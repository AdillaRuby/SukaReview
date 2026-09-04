import type { GoogleReview } from "@/types/google";
import type { PlaceDetails, PlaceSearchResult } from "@/types/places";

// Deliberately does NOT `import "server-only"` — same convention as
// lib/places/client.ts, so this stays importable from plain `tsx` scripts.

const SERPAPI_BASE = "https://serpapi.com/search.json";

function apiKey(): string {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) throw new Error("SERPAPI_API_KEY is not configured");
  return key;
}

function clampRating(value: number): 1 | 2 | 3 | 4 | 5 {
  const rounded = Math.round(value);
  if (rounded <= 1) return 1;
  if (rounded >= 5) return 5;
  return rounded as 1 | 2 | 3 | 4 | 5;
}

// Outlets resolved earlier via the Puppeteer scraper store a full Google Maps
// URL as google_place_id, which embeds the same hex:hex feature id ("data_id"
// in SerpApi's vocabulary) inside a `!1s<data_id>!` URL segment. Outlets
// resolved directly via SerpApi store a bare data_id. Handle both.
function extractDataId(placeId: string): string {
  const match = placeId.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  return match ? match[1] : placeId;
}

interface SerpApiPlaceResult {
  data_id?: string;
  title?: string;
  address?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  rating?: number;
  reviews?: number;
}

interface SerpApiMapsResponse {
  place_results?: SerpApiPlaceResult;
  local_results?: SerpApiPlaceResult[];
  error?: string;
}

interface SerpApiReview {
  review_id: string;
  rating: number;
  snippet?: string;
  iso_date: string;
  iso_date_of_last_edit?: string;
  user?: { name?: string; thumbnail?: string };
}

interface SerpApiReviewsResponse {
  place_info?: { rating?: number; reviews?: number };
  reviews?: SerpApiReview[];
  error?: string;
}

async function fetchJson<T>(params: Record<string, string>): Promise<T> {
  const url = new URL(SERPAPI_BASE);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  url.searchParams.set("api_key", apiKey());

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`SerpApi ${params.engine} failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as T & { error?: string };
  if (data.error) throw new Error(`SerpApi ${params.engine} error: ${data.error}`);
  return data;
}

/** Text Search via SerpApi's google_maps engine — used to bootstrap outlets. */
export async function serpapiSearchPlaceText(query: string): Promise<PlaceSearchResult | null> {
  const data = await fetchJson<SerpApiMapsResponse>({ engine: "google_maps", q: query, hl: "id" });
  const place = data.place_results ?? data.local_results?.[0];
  if (!place?.data_id) return null;

  return {
    placeId: place.data_id,
    name: place.title ?? query,
    address: place.address ?? null,
    latitude: place.gps_coordinates?.latitude ?? null,
    longitude: place.gps_coordinates?.longitude ?? null,
    rating: place.rating ?? null,
    userRatingCount: place.reviews ?? null,
  };
}

/** Fetches a place's aggregate rating/review count plus recent reviews via SerpApi. */
export async function serpapiGetPlaceDetails(placeId: string): Promise<PlaceDetails> {
  const dataId = extractDataId(placeId);

  // google_maps_reviews returns both the reviews list and a place_info block
  // with the aggregate rating/count, so a separate google_maps lookup isn't
  // needed (and the google_maps engine rejects data_id-only lookups anyway —
  // it requires a `q` text query).
  const reviewsData = await fetchJson<SerpApiReviewsResponse>({
    engine: "google_maps_reviews",
    data_id: dataId,
    hl: "id",
    sort_by: "newestFirst",
  });

  const reviews: GoogleReview[] = (reviewsData.reviews ?? []).map((raw) => ({
    reviewId: raw.review_id,
    locationId: `places/${dataId}`,
    reviewer: {
      displayName: raw.user?.name ?? "Google User",
      photoUrl: raw.user?.thumbnail ?? null,
    },
    starRating: clampRating(raw.rating),
    comment: raw.snippet ?? null,
    createTime: raw.iso_date,
    updateTime: raw.iso_date_of_last_edit ?? raw.iso_date,
  }));

  return {
    rating: reviewsData.place_info?.rating ?? null,
    userRatingCount: reviewsData.place_info?.reviews ?? null,
    reviews,
  };
}
