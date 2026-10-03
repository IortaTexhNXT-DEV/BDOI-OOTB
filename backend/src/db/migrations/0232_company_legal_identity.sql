-- The Company master owns the broker's legal identity: legal name, TIN, registered address, RDO code and the logo
-- printed on documents. BIR forms (period-end/tax.js) and printed documents read them from the primary company; the
-- bir.* / general.company_name / documents.default_logo_path settings are only the fallback used when no company
-- exists, and Master > Configuration shows them read-only (lib/settingOwners.js).

-- Company master: RDO code next to the TIN (administrator changes to the definition are kept)
UPDATE master_types SET fields = (
    SELECT jsonb_agg(f ORDER BY ord) FROM (
      SELECT f, ord::numeric AS ord FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f, ord)
      UNION ALL
      SELECT '{"name": "RDOCode", "label": "RDO Code", "type": "string", "required": false}'::jsonb,
             COALESCE((SELECT ord FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f, ord) WHERE f->>'name' = 'TIN'), jsonb_array_length(fields)) + 0.5
    ) x),
  updated_at = now()
WHERE code = 'company' AND NOT fields @> '[{"name": "RDOCode"}]';

-- Values entered on Master > Configuration move to the primary company where the company has none yet
WITH primary_company AS (
  SELECT id FROM master_records WHERE type_code = 'company' AND status = 'active'
  ORDER BY (lower(COALESCE(data->>'IsPrimary', 'false')) IN ('true', 'yes', '1')) DESC, id LIMIT 1
), s AS (
  SELECT COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'bir.withholding_agent_tin'), '') AS tin,
         COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'bir.zip_code'), '') AS zip,
         COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'bir.registered_address'), '') AS address
)
UPDATE master_records m SET data = m.data
    || CASE WHEN COALESCE(m.data->>'TIN', '') = '' AND btrim(s.tin) <> '' THEN jsonb_build_object('TIN', btrim(s.tin)) ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(m.data->>'PinCode', '') = '' AND btrim(s.zip) <> '' THEN jsonb_build_object('PinCode', btrim(s.zip)) ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(m.data->>'AddressLine1', '') || COALESCE(m.data->>'AddressLine2', '') || COALESCE(m.data->>'AddressLine3', '') = ''
              AND btrim(s.address) <> '' THEN jsonb_build_object('AddressLine1', btrim(s.address)) ELSE '{}'::jsonb END,
  updated_at = now()
FROM primary_company p, s
WHERE m.id = p.id;

UPDATE app_settings SET label = v.label
FROM (VALUES
 ('general.company_name', 'Company name (kept equal to the primary company of Master > Company; used only when no company exists)'),
 ('documents.default_logo_path', 'Logo printed on documents when the primary company of Master > Company has no logo (path relative to the backend folder)'),
 ('bir.registered_name', 'Registered name on BIR forms when no company exists (otherwise the primary company''s name)'),
 ('bir.registered_address', 'Registered address on BIR forms when no company exists (otherwise the primary company''s address)'),
 ('bir.withholding_agent_tin', 'TIN on BIR forms when no company exists (otherwise the primary company''s TIN)'),
 ('bir.zip_code', 'Zip code on BIR forms when no company exists (otherwise the primary company''s postal code)')
) AS v(key, label)
WHERE app_settings.key = v.key;
