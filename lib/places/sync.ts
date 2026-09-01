import { createAdminClient } from "@/lib/supabase/admin";
import { ingestGoogleReview, processIngestedReview } from "@/lib/reviews/ingest-review";
import { getPlaceDetails } from "./client";

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

  for (const outlet of withPlaceId) {
    try {
      const details = await getPlaceDetails(outlet.google_place_id);

      for (const review of details.reviews) {
        const result = await ingestGoogleReview(outlet.id, review);
        if (result.isNew) {
          newReviewsFound += 1;
          await processIngestedReview(result, outlet.name, review.starRating);
        }
      }

      if (details.rating !== null && details.userRatingCount !== null) {
        const { error: updateError } = await supabase
          .from("outlets")
          .update({ current_rating: details.rating, total_reviews: details.userRatingCount })
          .eq("id", outlet.id);

        if (updateError) {
          throw new Error(`Failed to update outlet rating: ${updateError.message}`);
        }
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

  return { outletsProcessed, outletsSkippedNoPlaceId, newReviewsFound, errors };
}
