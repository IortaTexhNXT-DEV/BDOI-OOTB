-- Bank reconciliation (Accounts > Bank Reconciliation): bank statements imported per bank account with a configurable
-- statement format, the book side read from the posted GL lines of the bank account's cash-in-bank account, automatic
-- and manual matching, adjustments for unrecorded bank items, and a reconciliation run per bank account and period
-- (draft -> prepared -> approved, maker-checker) with the Bank Reconciliation Statement.
--
--   bank_statement_formats      column mapping of a bank's CSV / XLSX export (Master > Finance > Bank Statement Formats)
--   bank_transaction_types      unrecorded bank items and the journal they post (Master > Finance > Bank Transaction Types)
--   bank_match_rules            automatic matching rules, applied in sort order
--   bank_statements             statement header (BST number): account, bank statement no., period, opening / closing
--   bank_statement_lines        THE bank statement line table (also holds the lines of the remittance reconciliation)
--   bank_rec_matches            a match of bank lines with GL lines (1:1, 1:n, n:1, adjustment, book contra), audited
--   bank_rec_match_items        the lines of a match
--   bank_reconciliations        reconciliation run (BRC number) per bank account and period with the statement snapshot
--   bank_reconciliation_history status changes of a run (who, when, why)
-- The bank account master (master_records type 'bank-account') links a bank account to its GL cash account
-- (data.glAccountCode) and its default statement format (data.statementFormat). Document numbering series
-- (bank_statement BST, bank_reconciliation BRC) and the report catalogue rows are in seeds/63_bank_reconciliation.sql
-- because document_numbering is created by a later migration. Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('bank_reconciliation.date_window_days', '5', 'bank_reconciliation', 'Auto-match: a bank line and a book entry of the same amount match when their dates are at most this many days apart', 'number'),
 ('bank_reconciliation.group_max_lines', '6', 'bank_reconciliation', 'Auto-match: most entries combined into one match (a deposit of several ORs, a bank batch)', 'number'),
 ('bank_reconciliation.stale_cheque_days', '180', 'bank_reconciliation', 'Outstanding cheques older than this many days are stale (flagged; may be cancelled and the payable re-opened)', 'number'),
 ('bank_reconciliation.auto_match_on_import', 'true', 'bank_reconciliation', 'Run the automatic matching right after a statement is imported', 'boolean'),
 ('bank_reconciliation.require_balanced_statement', 'true', 'bank_reconciliation', 'Refuse a statement whose opening balance plus movements does not equal its closing balance', 'boolean'),
 ('bank_reconciliation.check_from_period', '""', 'bank_reconciliation', 'Month-end close check: bank reconciliations are required from this period (YYYY-MM) onwards; empty = every period with activity', 'string'),
 ('remittance.reconciliation_bank_account', '""', 'remittance', 'Remittance > Reconciliation also lists the credit lines of this bank account (bank account master code); empty = only the lines imported there', 'string'),
 ('accounting.account.bank_charges', '"4401004"', 'accounting', 'GL: Bank charges (bank reconciliation adjustments)', 'string'),
 ('accounting.account.interest_income', '"3301001"', 'accounting', 'GL: Interest income on bank deposits (bank reconciliation adjustments)', 'string'),
 ('accounting.account.final_tax_interest', '"4601002"', 'accounting', 'GL: Final tax withheld on bank interest (bank reconciliation adjustments)', 'string')
ON CONFLICT (key) DO NOTHING;

INSERT INTO gl_accounts(code, name, account_type, category, is_open_item, allow_manual, fs_group, normal_balance, description) VALUES
 ('4601002', 'Final Tax on Interest Income', 'expense', 'Income Tax', false, true, 'Income Tax', 'debit', '20% final tax withheld by banks on deposit interest')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('approve:bank-reconciliation', 'bank-reconciliation', 'Approve and reopen bank reconciliations (maker-checker: a different user than the preparer)')
ON CONFLICT (code) DO NOTHING;

-- ---------- masters ----------
CREATE TABLE IF NOT EXISTS bank_statement_formats (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{2,30}$'),
  name text NOT NULL,
  bank_code text,                                      -- bank master code (BDO, BPI, MBT ...); informational
  description text,
  file_type text NOT NULL DEFAULT 'any' CHECK (file_type IN ('any', 'csv', 'xlsx')),
  skip_rows int NOT NULL DEFAULT 0 CHECK (skip_rows BETWEEN 0 AND 100), -- rows before the column header row
  has_header boolean NOT NULL DEFAULT true,
  -- column mapping: { date, valueDate, description, reference, debit, credit, amount, balance, drCr }; each value is a
  -- header text (compared without case / punctuation; "a|b" = alternatives) or a 1-based column number
  columns jsonb NOT NULL DEFAULT '{}',
  date_format text NOT NULL DEFAULT 'YYYY-MM-DD',      -- YYYY-MM-DD | MM/DD/YYYY | DD/MM/YYYY | DD-MMM-YYYY | MMM DD, YYYY | ...
  amount_sign text NOT NULL DEFAULT 'credit-positive' CHECK (amount_sign IN ('credit-positive', 'debit-positive')),
  skip_pattern text,                                   -- regular expression: rows whose text matches are ignored (totals, balance forward)
  is_example boolean NOT NULL DEFAULT false,           -- sample layouts shipped with the system; verify against the bank's export
  active boolean NOT NULL DEFAULT true,
  created_by text, updated_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

INSERT INTO bank_statement_formats(code, name, bank_code, description, file_type, skip_rows, has_header, columns, date_format, amount_sign, skip_pattern, is_example) VALUES
 ('GENERIC', 'Generic (Date, Description, Reference, Debit, Credit, Balance)', NULL, 'Standard layout: one header row with Date, Value Date, Description, Reference / Cheque No., Debit, Credit and Balance columns (or a signed Amount column)', 'any', 0, true,
  '{"date":"date|transaction date|txn date|posting date","valueDate":"value date","description":"description|particulars|narration|details|transaction description","reference":"reference|reference no|ref no|cheque no|check no|check number|cheque number","debit":"debit|withdrawal|withdrawals|debit amount","credit":"credit|deposit|deposits|credit amount","amount":"amount","balance":"balance|running balance|ending balance"}',
  'YYYY-MM-DD', 'credit-positive', '^(total|balance forward|beginning balance|ending balance)', false),
 ('BDO-SAMPLE', 'BDO - account activity export (example)', 'BDO', 'Example layout modelled on a BDO online banking CSV export: Posting Date (MM/DD/YYYY), Description, Check Number, Debit, Credit, Running Balance. Verify against the actual file before use.', 'csv', 0, true,
  '{"date":"posting date","description":"description","reference":"check number|branch/reference","debit":"debit","credit":"credit","balance":"running balance"}',
  'MM/DD/YYYY', 'credit-positive', '^(total|beginning balance)', true),
 ('BPI-SAMPLE', 'BPI - transaction history (example)', 'BPI', 'Example layout modelled on a BPI transaction history download: three title rows, then Date (MMM DD, YYYY), Transaction Description, Reference Number, Debit, Credit, Running Balance. Verify against the actual file before use.', 'any', 3, true,
  '{"date":"date","description":"transaction description|description","reference":"reference number|reference","debit":"debit","credit":"credit","balance":"running balance|balance"}',
  'MMM DD, YYYY', 'credit-positive', '^(total|ending balance)', true),
 ('MBT-SAMPLE', 'Metrobank - statement with signed amount (example)', 'MBT', 'Example layout modelled on a Metrobank statement export with a single signed Amount column (withdrawals negative): Txn Date (DD/MM/YYYY), Value Date, Particulars, Ref No, Amount, Balance. Verify against the actual file before use.', 'any', 0, true,
  '{"date":"txn date","valueDate":"value date","description":"particulars","reference":"ref no","amount":"amount","balance":"balance"}',
  'DD/MM/YYYY', 'credit-positive', NULL, true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS bank_transaction_types (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{2,20}$'),
  name text NOT NULL,
  description text,
  direction text NOT NULL CHECK (direction IN ('debit', 'credit')), -- bank debit = money out of the account, credit = money in
  action text NOT NULL DEFAULT 'journal' CHECK (action IN ('journal', 'returned-cheque')),
  account_role text,                                   -- accounting.account.<role> (e.g. bank_charges, suspense)
  gl_account_code text,                                -- a GL account instead of a role
  allow_account_override boolean NOT NULL DEFAULT false, -- the user may pick the counter account (direct credits)
  requires_approval boolean NOT NULL DEFAULT false,    -- the journal is created for approval (posted by a second user)
  match_pattern text,                                  -- regular expression on the bank description; suggests the type
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT false,
  created_by text, updated_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (action = 'returned-cheque' OR account_role IS NOT NULL OR gl_account_code IS NOT NULL));

INSERT INTO bank_transaction_types(code, name, description, direction, action, account_role, allow_account_override, requires_approval, match_pattern, sort_order, is_system) VALUES
 ('BCHG', 'Bank charges', 'Service charges, cheque book fees, transfer fees debited by the bank', 'debit', 'journal', 'bank_charges', false, false, '(service|svc|bank) ?(charge|chg|fee)|chq ?book|checkbook|transfer fee|instapay fee|pesonet fee', 10, true),
 ('INT', 'Interest income', 'Interest credited on the deposit (gross)', 'credit', 'journal', 'interest_income', false, false, 'interest (credit|earned|income)|int\.? ?cr', 20, true),
 ('FTAX', 'Final tax on interest', 'Final tax withheld by the bank on deposit interest', 'debit', 'journal', 'final_tax_interest', false, false, 'w/?h(olding)? ?tax|final tax|tax withheld', 30, true),
 ('RCHQ', 'Returned cheque', 'Deposited cheque returned unpaid (DAIF / DAUD): the official receipt is cancelled and the receivable re-opened', 'debit', 'returned-cheque', NULL, false, false, 'return(ed)? (check|cheque|chq)|daif|daud|dishono', 40, true),
 ('DCR-INS', 'Direct credit from insurer', 'Unidentified credit from an insurer (claim or commission payment) booked to suspense until identified', 'credit', 'journal', 'suspense', true, true, 'insurance|assurance|insurer', 50, true),
 ('DCR-CLI', 'Direct credit from client', 'Client paid straight into the bank without an official receipt yet: booked to suspense (or a chosen account)', 'credit', 'journal', 'suspense', true, false, 'instapay|pesonet|fund transfer|ibft|online transfer', 60, true),
 ('DDR-OTH', 'Other bank debit', 'Other debits by the bank (auto-debit arrangements, corrections) booked to a chosen account', 'debit', 'journal', 'suspense', true, true, NULL, 90, true)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS bank_match_rules (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text,
  rule_type text NOT NULL CHECK (rule_type IN ('adjustment', 'contra', 'reference', 'amount-date', 'one-to-many', 'many-to-one')),
  sort_order int NOT NULL DEFAULT 100,
  confidence int NOT NULL DEFAULT 80 CHECK (confidence BETWEEN 1 AND 100),
  params jsonb NOT NULL DEFAULT '{}',                  -- { dateWindowDays, maxLines } override the settings
  active boolean NOT NULL DEFAULT true,
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO bank_match_rules(code, name, description, rule_type, sort_order, confidence) VALUES
 ('ADJUSTMENT', 'Adjustment journals', 'A bank line with the adjustment journal created from it (once the journal is posted)', 'adjustment', 5, 100),
 ('CONTRA', 'Reversed entries (book contra)', 'A book entry and its reversal on the same bank account cancel out (cancelled receipt / cheque)', 'contra', 8, 100),
 ('REFERENCE', 'Amount and reference / cheque number', 'Same amount and the bank reference equals the cheque number, OR number or payment reference of the book entry', 'reference', 10, 100),
 ('AMOUNT_DATE', 'Amount and date window', 'Same amount and dates within the window, when exactly one candidate exists on each side', 'amount-date', 20, 80),
 ('ONE_TO_MANY', 'One bank line, several book entries', 'A deposit of several official receipts: the book entries in the window add up to the bank line', 'one-to-many', 30, 65),
 ('MANY_TO_ONE', 'Several bank lines, one book entry', 'A bank batch: the bank lines in the window add up to one book entry', 'many-to-one', 40, 60)
ON CONFLICT (code) DO NOTHING;

-- ---------- statements ----------
CREATE TABLE IF NOT EXISTS bank_statements (
  id text PRIMARY KEY DEFAULT ('bst_' || encode(gen_random_bytes(8), 'hex')),
  statement_number text UNIQUE NOT NULL,               -- BST number
  bank_account_id int NOT NULL,                        -- master_records.id (type bank-account)
  bank_account_code text NOT NULL,
  gl_account_code text,
  statement_ref text,                                  -- the bank's statement number / period label
  period_from date NOT NULL,
  period_to date NOT NULL,
  opening_balance numeric(16,2) NOT NULL DEFAULT 0,
  closing_balance numeric(16,2) NOT NULL DEFAULT 0,
  total_debits numeric(16,2) NOT NULL DEFAULT 0,
  total_credits numeric(16,2) NOT NULL DEFAULT 0,
  line_count int NOT NULL DEFAULT 0,
  format_code text,
  file_name text,
  file_hash text,
  source text NOT NULL DEFAULT 'import' CHECK (source IN ('import', 'manual')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  deleted_by text, deleted_at timestamptz,
  CHECK (period_to >= period_from));
CREATE INDEX IF NOT EXISTS bank_statements_account_idx ON bank_statements(bank_account_id, period_from) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS bank_statements_file_uq ON bank_statements(bank_account_id, file_hash) WHERE status = 'active' AND file_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS bank_statement_lines (
  id text PRIMARY KEY DEFAULT ('bsl_' || encode(gen_random_bytes(8), 'hex')),
  statement_id text REFERENCES bank_statements(id),
  bank_account_id int,                                 -- NULL: remittance-only line imported without a bank account
  line_no int NOT NULL DEFAULT 0,
  txn_number text UNIQUE,                              -- BNK number of lines imported through the remittance screen
  txn_date date NOT NULL,
  value_date date,
  description text NOT NULL DEFAULT '',
  reference text,
  debit numeric(16,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(16,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  amount numeric(16,2) NOT NULL,                       -- credit - debit (money into the account positive)
  running_balance numeric(16,2),
  line_hash text,                                      -- duplicate detection (account + date + amount + reference + description + occurrence)
  source text NOT NULL DEFAULT 'import' CHECK (source IN ('import', 'manual', 'remittance')),
  type_code text,                                      -- bank transaction type suggested from the description / used for the adjustment
  flag text CHECK (flag IN ('bank-error')),            -- reconciling item on the bank side, no journal
  flag_remarks text,
  adjustment_jv_id text,                               -- journal created from the line (postBankAdjustment)
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted')),
  -- remittance reconciliation (Remittance > Reconciliation): match of the line with an approved remittance
  rem_status text NOT NULL DEFAULT 'unmatched' CHECK (rem_status IN ('unmatched', 'matched', 'partial')),
  rem_remittance_id text,
  rem_reference text,
  rem_difference numeric(16,2),
  created_by text, updated_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS bank_statement_lines_account_idx ON bank_statement_lines(bank_account_id, txn_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS bank_statement_lines_statement_idx ON bank_statement_lines(statement_id, line_no);
CREATE UNIQUE INDEX IF NOT EXISTS bank_statement_lines_hash_uq ON bank_statement_lines(bank_account_id, line_hash) WHERE status = 'active' AND line_hash IS NOT NULL;

-- ---------- matching ----------
CREATE TABLE IF NOT EXISTS bank_rec_matches (
  id text PRIMARY KEY DEFAULT ('brm_' || encode(gen_random_bytes(8), 'hex')),
  bank_account_id int NOT NULL,
  match_type text NOT NULL CHECK (match_type IN ('auto', 'manual', 'adjustment', 'contra')),
  rule_code text,
  confidence int,
  bank_total numeric(16,2) NOT NULL DEFAULT 0,          -- sum of the bank lines (credit positive)
  book_total numeric(16,2) NOT NULL DEFAULT 0,          -- sum of the GL lines (debit positive)
  difference numeric(16,2) NOT NULL DEFAULT 0,          -- bank_total - book_total
  difference_treatment text CHECK (difference_treatment IN ('bank-error', 'book-error')),
  cleared_date date NOT NULL,                          -- latest date among the matched lines: cleared from then on
  remarks text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unmatched')),
  locked_by_rec text,                                  -- approved reconciliation that locks the match
  matched_by text, matched_at timestamptz NOT NULL DEFAULT now(),
  unmatched_by text, unmatched_at timestamptz, unmatch_reason text,
  CHECK (difference = 0 OR difference_treatment IS NOT NULL));
CREATE INDEX IF NOT EXISTS bank_rec_matches_account_idx ON bank_rec_matches(bank_account_id, cleared_date) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bank_rec_match_items (
  id bigserial PRIMARY KEY,
  match_id text NOT NULL REFERENCES bank_rec_matches(id),
  side text NOT NULL CHECK (side IN ('bank', 'book')),
  bank_line_id text REFERENCES bank_statement_lines(id),
  journal_line_id bigint REFERENCES journal_lines(id),
  amount numeric(16,2) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  CHECK ((side = 'bank' AND bank_line_id IS NOT NULL AND journal_line_id IS NULL) OR (side = 'book' AND journal_line_id IS NOT NULL AND bank_line_id IS NULL)));
CREATE UNIQUE INDEX IF NOT EXISTS bank_rec_match_items_bank_uq ON bank_rec_match_items(bank_line_id) WHERE active AND bank_line_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bank_rec_match_items_book_uq ON bank_rec_match_items(journal_line_id) WHERE active AND journal_line_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bank_rec_match_items_match_idx ON bank_rec_match_items(match_id);

-- ---------- reconciliation runs ----------
CREATE TABLE IF NOT EXISTS bank_reconciliations (
  id text PRIMARY KEY DEFAULT ('brc_' || encode(gen_random_bytes(8), 'hex')),
  rec_number text UNIQUE NOT NULL,                     -- BRC number
  bank_account_id int NOT NULL,
  bank_account_code text NOT NULL,
  gl_account_code text NOT NULL,
  period text NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  as_of_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'prepared', 'approved', 'cancelled')),
  snapshot jsonb,                                      -- the Bank Reconciliation Statement when prepared / approved
  -- figures of the Bank Reconciliation Statement (refreshed while draft, frozen when prepared / approved)
  bank_balance numeric(16,2), deposits_in_transit numeric(16,2), outstanding_cheques numeric(16,2), bank_errors numeric(16,2),
  adjusted_bank_balance numeric(16,2),
  book_balance numeric(16,2), unbooked_credits numeric(16,2), unbooked_debits numeric(16,2), book_errors numeric(16,2),
  adjusted_book_balance numeric(16,2), difference numeric(16,2),
  unmatched_bank_lines int, unmatched_book_lines int, computed_at timestamptz,
  prepared_by text, prepared_at timestamptz,
  approved_by text, approved_at timestamptz,
  reopened_by text, reopened_at timestamptz, reopen_remarks text,
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS bank_reconciliations_active_uq ON bank_reconciliations(bank_account_id, period) WHERE status <> 'cancelled';

CREATE TABLE IF NOT EXISTS bank_reconciliation_history (
  id bigserial PRIMARY KEY,
  rec_id text NOT NULL REFERENCES bank_reconciliations(id),
  from_status text, to_status text NOT NULL,
  remarks text,
  changed_by text, changed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS bank_reconciliation_history_rec_idx ON bank_reconciliation_history(rec_id, changed_at DESC);

-- ---------- views ----------
-- Bank accounts linked to a GL cash account (bank account master, data.glAccountCode).
CREATE OR REPLACE VIEW bank_account_links AS
SELECT m.id AS bank_account_id, m.code AS bank_account_code, m.name AS bank_account_name, m.data->>'bankCode' AS bank_code,
  m.data->>'bankName' AS bank_name, m.data->>'accountNumber' AS account_number, COALESCE(m.data->>'currency', 'PHP') AS currency,
  NULLIF(btrim(m.data->>'glAccountCode'), '') AS gl_account_code, NULLIF(btrim(m.data->>'statementFormat'), '') AS statement_format, m.status,
  CASE WHEN m.data->>'reconcileFrom' ~ '^\d{4}-\d{2}-\d{2}$' THEN (m.data->>'reconcileFrom')::date END AS reconcile_from
FROM master_records m WHERE m.type_code = 'bank-account' AND m.status <> 'deleted';

-- Book side: posted (and reversed) GL lines on the cash account of a linked bank account, with the source document
-- (official receipt, payment voucher / cheque, journal voucher) and the active match of the line. Entries dated before
-- the account's reconciliation start (data.reconcileFrom, else the first statement's start date) are covered by the
-- first statement's opening balance and left out.
CREATE OR REPLACE VIEW bank_book_lines AS
SELECT l.id AS line_id, b.bank_account_id, b.bank_account_code, l.account_code, j.id AS jv_id, j.jv_number, j.jv_date AS txn_date, j.status AS jv_status,
  j.source, j.reference_type, j.reference_id, j.transaction_code, j.reversal_of, j.reversed_by_jv,
  COALESCE(NULLIF(l.memo, ''), j.description) AS description, l.debit, l.credit, (l.debit - l.credit) AS amount,
  CASE WHEN j.reversal_of IS NOT NULL THEN 'Reversal' WHEN r.id IS NOT NULL THEN 'Official Receipt' WHEN ck.id IS NOT NULL THEN 'Cheque'
    WHEN d.id IS NOT NULL THEN 'Payment Voucher' WHEN j.source = 'bank-reconciliation' THEN 'Bank Adjustment' WHEN j.source = 'petty-cash' THEN 'Petty Cash'
    WHEN j.source IN ('manual', 'correction') THEN 'Journal Voucher' ELSE initcap(replace(j.source, '-', ' ')) END AS doc_type,
  COALESCE(r.receipt_number, d.voucher_number, j.transaction_code, j.jv_number) AS doc_number,
  ck.instrument_no AS cheque_no, ck.id AS checkbook_id, ck.status AS cheque_status, r.id AS receipt_id,
  COALESCE(r.customer_name, d.payee_name, ck.customer_name) AS party,
  COALESCE(r.reference_no, ck.instrument_no) AS payment_reference,
  mi.match_id, mm.cleared_date, mm.match_type, mm.locked_by_rec
FROM journal_lines l
JOIN journal_vouchers j ON j.id = l.jv_id AND j.status IN ('posted', 'reversed')
JOIN bank_account_links b ON b.gl_account_code = l.account_code
LEFT JOIN receipts r ON j.reference_type = 'Receipt' AND r.id = j.reference_id
LEFT JOIN disbursements d ON j.reference_type = 'Disbursement' AND d.id = j.reference_id
LEFT JOIN LATERAL (SELECT c.* FROM checkbooks c WHERE c.journal_id = COALESCE(j.reversal_of, j.id) ORDER BY c.created_at LIMIT 1) ck ON true
LEFT JOIN bank_rec_match_items mi ON mi.journal_line_id = l.id AND mi.active
LEFT JOIN bank_rec_matches mm ON mm.id = mi.match_id
WHERE j.jv_date >= COALESCE(b.reconcile_from,
  (SELECT min(s.period_from) FROM bank_statements s WHERE s.bank_account_id = b.bank_account_id AND s.status = 'active'), j.jv_date);

-- ---------- scheduled job (disabled until finance switches it on under Master > Configuration > Schedules) ----------
INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('bank-auto-match', 'Bank reconciliation auto-match', 'Run the automatic matching rules on every bank account with unmatched statement lines', '45 5 * * *', 'bankAutoMatch', '{}', false)
ON CONFLICT (code) DO NOTHING;
