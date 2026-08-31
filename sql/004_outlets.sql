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
