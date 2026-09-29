-- One bank statement line table: the bank transactions of the remittance reconciliation (remittance_items kind
-- 'bank-txn') move to bank_statement_lines (source 'remittance', no bank account unless one is assigned later),
-- keeping their ids (remittances.data.reconciliation.bankId points at them), BNK numbers and match state.
-- The remittance screen reads them from there (src/modules/remittance/items.js). Idempotent.
INSERT INTO bank_statement_lines(id, bank_account_id, txn_number, txn_date, description, reference, debit, credit, amount, source,
  rem_status, rem_remittance_id, rem_reference, rem_difference, created_by, updated_by, created_at, updated_at)
SELECT x.id, NULL, x.reference_no, COALESCE(NULLIF(x.data->>'transDate', '')::date, x.created_at::date), COALESCE(x.data->>'description', ''),
  x.data->>'bankReference', GREATEST(-x.amount, 0), GREATEST(x.amount, 0), x.amount, 'remittance',
  CASE WHEN x.status IN ('matched', 'partial') THEN x.status ELSE 'unmatched' END, x.data->>'matchedTo', x.data->>'matchedRef',
  NULLIF(x.data->>'difference', '')::numeric, x.created_by, x.updated_by, x.created_at, x.updated_at
FROM remittance_items x WHERE x.kind = 'bank-txn'
ON CONFLICT (id) DO NOTHING;
DELETE FROM remittance_items x WHERE x.kind = 'bank-txn' AND EXISTS (SELECT 1 FROM bank_statement_lines l WHERE l.id = x.id);
