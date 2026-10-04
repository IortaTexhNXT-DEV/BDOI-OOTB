-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Sample renewals (pipeline through renewed / lapsed), quotes, notices, contact log, batches and a win-back campaign. Idempotent.
INSERT INTO renewals(id, renewal_number, policy_id, client_id, owner_user_id, status, due_date, premium_old, premium_new, notice_stage, last_notice_at,
                     contact_attempts, last_contact_at, submitted_by, submitted_at, approved_by, approved_at, lapse_reason, lapsed_at, renewed_at, new_policy_id, created_by, created_at)
SELECT v.id, v.num, p.id, p.client_id, p.owner_user_id, v.status, p.expiry_date, p.premium_total, v.pnew, v.stage,
       CASE WHEN v.stage > 0 THEN now() - ((5 * (4 - v.stage)) || ' days')::interval END,
       v.contacts, CASE WHEN v.contacts > 0 THEN now() - interval '2 days' END,
       CASE WHEN v.status IN ('pending-approval','approved') THEN (SELECT id FROM users WHERE username = 'BrokerVerse') END,
       CASE WHEN v.status IN ('pending-approval','approved') THEN now() - interval '1 day' END,
       NULL, CASE WHEN v.status = 'approved' THEN now() - interval '6 hours' END,
       CASE WHEN v.status = 'lapsed' THEN 'Client did not respond to notices; insured elsewhere' END,
       CASE WHEN v.status = 'lapsed' THEN now() - interval '20 days' END,
       CASE WHEN v.status = 'renewed' THEN now() - interval '9 days' END,
       CASE WHEN v.status = 'renewed' THEN 'pol_crs_24' END, 'seed', now() - interval '40 days'
FROM (VALUES
 ('rnw_crs_11','RN-2026-90011','pol_crs_11','pipeline',         0, NULL::numeric, 0),
 ('rnw_crs_12','RN-2026-90012','pol_crs_12','notice-1',         1, NULL, 0),
 ('rnw_crs_13','RN-2026-90013','pol_crs_13','notice-2',         2, NULL, 1),
 ('rnw_crs_14','RN-2026-90014','pol_crs_14','quoted',           1, 79836.45, 2),
 ('rnw_crs_15','RN-2026-90015','pol_crs_15','pending-approval', 1, 28950.00, 1),
 ('rnw_crs_16','RN-2026-90016','pol_crs_16','pipeline',         0, NULL, 0),
 ('rnw_crs_17','RN-2026-90017','pol_crs_17','notice-1',         1, NULL, 0),
 ('rnw_crs_18','RN-2026-90018','pol_crs_18','quoted',           0, 121480.00, 1),
 ('rnw_crs_19','RN-2026-90019','pol_crs_19','final-notice',     3, NULL, 2),
 ('rnw_crs_20','RN-2026-90020','pol_crs_20','approved',         2, 9950.00, 1),
 ('rnw_crs_21','RN-2026-90021','pol_crs_21','final-notice',     3, NULL, 3),
 ('rnw_crs_22','RN-2026-90022','pol_crs_22','lapsed',           3, NULL, 3),
 ('rnw_crs_23','RN-2026-90023','pol_crs_23','renewed',          2, 2750.00, 1)
) AS v(id, num, policy, status, stage, pnew, contacts)
JOIN policies p ON p.id = v.policy
ON CONFLICT (id) DO NOTHING;

INSERT INTO renewal_notices(renewal_id, stage, notice_type, method, recipient, sent_by, sent_at)
SELECT r.id, s.stage, (ARRAY['first','second','final'])[s.stage], CASE WHEN cl.email IS NULL THEN 'Letter' ELSE 'Email' END, COALESCE(cl.email, cl.address), 'seed',
       now() - ((5 * (4 - s.stage) + 20) || ' days')::interval
FROM renewals r JOIN clients cl ON cl.id = r.client_id CROSS JOIN LATERAL generate_series(1, r.notice_stage) AS s(stage)
WHERE r.id LIKE 'rnw_crs_%'
ON CONFLICT (renewal_id, stage) DO NOTHING;

INSERT INTO renewal_activities(renewal_id, at, by_user, activity_type, method, description, outcome, next_action, follow_up_date, details)
SELECT v.rid, now() - (v.ago || ' days')::interval, 'BrokerVerse', v.type, v.method, v.descr, v.outcome, v.next, current_date + v.fu, v.details::jsonb
FROM (VALUES
 ('rnw_crs_13', 6, 'Reminder', 'SMS', 'Renewal reminder via SMS', 'Client acknowledged', 'Send quote', 5, '{}'),
 ('rnw_crs_14', 9, 'Quote Generated', NULL, 'Re-rated renewal quote: claims loading applied for 2 claims', NULL, NULL, NULL, '{}'),
 ('rnw_crs_14', 5, 'Meeting', 'Face-to-face', 'Discussed renewal terms and the claims history', 'Client concerned about the premium increase', 'Ask insurer for alternative deductible', 4, '{}'),
 ('rnw_crs_14', 2, 'Counter Offer', 'Email', 'Client requested a maximum 8% increase', 'Referred to the insurer', 'Submit for approval', 3, '{}'),
 ('rnw_crs_15', 3, 'Negotiation', 'Phone', 'Agreed renewal at the re-rated premium with free roadside assistance', 'Accepted', 'Approval', 1, '{}'),
 ('rnw_crs_18', 4, 'Initial Contact', 'Email', 'Sent renewal quote for the delivery fleet', 'Awaiting fleet list update', 'Follow up', 2, '{}'),
 ('rnw_crs_19', 7, 'Reminder', 'Phone', 'Called client - no e-mail on file, notice sent by letter', 'Will visit the office', NULL, NULL, '{}'),
 ('rnw_crs_21', 3, 'Reminder', 'Phone', 'Policy in grace period; reminded client', 'Payment promised next week', 'Collect payment', 6, '{}'),
 ('rnw_crs_22', 15, 'Win-back', 'Phone', '10% loyalty discount on reinstatement', 'No response', NULL, NULL, '{"offer": "10% loyalty discount", "campaignId": "wb_crs_01"}')
) AS v(rid, ago, type, method, descr, outcome, next, fu, details)
WHERE NOT EXISTS (SELECT 1 FROM renewal_activities a WHERE a.renewal_id LIKE 'rnw_crs_%');

INSERT INTO renewal_quotes(id, quote_number, renewal_id, status, valid_until, previous_premium, base_premium, claims_loading, loyalty_discount, net_premium, taxes, total_premium, variance, variance_pct, rating, created_by, created_at)
VALUES
 ('rq_crs_14','RQ-2026-90014','rnw_crs_14','generated', current_date + 21, 68200.00, 60500.00, 12100.00, 0, 72600.00,
  '{"vat": 8712.00, "dst": 9075.00, "lgt": 544.50, "fst": 0}', 90931.50, 22731.50, 33.33, '{"line": "motor", "rate": 0.0275, "claims": 2, "loadingPct": 0.2, "loyaltyYears": 0}', 'seed', now() - interval '9 days'),
 ('rq_crs_15','RQ-2026-90015','rnw_crs_15','generated', current_date + 25, 27590.00, 24475.00, 0, 0, 24475.00,
  '{"vat": 2937.00, "dst": 3059.38, "lgt": 183.56, "fst": 0}', 30654.94, 3064.94, 11.11, '{"line": "motor", "rate": 0.0275, "claims": 0, "loadingPct": 0, "loyaltyYears": 0}', 'seed', now() - interval '4 days')
ON CONFLICT (id) DO NOTHING;
UPDATE renewals SET premium_new = 90931.50 WHERE id = 'rnw_crs_14' AND premium_new = 79836.45;

INSERT INTO renewal_batches(id, batch_number, status, criteria, created_by, created_at, completed_at) VALUES
 ('rb_crs_01','RB-2026-90001','Completed','{"expiryDateFrom": null, "productType": "", "paymentStatus": ""}','BrokerVerse', now() - interval '12 days', now() - interval '12 days'),
 ('rb_crs_02','RB-2026-90002','Draft','{"productType": "Motor"}','BrokerVerse', now() - interval '1 day', NULL)
ON CONFLICT (id) DO NOTHING;
INSERT INTO renewal_batch_policies(batch_id, policy_id, renewal_id, is_selected, notice_status, notice_sent_at, error, attempts)
SELECT v.b, v.p, v.r, v.sel, v.st, CASE WHEN v.st = 'Sent' THEN now() - interval '12 days' END, v.err, CASE WHEN v.st IN ('Sent','Failed') THEN 1 ELSE 0 END
FROM (VALUES
 ('rb_crs_01','pol_crs_12','rnw_crs_12', true, 'Sent', NULL),
 ('rb_crs_01','pol_crs_13','rnw_crs_13', true, 'Sent', NULL),
 ('rb_crs_01','pol_crs_17','rnw_crs_17', true, 'Sent', NULL),
 ('rb_crs_01','pol_crs_19','rnw_crs_19', true, 'Failed', 'Client Ramon Dela Cruz has no e-mail address'),
 ('rb_crs_02','pol_crs_11', NULL, false, 'NotSent', NULL),
 ('rb_crs_02','pol_crs_16', NULL, false, 'NotSent', NULL),
 ('rb_crs_02','pol_crs_18', NULL, false, 'NotSent', NULL)
) AS v(b, p, r, sel, st, err)
ON CONFLICT (batch_id, policy_id) DO NOTHING;

INSERT INTO winback_campaigns(id, campaign_number, name, target_segment, start_date, end_date, discount_pct, budget, offers, created_by)
VALUES ('wb_crs_01','WB-2026-90001','Balik-Kliyente Win-back','Lapsed in the last 90 days', current_date - 30, current_date + 60, 10, 50000,
        '["Waived reinstatement fee", "Free roadside assistance for 3 months", "Instalment payment option"]', 'seed')
ON CONFLICT (id) DO NOTHING;

-- Put any other policies that expire within the pipeline window into the renewal pipeline
INSERT INTO renewals(renewal_number, policy_id, client_id, owner_user_id, status, due_date, premium_old, created_by)
SELECT next_number('renewal', COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'numbering.renewal.prefix'), 'RN')),
       p.id, p.client_id, p.owner_user_id, 'pipeline', p.expiry_date, p.premium_total, 'seed'
FROM policies p
WHERE p.status IN ('active', 'issued') AND p.renewed_to IS NULL
  AND p.expiry_date BETWEEN current_date AND current_date + COALESCE((SELECT (value #>> '{}')::int FROM app_settings WHERE key = 'renewals.pipeline_days'), 90)
  AND NOT EXISTS (SELECT 1 FROM renewals r WHERE r.policy_id = p.id)
ORDER BY p.expiry_date;
