-- Reference data. Idempotent by natural key.
INSERT INTO countries(code, name) VALUES ('PH','Philippines'),('SG','Singapore'),('MY','Malaysia'),('TH','Thailand'),('US','United States')
ON CONFLICT (code) DO NOTHING;
INSERT INTO states(country_id, code, name)
SELECT c.id, v.code, v.name FROM (VALUES ('NCR','Metro Manila'),('CAV','Cavite'),('LAG','Laguna'),('CEB','Cebu'),('DAV','Davao del Sur'),('PAM','Pampanga'),('BUL','Bulacan'),('BAT','Batangas'),('ILO','Iloilo'),('NEG','Negros Occidental')) AS v(code,name)
JOIN countries c ON c.code = 'PH'
WHERE NOT EXISTS (SELECT 1 FROM states s WHERE s.name = v.name);
INSERT INTO cities(state_id, name)
SELECT s.id, v.city FROM (VALUES ('Metro Manila','Makati'),('Metro Manila','Quezon City'),('Metro Manila','Manila'),('Metro Manila','Taguig'),('Metro Manila','Pasig'),('Cavite','Bacoor'),('Laguna','Santa Rosa'),('Cebu','Cebu City'),('Cebu','Mandaue'),('Davao del Sur','Davao City'),('Pampanga','San Fernando'),('Bulacan','Malolos'),('Batangas','Batangas City'),('Iloilo','Iloilo City'),('Negros Occidental','Bacolod')) AS v(state,city)
JOIN states s ON s.name = v.state
WHERE NOT EXISTS (SELECT 1 FROM cities c WHERE c.name = v.city);
INSERT INTO currencies(code, name, symbol, decimals, is_base, exchange_rate) VALUES
 ('PHP','Philippine Peso','₱',2,true,1),('USD','US Dollar','$',2,false,0.0177),('EUR','Euro','€',2,false,0.0163),('SGD','Singapore Dollar','S$',2,false,0.0238),('JPY','Japanese Yen','¥',0,false,2.65)
ON CONFLICT (code) DO NOTHING;
INSERT INTO banks(code, name, swift_code) VALUES
 ('BDO','Banco de Oro','BNORPHMM'),('BPI','Bank of the Philippine Islands','BOPIPHMM'),('MBT','Metrobank','MBTCPHMM'),('LBP','Land Bank of the Philippines','TLBPPHMM'),('SECB','Security Bank','SETCPHMM'),('CBC','China Banking Corporation','CHBKPHMM')
ON CONFLICT (code) DO NOTHING;
INSERT INTO insurance_companies(code, name, short_name, commission_rate, contact_email, status) VALUES
 ('MAPFRE','MAPFRE Insurance Corporation','MAPFRE',0.15,'uw@mapfre.example','active'),
 ('MALAYAN','Malayan Insurance Co., Inc.','Malayan',0.15,'uw@malayan.example','active'),
 ('PIONEER','Pioneer Insurance & Surety Corp.','Pioneer',0.175,'uw@pioneer.example','active'),
 ('FPG','FPG Insurance Co., Inc.','FPG',0.15,'uw@fpg.example','active'),
 ('STANDARD','Standard Insurance Co., Inc.','Standard',0.16,'uw@standard.example','active'),
 ('MERCANTILE','Mercantile Insurance Co., Inc.','Mercantile',0.14,'uw@mercantile.example','active')
ON CONFLICT (code) DO NOTHING;
INSERT INTO products(code, name, line) VALUES
 ('MOTOR','Motor Vehicle Insurance','motor'),('CTPL','Compulsory Third Party Liability','motor'),
 ('FIRE','Fire and Allied Perils','fire'),('MARINE','Marine Cargo','marine'),
 ('PA','Personal Accident','accident'),('CGL','Comprehensive General Liability','casualty'),
 ('EB','Group Employee Benefits','eb'),('BOND','Surety Bond','casualty')
ON CONFLICT (code) DO NOTHING;
INSERT INTO policy_types(product_id, code, name)
SELECT p.id, v.code, v.name FROM (VALUES
 ('MOTOR','COMP','Comprehensive'),('MOTOR','TPL','Third Party Liability'),('MOTOR','ODTH','Own Damage / Theft'),
 ('CTPL','CTPL','CTPL'),('FIRE','FIRE-RES','Residential'),('FIRE','FIRE-COM','Commercial'),
 ('MARINE','MC-IMP','Import'),('MARINE','MC-DOM','Domestic'),('PA','PA-IND','Individual'),('PA','PA-GRP','Group'),
 ('CGL','CGL-STD','Standard'),('EB','EB-GRP','Group Life & Health'),('BOND','BOND-PERF','Performance Bond')) AS v(pcode,code,name)
JOIN products p ON p.code = v.pcode
WHERE NOT EXISTS (SELECT 1 FROM policy_types t WHERE t.code = v.code);
INSERT INTO vehicle_brands(name) VALUES ('Toyota'),('Mitsubishi'),('Honda'),('Ford'),('Nissan'),('Hyundai'),('Suzuki'),('Isuzu')
ON CONFLICT (name) DO NOTHING;
INSERT INTO vehicle_models(brand_id, name)
SELECT b.id, v.model FROM (VALUES ('Toyota','Vios'),('Toyota','Fortuner'),('Toyota','Hilux'),('Toyota','Innova'),('Mitsubishi','Montero Sport'),('Mitsubishi','Xpander'),('Mitsubishi','L300'),('Honda','Civic'),('Honda','CR-V'),('Honda','City'),('Ford','Ranger'),('Ford','Everest'),('Nissan','Navara'),('Nissan','Terra'),('Hyundai','Accent'),('Hyundai','Tucson'),('Suzuki','Ertiga'),('Isuzu','D-Max'),('Isuzu','mu-X')) AS v(brand,model)
JOIN vehicle_brands b ON b.name = v.brand
WHERE NOT EXISTS (SELECT 1 FROM vehicle_models m WHERE m.name = v.model);
INSERT INTO vehicle_variants(model_id, name, body_type, seating)
SELECT m.id, v.variant, v.body, v.seats FROM (VALUES
 ('Vios','1.3 XLE CVT','Sedan',5),('Vios','1.5 G MT','Sedan',5),('Fortuner','2.4 G 4x2 AT','SUV',7),('Hilux','2.4 E 4x2 MT','Pickup',5),
 ('Innova','2.8 E AT','MPV',8),('Montero Sport','2.4 GLS 2WD AT','SUV',7),('Xpander','1.5 GLS AT','MPV',7),('L300','2.2 Cab & Chassis','Van',3),
 ('Civic','1.8 S CVT','Sedan',5),('CR-V','2.0 S CVT','SUV',5),('City','1.5 S CVT','Sedan',5),('Ranger','2.0 XLT 4x2 AT','Pickup',5),
 ('Everest','2.0 Trend 4x2 AT','SUV',7),('Navara','2.5 EL 4x2 AT','Pickup',5),('Terra','2.5 VE 4x2 AT','SUV',7),
 ('Accent','1.4 GL AT','Sedan',5),('Tucson','2.0 GL AT','SUV',5),('Ertiga','1.5 GL AT','MPV',7),('D-Max','3.0 LS 4x2 AT','Pickup',5),('mu-X','3.0 LS-A 4x2 AT','SUV',7)) AS v(model,variant,body,seats)
JOIN vehicle_models m ON m.name = v.model
WHERE NOT EXISTS (SELECT 1 FROM vehicle_variants x WHERE x.name = v.variant AND x.model_id = m.id);
INSERT INTO coverages(kind, policy_type_id, label, amount, premium)
SELECT v.kind, t.id, v.label, v.amount, v.premium FROM (VALUES
 ('bi','COMP','Bodily Injury 100,000',100000,450),('bi','COMP','Bodily Injury 200,000',200000,700),('bi','COMP','Bodily Injury 300,000',300000,900),
 ('pd','COMP','Property Damage 100,000',100000,500),('pd','COMP','Property Damage 200,000',200000,800),('pd','COMP','Property Damage 500,000',500000,1400),
 ('pa','COMP','Auto PA 50,000 / seat',50000,120),('pa','COMP','Auto PA 100,000 / seat',100000,200),
 ('bi','TPL','Bodily Injury 100,000',100000,560),('pd','TPL','Property Damage 100,000',100000,620),('pa','TPL','Auto PA 50,000 / seat',50000,150)) AS v(kind,tcode,label,amount,premium)
JOIN policy_types t ON t.code = v.tcode
WHERE NOT EXISTS (SELECT 1 FROM coverages c WHERE c.label = v.label AND c.policy_type_id = t.id AND c.kind = v.kind);
INSERT INTO signatories(name, designation)
SELECT * FROM (VALUES ('Maria Regina Cruz','President & CEO'),('Jose Antonio Reyes','VP - Underwriting'),('Ana Patricia Lim','Finance Director')) AS v(n,d)
WHERE NOT EXISTS (SELECT 1 FROM signatories s WHERE s.name = v.n);
INSERT INTO branches(code, name, address)
SELECT * FROM (VALUES ('HO','Head Office','Makati City'),('CEB','Cebu Branch','Cebu City'),('DAV','Davao Branch','Davao City')) AS v(c,n,a)
WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.code = v.c);
