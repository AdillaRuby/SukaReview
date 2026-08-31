import { createAdminClient } from "@/lib/supabase/admin";

const CRITICAL_NEGATIVE_24H = 4;
const ATTENTION_NEGATIVE_24H = 2;

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

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: negative24h } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("outlet_id", outletId)
    .lte("rating", 2)
    .gte("google_created_at", since24h);

  const negCount = negative24h ?? 0;
  let status: "good" | "watch" | "attention" | "critical" = "good";
  if (negCount >= CRITICAL_NEGATIVE_24H) status = "critical";
  else if (negCount >= ATTENTION_NEGATIVE_24H) status = "attention";
  else if (currentRating > 0 && currentRating < 4.0) status = "watch";

  await supabase
    .from("outlets")
    .update({ current_rating: currentRating, total_reviews: totalReviews, status })
    .eq("id", outletId);
}
