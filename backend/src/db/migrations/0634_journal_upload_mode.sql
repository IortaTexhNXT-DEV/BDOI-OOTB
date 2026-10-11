-- Journal voucher upload: batch error handling and the transaction code (TIS-BRD-NFR-07.4, TIS-BRD-NIA-05; GAP-FIN-18).
--
-- journal.upload_mode: partial (NFR-07.4: the batch logs its issues and carries on with the next record) saves the valid
-- vouchers of a file and lists the rows of the failed ones; all-or-nothing saves nothing while any voucher is wrong.
-- journal.upload_check_transaction_code: the Transaction Code of each voucher must be an active code of Master >
-- Finance > Transaction Code. Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('journal.upload_mode', '"partial"', 'finance', 'Journal voucher upload: partial (save the valid vouchers, list the failed rows) or all-or-nothing', 'string', true),
 ('journal.upload_check_transaction_code', 'true', 'finance', 'Journal voucher upload: the Transaction Code must be an active code of the Transaction Code master', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
