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
