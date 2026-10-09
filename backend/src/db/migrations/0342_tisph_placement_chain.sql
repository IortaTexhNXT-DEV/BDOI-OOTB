-- Broker-mediated issuance (TIS-BRD-ISSUE-01 to 04): the broker never issues cover. An accepted quotation raises the
-- placement automatically and the placement moves through the insurer's own steps before anything is booked:
--   draft (placement raised, slip PDF stored) -> sent (e-mailed with the slip attached) -> acknowledged (the insurer
--   confirmed receipt) -> epolicy_received (the e-policy is uploaded and its figures keyed) -> checked (compared with the
--   slip and confirmed by a second user) -> issued (Insurer issued: only now the policy, bill, journal and commission).
-- "bound" (every insurer confirmed) is retired: a bound placement had its confirmations, not its e-policy, so it becomes
-- acknowledged. Record Issued Policy (a policy created and issued in one step) is withdrawn.

ALTER TABLE placements ADD COLUMN IF NOT EXISTS slip_document_key text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS slip_document_name text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS slip_generated_at timestamptz;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS acknowledged_by text REFERENCES users(id);
ALTER TABLE placements ADD COLUMN IF NOT EXISTS acknowledgement_reference text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS acknowledgement_remarks text;
-- the issued policy as received from the insurer (ISSUE-02): policy numbers, participant name, figures, dates, vehicle
ALTER TABLE placements ADD COLUMN IF NOT EXISTS epolicy jsonb NOT NULL DEFAULT '{}';
ALTER TABLE placements ADD COLUMN IF NOT EXISTS epolicy_document_key text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS epolicy_document_name text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS epolicy_received_at timestamptz;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS epolicy_received_by text REFERENCES users(id);
-- comparison of the e-policy with the slip and the decision on it (a user other than the one who keyed the e-policy)
ALTER TABLE placements ADD COLUMN IF NOT EXISTS check_status text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS check_result jsonb;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS check_decision text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS check_reason text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS checked_at timestamptz;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS checked_by text REFERENCES users(id);
ALTER TABLE placements ADD COLUMN IF NOT EXISTS issued_by text REFERENCES users(id);

CREATE INDEX IF NOT EXISTS placements_acknowledged_by_fk_idx ON placements(acknowledged_by);
CREATE INDEX IF NOT EXISTS placements_epolicy_received_by_fk_idx ON placements(epolicy_received_by);
CREATE INDEX IF NOT EXISTS placements_checked_by_fk_idx ON placements(checked_by);
CREATE INDEX IF NOT EXISTS placements_issued_by_fk_idx ON placements(issued_by);

UPDATE placements SET status = 'acknowledged', acknowledged_at = COALESCE(bound_at, updated_at),
  acknowledged_by = CASE WHEN updated_by IN (SELECT id FROM users) THEN updated_by END,
  acknowledgement_remarks = 'All participating insurers had confirmed before the e-policy step was introduced'
WHERE status = 'bound';

ALTER TABLE placements DROP CONSTRAINT IF EXISTS placements_status_chk;
ALTER TABLE placements ADD CONSTRAINT placements_status_chk
  CHECK (status IN ('draft', 'sent', 'acknowledged', 'epolicy_received', 'checked', 'issued', 'declined', 'cancelled'));
ALTER TABLE placements DROP CONSTRAINT IF EXISTS placements_check_status_chk;
ALTER TABLE placements ADD CONSTRAINT placements_check_status_chk CHECK (check_status IS NULL OR check_status IN ('match', 'mismatch'));
ALTER TABLE placements DROP CONSTRAINT IF EXISTS placements_check_decision_chk;
ALTER TABLE placements ADD CONSTRAINT placements_check_decision_chk CHECK (check_decision IS NULL OR check_decision IN ('confirmed', 'accepted', 'returned'));

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('placement.auto_raise', 'true', 'placement', 'Raise the placement slip automatically when the client accepts a quotation (statuses in placement.auto_raise_statuses)', 'boolean'),
 ('placement.auto_raise_statuses', '["CustomerAccepted"]', 'placement', 'Quotation statuses that raise the placement slip automatically', 'json'),
 ('placement.check_fields', '["netPremium","grossPremium","sumInsured","commissionAmount","period","insuredName","vehicle","deductible"]', 'placement',
  'Items of the e-policy compared with the placement slip: netPremium, grossPremium, sumInsured, commissionAmount, period, insuredName, vehicle, deductible', 'json'),
 ('placement.check_tolerance_amount', '1', 'placement', 'Check against slip: an amount on the e-policy within this many currency units of the slip matches', 'number'),
 ('placement.check_tolerance_pct', '0', 'placement', 'Check against slip: an amount within this percentage of the slip amount matches (the larger of the two tolerances applies)', 'number'),
 ('placement.check_maker_checker', 'true', 'placement', 'Check against slip: the user who keyed the e-policy cannot confirm the check', 'boolean'),
 ('placement.schedule_email_on_booking', 'true', 'placement', 'E-mail the policy schedule to the client''s registered e-mail when the placement is booked (Insurer issued)', 'boolean'),
 ('placement.direct_document_products', '["CTPL"]', 'placement', 'Products (codes) placed without a quotation that need the LTO document / official receipt attached; it goes to the insurer with the placement slip', 'json'),
 ('email.template.placement_discrepancy', $j${"subject":"Placement slip {{placementNumber}} - e-policy {{insurerPolicyNumber}} does not match the slip","html":"<p>Dear {{insurerName}} underwriting team,</p><p>We checked e-policy <b>{{insurerPolicyNumber}}</b> for placement slip <b>{{placementNumber}}</b> ({{insuredName}}, {{productType}}) against our placement slip and found these differences: {{differences}}.</p><p>{{reason}}</p><p>Please send a corrected e-policy.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: e-policy returned to the insurer because it does not match the placement slip', 'json'),
 ('email.template.policy_schedule', $j${"subject":"Your policy {{policyNumber}} - policy schedule","html":"<p>Dear {{customerName}},</p><p>{{insurerName}} has issued your {{productType}} policy <b>{{policyNumber}}</b> (insurer policy number {{insurerPolicyNumber}}), effective {{inception}} to {{expiry}}. Your policy schedule is attached.</p><p>Gross premium: {{currency}} {{grossPremium}}</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: policy schedule sent to the client when the insurer has issued the policy', 'json')
ON CONFLICT (key) DO NOTHING;

-- the firm order now carries the placement slip PDF and asks for an acknowledgement and the e-policy
UPDATE app_settings SET value = $j${"subject":"Placement slip {{placementNumber}} - firm order - {{insuredName}}","html":"<p>Dear {{insurerName}} underwriting team,</p><p>On behalf of our client we place the risk below with you. The placement slip is attached. Please acknowledge receipt of this order and send us the e-policy once issued.</p><p>Placement slip <b>{{placementNumber}}</b><br/>Insured: {{insuredName}}<br/>Class: {{productType}}<br/>Period: {{period}}<br/>Sum insured (100%): {{currency}} {{sumInsured}}<br/>Your share: <b>{{sharePercent}}%</b> ({{role}})<br/>Your share of sum insured: {{currency}} {{shareSumInsured}}<br/>Your share of premium: {{currency}} {{sharePremium}} (gross {{currency}} {{sharePremiumTotal}})</p><p>{{companyName}}</p>"}$j$
WHERE key = 'email.template.placement_order' AND value->>'html' NOT LIKE '%placement slip is attached%';

-- TISPH journey: every line is placed through a placement slip (no direct conversion, no direct policy entry, renewals
-- included); Motor comprehensive needs a quotation, CTPL may be placed directly (TIS-BRD-QUOT-01)
UPDATE app_settings SET value = '{
  "default": {"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "required", "directPolicy": "skip"},
  "MOTOR": {"quotationSlip": "required", "placementSlip": "required", "directPolicy": "skip"},
  "CTPL": {"quotationSlip": "optional", "placementSlip": "required", "directPolicy": "skip"}
}' WHERE key = 'placement.journey';
UPDATE app_settings SET value = '{
  "package": {"brokerSlip": "optional", "quotationSlip": "required", "placementSlip": "required", "directPolicy": "skip"},
  "non_package": {"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "required", "directPolicy": "skip"}
}' WHERE key = 'placement.journey_by_business_type';
UPDATE app_settings SET value = 'true' WHERE key = 'placement.journey_applies_to_renewals';

UPDATE app_settings SET value = '["sent","acknowledged","epolicy_received","checked"]',
  label = 'Cover notes: placement slip statuses a cover note may be issued from (sent to the insurer and not yet booked)'
WHERE key = 'cover_note.placement_statuses';
UPDATE app_settings SET value = '["draft","submitted","responses-in","sent","acknowledged","epolicy_received","checked","declined"]'
WHERE key = 'reports.placement_open_statuses';
