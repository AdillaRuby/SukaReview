import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestGoogleReview, processIngestedReview } from "@/lib/reviews/ingest-review";
import type { IngestResult } from "@/lib/reviews/ingest-review";
import { getPlaceDetails } from "./client";
import { deriveOutletStatus, getNegative24hCount } from "@/lib/outlets/recompute-stats";
import type { GoogleReview } from "@/types/google";

// Vercel Hobby caps function duration at 60s. 20 outlets processed one at a
// time (each a network round trip to the Places provider) plus a synchronous
// Gemini call per new review can easily exceed that. Batching outlets keeps
// wall-clock time down; deferring the AI/alert step to `after()` (only valid
// inside a Next.js request lifecycle — this function must only be called
// from route handlers, never a plain script) keeps it off the response path
// entirely.
const OUTLET_CONCURRENCY = 10;

export interface PlacesSyncOutletError {
  outletId: string;
  outletName: string;
  message: string;
}

export interface PlacesSyncSummary {
  outletsProcessed: number;
  outletsSkippedNoPlaceId: number;
  newReviewsFound: number;
  errors: PlacesSyncOutletError[];
}

/**
 * Polls the Places API for every active outlet that has a google_place_id,
 * ingests its reviews through the standard pipeline, and overwrites the
 * outlet's rating/total_reviews with Places' own authoritative numbers
 * (never recomputeOutletStats — see Global Constraints). One outlet
 * failing does not stop the rest, since this runs unattended via cron.
 */
export async function runPlacesSync(): Promise<PlacesSyncSummary> {
  const supabase = createAdminClient();

  const { data: outlets, error: outletsError } = await supabase
    .from("outlets")
    .select("id, name, google_place_id")
    .eq("is_active", true);

  if (outletsError) {
    throw new Error(`Failed to list outlets: ${outletsError.message}`);
  }

  const rows = outlets ?? [];
  const withPlaceId = rows.filter((o): o is typeof o & { google_place_id: string } => !!o.google_place_id);
  const outletsSkippedNoPlaceId = rows.length - withPlaceId.length;

  let outletsProcessed = 0;
  let newReviewsFound = 0;
  const errors: PlacesSyncOutletError[] = [];

  async function processOutlet(outlet: (typeof withPlaceId)[number]): Promise<void> {
    try {
      const details = await getPlaceDetails(outlet.google_place_id);

      // Ingest every review first. This internally recomputes
      // current_rating from whatever's stored so far — an incidental,
      // wrong value for a Places-sourced outlet — so we deliberately
      // overwrite it with the Places-authoritative numbers below BEFORE
      // any processIngestedReview call, since evaluateOutletAlerts reads
      // outlets.current_rating fresh from the DB and must never see the
      // recompute-derived value here.
      const newlyIngested: { result: IngestResult; review: GoogleReview }[] = [];
      for (const review of details.reviews) {
        const result = await ingestGoogleReview(outlet.id, review);
        if (result.isNew) newlyIngested.push({ result, review });
      }

      if (details.rating !== null && details.userRatingCount !== null) {
        const negCount = await getNegative24hCount(outlet.id);
        const status = deriveOutletStatus(details.rating, negCount);

        const { error: updateError } = await supabase
          .from("outlets")
          .update({ current_rating: details.rating, total_reviews: details.userRatingCount, status })
          .eq("id", outlet.id);

        if (updateError) {
          throw new Error(`Failed to update outlet rating: ${updateError.message}`);
        }
      }

      // Deferred to run after the response is sent — Gemini analysis is the
      // slowest part of a sync and none of it needs to finish before the
      // caller (cron or "Sync Now") gets its outletsProcessed/newReviewsFound
      // summary back.
      for (const { result, review } of newlyIngested) {
        newReviewsFound += 1;
        after(() => processIngestedReview(result, outlet.name, review.starRating));
      }

      outletsProcessed += 1;
    } catch (err) {
      errors.push({
        outletId: outlet.id,
        outletName: outlet.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  for (let i = 0; i < withPlaceId.length; i += OUTLET_CONCURRENCY) {
    const batch = withPlaceId.slice(i, i + OUTLET_CONCURRENCY);
    await Promise.all(batch.map(processOutlet));
  }

  return { outletsProcessed, outletsSkippedNoPlaceId, newReviewsFound, errors };
}
