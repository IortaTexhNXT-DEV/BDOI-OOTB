-- TISPH decisions on RBAC v4 (journal vouchers, disbursements, incentive approval; TIS-BRD-COMM-08, SEC-01): journal
-- vouchers and disbursements are Finance work, so the Operations Officer and the Operations Unit Head no longer read
-- journal vouchers and the Operations and Sales Unit Heads no longer read disbursements; telesales incentive batches
-- are approved by the Sales Unit Head and the General Manager only, so the Operations Unit Head loses approve:incentive
-- (given by migration 0572) and keeps reading them as the other Operations personas. Idempotent.

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id
              WHERE (r.code IN ('tis-ops-officer', 'tis-ops-unit-head') AND p.code = 'read:journal-vouchers')
                 OR (r.code IN ('tis-ops-unit-head', 'tis-sales-unit-head') AND p.code = 'read:disbursements')
                 OR (r.code = 'tis-ops-unit-head' AND p.code = 'approve:incentive'));

DELETE FROM role_permissions rp USING roles r, permissions p
 WHERE r.id = rp.role_id AND p.id = rp.permission_id
   AND ((r.code IN ('tis-ops-officer', 'tis-ops-unit-head') AND p.code = 'read:journal-vouchers')
     OR (r.code IN ('tis-ops-unit-head', 'tis-sales-unit-head') AND p.code = 'read:disbursements')
     OR (r.code = 'tis-ops-unit-head' AND p.code = 'approve:incentive'));
