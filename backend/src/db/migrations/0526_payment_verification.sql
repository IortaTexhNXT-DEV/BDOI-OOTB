-- Payment capture and verification for TISPH (TIS-BRD-COLL-01).
--
-- policy.payment_capture_proof_required: a premium payment captured on a policy carries the proof of payment (deposit
-- slip, cheque image, transfer confirmation) that Cash Control verifies before the receipt is issued.
-- payments.verification_notify_roles: the roles told that a captured payment waits for verification (Accounting for
-- the broker roles, CCD-BP who issues the receipts for TISPH). Idempotent; a value changed on the screen is kept.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('policy.payment_capture_proof_required', 'true', 'policy', 'Payment capture: the proof of payment is required', 'boolean'),
 ('payments.verification_notify_roles', '["accounting","tis-ccd-bp"]', 'payments', 'Roles told that a premium payment captured on a policy waits for verification', 'json')
ON CONFLICT (key) DO NOTHING;
