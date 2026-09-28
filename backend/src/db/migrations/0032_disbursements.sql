-- Payment vouchers (disbursements), invoice lists (payables selected for a voucher) and cheques (checkbooks)
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS voucher_date date NOT NULL DEFAULT current_date;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS transaction_number text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS transaction_code text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS transaction_description text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS department_code text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS branch_code text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS criteria text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS customer_code text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS client_id text REFERENCES clients(id);
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS referrer_id text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS referrer_name text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS insurance_company_id int REFERENCES insurance_companies(id);
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS insurer_name text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS policy_id text REFERENCES policies(id);
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS policy_number text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS instrument_currency text NOT NULL DEFAULT 'PHP';
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS remarks text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS gross_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS wht_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS journal_id text REFERENCES journal_vouchers(id);
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';   -- manual | bulk-upload | agent-payout | insurer-remittance | commission-line
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS updated_by text;
CREATE INDEX IF NOT EXISTS disbursements_customer_idx ON disbursements(customer_code);
CREATE INDEX IF NOT EXISTS disbursements_referrer_idx ON disbursements(referrer_id);

CREATE TABLE IF NOT EXISTS invoice_lists (
  id text PRIMARY KEY DEFAULT ('il_' || encode(gen_random_bytes(8), 'hex')),
  invoice_number text UNIQUE,
  disbursement_id text REFERENCES disbursements(id),
  customer_code text, client_id text REFERENCES clients(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  policy_id text REFERENCES policies(id), policy_number text,
  receipt_id text REFERENCES receipts(id),
  payee_type text NOT NULL DEFAULT 'Insurer',       -- Insurer | Customer | Client | Agent/Referrer | Supplier
  payables numeric(14,2) NOT NULL DEFAULT 0, outstanding numeric(14,2) NOT NULL DEFAULT 0,
  fc_amount numeric(14,2) NOT NULL DEFAULT 0, lc_amount numeric(14,2) NOT NULL DEFAULT 0,
  excess numeric(14,2) NOT NULL DEFAULT 0, bal_amount numeric(14,2) NOT NULL DEFAULT 0,
  vat numeric(14,2) NOT NULL DEFAULT 0, wht numeric(14,2) NOT NULL DEFAULT 0, comsub numeric(14,2) NOT NULL DEFAULT 0,
  total_amount numeric(14,2) NOT NULL DEFAULT 0,
  bank_code text, bank_amount numeric(14,2) NOT NULL DEFAULT 0,
  is_invoice_paid boolean NOT NULL DEFAULT false,   -- premium received from the client
  status text NOT NULL DEFAULT 'open',              -- open | in-voucher | paid | cancelled
  source text NOT NULL DEFAULT 'manual',
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS invoice_lists_customer_idx ON invoice_lists(customer_code);

CREATE TABLE IF NOT EXISTS checkbooks (
  id text PRIMARY KEY DEFAULT ('chk_' || encode(gen_random_bytes(8), 'hex')),
  invoice_list_id text REFERENCES invoice_lists(id),
  disbursement_id text REFERENCES disbursements(id),
  customer_code text, customer_name text,
  main_account text, instrument_book_id text, instrument_no text, instrument_date date,
  totale_amount numeric(14,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Printed','Cancelled')),
  journal_id text REFERENCES journal_vouchers(id),
  created_by text, approved_by text, approved_at timestamptz, printed_by text, printed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS checkbooks_invoice_idx ON checkbooks(invoice_list_id);
