import { createAdminClient } from "@/lib/supabase/admin";
import { listGoogleLocations } from "./locations";
import { listGoogleReviews } from "./reviews";
import { configureReviewNotifications } from "./notifications";
import { ingestGoogleReview, processIngestedReview } from "@/lib/reviews/ingest-review";
import { recomputeOutletStats } from "@/lib/outlets/recompute-stats";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/suka shawarma/i, "")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || `outlet-${Date.now()}`;
}

export interface SyncProgress {
  step: "connecting" | "outlets" | "reviews" | "analyzing" | "completed";
  outletsCount: number;
  reviewsCount: number;
}

/**
 * Full initial sync: accounts -> locations -> outlets -> reviews -> Gemini
 * queue. Runs once right after OAuth connect (see
 * app/api/google/oauth/callback) and again whenever "Sync Now" is pressed.
 */
export async function runFullSync(
  accessToken: string,
  accountId: string,
  onProgress?: (p: SyncProgress) => void
): Promise<SyncProgress> {
  const supabase = createAdminClient();

  onProgress?.({ step: "outlets", outletsCount: 0, reviewsCount: 0 });

  const locations = await listGoogleLocations(accessToken, accountId);
  const outletIds: { id: string; name: string; locationId: string }[] = [];

  for (const location of locations) {
    const { data: existing } = await supabase
      .from("outlets")
      .select("id, slug")
      .eq("google_location_id", location.locationId)
      .maybeSingle();

    const slug = existing?.slug ?? slugify(location.name);

    const { data: outlet, error } = await supabase
      .from("outlets")
      .upsert(
        {
          google_location_id: location.locationId,
          google_place_id: location.placeId,
          name: location.name,
          slug,
          address: location.address,
          city: location.city,
          latitude: location.latitude,
          longitude: location.longitude,
        },
        { onConflict: "google_location_id" }
      )
      .select("id, name")
      .single();

    if (!error && outlet) {
      outletIds.push({ id: outlet.id, name: outlet.name, locationId: location.locationId });
    }
  }

  onProgress?.({ step: "reviews", outletsCount: outletIds.length, reviewsCount: 0 });

  let reviewsCount = 0;
  const pendingAnalysis: { outletId: string; outletName: string; reviewId: string; rating: number }[] = [];

  for (const outlet of outletIds) {
    const reviews = await listGoogleReviews(accessToken, accountId, outlet.locationId);

    for (const review of reviews) {
      const result = await ingestGoogleReview(outlet.id, review);
      reviewsCount += 1;
      if (result.isNew) {
        pendingAnalysis.push({
          outletId: outlet.id,
          outletName: outlet.name,
          reviewId: result.reviewId,
          rating: review.starRating,
        });
      }
    }

    await recomputeOutletStats(outlet.id);
  }

  onProgress?.({ step: "analyzing", outletsCount: outletIds.length, reviewsCount });

  for (const item of pendingAnalysis) {
    await processIngestedReview({ reviewId: item.reviewId, outletId: item.outletId, isNew: true }, item.outletName, item.rating);
  }

  try {
    await configureReviewNotifications(accessToken, accountId);
  } catch (err) {
    console.error("[google-sync] failed to configure Pub/Sub notifications:", err);
  }

  await supabase
    .from("google_connections")
    .update({
      locations_count: outletIds.length,
      last_sync_at: new Date().toISOString(),
      last_sync_status: "success",
      status: "connected",
    })
    .eq("account_id", accountId);

  const final: SyncProgress = { step: "completed", outletsCount: outletIds.length, reviewsCount };
  onProgress?.(final);
  return final;
}
