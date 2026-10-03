-- Product classification (migration 0161): package / non-package and the customer segment, Philippine practice.
-- Package: standard tariff or fixed-wording products sold quickly, mostly retail. Non-package: underwritten per risk
-- and placed with insurers through broker, quotation and placement slips, mostly corporate.
-- Only products not classified yet are set, so a classification changed on the Product master is kept.

INSERT INTO products(code, name, line, description) VALUES
 ('TRAVEL', 'Travel Insurance', 'accident', 'Individual and family travel cover (medical, trip cancellation, baggage)'),
 ('HOME', 'Householder Insurance', 'fire', 'Home / householder package: dwelling and contents against fire, typhoon, flood and burglary'),
 ('MICRO', 'Micro-insurance', 'accident', 'Low-premium micro-insurance products (Insurance Commission micro-insurance rules)'),
 ('GPA', 'Group Personal Accident', 'accident', 'Group personal accident package for employees, members or students'),
 ('CAR', 'Contractor''s All Risks', 'engineering', 'Civil works under construction, materials, third party liability'),
 ('EAR', 'Erection All Risks', 'engineering', 'Erection and installation of plant and machinery'),
 ('MB', 'Machinery Breakdown', 'engineering', 'Sudden breakdown of plant and machinery in operation'),
 ('HULL', 'Marine Hull', 'marine', 'Vessels: hull and machinery, protection and indemnity'),
 ('MONEY', 'Money and Securities', 'casualty', 'Cash and securities on premises and in transit')
ON CONFLICT (code) DO NOTHING;

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
