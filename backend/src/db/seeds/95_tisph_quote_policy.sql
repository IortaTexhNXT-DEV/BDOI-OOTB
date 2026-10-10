-- TISPH quotation and policy configuration (TIS-BRD-QUOT-04, PROD-03). Runs on a new database and on every start of an
-- existing one. Idempotent: a field or row is added only when missing, and a reference value is replaced only while it
-- is still the reference value and nobody has changed it (updated_by empty), so administrator changes are kept.

-- Product Master: quotation validity in days per product (migration 0480); empty = limits.quote_validity_days.
UPDATE master_types SET fields = fields || $j$[{"name":"quoteValidityDays","label":"Quotation Validity (days)","type":"integer","required":false,"column":"quote_validity_days"}]$j$::jsonb
WHERE code = 'product' AND NOT fields @> '[{"name":"quoteValidityDays"}]'::jsonb;

-- A spoiled quotation is not revived (QUOT-04): Expired has no way back to Draft; the customer gets a new quotation.
UPDATE app_settings SET value = value - 'Expired', updated_at = now()
 WHERE key = 'quotations.transitions' AND updated_by IS NULL AND value->'Expired' = '["Draft"]'::jsonb;

-- The insurer issues every TISPH policy through the placement slip (ISSUE-01): the policy bulk upload only loads the
-- in-force book at go-live (migration 0481).
UPDATE app_settings SET value = 'false'::jsonb, updated_at = now()
 WHERE key = 'policies.bulk_upload_issue' AND updated_by IS NULL AND value = 'true'::jsonb;

-- Reasons of the policy decisions on the Reason Codes master (Master > Insurance Management > Reason Codes), checked by
-- requiredReason() in src/modules/ops-masters/records.js:
--   policy_correction          request a correction of the core data of an issued policy (migration 0481)
--   policy_correction_reject   reject a requested correction
-- A context is added to the Used For list once and a reason only when its code is missing, so administrator changes are kept.
UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['policy_correction', 'policy_correction_reject']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['policy_correction', 'policy_correction_reject']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('PCR-ENCODING', 'Encoding error at issuance', 'policy_correction', false, 2000),
             ('PCR-INSURER', 'Corrected policy issued by the insurer', 'policy_correction', false, 2010),
             ('PCR-NAME', 'Name of the insured as on the ID or registration', 'policy_correction', false, 2020),
             ('PCR-PERIOD', 'Period of cover confirmed by the insurer', 'policy_correction', false, 2030),
             ('PCR-OTHER', 'Other', 'policy_correction', true, 2090),
             ('PCRR-NOPROOF', 'Insurer confirmation not attached or not matching', 'policy_correction_reject', false, 2100),
             ('PCRR-ENDORSE', 'Change to be made by endorsement', 'policy_correction_reject', false, 2110),
             ('PCRR-WRONG', 'Requested values are wrong', 'policy_correction_reject', true, 2120),
             ('PCRR-OTHER', 'Other', 'policy_correction_reject', true, 2190)
) AS v(code, name, context, note, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND m.code = v.code);
