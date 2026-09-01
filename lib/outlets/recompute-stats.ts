import { createAdminClient } from "@/lib/supabase/admin";
import type { OutletStatus } from "@/types/database";

const CRITICAL_NEGATIVE_24H = 4;
const ATTENTION_NEGATIVE_24H = 2;

/** Derives operational status from current rating + recent low-rating volume. */
export function deriveOutletStatus(currentRating: number, negative24hCount: number): OutletStatus {
  if (negative24hCount >= CRITICAL_NEGATIVE_24H) return "critical";
  if (negative24hCount >= ATTENTION_NEGATIVE_24H) return "attention";
  if (currentRating > 0 && currentRating < 4.0) return "watch";
  return "good";
}

/** Count of rating<=2 reviews for an outlet in the last 24 hours. */
export async function getNegative24hCount(outletId: string): Promise<number> {
  const supabase = createAdminClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("outlet_id", outletId)
    .lte("rating", 2)
    .gte("google_created_at", since24h);
  return count ?? 0;
}

/**
 * Recomputes an outlet's current_rating/total_reviews from its reviews, and
 * derives an operational status (good/watch/attention/critical) from recent
 * low-rating volume. Called after every review upsert.
 */
export async function recomputeOutletStats(outletId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: reviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("outlet_id", outletId);

  const totalReviews = reviews?.length ?? 0;
  const currentRating = totalReviews > 0
    ? Math.round((reviews!.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10
    : 0;

  const negCount = await getNegative24hCount(outletId);
  const status = deriveOutletStatus(currentRating, negCount);

  await supabase
    .from("outlets")
    .update({ current_rating: currentRating, total_reviews: totalReviews, status })
    .eq("id", outletId);
}
