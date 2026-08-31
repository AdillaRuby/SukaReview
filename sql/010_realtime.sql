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
