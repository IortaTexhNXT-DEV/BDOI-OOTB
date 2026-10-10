-- Approval of incentive calculation batches (Accounts > Incentive > Approvals) as a permission of its own, apart from
-- calculating them (write:incentive): approve:incentive approves or rejects a batch created and submitted by another
-- user (maker-checker in the service). Every role that could approve until now (the holders of write:incentive:
-- Accounting, the TIS Sales Unit Head, the System Administrator and any role an administrator gave it) keeps the
-- approval; an administrator can now take it away from the makers.
--
-- The optional remarks given with an approval are kept on the batch (approval_remarks), as the rejection reason is.
-- Idempotent.

INSERT INTO permissions(code, module, description) VALUES
 ('approve:incentive', 'incentive', 'Approve or reject an incentive calculation batch created and submitted by another user (maker-checker)')
ON CONFLICT (code) DO NOTHING;

-- Users of the roles that gain the permission get a new token version (the permissions travel in the access token);
-- only on the first run, while no role holds approve:incentive yet.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
               WHERE p.code = 'write:incentive')
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'approve:incentive');

INSERT INTO role_permissions(role_id, permission_id)
SELECT rp.role_id, a.id FROM role_permissions rp JOIN permissions w ON w.id = rp.permission_id, permissions a
 WHERE w.code = 'write:incentive' AND a.code = 'approve:incentive'
ON CONFLICT DO NOTHING;

ALTER TABLE incentive_calculations ADD COLUMN IF NOT EXISTS approval_remarks text;
COMMENT ON COLUMN incentive_calculations.approval_remarks IS 'Remarks given with the approval of the batch (optional)';
