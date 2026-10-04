-- Segregation of duties: official receipts (cash posting) and payment verification are finance-only. Sales held
-- write:receipts from the original seed; it keeps read:receipts and records client payments for finance to verify
-- (POST /policies/:id/payments).
DELETE FROM role_permissions rp USING roles r, permissions p
 WHERE rp.role_id = r.id AND rp.permission_id = p.id AND r.code = 'sales' AND p.code = 'write:receipts';
