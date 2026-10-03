-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Fictional insurers (quote Share dialog) and a linked sample: lead -> client -> quotation -> policy -> receivable ->
-- receipt -> commission, endorsements. All people and companies are fictional. Idempotent by fixed id.

-- ---------- Insurers listed in the quote Share > Send to insurer dialog (fictional) ----------
INSERT INTO insurance_companies(code, name, short_name, commission_rate, contact_email, status) VALUES
 ('SECUREGUARD','SecureGuard Insurance','SecureGuard',0.15,'placement@secureguard.example','active'),
 ('APEX','Apex Assurance','Apex',0.16,'placement@apexassurance.example','active'),
 ('LIBERTYSHIELD','Liberty Shield Insurance','Liberty Shield',0.15,'placement@libertyshield.example','active'),
 ('SENTINEL','Sentinel Underwriters','Sentinel',0.14,'placement@sentinel.example','active'),
 ('GOLDENHORIZON','Golden Horizon Assurance','Golden Horizon',0.17,'placement@goldenhorizon.example','active'),
 ('INTEGRITY','Integrity Insurance Co.','Integrity',0.15,'placement@integrity.example','active'),
 ('EVERSAFE','EverSafe Insure','EverSafe',0.15,'placement@eversafe.example','active')
ON CONFLICT (code) DO NOTHING;

-- ---------- Sample: leads ----------
INSERT INTO leads(id, lead_number, lead_type, first_name, last_name, preferred_name, company_name, display_name, email, phone, birth_date, gender,
  house_no, barangay, city, state, country, postal_code, lead_category, lob, product_interest, source, status, owner_user_id, created_by, created_at, updated_at)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.lead.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num,
  CASE WHEN v.co IS NULL THEN 'individual' ELSE 'corporate' END, v.fn, v.ln, v.fn, v.co, COALESCE(v.co, v.fn || ' ' || v.ln), v.email, v.phone,
  CASE WHEN v.age > 0 THEN (current_date - (v.age * 365))::date END, v.gender, v.house, v.brgy, v.city, v.prov, 'Philippines', v.zip, CASE WHEN v.co IS NULL THEN 'Retail' ELSE 'Corporate' END,
  v.lob, v.product, v.src, v.status, (SELECT id FROM users WHERE username = 'BrokerVerse'), (SELECT id FROM users WHERE username = 'BrokerVerse'),
  now() - make_interval(days => v.ago), now() - make_interval(days => v.ago)
FROM (VALUES
 ('ld_sls_01','95001','Miguel','Aquino',NULL,'miguel.aquino@example.ph','+639171110001',34,'Male','14 Jupiter St.','Bel-Air','Makati','Metro Manila','1209','MOTOR','Motor','Referral','Converted',175),
 ('ld_sls_02','95002','Kristine','Soriano',NULL,'kristine.soriano@example.ph','+639171110002',29,'Female','8 Kamias Rd.','Diliman','Quezon City','Metro Manila','1101','MOTOR','Motor','Walk-in','Converted',160),
 ('ld_sls_03','95003','Rafael','Navarro',NULL,'rafael.navarro@example.ph','+639171110003',41,'Male','22 Gorordo Ave.','Lahug','Cebu City','Cebu','6000','MOTOR','Motor','Website','Converted',140),
 ('ld_sls_04','95004',NULL,NULL,'Kalayaan Foods Corp.','procurement@kalayaanfoods.example.ph','+63288110004',0,NULL,'101 Shaw Blvd.','Kapitolyo','Pasig','Metro Manila','1603','FIRE','Fire and Allied Perils','Referral','Converted',120),
 ('ld_sls_05','95005','Bianca','Lorenzo',NULL,'bianca.lorenzo@example.ph','+639171110005',37,'Female','5 Molino Blvd.','Molino','Bacoor','Cavite','4102','MOTOR','Motor','Bank partner','Converted',95),
 ('ld_sls_06','95006',NULL,NULL,'Visayas Cold Chain Inc.','admin@visayascold.example.ph','+63322340006',0,NULL,'Pier 3 Rd.','Banilad','Mandaue','Cebu','6014','IAR','Industrial All Risks','Referral','Converted',70),
 ('ld_sls_07','95007','Paolo','Fernandez',NULL,'paolo.fernandez@example.ph','+639171110007',45,'Male','3 Iznart St.','Jaro','Iloilo City','Iloilo','5000','MOTOR','Motor','Website','Converted',45),
 ('ld_sls_08','95008','Angela','Ramos',NULL,'angela.ramos@example.ph','+639171110008',31,'Female','77 Lacson St.','Mandalagan','Bacolod','Negros Occidental','6100','FIRE','Fire and Allied Perils','Walk-in','Converted',20),
 ('ld_sls_09','95009','Dennis','Castillo',NULL,'dennis.castillo@example.ph','+639171110009',38,'Male','19 Ayala Ave.','San Lorenzo','Makati','Metro Manila','1223','MOTOR','Motor','Website','QuoteGenerated',12),
 ('ld_sls_10','95010','Jasmine','Villareal',NULL,'jasmine.villareal@example.ph','+639171110010',27,'Female','2 Aurora Blvd.','Cubao','Quezon City','Metro Manila','1109','MOTOR','Motor','Referral','QuoteGenerated',10),
 ('ld_sls_11','95011',NULL,NULL,'Pampanga Steelworks Inc.','finance@pampangasteel.example.ph','+63459610011',0,NULL,'Km 67 MacArthur Hwy.','Dolores','San Fernando','Pampanga','2000','FIRE','Fire and Allied Perils','Referral','QuoteGenerated',9),
 ('ld_sls_12','95012','Enrique','Tolentino',NULL,'enrique.tolentino@example.ph','+639171110012',52,'Male','40 Balibago Rd.','Balibago','Santa Rosa','Laguna','4026','MOTOR','Motor','Bank partner','QuoteGenerated',7),
 ('ld_sls_13','95013','Camille','Robles',NULL,'camille.robles@example.ph','+639171110013',33,'Female','11 Taft Ave.','Malate','Manila','Metro Manila','1004','MOTOR','Motor','Website','QuoteGenerated',5),
 ('ld_sls_14','95014',NULL,NULL,'Davao Agro Processing Corp.','ops@davaoagro.example.ph','+63822270014',0,NULL,'8 Quirino Ave.','Poblacion District','Davao City','Davao del Sur','8000','IAR','Industrial All Risks','Referral','QuoteGenerated',4),
 ('ld_sls_15','95015','Ricardo','Salazar',NULL,'ricardo.salazar@example.ph','+639171110015',48,'Male','6 Rizal St.','Santo Rosario','Malolos','Bulacan','3000','MOTOR','Motor','Walk-in','New',2),
 ('ld_sls_16','95016','Therese','Manalo',NULL,NULL,'+639171110016',26,'Female','9 P. Burgos St.','Poblacion','Batangas City','Batangas','4200','MOTOR','Motor','Website','Lost',30)
) AS v(id, num, fn, ln, co, email, phone, age, gender, house, brgy, city, prov, zip, lob, product, src, status, ago)
ON CONFLICT (id) DO NOTHING;

-- ---------- Sample: clients (converted leads + two direct clients) ----------
INSERT INTO clients(id, client_code, client_type, first_name, last_name, preferred_name, company_name, display_name, email, phone, birth_date, gender,
  house_no, barangay, city, state, country, postal_code, lead_id, lead_category, source, status, owner_user_id, created_by, created_at)
SELECT 'cl_sls_' || right(l.id, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.client.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || right(l.lead_number, 5),
  l.lead_type, l.first_name, l.last_name, l.preferred_name, l.company_name, l.display_name, l.email, l.phone, l.birth_date, l.gender, l.house_no, l.barangay, l.city, l.state,
  l.country, l.postal_code, l.id, l.lead_category, 'lead', 'active', l.owner_user_id, l.created_by, l.created_at + interval '5 days'
FROM leads l WHERE l.id IN ('ld_sls_01','ld_sls_02','ld_sls_03','ld_sls_04','ld_sls_05','ld_sls_06','ld_sls_07','ld_sls_08')
ON CONFLICT (id) DO NOTHING;
INSERT INTO clients(id, client_code, client_type, first_name, last_name, company_name, display_name, email, phone, city, state, country, postal_code, lead_category, source, status, owner_user_id, created_by)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.client.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num, v.t, v.fn, v.ln, v.co,
  COALESCE(v.co, v.fn || ' ' || v.ln), v.email, v.phone, v.city, v.prov, 'Philippines', v.zip, v.cat, 'Walk-in', 'active',
  (SELECT id FROM users WHERE username = 'BrokerVerse'), (SELECT id FROM users WHERE username = 'BrokerVerse')
FROM (VALUES ('cl_sls_91','95091','individual','Lourdes','Pascual',NULL,'lourdes.pascual@example.ph','+639171110091','Taguig','Metro Manila','1634','Retail'),
             ('cl_sls_92','95092','corporate',NULL,NULL,'Northstar BPO Services Inc.','hr@northstarbpo.example.ph','+63288110092','Makati','Metro Manila','1210','Corporate')) AS v(id, num, t, fn, ln, co, email, phone, city, prov, zip, cat)
ON CONFLICT (id) DO NOTHING;
UPDATE leads l SET client_id = c.id FROM clients c WHERE c.lead_id = l.id AND l.id LIKE 'ld_sls_%' AND l.client_id IS NULL;

-- ---------- Sample: quotations (premiums from the tax rates in settings) ----------
WITH rate AS (
  SELECT (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key = 'tax.vat_rate') AS vat, (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key = 'tax.dst_rate') AS dst,
         (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key = 'tax.lgt_rate') AS lgt, (SELECT (value#>>'{}')::numeric FROM app_settings WHERE key = 'tax.fst_rate') AS fst
), v(id, num, lead, status, lob, product, ptype, insurer, si, rpct, brand, model, yr, plate, ago) AS (VALUES
 ('qt_sls_01','95001','ld_sls_01','converted','MOTOR','Motor','PC','MALAYAN',1450000,1.60,'Toyota','Fortuner','2023','NBC 1452',170),
 ('qt_sls_02','95002','ld_sls_02','converted','MOTOR','Motor','PC','MAPFRE',980000,1.75,'Honda','City','2024','NDA 2201',155),
 ('qt_sls_03','95003','ld_sls_03','converted','MOTOR','Motor','CV','PIONEER',1600000,1.50,'Ford','Ranger','2022','GAB 3380',135),
 ('qt_sls_04','95004','ld_sls_04','converted','FIRE','Fire and Allied Perils','FIRE-COM','STANDARD',38000000,0.28,NULL,NULL,NULL,NULL,115),
 ('qt_sls_05','95005','ld_sls_05','converted','MOTOR','Motor','PC','FPG',1150000,1.65,'Mitsubishi','Xpander','2024','NEF 5510',90),
 ('qt_sls_06','95006','ld_sls_06','converted','IAR','Industrial All Risks','IAR-STD','MERCANTILE',95000000,0.12,NULL,NULL,NULL,NULL,65),
 ('qt_sls_07','95007','ld_sls_07','converted','MOTOR','Motor','PC','SECUREGUARD',1320000,1.55,'Nissan','Terra','2023','FAB 7721',40),
 ('qt_sls_08','95008','ld_sls_08','converted','FIRE','Fire and Allied Perils','FIRE-RES','APEX',6500000,0.30,NULL,NULL,NULL,NULL,16),
 ('qt_sls_09','95009','ld_sls_09','draft','MOTOR','Motor','PC','MALAYAN',1250000,1.60,'Toyota','Vios','2025','NGG 9001',11),
 ('qt_sls_10','95010','ld_sls_10','sent','MOTOR','Motor','PC','MAPFRE',890000,1.70,'Hyundai','Accent','2024','NHA 1010',9),
 ('qt_sls_11','95011','ld_sls_11','accepted','FIRE','Fire and Allied Perils','FIRE-COM','PIONEER',52000000,0.26,NULL,NULL,NULL,NULL,8),
 ('qt_sls_12','95012','ld_sls_12','submitted','MOTOR','Motor','PC','STANDARD',1750000,1.50,'Isuzu','mu-X','2024','NJK 1212',6),
 ('qt_sls_13','95013','ld_sls_13','approved','MOTOR','Motor','PC','LIBERTYSHIELD',1050000,1.60,'Suzuki','Ertiga','2025','NKL 1313',4),
 ('qt_sls_14','95014','ld_sls_14','rejected','IAR','Industrial All Risks','IAR-STD','FPG',120000000,0.10,NULL,NULL,NULL,NULL,3)
), calc AS (
  SELECT v.*, round(v.si * v.rpct / 100, 2) AS net, ic.id AS ic_id, ic.name AS ic_name, ic.commission_rate AS crate, r.* FROM v CROSS JOIN rate r JOIN insurance_companies ic ON ic.code = v.insurer
)
INSERT INTO quotes(id, quote_number, lead_id, client_id, insurance_company_id, agent_user_id, status, product_type, lob, sum_insured, premium_base, vat, dst, lgt, fst,
  premium_total, commission_rate, commission_amount, currency, valid_until, doc, created_by, created_at, updated_at, customer_accepted_at, approval_sent_to, approval_sent_at, approved_at)
SELECT c.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.quote.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || c.num, c.lead,
  (SELECT cl.id FROM clients cl WHERE cl.lead_id = c.lead), c.ic_id, (SELECT id FROM users WHERE username = 'BrokerVerse'), c.status, c.product, c.lob, c.si, c.net,
  round(c.net * c.vat, 2), round(c.net * c.dst, 2), round(c.net * c.lgt, 2), CASE WHEN c.lob = 'MOTOR' THEN 0 ELSE round(c.net * c.fst, 2) END,
  c.net + round(c.net * c.vat, 2) + round(c.net * c.dst, 2) + round(c.net * c.lgt, 2) + CASE WHEN c.lob = 'MOTOR' THEN 0 ELSE round(c.net * c.fst, 2) END,
  c.crate, round(c.net * c.crate, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'currency.default'), current_date - c.ago + 30,
  CASE WHEN c.lob = 'MOTOR' THEN jsonb_build_object('productType', c.product, 'insurancePolicyType', c.ptype, 'lossAndDamageCoverage', c.si, 'lossAndDamageCoverageRate', c.rpct,
      'lossAndDamageCoveragePremium', c.net, 'plateNumber', c.plate, 'participantDetails', jsonb_build_array(jsonb_build_object('insuranceCompanyName', c.ic_name, 'sharePercentage', 100)),
      'insuranceVehicleDetails', jsonb_build_array(jsonb_build_object('vehicleBrand', c.brand, 'vehicleModel', c.model, 'modelYear', c.yr, 'seatingCapacity', 5)))
    ELSE jsonb_build_object('productType', c.product, 'insurancePolicyType', c.ptype, 'participantDetails', jsonb_build_array(jsonb_build_object('insuranceCompanyName', c.ic_name, 'sharePercentage', 100)),
      'fireRiskDetails', jsonb_build_object('constructionType', 'Class A - Concrete', 'occupancyType', 'Commercial', 'locationAddress', (SELECT house_no || ', ' || city FROM leads WHERE id = c.lead),
        'sumInsured', jsonb_build_object('Building', round(c.si * 0.6), 'OtherContents', round(c.si * 0.4))),
      'firePremiumDetails', jsonb_build_object('rate', c.rpct, 'totalCoverPremium', c.net)) END,
  (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - make_interval(days => c.ago), now() - make_interval(days => GREATEST(c.ago - 3, 0)),
  CASE WHEN c.status IN ('converted','accepted','submitted','approved') THEN now() - make_interval(days => GREATEST(c.ago - 2, 0)) END,
  CASE WHEN c.status <> 'draft' THEN (SELECT email FROM leads WHERE id = c.lead) END, CASE WHEN c.status <> 'draft' THEN now() - make_interval(days => GREATEST(c.ago - 1, 0)) END,
  CASE WHEN c.status = 'approved' THEN now() - interval '1 day' END
FROM calc c
ON CONFLICT (id) DO NOTHING;

-- ---------- Sample: policies from the converted quotations ----------
INSERT INTO policies(id, policy_number, quote_id, client_id, lead_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, issued_date,
  sum_insured, net_premium, premium_total, commission_amount, currency, bill_number, insured_name, product_type, lob, payment_status, payment_method, paid_at, doc, details, created_by, created_at)
SELECT 'pol_sls_' || right(q.id, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.policy.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || right(q.quote_number, 5),
  q.id, q.client_id, q.lead_id, (SELECT id FROM products WHERE code = CASE q.lob WHEN 'MOTOR' THEN 'MOTOR' ELSE 'FIRE' END), q.insurance_company_id, q.created_by, 'active',
  (q.created_at + interval '5 days')::date, (q.created_at + interval '5 days' + interval '1 year')::date, (q.created_at + interval '5 days')::date,
  q.sum_insured, q.premium_base, q.premium_total, q.commission_amount, q.currency,
  (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.invoice.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || right(q.quote_number, 5),
  (SELECT display_name FROM clients WHERE id = q.client_id), q.product_type, q.lob,
  CASE WHEN right(q.id, 2) IN ('01','02','03','04','06') THEN 'Completed' ELSE 'Pending' END, 'Direct Debit',
  CASE WHEN right(q.id, 2) IN ('01','02','03','04','06') THEN q.created_at + interval '6 days' END,
  q.doc - 'participantDetails' || jsonb_build_object('insuranceCompanyName', (SELECT name FROM insurance_companies WHERE id = q.insurance_company_id)),
  jsonb_build_object('netPremium', q.premium_base, 'grossPremium', q.premium_total, 'source', 'seed'), q.created_by, q.created_at + interval '5 days'
FROM quotes q WHERE q.id LIKE 'qt_sls_%' AND q.status = 'converted'
ON CONFLICT (id) DO NOTHING;
UPDATE quotes q SET policy_id = p.id FROM policies p WHERE p.quote_id = q.id AND q.id LIKE 'qt_sls_%' AND q.policy_id IS NULL;

-- ---------- Sample: receivables, receipts, commissions ----------
INSERT INTO receivables(id, bill_number, policy_id, client_id, amount, balance, due_date, status, created_at)
SELECT 'rcv_sls_' || right(p.id, 2), p.bill_number, p.id, p.client_id, p.premium_total, CASE WHEN p.payment_status = 'Completed' THEN 0 ELSE p.premium_total END,
  p.inception_date + (SELECT (value#>>'{}')::int FROM app_settings WHERE key = 'receivables.due_days'), CASE WHEN p.payment_status = 'Completed' THEN 'paid' ELSE 'open' END, p.created_at
FROM policies p WHERE p.id LIKE 'pol_sls_%'
ON CONFLICT (id) DO NOTHING;
INSERT INTO receipts(id, receipt_number, receivable_id, policy_id, client_id, amount, payment_mode, reference_no, received_date, status, created_by, created_at)
SELECT 'or_sls_' || right(p.id, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.receipt.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || right(p.policy_number, 5),
  'rcv_sls_' || right(p.id, 2), p.id, p.client_id, p.premium_total, 'bank-transfer', 'DD-' || right(p.policy_number, 5), p.paid_at::date, 'posted', p.created_by, p.paid_at
FROM policies p WHERE p.id LIKE 'pol_sls_%' AND p.payment_status = 'Completed'
ON CONFLICT (id) DO NOTHING;
INSERT INTO commissions(id, policy_id, quote_id, agent_user_id, basis_amount, rate, amount, withholding, net_amount, status, period, created_at)
SELECT 'cm_sls_' || right(p.id, 2), p.id, p.quote_id, p.owner_user_id, p.net_premium, q.commission_rate, round(p.net_premium * q.commission_rate, 2),
  round(p.net_premium * q.commission_rate * COALESCE((SELECT tc.rate / 100 FROM tax_codes tc WHERE tc.active AND tc.code = (SELECT value#>>'{}' FROM app_settings WHERE key = 'commission.default_wht_code')), 0), 2),
  round(p.net_premium * q.commission_rate, 2) - round(p.net_premium * q.commission_rate * COALESCE((SELECT tc.rate / 100 FROM tax_codes tc WHERE tc.active AND tc.code = (SELECT value#>>'{}' FROM app_settings WHERE key = 'commission.default_wht_code')), 0), 2),
  (SELECT value#>>'{}' FROM app_settings WHERE key = 'commission.initial_status'), to_char(p.inception_date, 'YYYY-MM'), p.created_at
FROM policies p JOIN quotes q ON q.id = p.quote_id WHERE p.id LIKE 'pol_sls_%'
  -- commission accrues only to producers holding a commission-earning role (commission.eligible_roles), never to an administrator
  AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = p.owner_user_id
    AND ro.code IN (SELECT jsonb_array_elements_text(COALESCE((SELECT value FROM app_settings WHERE key = 'commission.eligible_roles'), '["sales"]'::jsonb))))
ON CONFLICT (id) DO NOTHING;

-- ---------- Sample: endorsements ----------
INSERT INTO endorsements(id, endorsement_number, policy_id, client_id, endorsement_type, status, changes, premium_delta, effective_date, endorsement_type_ids,
  completion, completed_at, sent_at, created_by, created_at)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.endorsement.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num, p.id, p.client_id,
  v.etype, v.status, v.changes::jsonb, v.delta, current_date - v.ago, v.ids::jsonb, v.completion::jsonb,
  CASE WHEN v.status = 'completed' THEN now() - make_interval(days => v.ago) END, CASE WHEN v.status IN ('submitted','completed') THEN now() - make_interval(days => v.ago + 1) END,
  p.created_by, now() - make_interval(days => v.ago + 2)
FROM (VALUES
 ('end_sls_01','95001','pol_sls_01','personal-details','completed','{"personalDetails":{"FirstName":"Miguel","LastName":"Aquino","ContactNumber":"+639171119999","City":"Makati"}}',0,20,'[1]','{"notes":"Mobile number updated"}'),
 ('end_sls_02','95002','pol_sls_02','motor-details','draft','{"motorDetails":{"PlateNumber":"NDA 2202","VehicleColor":"Pearl White"}}',0,3,'[2]','{}'),
 ('end_sls_03','95003','pol_sls_03','coverage','submitted','{"coverageChanges":{"BodilyInjury":"300000","Grosspremium":"0"}}',1850,1,'[3]','{}')
) AS v(id, num, pol, etype, status, changes, delta, ago, ids, completion)
JOIN policies p ON p.id = v.pol
ON CONFLICT (id) DO NOTHING;
