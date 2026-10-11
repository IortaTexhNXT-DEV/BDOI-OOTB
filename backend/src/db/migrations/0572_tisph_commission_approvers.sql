-- Approvers of the telesales incentive and of commission for the TISPH personas (RBAC v4, TIS-BRD-COMM-08, SEC-01;
-- gap register GAP-REMIT-10): the TIS General Manager and the TIS Operations Unit Head approve incentive batches
-- (approve:incentive) beside the Sales Unit Head, so that the batch is never decided by its own maker; the Sales Unit
-- Head keeps the calculation (write:incentive). Idempotent.

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('tis-general-manager', 'tis-ops-unit-head'))
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id JOIN roles r ON r.id = rp.role_id WHERE p.code = 'approve:incentive' AND r.code = 'tis-general-manager');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code IN ('tis-general-manager', 'tis-ops-unit-head') AND p.code IN ('approve:incentive', 'read:incentive')
ON CONFLICT DO NOTHING;
