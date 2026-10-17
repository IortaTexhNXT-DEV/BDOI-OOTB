-- Batch-wise BIR Form 2307 (TIS-BRD-TAX-03, CR-11, FGA-RF-07; GAP-FIN-24).
--
-- Each "issue all" of a quarter is a batch (CWB- number): the certificates it issued, their payees and the EWT per ATC,
-- read back as the batch detail and its Excel. A certificate issued on its own has no batch. A certificate is not
-- issued while the payor (the primary company, or the bir.* fallback) has no TIN. Idempotent.

CREATE TABLE IF NOT EXISTS bir_2307_batches (
  id text PRIMARY KEY DEFAULT ('cwb_' || encode(gen_random_bytes(8), 'hex')),
  batch_number text UNIQUE NOT NULL,
  year int NOT NULL,
  quarter int NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  payee_type text,
  certificates int NOT NULL DEFAULT 0,
  total_income numeric(16,2) NOT NULL DEFAULT 0,
  total_tax numeric(16,2) NOT NULL DEFAULT 0,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE bir_2307_certificates ADD COLUMN IF NOT EXISTS batch_id text REFERENCES bir_2307_batches(id);
CREATE INDEX IF NOT EXISTS bir_2307_certificates_batch_id_fk_idx ON bir_2307_certificates (batch_id);
