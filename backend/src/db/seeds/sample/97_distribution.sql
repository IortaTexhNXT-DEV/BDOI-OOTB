-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Distribution and products samples on the channels of 10_masters.sql: the Toyota dealer programmes with Toyota
-- Financial Services (free first-year insurance of Toyota Makati on financed cars, Toyota Alabang cash buyers with a
-- half subsidy) and an upload of Toyota Alabang sales, a lead assignment rule for the TFS referrals, campaign segments,
-- templates and campaigns, and a shared Report Builder report.

INSERT INTO motor_programmes(code, name, dealer_channel_id, bank_channel_id, insurance_company_id, product_id, vehicle_type, own_damage_rate, acts_of_nature_rate, bodily_injury,
    property_damage, include_ctpl, ctpl_term_years, free_first_year, subsidy_payer, subsidy_type, subsidy_value, issue_mode, effective_from, effective_to, notes, created_by, updated_by)
SELECT 'TMK-TFS-2026', 'Toyota Makati x TFS financed cars 2026 (free first year)', 'ch_seed_tmk', 'ch_seed_tfs', ic.id, pr.id, 'private_cars', 2.0, 0.5, 200000, 200000, true, 3, true, 'dealer', 'full', 0,
  'policy', DATE '2026-01-01', DATE '2026-12-31', 'First year free: Toyota Makati pays the premium of the cars financed by TFS. CTPL for 3 years (LTO registration of a new car).', 'seed', 'seed'
FROM insurance_companies ic, products pr WHERE ic.code = 'PIONEER' AND pr.code = 'MOTOR'
ON CONFLICT DO NOTHING;
INSERT INTO motor_programmes(code, name, dealer_channel_id, bank_channel_id, insurance_company_id, product_id, vehicle_type, own_damage_rate, acts_of_nature_rate, bodily_injury,
    property_damage, include_ctpl, ctpl_term_years, free_first_year, subsidy_payer, subsidy_type, subsidy_value, issue_mode, effective_from, effective_to, notes, created_by, updated_by)
SELECT 'TAL-CASH-2026', 'Toyota Alabang buyers 2026 (half subsidy)', 'ch_seed_tal', 'ch_seed_tfs', ic.id, pr.id, 'private_cars', 2.0, 0.5, 200000, 200000, true, 3, false, 'dealer', 'percent', 50,
  'quotation', DATE '2026-01-01', DATE '2026-12-31', 'Toyota Alabang pays half of the first-year premium; the buyer is quoted for the rest.', 'seed', 'seed'
FROM insurance_companies ic, products pr WHERE ic.code = 'AXA' AND pr.code = 'MOTOR'
  AND NOT EXISTS (SELECT 1 FROM motor_programmes WHERE lower(code) = 'tal-cash-2026');
INSERT INTO motor_programmes(code, name, dealer_channel_id, bank_channel_id, insurance_company_id, product_id, vehicle_type, own_damage_rate, acts_of_nature_rate, bodily_injury,
    property_damage, include_ctpl, ctpl_term_years, free_first_year, subsidy_payer, subsidy_type, subsidy_value, issue_mode, effective_from, effective_to, notes, created_by, updated_by)
SELECT 'TCB-TFS-2026', 'Toyota Cebu x TFS commercial pick-ups 2026', 'ch_seed_tcb', 'ch_seed_tfs', ic.id, pr.id, 'light_medium_trucks', 1.15, 0.5, 100000, 200000, true, 1, false, 'none', 'full', 0,
  'quotation', DATE '2026-04-01', DATE '2027-03-31', 'Hilux and Hiace bought by businesses on TFS loans: quotation to the buyer, own goods use.', 'seed', 'seed'
FROM insurance_companies ic, products pr WHERE ic.code = 'STRONGHOLD' AND pr.code = 'MOTOR'
  AND NOT EXISTS (SELECT 1 FROM motor_programmes WHERE lower(code) = 'tcb-tfs-2026');

-- Toyota Alabang's upload of its sales: the financed Innova quoted to its buyer, a row refused for its missing chassis number
DO $$
DECLARE v_prog record; v_batch text; v_admin text := (SELECT id FROM users WHERE username = 'BrokerVerse');
BEGIN
  SELECT * INTO v_prog FROM motor_programmes WHERE code = 'TAL-CASH-2026';
  IF v_prog.id IS NULL OR EXISTS (SELECT 1 FROM dealer_sales_batches WHERE programme_id = v_prog.id) THEN RETURN; END IF;
  INSERT INTO dealer_sales_batches(batch_number, programme_id, file_name, rows_total, rows_created, rows_failed, status, created_by, created_at)
  VALUES (next_number('dealer_sales_batch', 'DSB'), v_prog.id, 'toyota-alabang-sales.xlsx', 2, 1, 1, 'partial', v_admin, now() - interval '7 days')
  RETURNING id INTO v_batch;
  INSERT INTO dealer_sales(batch_id, programme_id, row_no, dealer_channel_id, bank_channel_id, sale_date, invoice_number, buyer_first_name, buyer_last_name, buyer_email, buyer_phone,
    buyer_city, buyer_province, make, model, variant, year_model, color, vehicle_type, conduction_sticker, chassis_number, engine_number, invoice_price, loan_amount, gross_premium,
    buyer_share, payer_share, lead_id, quote_id, status, error, created_by, created_at)
  SELECT v_batch, v_prog.id, 2, 'ch_seed_tal_alb', 'ch_seed_tfs', current_date - 8, 'TAL-SI-26-0412', l.first_name, l.last_name, l.email, l.phone, l.city, l.state, 'Toyota', 'Innova', '2.8 E AT',
    2026, 'Silver Metallic', 'private_cars', 'Q4A 812', q.doc->>'chassisNumber', q.doc->>'motorNumber', 1646000, 1152200, q.premium_total,
    q.premium_total - round(q.premium_total / 2, 2), round(q.premium_total / 2, 2), l.id, q.id, 'created', NULL, v_admin, now() - interval '7 days'
  FROM leads l JOIN quotes q ON q.lead_id = l.id WHERE l.id = 'ld_sls_12' AND q.id = 'qt_sls_12';
  INSERT INTO dealer_sales(batch_id, programme_id, row_no, dealer_channel_id, sale_date, invoice_number, buyer_first_name, buyer_last_name, make, model, variant, year_model,
    vehicle_type, invoice_price, status, error, created_by, created_at)
  VALUES (v_batch, v_prog.id, 3, 'ch_seed_tal_alb', current_date - 8, 'TAL-SI-26-0413', 'Nestor', 'Cruz', 'Toyota', 'Vios', '1.3 XLE CVT', 2026, 'private_cars', 1098000, 'failed',
    'Chassis Number is required; Engine Number is required', v_admin, now() - interval '7 days');
END $$;

INSERT INTO lead_assignment_rules(name, priority, method, conditions, assignees, description, created_by, updated_by)
SELECT 'TFS referrals - Metro Manila', 10, 'round_robin', '{"channelId":"ch_seed_tfs_hq"}',
  ARRAY(SELECT id FROM users WHERE username IN ('agent.jdelacruz', 'agent.msantos', 'agent.preyes') ORDER BY username), 'Prospects referred by the TFS head office go to the Metro Manila sales team in turn', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM lead_assignment_rules WHERE name = 'TFS referrals - Metro Manila');
INSERT INTO lead_assignment_rules(name, priority, method, conditions, assignees, description, created_by, updated_by)
SELECT 'TFS referrals - Visayas', 20, 'round_robin', '{"channelId":"ch_seed_tfs_ceb"}',
  ARRAY(SELECT id FROM users WHERE username IN ('agent.agarcia') ORDER BY username), 'Prospects referred by TFS Cebu go to the Cebu sales unit', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM lead_assignment_rules WHERE name = 'TFS referrals - Visayas');

INSERT INTO campaign_templates(code, name, subject, body_html, created_by, updated_by) VALUES
 ('MOTOR-RENEW', 'Toyota car insurance renewal reminder', 'Your Toyota''s insurance renews soon, {{firstName}}',
  '<p>Dear {{firstName}},</p><p>The insurance of your Toyota is due for renewal. Reply to this e-mail or call your TIS sales associate and we will renew it with the insurer of your choice from our panel, with repairs at the Toyota service centre.</p><p>{{companyName}}</p><p style="font-size:12px">To stop receiving offers by e-mail, <a href="{{optOutLink}}">unsubscribe here</a>.</p>',
  'seed', 'seed'),
 ('CL-VOL-OFFER', 'Voluntary credit life for year 2 of the TFS loan', 'Keep your TFS loan protected, {{firstName}}',
  '<p>Dear {{firstName}},</p><p>The compulsory credit life cover of your Toyota Financial Services loan ends with the first year. Our voluntary credit life plan keeps the outstanding balance of your loan protected for the rest of the term, for a single premium.</p><p>{{companyName}}</p><p style="font-size:12px">To stop receiving offers by e-mail, <a href="{{optOutLink}}">unsubscribe here</a>.</p>',
  'seed', 'seed'),
 ('PA-TOYOTA', 'Personal accident for Toyota owners', 'Protect yourself, not just your Toyota',
  '<p>Dear {{firstName}},</p><p>Add a personal accident plan from PHP 1,500 a year: accidental death and disablement, medical reimbursement and burial benefit, wherever you drive.</p><p>{{companyName}}</p><p style="font-size:12px">To stop receiving offers by e-mail, <a href="{{optOutLink}}">unsubscribe here</a>.</p>',
  'seed', 'seed')
ON CONFLICT DO NOTHING;
INSERT INTO campaign_segments(name, description, criteria, created_by, updated_by)
SELECT 'Metro Manila clients and prospects', 'Everyone in Metro Manila who agreed to receive offers', '{"partyType":"both","province":"Metro Manila"}', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM campaign_segments WHERE name = 'Metro Manila clients and prospects');
INSERT INTO campaign_segments(name, description, criteria, created_by, updated_by)
SELECT 'Motor clients renewing in 60 days', 'Clients with a motor policy expiring within 60 days', '{"partyType":"client","lob":"MOTOR","expiringWithinDays":60}', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM campaign_segments WHERE name = 'Motor clients renewing in 60 days');
INSERT INTO campaign_segments(name, description, criteria, created_by, updated_by)
SELECT 'Clients with an active policy', 'Every client with a policy in force (personal accident cross-sell)', '{"partyType":"client","hasActivePolicy":true}', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM campaign_segments WHERE name = 'Clients with an active policy');

INSERT INTO campaigns(id, campaign_number, name, segment_id, template_id, status, scheduled_at, recipients, excluded, notes, created_by, updated_by, created_at)
SELECT v.id, next_document_number('marketing_campaign'), v.name, s.id, t.id, v.status, CASE WHEN v.status = 'scheduled' THEN date_trunc('day', now()) + interval '3 days 9 hours' END, 0, 0, v.notes,
  (SELECT id FROM users WHERE username = 'BrokerVerse'), (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - interval '2 days'
FROM (VALUES ('cmp_seed_01', 'Motor renewals - next 60 days', 'Motor clients renewing in 60 days', 'MOTOR-RENEW', 'scheduled', 'Monthly renewal reminder to the Toyota owners'),
             ('cmp_seed_02', 'PA cross-sell to Toyota owners', 'Clients with an active policy', 'PA-TOYOTA', 'draft', 'Waiting for the PA rates of the panel for the new quarter')) AS v(id, name, segment, template, status, notes)
JOIN campaign_segments s ON s.name = v.segment JOIN campaign_templates t ON t.code = v.template
WHERE NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id = v.id);

INSERT INTO report_builder_reports(id, name, description, dataset, columns, filters, group_by, sort, shared_roles, owner_user_id, created_by, updated_by)
SELECT 'rbr_seed_premium_by_insurer', 'Premium by panel insurer', 'Policies, premium and commission per insurer of the panel', 'policies', '["insurer","policies","grossPremium","commission"]', '[]',
  '["insurer"]', '[{"column":"grossPremium","dir":"desc"}]', '{sales,processing,operations}', u.id, 'seed', 'seed'
FROM users u WHERE u.username = 'BrokerVerse'
ON CONFLICT (id) DO NOTHING;
