-- Letterhead company. Every printed document and report PDF prints the letterhead of the primary company of the
-- Company master (lib/letterhead.js), so a customer changing its company details there changes every print.
--  * Company master definition: TIN and IsPrimary ("Letterhead company"); licence, e-mail and phone become optional.
--  * The OOTB default company iorta TechNXT Corp. (reference data, primary unless another company already is).
--  * The demo companies of the sample data are not primary.
--  * general.company_name follows the primary company while it still holds the old default.

-- A fresh database gets the master type here already (the seed adds it later with ON CONFLICT DO NOTHING), so the
-- default company can be inserted below.
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$company$s$, $s$Company$s$, $s$general$s$, $s$/master/generals/organization/companymaster$s$, $s$generic$s$, NULL, $s$CompanyCode$s$, $s$CompanyName$s$, $j$[{"name":"CompanyCode","label":"Company Code","type":"string","required":true},{"name":"CompanyName","label":"Company Name","type":"string","required":true},{"name":"LicenseNumber","label":"License Number","type":"string","required":false},{"name":"TIN","label":"TIN","type":"string","required":false},{"name":"EmailID","label":"Email ID","type":"email","required":false},{"name":"Logo","label":"Logo","type":"url","required":false},{"name":"Websitelink","label":"Website link","type":"url","required":false},{"name":"Description","label":"Description","type":"text","required":false},{"name":"AddressLine1","label":"Address Line 1","type":"string","required":false},{"name":"AddressLine2","label":"Address Line 2","type":"string","required":false},{"name":"AddressLine3","label":"Address Line 3","type":"string","required":false},{"name":"PinCode","label":"Pin Code","type":"string","required":false},{"name":"City","label":"City","type":"string","required":false,"optionsFrom":"city"},{"name":"State","label":"State","type":"string","required":false,"optionsFrom":"state"},{"name":"Country","label":"Country","type":"string","required":false,"optionsFrom":"country"},{"name":"PhoneNumber","label":"Phone Number","type":"string","required":false},{"name":"Fax","label":"Fax","type":"string","required":false},{"name":"IsPrimary","label":"Letterhead company - used on documents and reports","type":"boolean","required":false,"default":false}]$j$, $j$[["CompanyCode"]]$j$, false, 10, true, 'seed')
ON CONFLICT (code) DO NOTHING;

-- Existing installations: add the fields to the definition they have (administrator changes are kept)
UPDATE master_types SET fields = (
    SELECT jsonb_agg(CASE WHEN f->>'name' IN ('LicenseNumber', 'EmailID', 'PhoneNumber') THEN f || '{"required": false}'::jsonb ELSE f END ORDER BY ord)
    FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f, ord))
  || CASE WHEN fields @> '[{"name": "TIN"}]' THEN '[]'::jsonb ELSE '[{"name": "TIN", "label": "TIN", "type": "string", "required": false}]'::jsonb END
  || '[{"name": "IsPrimary", "label": "Letterhead company - used on documents and reports", "type": "boolean", "required": false, "default": false}]'::jsonb,
  updated_at = now()
WHERE code = 'company' AND NOT fields @> '[{"name": "IsPrimary"}]';

-- Demo companies (sample data) are not the letterhead company
UPDATE master_records SET data = data || '{"IsPrimary": false}'::jsonb, updated_at = now()
WHERE type_code = 'company' AND code IN ('BVB', 'BVR', 'BVV') AND created_by = 'seed' AND NOT data ? 'IsPrimary';

-- The OOTB company (created_by 'system': reference data, kept by the sample-data purge)
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'company', 'ITX', 'iorta TechNXT Corp.', jsonb_build_object(
    'CompanyCode', 'ITX', 'CompanyName', 'iorta TechNXT Corp.', 'LicenseNumber', '', 'TIN', '', 'EmailID', '', 'PhoneNumber', '', 'Fax', '',
    'Logo', '/bdoi/iorta-technxt.png', 'Websitelink', '', 'Description', 'BrokerVerse OOTB company (letterhead of documents and reports)',
    'AddressLine1', 'UB, 111 Paseo De Roxas Building', 'AddressLine2', 'Legazpi Village, San Lorenzo', 'AddressLine3', '', 'PinCode', '',
    'City', 'Makati', 'State', 'Metro Manila', 'Country', 'Philippines',
    'IsPrimary', NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'company' AND status = 'active' AND lower(COALESCE(data->>'IsPrimary', 'false')) IN ('true', 'yes', '1'))),
  'active', 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'company' AND lower(code) = 'itx' AND status <> 'deleted');

UPDATE app_settings SET value = to_jsonb(m.name), updated_at = now()
FROM master_records m
WHERE app_settings.key = 'general.company_name' AND app_settings.value IN ('"BrokerVerse"'::jsonb, '""'::jsonb)
  AND m.type_code = 'company' AND m.status = 'active' AND lower(COALESCE(m.data->>'IsPrimary', 'false')) = 'true';
