# Places API Review Sync — Design

## Context

SukaReview currently has one path to real Google review data: the Business
Profile API (`lib/google/*`), which requires OAuth against a Google account
that has **Owner/Manager** access to every outlet's Google Business Profile
listing. The team doesn't have that access yet (listings are held by other
people), and getting it requires manually contacting each outlet's current
manager — slow and out of scope for right now.

This feature adds a second, independent data source: **Google Places API
(New)**, authenticated with a plain API key instead of OAuth. It requires no
manager access at all, at the cost of only getting the outlet's aggregate
rating/review count plus up to 5 "most relevant" reviews per outlet (not full
history), refreshed periodically instead of pushed in real time.

## Goals

- Get real rating + review data flowing into the existing dashboard/alerts/AI
  pipeline without waiting on Business Profile API manager access.
- Reuse the existing review pipeline (`ingestGoogleReview`,
  `processIngestedReview`, Gemini analysis, alert engine) unchanged.
- Zero risk to the working demo/live Business Profile flow — this is
  additive, not a modification of `lib/google/*`.

## Non-goals

- Full historical review backfill (Places API caps at 5 reviews per place;
  this is a known, accepted limitation, not something this feature works
  around).
- Real-time push notifications for new reviews (Places API has no
  webhook/Pub/Sub equivalent; this is poll-based).
- Replacing the Business Profile API integration — both can coexist; Places
  sync is meant to be a stand-in until manager access is sorted out, or a
  permanent fallback for outlets that never get GBP access.

## Chosen approach

A new, self-contained `lib/places/` module, independent of `GOOGLE_MODE` and
of every existing `lib/google/*` file. Reviews it fetches are handed to the
exact same `ingestGoogleReview` / `processIngestedReview` pipeline the
Business Profile path already uses, so Gemini tagging, alert rules, and the
realtime feed all work identically regardless of which source a review came
from.

Two alternatives were considered and rejected:

- **Make `places` a third `GOOGLE_MODE` value**, reusing the demo/live branch
  pattern in every `lib/google/*.ts` file. Rejected — Places API has no
  concept of an OAuth "account" or "list all locations," so fitting it into
  that shape would mean faking those concepts across several files that
  currently work correctly for demo/live, for no real benefit.
- **A standalone script that writes straight to `reviews`/`outlets`**,
  bypassing the ingest pipeline. Rejected — it would skip Gemini analysis and
  alert evaluation entirely, which defeats the point of the product.

## 1. Configuration

Two new env vars, additive to `.env.local` / `.env.example`, independent of
`GOOGLE_MODE`:

```
GOOGLE_PLACES_API_KEY=          # Places API (New) key from Google Cloud
CRON_SECRET=                    # random secret; MUST be named exactly this —
                                 # Vercel only auto-attaches the Authorization
                                 # header for an env var with this literal name
```

`GOOGLE_MODE` (`demo`/`live`) is untouched. Places sync activates whenever
`GOOGLE_PLACES_API_KEY` is set, regardless of `GOOGLE_MODE` — so demo mode
keeps working for UI development while Places sync independently brings in
real data.

## 2. Outlet bootstrap (`scripts/resolve-places.ts`)

A one-time (or as-needed) script, run manually via `tsx`, that resolves each
real outlet's Google Place ID and creates/updates its `outlets` row —
mirroring the existing `scripts/seed.ts` pattern.

**Input** — a small hand-edited file:

```ts
// scripts/places-outlets.ts
export const REAL_OUTLETS = [
  { name: "Suka Shawarma Cibubur", searchQuery: "Suka Shawarma Cibubur, Jakarta Timur" },
  // ... one entry per real outlet
];
```

**Per outlet, the script:**

1. Calls **Places API Text Search** with `searchQuery`, gets the top
   candidate (place ID, official name, address, lat/lng, rating, review
   count).
2. Prints the candidate and asks for manual `y/n` confirmation in the
   terminal before writing anything — Text Search can mismatch (similarly
   named competitor, multiple branches in one city), and this determines
   what data the whole dashboard shows for that outlet, so it is not
   auto-applied.
3. On confirmation, `upsert`s into `outlets` (conflict key: `slug`, same
   pattern as `lib/google/sync.ts`), setting `google_place_id`, `name`,
   `address`, `city`, `latitude`, `longitude`.
4. Prints a final summary: resolved / skipped / failed counts.

This runs standalone, not as part of the periodic sync.

## 3. `lib/places/` module

**`lib/places/client.ts`** — `getPlaceDetails(placeId): Promise<PlaceDetails>`.
Calls `GET https://places.googleapis.com/v1/places/{placeId}` with headers
`X-Goog-Api-Key` and `X-Goog-FieldMask: rating,userRatingCount,reviews`.
Returns the place's aggregate `rating`, `userRatingCount`, and up to 5
`reviews` (each with a stable `name` id like
`places/XXX/reviews/YYY`, `rating` as a plain 1–5 integer, `text.text`,
`authorAttribution.displayName`/`photoUri`, `publishTime`).

**Mapping** — each raw Places review is mapped to the existing `GoogleReview`
type (`types/google.ts`), the same shape the Business Profile path produces,
so it flows into `ingestGoogleReview` with no changes to that function or
anything downstream of it.

**`lib/places/sync.ts`** — `runPlacesSync(): Promise<PlacesSyncSummary>`:

1. Query active outlets where `google_place_id is not null`.
2. For each outlet: `getPlaceDetails`, map its reviews, and for each mapped
   review:
   - Always call `ingestGoogleReview` (keeps rating/comment fresh even for
     already-seen reviews whose text or rating changed).
   - Call `processIngestedReview` (Gemini analysis + alert evaluation)
     **only when `isNew === true`** — `analyzeAndPersistReview` has no
     "already analyzed" guard, so calling it for unchanged already-seen
     reviews on every poll would burn Gemini calls for no benefit.
3. After an outlet's reviews are processed, overwrite that outlet's
   `current_rating` / `total_reviews` directly from the Places API's own
   `rating` / `userRatingCount` — **not** the values
   `recomputeOutletStats` derives from stored review rows (which, fed only
   by the ≤5 reviews Places ever gives us, would understate the outlet's
   true totals). `recomputeOutletStats`'s `status` derivation (based on
   recent negative-review volume) is left as-is; it's a weaker signal with
   only 5 reviews to look at, but still meaningful, and not worth
   engineering around for this iteration.
4. Failures are caught **per outlet** and logged into the summary; one bad
   outlet (invalid place ID, deleted place, transient network error) does
   not stop the rest of the run — this runs unattended via cron, so a
   partial failure must not become a total one.
5. Returns a summary: outlets processed, new reviews found, per-outlet
   errors, outlets skipped for missing `google_place_id`.

## 4. Triggering — cron + manual button

**Shared endpoint**: `app/api/places/sync/route.ts`, with two handlers that
both call the same underlying `runPlacesSync()` + state-table update logic
(factored into one shared local function so the two handlers don't duplicate
it):

- **`GET`** — for Vercel Cron. Vercel *always* invokes cron paths with GET
  (confirmed against Vercel's docs — there's no way to configure it to POST),
  and automatically attaches `Authorization: Bearer <value>` using an env var
  that must be named **exactly** `CRON_SECRET` (a custom name like
  `PLACES_SYNC_CRON_SECRET` would not get the header auto-attached). The
  handler compares that header against `process.env.CRON_SECRET`.
- **`POST`** — for the manual "Sync Now" button. Checked with
  `getCurrentProfile()` + `canManage()`, same as `/api/google/sync`.

Neither valid → `401`/`403`.

**`vercel.json`** (new file):

```json
{
  "crons": [{ "path": "/api/places/sync", "schedule": "0 20 * * *" }]
}
```

Vercel cron schedules are always **UTC**. `0 20 * * *` = 20:00 UTC = 03:00
WIB (Jakarta) the next day — an off-peak local time for a nightly sync. This
is the max frequency on a Vercel Hobby plan (1x/day); a Pro plan can run it
more often. Two more Hobby-plan quirks worth knowing: Vercel may invoke the
job any time within the scheduled hour (not exactly 20:00:00 UTC), and cron
delivery is best-effort — Vercel's own docs say a scheduled run can
occasionally be skipped or double-invoked, so the job must tolerate both.
That's already true here: `ingestGoogleReview`'s atomic upsert makes a
duplicate invocation harmless, and a skipped day just means that outlet's
data is a day older, corrected on the next run.

Vercel also recommends a distributed lock to stop overlapping runs when a
job might run longer than its interval. Not added here — 18 outlets is fast
enough that a run finishing well within 24 hours is a safe bet, and adding a
lock (e.g. via Redis, which this project doesn't otherwise use) for a
low-probability edge case isn't worth it yet. Revisit if the outlet count
grows a lot or the interval shortens.

**State tracking** — new single-row table `places_sync_state` (same pattern
as `alert_settings`): `last_synced_at`, `last_status`
(`idle`/`running`/`success`/`failed`), `last_error`, `outlets_synced`,
`new_reviews_found`. The route updates it to `running` at the start and to
`success`/`failed` (+ error message) at the end — the same recovery pattern
used to fix the GBP "stuck syncing" bug.

**UI** — new `components/settings/places-sync-card.tsx` in Settings,
separate from `GoogleConnectionCard` (different data source, different
concerns): shows last sync time/status, outlets synced count, and a **"Sync
Now"** button that calls the endpoint and `router.refresh()`s — same pattern
as the existing GBP "Sync Now" button.

## 5. Error handling & known limitations

- **`GOOGLE_PLACES_API_KEY` unset** — the endpoint returns a clear error
  (not a crash); the Settings card shows a "not configured" state (mirrors
  `GoogleConnectionCard`'s `isDemoMode` state).
- **Outlet missing `google_place_id`** — skipped, not an error; counted
  separately in the summary so it's visible which outlets still need
  `scripts/resolve-places.ts` run against them.
- **Single outlet failure** — logged, sync continues. Overall run is marked
  `failed` only if *every* outlet failed; otherwise `success` with per-outlet
  errors visible for follow-up.
- **Cron/manual overlap** — not specially guarded against. The underlying
  `ingestGoogleReview` upsert is already concurrency-safe; worst case is a
  rare double Gemini call for one brand-new review. The existing GBP sync
  path has the same lack of an overlap guard, so this stays consistent
  rather than adding asymmetric protection.
- **Reviews falling out of the top-5** — not deleted, just not refreshed
  further. Historical rows stay in the database; they simply stop being kept
  in sync once Google stops surfacing them as "most relevant."
- **Cost** — Places API (New) bills per request beyond a monthly free
  quota. At 18 outlets × 1 sync/day this is well within typical free-tier
  usage, but exact current pricing should be checked on Google's pricing
  page rather than assumed, since it's controlled by Google and can change.

## Testing approach

- **`lib/places/client.ts`** — unit-testable in isolation by mocking
  `fetch`; verify field mask, header construction, and response mapping
  (including a place with zero reviews, and a place API error response).
- **`lib/places/sync.ts`** — verify with a fake `getPlaceDetails` +
  fake Supabase client: new review triggers `processIngestedReview`,
  already-seen review does not; one outlet throwing doesn't stop the loop;
  final rating/total_reviews write matches the Places response, not the
  recomputed value.
- **`scripts/resolve-places.ts`** — manual/interactive by nature (asks for
  confirmation); not unit tested, verified by a real dry run against a
  couple of real outlets.
- **`app/api/places/sync/route.ts`** — integration-style check: `GET` with a
  valid cron secret succeeds, `GET` with a missing/invalid secret returns
  `401`; `POST` from a non-admin/unauthenticated session returns `403`,
  `POST` from an authenticated admin succeeds.
- **End-to-end manual check**: run `scripts/resolve-places.ts` against a
  couple of real outlets, hit "Sync Now" in Settings, confirm reviews appear
  in the live feed with sentiment tags and that alerts fire correctly for a
  low-rated review.
