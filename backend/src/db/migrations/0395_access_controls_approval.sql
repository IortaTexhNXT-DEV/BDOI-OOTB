-- Access controls (Master > Users and Access > Role Permissions > Access controls): a change of the switches that
-- decide how access is enforced (access.change_approval, access.sod_enforced, access.authority_enforced,
-- access.authority_without_limit) is stored in accounting_config_changes as kind access-controls and applies only when
-- a different user holding approve:access-control approves it (src/modules/access-control/controls.js). The generic
-- configuration endpoints refuse these keys. Idempotent.

DO $$
BEGIN
  ALTER TABLE accounting_config_changes DROP CONSTRAINT IF EXISTS accounting_config_changes_kind_check;
  ALTER TABLE accounting_config_changes ADD CONSTRAINT accounting_config_changes_kind_check CHECK (kind IN ('posting-rule-version', 'posting-rule-status',
    'account-role', 'account-map', 'commission-taxes', 'role-access', 'delegation', 'sod-rule', 'sod-exception', 'access-review', 'authority-limits',
    'access-controls'));
END $$;
