-- Versions of remittances and remittance approvals (Accounts > Remittance > Approvals). Every mutating request names the
-- version it was shown; a request on an older version is refused with 409 instead of overwriting a newer decision.
--
--   remittances.version                  bumped by the database on every status change and on every change of the
--                                        amounts or the policy count (the content the approver decides on)
--   remittance_approvals.version         bumped on every decision: approved, rejected, next level, delegated
--   remittance_approvals.entity_version  the remittance's version when it was submitted, for the check "content
--                                        unchanged since submission"
--   remittance_approvals.reminded_at/by  the last "Remind approver" of the submitter
--
-- Setting remittance.reminder_interval_hours (4): the hours between two reminders of the same approval.
--
-- Idempotent.

ALTER TABLE remittances ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1;

ALTER TABLE remittance_approvals
  ADD COLUMN IF NOT EXISTS version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS entity_version int,
  ADD COLUMN IF NOT EXISTS reminded_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminded_by text REFERENCES users(id);

CREATE INDEX IF NOT EXISTS remittance_approvals_initiator_idx ON remittance_approvals(initiator_id, status);

CREATE OR REPLACE FUNCTION remittances_bump_version() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.gross_premium IS DISTINCT FROM OLD.gross_premium
     OR NEW.commission IS DISTINCT FROM OLD.commission OR NEW.tax IS DISTINCT FROM OLD.tax
     OR NEW.adjustments IS DISTINCT FROM OLD.adjustments OR NEW.net_due IS DISTINCT FROM OLD.net_due
     OR NEW.policy_count IS DISTINCT FROM OLD.policy_count THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS remittances_version_trg ON remittances;
CREATE TRIGGER remittances_version_trg BEFORE UPDATE ON remittances FOR EACH ROW EXECUTE FUNCTION remittances_bump_version();

CREATE OR REPLACE FUNCTION remittance_approvals_bump_version() RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.current_level IS DISTINCT FROM OLD.current_level
     OR NEW.delegated_to IS DISTINCT FROM OLD.delegated_to THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS remittance_approvals_version_trg ON remittance_approvals;
CREATE TRIGGER remittance_approvals_version_trg BEFORE UPDATE ON remittance_approvals FOR EACH ROW EXECUTE FUNCTION remittance_approvals_bump_version();

-- approvals opened before this migration: the remittance's current version stands for the submitted one
UPDATE remittance_approvals a SET entity_version = r.version
  FROM remittances r WHERE a.entity = 'remittance' AND r.id = a.entity_id AND a.entity_version IS NULL;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('remittance.reminder_interval_hours', '4', 'remittance', 'Hours between two reminders of the approvers of the same remittance approval', 'number')
ON CONFLICT (key) DO NOTHING;
