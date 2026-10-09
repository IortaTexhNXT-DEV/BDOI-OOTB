-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Sample claims across the lifecycle with status history and audit trail (fictional; idempotent by id): motor own
-- damage, theft (accessories and a carnapped pick-up), third-party property damage and flood on Toyota cars, a personal
-- accident claim and a credit life death claim on a TFS loan. Causes of loss are those of claims.loss_causes, repudiation
-- reasons those of Master > Reason Codes.
INSERT INTO claims(id, claim_number, policy_id, client_id, status, loss_date, reported_date, loss_type, description, estimate_amount, approved_amount,
                   settled_amount, settled_at, handler_user_id, lob, claim_type, priority, loss_time, loss_address, loss_city, loss_province,
                   insurer_claim_number, driver, third_party, adjuster, settlement, due_date, rejected_reason, rejected_reason_code, closed_at, submitted_to_insurer_at,
                   created_by, created_at)
SELECT v.id, v.num, p.id, p.client_id, v.status, current_date - v.loss_ago, current_date - v.rep_ago, v.loss_type, v.descr, v.est,
       CASE WHEN v.status IN ('approved','settled','closed') THEN v.settle END,
       CASE WHEN v.status IN ('settled','closed') THEN v.settle END,
       CASE WHEN v.status IN ('settled','closed') THEN now() - ((v.rep_ago - 10) || ' days')::interval END,
       (SELECT id FROM users WHERE username = 'BrokerVerse'), p.lob, initcap(lower(p.lob)), v.prio, v.ltime, v.addr, v.city, v.prov,
       CASE WHEN v.status <> 'registered' THEN upper(left(ic.code, 3)) || '-CLM-' || substr(v.num, 5) END,
       CASE WHEN p.lob = 'MOTOR' AND v.driver IS NOT NULL THEN jsonb_build_object('driverName', v.driver, 'licenseNumber', 'N0' || right(v.num, 2) || '-24-' || right(v.num, 6)) ELSE '{}'::jsonb END,
       CASE WHEN v.tp IS NOT NULL THEN jsonb_build_object('thirdPartyName', v.tp, 'thirdPartyContactNumber', '+6391700000' || right(v.num, 2)) ELSE '{}'::jsonb END,
       CASE WHEN v.status <> 'registered' THEN jsonb_build_object('adjusterName', 'Philippine Loss Adjusters Corp.', 'adjusterStatus', 'Assigned') ELSE '{}'::jsonb END,
       CASE WHEN v.status IN ('pending-approval','approved','settled','closed') THEN jsonb_build_object('settlementType', v.stype, 'settlementAmount', v.settle, 'requestedBy', 'BrokerVerse')
            || CASE WHEN v.stype = 'Repair Shop' THEN jsonb_build_object('repairShop', v.shop) ELSE '{}'::jsonb END ELSE '{}'::jsonb END,
       current_date - v.rep_ago + 20,
       CASE WHEN v.status = 'rejected' THEN v.reason END, CASE WHEN v.status = 'rejected' THEN v.code END,
       CASE WHEN v.status = 'closed' THEN now() - interval '3 days' END,
       CASE WHEN v.status <> 'registered' THEN now() - ((v.rep_ago - 1) || ' days')::interval END,
       'seed', now() - (v.rep_ago || ' days')::interval
FROM (VALUES
 ('clm_crs_01','CLM-2026-90001','pol_crs_01','registered',        3,  2,'Own Damage - Collision / Accident','Rear-ended at a stoplight along EDSA; rear bumper and tail lamp damaged','High','08:15','EDSA cor. Ayala Ave.','Makati','Metro Manila', 65000,     0,'Marivic Santos','Pedro Aquino',NULL,NULL,NULL,NULL),
 ('clm_crs_02','CLM-2026-90002','pol_crs_03','registered',        1,  0,'Theft','Side mirrors and emblem stolen while parked overnight','Medium','22:40','Colon St.','Cebu City','Cebu', 18000,     0,'Jose Reyes',NULL,NULL,NULL,NULL,NULL),
 ('clm_crs_03','CLM-2026-90003','pol_crs_05','in-review',        12, 10,'Death - Natural Causes / Illness','Death of the borrower (cardiac arrest); outstanding TFS loan balance claimed for the lender','High',NULL,'21 Burgos St.','Bacolod','Negros Occidental', 756000, 0,NULL,NULL,NULL,NULL,NULL,NULL),
 ('clm_crs_04','CLM-2026-90004','pol_crs_04','in-review',        14, 13,'Third Party Property Damage - Collision / Accident','Innova backed into a parked sedan at a mall car park; third party claims the repair','Medium','17:30','Trinoma car park','Quezon City','Metro Manila', 48000, 0,'Andrea Villanueva','Mario Ocampo',NULL,NULL,NULL,NULL),
 ('clm_crs_05','CLM-2026-90005','pol_crs_06','in-review',        21, 19,'Bodily Injury / Medical','Fractured wrist after a fall on a wet staircase; hospital and therapy bills','Medium','10:20','SM Molino','Bacoor','Cavite', 38000,     0,NULL,NULL,NULL,NULL,NULL,NULL),
 ('clm_crs_06','CLM-2026-90006','pol_crs_14','in-review',        40, 38,'Acts of God - Flood / Typhoon / Earthquake','Pick-up submerged during monsoon flooding; engine and interior damaged','High','19:00','Buhangin Rd.','Davao City','Davao del Sur', 210000, 0,'Rafael Uy',NULL,NULL,NULL,NULL,NULL),
 ('clm_crs_07','CLM-2026-90007','pol_crs_01','pending-approval', 45, 44,'Own Damage - Collision / Accident','Front bumper damaged in a parking incident','Low','11:20','Greenbelt Parking','Makati','Metro Manila', 32000, 28500,'Marivic Santos',NULL,'Repair Shop','Toyota Makati Service Center',NULL,NULL),
 ('clm_crs_08','CLM-2026-90008','pol_crs_02','approved',         60, 58,'Third Party Property Damage - Collision / Accident','Delivery pick-up hit the gate of a sari-sari store while reversing','Medium','06:45','A. Mabini St.','Pasig','Metro Manila', 95000, 90000,'Rogelio Tan','Nena Cruz','Bank Transfer',NULL,NULL,NULL),
 ('clm_crs_09','CLM-2026-90009','pol_crs_04','settled',          90, 88,'Own Damage - Collision / Accident','Minor collision at a roundabout; fender and headlamp replaced','Low','07:50','Quezon Memorial Circle','Quezon City','Metro Manila', 25000, 22000,'Andrea Villanueva','Lito Ramos','Repair Shop','Toyota Quezon Avenue Service Center',NULL,NULL),
 ('clm_crs_10','CLM-2026-90010','pol_crs_12','settled',         120,118,'Own Damage - Collision / Accident','Side-swiped by a jeepney; doors repainted','Medium','18:05','Osmena Blvd.','Cebu City','Cebu', 48000, 45000,'Jose Reyes',NULL,'Repair Shop','Toyota Cebu Service Center',NULL,NULL),
 ('clm_crs_11','CLM-2026-90011','pol_crs_18','settled',         100, 99,'Own Damage - Collision / Accident','Delivery pick-up hit a concrete barrier on C5','High','05:30','C5 Road','Pasig','Metro Manila', 180000, 165000,'Rogelio Tan',NULL,'Repair Shop','Toyota Pasig Service Center',NULL,NULL),
 ('clm_crs_12','CLM-2026-90012','pol_crs_14','settled',         150,147,'Theft','Battery and tools stolen from the pick-up','Low','03:00','Lanang','Davao City','Davao del Sur', 15000, 12500,'Rafael Uy',NULL,'Bank Transfer',NULL,NULL,NULL),
 ('clm_crs_13','CLM-2026-90013','pol_crs_12','closed',          140,138,'Own Damage - Collision / Accident','Windshield cracked by flying debris','Low','10:10','SRP Highway','Cebu City','Cebu', 12000, 11000,'Jose Reyes',NULL,'Repair Shop','Toyota Cebu Service Center',NULL,NULL),
 ('clm_crs_14','CLM-2026-90014','pol_crs_01','rejected',         80, 70,'Own Damage - Collision / Accident','Engine failure on the expressway, no collision','Low','09:00','SLEX Alabang exit','Muntinlupa','Metro Manila', 95000, 0,'Marivic Santos',NULL,NULL,NULL,'Cause of Loss Not Covered: engine failure is mechanical breakdown','REP-NOTCOVERED'),
 ('clm_crs_15','CLM-2026-90015','pol_crs_19','rejected',         50, 20,'Theft','Mags and tyres stolen; reported a month after the loss','Medium','01:00','Lacson St.','Bacolod','Negros Occidental', 60000, 0,'Ramon Dela Cruz',NULL,NULL,NULL,'Late notification: reported 30 days after the loss','REP-LATE'),
 ('clm_crs_16','CLM-2026-90016','pol_crs_02','in-review',         6,  5,'Theft','Pick-up carnapped from the delivery depot; police report and alarm filed, TFS notified as mortgagee','High','02:30','Dr. Sixto Antonio Ave.','Pasig','Metro Manila', 1215000, 0,'Rogelio Tan',NULL,NULL,NULL,NULL,NULL)
) AS v(id, num, policy, status, loss_ago, rep_ago, loss_type, descr, prio, ltime, addr, city, prov, est, settle, driver, tp, stype, shop, reason, code)
JOIN policies p ON p.id = v.policy
JOIN insurance_companies ic ON ic.id = p.insurance_company_id
ON CONFLICT (id) DO NOTHING;

-- A claim is never reported before its loss (the API refuses it). The sample rows respect it (loss_ago >= rep_ago);
-- this keeps any earlier seeded copy consistent. Idempotent.
UPDATE claims SET reported_date = loss_date WHERE id LIKE 'clm_crs_%' AND reported_date < loss_date;

-- Status history following the lifecycle up to each claim's current status
WITH paths(status, path) AS (VALUES
  ('registered', ARRAY['registered']), ('in-review', ARRAY['registered','in-review']),
  ('pending-approval', ARRAY['registered','in-review','pending-approval']), ('approved', ARRAY['registered','in-review','pending-approval','approved']),
  ('settled', ARRAY['registered','in-review','pending-approval','approved','settled']),
  ('closed', ARRAY['registered','in-review','pending-approval','approved','settled','closed']), ('rejected', ARRAY['registered','in-review','rejected']))
INSERT INTO claim_history(claim_id, at, by_user, status, note)
SELECT c.id, c.created_at + ((s.ord - 1) || ' days')::interval, 'BrokerVerse', s.st,
       CASE s.st WHEN 'registered' THEN 'Claim registered' WHEN 'in-review' THEN 'Preliminary loss advice sent to the insurer' WHEN 'rejected' THEN c.rejected_reason
                 WHEN 'settled' THEN 'Settlement released' ELSE NULL END
FROM claims c JOIN paths ON paths.status = c.status
CROSS JOIN LATERAL unnest(paths.path) WITH ORDINALITY AS s(st, ord)
WHERE c.id LIKE 'clm_crs_%' AND NOT EXISTS (SELECT 1 FROM claim_history h WHERE h.claim_id = c.id);

INSERT INTO claim_field_changes(claim_id, at, username, action, field_name, old_value, new_value)
SELECT h.claim_id, h.at, h.by_user, CASE WHEN h.status = 'registered' THEN 'Claim Registered' ELSE 'Status Changed' END, 'claimStatus',
       lag(h.status) OVER (PARTITION BY h.claim_id ORDER BY h.at, h.id), h.status
FROM claim_history h
WHERE h.claim_id LIKE 'clm_crs_%' AND NOT EXISTS (SELECT 1 FROM claim_field_changes f WHERE f.claim_id = h.claim_id);
