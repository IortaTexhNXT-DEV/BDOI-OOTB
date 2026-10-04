-- Renewals: pipeline, re-rated quotes, ordered notices, maker-checker approval, batches and a PostgreSQL job queue.
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS renewal_number text;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS client_id text REFERENCES clients(id);
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS owner_user_id text;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS coverage_details jsonb NOT NULL DEFAULT '{}';
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS accessories jsonb;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS order_summary jsonb;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS policy_limits jsonb;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS premium_breakdown jsonb;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS effective_date date;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS notice_stage int NOT NULL DEFAULT 0;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS last_notice_at timestamptz;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS contact_attempts int NOT NULL DEFAULT 0;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS last_contact_at timestamptz;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS lapse_reason text;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS lapsed_at timestamptz;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS renewed_at timestamptz;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS submitted_by text;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS approval_note text;
ALTER TABLE renewals ADD COLUMN IF NOT EXISTS created_by text;
CREATE UNIQUE INDEX IF NOT EXISTS renewals_number_uq ON renewals(renewal_number);
CREATE UNIQUE INDEX IF NOT EXISTS renewals_open_policy_uq ON renewals(policy_id) WHERE status NOT IN ('renewed', 'lapsed');
CREATE INDEX IF NOT EXISTS renewals_status_idx ON renewals(status, due_date);

CREATE TABLE IF NOT EXISTS renewal_quotes (
  id text PRIMARY KEY DEFAULT ('rq_' || encode(gen_random_bytes(8), 'hex')),
  quote_number text UNIQUE,
  renewal_id text NOT NULL REFERENCES renewals(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'generated',          -- generated | superseded | accepted
  valid_until date,
  previous_premium numeric(14,2) NOT NULL DEFAULT 0,
  base_premium numeric(14,2) NOT NULL DEFAULT 0,
  claims_loading numeric(14,2) NOT NULL DEFAULT 0,
  loyalty_discount numeric(14,2) NOT NULL DEFAULT 0,
  net_premium numeric(14,2) NOT NULL DEFAULT 0,
  taxes jsonb NOT NULL DEFAULT '{}',
  total_premium numeric(14,2) NOT NULL DEFAULT 0,
  variance numeric(14,2) NOT NULL DEFAULT 0,
  variance_pct numeric(8,2) NOT NULL DEFAULT 0,
  rating jsonb NOT NULL DEFAULT '{}',                -- rates and factors used (audit of the re-rating)
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS renewal_quotes_renewal_idx ON renewal_quotes(renewal_id, created_at);

CREATE TABLE IF NOT EXISTS renewal_notices (
  id bigserial PRIMARY KEY,
  renewal_id text NOT NULL REFERENCES renewals(id) ON DELETE CASCADE,
  stage int NOT NULL,                                -- 1 first, 2 second, 3 final
  notice_type text NOT NULL,
  method text NOT NULL DEFAULT 'Email',
  recipient text, email_id bigint, batch_id text,
  status text NOT NULL DEFAULT 'sent',               -- sent | failed
  error text, sent_by text, sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (renewal_id, stage));

-- Contact log / negotiation timeline
CREATE TABLE IF NOT EXISTS renewal_activities (
  id bigserial PRIMARY KEY,
  renewal_id text NOT NULL REFERENCES renewals(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(), by_user text,
  activity_type text NOT NULL, method text, description text, outcome text,
  next_action text, follow_up_date date, details jsonb NOT NULL DEFAULT '{}');
CREATE INDEX IF NOT EXISTS renewal_activities_renewal_idx ON renewal_activities(renewal_id, at);

CREATE TABLE IF NOT EXISTS renewal_batches (
  id text PRIMARY KEY DEFAULT ('rb_' || encode(gen_random_bytes(8), 'hex')),
  batch_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'Draft',              -- Draft | Processing | Completed | Cancelled
  criteria jsonb NOT NULL DEFAULT '{}',
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(), completed_at timestamptz);
CREATE TABLE IF NOT EXISTS renewal_batch_policies (
  id bigserial PRIMARY KEY,
  batch_id text NOT NULL REFERENCES renewal_batches(id) ON DELETE CASCADE,
  policy_id text NOT NULL REFERENCES policies(id),
  renewal_id text REFERENCES renewals(id),
  is_selected boolean NOT NULL DEFAULT false,
  notice_status text NOT NULL DEFAULT 'NotSent',     -- NotSent | Queued | Sent | Failed
  notice_sent_at timestamptz, error text, attempts int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, policy_id));

-- Generic PostgreSQL-backed job queue (no Redis); processed in-process with FOR UPDATE SKIP LOCKED.
CREATE TABLE IF NOT EXISTS job_queue (
  id bigserial PRIMARY KEY,
  queue text NOT NULL, job_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'waiting',            -- waiting | processing | completed | failed
  progress jsonb NOT NULL DEFAULT '{}', result jsonb, error text,
  attempts int NOT NULL DEFAULT 0,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz, finished_at timestamptz);
CREATE INDEX IF NOT EXISTS job_queue_status_idx ON job_queue(queue, status, id);

CREATE TABLE IF NOT EXISTS winback_campaigns (
  id text PRIMARY KEY DEFAULT ('wb_' || encode(gen_random_bytes(8), 'hex')),
  campaign_number text UNIQUE NOT NULL,
  name text NOT NULL, target_segment text,
  start_date date NOT NULL, end_date date NOT NULL,
  discount_pct numeric(6,2) NOT NULL DEFAULT 0, budget numeric(14,2) NOT NULL DEFAULT 0,
  offers jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'active',   -- active | completed | cancelled
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
