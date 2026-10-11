-- TISPH configuration of the commission rules register, the sharing schemes and the commission controls (migrations
-- 0570 and 0571; TIS-BRD-PROD-16, COMM-02, COMM-05, COMM-06). Runs on a new database and on every start of one in
-- use, only where the TISPH roles exist. Idempotent: a setting is changed only while it still holds the reference
-- value and nobody has changed it, so administrator changes are kept.

-- Motor policies are booked on the per-peril rates of the register; rules and schemes are approved on Configuration
-- Approvals; a rate change, reversal or withholding tax change on a commission line waits for a second user; a
-- commission line becomes payable once the policy is fully paid and remitted to the insurer; a new payee or a change of
-- its payment details is verified by a second user (migration 0645, FGA EN-01).
UPDATE app_settings s
   SET value = v.value, updated_at = now()
  FROM (VALUES ('commission.peril_based_motor', 'false'::jsonb, 'true'::jsonb),
               ('commission.rules_approval_required', 'false'::jsonb, 'true'::jsonb),
               ('commission.adjustment_approval_required', 'false'::jsonb, 'true'::jsonb),
               ('commission.eligible_requires_remittance', 'false'::jsonb, 'true'::jsonb),
               ('commission.payee_verification_required', 'false'::jsonb, 'true'::jsonb)) AS v(key, reference, value)
 WHERE s.key = v.key AND s.updated_by IS NULL AND s.value = v.reference
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

-- The TISPH exception type of a policy booked without rates on the register (raised by the remittance runs)
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'remittance-exception', 'EXC-RATES', 'Rates missing',
       $j${"code":"EXC-RATES","name":"Rates missing","category":"Commission","severity":"Medium","autoResolve":false,"resolutionSteps":["Add the rates on Master > Finance > Commission Rate Matrix","Recompute the commission of the policy","Resolve the exception"],"notification":["system"],"sla":"2 days","glImpact":false}$j$::jsonb,
       'active', 'seed'
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'remittance-exception')
  AND NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'remittance-exception' AND code = 'EXC-RATES');

-- The TISPH commission report layouts (CR-13 sales, CR-14 operations; queries in src/modules/reports/tisphQueries.js)
INSERT INTO report_definitions(code, name, category, description, screen, query_name, parameters, default_columns, roles, permission, sort_order) VALUES
 -- CR-14 (TIS-BRD-RPT-OPS-07)
 ('tisph-commission-sharing', 'Agents/Dealers Commission Sharing', 'operational', 'The commission share of each agent, dealer and referrer on the policies of the period: total commission of the policy, sharing basis, shared amount, withholding tax, net to the payee, the balance TISPH keeps and the payment status.',
  'Reports > All Reports > Agents/Dealers Commission Sharing', 'commissionSharing',
  '{"type":"object","required":["ReportCriteria"],"properties":{"ReportCriteria":{"type":"string","title":"Report Criteria","enum":["Payee","Payee Type","Principal Insurer","Overall"],"default":"Payee"},"FromDate":{"type":"string","format":"date","title":"From Date"},"ToDate":{"type":"string","format":"date","title":"To Date"},"Agent":{"type":"string","title":"Payee","description":"id or name"},"Company":{"type":"string","title":"Company (principal insurer)","description":"id, code or name","x-options":"insurance_companies"},"Status":{"type":"string","title":"Status","enum":["Accrued","Eligible","Approved","Paid","Reversed"]},"format":{"type":"string","enum":["csv","xlsx","pdf"],"default":"xlsx","title":"File format (generate only)"},"period":{"type":"string","enum":["today","yesterday","last-7-days","last-30-days","month-to-date","previous-month","year-to-date"],"title":"Relative period (schedules; used when no dates are given)"}}}'::jsonb,
  '[{"key":"agent","label":"Payee","type":"text"},{"key":"payeeType","label":"Type","type":"text"},{"key":"policyNumber","label":"Policy No.","type":"text"},{"key":"client","label":"Client","type":"text"},{"key":"insurer","label":"Insurer","type":"text"},{"key":"product","label":"Product","type":"text"},{"key":"inceptionDate","label":"Inception","type":"date"},{"key":"netPremium","label":"Net Premium","type":"money"},{"key":"totalCommission","label":"Total Commission","type":"money"},{"key":"scheme","label":"Scheme","type":"text"},{"key":"sharing","label":"Sharing","type":"text"},{"key":"sharedAmount","label":"Shared Amount","type":"money"},{"key":"wht","label":"WHT","type":"money"},{"key":"netToPayee","label":"Net to Payee","type":"money"},{"key":"retainedBalance","label":"Retained Balance","type":"money"},{"key":"status","label":"Payment Status","type":"text"},{"key":"voucher","label":"Voucher","type":"text"},{"key":"paidDate","label":"Paid","type":"date"},{"key":"remittanceNumber","label":"Remittance No.","type":"text"}]'::jsonb,
  ARRAY['operations', 'accounting', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-ccd-pdu', 'tis-ccd-recon', 'tis-finance', 'tis-general-manager', 'tis-it-admin']::text[], 'read:reports', 780),
 -- CR-13 (TIS-BRD-RPT-SLS-03, FGA-SRPT-03)
 ('tisph-agent-conversion', 'Agent Policy Conversion', 'operational', 'The policies converted per agent per month with the number of accounts, the tier level, the total premium, the commission and the incentives.',
  'Reports > All Reports > Agent Policy Conversion', 'agentConversion',
  '{"type":"object","required":["ReportCriteria"],"properties":{"ReportCriteria":{"type":"string","title":"Report Criteria","enum":["Agent","Month"],"default":"Agent"},"FromDate":{"type":"string","format":"date","title":"From Date"},"ToDate":{"type":"string","format":"date","title":"To Date"},"Agent":{"type":"string","title":"Agent","description":"id or name"},"format":{"type":"string","enum":["csv","xlsx","pdf"],"default":"xlsx","title":"File format (generate only)"},"period":{"type":"string","enum":["today","yesterday","last-7-days","last-30-days","month-to-date","previous-month","year-to-date"],"title":"Relative period (schedules; used when no dates are given)"}}}'::jsonb,
  '[{"key":"agent","label":"Agent","type":"text"},{"key":"payeeType","label":"Type","type":"text"},{"key":"tierLevel","label":"Tier Level","type":"text"},{"key":"month","label":"Month","type":"text"},{"key":"accounts","label":"No. of Accounts","type":"number"},{"key":"premium","label":"Total Premium","type":"money"},{"key":"commission","label":"Commission","type":"money"},{"key":"incentives","label":"Incentives","type":"money"}]'::jsonb,
  ARRAY['sales', 'operations', 'accounting', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-finance', 'tis-general-manager', 'tis-it-admin']::text[], 'read:reports', 790)
ON CONFLICT (code) DO NOTHING;
