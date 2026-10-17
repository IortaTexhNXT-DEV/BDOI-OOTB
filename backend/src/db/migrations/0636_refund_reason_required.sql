-- Refund reason required on every customer refund voucher (GAP-CASH-17; Pre-BSM M24 REF-CANCEL, TIS-BRD-DISB-03):
-- create, update and bulk upload refuse a payment voucher to a customer without a reason of the refund context (with
-- the note the reason asks for). Off: the reason stays optional. Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('disbursements.refund_reason_required', 'true', 'finance', 'A payment voucher to a customer (refund) needs a refund reason of the Reason Codes master (create, update, bulk upload)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
