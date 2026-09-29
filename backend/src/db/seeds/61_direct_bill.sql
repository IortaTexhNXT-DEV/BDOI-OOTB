-- Direct bill and chart of accounts: Configuration screen group label, the direct-bill commission receivable
-- report and the new report columns (billing mode, account type / statement group). Idempotent; admin edits are kept.
UPDATE app_settings SET value = value || '{"direct_bill":"Direct bill (commission debit notes)"}'::jsonb
 WHERE key = 'system.group_labels' AND jsonb_typeof(value) = 'object' AND NOT value ? 'direct_bill';

INSERT INTO report_definitions(code, name, category, description, screen, query_name, parameters, default_columns, roles, sort_order) VALUES
 ('direct-bill-commission', 'Commission Receivable – Direct Bill', 'financial',
  'Commission (with VAT) due from insurers on direct-bill policies, where the client pays the insurer: unbilled, on a debit note, partially collected or collected, with the outstanding share and ageing as of To Date (buckets from limits.receivable_ageing_buckets).',
  'Accounts > Remittance > Direct Bill Processing', 'directBillCommission',
  '{"type":"object","required":["ReportCriteria"],"properties":{"ReportCriteria":{"type":"string","title":"Report Criteria","enum":["Ageing Bucket","Principle Insurance","Outstanding","Overall"],"default":"Ageing Bucket"},"FromDate":{"type":"string","format":"date","title":"From Date"},"ToDate":{"type":"string","format":"date","title":"To Date"},"Company":{"type":"string","title":"Company (principal insurer)","description":"id, code or name","x-options":"insurance_companies"},"Agent":{"type":"string","title":"Agent","description":"id, code or name","x-options":"users"},"Branch":{"type":"string","title":"Branch","description":"id, code or name","x-options":"branches"},"Product":{"type":"string","title":"Product","description":"id, code or name","x-options":"products"},"format":{"type":"string","enum":["csv","xlsx","pdf"],"default":"xlsx","title":"File format (generate only)"},"period":{"type":"string","enum":["today","yesterday","last-7-days","last-30-days","month-to-date","previous-month","year-to-date"],"title":"Relative period (schedules; used when no dates are given)"}}}'::jsonb,
  '[{"key":"insurer","label":"Insurer","type":"text"},{"key":"policyNumber","label":"Policy No.","type":"text"},{"key":"reference","label":"Reference","type":"text"},{"key":"client","label":"Insured","type":"text"},{"key":"product","label":"Product","type":"text"},{"key":"bookedOn","label":"Booked","type":"date"},{"key":"debitNoteNo","label":"Debit Note","type":"text"},{"key":"dueDate","label":"Due Date","type":"date"},{"key":"grossPremium","label":"Gross Premium","type":"money"},{"key":"commission","label":"Commission","type":"money"},{"key":"vat","label":"VAT","type":"money"},{"key":"totalDue","label":"Total Due","type":"money"},{"key":"balance","label":"Outstanding","type":"money"},{"key":"ageDays","label":"Age (days)","type":"integer","total":false},{"key":"ageBucket","label":"Ageing","type":"text"},{"key":"status","label":"Status","type":"text"}]'::jsonb,
  ARRAY['accounting']::text[], 135)
ON CONFLICT (code) DO NOTHING;

-- Billing mode on the production register and the broker commission statement
UPDATE report_definitions SET default_columns = default_columns || '[{"key":"billingMode","label":"Billing Mode","type":"text"}]'::jsonb, updated_at = now()
 WHERE code IN ('production-register', 'commission-statement') AND NOT default_columns @> '[{"key":"billingMode"}]'::jsonb;
UPDATE report_definitions SET parameters = jsonb_set(parameters, '{properties,ReportCriteria,enum}', (parameters #> '{properties,ReportCriteria,enum}') || '["Billing Mode"]'::jsonb), updated_at = now()
 WHERE code = 'production-register' AND NOT (parameters #> '{properties,ReportCriteria,enum}') @> '["Billing Mode"]'::jsonb;

-- Trial balance grouped by account type and statement group (chart of accounts)
UPDATE report_definitions SET default_columns = '[{"key":"accountType","label":"Type","type":"text"},{"key":"fsGroup","label":"Statement Group","type":"text"}]'::jsonb || default_columns, updated_at = now()
 WHERE code = 'trial-balance' AND NOT default_columns @> '[{"key":"fsGroup"}]'::jsonb;
