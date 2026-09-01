import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPlacesSync, type PlacesSyncSummary } from "@/lib/places/sync";

// Puppeteer page loads are much slower than a fetch call — scrape mode
// needs more headroom than api mode. 300 requires at least a Vercel Pro
// plan; if deploying scrape mode on Hobby, expect this route to time out
// on larger outlet counts (the per-outlet try/catch in runPlacesSync means
// a timeout mid-run still leaves already-processed outlets' data intact).
export const maxDuration = process.env.GOOGLE_PLACES_MODE === "scrape" ? 300 : 60;

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
