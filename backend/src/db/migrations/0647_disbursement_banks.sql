-- Disbursing bank of a payment voucher (TIS-BRD-DISB-01, CR-09; gap register GAP-CASH-11).
--
-- A voucher is paid from the bank chosen on it, else from the dedicated bank of the dealer it pays (the distribution
-- channel whose payee is the voucher's referrer, Master > Distribution Channels > Bank), else from
-- disbursements.default_bank_code. A chosen bank is active and, when disbursements.allowed_bank_codes lists banks, one
-- of them (disbursements/service.js voucherBank).
--
-- Settings:
--   disbursements.default_bank_code    the bank a voucher is paid from when neither the voucher nor the dealer names one
--   disbursements.allowed_bank_codes   the banks vouchers may be paid from (empty: any active bank)
-- Both empty here; TISPH (one bank only, Metrobank: the TISPH remark on DISB-01) gets MBT from seed
-- 93_tisph_master_data.sql while nobody has changed the settings. Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('disbursements.default_bank_code', 'null', 'finance', 'Bank code a payment voucher is paid from when neither the voucher nor the dealer it pays names a bank', 'string', true),
 ('disbursements.allowed_bank_codes', '[]', 'finance', 'Bank codes payment vouchers may be paid from (empty: any active bank)', 'json', true)
ON CONFLICT (key) DO NOTHING;

