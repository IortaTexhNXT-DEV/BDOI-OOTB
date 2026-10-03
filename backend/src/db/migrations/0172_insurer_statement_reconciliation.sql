-- Insurer statement reconciliation: an insurer's statement of account (premium remittance confirmation, or commission
-- statement) imported from CSV / XLSX with a column mapping per insurer, matched line by line to the broker's records
-- (remittance lines, commission debit note lines, policies), differences resolved with a note or an adjustment journal
-- (posting rule insurer_statement.adjustment, posted on approval) and approved by a second user holding
-- approve:insurer-reconciliation (Accounting Manager).
--   insurer_statement_formats      column mapping of an insurer's statement export (Master > Finance > Insurer Statement Formats)
--   insurer_statements             statement header (ISR number): insurer, type, period, file, status, sign-off
--   insurer_statement_lines        the insurer's lines with their match to a broker record and the differences
--   insurer_statement_resolutions  how a difference or a broker record missing on the statement was settled
CREATE TABLE IF NOT EXISTS insurer_statement_formats (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{2,30}$'),
  name text NOT NULL,
  insurance_company_id int REFERENCES insurance_companies(id),   -- the insurer whose layout this is (null = any insurer)
  description text,
  file_type text NOT NULL DEFAULT 'any' CHECK (file_type IN ('any', 'csv', 'xlsx')),
  skip_rows int NOT NULL DEFAULT 0 CHECK (skip_rows BETWEEN 0 AND 100),
  has_header boolean NOT NULL DEFAULT true,
  -- { policyNo, insured, date, reference, grossPremium, commission, taxes, amountPaid }: header text ("a|b" = alternatives,
  -- compared without case / punctuation) or a 1-based column number
  columns jsonb NOT NULL DEFAULT '{}',
  date_format text NOT NULL DEFAULT 'YYYY-MM-DD',
  skip_pattern text,                                   -- regular expression: rows whose text matches are ignored (totals)
  active boolean NOT NULL DEFAULT true,
  created_by text, updated_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

INSERT INTO insurer_statement_formats(code, name, description, file_type, columns, date_format, skip_pattern) VALUES
 ('GENERIC', 'Generic statement of account', 'One header row: Policy No, Insured, Date, Reference, Gross Premium, Commission, Taxes, Amount Paid / Remitted', 'any',
  '{"policyNo":"policy no|policy number|policy|pol no","insured":"insured|insured name|assured|client","date":"date|transaction date|payment date|remittance date","reference":"reference|ref no|or no|official receipt|document no","grossPremium":"gross premium|premium|gross","commission":"commission|commission amount|brokerage","taxes":"taxes|tax|premium taxes|vat","amountPaid":"amount paid|amount remitted|paid|remitted|net amount|amount"}',
  'YYYY-MM-DD', '^(total|grand total|sub total|subtotal)')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS insurer_statements (
  id text PRIMARY KEY DEFAULT ('isr_' || encode(gen_random_bytes(8), 'hex')),
  statement_number text UNIQUE NOT NULL,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  statement_type text NOT NULL CHECK (statement_type IN ('premium', 'commission')), -- premium remittance confirmation | commission statement
  statement_ref text,                                  -- the insurer's own statement number
  period_from date NOT NULL, period_to date NOT NULL,
  format_code text,
  file_name text, file_hash text,
  tolerance numeric(14,2) NOT NULL DEFAULT 1,
  line_count int NOT NULL DEFAULT 0,
  total_gross numeric(16,2) NOT NULL DEFAULT 0, total_commission numeric(16,2) NOT NULL DEFAULT 0,
  total_taxes numeric(16,2) NOT NULL DEFAULT 0, total_paid numeric(16,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'cancelled')),
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text, submitted_at timestamptz,
  approved_by text, approved_at timestamptz, approval_remarks text,
  rejected_by text, rejected_at timestamptz, rejection_reason text,
  CHECK (period_to >= period_from));
CREATE INDEX IF NOT EXISTS insurer_statements_insurer ON insurer_statements(insurance_company_id, period_to DESC);
CREATE UNIQUE INDEX IF NOT EXISTS insurer_statements_file_uq ON insurer_statements(insurance_company_id, file_hash) WHERE file_hash IS NOT NULL AND status <> 'cancelled';

CREATE TABLE IF NOT EXISTS insurer_statement_lines (
  id bigserial PRIMARY KEY,
  statement_id text NOT NULL REFERENCES insurer_statements(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  row_no int,
  policy_number text,
  insured_name text,
  txn_date date,
  reference text,
  gross_premium numeric(14,2) NOT NULL DEFAULT 0,
  commission numeric(14,2) NOT NULL DEFAULT 0,
  taxes numeric(14,2) NOT NULL DEFAULT 0,
  amount_paid numeric(14,2) NOT NULL DEFAULT 0,
  -- unmatched (not found at the broker) | matched (within tolerance) | difference (matched, amounts differ)
  match_status text NOT NULL DEFAULT 'unmatched' CHECK (match_status IN ('unmatched', 'matched', 'difference')),
  match_source text CHECK (match_source IN ('auto', 'manual')),
  broker_type text CHECK (broker_type IN ('remittance_line', 'debit_note_line', 'policy')),
  broker_id text,
  policy_id text REFERENCES policies(id),
  broker_gross numeric(14,2), broker_commission numeric(14,2), broker_taxes numeric(14,2), broker_amount numeric(14,2),
  matched_by text, matched_at timestamptz,
  UNIQUE (statement_id, line_no));
CREATE INDEX IF NOT EXISTS insurer_statement_lines_policy ON insurer_statement_lines(policy_number);

CREATE TABLE IF NOT EXISTS insurer_statement_resolutions (
  id bigserial PRIMARY KEY,
  statement_id text NOT NULL REFERENCES insurer_statements(id) ON DELETE CASCADE,
  line_id bigint REFERENCES insurer_statement_lines(id) ON DELETE CASCADE,   -- an insurer line (unmatched or difference)
  broker_type text, broker_id text,                                           -- or a broker record missing on the statement
  policy_number text,
  kind text NOT NULL CHECK (kind IN ('note', 'adjustment')),
  note text NOT NULL,
  premium_adjustment numeric(14,2) NOT NULL DEFAULT 0,     -- + : more premium due to the insurer
  commission_adjustment numeric(14,2) NOT NULL DEFAULT 0,  -- + : less commission for the broker
  commission_side text CHECK (commission_side IN ('commission_receivable', 'due_to_insurer')),
  journal_id text REFERENCES journal_vouchers(id),          -- posted when the reconciliation is approved
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (line_id IS NOT NULL OR broker_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS insurer_statement_resolutions_line_uq ON insurer_statement_resolutions(line_id) WHERE line_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS insurer_statement_resolutions_broker_uq ON insurer_statement_resolutions(statement_id, broker_type, broker_id) WHERE broker_id IS NOT NULL;

INSERT INTO permissions(code, module, description) VALUES
 ('approve:insurer-reconciliation', 'remittance', 'Approve insurer statement reconciliations and post their adjustment journals (maker-checker: not the preparer)')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code IN ('accounting-manager', 'system-admin') AND p.code = 'approve:insurer-reconciliation'
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('insurer_reconciliation.amount_tolerance', '1', 'insurer_reconciliation', 'Insurer statement reconciliation: largest difference (PHP) on premium, commission or amount paid still treated as a match', 'number'),
 ('insurer_reconciliation.require_resolved', 'true', 'insurer_reconciliation', 'Insurer statement reconciliation: every difference, insurer line not found and broker record missing on the statement must be resolved before submitting for approval', 'boolean')
ON CONFLICT (key) DO NOTHING;

INSERT INTO document_numbering(code, name, module, prefix, description, created_by)
VALUES ('insurer_statement', 'Insurer Statement Reconciliation', 'accounting', 'ISR', 'Insurer statement of account imported for reconciliation', 'migration:0172')
ON CONFLICT (code) DO NOTHING;

-- Posting rule of the adjustment journal (Master > Finance > Posting Rules)
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('insurer_statement.adjustment', 1, 'Insurer statement adjustment',
    'Difference with an insurer statement of account settled by adjustment: a premium difference against the amount due to the insurer, a commission difference against commission income (offset on the commission receivable for direct bill, the premium due to the insurer for broker billed). A negative amount reverses the sides.',
    'remittance', 'REMITTANCE', 'remittance', 'Insurer statement {{statementNumber}} adjustment ({{insurer}})', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, false, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'remittance_adjustment', NULL::text, 'premium', 'Premium difference {{policyNumber}}: {{note}}'),
  (2, 'Cr', 'resolver', 'payable_by_payee', NULL::text, 'premium', 'Due to {{insurer}} per statement {{statementRef}}'),
  (3, 'Dr', 'role', 'commission_income', NULL::text, 'commission', 'Commission difference {{policyNumber}}: {{note}}'),
  (4, 'Cr', 'context', 'commission_offset', 'due_to_insurer', 'commission', 'Commission per {{insurer}} statement {{statementRef}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, narration);
