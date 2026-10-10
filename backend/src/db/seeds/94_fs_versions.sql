-- Financial statement versions of TISPH (FGA-DS-07): TIS01 local FS, TIS02 balance sheet / income statement and TIS03
-- budget, with GL ranges over the chart of accounts as loaded (proposal until Finance confirms the ranges, see the
-- decision register). A version is added once with its lines; once changed on the screen (updated_by set) its lines
-- are left as they are.

INSERT INTO fs_versions(code, name, purpose, scope, created_by) VALUES
 ('TIS01', 'TIS01 Local financial statements', 'Statutory financial statements by line item', 'full', 'seed'),
 ('TIS02', 'TIS02 Balance sheet and income statement', 'Management balance sheet and income statement by statement group', 'full', 'seed'),
 ('TIS03', 'TIS03 Budget', 'Income and expense lines compared with the budget', 'income', 'seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO fs_version_lines(version_code, line_no, statement, section, caption, gl_from, gl_to, normal_balance)
SELECT v.version_code, v.line_no, v.statement, v.section, v.caption, v.gl_from, v.gl_to, v.normal_balance
FROM (VALUES
  ('TIS01', 10, 'bs', 'Current Assets', 'Cash and cash equivalents', '100', '109', 'debit'),
  ('TIS01', 20, 'bs', 'Current Assets', 'Premiums and commissions receivable', '110', '112', 'debit'),
  ('TIS01', 25, 'bs', 'Current Assets', 'Other receivables', '113', '119', 'debit'),
  ('TIS01', 30, 'bs', 'Current Assets', 'Advances to agents, employees and suppliers', '120', '129', 'debit'),
  ('TIS01', 40, 'bs', 'Current Assets', 'Creditable withholding and input taxes', '130', '139', 'debit'),
  ('TIS01', 50, 'bs', 'Current Assets', 'Prepayments', '144', '149', 'debit'),
  ('TIS01', 55, 'bs', 'Current Assets', 'Short-term investments', '151', '159', 'debit'),
  ('TIS01', 60, 'bs', 'Current Assets', 'Deferred charges and suspense', '180', '199', 'debit'),
  ('TIS01', 70, 'bs', 'Non-current Assets', 'Intangible assets', '140', '143', 'debit'),
  ('TIS01', 80, 'bs', 'Non-current Assets', 'Security deposits', '150', '150', 'debit'),
  ('TIS01', 90, 'bs', 'Non-current Assets', 'Property and equipment', '160', '179', 'debit'),
  ('TIS01', 110, 'bs', 'Current Liabilities', 'Accounts payable and accrued expenses', '210', '229', 'credit'),
  ('TIS01', 120, 'bs', 'Current Liabilities', 'Taxes payable', '235', '239', 'credit'),
  ('TIS01', 130, 'bs', 'Current Liabilities', 'Accrued interest and other liabilities', '240', '249', 'credit'),
  ('TIS01', 140, 'bs', 'Current Liabilities', 'Loans payable', '250', '259', 'credit'),
  ('TIS01', 150, 'bs', 'Current Liabilities', 'Other current liabilities', '260', '299', 'credit'),
  ('TIS01', 160, 'bs', 'Non-current Liabilities', 'Retirement benefit obligation', '230', '234', 'credit'),
  ('TIS01', 210, 'bs', 'Equity', 'Capital stock', '300', '319', 'credit'),
  ('TIS01', 220, 'bs', 'Equity', 'Additional paid-in capital', '510', '519', 'credit'),
  ('TIS01', 230, 'bs', 'Equity', 'Retained earnings and reserves', '340', '399', 'credit'),
  ('TIS01', 310, 'is', 'Revenue', 'Commission income', '320', '329', 'credit'),
  ('TIS01', 315, 'is', 'Revenue', 'Commission income by line of insurance', '410', '429', 'credit'),
  ('TIS01', 320, 'is', 'Other Income', 'Other income', '330', '339', 'credit'),
  ('TIS01', 410, 'is', 'Cost of Services', 'Commission expense - agents and referrers', '440101', '440102', 'debit'),
  ('TIS01', 420, 'is', 'Cost of Services', 'Commission expense - callers', '630', '630', 'debit'),
  ('TIS01', 510, 'is', 'Operating Expenses', 'Personnel costs', '430', '439', 'debit'),
  ('TIS01', 520, 'is', 'Operating Expenses', 'Administrative expenses', '440', '449', 'debit'),
  ('TIS01', 530, 'is', 'Operating Expenses', 'Operating expenses', '600', '699', 'debit'),
  ('TIS01', 610, 'is', 'Other Expenses', 'Other expenses', '450', '459', 'debit'),
  ('TIS01', 710, 'is', 'Income Tax', 'Income tax and final tax', '460', '469', 'debit'),
  ('TIS02', 10, 'bs', 'Assets', 'Current assets', '100', '139', 'debit'),
  ('TIS02', 11, 'bs', 'Assets', 'Current assets', '144', '149', 'debit'),
  ('TIS02', 12, 'bs', 'Assets', 'Current assets', '151', '159', 'debit'),
  ('TIS02', 13, 'bs', 'Assets', 'Current assets', '180', '199', 'debit'),
  ('TIS02', 20, 'bs', 'Assets', 'Non-current assets', '140', '143', 'debit'),
  ('TIS02', 21, 'bs', 'Assets', 'Non-current assets', '150', '150', 'debit'),
  ('TIS02', 22, 'bs', 'Assets', 'Non-current assets', '160', '179', 'debit'),
  ('TIS02', 30, 'bs', 'Liabilities', 'Current liabilities', '210', '229', 'credit'),
  ('TIS02', 31, 'bs', 'Liabilities', 'Current liabilities', '235', '299', 'credit'),
  ('TIS02', 40, 'bs', 'Liabilities', 'Non-current liabilities', '230', '234', 'credit'),
  ('TIS02', 50, 'bs', 'Equity', 'Equity', '300', '319', 'credit'),
  ('TIS02', 51, 'bs', 'Equity', 'Equity', '340', '399', 'credit'),
  ('TIS02', 52, 'bs', 'Equity', 'Equity', '510', '519', 'credit'),
  ('TIS02', 60, 'is', 'Income', 'Revenue', '320', '329', 'credit'),
  ('TIS02', 61, 'is', 'Income', 'Revenue', '410', '429', 'credit'),
  ('TIS02', 70, 'is', 'Income', 'Other income', '330', '339', 'credit'),
  ('TIS02', 80, 'is', 'Expenses', 'Cost of services', '440101', '440102', 'debit'),
  ('TIS02', 81, 'is', 'Expenses', 'Cost of services', '630', '630', 'debit'),
  ('TIS02', 90, 'is', 'Expenses', 'Operating expenses', '430', '449', 'debit'),
  ('TIS02', 91, 'is', 'Expenses', 'Operating expenses', '600', '699', 'debit'),
  ('TIS02', 100, 'is', 'Expenses', 'Other expenses', '450', '459', 'debit'),
  ('TIS02', 110, 'is', 'Expenses', 'Income tax', '460', '469', 'debit'),
  ('TIS03', 10, 'is', 'Revenue', 'Commission income', '320', '329', 'credit'),
  ('TIS03', 11, 'is', 'Revenue', 'Commission income', '410', '429', 'credit'),
  ('TIS03', 20, 'is', 'Revenue', 'Other income', '330', '339', 'credit'),
  ('TIS03', 30, 'is', 'Expenses', 'Commission expense', '440101', '440102', 'debit'),
  ('TIS03', 31, 'is', 'Expenses', 'Commission expense', '630', '630', 'debit'),
  ('TIS03', 40, 'is', 'Expenses', 'Personnel costs', '430', '439', 'debit'),
  ('TIS03', 50, 'is', 'Expenses', 'Administrative and operating expenses', '440', '449', 'debit'),
  ('TIS03', 51, 'is', 'Expenses', 'Administrative and operating expenses', '600', '699', 'debit'),
  ('TIS03', 60, 'is', 'Expenses', 'Other expenses and taxes', '450', '469', 'debit')
) AS v(version_code, line_no, statement, section, caption, gl_from, gl_to, normal_balance)
WHERE EXISTS (SELECT 1 FROM fs_versions f WHERE f.code = v.version_code AND f.created_by = 'seed' AND f.updated_by IS NULL)
ON CONFLICT (version_code, line_no) DO NOTHING;
