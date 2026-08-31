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
