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
