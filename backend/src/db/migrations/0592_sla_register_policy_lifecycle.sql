-- Service level register and clocks, and the policy lifecycle statuses (TIS-BRD-NOTIF-02, TIS-BRD-ISSUE-04, Pre-BSM
-- M15, TIS-BRD-MAS-08).
--
-- sla_targets: one row per status a document waits in, with the turnaround (hours, in working time by the holiday
-- calendar and the working week when working_time is on) and the roles escalated to on breach. The delivered rows are
-- the Pre-BSM M15 workflow statuses (POL-PEND, POL-PLACED, POL-RECVD, END-REQ, END-PLACED, CAN-REQ, CAN-DONE), the
-- lead nurture, quotation despatch and claim handling turnarounds.
-- sla_clocks: the open items with their deadline, kept by the sla-monitor job (every 30 minutes) and shown on My Work
-- (Service levels); a breach escalates once to the target's roles.
-- policies: suspended (premium warranty), reinstated and lapsed transitions with their reason and time; the expiry
-- job records each move.
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('calendar.working_day_hours', '8', 'calendar', 'Working hours in a working day, for turnarounds measured in working time', 'number', true),
 ('sla.escalation_enabled', 'true', 'sla', 'Escalate a service level breach to the roles of the service level register', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
UPDATE app_settings SET value = value || '{"sla":"Service levels","calendar":"Working calendar"}'::jsonb
 WHERE key = 'system.group_labels' AND jsonb_typeof(value) = 'object' AND NOT (value ? 'sla');

CREATE TABLE IF NOT EXISTS sla_targets (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z][A-Z0-9-]*$'),
  document text NOT NULL CHECK (document IN ('lead', 'quotation', 'placement', 'policy', 'endorsement', 'cancellation', 'claim', 'renewal')),
  name text NOT NULL,
  description text,
  target_hours numeric(8,2) NOT NULL CHECK (target_hours > 0),
  working_time boolean NOT NULL DEFAULT true,
  escalate_to_roles jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS sla_targets_updated ON sla_targets;
CREATE TRIGGER sla_targets_updated BEFORE UPDATE ON sla_targets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO sla_targets(code, document, name, description, target_hours, working_time, escalate_to_roles, sort_order, created_by)
VALUES
 ('LEAD-NURTURE', 'lead', 'Prospect first contact', 'A new prospect is contacted by its account executive', 48, true, '["tis-sales-unit-head"]', 10, 'migration'),
 ('QUOTE-DESPATCH', 'quotation', 'Quotation despatch', 'A quotation is sent to the customer', 8, true, '["tis-sales-unit-head"]', 20, 'migration'),
 ('POL-KYC', 'placement', 'KYC, OR/CR and proof of payment verified', 'The onboarding documents and the proof of payment are verified before the placement is approved', 8, true, '["tis-ops-unit-head"]', 30, 'migration'),
 ('POL-PEND', 'placement', 'Placement approved and sent', 'The placement slip is approved and sent to the insurer', 24, false, '["tis-ops-unit-head"]', 40, 'migration'),
 ('POL-PLACED', 'placement', 'Insurer issues the policy', 'The insurer acknowledges and issues the e-policy', 16, true, '["tis-ops-unit-head"]', 50, 'migration'),
 ('POL-RECVD', 'placement', 'e-Policy checked and booked', 'The e-policy is checked against the slip and the policy is booked', 8, true, '["tis-ops-unit-head"]', 60, 'migration'),
 ('END-REQ', 'endorsement', 'Endorsement requested', 'An endorsement request is sent to the insurer', 48, false, '["tis-ops-unit-head"]', 70, 'migration'),
 ('END-PLACED', 'endorsement', 'Endorsement issued by the insurer', 'The insurer issues the endorsement', 24, true, '["tis-ops-unit-head"]', 80, 'migration'),
 ('CAN-REQ', 'cancellation', 'Cancellation requested', 'A cancellation request is sent to the insurer', 16, true, '["tis-ops-unit-head"]', 90, 'migration'),
 ('CAN-DONE', 'cancellation', 'Cancellation completed', 'The cancellation is completed and the return premium computed', 8, true, '["tis-ops-unit-head"]', 100, 'migration'),
 ('CLAIM-HANDLING', 'claim', 'Claim handling', 'A registered claim is settled or closed', 160, true, '["tis-ops-unit-head"]', 110, 'migration')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS sla_clocks (
  id bigserial PRIMARY KEY,
  target_code text NOT NULL REFERENCES sla_targets(code),
  document text NOT NULL,
  record_id text NOT NULL,
  ref text,
  title text,
  client_name text,
  owner_id text,
  link text,
  started_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  breached_at timestamptz,
  escalated_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sla_clocks_open_idx ON sla_clocks(target_code, record_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS sla_clocks_owner_idx ON sla_clocks(owner_id) WHERE closed_at IS NULL;

-- ---------------------------------------------------------------- policy lifecycle
ALTER TABLE policies ADD COLUMN IF NOT EXISTS status_reason text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS status_changed_by text;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS reinstated_at timestamptz;
ALTER TABLE policies ADD COLUMN IF NOT EXISTS lapsed_at timestamptz;

-- Reasons of a suspension or reinstatement (Reason Codes master, contexts policy_suspend / policy_reinstate); a lapse
-- takes the lapse reasons of the renewals.
UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context' THEN jsonb_set(f, '{options}', (f->'options') || '["policy_suspend", "policy_reinstate"]'::jsonb) ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context' AND NOT (f->'options' ? 'policy_suspend'));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('SUS-WARRANTY', 'Premium warranty breached', 'policy_suspend', false, 600),
             ('SUS-PAYMENT', 'Payment dishonoured or reversed', 'policy_suspend', false, 610),
             ('SUS-REQUEST', 'Customer or insurer request', 'policy_suspend', true, 620),
             ('SUS-OTHER', 'Other', 'policy_suspend', true, 690),
             ('REI-PAID', 'Premium paid', 'policy_reinstate', false, 700),
             ('REI-INSURER', 'Reinstated by the insurer', 'policy_reinstate', true, 710),
             ('REI-OTHER', 'Other', 'policy_reinstate', true, 790)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
