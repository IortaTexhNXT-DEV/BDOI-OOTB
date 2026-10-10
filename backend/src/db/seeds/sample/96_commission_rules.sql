-- Sample commission rules and sharing schemes of the TISPH panel (TIS-BRD-PROD-16, COMM-06): per-peril rules for the
-- Motor policies of Pioneer and Malayan (new business and renewal), a % of net premium for AXA Personal Accident and
-- the Credit Life line, and the schemes EXT-AGENT-STD (the variance of external agents, TFS team members and
-- referrals) and DLR-STD (the dealers' share of the Own Damage and Acts of Nature commission), assigned to the sample
-- referrers and the Toyota dealer group. Illustrative figures. Idempotent: a rule or scheme is added once (remarks
-- 'TISPH sample' / scheme code); an existing record is kept.

INSERT INTO commission_rates(insurance_company_id, product_id, policy_type, motor_type, rate_basis, rate, peril_rates, effective_from, active, approval_status, approved_by, approved_at, remarks, created_by, updated_by)
SELECT ic.id, pr.id, v.policy_type, v.motor_type, 'issuing-remitting', 0, v.rates::jsonb, '2026-01-01', true, 'approved', 'seed', now(), 'TISPH sample', 'seed', 'seed'
FROM (VALUES
  ('PIONEER', 'new', 'PC-OTHER', '[{"peril":"OD","basis":"issuing-remitting","issuing":2,"tisRemitting":1.7,"insurerNet":0.95},{"peril":"AON","basis":"issuing-remitting","issuing":0.5,"tisRemitting":0.4,"insurerNet":0.25},{"peril":"BI","basis":"premium-pct","commissionPct":25},{"peril":"PD","basis":"premium-pct","commissionPct":25},{"peril":"APPA","basis":"premium-pct","commissionPct":25},{"peril":"RSA","basis":"none"}]'),
  ('PIONEER', 'new', 'PC-SEDAN', '[{"peril":"OD","basis":"issuing-remitting","issuing":2,"tisRemitting":1.7,"insurerNet":1.1},{"peril":"AON","basis":"issuing-remitting","issuing":0.5,"tisRemitting":0.4,"insurerNet":0.25},{"peril":"BI","basis":"premium-pct","commissionPct":25},{"peril":"PD","basis":"premium-pct","commissionPct":25},{"peril":"APPA","basis":"premium-pct","commissionPct":25},{"peril":"RSA","basis":"none"}]'),
  ('PIONEER', 'renewal', NULL, '[{"peril":"OD","basis":"issuing-remitting","issuing":2,"tisRemitting":1.7,"insurerNet":1.1},{"peril":"AON","basis":"issuing-remitting","issuing":0.5,"tisRemitting":0.4,"insurerNet":0.25},{"peril":"BI","basis":"premium-pct","commissionPct":25},{"peril":"PD","basis":"premium-pct","commissionPct":25},{"peril":"APPA","basis":"premium-pct","commissionPct":25},{"peril":"RSA","basis":"none"}]'),
  ('MALAYAN', 'new', NULL, '[{"peril":"OD","basis":"issuing-remitting","issuing":2,"tisRemitting":1.7,"insurerNet":0.95},{"peril":"AON","basis":"issuing-remitting","issuing":0.5,"tisRemitting":0.4,"insurerNet":0.25},{"peril":"BI","basis":"premium-pct","commissionPct":25},{"peril":"PD","basis":"premium-pct","commissionPct":25},{"peril":"APPA","basis":"premium-pct","commissionPct":25},{"peril":"RSA","basis":"none"}]'),
  ('MALAYAN', 'renewal', NULL, '[{"peril":"OD","basis":"issuing-remitting","issuing":2,"tisRemitting":1.7,"insurerNet":1.1},{"peril":"AON","basis":"issuing-remitting","issuing":0.5,"tisRemitting":0.4,"insurerNet":0.25},{"peril":"BI","basis":"premium-pct","commissionPct":25},{"peril":"PD","basis":"premium-pct","commissionPct":25},{"peril":"APPA","basis":"premium-pct","commissionPct":25},{"peril":"RSA","basis":"none"}]'),
  ('STANDARD', 'any', NULL, '[{"peril":"OD","basis":"issuing-remitting","issuing":2,"tisRemitting":1.7,"insurerNet":1.3},{"peril":"AON","basis":"issuing-remitting","issuing":0.5,"tisRemitting":0.4,"insurerNet":0.3},{"peril":"BI","basis":"premium-pct","commissionPct":25},{"peril":"PD","basis":"premium-pct","commissionPct":25},{"peril":"APPA","basis":"premium-pct","commissionPct":25},{"peril":"RSA","basis":"none"}]')
  ) AS v(insurer, policy_type, motor_type, rates)
JOIN insurance_companies ic ON ic.code = v.insurer JOIN products pr ON pr.code = 'MOTOR'
WHERE NOT EXISTS (SELECT 1 FROM commission_rates r WHERE r.insurance_company_id = ic.id AND r.product_id = pr.id AND r.policy_type = v.policy_type AND r.motor_type IS NOT DISTINCT FROM v.motor_type AND r.remarks = 'TISPH sample');

INSERT INTO commission_rates(insurance_company_id, product_id, line_of_business, policy_type, rate_basis, rate, effective_from, active, approval_status, approved_by, approved_at, remarks, created_by, updated_by)
SELECT ic.id, pr.id, v.lob, 'any', 'net-premium', v.rate, '2026-01-01', true, 'approved', 'seed', now(), 'TISPH sample', 'seed', 'seed'
FROM (VALUES ('AXA', 'PA', NULL, 0.25), (NULL, NULL, 'life', 0.20), ('AXA', 'MARINE', NULL, 0.03)) AS v(insurer, product, lob, rate)
LEFT JOIN insurance_companies ic ON ic.code = v.insurer LEFT JOIN products pr ON pr.code = v.product
WHERE (v.insurer IS NULL OR ic.id IS NOT NULL) AND (v.product IS NULL OR pr.id IS NOT NULL)
  AND NOT EXISTS (SELECT 1 FROM commission_rates r WHERE r.insurance_company_id IS NOT DISTINCT FROM ic.id AND r.product_id IS NOT DISTINCT FROM pr.id AND r.line_of_business IS NOT DISTINCT FROM v.lob AND r.remarks = 'TISPH sample');

INSERT INTO sharing_schemes(code, name, party_types, product_ids, policy_type, effective_from, lines, status, approved_by, approved_at, remarks, created_by, updated_by)
SELECT v.code, v.name, v.party_types::text[], ARRAY[(SELECT id FROM products WHERE code = 'MOTOR')], 'any', '2026-01-01', v.lines::jsonb, 'active', 'seed', now(), 'TISPH sample', 'seed', 'seed'
FROM (VALUES
  ('EXT-AGENT-STD', 'External agents, TFS team members and referrals', '{Agent,Sub-agent,"TFS team member",Referral,External}',
   '[{"paidTo":"referrer","basis":"variance","perils":["OD","AON"],"defaultValue":0.3,"min":0,"max":0.3,"description":"The variance between the issuing rate and the TIS remitting rate"}]'),
  ('AGT-L1L2', 'Agent hierarchy: sub-agent and parent agent', '{Agent,Sub-agent}',
   '[{"paidTo":"referrer","basis":"variance","perils":["OD","AON"],"defaultValue":0.2,"min":0,"max":0.3},{"paidTo":"parent","basis":"variance","perils":["OD"],"defaultValue":0.1,"min":0,"max":0.1,"addToReferrer":false}]'),
  ('DLR-STD', 'Dealer standard share', '{Dealer,"Affinity partner"}',
   '[{"paidTo":"channel","basis":"commission-pct","perils":["OD","AON"],"defaultValue":40,"min":30,"max":50}]')
  ) AS v(code, name, party_types, lines)
WHERE EXISTS (SELECT 1 FROM products WHERE code = 'MOTOR') AND NOT EXISTS (SELECT 1 FROM sharing_schemes s WHERE upper(s.code) = v.code);

UPDATE commission_referrers SET scheme_code = 'EXT-AGENT-STD' WHERE id IN ('ref-amendoza', 'ref-rbautista', 'ref-pvillanueva') AND scheme_code IS NULL
  AND EXISTS (SELECT 1 FROM sharing_schemes WHERE code = 'EXT-AGENT-STD');
UPDATE commission_referrers SET scheme_code = 'AGT-L1L2' WHERE id IN ('ref-lgarcia', 'ref-mreyes') AND scheme_code IS NULL
  AND EXISTS (SELECT 1 FROM sharing_schemes WHERE code = 'AGT-L1L2');
UPDATE commission_referrers SET referrer_type = 'TFS team member' WHERE id = 'ref-pvillanueva' AND referrer_type = 'Agent';
UPDATE distribution_channels SET scheme_code = 'DLR-STD', scheme_override = 45 WHERE channel_type = 'dealer_group' AND scheme_code IS NULL
  AND EXISTS (SELECT 1 FROM sharing_schemes WHERE code = 'DLR-STD');
