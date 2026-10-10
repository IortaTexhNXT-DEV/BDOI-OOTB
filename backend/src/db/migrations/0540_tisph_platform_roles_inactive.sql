-- The roles of the base platform (System Administrator, Sales & Marketing, Processing Team, Operations, Claims,
-- Accounting, Accounting Manager) are not TISPH roles: TISPH works with the RBAC v4 personas (PBSM-M17v4-RBAC,
-- TIS-BRD-SEC-05). The user form already offers no platform role for a new assignment (access.platform_roles); a
-- platform role that nobody holds is now set Inactive as well.
--
-- A role stays as it is when
--   a user holds it (an inactive role gives its holders nothing, so a holder would lose access),
--   an active role that stays active includes it (roles.inherits: SUPERID includes the System Administrator, the
--   Accounting Manager includes Accounting), or
--   an administrator has changed it (an update of the role in the audit trail).
-- An administrator sets a role Active again on Master > User Management > Role. A new database creates its roles after
-- the migrations (seed.js), so this changes only a database in use. Forward-only and idempotent.

WITH RECURSIVE platform(code) AS (
  VALUES ('system-admin'), ('sales'), ('processing'), ('operations'), ('claims'), ('accounting'), ('accounting-manager')
), held AS (
  SELECT DISTINCT r.code FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN users u ON u.id = ur.user_id
   WHERE u.status <> 'deleted'
), changed AS (
  SELECT r.code FROM roles r WHERE EXISTS (SELECT 1 FROM audit_log a WHERE a.entity = 'role' AND a.entity_id = r.id::text AND a.action = 'update')
), kept(code) AS (
  SELECT code FROM held
  UNION SELECT code FROM changed
  UNION SELECT unnest(r.inherits) FROM roles r WHERE r.status = 'active' AND r.code NOT IN (SELECT code FROM platform)
  UNION SELECT unnest(r.inherits) FROM roles r JOIN kept k ON k.code = r.code
)
UPDATE roles r SET status = 'inactive', updated_at = now()
 WHERE r.code IN (SELECT code FROM platform) AND r.status = 'active'
   AND r.code NOT IN (SELECT code FROM kept);
