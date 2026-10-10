-- Reasons of the access decisions on the Reason Codes master of seed 77_lead_sources_reason_codes.sql (Master >
-- Insurance Management > Reason Codes): the contexts are added to the Used For list of the master and their reasons to
-- the master. A decision of these kinds is taken with a reason code of its context (and a note when the reason needs
-- one), checked by requiredReason() in src/modules/ops-masters/records.js:
--   delegation      why an approver's authority is delegated (Master > Users and Access > Delegations)
--   delegation_end  why a delegation is ended before its end date
--   sod_exception   why a segregation-of-duties conflict is accepted for one person (Segregation of Duties)
--   access_review   why an access review removes roles or deactivates an account (Access Reviews)
-- A change of a segregation-of-duties rule takes a reason of access_change (seed 91_role_access.sql), to which
-- "Rule no longer needed" is added.
-- Idempotent: a context is added once and a reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['delegation', 'delegation_end', 'sod_exception', 'access_review']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['delegation', 'delegation_end', 'sod_exception', 'access_review']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('DLG-LEAVE', 'Vacation or annual leave', 'delegation', false, 1200),
             ('DLG-SICK', 'Sick leave', 'delegation', false, 1210),
             ('DLG-TRAVEL', 'Business travel', 'delegation', false, 1220),
             ('DLG-TRAINING', 'Training or seminar', 'delegation', false, 1230),
             ('DLG-VACANT', 'Position vacant', 'delegation', false, 1240),
             ('DLG-OTHER', 'Other', 'delegation', true, 1290),
             ('DLE-RETURNED', 'Approver back early', 'delegation_end', false, 1300),
             ('DLE-UNAVAILABLE', 'Covering person not available', 'delegation_end', false, 1310),
             ('DLE-ERROR', 'Recorded in error', 'delegation_end', false, 1320),
             ('DLE-OTHER', 'Other', 'delegation_end', true, 1390),
             ('SXE-SMALLTEAM', 'Small team: no one else can do it', 'sod_exception', false, 1400),
             ('SXE-COVER', 'Temporary cover for leave or a vacancy', 'sod_exception', false, 1410),
             ('SXE-TRANSITION', 'Role change in progress', 'sod_exception', false, 1420),
             ('SXE-REVIEWED', 'Compensating review in place', 'sod_exception', true, 1430),
             ('SXE-UAT', 'Test account (UAT only)', 'sod_exception', false, 1440),
             ('SXE-OTHER', 'Other', 'sod_exception', true, 1490),
             ('ARV-LEFT', 'Left the company', 'access_review', false, 1500),
             ('ARV-MOVED', 'Moved to another job or department', 'access_review', false, 1510),
             ('ARV-NOTNEEDED', 'Access no longer needed', 'access_review', false, 1520),
             ('ARV-EXCESS', 'More access than the job needs', 'access_review', false, 1530),
             ('ARV-SOD', 'Segregation of duties conflict', 'access_review', false, 1540),
             ('ARV-DORMANT', 'Account not used', 'access_review', false, 1550),
             ('ARV-TEMPENDED', 'Temporary assignment ended', 'access_review', false, 1560),
             ('ARV-OTHER', 'Other', 'access_review', true, 1590),
             ('ACC-NOTNEEDED', 'Rule no longer needed', 'access_change', false, 1150)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
