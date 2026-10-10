-- Segregation of duties on access (Master > Users and Access > Segregation of Duties): besides two roles one person
-- may not hold together (kind roles), a rule can name two sets of permissions a role or a person should not combine
-- (kind access, e.g. issuing receipts and issuing policies): access_a and access_b. Such a rule is checked when a
-- role's access changes (Role Permissions) and when roles are given to a user, on the permissions of the roles held.
-- The default access rules are in seeds/91_role_access.sql. Idempotent (also the records of the other screens below).

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

-- Records of the other access screens (Delegations, Segregation of Duties, Access Reviews). Their changes go through
-- the configuration approval as kinds delegation, sod-rule, sod-exception and access-review (migration 0392,
-- src/modules/access-control/delegations.js, sod.js and reviews.js).
--
-- sod_rules: who changed a rule last. sod_exceptions: a conflict accepted for one person (rule and user) with its
-- reason and end date, approved by another administrator; the conflict is open again after valid_until without any
-- job. user_delegations: the reason code, the approval that put the delegation in effect and the reason it was ended
-- early (status revoked). access_reviews: the scope (all active users, departments or roles) and the sign-off by
-- another administrator (status awaiting-signoff); access_review_items: the outcome keep, remove-roles (the roles in
-- remove_roles) or deactivate, applied at sign-off (applied_by / applied_at). Earlier revoke decisions, which
-- deactivated the account at once, become deactivate decisions applied when decided.

ALTER TABLE sod_rules ADD COLUMN IF NOT EXISTS updated_by text REFERENCES users(id);
ALTER TABLE sod_rules ADD COLUMN IF NOT EXISTS updated_at timestamptz;
CREATE INDEX IF NOT EXISTS sod_rules_updated_by ON sod_rules(updated_by);

CREATE TABLE IF NOT EXISTS sod_exceptions (
  id bigserial PRIMARY KEY,
  rule_id bigint NOT NULL REFERENCES sod_rules(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason_code text,
  reason text NOT NULL,
  valid_until date NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  change_id bigint REFERENCES accounting_config_changes(id),
  requested_by text REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_by text REFERENCES users(id),
  approved_at timestamptz,
  ended_by text REFERENCES users(id),
  ended_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS sod_exceptions_one_active ON sod_exceptions(rule_id, user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS sod_exceptions_user ON sod_exceptions(user_id);
CREATE INDEX IF NOT EXISTS sod_exceptions_change ON sod_exceptions(change_id);
CREATE INDEX IF NOT EXISTS sod_exceptions_requested_by ON sod_exceptions(requested_by);
CREATE INDEX IF NOT EXISTS sod_exceptions_approved_by ON sod_exceptions(approved_by);
CREATE INDEX IF NOT EXISTS sod_exceptions_ended_by ON sod_exceptions(ended_by);
COMMENT ON TABLE sod_exceptions IS 'Segregation-of-duties conflicts accepted for one person until a date, approved by another administrator';

ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS reason_code text;
ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS end_reason_code text;
ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS end_reason text;
ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS change_id bigint REFERENCES accounting_config_changes(id);
ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS approved_by text REFERENCES users(id);
ALTER TABLE user_delegations ADD COLUMN IF NOT EXISTS approved_at timestamptz;
CREATE INDEX IF NOT EXISTS user_delegations_dates ON user_delegations(status, date_from, date_to);
CREATE INDEX IF NOT EXISTS user_delegations_change ON user_delegations(change_id);
CREATE INDEX IF NOT EXISTS user_delegations_approved_by ON user_delegations(approved_by);

ALTER TABLE access_reviews ADD COLUMN IF NOT EXISTS scope jsonb NOT NULL DEFAULT '{"kind": "all"}';
ALTER TABLE access_reviews ADD COLUMN IF NOT EXISTS submitted_by text REFERENCES users(id);
ALTER TABLE access_reviews ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE access_reviews ADD COLUMN IF NOT EXISTS signed_off_by text REFERENCES users(id);
ALTER TABLE access_reviews ADD COLUMN IF NOT EXISTS signed_off_at timestamptz;
ALTER TABLE access_reviews ADD COLUMN IF NOT EXISTS change_id bigint REFERENCES accounting_config_changes(id);
CREATE INDEX IF NOT EXISTS access_reviews_submitted_by ON access_reviews(submitted_by);
CREATE INDEX IF NOT EXISTS access_reviews_signed_off_by ON access_reviews(signed_off_by);
CREATE INDEX IF NOT EXISTS access_reviews_change ON access_reviews(change_id);

ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS remove_roles text[] NOT NULL DEFAULT '{}';
ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS reason_code text;
ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS applied_by text REFERENCES users(id);
ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS applied_at timestamptz;
ALTER TABLE access_review_items ADD COLUMN IF NOT EXISTS apply_note text;
CREATE INDEX IF NOT EXISTS access_review_items_applied_by ON access_review_items(applied_by);

DO $$
BEGIN
  ALTER TABLE access_reviews DROP CONSTRAINT IF EXISTS access_reviews_status_check;
  ALTER TABLE access_reviews ADD CONSTRAINT access_reviews_status_check CHECK (status IN ('open', 'awaiting-signoff', 'closed'));
  ALTER TABLE access_review_items DROP CONSTRAINT IF EXISTS access_review_items_decision_check;
  UPDATE access_review_items SET decision = 'deactivate', applied_by = COALESCE(applied_by, decided_by), applied_at = COALESCE(applied_at, decided_at)
   WHERE decision = 'revoke';
  ALTER TABLE access_review_items ADD CONSTRAINT access_review_items_decision_check CHECK (decision IN ('pending', 'keep', 'remove-roles', 'deactivate'));
END $$;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('access.delegation_max_days', '90', 'access', 'Longest delegation of approval authority, in days', 'number'),
 ('access.sod_exception_max_days', '365', 'access', 'Longest segregation-of-duties exception, in days', 'number'),
 ('access.review_due_days', '14', 'access', 'Days from the start of an access review to its proposed due date', 'number')
ON CONFLICT (key) DO NOTHING;

-- the approval now covers every change of access of the menu (the label of migration 0392 only, so a changed one is kept)
UPDATE app_settings SET label = 'Changes to access (the access of a role, approval limits, delegations, segregation-of-duties rules and exceptions, the removals of an access review) wait for the approval of a different administrator who may approve access changes'
 WHERE key = 'access.change_approval' AND label = 'Changes to access (the access of a role) wait for the approval of a different administrator who may approve access changes';
