-- Changes of access (Master > Users and Access > Role Permissions) and segregation of duties on access.
--
-- Reasons: the context "access_change" is added to the Used For list of the Reason Codes master (seed
-- 77_lead_sources_reason_codes.sql) and its reasons to the master; a change of a role's access is requested with one of
-- them (checked by requiredReason() in src/modules/ops-masters/records.js), Other with a note.
--
-- Access rules of the Segregation of Duties screen (kind access, migration 0393): two sets of permissions a role or a
-- person should not combine. They warn; none is broken by the access of a TISPH role on its own (RBAC v4), only by a
-- person holding two roles or by a change of a role's access.
--
-- Idempotent: the context is added once, a reason or a rule only when its code is missing, so administrator changes
-- are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context' AND NOT (f->'options' ? 'access_change')
    THEN jsonb_set(f, '{options}', (f->'options') || '["access_change"]'::jsonb) ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context' AND NOT (f->'options' ? 'access_change'));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', 'access_change', 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('ACC-DUTIES', 'New duties', false, 1100),
             ('ACC-REDESIGN', 'Role redesign', false, 1110),
             ('ACC-AUDIT', 'Audit or compliance finding', false, 1120),
             ('ACC-PROCESS', 'Process change', false, 1130),
             ('ACC-CORRECT', 'Correction of an earlier change', false, 1140),
             ('ACC-OTHER', 'Other', true, 1190)) AS v(code, name, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));

INSERT INTO sod_rules(code, name, kind, access_a, access_b, action, reason)
VALUES
 ('SOD-ACC-RCPT-SELL', 'Receipting and selling', 'access', '{write:receipts}', '{write:quotations,write:policies}', 'warn',
  'The person who issues receipts and posts cash should not also sell or issue the policies paid for'),
 ('SOD-ACC-PLACE-PAY', 'Placing and paying insurers', 'access', '{write:quotations,write:policies}', '{write:remittance,write:disbursements}', 'warn',
  'The person who places business with an insurer should not also prepare the payments to insurers'),
 ('SOD-ACC-CLAIM-PAY', 'Claims and payment', 'access', '{write:claims}', '{write:disbursements}', 'warn',
  'The claims handler should not also prepare the claim payments'),
 ('SOD-ACC-ADMIN-TXN', 'Administration and transactions', 'access', '{write:users,write:roles,write:access-control}',
  '{write:receipts,write:collections,write:disbursements,write:journal-vouchers,write:remittance,write:policies,write:quotations,write:claims}', 'warn',
  'The person who administers users and access should not enter business or accounting transactions')
ON CONFLICT (code) DO NOTHING;
