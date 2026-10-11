-- Reasons of the Talkbot call lists (Operations > Renewals > Talkbot Calls, migration 0460) on the Reason Codes master
-- of seed 77_lead_sources_reason_codes.sql: an account taken off a call list before it is sent (talkbot_line_remove,
-- FRS LEAD-09 list of values "Line removal reason") and a call list cancelled (talkbot_list_cancel). The contexts are
-- added to the Used For list of the master once, and a reason only when its code is missing, so administrator changes
-- are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) FROM jsonb_array_elements_text('["talkbot_line_remove", "talkbot_list_cancel"]') c
                                                    WHERE NOT (f->'options') ? c)) ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context'
  AND NOT ((f->'options') ? 'talkbot_line_remove' AND (f->'options') ? 'talkbot_list_cancel'));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('TBR-COMPLAINT', 'Complaint in progress', 'talkbot_line_remove', false, 600),
             ('TBR-NO-CALL', 'Client asked not to be called', 'talkbot_line_remove', false, 610),
             ('TBR-ELSEWHERE', 'Renewing elsewhere', 'talkbot_line_remove', false, 620),
             ('TBR-DUPLICATE', 'Duplicate account', 'talkbot_line_remove', false, 630),
             ('TBR-OTHER', 'Other', 'talkbot_line_remove', true, 690),
             ('TBC-NOT-RUN', 'Campaign not run', 'talkbot_list_cancel', false, 700),
             ('TBC-WRONG-CRITERIA', 'Wrong criteria', 'talkbot_list_cancel', false, 710),
             ('TBC-REPLACED', 'Replaced by another call list', 'talkbot_list_cancel', false, 720),
             ('TBC-OTHER', 'Other', 'talkbot_list_cancel', true, 790)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
