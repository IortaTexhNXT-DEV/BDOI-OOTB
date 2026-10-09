-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true. Packaged products (illustrative rates, verify with the
-- insurers before use): rate tables of the panel insurers for personal accident, group PA, travel and credit life, and
-- the "TFS Borrower Protect" bundle (compulsory credit life of the loan with an optional personal accident cover).
-- Idempotent by code and by insurer / product / effective date. Rate tables of inactive products are inactive.

INSERT INTO insurer_rate_tables(insurance_company_id, product_id, rate_basis, rate, minimum_premium, deductible, deductible_amount, key_benefits, commission_rate, effective_from, active, remarks, created_by)
SELECT ic.id, p.id, v.basis, v.rate, v.minimum, NULL, NULL, v.benefits::jsonb, v.commission, DATE '2026-01-01', p.status = 'active', 'Sample rate', 'seed'
FROM (VALUES
 ('PIONEER', 'PA', 'per_mille', 3.00, 500, '["Accidental death and disablement","Medical reimbursement up to 10% of the sum insured","Burial benefit PHP 10,000"]', 0.25),
 ('AXA', 'PA', 'per_mille', 3.00, 600, '["Accidental death and disablement","Medical reimbursement up to 10% of the sum insured","Murder and assault cover"]', 0.25),
 ('MAAGAP', 'PA', 'per_mille', 2.80, 450, '["Accidental death and disablement","Medical reimbursement up to 5% of the sum insured"]', 0.22),
 ('PIONEER', 'GPA', 'per_mille', 1.75, 5000, '["Accidental death and disablement per member","Medical reimbursement","Burial benefit"]', 0.20),
 ('AXA', 'GPA', 'per_mille', 1.85, 5000, '["Accidental death and disablement per member","24/7 worldwide cover","Murder and assault"]', 0.20),
 ('AXA', 'TRAVEL', 'flat', 2500, 2500, '["Asia annual multi-trip","Medical expenses PHP 3,000,000","Trip cancellation and baggage delay"]', 0.25),
 ('AXA', 'CL-COMP', 'percent', 0.75, 1000, '["Outstanding loan balance on death","Total and permanent disability"]', 0.15),
 ('AXA', 'CL-VOL', 'percent', 0.65, 1000, '["Outstanding loan balance on death","Single premium for the remaining term"]', 0.15)
) AS v(insurer, product, basis, rate, minimum, benefits, commission)
JOIN insurance_companies ic ON ic.code = v.insurer JOIN products p ON p.code = v.product
WHERE NOT EXISTS (SELECT 1 FROM insurer_rate_tables x WHERE x.insurance_company_id = ic.id AND x.product_id = p.id AND x.effective_from = DATE '2026-01-01');

INSERT INTO package_bundles(code, name, description, customer_segment, discount_percent, term_months, auto_issue, status, created_by) VALUES
 ('TFS-BORROWER', 'TFS Borrower Protect', 'Compulsory credit life of the TFS car loan with an optional personal accident cover of the borrower', 'retail', 5, 12, true, 'active', 'seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO package_bundle_sections(bundle_id, section_no, name, product_id, default_sum_insured, rate_percent, minimum_premium, property, optional, insurer_ids, benefits)
SELECT b.id, v.no, v.name, p.id, v.si, v.rate, v.minimum, false, v.optional,
       ARRAY(SELECT ic.id FROM unnest(v.insurers) WITH ORDINALITY AS x(code, ord) JOIN insurance_companies ic ON ic.code = x.code ORDER BY x.ord), v.benefits::jsonb
FROM (VALUES
 ('TFS-BORROWER', 1, 'Credit Life - Compulsory', 'CL-COMP', 1000000, 0.75, 1000, false, ARRAY['AXA'], '["Outstanding loan balance on death"]'),
 ('TFS-BORROWER', 2, 'Personal Accident of the borrower', 'PA', 500000, 0.30, 500, true, ARRAY['PIONEER', 'AXA'], '["Accidental death and disablement","Medical reimbursement"]')
) AS v(bundle, no, name, product, si, rate, minimum, optional, insurers, benefits)
JOIN package_bundles b ON b.code = v.bundle JOIN products p ON p.code = v.product
ON CONFLICT (bundle_id, section_no) DO NOTHING;
