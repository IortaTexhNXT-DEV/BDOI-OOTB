-- Reasons of the feature changes of Master > Platform > Features & Releases on the Reason Codes master of seed
-- 77_lead_sources_reason_codes.sql: the contexts are added to the Used For list of the master and their reasons to the
-- master. Checked by requiredReason() in src/modules/ops-masters/records.js:
--   feature_change   request to enable or disable platform features (with the contract or change request reference)
--   feature_reject   reject a feature change requested by another platform administrator
-- Idempotent: a context is added once and a reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['feature_change', 'feature_reject']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['feature_change', 'feature_reject']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('FTR-CONTRACT', 'Contracted release', 'feature_change', false, 1500),
             ('FTR-CHANGE', 'Approved change request', 'feature_change', false, 1510),
             ('FTR-PROMOTION', 'Promotion from another environment', 'feature_change', false, 1520),
             ('FTR-WITHDRAWN', 'Function withdrawn by the client', 'feature_change', false, 1530),
             ('FTR-OTHER', 'Other', 'feature_change', true, 1590),
             ('FTR-REJ-REF', 'Reference not found or not signed', 'feature_reject', false, 1600),
             ('FTR-REJ-SCOPE', 'Features outside the contracted scope', 'feature_reject', false, 1610),
             ('FTR-REJ-DATE', 'Wrong effective date', 'feature_reject', false, 1620),
             ('FTR-REJ-OTHER', 'Other', 'feature_reject', true, 1690)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
