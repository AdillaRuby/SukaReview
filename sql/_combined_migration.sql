-- SukaReview: combined migration (sql/001 - sql/011)
-- Generated for one-shot paste into Supabase SQL Editor.

-- ==================== sql/001_extensions.sql ====================
-- SukaReview: extensions and shared helpers
-- Safe to re-run.

create extension if not exists pgcrypto;

-- Generic updated_at trigger, reused by every table below.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==================== sql/002_profiles.sql ====================
-- Profiles: one row per authenticated dashboard user.
-- Role drives RLS: owner/admin can manage, viewer is read-only.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  role text not null default 'viewer' check (role in ('owner', 'admin', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create a profile row whenever a new auth user signs up.
-- New users default to 'viewer'; promote to owner/admin manually in SQL:
--   update public.profiles set role = 'owner' where email = 'you@company.com';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    case when (select count(*) from public.profiles) = 0 then 'owner' else 'viewer' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper used throughout RLS policies: is the current user owner/admin?
create or replace function public.is_admin_or_owner()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_owner()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

-- ==================== sql/003_google_connections.sql ====================
-- Google Business Profile connection state.
-- OAuth tokens are NEVER stored here in plain text in application code paths;
-- this table only holds encrypted/opaque token material written by the server
-- (service role) and metadata safe to show in Settings.

create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  account_id text not null,
  account_name text not null,
  status text not null default 'connected' check (status in ('connected', 'disconnected', 'error', 'syncing')),
  -- Opaque token payload (encrypted at rest by Supabase; only ever read/written
  -- by server-side code using the service role key, never exposed to the browser).
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  locations_count integer not null default 0,
  last_sync_at timestamptz,
  last_sync_status text check (last_sync_status in ('idle', 'running', 'success', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger google_connections_set_updated_at
  before update on public.google_connections
  for each row execute function public.set_updated_at();

-- ==================== sql/004_outlets.sql ====================
-- Outlets: one row per Suka Shawarma physical location / GBP location.

create table if not exists public.outlets (
  id uuid primary key default gen_random_uuid(),
  google_location_id text not null unique,
  google_place_id text,
  name text not null,
  slug text not null unique,
  address text,
  city text,
  latitude numeric,
  longitude numeric,
  current_rating numeric(2, 1) not null default 0,
  total_reviews integer not null default 0,
  -- Derived operational status, recomputed by alert rules / sync jobs.
  status text not null default 'good' check (status in ('good', 'watch', 'attention', 'critical')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_outlets_name on public.outlets (name);
create index if not exists idx_outlets_city on public.outlets (city);
create index if not exists idx_outlets_google_location_id on public.outlets (google_location_id);
create index if not exists idx_outlets_status on public.outlets (status) where is_active = true;

create trigger outlets_set_updated_at
  before update on public.outlets
  for each row execute function public.set_updated_at();

-- ==================== sql/005_reviews.sql ====================
-- Reviews: one row per Google review. google_review_id enforces idempotent
-- upsert so repeated Pub/Sub notifications never create duplicates.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  google_review_id text not null unique,
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  reviewer_name text not null default 'Google User',
  reviewer_avatar text,
  rating integer not null check (rating between 1 and 5),
  comment text,
  google_created_at timestamptz not null,
  google_updated_at timestamptz,
  -- AI analysis (Gemini), filled in asynchronously after insert.
  sentiment text check (sentiment in ('positive', 'neutral', 'negative')),
  ai_summary text,
  urgency text check (urgency in ('low', 'medium', 'high')),
  analysis_status text not null default 'pending' check (analysis_status in ('pending', 'completed', 'failed')),
  analysis_error text,
  analysis_attempts integer not null default 0,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reviews_outlet_id on public.reviews (outlet_id);
create index if not exists idx_reviews_rating on public.reviews (rating);
create index if not exists idx_reviews_sentiment on public.reviews (sentiment);
create index if not exists idx_reviews_google_created_at on public.reviews (google_created_at desc);
create index if not exists idx_reviews_analysis_status on public.reviews (analysis_status) where analysis_status <> 'completed';
create index if not exists idx_reviews_outlet_created on public.reviews (outlet_id, google_created_at desc);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- ==================== sql/006_review_categories.sql ====================
-- Review categories: controlled taxonomy tags produced by Gemini analysis.
-- One review can have many categories (many-to-one on review).

create table if not exists public.review_categories (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  category text not null check (category in (
    'RASA', 'PELAYANAN', 'KECEPATAN', 'KEBERSIHAN', 'HARGA', 'PORSI',
    'PESANAN_SALAH', 'STAFF', 'TEMPAT', 'DELIVERY', 'KUALITAS_PRODUK', 'LAINNYA'
  )),
  aspect_sentiment text check (aspect_sentiment in ('positive', 'neutral', 'negative')),
  created_at timestamptz not null default now(),
  unique (review_id, category)
);

create index if not exists idx_review_categories_review_id on public.review_categories (review_id);
create index if not exists idx_review_categories_category on public.review_categories (category);

-- ==================== sql/007_alerts.sql ====================
-- Alerts: operational flags raised by the alert-rule engine
-- (low rating review, rating drop, negative spike, low outlet rating).

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references public.outlets (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete set null,
  type text not null check (type in (
    'LOW_RATING_REVIEW', 'RATING_DROP', 'NEGATIVE_SPIKE', 'LOW_OUTLET_RATING'
  )),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  title text not null,
  message text not null,
  status text not null default 'active' check (status in ('active', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

create index if not exists idx_alerts_status on public.alerts (status);
create index if not exists idx_alerts_severity on public.alerts (severity);
create index if not exists idx_alerts_outlet_id on public.alerts (outlet_id);
create index if not exists idx_alerts_created_at on public.alerts (created_at desc);

-- ==================== sql/008_notification_preferences.sql ====================
-- Per-user notification preferences. Device-local sound state also lives in
-- localStorage (see hooks/use-notification-sound.ts); this table is the
-- cross-device source of truth.

create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  sound_enabled boolean not null default true,
  sound_volume numeric(3, 2) not null default 0.7 check (sound_volume between 0 and 1),
  rating_trigger integer check (rating_trigger between 1 and 5),
  browser_notification_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger notification_preferences_set_updated_at
  before update on public.notification_preferences
  for each row execute function public.set_updated_at();

-- ==================== sql/009_rls_policies.sql ====================
-- Row Level Security.
-- The browser client authenticates as a real Supabase user and is subject to
-- every policy below. The service role key (server-only, used for Google
-- sync / Pub/Sub ingestion / Gemini writes) bypasses RLS entirely and must
-- never be shipped to the client.

alter table public.profiles enable row level security;
alter table public.google_connections enable row level security;
alter table public.outlets enable row level security;
alter table public.reviews enable row level security;
alter table public.review_categories enable row level security;
alter table public.alerts enable row level security;
alter table public.notification_preferences enable row level security;

-- profiles: everyone signed in can see the team roster; a user may edit
-- their own basic info, but only an owner may change roles (enforced below
-- by trigger, since RLS alone can't do column-level checks cleanly).
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.is_owner()) with check (public.is_owner());

create or replace function public.prevent_self_role_escalation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_owner() then
    raise exception 'Only an owner can change roles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_role_escalation();

-- google_connections: admin/owner only (contains integration health + token metadata).
create policy "google_connections_select_admin" on public.google_connections
  for select to authenticated using (public.is_admin_or_owner());

create policy "google_connections_write_admin" on public.google_connections
  for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- outlets: readable by every signed-in team member; edits restricted to admin/owner.
create policy "outlets_select_authenticated" on public.outlets
  for select to authenticated using (true);

create policy "outlets_write_admin" on public.outlets
  for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- reviews: readable by everyone; direct writes restricted to admin/owner
-- (normal ingestion happens server-side via the service role, bypassing RLS).
create policy "reviews_select_authenticated" on public.reviews
  for select to authenticated using (true);

create policy "reviews_write_admin" on public.reviews
  for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- review_categories: same shape as reviews.
create policy "review_categories_select_authenticated" on public.review_categories
  for select to authenticated using (true);

create policy "review_categories_write_admin" on public.review_categories
  for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- alerts: readable by everyone; only admin/owner can create/resolve.
create policy "alerts_select_authenticated" on public.alerts
  for select to authenticated using (true);

create policy "alerts_write_admin" on public.alerts
  for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- notification_preferences: strictly per-user.
create policy "notification_preferences_own" on public.notification_preferences
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ==================== sql/010_realtime.sql ====================
-- Realtime: Broadcast-from-Database pattern (Supabase's recommended
-- production/scalable approach — see lib/realtime for the client side).
--
-- Instead of clients subscribing directly to Postgres Changes on `reviews`,
-- `alerts`, and `outlets` (which does not scale well with many concurrent
-- dashboard sessions), a trigger on each table broadcasts a compact change
-- event to a well-known private channel. The Next.js app subscribes to
-- these channels via lib/realtime/channels.ts.
--
-- Full row images (old + new) are needed on UPDATE, so REPLICA IDENTITY
-- FULL is required on the source tables.

alter table public.reviews replica identity full;
alter table public.alerts replica identity full;
alter table public.outlets replica identity full;

create or replace function public.broadcast_review_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.broadcast_changes(
    'reviews:feed',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists reviews_broadcast on public.reviews;
create trigger reviews_broadcast
  after insert or update on public.reviews
  for each row execute function public.broadcast_review_change();

create or replace function public.broadcast_alert_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.broadcast_changes(
    'alerts:feed',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists alerts_broadcast on public.alerts;
create trigger alerts_broadcast
  after insert or update on public.alerts
  for each row execute function public.broadcast_alert_change();

create or replace function public.broadcast_outlet_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.broadcast_changes(
    'outlets:feed',
    tg_op,
    tg_op,
    tg_table_name,
    tg_table_schema,
    new,
    old
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists outlets_broadcast on public.outlets;
create trigger outlets_broadcast
  after update on public.outlets
  for each row execute function public.broadcast_outlet_change();

-- Broadcast channels used above are private: only authenticated dashboard
-- users may listen. All signed-in team members can see all outlets (role
-- only gates writes), so a single blanket read policy is sufficient here.
create policy "authenticated_read_broadcasts" on realtime.messages
  for select to authenticated using (true);

-- ==================== sql/011_alert_settings.sql ====================
-- Single-row table holding the alert-rule thresholds shown/edited in
-- Settings > System (spec section 42). Not explicitly listed in the core
-- schema brief, added because thresholds must live somewhere persistent
-- and editable by admin/owner rather than being hardcoded.

create table if not exists public.alert_settings (
  id boolean primary key default true check (id),
  low_outlet_rating_threshold numeric(2, 1) not null default 3.8,
  urgent_review_rating_threshold integer not null default 2 check (urgent_review_rating_threshold between 1 and 5),
  negative_spike_count integer not null default 3,
  negative_spike_window_hours integer not null default 24,
  rating_drop_threshold numeric(2, 1) not null default 0.3,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.alert_settings (id) values (true) on conflict (id) do nothing;

create trigger alert_settings_set_updated_at
  before update on public.alert_settings
  for each row execute function public.set_updated_at();

alter table public.alert_settings enable row level security;

create policy "alert_settings_select_authenticated" on public.alert_settings
  for select to authenticated using (true);

create policy "alert_settings_write_admin" on public.alert_settings
  for all to authenticated using (public.is_admin_or_owner()) with check (public.is_admin_or_owner());

-- ==================== sql/012_places_sync.sql ====================
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

-- ==================== sql/013_alert_email.sql ====================
-- Adds email delivery for the LOW_RATING_REVIEW alert rule (lib/alerts/engine.ts
-- rule 1) on top of the existing in-app alert. Reuses alert_settings as the
-- single-row config table (sql/011_alert_settings.sql) rather than a new
-- table, since there's exactly one recipient for now and it's edited from
-- the same Settings > System card.

alter table public.alert_settings
  add column if not exists notify_email_enabled boolean not null default false,
  add column if not exists notify_email text;

