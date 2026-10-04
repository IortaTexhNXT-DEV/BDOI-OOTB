-- Sales invoices under the Ease of Paying Taxes Act (RA 11976) and RR 7-2024: the invoice is the primary document of
-- the broker's sale of services (brokerage commission, fees, overriding / contingent commission). Each invoice carries
-- the seller's registered name, TIN with branch code, business address and the ATP / CAS permit details (snapshot of
-- the invoice.* settings at issue), the buyer's name, TIN and address, the VATable / VAT-exempt / zero-rated breakdown
-- and the VAT. Numbers come from the sales_invoice series (sequential, never reset, no gaps: the number is taken in the
-- issuing transaction). An invoice is never deleted: it is cancelled with a reason. Payments received on an invoice
-- are acknowledged with a supplementary document (payment acknowledgement, not valid for claim of input tax).
-- Invoices made out for a commission debit note, an overriding commission computation or a broker-billed policy's
-- commission do not post again (their revenue is already booked); a manual service invoice posts its own journal
-- (posting rule sales_invoice.issue) and its payments post sales_invoice.payment. Idempotent.
CREATE TABLE IF NOT EXISTS sales_invoices (
  id text PRIMARY KEY DEFAULT ('sin_' || encode(gen_random_bytes(8), 'hex')),
  invoice_number text UNIQUE NOT NULL,
  invoice_date date NOT NULL,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'debit_note', 'override_commission', 'policy_commission')),
  source_id text, source_reference text,
  buyer_type text NOT NULL DEFAULT 'insurer' CHECK (buyer_type IN ('insurer', 'client', 'other')),
  buyer_id text, buyer_name text NOT NULL, buyer_tin text, buyer_branch_code text, buyer_address text, buyer_business_style text,
  seller jsonb NOT NULL DEFAULT '{}',                    -- registered name, trade name, TIN, branch, address, VAT status, ATP / CAS permit, serial range
  vat_registered boolean NOT NULL DEFAULT true,
  currency text NOT NULL DEFAULT 'PHP',
  vatable_sales numeric(16,2) NOT NULL DEFAULT 0,
  vat_exempt_sales numeric(16,2) NOT NULL DEFAULT 0,
  zero_rated_sales numeric(16,2) NOT NULL DEFAULT 0,
  vat_amount numeric(16,2) NOT NULL DEFAULT 0,
  total_sales numeric(16,2) NOT NULL DEFAULT 0,          -- vatable + exempt + zero-rated (net of VAT)
  total_amount numeric(16,2) NOT NULL DEFAULT 0,         -- total amount due (sales + VAT)
  withholding_tax numeric(16,2) NOT NULL DEFAULT 0,      -- expected creditable withholding by the buyer (shown, not deducted from the total)
  amount_paid numeric(16,2) NOT NULL DEFAULT 0,
  balance numeric(16,2) NOT NULL DEFAULT 0,
  payment_terms text, due_date date, remarks text,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
  journal_id text, cancel_journal_id text,
  cancel_reason text, cancelled_by text, cancelled_at timestamptz,
  print_count int NOT NULL DEFAULT 0, last_printed_at timestamptz,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS sales_invoices_source_uq ON sales_invoices(source_type, source_id) WHERE status = 'issued' AND source_type <> 'manual';
CREATE INDEX IF NOT EXISTS sales_invoices_date_idx ON sales_invoices(invoice_date);

CREATE TABLE IF NOT EXISTS sales_invoice_lines (
  id bigserial PRIMARY KEY,
  invoice_id text NOT NULL REFERENCES sales_invoices(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  description text NOT NULL,
  quantity numeric(14,4) NOT NULL DEFAULT 1,
  unit_price numeric(16,2) NOT NULL DEFAULT 0,
  amount numeric(16,2) NOT NULL DEFAULT 0,               -- net of VAT
  vat_class text NOT NULL DEFAULT 'vatable' CHECK (vat_class IN ('vatable', 'exempt', 'zero_rated')),
  vat_amount numeric(16,2) NOT NULL DEFAULT 0,
  gl_account text,                                       -- income account of a manual invoice line
  policy_number text, reference text);
CREATE INDEX IF NOT EXISTS sales_invoice_lines_inv_idx ON sales_invoice_lines(invoice_id);

CREATE TABLE IF NOT EXISTS sales_invoice_payments (
  id text PRIMARY KEY DEFAULT ('sip_' || encode(gen_random_bytes(8), 'hex')),
  invoice_id text NOT NULL REFERENCES sales_invoices(id),
  ack_number text UNIQUE NOT NULL,                       -- payment acknowledgement (supplementary document) number
  payment_date date NOT NULL,
  amount numeric(16,2) NOT NULL DEFAULT 0,               -- cash received
  ewt_amount numeric(16,2) NOT NULL DEFAULT 0,           -- creditable tax withheld by the buyer (BIR Form 2307)
  form_2307_no text, payment_mode text, bank_account text, reference_no text,
  journal_id text, cancel_journal_id text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'cancelled')),
  cancel_reason text, cancelled_by text, cancelled_at timestamptz,
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sales_invoice_payments_inv_idx ON sales_invoice_payments(invoice_id);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('sales_invoice', 'Sales Invoice', 'accounting', 'SI', '{PREFIX}-{SEQ}', 10, 'never', 'Sales invoice of the broker''s services (EOPT Act): sequential, never reset; keep within the registered serial range', 'migration:0281'),
 ('invoice_payment', 'Payment Acknowledgement', 'accounting', 'PAR', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly', 'Supplementary document acknowledging a payment on a sales invoice', 'migration:0281')
ON CONFLICT (code) DO NOTHING;

INSERT INTO gl_accounts(code, name, account_type, category, is_open_item, allow_manual, fs_group, normal_balance, description) VALUES
 ('1205003', 'Service Fees Receivable', 'asset', 'Receivables', false, false, 'Current Assets', 'debit', 'Fees and other services invoiced by the broker (manual sales invoices), until paid')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.account.service_fee_receivable', '"1205003"', 'accounting', 'GL: Service fees receivable (manual sales invoices)', 'string'),
 ('accounting.account.service_fee_income', '"3202001"', 'accounting', 'GL: Service fee income (default income account of a manual sales invoice line)', 'string'),
 ('invoice.atp_number', '""', 'invoice', 'Authority to Print (ATP) number of the invoices, or the acknowledgement number when the invoices are system generated', 'string'),
 ('invoice.atp_date_issued', '""', 'invoice', 'Date the ATP / acknowledgement was issued (YYYY-MM-DD)', 'string'),
 ('invoice.atp_valid_until', '""', 'invoice', 'Last day the ATP is valid (blank when the BIR no longer sets an expiry)', 'string'),
 ('invoice.cas_permit_number', '""', 'invoice', 'CAS Permit to Use / Acknowledgement Certificate number printed on the invoices', 'string'),
 ('invoice.cas_permit_date', '""', 'invoice', 'Date of the CAS Permit to Use / Acknowledgement Certificate (YYYY-MM-DD)', 'string'),
 ('invoice.serial_from', '1', 'invoice', 'First invoice serial number registered with the BIR', 'number'),
 ('invoice.serial_to', '9999999999', 'invoice', 'Last invoice serial number registered with the BIR: issuing stops beyond it', 'number'),
 ('invoice.printer_details', '""', 'invoice', 'Accredited printer or software provider and its accreditation number, printed at the foot of the invoice', 'string'),
 ('invoice.buyer_details_threshold', '1000', 'invoice', 'Total amount (PHP) from which the buyer''s TIN and address are required on the invoice (always required for a business buyer)', 'number'),
 ('invoice.default_due_days', '30', 'invoice', 'Days from the invoice date to the due date', 'number'),
 ('invoice.ewt_rate_insurer', '10', 'invoice', 'Expected creditable withholding (%) shown on invoices to insurers (commission of brokers, WC139)', 'number'),
 ('invoice.footer_note', '""', 'invoice', 'Text printed at the foot of every sales invoice', 'string'),
 ('invoice.payment_document_title', '"Payment Acknowledgement"', 'invoice', 'Title of the supplementary document issued for a payment on a sales invoice', 'string'),
 ('invoice.supplementary_note', '"THIS DOCUMENT IS NOT VALID FOR CLAIM OF INPUT TAX."', 'invoice', 'Statement printed on supplementary documents (payment acknowledgements, collection receipts)', 'string'),
 ('receipts.document_title', '"Official Receipt"', 'receipts', 'Title printed on premium collection receipts (for example Collection Receipt or Acknowledgement Receipt under the EOPT Act, as the tax adviser confirms)', 'string')
ON CONFLICT (key) DO NOTHING;

-- Posting rules (Master > Finance > Posting Rules)
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'sales_invoice.issue', 1, 'Sales invoice issued (manual service invoice)',
    'A manual sales invoice for fees or other services: the amount due is receivable, the sales net of VAT is income (the line''s income account, else the service fee income role) and the VAT is output VAT.',
    'accounting', 'SALES', 'sales-invoice', 'Sales invoice {{invoiceNumber}} ({{buyer}})', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'sales_invoice.issue') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, false, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'service_fee_receivable', NULL::text, 'receivable', 'Invoice {{invoiceNumber}} {{buyer}}'),
  (2, 'Cr', 'context', 'income', 'service_fee_income', 'income', 'Invoice {{invoiceNumber}} {{buyer}}'),
  (3, 'Cr', 'role', 'output_vat', NULL::text, 'vat', 'Output VAT invoice {{invoiceNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, narration);

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'sales_invoice.payment', 1, 'Sales invoice payment received',
    'Payment on a manual sales invoice: cash to the bank account of the payment, creditable tax withheld by the buyer (BIR Form 2307) and the receivable settled.',
    'accounting', 'COLLECTION', 'sales-invoice', 'Payment {{ackNumber}} on invoice {{invoiceNumber}} ({{buyer}})', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'sales_invoice.payment') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, false, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'bank_account', NULL::text, 'cash', 'Payment {{ackNumber}} {{buyer}}'),
  (2, 'Dr', 'role', 'creditable_wht', NULL::text, 'ewt', 'CWT withheld by {{buyer}} {{form2307}}'),
  (3, 'Cr', 'role', 'service_fee_receivable', NULL::text, 'applied', 'Invoice {{invoiceNumber}} settled')
) v(line_no, side, account_type, account, fallback_role, amount_key, narration);
