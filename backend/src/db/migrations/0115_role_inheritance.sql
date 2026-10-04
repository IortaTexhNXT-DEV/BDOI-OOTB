-- Roles can include other roles: a user with a role also holds every role it inherits (and their permissions,
-- menus, reports and notifications). Used by Finance Manager, which is Finance / Accounts plus period-end approval.
ALTER TABLE roles ADD COLUMN IF NOT EXISTS inherits text[] NOT NULL DEFAULT '{}';

-- The roles a user holds: assigned roles and, recursively, the roles they inherit.
CREATE OR REPLACE FUNCTION user_effective_roles(p_user text) RETURNS TABLE(role_id int, code text)
LANGUAGE sql STABLE AS $$
  WITH RECURSIVE rr(id, code, inherits) AS (
    SELECT r.id, r.code, r.inherits FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = p_user AND r.status = 'active'
    UNION
    SELECT r.id, r.code, r.inherits FROM rr JOIN roles r ON r.code = ANY(rr.inherits) AND r.status = 'active')
  SELECT id, code FROM rr
$$;
