-- KYC by source and the Onboarding Checklist (migration 0594) for a fresh database: the Lead Source master gains its
-- KYC Mode, the Onboarding Checklist master and its TISPH rows are created, and the TFS-sourced lead sources of
-- seed 83_tisph_lists.sql take the TFS confirmation mode. Idempotent.

UPDATE master_types SET fields = fields || $j$[{"name":"kycMode","label":"KYC Mode","type":"select","required":false,"options":["Full KYC","TFS confirmation"]}]$j$::jsonb, updated_at = now()
WHERE code = 'lead-source' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'name' = 'kycMode');

INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$kyc-checklist$s$, $s$Onboarding Checklist$s$, $s$general$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$,
  $j$[{"name":"code","label":"Code","type":"string","required":true},
      {"name":"name","label":"Document","type":"string","required":true},
      {"name":"docType","label":"Document Type","type":"string","required":true},
      {"name":"lob","label":"Line of Business (* = all)","type":"string","required":true,"default":"*"},
      {"name":"kycMode","label":"KYC Mode","type":"select","required":true,"options":["Any","Full KYC","TFS confirmation"],"default":"Any"},
      {"name":"required","label":"Required at booking","type":"boolean","required":false,"default":true},
      {"name":"rule","label":"Applies When","type":"select","required":false,"options":["Always","Customer aged 21 or under","Non-Filipino customer"]},
      {"name":"sortOrder","label":"Sort Order","type":"integer","required":false},
      {"name":"description","label":"Description","type":"text","required":false}]$j$,
  $j$[["code"]]$j$, false, 96, true, 'seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'kyc-checklist', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'docType', v.doc, 'lob', v.lob, 'kycMode', v.mode, 'required', true, 'rule', v.rule, 'sortOrder', v.sort, 'description', v.descr), 'active', 'seed'
FROM (VALUES
  ('GOV-ID', 'Valid government ID', 'government-id', '*', 'Full KYC', 'Always', 10, 'One primary ID, or two secondary IDs, of the accepted list'),
  ('TFS-CONF', 'TFS KYC confirmation', 'tfs-kyc-confirmation', '*', 'TFS confirmation', 'Always', 20, 'The KYC confirmation of Toyota Financial Services for a financed customer'),
  ('OR-CR', 'Vehicle OR/CR (LTO registration)', 'or-cr', 'MOTOR', 'Any', 'Always', 30, 'Official receipt and certificate of registration of the vehicle'),
  ('PROPOSAL', 'Signed proposal form', 'signed-proposal', '*', 'Any', 'Always', 40, 'The proposal form signed by the customer (electronic preferred)'),
  ('PHOTOS', 'Vehicle photos (four sides)', 'vehicle-photos', 'MOTOR', 'Any', 'Always', 50, 'Left, right, front and rear photos of the vehicle'),
  ('BIRTH-CERT', 'Birth certificate', 'birth-certificate', '*', 'Full KYC', 'Customer aged 21 or under', 60, 'For a customer aged 21 or under'),
  ('ACR-SRRV', 'ACR I-Card or SRRV', 'acr-srrv', '*', 'Full KYC', 'Non-Filipino customer', 70, 'For a non-Filipino customer')
) AS v(code, name, doc, lob, mode, rule, sort, descr)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'kyc-checklist')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'kyc-checklist' AND lower(m.code) = lower(v.code));

-- TFS-sourced lead sources (Bancassurance / Affinity: financed, redemption, promo and bundled deals) rely on the TFS KYC confirmation
UPDATE master_records SET data = data || '{"kycMode": "TFS confirmation"}'::jsonb, updated_at = now()
 WHERE type_code = 'lead-source' AND code IN ('CLI', 'SCR', 'UCFP', 'CCAR', 'REDEEM', 'PROMO', 'BNDL') AND NOT (data ? 'kycMode');
UPDATE master_records SET data = data || '{"kycMode": "Full KYC"}'::jsonb, updated_at = now()
 WHERE type_code = 'lead-source' AND code IN ('CL', 'WI', 'REF', 'CORP', 'REN', 'AGNT', 'WEB') AND NOT (data ? 'kycMode');
