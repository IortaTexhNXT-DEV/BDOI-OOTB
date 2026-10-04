-- Bank payment files (Accounts > Bank Payment Files; layouts under Master > Finance > Bank File Layouts).
--
--   bank_file_layouts         how a bank's bulk credit / InstaPay / PESONet upload file is written (fixed width or
--                             delimited; header, detail and trailer records, each a list of fields with source, width,
--                             alignment, padding and format) and how its payment status (return) file is read
--   payee_bank_accounts       bank account of a payee (insurer, referrer, client, supplier) credited by the file
--   bank_payment_batches      a batch of payment vouchers paid through one bank account and layout: draft ->
--                             for-approval -> approved (maker-checker, Authority Matrix payment_voucher) -> file
--                             generated -> sent -> completed; cancelled
--   bank_payment_batch_lines  one line per voucher: payee account, amount, status pending / paid / rejected from the
--                             bank's status file or entered by hand; a paid line posts the payment journal of its voucher
--                             (Dr payable / Cr cash in bank of the batch's bank account) and marks the voucher paid
--
-- Starter layouts (seeds/75_integrations.sql) for BDO, BPI, Metrobank, Landbank and UnionBank are examples: each must be
-- validated against the bank's current file specification during onboarding. Idempotent.

CREATE TABLE IF NOT EXISTS bank_file_layouts (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z0-9_-]{2,30}$'),
  name text NOT NULL,
  bank_code text,                                        -- bank master code (BDO, BPI, MBT, LBP, UBP ...)
  channels text[] NOT NULL DEFAULT ARRAY['bulk_credit']::text[],   -- bulk_credit | instapay | pesonet
  format text NOT NULL DEFAULT 'delimited' CHECK (format IN ('fixed', 'delimited')),
  delimiter text NOT NULL DEFAULT ',',
  quote_values boolean NOT NULL DEFAULT false,
  line_ending text NOT NULL DEFAULT 'CRLF' CHECK (line_ending IN ('CRLF', 'LF')),
  file_name_pattern text NOT NULL DEFAULT '{bankCode}_{batchNumber}_{valueDate:YYYYMMDD}.txt',
  header_fields jsonb NOT NULL DEFAULT '[]',             -- [{ name, source, value, width, align, pad, format }]
  detail_fields jsonb NOT NULL DEFAULT '[]',
  trailer_fields jsonb NOT NULL DEFAULT '[]',
  status_file jsonb NOT NULL DEFAULT '{}',               -- { format, delimiter, skipRows, hasHeader, columns: { reference, status, bankReference, reason, amount }, paidValues, rejectedValues }
  max_amount_per_line numeric(14,2),                     -- e.g. InstaPay 50,000.00
  is_example boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  description text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS payee_bank_accounts (
  id serial PRIMARY KEY,
  payee_type text NOT NULL CHECK (payee_type IN ('Insurer', 'Agent/Referrer', 'Customer', 'Client', 'Supplier')),
  payee_id text NOT NULL,                                -- insurer id, referrer id, client id or supplier code
  payee_name text,
  bank_code text NOT NULL,
  bank_branch text,
  account_number text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL DEFAULT 'savings' CHECK (account_type IN ('savings', 'current')),
  is_default boolean NOT NULL DEFAULT true,
  email text,
  active boolean NOT NULL DEFAULT true,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS payee_bank_accounts_payee_idx ON payee_bank_accounts(payee_type, payee_id);

CREATE TABLE IF NOT EXISTS bank_payment_batches (
  id text PRIMARY KEY DEFAULT ('bpb_' || encode(gen_random_bytes(8), 'hex')),
  batch_number text UNIQUE,
  layout_code text NOT NULL REFERENCES bank_file_layouts(code),
  bank_account_code text NOT NULL,                       -- the broker's bank account (bank account master) debited
  channel text NOT NULL DEFAULT 'bulk_credit' CHECK (channel IN ('bulk_credit', 'instapay', 'pesonet')),
  value_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'for-approval', 'approved', 'file-generated', 'sent', 'completed', 'cancelled')),
  line_count int NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  paid_count int NOT NULL DEFAULT 0, rejected_count int NOT NULL DEFAULT 0,
  file_name text, file_content text, file_hash text, file_generated_at timestamptz, file_generated_by text,
  sent_at timestamptz, sent_by text,
  outbox_id bigint REFERENCES integration_outbox(id),
  remarks text,
  submitted_by text, submitted_at timestamptz,
  approved_by text, approved_at timestamptz,
  rejected_reason text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS bank_payment_batches_status_idx ON bank_payment_batches(status, created_at DESC);

CREATE TABLE IF NOT EXISTS bank_payment_batch_lines (
  id bigserial PRIMARY KEY,
  batch_id text NOT NULL REFERENCES bank_payment_batches(id) ON DELETE CASCADE,
  seq int NOT NULL,
  disbursement_id text NOT NULL REFERENCES disbursements(id),
  voucher_number text,
  payee_type text, payee_name text,
  bank_code text, account_number text, account_name text, account_type text, email text,
  amount numeric(14,2) NOT NULL,
  reference text NOT NULL,                               -- what the bank returns in the status file (the voucher number)
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  bank_reference text, reason text,
  journal_id text REFERENCES journal_vouchers(id),
  checkbook_id text REFERENCES checkbooks(id),
  result_source text CHECK (result_source IN ('file', 'manual')),
  result_at timestamptz, result_by text);
CREATE INDEX IF NOT EXISTS bank_payment_batch_lines_batch_idx ON bank_payment_batch_lines(batch_id, seq);
CREATE INDEX IF NOT EXISTS bank_payment_batch_lines_voucher_idx ON bank_payment_batch_lines(disbursement_id);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('bank_payment_batch', 'Bank Payment Batch', 'disbursements', 'BPB', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly',
  'Batch of payment vouchers paid by a bank payment file (Accounts > Bank Payment Files)', 'migration')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('bank_payments.instapay_limit', '50000', 'bank_payments', 'InstaPay: highest amount of one transfer (PHP); a larger line must go by PESONet or bulk credit', 'number'),
 ('bank_payments.allow_draft_vouchers', 'false', 'bank_payments', 'Bank payment batch: also accept vouchers still in draft (otherwise only vouchers submitted for approval)', 'boolean')
ON CONFLICT (key) DO NOTHING;
