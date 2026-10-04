-- Chart of accounts mirror: the Main Account / Sub Account masters used by the remittance, transaction-code and
-- account-setup lookups list the GL chart (accounts without a parent are main accounts, with a parent sub accounts; see
-- 40_finance.sql). Former sample master codes that are not GL accounts are retired. Idempotent.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'main-account', a.code, a.name, jsonb_build_object('mainAccountCode', a.code, 'mainAccountName', a.name, 'description', COALESCE(a.description, a.name),
    'accountCategoryCode', CASE a.account_type WHEN 'asset' THEN 'AC-ASSET' WHEN 'liability' THEN 'AC-LIAB' WHEN 'equity' THEN 'AC-EQTY' WHEN 'income' THEN 'AC-INC' ELSE 'AC-EXP' END,
    'accountType', initcap(a.account_type), 'openEntry', CASE WHEN a.is_open_item THEN 'Yes' ELSE 'No' END, 'openEntryType', COALESCE(a.category, ''), 'fsGroup', a.fs_group),
  a.status, 'gl-sync'
FROM gl_accounts a WHERE a.parent_code IS NULL
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'main-account' AND lower(m.code) = lower(a.code) AND m.status <> 'deleted');
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'sub-account', a.code, a.name, jsonb_build_object('subAccountCode', a.code, 'subAccountName', a.name, 'description', COALESCE(a.description, a.name), 'mainAccount', a.parent_code),
  a.status, 'gl-sync'
FROM gl_accounts a WHERE a.parent_code IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'sub-account' AND lower(m.code) = lower(a.code) AND m.status <> 'deleted');
UPDATE master_records m SET status = 'inactive', updated_at = now()
  WHERE m.type_code IN ('main-account', 'sub-account') AND m.created_by = 'seed' AND m.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM gl_accounts a WHERE a.code = m.code);
