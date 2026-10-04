-- Sales activities (Sales > Sales Activities, and the Activities tab of a prospect, a client and a quotation).
--
-- An account executive logs every call, meeting, e-mail and visit on a prospect (lead), a quotation or a client: the
-- activity type (master sales-activity-type: call, meeting, e-mail, visit...), when it took place, the contact, the
-- outcome (master sales-activity-outcome) and the next step with its date. The next step becomes a follow-up task in
-- the account executive's My Work diary (work_tasks, source sales-activity, created with the My Work task service);
-- a later activity on the same record completes the earlier open follow-up (sales_activities.close_previous_follow_up).
-- The activity report sums the activities by account executive, type and outcome over a period.
--   read:sales-activities   the timelines and the activity report
--   write:sales-activities  log, change and cancel activities
CREATE TABLE IF NOT EXISTS sales_activities (
  id text PRIMARY KEY DEFAULT ('sac_' || encode(gen_random_bytes(8), 'hex')),
  entity text NOT NULL CHECK (entity IN ('lead', 'quote', 'client')),
  entity_id text NOT NULL,
  lead_id text,                                        -- prospect of the record (a quotation's lead), for its timeline
  client_id text,                                      -- client of the record (a quotation's client), for its timeline
  activity_type text NOT NULL,                         -- sales-activity-type master code
  channel text NOT NULL DEFAULT 'other' CHECK (channel IN ('call', 'meeting', 'email', 'visit', 'other')),
  subject text NOT NULL,
  notes text,
  activity_at timestamptz NOT NULL,
  duration_minutes int CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 0 AND 1440),
  contact_person text,
  location text,
  outcome text,                                        -- sales-activity-outcome master code
  next_step text,
  next_step_date date,
  task_id text REFERENCES work_tasks(id) ON DELETE SET NULL,
  account_executive text NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'logged' CHECK (status IN ('logged', 'cancelled')),
  cancel_reason text,
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (next_step_date IS NULL OR next_step IS NOT NULL));
CREATE INDEX IF NOT EXISTS sales_activities_entity ON sales_activities(entity, entity_id, activity_at DESC);
CREATE INDEX IF NOT EXISTS sales_activities_lead ON sales_activities(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_activities_client ON sales_activities(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS sales_activities_ae ON sales_activities(account_executive, activity_at);
COMMENT ON TABLE sales_activities IS 'Calls, meetings, e-mails and visits of account executives on prospects, quotations and clients (Sales > Sales Activities)';

-- the follow-up task of an activity's next step is a My Work task of source sales-activity
ALTER TABLE work_tasks DROP CONSTRAINT IF EXISTS work_tasks_source_check;
ALTER TABLE work_tasks ADD CONSTRAINT work_tasks_source_check CHECK (source IN ('manual', 'manager', 'collection', 'renewal', 'claim', 'sales-activity'));
COMMENT ON COLUMN work_tasks.source IS 'manual (own task), manager (assigned by a manager), collection / renewal / claim (created from a follow-up date), sales-activity (next step of a sales activity)';

INSERT INTO permissions(code, module, description) VALUES
 ('read:sales-activities', 'sales-activities', 'View the sales activity timelines and the activity report'),
 ('write:sales-activities', 'sales-activities', 'Log, change and cancel sales activities (calls, meetings, e-mails, visits)')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE (r.code IN ('sales', 'operations', 'system-admin') AND p.code IN ('read:sales-activities', 'write:sales-activities'))
   OR (r.code = 'processing' AND p.code = 'read:sales-activities')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('sales_activities.follow_up_priority', '"normal"', 'leads', 'Sales activities: priority of the My Work follow-up task created from a next step (low, normal, high, urgent)', 'string'),
 ('sales_activities.close_previous_follow_up', 'true', 'leads', 'Sales activities: a new activity on a record completes the open follow-up task of the earlier activity on that record', 'boolean'),
 ('sales_activities.next_step_required', 'false', 'leads', 'Sales activities: every activity must have a next step and its date', 'boolean'),
 ('sales_activities.backdate_days', '30', 'leads', 'Sales activities: how many days back an activity may be logged', 'number')
ON CONFLICT (key) DO NOTHING;
