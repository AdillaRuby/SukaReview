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

  const baseRow = {
    google_review_id: review.reviewId,
    outlet_id: outletId,
    reviewer_name: review.reviewer.displayName,
    reviewer_avatar: review.reviewer.photoUrl,
    rating: review.starRating,
    comment: review.comment,
    google_created_at: review.createTime,
    google_updated_at: review.updateTime,
    synced_at: new Date().toISOString(),
  };

  // Atomic insert-if-absent (ON CONFLICT DO NOTHING at the DB level) instead
  // of a SELECT-then-upsert: Pub/Sub is at-least-once delivery, so two
  // concurrent notifications for the same brand-new review must not both
  // observe "not found" and both treat it as new (duplicate Gemini calls +
  // duplicate alerts).
  const { data: inserted, error: insertError } = await supabase
    .from("reviews")
    .upsert(
      { ...baseRow, analysis_status: "pending" as const },
      { onConflict: "google_review_id", ignoreDuplicates: true }
    )
    .select("id")
    .maybeSingle();

  if (insertError) {
    throw new Error(`Failed to insert review ${review.reviewId}: ${insertError.message}`);
  }

  const isNew = !!inserted;
  let reviewId = inserted?.id;

  if (!isNew) {
    const { data: updated, error: updateError } = await supabase
      .from("reviews")
      .update(baseRow)
      .eq("google_review_id", review.reviewId)
      .select("id")
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to update review ${review.reviewId}: ${updateError?.message}`);
    }
    reviewId = updated.id;
  }

  await recomputeOutletStats(outletId);

  return { reviewId: reviewId!, outletId, isNew };
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
