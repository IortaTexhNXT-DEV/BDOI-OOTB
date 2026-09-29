-- Broker role model (Philippine insurance broker terminology). "Underwriter" is an insurer term: the broker's teams are
-- Sales & Marketing, the Processing Team, Operations, Claims and Accounting. One System Administrator (Super Admin
-- Access) replaces the IT / Business / User Access administrators, and the Agent / Referrer login role is withdrawn
-- (referrers and sub-agents do not sign in: Sales & Marketing enters their business and they are paid from the
-- referrer master, which is unchanged).
--
--   underwriting       -> processing          Processing Team (Placement & Policy Processing)
--   customer-services  -> operations          Operations (Client Servicing)
--   finance            -> accounting          Accounting
--   finance-manager    -> accounting-manager  Accounting Manager (inherits accounting)
--   it-admin, ba, user-access-admin -> system-admin   System Administrator (Super Admin Access)
--   agent              -> removed; its users move to sales
--   sales, claims      -> same codes, new names
--
-- Renamed roles keep their id, permissions and user assignments. Merged roles move their users to the target role
-- (duplicates dropped) and are deleted. Every stored role code is rewritten key by key: roles.inherits,
-- report_definitions.roles, the role-list settings named below and the transaction-code master's user group access.
-- Users whose roles changed get a new token version, so a token carrying an old code is refreshed at once.
-- Idempotent: a second run (or a run on a database that never had the old codes) changes nothing.

-- Old code -> new code (NULL = the role is withdrawn and the code dropped from lists).
CREATE OR REPLACE FUNCTION pg_temp.bv_role(code text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE code
    WHEN 'underwriting' THEN 'processing'
    WHEN 'customer-services' THEN 'operations'
    WHEN 'finance' THEN 'accounting'
    WHEN 'finance-manager' THEN 'accounting-manager'
    WHEN 'it-admin' THEN 'system-admin'
    WHEN 'ba' THEN 'system-admin'
    WHEN 'user-access-admin' THEN 'system-admin'
    WHEN 'agent' THEN NULL
    ELSE code END
$$;
-- A role list rewritten: codes mapped, withdrawn codes dropped, duplicates removed, order kept.
CREATE OR REPLACE FUNCTION pg_temp.bv_roles(codes text[]) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(array_agg(c ORDER BY o), '{}') FROM (
    SELECT c, min(o) AS o FROM (SELECT pg_temp.bv_role(x) AS c, o FROM unnest(codes) WITH ORDINALITY AS t(x, o)) m
    WHERE c IS NOT NULL GROUP BY c) d
$$;
CREATE OR REPLACE FUNCTION pg_temp.bv_roles_json(v jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN jsonb_typeof(v) = 'array'
    THEN to_jsonb(pg_temp.bv_roles(ARRAY(SELECT jsonb_array_elements_text(v))))
    ELSE v END
$$;

-- Users whose roles are about to change: their access tokens carry the old codes.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
              WHERE r.code IN ('underwriting', 'customer-services', 'finance', 'finance-manager', 'it-admin', 'ba', 'user-access-admin', 'agent'));

-- 1. Roles: rename in place (keeps id, permissions and users) or, when the target already exists, merge into it.
DO $$
DECLARE
  m record;
  old_id int;
  new_id int;
BEGIN
  FOR m IN SELECT * FROM (VALUES
      ('underwriting', 'processing', false), ('customer-services', 'operations', false), ('finance', 'accounting', false),
      ('finance-manager', 'accounting-manager', false), ('it-admin', 'system-admin', true), ('ba', 'system-admin', true),
      ('user-access-admin', 'system-admin', true), ('agent', 'sales', false)) AS v(old_code, new_code, is_admin) LOOP
    SELECT id INTO old_id FROM roles WHERE code = m.old_code;
    CONTINUE WHEN old_id IS NULL;
    SELECT id INTO new_id FROM roles WHERE code = m.new_code;
    -- The Agent role is withdrawn, never renamed: without a sales role its users simply lose it.
    IF new_id IS NULL AND m.old_code <> 'agent' THEN
      UPDATE roles SET code = m.new_code, updated_at = now() WHERE id = old_id;
    ELSE
      IF new_id IS NOT NULL THEN
        INSERT INTO user_roles(user_id, role_id) SELECT user_id, new_id FROM user_roles WHERE role_id = old_id ON CONFLICT DO NOTHING;
      END IF;
      DELETE FROM roles WHERE id = old_id;  -- user_roles / role_permissions rows cascade
    END IF;
  END LOOP;
END $$;

-- 2. Names, descriptions and flags of the broker roles (on a fresh database the seed creates them).
UPDATE roles r SET name = v.name, description = v.description, is_system = v.is_system, updated_at = now()
  FROM (VALUES
    ('system-admin', 'System Administrator (Super Admin Access)', 'Full access to every module, configuration, user and role administration', true),
    ('sales', 'Sales & Marketing (Account Executive)', 'Prospects, leads, clients, quotation requests, renewals follow-up and own production', false),
    ('processing', 'Processing Team (Placement & Policy Processing)', 'Broker slips to insurers, offer comparison, quotation and placement slips, insurer confirmation, policy checking and issuance, endorsement processing, reinsurance, product templates', false),
    ('operations', 'Operations (Client Servicing)', 'Client servicing, endorsement requests, renewals, open items and documents', false),
    ('claims', 'Claims', 'Claims registration, follow-up with insurers, review and settlement', false),
    ('accounting', 'Accounting', 'Billing, collection, official receipts, remittance to insurers, commission, period end and BIR reporting', false),
    ('accounting-manager', 'Accounting Manager', 'Everything Accounting does, plus approving the month-end and year-end close, posting into soft-closed periods and reopening periods', false)
  ) AS v(code, name, description, is_system)
 WHERE r.code = v.code AND (r.name, COALESCE(r.description, ''), r.is_system) IS DISTINCT FROM (v.name, v.description, v.is_system);

-- The System Administrator holds every permission.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.code = 'system-admin' ON CONFLICT DO NOTHING;

-- 3. Role inheritance (Accounting Manager includes Accounting).
UPDATE roles SET inherits = pg_temp.bv_roles(inherits) WHERE inherits IS DISTINCT FROM pg_temp.bv_roles(inherits);

-- 4. Report catalogue: roles allowed to run each report.
UPDATE report_definitions SET roles = pg_temp.bv_roles(roles), updated_at = now() WHERE roles IS DISTINCT FROM pg_temp.bv_roles(roles);

-- 5. Settings that hold role codes, one by one:
--    security.scoped_roles           roles that only see their own book (was ["agent"]; empty once agent is withdrawn)
--    security.require_2fa_roles      roles that must enrol in two-factor authentication
--    quotations.approval_notify_roles roles notified when a quotation is sent for approval (was ["underwriting"])
--    renewals.approver_roles         roles notified to approve renewal terms (was ["underwriting"])
--    incentive.eligible_roles        roles that take part in incentive programs (was ["agent","sales"])
--    commission.eligible_roles       roles that earn commission on their production (was ["agent","sales"])
UPDATE app_settings SET value = pg_temp.bv_roles_json(value), updated_at = now(), updated_by = 'migration:0140'
 WHERE key IN ('security.scoped_roles', 'security.require_2fa_roles', 'quotations.approval_notify_roles', 'renewals.approver_roles',
               'incentive.eligible_roles', 'commission.eligible_roles')
   AND value IS DISTINCT FROM pg_temp.bv_roles_json(value);
UPDATE app_settings SET label = 'Sum insured from which a Processing Team case is high priority'
 WHERE key = 'dashboard.high_sum_insured' AND label = 'Sum insured from which an underwriting case is high priority';

-- 6. Master data: user group access of the transaction codes (Master > Finance > Transaction Code, data.userGroupAccess[].UserRole).
UPDATE master_records mr SET data = jsonb_set(mr.data, '{userGroupAccess}', (
    SELECT COALESCE(jsonb_agg(CASE WHEN g ? 'UserRole' AND jsonb_typeof(g->'UserRole') = 'string' AND pg_temp.bv_role(g->>'UserRole') IS DISTINCT FROM g->>'UserRole'
      THEN jsonb_set(g, '{UserRole}', to_jsonb(COALESCE(pg_temp.bv_role(g->>'UserRole'), 'sales'))) ELSE g END ORDER BY o), '[]'::jsonb)
    FROM jsonb_array_elements(mr.data->'userGroupAccess') WITH ORDINALITY AS t(g, o)))
 WHERE jsonb_typeof(mr.data->'userGroupAccess') = 'array'
   AND EXISTS (SELECT 1 FROM jsonb_array_elements(mr.data->'userGroupAccess') g
               WHERE g->>'UserRole' IN ('underwriting', 'customer-services', 'finance', 'finance-manager', 'it-admin', 'ba', 'user-access-admin', 'agent'));

-- 7. Sample users (seeded with SEED_SAMPLE_DATA): broker designations, only where the seeded value is unchanged.
UPDATE users u SET designation = v.new_des
  FROM (VALUES ('agent.jdelacruz', 'Senior Agent', 'Senior Account Executive'), ('agent.msantos', 'Agent', 'Account Executive'),
               ('agent.preyes', 'Agent', 'Account Executive'), ('agent.agarcia', 'Unit Manager', 'Sales Unit Manager'),
               ('agent.jmartinez', 'Agent', 'Account Executive'), ('fin.approver', 'Finance Manager', 'Accounting Supervisor')) AS v(username, old_des, new_des)
 WHERE u.username = v.username AND u.created_by = 'seed' AND u.designation = v.old_des;
