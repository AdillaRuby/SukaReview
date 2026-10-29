-- ==============================================================================
-- Seed 23 Cabang Resmi Suka Shawarma ke Database SukaReview
-- Target: Supabase project scvnmaelsamtreuetcpa
-- ==============================================================================

-- 1. Masukkan / Update Data 23 Cabang Resmi Suka Shawarma
insert into public.outlets (
  google_location_id, name, slug, address, city, latitude, longitude, current_rating, total_reviews, status, is_active
) values
  ('locations/ss-empang', 'Suka Shawarma Empang', 'empang', 'Jl. Pahlawan No.10A, Empang, Bogor Selatan', 'Bogor', -6.6079492, 106.7953519, 4.8, 142, 'good', true),
  ('locations/ss-paledang', 'Suka Shawarma Paledang', 'paledang', 'Jl. Paledang No. 18, Bogor Tengah', 'Bogor', -6.5976299, 106.7894024, 4.7, 98, 'good', true),
  ('locations/ss-cimanggu', 'Suka Shawarma Cimanggu', 'cimanggu', 'Jl. Ruko Bukit Cimanggu City Raya No.3A, Tanah Sareal', 'Bogor', -6.5541076, 106.7826057, 4.8, 115, 'good', true),
  ('locations/ss-pajajaran', 'Suka Shawarma Pajajaran', 'pajajaran', 'Jl. Raya Pajajaran No.21, Sukasari, Bogor Timur', 'Bogor', -6.6181115, 106.8154405, 4.9, 210, 'good', true),
  ('locations/ss-dramaga', 'Suka Shawarma Dramaga', 'dramaga', 'Jl. Raya Dramaga No.15, Margajaya, Bogor Barat', 'Bogor', -6.5728375, 106.7448281, 4.7, 86, 'good', true),
  ('locations/ss-sentul', 'Suka Shawarma Sentul', 'sentul', 'Jl. Raya Babakan Madang, Sentul, Bogor', 'Bogor', -6.562316, 106.86102, 4.8, 130, 'good', true),
  ('locations/ss-cibinong', 'Suka Shawarma Cibinong', 'cibinong', 'Jl. Raya Sukahati No.35, Cibinong, Bogor', 'Bogor', -6.4805417, 106.8178322, 4.6, 175, 'good', true),
  ('locations/ss-ciseeng', 'Suka Shawarma Ciseeng', 'ciseeng', 'Jl. H. Mawi No.17, Parigi Mekar, Ciseeng, Bogor', 'Bogor', -6.4712, 106.7123, 4.7, 64, 'good', true),
  ('locations/ss-cibubur', 'Suka Shawarma Cibubur', 'cibubur', 'Ruko Fresh Market Kota Wisata, Ciangsana, Gn. Putri, Bogor', 'Bogor', -6.3656095, 106.9575285, 4.8, 190, 'good', true),
  ('locations/ss-cileungsi', 'Suka Shawarma Cileungsi', 'cileungsi', 'Jl. Boulevard Metland Cileungsi, Bogor', 'Bogor', -6.3899039, 106.9867841, 4.7, 102, 'good', true),
  ('locations/ss-beji', 'Suka Shawarma Beji', 'beji', 'Jl. H. Asmawi No.44, Beji, Depok', 'Depok', -6.3764416, 106.813757, 4.8, 128, 'good', true),
  ('locations/ss-sawangan', 'Suka Shawarma Sawangan', 'sawangan', 'Jl. Raya Sawangan DTC, Mampang, Pancoran Mas, Depok', 'Depok', -6.3945632, 106.7940041, 4.6, 94, 'good', true),
  ('locations/ss-sukmajaya', 'Suka Shawarma Depok Sukmajaya', 'sukmajaya', 'Jl. K.H.M. Yusuf Raya, Mekar Jaya, Sukmajaya, Depok', 'Depok', -6.3889, 106.8345, 4.7, 78, 'good', true),
  ('locations/ss-cirendeu', 'Suka Shawarma Cirendeu', 'cirendeu', 'Jl. Raya Cirendeu, Ciputat Timur, Tangerang Selatan', 'Tangerang Selatan', -6.3210676, 106.7683419, 4.8, 110, 'good', true),
  ('locations/ss-pamulang', 'Suka Shawarma Pamulang', 'pamulang', 'Jl. Suryakencana No.54, Pamulang Barat, Tangerang Selatan', 'Tangerang Selatan', -6.3468928, 106.7351637, 4.7, 88, 'good', true),
  ('locations/ss-pondok-aren', 'Suka Shawarma Pondok Aren', 'pondok-aren', 'Jl. Jombang Raya, Pondok Aren, Tangerang Selatan', 'Tangerang Selatan', -6.2594658, 106.7040904, 4.6, 72, 'good', true),
  ('locations/ss-ciledug', 'Suka Shawarma Ciledug', 'ciledug', 'Jl. Raden Saleh, Karang Tengah, Ciledug, Tangerang', 'Tangerang', -6.2121779, 106.71225, 4.7, 85, 'good', true),
  ('locations/ss-jagakarsa', 'Suka Shawarma Jagakarsa', 'jagakarsa', 'Jl. Raya Jagakarsa No.159, Jagakarsa, Jakarta Selatan', 'Jakarta Selatan', -6.330686, 106.8280426, 4.8, 160, 'good', true),
  ('locations/ss-kalisari', 'Suka Shawarma Kalisari', 'kalisari', 'Jl. Kalisari No.13, Pasar Rebo, Jakarta Timur', 'Jakarta Timur', -6.3359964, 106.8540049, 4.7, 135, 'good', true),
  ('locations/ss-pekayon', 'Suka Shawarma Pekayon', 'pekayon', 'Jl. Pulo Ribung No.1, Pekayon Jaya, Bekasi Selatan', 'Bekasi', -6.2691389, 106.9801668, 4.7, 140, 'good', true),
  ('locations/ss-jatiwaringin', 'Suka Shawarma Jatiwaringin', 'jatiwaringin', 'Jl. Raya Jatiwaringin No.51, Pondok Gede, Bekasi', 'Bekasi', -6.2761613, 106.9130065, 4.8, 155, 'good', true),
  ('locations/ss-jatiasih', 'Suka Shawarma Jatiasih', 'jatiasih', 'Jl. Raya Mess AL No.10, Jatisari, Jatiasih, Bekasi', 'Bekasi', -6.3120, 106.9450, 4.6, 68, 'good', true),
  ('locations/ss-cicurug', 'Suka Shawarma Cicurug', 'cicurug', 'Jl. Siliwangi, Cicurug, Sukabumi', 'Sukabumi', -6.783306, 106.781924, 4.8, 92, 'good', true)
on conflict (slug) do update set
  name = excluded.name,
  address = excluded.address,
  city = excluded.city,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  current_rating = excluded.current_rating,
  total_reviews = excluded.total_reviews,
  status = excluded.status,
  is_active = excluded.is_active;

-- 2. Contoh Ulasan Pelanggan Terkini (Untuk Mengaktifkan Feed, AI Sentimen, & Kategori)
do $$ 
declare
  v_empang uuid;
  v_pajajaran uuid;
  v_cibinong uuid;
  v_cibubur uuid;
  v_rev1 uuid;
  v_rev2 uuid;
  v_rev3 uuid;
  v_rev4 uuid;
begin
  select id into v_empang from public.outlets where slug = 'empang';
  select id into v_pajajaran from public.outlets where slug = 'pajajaran';
  select id into v_cibinong from public.outlets where slug = 'cibinong';
  select id into v_cibubur from public.outlets where slug = 'cibubur';

  -- Ulasan 1: Empang (Rasa & Porsi)
  if v_empang is not null then
    insert into public.reviews (google_review_id, outlet_id, reviewer_name, rating, comment, sentiment, ai_summary, urgency, analysis_status, google_created_at)
    values ('rev-empang-001', v_empang, 'Ahmad Fauzi', 5, 'Shawarma daging sapinya empuk banget, bumbu rempahnya otentik dan saus garlic-nya mantap! Porsi pas bikin kenyang.', 'positive', 'Pujian rasa daging sapi empuk, bumbu rempah otentik, dan saus garlic lezat.', 'low', 'completed', now() - interval '2 hours')
    on conflict (google_review_id) do nothing returning id into v_rev1;

    if v_rev1 is not null then
      insert into public.review_categories (review_id, category) values (v_rev1, 'RASA'), (v_rev1, 'PORSI') on conflict do nothing;
    end if;
  end if;

  -- Ulasan 2: Pajajaran (Pelayanan & Kebersihan)
  if v_pajajaran is not null then
    insert into public.reviews (google_review_id, outlet_id, reviewer_name, rating, comment, sentiment, ai_summary, urgency, analysis_status, google_created_at)
    values ('rev-pajajaran-001', v_pajajaran, 'Siti Nurhaliza', 5, 'Pelayanan ramah dan cepat, tempat bersih dan nyaman buat nongkrong sore. Shawarma ayam favorit keluarga!', 'positive', 'Apresiasi pelayanan cepat dan ramah, kebersihan tempat, serta rasa shawarma ayam.', 'low', 'completed', now() - interval '5 hours')
    on conflict (google_review_id) do nothing returning id into v_rev2;

    if v_rev2 is not null then
      insert into public.review_categories (review_id, category) values (v_rev2, 'PELAYANAN'), (v_rev2, 'KEBERSIHAN') on conflict do nothing;
    end if;
  end if;

  -- Ulasan 3: Cibinong (Rasa & Kecepatan)
  if v_cibinong is not null then
    insert into public.reviews (google_review_id, outlet_id, reviewer_name, rating, comment, sentiment, ai_summary, urgency, analysis_status, google_created_at)
    values ('rev-cibinong-001', v_cibinong, 'Budi Santoso', 4, 'Enak banget rotinya fresh baru dipanggang. Cuma antrian agak panjang kalau pas jam makan malam.', 'positive', 'Roti shawarma fresh, catatan minor antrean ramai saat jam makan malam.', 'medium', 'completed', now() - interval '1 day')
    on conflict (google_review_id) do nothing returning id into v_rev3;

    if v_rev3 is not null then
      insert into public.review_categories (review_id, category) values (v_rev3, 'RASA'), (v_rev3, 'KECEPATAN') on conflict do nothing;
    end if;
  end if;

  -- Ulasan 4: Cibubur (Kualitas & Porsi)
  if v_cibubur is not null then
    insert into public.reviews (google_review_id, outlet_id, reviewer_name, rating, comment, sentiment, ai_summary, urgency, analysis_status, google_created_at)
    values ('rev-cibubur-001', v_cibubur, 'Dewi Lestari', 5, 'Porsi besar, kemasan rapi dan sausnya melimpah. Bakal langganan terus kalau lagi ke Fresh Market!', 'positive', 'Kepuasan tinggi terhadap porsi besar, kemasan rapi, dan saus melimpah.', 'low', 'completed', now() - interval '1 day 4 hours')
    on conflict (google_review_id) do nothing returning id into v_rev4;

    if v_rev4 is not null then
      insert into public.review_categories (review_id, category) values (v_rev4, 'KUALITAS_PRODUK'), (v_rev4, 'PORSI') on conflict do nothing;
    end if;
  end if;

end $$;
