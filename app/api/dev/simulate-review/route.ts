import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleMode } from "@/lib/google/auth";
import { pickRandom, randomReviewerName, DEMO_REVIEW_TEMPLATES } from "@/lib/google/demo-data";
import { ingestGoogleReview, processIngestedReview } from "@/lib/reviews/ingest-review";

/**
 * Dev-only endpoint: injects one fake review into a random outlet so the
 * entire realtime pipeline (insert -> broadcast -> toast -> sound -> Gemini
 * -> alert rules) can be exercised without a live Google connection.
 * Refuses to run outside GOOGLE_MODE=demo, and in production requires an
 * explicit opt-in (see NEXT_PUBLIC_SHOW_DEV_SIMULATOR in .env.example).
 */
export async function POST() {
  const isProdLocked =
    process.env.NODE_ENV === "production" && process.env.NEXT_PUBLIC_SHOW_DEV_SIMULATOR !== "true";

  if (getGoogleMode() !== "demo" || isProdLocked) {
    return NextResponse.json({ error: "Simulator is only available in demo mode" }, { status: 403 });
  }

  const supabase = createAdminClient();
  const { data: outlets } = await supabase.from("outlets").select("id, name, google_location_id").eq("is_active", true);

  if (!outlets || outlets.length === 0) {
    return NextResponse.json({ error: "No outlets found — run the seed script first" }, { status: 400 });
  }

  const outlet = pickRandom(outlets);
  const template = pickRandom(DEMO_REVIEW_TEMPLATES);
  const reviewId = `demo-live-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  const result = await ingestGoogleReview(outlet.id, {
    reviewId,
    locationId: outlet.google_location_id,
    reviewer: { displayName: randomReviewerName(), photoUrl: null },
    starRating: template.rating,
    comment: template.comment,
    createTime: now,
    updateTime: now,
  });

  await processIngestedReview(result, outlet.name, template.rating);

  return NextResponse.json({ ok: true, reviewId: result.reviewId, outlet: outlet.name });
}
