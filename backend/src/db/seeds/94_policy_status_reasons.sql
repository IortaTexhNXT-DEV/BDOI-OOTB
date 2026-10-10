-- Reasons of a policy suspension and reinstatement (Reason Codes master of seed 77_lead_sources_reason_codes.sql): the
-- contexts policy_suspend and policy_reinstate are added to the Used For list once, and the reasons only when their
-- code is missing, so administrator changes are kept (migration 0592 holds the same for installed databases).

-- Reasons of a suspension or reinstatement (Reason Codes master, contexts policy_suspend / policy_reinstate); a lapse
-- takes the lapse reasons of the renewals.
UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context' THEN jsonb_set(f, '{options}', (f->'options') || '["policy_suspend", "policy_reinstate"]'::jsonb) ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context' AND NOT (f->'options' ? 'policy_suspend'));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('SUS-WARRANTY', 'Premium warranty breached', 'policy_suspend', false, 600),
             ('SUS-PAYMENT', 'Payment dishonoured or reversed', 'policy_suspend', false, 610),
             ('SUS-REQUEST', 'Customer or insurer request', 'policy_suspend', true, 620),
             ('SUS-OTHER', 'Other', 'policy_suspend', true, 690),
             ('REI-PAID', 'Premium paid', 'policy_reinstate', false, 700),
             ('REI-INSURER', 'Reinstated by the insurer', 'policy_reinstate', true, 710),
             ('REI-OTHER', 'Other', 'policy_reinstate', true, 790)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
