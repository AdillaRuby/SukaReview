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
