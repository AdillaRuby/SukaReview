-- 014_telegram_alert_settings.sql
-- Menambahkan kolom konfigurasi alert Telegram pada tabel alert_settings

alter table public.alert_settings
  add column if not exists notify_telegram_enabled boolean not null default false,
  add column if not exists notify_telegram_chat_ids text;
