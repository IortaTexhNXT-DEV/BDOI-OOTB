-- Covers by line of business: the Quick Quote / Request for Quotation offers the covers of the chosen product's line
-- (a cover with no line is offered for every line). New databases get the field and the reference covers' lines from
-- seeds/51_masters.sql.
UPDATE master_types SET fields = fields || '[{"name": "linesOfBusiness", "label": "Lines of business (blank: every line)", "type": "multiselect", "required": false, "options": ["motor", "fire", "accident", "engineering", "marine", "casualty", "eb"], "blankMatchesAll": true}]'::jsonb
WHERE code = 'cover' AND NOT fields @> '[{"name": "linesOfBusiness"}]'::jsonb;

UPDATE master_records SET data = data || jsonb_build_object('linesOfBusiness', CASE code WHEN 'OD' THEN '["motor"]'::jsonb WHEN 'THEFT' THEN '["motor"]'::jsonb WHEN 'AOG' THEN '["motor", "fire"]'::jsonb WHEN 'CTPL' THEN '["motor"]'::jsonb WHEN 'VTPL-BI' THEN '["motor"]'::jsonb WHEN 'VTPL-PD' THEN '["motor"]'::jsonb WHEN 'APA' THEN '["motor"]'::jsonb WHEN 'RSMD' THEN '["motor", "fire"]'::jsonb WHEN 'FLEXA' THEN '["fire"]'::jsonb WHEN 'EQ' THEN '["fire", "engineering"]'::jsonb END)
WHERE type_code = 'cover' AND data->'linesOfBusiness' IS NULL
  AND code IN ('OD', 'THEFT', 'AOG', 'CTPL', 'VTPL-BI', 'VTPL-PD', 'APA', 'RSMD', 'FLEXA', 'EQ');
