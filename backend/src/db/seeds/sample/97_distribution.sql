-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Distribution and products samples: a dealer group with two branches and a financing bank (Distribution Channels), a
-- brand-new vehicle programme, a lead assignment rule, campaign segments and templates, and a shared Report Builder
-- report. Fictional dealers; the bank is the BDO entry of the Bank master.

INSERT INTO distribution_channels(id, code, name, channel_type, parent_id, referrer_id, comsub_pct, bank_id, branch_code, province, city, address, contact_person,
    contact_email, contact_phone, mortgagee_clause, letter_addressee, created_by, updated_by) VALUES
 ('ch_seed_mmg', 'MMG', 'Makati Motors Group', 'dealer_group', NULL, 'ref-makatimotors', 5, NULL, 'HO', 'Metro Manila', 'Makati City', 'Chino Roces Avenue, Makati City',
  'Ramon Ilagan', 'fleet@makatimotors.example.ph', '+63 2 8812 4400', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_mmg_mkt', 'MMG-MKT', 'Makati Motors Makati', 'dealer_branch', 'ch_seed_mmg', 'ref-makatimotors', 5, NULL, 'HO', 'Metro Manila', 'Makati City', 'Chino Roces Avenue, Makati City',
  'Liza Santiago', 'sales.makati@makatimotors.example.ph', '+63 2 8812 4410', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_mmg_alb', 'MMG-ALB', 'Makati Motors Alabang', 'dealer_branch', 'ch_seed_mmg', 'ref-makatimotors', 5, NULL, 'HO', 'Metro Manila', 'Muntinlupa City', 'Alabang-Zapote Road, Muntinlupa City',
  'Noel Bautista', 'sales.alabang@makatimotors.example.ph', '+63 2 8850 2201', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_bdo', 'BDO-AUTO', 'BDO Unibank, Inc. (Auto Loans)', 'financing_bank', NULL, NULL, NULL, (SELECT id FROM banks WHERE code = 'BDO'), 'HO', 'Metro Manila', 'Makati City',
  'Makati Avenue, Makati City', 'Auto Loans Department', 'autoloans@bdo.example.ph', '+63 2 8631 8000',
  'Loss, if any, under the own damage and theft sections of this policy shall be payable to {{bankName}} as mortgagee, as its interest may appear.', 'The Manager, Auto Loans Department', 'seed', 'seed'),
 ('ch_seed_bdo_mkt', 'BDO-AUTO-MKT', 'BDO Auto Loans Makati Center', 'bank_branch', 'ch_seed_bdo', NULL, NULL, (SELECT id FROM banks WHERE code = 'BDO'), 'HO', 'Metro Manila', 'Makati City',
  'Ayala Avenue, Makati City', 'Center Head', 'autoloans.makati@bdo.example.ph', '+63 2 8631 8100', NULL, 'The Center Head, Auto Loans Makati Center', 'seed', 'seed'),
 ('ch_seed_cpr', 'CPR-AFF', 'Cebu Prime Realty homeowners', 'affinity_partner', NULL, 'ref-cebuprime', 3, NULL, 'CEB', 'Cebu', 'Cebu City', 'IT Park, Cebu City',
  'Gemma Uy', 'admin@cebuprime.example.ph', '+63 32 412 7788', NULL, NULL, 'seed', 'seed')
ON CONFLICT (id) DO NOTHING;

INSERT INTO motor_programmes(code, name, dealer_channel_id, bank_channel_id, insurance_company_id, product_id, vehicle_type, own_damage_rate, acts_of_nature_rate, bodily_injury,
    property_damage, include_ctpl, ctpl_term_years, free_first_year, subsidy_payer, subsidy_type, subsidy_value, issue_mode, effective_from, effective_to, notes, created_by, updated_by)
SELECT 'MMG-BDO-2026', 'Makati Motors x BDO auto loans 2026', 'ch_seed_mmg', 'ch_seed_bdo', ic.id, pr.id, 'private_cars', 1.5, 0.5, 200000, 200000, true, 3, true, 'dealer', 'full', 0,
  'policy', DATE '2026-01-01', DATE '2026-12-31', 'First year free: Makati Motors pays the premium. CTPL for 3 years (LTO registration of a new car).', 'seed', 'seed'
FROM insurance_companies ic, products pr WHERE ic.code = 'MALAYAN' AND pr.code = 'MOTOR'
ON CONFLICT DO NOTHING;
INSERT INTO motor_programmes(code, name, dealer_channel_id, bank_channel_id, insurance_company_id, product_id, vehicle_type, own_damage_rate, acts_of_nature_rate, include_ctpl,
    ctpl_term_years, free_first_year, subsidy_payer, subsidy_type, subsidy_value, issue_mode, effective_from, effective_to, created_by, updated_by)
SELECT 'MMG-CASH-2026', 'Makati Motors cash buyers 2026 (half subsidy)', 'ch_seed_mmg', NULL, ic.id, pr.id, 'private_cars', 1.6, 0.5, true, 3, false, 'dealer', 'percent', 50,
  'quotation', DATE '2026-01-01', DATE '2026-12-31', 'seed', 'seed'
FROM insurance_companies ic, products pr WHERE ic.code = 'PIONEER' AND pr.code = 'MOTOR'
  AND NOT EXISTS (SELECT 1 FROM motor_programmes WHERE lower(code) = 'mmg-cash-2026');

INSERT INTO lead_assignment_rules(name, priority, method, conditions, assignees, description, created_by, updated_by)
SELECT 'Website motor prospects', 10, 'round_robin', '{"source":"Website","lob":"MOTOR","channelId":"ch_seed_mmg_mkt"}',
  ARRAY(SELECT id FROM users WHERE username IN ('agent.jdelacruz', 'agent.msantos') ORDER BY username), 'Prospects from the Makati Motors web enquiry form go to the Makati team in turn', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM lead_assignment_rules WHERE name = 'Website motor prospects');

INSERT INTO campaign_templates(code, name, subject, body_html, created_by, updated_by) VALUES
 ('MOTOR-RENEW', 'Motor renewal reminder', 'Your car insurance renews soon, {{firstName}}',
  '<p>Dear {{firstName}},</p><p>Your car insurance is due for renewal. Reply to this e-mail or call your account executive and we will compare the best offers of our insurers for you.</p><p>{{companyName}}</p><p style="font-size:12px">To stop receiving offers by e-mail, <a href="{{optOutLink}}">unsubscribe here</a>.</p>',
  'seed', 'seed'),
 ('HOME-PROTECT', 'Home protection offer', 'Protect your home this typhoon season',
  '<p>Dear {{firstName}},</p><p>Typhoon season is here. Ask us about fire and allied perils cover for your home, with acts of nature included.</p><p>{{companyName}}</p>', 'seed', 'seed')
ON CONFLICT DO NOTHING;
INSERT INTO campaign_segments(name, description, criteria, created_by, updated_by)
SELECT 'Metro Manila clients and prospects', 'Everyone in Metro Manila who agreed to receive offers', '{"partyType":"both","province":"Metro Manila"}', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM campaign_segments WHERE name = 'Metro Manila clients and prospects');
INSERT INTO campaign_segments(name, description, criteria, created_by, updated_by)
SELECT 'Motor clients renewing in 60 days', 'Clients with a motor policy expiring within 60 days', '{"partyType":"client","lob":"MOTOR","expiringWithinDays":60}', 'seed', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM campaign_segments WHERE name = 'Motor clients renewing in 60 days');

INSERT INTO report_builder_reports(id, name, description, dataset, columns, filters, group_by, sort, shared_roles, owner_user_id, created_by, updated_by)
SELECT 'rbr_seed_premium_by_insurer', 'Premium by insurer', 'Policies, premium and commission per insurer', 'policies', '["insurer","policies","grossPremium","commission"]', '[]',
  '["insurer"]', '[{"column":"grossPremium","dir":"desc"}]', '{sales,processing,operations}', u.id, 'seed', 'seed'
FROM users u WHERE u.username = 'BrokerVerse'
ON CONFLICT (id) DO NOTHING;
