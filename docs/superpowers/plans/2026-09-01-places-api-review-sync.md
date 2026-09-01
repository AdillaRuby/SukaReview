# Places API Review Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Google Places API (New) as a second, independent source of review data for outlets whose Business Profile listing the team doesn't have Manager access to — polled periodically instead of pushed, feeding the same ingest/Gemini/alert pipeline the Business Profile path already uses.

**Architecture:** A new, self-contained `lib/places/` module (API-key auth, no OAuth) that maps Places API responses onto the existing `GoogleReview` type and hands them to the unchanged `ingestGoogleReview`/`processIngestedReview` pipeline. Triggered by a route with two handlers — `GET` for Vercel Cron, `POST` for a manual "Sync Now" button — both calling one shared sync function. `GOOGLE_MODE` (demo/live) and every `lib/google/*` file are untouched.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (Postgres, service-role client), Vercel Cron, Vitest (new — no test runner exists in this repo yet).

## Global Constraints

- Vercel Cron always invokes via HTTP `GET` and only auto-attaches the `Authorization: Bearer <value>` header for an env var named **exactly** `CRON_SECRET` (verified against Vercel's docs — a custom name will not work).
- Vercel cron schedules are always UTC.
- `lib/places/client.ts` must NOT `import "server-only"` — that package throws unconditionally when required outside Next's bundler aliasing (confirmed by reading `node_modules/server-only/index.js`), and `scripts/resolve-places.ts` imports from this file via plain `tsx`, not through Next.
- Outlet rating/review-count for Places-sourced outlets must come directly from the Places API's own `rating`/`userRatingCount` fields, never from `recomputeOutletStats` (which only sees the ≤5 reviews Places ever returns and would understate the true totals).
- `processIngestedReview` (Gemini + alerts) runs only for reviews where `ingestGoogleReview` returned `isNew: true` — `analyzeAndPersistReview` has no "already analyzed" guard, so calling it for unchanged already-seen reviews on every poll would burn Gemini calls for nothing.
- One outlet's sync failure must not stop the rest of the run (cron runs unattended).
- Spec: `docs/superpowers/specs/2026-09-01-places-api-review-sync-design.md`

---

### Task 1: Database migration — nullable `google_location_id` + `places_sync_state` table

**Files:**
- Create: `sql/012_places_sync.sql`
- Modify: `sql/_combined_migration.sql` (append the new migration's content)
- Modify: `types/database.ts:90-115` (outlets table types), and add a new `places_sync_state` table + `PlacesSyncStatus` type
- Modify: `types/domain.ts:35-48` (`OutletSummary.googleLocationId`)

**Interfaces:**
- Produces: `Database["public"]["Tables"]["places_sync_state"]["Row"]` shape — `{ id: boolean; last_synced_at: string | null; last_status: PlacesSyncStatus; last_error: string | null; outlets_synced: number; new_reviews_found: number; updated_at: string }` — used by Task 4 (route) and Task 5 (UI card).
- Produces: `PlacesSyncStatus = "idle" | "running" | "success" | "failed"`, exported from `types/database.ts`.

- [ ] **Step 1: Write the migration SQL**

Create `sql/012_places_sync.sql`:

```sql
-- Places API review sync (docs/superpowers/specs/2026-09-01-places-api-review-sync-design.md).
-- Outlets sourced from Places API have no Business Profile "location", so
-- google_location_id can no longer be required for every outlet.

alter table public.outlets alter column google_location_id drop not null;

-- Single-row table tracking the last Places sync run, same singleton
-- pattern as alert_settings (sql/011_alert_settings.sql).
create table if not exists public.places_sync_state (
  id boolean primary key default true check (id),
  last_synced_at timestamptz,
  last_status text not null default 'idle' check (last_status in ('idle', 'running', 'success', 'failed')),
  last_error text,
  outlets_synced integer not null default 0,
  new_reviews_found integer not null default 0,
  updated_at timestamptz not null default now()
);

insert into public.places_sync_state (id) values (true) on conflict (id) do nothing;

create trigger places_sync_state_set_updated_at
  before update on public.places_sync_state
  for each row execute function public.set_updated_at();

alter table public.places_sync_state enable row level security;

create policy "places_sync_state_select_authenticated" on public.places_sync_state
  for select to authenticated using (true);

create policy "places_sync_state_write_admin" on public.places_sync_state
  for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());
```

- [ ] **Step 2: Append it to the combined migration file**

Open `sql/_combined_migration.sql`, scroll to the end, and append the exact contents of `sql/012_places_sync.sql` (same convention every prior migration in that file already follows — check the end of the file for the `011_alert_settings.sql` block to match the separator style used between files).

- [ ] **Step 3: Run the migration against your Supabase project**

This is a real schema change against a live database — run it yourself (don't let an unattended process do this):

```bash
# Supabase SQL Editor: paste sql/012_places_sync.sql and run it
# — or, via the CLI, from the project root:
supabase db execute --file sql/012_places_sync.sql
```

Verify it worked:

```sql
select column_name, is_nullable from information_schema.columns
where table_name = 'outlets' and column_name = 'google_location_id';
-- expect is_nullable = 'YES'

select * from public.places_sync_state;
-- expect exactly one row, id = true, last_status = 'idle'
```

- [ ] **Step 4: Update `types/database.ts`**

In the `outlets` table block (around line 90-115), change:

```ts
      outlets: {
        Row: {
          id: string;
          google_location_id: string;
```
to:
```ts
      outlets: {
        Row: {
          id: string;
          google_location_id: string | null;
```

and change the `Insert` type from:
```ts
        Insert: Partial<Database["public"]["Tables"]["outlets"]["Row"]> & {
          google_location_id: string;
          name: string;
          slug: string;
        };
```
to:
```ts
        Insert: Partial<Database["public"]["Tables"]["outlets"]["Row"]> & {
          name: string;
          slug: string;
        };
```

Then, in the `Tables` object, add a new `places_sync_state` entry right after the `alert_settings` block (after its closing `};` around line 199):

```ts
      places_sync_state: {
        Row: {
          id: boolean;
          last_synced_at: string | null;
          last_status: PlacesSyncStatus;
          last_error: string | null;
          outlets_synced: number;
          new_reviews_found: number;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["places_sync_state"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["places_sync_state"]["Row"]>;
        Relationships: never[];
      };
```

Finally, add the new exported type near the other status-enum exports at the top of the file (right after `export type GoogleConnectionStatus = ...` around line 45):

```ts
export type PlacesSyncStatus = "idle" | "running" | "success" | "failed";
```

- [ ] **Step 5: Update `types/domain.ts`**

In `OutletSummary` (around line 35-48), change:

```ts
export interface OutletSummary {
  id: string;
  googleLocationId: string;
```
to:
```ts
export interface OutletSummary {
  id: string;
  googleLocationId: string | null;
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: no errors. (`lib/outlets/queries.ts` maps `googleLocationId: o.google_location_id` directly — it already tolerates the widened type with no changes needed, since it's a straight passthrough.)

- [ ] **Step 7: Commit**

```bash
git add sql/012_places_sync.sql sql/_combined_migration.sql types/database.ts types/domain.ts
git commit -m "Add places_sync_state table and make outlets.google_location_id nullable"
```

---

### Task 2: Test infrastructure + `lib/places/client.ts`

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add `vitest` devDependency + `test` script)
- Create: `types/places.ts`
- Create: `lib/places/client.ts`
- Test: `lib/places/client.test.ts`
- Modify: `.env.example` (add `GOOGLE_PLACES_API_KEY`)

**Interfaces:**
- Consumes: `GoogleReview` from `types/google.ts` (existing).
- Produces: `PlaceDetails { rating: number | null; userRatingCount: number | null; reviews: GoogleReview[] }`, `PlaceSearchResult { placeId: string; name: string; address: string | null; latitude: number | null; longitude: number | null; rating: number | null; userRatingCount: number | null }` — both from `types/places.ts`.
- Produces: `getPlaceDetails(placeId: string): Promise<PlaceDetails>` and `searchPlaceText(query: string): Promise<PlaceSearchResult | null>` from `lib/places/client.ts` — consumed by Task 3 (`sync.ts`) and Task 6 (`resolve-places.ts`).

- [ ] **Step 1: Install vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` block, add (alongside the existing `"seed": "tsx scripts/seed.ts"` line):

```json
    "test": "vitest run",
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 4: Create `types/places.ts`**

```ts
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
```

- [ ] **Step 5: Write the failing tests**

Create `lib/places/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("lib/places/client", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GOOGLE_PLACES_API_KEY;

  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = "test-api-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.GOOGLE_PLACES_API_KEY = originalApiKey;
    vi.resetModules();
  });

  it("getPlaceDetails maps reviews and sends the right headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rating: 4.5,
        userRatingCount: 120,
        reviews: [
          {
            name: "places/ChIJabc/reviews/xyz",
            rating: 5,
            text: { text: "Enak banget!" },
            authorAttribution: { displayName: "Budi S.", photoUri: "https://example.com/p.jpg" },
            publishTime: "2026-01-01T00:00:00Z",
          },
        ],
      }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const { getPlaceDetails } = await import("./client");
    const result = await getPlaceDetails("ChIJabc");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://places.googleapis.com/v1/places/ChIJabc",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-Goog-Api-Key": "test-api-key",
          "X-Goog-FieldMask": "rating,userRatingCount,reviews",
        }),
      })
    );

    expect(result.rating).toBe(4.5);
    expect(result.userRatingCount).toBe(120);
    expect(result.reviews).toEqual([
      {
        reviewId: "places/ChIJabc/reviews/xyz",
        locationId: "places/ChIJabc",
        reviewer: { displayName: "Budi S.", photoUrl: "https://example.com/p.jpg" },
        starRating: 5,
        comment: "Enak banget!",
        createTime: "2026-01-01T00:00:00Z",
        updateTime: "2026-01-01T00:00:00Z",
      },
    ]);
  });

  it("getPlaceDetails returns nulls/empty reviews when the place has none", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    const { getPlaceDetails } = await import("./client");
    const result = await getPlaceDetails("ChIJempty");

    expect(result).toEqual({ rating: null, userRatingCount: null, reviews: [] });
  });

  it("getPlaceDetails falls back to defaults for a review missing optional fields", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        reviews: [{ name: "places/x/reviews/y", rating: 3, publishTime: "2026-02-01T00:00:00Z" }],
      }),
    }) as unknown as typeof fetch;

    const { getPlaceDetails } = await import("./client");
    const result = await getPlaceDetails("ChIJx");

    expect(result.reviews[0]).toEqual({
      reviewId: "places/x/reviews/y",
      locationId: "places/ChIJx",
      reviewer: { displayName: "Google User", photoUrl: null },
      starRating: 3,
      comment: null,
      createTime: "2026-02-01T00:00:00Z",
      updateTime: "2026-02-01T00:00:00Z",
    });
  });

  it("getPlaceDetails throws when the API responds with an error", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "PERMISSION_DENIED",
    }) as unknown as typeof fetch;

    const { getPlaceDetails } = await import("./client");
    await expect(getPlaceDetails("ChIJbad")).rejects.toThrow(/403/);
  });

  it("throws a clear error when GOOGLE_PLACES_API_KEY is not configured", async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const { getPlaceDetails } = await import("./client");
    await expect(getPlaceDetails("ChIJabc")).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);
  });

  it("searchPlaceText returns null when no places match", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as unknown as typeof fetch;

    const { searchPlaceText } = await import("./client");
    const result = await searchPlaceText("Suka Shawarma Nowhere");

    expect(result).toBeNull();
  });

  it("searchPlaceText maps the first candidate", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            id: "ChIJcibubur",
            displayName: { text: "Suka Shawarma Cibubur" },
            formattedAddress: "Jl. Alternatif Cibubur No. 45",
            location: { latitude: -6.3729, longitude: 106.9256 },
            rating: 4.6,
            userRatingCount: 340,
          },
        ],
      }),
    }) as unknown as typeof fetch;

    const { searchPlaceText } = await import("./client");
    const result = await searchPlaceText("Suka Shawarma Cibubur, Jakarta Timur");

    expect(result).toEqual({
      placeId: "ChIJcibubur",
      name: "Suka Shawarma Cibubur",
      address: "Jl. Alternatif Cibubur No. 45",
      latitude: -6.3729,
      longitude: 106.9256,
      rating: 4.6,
      userRatingCount: 340,
    });
  });
});
```

- [ ] **Step 6: Run the tests to verify they fail**

```bash
npx vitest run lib/places/client.test.ts
```
Expected: FAIL — `Cannot find module './client'` (the file doesn't exist yet).

- [ ] **Step 7: Implement `lib/places/client.ts`**

```ts
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

- [ ] **Step 8: Run the tests to verify they pass**

```bash
npx vitest run lib/places/client.test.ts
```
Expected: PASS — all 7 tests green.

- [ ] **Step 9: Add the env var to `.env.example`**

Add a new section at the end of `.env.example` (after the Gemini section):

```
# ── Places API review sync (independent of GOOGLE_MODE, no OAuth needed) ──
# https://console.cloud.google.com — enable "Places API (New)", create a key.
GOOGLE_PLACES_API_KEY=
```

- [ ] **Step 10: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add vitest.config.ts package.json package-lock.json types/places.ts lib/places/client.ts lib/places/client.test.ts .env.example
git commit -m "Add Places API client with tests"
```

---

### Task 3: `lib/places/sync.ts` — sync orchestrator

**Files:**
- Create: `lib/places/sync.ts`
- Test: `lib/places/sync.test.ts`

**Interfaces:**
- Consumes: `getPlaceDetails` from `lib/places/client.ts` (Task 2); `ingestGoogleReview`, `processIngestedReview` from `lib/reviews/ingest-review.ts` (existing, signatures: `ingestGoogleReview(outletId: string, review: GoogleReview): Promise<{ reviewId: string; outletId: string; isNew: boolean }>`, `processIngestedReview(result, outletName: string, rating: number): Promise<void>`); `createAdminClient` from `lib/supabase/admin.ts` (existing).
- Produces: `PlacesSyncOutletError { outletId: string; outletName: string; message: string }`, `PlacesSyncSummary { outletsProcessed: number; outletsSkippedNoPlaceId: number; newReviewsFound: number; errors: PlacesSyncOutletError[] }`, `runPlacesSync(): Promise<PlacesSyncSummary>` — consumed by Task 4 (route).

- [ ] **Step 1: Write the failing tests**

Create `lib/places/sync.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetPlaceDetails = vi.fn();
vi.mock("./client", () => ({ getPlaceDetails: mockGetPlaceDetails }));

const mockIngestGoogleReview = vi.fn();
const mockProcessIngestedReview = vi.fn();
vi.mock("@/lib/reviews/ingest-review", () => ({
  ingestGoogleReview: mockIngestGoogleReview,
  processIngestedReview: mockProcessIngestedReview,
}));

interface FakeOutlet {
  id: string;
  name: string;
  google_place_id: string | null;
}

function mockSupabase(outlets: FakeOutlet[]) {
  const updateCalls: { table: string; values: Record<string, unknown> }[] = [];
  return {
    client: {
      from(table: string) {
        return {
          select: () => ({
            eq: async () => ({ data: outlets, error: null }),
          }),
          update: (values: Record<string, unknown>) => ({
            eq: async () => {
              updateCalls.push({ table, values });
              return { data: null, error: null };
            },
          }),
        };
      },
    },
    updateCalls,
  };
}

const mockCreateAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockCreateAdminClient() }));

describe("runPlacesSync", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("processes new reviews through the pipeline and skips already-seen ones", async () => {
    const { updateCalls, client } = mockSupabase([{ id: "o1", name: "Outlet 1", google_place_id: "place-1" }]);
    mockCreateAdminClient.mockReturnValue(client);

    mockGetPlaceDetails.mockResolvedValue({
      rating: 4.7,
      userRatingCount: 200,
      reviews: [
        { reviewId: "r-new", locationId: "places/place-1", reviewer: { displayName: "A", photoUrl: null }, starRating: 5, comment: null, createTime: "t", updateTime: "t" },
        { reviewId: "r-old", locationId: "places/place-1", reviewer: { displayName: "B", photoUrl: null }, starRating: 3, comment: null, createTime: "t", updateTime: "t" },
      ],
    });

    mockIngestGoogleReview
      .mockResolvedValueOnce({ reviewId: "id-new", outletId: "o1", isNew: true })
      .mockResolvedValueOnce({ reviewId: "id-old", outletId: "o1", isNew: false });

    const { runPlacesSync } = await import("./sync");
    const summary = await runPlacesSync();

    expect(mockProcessIngestedReview).toHaveBeenCalledTimes(1);
    expect(mockProcessIngestedReview).toHaveBeenCalledWith({ reviewId: "id-new", outletId: "o1", isNew: true }, "Outlet 1", 5);
    expect(summary.newReviewsFound).toBe(1);
    expect(summary.outletsProcessed).toBe(1);
    expect(summary.errors).toEqual([]);

    const ratingUpdate = updateCalls.find((c) => c.table === "outlets");
    expect(ratingUpdate?.values).toEqual({ current_rating: 4.7, total_reviews: 200 });
  });

  it("continues to the next outlet when one outlet's Places lookup fails", async () => {
    const { client } = mockSupabase([
      { id: "o1", name: "Outlet 1", google_place_id: "place-1" },
      { id: "o2", name: "Outlet 2", google_place_id: "place-2" },
    ]);
    mockCreateAdminClient.mockReturnValue(client);

    mockGetPlaceDetails
      .mockRejectedValueOnce(new Error("Places API getPlaceDetails failed: 404 NOT_FOUND"))
      .mockResolvedValueOnce({ rating: 4.0, userRatingCount: 50, reviews: [] });

    const { runPlacesSync } = await import("./sync");
    const summary = await runPlacesSync();

    expect(summary.outletsProcessed).toBe(1);
    expect(summary.errors).toEqual([{ outletId: "o1", outletName: "Outlet 1", message: "Places API getPlaceDetails failed: 404 NOT_FOUND" }]);
  });

  it("skips outlets with no google_place_id and counts them separately", async () => {
    const { client } = mockSupabase([{ id: "o1", name: "Outlet 1", google_place_id: null }]);
    mockCreateAdminClient.mockReturnValue(client);

    const { runPlacesSync } = await import("./sync");
    const summary = await runPlacesSync();

    expect(mockGetPlaceDetails).not.toHaveBeenCalled();
    expect(summary.outletsSkippedNoPlaceId).toBe(1);
    expect(summary.outletsProcessed).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run lib/places/sync.test.ts
```
Expected: FAIL — `Cannot find module './sync'`.

- [ ] **Step 3: Implement `lib/places/sync.ts`**

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { ingestGoogleReview, processIngestedReview } from "@/lib/reviews/ingest-review";
import { getPlaceDetails } from "./client";

export interface PlacesSyncOutletError {
  outletId: string;
  outletName: string;
  message: string;
}

export interface PlacesSyncSummary {
  outletsProcessed: number;
  outletsSkippedNoPlaceId: number;
  newReviewsFound: number;
  errors: PlacesSyncOutletError[];
}

/**
 * Polls the Places API for every active outlet that has a google_place_id,
 * ingests its reviews through the standard pipeline, and overwrites the
 * outlet's rating/total_reviews with Places' own authoritative numbers
 * (never recomputeOutletStats — see Global Constraints). One outlet
 * failing does not stop the rest, since this runs unattended via cron.
 */
export async function runPlacesSync(): Promise<PlacesSyncSummary> {
  const supabase = createAdminClient();

  const { data: outlets, error: outletsError } = await supabase
    .from("outlets")
    .select("id, name, google_place_id")
    .eq("is_active", true);

  if (outletsError) {
    throw new Error(`Failed to list outlets: ${outletsError.message}`);
  }

  const rows = outlets ?? [];
  const withPlaceId = rows.filter((o): o is typeof o & { google_place_id: string } => !!o.google_place_id);
  const outletsSkippedNoPlaceId = rows.length - withPlaceId.length;

  let outletsProcessed = 0;
  let newReviewsFound = 0;
  const errors: PlacesSyncOutletError[] = [];

  for (const outlet of withPlaceId) {
    try {
      const details = await getPlaceDetails(outlet.google_place_id);

      for (const review of details.reviews) {
        const result = await ingestGoogleReview(outlet.id, review);
        if (result.isNew) {
          newReviewsFound += 1;
          await processIngestedReview(result, outlet.name, review.starRating);
        }
      }

      if (details.rating !== null && details.userRatingCount !== null) {
        await supabase
          .from("outlets")
          .update({ current_rating: details.rating, total_reviews: details.userRatingCount })
          .eq("id", outlet.id);
      }

      outletsProcessed += 1;
    } catch (err) {
      errors.push({
        outletId: outlet.id,
        outletName: outlet.name,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { outletsProcessed, outletsSkippedNoPlaceId, newReviewsFound, errors };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run lib/places/sync.test.ts
```
Expected: PASS — all 3 tests green.

- [ ] **Step 5: Type-check and commit**

```bash
npx tsc --noEmit -p tsconfig.json
git add lib/places/sync.ts lib/places/sync.test.ts
git commit -m "Add Places sync orchestrator with tests"
```

---

### Task 4: Sync endpoint + Vercel Cron config

**Files:**
- Create: `app/api/places/sync/route.ts`
- Create: `vercel.json`
- Modify: `.env.example` (add `CRON_SECRET`)

**Interfaces:**
- Consumes: `runPlacesSync` from `lib/places/sync.ts` (Task 3); `getCurrentProfile`, `canManage` from `lib/auth/get-current-profile.ts` (existing, same signature used by `app/api/google/sync/route.ts`); `createAdminClient` from `lib/supabase/admin.ts`.
- Produces: `GET`/`POST` handlers at `/api/places/sync` — consumed by Task 5's "Sync Now" button (`POST`) and Vercel Cron (`GET`).

- [ ] **Step 1: Implement the route**

Create `app/api/places/sync/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentProfile, canManage } from "@/lib/auth/get-current-profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { runPlacesSync, type PlacesSyncSummary } from "@/lib/places/sync";

async function performSync(): Promise<PlacesSyncSummary> {
  const supabase = createAdminClient();
  await supabase.from("places_sync_state").update({ last_status: "running" }).eq("id", true);

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
      .update({ last_status: "failed", last_error: message.slice(0, 500) })
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
```

- [ ] **Step 2: Create `vercel.json`**

```json
{
  "crons": [{ "path": "/api/places/sync", "schedule": "0 20 * * *" }]
}
```

(`0 20 * * *` = 20:00 UTC = 03:00 WIB the next day. Vercel cron schedules are always UTC.)

- [ ] **Step 3: Add `CRON_SECRET` to `.env.example`**

In the Places API section added in Task 2, add below `GOOGLE_PLACES_API_KEY`:

```
# MUST be named exactly CRON_SECRET — Vercel only auto-attaches the
# Authorization header to cron requests for an env var with this literal
# name. Generate with: openssl rand -hex 24
CRON_SECRET=
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: no errors.

- [ ] **Step 5: Manual verification against a real Supabase project**

This needs `GOOGLE_PLACES_API_KEY`, `CRON_SECRET`, and at least one outlet with `google_place_id` set — if none exist yet, this step can be deferred until after Task 6 (bootstrap script). Once available:

```bash
npm run dev
# in another terminal, once the dev server is up:
curl -i http://localhost:3000/api/places/sync -H "Authorization: Bearer $CRON_SECRET"
# expect: HTTP 200, {"ok":true,"outletsProcessed":...}
curl -i http://localhost:3000/api/places/sync -H "Authorization: Bearer wrong"
# expect: HTTP 401
```

- [ ] **Step 6: Commit**

```bash
git add app/api/places/sync/route.ts vercel.json .env.example
git commit -m "Add Places sync endpoint with Vercel Cron config"
```

---

### Task 5: Settings UI — Places sync card

**Files:**
- Create: `components/settings/places-sync-card.tsx`
- Modify: `app/(app)/settings/page.tsx`

**Interfaces:**
- Consumes: `places_sync_state` row shape from Task 1; `formatRelativeID` from `lib/format.ts` (existing, used identically by `GoogleConnectionCard`).
- Produces: `PlacesSyncCard({ configured, state, linkedOutlets, canManage }: PlacesSyncCardProps)` component.

- [ ] **Step 1: Implement the card component**

Create `components/settings/places-sync-card.tsx`:

```tsx
"use client";

import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeID } from "@/lib/format";
import type { PlacesSyncStatus } from "@/types/database";

interface PlacesSyncStateSummary {
  lastSyncedAt: string | null;
  lastStatus: PlacesSyncStatus;
  lastError: string | null;
  newReviewsFound: number;
}

export function PlacesSyncCard({
  configured,
  state,
  linkedOutlets,
  canManage,
}: {
  configured: boolean;
  state: PlacesSyncStateSummary | null;
  linkedOutlets: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      await fetch("/api/places/sync", { method: "POST" });
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  const failed = state?.lastStatus === "failed";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Google Places Review Sync</CardTitle>
          <CardDescription>Sumber data alternatif tanpa perlu akses Manager Google Business Profile.</CardDescription>
        </div>
        <Badge variant={!configured ? "outline" : failed ? "negative" : "positive"}>
          {!configured ? "BELUM DIKONFIGURASI" : failed ? "SYNC GAGAL" : "AKTIF"}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!configured && (
          <p className="text-sm text-muted-foreground">
            Set <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-xs">GOOGLE_PLACES_API_KEY</code> di
            environment variables untuk mengaktifkan sumber data ini.
          </p>
        )}

        {configured && (
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Outlet Terhubung</p>
              <p className="text-foreground">{linkedOutlets}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sync Terakhir</p>
              <p className="text-foreground">{state?.lastSyncedAt ? formatRelativeID(state.lastSyncedAt) : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Review Baru (Sync Terakhir)</p>
              <p className="text-foreground">{state?.newReviewsFound ?? 0}</p>
            </div>
          </div>
        )}

        {configured && failed && state?.lastError && <p className="text-xs text-negative">{state.lastError}</p>}

        {!canManage && <p className="text-xs text-muted-foreground">Hanya owner/admin yang dapat menjalankan sync.</p>}

        {configured && canManage && (
          <div>
            <Button variant="secondary" onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Sync Now
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Wire it into the Settings page**

`app/(app)/settings/page.tsx` currently creates its `createAdminClient()` instance *inside* the `if (canManageSettings && !isDemoMode)` block (only used there for the `connection` query). The Places card must be visible to everyone who can see Settings (viewers included, same as `GoogleConnectionCard` — the card itself gates the "Sync Now" button on `canManage`, not page-level visibility), regardless of `GOOGLE_MODE`. So hoist `admin` out to always run, and add the two new queries unconditionally.

Replace:

```ts
  const { data: users } = await supabase.from("profiles").select("id, full_name, email, role").order("created_at");

  let connection = null;
  if (canManageSettings && !isDemoMode) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("google_connections")
      .select("account_id, account_name, status, locations_count, last_sync_at")
      .eq("status", "connected")
      .maybeSingle();
    if (data) {
      connection = {
        accountId: data.account_id,
        accountName: data.account_name,
        status: data.status,
        locationsCount: data.locations_count,
        lastSyncAt: data.last_sync_at,
      };
    }
  }
```

with:

```ts
  const { data: users } = await supabase.from("profiles").select("id, full_name, email, role").order("created_at");

  const admin = createAdminClient();

  let connection = null;
  if (canManageSettings && !isDemoMode) {
    const { data } = await admin
      .from("google_connections")
      .select("account_id, account_name, status, locations_count, last_sync_at")
      .eq("status", "connected")
      .maybeSingle();
    if (data) {
      connection = {
        accountId: data.account_id,
        accountName: data.account_name,
        status: data.status,
        locationsCount: data.locations_count,
        lastSyncAt: data.last_sync_at,
      };
    }
  }

  const { data: placesSyncRow } = await admin
    .from("places_sync_state")
    .select("last_synced_at, last_status, last_error, new_reviews_found")
    .eq("id", true)
    .maybeSingle();

  const { count: placesLinkedOutlets } = await admin
    .from("outlets")
    .select("id", { count: "exact", head: true })
    .not("google_place_id", "is", null);
```

Add the import at the top (alongside the other settings-card imports):

```ts
import { PlacesSyncCard } from "@/components/settings/places-sync-card";
```

Then, right after the `<GoogleConnectionCard .../>` JSX line, add:

```tsx
      <PlacesSyncCard
        configured={!!process.env.GOOGLE_PLACES_API_KEY}
        state={
          placesSyncRow
            ? {
                lastSyncedAt: placesSyncRow.last_synced_at,
                lastStatus: placesSyncRow.last_status,
                lastError: placesSyncRow.last_error,
                newReviewsFound: placesSyncRow.new_reviews_found,
              }
            : null
        }
        linkedOutlets={placesLinkedOutlets ?? 0}
        canManage={canManageSettings}
      />
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: no errors.

- [ ] **Step 4: Lint**

```bash
npx eslint components/settings/places-sync-card.tsx "app/(app)/settings/page.tsx"
```
Expected: no errors.

- [ ] **Step 5: Manual browser check**

```bash
npm run dev
```
Open `http://localhost:3000/settings`, confirm the "Google Places Review Sync" card renders below the Google Business Profile card, showing "BELUM DIKONFIGURASI" if `GOOGLE_PLACES_API_KEY` isn't set yet in your `.env.local`.

- [ ] **Step 6: Commit**

```bash
git add components/settings/places-sync-card.tsx "app/(app)/settings/page.tsx"
git commit -m "Add Places sync card to Settings"
```

---

### Task 6: Outlet bootstrap script

**Files:**
- Modify: `lib/google/sync.ts:8-15` (export the existing `slugify` helper)
- Create: `scripts/places-outlets.ts`
- Create: `scripts/resolve-places.ts`
- Modify: `package.json` (add `resolve-places` script)

**Interfaces:**
- Consumes: `searchPlaceText` from `lib/places/client.ts` (Task 2); `slugify` from `lib/google/sync.ts` (this task).

- [ ] **Step 1: Export `slugify` from `lib/google/sync.ts`**

In `lib/google/sync.ts`, change:

```ts
function slugify(name: string): string {
```
to:
```ts
export function slugify(name: string): string {
```

- [ ] **Step 2: Create the outlet list file**

Create `scripts/places-outlets.ts`:

```ts
/**
 * Real Suka Shawarma outlets to resolve via scripts/resolve-places.ts.
 * Edit this list, then run `npm run resolve-places`.
 */
export interface RealOutletInput {
  name: string;
  city: string;
  searchQuery: string;
}

export const REAL_OUTLETS: RealOutletInput[] = [
  // { name: "Suka Shawarma Cibubur", city: "Jakarta Timur", searchQuery: "Suka Shawarma Cibubur, Jakarta Timur" },
];
```

- [ ] **Step 3: Implement the resolver script**

Create `scripts/resolve-places.ts`:

```ts
/**
 * Resolves each outlet in scripts/places-outlets.ts to a Google Place ID via
 * Places API Text Search, confirms the match interactively, then upserts it
 * into `outlets` (conflict key: slug). Run once, or whenever outlets change.
 *
 * Usage: npm run resolve-places
 */
import { config } from "dotenv";
import { existsSync } from "fs";
import { createInterface } from "readline/promises";
import { createClient } from "@supabase/supabase-js";
import { searchPlaceText } from "../lib/places/client";
import { slugify } from "../lib/google/sync";
import { REAL_OUTLETS } from "./places-outlets";

const envFile = existsSync(".env.local") ? ".env.local" : ".env";
config({ path: envFile });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      `Checked ${envFile} — copy .env.example to .env.local and fill in your Supabase project keys first.`
  );
  process.exit(1);
}

if (!process.env.GOOGLE_PLACES_API_KEY) {
  console.error("Missing GOOGLE_PLACES_API_KEY in your environment.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const rl = createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  if (REAL_OUTLETS.length === 0) {
    console.error("scripts/places-outlets.ts is empty — add your real outlets to REAL_OUTLETS first.");
    process.exit(1);
  }

  let resolved = 0;
  let skipped = 0;
  let failed = 0;

  for (const outlet of REAL_OUTLETS) {
    console.log(`\nSearching: "${outlet.searchQuery}"...`);

    let candidate;
    try {
      candidate = await searchPlaceText(outlet.searchQuery);
    } catch (err) {
      console.error(`  Search failed: ${err instanceof Error ? err.message : err}`);
      failed += 1;
      continue;
    }

    if (!candidate) {
      console.log(`  No match found — skipping.`);
      skipped += 1;
      continue;
    }

    console.log(`  Found: ${candidate.name}`);
    console.log(`    Place ID: ${candidate.placeId}`);
    console.log(`    Address:  ${candidate.address ?? "(none)"}`);
    console.log(`    Rating:   ${candidate.rating ?? "-"} (${candidate.userRatingCount ?? 0} reviews)`);

    const answer = (await rl.question(`  Use this for "${outlet.name}"? [y/N] `)).trim().toLowerCase();
    if (answer !== "y") {
      console.log("  Skipped.");
      skipped += 1;
      continue;
    }

    const { error } = await supabase.from("outlets").upsert(
      {
        slug: slugify(outlet.name),
        name: outlet.name,
        city: outlet.city,
        address: candidate.address,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        google_place_id: candidate.placeId,
      },
      { onConflict: "slug" }
    );

    if (error) {
      console.error(`  Failed to save: ${error.message}`);
      failed += 1;
      continue;
    }

    console.log("  Saved.");
    resolved += 1;
  }

  rl.close();
  console.log(`\nDone. Resolved: ${resolved}, skipped: ${skipped}, failed: ${failed}.`);
}

main();
```

- [ ] **Step 4: Add the npm script**

In `package.json`, add to `"scripts"` (alongside `"seed"`):

```json
    "resolve-places": "tsx scripts/resolve-places.ts",
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit -p tsconfig.json
```
Expected: no errors.

- [ ] **Step 6: Manual dry run**

Add one real outlet to `scripts/places-outlets.ts`, with `GOOGLE_PLACES_API_KEY` set in `.env.local`, then:

```bash
npm run resolve-places
```
Expected: prints the search result, prompts `[y/N]`, and on `y` upserts the outlet — verify with:
```sql
select name, slug, google_place_id, address from public.outlets where google_place_id is not null;
```

- [ ] **Step 7: Commit**

```bash
git add lib/google/sync.ts scripts/places-outlets.ts scripts/resolve-places.ts package.json
git commit -m "Add outlet bootstrap script for Places API sync"
```

---

## Post-plan: end-to-end check

Once all 6 tasks are done and at least one real outlet has been resolved (Task 6):

1. `npm run dev`, open Settings, confirm "Google Places Review Sync" shows the linked outlet count.
2. Click "Sync Now", confirm it succeeds and the card updates with a sync time and review count.
3. Check the live review feed / outlet page for the newly-ingested review(s), confirm sentiment/category tags appear (Gemini ran).
4. If a synced review is rated ≤2, confirm an alert appears on the Alerts page.
5. Deploy to Vercel, confirm the cron job appears under Project Settings → Cron Jobs, and check its logs after the next scheduled run.
