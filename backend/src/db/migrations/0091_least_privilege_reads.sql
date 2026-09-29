-- Least privilege for API reads:
-- * Claims officers no longer read the lead register. The claim screens get the holder's lead through the policy
--   (GET /policies/:id embeds it), which claims officers can read.
-- * Sales and customer services no longer read the finance receipt register (/receipts, /collections,
--   /policies/payment-captures). Their screens use endpoints that accept read:policies: the policy payment screen
--   (GET /policies/:id/payments), billing statements, receipt PDFs of their policies, open items and accounting
--   entries of a policy.
-- An administrator can grant either permission back under Master > User Management > Role.
DELETE FROM role_permissions rp USING roles r, permissions p
 WHERE rp.role_id = r.id AND rp.permission_id = p.id
   AND ((r.code = 'claims' AND p.code = 'read:leads')
     OR (r.code IN ('sales', 'customer-services') AND p.code = 'read:receipts'));
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('claims', 'sales', 'customer-services'));
