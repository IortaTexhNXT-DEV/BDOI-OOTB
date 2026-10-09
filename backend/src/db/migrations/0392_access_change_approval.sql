-- Changes of access through the configuration approval (maker-checker), Master > Users and Access.
--
-- A change of a role's access (Role Permissions) is stored in accounting_config_changes as kind role-access (target:
-- the role code; payload: the permissions to add and to remove, the reason and the segregation-of-duties warnings;
-- before: the role's permissions when it was requested). It applies when a different user holding
-- approve:access-control approves it (src/modules/access-control/changes.js); posting-rules leaves these kinds alone.
-- The other changes of access of the same screens (delegation, sod-rule, sod-exception, access-review) are allowed
-- kinds as well. access.change_approval switches the approval off for a small team (the change then applies at once;
-- the approver is never the requester while it is on). Idempotent.

DO $$
BEGIN
  ALTER TABLE accounting_config_changes DROP CONSTRAINT IF EXISTS accounting_config_changes_kind_check;
  ALTER TABLE accounting_config_changes ADD CONSTRAINT accounting_config_changes_kind_check CHECK (kind IN ('posting-rule-version', 'posting-rule-status',
    'account-role', 'account-map', 'commission-taxes', 'role-access', 'delegation', 'sod-rule', 'sod-exception', 'access-review'));
END $$;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('access.change_approval', 'true', 'access',
  'Changes to access (the access of a role) wait for the approval of a different administrator who may approve access changes', 'boolean')
ON CONFLICT (key) DO NOTHING;

-- the permission now approves role access changes too (description of migration 0193 only, so a changed one is kept)
UPDATE permissions SET description = 'Approve role access changes and authority limits proposed by another administrator'
 WHERE code = 'approve:access-control' AND description = 'Approve authority limits proposed by another administrator (maker-checker)';
