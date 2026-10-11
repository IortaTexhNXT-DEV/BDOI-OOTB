-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true. Quotation validity and versions (all fictional):
--  * QT-2026-95010 was sent to the customer, changed at the customer's request (acts of nature removed) and sent again:
--    version 1 is kept read-only, version 2 waits for the customer;
--  * QT-2026-95011, accepted by the customer, had its validity extended once by 30 days while the loan was released.
-- Idempotent: each change is made only while the quotation is still as 84_sales.sql left it.

INSERT INTO quote_versions(quote_id, version, status, doc, sum_insured, premium_base, premium_total, commission_rate, commission_amount, currency,
  insurance_company_id, valid_until, approval_sent_to, approval_sent_at, version_started_at, superseded_by, superseded_at, change_reason)
SELECT q.id, 1, 'sent', q.doc, q.sum_insured, round(q.premium_base * 1.08, 2), round(q.premium_total * 1.08, 2), q.commission_rate,
       round(q.commission_amount * 1.08, 2), q.currency, q.insurance_company_id, q.valid_until, COALESCE(q.approval_sent_to, l.email), q.created_at + interval '2 hours',
       q.created_at, (SELECT id FROM users WHERE username = 'agent.msantos'), q.created_at + interval '1 day', 'Customer asked to remove the acts of nature cover'
  FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id
 WHERE q.id = 'qt_sls_10' AND q.version = 1 AND q.status = 'sent'
ON CONFLICT (quote_id, version) DO NOTHING;

UPDATE quotes SET version = 2, version_started_at = created_at + interval '1 day'
 WHERE id = 'qt_sls_10' AND version = 1 AND EXISTS (SELECT 1 FROM quote_versions v WHERE v.quote_id = 'qt_sls_10' AND v.version = 1);

UPDATE quotes SET valid_until = valid_until + 30, extension_count = 1, extended_at = created_at + interval '5 days',
       extended_by = (SELECT id FROM users WHERE username = 'agent.msantos'), extension_remarks = 'Customer waiting for the release of the auto loan'
 WHERE id = 'qt_sls_11' AND extension_count = 0 AND status = 'accepted';

-- POL-2026-95007: the insurer corrected the expiry date after issuance; the correction waits for a second user.
INSERT INTO policy_corrections(id, policy_id, changes, reason_code, reason, insurer_reference, requested_by, requested_at)
SELECT 'pcr_sample_01', p.id, jsonb_build_object('expiry', jsonb_build_object('from', p.expiry_date, 'to', p.expiry_date + 1)),
       'PCR-INSURER', 'Corrected policy issued by the insurer', 'MAP-END-2026-0042', (SELECT id FROM users WHERE username = 'agent.msantos'), now() - interval '2 hours'
  FROM policies p
 WHERE p.id = 'pol_sls_07' AND p.status = 'active'
   AND NOT EXISTS (SELECT 1 FROM policy_corrections c WHERE c.policy_id = p.id)
ON CONFLICT (id) DO NOTHING;

-- An endorsement waiting for a second user: change of plate number on POL-2026-95003, raised by the account executive.
INSERT INTO endorsements(id, endorsement_number, policy_id, client_id, endorsement_type, status, changes, premium_delta, effective_date, remarks, endorsement_type_ids,
  is_cancel, created_by, endorsement_type_codes, submitted_at, submitted_by, created_at, updated_at)
SELECT 'end_sample_95101', 'END-2026-95101', p.id, p.client_id, 'motor-details', 'for-approval', '{"motorDetails":{"PlateNumber":"NDQ 5521"}}'::jsonb, 0, current_date,
       'New plate issued by the LTO', '[2]'::jsonb, false, u.id,
       '[{"code":"CPLT","name":"Change of Plate Number","section":"vehicle","financial":false,"premiumImpact":false}]'::jsonb, now() - interval '3 hours', u.id,
       now() - interval '4 hours', now() - interval '3 hours'
  FROM policies p, users u
 WHERE p.id = 'pol_sls_03' AND p.status = 'active' AND u.username = 'agent.msantos'
ON CONFLICT (id) DO NOTHING;

-- A Credit Life renewal quotation (CL-VOL) of Enrique Tolentino: the sum insured follows the outstanding balance of
-- PHP 650,000 at 3.68 per 1,000, so it waits for the approval of the reduced sum insured.
INSERT INTO quotes(id, quote_number, lead_id, product_id, insurance_company_id, agent_user_id, created_by, status, product_type, lob, sum_insured, premium_base, vat, dst, lgt, fst,
  others, premium_total, commission_rate, commission_amount, currency, issued_on, valid_until, doc, created_at, updated_at, version_started_at)
SELECT 'qt_sample_cl_01', 'QT-2026-95101', l.id, p.id, ic.id, u.id, u.id, 'draft', 'CL-VOL', 'LIFE', 650000, 2392, 0, 299, 17.94, 0, 47.84, 2756.78, 0.15, 358.8, 'PHP',
       current_date - 2, current_date + 28,
       jsonb_build_object('productType', 'CL-VOL', 'totalSumInsured', 650000, 'netPremium', 2392, 'discount', 0, 'insuranceCompanyName', ic.name,
         'creditLife', jsonb_build_object('loanAccountNo', 'TFS-2023-0045817', 'borrowerBirthDate', l.birth_date, 'borrowerAge', date_part('year', age(current_date, l.birth_date))::int,
           'accountCount', 1, 'pendingBalance', 0, 'loanTermYears', 3, 'sumInsured', 650000, 'ratePerThousand', 3.68, 'defaultSumInsured', 1000000),
         'underwritingReferral', jsonb_build_object('status', 'pending', 'ruleCodes', jsonb_build_array('CL_SI_REDUCTION'),
           'authorityRoles', jsonb_build_array('tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-unit-head', 'tis-general-manager'),
           'authorityRoleNames', jsonb_build_array('TIS Sales Officer', 'TIS Sales Unit Head', 'TIS Operations Unit Head', 'TIS General Manager'),
           'reasons', jsonb_build_array('CL_SI_REDUCTION: Sum insured reduced from PHP 1,000,000.00 to PHP 650,000.00: approval needed before issuance'),
           'requestedAt', to_char(now() - interval '2 days', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'creditLifeSumInsured', 650000)),
       now() - interval '2 days', now() - interval '2 days', now() - interval '2 days'
  FROM leads l, products p, insurance_companies ic, users u
 WHERE l.id = 'ld_sls_12' AND p.code = 'CL-VOL' AND ic.name = 'Malayan Insurance Co., Inc.' AND u.username = 'agent.msantos'
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- promotions and discount caps (PROD-15)
-- An active Fortuner and Vios promotion, a Hilux gross premium discount waiting for approval, a Vios lock-in draft
-- and an expired Innova promotion; a proposed affinity partner cap waiting for approval.
INSERT INTO promotions(id, code, version, name, period_from, period_to, benefit, excess, unit_quota, lockin_years, product_ids, insurer_ids, channel_types,
  combine_dealer, combine_discount, status, notes, created_by, updated_by, created_at, submitted_by, submitted_at, decided_by, decided_at, decision_note)
SELECT v.id, v.code, 1, v.name, CURRENT_DATE + v.from_days, CURRENT_DATE + v.to_days, v.benefit, jsonb_build_object(p.id::text, v.excess), v.quota, v.lockin,
       jsonb_build_array(p.id), (SELECT jsonb_agg(id ORDER BY id) FROM insurance_companies WHERE name IN ('Malayan Insurance Co., Inc.', 'Maagap Insurance, Inc.', 'Pioneer Insurance & Surety Corp.')),
       v.channels::jsonb, v.dealer, false, v.status, v.notes, mk.id, mk.id, now() - interval '20 days',
       CASE WHEN v.status <> 'draft' THEN mk.id END, CASE WHEN v.status <> 'draft' THEN now() - interval '15 days' END,
       CASE WHEN v.status IN ('active', 'expired') THEN ap.id END, CASE WHEN v.status IN ('active', 'expired') THEN now() - interval '12 days' END,
       CASE WHEN v.status = 'active' THEN 'Rates agreed with Malayan, Maagap and Pioneer' END
FROM products p, (SELECT id FROM users WHERE username = 'agent.preyes') mk, (SELECT id FROM users WHERE username = 'fin.approver') ap,
  (VALUES ('prm_sample_01', 'PRM-FORTUNER26', 'Fortuner and Vios launch rate', -9, 82, 'rate', 2000, 500, NULL::int, '["financing_bank", "dealer"]', true, 'active', 'Brand-new Fortuner and Vios financed by TFS or sold by Toyota dealers'),
          ('prm_sample_02', 'PRM-HILUX-Q4', 'Hilux year-end 10% off', 3, 80, 'discount', 3000, 200, NULL, '["financing_bank", "direct"]', false, 'pending-approval', 'Gross premium discount on brand-new Hilux'),
          ('prm_sample_03', 'PRM-VIOS-LOCK3', 'Vios three-year rate lock', 20, 140, 'rate', 2000, NULL, 3, '["financing_bank"]', false, 'draft', 'Rate kept for three policy years'),
          ('prm_sample_04', 'PRM-INNOVA-SUMMER', 'Innova summer rate', -160, -40, 'rate', 2000, 300, NULL, '["dealer"]', false, 'expired', NULL)
  ) AS v(id, code, name, from_days, to_days, benefit, excess, quota, lockin, channels, dealer, status, notes)
WHERE p.code = 'MOTOR' AND NOT EXISTS (SELECT 1 FROM promotions x WHERE x.id = v.id OR upper(x.code) = v.code);

INSERT INTO promotion_lines(promotion_id, line_no, variant_id, year_from, year_to, promo_od, min_od, promo_aon, remit_od, remit_aon, discount_pct)
SELECT l.pid, l.n, vv.id, EXTRACT(YEAR FROM CURRENT_DATE)::int - 1, EXTRACT(YEAR FROM CURRENT_DATE)::int + 1, l.od, l.minod, l.aon, l.rod, l.raon, l.pct
FROM (VALUES ('prm_sample_01', 1, 'Fortuner', '2.4 G 4x2 AT', 1.6, 1.6, 0.4, 1.4, 0.3, NULL::numeric),
             ('prm_sample_01', 2, 'Vios', '1.3 XLE CVT', 1.7, 1.6, 0.45, 1.5, 0.35, NULL),
             ('prm_sample_02', 1, 'Hilux', '2.4 E 4x2 MT', NULL, NULL, NULL, 1.7, 0.4, 10),
             ('prm_sample_03', 1, 'Vios', '1.5 G MT', 1.75, 1.7, 0.45, 1.55, 0.35, NULL),
             ('prm_sample_04', 1, 'Innova', '2.8 E AT', 1.7, 1.7, 0.45, 1.5, 0.35, NULL)
  ) AS l(pid, n, model, variant, od, minod, aon, rod, raon, pct)
JOIN vehicle_models m ON m.name = l.model JOIN vehicle_variants vv ON vv.model_id = m.id AND vv.name = l.variant
WHERE EXISTS (SELECT 1 FROM promotions p WHERE p.id = l.pid) AND NOT EXISTS (SELECT 1 FROM promotion_lines x WHERE x.promotion_id = l.pid AND x.line_no = l.n);

INSERT INTO discount_caps(product_id, channel_type, min_pct, max_pct, lowest_od, effective_from, status, remarks, created_by)
SELECT p.id, 'affinity', 0, 18, 1.5, CURRENT_DATE + 7, 'pending', 'Affinity partners of the Toyota owners club', (SELECT id FROM users WHERE username = 'agent.preyes')
FROM products p WHERE p.code = 'MOTOR' AND NOT EXISTS (SELECT 1 FROM discount_caps c WHERE c.product_id = p.id AND c.channel_type = 'affinity');
