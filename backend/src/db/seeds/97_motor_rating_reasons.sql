-- Reasons of the motor rating decisions (migration 0615, TIS-BRD-PROD-12) on the Reason Codes master (Master >
-- Insurance Management > Reason Codes), read by decisionReason() in src/modules/ops-masters/records.js:
--   fmv_edit        change the fair market value of a Motor quotation away from the value less depreciation
--   rate_override   change the Own Damage or Acts of Nature rate away from the issuing rate
-- A context is added to the Used For list once and a reason only when its code is missing, so administrator changes are
-- kept. Idempotent.
UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['fmv_edit', 'rate_override']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['fmv_edit', 'rate_override']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('FMV-APPRAISAL', 'Appraised value of the vehicle', 'fmv_edit', false, 2400),
             ('FMV-ACCESSORIES', 'Accessories added to the vehicle', 'fmv_edit', false, 2410),
             ('FMV-CONDITION', 'Condition of the vehicle', 'fmv_edit', false, 2420),
             ('FMV-INSURER', 'Value required by the insurer', 'fmv_edit', false, 2430),
             ('FMV-OTHER', 'Other reason', 'fmv_edit', true, 2490),
             ('RTO-INSURER', 'Rate agreed with the insurer', 'rate_override', false, 2500),
             ('RTO-FLEET', 'Fleet or corporate account terms', 'rate_override', false, 2510),
             ('RTO-RETENTION', 'Retention of a renewing client', 'rate_override', false, 2520),
             ('RTO-OTHER', 'Other reason', 'rate_override', true, 2590)
) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND m.code = v.code);
