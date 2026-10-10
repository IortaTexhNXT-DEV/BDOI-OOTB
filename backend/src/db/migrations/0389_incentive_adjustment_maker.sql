-- Adjustment of the agent lines of an incentive calculation batch (Accounts > Incentive > Calculations > Details):
-- the users who adjusted a batch are kept on it (adjusted_by) and, like its creator and its submitter, may not approve
-- or reject it (maker-checker in the service). The reason of an adjustment is a code of the Reason Codes master
-- (context incentive_adjustment, seed 88_accounting_reasons.sql), kept beside the reason text of the line. Idempotent.

ALTER TABLE incentive_calculations ADD COLUMN IF NOT EXISTS adjusted_by text[] NOT NULL DEFAULT '{}';
COMMENT ON COLUMN incentive_calculations.adjusted_by IS 'Users who adjusted agent lines of the batch (maker-checker: they may not decide it)';
ALTER TABLE incentive_results ADD COLUMN IF NOT EXISTS adjustment_reason_code text;
COMMENT ON COLUMN incentive_results.adjustment_reason_code IS 'Reason code of the adjustment (master reason-code, context incentive_adjustment); adjustment_reason holds its name and the note';
