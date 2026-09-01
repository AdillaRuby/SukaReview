import type { GoogleReview } from "./google";

/** Result of a Places API (New) Place Details lookup. */
export interface PlaceDetails {
  rating: number | null;
  userRatingCount: number | null;
  reviews: GoogleReview[];
}

/** One candidate from a Places API (New) Text Search. */
export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
}
