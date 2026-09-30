-- Controls on accounting configuration and the month-end close.
--
-- Maker-checker on posting rules and account determination (accounting.configuration_maker_checker): a new rule
-- version, the activation or deactivation of a version, a change of an account role, of the payable / cash account
-- maps or of the commission tax set-up is saved as a pending change (accounting_config_changes). It takes effect only
-- when a different user holding approve:posting-rules (Accounting Manager, System Administrator) approves it. A pending
-- rule version is stored with approval_status 'pending' and is never used for posting. Existing versions are approved.
--
-- Month-end checklist: subledger_tieout compares the premium receivable, commission receivable and due to insurer
-- sub-ledgers with the balances of their GL control accounts.
ALTER TABLE posting_rules ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved';
DO $$ BEGIN
  ALTER TABLE posting_rules ADD CONSTRAINT posting_rules_approval_status_chk CHECK (approval_status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE posting_rules ADD COLUMN IF NOT EXISTS approved_by text;
ALTER TABLE posting_rules ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE TABLE IF NOT EXISTS accounting_config_changes (
  id bigserial PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('posting-rule-version', 'posting-rule-status', 'account-role', 'account-map', 'commission-taxes')),
  target text NOT NULL,                                -- event code, rule id, role, map name or 'commission-taxes'
  rule_id int REFERENCES posting_rules(id),            -- the pending version (posting-rule-version) or the version to (de)activate
  payload jsonb NOT NULL DEFAULT '{}',                 -- the change requested
  before jsonb,                                        -- the value in force when it was requested
  change_note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn')),
  requested_by text, requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text, decided_at timestamptz, decision_remarks text);
CREATE UNIQUE INDEX IF NOT EXISTS accounting_config_changes_pending_uq ON accounting_config_changes(kind, target) WHERE status = 'pending';

INSERT INTO permissions(code, module, description) VALUES
 ('write:posting-rules', 'masters', 'Propose changes to posting rules and account determination (applied once approved)'),
 ('approve:posting-rules', 'masters', 'Approve changes to posting rules and account determination (maker-checker: not the requester)')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE (r.code IN ('accounting-manager', 'system-admin') AND p.code = 'write:posting-rules')
    OR (r.code IN ('accounting-manager', 'system-admin') AND p.code = 'approve:posting-rules')
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.configuration_maker_checker', 'true', 'accounting', 'Posting rule and account determination changes wait for the approval of a different user with approve:posting-rules (Accounting Manager, System Administrator)', 'boolean'),
 ('period_end.tieout_tolerance', '0', 'period_end', 'Month-end subledger vs GL tie-out: largest difference (PHP) still reported as tied out', 'number')
ON CONFLICT (key) DO NOTHING;

INSERT INTO period_close_checklist(code, label, description, item_type, severity, sort_order, is_system) VALUES
 ('subledger_tieout', 'Sub-ledgers tie out to the GL', 'Premium receivable (open bills), commission receivable (unbilled direct-bill commission and open debit notes) and due to insurers (postings from operations) agree with the balances of their GL control accounts; a difference is usually a manual journal on a control account', 'auto', 'warning', 55, true)
ON CONFLICT (code) DO NOTHING;
