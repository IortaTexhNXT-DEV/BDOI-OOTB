-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true. Placement journey examples (all fictional):
--  * a fire broker slip with the market's answers in (two offers whose lines make 100%, one decline),
--  * an IAR broker slip just submitted to the market (answers pending),
--  * a direct marine cargo placement slip (70% / 30% co-insurance) sent to the insurers.
-- Also backfills risk_participants for the sample quotations and policies loaded by the earlier sample files.
-- Idempotent by fixed id.

INSERT INTO broker_slips(id, slip_number, lead_id, product_id, product_type, lob, insured_name, risk_details, requested_covers, sum_insured, currency,
  inception_date, expiry_date, submission_date, response_due_date, status, remarks, owner_user_id, created_by, created_at, updated_at)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.broker_slip.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num,
  v.lead, (SELECT id FROM products WHERE code = v.product), v.ptype, v.lob, v.insured, v.risk::jsonb, v.covers::jsonb, v.si, 'PHP',
  current_date + 30, current_date + 395, current_date - v.ago + 1, current_date - v.ago + 8, v.status, v.remarks,
  (SELECT id FROM users WHERE username = 'BrokerVerse'), (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - make_interval(days => v.ago), now() - make_interval(days => v.ago)
FROM (VALUES
 ('bs_sample_01', '90001', 'ld_sls_11', 'FIRE', 'Fire and Allied Perils', 'FIRE', 'Pampanga Steelworks Inc.',
  '{"location":"Km 67 MacArthur Hwy., Dolores, San Fernando, Pampanga","occupancy":"Steel fabrication plant","construction":"Class A (steel frame, concrete walls, GI roof)","fireProtection":"Hydrants, sprinklers in the paint shop","earthquakeZone":"Zone 2"}',
  '[{"cover":"Fire and lightning","sumInsured":180000000},{"cover":"Earthquake fire and shock","sumInsured":180000000,"deductible":"2% of the sum insured"},{"cover":"Typhoon and flood","sumInsured":180000000,"deductible":"PHP 250,000 each and every loss"}]',
  180000000, 'responses-in', 'Renewal marketing: incumbent insurer increased the rate by 20%', 9),
 ('bs_sample_02', '90002', 'ld_sls_14', 'FIRE', 'Industrial All Risks', 'IAR', 'Davao Agro Processing Corp.',
  '{"location":"8 Quirino Ave., Poblacion District, Davao City","occupancy":"Fruit processing and cold storage","construction":"Class A","machinery":"Blast freezers, packing lines"}',
  '[{"cover":"Material damage (all risks)","sumInsured":95000000},{"cover":"Machinery breakdown","sumInsured":30000000,"deductible":"PHP 100,000"}]',
  125000000, 'submitted', NULL, 3)
) AS v(id, num, lead, product, ptype, lob, insured, risk, covers, si, status, remarks, ago)
ON CONFLICT (id) DO NOTHING;

INSERT INTO insurer_offers(id, offer_number, broker_slip_id, insurance_company_id, status, premium, rate, taxes, premium_total, sum_insured, deductibles, terms,
  validity_date, offered_share, insurer_reference, decline_reason, requested_at, responded_at, created_by)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.insurer_offer.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num, v.slip, ic.id, v.status,
  v.premium, CASE WHEN v.premium IS NOT NULL THEN round(v.premium / v.si * 100, 6) END,
  CASE WHEN v.premium IS NOT NULL THEN round(v.premium * 0.2725, 2) END, CASE WHEN v.premium IS NOT NULL THEN round(v.premium * 1.2725, 2) END,
  CASE WHEN v.premium IS NOT NULL THEN v.si END, v.ded, v.terms, CASE WHEN v.premium IS NOT NULL THEN current_date + 25 END, v.share, v.ref, v.decline,
  now() - interval '8 days', CASE WHEN v.status <> 'pending' THEN now() - interval '3 days' END, (SELECT id FROM users WHERE username = 'BrokerVerse')
FROM (VALUES
 ('ofr_sample_01', '90001', 'bs_sample_01', 'MALAYAN', 'offered', 405000::numeric, 180000000::numeric, 'PHP 250,000 each and every loss; earthquake 2% of the sum insured', 'Warranted: hot work permit system; sprinklers maintained', 60::numeric, 'MAL-FQ-2026-1181', NULL),
 ('ofr_sample_02', '90002', 'bs_sample_01', 'PIONEER', 'offered', 423000, 180000000, 'PHP 300,000 each and every loss', 'Subject to a risk survey within 30 days', 40, 'PIO-FQ-2026-0457', NULL),
 ('ofr_sample_03', '90003', 'bs_sample_01', 'FPG', 'declined', NULL, 180000000, NULL, NULL, 100, NULL, 'Steel fabrication outside the current appetite'),
 ('ofr_sample_04', '90004', 'bs_sample_02', 'MALAYAN', 'pending', NULL, 125000000, NULL, NULL, 100, NULL, NULL),
 ('ofr_sample_05', '90005', 'bs_sample_02', 'STANDARD', 'pending', NULL, 125000000, NULL, NULL, 100, NULL, NULL)
) AS v(id, num, slip, insurer, status, premium, si, ded, terms, share, ref, decline)
JOIN insurance_companies ic ON ic.code = v.insurer
ON CONFLICT (id) DO NOTHING;

INSERT INTO placements(id, placement_number, source, client_id, product_id, product_type, lob, insurance_company_id, insured_name, doc, sum_insured, premium_base,
  vat, dst, lgt, premium_total, commission_rate, commission_amount, currency, inception_date, expiry_date, status, sent_at, remarks, owner_user_id, created_by, created_at, updated_at)
SELECT 'plc_sample_01', (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.placement.prefix') || '-' || to_char(current_date, 'YYYY') || '-90001', 'direct', 'cl_sls_92',
  (SELECT id FROM products WHERE code = 'MARINE'), 'Marine Cargo', 'MARINE', ic.id, 'Northstar BPO Services Inc.',
  '{"riskDetails":{"voyage":"Manila to Davao by sea","cargo":"IT equipment (servers, laptops)","conveyance":"MV Lorenzo Pride","basisOfValuation":"CIF + 10%"}}'::jsonb,
  12000000, 36000, 4320, 4500, 270, 45090, 0.15, 5400, 'PHP', current_date + 5, current_date + 370, 'sent', now() - interval '1 day',
  'Client instructed placement with SecureGuard as lead', (SELECT id FROM users WHERE username = 'BrokerVerse'), (SELECT id FROM users WHERE username = 'BrokerVerse'),
  now() - interval '2 days', now() - interval '1 day'
FROM insurance_companies ic WHERE ic.code = 'SECUREGUARD'
ON CONFLICT (id) DO NOTHING;

-- participants of the sample placement (pending confirmation), split by share with the remainder on the lead
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM placements WHERE id = 'plc_sample_01')
     AND NOT EXISTS (SELECT 1 FROM risk_participants WHERE entity_type = 'placement' AND entity_id = 'plc_sample_01') THEN
    PERFORM rp_write_split('placement', 'plc_sample_01',
      jsonb_build_array(jsonb_build_object('ic', (SELECT id FROM insurance_companies WHERE code = 'SECUREGUARD'), 'share', 70, 'lead', true),
                        jsonb_build_object('ic', (SELECT id FROM insurance_companies WHERE code = 'APEX'), 'share', 30, 'lead', false)),
      12000000, 36000, 9090, 45090, 5400, 0.15, 'sample');
    UPDATE risk_participants SET status = 'pending' WHERE entity_type = 'placement' AND entity_id = 'plc_sample_01';
  END IF;
END $$;

SELECT backfill_risk_participants();
