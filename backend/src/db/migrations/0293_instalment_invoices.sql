-- Separate instalment invoices: an instalment plan can be invoiced, replacing the single premium bill by one bill
-- (receivable) per instalment with its own due date, booking journal, collection item and ageing. The original bill
-- is cancelled with the reversal of its booking journal, so the ledger carries one receivable per instalment.
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS parent_receivable_id text REFERENCES receivables(id);
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS instalment_seq int;
CREATE INDEX IF NOT EXISTS receivables_parent_receivable ON receivables(parent_receivable_id);
ALTER TABLE premium_instalments ADD COLUMN IF NOT EXISTS receivable_id text REFERENCES receivables(id);
CREATE INDEX IF NOT EXISTS premium_instalments_receivable ON premium_instalments(receivable_id);
ALTER TABLE premium_instalment_plans ADD COLUMN IF NOT EXISTS invoiced_at timestamptz;
ALTER TABLE premium_instalment_plans ADD COLUMN IF NOT EXISTS invoiced_by text;
