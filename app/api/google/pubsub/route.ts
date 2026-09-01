import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken } from "@/lib/google/token-store";
import { getGoogleReview } from "@/lib/google/reviews";
import { ingestGoogleReview, processIngestedReview } from "@/lib/reviews/ingest-review";
import type { GoogleReviewNotification } from "@/types/google";

interface PubSubPushBody {
  message: {
    data: string; // base64-encoded JSON
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

function extractLocationId(locationName: string): string {
  // Accepts "accounts/{id}/locations/{id}" or plain "locations/{id}".
  const match = locationName.match(/locations\/[^/]+/);
  return match ? match[0] : locationName;
}

function extractReviewId(reviewName?: string): string | undefined {
  if (!reviewName) return undefined;
  const match = reviewName.match(/reviews\/([^/]+)$/);
  return match ? match[1] : reviewName;
}

/**
 * Google Cloud Pub/Sub push endpoint. Must validate + respond fast (Google
 * retries/backs off aggressively on slow or failing endpoints) — so this
 * handler only does the cheap, idempotent DB upsert inline, then defers
 * Gemini analysis + alert evaluation to `after()` so they run post-response
 * without blocking or risking a Pub/Sub timeout.
 */
export async function POST(request: NextRequest) {
  const verificationToken = process.env.GOOGLE_PUBSUB_VERIFICATION_TOKEN;
  if (!verificationToken) {
    console.error("[pubsub] GOOGLE_PUBSUB_VERIFICATION_TOKEN is not configured — rejecting push");
    return NextResponse.json({ error: "Endpoint not configured" }, { status: 503 });
  }
  const provided = request.nextUrl.searchParams.get("token");
  if (provided !== verificationToken) {
    return NextResponse.json({ error: "Invalid verification token" }, { status: 401 });
  }

  let body: PubSubPushBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body?.message?.data) {
    // Acknowledge anyway — malformed/empty messages should not be retried forever.
    return NextResponse.json({ ok: true, skipped: "no message data" });
  }

  let notification: GoogleReviewNotification;
  try {
    const decoded = Buffer.from(body.message.data, "base64").toString("utf8");
    notification = JSON.parse(decoded);
  } catch (err) {
    console.error("[pubsub] failed to decode message.data:", err);
    return NextResponse.json({ ok: true, skipped: "undecodable payload" });
  }

  if (notification.eventType !== "NEW_REVIEW" && notification.eventType !== "UPDATED_REVIEW") {
    return NextResponse.json({ ok: true, skipped: notification.eventType });
  }

  const locationId = extractLocationId(notification.locationName);
  const reviewId = extractReviewId(notification.reviewId);

  const supabase = createAdminClient();
  const { data: outlet } = await supabase
    .from("outlets")
    .select("id, name, google_location_id")
    .eq("google_location_id", locationId)
    .maybeSingle();

  if (!outlet) {
    console.warn(`[pubsub] no outlet found for location ${locationId}`);
    return NextResponse.json({ ok: true, skipped: "unknown location" });
  }

  if (!reviewId) {
    return NextResponse.json({ ok: true, skipped: "no review id in payload" });
  }

  try {
    const { data: connectionAccount } = await supabase
      .from("google_connections")
      .select("account_id")
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!connectionAccount) {
      return NextResponse.json({ ok: true, skipped: "no connected account" });
    }

    const accessToken = await getValidAccessToken(connectionAccount.account_id);
    const review = await getGoogleReview(accessToken, connectionAccount.account_id, locationId, reviewId);

    const result = await ingestGoogleReview(outlet.id, review);

    after(() => processIngestedReview(result, outlet.name, review.starRating));

    return NextResponse.json({ ok: true, reviewId: result.reviewId });
  } catch (err) {
    console.error("[pubsub] failed to process notification:", err);
    // 500 so Pub/Sub retries with backoff instead of silently dropping the event.
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
