-- Ad hoc reporting (Reports > Report Builder) and the BI extract.
--
-- report_builder_reports: reports a user designs over the curated datasets (policies, clients, bills, claims,
-- commissions; src/modules/report-builder/datasets.js): the columns, the filters, the grouping with its totals and
-- the sort. A report is private to its owner unless shared with roles (shared_roles); the administrator sees all.
-- Running a report needs read:reports and the read permission of its dataset (read:policies, read:clients ...), and
-- the rows of a scoped user are limited to their own book as on the screens.
--
-- bi_extract_runs: the scheduled BI extract (job bi-extract): one CSV file per dataset (bi.extract_datasets) written to
-- the storage folder bi-extract/<date>/ for a data warehouse or BI tool to pick up, with the run's files and row counts.

CREATE TABLE IF NOT EXISTS report_builder_reports (
  id text PRIMARY KEY DEFAULT ('rbr_' || encode(gen_random_bytes(8), 'hex')),
  name text NOT NULL,
  description text,
  dataset text NOT NULL,
  columns jsonb NOT NULL DEFAULT '[]',               -- column keys in display order
  filters jsonb NOT NULL DEFAULT '[]',               -- [{ column, op, value }]
  group_by jsonb NOT NULL DEFAULT '[]',              -- column keys; numeric columns are totalled per group
  sort jsonb NOT NULL DEFAULT '[]',                  -- [{ column, dir }]
  shared_roles text[] NOT NULL DEFAULT '{}',
  owner_user_id text REFERENCES users(id),
  last_run_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS report_builder_reports_owner_user_id_fk_idx ON report_builder_reports(owner_user_id);

CREATE TABLE IF NOT EXISTS bi_extract_runs (
  id bigserial PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'failed')),
  trigger text NOT NULL DEFAULT 'schedule' CHECK (trigger IN ('schedule', 'manual')),
  folder text,
  files jsonb NOT NULL DEFAULT '[]',                 -- [{ dataset, key, fileName, rows, bytes }]
  rows_total int NOT NULL DEFAULT 0,
  error text,
  created_by text
);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('report_builder.max_rows', '50000', 'reports', 'Maximum rows of a Report Builder run or Excel export', 'number'),
 ('report_builder.preview_rows', '200', 'reports', 'Rows shown on screen when a Report Builder report is previewed', 'number'),
 ('bi.extract_datasets', '["policies","clients","bills","claims","commissions"]', 'reports', 'Datasets written by the BI extract (one CSV file each)', 'json'),
 ('bi.extract_folder', '"bi-extract"', 'reports', 'Storage folder of the BI extract files (a sub-folder per run date)', 'string'),
 ('bi.extract_keep_runs', '30', 'reports', 'BI extract runs kept in the run history (the files stay in the storage folder)', 'number')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('bi-extract', 'BI extract', 'Write one CSV file per dataset (bi.extract_datasets) to the storage folder bi.extract_folder for the data warehouse or BI tool', '0 2 * * *', 'biExtract', '{}', false)
ON CONFLICT (code) DO NOTHING;
