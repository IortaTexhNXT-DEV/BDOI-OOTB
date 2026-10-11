-- KYC by source, the onboarding checklist, duplicate-account control and the KYC form (TIS-BRD-KYC-02 to KYC-05,
-- FR-SIS-012, Pre-BSM M14).
--
-- Lead Source master: KYC Mode per source. A TFS-sourced deal relies on the KYC TFS already validated (the TFS
-- confirmation is attached, no ID is collected again); walk-in and direct business needs the full KYC with a
-- government ID. Onboarding Checklist master: the documents required at booking per line (government ID for all,
-- OR/CR and the four-side vehicle photos for Motor, the signed proposal form, the TFS confirmation under TFS KYC, the
-- birth certificate of a customer aged 21 or under, the ACR I-Card / SRRV of a non-Filipino); enforced with
-- policy.kyc_checklist_enforced. One primary ID or two secondary IDs (policy.kyc_secondary_ids). Duplicate-account
-- control on the client register (clients.duplicate_control). Idempotent; the master definitions are seeded again in
-- seeds/95_tisph_kyc.sql for a fresh database.

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

UPDATE master_records SET data = data || '{"kycMode": "TFS confirmation"}'::jsonb, updated_at = now()
 WHERE type_code = 'lead-source' AND code IN ('CLI', 'SCR', 'UCFP', 'CCAR', 'REDEEM', 'PROMO', 'BNDL') AND NOT (data ? 'kycMode');

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('policy.kyc_checklist_enforced', 'false', 'policy', 'Booking requires the documents of the Onboarding Checklist master (per line and KYC mode) on the client or the booking', 'boolean', true),
 ('policy.kyc_secondary_ids', '["TIN ID", "Postal ID", "Senior Citizen ID", "PhilHealth ID", "Company ID"]', 'policy', 'Secondary IDs: a customer presenting one of these needs a second ID (one primary or two secondary IDs)', 'json', true),
 ('policy.kyc_minor_age', '21', 'policy', 'Age up to which the birth certificate is part of the KYC checklist', 'number', true),
 ('policy.kyc_tfs_sources', '[]', 'policy', 'Lead sources whose deals rely on the TFS KYC confirmation (added to the sources whose KYC Mode is TFS confirmation)', 'json', true),
 ('clients.duplicate_control', '"block"', 'clients', 'A new client matching an existing one (e-mail, mobile, or name with the same birth date): block, warn or off', 'string', true),
 ('placement.attach_kyc_documents', 'true', 'placement', 'Attach the customer''s government ID or TFS KYC confirmation to the placement order e-mailed to the insurer', 'boolean', true)
ON CONFLICT (key) DO NOTHING;

-- the checklist documents are kept with the KYC documents of the client
ALTER TABLE client_kyc_documents DROP CONSTRAINT IF EXISTS client_kyc_documents_doc_type_check;
ALTER TABLE client_kyc_documents ADD CONSTRAINT client_kyc_documents_doc_type_check CHECK (doc_type IN ('government-id', 'tfs-kyc-confirmation', 'or-cr', 'signed-proposal', 'vehicle-photos', 'birth-certificate', 'acr-srrv',
  'proof-of-address', 'tin', 'sec-registration', 'dti-registration', 'cda-registration',
  'articles-by-laws', 'gis', 'board-resolution', 'secretary-certificate', 'beneficial-owner-declaration', 'source-of-funds', 'edd-evidence', 'other'));
