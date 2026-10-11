-- One payment path for remittances (Accounts > Remittance): an approved remittance is paid through the voucher of its
-- settlement (Insurer payments, Bank Payment Files, Disbursement). Marking it settled by hand with a free payment
-- reference (POST /remittance/remittances/:id/settle) left a remittance "Settled (voucher raised)" with no voucher.
--
-- Setting:
--   remittance.direct_settle_enabled   on: an approved remittance can be marked settled with a payment reference;
--                                      off: refused with 409 SETTLE_OFF (TISPH, roles of migration 0348)
--
-- The status "Pending Approval" reads "Pending approval" (sentence case, as the screens write it), while unchanged.
--
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('remittance.direct_settle_enabled', 'true', 'remittance', 'An approved remittance can be marked settled with a payment reference, without a payment voucher (off: paid through the voucher of its settlement)', 'boolean')
ON CONFLICT (key) DO NOTHING;

UPDATE app_settings s
   SET value = 'false'::jsonb, updated_at = now()
 WHERE s.key = 'remittance.direct_settle_enabled' AND s.updated_by IS NULL AND s.value = 'true'::jsonb
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

UPDATE app_settings s
   SET value = s.value || '{"for-approval": "Pending approval"}'::jsonb, updated_at = now()
 WHERE s.key = 'remittance.status_labels' AND s.updated_by IS NULL AND s.value->>'for-approval' = 'Pending Approval'
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');
