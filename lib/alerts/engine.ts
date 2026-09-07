import { createAdminClient } from "@/lib/supabase/admin";
import { sendLowRatingReviewEmail } from "./notify-email";
import type { AlertSeverity, AlertType } from "@/types/database";

interface EvaluateInput {
  outletId: string;
  outletName: string;
  triggerReviewId?: string;
  triggerRating?: number;
}

/**
 * Runs all alert rules for one outlet after a review changes. Idempotent-ish:
 * re-raises LOW_OUTLET_RATING / NEGATIVE_SPIKE only if there isn't already an
 * active alert of that type, so a burst of reviews doesn't spam duplicates.
 */
export async function evaluateOutletAlerts({
  outletId,
  outletName,
  triggerReviewId,
  triggerRating,
}: EvaluateInput): Promise<void> {
  const supabase = createAdminClient();

  const { data: settings } = await supabase.from("alert_settings").select("*").single();
  const thresholds = settings ?? {
    low_outlet_rating_threshold: 3.8,
    urgent_review_rating_threshold: 2,
    negative_spike_count: 3,
    negative_spike_window_hours: 24,
    rating_drop_threshold: 0.3,
    notify_email_enabled: false,
    notify_email: null,
  };

  const hasActiveAlert = async (type: AlertType, reviewId?: string) => {
    let query = supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("outlet_id", outletId)
      .eq("type", type)
      .eq("status", "active");
    if (reviewId) query = query.eq("review_id", reviewId);
    const { count } = await query;
    return (count ?? 0) > 0;
  };

  const createAlert = async (params: {
    type: AlertType;
    severity: AlertSeverity;
    title: string;
    message: string;
    reviewId?: string;
  }) => {
    await supabase.from("alerts").insert({
      outlet_id: outletId,
      review_id: params.reviewId ?? null,
      type: params.type,
      severity: params.severity,
      title: params.title,
      message: params.message,
      status: "active",
    });
  };

  // Rule 1: a single very-low review just came in. Deduped per review (not
  // just per outlet) so a Pub/Sub redelivery or a reviewer editing their
  // text doesn't re-raise the same alert on every UPDATED_REVIEW event.
  if (
    triggerReviewId &&
    triggerRating !== undefined &&
    triggerRating <= thresholds.urgent_review_rating_threshold &&
    !(await hasActiveAlert("LOW_RATING_REVIEW", triggerReviewId))
  ) {
    await createAlert({
      type: "LOW_RATING_REVIEW",
      severity: triggerRating === 1 ? "high" : "medium",
      title: outletName,
      message: `Review baru dengan rating ${triggerRating}⭐ masuk.`,
      reviewId: triggerReviewId,
    });

    if (thresholds.notify_email_enabled && thresholds.notify_email) {
      const { data: triggerReview } = await supabase
        .from("reviews")
        .select("reviewer_name, comment")
        .eq("id", triggerReviewId)
        .single();

      if (triggerReview) {
        await sendLowRatingReviewEmail({
          to: thresholds.notify_email,
          outletName,
          rating: triggerRating,
          reviewerName: triggerReview.reviewer_name,
          comment: triggerReview.comment,
        });
      }
    }
  }

  // Rule 2: negative-review spike in the configured time window.
  const windowStart = new Date(
    Date.now() - thresholds.negative_spike_window_hours * 60 * 60 * 1000
  ).toISOString();
  const { count: negativeCount } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("outlet_id", outletId)
    .lte("rating", 2)
    .gte("google_created_at", windowStart);

  if ((negativeCount ?? 0) >= thresholds.negative_spike_count && !(await hasActiveAlert("NEGATIVE_SPIKE"))) {
    await createAlert({
      type: "NEGATIVE_SPIKE",
      severity: (negativeCount ?? 0) >= thresholds.negative_spike_count * 1.5 ? "critical" : "high",
      title: outletName,
      message: `${negativeCount} review rating ≤2⭐ masuk dalam ${thresholds.negative_spike_window_hours} jam.`,
    });
  }

  // Rule 3: outlet average rating has fallen below the floor.
  const { data: outlet } = await supabase
    .from("outlets")
    .select("current_rating")
    .eq("id", outletId)
    .single();

  if (
    outlet &&
    outlet.current_rating > 0 &&
    outlet.current_rating < thresholds.low_outlet_rating_threshold &&
    !(await hasActiveAlert("LOW_OUTLET_RATING"))
  ) {
    await createAlert({
      type: "LOW_OUTLET_RATING",
      severity: outlet.current_rating < thresholds.low_outlet_rating_threshold - 0.5 ? "high" : "medium",
      title: outletName,
      message: `Rating outlet turun ke ${outlet.current_rating.toFixed(1)}⭐, di bawah threshold ${thresholds.low_outlet_rating_threshold}⭐.`,
    });
  }

  // Rule 4: rating trending down (last 7d avg vs prior 7d avg).
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: recent }, { data: prior }] = await Promise.all([
    supabase.from("reviews").select("rating").eq("outlet_id", outletId).gte("google_created_at", sevenDaysAgo),
    supabase
      .from("reviews")
      .select("rating")
      .eq("outlet_id", outletId)
      .gte("google_created_at", fourteenDaysAgo)
      .lt("google_created_at", sevenDaysAgo),
  ]);

  if (recent && prior && recent.length >= 3 && prior.length >= 3) {
    const avg = (rows: { rating: number }[]) => rows.reduce((s, r) => s + r.rating, 0) / rows.length;
    const recentAvg = avg(recent);
    const priorAvg = avg(prior);
    const drop = priorAvg - recentAvg;

    if (drop >= thresholds.rating_drop_threshold && !(await hasActiveAlert("RATING_DROP"))) {
      await createAlert({
        type: "RATING_DROP",
        severity: drop >= thresholds.rating_drop_threshold * 2 ? "critical" : "high",
        title: outletName,
        message: `Rating turun dari ${priorAvg.toFixed(1)} ke ${recentAvg.toFixed(1)} dalam 7 hari terakhir.`,
      });
    }
  }
}
