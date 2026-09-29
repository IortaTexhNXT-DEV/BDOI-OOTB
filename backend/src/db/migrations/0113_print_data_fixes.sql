-- Data seen on printed documents:
--  * Industrial All Risks had no policy type (sample quotations carried "2009"): IAR-STD "Standard" for the IAR product.
--  * Sample quotations with that placeholder get the new type.
--  * Sample invoices of the claims / renewals data were dated on the seeding day, after their due date: the bill date is
--    the policy inception date (the due date is inception + 30 days).
INSERT INTO policy_types(product_id, code, name)
SELECT p.id, 'IAR-STD', 'Standard' FROM products p
WHERE p.code = 'IAR' AND NOT EXISTS (SELECT 1 FROM policy_types t WHERE t.code = 'IAR-STD');

UPDATE quotes SET doc = jsonb_set(doc, '{insurancePolicyType}', '"IAR-STD"'), updated_at = now()
WHERE id IN ('qt_sls_06', 'qt_sls_14') AND doc->>'insurancePolicyType' = '2009';

UPDATE receivables r SET created_at = p.inception_date::timestamptz
FROM policies p
WHERE r.policy_id = p.id AND r.id LIKE 'rcv\_crs\_%' AND r.created_at::date > r.due_date AND p.inception_date IS NOT NULL;
