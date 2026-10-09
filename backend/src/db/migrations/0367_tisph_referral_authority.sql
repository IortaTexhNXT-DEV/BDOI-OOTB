-- Underwriting referrals of the shipped acceptance rules (Product Configurator > Underwriting Rules) are decided by the
-- Processing Team role, which no TISPH user holds: a referred quotation could only be released by the System
-- Administrator. On a database with the TISPH roles (0348_tisph_roles.sql) the rules that name the Processing Team
-- name the Operations Unit Head instead (placement checks and quotation approvals are already that role's), and the
-- referrals still waiting on a quotation follow. A rule given another authority role on screen is left alone.
-- Idempotent.

UPDATE product_components SET data = jsonb_set(data, '{authorityRole}', '"tis-ops-unit-head"'), updated_at = now()
WHERE kind = 'underwriting-rules' AND data->>'authorityRole' = 'processing'
  AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-ops-unit-head');

UPDATE quotes SET doc = jsonb_set(jsonb_set(doc, '{underwritingReferral,authorityRoles}', '["tis-ops-unit-head"]'),
    '{underwritingReferral,authorityRoleNames}', to_jsonb(ARRAY[(SELECT name FROM roles WHERE code = 'tis-ops-unit-head')])), updated_at = now()
WHERE doc->'underwritingReferral'->>'status' = 'pending' AND doc->'underwritingReferral'->'authorityRoles' = '["processing"]'::jsonb
  AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-ops-unit-head');
