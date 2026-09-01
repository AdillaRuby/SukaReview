import type { GoogleReview } from "@/types/google";
import type { PlaceDetails, PlaceSearchResult } from "@/types/places";

// Deliberately does NOT `import "server-only"` — scripts/resolve-places.ts
// imports this module via plain `tsx`, outside Next's bundler, and that
// package throws unconditionally when required outside Next's aliasing
// (see node_modules/server-only/index.js). Every sibling lib/google/*.ts
// file except token-crypto.ts follows the same convention.

const PLACES_BASE = "https://places.googleapis.com/v1";

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not configured");
  return key;
}

function clampRating(value: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(value);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as 1 | 2 | 3 | 4 | 5;
}

interface RawPlaceReview {
  name: string;
  rating: number;
  text?: { text: string };
  authorAttribution?: { displayName?: string; photoUri?: string };
  publishTime: string;
}

interface RawPlaceDetailsResponse {
  rating?: number;
  userRatingCount?: number;
  reviews?: RawPlaceReview[];
}

/** Fetches a place's aggregate rating/review count plus up to 5 reviews via the Places API. */
async function apiGetPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const res = await fetch(`${PLACES_BASE}/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask": "rating,userRatingCount,reviews",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Places API getPlaceDetails failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as RawPlaceDetailsResponse;

  const reviews: GoogleReview[] = (data.reviews ?? []).map((raw) => ({
    reviewId: raw.name,
    locationId: `places/${placeId}`,
    reviewer: {
      displayName: raw.authorAttribution?.displayName ?? "Google User",
      photoUrl: raw.authorAttribution?.photoUri ?? null,
    },
    starRating: clampRating(raw.rating),
    comment: raw.text?.text ?? null,
    createTime: raw.publishTime,
    updateTime: raw.publishTime,
  }));

  return {
    rating: data.rating ?? null,
    userRatingCount: data.userRatingCount ?? null,
    reviews,
  };
}

interface RawSearchTextResponse {
  places?: Array<{
    id: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    rating?: number;
    userRatingCount?: number;
  }>;
}

/** Text Search via the Places API — used only by scripts/resolve-places.ts to bootstrap outlets. */
async function apiSearchPlaceText(query: string): Promise<PlaceSearchResult | null> {
  const res = await fetch(`${PLACES_BASE}/places:searchText`, {
    method: "POST",
    headers: {
      "X-Goog-Api-Key": apiKey(),
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ textQuery: query }),
  });

  if (!res.ok) {
    throw new Error(`Places API searchText failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as RawSearchTextResponse;
  const first = data.places?.[0];
  if (!first) return null;

  return {
    placeId: first.id,
    name: first.displayName?.text ?? query,
    address: first.formattedAddress ?? null,
    latitude: first.location?.latitude ?? null,
    longitude: first.location?.longitude ?? null,
    rating: first.rating ?? null,
    userRatingCount: first.userRatingCount ?? null,
  };
}

function isScrapeMode(): boolean {
  return process.env.GOOGLE_PLACES_MODE === "scrape";
}

/** Fetches a place's aggregate rating/review count plus up to 5 reviews. */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
  if (isScrapeMode()) {
    const { scrapeGetPlaceDetails } = await import("./scrape-browser");
    return scrapeGetPlaceDetails(placeId);
  }
  return apiGetPlaceDetails(placeId);
}

/** Text Search — used only by scripts/resolve-places.ts to bootstrap outlets. */
export async function searchPlaceText(query: string): Promise<PlaceSearchResult | null> {
  if (isScrapeMode()) {
    const { scrapeSearchPlaceText } = await import("./scrape-browser");
    return scrapeSearchPlaceText(query);
  }
  return apiSearchPlaceText(query);
}
