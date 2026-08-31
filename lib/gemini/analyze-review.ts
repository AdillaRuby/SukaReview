import { createAdminClient } from "@/lib/supabase/admin";
import { analyzeReviewWithGemini } from "./client";

const MAX_ATTEMPTS = 3;

interface ReviewForAnalysis {
  id: string;
  rating: number;
  comment: string | null;
  analysis_attempts: number;
  outlets: { name: string } | null;
}

/**
 * Runs Gemini analysis for one review and persists the result. Never throws
 * — a failure marks analysis_status = "failed" so the review stays visible
 * with a retry affordance instead of disappearing or blocking the write
 * that stored it in the first place (see sql/005_reviews.sql).
 */
export async function analyzeAndPersistReview(reviewId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: rawReview, error: fetchError } = await supabase
    .from("reviews")
    .select("id, rating, comment, analysis_attempts, outlets(name)")
    .eq("id", reviewId)
    .single();

  if (fetchError || !rawReview) {
    console.error(`[gemini] review ${reviewId} not found for analysis`, fetchError);
    return;
  }

  const review = rawReview as unknown as ReviewForAnalysis;
  const outletName = review.outlets?.name ?? "Suka Shawarma";

  try {
    const result = await analyzeReviewWithGemini({
      outletName,
      rating: review.rating,
      comment: review.comment,
    });

    const { error: updateError } = await supabase
      .from("reviews")
      .update({
        sentiment: result.sentiment,
        ai_summary: result.summary,
        urgency: result.urgency,
        analysis_status: "completed",
        analysis_error: null,
        analysis_attempts: (review.analysis_attempts ?? 0) + 1,
      })
      .eq("id", reviewId);

    if (updateError) throw updateError;

    await supabase.from("review_categories").delete().eq("review_id", reviewId);

    const aspectByCategory = new Map(result.aspects.map((a) => [a.category, a.sentiment]));
    const categoryRows = result.categories.map((category) => ({
      review_id: reviewId,
      category,
      aspect_sentiment: aspectByCategory.get(category) ?? result.sentiment,
    }));

    if (categoryRows.length > 0) {
      const { error: categoriesError } = await supabase.from("review_categories").insert(categoryRows);
      if (categoriesError) throw categoriesError;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Gemini error";
    console.error(`[gemini] analysis failed for review ${reviewId}:`, message);

    await supabase
      .from("reviews")
      .update({
        analysis_status: "failed",
        analysis_error: message.slice(0, 500),
        analysis_attempts: (review.analysis_attempts ?? 0) + 1,
      })
      .eq("id", reviewId);
  }
}

export async function retryFailedAnalyses(limit = 20): Promise<number> {
  const supabase = createAdminClient();

  const { data: pending } = await supabase
    .from("reviews")
    .select("id")
    .eq("analysis_status", "failed")
    .lt("analysis_attempts", MAX_ATTEMPTS)
    .limit(limit);

  if (!pending || pending.length === 0) return 0;

  await Promise.all(pending.map((r) => analyzeAndPersistReview(r.id)));
  return pending.length;
}
