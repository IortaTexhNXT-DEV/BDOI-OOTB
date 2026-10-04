-- Default authority matrix of a Philippine non-life broker (Master > User Management > Authority Matrix). Starting
-- values only: the board-approved signing authority replaces them. Amounts in PHP; the discount in percent; NULL = no
-- limit. A role / type pair that already has a limit in any state is left alone, so changes made on screen are kept.
-- The System Administrator has no limit rows: approvals are Accounting and Operations work.

INSERT INTO authority_limits(transaction_type, role_code, max_amount, status, remarks, decided_at, decision_note)
SELECT v.type, v.role, v.amount, 'active', 'Default limit', now(), 'Out-of-the-box default'
FROM (VALUES
 ('quotation_discount', 'sales', 10::numeric), ('quotation_discount', 'operations', 10), ('quotation_discount', 'processing', 15), ('quotation_discount', 'accounting-manager', 25),
 ('policy_issue', 'sales', 1000000), ('policy_issue', 'operations', 1000000), ('policy_issue', 'processing', 5000000), ('policy_issue', 'accounting-manager', NULL),
 ('return_premium', 'operations', 100000), ('return_premium', 'processing', 250000), ('return_premium', 'accounting', 250000), ('return_premium', 'accounting-manager', NULL),
 ('claim_settlement', 'claims', 1000000), ('claim_settlement', 'accounting-manager', NULL),
 ('payment_voucher', 'accounting', 2000000), ('payment_voucher', 'accounting-manager', NULL),
 ('journal_voucher', 'accounting', 1000000), ('journal_voucher', 'accounting-manager', NULL),
 ('write_off', 'accounting', 1000), ('write_off', 'accounting-manager', 50000),
 ('commission_payout', 'accounting', 500000), ('commission_payout', 'accounting-manager', NULL),
 ('petty_cash', 'accounting', 10000), ('petty_cash', 'accounting-manager', 50000),
 ('remittance', 'accounting', 1000000), ('remittance', 'accounting-manager', NULL),
 ('underwriting_referral', 'processing', 10000000), ('underwriting_referral', 'operations', 3000000),
 ('remittance_settlement', 'accounting', 1000000), ('remittance_settlement', 'accounting-manager', NULL)
) AS v(type, role, amount)
WHERE EXISTS (SELECT 1 FROM roles r WHERE r.code = v.role)
  AND NOT EXISTS (SELECT 1 FROM authority_limits l WHERE l.transaction_type = v.type AND l.role_code = v.role);

-- Default segregation-of-duties rules (Master > User Management > Segregation of Duties); edits on screen are kept.
INSERT INTO sod_rules(code, name, role_a, role_b, action, reason)
SELECT v.code, v.name, v.a, v.b, v.action, v.reason FROM (VALUES
 ('SOD-PROC-ACCT', 'Placement and payment', 'processing', 'accounting', 'block', 'The person who places and issues business should not also release premium to insurers'),
 ('SOD-PROC-MGR', 'Placement and payment approval', 'processing', 'accounting-manager', 'block', 'The person who places business should not approve its payments'),
 ('SOD-CLM-ACCT', 'Claims and payment', 'claims', 'accounting', 'block', 'The claims handler should not also release claim payments'),
 ('SOD-SALES-ACCT', 'Sales and collection', 'sales', 'accounting', 'warn', 'Account executives should not apply collections to their own clients'),
 ('SOD-SALES-CLM', 'Sales and claims', 'sales', 'claims', 'warn', 'Claims are handled apart from the account executive of the client')
) AS v(code, name, a, b, action, reason)
WHERE EXISTS (SELECT 1 FROM roles WHERE code = v.a) AND EXISTS (SELECT 1 FROM roles WHERE code = v.b)
ON CONFLICT (code) DO NOTHING;
