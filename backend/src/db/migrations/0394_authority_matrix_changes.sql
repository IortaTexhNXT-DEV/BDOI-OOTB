-- Authority Matrix (Master > Users and Access): changes of approval limits through the configuration approval.
--
-- A change of one or more limits (a cell of the matrix, a personal limit, the removal of a limit, or an uploaded
-- workbook) is stored in accounting_config_changes as kind authority-limits (target: the role or person and the
-- transaction type, or "upload" for a workbook; payload: the lines). It applies when a different user holding
-- approve:access-control approves it (src/modules/access-control/authority.js). Each limit it writes keeps the
-- authority reference (board resolution number and date) and the change it came from.
-- A proposal waiting in authority_limits (the go-live workbook, the API) can now be withdrawn by its proposer.
-- access.authority_reference_required asks for the reference on every change made on the screen or by upload.
-- Idempotent.

ALTER TABLE authority_limits ADD COLUMN IF NOT EXISTS reference_no text;
ALTER TABLE authority_limits ADD COLUMN IF NOT EXISTS reference_date date;
ALTER TABLE authority_limits ADD COLUMN IF NOT EXISTS change_id bigint REFERENCES accounting_config_changes(id);
CREATE INDEX IF NOT EXISTS authority_limits_change ON authority_limits(change_id) WHERE change_id IS NOT NULL;

DO $$
BEGIN
  ALTER TABLE authority_limits DROP CONSTRAINT IF EXISTS authority_limits_status_check;
  ALTER TABLE authority_limits ADD CONSTRAINT authority_limits_status_check CHECK (status IN ('pending', 'active', 'rejected', 'retired', 'withdrawn'));
  ALTER TABLE accounting_config_changes DROP CONSTRAINT IF EXISTS accounting_config_changes_kind_check;
  ALTER TABLE accounting_config_changes ADD CONSTRAINT accounting_config_changes_kind_check CHECK (kind IN ('posting-rule-version', 'posting-rule-status',
    'account-role', 'account-map', 'commission-taxes', 'role-access', 'delegation', 'sod-rule', 'sod-exception', 'access-review', 'authority-limits'));
END $$;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('access.authority_reference_required', 'true', 'access',
  'Ask for the authority reference (board resolution number and date) on every change of an approval limit', 'boolean')
ON CONFLICT (key) DO NOTHING;
