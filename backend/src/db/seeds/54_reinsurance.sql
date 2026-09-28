-- Reinsurance sample data: reinsurers, treaties, cessions from seeded policies, recoveries, bordereaux, reconciliation.
INSERT INTO reinsurers(id, name, short_name, type, country, rating, rating_agency, capacity, contact, status, created_by) VALUES
 ('RE001', 'National Reinsurance Corporation of the Philippines', 'Nat Re', 'Local', 'Philippines', 'A-', 'AM Best', 'PHP 5 Billion', '{"email":"treaty@natre.example","phone":"+63 2 8988 7400","address":"Makati City, Metro Manila"}', 'Active', 'seed'),
 ('RE002', 'Swiss Re Asia Pte Ltd', 'Swiss Re', 'International', 'Switzerland', 'AA-', 'S&P', 'USD 10 Billion', '{"email":"asia.treaty@swissre.example","phone":"+65 6532 2161","address":"Singapore"}', 'Active', 'seed'),
 ('RE003', 'Munich Re Singapore Branch', 'Munich Re', 'International', 'Germany', 'AA-', 'S&P', 'USD 8 Billion', '{"email":"singapore@munichre.example","phone":"+65 6318 9700","address":"Singapore"}', 'Active', 'seed'),
 ('RE004', 'General Reinsurance AG Manila Office', 'Gen Re', 'International', 'Germany', 'AA+', 'S&P', 'USD 6 Billion', '{"email":"manila@genre.example","phone":"+63 2 8845 1234","address":"BGC, Taguig City"}', 'Active', 'seed'),
 ('RE005', 'Asian Reinsurance Corporation', 'Asian Re', 'Regional', 'Thailand', 'BBB+', 'AM Best', 'USD 500 Million', '{"email":"treaty@asianre.example","phone":"+66 2 665 7000","address":"Bangkok, Thailand"}', 'Active', 'seed'),
 ('RE006', 'Pacific Harbour Reinsurance Berhad', 'Pacific Harbour Re', 'Regional', 'Malaysia', 'A', 'AM Best', 'USD 900 Million', '{"email":"treaty@pacificharbour.example","phone":"+60 3 2711 0000","address":"Kuala Lumpur, Malaysia"}', 'Active', 'seed')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  admin_id text := (SELECT id FROM users WHERE username = 'BrokerVerse');
  checker_id text := (SELECT id FROM users WHERE username = 'fin.approver');
  cur text := COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'currency.default'), 'PHP');
  t_motor int; t_fire int; t_surplus int;
BEGIN
  IF EXISTS (SELECT 1 FROM reinsurance_treaties WHERE treaty_number = 'QS-MOTOR-2026') OR admin_id IS NULL THEN RETURN; END IF;

  INSERT INTO reinsurance_treaties(name, reinsurer, security_rating, treaty_type, capacity, share, period_from, period_to, status, treaty_number, line_of_business, reinsurer_ids, terms, currency,
                                   retention, commission_rate, created_by, updated_by, submitted_by, approved_by, approved_at)
  VALUES
   ('Motor Quota Share Treaty 2026', 'National Reinsurance Corporation of the Philippines, Swiss Re Asia Pte Ltd', 'A-', 'Quota Share', 50000000, 0.40, '2026-01-01', '2026-12-31', 'Active', 'QS-MOTOR-2026', 'Motor', '["RE001","RE002"]',
    '{"cession":{"percentage":40,"maxLimit":50000000,"retention":30000000},"commission":{"type":"Sliding Scale","rate":32.5,"rates":[{"lossRatio":"0-50%","commission":"35%"},{"lossRatio":"50-60%","commission":"32.5%"},{"lossRatio":"60-70%","commission":"30%"},{"lossRatio":"70%+","commission":"27.5%"}]}}',
    cur, 30000000, 32.5, admin_id, admin_id, admin_id, checker_id, TIMESTAMPTZ '2025-12-15 10:00+08'),
   ('Property Surplus Treaty 2026', 'Swiss Re Asia Pte Ltd, Munich Re Singapore Branch, General Reinsurance AG Manila Office', 'AA-', 'Surplus', 500000000, NULL, '2026-01-01', '2026-12-31', 'Active', 'SURPLUS-PROP-2026', 'Property', '["RE002","RE003","RE004"]',
    '{"lines":8,"retention":10000000,"commission":{"type":"Flat","rate":30}}', cur, 10000000, 30, admin_id, admin_id, admin_id, checker_id, TIMESTAMPTZ '2025-12-15 10:30+08'),
   ('Catastrophe Excess of Loss 2026', 'Swiss Re Asia Pte Ltd, Munich Re Singapore Branch', 'AA-', 'Excess of Loss', 1500000000, NULL, '2026-01-01', '2026-12-31', 'Active', 'CAT-XOL-2026', 'Catastrophe', '["RE002","RE003"]',
    '{"layers":[{"layer":1,"limit":500000000,"excess":100000000,"rate":3.5,"reinstatements":2},{"layer":2,"limit":1000000000,"excess":600000000,"rate":2.8,"reinstatements":1}],"events":["Typhoon","Earthquake","Flood"],"premium":45000000}',
    cur, 100000000, NULL, admin_id, admin_id, admin_id, checker_id, TIMESTAMPTZ '2025-12-16 09:00+08'),
   ('Aggregate Stop Loss Treaty 2026', 'National Reinsurance Corporation of the Philippines, Pacific Harbour Reinsurance Berhad', 'A-', 'Stop Loss', NULL, NULL, '2026-01-01', '2026-12-31', 'Active', 'STOP-LOSS-2026', 'All Lines', '["RE001","RE006"]',
    '{"trigger":{"type":"Loss Ratio","threshold":"75%","limit":"90%","coverage":"90% of excess"},"premium":25000000}', cur, NULL, NULL, admin_id, admin_id, admin_id, checker_id, TIMESTAMPTZ '2025-12-16 09:30+08'),
   ('Fire Quota Share Treaty 2026', 'National Reinsurance Corporation of the Philippines', 'A-', 'Quota Share', 100000000, 0.50, '2026-01-01', '2026-12-31', 'Active', 'QS-FIRE-2026', 'Fire', '["RE001"]',
    '{"cession":{"percentage":50,"maxLimit":100000000,"retention":100000000},"commission":{"type":"Flat","rate":32.5}}', cur, 100000000, 32.5, admin_id, admin_id, admin_id, checker_id, TIMESTAMPTZ '2025-12-17 11:00+08'),
   ('Marine Cargo Quota Share 2027', 'Munich Re Singapore Branch, Pacific Harbour Reinsurance Berhad', 'A', 'Quota Share', 60000000, 0.35, '2027-01-01', '2027-12-31', 'Pending Approval', 'QS-MARINE-2027', 'Marine', '["RE003","RE006"]',
    '{"cession":{"percentage":35,"maxLimit":60000000},"commission":{"type":"Flat","rate":27.5}}', cur, NULL, 27.5, admin_id, admin_id, admin_id, NULL, NULL);

  t_motor := (SELECT id FROM reinsurance_treaties WHERE treaty_number = 'QS-MOTOR-2026');
  t_fire := (SELECT id FROM reinsurance_treaties WHERE treaty_number = 'QS-FIRE-2026');
  t_surplus := (SELECT id FROM reinsurance_treaties WHERE treaty_number = 'SURPLUS-PROP-2026');

  -- Motor quota share: 2026 motor policies at 40%, 32.5% commission.
  INSERT INTO cessions(treaty_id, policy_id, ceded_sum, ceded_premium, cession_number, policy_number, insured, line_of_business, cession_type, gross_premium, sum_insured, cession_percentage,
                       commission, net_premium, cession_date, status, created_by, confirmed_by, confirmed_at)
  SELECT t_motor, p.id, round(p.sum_insured * 0.40, 2), round(p.premium_total * 0.40, 2), next_number('cession', numbering_prefix('cession', 'CES')), p.policy_number, c.display_name, 'Motor', 'Treaty',
         p.premium_total, p.sum_insured, 40, round(p.premium_total * 0.40 * 0.325, 2), round(p.premium_total * 0.40, 2) - round(p.premium_total * 0.40 * 0.325, 2), p.inception_date,
         CASE WHEN p.inception_date >= DATE '2026-08-01' THEN 'Pending' ELSE 'Confirmed' END, admin_id,
         CASE WHEN p.inception_date >= DATE '2026-08-01' THEN NULL ELSE checker_id END, CASE WHEN p.inception_date >= DATE '2026-08-01' THEN NULL ELSE p.inception_date + 2 END
  FROM policies p JOIN products pr ON pr.id = p.product_id LEFT JOIN clients c ON c.id = p.client_id
  WHERE pr.line = 'motor' AND p.status = 'active' AND p.sum_insured > 0 AND p.inception_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31' ORDER BY p.inception_date;

  -- Fire quota share (50%) for mid-size fire risks; property surplus for the largest (retention 10M, 8 lines).
  INSERT INTO cessions(treaty_id, policy_id, ceded_sum, ceded_premium, cession_number, policy_number, insured, line_of_business, cession_type, gross_premium, sum_insured, cession_percentage,
                       commission, net_premium, cession_date, status, created_by, confirmed_by, confirmed_at)
  SELECT CASE WHEN p.sum_insured > 50000000 THEN t_surplus ELSE t_fire END, p.id,
         CASE WHEN p.sum_insured > 50000000 THEN LEAST(p.sum_insured - 10000000, 80000000) ELSE round(p.sum_insured * 0.5, 2) END,
         round(p.premium_total * CASE WHEN p.sum_insured > 50000000 THEN LEAST(p.sum_insured - 10000000, 80000000) / p.sum_insured ELSE 0.5 END, 2),
         next_number('cession', numbering_prefix('cession', 'CES')), p.policy_number, c.display_name, CASE WHEN p.sum_insured > 50000000 THEN 'Property' ELSE 'Fire' END, 'Treaty', p.premium_total, p.sum_insured,
         round(CASE WHEN p.sum_insured > 50000000 THEN LEAST(p.sum_insured - 10000000, 80000000) / p.sum_insured * 100 ELSE 50 END, 2),
         round(p.premium_total * CASE WHEN p.sum_insured > 50000000 THEN LEAST(p.sum_insured - 10000000, 80000000) / p.sum_insured * 0.30 ELSE 0.5 * 0.325 END, 2), 0, p.inception_date,
         CASE WHEN p.inception_date >= DATE '2026-09-01' THEN 'Pending' ELSE 'Confirmed' END, admin_id,
         CASE WHEN p.inception_date >= DATE '2026-09-01' THEN NULL ELSE checker_id END, CASE WHEN p.inception_date >= DATE '2026-09-01' THEN NULL ELSE p.inception_date + 3 END
  FROM policies p JOIN products pr ON pr.id = p.product_id LEFT JOIN clients c ON c.id = p.client_id
  WHERE pr.line = 'fire' AND p.status = 'active' AND p.sum_insured >= 5000000 AND p.inception_date BETWEEN DATE '2026-01-01' AND DATE '2026-12-31';
  UPDATE cessions SET net_premium = ceded_premium - commission WHERE net_premium = 0 AND ceded_premium > 0;

  -- Facultative marine cession awaiting confirmation.
  INSERT INTO cessions(treaty_id, policy_id, ceded_sum, ceded_premium, cession_number, policy_number, insured, line_of_business, cession_type, facultative_reinsurer_id, gross_premium, sum_insured,
                       cession_percentage, commission, net_premium, cession_date, status, notes, created_by)
  SELECT NULL, p.id, round(p.sum_insured * 0.8, 2), round(p.premium_total * 0.8, 2), next_number('cession', numbering_prefix('cession', 'CES')), p.policy_number, c.display_name, 'Marine', 'Facultative', 'RE003',
         p.premium_total, p.sum_insured, 80, round(p.premium_total * 0.8 * 0.25, 2), round(p.premium_total * 0.8, 2) - round(p.premium_total * 0.8 * 0.25, 2), current_date - 3, 'Pending',
         'High value cargo - awaiting reinsurer confirmation', admin_id
  FROM policies p JOIN products pr ON pr.id = p.product_id LEFT JOIN clients c ON c.id = p.client_id WHERE pr.line = 'marine' AND p.status = 'active' LIMIT 1;

  -- Recoveries on claims of ceded motor policies.
  INSERT INTO reinsurance_recoveries(recovery_number, claim_id, claim_number, policy_number, insured, treaty_id, cession_id, date_of_loss, cause_of_loss, gross_claim, cession_percentage,
                                     recoverable_amount, settlement_amount, status, submission_date, recovery_date, expected_settlement, documents, created_by, updated_by)
  SELECT next_number('ri_recovery', numbering_prefix('ri_recovery', 'RCL')), cl.id, cl.claim_number, s.policy_number, s.insured, s.treaty_id, s.id, cl.loss_date, COALESCE(cl.loss_type, 'Collision'),
         COALESCE(cl.approved_amount, cl.estimate_amount), s.cession_percentage, round(COALESCE(cl.approved_amount, cl.estimate_amount) * s.cession_percentage / 100, 2),
         CASE WHEN cl.status IN ('settled', 'closed') THEN round(COALESCE(cl.approved_amount, cl.estimate_amount) * s.cession_percentage / 100, 2) END,
         CASE WHEN cl.status IN ('settled', 'closed') THEN 'Recovered' WHEN cl.status = 'in-review' THEN 'Processing' ELSE 'Pending' END,
         CASE WHEN cl.status IN ('settled', 'closed', 'in-review') THEN cl.loss_date + 10 END, CASE WHEN cl.status IN ('settled', 'closed') THEN cl.loss_date + 45 END,
         CASE WHEN cl.status NOT IN ('settled', 'closed') THEN current_date + 30 END, '["Loss Report","Police Report","Repair Estimate"]', admin_id, admin_id
  FROM claims cl JOIN cessions s ON s.policy_id = cl.policy_id AND s.status = 'Confirmed'
  WHERE cl.status NOT IN ('rejected', 'withdrawn');

  -- Premium bordereau for May 2026 (submitted) and a claims bordereau (confirmed).
  INSERT INTO reinsurance_bordereaux(reference, type, period, treaty_id, reinsurer_id, entries, totals, status, submission_date, due_date, created_by, updated_by)
  SELECT next_number('bordereau', numbering_prefix('bordereau', 'BDX')), 'Premium', '2026-05', NULL, 'RE001', count(*),
         jsonb_build_object('grossPremium', sum(gross_premium), 'cededPremium', sum(ceded_premium), 'commission', sum(commission), 'netAmount', sum(ceded_premium - commission)),
         'Submitted', DATE '2026-06-05', DATE '2026-06-30', admin_id, admin_id
  FROM cessions WHERE status = 'Confirmed' AND to_char(cession_date, 'YYYY-MM') = '2026-05' HAVING count(*) > 0;
  UPDATE cessions SET bordereau_ref = (SELECT reference FROM reinsurance_bordereaux WHERE type = 'Premium' AND period = '2026-05' LIMIT 1)
  WHERE status = 'Confirmed' AND to_char(cession_date, 'YYYY-MM') = '2026-05';
  INSERT INTO reinsurance_bordereaux(reference, type, period, treaty_id, reinsurer_id, entries, totals, status, submission_date, confirmation_date, due_date, created_by, updated_by)
  SELECT next_number('bordereau', numbering_prefix('bordereau', 'BDX')), 'Claims', '2026-07', t_motor, 'RE002', count(*),
         jsonb_build_object('grossClaims', sum(gross_claim), 'recoverableAmount', sum(recoverable_amount), 'recovered', COALESCE(sum(settlement_amount), 0), 'outstanding', sum(recoverable_amount) - COALESCE(sum(settlement_amount), 0)),
         'Confirmed', DATE '2026-08-10', DATE '2026-08-15', DATE '2026-08-31', admin_id, admin_id
  FROM reinsurance_recoveries HAVING count(*) > 0;

  -- Statement reconciliation: Nat Re premium for May (small variance, pending review) and Swiss Re claims (matched).
  INSERT INTO reinsurance_reconciliations(reference, type, reinsurer_id, period, our_amount, their_amount, items, status, created_by, updated_by)
  SELECT next_number('ri_reconciliation', numbering_prefix('ri_reconciliation', 'REC')), 'Premium', 'RE001', '2026-05', COALESCE(sum(ceded_premium - commission), 0),
         round(COALESCE(sum(ceded_premium - commission), 0) * 0.985, 2), count(*), 'Pending Review', admin_id, admin_id
  FROM cessions WHERE status = 'Confirmed' AND to_char(cession_date, 'YYYY-MM') = '2026-05';
  INSERT INTO reinsurance_reconciliations(reference, type, reinsurer_id, period, our_amount, their_amount, items, status, created_by, updated_by)
  SELECT next_number('ri_reconciliation', numbering_prefix('ri_reconciliation', 'REC')), 'Claims', 'RE002', '2026-07', COALESCE(sum(recoverable_amount), 0), COALESCE(sum(recoverable_amount), 0), count(*), 'Matched', admin_id, admin_id
  FROM reinsurance_recoveries;
  INSERT INTO reinsurance_exceptions(date, type, description, amount, reconciliation_id, status, created_by)
  SELECT DATE '2026-06-20', 'Variance', 'Nat Re May premium statement is 1.5% below our bordereau', our_amount - their_amount, id, 'Under Investigation', admin_id
  FROM reinsurance_reconciliations WHERE type = 'Premium' AND reinsurer_id = 'RE001' AND period = '2026-05';
  INSERT INTO reinsurance_exceptions(date, type, description, amount, status, created_by)
  VALUES (DATE '2026-09-20', 'Missing Policy', 'Policy POL-2026-95004 not found in reinsurer statement', 45000, 'Under Investigation', admin_id);
END $$;
