-- IC annual statement and production report of an insurance broker (Compliance > Insurance Commission > IC Annual
-- Statement, IC Production Report).
--
-- ic_statement_lines: the lines of the balance sheet and income statement schedules of the IC annual statement and
-- the general ledger accounts that make each one. An account belongs to the line whose prefix matches it longest
-- (account_prefixes: account codes or the first digits of codes), so a general line such as "Other operating
-- expenses" (prefix 44) takes what the more specific lines do not. Accounts that match no line are listed on the
-- "Unmapped accounts" sheet of the workbook for the accountant. `confirm` is the note the broker's accountant must
-- confirm for the line before the statement is filed (shown on the "Accountant confirmation" sheet).
-- Delivered mapping: the delivered chart of accounts (56_chart_of_accounts_masters.sql); a broker with its own chart
-- changes the prefixes on the IC Annual Statement screen (Account mapping tab, write:compliance).

CREATE TABLE IF NOT EXISTS ic_statement_lines (
  id serial PRIMARY KEY,
  schedule text NOT NULL CHECK (schedule IN ('balance-sheet', 'income-statement')),
  code text NOT NULL UNIQUE,
  section text NOT NULL,
  label text NOT NULL,
  sort_order int NOT NULL,
  account_prefixes text[] NOT NULL DEFAULT '{}',
  confirm text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO ic_statement_lines(schedule, code, section, label, sort_order, account_prefixes, confirm) VALUES
 ('balance-sheet', 'BS-A01', 'Assets', 'Cash on hand and in banks (own funds)', 10, '{1101,1102001,1102002,1102004,1103}', NULL),
 ('balance-sheet', 'BS-A02', 'Assets', 'Cash in bank, premium trust (fiduciary) account', 20, '{1102003}', 'Confirm that the account holds only premiums collected for insurers and agrees with the bank confirmation'),
 ('balance-sheet', 'BS-A03', 'Assets', 'Short-term investments and time deposits', 30, '{1104}', NULL),
 ('balance-sheet', 'BS-A04', 'Assets', 'Premiums receivable, net of allowance for doubtful accounts', 40, '{1202}', 'Confirm the allowance for doubtful accounts against the ageing of premiums receivable'),
 ('balance-sheet', 'BS-A05', 'Assets', 'Commission receivable and due from insurers', 50, '{1203001,1203002,1203005}', NULL),
 ('balance-sheet', 'BS-A06', 'Assets', 'Due from reinsurers and ceding companies', 60, '{1203003,1203004}', NULL),
 ('balance-sheet', 'BS-A07', 'Assets', 'Advances to agents, employees and other receivables', 70, '{1204,1205}', NULL),
 ('balance-sheet', 'BS-A08', 'Assets', 'Input VAT, creditable withholding and prepaid income tax', 80, '{1301,1302}', NULL),
 ('balance-sheet', 'BS-A09', 'Assets', 'Prepayments and other current assets', 90, '{1303,1901}', 'Confirm that the suspense account is cleared or explained'),
 ('balance-sheet', 'BS-A10', 'Assets', 'Property and equipment, net of accumulated depreciation', 100, '{1401,1402}', NULL),
 ('balance-sheet', 'BS-A11', 'Assets', 'Intangible assets, net of accumulated amortisation', 110, '{1403}', NULL),
 ('balance-sheet', 'BS-A12', 'Assets', 'Other non-current assets', 120, '{15}', NULL),
 ('balance-sheet', 'BS-L01', 'Liabilities', 'Premiums payable to insurers (including taxes on premium)', 210, '{2201001,2201002,2201003,2201004}', 'Confirm against the statements of account of the insurers (Accounts > Insurer Reconciliation)'),
 ('balance-sheet', 'BS-L02', 'Liabilities', 'Premiums payable to reinsurers', 220, '{2201005}', NULL),
 ('balance-sheet', 'BS-L03', 'Liabilities', 'Clients'' deposits and unapplied collections', 230, '{2202}', NULL),
 ('balance-sheet', 'BS-L04', 'Liabilities', 'Commission payable', 240, '{2203}', NULL),
 ('balance-sheet', 'BS-L05', 'Liabilities', 'Taxes payable', 250, '{2204}', NULL),
 ('balance-sheet', 'BS-L06', 'Liabilities', 'Accounts payable and accrued expenses', 260, '{2205,2206,2207,2208}', NULL),
 ('balance-sheet', 'BS-L07', 'Liabilities', 'Unearned commission income', 270, '{2209}', NULL),
 ('balance-sheet', 'BS-L08', 'Liabilities', 'Retirement benefit obligation and other non-current liabilities', 280, '{23}', 'Confirm the retirement benefit obligation against the actuarial valuation'),
 ('balance-sheet', 'BS-E01', 'Equity', 'Capital stock', 310, '{5100001}', 'Confirm the paid-up capital against the SEC articles and the stock and transfer book'),
 ('balance-sheet', 'BS-E02', 'Equity', 'Additional paid-in capital', 320, '{5100002}', NULL),
 ('balance-sheet', 'BS-E03', 'Equity', 'Retained earnings', 330, '{5101,5102}', 'Confirm the opening retained earnings against the audited financial statements of the previous year'),
 ('income-statement', 'IS-R01', 'Revenue', 'Brokerage commission income', 410, '{3201001}', NULL),
 ('income-statement', 'IS-R02', 'Revenue', 'Contingent and profit commission income', 420, '{3201002}', NULL),
 ('income-statement', 'IS-R03', 'Revenue', 'Reinsurance commission and brokerage income', 430, '{3201003}', NULL),
 ('income-statement', 'IS-R04', 'Revenue', 'Service, consultancy and risk management fees', 440, '{3202}', NULL),
 ('income-statement', 'IS-R05', 'Revenue', 'Interest and other income', 450, '{33}', NULL),
 ('income-statement', 'IS-C01', 'Cost of services', 'Commission and incentives to agents and referrers', 510, '{4401010,4401020}', NULL),
 ('income-statement', 'IS-X01', 'Operating expenses', 'Salaries, wages and employee benefits', 610, '{4301}', NULL),
 ('income-statement', 'IS-X02', 'Operating expenses', 'Rent, occupancy and utilities', 620, '{4401005,4402}', NULL),
 ('income-statement', 'IS-X03', 'Operating expenses', 'Professional and audit fees', 630, '{4401003,4401006,4404}', NULL),
 ('income-statement', 'IS-X04', 'Operating expenses', 'Taxes and licences', 640, '{4405001}', NULL),
 ('income-statement', 'IS-X05', 'Operating expenses', 'Depreciation and amortisation', 650, '{4406}', NULL),
 ('income-statement', 'IS-X06', 'Operating expenses', 'Other operating expenses', 660, '{43,44}', NULL),
 ('income-statement', 'IS-X07', 'Other expenses', 'Interest, finance charges and foreign exchange losses', 670, '{45}', NULL),
 ('income-statement', 'IS-T01', 'Income tax', 'Provision for income tax', 710, '{46}', 'Confirm the provision for income tax against the annual income tax return')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('compliance.ic_statement_form', '"Annual Statement of an Insurance Broker (Insurance Commission form set in force for the reporting year)"', 'compliance',
  'Name and version of the IC annual statement form set the workbook follows (printed on its cover; update it when the IC issues a new form set)', 'string'),
 ('compliance.ic_lines_of_business', '["Fire", "Marine", "Motor Car", "Casualty", "Suretyship", "Engineering", "Accident and Health", "Others"]', 'compliance',
  'Lines of business of the IC production report and annual statement schedules, in the order of the columns', 'json'),
 ('compliance.ic_line_map', '{"fire": "Fire", "marine": "Marine", "motor": "Motor Car", "casualty": "Casualty", "surety": "Suretyship", "bond": "Suretyship", "engineering": "Engineering", "accident": "Accident and Health", "eb": "Accident and Health", "health": "Accident and Health"}', 'compliance',
  'IC line of business of each product line (products.line or the policy line of business, lower case); unmapped lines go to Others', 'json'),
 ('compliance.ic_minimum_net_worth', 'null', 'compliance', 'Minimum net worth the broker must keep under the IC rules that apply to it (shown against the equity on the balance sheet schedule; empty: not shown)', 'number')
ON CONFLICT (key) DO NOTHING;
