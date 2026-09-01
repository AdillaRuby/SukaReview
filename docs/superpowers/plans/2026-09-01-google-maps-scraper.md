# Google Maps Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Puppeteer-based Google Maps scraper as a drop-in alternative implementation of `getPlaceDetails`/`searchPlaceText`, selected via `GOOGLE_PLACES_MODE=scrape`, so every downstream file (`lib/places/sync.ts`, the sync route, the Settings UI, `scripts/resolve-places.ts`) works unmodified regardless of which mode is active.

**Architecture:** A pure parsing module (`lib/places/scrape-parse.ts`) separated from a Puppeteer automation module (`lib/places/scrape-browser.ts`), so the parsing logic — the part actually worth testing — is fully unit-tested without a real browser. `lib/places/client.ts` gains a mode switch that delegates to either the existing Places-API implementation or this new scraping one.

**Tech Stack:** `puppeteer-core`, `puppeteer-extra` + `puppeteer-extra-plugin-stealth`, `@sparticuz/chromium` (serverless-compatible Chromium for Vercel).

## Global Constraints

- Every selector and DOM pattern in this plan was verified live against a real Google Maps listing during design (not guessed from memory) — see `docs/superpowers/specs/2026-09-01-google-maps-scraper-design.md` for the verification notes. Selectors WILL need maintenance if Google changes its markup; this is an accepted trade-off, not a defect.
- `aria-label` patterns are the primary extraction signal (semantic, more stable); CSS class names are a secondary/fallback signal only.
- `place_id`/`placeId` in scrape mode is the full, re-navigable Google Maps URL for that business — not an API-issued ID. No DB schema change; `outlets.google_place_id` is free text either way.
- A missing/unexpected DOM structure (blocked, CAPTCHA'd, or Google changed the markup) must throw a clear, named error — never silently return empty/null data, since `runPlacesSync`'s per-outlet `try/catch` (already built) needs a real error to record.
- `lib/places/scrape-browser.ts` is not unit tested (no real browser in CI/sandbox); verify it manually against a real Google Maps listing on your own machine once implemented — an implementer subagent in a sandboxed environment cannot do this itself.
- Spec: `docs/superpowers/specs/2026-09-01-google-maps-scraper-design.md`

---

### Task 1: `lib/places/scrape-parse.ts` — pure parsing

**Files:**
- Create: `lib/places/scrape-parse.ts`
- Test: `lib/places/scrape-parse.test.ts`

**Interfaces:**
- Produces: `parseAggregateRating(ariaLabel: string): { rating: number; reviewCount: number } | null`, `parseReviewStars(ariaLabel: string): 1 | 2 | 3 | 4 | 5 | null`, `parseRelativeTimeToISO(text: string, now?: Date): string | null` — all consumed by Task 2 (`scrape-browser.ts`).

- [ ] **Step 1: Write the failing tests**

Create `lib/places/scrape-parse.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseAggregateRating, parseReviewStars, parseRelativeTimeToISO } from "./scrape-parse";

describe("parseAggregateRating", () => {
  it("parses the verified Indonesian format (comma decimal, dot thousands)", () => {
    expect(parseAggregateRating("4,6 bintang 4.046 Ulasan")).toEqual({ rating: 4.6, reviewCount: 4046 });
  });

  it("parses a review count with no thousands separator", () => {
    expect(parseAggregateRating("4,9 bintang 112 Ulasan")).toEqual({ rating: 4.9, reviewCount: 112 });
  });

  it("parses the English fallback format (dot decimal, comma thousands)", () => {
    expect(parseAggregateRating("4.6 stars 4,046 reviews")).toEqual({ rating: 4.6, reviewCount: 4046 });
  });

  it("returns null for an unrecognized format", () => {
    expect(parseAggregateRating("no rating yet")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseAggregateRating("")).toBeNull();
  });
});

describe("parseReviewStars", () => {
  it("parses a whole-star Indonesian review rating", () => {
    expect(parseReviewStars("5 bintang")).toBe(5);
  });

  it("parses a whole-star English review rating", () => {
    expect(parseReviewStars("1 star")).toBe(1);
  });

  it("parses the plural English form", () => {
    expect(parseReviewStars("4 stars")).toBe(4);
  });

  it("returns null for an out-of-range value", () => {
    expect(parseReviewStars("6 bintang")).toBeNull();
    expect(parseReviewStars("0 bintang")).toBeNull();
  });

  it("returns null for an unrecognized format", () => {
    expect(parseReviewStars("great place")).toBeNull();
  });
});

describe("parseRelativeTimeToISO", () => {
  const now = new Date("2026-09-01T12:00:00.000Z");

  it("parses 'se<unit> lalu' (a <unit> ago) as 1 unit", () => {
    expect(parseRelativeTimeToISO("sebulan lalu", now)).toBe(
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("parses 'N <unit> lalu'", () => {
    expect(parseRelativeTimeToISO("5 bulan lalu", now)).toBe(
      new Date(now.getTime() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("parses days", () => {
    expect(parseRelativeTimeToISO("3 hari lalu", now)).toBe(
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
    );
  });

  it("returns null for an unrecognized format", () => {
    expect(parseRelativeTimeToISO("last Tuesday", now)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run lib/places/scrape-parse.test.ts
```
Expected: FAIL — `Cannot find module './scrape-parse'`.

- [ ] **Step 3: Implement `lib/places/scrape-parse.ts`**

```ts
/**
 * Pure parsing for the Google Maps scraping mode (see
 * docs/superpowers/specs/2026-09-01-google-maps-scraper-design.md). Takes
 * raw aria-label / text-content strings extracted from the DOM by
 * scrape-browser.ts and turns them into typed values. No DOM, no I/O —
 * everything here is unit-testable without a real browser.
 */

/** "4,6 bintang 4.046 Ulasan" (id) or "4.6 stars 4,046 reviews" (en fallback). */
export function parseAggregateRating(ariaLabel: string): { rating: number; reviewCount: number } | null {
  const trimmed = ariaLabel.trim();

  const idMatch = trimmed.match(/^([\d.]+),(\d+)\s*bintang\s*([\d.]+)\s*ulasan$/i);
  if (idMatch) {
    const rating = parseFloat(`${idMatch[1].replace(/\./g, "")}.${idMatch[2]}`);
    const reviewCount = parseInt(idMatch[3].replace(/\./g, ""), 10);
    if (!Number.isNaN(rating) && !Number.isNaN(reviewCount)) return { rating, reviewCount };
  }

  const enMatch = trimmed.match(/^([\d,]+)\.(\d+)\s*stars?\s*([\d,]+)\s*reviews?$/i);
  if (enMatch) {
    const rating = parseFloat(`${enMatch[1].replace(/,/g, "")}.${enMatch[2]}`);
    const reviewCount = parseInt(enMatch[3].replace(/,/g, ""), 10);
    if (!Number.isNaN(rating) && !Number.isNaN(reviewCount)) return { rating, reviewCount };
  }

  return null;
}

/** "5 bintang" / "1 star" / "4 stars" — always a whole number, 1-5. */
export function parseReviewStars(ariaLabel: string): 1 | 2 | 3 | 4 | 5 | null {
  const trimmed = ariaLabel.trim().toLowerCase();
  const match = trimmed.match(/^(\d)\s*(?:bintang|stars?)$/);
  if (!match) return null;
  const stars = parseInt(match[1], 10);
  if (stars < 1 || stars > 5) return null;
  return stars as 1 | 2 | 3 | 4 | 5;
}

const UNIT_MS: Record<string, number> = {
  menit: 60 * 1000,
  jam: 60 * 60 * 1000,
  hari: 24 * 60 * 60 * 1000,
  minggu: 7 * 24 * 60 * 60 * 1000,
  bulan: 30 * 24 * 60 * 60 * 1000,
  tahun: 365 * 24 * 60 * 60 * 1000,
};

/**
 * "sebulan lalu" / "5 bulan lalu" -> approximate ISO timestamp. Google Maps
 * never exposes an absolute review date in the DOM, so this is inherently
 * an approximation (day-level precision lost) — acceptable for trend
 * charts, not for anything needing an exact date.
 */
export function parseRelativeTimeToISO(text: string, now: Date = new Date()): string | null {
  const trimmed = text.trim().toLowerCase();
  const match = trimmed.match(/^(se|\d+)\s*(menit|jam|hari|minggu|bulan|tahun)\s*(?:yang\s+)?lalu$/);
  if (!match) return null;

  const amount = match[1] === "se" ? 1 : parseInt(match[1], 10);
  const unitMs = UNIT_MS[match[2]];
  if (!unitMs || Number.isNaN(amount)) return null;

  return new Date(now.getTime() - amount * unitMs).toISOString();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run lib/places/scrape-parse.test.ts
```
Expected: PASS — all 15 tests green.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add lib/places/scrape-parse.ts lib/places/scrape-parse.test.ts
git commit -m "Add pure parsing for Google Maps scraper (rating, stars, relative time)"
```

---

### Task 2: `lib/places/scrape-browser.ts` — Puppeteer automation

**Files:**
- Create: `lib/places/scrape-browser.ts`
- Modify: `.env.example` (add `PUPPETEER_EXECUTABLE_PATH`)

**Interfaces:**
- Consumes: `parseAggregateRating`, `parseReviewStars`, `parseRelativeTimeToISO` from `lib/places/scrape-parse.ts` (Task 1); `PlaceDetails`, `PlaceSearchResult` from `@/types/places` (existing, from the Places API feature); `GoogleReview` from `@/types/google` (existing).
- Produces: `scrapeSearchPlaceText(query: string): Promise<PlaceSearchResult | null>`, `scrapeGetPlaceDetails(placeUrl: string): Promise<PlaceDetails>` — consumed by Task 3 (`lib/places/client.ts`'s mode switch).

- [ ] **Step 1: Install dependencies**

```bash
npm install puppeteer-core puppeteer-extra puppeteer-extra-plugin-stealth @sparticuz/chromium
```

- [ ] **Step 2: Implement `lib/places/scrape-browser.ts`**

```ts
import puppeteerCore from "puppeteer-core";
import { addExtra } from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { PlaceDetails, PlaceSearchResult } from "@/types/places";
import type { GoogleReview } from "@/types/google";
import { parseAggregateRating, parseReviewStars, parseRelativeTimeToISO } from "./scrape-parse";

// Deliberately does NOT `import "server-only"` — same reasoning as
// lib/places/client.ts: nothing here needs to run outside Next, but
// keeping the whole lib/places/ directory consistent avoids surprises if
// a future script imports this module too.

const puppeteer = addExtra(puppeteerCore);
puppeteer.use(StealthPlugin());

async function launchBrowser() {
  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const localExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  if (!localExecutablePath) {
    throw new Error(
      "PUPPETEER_EXECUTABLE_PATH is not set. For local development, set it in .env.local to your " +
        'installed Chrome\'s path (e.g. "C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe" ' +
        'on Windows, "/usr/bin/google-chrome" on Linux, or ' +
        '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" on macOS).'
    );
  }
  return puppeteer.launch({ executablePath: localExecutablePath, headless: true });
}

type LaunchedBrowser = Awaited<ReturnType<typeof launchBrowser>>;
type LaunchedPage = Awaited<ReturnType<LaunchedBrowser["newPage"]>>;

async function withBrowser<T>(fn: (page: LaunchedPage) => Promise<T>): Promise<T> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ "Accept-Language": "id-ID,id;q=0.9" });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

interface PlacePageBasics {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
}

/**
 * Extracts name/address/lat-lng/rating from whatever place page the given
 * Page is currently on. Shared by scrapeSearchPlaceText (after landing on
 * a search result) and scrapeGetPlaceDetails (after navigating directly to
 * a stored URL).
 */
async function scrapePlacePageBasics(page: LaunchedPage): Promise<PlacePageBasics | null> {
  const url = page.url();
  const latLngMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);

  const raw = await page.evaluate(() => {
    const addressBtn = document.querySelector('[aria-label^="Alamat:"], [aria-label^="Address:"]');
    const ratingEl = document.querySelector(
      'span[role="img"][aria-label*="bintang"], span[role="img"][aria-label*="star"]'
    );
    return {
      title: document.title,
      address:
        addressBtn?.getAttribute("aria-label")?.replace(/^(Alamat|Address):\s*/i, "").trim() ?? null,
      ratingAriaLabel: ratingEl?.getAttribute("aria-label") ?? null,
    };
  });

  // Google sets the tab title to "<Place Name> - Google Maps" on a place
  // page — verified live during design, more reliable than hunting for a
  // specific heading element/class (which differs between a plain place
  // page and a place opened from a search-results split view).
  const name = raw.title.replace(/\s*-\s*Google Maps\s*$/i, "").trim();
  if (!name) return null;

  const aggregate = raw.ratingAriaLabel ? parseAggregateRating(raw.ratingAriaLabel) : null;

  return {
    name,
    address: raw.address,
    latitude: latLngMatch ? parseFloat(latLngMatch[1]) : null,
    longitude: latLngMatch ? parseFloat(latLngMatch[2]) : null,
    rating: aggregate?.rating ?? null,
    userRatingCount: aggregate?.reviewCount ?? null,
  };
}

/** Text-search bootstrap — used only by scripts/resolve-places.ts. */
export async function scrapeSearchPlaceText(query: string): Promise<PlaceSearchResult | null> {
  return withBrowser(async (page) => {
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // A distinctive query often makes Google redirect straight to the
    // place page. Otherwise, click the first result in the results list.
    if (!page.url().includes("/maps/place/")) {
      const firstResult = await page.$('a[href*="/maps/place/"]');
      if (!firstResult) return null;
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }).catch(() => {}),
        firstResult.click(),
      ]);
    }

    const basics = await scrapePlacePageBasics(page);
    if (!basics) return null;

    return {
      placeId: page.url(),
      name: basics.name,
      address: basics.address,
      latitude: basics.latitude,
      longitude: basics.longitude,
      rating: basics.rating,
      userRatingCount: basics.userRatingCount,
    };
  });
}

interface RawScrapedReview {
  reviewId: string;
  reviewerName: string;
  starAriaLabel: string | null;
  relativeTime: string | null;
  text: string | null;
}

/** Place details + reviews — placeUrl is a URL previously returned as `placeId`. */
export async function scrapeGetPlaceDetails(placeUrl: string): Promise<PlaceDetails> {
  return withBrowser(async (page) => {
    await page.goto(placeUrl, { waitUntil: "networkidle2", timeout: 30000 });

    const basics = await scrapePlacePageBasics(page);
    if (!basics) {
      throw new Error(`Blocked or CAPTCHA'd while scraping ${placeUrl} (no page title found)`);
    }

    const reviewsTab = await page.$('[aria-label^="Ulasan untuk"], [aria-label^="Reviews for"]');
    if (reviewsTab) {
      await reviewsTab.click();
      await page.waitForSelector("div[data-review-id]", { timeout: 15000 }).catch(() => {});
    }

    // Reviews lazy-load as the panel scrolls. A few scrolls is enough to
    // load well over 5 reviews (verified during design) without trying to
    // exhaustively paginate history — matches the API mode's own "up to a
    // handful per poll" character.
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => {
        const firstReview = document.querySelector("div[data-review-id]");
        const scrollable = firstReview?.closest('[role="main"]') ?? firstReview?.parentElement?.parentElement;
        scrollable?.scrollBy(0, 800);
      });
      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    const rawReviews: RawScrapedReview[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("div[data-review-id]")).map((el) => {
        const starEl = el.querySelector(
          'span[role="img"][aria-label$=" bintang"], span[role="img"][aria-label$=" star"], span[role="img"][aria-label$=" stars"]'
        );
        const timeEl = el.querySelector(".rsqaWe");
        const textEl = el.querySelector(".wiI7pd");
        return {
          reviewId: el.getAttribute("data-review-id") ?? "",
          reviewerName: el.getAttribute("aria-label") ?? "",
          starAriaLabel: starEl?.getAttribute("aria-label") ?? null,
          relativeTime: timeEl?.textContent?.trim() ?? null,
          text: textEl?.textContent?.trim() ?? null,
        };
      });
    });

    const reviews: GoogleReview[] = [];
    for (const raw of rawReviews) {
      if (!raw.reviewId || !raw.starAriaLabel) continue;
      const stars = parseReviewStars(raw.starAriaLabel);
      if (!stars) continue;

      const timestamp = (raw.relativeTime && parseRelativeTimeToISO(raw.relativeTime)) ?? new Date().toISOString();

      reviews.push({
        reviewId: raw.reviewId,
        locationId: placeUrl,
        reviewer: { displayName: raw.reviewerName || "Google User", photoUrl: null },
        starRating: stars,
        comment: raw.text,
        createTime: timestamp,
        updateTime: timestamp,
      });
    }

    return {
      rating: basics.rating,
      userRatingCount: basics.userRatingCount,
      reviews,
    };
  });
}
```

- [ ] **Step 3: Add the local-dev env var to `.env.example`**

In the Places API section of `.env.example`, add below `GOOGLE_PLACES_API_KEY`:

```
# Only needed when GOOGLE_PLACES_MODE=scrape and running locally (not on
# Vercel, which uses @sparticuz/chromium automatically). Point this at your
# installed Chrome, e.g. on Windows:
# C:\Program Files\Google\Chrome\Application\chrome.exe
PUPPETEER_EXECUTABLE_PATH=
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: no errors. (No automated tests for this file per the Global Constraints — it needs a real browser.)

- [ ] **Step 5: Manual verification (deferred to your own machine)**

This cannot be run in a sandboxed implementer environment — no Chrome binary, and it would hit the real Google Maps over the network. Once you have Chrome installed locally and `PUPPETEER_EXECUTABLE_PATH` set in `.env.local`:

```bash
npx tsx -e "
import('./lib/places/scrape-browser').then(async (m) => {
  const result = await m.scrapeSearchPlaceText('Starbucks Jakarta');
  console.log(JSON.stringify(result, null, 2));
  if (result) {
    const details = await m.scrapeGetPlaceDetails(result.placeId);
    console.log(JSON.stringify(details, null, 2));
  }
});
"
```
Expected: `scrapeSearchPlaceText` returns a populated object (name, address, rating); `scrapeGetPlaceDetails` returns `rating`/`userRatingCount` plus a non-empty `reviews` array with sane-looking `starRating` (1-5), `comment`, and ISO `createTime` values. If reviews come back empty, the reviews-tab click or scroll timing likely needs adjustment — check with a visible (non-headless) run first (`headless: false` in `launchBrowser` temporarily) to see what actually loaded.

- [ ] **Step 6: Commit**

```bash
git add lib/places/scrape-browser.ts .env.example package.json package-lock.json
git commit -m "Add Puppeteer-based Google Maps scraper"
```

---

### Task 3: Mode switch in `lib/places/client.ts`

**Files:**
- Modify: `lib/places/client.ts`
- Test: `lib/places/client.test.ts` (add to existing file)
- Modify: `.env.example` (add `GOOGLE_PLACES_MODE`)
- Modify: `app/api/places/sync/route.ts` (raise `maxDuration` for scrape mode)

**Interfaces:**
- Consumes: `scrapeSearchPlaceText`, `scrapeGetPlaceDetails` from `lib/places/scrape-browser.ts` (Task 2).
- Produces: no change to `getPlaceDetails`/`searchPlaceText`'s public signatures — `lib/places/sync.ts` and `scripts/resolve-places.ts` need zero changes.

- [ ] **Step 1: Write the failing test**

Read the existing `lib/places/client.test.ts` first (from the Places API feature) to match its `vi.mock`/`beforeEach` conventions exactly. Add this describe block to that file:

```ts
describe("mode switch", () => {
  const mockScrapeSearchPlaceText = vi.fn();
  const mockScrapeGetPlaceDetails = vi.fn();

  beforeEach(() => {
    vi.doMock("./scrape-browser", () => ({
      scrapeSearchPlaceText: mockScrapeSearchPlaceText,
      scrapeGetPlaceDetails: mockScrapeGetPlaceDetails,
    }));
  });

  afterEach(() => {
    vi.doUnmock("./scrape-browser");
    delete process.env.GOOGLE_PLACES_MODE;
  });

  it("delegates to the scraper when GOOGLE_PLACES_MODE=scrape", async () => {
    process.env.GOOGLE_PLACES_MODE = "scrape";
    mockScrapeGetPlaceDetails.mockResolvedValue({ rating: 4.5, userRatingCount: 10, reviews: [] });

    const { getPlaceDetails } = await import("./client");
    const result = await getPlaceDetails("https://www.google.com/maps/place/Example");

    expect(mockScrapeGetPlaceDetails).toHaveBeenCalledWith("https://www.google.com/maps/place/Example");
    expect(result).toEqual({ rating: 4.5, userRatingCount: 10, reviews: [] });
  });

  it("uses the Places API implementation when GOOGLE_PLACES_MODE is unset", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    const { getPlaceDetails } = await import("./client");
    await getPlaceDetails("ChIJabc");

    expect(mockScrapeGetPlaceDetails).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run lib/places/client.test.ts
```
Expected: FAIL — the first new test fails because `getPlaceDetails` still always uses the API path (`mockScrapeGetPlaceDetails` never called).

- [ ] **Step 3: Implement the mode switch**

In `lib/places/client.ts`, replace:

```ts
/** Fetches a place's aggregate rating/review count plus up to 5 reviews. */
export async function getPlaceDetails(placeId: string): Promise<PlaceDetails> {
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
```

with:

```ts
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
```

(This is a pure rename — `export` dropped, name changed from `getPlaceDetails` to `apiGetPlaceDetails` — plus the docstring wording; the body is byte-for-byte identical.)

Next, replace:

```ts
/** Text Search — used only by scripts/resolve-places.ts to bootstrap outlets. */
export async function searchPlaceText(query: string): Promise<PlaceSearchResult | null> {
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
```

with:

```ts
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
```

(Same pure rename: `export` dropped, `searchPlaceText` → `apiSearchPlaceText`, body untouched.)

Then add, at the bottom of the file:

```ts
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
```

After these edits, the file has exactly one `export` each for `getPlaceDetails` and `searchPlaceText` (the two new wrapper functions above) — `apiGetPlaceDetails`/`apiSearchPlaceText` are internal.

The dynamic `import("./scrape-browser")` (rather than a static top-level import) matters: it keeps Puppeteer/`@sparticuz/chromium` out of the API-mode code path entirely, so a deployment running in `api` mode never pulls in the scraping dependencies at runtime.

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run lib/places/client.test.ts
```
Expected: PASS — all tests in the file green, including the 2 new ones.

- [ ] **Step 5: Add `GOOGLE_PLACES_MODE` to `.env.example`**

In the Places API section, add above `GOOGLE_PLACES_API_KEY`:

```
# api (default) = official Places API, requires GOOGLE_PLACES_API_KEY and
# Google Cloud billing. scrape = Puppeteer-based Google Maps scraping, no
# API key or billing needed — see docs/superpowers/specs/2026-09-01-google-maps-scraper-design.md
# for the trade-offs (ToS risk, fragility, blocking risk) before using this.
GOOGLE_PLACES_MODE=api
```

- [ ] **Step 6: Raise `maxDuration` for scrape mode**

In `app/api/places/sync/route.ts`, change:
```ts
export const maxDuration = 60; // Hobby-plan-safe ceiling for the sync run.
```
to:
```ts
// Puppeteer page loads are much slower than a fetch call — scrape mode
// needs more headroom than api mode. 300 requires at least a Vercel Pro
// plan; if deploying scrape mode on Hobby, expect this route to time out
// on larger outlet counts (the per-outlet try/catch in runPlacesSync means
// a timeout mid-run still leaves already-processed outlets' data intact).
export const maxDuration = process.env.GOOGLE_PLACES_MODE === "scrape" ? 300 : 60;
```

- [ ] **Step 7: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add lib/places/client.ts lib/places/client.test.ts .env.example app/api/places/sync/route.ts
git commit -m "Add GOOGLE_PLACES_MODE switch between Places API and scraping"
```

---

## Post-plan: end-to-end check

Once all 3 tasks are done, on your own machine (not a sandboxed environment):

1. Install a local Chrome if you don't have one, set `PUPPETEER_EXECUTABLE_PATH` in `.env.local`.
2. Set `GOOGLE_PLACES_MODE=scrape` in `.env.local` (no `GOOGLE_PLACES_API_KEY` needed).
3. Add one real outlet to `scripts/places-outlets.ts` (already built in the Places API feature), run `npm run resolve-places` — confirm it resolves via scraping and the confirmation prompt shows sane data.
4. In Settings, click "Sync Now" — confirm the Places Sync card updates and a review appears in the live feed with sentiment tags.
5. If reviews come back empty or the sync errors immediately, re-check the selectors in `lib/places/scrape-browser.ts` against the current Google Maps DOM (Google may have changed markup since this plan was written) using the same live-inspection approach as the design phase: open a real listing, open DevTools, and confirm `[data-review-id]`, `.wiI7pd`, `.rsqaWe`, and the `aria-label` patterns for rating badges still match.
