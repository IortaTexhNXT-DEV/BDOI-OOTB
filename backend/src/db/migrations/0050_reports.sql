-- Reports: catalogue of report definitions, report schedules and generated-report metadata
CREATE TABLE IF NOT EXISTS report_definitions (
  code text PRIMARY KEY,                          -- production-register, claims-position ...
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('operational', 'financial')),
  description text,
  screen text,                                    -- front-end menu path(s) that run it
  parameters jsonb NOT NULL DEFAULT '{}',         -- JSON schema of the filter form
  query_name text NOT NULL,                       -- key of the SQL query in src/modules/reports/queries.js
  default_columns jsonb NOT NULL DEFAULT '[]',    -- [{key, label, type, total?}]
  roles text[] NOT NULL DEFAULT '{}',             -- roles allowed (admin roles always allowed)
  permission text NOT NULL DEFAULT 'read:reports',
  sort_order int NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active',          -- active | inactive
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS report_schedules (
  id text PRIMARY KEY DEFAULT ('rsch_' || encode(gen_random_bytes(8), 'hex')),
  name text NOT NULL,
  report_code text NOT NULL REFERENCES report_definitions(code),
  cron text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}',
  format text NOT NULL DEFAULT 'xlsx' CHECK (format IN ('csv', 'xlsx', 'pdf')),
  recipients text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  job_id int REFERENCES scheduled_jobs(id) ON DELETE SET NULL,
  last_run_at timestamptz, last_status text, last_report_id text,
  status text NOT NULL DEFAULT 'active',          -- active | deleted
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS content_type text;
ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS size_bytes bigint;
ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS totals jsonb;
ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS triggered_by text;
ALTER TABLE generated_reports ADD COLUMN IF NOT EXISTS schedule_id text;
CREATE INDEX IF NOT EXISTS generated_reports_created_idx ON generated_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS generated_reports_code_idx ON generated_reports(code);

-- Ageing bucket label for an age in days against ascending bucket limits: '0-30', '31-60', ..., '>120'; negative = 'current'
CREATE OR REPLACE FUNCTION rpt_age_bucket(p_age int, p_buckets int[]) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE lo int := 0; b int;
BEGIN
  IF p_age IS NULL THEN RETURN NULL; END IF;
  IF p_age < 0 THEN RETURN 'current'; END IF;
  FOR b IN SELECT x FROM unnest(p_buckets) x ORDER BY x LOOP
    IF p_age <= b THEN RETURN lo || '-' || b; END IF;
    lo := b + 1;
  END LOOP;
  RETURN '>' || (lo - 1);
END $$;
