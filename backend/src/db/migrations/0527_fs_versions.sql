-- Financial statement versions (FGA-DS-07, FGA-RPT-02; TIS-BRD-RPT-FGA-01 to 03).
--
-- A version (TIS01 local FS, TIS02 balance sheet / income statement, TIS03 budget) lists the lines of a statement in
-- order, each with the range of GL accounts it carries (GL from / GL to, compared as account-code prefixes: 110 to 112
-- takes 110030 and 1104001). An account belongs to the first line, by line number, whose range takes it; accounts no
-- line takes show as "Accounts not in this version". scope income: the version has income statement lines only
-- (budget). The Financial Statement by Version and Daily GL Balance reports group by the lines of the version chosen,
-- accounting.default_fs_version when none is. Finance maintains the versions (write:journal-vouchers). Idempotent.

CREATE TABLE IF NOT EXISTS fs_versions (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9-]{2,20}$'),
  name text NOT NULL,
  purpose text,
  scope text NOT NULL DEFAULT 'full' CHECK (scope IN ('full', 'income')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS fs_version_lines (
  id bigserial PRIMARY KEY,
  version_code text NOT NULL REFERENCES fs_versions(code) ON DELETE CASCADE,
  line_no int NOT NULL CHECK (line_no > 0),
  statement text NOT NULL CHECK (statement IN ('bs', 'is')),
  section text NOT NULL,
  caption text NOT NULL,
  gl_from text NOT NULL,
  gl_to text NOT NULL,
  normal_balance text NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  UNIQUE (version_code, line_no));

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.default_fs_version', '"TIS01"', 'accounting', 'Financial statement version used by the reports when none is chosen', 'string')
ON CONFLICT (key) DO NOTHING;
