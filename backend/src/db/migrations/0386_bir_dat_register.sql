-- Register of the BIR DAT files generated on Accounts > Tax > BIR DAT Files: each generation keeps the file as produced
-- (name, content, record count, totals), its validation against the report it was built from (detail records and
-- control totals compared, field problems per record) and who generated it and when, so the file sent to the BIR can
-- be downloaded again unchanged.
-- Also the reason code of a cancelled sales invoice or payment acknowledgement (master reason-code, contexts
-- sales_invoice_cancel and invoice_payment_cancel of seed 89_tax_invoice_reasons.sql); cancel_reason keeps the name of
-- the reason and the note. Idempotent.
CREATE TABLE IF NOT EXISTS bir_dat_files (
  id text PRIMARY KEY DEFAULT ('bdf_' || encode(gen_random_bytes(8), 'hex')),
  dat_type text NOT NULL CHECK (dat_type IN ('qap', 'sawt', '1604e', 'slspSales', 'slspPurchases')),
  form_code text,                                        -- return form of a SAWT (1702Q, 2550Q ...)
  year int NOT NULL,
  quarter int CHECK (quarter BETWEEN 1 AND 4),
  period_key text NOT NULL,                              -- 2026-Q3, or 2026 for the 1604-E
  period_from date NOT NULL,
  period_to date NOT NULL,
  file_name text NOT NULL,
  content text NOT NULL,
  records int NOT NULL DEFAULT 0,                        -- lines of the file
  detail_rows int NOT NULL DEFAULT 0,                    -- rows of the report
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  checks jsonb NOT NULL DEFAULT '[]'::jsonb,             -- [{ code, report, file, difference, agrees }]
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,             -- [{ record, name, code }]
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  valid boolean NOT NULL DEFAULT false,
  layout_version text,
  generated_by text,
  generated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS bir_dat_files_year_idx ON bir_dat_files(year, generated_at DESC);

ALTER TABLE sales_invoices ADD COLUMN IF NOT EXISTS cancel_reason_code text;
COMMENT ON COLUMN sales_invoices.cancel_reason_code IS 'Reason code of the cancellation (master reason-code, context sales_invoice_cancel); cancel_reason holds its name and the note';
ALTER TABLE sales_invoice_payments ADD COLUMN IF NOT EXISTS cancel_reason_code text;
COMMENT ON COLUMN sales_invoice_payments.cancel_reason_code IS 'Reason code of the cancellation (master reason-code, context invoice_payment_cancel); cancel_reason holds its name and the note';
