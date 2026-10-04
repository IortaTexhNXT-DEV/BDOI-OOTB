-- Lead assignment (Operations > Sales & Marketing > Lead Assignment).
--
-- lead_assignment_rules: who receives a new prospect. A rule matches on the prospect's branch, line of business,
-- source, category, distribution channel and territory (Province, City / Municipality); the first active rule by
-- priority that matches assigns the prospect to one of its account executives, by round robin (the next one after the
-- last assigned), by fewest open prospects (load) or always to the first one (fixed). A prospect that no rule
-- matches, or whose assignee is no longer active, goes to the reassignment queue (leads.assignment_status = 'queued').
--
-- lead_assignment_history: every assignment and reassignment (automatic, manual, bulk, from the queue), with the
-- rule, the previous and the new owner and the reason. The lead's owner is leads.owner_user_id.
--
-- The daily job lead-assignment-sla queues the prospects still New after leads.assignment_sla_hours (0 = off), so a
-- sales manager can give them to someone else.

CREATE TABLE IF NOT EXISTS lead_assignment_rules (
  id serial PRIMARY KEY,
  name text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  method text NOT NULL DEFAULT 'round_robin' CHECK (method IN ('round_robin', 'load', 'fixed')),
  conditions jsonb NOT NULL DEFAULT '{}',          -- { branchCode, lob, source, leadCategory, channelId, province, city }: empty = any
  assignees text[] NOT NULL DEFAULT '{}',          -- user ids, in round-robin order
  last_assigned_user_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  description text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_assignment_rules_priority_idx ON lead_assignment_rules(status, priority, id);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS assignment_status text NOT NULL DEFAULT 'assigned';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assignment_rule_id int REFERENCES lead_assignment_rules(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS assigned_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS queue_reason text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS queued_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS branch_code text;
DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_assignment_status_chk CHECK (assignment_status IN ('assigned', 'queued'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS leads_assignment_rule_id_fk_idx ON leads(assignment_rule_id);
CREATE INDEX IF NOT EXISTS leads_assignment_queue_idx ON leads(assignment_status, queued_at) WHERE assignment_status = 'queued';

CREATE TABLE IF NOT EXISTS lead_assignment_history (
  id bigserial PRIMARY KEY,
  lead_id text NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_user_id text REFERENCES users(id),
  to_user_id text REFERENCES users(id),
  rule_id int REFERENCES lead_assignment_rules(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('auto', 'manual', 'bulk', 'queue', 'queued')),
  reason text,
  assigned_by text,
  assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_assignment_history_lead_idx ON lead_assignment_history(lead_id, assigned_at DESC);
CREATE INDEX IF NOT EXISTS lead_assignment_history_from_user_id_fk_idx ON lead_assignment_history(from_user_id);
CREATE INDEX IF NOT EXISTS lead_assignment_history_to_user_id_fk_idx ON lead_assignment_history(to_user_id);
CREATE INDEX IF NOT EXISTS lead_assignment_history_rule_id_fk_idx ON lead_assignment_history(rule_id);

INSERT INTO permissions(code, module, description) VALUES
 ('read:lead-assignment', 'lead-assignment', 'View the lead assignment rules, the reassignment queue and every team''s prospects'),
 ('write:lead-assignment', 'lead-assignment', 'Maintain the lead assignment rules and reassign prospects (one, in bulk or from the queue)')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code IN ('system-admin', 'operations') AND p.code IN ('read:lead-assignment', 'write:lead-assignment')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('leads.assignment_enabled', 'true', 'leads', 'Assign new prospects automatically with the lead assignment rules (off: the creator keeps the prospect)', 'boolean'),
 ('leads.assignment_fallback', '"creator"', 'leads', 'When no rule matches a new prospect: creator (the user who created it keeps it) or queue (reassignment queue)', 'string'),
 ('leads.assignment_sla_hours', '48', 'leads', 'Hours a prospect may stay New before it is queued for reassignment (0 = never)', 'number'),
 ('leads.assignment_notify', 'true', 'leads', 'Notify the account executive a prospect is assigned to', 'boolean')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('lead-assignment-sla', 'Prospects not worked in time', 'Queue for reassignment the prospects still New after leads.assignment_sla_hours and notify the lead assignment team (read:lead-assignment)', '30 7 * * *', 'leadAssignmentSla', '{}', false)
ON CONFLICT (code) DO NOTHING;
