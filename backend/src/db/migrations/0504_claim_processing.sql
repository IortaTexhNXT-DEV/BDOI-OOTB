-- Claim processing as a maker step (TIS-BRD-CLAIM-05, RBAC v4: Operations Associate and Officer process claims, the
-- Operations Unit Head approves): process:claims moves a claim to review and submits its settlement, partial or
-- final, for approval. Rejection, closing, cancellation, the approval and the release of a settlement stay with
-- approve:claims, which also processes. Granted to the Operations roles of TISPH.
--
-- Idempotent.

INSERT INTO permissions(code, module, description) VALUES
 ('process:claims', 'claims', 'Move a claim to review and submit its settlement for approval')
ON CONFLICT (code) DO NOTHING;

-- Users of the roles that gain the permission get a new token version (the permissions travel in the access token);
-- only on the first run, while no role holds process:claims yet.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head'))
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'process:claims');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'process:claims'
 WHERE r.code IN ('tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'system-admin')
ON CONFLICT DO NOTHING;
