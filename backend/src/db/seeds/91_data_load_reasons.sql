-- Reasons of a rejected data load on the Reason Codes master of seed 77_lead_sources_reason_codes.sql (Master >
-- Insurance Management > Reason Codes): the context is added to the Used For list of the master and its reasons to the
-- master. A load waiting for approval (Data Migration & Go-Live > Loads) is rejected with a reason of this context (and
-- a note when the reason needs one), checked by requiredReason() in src/modules/ops-masters/records.js:
--   data_load_reject  reject a data load submitted for approval
-- Idempotent: the context is added once and a reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || '["data_load_reject"]'::jsonb)
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context' AND NOT (f->'options' ? 'data_load_reject'));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', 'data_load_reject', 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('DLR-FILE', 'Wrong file', false, 1600),
             ('DLR-TOTALS', 'Control totals differ', true, 1610),
             ('DLR-DUPLICATES', 'Duplicates not resolved', false, 1620),
             ('DLR-AUTH', 'Not authorised', true, 1630),
             ('DLR-OTHER', 'Other', true, 1690)) AS v(code, name, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
