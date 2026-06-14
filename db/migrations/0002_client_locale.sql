-- 0002_client_locale: add country + timezone to clients for local-time + holiday + FX signals.
--
-- `country` is ISO-3166-1 alpha-2 (e.g. US, GB, DE) — used by Nager.Date and the
-- IANA tz lookup. `tz` is an explicit IANA zone (e.g. "America/Los_Angeles")
-- so we don't have to map country→tz when a country spans multiple zones.
-- `default_currency` already exists from 0001 — we reuse it for the FX signal.

ALTER TABLE clients ADD COLUMN country TEXT;
ALTER TABLE clients ADD COLUMN tz TEXT;
