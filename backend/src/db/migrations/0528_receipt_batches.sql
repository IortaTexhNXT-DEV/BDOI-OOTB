-- Receipt voucher batches (TIS-BRD-COLL-08; MOM-S3-COLL-RV-SPLIT).
--
-- Each bulk upload of receipts is a batch (RVB-) with its file, row counts and totals. The TISPH batch file combines
-- premium and commission on a row (Amount = premium + Commission Amount). receipts.batch_commission_handling:
--   separate  (proposal) the premium part is receipted against the policy; the commission part is kept apart on the
--             batch, listed for Accounting to reconcile with the insurer's commission (exported from the batch)
--   refuse    a row with a commission amount is refused: the file must carry premium only
-- Idempotent.

CREATE TABLE IF NOT EXISTS receipt_batches (
  id text PRIMARY KEY DEFAULT ('rvb_' || encode(gen_random_bytes(8), 'hex')),
  batch_number text NOT NULL UNIQUE,
  file_name text,
  row_count int NOT NULL DEFAULT 0,
  created_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  premium_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_total numeric(14,2) NOT NULL DEFAULT 0,
  commission_lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS receipt_batches_created ON receipt_batches(created_at DESC);

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS batch_id text REFERENCES receipt_batches(id);

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('receipt_batch', 'Receipt Voucher Batch', 'receipts', 'RVB', 'Bulk upload of receipts (one file)', 'system')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('receipts.batch_commission_handling', '"separate"', 'receipts', 'Receipt batch upload: a row with a commission amount (separate: the premium is receipted and the commission kept apart for Accounting; refuse: the row is refused)', 'string')
ON CONFLICT (key) DO NOTHING;
