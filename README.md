# SukaReview

Google Review Monitoring for Suka Shawarma — an internal operations dashboard, not a marketing site. Built with Next.js (App Router), TypeScript, Tailwind, Supabase (Postgres + Realtime + Auth), and Gemini for review analysis.

## What this is

SukaReview pulls Google reviews from every Suka Shawarma outlet into one live dashboard: new reviews appear instantly (no refresh) with a toast + sound, Gemini tags each review's sentiment and category, and an alert engine flags outlets that need attention (a bad-review spike, a rating drop, a rating below threshold).

The app runs in two modes, controlled by `GOOGLE_MODE`:

- **`demo`** (default) — realistic seed data, a "Simulate New Review" button to exercise the whole realtime pipeline, zero Google credentials required. Use this to build/test the UI and to demo the product before Google API access is approved.
- **`live`** — real Google Business Profile integration via OAuth + Cloud Pub/Sub.

Nothing in the UI hard-depends on Google credentials existing — you can build and demo the entire product in demo mode.

## 1. Install dependencies

```bash
npm install
```

## 2. Configure Supabase

Create a project at [supabase.com](https://supabase.com), then grab these from **Project Settings > API**:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose this)

## 3. Run SQL migrations

In the Supabase SQL Editor, run every file in [`sql/`](sql/) **in numeric order** (001 through 011). Or via the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
for f in sql/*.sql; do supabase db execute --file "$f"; done
```

This creates all tables, RLS policies, the alert-rule settings row, and the Realtime "Broadcast from Database" triggers that power the live feed.

## 4. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in the Supabase values from step 2. Leave everything under "Google Business Profile" and "Gemini" blank for now — the app runs fine without them in demo mode.

## 5. Seed demo data

```bash
npm run seed
```

This inserts ~18 outlets and ~90 realistic Indonesian reviews (mixed ratings/sentiment, pre-analyzed so it doesn't need a Gemini key), plus a deliberate negative burst on one outlet so the "Outlet Butuh Perhatian" panel and Alerts page have something to show immediately.

## 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign up for an account on the login screen — **the first account created automatically becomes `owner`**; everyone after that defaults to `viewer` (promote them from Settings → Users).

## 7. Test the realtime simulator

On the Dashboard (demo mode only), click **"Simulate New Review"** in the bottom-right corner. This inserts a fake review server-side and exercises the full pipeline: Postgres insert → Realtime broadcast → toast → sound → Gemini analysis (if configured) → alert rules → outlet stats update. No page refresh.

## 8. Configure Gemini API (optional, Phase 3)

1. Get a key from [Google AI Studio](https://aistudio.google.com/apikey) (free tier available).
2. Set `GEMINI_API_KEY` in `.env.local`.
3. Restart the dev server.

Without a key, reviews still save fine — they just sit at `analysis_status = pending`, and a **Retry** link appears on the sentiment badge once you add a key.

## 9. Configure Google Cloud (optional, Phase 4-5 — only needed for `GOOGLE_MODE=live`)

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com).
2. Note the Project ID → `GOOGLE_CLOUD_PROJECT_ID`.
3. **Request Google Business Profile API access** — this is the slow part. It's a gated API: fill out [Google's access request form](https://developers.google.com/my-business/content/prereqs), tied to this Cloud project, and to a Google account that's an **Owner or Manager** on the real Suka Shawarma Business Profile. Approval can take days to weeks — this is normal, not a sign anything is broken. Everything else below can be set up while you wait.

## 10. Enable required Google Business Profile APIs

In Cloud Console → APIs & Services → Library, enable:

- My Business Account Management API
- My Business Business Information API
- My Business API (v4 — used for reviews)
- My Business Notifications API
- Cloud Pub/Sub API

## 11. Configure OAuth

1. APIs & Services → Credentials → Create OAuth client ID (type: Web application).
2. Authorized redirect URI: `{NEXT_PUBLIC_APP_URL}/api/google/oauth/callback` (e.g. `https://sukareview.yourcompany.com/api/google/oauth/callback`).
3. Copy Client ID / Secret into `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, and set `GOOGLE_REDIRECT_URI` to the exact URI above.

## 12. Configure Cloud Pub/Sub

1. Create a topic, e.g. `suka-review-notifications` → `GOOGLE_PUBSUB_TOPIC=projects/{project-id}/topics/suka-review-notifications`.
2. Create a **push subscription** on that topic pointing at:
   `{NEXT_PUBLIC_APP_URL}/api/google/pubsub?token={GOOGLE_PUBSUB_VERIFICATION_TOKEN}`
3. Generate a random token for `GOOGLE_PUBSUB_VERIFICATION_TOKEN` (e.g. `openssl rand -hex 24`) and use the same value in the subscription URL above — the webhook rejects requests with a missing/wrong token.

## 13. Set Pub/Sub permissions

Grant the Google Business Profile service account (`mybusiness-api-pubsub@system.gserviceaccount.com`) the **Pub/Sub Publisher** role on your topic (IAM & Admin → your topic → Add principal).

## 14. Configure the notification webhook

Nothing to do manually here — once you connect a Google account from **Settings → Google Business Profile**, SukaReview automatically registers `GOOGLE_PUBSUB_TOPIC` with Google's Notifications API so `NEW_REVIEW`/`UPDATED_REVIEW` events start flowing to `/api/google/pubsub`.

## 15. Go live

Once Google approves API access and steps 9-14 are done:

```bash
GOOGLE_MODE=live
```

Set `TOKEN_ENCRYPTION_KEY` (`openssl rand -hex 32`) — this encrypts the stored OAuth tokens at rest. Restart the app, then go to **Settings → Google Business Profile → Connect Google Account** and sign in with the account that manages the real Suka Shawarma listings. Initial sync pulls every outlet + historical review automatically.

## 16. Replace the notification sound

Drop your MP3 at `public/sounds/review-notification.mp3` (see [public/sounds/README.md](public/sounds/README.md)). No code changes needed — missing file just means silent notifications, never a crash.

---

## What Suka Shawarma's owner needs to provide, concretely

- **Manager access** on the real Google Business Profile (a 2-minute step from the Google Business Profile app — no password sharing needed), so someone can request API access and complete OAuth.
- Sign-off on which Google Cloud project owns the API access request (usually whoever manages IT/ops).
- Patience for the Google approval step (days–weeks) — everything else in this app works today without it, via `GOOGLE_MODE=demo`.

## Architecture notes

- **Realtime**: uses Supabase's "Broadcast from Database" pattern (Postgres triggers → `realtime.broadcast_changes` → private channels), not raw Postgres Changes — this is the pattern Supabase recommends for production scale. See [`sql/010_realtime.sql`](sql/010_realtime.sql) and [`lib/realtime/`](lib/realtime/).
- **Google integration** lives entirely under [`lib/google/`](lib/google/) behind a small interface (`accounts.ts`, `locations.ts`, `reviews.ts`, `notifications.ts`), each with a `demo`/`live` branch — swap or debug the Google layer without touching UI or DB code.
- **Gemini analysis** is async and non-blocking: a review is saved immediately (`analysis_status = pending`), analyzed in the background, and never blocks the write path. Failures mark `analysis_status = failed` with a Retry affordance instead of losing data.
- **Duplicate protection**: `reviews.google_review_id` is a unique constraint; all ingestion goes through a single `upsert` path ([`lib/reviews/ingest-review.ts`](lib/reviews/ingest-review.ts)), so repeated Pub/Sub deliveries never create duplicates.
- **RLS**: the browser only ever holds the anon key. `owner`/`admin` roles can manage settings/alerts/Google integration; `viewer` is read-only. The service role key is used exclusively in server-only code (`lib/supabase/admin.ts`, guarded by the `server-only` package).
