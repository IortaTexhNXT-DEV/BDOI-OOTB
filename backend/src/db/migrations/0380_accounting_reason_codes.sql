-- Coded reasons of the accounting decisions (Reason Codes master, contexts of seed 88_accounting_reasons.sql): the
-- reason code is kept beside the reason text of a period status change (period_close, period_reopen), a year-end
-- reversal (year_end_reverse), a voided print of a loose-leaf book (cas_print_void) and a rejected incentive
-- calculation batch (incentive_batch_reject). The text columns keep the reason's name and the note, as
-- requiredReason() in src/modules/ops-masters/records.js returns them. Idempotent.

ALTER TABLE period_status_history ADD COLUMN IF NOT EXISTS reason_code text;
COMMENT ON COLUMN period_status_history.reason_code IS 'Reason code (master reason-code, context period_close or period_reopen); remarks holds its name and the note';
ALTER TABLE year_end_runs ADD COLUMN IF NOT EXISTS reverse_reason_code text;
COMMENT ON COLUMN year_end_runs.reverse_reason_code IS 'Reason code of the reversal (master reason-code, context year_end_reverse); reverse_reason holds its name and the note';
ALTER TABLE cas_book_prints ADD COLUMN IF NOT EXISTS void_reason_code text;
COMMENT ON COLUMN cas_book_prints.void_reason_code IS 'Reason code of the void (master reason-code, context cas_print_void); void_reason holds its name and the note';
ALTER TABLE incentive_calculations ADD COLUMN IF NOT EXISTS rejection_reason_code text;
COMMENT ON COLUMN incentive_calculations.rejection_reason_code IS 'Reason code of the rejection (master reason-code, context incentive_batch_reject); rejection_reason holds its name and the note';
