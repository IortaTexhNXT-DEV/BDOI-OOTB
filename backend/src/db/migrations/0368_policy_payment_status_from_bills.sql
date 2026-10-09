-- The payment status of a policy followed only the payments captured on the policy's Payment screen: a receipt
-- recorded in Accounts > Receipts, a deposited post-dated cheque or a cancelled receipt left it Pending, and a policy
-- fully paid could not be endorsed (the endorsement needs a Completed payment); an additional premium billed on a paid
-- policy left it Completed. Receipts, endorsement bills and return premiums now update it (receipts/receivables.js
-- syncPolicyPaymentStatus); the policies already collected or endorsed that way are brought in line with their bills
-- here. Only Pending, Partial and Completed are corrected; a payment in review or a refund is left as it is. Idempotent.

WITH bills AS (
  SELECT r.policy_id, sum(r.amount) AS amount, sum(r.balance) AS balance
  FROM receivables r WHERE r.status <> 'written-off' AND r.policy_id IS NOT NULL GROUP BY r.policy_id
)
UPDATE policies p SET payment_status = CASE WHEN b.balance <= 0 THEN 'Completed' WHEN b.balance < b.amount THEN 'Partial' ELSE 'Pending' END,
  paid_at = CASE WHEN b.balance <= 0 THEN COALESCE(p.paid_at, now()) ELSE p.paid_at END, updated_at = now()
FROM bills b
WHERE b.policy_id = p.id AND p.payment_status IN ('Pending', 'Partial', 'Completed') AND COALESCE(p.billing_mode, 'broker') <> 'direct'
  AND NOT EXISTS (SELECT 1 FROM policy_payments pp WHERE pp.policy_id = p.id AND pp.status = 'submitted')
  AND p.payment_status <> CASE WHEN b.balance <= 0 THEN 'Completed' WHEN b.balance < b.amount THEN 'Partial' ELSE 'Pending' END;
