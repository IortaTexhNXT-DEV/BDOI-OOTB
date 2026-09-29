-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Incentive programs and calculation batches for the sample agents (seeded in 53_remittance.sql). Idempotent.
INSERT INTO incentive_programs(name, description, metric, target, period_from, period_to, status, program_code, program_type, applicable_to, target_metric, stretch_target, currency,
                               calculation_frequency, structure, created_by)
SELECT v.name, v.descr, v.metric, v.target, v.f::date, v.t::date, v.status, v.code, v.ptype, v.applicable::jsonb, v.tmetric, v.stretch,
       COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'currency.default'), 'PHP'), v.freq, v.structure::jsonb, (SELECT id FROM users WHERE username = 'BrokerVerse')
FROM (VALUES
  ('Q3 Premium Achievers', 'Quarterly incentive for premium targets', 'premium', 500000, '2026-07-01', '2026-09-30', 'Active', 'INC-2026-001', 'Target Based', '["Individual Agent"]', 'Premium Volume', 750000, 'Quarterly',
   '[{"level":"80-90%","type":"Percentage","value":2,"maxPayout":20000},{"level":"90-100%","type":"Percentage","value":3,"maxPayout":30000},{"level":"100-110%","type":"Percentage","value":4,"maxPayout":50000},{"level":"110%+","type":"Percentage","value":5,"maxPayout":75000}]'),
  ('New Business Champion', 'Monthly incentive for new policy acquisition', 'policies', 20, '2026-01-01', '2026-12-31', 'Active', 'INC-2026-002', 'Commission Based', '["Individual Agent","Team"]', 'Policy Count', 30, 'Monthly',
   '[{"level":"0-10 policies","type":"Fixed Amount","value":500,"maxPayout":5000},{"level":"11-20 policies","type":"Fixed Amount","value":750,"maxPayout":15000},{"level":"21-30 policies","type":"Fixed Amount","value":1000,"maxPayout":30000},{"level":"31+ policies","type":"Fixed Amount","value":1500,"maxPayout":50000}]'),
  ('Renewal Excellence', 'Incentive for maintaining high renewal rates', 'renewal-rate', 85, '2026-01-01', '2026-06-30', 'Completed', 'INC-2026-003', 'Hybrid', '["Individual Agent","Branch"]', 'Renewal Rate', 95, 'Semi-Annual',
   '[{"level":"85-90%","type":"Fixed Amount","value":10000,"maxPayout":10000},{"level":"90-95%","type":"Fixed Amount","value":20000,"maxPayout":20000},{"level":"95%+","type":"Fixed Amount","value":35000,"maxPayout":35000}]'),
  ('Q4 Motor Sales Contest', 'Year-end contest for motor premium', 'premium', 1000000, '2026-10-01', '2026-12-31', 'Draft', 'INC-2026-004', 'Contest', '["Individual Agent"]', 'Premium Volume', 1500000, 'Quarterly',
   '[{"level":"100-120%","type":"Percentage","value":3,"maxPayout":40000},{"level":"120%+","type":"Percentage","value":5,"maxPayout":80000}]')
) AS v(name, descr, metric, target, f, t, status, code, ptype, applicable, tmetric, stretch, freq, structure)
WHERE NOT EXISTS (SELECT 1 FROM incentive_programs p WHERE p.program_code = v.code);

DO $$
DECLARE
  admin_id text := (SELECT id FROM users WHERE username = 'BrokerVerse');
  checker_id text := (SELECT id FROM users WHERE username = 'fin.approver');
  nbc int := (SELECT id FROM incentive_programs WHERE program_code = 'INC-2026-002');
  ren int := (SELECT id FROM incentive_programs WHERE program_code = 'INC-2026-003');
  pfx text := numbering_prefix('incentive_calc', 'CALC');
  b text;
  rec record;
BEGIN
  IF EXISTS (SELECT 1 FROM incentive_calculations) OR admin_id IS NULL OR nbc IS NULL THEN RETURN; END IF;
  FOR rec IN SELECT * FROM (VALUES
      ('June 2026', '2026-06', DATE '2026-06-01', DATE '2026-06-30', 'Paid', 0),
      ('July 2026', '2026-07', DATE '2026-07-01', DATE '2026-07-31', 'Approved', 1),
      ('August 2026', '2026-08', DATE '2026-08-01', DATE '2026-08-31', 'Pending Approval', 2)) AS v(label, pkey, pf, pt, st, k)
  LOOP
    b := next_number('incentive_calc', pfx);
    INSERT INTO incentive_calculations(batch_id, period, period_from, period_to, programs_included, description, status, created_by, submitted_by, submitted_date,
                                       approved_by, approval_date, payment_date, payment_reference, created_at)
    VALUES (b, rec.label, rec.pf, rec.pt, '["INC-2026-002"]', 'Monthly new business incentive', rec.st, admin_id, admin_id, rec.pt + 2,
            CASE WHEN rec.st IN ('Approved', 'Paid') THEN checker_id END, CASE WHEN rec.st IN ('Approved', 'Paid') THEN rec.pt + 4 END,
            CASE WHEN rec.st = 'Paid' THEN rec.pt + 15 END, CASE WHEN rec.st = 'Paid' THEN 'PV-' || rec.pkey || '-INC' END, rec.pt + 1);
    INSERT INTO incentive_results(program_id, agent_user_id, achieved, payout, status, period, calculation_id, target, achievement_percent, base_incentive, adjustments, adjustment_reason, tier, paid_at)
    SELECT nbc, u.id, a.achieved, a.base + a.adj, CASE rec.st WHEN 'Paid' THEN 'Paid' WHEN 'Approved' THEN 'Approved' ELSE CASE WHEN a.adj <> 0 THEN 'Adjusted' ELSE 'Calculated' END END,
           rec.pkey, b, 20, round(a.achieved * 100.0 / 20, 2), a.base, a.adj, CASE WHEN a.adj <> 0 THEN 'Chargeback on cancelled policy' END, a.tier,
           CASE WHEN rec.st = 'Paid' THEN (rec.pt + 15)::timestamptz END
    FROM (VALUES ('agent.jdelacruz', 16 + rec.k, 750 * (16 + rec.k), 0, '11-20 policies'),
                 ('agent.msantos', 23 + rec.k, 1000 * (23 + rec.k), CASE WHEN rec.k = 2 THEN -1000 ELSE 0 END, '21-30 policies'),
                 ('agent.preyes', 19 + rec.k, CASE WHEN 19 + rec.k > 20 THEN 1000 ELSE 750 END * (19 + rec.k), 0, CASE WHEN 19 + rec.k > 20 THEN '21-30 policies' ELSE '11-20 policies' END),
                 ('agent.agarcia', 8 + rec.k, 500 * (8 + rec.k), 0, '0-10 policies'),
                 ('agent.jmartinez', 12 + rec.k, 750 * (12 + rec.k), 0, '11-20 policies')) AS a(username, achieved, base, adj, tier)
    JOIN users u ON u.username = a.username
    ON CONFLICT (program_id, agent_user_id, period) DO NOTHING;
    UPDATE incentive_calculations SET total_amount = (SELECT COALESCE(sum(payout), 0) FROM incentive_results WHERE calculation_id = b),
           agent_count = (SELECT count(DISTINCT agent_user_id) FROM incentive_results WHERE calculation_id = b) WHERE batch_id = b;
  END LOOP;

  -- Renewal Excellence half-year result (paid).
  b := next_number('incentive_calc', pfx);
  INSERT INTO incentive_calculations(batch_id, period, period_from, period_to, programs_included, description, status, created_by, submitted_by, submitted_date, approved_by, approval_date, payment_date, created_at)
  VALUES (b, 'January - June 2026', DATE '2026-01-01', DATE '2026-06-30', '["INC-2026-003"]', 'Semi-annual renewal incentive', 'Paid', admin_id, admin_id, DATE '2026-07-03', checker_id, DATE '2026-07-06', DATE '2026-07-15', DATE '2026-07-02');
  INSERT INTO incentive_results(program_id, agent_user_id, achieved, payout, status, period, calculation_id, target, achievement_percent, base_incentive, tier, paid_at)
  SELECT ren, u.id, a.rate, a.pay, 'Paid', '2026-H1', b, 85, round(a.rate * 100.0 / 85, 2), a.pay, a.tier, TIMESTAMPTZ '2026-07-15 00:00+08'
  FROM (VALUES ('agent.jdelacruz', 88, 10000, '85-90%'), ('agent.msantos', 93, 20000, '90-95%'), ('agent.agarcia', 96, 35000, '95%+')) AS a(username, rate, pay, tier)
  JOIN users u ON u.username = a.username ON CONFLICT (program_id, agent_user_id, period) DO NOTHING;
  UPDATE incentive_calculations SET total_amount = (SELECT COALESCE(sum(payout), 0) FROM incentive_results WHERE calculation_id = b),
         agent_count = (SELECT count(DISTINCT agent_user_id) FROM incentive_results WHERE calculation_id = b) WHERE batch_id = b;
END $$;
