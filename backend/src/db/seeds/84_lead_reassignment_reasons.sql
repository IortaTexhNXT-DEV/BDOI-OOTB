-- Reasons of a prospect reassignment or of a prospect sent to the reassignment queue (Operations > Sales & Marketing >
-- Lead Assignment) on the Reason Codes master of seed 77_lead_sources_reason_codes.sql: the context "reassignment" is
-- added to the Used For list of the master, and its reasons to the master. Idempotent: the context is added once and a
-- reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context' AND NOT (f->'options' ? 'reassignment')
    THEN jsonb_set(f, '{options}', (f->'options') || '["reassignment"]'::jsonb) ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context' AND NOT (f->'options' ? 'reassignment'));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', 'reassignment', 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('REA-LEFT', 'Account executive left the company', false, 400),
             ('REA-LEAVE', 'Account executive on leave', false, 410),
             ('REA-TERRITORY', 'Territory or branch change', false, 420),
             ('REA-WORKLOAD', 'Workload balancing', false, 430),
             ('REA-CUSTOMER', 'Customer request', false, 440),
             ('REA-NOTWORKED', 'Not worked in time', false, 450),
             ('REA-PRODUCT', 'Needs a specialist for the product', false, 460),
             ('REA-OTHER', 'Other', true, 490)) AS v(code, name, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
