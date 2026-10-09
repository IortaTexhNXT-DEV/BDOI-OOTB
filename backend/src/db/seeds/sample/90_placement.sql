-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true. Placement journey examples (all fictional):
--  * a request for quotation (broker slip) of a group PA with the panel insurers' answers in (two offers, one decline),
--  * a request for quotation of a fleet of delivery pick-ups just submitted to the market (answers pending),
--  * a placement slip for each quotation the client accepted, at every step of the TISPH chain: raised, sent to the
--    insurer, acknowledged, e-policy received (compared with the slip), checked against the slip by a second user, and
--    insurer issued (the policies of 84_sales.sql, booked from their slip),
--  * a direct CTPL placement sent to the insurer.
-- Also backfills risk_participants for the sample quotations and policies. Idempotent by fixed id.

INSERT INTO broker_slips(id, slip_number, lead_id, client_id, product_id, product_type, lob, insured_name, risk_details, requested_covers, sum_insured, currency,
  inception_date, expiry_date, submission_date, response_due_date, status, remarks, owner_user_id, created_by, created_at, updated_at)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.broker_slip.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num,
  v.lead, v.client, (SELECT id FROM products WHERE code = v.product), v.ptype, v.lob, v.insured, v.risk::jsonb, v.covers::jsonb, v.si, 'PHP',
  current_date + 30, current_date + 395, current_date - v.ago + 1, current_date - v.ago + 8, v.status, v.remarks,
  (SELECT id FROM users WHERE username = 'BrokerVerse'), (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - make_interval(days => v.ago), now() - make_interval(days => v.ago)
FROM (VALUES
 ('bs_sample_01', '90001', NULL, 'cl_sls_92', 'GPA', 'Group Personal Accident', 'ACCIDENT', 'Northstar BPO Services Inc.',
  '{"members":250,"occupation":"Call centre agents and team leaders (office work, night shift)","location":"Ayala Avenue, Makati City","currentInsurer":"None (first group cover)"}',
  '[{"cover":"Accidental death and disablement","sumInsured":200000},{"cover":"Medical reimbursement","sumInsured":20000},{"cover":"Burial benefit","sumInsured":10000}]',
  50000000, 'responses-in', 'Annual group PA for 250 employees; HR asked for two options', 9),
 ('bs_sample_02', '90002', NULL, 'cl_crs_05', 'MOTOR', 'Motor', 'MOTOR', 'Mindanao Agri Trading Inc.',
  '{"vehicles":6,"description":"Toyota Hilux 2.4 E 4x2 MT delivery pick-ups, 2023 to 2025 models","use":"Own goods, Davao region","claimsLast3Years":2}',
  '[{"cover":"Own damage and theft","sumInsured":7200000},{"cover":"Acts of nature","sumInsured":7200000},{"cover":"Excess bodily injury and property damage","sumInsured":400000}]',
  7200000, 'submitted', 'Fleet renewal marketing: claims loading of the incumbent insurer questioned', 3)
) AS v(id, num, lead, client, product, ptype, lob, insured, risk, covers, si, status, remarks, ago)
ON CONFLICT (id) DO NOTHING;

INSERT INTO insurer_offers(id, offer_number, broker_slip_id, insurance_company_id, status, premium, rate, taxes, premium_total, sum_insured, deductibles, terms,
  validity_date, offered_share, insurer_reference, decline_reason, requested_at, responded_at, created_by)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.insurer_offer.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num, v.slip, ic.id, v.status,
  v.premium, CASE WHEN v.premium IS NOT NULL THEN round(v.premium / v.si * 100, 6) END,
  CASE WHEN v.premium IS NOT NULL THEN (pg_temp.smp_price(v.product, v.premium)->>'gross')::numeric - v.premium END,
  CASE WHEN v.premium IS NOT NULL THEN (pg_temp.smp_price(v.product, v.premium)->>'gross')::numeric END,
  CASE WHEN v.premium IS NOT NULL THEN v.si END, v.ded, v.terms, CASE WHEN v.premium IS NOT NULL THEN current_date + 25 END, v.share, v.ref, v.decline,
  now() - interval '8 days', CASE WHEN v.status <> 'pending' THEN now() - interval '3 days' END, (SELECT id FROM users WHERE username = 'BrokerVerse')
FROM (VALUES
 ('ofr_sample_01', '90001', 'bs_sample_01', 'GPA',   'PIONEER',    'offered', 87500::numeric, 50000000::numeric, NULL, 'Age limit 18 to 65; medical reimbursement on a per-accident basis', 100::numeric, 'PIO-GPA-2026-0457', NULL),
 ('ofr_sample_02', '90002', 'bs_sample_01', 'GPA',   'AXA',        'offered', 92500, 50000000, NULL, 'Includes murder and assault; 24/7 cover', 100, 'AXA-GPA-2026-1181', NULL),
 ('ofr_sample_03', '90003', 'bs_sample_01', 'GPA',   'MAAGAP',     'declined', NULL, 50000000, NULL, NULL, 100, NULL, 'Night-shift group outside the current appetite'),
 ('ofr_sample_04', '90004', 'bs_sample_02', 'MOTOR', 'PIONEER',    'pending', NULL, 7200000, NULL, NULL, 100, NULL, NULL),
 ('ofr_sample_05', '90005', 'bs_sample_02', 'MOTOR', 'STRONGHOLD', 'pending', NULL, 7200000, NULL, NULL, 100, NULL, NULL)
) AS v(id, num, slip, product, insurer, status, premium, si, ded, terms, share, ref, decline)
JOIN insurance_companies ic ON ic.code = v.insurer
ON CONFLICT (id) DO NOTHING;

-- Placement slips of the accepted quotations, one per step of the chain
WITH v(qid, num, step, sent_ago, ack_ago, ep_ago, chk_ago, plate) AS (VALUES
 ('qt_sls_01', '90101', 'issued',           NULL::int, NULL::int, NULL::int, NULL::int, NULL),
 ('qt_sls_02', '90102', 'issued',           NULL, NULL, NULL, NULL, NULL),
 ('qt_sls_03', '90103', 'issued',           NULL, NULL, NULL, NULL, NULL),
 ('qt_sls_04', '90104', 'issued',           NULL, NULL, NULL, NULL, NULL),
 ('qt_sls_05', '90105', 'issued',           NULL, NULL, NULL, NULL, NULL),
 ('qt_sls_06', '90106', 'issued',           NULL, NULL, NULL, NULL, NULL),
 ('qt_sls_07', '90107', 'issued',           NULL, NULL, NULL, NULL, NULL),
 ('qt_sls_08', '90108', 'issued',           NULL, NULL, NULL, NULL, NULL),
 ('qt_sls_11', '90111', 'draft',            NULL, NULL, NULL, NULL, NULL),
 ('qt_sls_12', '90112', 'sent',             2,    NULL, NULL, NULL, NULL),
 ('qt_sls_17', '90117', 'acknowledged',     10,   8,    NULL, NULL, NULL),
 ('qt_sls_18', '90118', 'epolicy_received', 9,    8,    1,    NULL, 'NIA 1818'),
 ('qt_sls_19', '90119', 'checked',          8,    7,    3,    1,    'GAD 1919')
), x AS (
  SELECT v.*, q.*, p.id AS pol_id, p.inception_date AS pol_incep, p.expiry_date AS pol_exp, p.doc AS pol_doc, p.created_at AS pol_created,
    COALESCE(p.inception_date, (q.updated_at + interval '7 days')::date) AS incep, ic.code AS ic_code, ic.name AS ic_name,
    (SELECT display_name FROM leads WHERE id = q.lead_id) AS insured
  FROM v JOIN quotes q ON q.id = v.qid JOIN insurance_companies ic ON ic.id = q.insurance_company_id LEFT JOIN policies p ON p.quote_id = q.id
), e AS (
  SELECT x.*, CASE WHEN x.step IN ('epolicy_received', 'checked', 'issued') THEN jsonb_build_object(
      'insurerPolicyNumber', COALESCE(x.pol_doc->>'insurerPolicyNumber', upper(left(x.ic_code, 3)) || '-MC-' || to_char(x.incep, 'YYYY') || '-' || lpad(right(x.num, 3), 6, '0')),
      'brokerPolicyNumber', NULL, 'participantName', x.insured, 'sumInsured', x.sum_insured, 'netPremium', x.premium_base, 'grossPremium', x.premium_total,
      'commissionAmount', x.commission_amount, 'issueDate', to_char(x.incep - 1, 'YYYY-MM-DD'), 'issuanceDate', to_char(x.incep - 1, 'YYYY-MM-DD'),
      'effectiveDate', to_char(x.incep, 'YYYY-MM-DD'), 'expiryDate', to_char(COALESCE(x.pol_exp, (x.incep + interval '1 year')::date), 'YYYY-MM-DD'), 'productionDate', NULL,
      'deductible', NULL, 'remarks', NULL, 'vehiclePhotoKey', NULL, 'vehiclePhotoName', NULL)
      || CASE WHEN x.lob = 'MOTOR' THEN jsonb_build_object('vehicle', jsonb_build_object('plateNumber', COALESCE(x.plate, x.doc->>'plateNumber'), 'chassisNumber', x.doc->>'chassisNumber',
           'motorNumber', x.doc->>'motorNumber', 'mvFileNumber', NULL)) ELSE '{}'::jsonb END END AS ep
  FROM x
)
INSERT INTO placements(id, placement_number, source, quote_id, lead_id, client_id, product_id, policy_type_id, product_type, lob, insurance_company_id, insured_name, doc,
  sum_insured, premium_base, vat, dst, lgt, fst, others, discount, premium_total, commission_rate, commission_amount, currency, inception_date, expiry_date, status,
  sent_at, issued_at, policy_id, owner_user_id, created_by, updated_by, created_at, updated_at,
  acknowledged_at, acknowledged_by, acknowledgement_reference, acknowledgement_remarks, epolicy, epolicy_received_at, epolicy_received_by,
  check_status, check_result, check_decision, checked_at, checked_by, issued_by)
SELECT 'plc_sample_' || right(e.qid, 2), (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.placement.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || e.num,
  'quote', e.qid, e.lead_id, e.client_id, e.product_id, e.policy_type_id, e.product_type, e.lob, e.insurance_company_id, e.insured, e.doc,
  e.sum_insured, e.premium_base, e.vat, e.dst, e.lgt, e.fst, e.others, 0, e.premium_total, e.commission_rate, e.commission_amount, e.currency,
  e.incep, COALESCE(e.pol_exp, (e.incep + interval '1 year')::date), e.step,
  CASE WHEN e.step = 'issued' THEN e.pol_created - interval '4 days' WHEN e.sent_ago IS NOT NULL THEN now() - make_interval(days => e.sent_ago) END,
  CASE WHEN e.step = 'issued' THEN e.pol_created END, e.pol_id,
  e.created_by, e.created_by, e.created_by,
  CASE WHEN e.step = 'issued' THEN e.pol_created - interval '6 days' ELSE e.customer_accepted_at END, CASE WHEN e.step = 'issued' THEN e.pol_created ELSE now() END,
  CASE WHEN e.step = 'issued' THEN e.pol_created - interval '3 days' WHEN e.ack_ago IS NOT NULL THEN now() - make_interval(days => e.ack_ago) END,
  CASE WHEN e.step = 'issued' OR e.ack_ago IS NOT NULL THEN e.created_by END,
  CASE WHEN e.step = 'issued' OR e.ack_ago IS NOT NULL THEN upper(left(e.ic_code, 3)) || '-ACK-' || right(e.num, 4) END,
  CASE WHEN e.step = 'issued' OR e.ack_ago IS NOT NULL THEN 'Received by the motor and accident underwriting desk' END,
  COALESCE(e.ep, '{}'::jsonb),
  CASE WHEN e.step = 'issued' THEN e.pol_created - interval '1 day' WHEN e.ep_ago IS NOT NULL THEN now() - make_interval(days => e.ep_ago) END,
  CASE WHEN e.ep IS NOT NULL THEN (SELECT id FROM users WHERE username = 'agent.msantos') END,
  CASE WHEN e.ep IS NOT NULL THEN 'match' END,
  CASE WHEN e.ep IS NOT NULL THEN jsonb_build_object('result', 'match', 'tolerance', jsonb_build_object('amount', 1, 'percent', 0), 'differences', '[]'::jsonb, 'items', jsonb_build_array(
      jsonb_build_object('key', 'netPremium', 'label', 'Net premium', 'slip', e.premium_base, 'epolicy', e.premium_base, 'difference', 0, 'status', 'match'),
      jsonb_build_object('key', 'grossPremium', 'label', 'Gross premium', 'slip', e.premium_total, 'epolicy', e.premium_total, 'difference', 0, 'status', 'match'),
      jsonb_build_object('key', 'sumInsured', 'label', 'Sum insured', 'slip', e.sum_insured, 'epolicy', e.sum_insured, 'difference', 0, 'status', 'match'),
      jsonb_build_object('key', 'commissionAmount', 'label', 'Commission', 'slip', e.commission_amount, 'epolicy', e.commission_amount, 'difference', 0, 'status', 'match'),
      jsonb_build_object('key', 'effectiveDate', 'label', 'Effective date', 'slip', e.ep->>'effectiveDate', 'epolicy', e.ep->>'effectiveDate', 'difference', NULL, 'status', 'match'),
      jsonb_build_object('key', 'expiryDate', 'label', 'Expiry date', 'slip', e.ep->>'expiryDate', 'epolicy', e.ep->>'expiryDate', 'difference', NULL, 'status', 'match'),
      jsonb_build_object('key', 'insuredName', 'label', 'Insured', 'slip', e.insured, 'epolicy', e.insured, 'difference', NULL, 'status', 'match'))
    || CASE WHEN e.lob = 'MOTOR' THEN jsonb_build_array(
      jsonb_build_object('key', 'chassisNumber', 'label', 'Chassis number', 'slip', e.doc->>'chassisNumber', 'epolicy', e.doc->>'chassisNumber', 'difference', NULL, 'status', 'match'),
      jsonb_build_object('key', 'motorNumber', 'label', 'Engine / motor number', 'slip', e.doc->>'motorNumber', 'epolicy', e.doc->>'motorNumber', 'difference', NULL, 'status', 'match'),
      jsonb_build_object('key', 'plateNumber', 'label', 'Plate number', 'slip', NULLIF(e.doc->>'plateNumber', 'TBA'), 'epolicy', e.ep->'vehicle'->>'plateNumber', 'difference', NULL,
        'status', CASE WHEN e.doc->>'plateNumber' = 'TBA' THEN 'captured' ELSE 'match' END)) ELSE '[]'::jsonb END) END,
  CASE WHEN e.step IN ('checked', 'issued') THEN 'confirmed' END,
  CASE WHEN e.step = 'issued' THEN e.pol_created - interval '12 hours' WHEN e.chk_ago IS NOT NULL THEN now() - make_interval(days => e.chk_ago) END,
  CASE WHEN e.step IN ('checked', 'issued') THEN e.created_by END,
  CASE WHEN e.step = 'issued' THEN e.created_by END
FROM e
ON CONFLICT (id) DO NOTHING;
UPDATE policies p SET placement_id = pl.id, doc = p.doc || jsonb_build_object('placementNumber', pl.placement_number, 'epolicy', pl.epolicy)
FROM placements pl WHERE pl.policy_id = p.id AND pl.id LIKE 'plc_sample_%' AND p.placement_id IS NULL;

-- Direct placement: a CTPL for a client's motorcycle, sent to the insurer with the LTO registration
INSERT INTO placements(id, placement_number, source, client_id, product_id, product_type, lob, insurance_company_id, insured_name, doc, sum_insured, premium_base,
  vat, dst, lgt, premium_total, commission_rate, commission_amount, currency, inception_date, expiry_date, status, sent_at, remarks, owner_user_id, created_by, created_at, updated_at)
SELECT 'plc_sample_91', (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.placement.prefix') || '-' || to_char(current_date, 'YYYY') || '-90191', 'direct', 'cl_sls_91',
  p.id, p.name, 'MOTOR', ic.id, 'Lourdes Pascual',
  jsonb_build_object('riskDetails', jsonb_build_object('plateNumber', '456 QWE', 'vehicle', 'Honda Click 125i (2024)', 'vehicleType', 'motorcycles_tricycles', 'mvFileNumber', '1301-00000456123')),
  100000, 0, 0, 0, 0, (SELECT (config->'ctplSetting'->>'motorcycles_tricycles')::numeric FROM product_templates
    WHERE template_code = (SELECT value #>> '{}' FROM app_settings WHERE key = 'motor.pricing_template_code')), 0, 0, 'PHP', current_date + 5, current_date + 370, 'sent', now() - interval '1 day',
  'Client renews the registration at LTO next week', (SELECT id FROM users WHERE username = 'BrokerVerse'), (SELECT id FROM users WHERE username = 'BrokerVerse'),
  now() - interval '2 days', now() - interval '1 day'
FROM insurance_companies ic, products p WHERE ic.code = 'MAAGAP' AND p.code = 'CTPL'
ON CONFLICT (id) DO NOTHING;

-- participants of the sample placements: the insurer of the slip takes 100%, confirmed once the e-policy is in
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT pl.* FROM placements pl WHERE pl.id LIKE 'plc_sample_%'
      AND NOT EXISTS (SELECT 1 FROM risk_participants rp WHERE rp.entity_type = 'placement' AND rp.entity_id = pl.id) LOOP
    PERFORM rp_write_split('placement', r.id, jsonb_build_array(jsonb_build_object('ic', r.insurance_company_id, 'share', 100, 'lead', true)),
      r.sum_insured, r.premium_base, r.vat + r.dst + r.lgt + r.fst + r.others, r.premium_total, r.commission_amount, r.commission_rate, 'sample');
    UPDATE risk_participants SET status = CASE WHEN r.epolicy <> '{}'::jsonb THEN 'confirmed' ELSE 'pending' END,
      confirmed_at = CASE WHEN r.epolicy <> '{}'::jsonb THEN r.epolicy_received_at END, insurer_reference = r.epolicy->>'insurerPolicyNumber'
    WHERE entity_type = 'placement' AND entity_id = r.id;
  END LOOP;
END $$;

SELECT backfill_risk_participants();
UPDATE risk_participants rp SET insurer_reference = p.doc->>'insurerPolicyNumber'
FROM policies p WHERE rp.entity_type = 'policy' AND rp.entity_id = p.id AND (p.id LIKE 'pol_sls_%' OR p.id LIKE 'pol_crs_%') AND rp.insurer_reference IS NULL AND p.doc ? 'insurerPolicyNumber';
