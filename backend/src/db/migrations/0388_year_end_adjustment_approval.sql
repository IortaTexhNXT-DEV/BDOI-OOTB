-- Year-end adjustment journals (Accounts > Period End > Year-End Close, step 2) await approval as the other manual
-- journal vouchers do: a second user approves and posts them on the journal voucher (maker-checker of the vouchers).
-- The adjustments created before as 'pending', which no screen could approve, move to 'for-approval'. Idempotent.

UPDATE journal_vouchers SET status = 'for-approval', updated_at = now()
 WHERE source = 'adjustment' AND entry_type = 'YEAR_END_ADJUSTMENT' AND status = 'pending';
