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

-- POL-2026-95002: the insurer corrected the expiry date after issuance; the correction waits for a second user.
INSERT INTO policy_corrections(id, policy_id, changes, reason_code, reason, insurer_reference, requested_by, requested_at)
SELECT 'pcr_sample_01', p.id, jsonb_build_object('expiry', jsonb_build_object('from', p.expiry_date, 'to', p.expiry_date + 1)),
       'PCR-INSURER', 'Corrected policy issued by the insurer', 'MAP-END-2026-0042', (SELECT id FROM users WHERE username = 'agent.msantos'), now() - interval '2 hours'
  FROM policies p
 WHERE p.id = 'pol_sls_02' AND p.status = 'active'
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
