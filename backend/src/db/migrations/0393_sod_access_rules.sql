-- Segregation of duties on access (Master > Users and Access > Segregation of Duties): besides two roles one person
-- may not hold together (kind roles), a rule can name two sets of permissions a role or a person should not combine
-- (kind access, e.g. issuing receipts and issuing policies): access_a and access_b. Such a rule is checked when a
-- role's access changes (Role Permissions) and when roles are given to a user, on the permissions of the roles held.
-- The default access rules are in seeds/91_role_access.sql. Idempotent.

ALTER TABLE sod_rules ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'roles';
ALTER TABLE sod_rules ADD COLUMN IF NOT EXISTS access_a text[] NOT NULL DEFAULT '{}';
ALTER TABLE sod_rules ADD COLUMN IF NOT EXISTS access_b text[] NOT NULL DEFAULT '{}';
ALTER TABLE sod_rules ALTER COLUMN role_a DROP NOT NULL;
ALTER TABLE sod_rules ALTER COLUMN role_b DROP NOT NULL;
COMMENT ON COLUMN sod_rules.kind IS 'roles: role_a and role_b may not be held by one person; access: the permissions of access_a and of access_b may not be combined';
COMMENT ON COLUMN sod_rules.access_a IS 'Permission codes of the first side of an access rule';
COMMENT ON COLUMN sod_rules.access_b IS 'Permission codes of the second side of an access rule';

DO $$
BEGIN
  ALTER TABLE sod_rules DROP CONSTRAINT IF EXISTS sod_rules_kind_check;
  ALTER TABLE sod_rules ADD CONSTRAINT sod_rules_kind_check CHECK (
    (kind = 'roles' AND role_a IS NOT NULL AND role_b IS NOT NULL)
    OR (kind = 'access' AND cardinality(access_a) > 0 AND cardinality(access_b) > 0));
END $$;
