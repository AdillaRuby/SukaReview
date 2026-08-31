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
