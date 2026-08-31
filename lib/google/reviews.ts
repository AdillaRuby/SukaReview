import { isLiveMode } from "./auth";
import { generateDemoReviewsForLocation } from "./demo-data";
import type { GoogleReview } from "@/types/google";

const MYBUSINESS_V4_BASE = "https://mybusiness.googleapis.com/v4";

const STAR_RATING_MAP: Record<string, 1 | 2 | 3 | 4 | 5> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

interface RawReview {
  reviewId: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  starRating: string;
  comment?: string;
  createTime: string;
  updateTime: string;
}

interface RawReviewsResponse {
  reviews?: RawReview[];
  nextPageToken?: string;
}

function mapRawReview(raw: RawReview, locationId: string): GoogleReview {
  return {
    reviewId: raw.reviewId,
    locationId,
    reviewer: {
      displayName: raw.reviewer?.displayName ?? "Google User",
      photoUrl: raw.reviewer?.profilePhotoUrl ?? null,
    },
    starRating: STAR_RATING_MAP[raw.starRating] ?? 5,
    comment: raw.comment ?? null,
    createTime: raw.createTime,
    updateTime: raw.updateTime,
  };
}

/** Fetches all historical reviews for one outlet (used during initial sync). */
export async function listGoogleReviews(
  accessToken: string,
  accountId: string,
  locationId: string
): Promise<GoogleReview[]> {
  if (!isLiveMode()) {
    const count = 3 + Math.floor(Math.random() * 6); // 3-8 reviews per outlet
    return generateDemoReviewsForLocation(locationId, count).map((r) => ({
      reviewId: r.googleReviewId,
      locationId: r.locationId,
      reviewer: { displayName: r.reviewerName, photoUrl: r.reviewerAvatar },
      starRating: r.rating,
      comment: r.comment,
      createTime: r.googleCreatedAt,
      updateTime: r.googleCreatedAt,
    }));
  }

  const shortLocationId = locationId.replace("locations/", "");
  const reviews: GoogleReview[] = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(
      `${MYBUSINESS_V4_BASE}/accounts/${accountId}/locations/${shortLocationId}/reviews`
    );
    url.searchParams.set("pageSize", "50");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Google reviews.list failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as RawReviewsResponse;
    reviews.push(...(data.reviews ?? []).map((r) => mapRawReview(r, locationId)));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return reviews;
}

/** Fetches a single review by ID — used after a Pub/Sub NEW_REVIEW/UPDATED_REVIEW notification. */
export async function getGoogleReview(
  accessToken: string,
  accountId: string,
  locationId: string,
  reviewId: string
): Promise<GoogleReview> {
  if (!isLiveMode()) {
    const [generated] = generateDemoReviewsForLocation(locationId, 1, 0);
    return {
      reviewId,
      locationId,
      reviewer: { displayName: generated.reviewerName, photoUrl: null },
      starRating: generated.rating,
      comment: generated.comment,
      createTime: generated.googleCreatedAt,
      updateTime: generated.googleCreatedAt,
    };
  }

  const shortLocationId = locationId.replace("locations/", "");
  const res = await fetch(
    `${MYBUSINESS_V4_BASE}/accounts/${accountId}/locations/${shortLocationId}/reviews/${reviewId}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Google reviews.get failed: ${res.status} ${await res.text()}`);
  }

  return mapRawReview((await res.json()) as RawReview, locationId);
}
