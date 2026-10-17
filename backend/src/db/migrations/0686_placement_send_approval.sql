-- Placement slip approved by a second user before it is sent to the insurer (TIS-BRD-ISSUE-01, TIS-BRD-QUOT-03
-- maker-checker; gap register GAP-POLICY-21).
--
-- With placement.send_requires_approval (delivered on) a placement slip raised by its maker is submitted for approval
-- and approved by a user holding a role of placement.send_approval_roles who neither raised nor submitted it; only then
-- is the firm order e-mailed to the insurer(s). A rejection returns the slip to its maker with the reason; an edit of
-- the slip (participants, period, premium) clears an approval already given. A slip already with the insurer is sent
-- again without a new approval. Scheme application slips (Scheme Issuance) keep their own checklist and approval.
-- placements.send_approval_*: the status (pending, approved, rejected), who submitted it and when, who decided it,
-- when, and the note of the decision. Idempotent.

ALTER TABLE placements ADD COLUMN IF NOT EXISTS send_approval_status text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS send_approval_requested_by text REFERENCES users(id);
ALTER TABLE placements ADD COLUMN IF NOT EXISTS send_approval_requested_at timestamptz;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS send_approved_by text REFERENCES users(id);
ALTER TABLE placements ADD COLUMN IF NOT EXISTS send_approved_at timestamptz;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS send_approval_note text;
ALTER TABLE placements DROP CONSTRAINT IF EXISTS placements_send_approval_status_check;
ALTER TABLE placements ADD CONSTRAINT placements_send_approval_status_check CHECK (send_approval_status IS NULL OR send_approval_status IN ('pending', 'approved', 'rejected'));
CREATE INDEX IF NOT EXISTS placements_send_approval_requested_by_fk_idx ON placements (send_approval_requested_by);
CREATE INDEX IF NOT EXISTS placements_send_approved_by_fk_idx ON placements (send_approved_by);
CREATE INDEX IF NOT EXISTS placements_send_approval_pending_idx ON placements (send_approval_requested_at) WHERE send_approval_status = 'pending';

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('placement.send_requires_approval', 'true', 'placement', 'A placement slip is approved by a second user (not its maker) before it is sent to the insurer', 'boolean', true),
 ('placement.send_approval_roles', '["sales", "processing", "operations", "tis-sales-officer", "tis-sales-unit-head", "tis-ops-unit-head", "tis-general-manager"]', 'placement',
  'Roles whose users approve a placement slip before it is sent to the insurer (the System Administrator always may; never the maker)', 'json', true)
ON CONFLICT (key) DO NOTHING;
