-- One place per value: master types that duplicate another screen, or that nothing reads, are retired. A retired type
-- has no screen and is inactive; its records are kept for reference (inactive) and the API refuses changes to them
-- (masters RETIRED_TYPES). Where each value lives now:
--   remittance-approval-workflow    Master > User Management > Authority Matrix (remittance limits, migration 0240)
--   remittance-reconciliation-rule  Master > Configuration, remittance.reconciliation_tolerance
--   remittance-electronic-transfer  Master > Configuration, remittance.transfer_methods
--   remittance-history-config       nothing read it (Accounts > Remittance > History lists the audit trail)
--   remittance-analytics-config     Master > Configuration, remittance.kpi_targets
--   remittance-direct-bill          Master > Configuration, direct_bill.*
--   remittance-report-template      Reports > Remittance summary (the orphan Remittance > Reports screen is removed)
--   commission                      Master > Finance > Commission Rate Matrix (the only source pricing reads)
--   employee                        Master > User Management > User (users is the staff register)
--   petty-cash                      Accounts > Petty Cash > Initiate (petty_cash_funds, the live fund; Initiate issues the code)
UPDATE master_types SET status = 'inactive', screen = NULL, updated_at = now()
WHERE code IN ('remittance-approval-workflow', 'remittance-reconciliation-rule', 'remittance-electronic-transfer', 'remittance-history-config',
  'remittance-analytics-config', 'remittance-direct-bill', 'remittance-report-template', 'commission', 'employee', 'petty-cash');

UPDATE master_records SET status = 'inactive', updated_at = now()
WHERE status = 'active' AND type_code IN ('remittance-approval-workflow', 'remittance-reconciliation-rule', 'remittance-electronic-transfer', 'remittance-history-config',
  'remittance-analytics-config', 'remittance-direct-bill', 'remittance-report-template', 'commission', 'employee', 'petty-cash');

-- Petty cash master: a plain code list (code, name, branch). Fund size, available cash, minimum cash box and the
-- transaction limit belong to the fund established in Accounts > Petty Cash > Initiate.
UPDATE master_types SET updated_at = now(),
  fields = (SELECT COALESCE(jsonb_agg(f ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f, ord)
            WHERE f->>'name' NOT IN ('pettycashsize', 'avilabelcash', 'minicashbox', 'transactionlimit', 'custodian'))
WHERE code = 'petty-cash';
UPDATE master_records SET data = data - 'pettycashsize' - 'avilabelcash' - 'minicashbox' - 'transactionlimit' - 'custodian', updated_at = now()
WHERE type_code = 'petty-cash' AND (data ?| ARRAY['pettycashsize', 'avilabelcash', 'minicashbox', 'transactionlimit', 'custodian']);

UPDATE document_numbering SET description = 'Code of a petty cash fund (Accounts > Petty Cash > Initiate issues it when the code is left empty)'
WHERE code = 'petty_cash_fund';

-- Settlement parameters: approvalLevels was never read (approval limits are the Authority Matrix's).
UPDATE master_types SET updated_at = now(),
  fields = (SELECT COALESCE(jsonb_agg(f ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f, ord) WHERE f->>'name' <> 'approvalLevels')
WHERE code = 'remittance-settlement-parameter';
UPDATE master_records SET data = data - 'approvalLevels' - 'approvalLimits', updated_at = now()
WHERE type_code = 'remittance-settlement-parameter' AND (data ? 'approvalLevels' OR data ? 'approvalLimits');
UPDATE master_records SET data = jsonb_set(data, '{form}', (data->'form') - 'level1Limit' - 'level2Limit' - 'level3Limit'), updated_at = now()
WHERE type_code = 'remittance-settlement-parameter' AND jsonb_typeof(data->'form') = 'object';

-- Remittance schedules say what to remit (insurers, cut-off, frequency, next run date) and are edited only in
-- Accounts > Remittance > Scheduling. They have no timer of their own: the "Remittance schedules" job of Master >
-- Schedules (seeds/jobs.json, disabled until switched on) runs the due ones in the business time zone. The time of
-- day goes; the seeded EST time zone becomes the business time zone (general.timezone).
UPDATE master_types SET screen = '/finance/remittance/scheduling', updated_at = now(), allow_extra = true,
  fields = $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Name","type":"string","required":true},{"name":"insurers","label":"Insurers to remit","type":"multiselect","required":false,"optionsFrom":"insurance-company"},{"name":"cutOffDays","label":"Cut-off (days before the run date)","type":"integer","required":false,"min":0},{"name":"frequency","label":"Frequency","type":"select","required":true,"options":["Daily","Weekly","Monthly","Quarterly"]},{"name":"nextRun","label":"Next run date","type":"date","required":false},{"name":"linkedProcesses","label":"Automated remittance (when no insurers are named)","type":"multiselect","required":false,"optionsFrom":"remittance-automated"},{"name":"type","label":"Type","type":"string","required":false}]$j$::jsonb
WHERE code = 'remittance-schedule';
UPDATE master_records SET updated_at = now(),
  data = (data - 'time')
    || jsonb_build_object('timezone', COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'general.timezone'), 'Asia/Manila'))
    || CASE WHEN data->>'nextRun' ~ '^\d{4}-\d{2}-\d{2}' THEN jsonb_build_object('nextRun', left(data->>'nextRun', 10)) ELSE '{}'::jsonb END
WHERE type_code = 'remittance-schedule';
