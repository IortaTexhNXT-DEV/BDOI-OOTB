-- Sample overriding commission agreements (Commission > Insurer Overrides): a quarterly production override on the motor
-- business placed with Pioneer (slab tiers) and an annual profit commission on loss ratio with AXA. Fictional terms for
-- the demo; removed by npm run purge:sample (SAMPLE_MASTERS). Idempotent.
INSERT INTO override_agreements(agreement_code, name, insurance_company_id, commission_type, basis, period_type, premium_measure, tier_method, min_production, vat_applicable, ewt_rate,
  effective_from, status, remarks, created_by)
SELECT v.code, v.name, ic.id, v.ctype, v.basis, v.ptype, 'net_premium', 'slab', v.minp, true, 10, DATE '2025-04-01', 'active', v.remarks, 'seed'
FROM (VALUES
  ('PIONEER-OVR-SAMPLE', 'Pioneer quarterly motor production override (sample)', 'PIONEER', 'overriding', 'production', 'quarterly', 10000::numeric, 'Sample terms: 2% of net premium from PHP 10,000, 3% from PHP 50,000 a quarter'),
  ('AXA-LR-SAMPLE', 'AXA annual profit commission on loss ratio (sample)', 'AXA', 'profit', 'loss_ratio', 'annual', 0::numeric, 'Sample terms: 5% of net premium when the loss ratio is under 40%, 2.5% from 40% to 60%')
) v(code, name, insurer, ctype, basis, ptype, minp, remarks)
JOIN insurance_companies ic ON ic.code = v.insurer
ON CONFLICT (agreement_code) DO NOTHING;

INSERT INTO override_agreement_tiers(agreement_id, tier_no, from_value, to_value, rate)
SELECT a.id, t.tier_no, t.from_value, t.to_value, t.rate FROM override_agreements a JOIN (VALUES
  ('PIONEER-OVR-SAMPLE', 1, 0::numeric, 50000::numeric, 2::numeric),
  ('PIONEER-OVR-SAMPLE', 2, 50000, NULL, 3),
  ('AXA-LR-SAMPLE', 1, 0, 40, 5),
  ('AXA-LR-SAMPLE', 2, 40, 60, 2.5)
) t(code, tier_no, from_value, to_value, rate) ON t.code = a.agreement_code
ON CONFLICT (agreement_id, tier_no) DO NOTHING;
