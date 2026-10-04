-- Permissions and posting rules of the accounts payable sub-ledger and the fixed asset register.
--   read:payables / write:payables     Accounting: suppliers, supplier invoices, supplier payments, AP ageing
--   approve:payables                   Accounting Manager: approves supplier invoices (maker-checker: not the preparer)
--   read:fixed-assets / write:fixed-assets   Accounting: asset register and the monthly depreciation run
-- Posting rules (version 1, editable on Master > Finance > Posting Rules):
--   ap.invoice       Dr expense / asset lines, Dr input VAT / Cr EWT payable, Cr accounts payable - suppliers
--   ap.payment       Dr accounts payable - suppliers / Cr bank
--   fa.depreciation  Dr depreciation expense / Cr accumulated depreciation (accounts of the asset class)
INSERT INTO permissions(code, module, description) VALUES
 ('read:payables', 'payables', 'View suppliers, supplier invoices and payments, AP ageing'),
 ('write:payables', 'payables', 'Create supplier invoices and supplier payments, maintain suppliers'),
 ('approve:payables', 'payables', 'Approve supplier invoices (maker-checker: not the preparer)'),
 ('read:fixed-assets', 'fixed-assets', 'View the fixed asset register and depreciation schedules'),
 ('write:fixed-assets', 'fixed-assets', 'Register fixed assets and run the monthly depreciation')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE (r.code IN ('accounting', 'system-admin') AND p.code IN ('read:payables', 'write:payables', 'read:fixed-assets', 'write:fixed-assets'))
   OR (r.code IN ('accounting-manager', 'system-admin') AND p.code = 'approve:payables')
ON CONFLICT DO NOTHING;

-- account roles used as fallbacks by the depreciation rule (the asset class names its own accounts)
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.account.depreciation_expense', '"4406001"', 'accounting', 'GL account: depreciation expense (fallback when an asset class names none)', 'string'),
 ('accounting.account.accumulated_depreciation', '"1402001"', 'accounting', 'GL account: accumulated depreciation (fallback when an asset class names none)', 'string')
ON CONFLICT (key) DO NOTHING;

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'ap.invoice', 1, 'Supplier invoice approved', 'Expense (or asset) and input VAT against the amount payable to the supplier and the expanded withholding tax withheld.',
    'payables', 'AP_INVOICE', 'payables', 'Supplier invoice {{invoiceNo}} – {{supplierName}}', 'none', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'ap.invoice') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'context', 'expense', NULL::text, 'net', false, '{{supplierName}} – {{invoiceNo}}'),
  (2, 'Dr', 'context', 'vat', 'input_vat', 'vat', false, 'Input VAT – {{invoiceNo}}'),
  (3, 'Cr', 'context', 'ewt', 'wht_payable', 'ewt', false, 'EWT withheld – {{supplierName}} {{invoiceNo}}'),
  (4, 'Cr', 'role', 'supplier_payable', NULL::text, 'payable', false, 'Payable to {{supplierName}} – {{voucherNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'ap.payment', 1, 'Supplier paid', 'Payment of supplier invoices from a bank account or cash.', 'payables', 'AP_PAYMENT', 'payables',
    'Payment {{paymentNumber}} to {{supplierName}}', 'none', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'ap.payment') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'supplier_payable', NULL::text, 'amount', false, 'Paid to {{supplierName}} – {{paymentNumber}}'),
  (2, 'Cr', 'resolver', 'bank_account', NULL::text, 'amount', false, '{{memoRef}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'fa.depreciation', 1, 'Monthly depreciation', 'Straight-line depreciation of the fixed assets of one asset class for one period.', 'fixed-assets', 'DEPRECIATION', 'fixed-assets',
    'Depreciation {{period}} – {{assetClass}}', 'none', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'fa.depreciation') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'context', 'expense', 'depreciation_expense', 'amount', false, 'Depreciation {{period}} – {{assetClass}}'),
  (2, 'Cr', 'context', 'accumulated', 'accumulated_depreciation', 'amount', false, 'Accumulated depreciation {{period}} – {{assetClass}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
