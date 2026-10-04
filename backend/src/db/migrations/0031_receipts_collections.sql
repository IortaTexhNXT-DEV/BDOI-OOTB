-- Receivables (premium billed to clients), official receipts with receipt lines, payment applications, collections.
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'policy';     -- policy | endorsement | renewal | receipt | manual
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS reference text;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'PHP';
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS net_premium numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS vat numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS dst numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS lgt numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS other_charges numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS discount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS commission_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS booking_jv_id text REFERENCES journal_vouchers(id);
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS last_payment_at timestamptz;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS created_by text;
CREATE INDEX IF NOT EXISTS receivables_policy_idx ON receivables(policy_id);
CREATE INDEX IF NOT EXISTS receivables_client_idx ON receivables(client_id);

-- receipts: header of an official receipt. receipt_status Draft (has unpaid lines) | Converted (fully paid) | Cancelled
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_type text NOT NULL DEFAULT 'Payment';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_status text NOT NULL DEFAULT 'Draft';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS transaction_code text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS transaction_number text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS customer_code text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS branch_code text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS department_code text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS currency_code text NOT NULL DEFAULT 'PHP';
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS external_ref text;            -- number supplied by the caller (kept for reference)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'api';   -- api | bulk-upload | payment
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS cancel_reason text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS receipts_customer_idx ON receipts(customer_code);
CREATE INDEX IF NOT EXISTS receipts_policy_idx ON receipts(policy_id);
CREATE INDEX IF NOT EXISTS receipts_status_idx ON receipts(receipt_status, received_date);

CREATE TABLE IF NOT EXISTS receipt_lines (
  id text PRIMARY KEY DEFAULT ('rl_' || encode(gen_random_bytes(8), 'hex')),
  receipt_id text NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  policy_id text REFERENCES policies(id),
  policy_number text,
  net_premium numeric(14,2) NOT NULL DEFAULT 0,
  paid numeric(14,2) NOT NULL DEFAULT 0,
  un_paid numeric(14,2) NOT NULL DEFAULT 0,
  discounts numeric(14,2) NOT NULL DEFAULT 0,
  dst numeric(14,2) NOT NULL DEFAULT 0, lgt numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0, ewt numeric(14,2) NOT NULL DEFAULT 0,
  other numeric(14,2) NOT NULL DEFAULT 0,
  fc_amount numeric(14,2) NOT NULL DEFAULT 0, lc_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Paid')),
  applied_amount numeric(14,2) NOT NULL DEFAULT 0,  -- part of `paid` already applied to receivables and journalised
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (receipt_id, line_no));

CREATE TABLE IF NOT EXISTS receipt_applications (
  id bigserial PRIMARY KEY,
  receipt_id text REFERENCES receipts(id),            -- null for payments recorded without an official receipt
  receipt_line_id text REFERENCES receipt_lines(id) ON DELETE SET NULL,
  receivable_id text NOT NULL REFERENCES receivables(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  journal_id text REFERENCES journal_vouchers(id),
  payment_mode text, reference_no text,
  status text NOT NULL DEFAULT 'applied',            -- applied | reversed
  remitted_invoice_id text,                           -- invoice_lists row that remitted the insurer share
  applied_by text, applied_at timestamptz NOT NULL DEFAULT now(), reversed_at timestamptz);
CREATE INDEX IF NOT EXISTS receipt_applications_receivable_idx ON receipt_applications(receivable_id);

-- Collections: one tracking record per receivable; status is derived at read time from balance / due date / commitment
CREATE TABLE IF NOT EXISTS collection_items (
  id text PRIMARY KEY DEFAULT ('col_' || encode(gen_random_bytes(8), 'hex')),
  receivable_id text NOT NULL UNIQUE REFERENCES receivables(id),
  policy_id text REFERENCES policies(id),
  client_id text REFERENCES clients(id),
  commitment_date date, commitment_reason text,
  escalated_at timestamptz, escalated_by text,
  last_follow_up_at timestamptz, last_reminder_at timestamptz,
  assigned_to text REFERENCES users(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS collection_actions (
  id bigserial PRIMARY KEY,
  collection_id text NOT NULL REFERENCES collection_items(id) ON DELETE CASCADE,
  action_type text NOT NULL,                        -- Call | Email | SMS | Visit | Commitment | Note | Reminder | Escalation
  action_date timestamptz NOT NULL DEFAULT now(),
  action_by text, call_outcome text, notes text, commitment_date date, email_id bigint);
CREATE INDEX IF NOT EXISTS collection_actions_item_idx ON collection_actions(collection_id, action_date DESC);
