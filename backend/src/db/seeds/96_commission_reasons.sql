-- Reasons of the commission decisions on the Reason Codes master of seed 77_lead_sources_reason_codes.sql (Master >
-- Insurance Management > Reason Codes; migrations 0570 and 0571): the contexts are added to the Used For list of the
-- master and their reasons to the master. A decision of these kinds is taken with a reason code of its context (and a
-- note when the reason needs one), checked by requiredReason() in src/modules/ops-masters/records.js:
--   commission_share_change   change the share of a commission line inside the limits of its scheme
--   commission_rate_change    ask for a rate change on a commission line
--   commission_reversal       ask for the reversal of a commission line
--   commission_wht_change     ask for a withholding tax change on a payee
--   scheme_end                end a sharing scheme
-- Idempotent: a context is added once and a reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['commission_share_change', 'commission_rate_change', 'commission_reversal', 'commission_wht_change', 'scheme_end']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context');

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES
  ('CSH-NEGOTIATED', 'Negotiated with agent', 'commission_share_change', false, 10),
  ('CSH-DEALER', 'Dealer agreement', 'commission_share_change', false, 20),
  ('CSH-MANAGEMENT', 'Management approval', 'commission_share_change', false, 30),
  ('CSH-CORRECTION', 'Correction', 'commission_share_change', false, 40),
  ('CSH-OTHER', 'Other', 'commission_share_change', true, 50),
  ('CRT-SPECIAL', 'Agreed special rate', 'commission_rate_change', false, 10),
  ('CRT-ENCODING', 'Encoding error', 'commission_rate_change', false, 20),
  ('CRT-SCHEME', 'Scheme change', 'commission_rate_change', false, 30),
  ('CRT-OTHER', 'Other', 'commission_rate_change', true, 40),
  ('CMR-CANCELLED', 'Policy cancelled', 'commission_reversal', false, 10),
  ('CMR-DUPLICATE', 'Duplicate line', 'commission_reversal', false, 20),
  ('CMR-WRONG-PAYEE', 'Wrong payee', 'commission_reversal', false, 30),
  ('CMR-OTHER', 'Other', 'commission_reversal', true, 40),
  ('CWT-STATUS', 'Payee tax status changed', 'commission_wht_change', false, 10),
  ('CWT-CERTIFICATE', 'BIR certificate received', 'commission_wht_change', false, 20),
  ('CWT-OTHER', 'Other', 'commission_wht_change', true, 30),
  ('SEN-REPLACED', 'Replaced by another scheme', 'scheme_end', false, 10),
  ('SEN-NO-SHARING', 'Business no longer shared', 'scheme_end', false, 20),
  ('SEN-OTHER', 'Other', 'scheme_end', true, 30)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records r WHERE r.type_code = 'reason-code' AND r.code = v.code);

