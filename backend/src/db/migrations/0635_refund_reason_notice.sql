-- Refund reason and the refund amount notification on the refund voucher (Pre-BSM M16 "Refund Amount Notification -
-- Mid-Term Policy Cancellation", M24 REF-CANCEL, TIS-BRD-DISB-03; GAP-CASH-17).
--
-- A payment voucher to a customer carries its refund reason (Reason Codes master, context refund, e.g. REF-CANCEL).
-- When the voucher is paid (its cheque or bank transfer approved) the client is e-mailed the refund amount
-- (template refund_notice) once, with disbursements.refund_notify_client; refund_notified_at records it. Idempotent.

ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS refund_reason_code text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS refund_reason text;
ALTER TABLE disbursements ADD COLUMN IF NOT EXISTS refund_notified_at timestamptz;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('disbursements.refund_notify_client', 'true', 'finance', 'E-mail the client the refund amount when a refund voucher to a customer is paid (Refund Amount Notification)', 'boolean', true),
 ('email.template.refund_notice', $j${"subject":"{{companyName}}: refund of {{currency}} {{amount}} on policy {{policyNumber}}","html":"<p>Dear {{customerName}},</p><p>A refund of <b>{{currency}} {{amount}}</b> on policy <b>{{policyNumber}}</b> ({{reason}}) has been released under voucher {{voucherNumber}}.</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail to the client when a refund is paid ({{amount}}, {{policyNumber}}, {{reason}}, {{voucherNumber}})', 'json', true)
ON CONFLICT (key) DO NOTHING;
