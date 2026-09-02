import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPlacesSync, type PlacesSyncSummary } from "@/lib/places/sync";

// Puppeteer page loads are much slower than a fetch call, so scrape mode
// needs more headroom than api mode needs. Route segment config exports
// are extracted via static AST analysis at build time and can't read
// process.env — an env-conditional ternary here is silently dropped by
// Next's extractor (verified against this repo's own Next build
// analyzer), which would leave maxDuration completely unset rather than
// falling back to anything. So this has to stay a static literal: kept at
// the Hobby-plan-safe default api mode needs. If deploying with
// GOOGLE_PLACES_MODE=scrape, change this literal to 300 before building
// (requires at least a Vercel Pro plan).
export const maxDuration = 60;

async function performSync(): Promise<PlacesSyncSummary> {
  const supabase = createAdminClient();
  await supabase
    .from("places_sync_state")
    .update({ last_status: "running", last_error: null })
    .eq("id", true);

  try {
    const summary = await runPlacesSync();
    const allFailed = summary.outletsProcessed === 0 && summary.errors.length > 0;

    await supabase
      .from("places_sync_state")
      .update({
        last_status: allFailed ? "failed" : "success",
        last_synced_at: new Date().toISOString(),
        last_error:
          summary.errors.length > 0
            ? summary.errors.map((e) => `${e.outletName}: ${e.message}`).join("; ").slice(0, 500)
            : null,
        outlets_synced: summary.outletsProcessed,
        new_reviews_found: summary.newReviewsFound,
      })
      .eq("id", true);

    return summary;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    await supabase
      .from("places_sync_state")
      .update({ last_status: "failed", last_error: message.slice(0, 500), outlets_synced: 0, new_reviews_found: 0 })
      .eq("id", true);
    throw err;
  }
}

/** Vercel Cron entry point — see vercel.json. Vercel always invokes cron paths with GET. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await performSync();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}

/** Manual "Sync Now" button in Settings. */
export async function POST() {
  const profile = await getCurrentProfile();
  if (!profile || !canManage(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const summary = await performSync();
    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed" }, { status: 500 });
  }
}
