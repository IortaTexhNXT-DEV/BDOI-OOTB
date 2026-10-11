-- Reasons of the telesales incentive (FRS COMM-08 6.3) on the Reason Codes master of seed 77_lead_sources_reason_codes.sql:
-- incentive_disqualify (Disqualify a caller, Callers tab of a Telesales program) and incentive_exclude (Exclude a policy,
-- Policies tab of a calculation batch). The contexts are added to the Used For list once, and the reasons only when their
-- code is missing, so administrator changes are kept (migration 0610 holds the same for installed databases).

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context' THEN jsonb_set(f, '{options}', (f->'options') || '["incentive_disqualify", "incentive_exclude"]'::jsonb) ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context' AND NOT (f->'options' ? 'incentive_disqualify'));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('TDQ-MISREP', 'Misrepresentation', 'incentive_disqualify', true, 1300),
             ('TDQ-GRAB', 'Account grabbing', 'incentive_disqualify', true, 1310),
             ('TDQ-REASSIGN', 'Unauthorized reassignment', 'incentive_disqualify', true, 1320),
             ('TDQ-OTHER', 'Other', 'incentive_disqualify', true, 1390),
             ('TEX-MISREP', 'Misrepresentation', 'incentive_exclude', true, 1400),
             ('TEX-GRAB', 'Account grabbing', 'incentive_exclude', true, 1410),
             ('TEX-REASSIGN', 'Unauthorized reassignment', 'incentive_exclude', true, 1420),
             ('TEX-DUPLICATE', 'Duplicate', 'incentive_exclude', true, 1430),
             ('TEX-OTHER', 'Other', 'incentive_exclude', true, 1490)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
