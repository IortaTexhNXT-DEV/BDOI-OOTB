-- Product Configurator templates name their line of business by the Line of Business master code (MOTOR, FIRE, EB...)
-- instead of free text ("Motor Vehicle", "Fire & Allied Perils"), and the product by a row of the products table, so the
-- codes match the rest of the system. The template form picks both from the masters; the API accepts a code or a name
-- and stores the code. Existing templates take the line of their product, else the master entry of the same code or
-- name; a value that matches nothing is left as it is (shown until the template is edited).
UPDATE product_templates t SET line_of_business = lob.code, updated_at = now()
FROM products p, master_records lob
WHERE p.id = t.product_id AND lob.type_code = 'line-of-business' AND lob.status = 'active' AND lob.code = upper(p.line)
  AND t.line_of_business IS DISTINCT FROM lob.code;

UPDATE product_templates t SET line_of_business = lob.code, updated_at = now()
FROM master_records lob
WHERE lob.type_code = 'line-of-business' AND lob.status = 'active' AND t.line_of_business IS DISTINCT FROM lob.code
  AND (lower(lob.code) = lower(t.line_of_business) OR lower(lob.name) = lower(t.line_of_business))
  AND NOT EXISTS (SELECT 1 FROM master_records x WHERE x.type_code = 'line-of-business' AND x.code = t.line_of_business);
