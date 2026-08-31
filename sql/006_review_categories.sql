-- Review categories: controlled taxonomy tags produced by Gemini analysis.
-- One review can have many categories (many-to-one on review).

create table if not exists public.review_categories (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  category text not null check (category in (
    'RASA', 'PELAYANAN', 'KECEPATAN', 'KEBERSIHAN', 'HARGA', 'PORSI',
    'PESANAN_SALAH', 'STAFF', 'TEMPAT', 'DELIVERY', 'KUALITAS_PRODUK', 'LAINNYA'
  )),
  aspect_sentiment text check (aspect_sentiment in ('positive', 'neutral', 'negative')),
  created_at timestamptz not null default now(),
  unique (review_id, category)
);

create index if not exists idx_review_categories_review_id on public.review_categories (review_id);
create index if not exists idx_review_categories_category on public.review_categories (category);
