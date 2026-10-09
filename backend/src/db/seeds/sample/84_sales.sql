-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- TISPH sales sample: prospects (most referred by Toyota Financial Services for the Toyota cars it finances, a few not
-- yet tagged with a product), the clients they became, quotations, the policies booked from them (Motor with the motor
-- tariff of the product configurator, Group PA and Personal Accident), their bills, receipts and endorsements, and the
-- account executives' sales activities. Two of the policies are booked in the current month, so the dashboards of the
-- month have new business. All people and companies are fictional. Idempotent by fixed id.

-- ---------- Pricing helpers (session-local, also used by the later sample files) ----------
-- The premium tax and charge engine (Master > Premium Taxes & LGU Rates): the amount of one kind of tax on a net premium
-- of a product, from the rules in force today (VAT or premium tax by the product's tax regime, DST per unit with the
-- fraction counted as a whole unit, LGT at the rule rate, FST on fire lines), each rounded to the centavo.
CREATE OR REPLACE FUNCTION pg_temp.smp_tax(p_net numeric, p_product text, p_kind text) RETURNS numeric LANGUAGE sql AS $$
  SELECT COALESCE(sum(GREATEST(CASE r.method
      WHEN 'percent' THEN round(p_net * r.rate / 100, 2)
      WHEN 'per_unit' THEN CASE WHEN r.unit_size > 0 THEN round(ceil(p_net / r.unit_size - 0.000000001) * r.unit_amount, 2) ELSE 0 END
      ELSE round(r.unit_amount, 2) END, r.minimum_amount)), 0)
  FROM premium_charge_rules r JOIN products p ON upper(p.code) = upper(p_product)
  WHERE p_net > 0 AND r.active AND r.kind = p_kind AND r.effective_from <= current_date AND (r.effective_to IS NULL OR r.effective_to >= current_date)
    AND NOT (COALESCE(p.premium_tax_regime, 'vat') = 'exempt' AND r.kind IN ('vat', 'premium_tax'))
    AND (r.regimes IS NULL OR cardinality(r.regimes) = 0 OR COALESCE(p.premium_tax_regime, 'vat') = ANY(r.regimes))
    AND (r.lines IS NULL OR cardinality(r.lines) = 0 OR p.line = ANY(r.lines)) $$;

-- Premium of a product priced on its net premium: { net, vat, dst, lgt, fst, others, gross } (others: premium tax and other charges).
CREATE OR REPLACE FUNCTION pg_temp.smp_price(p_product text, p_net numeric) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_build_object('net', p_net, 'vat', t.vat, 'dst', t.dst, 'lgt', t.lgt, 'fst', t.fst, 'others', t.others, 'gross', p_net + t.vat + t.dst + t.lgt + t.fst + t.others)
  FROM (SELECT pg_temp.smp_tax(p_net, p_product, 'vat') AS vat, pg_temp.smp_tax(p_net, p_product, 'dst') AS dst, pg_temp.smp_tax(p_net, p_product, 'lgt') AS lgt,
               pg_temp.smp_tax(p_net, p_product, 'fst') AS fst, pg_temp.smp_tax(p_net, p_product, 'premium_tax') + pg_temp.smp_tax(p_net, p_product, 'other') AS others) t $$;

-- Motor premium as the quotation engine prices it on the motor tariff (setting motor.pricing_template_code): own damage
-- and theft at the rate of the vehicle class, acts of nature, excess bodily injury and property damage from the cover
-- master, auto passenger PA (limit per person x seats x rate), and CTPL at the tariff amount of the class (1 or 3
-- years), added to the gross outside the taxable net premium.
CREATE OR REPLACE FUNCTION pg_temp.smp_motor(p_value numeric, p_class text, p_seats int, p_appa numeric, p_ctpl_years int, p_bi int, p_pd int) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE t jsonb; od numeric; aon numeric; bi record; pd record; appa numeric; ctpl numeric; net numeric; p jsonb;
BEGIN
  SELECT config INTO t FROM product_templates WHERE template_code = (SELECT value #>> '{}' FROM app_settings WHERE key = 'motor.pricing_template_code');
  od := round(p_value * COALESCE((t->'premiumRates'->>p_class)::numeric, 0) / 100, 2);
  aon := round(p_value * COALESCE((t->'premiumRates'->>'acts_of_nature')::numeric, 0) / 100, 2);
  SELECT amount, premium INTO bi FROM coverages WHERE id = p_bi;
  SELECT amount, premium INTO pd FROM coverages WHERE id = p_pd;
  appa := round(COALESCE(p_appa, 0) * p_seats * COALESCE((t->'appaSetting'->>'ratePercent')::numeric, 0) / 100, 2);
  ctpl := CASE p_ctpl_years WHEN 3 THEN (t->'ctplSetting3Year'->>p_class)::numeric WHEN 1 THEN (t->'ctplSetting'->>p_class)::numeric ELSE 0 END;
  net := od + aon + COALESCE(bi.premium, 0) + COALESCE(pd.premium, 0) + appa;
  p := pg_temp.smp_price('MOTOR', net);
  RETURN p || jsonb_build_object('gross', (p->>'gross')::numeric + COALESCE(ctpl, 0), 'od', od, 'odRate', (t->'premiumRates'->>p_class)::numeric, 'aon', aon,
    'aonRate', (t->'premiumRates'->>'acts_of_nature')::numeric, 'bi', COALESCE(bi.premium, 0), 'biAmount', COALESCE(bi.amount, 0), 'pd', COALESCE(pd.premium, 0),
    'pdAmount', COALESCE(pd.amount, 0), 'appa', appa, 'appaTotal', COALESCE(p_appa, 0) * p_seats, 'appaRate', (t->'appaSetting'->>'ratePercent')::numeric,
    'ctpl', COALESCE(ctpl, 0), 'si', p_value + COALESCE(bi.amount, 0) + COALESCE(pd.amount, 0) + COALESCE(p_appa, 0) * p_seats);
END $$;

-- Commission rate of a placement (Commission Rate Matrix, else the insurer's rate, else commission.default_rate).
CREATE OR REPLACE FUNCTION pg_temp.smp_comm_rate(p_insurer text, p_product text) RETURNS numeric LANGUAGE sql AS $$
  SELECT COALESCE(
    (SELECT r.rate FROM commission_rates r WHERE r.active AND r.effective_from <= current_date AND (r.effective_to IS NULL OR r.effective_to >= current_date)
        AND (r.insurance_company_id IS NULL OR r.insurance_company_id = ic.id) AND (r.product_id IS NULL OR r.product_id = pr.id)
        AND (r.line_of_business IS NULL OR lower(r.line_of_business) = lower(pr.line)) AND r.policy_type IN ('any', 'new')
      ORDER BY (r.insurance_company_id IS NOT NULL) DESC, (r.product_id IS NOT NULL) DESC, r.effective_from DESC LIMIT 1),
    ic.commission_rate, (SELECT (value #>> '{}')::numeric FROM app_settings WHERE key = 'commission.default_rate'), 0.15)
  FROM insurance_companies ic, products pr WHERE ic.code = p_insurer AND pr.code = p_product $$;

-- ---------- Prospects ----------
-- Toyota Financial Services refers most prospects (channel TFS, with the loan and the dealer in the notes); two are not
-- yet tagged with a product. Lead sources are those of Master > Insurance Management > Lead Sources.
INSERT INTO leads(id, lead_number, lead_type, first_name, last_name, preferred_name, company_name, display_name, email, phone, birth_date, gender,
  house_no, barangay, city, state, country, postal_code, lead_category, lob, product_interest, product_id, source, status, notes, channel_id, branch_code,
  owner_user_id, created_by, created_at, updated_at)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.lead.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num,
  CASE WHEN v.co IS NULL THEN 'individual' ELSE 'corporate' END, v.fn, v.ln, v.fn, v.co, COALESCE(v.co, v.fn || ' ' || v.ln), v.email, v.phone,
  CASE WHEN v.age > 0 THEN (current_date - (v.age * 365))::date END, v.gender, v.house, v.brgy, v.city, v.prov, 'Philippines', v.zip, CASE WHEN v.co IS NULL THEN 'Retail' ELSE 'Corporate' END,
  v.lob, (SELECT name FROM products WHERE code = v.product), (SELECT id FROM products WHERE code = v.product), v.src, v.status, v.notes, v.ch,
  CASE WHEN v.prov = 'Cebu' THEN 'CEB' ELSE 'HO' END, COALESCE((SELECT id FROM users WHERE username = v.owner), (SELECT id FROM users WHERE username = 'BrokerVerse')),
  (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - make_interval(days => v.ago), now() - make_interval(days => v.ago)
FROM (VALUES
 ('ld_sls_01','95001','Miguel','Aquino',NULL,'miguel.aquino@example.ph','+639171110001',34,'Male','14 Jupiter St.','Bel-Air','Makati','Metro Manila','1209','MOTOR','MOTOR','Bundling','Converted',175,'ch_seed_tfs_hq','agent.jdelacruz','TFS loan TFS-2604511, Fortuner from Toyota Makati'),
 ('ld_sls_02','95002','Kristine','Soriano',NULL,'kristine.soriano@example.ph','+639171110002',29,'Female','8 Kamias Rd.','Diliman','Quezon City','Metro Manila','1101','MOTOR','MOTOR','Bundling','Converted',160,'ch_seed_tfs_hq','agent.msantos','TFS loan TFS-2604622, Vios from Toyota Quezon Avenue'),
 ('ld_sls_03','95003','Rafael','Navarro',NULL,'rafael.navarro@example.ph','+639171110003',41,'Male','22 Gorordo Ave.','Lahug','Cebu City','Cebu','6000','MOTOR','MOTOR','Used-Cars - SCR','Converted',140,'ch_seed_tfs_ceb','agent.agarcia','TFS loan TFS-2504733, Hilux (own goods) from Toyota Cebu'),
 ('ld_sls_04','95004',NULL,NULL,'Kalayaan Foods Distribution Corp.','fleet@kalayaanfoods.example.ph','+63288110004',0,NULL,'101 Shaw Blvd.','Kapitolyo','Pasig','Metro Manila','1603','MOTOR','MOTOR','Company Car','Converted',120,'ch_seed_tfs_hq','agent.jdelacruz','Company cars financed by TFS (fleet account TFS-F-26018), Innova from Toyota Pasig'),
 ('ld_sls_05','95005','Bianca','Lorenzo',NULL,'bianca.lorenzo@example.ph','+639171110005',37,'Female','5 Molino Blvd.','Molino','Bacoor','Cavite','4102','MOTOR','MOTOR','Promo','Converted',95,'ch_seed_tfs_hq','agent.preyes','TFS loan TFS-2604855, Vios from Toyota Alabang'),
 ('ld_sls_06','95006',NULL,NULL,'Visayas Cold Chain Inc.','hr@visayascold.example.ph','+63322340006',0,NULL,'Pier 3 Rd.','Banilad','Mandaue','Cebu','6014','ACCIDENT','GPA','Corporate','Converted',70,NULL,'agent.agarcia','Group PA for 30 delivery drivers and helpers'),
 ('ld_sls_07','95007','Paolo','Fernandez',NULL,'paolo.fernandez@example.ph','+639171110007',45,'Male','3 Iznart St.','Jaro','Iloilo City','Iloilo','5000','MOTOR','MOTOR','Redemption','Converted',45,'ch_seed_tfs_hq','agent.msantos','TFS loan TFS-2104966 fully paid; OR/CR released, own cover from now on'),
 ('ld_sls_08','95008','Angela','Ramos',NULL,'angela.ramos@example.ph','+639171110008',31,'Female','77 Lacson St.','Mandalagan','Bacolod','Negros Occidental','6100','ACCIDENT','PA','Walk-In','Converted',20,NULL,'agent.preyes',NULL),
 ('ld_sls_09','95009','Dennis','Castillo',NULL,'dennis.castillo@example.ph','+639171110009',38,'Male','19 Ayala Ave.','San Lorenzo','Makati','Metro Manila','1223','MOTOR','MOTOR','Bundling','QuoteGenerated',12,'ch_seed_tfs_hq','agent.jdelacruz','TFS loan application TFS-2605077, Vios from Toyota Makati'),
 ('ld_sls_10','95010','Jasmine','Villareal',NULL,'jasmine.villareal@example.ph','+639171110010',27,'Female','2 Aurora Blvd.','Cubao','Quezon City','Metro Manila','1109','MOTOR','MOTOR','Promo','QuoteGenerated',10,'ch_seed_tfs_hq','agent.msantos','TFS loan TFS-2605088, Fortuner from Toyota Quezon Avenue'),
 ('ld_sls_11','95011',NULL,NULL,'Pampanga Agri-Supply Trading Inc.','finance@pampangaagri.example.ph','+63459610011',0,NULL,'Km 67 MacArthur Hwy.','Dolores','San Fernando','Pampanga','2000','MOTOR','MOTOR','Corporate','QuoteGenerated',9,'ch_seed_tfs_hq','agent.jdelacruz','Delivery pick-up financed by TFS (TFS-2605099)'),
 ('ld_sls_12','95012','Enrique','Tolentino',NULL,'enrique.tolentino@example.ph','+639171110012',52,'Male','40 Balibago Rd.','Balibago','Santa Rosa','Laguna','4026','MOTOR','MOTOR','Bundling','QuoteGenerated',7,'ch_seed_tal_alb','agent.preyes','Toyota Alabang sale TAL-SI-26-0412 financed by TFS (TFS-2605110)'),
 ('ld_sls_13','95013','Camille','Robles',NULL,'camille.robles@example.ph','+639171110013',33,'Female','11 Taft Ave.','Malate','Manila','Metro Manila','1004','MOTOR','MOTOR','Social Media / Website','QuoteGenerated',5,NULL,'agent.msantos','Cash buyer, Vios'),
 ('ld_sls_14','95014',NULL,NULL,'Davao Agro Processing Corp.','hr@davaoagro.example.ph','+63822270014',0,NULL,'8 Quirino Ave.','Poblacion District','Davao City','Davao del Sur','8000','ACCIDENT','GPA','Corporate','QuoteGenerated',4,NULL,'agent.jmartinez','Group PA for 60 plant workers'),
 ('ld_sls_15','95015','Ricardo','Salazar',NULL,'ricardo.salazar@example.ph','+639171110015',48,'Male','6 Rizal St.','Santo Rosario','Malolos','Bulacan','3000','MOTOR','MOTOR','Bundling','New',2,'ch_seed_tfs_hq','agent.jdelacruz','TFS loan application TFS-2605121, Fortuner from Toyota Quezon Avenue'),
 ('ld_sls_16','95016','Therese','Manalo',NULL,NULL,'+639171110016',26,'Female','9 P. Burgos St.','Poblacion','Batangas City','Batangas','4200','MOTOR','MOTOR','Social Media / Website','Lost',30,NULL,'agent.preyes','Insured through the dealer''s in-house agent'),
 ('ld_sls_17','95017','Ronaldo','Pascual',NULL,'ronaldo.pascual@example.ph','+639171110017',44,'Male','27 Pasig Blvd.','Bagong Ilog','Pasig','Metro Manila','1600','MOTOR','MOTOR','Bundling','QuoteGenerated',16,'ch_seed_tfs_hq','agent.jdelacruz','TFS loan TFS-2605132, Fortuner from Toyota Pasig'),
 ('ld_sls_18','95018','Sheila','Cabrera',NULL,'sheila.cabrera@example.ph','+639171110018',36,'Female','12 C-5 Rd.','Ususan','Taguig','Metro Manila','1630','MOTOR','MOTOR','Promo','QuoteGenerated',14,'ch_seed_tfs_hq','agent.msantos','TFS loan TFS-2605143, Vios from Toyota Makati'),
 ('ld_sls_19','95019','Gilbert','Ong',NULL,'gilbert.ong@example.ph','+639171110019',50,'Male','45 Mango Ave.','Kamputhaw','Cebu City','Cebu','6000','MOTOR','MOTOR','Used-Cars - UCFP','QuoteGenerated',13,'ch_seed_tfs_ceb','agent.agarcia','TFS used-car loan TFS-2605154, Hilux (own goods)'),
 ('ld_sls_20','95020','Marvin','De Leon',NULL,'marvin.deleon@example.ph','+639171110020',30,'Male','88 Visayas Ave.','Vasra','Quezon City','Metro Manila','1128',NULL,NULL,'Bundling','New',1,'ch_seed_tfs_hq','agent.msantos','Referred by TFS on loan approval; product to confirm with the client'),
 ('ld_sls_21','95021','Rowena','Sison',NULL,'rowena.sison@example.ph','+639171110021',42,'Female','5 Alabang-Zapote Rd.','Pamplona Dos','Las Piñas','Metro Manila','1740',NULL,NULL,'Referral','New',3,NULL,'agent.preyes','Referred by agent Pia Villanueva'),
 ('ld_sls_22','95022','Arturo','Villanueva',NULL,'arturo.villanueva@example.ph','+639171110022',58,'Male','31 Dela Rosa St.','Legazpi Village','Makati','Metro Manila','1229','LIFE','CL-VOL','Credit Life','Contacted',6,'ch_seed_tfs_hq','agent.jdelacruz','Compulsory credit life of TFS loan TFS-2504399 ends with year 1; offer the voluntary cover'),
 ('ld_sls_23','95023','Katrina','Lim',NULL,'katrina.lim@example.ph','+639171110023',29,'Female','18 Shaw Blvd.','Wack-Wack','Mandaluyong','Metro Manila','1555','ACCIDENT','TRAVEL','Social Media / Website','Contacted',8,NULL,'agent.msantos','Annual multi-trip travel cover for Asia')
) AS v(id, num, fn, ln, co, email, phone, age, gender, house, brgy, city, prov, zip, lob, product, src, status, ago, ch, owner, notes)
ON CONFLICT (id) DO NOTHING;

-- ---------- Clients (converted prospects + two direct clients) ----------
INSERT INTO clients(id, client_code, client_type, first_name, last_name, preferred_name, company_name, display_name, email, phone, birth_date, gender,
  house_no, barangay, city, state, country, postal_code, lead_id, lead_category, source, status, owner_user_id, created_by, created_at)
SELECT 'cl_sls_' || right(l.id, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.client.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || right(l.lead_number, 5),
  l.lead_type, l.first_name, l.last_name, l.preferred_name, l.company_name, l.display_name, l.email, l.phone, l.birth_date, l.gender, l.house_no, l.barangay, l.city, l.state,
  l.country, l.postal_code, l.id, l.lead_category, 'lead', 'active', (SELECT id FROM users WHERE username = 'BrokerVerse'), l.created_by, l.created_at + interval '5 days'
FROM leads l WHERE l.id IN ('ld_sls_01','ld_sls_02','ld_sls_03','ld_sls_04','ld_sls_05','ld_sls_06','ld_sls_07','ld_sls_08')
ON CONFLICT (id) DO NOTHING;
INSERT INTO clients(id, client_code, client_type, first_name, last_name, company_name, display_name, email, phone, city, state, country, postal_code, lead_category, source, status, owner_user_id, created_by)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.client.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num, v.t, v.fn, v.ln, v.co,
  COALESCE(v.co, v.fn || ' ' || v.ln), v.email, v.phone, v.city, v.prov, 'Philippines', v.zip, v.cat, v.src, 'active',
  (SELECT id FROM users WHERE username = 'BrokerVerse'), (SELECT id FROM users WHERE username = 'BrokerVerse')
FROM (VALUES ('cl_sls_91','95091','individual','Lourdes','Pascual',NULL,'lourdes.pascual@example.ph','+639171110091','Taguig','Metro Manila','1634','Retail','Walk-In'),
             ('cl_sls_92','95092','corporate',NULL,NULL,'Northstar BPO Services Inc.','admin@northstarbpo.example.ph','+63288110092','Makati','Metro Manila','1210','Corporate','Corporate')) AS v(id, num, t, fn, ln, co, email, phone, city, prov, zip, cat, src)
ON CONFLICT (id) DO NOTHING;
UPDATE leads l SET client_id = c.id FROM clients c WHERE c.lead_id = l.id AND l.id LIKE 'ld_sls_%' AND l.client_id IS NULL;

-- ---------- Motor quotations (Toyota vehicles of the vehicle master; the dealer and TFS loan on the quotation) ----------
WITH v(id, num, lead, status, insurer, vclass, model, variant, yr, seats, color, price, ctpl, appa, plate, chassis, engine, ch, loan, loan_amount, ago) AS (VALUES
 ('qt_sls_01','95001','ld_sls_01','converted','PIONEER',   'private_cars',       'Fortuner','2.4 G 4x2 AT', '2026',7,'Attitude Black',1890000,3,50000,'NBC 1452','MHFGB8GS4R0901452','2GD-1452901','ch_seed_tmk_mkt','TFS-2604511',1323000,170),
 ('qt_sls_02','95002','ld_sls_02','converted','MAAGAP',    'private_cars',       'Vios',    '1.3 XLE CVT',  '2026',5,'Silver Metallic',1098000,3,50000,'NDA 2201','MR2B29F30R1022201','2NR-0222011','ch_seed_tqa_qc','TFS-2604622',768600,155),
 ('qt_sls_03','95003','ld_sls_03','converted','STRONGHOLD','light_medium_trucks','Hilux',   '2.4 E 4x2 MT', '2025',5,'Super White',1350000,1,25000,'GAB 3380','MR0HA3CD5S0303380','2GD-3380303','ch_seed_tcb_ceb','TFS-2504733',945000,135),
 ('qt_sls_04','95004','ld_sls_04','converted','AXA',       'private_cars',       'Innova',  '2.8 E AT',     '2026',8,'Silver Metallic',1646000,1,50000,'NCF 4404','MHFJW8EM5R4044404','1GD-4404044','ch_seed_tps_psg','TFS-F-26018',1152200,115),
 ('qt_sls_05','95005','ld_sls_05','converted','MALAYAN',   'private_cars',       'Vios',    '1.5 G MT',     '2026',5,'Red Mica',937000,3,25000,'NEF 5510','MR2B29F31R1055510','2NR-5510551','ch_seed_tal_alb','TFS-2604855',655900,90),
 ('qt_sls_07','95007','ld_sls_07','converted','STANDARD',  'private_cars',       'Innova',  '2.8 E AT',     '2021',8,'Phantom Brown',980000,1,25000,'FAB 7721','MHFJW8EM2M4077721','1GD-7721077',NULL,NULL,NULL,LEAST(40, extract(day FROM current_date)::int + 4)),
 ('qt_sls_09','95009','ld_sls_09','draft',    'MAAGAP',    'private_cars',       'Vios',    '1.3 XLE CVT',  '2026',5,'Grayish Blue',1098000,3,50000,'TBA',NULL,NULL,'ch_seed_tmk_mkt','TFS-2605077',768600,11),
 ('qt_sls_10','95010','ld_sls_10','sent',     'PIONEER',   'private_cars',       'Fortuner','2.4 G 4x2 AT', '2026',7,'White Pearl',1890000,3,50000,'TBA',NULL,NULL,'ch_seed_tqa_qc','TFS-2605088',1323000,9),
 ('qt_sls_11','95011','ld_sls_11','accepted', 'STRONGHOLD','light_medium_trucks','Hilux',   '2.4 E 4x2 MT', '2026',5,'Super White',1365000,3,25000,'TBA','MR0HA3CD5T0311011','2GD-1101131',NULL,'TFS-2605099',955500,8),
 ('qt_sls_12','95012','ld_sls_12','submitted','AXA',       'private_cars',       'Innova',  '2.8 E AT',     '2026',8,'Silver Metallic',1646000,3,50000,'TBA','MHFJW8EM5T4121212','1GD-1212121','ch_seed_tal_alb','TFS-2605110',1152200,6),
 ('qt_sls_13','95013','ld_sls_13','approved', 'MALAYAN',   'private_cars',       'Vios',    '1.5 G MT',     '2026',5,'Red Mica',937000,3,25000,'TBA','MR2B29F31T1131313','2NR-1313131',NULL,NULL,NULL,4),
 ('qt_sls_17','95017','ld_sls_17','submitted','MAAGAP',    'private_cars',       'Fortuner','2.4 G 4x2 AT', '2026',7,'Gray Metallic',1890000,3,50000,'TBA','MHFGB8GS4T0917017','2GD-1717017','ch_seed_tps_psg','TFS-2605132',1323000,15),
 ('qt_sls_18','95018','ld_sls_18','submitted','PIONEER',   'private_cars',       'Vios',    '1.3 XLE CVT',  '2026',5,'Silver Metallic',1098000,3,50000,'NIA 1818','MR2B29F30T1181818','2NR-1818181','ch_seed_tmk_mkt','TFS-2605143',768600,13),
 ('qt_sls_19','95019','ld_sls_19','submitted','STRONGHOLD','light_medium_trucks','Hilux',   '2.4 E 4x2 MT', '2023',5,'Super White',980000,1,25000,'GAD 1919','MR0HA3CD5P0191919','2GD-1919191','ch_seed_tcb_ceb','TFS-2605154',686000,12)
), priced AS (
  SELECT v.*, pg_temp.smp_motor(v.price, v.vclass, v.seats, v.appa, v.ctpl, 7, 4) AS m, ic.id AS ic_id, ic.name AS ic_name, pg_temp.smp_comm_rate(v.insurer, 'MOTOR') AS crate,
    (SELECT name FROM distribution_channels WHERE id = 'ch_seed_tfs') AS tfs, (SELECT name FROM distribution_channels WHERE id = v.ch) AS dealer
  FROM v JOIN insurance_companies ic ON ic.code = v.insurer
)
INSERT INTO quotes(id, quote_number, lead_id, client_id, product_id, policy_type_id, insurance_company_id, agent_user_id, status, product_type, lob, sum_insured, premium_base,
  vat, dst, lgt, fst, others, premium_total, commission_rate, commission_amount, currency, valid_until, doc, channel_id, created_by, created_at, updated_at, customer_accepted_at,
  approval_sent_to, approval_sent_at, submitted_to_insurer_at, approved_at)
SELECT c.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.quote.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || c.num, c.lead,
  (SELECT cl.id FROM clients cl WHERE cl.lead_id = c.lead), (SELECT id FROM products WHERE code = 'MOTOR'), (SELECT id FROM policy_types WHERE code = 'COMP'), c.ic_id,
  (SELECT id FROM users WHERE username = 'BrokerVerse'), c.status, 'Motor', 'MOTOR', (c.m->>'si')::numeric, (c.m->>'net')::numeric,
  (c.m->>'vat')::numeric, (c.m->>'dst')::numeric, (c.m->>'lgt')::numeric, (c.m->>'fst')::numeric, (c.m->>'others')::numeric, (c.m->>'gross')::numeric,
  c.crate, round((c.m->>'net')::numeric * c.crate, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'currency.default'), current_date - c.ago + 30,
  jsonb_build_object('productType', 'Motor', 'insurancePolicyType', 'COMP', 'leadRefId', c.lead, 'isCoInsurance', false, 'vehicleType', c.vclass,
    'lossAndDamageCoverage', c.price::text, 'lossAndDamageCoverageRate', (c.m->>'odRate'), 'lossAndDamageCoveragePremium', (c.m->>'od')::numeric,
    'actsOfNatureRate', (c.m->>'aonRate'), 'actsOfNaturePremium', (c.m->>'aon')::numeric,
    'includeCTPL', c.ctpl > 0, 'ctplTermYears', c.ctpl, 'ctplCoveragePremium', (c.m->>'ctpl')::numeric, 'ctplCoverageRate', to_char((c.m->>'ctpl')::numeric, 'FM999990.00'),
    'biCoverageId', 7, 'bodilyInjury', (c.m->>'biAmount'), 'bodilyInjuryCoveragePremium', (c.m->>'bi')::numeric,
    'pdCoverageId', 4, 'propertyDamage', (c.m->>'pdAmount'), 'propertyDamageCoveragePremium', (c.m->>'pd')::numeric,
    'autoPassengerPersonalAccident', c.appa, 'appaSeats', c.seats, 'APPAtotalCoverage', (c.m->>'appaTotal')::numeric, 'APPARate', (c.m->>'appaRate')::numeric,
    'APPAcoveragePremium', (c.m->>'appa')::numeric, 'totalSumInsured', (c.m->>'si')::numeric, 'netPremium', (c.m->>'net')::numeric, 'valueAddedTax', (c.m->>'vat')::numeric,
    'documentaryStampTax', (c.m->>'dst')::numeric, 'localGovernmentTax', (c.m->>'lgt')::numeric, 'fireServiceTax', 0, 'accountPremiumOthers', (c.m->>'others')::numeric,
    'discount', 0, 'grossPremium', (c.m->>'gross')::numeric, 'commissionRate', c.crate, 'commissionAmount', round((c.m->>'net')::numeric * c.crate, 2),
    'plateNumber', c.plate, 'chassisNumber', c.chassis, 'motorNumber', c.engine, 'brandNew', c.yr::int >= extract(year FROM current_date)::int,
    'insuranceVehicleDetails', jsonb_build_array(jsonb_build_object('vehicleType', c.vclass, 'vehicleBrand', 'Toyota', 'vehicleModel', c.model, 'modelVariant', c.variant,
      'modelYear', c.yr, 'vehicleColor', c.color, 'seatingCapacity', c.seats)),
    'participantDetails', jsonb_build_array(jsonb_build_object('insuranceCompanyName', c.ic_name, 'participantName', c.ic_name, 'insuranceCompanyId', c.ic_id,
      'sharePercentage', '100', 'isLead', true, 'sumInsuredCurrency', 'PHP', 'premiumCurrency', 'PHP')))
  || CASE WHEN c.loan IS NOT NULL THEN jsonb_build_object('mortgage', c.tfs, 'mortgageeChannelId', 'ch_seed_tfs', 'loanNumber', c.loan, 'loanAmount', c.loan_amount,
       'mortgageeClause', 'Loss, if any, under the own damage and theft sections of this policy shall be payable to ' || c.tfs || ' as mortgagee, as its interest may appear.')
     ELSE '{}'::jsonb END
  || CASE WHEN c.dealer IS NOT NULL THEN jsonb_build_object('channelId', c.ch, 'dealerName', c.dealer) ELSE '{}'::jsonb END,
  c.ch, (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - make_interval(days => c.ago), now() - make_interval(days => GREATEST(c.ago - 3, 0)),
  CASE WHEN c.status IN ('converted','accepted','submitted','approved') THEN now() - make_interval(days => GREATEST(c.ago - 2, 0)) END,
  CASE WHEN c.status <> 'draft' THEN (SELECT email FROM leads WHERE id = c.lead) END, CASE WHEN c.status <> 'draft' THEN now() - make_interval(days => GREATEST(c.ago - 1, 0)) END,
  CASE WHEN c.status IN ('converted','submitted') THEN now() - make_interval(days => GREATEST(c.ago - 3, 0)) END,
  CASE WHEN c.status = 'approved' THEN now() - interval '1 day' END
FROM priced c
ON CONFLICT (id) DO NOTHING;

-- ---------- Accident quotations: Group PA (rate per thousand per member) and individual Personal Accident ----------
WITH v(id, num, lead, status, product, ptype, insurer, members, si_each, rate_mille, ago) AS (VALUES
 ('qt_sls_06','95006','ld_sls_06','converted','GPA','GRP-STD','PIONEER',30,300000,1.75,65),
 ('qt_sls_08','95008','ld_sls_08','converted','PA', 'PA-IND', 'AXA',     1,1000000,3.00,LEAST(16, extract(day FROM current_date)::int + 5)),
 ('qt_sls_14','95014','ld_sls_14','rejected', 'GPA','GRP-STD','MAAGAP', 60,200000,1.60,3)
), priced AS (
  SELECT v.*, pg_temp.smp_price(v.product, round(v.members * v.si_each * v.rate_mille / 1000, 2)) AS m, ic.id AS ic_id, ic.name AS ic_name,
    pg_temp.smp_comm_rate(v.insurer, v.product) AS crate, pr.id AS pr_id, pr.name AS pr_name
  FROM v JOIN insurance_companies ic ON ic.code = v.insurer JOIN products pr ON pr.code = v.product
)
INSERT INTO quotes(id, quote_number, lead_id, client_id, product_id, policy_type_id, insurance_company_id, agent_user_id, status, product_type, lob, sum_insured, premium_base,
  vat, dst, lgt, fst, others, premium_total, commission_rate, commission_amount, currency, valid_until, doc, created_by, created_at, updated_at, customer_accepted_at,
  approval_sent_to, approval_sent_at, submitted_to_insurer_at)
SELECT c.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.quote.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || c.num, c.lead,
  (SELECT cl.id FROM clients cl WHERE cl.lead_id = c.lead), c.pr_id, (SELECT id FROM policy_types WHERE code = c.ptype), c.ic_id, (SELECT id FROM users WHERE username = 'BrokerVerse'),
  c.status, c.pr_name, 'ACCIDENT', c.members * c.si_each, (c.m->>'net')::numeric, (c.m->>'vat')::numeric, (c.m->>'dst')::numeric, (c.m->>'lgt')::numeric, (c.m->>'fst')::numeric,
  (c.m->>'others')::numeric, (c.m->>'gross')::numeric, c.crate, round((c.m->>'net')::numeric * c.crate, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'currency.default'),
  current_date - c.ago + 30,
  jsonb_build_object('productType', c.pr_name, 'productId', c.pr_id, 'lob', 'ACCIDENT', 'insurancePolicyType', c.ptype, 'leadRefId', c.lead, 'isCoInsurance', false,
    'totalSumInsured', c.members * c.si_each, 'netPremium', (c.m->>'net')::numeric, 'valueAddedTax', (c.m->>'vat')::numeric, 'documentaryStampTax', (c.m->>'dst')::numeric,
    'localGovernmentTax', (c.m->>'lgt')::numeric, 'fireServiceTax', 0, 'accountPremiumOthers', (c.m->>'others')::numeric, 'discount', 0, 'grossPremium', (c.m->>'gross')::numeric,
    'commissionRate', c.crate, 'commissionAmount', round((c.m->>'net')::numeric * c.crate, 2),
    'accidentDetails', jsonb_build_object('memberCount', c.members, 'sumInsuredPerPerson', c.si_each, 'ratePerThousand', c.rate_mille,
      'benefits', 'Accidental death and disablement, medical reimbursement up to 10% of the sum insured, burial benefit PHP 10,000'),
    'participantDetails', jsonb_build_array(jsonb_build_object('insuranceCompanyName', c.ic_name, 'participantName', c.ic_name, 'insuranceCompanyId', c.ic_id,
      'sharePercentage', '100', 'isLead', true, 'sumInsuredCurrency', 'PHP', 'premiumCurrency', 'PHP'))),
  (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - make_interval(days => c.ago), now() - make_interval(days => GREATEST(c.ago - 2, 0)),
  CASE WHEN c.status = 'converted' THEN now() - make_interval(days => GREATEST(c.ago - 2, 0)) END,
  (SELECT email FROM leads WHERE id = c.lead), now() - make_interval(days => GREATEST(c.ago - 1, 0)),
  CASE WHEN c.status = 'converted' THEN now() - make_interval(days => GREATEST(c.ago - 3, 0)) END
FROM priced c
ON CONFLICT (id) DO NOTHING;
UPDATE quotes SET remarks = 'Client renewed the group cover with its incumbent insurer' WHERE id = 'qt_sls_14' AND remarks IS NULL;

-- ---------- Policies booked from the converted quotations (insurer issued: e-policy received, checked and booked) ----------
INSERT INTO policies(id, policy_number, quote_id, client_id, lead_id, product_id, policy_type_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date,
  issued_date, sum_insured, net_premium, premium_total, commission_amount, currency, bill_number, insured_name, product_type, lob, payment_status, payment_method, paid_at,
  doc, details, channel_id, created_by, created_at)
SELECT 'pol_sls_' || right(q.id, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.policy.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || right(q.quote_number, 5),
  q.id, q.client_id, q.lead_id, q.product_id, q.policy_type_id, q.insurance_company_id, q.created_by, 'active',
  (q.created_at + interval '5 days')::date, (q.created_at + interval '5 days' + interval '1 year')::date, (q.created_at + interval '5 days')::date,
  q.sum_insured, q.premium_base, q.premium_total, q.commission_amount, q.currency,
  (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.invoice.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || right(q.quote_number, 5),
  (SELECT display_name FROM clients WHERE id = q.client_id), q.product_type, q.lob,
  CASE WHEN right(q.id, 2) IN ('01','02','03','04','06','08') THEN 'Completed' ELSE 'Pending' END, CASE WHEN right(q.id, 2) IN ('01','02','03','04','06','08') THEN 'Bank Transfer' END,
  CASE WHEN right(q.id, 2) IN ('01','02','03','04','06','08') THEN q.created_at + interval '6 days' END,
  q.doc || jsonb_build_object('insuranceCompanyName', ic.name,
    'insurerPolicyNumber', upper(left(ic.code, 3)) || CASE WHEN q.lob = 'MOTOR' THEN '-MC-' ELSE '-PA-' END || to_char(q.created_at + interval '5 days', 'YYYY') || '-' || lpad(right(q.quote_number, 3), 6, '0'),
    'issuanceDate', to_char(q.created_at + interval '4 days', 'YYYY-MM-DD'), 'productionDate', to_char(q.created_at + interval '5 days', 'YYYY-MM-DD'))
  || CASE WHEN q.lob = 'MOTOR' AND (q.doc->>'includeCTPL')::boolean THEN jsonb_build_object('cocNumber', upper(left(ic.code, 3)) || lpad(right(q.quote_number, 3), 8, '0')) ELSE '{}'::jsonb END,
  jsonb_build_object('netPremium', q.premium_base, 'grossPremium', q.premium_total, 'discount', 0, 'businessType', 'New Business', 'source', 'seed')
  || CASE right(q.id, 2)
       WHEN '01' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-toyotamakati","comsubPct":5},"chain":[]}}'::jsonb
       WHEN '03' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-toyotacebu","comsubPct":4},"chain":[]}}'::jsonb
       WHEN '06' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-rbautista","level":"L1"},"chain":[{"referrerId":"ref-lgarcia","level":"L2"}]}}'::jsonb
       WHEN '08' THEN '{"commissionDetails":{"primary":{"referrerId":"ref-pvillanueva","level":"L1"},"chain":[]}}'::jsonb
       ELSE '{}'::jsonb END,
  q.channel_id, q.created_by, ((q.created_at + interval '5 days')::date + time '10:00') AT TIME ZONE 'Asia/Manila'
FROM quotes q JOIN insurance_companies ic ON ic.id = q.insurance_company_id WHERE q.id LIKE 'qt_sls_%' AND q.status = 'converted'
ON CONFLICT (id) DO NOTHING;
UPDATE quotes q SET policy_id = p.id FROM policies p WHERE p.quote_id = q.id AND q.id LIKE 'qt_sls_%' AND q.policy_id IS NULL;

-- ---------- Bills, receipts, commissions ----------
INSERT INTO receivables(id, bill_number, policy_id, client_id, amount, balance, due_date, status, source, currency, net_premium, vat, dst, lgt, other_charges, created_at)
SELECT 'rcv_sls_' || right(p.id, 2), p.bill_number, p.id, p.client_id, p.premium_total, CASE WHEN p.payment_status = 'Completed' THEN 0 ELSE p.premium_total END,
  p.inception_date + (SELECT (value#>>'{}')::int FROM app_settings WHERE key = 'receivables.due_days'), CASE WHEN p.payment_status = 'Completed' THEN 'paid' ELSE 'open' END,
  'policy', p.currency, q.premium_base, q.vat, q.dst, q.lgt, q.others, p.created_at
FROM policies p JOIN quotes q ON q.id = p.quote_id WHERE p.id LIKE 'pol_sls_%'
ON CONFLICT (id) DO NOTHING;
INSERT INTO receipts(id, receipt_number, receivable_id, policy_id, client_id, amount, payment_mode, reference_no, received_date, status, created_by, created_at)
SELECT 'or_sls_' || right(p.id, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.receipt.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || right(p.policy_number, 5),
  'rcv_sls_' || right(p.id, 2), p.id, p.client_id, p.premium_total, 'bank-transfer', 'IBFT-' || right(p.policy_number, 5), p.paid_at::date, 'posted', p.created_by, p.paid_at
FROM policies p WHERE p.id LIKE 'pol_sls_%' AND p.quote_id IS NOT NULL AND p.payment_status = 'Completed'
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

-- ---------- Endorsements ----------
INSERT INTO endorsements(id, endorsement_number, policy_id, client_id, endorsement_type, status, changes, premium_delta, effective_date, endorsement_type_ids,
  completion, completed_at, sent_at, created_by, created_at)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.endorsement.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num, p.id, p.client_id,
  v.etype, v.status, v.changes::jsonb, v.delta, current_date - v.ago, v.ids::jsonb, v.completion::jsonb,
  CASE WHEN v.status = 'completed' THEN now() - make_interval(days => v.ago) END, CASE WHEN v.status IN ('submitted','completed') THEN now() - make_interval(days => v.ago + 1) END,
  p.created_by, now() - make_interval(days => v.ago + 2)
FROM (VALUES
 ('end_sls_01','95001','pol_sls_01','personal-details','completed','{"personalDetails":{"FirstName":"Miguel","LastName":"Aquino","ContactNumber":"+639171119999","City":"Makati"}}',0,20,'[1]','{"notes":"Mobile number updated"}'),
 ('end_sls_02','95002','pol_sls_02','motor-details','draft','{"motorDetails":{"PlateNumber":"NDA 2202","VehicleColor":"Silver Metallic"}}',0,3,'[2]','{}'),
 ('end_sls_03','95003','pol_sls_03','coverage','submitted','{"coverageChanges":{"BodilyInjury":"300000","Grosspremium":"0"}}',200,1,'[3]','{}'),
 ('end_sls_04','95004','pol_sls_07','motor-details','completed','{"motorDetails":{"Mortgagee":"","Remarks":"TFS loan fully paid: mortgagee clause deleted"}}',0,LEAST(10, extract(day FROM current_date)::int - 1),'[2]','{"notes":"Release of mortgage received from TFS"}')
) AS v(id, num, pol, etype, status, changes, delta, ago, ids, completion)
JOIN policies p ON p.id = v.pol
ON CONFLICT (id) DO NOTHING;

-- ---------- Sales activities of the account executives ----------
INSERT INTO sales_activities(id, entity, entity_id, lead_id, client_id, activity_type, channel, subject, notes, activity_at, duration_minutes, contact_person, location,
  outcome, next_step, next_step_date, account_executive, created_by, updated_by)
SELECT v.id, v.entity, v.rec, COALESCE(l.id, q.lead_id, cl.lead_id), COALESCE(l.client_id, q.client_id, cl.id), v.type, t.data->>'channel', v.subject, v.notes,
  now() - make_interval(days => v.ago), v.mins, v.contact, v.loc, v.outcome, v.next, CASE WHEN v.next IS NOT NULL THEN current_date + v.fu END, u.id, u.id, u.id
FROM (VALUES
 ('sac_seed_02','lead','ld_sls_20','CALL','First call on the TFS referral','No answer; SMS sent',1,3,NULL,NULL,'NO_ANSWER','Call again',1,'agent.msantos'),
 ('sac_seed_04','lead','ld_sls_22','VISIT','Credit life review at the client''s office','Explained the voluntary credit life cover for year 2 of the loan',6,45,'Arturo Villanueva','Legazpi Village, Makati','INTERESTED','Quote voluntary credit life',3,'agent.jdelacruz'),
 ('sac_seed_05','lead','ld_sls_23','EMAIL','Travel cover options','Sent the Asia annual multi-trip benefits',8,NULL,'Katrina Lim',NULL,'CALL_BACK','Call after the client checks the dates',2,'agent.msantos'),
 ('sac_seed_06','quote','qt_sls_09','CALL','Quotation walk-through','Explained own damage, acts of nature and the 3-year CTPL',10,15,'Dennis Castillo',NULL,'QUOTE_PRESENTED','Follow up the acceptance',2,'agent.jdelacruz'),
 ('sac_seed_07','quote','qt_sls_10','MEETING','Quotation presented at Toyota Quezon Avenue','Met the client at the dealer on vehicle release day',9,30,'Jasmine Villareal','Toyota Quezon Avenue','QUOTE_PRESENTED','Confirm acceptance',1,'agent.msantos'),
 ('sac_seed_08','quote','qt_sls_11','CALL','Fleet pick-up accepted','Accepted the quotation; placement slip raised to Stronghold',8,10,'Finance Manager',NULL,'ACCEPTED',NULL,NULL,'agent.jdelacruz'),
 ('sac_seed_09','quote','qt_sls_14','PRESENTATION','Group PA proposal','Proposal for 60 plant workers presented to HR',5,60,'HR Manager','Davao City','NOT_INTERESTED',NULL,NULL,'agent.jmartinez'),
 ('sac_seed_10','lead','ld_sls_16','CALL','Follow-up on the quotation','Client insured through the dealer''s in-house agent',28,5,'Therese Manalo',NULL,'LOST_TO_COMPETITOR',NULL,NULL,'agent.preyes'),
 ('sac_seed_11','client','cl_sls_04','VISIT','Fleet review with Kalayaan Foods','Two more Innova units for the sales team next quarter',12,60,'Fleet Manager','Kapitolyo, Pasig','INTERESTED','Prepare fleet quotation',14,'agent.jdelacruz'),
 ('sac_seed_12','client','cl_sls_06','CALL','Group PA member update','Three new drivers to add to the group cover',15,10,'HR Officer',NULL,'DOCS_REQUESTED','Endorse the new members',5,'agent.agarcia')
) AS v(id, entity, rec, type, subject, notes, ago, mins, contact, loc, outcome, next, fu, ae)
JOIN users u ON u.username = v.ae
JOIN master_records t ON t.type_code = 'sales-activity-type' AND t.code = v.type
LEFT JOIN leads l ON v.entity = 'lead' AND l.id = v.rec
LEFT JOIN quotes q ON v.entity = 'quote' AND q.id = v.rec
LEFT JOIN clients cl ON v.entity = 'client' AND cl.id = v.rec
WHERE COALESCE(l.id, q.id, cl.id) IS NOT NULL
ON CONFLICT (id) DO NOTHING;
-- logging an activity on a new prospect marks it contacted
UPDATE leads SET status = 'Contacted', updated_at = now()
WHERE status = 'New' AND id IN (SELECT lead_id FROM sales_activities WHERE id LIKE 'sac_seed_%' AND entity = 'lead');
-- the next step of an activity is a follow-up task in the account executive's My Work diary
INSERT INTO work_tasks(title, notes, due_date, priority, status, assigned_to, source, source_key, entity, entity_id, created_by, updated_by, created_at)
SELECT left(a.next_step || ' (' || COALESCE(l.lead_number, q.quote_number, c.client_code) || ')', 200), 'Next step of ' || a.subject || ', ' || COALESCE(l.display_name, ql.display_name, c.display_name),
  a.next_step_date, 'normal', 'open', a.account_executive, 'sales-activity', 'sales_activity:' || a.id, a.entity, a.entity_id, a.account_executive, a.account_executive, a.activity_at
FROM sales_activities a LEFT JOIN leads l ON a.entity = 'lead' AND l.id = a.entity_id LEFT JOIN quotes q ON a.entity = 'quote' AND q.id = a.entity_id
  LEFT JOIN leads ql ON ql.id = q.lead_id LEFT JOIN clients c ON a.entity = 'client' AND c.id = a.entity_id
WHERE a.id LIKE 'sac_seed_%' AND a.next_step_date IS NOT NULL AND a.task_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM work_tasks t WHERE t.source_key = 'sales_activity:' || a.id);
UPDATE sales_activities a SET task_id = t.id FROM work_tasks t WHERE t.source_key = 'sales_activity:' || a.id AND a.id LIKE 'sac_seed_%' AND a.task_id IS NULL;
