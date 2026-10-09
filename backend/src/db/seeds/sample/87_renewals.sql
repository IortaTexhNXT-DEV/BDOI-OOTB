-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Sample renewals in every state (pipeline through renewed / lapsed) of the motor, CTPL, personal accident, group PA
-- and travel terms of 85_claims_renewals_base.sql, the renewal quotes re-rated as the renewals module rates them,
-- notices, contact log, batches and a win-back campaign. Idempotent.
INSERT INTO renewals(id, renewal_number, policy_id, client_id, owner_user_id, status, due_date, premium_old, premium_new, notice_stage, last_notice_at,
                     contact_attempts, last_contact_at, submitted_by, submitted_at, approved_by, approved_at, lapse_reason, lapse_reason_code, lapsed_at, renewed_at, new_policy_id,
                     created_by, created_at)
SELECT v.id, v.num, p.id, p.client_id, p.owner_user_id, v.status, p.expiry_date, p.premium_total, v.pnew, v.stage,
       CASE WHEN v.stage > 0 THEN now() - ((5 * (4 - v.stage)) || ' days')::interval END,
       v.contacts, CASE WHEN v.contacts > 0 THEN now() - interval '2 days' END,
       CASE WHEN v.status IN ('pending-approval','approved') THEN (SELECT id FROM users WHERE username = 'BrokerVerse') END,
       CASE WHEN v.status IN ('pending-approval','approved') THEN now() - interval '1 day' END,
       NULL, CASE WHEN v.status = 'approved' THEN now() - interval '6 hours' END,
       CASE WHEN v.status = 'lapsed' THEN 'Customer No Longer Needs Coverage: car sold after the loan was paid' END,
       CASE WHEN v.status = 'lapsed' THEN 'LAP-COV' END,
       CASE WHEN v.status = 'lapsed' THEN now() - interval '20 days' END,
       CASE WHEN v.status = 'renewed' THEN now() - interval '9 days' END,
       CASE WHEN v.status = 'renewed' THEN 'pol_crs_24' END, 'seed', now() - interval '40 days'
FROM (VALUES
 ('rnw_crs_11','RN-2026-90011','pol_crs_11','pipeline',         0, NULL::numeric, 0),
 ('rnw_crs_12','RN-2026-90012','pol_crs_12','notice-1',         1, NULL, 0),
 ('rnw_crs_13','RN-2026-90013','pol_crs_13','notice-2',         2, NULL, 1),
 ('rnw_crs_14','RN-2026-90014','pol_crs_14','quoted',           1, NULL, 2),
 ('rnw_crs_15','RN-2026-90015','pol_crs_15','pending-approval', 1, NULL, 1),
 ('rnw_crs_16','RN-2026-90016','pol_crs_16','pipeline',         0, NULL, 0),
 ('rnw_crs_17','RN-2026-90017','pol_crs_17','notice-1',         1, NULL, 0),
 ('rnw_crs_18','RN-2026-90018','pol_crs_18','quoted',           0, NULL, 1),
 ('rnw_crs_19','RN-2026-90019','pol_crs_19','final-notice',     3, NULL, 2),
 ('rnw_crs_20','RN-2026-90020','pol_crs_20','approved',         2, NULL, 1),
 ('rnw_crs_21','RN-2026-90021','pol_crs_21','final-notice',     3, NULL, 3),
 ('rnw_crs_22','RN-2026-90022','pol_crs_22','lapsed',           3, NULL, 3),
 ('rnw_crs_23','RN-2026-90023','pol_crs_23','renewed',          2, NULL, 1)
) AS v(id, num, policy, status, stage, pnew, contacts)
JOIN policies p ON p.id = v.policy
ON CONFLICT (id) DO NOTHING;
UPDATE renewals SET premium_new = (SELECT premium_total FROM policies WHERE id = 'pol_crs_24') WHERE id = 'rnw_crs_23' AND premium_new IS NULL;

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
 ('rnw_crs_14', 9, 'Quote Generated', NULL, 'Re-rated renewal quote: claims loading applied for 2 claims (flood and theft)', NULL, NULL, NULL, '{}'),
 ('rnw_crs_14', 5, 'Meeting', 'Face-to-face', 'Discussed the fleet renewal and the claims history', 'Client concerned about the premium increase', 'Ask Standard for a higher deductible option', 4, '{}'),
 ('rnw_crs_14', 2, 'Counter Offer', 'Email', 'Client requested a maximum 10% increase', 'Referred to the insurer', 'Submit for approval', 3, '{}'),
 ('rnw_crs_15', 3, 'Negotiation', 'Phone', 'Agreed renewal at the re-rated premium with free roadside assistance', 'Accepted', 'Approval', 1, '{}'),
 ('rnw_crs_18', 4, 'Initial Contact', 'Email', 'Sent the renewal quote for the delivery pick-ups', 'Awaiting fleet list update', 'Follow up', 2, '{}'),
 ('rnw_crs_19', 7, 'Reminder', 'Phone', 'Called client - no e-mail on file, notice sent by letter', 'Will visit the office', NULL, NULL, '{}'),
 ('rnw_crs_21', 3, 'Reminder', 'Phone', 'Policy in grace period; reminded client', 'Payment promised next week', 'Collect payment', 6, '{}'),
 ('rnw_crs_22', 15, 'Win-back', 'Phone', '10% loyalty discount on a replacement Toyota', 'Car sold, no new vehicle yet', NULL, NULL, '{"offer": "10% loyalty discount", "campaignId": "wb_crs_01"}')
) AS v(rid, ago, type, method, descr, outcome, next, fu, details)
WHERE NOT EXISTS (SELECT 1 FROM renewal_activities a WHERE a.renewal_id LIKE 'rnw_crs_%');

-- Renewal quotes re-rated as the renewals module rates them (renewals.rating_rates on the sum insured, claims loading per
-- claim on the expiring term, taxes from the premium tax and charge engine)
WITH r AS (
  SELECT rn.id AS rid, v.qid, v.qnum, v.status, v.valid, v.ago, p.premium_total AS previous, p.sum_insured, pr.code AS product, pr.line,
    COALESCE(((SELECT value FROM app_settings WHERE key = 'renewals.rating_rates')->>pr.line)::numeric, 0) AS rate,
    LEAST((SELECT (value #>> '{}')::numeric FROM app_settings WHERE key = 'renewals.claims_loading_cap'),
          (SELECT count(*) FROM claims c WHERE c.policy_id = p.id) * (SELECT (value #>> '{}')::numeric FROM app_settings WHERE key = 'renewals.claims_loading_rate')) AS loading_pct,
    (SELECT count(*) FROM claims c WHERE c.policy_id = p.id)::int AS claims
  FROM (VALUES ('rq_crs_14','RQ-2026-90014','rnw_crs_14','generated',21,9), ('rq_crs_15','RQ-2026-90015','rnw_crs_15','generated',25,4),
               ('rq_crs_18','RQ-2026-90018','rnw_crs_18','generated',26,4), ('rq_crs_20','RQ-2026-90020','rnw_crs_20','generated',20,6)) AS v(qid, qnum, rid, status, valid, ago)
  JOIN renewals rn ON rn.id = v.rid JOIN policies p ON p.id = rn.policy_id JOIN products pr ON pr.id = p.product_id
), b AS (
  SELECT r.*, round(r.sum_insured * r.rate, 2) AS base FROM r
), n AS (
  SELECT b.*, round(b.base * b.loading_pct, 2) AS loading, round(b.base + round(b.base * b.loading_pct, 2), 2) AS net FROM b
), t AS (
  SELECT n.*, pg_temp.smp_price(n.product, n.net) AS m FROM n
)
INSERT INTO renewal_quotes(id, quote_number, renewal_id, status, valid_until, previous_premium, base_premium, claims_loading, loyalty_discount, net_premium, taxes, total_premium,
  variance, variance_pct, rating, created_by, created_at)
SELECT t.qid, t.qnum, t.rid, t.status, current_date + t.valid, t.previous, t.base, t.loading, 0, t.net,
  jsonb_build_object('vat', (t.m->>'vat')::numeric, 'dst', (t.m->>'dst')::numeric, 'lgt', (t.m->>'lgt')::numeric, 'fst', (t.m->>'fst')::numeric)
    || CASE WHEN (t.m->>'others')::numeric > 0 THEN jsonb_build_object('others', (t.m->>'others')::numeric) ELSE '{}'::jsonb END,
  (t.m->>'gross')::numeric, (t.m->>'gross')::numeric - t.previous, CASE WHEN t.previous > 0 THEN round(((t.m->>'gross')::numeric - t.previous) / t.previous * 100, 2) ELSE 0 END,
  jsonb_build_object('line', t.line, 'rate', t.rate, 'sumInsured', t.sum_insured, 'claims', t.claims, 'loadingPct', t.loading_pct, 'loyaltyYears', 0, 'loyaltyPct', 0),
  'seed', now() - make_interval(days => t.ago)
FROM t
ON CONFLICT (id) DO NOTHING;
UPDATE renewals r SET premium_new = q.total_premium, premium_breakdown = jsonb_build_object('netPremium', q.net_premium, 'grossPremium', q.total_premium) || q.taxes
FROM renewal_quotes q WHERE q.renewal_id = r.id AND r.id LIKE 'rnw_crs_%' AND r.premium_new IS NULL;

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
VALUES ('wb_crs_01','WB-2026-90001','Balik-Kliyente Toyota Win-back','Lapsed in the last 90 days', current_date - 30, current_date + 60, 10, 50000,
        '["Waived reinstatement fee", "Free roadside assistance for 3 months", "Instalment payment through the TFS loan"]', 'seed')
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
