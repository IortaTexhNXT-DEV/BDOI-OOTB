-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Sample claims across the lifecycle with status history and audit trail (fictional; idempotent by id).
INSERT INTO claims(id, claim_number, policy_id, client_id, status, loss_date, reported_date, loss_type, description, estimate_amount, approved_amount,
                   settled_amount, settled_at, handler_user_id, lob, claim_type, priority, loss_time, loss_address, loss_city, loss_province,
                   insurer_claim_number, driver, third_party, adjuster, settlement, due_date, rejected_reason, closed_at, created_by, created_at)
SELECT v.id, v.num, p.id, p.client_id, v.status, current_date - v.loss_ago, current_date - v.rep_ago, v.loss_type, v.descr, v.est,
       CASE WHEN v.status IN ('approved','settled','closed') THEN v.settle END,
       CASE WHEN v.status IN ('settled','closed') THEN v.settle END,
       CASE WHEN v.status IN ('settled','closed') THEN now() - ((v.rep_ago - 10) || ' days')::interval END,
       (SELECT id FROM users WHERE username = 'BrokerVerse'), v.lob, initcap(lower(v.lob)), v.prio, v.ltime, v.addr, v.city, v.prov,
       CASE WHEN v.status <> 'registered' THEN 'INS-' || substr(v.num, 5) END,
       CASE WHEN v.lob = 'MOTOR' THEN jsonb_build_object('driverName', v.driver) ELSE '{}'::jsonb END,
       CASE WHEN v.tp IS NOT NULL THEN jsonb_build_object('thirdPartyName', v.tp, 'thirdPartyContactNumber', '+639170000000') ELSE '{}'::jsonb END,
       CASE WHEN v.status NOT IN ('registered') THEN jsonb_build_object('adjusterName', 'Cordillera Adjusters Inc.', 'adjusterStatus', 'Assigned') ELSE '{}'::jsonb END,
       CASE WHEN v.status IN ('pending-approval','approved','settled','closed') THEN jsonb_build_object('settlementType', 'Bank Transfer', 'settlementAmount', v.settle, 'requestedBy', 'BrokerVerse') ELSE '{}'::jsonb END,
       current_date - v.rep_ago + 20,
       CASE WHEN v.status = 'rejected' THEN v.descr END,
       CASE WHEN v.status = 'closed' THEN now() - interval '3 days' END,
       'seed', now() - (v.rep_ago || ' days')::interval
FROM (VALUES
 ('clm_crs_01','CLM-2026-90001','pol_crs_01','registered',      3,  2,'Collision','Rear-ended at a stoplight along EDSA', 'MOTOR','High',  '08:15','EDSA cor. Ayala Ave.','Makati','Metro Manila', 65000,      0,'Jose Santos','Pedro Aquino'),
 ('clm_crs_02','CLM-2026-90002','pol_crs_03','registered',      1,  0,'Theft','Side mirrors and emblem stolen while parked',  'MOTOR','Medium','22:40','Colon St.','Cebu City','Cebu', 18000,      0,'Jose Reyes',NULL),
 ('clm_crs_03','CLM-2026-90003','pol_crs_05','registered',      6,  5,'Water Damage','Cargo wetted during typhoon discharge at port','MARINE','High','14:00','Sasa Wharf','Davao City','Davao del Sur', 420000, 0,NULL,NULL),
 ('clm_crs_04','CLM-2026-90004','pol_crs_04','in-review',      12, 11,'Collision','Side-swiped by a jeepney on Commonwealth Ave.','MOTOR','Medium','17:30','Commonwealth Ave.','Quezon City','Metro Manila', 48000, 0,'Andrea Villanueva','Mario Ocampo'),
 ('clm_crs_05','CLM-2026-90005','pol_crs_02','in-review',      30, 28,'Fire','Electrical fire in warehouse section B',    'FIRE','High',  '02:10','45 Pioneer St.','Pasig','Metro Manila', 1850000, 0,NULL,NULL),
 ('clm_crs_06','CLM-2026-90006','pol_crs_14','in-review',      40, 38,'Flood','Unit submerged during monsoon flooding',     'MOTOR','High',  '19:00','Buhangin Rd.','Davao City','Davao del Sur', 210000, 0,'Rafael Uy',NULL),
 ('clm_crs_07','CLM-2026-90007','pol_crs_01','pending-approval',45, 44,'Collision','Front bumper damage from parking incident','MOTOR','Low',  '11:20','Greenbelt Parking','Makati','Metro Manila', 32000,  28500,'Jose Santos',NULL),
 ('clm_crs_08','CLM-2026-90008','pol_crs_06','approved',        60, 58,'Fire','Kitchen fire in resort restaurant',          'FIRE','Medium','20:45','Tagaytay-Talisay Rd.','Batangas City','Batangas', 750000, 690000,NULL,NULL),
 ('clm_crs_09','CLM-2026-90009','pol_crs_04','settled',         90, 88,'Collision','Minor collision at a roundabout',          'MOTOR','Low',   '07:50','Quezon Memorial Circle','Quezon City','Metro Manila', 25000,  22000,'Andrea Villanueva','Lito Ramos'),
 ('clm_crs_10','CLM-2026-90010','pol_crs_12','settled',        120,118,'Fire','Kitchen fire damage to residence',           'FIRE','Medium','18:05','7 Osmena Blvd.','Cebu City','Cebu', 180000, 165000,NULL,NULL),
 ('clm_crs_11','CLM-2026-90011','pol_crs_18','settled',        100, 99,'Collision','Delivery truck hit a concrete barrier',   'MOTOR','High',  '05:30','C5 Road','Pasig','Metro Manila', 380000, 342000,'Rogelio Tan',NULL),
 ('clm_crs_12','CLM-2026-90012','pol_crs_14','settled',        150,147,'Theft','Battery and tools stolen from the vehicle','MOTOR','Low',   '03:00','Lanang','Davao City','Davao del Sur', 15000,  12500,'Rafael Uy',NULL),
 ('clm_crs_13','CLM-2026-90013','pol_crs_03','closed',         140,138,'Glass Breakage','Windshield cracked by flying debris','MOTOR','Low',  '10:10','SRP Highway','Cebu City','Cebu', 12000,  11000,'Jose Reyes',NULL),
 ('clm_crs_14','CLM-2026-90014','pol_crs_01','rejected',        80, 70,'Mechanical Breakdown','Engine failure (excluded peril)','MOTOR','Low','09:00','Kalayaan Ave.','Makati','Metro Manila', 95000,  0,'Jose Santos',NULL),
 ('clm_crs_15','CLM-2026-90015','pol_crs_05','rejected',        50, 20,'Shortage','Shortage in delivered cargo reported late','MARINE','Medium','12:00','Sasa Wharf','Davao City','Davao del Sur', 60000, 0,NULL,NULL)
) AS v(id, num, policy, status, loss_ago, rep_ago, loss_type, descr, lob, prio, ltime, addr, city, prov, est, settle, driver, tp)
JOIN policies p ON p.id = v.policy
ON CONFLICT (id) DO NOTHING;

-- D107: a claim is never reported before its loss (the API refuses it). The sample rows respect it (loss_ago >= rep_ago);
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
       CASE s.st WHEN 'registered' THEN 'Claim registered' WHEN 'rejected' THEN c.rejected_reason WHEN 'settled' THEN 'Settlement released' ELSE NULL END
FROM claims c JOIN paths ON paths.status = c.status
CROSS JOIN LATERAL unnest(paths.path) WITH ORDINALITY AS s(st, ord)
WHERE c.id LIKE 'clm_crs_%' AND NOT EXISTS (SELECT 1 FROM claim_history h WHERE h.claim_id = c.id);

INSERT INTO claim_field_changes(claim_id, at, username, action, field_name, old_value, new_value)
SELECT h.claim_id, h.at, h.by_user, CASE WHEN h.status = 'registered' THEN 'Claim Registered' ELSE 'Status Changed' END, 'claimStatus',
       lag(h.status) OVER (PARTITION BY h.claim_id ORDER BY h.at, h.id), h.status
FROM claim_history h
WHERE h.claim_id LIKE 'clm_crs_%' AND NOT EXISTS (SELECT 1 FROM claim_field_changes f WHERE f.claim_id = h.claim_id);
