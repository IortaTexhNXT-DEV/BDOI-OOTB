-- Operations > My Work: the work diary (tasks) of every user.
--
-- work_tasks: a task with a due date (and optional time), a priority, a reminder and an optional related record
-- (client, policy, claim, quotation, renewal, collection item...). A task is created by the user for themselves, by a
-- manager for someone reporting to them (users.reporting_to), or automatically from a follow-up date entered on
-- another record (source + source_key: a collection action's promise-to-pay date, a renewal activity's next step, a
-- claim's follow-up date). The my-work-reminders job (Master > Schedules) notifies the assignee when the reminder time
-- comes and once when an open task becomes overdue, and closes automatic tasks whose record was closed.
--
-- The open items of the other modules (quotations, placement, renewals, receivables, claims, approvals...) are not
-- copied here: GET /my-work/summary and /my-work/items read them where they are.

CREATE TABLE IF NOT EXISTS work_tasks (
  id text PRIMARY KEY DEFAULT ('tsk_' || encode(gen_random_bytes(8), 'hex')),
  title text NOT NULL,
  notes text,
  due_date date NOT NULL,
  due_time time,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'cancelled')),
  assigned_to text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'manager', 'collection', 'renewal', 'claim')),
  source_key text UNIQUE,
  entity text,
  entity_id text,
  remind_at timestamptz,
  reminded_at timestamptz,
  overdue_notified_at timestamptz,
  completed_at timestamptz,
  completed_by text,
  completion_note text,
  created_by text NOT NULL,
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_tasks_assignee_idx ON work_tasks (assigned_to, status, due_date);
CREATE INDEX IF NOT EXISTS work_tasks_reminder_idx ON work_tasks (remind_at) WHERE status = 'open' AND reminded_at IS NULL;
CREATE INDEX IF NOT EXISTS work_tasks_entity_idx ON work_tasks (entity, entity_id);
CREATE INDEX IF NOT EXISTS work_tasks_created_by_idx ON work_tasks (created_by);
CREATE INDEX IF NOT EXISTS users_reporting_to_idx ON users (reporting_to);

COMMENT ON TABLE work_tasks IS 'Work diary: personal, assigned and automatic follow-up tasks (Operations > My Work > My Tasks)';
COMMENT ON COLUMN work_tasks.source IS 'manual (own task), manager (assigned by a manager), collection / renewal / claim (created from a follow-up date)';
COMMENT ON COLUMN work_tasks.source_key IS 'Record that created an automatic task (e.g. collection_action:12); one task per key';

-- Settings of the screen and the reminder job (Master > Configuration)
INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
  ('myWork.due_soon_days', '7', 'myWork', 'My Work: days ahead counted as "due soon" (header figures and the due filter)', 'number', true),
  ('myWork.approval_sla_days', '2', 'myWork', 'My Work: days an approval request may wait before it shows as overdue', 'number', true),
  ('myWork.default_reminder_minutes', '60', 'myWork', 'My Work: default reminder before a task''s due time, in minutes (tasks without a time: 09:00 on the due date)', 'number', true),
  ('myWork.auto_tasks', 'true', 'myWork', 'My Work: create follow-up tasks from collection promises to pay, renewal next steps and claim follow-up dates', 'boolean', true),
  ('myWork.overdue_task_alert', 'true', 'myWork', 'My Work: notify the assignee once when an open task becomes overdue', 'boolean', true)
ON CONFLICT (key) DO NOTHING;

-- The reminder job (also in seeds/jobs.json for fresh databases)
INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
  ('my-work-reminders', 'My Work reminders',
   'Create follow-up tasks from collection promises to pay, renewal next steps and claim follow-up dates, close those whose record is closed, and notify task reminders and newly overdue tasks',
   '*/15 * * * *', 'myWorkReminders', '{}', true)
ON CONFLICT (code) DO NOTHING;
