// Types for the Google Business Profile integration layer (lib/google/*).
// Deliberately independent from Google's raw API response shapes so the rest
// of the app never depends on Google's wire format directly.

export interface GoogleAccount {
  accountId: string;
  accountName: string;
  type: string;
}

export interface GoogleLocation {
  locationId: string;
  accountId: string;
  name: string;
  placeId: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface GoogleReviewAuthor {
  displayName: string;
  photoUrl: string | null;
}

export interface GoogleReview {
  reviewId: string;
  locationId: string;
  reviewer: GoogleReviewAuthor;
  starRating: 1 | 2 | 3 | 4 | 5;
  comment: string | null;
  createTime: string;
  updateTime: string;
}

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
}

/** Parsed shape of a Google Business Profile Pub/Sub notification payload. */
export interface GoogleReviewNotification {
  eventType: "NEW_REVIEW" | "UPDATED_REVIEW" | "GOOGLE_UPDATE" | "NEW_QUESTION" | "UPDATED_QUESTION" | "DELETED_QUESTION" | "NEW_ANSWER" | "UPDATED_ANSWER" | "DELETED_ANSWER";
  locationName: string;
  reviewId?: string;
}

export type GoogleMode = "demo" | "live";
