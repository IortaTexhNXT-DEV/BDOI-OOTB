-- Policies issued from quotations were saved without a product; link them to the product of their line of business
-- (MOTOR, FIRE ...) or product type so reports show and filter the product.
UPDATE policies p SET product_id = pr.id
FROM products pr
WHERE p.product_id IS NULL
  AND pr.id = (SELECT x.id FROM products x WHERE upper(x.code) IN (upper(p.lob), upper(p.product_type)) ORDER BY x.id LIMIT 1);
