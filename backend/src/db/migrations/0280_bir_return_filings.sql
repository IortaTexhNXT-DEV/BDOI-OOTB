-- BIR withholding and percentage tax returns: the filing record of each return period (BIR Form 0619-E monthly
-- remittance, 1601-EQ quarterly return, 1604-E annual information return, 2551Q quarterly percentage tax return).
-- The figures are computed live from the payment vouchers, the alphalists and the ledger (modules/bir); the filing record
-- keeps what was filed: the figures as filed (snapshot), the date filed, the eFPS / eBIRForms reference, the amount paid
-- and the payment reference. A filed return is amended by recording a new filing that supersedes it. Idempotent.
CREATE TABLE IF NOT EXISTS bir_return_filings (
  id text PRIMARY KEY DEFAULT ('brf_' || encode(gen_random_bytes(8), 'hex')),
  form_code text NOT NULL CHECK (form_code IN ('0619-E', '1601-EQ', '1604-E', '2551Q')),
  period_key text NOT NULL,                             -- 2026-07 (monthly), 2026-Q3 (quarterly), 2026 (annual)
  year int NOT NULL,
  quarter int CHECK (quarter BETWEEN 1 AND 4),
  month int CHECK (month BETWEEN 1 AND 12),
  period_from date NOT NULL, period_to date NOT NULL,
  figures jsonb NOT NULL DEFAULT '{}',                  -- the computed return as filed (snapshot)
  tax_due numeric(16,2) NOT NULL DEFAULT 0,             -- tax due per the return before penalties
  penalties numeric(16,2) NOT NULL DEFAULT 0,           -- surcharge, interest and compromise
  amount_paid numeric(16,2) NOT NULL DEFAULT 0,
  date_filed date NOT NULL,
  filing_reference text,                                -- eFPS / eBIRForms filing reference or tax return receipt confirmation
  payment_date date,
  payment_reference text,                               -- bank / eFPS / ePayment confirmation number
  payment_channel text,                                 -- eFPS, eBIRForms with bank, GCash, Landbank Link.BizPortal, over the counter, ...
  amended boolean NOT NULL DEFAULT false,
  supersedes text REFERENCES bir_return_filings(id),
  status text NOT NULL DEFAULT 'filed' CHECK (status IN ('filed', 'superseded', 'cancelled')),
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  cancelled_by text, cancelled_at timestamptz, cancel_reason text);
CREATE UNIQUE INDEX IF NOT EXISTS bir_return_filings_active_uq ON bir_return_filings(form_code, period_key) WHERE status = 'filed';
CREATE INDEX IF NOT EXISTS bir_return_filings_year_idx ON bir_return_filings(year, form_code);

-- Percentage tax (non-VAT broker or agent, BIR Form 2551Q): ATC PT010, 3% of gross sales (rate kept in a setting)
INSERT INTO tax_codes(code, description, tax_type, rate, atc, nature_of_payment, gl_account, applies_to, payee_kind, effective_from, sort_order, remarks) VALUES
 ('PT010', 'Percentage tax on gross sales of a non-VAT registered person (NIRC Sec. 116)', 'PT', 3, 'PT010', 'Persons exempt from VAT under Sec. 109 (BB)', NULL, 'sales', 'any', '2026-01-01', 430,
  'The rate applied on the 2551Q working paper is bir.percentage_tax_rate; confirm with the tax adviser')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('bir.tin_branch_code', '"00000"', 'bir', 'Branch code of the broker''s TIN (5 digits, 00000 = head office), printed after the TIN on BIR forms, invoices and DAT files', 'string'),
 ('bir.withholding_due_day', '10', 'bir', 'Day of the following month the monthly remittance (0619-E) is due (eFPS filers may be staggered to day 11 to 15)', 'number'),
 ('bir.withholding_agent_category', '"private"', 'bir', 'Category of withholding agent on BIR forms: private or government', 'string'),
 ('bir.top_withholding_agent', 'false', 'bir', 'The broker is a top withholding agent (shown on 0619-E and 1601-EQ)', 'boolean'),
 ('bir.withholding_ledger_accounts', '[]', 'bir', 'GL accounts of expanded withholding tax payable reconciled with 0619-E / 1601-EQ (empty = accounting.account.wht_payable)', 'json'),
 ('bir.percentage_tax_rate', '3', 'bir', 'Percentage tax rate (%) on gross sales for a non-VAT registered broker or agent (2551Q working paper)', 'number'),
 ('bir.percentage_tax_atc', '"PT010"', 'bir', 'ATC of the percentage tax on the 2551Q working paper', 'string'),
 ('bir.sawt_form', '"1702Q"', 'bir', 'Return the SAWT DAT file is attached to (1702Q, 1702RT, 2550Q, 2551Q)', 'string'),
 ('bir.fiscal_year_end_month', '12', 'bir', 'Month the broker''s taxable year ends (12 = calendar year), written in the SLSP DAT header', 'number'),
 ('bir.trade_name', '""', 'bir', 'Trade name (business style) for BIR forms and invoices (blank = the registered name)', 'string'),
 ('bir.line_of_business', '"Insurance brokerage"', 'bir', 'Line of business on BIR forms', 'string')
ON CONFLICT (key) DO NOTHING;

