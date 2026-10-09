-- TISPH product catalogue (BRD v2.2: PROD-02, PROD-03, PJRN-01 to PJRN-09). Phase 1 sells three lines of business,
-- Motor, Personal Accident and Credit Life, plus Parcel / Courier for TFS through AXA:
--   Motor              MOTOR (Comprehensive with CTPL, TPL) and CTPL issued direct. Private car, commercial vehicle and
--                      motorcycle are the Insurance Commission vehicle classes of the motor tariff, not separate products;
--                      the policy types stay the cover types the motor quote offers (COMP, TPL).
--   Personal Accident  PA (individual), GPA (group, batch upload), TRAVEL (sold through the insurer's QR page)
--   Credit Life        CL-COMP (compulsory, decreasing term, year 1) and CL-VOL (voluntary group life on renewal), one
--                      master policy per customer off the monthly TFS batch
--   Parcel / Courier   PARCEL (AXA open policy, a certificate per customer, daily declaration)
-- Every other product is deactivated, not deleted: Phase 2 lines (group life, fire and engineering, bonds, liability and
-- miscellaneous) are switched back on in Master > Product when they go live. Their product configurator templates and
-- risk mappings, package bundles and insurer rate tables are deactivated with them. The reference seed files carry the
-- same catalogue for a new installation.

-- 1. Line of business of Credit Life (Group Life sits under it: mortgage- and loan-linked life cover).
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'line-of-business', 'LIFE', 'Credit Life',
       '{"lineofBusinessCode":"LIFE","LOBName":"Credit Life","LOBDescription":"Credit life on TFS motor loans (compulsory decreasing term, voluntary group life) and group life"}'::jsonb,
       'active', 'migration'
 WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'line-of-business')
   AND NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'line-of-business' AND code = 'LIFE');

-- The accident line is named as the BRD names it (an administrator's own name is kept).
UPDATE master_records SET name = 'Personal Accident', data = data || '{"LOBName":"Personal Accident"}'::jsonb, updated_by = 'migration', updated_at = now()
 WHERE type_code = 'line-of-business' AND code = 'ACCIDENT' AND name = 'Accident';

-- Covers (Cover master) can be limited to the new line.
UPDATE master_types
   SET fields = (SELECT jsonb_agg(CASE WHEN f->>'name' = 'linesOfBusiness' THEN jsonb_set(f, '{options}', (f->'options') || '["life"]'::jsonb) ELSE f END ORDER BY ord)
                   FROM jsonb_array_elements(fields) WITH ORDINALITY AS x(f, ord)),
       updated_at = now()
 WHERE code = 'cover' AND fields @> '[{"name":"linesOfBusiness"}]'::jsonb AND NOT fields @> '[{"name":"linesOfBusiness","options":["life"]}]'::jsonb;

-- 2. Insurer panel: Pioneer is on the starter list; Maagap and AXA are added (the fourth insurer is named by TISPH).
-- Steps 2 to 4 apply to a database already seeded; a new database gets the same rows from the reference seeds, after
-- the starter rows.
INSERT INTO insurance_companies(code, name, short_name, status)
SELECT v.code, v.name, v.short, 'active' FROM (VALUES
 ('MAAGAP', 'Maagap Insurance, Inc.', 'Maagap'),
 ('AXA', 'AXA Philippines', 'AXA')) AS v(code, name, short)
WHERE EXISTS (SELECT 1 FROM insurance_companies WHERE code = 'PIONEER')
ON CONFLICT (code) DO NOTHING;

-- 3. The Credit Life and Parcel / Courier products. Credit life premiums bear the premium tax instead of VAT.
INSERT INTO products(code, name, line, description, business_type, customer_segment, premium_tax_regime)
SELECT v.* FROM (VALUES
 ('CL-COMP', 'Credit Life - Compulsory', 'life', 'Compulsory decreasing-term credit life on TFS motor loans: year-1 cover of the borrower, one master policy per customer', 'package', 'retail', 'premium_tax'),
 ('CL-VOL', 'Credit Life - Voluntary', 'life', 'Voluntary group credit life replacing the compulsory cover on renewal, quoted per customer', 'package', 'retail', 'premium_tax'),
 ('PARCEL', 'Parcel / Courier Insurance', 'marine', 'Parcels and courier shipments of TFS customers: certificate per customer under the AXA open policy with daily declarations', 'package', 'retail', 'vat')
) AS v(code, name, line, description, business_type, customer_segment, premium_tax_regime)
WHERE EXISTS (SELECT 1 FROM products WHERE code = 'MOTOR')
ON CONFLICT (code) DO NOTHING;

-- 4. Travel policy types (PJRN-07). Group PA is the GPA product, so the group policy type of PA is retired.
INSERT INTO policy_types(product_id, code, name)
SELECT p.id, v.code, v.name FROM (VALUES ('TRV-ST', 'Short-term'), ('TRV-ANN', 'Annual'), ('TRV-REN', 'Renewable')) AS v(code, name)
JOIN products p ON p.code = 'TRAVEL'
WHERE NOT EXISTS (SELECT 1 FROM policy_types t WHERE t.code = v.code);

-- 5. Products outside the TISPH catalogue, their policy types, and the motor Own Damage / Theft and PA group types.
UPDATE products SET status = 'inactive'
 WHERE status = 'active' AND code NOT IN ('MOTOR', 'CTPL', 'PA', 'GPA', 'TRAVEL', 'CL-COMP', 'CL-VOL', 'PARCEL');

UPDATE policy_types t SET status = 'inactive'
  FROM products p
 WHERE p.id = t.product_id AND t.status = 'active' AND (p.status <> 'active' OR t.code IN ('ODTH', 'PA-GRP'));

-- 6. Lines of business outside Phase 1 (Marine stays for Parcel / Courier).
UPDATE master_records SET status = 'inactive', updated_by = 'migration', updated_at = now()
 WHERE type_code = 'line-of-business' AND status = 'active' AND code IN ('FIRE', 'CASUALTY', 'EB', 'ENGINEERING');

-- 7. Product Configurator: templates of the inactive products and the risk mappings of their lines.
UPDATE product_templates t SET status = 'Inactive', updated_by = 'migration', updated_at = now()
  FROM products p
 WHERE p.id = t.product_id AND p.status <> 'active' AND t.status = 'Active';

UPDATE product_risk_mappings SET status = 'Inactive', updated_by = 'migration', updated_at = now()
 WHERE status = 'Active' AND upper(lob_code) IN ('FIRE', 'IAR', 'PROPERTY', 'HEALTH');

-- 8. Package bundles with a section of an inactive product, and the insurer rate tables of inactive products.
UPDATE package_bundles b SET status = 'inactive', updated_by = 'migration'
 WHERE b.status = 'active'
   AND EXISTS (SELECT 1 FROM package_bundle_sections s JOIN products p ON p.id = s.product_id WHERE s.bundle_id = b.id AND p.status <> 'active');

UPDATE insurer_rate_tables r SET active = false, updated_by = 'migration'
  FROM products p
 WHERE p.id = r.product_id AND p.status <> 'active' AND r.active;

-- 9. Compare Insurers is withdrawn (insurers are compared on the Request for Quotation and the Comparison Reports).
UPDATE app_settings SET label = 'Insurers approached on a Request for Quotation must be on the product''s insurer market (Product Configurator > Market Mapping); a product whose templates name no insurer is open to every insurer'
 WHERE key = 'product.market_panel_enforced' AND label LIKE '%Compare Insurers%';
UPDATE app_settings SET label = 'Note printed on the package quotation and policy schedule given to the client'
 WHERE key = 'packages.comparison_disclaimer' AND label = 'Note printed on the insurer comparison given to the client';
