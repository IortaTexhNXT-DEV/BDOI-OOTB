-- Receipt reversal with a checker (PBSM-M17v4-REVERSALS, TIS-BRD-SEC-03, TIS-BRD-COLL-06).
--
-- A receipt is reversed (cancelled: its payment journals reversed, the bills re-opened) by a holder of
-- reverse:receipts with a reason of the Reason Codes master (context receipt_reversal). With
-- receipts.reversal_requires_approval the request waits for a holder of approve:receipt-reversal who did not request
-- it; a returned request needs a reason (context receipt_reversal_reject). RBAC v4: reversals sit with CCD-Recon
-- (CCD-BP, CCD-PDU and CCD-PDC issue receipts and do not reverse them); the checker is a second CCD-Recon user or
-- Finance. The broker roles keep their right: the roles holding write:receipts request, the Accounting Manager approves.
-- Idempotent.

INSERT INTO permissions(code, module, description) VALUES
 ('reverse:receipts', 'receipts', 'Reverse a receipt (cancel it, reversing its payment journals) with a reason; the reversal waits for a checker when required'),
 ('approve:receipt-reversal', 'receipts', 'Approve or return the reversal of a receipt requested by another user (maker-checker)')
ON CONFLICT (code) DO NOTHING;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
               WHERE p.code = 'write:receipts')
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'reverse:receipts');

INSERT INTO role_permissions(role_id, permission_id)
SELECT DISTINCT rp.role_id, n.id FROM role_permissions rp JOIN permissions o ON o.id = rp.permission_id JOIN roles r ON r.id = rp.role_id
  JOIN permissions n ON n.code = 'reverse:receipts'
 WHERE o.code = 'write:receipts' AND r.code NOT LIKE 'tis-%'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = ANY(CASE r.code
    WHEN 'system-admin' THEN ARRAY['reverse:receipts', 'approve:receipt-reversal']
    WHEN 'accounting-manager' THEN ARRAY['approve:receipt-reversal']
    WHEN 'tis-ccd-recon' THEN ARRAY['reverse:receipts', 'approve:receipt-reversal']
    WHEN 'tis-finance' THEN ARRAY['approve:receipt-reversal']
    ELSE ARRAY[]::text[] END)
ON CONFLICT DO NOTHING;

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reversal_status text;
ALTER TABLE receipts DROP CONSTRAINT IF EXISTS receipts_reversal_status_chk;
ALTER TABLE receipts ADD CONSTRAINT receipts_reversal_status_chk CHECK (reversal_status IS NULL OR reversal_status IN ('pending', 'approved', 'returned'));
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reversal_reason_code text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reversal_reason text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reversal_requested_by text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reversal_requested_at timestamptz;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reversal_decided_by text;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reversal_decided_at timestamptz;
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reversal_return_reason text;
CREATE INDEX IF NOT EXISTS receipts_reversal_pending ON receipts(reversal_status) WHERE reversal_status = 'pending';

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('receipts.reversal_requires_approval', 'true', 'receipts', 'Receipt reversal: a second user (approve:receipt-reversal) approves the reversal before the receipt is cancelled', 'boolean')
ON CONFLICT (key) DO NOTHING;
