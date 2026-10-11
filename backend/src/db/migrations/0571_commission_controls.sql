-- Commission controls (TIS-BRD-COMM-02, COMM-04, COMM-05, COMM-06, SEC-03; FRS FR-RMT-014, FR-RMT-030, FR-CMR-022).
--
-- A rate change, a reversal or a withholding tax change on a commission line is a request (commission_line_requests)
-- with a reason of the Reason Codes master, approved by a holder of approve:commission other than the requester while
-- commission.adjustment_approval_required is on (TISPH: "approval of the Heads and Accounting"); the direct actions
-- answer 409 meanwhile. A variance share becomes Eligible only once its policy is fully paid and on an approved
-- remittance (commission.eligible_requires_remittance). An approved remittance marks the client's payment records
-- remitted (receivables.remitted_at / remittance_id). Motor policies are booked on the per-peril rates of the rules
-- register (commission.peril_based_motor) and rule and scheme changes are approved (commission.rules_approval_required):
-- both off here, switched on for TISPH by seed 96_tisph_commission.sql. Idempotent.

INSERT INTO permissions(code, module, description) VALUES
 ('approve:commission', 'commission', 'Approve or reject a rate change, reversal or withholding tax change requested on a commission line (never your own request)')
ON CONFLICT (code) DO NOTHING;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('system-admin', 'accounting-manager', 'tis-finance', 'tis-general-manager', 'tis-ops-unit-head'))
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'approve:commission');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
 WHERE r.code IN ('system-admin', 'accounting-manager', 'tis-finance', 'tis-general-manager', 'tis-ops-unit-head') AND p.code = 'approve:commission'
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS commission_line_requests (
  id bigserial PRIMARY KEY,
  commission_id text NOT NULL REFERENCES commissions(id),
  referrer_id text REFERENCES commission_referrers(id),
  kind text NOT NULL CHECK (kind IN ('rate', 'reversal', 'wht')),
  from_value jsonb,
  to_value jsonb,
  reason_code text,
  reason_text text,
  note text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_by text, requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text, decided_at timestamptz, decision_note text);
CREATE INDEX IF NOT EXISTS commission_line_requests_line_idx ON commission_line_requests(commission_id, status);
CREATE INDEX IF NOT EXISTS commission_line_requests_status_idx ON commission_line_requests(status, requested_at DESC);

ALTER TABLE receivables ADD COLUMN IF NOT EXISTS remitted_at timestamptz;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS remittance_id text;
CREATE INDEX IF NOT EXISTS receivables_remittance_idx ON receivables(remittance_id);

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('commission.rules_approval_required', 'false', 'commission', 'Commission rules and sharing schemes are approved on Configuration Approvals before they apply (off: saved in force at once)', 'boolean'),
 ('commission.adjustment_approval_required', 'false', 'commission', 'A rate change, reversal or withholding tax change on a commission line is requested with a reason and approved by a second user', 'boolean'),
 ('commission.eligible_requires_remittance', 'false', 'commission', 'A commission line becomes payable only once its policy is fully paid and on an approved remittance to the insurer', 'boolean'),
 ('commission.reverse_on_cancellation', 'true', 'commission', 'A cancellation or return premium reverses or claws back the commission lines of the policy in proportion (off: lines are left for a manual request)', 'boolean')
ON CONFLICT (key) DO NOTHING;
