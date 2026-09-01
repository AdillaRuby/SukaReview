# Google Maps Scraper (Places-mode alternative) — Design

## Context

`GOOGLE_PLACES_MODE` today has one working value (`api`, via `lib/places/client.ts` calling the
official Google Places API), built and merged in
[2026-09-01-places-api-review-sync-design.md](2026-09-01-places-api-review-sync-design.md). Every
route to real review data that requires a payment method — the official Places API, and every
paid third-party Maps-scraping service (HasData, SerpApi, Outscraper, etc.) — has been explicitly
ruled out: the team does not want to attach a card to any of them right now.

The only path with zero payment method involved is scraping Google Maps directly. This has been
discussed with the user across several messages, with the trade-offs stated plainly each time and
confirmed as an informed, deliberate choice:

- **ToS**: scraping Google Maps violates Google's Terms of Service. Consequences can include
  IP/account blocking and, for commercial use, legal exposure.
- **Fragility**: Google's page markup (class names, layout) changes periodically; the scraper's
  selectors will need maintenance over the feature's lifetime.
- **Blocking risk**: Vercel's serverless IP ranges are well-known to Google's bot detection.
  Requests are more likely to be rate-limited or CAPTCHA-challenged than from a residential IP.
  The user chose "basic" anti-detection effort (stealth plugin + inter-request delay) over paid
  residential proxies, which would reintroduce a payment method anyway.

This spec covers only what's new: a second `getPlaceDetails`/`searchPlaceText` implementation. It
does not restate the surrounding architecture (the sync orchestrator, the ingest/Gemini/alert
pipeline, the cron/manual trigger route, the Settings UI, the bootstrap script) — none of that
changes. See the Places API spec for that context.

## Goals

- A working `getPlaceDetails`/`searchPlaceText` implementation that scrapes Google Maps instead of
  calling the Places API, selected via `GOOGLE_PLACES_MODE=scrape` — zero other files change.
- Reuse the *exact* interfaces (`PlaceDetails`, `PlaceSearchResult`, `GoogleReview`) already defined
  for the API mode, so `lib/places/sync.ts`, the route, the UI, and `scripts/resolve-places.ts`
  work unmodified regardless of which mode is active.
- Selectors and parsing grounded in the actual current Google Maps DOM (verified live during this
  design session — see below), not guessed from memory.

## Non-goals

- Beating Google's bot detection reliably at scale. "Basic" effort is the agreed ceiling; if
  blocking becomes a real operational problem, the fix is switching back to `api` mode (already
  built) or a paid service, not investing further in evasion.
- Solving selector drift permanently. When Google changes its markup, this breaks until someone
  updates the selectors — that is an accepted, named trade-off, not a defect to design around.
- CAPTCHA solving.

## What was verified live (not assumed)

Using a real browser session against `https://www.google.com/maps/search/...` and a place page
(Starbucks, Jakarta — arbitrary, just needed a real listing with reviews):

- A place's canonical URL (e.g.
  `https://www.google.com/maps/place/Starbucks/data=!4m7!3m6!1s0x2e69...!8m2!3d-6.18...!4d106.82...`)
  is directly re-navigable — opening it again lands straight on the same business page. This is
  the identifier scraping uses in place of an API-issued place ID.
- The aggregate rating badge is a `<span role="img" aria-label="4,6 bintang 4.046 Ulasan">` —
  rating and review count in one accessible string, Indonesian-locale number format (comma decimal,
  dot thousands separator).
- Each review is a `<div data-review-id="...">` — a stable, Google-assigned opaque ID, directly
  usable for de-duplication (no need to hash reviewer+text ourselves).
- Within a review container: reviewer name is the container's own `aria-label` (and duplicated in
  `.d4r55.fontTitleMedium`), the star rating is another `<span role="img" aria-label="5 bintang">`
  (singular pattern, no review count), relative time is `.rsqaWe` ("5 bulan lalu"), and review text
  is `.wiI7pd`.
- Reviews are not present on initial page load — the sidebar must be scrolled after opening the
  "Ulasan" (Reviews) tab for review cards to render.

`aria-label` patterns are the primary selectors (semantic, tied to accessibility — less likely to
be casually renamed than build-obfuscated CSS classes); the class names above are recorded as a
secondary/fallback signal, not the primary extraction path.

## Chosen approach

Mode switch inside the existing `lib/places/client.ts`, delegating to a new `lib/places/scrape.ts`
when `GOOGLE_PLACES_MODE=scrape`. Two sub-modules inside the scraping implementation, split for
testability:

- **`lib/places/scrape-browser.ts`** — Puppeteer automation (launch, navigate, click, scroll,
  `page.evaluate()` to pull raw strings out of the DOM). Not unit-testable without a real browser;
  verified manually.
- **`lib/places/scrape-parse.ts`** — pure functions that turn the raw strings the browser layer
  extracts (aria-label text, review text, relative-time text) into typed values (`{rating, reviewCount}`,
  a single star integer, a `GoogleReview`). No DOM, no I/O — fully unit-testable, and this is where
  the actual parsing bugs (locale format, malformed strings) would show up, so it's the piece worth
  testing.

This mirrors the client/sync split already used for the API mode (`lib/places/client.ts` vs.
`lib/places/sync.ts`) — automation and business logic in separate files, each independently
reasoned about.

## 1. Configuration

```
GOOGLE_PLACES_MODE=scrape   # default: api. When scrape, GOOGLE_PLACES_API_KEY is not read.
```

New dependencies: `puppeteer-core`, `@sparticuz/chromium` (serverless-compatible Chromium binary —
full `puppeteer` bundles its own Chromium download, too large for a Vercel function), `puppeteer-extra`,
`puppeteer-extra-plugin-stealth`.

## 2. `lib/places/scrape-parse.ts` — pure parsing

```ts
export function parseAggregateRating(ariaLabel: string): { rating: number; reviewCount: number } | null
export function parseReviewStars(ariaLabel: string): number | null // returns 1-5, clamped
```

Handles the verified Indonesian format (`"4,6 bintang 4.046 Ulasan"`, comma decimal / dot
thousands) as primary, but tolerates the English format too (`"4.6 stars 4,046 reviews"`) as a
defensive fallback — the browser layer requests Indonesian locale explicitly (see below), but
Google's locale detection can still be swayed by the server's IP geolocation (Vercel functions
often run from US regions), so relying on locale alone is not safe enough on its own.

## 3. `lib/places/scrape-browser.ts` — Puppeteer automation

Launches a `puppeteer-extra` browser with the stealth plugin and `@sparticuz/chromium`'s binary,
`Accept-Language: id-ID,id;q=0.9` set explicitly on the page (best-effort locale steering — parsing
still tolerates the other format if Google ignores it).

**`searchPlaceText(query)`**: navigates to `https://www.google.com/maps/search/<query>`. If Google
redirects straight to a single place page (common for a specific, distinctive query), reads that
page directly. If a results list renders instead, takes the first result. Extracts name, address,
lat/lng (from the URL's `@lat,lng` segment), and the aggregate rating badge via
`parseAggregateRating`. Returns `{ placeId: <the page's own URL>, name, address, latitude,
longitude, rating, userRatingCount }` — same `PlaceSearchResult` shape the API mode returns, with
`placeId` repurposed to hold the scraped URL instead of an API-issued ID (`outlets.google_place_id`
is untyped free text in the DB either way — no schema change).

**`getPlaceDetails(placeId)`**: `placeId` here *is* the stored URL from a prior `searchPlaceText`
call (or a prior `getPlaceDetails` — the URL is stable across visits, verified above). Navigates
directly to it, opens the "Ulasan"/Reviews tab, and scrolls the review list a fixed 3 times (no
infinite-scroll pagination to exhaustively harvest history — matches the Places API mode's own
"up to a handful of reviews per poll" character; 3 scrolls was enough to load well over 5 reviews
in the live check above), then extracts every
`div[data-review-id]` element: reviewer name (container's `aria-label`), star rating
(`parseReviewStars` on the nested rating badge), review text (`.wiI7pd`), relative time (`.rsqaWe`,
converted to an ISO timestamp via a best-effort relative-time parser — Google doesn't expose an
absolute timestamp in the DOM, so this is an approximation, not the true `google_created_at`).
Maps each into `GoogleReview` with `reviewId` set to the raw `data-review-id` value. Returns the
same `PlaceDetails` shape the API mode returns.

## 4. Error handling & known limitations

- **No absolute review timestamp.** Google Maps' DOM only exposes relative time ("5 bulan lalu").
  The scraper converts this to an approximate ISO timestamp (e.g., "5 bulan lalu" → now minus ~5
  months). This is inherently imprecise (day-level granularity lost) — acceptable for trend charts,
  not for anything needing exact review dates. This is a hard ceiling of the scraping approach, not
  a bug to fix later.
- **Blocking/CAPTCHA**: if Puppeteer lands on a CAPTCHA or consent-wall page instead of the
  expected content, `scrape-browser.ts` must detect that (the expected selectors simply won't be
  found) and throw a clear, named error (`"Blocked or CAPTCHA'd while scraping <url>"`) rather than
  returning empty/garbage data — this flows into the exact same per-outlet `try/catch` in
  `runPlacesSync` that already isolates one outlet's failure from the rest (built in the Places API
  feature, unchanged).
- **Selector drift**: if Google's markup changes such that expected elements aren't found,
  `scrape-browser.ts` throws rather than silently returning nulls/empty arrays — a loud failure
  (visible in `places_sync_state.last_error`) is far more useful than quietly reporting zero
  reviews forever.
- **`maxDuration`**: Puppeteer page loads are much slower than a fetch call. The existing
  `app/api/places/sync/route.ts` `maxDuration = 60` (set for the API mode) is almost certainly too
  low for scrape mode — a single outlet's page load + review-tab click + scroll can itself take
  several seconds, before Gemini analysis is even counted. This needs raising when scrape mode is
  the active mode; exact value is a deployment-time tuning concern, not fixed by this design.
- **Vercel function size**: `@sparticuz/chromium` + Puppeteer is a large dependency. If it pushes
  the function past Vercel's deployment size limit, the fix is `sparticuz/chromium`'s own
  documented trimming options (community precedent for this exact use case) — flagged here as a
  real risk to watch during implementation, not one this design can fully rule out in advance
  without actually deploying.

## Testing approach

- **`lib/places/scrape-parse.ts`** — fully unit tested (vitest, same as `lib/places/client.ts`):
  both locale formats for `parseAggregateRating`, boundary/out-of-range input for
  `parseReviewStars`, malformed/unexpected strings returning `null` rather than throwing.
- **`lib/places/scrape-browser.ts`** — not unit tested (no real browser in CI); verified manually
  against a real Google Maps listing during implementation, the same way this design's selectors
  were verified. The manual check: run `searchPlaceText` and `getPlaceDetails` against one real
  outlet end-to-end and confirm the returned shape is populated and sane.
- **Mode switch in `lib/places/client.ts`**: a small unit test confirming `GOOGLE_PLACES_MODE=scrape`
  routes to the scraping implementation and `api` (or unset) routes to the existing one — this is
  the one piece of `client.ts` itself that's new and worth locking down.
