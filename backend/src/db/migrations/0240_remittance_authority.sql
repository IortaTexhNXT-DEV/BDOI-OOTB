-- Remittance approval limits belong to the Authority Matrix (Master > User Management > Authority Matrix), like every
-- other approval. Accounts > Remittance > Approval checks the approver's limit (assertAuthority) for:
--   remittance             insurer remittances and agency bills (net amount due)
--   remittance_settlement  settlements, remittance adjustments and electronic transfers (amount of the item)
-- remittance.approval_levels (Configuration) is kept only as the fallback used while no Authority Matrix limit exists
-- for the transaction type; its label says so. The Remittance Master "Approval Workflow" records and the
-- settlement parameter approvalLevels were never read (migration 0241 retires them).
-- Remittance > Approval > Delegation (remittance_delegations) was never read by the approval either: cover is given
-- in Master > User Management > Delegations (user_delegations), which assertAuthority follows. The table is kept
-- for reference; nothing writes it any more.
INSERT INTO authority_transaction_types(code, name, measure, description, sort_order) VALUES
 ('remittance', 'Remittance approval', 'amount', 'Net amount of an insurer remittance or agency bill approved in Accounts > Remittance > Approval', 100),
 ('remittance_settlement', 'Remittance settlement, adjustment and transfer', 'amount', 'Settlement, remittance adjustment or electronic transfer approved in Accounts > Remittance > Approval', 110)
ON CONFLICT (code) DO NOTHING;

UPDATE app_settings
SET label = 'Fallback approval levels by amount, used only while the Authority Matrix has no remittance limit (Master > User Management > Authority Matrix)'
WHERE key = 'remittance.approval_levels';
