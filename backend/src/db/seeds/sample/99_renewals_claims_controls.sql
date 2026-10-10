-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Renewal and claim controls on the samples of 85_claims_renewals_base.sql, 86_claims.sql and 87_renewals.sql
-- (fictional; idempotent): an Operations Officer and an Operations Unit Head who handle and approve claims, lock-in and
-- Scheme 2 accounts with their TFS loan status, how each claim was reported, the insurer's advice, the communication
-- log with a follow-up overdue, the settlements of each claim (one partly settled, one awaiting approval) and a claim
-- cancelled as a duplicate notification.

INSERT INTO users(username, password_hash, display_name, first_name, last_name, email, employee_code, branch_code, designation, status, must_change_password, created_by)
SELECT v.u, crypt(gen_random_uuid()::text, gen_salt('bf', 8)), v.f || ' ' || v.l, v.f, v.l, v.e, v.code, 'HO', v.des, 'active', true, 'seed'
FROM (VALUES
  ('ops.cmendoza', 'Carla', 'Mendoza', 'carla.mendoza@tisph.example.ph', 'EMP-0211', 'Operations Officer'),
  ('ops.jramos', 'Joel', 'Ramos', 'joel.ramos@tisph.example.ph', 'EMP-0205', 'Operations Unit Head')
) AS v(u, f, l, e, code, des)
ON CONFLICT (username) DO NOTHING;
INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = CASE u.username WHEN 'ops.cmendoza' THEN 'tis-ops-officer' ELSE 'tis-ops-unit-head' END
WHERE u.username IN ('ops.cmendoza', 'ops.jramos')
ON CONFLICT DO NOTHING;

-- Lock-in accounts: a promotion lock-in in its second year (notices suppressed), a Scheme 2 account whose TFS loan is
-- past due (notices held) and a Scheme 1 ARA account in its last year (notices sent as scheduled).
INSERT INTO policy_lock_ins(policy_id, source, reference, start_date, years, end_date, tfs_loan_account, loan_status, loan_status_at, loan_status_note, created_by)
SELECT p.id, v.source, v.ref, (p.expiry_date - make_interval(years => v.into_years))::date, v.years,
       (p.expiry_date - make_interval(years => v.into_years) + make_interval(years => v.years))::date, v.loan, v.loan_status,
       CASE WHEN v.loan_status <> 'current' THEN now() - interval '6 days' END, v.note, 'seed'
FROM (VALUES
  ('pol_crs_15', 'promotion',   'PROMO-2024-07',  2, 3, 'TFS-2404515', 'current',  NULL),
  ('pol_crs_14', 'scheme2',     'S2-2024-0077',   1, 3, 'TFS-F-24077', 'past-due', 'Two amortisations unpaid per the TFS collection list'),
  ('pol_crs_18', 'scheme1-ara', 'ARA-2023-0092',  3, 3, 'TFS-F-24092', 'current',  NULL)
) AS v(policy, source, ref, into_years, years, loan, loan_status, note)
JOIN policies p ON p.id = v.policy
ON CONFLICT (policy_id) DO NOTHING;

-- How each sample claim was reported, the loss extent of the motor claims and the insurer's side of the open ones.
UPDATE claims c SET fnol_source = v.src, loss_extent = v.extent
  FROM (VALUES ('clm_crs_01', 'TFS', 'partial'), ('clm_crs_02', 'Walk-in or e-mail', 'partial'), ('clm_crs_03', 'TFS', NULL),
               ('clm_crs_04', 'Call Centre', 'partial'), ('clm_crs_05', 'Walk-in or e-mail', NULL), ('clm_crs_06', 'Dealer', 'total'),
               ('clm_crs_07', 'Dealer', 'partial'), ('clm_crs_08', 'Call Centre', 'partial'), ('clm_crs_16', 'TFS', 'total')) AS v(id, src, extent)
 WHERE c.id = v.id AND c.fnol_source IS NULL;
UPDATE claims c SET insurer_handler = v.handler, insurer_handler_contact = v.contact, insurer_advice = v.advice, insurer_advice_at = now() - (v.ago || ' days')::interval,
       authorisation_code = v.auth, authorisation_at = CASE WHEN v.auth IS NOT NULL THEN now() - (v.ago || ' days')::interval END, insurer_offer_amount = v.offer
  FROM (VALUES ('clm_crs_03', 'Grace Lim', 'grace.lim@insurer.example.ph', 'incomplete-requirements', 4, NULL, NULL::numeric),
               ('clm_crs_04', 'Noel Bautista', '+63 2 8888 4410', 'under-evaluation', 6, NULL, NULL),
               ('clm_crs_06', 'Teresa Cruz', 'teresa.cruz@insurer.example.ph', 'loa-issued', 3, 'LOA-26-40616', 195000),
               ('clm_crs_08', 'Noel Bautista', '+63 2 8888 4410', 'approved', 20, 'AUTH-26-88008', 90000)) AS v(id, handler, contact, advice, ago, auth, offer)
 WHERE c.id = v.id AND c.insurer_advice IS NULL;

-- Who asked for and who approved the settlements of the sample claims.
UPDATE claims SET settlement_requested_by = (SELECT id FROM users WHERE username = 'ops.cmendoza')
 WHERE id LIKE 'clm_crs_%' AND settlement_requested_by IS NULL AND status IN ('pending-approval', 'approved', 'settled', 'closed');
UPDATE claims SET settlement_approved_by = (SELECT id FROM users WHERE username = 'ops.jramos'), settlement_approved_at = COALESCE(settled_at, now()) - interval '2 days'
 WHERE id LIKE 'clm_crs_%' AND settlement_approved_by IS NULL AND status IN ('approved', 'settled', 'closed');

-- A flooded Innova partly settled (the insurer paid the first part on the LOA), a Vios claim awaiting approval and a
-- duplicate notification cancelled.
INSERT INTO claims(id, claim_number, policy_id, client_id, status, loss_date, reported_date, loss_type, description, estimate_amount, approved_amount, settled_amount,
                   handler_user_id, lob, claim_type, priority, loss_address, loss_city, loss_province, insurer_claim_number, settlement, due_date,
                   settlement_requested_by, settlement_approved_by, settlement_approved_at, submitted_to_insurer_at, fnol_source, loss_extent,
                   insurer_handler, insurer_advice, insurer_advice_at, cancelled_reason, cancelled_reason_code, cancelled_at, created_by, created_at)
SELECT v.id, v.num, p.id, p.client_id, v.status, current_date - v.loss_ago, current_date - v.rep_ago, v.loss_type, v.descr, v.est, v.approved, v.settled,
       (SELECT id FROM users WHERE username = 'ops.cmendoza'), p.lob, initcap(lower(p.lob)), 'High', v.addr, v.city, v.prov, v.insurer_no,
       COALESCE(v.settlement, '{}'::jsonb), current_date - v.rep_ago + 30,
       CASE WHEN v.settlement IS NOT NULL THEN (SELECT id FROM users WHERE username = 'ops.cmendoza') END,
       CASE WHEN v.status = 'partially-settled' THEN (SELECT id FROM users WHERE username = 'ops.jramos') END, CASE WHEN v.status = 'partially-settled' THEN now() - interval '12 days' END,
       CASE WHEN v.status <> 'cancelled' THEN now() - ((v.rep_ago - 1) || ' days')::interval END, v.src, v.extent, v.handler, v.advice,
       CASE WHEN v.advice IS NOT NULL THEN now() - interval '15 days' END,
       CASE WHEN v.status = 'cancelled' THEN 'Duplicate notification of the same loss: already registered as CLM-2026-90001' END,
       CASE WHEN v.status = 'cancelled' THEN 'CCN-DUPLICATE' END, CASE WHEN v.status = 'cancelled' THEN now() - interval '1 day' END,
       'seed', now() - (v.rep_ago || ' days')::interval
FROM (VALUES
 ('clm_crs_21', 'CLM-2026-90021', 'pol_crs_16', 'partially-settled', 35, 33, 'Acts of God - Flood / Typhoon / Earthquake', 'Innova stalled in floodwater on Espana Blvd.; engine overhaul and interior replacement',
  160000, 80000, 80000, 'Espana Blvd.', 'Manila', 'Metro Manila', 'PIO-CLM-2026-90021', '{"settlementType": "Bank Transfer", "settlementAmount": 80000}'::jsonb, 'Dealer', 'partial', 'Teresa Cruz', 'cheque-available'),
 ('clm_crs_22', 'CLM-2026-90022', 'pol_crs_15', 'pending-approval', 18, 16, 'Own Damage - Collision / Accident', 'Vios hit a road divider in the rain along Commonwealth Ave.; bumper, grille and radiator replaced',
  48000, NULL, NULL, 'Commonwealth Ave.', 'Quezon City', 'Metro Manila', 'MAL-CLM-2026-90022', '{"settlementType": "Repair Shop", "settlementAmount": 42000, "repairShop": "Toyota Quezon Avenue Service Center"}'::jsonb, 'TFS', 'partial', 'Liza Tan', 'approved'),
 ('clm_crs_23', 'CLM-2026-90023', 'pol_crs_01', 'cancelled', 3, 1, 'Own Damage - Collision / Accident', 'Rear bumper damage at EDSA reported again by the dealer',
  65000, NULL, NULL, 'EDSA cor. Ayala Ave.', 'Makati', 'Metro Manila', NULL, NULL, 'Dealer', 'partial', NULL, NULL)
) AS v(id, num, policy, status, loss_ago, rep_ago, loss_type, descr, est, approved, settled, addr, city, prov, insurer_no, settlement, src, extent, handler, advice)
JOIN policies p ON p.id = v.policy
ON CONFLICT (id) DO NOTHING;

-- The settlements: the samples' own settlement as one final row, the partial payment of the flood claim and the
-- settlement awaiting approval.
INSERT INTO claim_settlements(claim_id, seq, kind, amount, approved_amount, settlement_type, paid_through_broker, payee, status, requested_by, requested_at, decided_by, decided_at)
SELECT c.id, 1, CASE WHEN c.status = 'partially-settled' THEN 'partial' ELSE 'final' END,
       COALESCE(NULLIF(c.settlement->>'settlementAmount', '')::numeric, c.settled_amount, c.approved_amount),
       CASE WHEN c.status IN ('approved', 'settled', 'closed', 'partially-settled') THEN COALESCE(c.approved_amount, c.settled_amount) END,
       c.settlement->>'settlementType', false, c.settlement->>'repairShop',
       CASE WHEN c.status = 'pending-approval' THEN 'pending' ELSE 'approved' END, c.settlement_requested_by, c.created_at + interval '5 days',
       c.settlement_approved_by, c.settlement_approved_at
  FROM claims c
 WHERE c.id LIKE 'clm_crs_%'
   AND COALESCE(NULLIF(c.settlement->>'settlementAmount', '')::numeric, c.settled_amount, c.approved_amount) > 0
   AND c.status IN ('pending-approval', 'approved', 'settled', 'closed', 'partially-settled')
   AND NOT EXISTS (SELECT 1 FROM claim_settlements s WHERE s.claim_id = c.id);

INSERT INTO claim_history(claim_id, at, by_user, status, note)
SELECT v.id, now() - (v.ago || ' days')::interval, v.who, v.st, v.note
FROM (VALUES
 ('clm_crs_21', 'registered', 'Claim registered', 'ops.cmendoza', 33),
 ('clm_crs_21', 'in-review', 'Documents complete; submitted to the insurer', 'ops.cmendoza', 32),
 ('clm_crs_21', 'pending-approval', 'Partial settlement of PHP 80,000.00 on the LOA', 'ops.cmendoza', 14),
 ('clm_crs_21', 'partially-settled', 'Partial settlement approved', 'ops.jramos', 12),
 ('clm_crs_22', 'registered', 'Claim registered', 'ops.cmendoza', 16),
 ('clm_crs_22', 'in-review', 'Documents complete; submitted to the insurer', 'ops.cmendoza', 15),
 ('clm_crs_22', 'pending-approval', 'Settlement of PHP 42,000.00 to the repair shop', 'ops.cmendoza', 2),
 ('clm_crs_23', 'registered', 'Claim registered', 'ops.cmendoza', 1),
 ('clm_crs_23', 'cancelled', 'Duplicate notification of the same loss: already registered as CLM-2026-90001', 'ops.cmendoza', 1)
) AS v(id, st, note, who, ago)
WHERE EXISTS (SELECT 1 FROM claims WHERE id = v.id)
  AND NOT EXISTS (SELECT 1 FROM claim_history h WHERE h.claim_id = v.id AND h.status = v.st);

-- The communication log: the insurer chased on a third-party claim (follow-up overdue), the client told of missing
-- requirements and the repair shop's estimate on the flood claim.
INSERT INTO claim_communications(claim_id, party, direction, method, subject, message, follow_up_date, follow_up_done_at, created_by, created_at)
SELECT v.id, v.party, v.dir, v.method, v.subject, v.message, CASE WHEN v.fu IS NOT NULL THEN current_date + v.fu END,
       CASE WHEN v.done THEN now() - interval '1 day' END, (SELECT id FROM users WHERE username = 'ops.cmendoza'), now() - (v.ago || ' days')::interval
FROM (VALUES
 ('clm_crs_04', 'insurer', 'out', 'Email', 'Claim CLM-2026-90004: documents submitted', 'Sent the police report, the third party''s repair estimate and the driver''s licence.', -3, false, 9),
 ('clm_crs_04', 'client', 'out', 'Phone', NULL, 'Told Ms. Villanueva the insurer is evaluating the third party''s claim.', NULL, false, 5),
 ('clm_crs_03', 'client', 'out', 'Email', 'Claim CLM-2026-90003: requirements', 'Asked the family for the certified death certificate and the attending physician''s statement.', 4, false, 3),
 ('clm_crs_21', 'repair-shop', 'in', 'Email', 'Repair estimate', 'Toyota Manila Bay sent the revised estimate for the engine overhaul: PHP 158,500.00.', 2, false, 20),
 ('clm_crs_21', 'insurer', 'out', 'Phone', NULL, 'Insurer confirmed the cheque for the first part is available for pick-up.', -10, true, 13)
) AS v(id, party, dir, method, subject, message, fu, done, ago)
WHERE EXISTS (SELECT 1 FROM claims WHERE id = v.id)
  AND NOT EXISTS (SELECT 1 FROM claim_communications c WHERE c.claim_id = v.id AND c.message = v.message);
