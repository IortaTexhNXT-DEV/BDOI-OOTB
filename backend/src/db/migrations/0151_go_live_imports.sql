-- Go-live data imports.
-- Open premium receivables of the old system are loaded as bills with source 'opening' and the go-live date; they
-- have no booking journal (the GL carries them in the opening balance of the premiums receivable account). One
-- legacy bill reference per policy.
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS go_live_date date;
CREATE UNIQUE INDEX IF NOT EXISTS receivables_opening_reference_uq ON receivables (policy_id, reference) WHERE source = 'opening';
