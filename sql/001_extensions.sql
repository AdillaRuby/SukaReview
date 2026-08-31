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
