-- Remittance per bill of an open cover (TIS-BRD-PJRN-09 parcel / courier open policy, TIS-BRD-COMM-01): an open cover is
-- billed every period (monthly declaration) and each bill is remitted once, instead of the policy once. A policy is
-- remitted per bill when policies.details.openCover is true or its product line is one of remittance.per_bill_lines;
-- remittance_lines.receivable_ids names the bills a line remits (null: the whole policy, as before).
--
-- Setting remittance.per_bill_lines: product lines remitted per bill (MARINE: the parcel / courier open policy).
-- Idempotent.

ALTER TABLE remittance_lines ADD COLUMN IF NOT EXISTS receivable_ids text[];
CREATE INDEX IF NOT EXISTS remittance_lines_receivable_ids_gin ON remittance_lines USING gin (receivable_ids);

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('remittance.per_bill_lines', '["MARINE"]', 'remittance', 'Product lines whose policies are remitted per bill (open covers billed every period), each bill once', 'json', true)
ON CONFLICT (key) DO NOTHING;
