-- Remittance approval authority (Accounts > Remittance > Approval). Deciding a remittance approval (a remittance, an
-- agency bill, a settlement, an adjustment or an electronic transfer) becomes a permission of its own,
-- approve:remittance, instead of write:remittance: preparing and approving are separate grants, and an approver needs
-- no maker rights. It is granted to the roles that decided before: the System Administrator and Accounting (the
-- Accounting Manager includes Accounting). For TISPH it is granted to TIS Finance & General Accounting and the TIS
-- General Manager, the proposed remittance approvers until TISPH names them; the TISPH roles are only granted where
-- they exist.
--
-- Settings of the decision (TISPH values: seed 90_tisph_remittance.sql):
--   remittance.require_authority_limit   on: a user without a remittance limit in the Authority Matrix (own, role or
--                                        delegated) decides no remittance approval, whatever
--                                        access.authority_without_limit says for the other transactions
--   remittance.item_delegation_enabled   off: an approval cannot be handed to another user one by one; an absent
--                                        approver is covered by a dated delegation (Master > User Management >
--                                        Delegations)
-- Idempotent.

-- Users of the roles that gain the permission get a new token version (the permissions travel in the access token);
-- only on the first run, while the permission does not exist yet.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('accounting', 'accounting-manager', 'tis-finance', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'approve:remittance');

INSERT INTO permissions(code, module, description) VALUES
 ('approve:remittance', 'remittance', 'Approve or reject a remittance, agency bill, settlement, adjustment or transfer submitted by another user, within the Authority Matrix limit (maker-checker)')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'approve:remittance'
WHERE r.code IN ('system-admin', 'accounting')
ON CONFLICT DO NOTHING;

-- TISPH (roles of migration 0348)
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'approve:remittance'
WHERE r.code IN ('tis-finance', 'tis-general-manager')
  AND EXISTS (SELECT 1 FROM roles t WHERE t.code = 'tis-finance')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('remittance.require_authority_limit', 'false', 'remittance', 'Remittance approvals need an approval limit: a user without a remittance limit in the Authority Matrix cannot approve or reject', 'boolean'),
 ('remittance.item_delegation_enabled', 'true', 'remittance', 'An approver may hand a pending remittance approval to another user', 'boolean')
ON CONFLICT (key) DO NOTHING;
