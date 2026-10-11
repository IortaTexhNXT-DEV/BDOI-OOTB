-- Sample dealer schemes (TIS-BRD-SCHM-02): an active Scheme 1 (dealer pays year 1, client renews under the Auto Renewal
-- Agreement) and an active Scheme 2 (paid through the TFSPH monthly amortisation) for every Toyota dealer, insured by
-- Pioneer and Malayan, with Innova and Hilux vehicle lines; and next year's Scheme 1 as a Draft. The Vios and Fortuner
-- lines are left to the tests and the demo set-up. Idempotent.

INSERT INTO schemes(id, scheme_no, version, scheme_type, description, effective_from, effective_to, bank_channel_id, all_dealers, dealer_channel_ids, insurer_ids, product_id,
  vehicle_classes, perils, commission_pct, dealer_commission_pct, term_years, year1_paid_by, si_schedule, status, notes, created_by, updated_by, created_at, submitted_by,
  submitted_at, decided_by, decided_at, decision_note)
SELECT v.id, v.no, 1, v.type, v.description, CURRENT_DATE + v.from_days, CURRENT_DATE + v.to_days, 'ch_seed_tfs', true, '[]'::jsonb,
       (SELECT jsonb_agg(id ORDER BY id) FROM insurance_companies WHERE name IN ('Malayan Insurance Co., Inc.', 'Pioneer Insurance & Surety Corp.')),
       p.id, '["private_cars", "light_medium_trucks"]'::jsonb,
       jsonb_build_array(
         jsonb_build_object('code', 'OD', 'name', 'Own Damage / Theft', 'basis', 'si-pct', 'mandatory', true, 'included', true, 'rate', v.od, 'premium', NULL, 'limit', NULL),
         jsonb_build_object('code', 'AON', 'name', 'Acts of Nature', 'basis', 'si-pct', 'mandatory', false, 'included', true, 'rate', v.aon, 'premium', NULL, 'limit', NULL),
         jsonb_build_object('code', 'BI', 'name', 'Excess Bodily Injury', 'basis', 'limit-premium', 'mandatory', false, 'included', true, 'rate', NULL, 'premium', 1000, 'limit', 100000),
         jsonb_build_object('code', 'PD', 'name', 'Property Damage', 'basis', 'limit-premium', 'mandatory', false, 'included', true, 'rate', NULL, 'premium', 1000, 'limit', 100000),
         jsonb_build_object('code', 'APPA', 'name', 'Auto Personal Accident', 'basis', 'limit-seat-pct', 'mandatory', false, 'included', true, 'rate', 0.1, 'premium', NULL, 'limit', 25000),
         jsonb_build_object('code', 'RSA', 'name', 'Roadside Assistance', 'basis', 'vehicle-premium', 'mandatory', false, 'included', false, 'rate', NULL, 'premium', NULL, 'limit', NULL),
         jsonb_build_object('code', 'PAD', 'name', 'Personal Accident of the Driver', 'basis', 'limit-pct', 'mandatory', false, 'included', false, 'rate', NULL, 'premium', NULL, 'limit', NULL),
         jsonb_build_object('code', 'CTPL', 'name', 'CTPL', 'basis', 'tariff', 'mandatory', true, 'included', true, 'rate', NULL, 'premium', NULL, 'limit', NULL)),
       25, 85, 5, CASE WHEN v.type = 'scheme1' THEN 'dealer' END, '[100, 90, 80, 70, 60]'::jsonb, v.status, v.notes, mk.id, mk.id, now() - interval '40 days',
       CASE WHEN v.status <> 'draft' THEN mk.id END, CASE WHEN v.status <> 'draft' THEN now() - interval '35 days' END,
       CASE WHEN v.status <> 'draft' THEN ap.id END, CASE WHEN v.status <> 'draft' THEN now() - interval '33 days' END,
       CASE WHEN v.status <> 'draft' THEN 'Rates agreed with Pioneer and Malayan' END
FROM products p, (SELECT id FROM users WHERE username = 'agent.preyes') mk, (SELECT id FROM users WHERE username = 'fin.approver') ap,
  (VALUES ('sch_sample_s1_26', 'S1-STD-2026', 'scheme1', 'Scheme 1 standard 2026: free first year from the dealer, ARA renewals', -30, 335, 2.0, 0.5, 'active', 'Bundled with TFSPH auto loans'),
          ('sch_sample_s2_26', 'S2-STD-2026', 'scheme2', 'Scheme 2 standard 2026: premium in the monthly amortisation', -30, 335, 1.8, 0.4, 'active', 'Insurance financed with the loan'),
          ('sch_sample_s1_27', 'S1-STD-2027', 'scheme1', 'Scheme 1 standard 2027 (draft)', 336, 700, 1.9, 0.5, 'draft', 'Rates under negotiation')) AS v(id, no, type, description, from_days, to_days, od, aon, status, notes)
WHERE p.code = 'MOTOR'
  AND NOT EXISTS (SELECT 1 FROM schemes s WHERE upper(s.scheme_no) = v.no);

INSERT INTO scheme_vehicle_lines(scheme_id, line_no, brand_id, model_id, variant_id, year_from, year_to, si_from, si_to, vehicle_class, od_rate, aon_rate)
SELECT s.id, l.line_no, b.id, m.id, NULL, EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, l.si_from, l.si_to, l.class, NULL, NULL
FROM schemes s
JOIN (VALUES (1, 'Innova', 1200000, 2100000, 'private_cars'), (2, 'Hilux', 900000, 2200000, 'light_medium_trucks')) AS l(line_no, model, si_from, si_to, class) ON true
JOIN vehicle_brands b ON b.name = 'Toyota'
JOIN vehicle_models m ON m.brand_id = b.id AND m.name = l.model
WHERE s.id IN ('sch_sample_s1_26', 'sch_sample_s2_26', 'sch_sample_s1_27')
  AND NOT EXISTS (SELECT 1 FROM scheme_vehicle_lines x WHERE x.scheme_id = s.id AND x.line_no = l.line_no);
