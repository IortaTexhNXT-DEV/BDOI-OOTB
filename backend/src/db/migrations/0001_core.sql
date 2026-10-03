-- Core: users, roles, permissions, sessions, configuration, audit, notifications, email outbox, jobs, documents, numbering
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE roles (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,            -- it-admin, ba, sales, underwriting, customer-services, claims, finance, agent
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE permissions (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,            -- read:leads, write:leads ...
  module text NOT NULL,
  description text
);
CREATE TABLE role_permissions (
  role_id int NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id int NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE users (
  id text PRIMARY KEY DEFAULT ('usr_' || encode(gen_random_bytes(8), 'hex')),
  username text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  first_name text, last_name text,
  email text, phone text,
  employee_code text, branch_code text, department text, designation text, reporting_to text,
  status text NOT NULL DEFAULT 'active',  -- active | inactive | locked
  must_change_password boolean NOT NULL DEFAULT false,
  failed_logins int NOT NULL DEFAULT 0,
  last_login_at timestamptz,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE user_roles (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id int NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
CREATE TABLE refresh_tokens (
  jti text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id text,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE password_resets (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Configuration-driven behaviour: business parameters editable from the front end (System Settings)
CREATE TABLE app_settings (
  key text PRIMARY KEY,                  -- e.g. tax.vat_rate, currency.default, numbering.policy.prefix
  value jsonb NOT NULL,
  "group" text NOT NULL,                 -- general | branding | tax | currency | numbering | notification | schedule | limits
  label text NOT NULL,
  type text NOT NULL DEFAULT 'string',   -- string | number | boolean | json | color | image
  editable boolean NOT NULL DEFAULT true,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  user_id text, username text,
  entity text NOT NULL, entity_id text, action text NOT NULL,
  before_data jsonb, after_data jsonb, ip text
);
CREATE INDEX audit_log_entity_idx ON audit_log(entity, entity_id);

CREATE TABLE notifications (
  id text PRIMARY KEY DEFAULT ('ntf_' || encode(gen_random_bytes(8), 'hex')),
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'info',     -- info | task | approval | reminder | alert
  priority text NOT NULL DEFAULT 'normal', -- low | normal | high | urgent
  title text NOT NULL,
  message text NOT NULL,
  link text,
  entity text, entity_id text,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, is_read, created_at DESC);

CREATE TABLE email_outbox (
  id bigserial PRIMARY KEY,
  to_address text NOT NULL, cc text, subject text NOT NULL, body_html text NOT NULL,
  template text, entity text, entity_id text,
  status text NOT NULL DEFAULT 'queued', -- queued | sent | failed
  error text, attempts int NOT NULL DEFAULT 0,
  sent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);

-- Schedules: jobs configured in the database, run by the in-process scheduler
CREATE TABLE scheduled_jobs (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE,             -- renewal-notices, policy-expiry, receivable-ageing, report-daily ...
  name text NOT NULL,
  description text,
  cron text NOT NULL,
  handler text NOT NULL,                 -- name of the job function in src/jobs
  params jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz, last_status text, next_run_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE job_runs (
  id bigserial PRIMARY KEY,
  job_id int NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running', -- running | success | failed
  output jsonb, error text, triggered_by text NOT NULL DEFAULT 'schedule'
);

-- Uploaded files (presigned-URL style flow: get-url -> PUT -> reference by key)
CREATE TABLE documents (
  id text PRIMARY KEY DEFAULT ('doc_' || encode(gen_random_bytes(8), 'hex')),
  storage_key text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text,
  size_bytes bigint,
  category text,                         -- vehicle | id | document | endorsement | claims | settlement | template | logo
  entity text, entity_id text,
  uploaded_by text,
  status text NOT NULL DEFAULT 'pending', -- pending | uploaded
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Document numbering (POL-2026-00001 etc.), prefixes configurable in app_settings
CREATE TABLE sequences (
  name text NOT NULL, period text NOT NULL, value bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (name, period)
);
CREATE OR REPLACE FUNCTION next_number(p_name text, p_prefix text, p_width int DEFAULT 5)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE v bigint; yr text := to_char(now(), 'YYYY');
BEGIN
  INSERT INTO sequences(name, period, value) VALUES (p_name, yr, 1)
    ON CONFLICT (name, period) DO UPDATE SET value = sequences.value + 1
    RETURNING value INTO v;
  RETURN p_prefix || '-' || yr || '-' || lpad(v::text, p_width, '0');
END $$;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER roles_updated BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
