-- Proof of payment verified before the placement is sent (Pre-BSM P04, TIS-BRD-COLL-01) and the non-payment cadence
-- (TIS-BRD-CANC-02, RPT-OPS-11, CR-14).
--
-- placements.payment_verified_*: Cash Control (write:receipts) verifies the proof of payment of a placement (cash before
-- cover; an approved post-dated cheque instalment may get cover before cash); with placement.payment_verification_required
-- the slip is neither sent nor booked before that. CCD-BP reads the placement slips to do it.
-- Non-payment cadence: the nonpayment-cadence job sends the customer a notice at collections.nonpayment_notice_days
-- after the due date (5, 10, 15 days), flags the account for cancellation at the last notice (collection_items
-- .nonpayment_flagged_at), tells Sales and the insurer once a policy is cancelled for non-payment, and sends each
-- insurer the month's non-payment cancellations on or before collections.insurer_notice_day (the 26th). The
-- Non-Payment Report lists the accounts without payment past collections.nonpayment_report_days. Idempotent.

ALTER TABLE placements ADD COLUMN IF NOT EXISTS payment_verified_at timestamptz;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS payment_verified_by text;
ALTER TABLE placements ADD COLUMN IF NOT EXISTS payment_verification jsonb;
COMMENT ON COLUMN placements.payment_verification IS 'Proof of payment verified by Cash Control: { mode, reference, amount, remarks, pdcApproved }';

ALTER TABLE collection_items ADD COLUMN IF NOT EXISTS nonpayment_flagged_at timestamptz;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS nonpayment_notified_at timestamptz;

CREATE TABLE IF NOT EXISTS nonpayment_insurer_notices (
  id bigserial PRIMARY KEY,
  period text NOT NULL,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  policies int NOT NULL DEFAULT 0,
  email_id bigint,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period, insurance_company_id)
);

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('placement.payment_verification_required', 'false', 'placement', 'A placement slip is sent and booked only after Cash Control has verified the proof of payment (cash before cover)', 'boolean', true),
 ('placement.pdc_cover_before_cash', 'true', 'placement', 'An approved post-dated cheque instalment plan counts as verified payment (cover before cash)', 'boolean', true),
 ('collections.nonpayment_notice_days', '[5, 10, 15]', 'collections', 'Days after the due date on which the customer is notified of non-payment; the last one flags the account for cancellation', 'json', true),
 ('collections.nonpayment_report_days', '5', 'collections', 'Days after the due date from which an unpaid account appears on the Non-Payment Report', 'number', true),
 ('collections.insurer_notice_day', '26', 'collections', 'Day of the month on or before which each insurer receives the list of policies cancelled for non-payment', 'number', true),
 ('collections.nonpayment_cancellation_reason', '"CAN-NONPAY"', 'collections', 'Cancellation reason code of a cancellation for non-payment', 'string', true),
 ('email.template.nonpayment_notice', $j${"subject":"{{companyName}}: premium of policy {{policyNumber}} unpaid {{days}} days after its due date","html":"<p>Dear {{customerName}},</p><p>The premium of <b>{{currency}} {{amount}}</b> on policy <b>{{policyNumber}}</b> (bill {{billNumber}}) was due on {{dueDate}} and is unpaid {{days}} days later.</p><p>{{consequence}}</p><p>Please settle the premium or contact us if it has been paid.</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail to the customer at each non-payment notice ({{days}}, {{consequence}}, {{policyNumber}}, {{billNumber}}, {{amount}}, {{dueDate}})', 'json', true),
 ('email.template.nonpayment_cancelled', $j${"subject":"{{companyName}}: policy {{policyNumber}} cancelled for non-payment","html":"<p>Policy <b>{{policyNumber}}</b> of {{customerName}} was cancelled for non-payment of premium effective {{effectiveDate}} (cancellation {{endorsementNumber}}).</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail to the insurer when a policy is cancelled for non-payment', 'json', true),
 ('email.template.nonpayment_insurer_notice', $j${"subject":"{{companyName}}: policies cancelled for non-payment, {{period}}","html":"<p>The following policies placed with {{insurerName}} were cancelled for non-payment of premium in {{period}}:</p>{{policyList}}<p>{{companyName}}</p>"}$j$, 'email', 'E-mail to each insurer on or before the insurer notice day with the month''s non-payment cancellations ({{policyList}})', 'json', true)
ON CONFLICT (key) DO NOTHING;

-- CCD-BP (the teller) reads the placement slips to verify the proof of payment
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = 'read:quotations' WHERE r.code = 'tis-ccd-bp'
  AND NOT EXISTS (SELECT 1 FROM role_permissions x WHERE x.role_id = r.id AND x.permission_id = p.id);

-- Non-Payment Report (cancellation basis)
INSERT INTO report_definitions(code, name, category, description, screen, query_name, parameters, default_columns, roles, sort_order)
VALUES ('non-payment', 'Non-Payment Report', 'operational', 'Accounts without payment past the non-payment report days after the due date: policy, client, insurer, bill, days past due, balance, notices sent and the cancellation flag (cancellation basis).', 'Reports > Operational Reports > Non-Payment', 'nonPayment',
  '{"type":"object","required":["ReportCriteria"],"properties":{"ReportCriteria":{"type":"string","title":"Report Criteria","enum":["Overall","Principal Insurer","Agent","Branch"],"default":"Overall"},"FromDate":{"type":"string","format":"date","title":"Due From"},"ToDate":{"type":"string","format":"date","title":"Due To"}}}',
  '[{"key":"policyNumber","label":"Policy No.","type":"text"},{"key":"client","label":"Client","type":"text"},{"key":"insurer","label":"Insurer","type":"text"},{"key":"product","label":"Product","type":"text"},{"key":"billNumber","label":"Bill No.","type":"text"},{"key":"dueDate","label":"Due Date","type":"date"},{"key":"daysPastDue","label":"Days Past Due","type":"number"},{"key":"balance","label":"Balance","type":"money"},{"key":"noticesSent","label":"Notices Sent","type":"number"},{"key":"lastNoticeDate","label":"Last Notice","type":"date"},{"key":"flaggedDate","label":"Flagged for Cancellation","type":"date"},{"key":"agent","label":"Account Executive","type":"text"},{"key":"status","label":"Status","type":"text"}]',
  ARRAY['accounting', 'accounting-manager', 'operations', 'tis-ccd-bp', 'tis-ccd-recon', 'tis-finance', 'tis-general-manager', 'tis-sales-unit-head', 'tis-ops-unit-head'], 215)
ON CONFLICT (code) DO NOTHING;
