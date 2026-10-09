-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Sample clients, policies and bills used by the claims and renewals samples (fictional; idempotent by id): TFS
-- borrowers and fleet owners with Toyota cars (private car and commercial vehicle classes of the motor tariff), a
-- motorcycle CTPL, the compulsory and voluntary credit life of TFS loans, personal accident, group PA and travel.
-- Premiums are priced with the helpers of 84_sales.sql. Dates are relative to the day the seed runs so the pipeline,
-- ageing and grace-period views always have rows.
INSERT INTO clients(id, client_code, client_type, first_name, last_name, company_name, display_name, email, phone, address, city, state, country, postal_code, source, owner_user_id, created_by)
SELECT v.id, v.code, v.ctype, v.fn, v.ln, v.co, COALESCE(v.co, v.fn || ' ' || v.ln), v.email, v.phone, v.addr, v.city, v.state, 'Philippines', v.zip, v.src,
       (SELECT id FROM users WHERE username = 'BrokerVerse'), 'seed'
FROM (VALUES
 ('cl_crs_01','CL-2026-90001','individual','Marivic','Santos',NULL,'marivic.santos@example.ph','+639171234567','12 Mabini St., Brgy. San Antonio','Makati','Metro Manila','1203','Bundling'),
 ('cl_crs_02','CL-2026-90002','corporate',NULL,NULL,'Bayanihan Logistics Corp.','fleet@bayanihanlogistics.example.ph','+63288123456','45 Pioneer St.','Pasig','Metro Manila','1600','Corporate'),
 ('cl_crs_03','CL-2026-90003','individual','Jose','Reyes',NULL,'jose.reyes@example.ph','+639189876543','7 Osmena Blvd.','Cebu City','Cebu','6000','Bundling'),
 ('cl_crs_04','CL-2026-90004','individual','Andrea','Villanueva',NULL,'andrea.villanueva@example.ph','+639205551234','88 Rizal Ave.','Quezon City','Metro Manila','1100','Promo'),
 ('cl_crs_05','CL-2026-90005','corporate',NULL,NULL,'Mindanao Agri Trading Inc.','accounts@mindanaoagri.example.ph','+63822245678','3 J.P. Laurel Ave.','Davao City','Davao del Sur','8000','Corporate'),
 ('cl_crs_06','CL-2026-90006','individual','Ramon','Dela Cruz',NULL,NULL,'+639167770011','21 Burgos St.','Bacolod','Negros Occidental','6100','Credit Life'),
 ('cl_crs_07','CL-2026-90007','individual','Liza','Mendoza',NULL,'liza.mendoza@example.ph','+639178880022','5 Aguinaldo Hwy.','Bacoor','Cavite','4102','Referral'),
 ('cl_crs_08','CL-2026-90008','corporate',NULL,NULL,'Taal Lakeside Resorts Inc.','hr@taallakeside.example.ph','+63437001234','Km 60 Tagaytay-Talisay Rd.','Batangas City','Batangas','4200','Corporate'),
 ('cl_crs_09','CL-2026-90009','individual','Carlo','Bautista',NULL,'carlo.bautista@example.ph','+639199990033','14 Luna St.','Iloilo City','Iloilo','5000','Redemption'),
 ('cl_crs_10','CL-2026-90010','individual','Patricia','Garcia',NULL,'patricia.garcia@example.ph','+639151110044','9 McArthur Hwy.','San Fernando','Pampanga','2000','Bundling')
) AS v(id, code, ctype, fn, ln, co, email, phone, addr, city, state, zip, src)
ON CONFLICT (id) DO NOTHING;

-- Motor terms: Toyota cars and pick-ups (TFS as mortgagee while the loan runs) and a motorcycle CTPL
WITH v(id, num, client, product, ptype, insurer, status, incep, vclass, brand, model, variant, yr, seats, value, ctpl, appa, plate, chassis, engine, loan, ch) AS (VALUES
 -- active terms used for claims
 ('pol_crs_01','POL-2026-90001','cl_crs_01','MOTOR','COMP','PIONEER',   'active', -250,'private_cars',       'Toyota','Vios',    '1.3 XLE CVT', '2025',5,1098000,3,50000,'NDE 1001','MR2B29F30S1090001','2NR-9000101','TFS-2504101','ch_seed_tmk_mkt'),
 ('pol_crs_02','POL-2026-90002','cl_crs_02','MOTOR','COMP','MAAGAP',    'active', -200,'light_medium_trucks','Toyota','Hilux',   '2.4 E 4x2 MT','2025',5,1350000,1,25000,'NFG 2002','MR0HA3CD5S0290002','2GD-9000202','TFS-F-25031','ch_seed_tps_psg'),
 ('pol_crs_03','POL-2026-90003','cl_crs_03','MOTOR','COMP','STRONGHOLD','active', -150,'private_cars',       'Toyota','Fortuner','2.4 G 4x2 AT','2026',7,1890000,3,50000,'GAA 3003','MHFGB8GS4T0390003','2GD-9000303','TFS-2604303','ch_seed_tcb_ceb'),
 ('pol_crs_04','POL-2026-90004','cl_crs_04','MOTOR','COMP','AXA',       'active', -300,'private_cars',       'Toyota','Innova',  '2.8 E AT',    '2025',8,1646000,3,50000,'NDF 4004','MHFJW8EM5S4090004','1GD-9000404','TFS-2504404','ch_seed_tqa_qc'),
 -- terms expiring soon (renewal pipeline)
 ('pol_crs_11','POL-2025-90011','cl_crs_01','CTPL', 'CTPL','MAAGAP',    'active', -353,'motorcycles_tricycles','Yamaha','NMAX',  '155',         '2023',2,0,1,0,'123 AB 45',NULL,NULL,NULL,NULL),
 ('pol_crs_12','POL-2025-90012','cl_crs_03','MOTOR','COMP','PIONEER',   'active', -345,'private_cars',       'Toyota','Vios',    '1.5 G MT',    '2023',5,750000,1,25000,'GAB 1212','MR2B29F31P1090012','2NR-9001212',NULL,NULL),
 ('pol_crs_14','POL-2025-90014','cl_crs_05','MOTOR','COMP','STANDARD',  'active', -330,'light_medium_trucks','Toyota','Hilux',   '2.4 E 4x2 MT','2024',5,1200000,1,25000,'LAD 1414','MR0HA3CD5R0090014','2GD-9001414','TFS-F-24077',NULL),
 ('pol_crs_15','POL-2025-90015','cl_crs_07','MOTOR','COMP','MALAYAN',   'active', -320,'private_cars',       'Toyota','Vios',    '1.3 XLE CVT', '2024',5,900000,1,25000,'NCB 1515','MR2B29F30R1090015','2NR-9001515','TFS-2404515',NULL),
 ('pol_crs_16','POL-2025-90016','cl_crs_09','MOTOR','COMP','PIONEER',   'active', -310,'private_cars',       'Toyota','Innova',  '2.8 E AT',    '2023',8,1150000,1,25000,'FAC 1616','MHFJW8EM2P4090016','1GD-9001616',NULL,NULL),
 ('pol_crs_18','POL-2025-90018','cl_crs_02','MOTOR','COMP','MAAGAP',    'active', -280,'light_medium_trucks','Toyota','Hilux',   '2.4 E 4x2 MT','2024',5,1250000,1,25000,'NFE 1818','MR0HA3CD5R0090018','2GD-9001818','TFS-F-24092',NULL),
 ('pol_crs_19','POL-2025-90019','cl_crs_06','MOTOR','COMP','STRONGHOLD','active', -357,'private_cars',       'Toyota','Vios',    '1.5 G MT',    '2023',5,720000,1,25000,'YAD 1919','MR2B29F31P1090019','2NR-9001919','TFS-2304919',NULL),
 ('pol_crs_21','POL-2025-90021','cl_crs_10','MOTOR','COMP','STANDARD',  'expired',-379,'private_cars',       'Toyota','Fortuner','2.4 G 4x2 AT','2023',7,1600000,1,50000,'CAE 2121','MHFGB8GS4P0092121','2GD-9002121',NULL,NULL),
 ('pol_crs_22','POL-2025-90022','cl_crs_09','MOTOR','COMP','MALAYAN',   'expired',-415,'private_cars',       'Toyota','Vios',    '1.3 XLE CVT', '2022',5,650000,1,25000,'FAB 2222','MR2B29F30N1092222','2NR-9002222',NULL,NULL)
), priced AS (
  SELECT v.*, pg_temp.smp_motor(v.value, v.vclass, v.seats, v.appa, v.ctpl, CASE WHEN v.product = 'MOTOR' THEN 7 END, CASE WHEN v.product = 'MOTOR' THEN 4 END) AS m,
    pg_temp.smp_comm_rate(v.insurer, v.product) AS crate, (SELECT name FROM distribution_channels WHERE id = 'ch_seed_tfs') AS tfs
  FROM v
)
INSERT INTO policies(id, policy_number, client_id, product_id, policy_type_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, issued_date,
                     sum_insured, net_premium, premium_total, commission_amount, currency, insured_name, product_type, lob, channel_id, doc, details, created_by, created_at)
SELECT c.id, c.num, c.client, pr.id, (SELECT pt.id FROM policy_types pt WHERE pt.code = c.ptype), ic.id, (SELECT id FROM users WHERE username = 'BrokerVerse'), c.status,
       current_date + c.incep, current_date + c.incep + 364, current_date + c.incep - 1,
       CASE WHEN c.product = 'CTPL' THEN 100000 ELSE (c.m->>'si')::numeric END, (c.m->>'net')::numeric, (c.m->>'gross')::numeric, round((c.m->>'net')::numeric * c.crate, 2),
       'PHP', (SELECT display_name FROM clients WHERE id = c.client), CASE WHEN c.product = 'CTPL' THEN pr.name ELSE 'Motor' END, 'MOTOR', c.ch,
       jsonb_build_object('productType', CASE WHEN c.product = 'CTPL' THEN pr.name ELSE 'Motor' END, 'insurancePolicyType', c.ptype, 'vehicleType', c.vclass,
         'plateNumber', c.plate, 'chassisNumber', c.chassis, 'motorNumber', c.engine, 'insuranceCompanyName', ic.name,
         'insurerPolicyNumber', upper(left(ic.code, 3)) || '-MC-' || to_char(current_date + c.incep, 'YYYY') || '-' || right(c.num, 6),
         'includeCTPL', c.ctpl > 0, 'ctplTermYears', c.ctpl, 'ctplCoveragePremium', (c.m->>'ctpl')::numeric,
         'cocNumber', upper(left(ic.code, 3)) || lpad(right(c.num, 5), 8, '0'),
         'insuranceVehicleDetails', jsonb_build_array(jsonb_build_object('vehicleType', c.vclass, 'vehicleBrand', c.brand, 'vehicleModel', c.model, 'modelVariant', c.variant,
           'modelYear', c.yr, 'seatingCapacity', c.seats)))
       || CASE WHEN c.product = 'MOTOR' THEN jsonb_build_object('lossAndDamageCoverage', c.value::text, 'lossAndDamageCoverageRate', c.m->>'odRate',
            'lossAndDamageCoveragePremium', (c.m->>'od')::numeric, 'actsOfNatureRate', c.m->>'aonRate', 'actsOfNaturePremium', (c.m->>'aon')::numeric,
            'bodilyInjury', c.m->>'biAmount', 'bodilyInjuryCoveragePremium', (c.m->>'bi')::numeric, 'propertyDamage', c.m->>'pdAmount',
            'propertyDamageCoveragePremium', (c.m->>'pd')::numeric, 'autoPassengerPersonalAccident', c.appa, 'APPAtotalCoverage', (c.m->>'appaTotal')::numeric,
            'APPAcoveragePremium', (c.m->>'appa')::numeric) ELSE '{}'::jsonb END
       || CASE WHEN c.loan IS NOT NULL THEN jsonb_build_object('mortgage', c.tfs, 'mortgageeChannelId', 'ch_seed_tfs', 'loanNumber', c.loan,
            'mortgageeClause', 'Loss, if any, under the own damage and theft sections of this policy shall be payable to ' || c.tfs || ' as mortgagee, as its interest may appear.')
          ELSE '{}'::jsonb END,
       jsonb_build_object('businessType', 'New Business', 'source', 'seed', 'netPremium', (c.m->>'net')::numeric, 'valueAddedTax', (c.m->>'vat')::numeric,
         'documentaryStampTax', (c.m->>'dst')::numeric, 'localGovernmentTax', (c.m->>'lgt')::numeric, 'otherCharges', (c.m->>'others')::numeric, 'grossPremium', (c.m->>'gross')::numeric)
       || CASE c.id WHEN 'pol_crs_01' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-toyotamakati","comsubPct":5},"chain":[]}}'::jsonb
                    WHEN 'pol_crs_03' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-toyotacebu","comsubPct":4},"chain":[]}}'::jsonb
                    WHEN 'pol_crs_12' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-jdelacruz","level":"L1"},"chain":[{"referrerId":"ref-mreyes","level":"L2"}]}}'::jsonb
                    WHEN 'pol_crs_16' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-amendoza","level":"L1"},"chain":[]}}'::jsonb
                    ELSE '{}'::jsonb END,
       'seed', LEAST(now(), (current_date + c.incep - 1 + time '10:00') AT TIME ZONE 'Asia/Manila')
FROM priced c JOIN products pr ON pr.code = c.product JOIN insurance_companies ic ON ic.code = c.insurer
ON CONFLICT (id) DO NOTHING;

-- Credit life of TFS loans (compulsory year 1, voluntary afterwards), personal accident, group PA and travel
WITH v(id, num, client, product, ptype, insurer, status, incep, si, net, members, plan) AS (VALUES
 ('pol_crs_05','POL-2026-90005','cl_crs_06','CL-COMP','',       'AXA',    'active', -120, 820000, 6150.00, 1, 'Loan TFS-2604605, 60 months, decreasing term'),
 ('pol_crs_06','POL-2026-90006','cl_crs_07','PA',     'PA-IND', 'PIONEER','active', -180, 500000, 1500.00, 1, 'Accidental death and disablement, medical reimbursement PHP 50,000'),
 ('pol_crs_07','POL-2026-90007','cl_crs_04','CL-COMP','',       'AXA',    'active', -300,1152200, 8641.50, 1, 'Loan TFS-2504404, 60 months, decreasing term'),
 ('pol_crs_08','POL-2026-90008','cl_crs_01','CL-COMP','',       'AXA',    'active', -250, 768600, 5764.50, 1, 'Loan TFS-2504101, 48 months, decreasing term'),
 ('pol_crs_09','POL-2026-90009','cl_crs_10','CL-VOL', 'DT-SP',  'AXA',    'active',  -60, 640000, 4160.00, 1, 'Loan TFS-2404210, year 2 of 5, voluntary single premium'),
 ('pol_crs_13','POL-2025-90013','cl_crs_04','PA',     'PA-IND', 'AXA',    'active', -337,1000000, 3000.00, 1, 'Accidental death and disablement, medical reimbursement PHP 100,000'),
 ('pol_crs_17','POL-2025-90017','cl_crs_10','TRAVEL', 'TRV-ANN','AXA',    'active', -295,3000000, 2500.00, 1, 'Asia annual multi-trip, medical PHP 3,000,000'),
 ('pol_crs_20','POL-2025-90020','cl_crs_08','GPA',    'GRP-STD','PIONEER','active', -372,10000000,17500.00,40, '40 resort staff at PHP 250,000 each'),
 -- a term already renewed (old) and its renewal term (new)
 ('pol_crs_23','POL-2025-90023','cl_crs_07','PA',     'PA-IND', 'PIONEER','renewed',-372, 500000, 1500.00, 1, 'Accidental death and disablement'),
 ('pol_crs_24','POL-2026-90024','cl_crs_07','PA',     'PA-IND', 'PIONEER','active',   -7, 500000, 1650.00, 1, 'Accidental death and disablement, medical reimbursement PHP 50,000')
), priced AS (
  SELECT v.*, pg_temp.smp_price(v.product, v.net) AS m, pg_temp.smp_comm_rate(v.insurer, v.product) AS crate FROM v
)
INSERT INTO policies(id, policy_number, client_id, product_id, policy_type_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, issued_date,
                     sum_insured, net_premium, premium_total, commission_amount, currency, insured_name, product_type, lob, doc, details, created_by, created_at)
SELECT c.id, c.num, c.client, pr.id, (SELECT pt.id FROM policy_types pt WHERE pt.code = c.ptype), ic.id, (SELECT id FROM users WHERE username = 'BrokerVerse'), c.status,
       current_date + c.incep, current_date + c.incep + 364, current_date + c.incep - 1, c.si, c.net, (c.m->>'gross')::numeric, round(c.net * c.crate, 2), 'PHP',
       (SELECT display_name FROM clients WHERE id = c.client), pr.name, CASE WHEN pr.line = 'life' THEN 'LIFE' ELSE 'ACCIDENT' END,
       jsonb_build_object('productType', pr.name, 'insurancePolicyType', NULLIF(c.ptype, ''), 'insuranceCompanyName', ic.name, 'totalSumInsured', c.si,
         'insurerPolicyNumber', upper(left(ic.code, 3)) || CASE WHEN pr.line = 'life' THEN '-CL-' ELSE '-PA-' END || to_char(current_date + c.incep, 'YYYY') || '-' || right(c.num, 6),
         CASE WHEN pr.line = 'life' THEN 'creditLifeDetails' ELSE 'accidentDetails' END, jsonb_build_object('memberCount', c.members, 'plan', c.plan)
           || CASE WHEN pr.line = 'life' THEN jsonb_build_object('loanAmount', c.si, 'beneficiary', (SELECT name FROM distribution_channels WHERE id = 'ch_seed_tfs')) ELSE '{}'::jsonb END),
       jsonb_build_object('businessType', CASE WHEN c.id = 'pol_crs_24' THEN 'Renewal' ELSE 'New Business' END, 'source', 'seed', 'netPremium', c.net,
         'valueAddedTax', (c.m->>'vat')::numeric, 'documentaryStampTax', (c.m->>'dst')::numeric, 'localGovernmentTax', (c.m->>'lgt')::numeric,
         'otherCharges', (c.m->>'others')::numeric, 'grossPremium', (c.m->>'gross')::numeric)
       || CASE c.id WHEN 'pol_crs_20' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-rbautista","level":"L1"},"chain":[{"referrerId":"ref-lgarcia","level":"L2"}]}}'::jsonb
                    WHEN 'pol_crs_06' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-pvillanueva","level":"L1"},"chain":[]}}'::jsonb
                    ELSE '{}'::jsonb END,
       'seed', LEAST(now(), (current_date + c.incep - 1 + time '10:00') AT TIME ZONE 'Asia/Manila')
FROM priced c JOIN products pr ON pr.code = c.product JOIN insurance_companies ic ON ic.code = c.insurer
ON CONFLICT (id) DO NOTHING;
UPDATE policies SET renewed_to = 'pol_crs_24' WHERE id = 'pol_crs_23' AND renewed_to IS NULL;
UPDATE policies SET renewed_from = 'pol_crs_23' WHERE id = 'pol_crs_24' AND renewed_from IS NULL;

-- Premium bills: paid for most terms, unpaid on two (claims acceptance control demo, payment status in batches), half
-- paid on the fleet account that pays by post-dated cheques; billed on the inception date, due 30 days later
INSERT INTO receivables(id, bill_number, policy_id, client_id, amount, balance, due_date, status, source, currency, net_premium, vat, dst, lgt, other_charges, created_at)
SELECT 'rcv_crs_' || substr(p.id, 9), 'INV-' || substr(p.policy_number, 5), p.id, p.client_id, p.premium_total,
       CASE WHEN p.id IN ('pol_crs_03', 'pol_crs_16') THEN p.premium_total WHEN p.id = 'pol_crs_02' THEN p.premium_total - round(p.premium_total / 2, 2) ELSE 0 END, p.inception_date + 30,
       CASE WHEN p.id IN ('pol_crs_03', 'pol_crs_16') THEN 'open' WHEN p.id = 'pol_crs_02' THEN 'partial' ELSE 'paid' END, CASE WHEN p.renewed_from IS NOT NULL THEN 'renewal' ELSE 'policy' END, p.currency,
       p.net_premium, (p.details->>'valueAddedTax')::numeric, (p.details->>'documentaryStampTax')::numeric, (p.details->>'localGovernmentTax')::numeric,
       (p.details->>'otherCharges')::numeric, p.inception_date::timestamptz
FROM policies p WHERE p.id LIKE 'pol_crs_%'
ON CONFLICT (id) DO NOTHING;
UPDATE policies p SET bill_number = r.bill_number, payment_status = CASE r.status WHEN 'paid' THEN 'Completed' WHEN 'partial' THEN 'Partial' ELSE 'Pending' END
FROM receivables r WHERE r.policy_id = p.id AND p.id LIKE 'pol_crs_%' AND p.bill_number IS NULL;
