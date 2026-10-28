-- Energia inquiries. Reverse with 001_inquiries.down.sql (scripts/migrate.mjs down).
-- Inquiries have no expiry: a row is removed only when the owner erases it.
CREATE TABLE inquiries (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference text NOT NULL UNIQUE CHECK (reference ~ '^EA-[0-9A-HJKMNP-TV-Z]{8}$'),
  idempotency_key text NOT NULL UNIQUE CHECK (idempotency_key ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'),
  payload_hash text NOT NULL CHECK (payload_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted')),
  contacted_at timestamptz CHECK ((status = 'contacted') = (contacted_at IS NOT NULL)),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email text NOT NULL CHECK (char_length(email) BETWEEN 3 AND 160),
  company text NOT NULL CHECK (char_length(company) BETWEEN 1 AND 120),
  building_type text NOT NULL CHECK (char_length(building_type) BETWEEN 1 AND 40),
  floor_area text NOT NULL CHECK (char_length(floor_area) BETWEEN 1 AND 40),
  role text CHECK (char_length(role) <= 40),
  building_count text CHECK (char_length(building_count) <= 20),
  bms text CHECK (char_length(bms) <= 20),
  bms_name text CHECK (char_length(bms_name) <= 80),
  energy_spend text CHECK (char_length(energy_spend) <= 40),
  improve text CHECK (char_length(improve) <= 1000),
  phone text CHECK (char_length(phone) <= 40),
  source_url text CHECK (char_length(source_url) <= 300),
  utm_source text CHECK (char_length(utm_source) <= 100),
  utm_medium text CHECK (char_length(utm_medium) <= 100),
  utm_campaign text CHECK (char_length(utm_campaign) <= 100),
  utm_term text CHECK (char_length(utm_term) <= 100),
  utm_content text CHECK (char_length(utm_content) <= 100)
);
CREATE INDEX inquiries_newest ON inquiries (created_at DESC, id DESC);

-- What happened to each reference, without any answers.
CREATE TABLE inquiry_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  reference text NOT NULL CHECK (reference ~ '^EA-[0-9A-HJKMNP-TV-Z]{8}$'),
  action text NOT NULL CHECK (action IN ('received', 'contacted', 'reopened', 'erased')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inquiry_events_reference ON inquiry_events (reference, id);

-- Short lived security rows; the daily cleanup removes expired ones.
CREATE TABLE rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX rate_limits_expiry ON rate_limits (expires_at);
CREATE TABLE used_proofs (
  hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL
);
CREATE INDEX used_proofs_expiry ON used_proofs (expires_at);
CREATE TABLE admin_sessions (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  csrf text NOT NULL,
  credential_version text NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX admin_sessions_expiry ON admin_sessions (expires_at);
