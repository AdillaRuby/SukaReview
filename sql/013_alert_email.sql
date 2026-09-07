-- Adds email delivery for the LOW_RATING_REVIEW alert rule (lib/alerts/engine.ts
-- rule 1) on top of the existing in-app alert. Reuses alert_settings as the
-- single-row config table (sql/011_alert_settings.sql) rather than a new
-- table, since there's exactly one recipient for now and it's edited from
-- the same Settings > System card.

alter table public.alert_settings
  add column if not exists notify_email_enabled boolean not null default false,
  add column if not exists notify_email text;
