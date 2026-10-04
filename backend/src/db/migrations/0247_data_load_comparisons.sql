-- Environment comparison of the Go-Live Data Workbench (Master > Go-Live Data Load > Compare environments): proves
-- that configuration and masters are mirrored between environments (Dev -> SIT -> UAT -> Pre-Prod -> Production).
--
-- data_load_comparisons: one comparison of the configuration workbook. mode environment: an uploaded export
-- ("Current data" of another environment) compared with this environment; mode files: two uploaded exports compared
-- with each other (file A vs file B, this environment not read). Comparing never writes business data: only this
-- result is kept. sheets: counts per sheet; rows: the compared rows (status identical, different, only-in-file,
-- only-here, with the field-level differences); environment_specific: values that legitimately differ between
-- environments (cutover date, URLs and hosts, e-mail sender, payment gateway modes, numbering counters ...), listed
-- apart and never a difference. verdict: mirrored or differences.

CREATE TABLE IF NOT EXISTS data_load_comparisons (
  id bigserial PRIMARY KEY,
  kit text NOT NULL DEFAULT 'configuration' CHECK (kit IN ('configuration')),
  mode text NOT NULL CHECK (mode IN ('environment', 'files')),
  file_name text,
  file_b_name text,
  environment text,                                  -- APP_ENVIRONMENT of this environment (mode environment)
  options jsonb NOT NULL DEFAULT '{}',               -- { includeNumbering }
  verdict text NOT NULL CHECK (verdict IN ('mirrored', 'differences')),
  totals jsonb NOT NULL DEFAULT '{}',
  sheets jsonb NOT NULL DEFAULT '[]',
  rows jsonb NOT NULL DEFAULT '[]',
  environment_specific jsonb NOT NULL DEFAULT '[]',
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS data_load_comparisons_created_idx ON data_load_comparisons(created_at DESC);
CREATE INDEX IF NOT EXISTS data_load_comparisons_created_by_idx ON data_load_comparisons(created_by);

UPDATE permissions SET description = 'Download the go-live workbooks (blank or with the current data), read the load history and compare environments'
 WHERE code = 'read:data-load';
