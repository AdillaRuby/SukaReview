import { createAdminClient } from "@/lib/supabase/admin";
import { recomputeOutletStats } from "@/lib/outlets/recompute-stats";
import { evaluateOutletAlerts } from "@/lib/alerts/engine";
import { analyzeAndPersistReview } from "@/lib/gemini/analyze-review";
import type { GoogleReview } from "@/types/google";

export interface IngestResult {
  reviewId: string;
  outletId: string;
  isNew: boolean;
}

/**
 * Idempotent review ingestion: upsert by google_review_id (so repeated
 * Pub/Sub deliveries never duplicate), recompute outlet aggregates, run
 * alert rules, and kick off Gemini analysis. Analysis runs synchronously
 * here — callers that are latency-sensitive (the Pub/Sub webhook) should
 * wrap the Gemini + alert steps in `after()` instead of awaiting this
 * directly. See app/api/google/pubsub/route.ts.
 */
export async function ingestGoogleReview(
  outletId: string,
  review: GoogleReview
): Promise<IngestResult> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("google_review_id", review.reviewId)
    .maybeSingle();

  const isNew = !existing;

  const { data: saved, error } = await supabase
    .from("reviews")
    .upsert(
      {
        google_review_id: review.reviewId,
        outlet_id: outletId,
        reviewer_name: review.reviewer.displayName,
        reviewer_avatar: review.reviewer.photoUrl,
        rating: review.starRating,
        comment: review.comment,
        google_created_at: review.createTime,
        google_updated_at: review.updateTime,
        synced_at: new Date().toISOString(),
        ...(isNew ? { analysis_status: "pending" as const } : {}),
      },
      { onConflict: "google_review_id" }
    )
    .select("id")
    .single();

  if (error || !saved) {
    throw new Error(`Failed to upsert review ${review.reviewId}: ${error?.message}`);
  }

  await recomputeOutletStats(outletId);

  return { reviewId: saved.id, outletId, isNew };
}

/** Runs the "downstream" work for a newly-ingested review: AI + alerts. */
export async function processIngestedReview(
  result: IngestResult,
  outletName: string,
  rating: number
): Promise<void> {
  await analyzeAndPersistReview(result.reviewId);
  await evaluateOutletAlerts({
    outletId: result.outletId,
    outletName,
    triggerReviewId: result.reviewId,
    triggerRating: rating,
  });
}
