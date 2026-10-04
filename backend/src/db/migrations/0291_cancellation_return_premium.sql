-- Policy cancellation with a computed return premium (pro-rata on the days left, the short-period scale when the
-- insured cancels, flat when cancelled from inception). The method, the reason and the computation are kept on the
-- endorsement; the short-period scale and the cancellation reasons are generic masters (seed 73_ops_accounting.sql).
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS cancellation_method text
  CHECK (cancellation_method IS NULL OR cancellation_method IN ('pro-rata', 'short-period', 'flat', 'manual'));
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS return_calculation jsonb;
