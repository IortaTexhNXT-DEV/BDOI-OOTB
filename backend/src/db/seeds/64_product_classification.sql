-- Product classification (migration 0161): package / non-package and the customer segment, Philippine practice.
-- Package: standard tariff or fixed-wording products sold quickly, mostly retail. Non-package: underwritten per risk
-- and placed with insurers through broker, quotation and placement slips, mostly corporate.
-- Only products not classified yet are set, so a classification changed on the Product master is kept.

-- TISPH catalogue (migration 0341): travel and group PA are sold; the other products are created inactive.
INSERT INTO products(code, name, line, description, status) VALUES
 ('TRAVEL', 'Travel Insurance', 'accident', 'Individual and family travel cover (medical, trip cancellation, baggage)', 'active'),
 ('HOME', 'Householder Insurance', 'fire', 'Home / householder package: dwelling and contents against fire, typhoon, flood and burglary', 'inactive'),
 ('MICRO', 'Micro-insurance', 'accident', 'Low-premium micro-insurance products (Insurance Commission micro-insurance rules)', 'inactive'),
 ('GPA', 'Group Personal Accident', 'accident', 'Group personal accident package for employees, members or students', 'active'),
 ('CAR', 'Contractor''s All Risks', 'engineering', 'Civil works under construction, materials, third party liability', 'inactive'),
 ('EAR', 'Erection All Risks', 'engineering', 'Erection and installation of plant and machinery', 'inactive'),
 ('MB', 'Machinery Breakdown', 'engineering', 'Sudden breakdown of plant and machinery in operation', 'inactive'),
 ('HULL', 'Marine Hull', 'marine', 'Vessels: hull and machinery, protection and indemnity', 'inactive'),
 ('MONEY', 'Money and Securities', 'casualty', 'Cash and securities on premises and in transit', 'inactive')
ON CONFLICT (code) DO NOTHING;

-- Credit Life (premium tax instead of VAT) and Parcel / Courier (AXA open policy), as migration 0341 adds them.
INSERT INTO products(code, name, line, description, business_type, customer_segment, premium_tax_regime) VALUES
 ('CL-COMP', 'Credit Life - Compulsory', 'life', 'Compulsory decreasing-term credit life on TFS motor loans: year-1 cover of the borrower, one master policy per customer', 'package', 'retail', 'premium_tax'),
 ('CL-VOL', 'Credit Life - Voluntary', 'life', 'Voluntary group credit life replacing the compulsory cover on renewal, quoted per customer', 'package', 'retail', 'premium_tax'),
 ('PARCEL', 'Parcel / Courier Insurance', 'marine', 'Parcels and courier shipments of TFS customers: certificate per customer under the AXA open policy with daily declarations', 'package', 'retail', 'vat')
ON CONFLICT (code) DO NOTHING;

INSERT INTO policy_types(product_id, code, name)
SELECT p.id, v.code, v.name FROM (VALUES ('TRV-ST', 'Short-term'), ('TRV-ANN', 'Annual'), ('TRV-REN', 'Renewable')) AS v(code, name)
JOIN products p ON p.code = 'TRAVEL'
WHERE NOT EXISTS (SELECT 1 FROM policy_types t WHERE t.code = v.code);

UPDATE products p SET business_type = v.business_type, customer_segment = v.segment
FROM (VALUES
 ('MOTOR', 'package', 'retail'), ('CTPL', 'package', 'retail'), ('PA', 'package', 'retail'), ('TRAVEL', 'package', 'retail'),
 ('HOME', 'package', 'retail'), ('MICRO', 'package', 'retail'), ('GPA', 'package', 'both'),
 ('FIRE', 'non_package', 'corporate'), ('IAR', 'non_package', 'corporate'), ('CAR', 'non_package', 'corporate'),
 ('EAR', 'non_package', 'corporate'), ('MB', 'non_package', 'corporate'), ('MARINE', 'non_package', 'corporate'),
 ('HULL', 'non_package', 'corporate'), ('CGL', 'non_package', 'corporate'), ('BOND', 'non_package', 'corporate'),
 ('MONEY', 'non_package', 'corporate'), ('EB', 'non_package', 'corporate')) AS v(code, business_type, segment)
WHERE p.code = v.code AND p.business_type IS NULL;

-- Product master screen fields (databases created before the fields were part of the definition in 51_masters.sql).
UPDATE master_types SET fields = fields || $j$[{"name":"businessType","label":"Business Type","type":"select","required":true,"options":["package","non_package"],"column":"business_type"}]$j$::jsonb
WHERE code = 'product' AND NOT fields @> '[{"name":"businessType"}]'::jsonb;
UPDATE master_types SET fields = fields || $j$[{"name":"customerSegment","label":"Customer Segment","type":"select","required":true,"options":["retail","corporate","both"],"column":"customer_segment"}]$j$::jsonb
WHERE code = 'product' AND NOT fields @> '[{"name":"customerSegment"}]'::jsonb;
