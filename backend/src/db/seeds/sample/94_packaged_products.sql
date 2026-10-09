-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true. Packaged products (illustrative rates, verify with the
-- insurers before use): insurer rate tables for the householder, personal accident and burglary products, and two
-- bundles, "SME Shield" (Fire + CGL + Burglary) and "Home Protect" (Householder fire + PA + optional Burglary).
-- Idempotent by code and by insurer / product / effective date. Rate tables of inactive products are inactive.

INSERT INTO insurer_rate_tables(insurance_company_id, product_id, rate_basis, rate, minimum_premium, deductible, deductible_amount, key_benefits, commission_rate, effective_from, active, remarks, created_by)
SELECT ic.id, p.id, v.basis, v.rate, v.minimum, v.deductible, v.ded_amount, v.benefits::jsonb, v.commission, DATE '2026-01-01', p.status = 'active', 'Sample rate', 'seed'
FROM (VALUES
 ('MALAYAN', 'HOME', 'percent', 0.25, 1500, 'PHP 2,500 each and every loss', 2500, '["Fire and lightning","Typhoon, flood and windstorm","Earthquake fire and shock","Riot, strike and malicious damage","Temporary living expenses up to PHP 30,000"]', 0.20),
 ('STANDARD', 'HOME', 'percent', 0.22, 1800, 'PHP 5,000 each and every loss', 5000, '["Fire and lightning","Typhoon and flood","Burst pipes and water damage"]', 0.18),
 ('PIONEER', 'HOME', 'percent', 0.28, 1200, 'PHP 2,000 each and every loss', 2000, '["Fire and lightning","Typhoon, flood and windstorm","Earthquake fire and shock","Personal liability up to PHP 100,000"]', 0.20),
 ('MAPFRE', 'HOME', 'percent', 0.20, 2000, '1% of the loss, minimum PHP 5,000', 5000, '["Fire and lightning","Typhoon and flood"]', 0.15),
 ('PIONEER', 'PA', 'per_mille', 3.00, 500, NULL, NULL, '["Accidental death and disablement","Medical reimbursement up to 10% of the sum insured","Burial benefit PHP 10,000"]', 0.25),
 ('MAPFRE', 'PA', 'per_mille', 2.50, 600, NULL, NULL, '["Accidental death and disablement","Medical reimbursement up to 5% of the sum insured"]', 0.22),
 ('FPG', 'PA', 'per_mille', 2.80, 450, NULL, NULL, '["Accidental death and disablement","Murder and assault cover","Medical reimbursement up to 10% of the sum insured"]', 0.25),
 ('FPG', 'BURGLARY', 'percent', 0.50, 750, 'PHP 1,000 each and every loss', 1000, '["Burglary and robbery of contents","Damage to doors and windows from forced entry"]', 0.25),
 ('MALAYAN', 'BURGLARY', 'percent', 0.55, 800, 'PHP 2,000 each and every loss', 2000, '["Burglary and robbery of contents"]', 0.22)
) AS v(insurer, product, basis, rate, minimum, deductible, ded_amount, benefits, commission)
JOIN insurance_companies ic ON ic.code = v.insurer JOIN products p ON p.code = v.product
WHERE NOT EXISTS (SELECT 1 FROM insurer_rate_tables x WHERE x.insurance_company_id = ic.id AND x.product_id = p.id AND x.effective_from = DATE '2026-01-01');

-- Both bundles carry products outside the TISPH catalogue (migration 0341): they are created inactive.
INSERT INTO package_bundles(code, name, description, customer_segment, discount_percent, term_months, auto_issue, status, created_by) VALUES
 ('SME-SHIELD', 'SME Shield', 'Property, liability and burglary cover for small shops, offices and restaurants', 'sme', 10, 12, true, 'inactive', 'seed'),
 ('HOME-PROTECT', 'Home Protect', 'Householder fire, personal accident of the head of the family and optional burglary', 'retail', 5, 12, true, 'inactive', 'seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO package_bundle_sections(bundle_id, section_no, name, product_id, default_sum_insured, rate_percent, minimum_premium, property, optional, insurer_ids, benefits)
SELECT b.id, v.no, v.name, p.id, v.si, v.rate, v.minimum, v.property, v.optional,
       ARRAY(SELECT ic.id FROM unnest(v.insurers) WITH ORDINALITY AS x(code, ord) JOIN insurance_companies ic ON ic.code = x.code ORDER BY x.ord), v.benefits::jsonb
FROM (VALUES
 ('SME-SHIELD', 1, 'Fire and Allied Perils', 'FIRE', 2000000, 0.20, 2000, true, false, ARRAY['MALAYAN', 'PIONEER'], '["Building, stock and equipment","Typhoon and flood"]'),
 ('SME-SHIELD', 2, 'Comprehensive General Liability', 'CGL', 1000000, 0.15, 1500, false, false, ARRAY['PIONEER', 'MAPFRE'], '["Third-party bodily injury and property damage on the premises"]'),
 ('SME-SHIELD', 3, 'Burglary and Robbery', 'BURGLARY', 200000, 0.50, 750, false, false, ARRAY['FPG', 'MALAYAN'], '["Stock and cash in locked safe"]'),
 ('HOME-PROTECT', 1, 'Householder Fire', 'HOME', 1500000, 0.15, 1000, true, false, ARRAY['MALAYAN', 'STANDARD'], '["House and contents"]'),
 ('HOME-PROTECT', 2, 'Personal Accident', 'PA', 500000, 0.30, 500, false, false, ARRAY['PIONEER', 'MAPFRE'], '["Head of the family"]'),
 ('HOME-PROTECT', 3, 'Burglary', 'BURGLARY', 100000, 0.60, 500, false, true, ARRAY['FPG'], '["Household contents"]')
) AS v(bundle, no, name, product, si, rate, minimum, property, optional, insurers, benefits)
JOIN package_bundles b ON b.code = v.bundle JOIN products p ON p.code = v.product
ON CONFLICT (bundle_id, section_no) DO NOTHING;
