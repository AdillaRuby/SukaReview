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
