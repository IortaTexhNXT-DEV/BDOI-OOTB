-- Posting rules (seed): account roles for the new postings, their GL accounts, the write-off reasons master, the
-- bank-account GL field and the initial posting rule of every business event. The initial rules reproduce the
-- journals the system posted before posting rules existed.
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.split_premium_taxes', 'true', 'accounting', 'Book VAT, DST and LGT billed on premium in their own GL accounts (when the bill carries the breakdown)', 'boolean'),
 ('accounting.cancel_reverses_open_receivable', 'true', 'accounting', 'A cancellation without a return-premium amount reverses the open balance of the policy''s bills', 'boolean'),
 ('accounting.account.premium_vat_payable', '"2201002"', 'accounting', 'GL: VAT on premium due to insurers', 'string'),
 ('accounting.account.premium_dst_payable', '"2201003"', 'accounting', 'GL: Documentary stamp tax on premium due to insurers', 'string'),
 ('accounting.account.premium_lgt_payable', '"2201004"', 'accounting', 'GL: Local government tax on premium due to insurers', 'string'),
 ('accounting.account.due_to_reinsurer', '"2201005"', 'accounting', 'GL: Premium payable to reinsurers', 'string'),
 ('accounting.account.ri_premium_receivable', '"1203003"', 'accounting', 'GL: Reinsurance premium receivable from cedants', 'string'),
 ('accounting.account.due_from_reinsurer', '"1203004"', 'accounting', 'GL: Claim recoveries receivable from reinsurers', 'string'),
 ('accounting.account.claims_receivable', '"1203005"', 'accounting', 'GL: Claim settlements receivable from insurers (paid through the broker)', 'string'),
 ('accounting.account.claims_payable', '"2205003"', 'accounting', 'GL: Claim settlements payable to claimants', 'string'),
 ('accounting.account.ri_recovery_payable', '"2205004"', 'accounting', 'GL: Reinsurance claim recoveries payable to cedants', 'string'),
 ('accounting.account.incentive_payable', '"2203007"', 'accounting', 'GL: Incentives payable to producers', 'string'),
 ('accounting.account.ri_commission_income', '"3201003"', 'accounting', 'GL: Reinsurance commission / brokerage income', 'string'),
 ('accounting.account.incentive_expense', '"4401020"', 'accounting', 'GL: Producer incentive expense', 'string'),
 ('accounting.account.remittance_adjustment', '"4409002"', 'accounting', 'GL: Remittance adjustments (credit / debit notes with insurers)', 'string')
ON CONFLICT (key) DO NOTHING;

INSERT INTO gl_accounts(code, name, account_type, parent_code, category, is_open_item, allow_manual, fs_group, normal_balance, description) VALUES
 ('1203003', 'Reinsurance Premium Receivable – Cedants', 'asset', NULL, 'Receivables', true, true, 'Current Assets', 'debit', 'Ceded premium due from cedants on reinsurance placements'),
 ('1203004', 'Claim Recoveries Receivable – Reinsurers', 'asset', NULL, 'Receivables', true, true, 'Current Assets', 'debit', 'Claim recoveries agreed with reinsurers, not yet received'),
 ('1203005', 'Claim Settlements Receivable – Insurers', 'asset', NULL, 'Receivables', true, true, 'Current Assets', 'debit', 'Claim settlements paid through the broker, recoverable from the insurers'),
 ('2201002', 'Premium VAT Due to Insurers', 'liability', NULL, 'Payables', true, true, 'Current Liabilities', 'credit', 'VAT billed on premium, collected for the insurers'),
 ('2201003', 'Premium DST Due to Insurers', 'liability', NULL, 'Payables', true, true, 'Current Liabilities', 'credit', 'Documentary stamp tax billed on premium, collected for the insurers'),
 ('2201004', 'Premium LGT Due to Insurers', 'liability', NULL, 'Payables', true, true, 'Current Liabilities', 'credit', 'Local government (premium) tax billed on premium, collected for the insurers'),
 ('2201005', 'Premiums Payable to Reinsurers', 'liability', NULL, 'Payables', true, true, 'Current Liabilities', 'credit', 'Ceded premium net of reinsurance commission, due to reinsurers'),
 ('2203007', 'Incentives Payable – Producers', 'liability', NULL, 'Commission Payable', true, true, 'Current Liabilities', 'credit', 'Approved producer incentives not yet paid'),
 ('2205003', 'Claim Settlements Payable – Claimants', 'liability', NULL, 'Payables', true, true, 'Current Liabilities', 'credit', 'Claim settlements paid through the broker, due to claimants'),
 ('2205004', 'Claim Recoveries Payable – Cedants', 'liability', NULL, 'Payables', true, true, 'Current Liabilities', 'credit', 'Reinsurance claim recoveries due to cedants'),
 ('3201003', 'Reinsurance Commission and Brokerage Income', 'income', NULL, 'Commission', false, true, 'Revenue', 'credit', 'Commission on reinsurance placements'),
 ('4401020', 'Incentive Expense – Producers', 'expense', NULL, 'Commission', false, true, 'Cost of Services', 'debit', 'Sales incentives earned by agents and producers'),
 ('4409002', 'Remittance Adjustments', 'expense', NULL, 'Operating Expenses', false, true, 'Operating Expenses', 'debit', 'Credit / debit notes and other adjustments agreed with insurers on remittances')
ON CONFLICT (code) DO NOTHING;

-- Write-off reasons master (Master > Finance > Account Determination > Write-off reasons)
INSERT INTO write_off_reasons(code, name, gl_account, max_amount, description, created_by) VALUES
 ('BAD_DEBT', 'Uncollectible premium (bad debt)', '4401009', NULL, 'Premium receivable judged uncollectible', 'system'),
 ('SMALL_BALANCE', 'Small balance difference', '4409001', 100, 'Residual differences on collections (rounding, bank charges)', 'system'),
 ('SMALL_CREDIT', 'Small credit balance taken to income', '3302001', 100, 'Residual overpayments not refunded', 'system'),
 ('FX_DIFFERENCE', 'Foreign exchange difference', '4501002', NULL, 'Exchange differences on foreign-currency collections', 'system')
ON CONFLICT (code) DO NOTHING;
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ('write-off-reason', 'Write-off Reason', 'finance', '/master/finance/account-determination', 'table', 'write_off_reasons', 'code', 'name',
  '[{"name":"code","label":"Reason Code","type":"string","required":true,"column":"code"},{"name":"name","label":"Reason","type":"string","required":true,"column":"name"},{"name":"glAccount","label":"GL Account","type":"string","required":true,"column":"gl_account"},{"name":"maxAmount","label":"Maximum Amount","type":"number","required":false,"column":"max_amount"},{"name":"description","label":"Description","type":"text","required":false,"column":"description"}]',
  '[["code"]]', false, 240, true, 'system')
ON CONFLICT (code) DO NOTHING;

-- Bank accounts carry the GL account their receipts and payments post to
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ('bank-account', 'Bank Account', 'finance', '/master/finance/bankaccount', 'generic', NULL, 'accountCode', 'accountName',
  '[{"name":"accountCode","label":"Account Code","type":"string","required":true},{"name":"accountName","label":"Account Name","type":"string","required":true},{"name":"bankCode","label":"Bank Code","type":"string","required":true,"optionsFrom":"bank"},{"name":"bankName","label":"Bank Name","type":"string","required":false},{"name":"accountNumber","label":"Account Number","type":"string","required":true},{"name":"accountType","label":"Account Type","type":"select","required":true,"options":["Current Account","Savings Account","Time Deposit","Trust Account"]},{"name":"currency","label":"Currency","type":"string","required":true,"optionsFrom":"currency"},{"name":"glAccount","label":"GL Account","type":"string","required":false},{"name":"branch","label":"Branch","type":"string","required":false},{"name":"branchCode","label":"Branch Code","type":"string","required":false},{"name":"swiftCode","label":"SWIFT Code","type":"string","required":false},{"name":"openingDate","label":"Opening Date","type":"date","required":false},{"name":"contactPerson","label":"Contact Person","type":"string","required":false},{"name":"contactNumber","label":"Contact Number","type":"string","required":false},{"name":"email","label":"E-mail","type":"email","required":false}]',
  '[["accountCode"]]', false, 235, true, 'seed')
ON CONFLICT (code) DO UPDATE SET fields = CASE WHEN master_types.fields @> '[{"name":"glAccount"}]' THEN master_types.fields ELSE master_types.fields || '[{"name":"glAccount","label":"GL Account","type":"string","required":false}]'::jsonb END;
UPDATE master_records SET data = data || jsonb_build_object('glAccount', CASE WHEN data->>'accountType' = 'Trust Account' THEN '1102003' ELSE '1102001' END)
  WHERE type_code = 'bank-account' AND NOT (data ? 'glAccount');

-- Initial posting rules
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('policy.issue.broker_billed', 1, 'Policy issued – broker billed', 'Premium billed to the client on a broker-billed policy: receivable at the gross, premium (and its taxes) due to each insurer, brokerage commission earned.', 'policies', 'NEW_BUSINESS', 'booking', 'Premium billed – {{policyNumber}} ({{billNumber}})', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'premium_receivable', NULL::text, 'gross', false, 'Premium receivable {{billNumber}}'),
  (2, 'Cr', 'role', 'due_to_insurer', NULL::text, 'due_to_insurer', true, 'Premium due to {{insurer}}'),
  (3, 'Cr', 'role', 'premium_vat_payable', NULL::text, 'vat', true, 'VAT on premium due to {{insurer}}'),
  (4, 'Cr', 'role', 'premium_dst_payable', NULL::text, 'dst', true, 'DST on premium due to {{insurer}}'),
  (5, 'Cr', 'role', 'premium_lgt_payable', NULL::text, 'lgt', true, 'LGT on premium due to {{insurer}}'),
  (6, 'Cr', 'role', 'commission_income', NULL::text, 'commission', true, 'Brokerage commission{{participantSuffix}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('endorsement.additional_premium', 1, 'Endorsement – additional premium', 'Additional premium of an endorsement billed to the client.', 'policies', 'ENDORSEMENT', 'booking', 'Premium billed – {{policyNumber}} ({{billNumber}})', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'premium_receivable', NULL::text, 'gross', false, 'Premium receivable {{billNumber}}'),
  (2, 'Cr', 'role', 'due_to_insurer', NULL::text, 'due_to_insurer', true, 'Premium due to {{insurer}}'),
  (3, 'Cr', 'role', 'premium_vat_payable', NULL::text, 'vat', true, 'VAT on premium due to {{insurer}}'),
  (4, 'Cr', 'role', 'premium_dst_payable', NULL::text, 'dst', true, 'DST on premium due to {{insurer}}'),
  (5, 'Cr', 'role', 'premium_lgt_payable', NULL::text, 'lgt', true, 'LGT on premium due to {{insurer}}'),
  (6, 'Cr', 'role', 'commission_income', NULL::text, 'commission', true, 'Brokerage commission{{participantSuffix}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('policy.renewal.broker_billed', 1, 'Renewal – broker billed', 'Renewal premium billed to the client.', 'policies', 'RENEWAL', 'booking', 'Premium billed – {{policyNumber}} ({{billNumber}})', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'premium_receivable', NULL::text, 'gross', false, 'Premium receivable {{billNumber}}'),
  (2, 'Cr', 'role', 'due_to_insurer', NULL::text, 'due_to_insurer', true, 'Premium due to {{insurer}}'),
  (3, 'Cr', 'role', 'premium_vat_payable', NULL::text, 'vat', true, 'VAT on premium due to {{insurer}}'),
  (4, 'Cr', 'role', 'premium_dst_payable', NULL::text, 'dst', true, 'DST on premium due to {{insurer}}'),
  (5, 'Cr', 'role', 'premium_lgt_payable', NULL::text, 'lgt', true, 'LGT on premium due to {{insurer}}'),
  (6, 'Cr', 'role', 'commission_income', NULL::text, 'commission', true, 'Brokerage commission{{participantSuffix}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('endorsement.return_premium', 1, 'Endorsement – return premium', 'Return premium on a broker-billed policy: the insurer and commission shares are reversed; the open bill is credited and any premium already paid becomes a client refund payable.', 'endorsements', 'ENDORSEMENT_NEGATIVE', 'booking', 'Return premium – {{policyNumber}} ({{reference}})', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'due_to_insurer', NULL::text, 'due_to_insurer', true, 'Return premium – {{insurer}}'),
  (2, 'Dr', 'role', 'premium_vat_payable', NULL::text, 'vat', true, 'VAT on return premium – {{insurer}}'),
  (3, 'Dr', 'role', 'premium_dst_payable', NULL::text, 'dst', true, 'DST on return premium – {{insurer}}'),
  (4, 'Dr', 'role', 'premium_lgt_payable', NULL::text, 'lgt', true, 'LGT on return premium – {{insurer}}'),
  (5, 'Dr', 'role', 'commission_income', NULL::text, 'commission', true, 'Commission returned{{participantSuffix}}'),
  (6, 'Cr', 'role', 'premium_receivable', NULL::text, 'receivable_credit', false, 'Credited to {{billNumber}}'),
  (7, 'Cr', 'role', 'client_refund_payable', NULL::text, 'refund', false, 'Refund due to {{clientName}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('policy.cancel', 1, 'Policy cancellation', 'Cancellation of a broker-billed policy: the return (or the still-open) premium is reversed against the bill, the insurers and the commission; premium already paid becomes a client refund payable.', 'endorsements', 'CANCELLATION', 'booking', 'Policy cancelled – {{policyNumber}} ({{reference}})', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'due_to_insurer', NULL::text, 'due_to_insurer', true, 'Return premium – {{insurer}}'),
  (2, 'Dr', 'role', 'premium_vat_payable', NULL::text, 'vat', true, 'VAT on return premium – {{insurer}}'),
  (3, 'Dr', 'role', 'premium_dst_payable', NULL::text, 'dst', true, 'DST on return premium – {{insurer}}'),
  (4, 'Dr', 'role', 'premium_lgt_payable', NULL::text, 'lgt', true, 'LGT on return premium – {{insurer}}'),
  (5, 'Dr', 'role', 'commission_income', NULL::text, 'commission', true, 'Commission returned{{participantSuffix}}'),
  (6, 'Cr', 'role', 'premium_receivable', NULL::text, 'receivable_credit', false, 'Credited to {{billNumber}}'),
  (7, 'Cr', 'role', 'client_refund_payable', NULL::text, 'refund', false, 'Refund due to {{clientName}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('receipt.apply', 1, 'Premium collection applied', 'Cash received from the client applied to a bill: the chosen bank account (or the payment-mode cash account) against the premium receivable.', 'receipts', 'PAYMENT_RECEIPT', 'receipt', 'Premium collected – {{policyNumber}}{{receiptSuffix}}', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'bank_account', NULL::text, 'amount', false, '{{memoRef}}'),
  (2, 'Cr', 'role', 'premium_receivable', NULL::text, 'amount', false, 'Settles {{billNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('directbill.commission', 1, 'Direct bill – commission booked', 'Commission (and output VAT) due from the insurer on a direct-bill policy.', 'remittance', 'DIRECT_BILLED', 'booking', 'Direct-bill commission – {{policyNumber}}{{referenceSuffix}} – {{insurer}}', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'commission_receivable', NULL::text, 'amount', false, 'Commission due from {{insurer}}'),
  (2, 'Cr', 'role', 'commission_income', NULL::text, 'commission', false, 'Brokerage commission (direct bill)'),
  (3, 'Cr', 'role', 'output_vat', NULL::text, 'vat', false, 'Output VAT on commission')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('directbill.commission_return', 1, 'Direct bill – commission returned', 'Return premium on a direct-bill policy: the commission and VAT due from the insurer are reversed.', 'remittance', 'DIRECT_BILLED', 'booking', 'Direct-bill commission returned – {{policyNumber}}{{referenceSuffix}} – {{insurer}}', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'commission_income', NULL::text, 'commission', false, 'Brokerage commission (direct bill)'),
  (2, 'Dr', 'role', 'output_vat', NULL::text, 'vat', false, 'Output VAT on commission'),
  (3, 'Cr', 'role', 'commission_receivable', NULL::text, 'amount', false, 'Commission due from {{insurer}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('directbill.collection', 1, 'Direct bill – commission collected', 'Payment from the insurer against a commission debit note, with the EWT it withheld (BIR 2307).', 'remittance', 'DIRECT_BILL_COLLECTION', 'receipt', 'Commission collected – {{dnNumber}} – {{insurer}}{{referenceSuffix}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'bank_account', NULL::text, 'cash', false, '{{memoRef}}'),
  (2, 'Dr', 'role', 'creditable_wht', NULL::text, 'ewt', false, 'EWT withheld by {{insurer}}{{form2307Suffix}}'),
  (3, 'Cr', 'role', 'commission_receivable', NULL::text, 'applied', false, 'Settles {{dnNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('commission.approve', 1, 'Comsub approved', 'Commission shared with an agent / referrer accrued on approval.', 'commission', 'COMMISSION_ACCRUAL', 'commission', 'Comsub approved – {{referrerName}} – {{policyNumber}}', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'commission_expense', NULL::text, 'amount', false, 'Comsub expense'),
  (2, 'Cr', 'role', 'commission_payable', NULL::text, 'amount', false, 'Payable to {{referrerName}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('commission.payout', 1, 'Comsub paid', 'Payout of approved comsub lines: payable settled, cash net of withholding tax.', 'commission', 'COMMISSION_PAYMENT', 'disbursement', 'Comsub payout {{voucherNumber}} – {{payeeName}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'commission_payable', NULL::text, 'gross', false, 'Comsub payable settled'),
  (2, 'Cr', 'resolver', 'bank_account', NULL::text, 'net', false, 'Paid to {{payeeName}}'),
  (3, 'Cr', 'role', 'wht_payable', NULL::text, 'wht', false, 'Withholding tax on commission')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('commission.clawback', 1, 'Comsub clawback', 'Reversal of a paid comsub line: recoverable from the referrer.', 'commission', 'COMMISSION_CLAWBACK', 'commission', 'Comsub clawback – {{referrerName}} – {{policyNumber}}', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'agent_receivable', NULL::text, 'amount', false, 'Clawback receivable from referrer'),
  (2, 'Cr', 'role', 'commission_expense', NULL::text, 'amount', false, 'Comsub clawback')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('disbursement.payment', 1, 'Payment voucher paid (cheque approved)', 'Cheque / payment approval: the payable of the payee type settled from the chosen bank account (premium taxes due to insurers settled from their own accounts).', 'disbursements', 'REFUND', 'disbursement', 'Cheque {{instrumentNo}} – {{payeeName}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'payable_by_payee', NULL::text, 'payable', false, 'Payable settled ({{payeeType}})'),
  (2, 'Dr', 'role', 'premium_vat_payable', NULL::text, 'vat', false, 'VAT on premium remitted'),
  (3, 'Dr', 'role', 'premium_dst_payable', NULL::text, 'dst', false, 'DST on premium remitted'),
  (4, 'Dr', 'role', 'premium_lgt_payable', NULL::text, 'lgt', false, 'LGT on premium remitted'),
  (5, 'Cr', 'resolver', 'bank_account', NULL::text, 'amount', false, 'Cheque {{instrumentNo}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('pettycash.fund', 1, 'Petty cash fund established', 'Imprest fund set up from the bank.', 'payments', 'PETTY_CASH_FUND', 'petty-cash', 'Petty cash fund {{fundCode}} established', 'context', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'context', 'fund', 'petty_cash_fund', 'amount', false, 'Fund {{fundCode}}'),
  (2, 'Cr', 'resolver', 'bank_account', NULL::text, 'amount', false, 'Cheque to {{fundCode}} custodian')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('pettycash.disbursement', 1, 'Petty cash disbursement', 'Expense paid from a petty cash fund with input VAT and EWT.', 'payments', 'PETTY_CASH_DISBURSEMENT', 'petty-cash', 'Petty cash {{fundCode}}: {{purpose}}', 'context', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'context', 'expense', NULL::text, 'net_of_vat', false, '{{remarks}}'),
  (2, 'Dr', 'context', 'vat', 'input_vat', 'vat', false, 'Input VAT'),
  (3, 'Cr', 'context', 'fund', 'petty_cash_fund', 'net', false, 'Paid from {{fundCode}}'),
  (4, 'Cr', 'context', 'wht', 'wht_payable', 'wht', false, 'Expanded withholding tax')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('pettycash.receipt', 1, 'Petty cash returned', 'Unused cash returned to the fund.', 'payments', 'PETTY_CASH_RECEIPT', 'petty-cash', 'Cash returned to {{fundCode}}', 'context', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'context', 'fund', 'petty_cash_fund', 'amount', false, '{{remarks}}'),
  (2, 'Cr', 'context', 'credit', 'employee_advances', 'amount', false, '{{remarks}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('pettycash.replenishment', 1, 'Petty cash replenished', 'Fund topped up from the bank.', 'payments', 'PETTY_CASH_REPLENISHMENT', 'petty-cash', 'Replenishment of {{fundCode}}', 'context', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'context', 'fund', 'petty_cash_fund', 'amount', false, 'Replenishment'),
  (2, 'Cr', 'resolver', 'bank_account', NULL::text, 'amount', false, 'Cheque for {{fundCode}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('write_off', 1, 'Write-off of a debit balance', 'Residual debit balance of an open item (e.g. premium receivable) charged to the GL account of the write-off reason.', 'accounting', 'WRITE_OFF', 'write-off', 'Write-off {{reasonCode}} – {{accountCode}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'write_off_reason', 'write_off', 'amount', false, 'Write-off: {{reasonName}}'),
  (2, 'Cr', 'context', 'open_item', NULL::text, 'amount', false, 'Written off ({{reasonCode}})')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('write_off.credit_balance', 1, 'Write-off of a credit balance', 'Residual credit balance of an open item taken to the GL account of the write-off reason.', 'accounting', 'WRITE_OFF', 'write-off', 'Write-off {{reasonCode}} – {{accountCode}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'context', 'open_item', NULL::text, 'amount', false, 'Written off ({{reasonCode}})'),
  (2, 'Cr', 'resolver', 'write_off_reason', 'write_off', 'amount', false, 'Write-off: {{reasonName}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('claim.settlement.paid_through_broker', 1, 'Claim settled through the broker', 'Claim settlement paid through the broker: recoverable from each insurer (its share), payable to the claimant.', 'claims', 'CLAIM_SETTLEMENT', 'claims', 'Claim {{claimNumber}} settled through the broker – {{policyNumber}}', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'claims_receivable', NULL::text, 'amount', true, 'Claim {{claimNumber}} recoverable from {{insurer}}'),
  (2, 'Cr', 'role', 'claims_payable', NULL::text, 'amount', false, 'Claim {{claimNumber}} payable to {{claimant}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('claim.funds_received', 1, 'Claim funds received from insurer', 'Settlement money received from an insurer for a claim paid through the broker.', 'claims', 'CLAIM_SETTLEMENT', 'claims', 'Claim {{claimNumber}} funds received from {{insurer}}', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'bank_account', NULL::text, 'amount', false, '{{memoRef}}'),
  (2, 'Cr', 'role', 'claims_receivable', NULL::text, 'amount', false, 'Claim {{claimNumber}} recovered from {{insurer}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('claim.paid_to_claimant', 1, 'Claim paid to claimant', 'Settlement paid out to the claimant.', 'claims', 'CLAIM_SETTLEMENT', 'claims', 'Claim {{claimNumber}} paid to {{claimant}}', 'policy_owner', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'claims_payable', NULL::text, 'amount', false, 'Claim {{claimNumber}} payable settled'),
  (2, 'Cr', 'resolver', 'bank_account', NULL::text, 'amount', false, '{{memoRef}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('remittance.settlement', 1, 'Remittance settlement adjustments', 'Credit / debit notes and other adjustments agreed on an approved settlement with an insurer (the premium itself is paid by the insurer payment voucher).', 'remittance', 'REMITTANCE', 'remittance', 'Settlement {{reference}} – {{insurer}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'remittance_adjustment', NULL::text, 'adjustments', false, 'Settlement adjustments {{reference}}'),
  (2, 'Cr', 'resolver', 'payable_by_payee', NULL::text, 'adjustments', false, 'Adjustments payable to {{insurer}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('remittance.adjustment', 1, 'Remittance adjustment', 'Approved adjustment to an amount due to an insurer (a negative amount reverses the sides).', 'remittance', 'REMITTANCE', 'remittance', 'Adjustment {{reference}} – {{adjustmentType}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'remittance_adjustment', NULL::text, 'amount', false, '{{adjustmentType}}: {{reason}}'),
  (2, 'Cr', 'resolver', 'payable_by_payee', NULL::text, 'amount', false, 'Adjustment payable to {{insurer}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('remittance.transfer', 1, 'Remittance electronic transfer', 'Approved electronic transfer to an insurer: payable settled from the chosen bank account.', 'remittance', 'REMITTANCE', 'remittance', 'Transfer {{reference}} to {{beneficiary}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'resolver', 'payable_by_payee', NULL::text, 'amount', false, 'Remitted to {{beneficiary}}'),
  (2, 'Cr', 'resolver', 'bank_account', NULL::text, 'amount', false, '{{method}} {{reference}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('ri.cession', 1, 'Reinsurance cession confirmed', 'Ceded premium due from the cedant, net premium due to the reinsurer(s), reinsurance commission earned.', 'reinsurance', 'REINSURANCE', 'reinsurance', 'Cession {{cessionNumber}} – {{policyNumber}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'ri_premium_receivable', NULL::text, 'ceded_premium', false, 'Ceded premium {{cessionNumber}}'),
  (2, 'Cr', 'role', 'due_to_reinsurer', NULL::text, 'net_premium', false, 'Due to {{reinsurer}}'),
  (3, 'Cr', 'role', 'ri_commission_income', NULL::text, 'commission', false, 'Reinsurance commission {{cessionNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('ri.recovery', 1, 'Reinsurance recovery settled', 'Claim recovery agreed with the reinsurer: due from the reinsurer, payable to the cedant.', 'reinsurance', 'REINSURANCE', 'reinsurance', 'Recovery {{recoveryNumber}} – claim {{claimNumber}}', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'due_from_reinsurer', NULL::text, 'amount', false, 'Recovery {{recoveryNumber}} due from reinsurer'),
  (2, 'Cr', 'role', 'ri_recovery_payable', NULL::text, 'amount', false, 'Recovery {{recoveryNumber}} payable to cedant')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('incentive.accrual', 1, 'Incentives approved', 'Producer incentives of an approved calculation batch accrued.', 'incentive', 'INCENTIVE_ACCRUAL', 'incentive', 'Incentives {{batchId}} ({{period}}) approved', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'incentive_expense', NULL::text, 'amount', false, 'Incentives {{batchId}}'),
  (2, 'Cr', 'role', 'incentive_payable', NULL::text, 'amount', false, 'Incentives payable {{batchId}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  VALUES ('incentive.payout', 1, 'Incentives paid', 'Payment of an approved incentive batch.', 'incentive', 'INCENTIVE_PAYMENT', 'incentive', 'Incentives {{batchId}} ({{period}}) paid', 'user', 'Initial rule', 'system', 'system') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'incentive_payable', NULL::text, 'amount', false, 'Incentives {{batchId}} settled'),
  (2, 'Cr', 'resolver', 'bank_account', NULL::text, 'amount', false, '{{memoRef}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
