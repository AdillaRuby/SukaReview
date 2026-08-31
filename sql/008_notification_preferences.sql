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
