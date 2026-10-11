-- Data Migration & Go-Live: the audit role in a department of its own.
--
-- The TIS Audit role (migration 0440) is offered on the user form under the department Audit (access.role_groups), so
-- that it is listed with the TISPH roles: the Role list shows its department, the user form offers it with its summary,
-- and the user manual carries a chapter for it (backend/src/tools/manual-role-facts.js takes the roles of the
-- departments). Idempotent: the department is added once, after Management.

UPDATE app_settings
   SET value = value || $j$[{"name": "Audit", "roles": [
     {"code": "tis-auditor", "summary": "Internal and external audit: reads the migration workspace, the audit trail, the business records, the ledgers and the reports; changes nothing"}]}]$j$::jsonb,
       updated_at = now()
 WHERE key = 'access.role_groups'
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(value) g, jsonb_array_elements(g->'roles') r WHERE r->>'code' = 'tis-auditor');
