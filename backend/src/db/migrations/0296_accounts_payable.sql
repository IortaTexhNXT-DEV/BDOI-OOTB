-- Accounts payable sub-ledger (Accounts > Payables): supplier invoices with input VAT and expanded withholding tax,
-- maker-checker approval (posting rule ap.invoice on approval), supplier payments allocated to invoices (posting rule
-- ap.payment) and the AP ageing. Suppliers are a generic master (type supplier, seed 73_ops_accounting.sql).
--   supplier_invoices / supplier_invoice_lines   the invoice (APV number) and its expense or asset lines
--   supplier_payments / supplier_payment_allocations   the payment (SPV number) and the invoices it settles
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id text PRIMARY KEY DEFAULT ('sin_' || encode(gen_random_bytes(8), 'hex')),
  voucher_number text NOT NULL UNIQUE,
  supplier_id int NOT NULL REFERENCES master_records(id),
  supplier_invoice_no text NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  received_date date,
  description text,
  currency text NOT NULL DEFAULT 'PHP',
  vat_code text,                                       -- input VAT tax code (tax_codes), null when not VAT-registered
  ewt_code text,                                       -- EWT tax code withheld from the supplier (tax_codes)
  net_amount numeric(14,2) NOT NULL DEFAULT 0,
  input_vat numeric(14,2) NOT NULL DEFAULT 0,
  gross_amount numeric(14,2) NOT NULL DEFAULT 0,
  ewt_rate numeric(7,4) NOT NULL DEFAULT 0,            -- percent
  ewt_amount numeric(14,2) NOT NULL DEFAULT 0,
  payable_amount numeric(14,2) NOT NULL DEFAULT 0,     -- gross less EWT: what the supplier is paid
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  balance numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'for-approval', 'approved', 'partially-paid', 'paid', 'rejected', 'cancelled')),
  journal_id text REFERENCES journal_vouchers(id),
  submitted_by text, submitted_at timestamptz,
  approved_by text, approved_at timestamptz,
  rejected_by text, rejected_at timestamptz, reject_reason text,
  cancelled_by text, cancelled_at timestamptz, cancel_reason text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS supplier_invoices_supplier_no_uq ON supplier_invoices(supplier_id, lower(supplier_invoice_no)) WHERE status NOT IN ('cancelled', 'rejected');
CREATE INDEX IF NOT EXISTS supplier_invoices_status ON supplier_invoices(status, due_date);
CREATE INDEX IF NOT EXISTS supplier_invoices_journal ON supplier_invoices(journal_id);

CREATE TABLE IF NOT EXISTS supplier_invoice_lines (
  id bigserial PRIMARY KEY,
  invoice_id text NOT NULL REFERENCES supplier_invoices(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  description text NOT NULL,
  account_code text NOT NULL,                          -- expense (or asset) GL account
  amount numeric(14,2) NOT NULL CHECK (amount > 0),    -- net of VAT
  vatable boolean NOT NULL DEFAULT true,
  vat_amount numeric(14,2) NOT NULL DEFAULT 0,
  asset_class text,                                    -- asset-class master code: the line is capitalised as a fixed asset
  fixed_asset_id text,
  branch_code text, department_code text,
  UNIQUE (invoice_id, line_no));

CREATE TABLE IF NOT EXISTS supplier_payments (
  id text PRIMARY KEY DEFAULT ('spy_' || encode(gen_random_bytes(8), 'hex')),
  payment_number text NOT NULL UNIQUE,
  supplier_id int NOT NULL REFERENCES master_records(id),
  payment_date date NOT NULL,
  payment_mode text NOT NULL DEFAULT 'check' CHECK (payment_mode IN ('check', 'bank-transfer', 'cash')),
  pay_from_account text NOT NULL,                      -- bank account (Bank Account master) or cash GL account
  cheque_number text,
  reference text,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'cancelled')),
  journal_id text REFERENCES journal_vouchers(id),
  reversal_journal_id text REFERENCES journal_vouchers(id),
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  cancelled_by text, cancelled_at timestamptz, cancel_reason text);
CREATE INDEX IF NOT EXISTS supplier_payments_supplier ON supplier_payments(supplier_id, payment_date);

CREATE TABLE IF NOT EXISTS supplier_payment_allocations (
  id bigserial PRIMARY KEY,
  payment_id text NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
  invoice_id text NOT NULL REFERENCES supplier_invoices(id),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  UNIQUE (payment_id, invoice_id));
CREATE INDEX IF NOT EXISTS supplier_payment_allocations_invoice ON supplier_payment_allocations(invoice_id);
