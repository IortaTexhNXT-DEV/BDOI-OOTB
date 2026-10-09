-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- The people and partners the TISPH sample business is built on: fictional authorised signatories, the Cebu and Davao
-- demo branches, the sample account executives and the Accounting approver, the commission referrers (agents and the
-- Toyota dealers' referral accounts) and the distribution channels (Toyota Financial Services and the Toyota dealers
-- whose buyers are referred to TISPH). They come first so the prospects, quotations and policies of the later sample
-- files can name them. Idempotent by natural key or fixed id.
INSERT INTO signatories(name, designation)
SELECT * FROM (VALUES ('Maria Regina Cruz','President & CEO'),('Jose Antonio Reyes','VP - Operations'),('Ana Patricia Lim','Finance Director')) AS v(n,d)
WHERE NOT EXISTS (SELECT 1 FROM signatories s WHERE s.name = v.n);
INSERT INTO branches(code, name, address)
SELECT * FROM (VALUES ('CEB','Cebu Branch','Cebu City'),('DAV','Davao Branch','Davao City')) AS v(c,n,a)
WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.code = v.c);

-- Account executives (Sales & Marketing; the usernames are kept from earlier releases) and an Accounting approver used by
-- the agency bills, incentives and maker-checker samples. Passwords are random and unusable; administrators set real
-- ones through Master > User.
INSERT INTO users(username, password_hash, display_name, first_name, last_name, email, employee_code, branch_code, designation, status, must_change_password, created_by)
SELECT v.u, crypt(gen_random_uuid()::text, gen_salt('bf', 8)), v.f || ' ' || v.l, v.f, v.l, v.e, v.code, v.branch, v.des, 'active', true, 'seed'
FROM (VALUES
  ('agent.jdelacruz', 'Juan', 'Dela Cruz', 'juan.delacruz@tisph.example.ph', 'AG001', 'HO', 'Sales Officer'),
  ('agent.msantos', 'Maria', 'Santos', 'maria.santos@tisph.example.ph', 'AG002', 'HO', 'Sales Associate'),
  ('agent.preyes', 'Pedro', 'Reyes', 'pedro.reyes@tisph.example.ph', 'AG003', 'HO', 'Sales Associate'),
  ('agent.agarcia', 'Ana', 'Garcia', 'ana.garcia@tisph.example.ph', 'AG004', 'CEB', 'Sales Unit Head'),
  ('agent.jmartinez', 'Jose', 'Martinez', 'jose.martinez@tisph.example.ph', 'AG005', 'DAV', 'Sales Associate'),
  ('fin.approver', 'Ramon', 'Aquino', 'ramon.aquino@tisph.example.ph', 'EMP-0004', 'HO', 'Finance Supervisor')
) AS v(u, f, l, e, code, branch, des)
ON CONFLICT (username) DO NOTHING;
INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = CASE WHEN u.username = 'fin.approver' THEN 'accounting' ELSE 'sales' END
WHERE u.username IN ('agent.jdelacruz', 'agent.msantos', 'agent.preyes', 'agent.agarcia', 'agent.jmartinez', 'fin.approver')
ON CONFLICT DO NOTHING;

-- Commission referrers: referral agents and sub-agents, and the dealers' referral accounts (comsub on the business their
-- buyers place through TISPH).
INSERT INTO commission_referrers(id, name, referrer_type, level, parent_referrer_id, tin, email, phone, wht_rate, wht_applicable, bank_name, bank_account_no, status) VALUES
 ('ref-jdelacruz','Juan Dela Cruz','Agent','L1',NULL,'123-456-789-000','juan.delacruz@example.ph','+63 917 555 0101',NULL,true,'BDO','004560124521','Active'),
 ('ref-rbautista','Ramon Bautista','Agent','L1',NULL,'234-567-891-000','ramon.bautista@example.ph','+63 918 555 0102',NULL,true,'BPI','3179048830','Active'),
 ('ref-amendoza','Andres Mendoza','Agent','L1',NULL,'345-678-912-000','andres.mendoza@example.ph','+63 919 555 0103',NULL,true,'Metrobank','0072335519','Active'),
 ('ref-pvillanueva','Pia Villanueva','Agent','L1',NULL,'456-789-123-000','pia.villanueva@example.ph','+63 920 555 0104',NULL,true,'Security Bank','0000912207','Active'),
 ('ref-mreyes','Marites Reyes','Sub-agent','L2','ref-jdelacruz','567-891-234-000','marites.reyes@example.ph','+63 921 555 0105',NULL,true,'BDO','004560127742','Active'),
 ('ref-lgarcia','Liza Garcia','Sub-agent','L2','ref-rbautista','678-912-345-000','liza.garcia@example.ph','+63 922 555 0106',NULL,true,'Landbank','1234561188','Active'),
 ('ref-toyotamakati','Toyota Makati, Inc.','External',NULL,NULL,'789-123-456-000','accounts@toyotamakati.example.ph','+63 2 8555 0107',NULL,true,'Metrobank','0072339901','Active'),
 ('ref-toyotacebu','Toyota Cebu City, Inc.','External',NULL,NULL,'891-234-567-000','finance@toyotacebu.example.ph','+63 32 555 0108',NULL,true,'BPI','1002033310','Active')
ON CONFLICT (id) DO NOTHING;

-- Distribution channels: Toyota Financial Services (financing bank, mortgagee of the financed cars, source of most
-- leads) with two branches, and the Toyota dealers (dealer group and showroom) whose buyers are referred.
INSERT INTO distribution_channels(id, code, name, channel_type, parent_id, referrer_id, comsub_pct, bank_id, branch_code, province, city, address, contact_person,
    contact_email, contact_phone, mortgagee_clause, letter_addressee, created_by, updated_by) VALUES
 ('ch_seed_tfs', 'TFS', 'Toyota Financial Services Philippines Corporation', 'financing_bank', NULL, NULL, NULL, NULL, 'HO', 'Metro Manila', 'Taguig City',
  'Bonifacio Global City, Taguig City', 'Insurance Desk, Retail Credit Operations', 'insurance.desk@tfs.example.ph', '+63 2 8858 8000',
  'Loss, if any, under the own damage and theft sections of this policy shall be payable to {{bankName}} as mortgagee, as its interest may appear.', 'The Head, Retail Credit Operations', 'seed', 'seed'),
 ('ch_seed_tfs_hq', 'TFS-HQ', 'TFS Head Office (Metro Manila loans)', 'bank_branch', 'ch_seed_tfs', NULL, NULL, NULL, 'HO', 'Metro Manila', 'Taguig City',
  'Bonifacio Global City, Taguig City', 'Loan Booking Unit', 'loans.manila@tfs.example.ph', '+63 2 8858 8100', NULL, 'The Head, Loan Booking Unit', 'seed', 'seed'),
 ('ch_seed_tfs_ceb', 'TFS-CEB', 'TFS Cebu Branch', 'bank_branch', 'ch_seed_tfs', NULL, NULL, NULL, 'CEB', 'Cebu', 'Cebu City',
  'Cebu Business Park, Cebu City', 'Branch Credit Officer', 'loans.cebu@tfs.example.ph', '+63 32 888 8200', NULL, 'The Branch Head, TFS Cebu', 'seed', 'seed'),
 ('ch_seed_tmk', 'TMK', 'Toyota Makati, Inc.', 'dealer_group', NULL, 'ref-toyotamakati', 5, NULL, 'HO', 'Metro Manila', 'Makati City', 'Chino Roces Avenue, Makati City',
  'Ramon Ilagan', 'fleet@toyotamakati.example.ph', '+63 2 8812 4400', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_tmk_mkt', 'TMK-MKT', 'Toyota Makati', 'dealer_branch', 'ch_seed_tmk', 'ref-toyotamakati', 5, NULL, 'HO', 'Metro Manila', 'Makati City', 'Chino Roces Avenue, Makati City',
  'Liza Santiago', 'sales@toyotamakati.example.ph', '+63 2 8812 4410', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_tps', 'TPS', 'Toyota Pasig, Inc.', 'dealer_group', NULL, NULL, NULL, NULL, 'HO', 'Metro Manila', 'Pasig City', 'Ortigas Avenue Extension, Pasig City',
  'Arnel Pineda', 'fleet@toyotapasig.example.ph', '+63 2 8655 2200', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_tps_psg', 'TPS-PSG', 'Toyota Pasig', 'dealer_branch', 'ch_seed_tps', NULL, NULL, NULL, 'HO', 'Metro Manila', 'Pasig City', 'Ortigas Avenue Extension, Pasig City',
  'Carmela Diaz', 'sales@toyotapasig.example.ph', '+63 2 8655 2201', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_tqa', 'TQA', 'Toyota Quezon Avenue, Inc.', 'dealer_group', NULL, NULL, NULL, NULL, 'HO', 'Metro Manila', 'Quezon City', 'Quezon Avenue, Quezon City',
  'Grace Valdez', 'fleet@toyotaqave.example.ph', '+63 2 8712 3300', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_tqa_qc', 'TQA-QC', 'Toyota Quezon Avenue', 'dealer_branch', 'ch_seed_tqa', NULL, NULL, NULL, 'HO', 'Metro Manila', 'Quezon City', 'Quezon Avenue, Quezon City',
  'Mark Tolentino', 'sales@toyotaqave.example.ph', '+63 2 8712 3310', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_tal', 'TAL', 'Toyota Alabang, Inc.', 'dealer_group', NULL, NULL, NULL, NULL, 'HO', 'Metro Manila', 'Muntinlupa City', 'Alabang-Zapote Road, Muntinlupa City',
  'Noel Bautista', 'fleet@toyotaalabang.example.ph', '+63 2 8850 2200', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_tal_alb', 'TAL-ALB', 'Toyota Alabang', 'dealer_branch', 'ch_seed_tal', NULL, NULL, NULL, 'HO', 'Metro Manila', 'Muntinlupa City', 'Alabang-Zapote Road, Muntinlupa City',
  'Joy Mercado', 'sales@toyotaalabang.example.ph', '+63 2 8850 2201', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_tcb', 'TCB', 'Toyota Cebu City, Inc.', 'dealer_group', NULL, 'ref-toyotacebu', 4, NULL, 'CEB', 'Cebu', 'Cebu City', 'Archbishop Reyes Avenue, Cebu City',
  'Gemma Uy', 'fleet@toyotacebu.example.ph', '+63 32 412 7788', NULL, NULL, 'seed', 'seed'),
 ('ch_seed_tcb_ceb', 'TCB-CEB', 'Toyota Cebu', 'dealer_branch', 'ch_seed_tcb', 'ref-toyotacebu', 4, NULL, 'CEB', 'Cebu', 'Cebu City', 'Archbishop Reyes Avenue, Cebu City',
  'Paul Sy', 'sales@toyotacebu.example.ph', '+63 32 412 7790', NULL, NULL, 'seed', 'seed')
ON CONFLICT (id) DO NOTHING;
