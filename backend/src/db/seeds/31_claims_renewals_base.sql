-- Sample clients, policies and receivables used by the claims and renewals samples (fictional; idempotent by id).
-- Dates are relative to the day the seed runs so the pipeline, ageing and grace-period views always have rows.
INSERT INTO clients(id, client_code, client_type, first_name, last_name, company_name, display_name, email, phone, address, city, state, country, postal_code, source, owner_user_id, created_by)
SELECT v.id, v.code, v.ctype, v.fn, v.ln, v.co, COALESCE(v.co, v.fn || ' ' || v.ln), v.email, v.phone, v.addr, v.city, v.state, 'Philippines', v.zip, 'Referral',
       (SELECT id FROM users WHERE username = 'BrokerVerse'), 'seed'
FROM (VALUES
 ('cl_crs_01','CL-2026-90001','individual','Maria','Santos',NULL,'maria.santos@example.ph','+639171234567','12 Mabini St., Brgy. San Antonio','Makati','Metro Manila','1203'),
 ('cl_crs_02','CL-2026-90002','corporate',NULL,NULL,'Bayanihan Logistics Corp.','finance@bayanihanlogistics.example.ph','+63288123456','45 Pioneer St.','Pasig','Metro Manila','1600'),
 ('cl_crs_03','CL-2026-90003','individual','Jose','Reyes',NULL,'jose.reyes@example.ph','+639189876543','7 Osmena Blvd.','Cebu City','Cebu','6000'),
 ('cl_crs_04','CL-2026-90004','individual','Andrea','Villanueva',NULL,'andrea.villanueva@example.ph','+639205551234','88 Rizal Ave.','Quezon City','Metro Manila','1100'),
 ('cl_crs_05','CL-2026-90005','corporate',NULL,NULL,'Mindanao Agri Trading Inc.','accounts@mindanaoagri.example.ph','+63822245678','3 J.P. Laurel Ave.','Davao City','Davao del Sur','8000'),
 ('cl_crs_06','CL-2026-90006','individual','Ramon','Dela Cruz',NULL,NULL,'+639167770011','21 Burgos St.','Bacolod','Negros Occidental','6100'),
 ('cl_crs_07','CL-2026-90007','individual','Liza','Mendoza',NULL,'liza.mendoza@example.ph','+639178880022','5 Aguinaldo Hwy.','Bacoor','Cavite','4102'),
 ('cl_crs_08','CL-2026-90008','corporate',NULL,NULL,'Taal Lakeside Resorts Inc.','admin@taallakeside.example.ph','+63437001234','Km 60 Tagaytay-Talisay Rd.','Batangas City','Batangas','4200'),
 ('cl_crs_09','CL-2026-90009','individual','Carlo','Bautista',NULL,'carlo.bautista@example.ph','+639199990033','14 Luna St.','Iloilo City','Iloilo','5000'),
 ('cl_crs_10','CL-2026-90010','individual','Patricia','Garcia',NULL,'patricia.garcia@example.ph','+639151110044','9 McArthur Hwy.','San Fernando','Pampanga','2000')
) AS v(id, code, ctype, fn, ln, co, email, phone, addr, city, state, zip)
ON CONFLICT (id) DO NOTHING;

INSERT INTO policies(id, policy_number, client_id, product_id, policy_type_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date,
                     sum_insured, premium_total, commission_amount, currency, details, created_by)
SELECT v.id, v.num, v.client, pr.id, (SELECT pt.id FROM policy_types pt WHERE pt.product_id = pr.id ORDER BY pt.id LIMIT 1), ic.id,
       (SELECT id FROM users WHERE username = 'BrokerVerse'), v.status, current_date + v.incep, current_date + v.incep + 364,
       v.si, v.prem, round(v.prem * 0.15, 2), 'PHP', jsonb_build_object('businessType', 'New Business', 'source', 'seed'), 'seed'
FROM (VALUES
 -- active terms used for claims
 ('pol_crs_01','POL-2026-90001','cl_crs_01','MOTOR','MAPFRE',   'active', -250,  1250000, 38750.00),
 ('pol_crs_02','POL-2026-90002','cl_crs_02','FIRE', 'MALAYAN',  'active', -200, 45000000,142500.00),
 ('pol_crs_03','POL-2026-90003','cl_crs_03','MOTOR','PIONEER',  'active', -150,   980000, 30380.00),
 ('pol_crs_04','POL-2026-90004','cl_crs_04','MOTOR','STANDARD', 'active', -300,  1650000, 51150.00),
 ('pol_crs_05','POL-2026-90005','cl_crs_05','MARINE','FPG',     'active', -120, 12000000, 64800.00),
 ('pol_crs_06','POL-2026-90006','cl_crs_08','FIRE', 'MERCANTILE','active',-180, 60000000,168000.00),
 -- terms expiring soon (renewal pipeline)
 ('pol_crs_11','POL-2025-90011','cl_crs_01','CTPL', 'MAPFRE',   'active', -353,        0,  1650.00),
 ('pol_crs_12','POL-2025-90012','cl_crs_03','FIRE', 'MALAYAN',  'active', -345,  8500000, 26350.00),
 ('pol_crs_13','POL-2025-90013','cl_crs_04','PA',   'PIONEER',  'active', -337,  1000000,  4850.00),
 ('pol_crs_14','POL-2025-90014','cl_crs_05','MOTOR','FPG',      'active', -330,  2200000, 68200.00),
 ('pol_crs_15','POL-2025-90015','cl_crs_07','MOTOR','STANDARD', 'active', -320,   890000, 27590.00),
 ('pol_crs_16','POL-2025-90016','cl_crs_09','MOTOR','MAPFRE',   'active', -310,  1150000, 35650.00),
 ('pol_crs_17','POL-2025-90017','cl_crs_10','CGL',  'MALAYAN',  'active', -295,  5000000, 21500.00),
 ('pol_crs_18','POL-2025-90018','cl_crs_02','MOTOR','PIONEER',  'active', -280,  3400000,105400.00),
 ('pol_crs_19','POL-2025-90019','cl_crs_06','MOTOR','MERCANTILE','active',-357,   760000, 23560.00),
 ('pol_crs_20','POL-2025-90020','cl_crs_08','PA',   'FPG',      'active', -372,  2000000,  9700.00),
 ('pol_crs_21','POL-2025-90021','cl_crs_10','MOTOR','STANDARD', 'expired',-379,  1300000, 40300.00),
 ('pol_crs_22','POL-2025-90022','cl_crs_09','FIRE', 'MERCANTILE','expired',-415, 3500000, 11200.00),
 -- a term already renewed (old) and its renewal term (new)
 ('pol_crs_23','POL-2025-90023','cl_crs_07','PA',   'PIONEER',  'renewed', -372,  500000,  2600.00),
 ('pol_crs_24','POL-2026-90024','cl_crs_07','PA',   'PIONEER',  'active',    -7,  500000,  2750.00)
) AS v(id, num, client, product, insurer, status, incep, si, prem)
JOIN products pr ON pr.code = v.product
JOIN insurance_companies ic ON ic.code = v.insurer
ON CONFLICT (id) DO NOTHING;
UPDATE policies SET renewed_to = 'pol_crs_24' WHERE id = 'pol_crs_23' AND renewed_to IS NULL;
UPDATE policies SET renewed_from = 'pol_crs_23', details = details || '{"businessType": "Renewal"}' WHERE id = 'pol_crs_24' AND renewed_from IS NULL;

-- Premium receivables: paid for most terms, unpaid on two (claims acceptance control demo, payment status in batches)
INSERT INTO receivables(id, bill_number, policy_id, client_id, amount, balance, due_date, status)
SELECT 'rcv_crs_' || substr(p.id, 9), 'INV-' || substr(p.policy_number, 5), p.id, p.client_id, p.premium_total,
       CASE WHEN p.id IN ('pol_crs_03', 'pol_crs_16') THEN p.premium_total ELSE 0 END, p.inception_date + 30,
       CASE WHEN p.id IN ('pol_crs_03', 'pol_crs_16') THEN 'open' ELSE 'paid' END
FROM policies p WHERE p.id LIKE 'pol_crs_%'
ON CONFLICT (id) DO NOTHING;
