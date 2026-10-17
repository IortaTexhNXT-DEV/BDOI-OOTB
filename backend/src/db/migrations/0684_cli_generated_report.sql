-- CLI Generated Report (TIS-BRD-RPT-OPS-01, CR-14; gap register GAP-PLAT-28): the Credit Life certificates of cover
-- generated from the financing bank's batches (migration 0680), with the TFS 10-digit loan account, in Reports >
-- Operational Reports > CLI Generated Report. The loan account of a batch member follows credit_life.loan_account_pattern
-- (the TFS 10-digit loan number by default). Idempotent.

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('credit_life.loan_account_pattern', '"^[0-9]{10}$"', 'credit_life', 'Format of the loan account of a Credit Life member (regular expression; delivered: the TFS 10-digit loan number)', 'string', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO report_definitions(code, name, category, description, screen, parameters, query_name, default_columns, roles, permission, sort_order) VALUES
 ('cli-generated', 'CLI Generated Report', 'operational',
  'Credit Life certificates of cover generated from the financing bank''s batches, with the TFS 10-digit loan account, the borrower, the cover, the sum insured and premium.',
  'Reports > Operational Reports > CLI Generated Report',
  '{"type": "object", "required": ["ReportCriteria"], "properties": {"FromDate": {"type": "string", "title": "From Date", "format": "date"}, "ToDate": {"type": "string", "title": "To Date", "format": "date"}, "ReportCriteria": {"enum": ["All", "In force", "Cancelled"], "type": "string", "title": "Report Criteria", "default": "All"}, "Company": {"type": "string", "title": "Company (insurer)", "x-options": "insurance_companies", "description": "id, code or name"}, "Product": {"type": "string", "title": "Product", "x-options": "products", "description": "id, code or name"}, "format": {"enum": ["csv", "xlsx", "pdf"], "type": "string", "title": "File format (generate only)", "default": "xlsx"}, "period": {"enum": ["today", "yesterday", "last-7-days", "last-30-days", "month-to-date", "previous-month", "year-to-date"], "type": "string", "title": "Relative period (schedules; used when no dates are given)"}}}',
  'cliGenerated',
  '[{"key":"batchNumber","type":"text","label":"Batch"},{"key":"certificateNumber","type":"text","label":"Certificate No."},{"key":"masterPolicy","type":"text","label":"Master Policy"},{"key":"customerNo","type":"text","label":"Customer No."},{"key":"borrower","type":"text","label":"Borrower"},{"key":"birthDate","type":"date","label":"Birth Date"},{"key":"loanAccount","type":"text","label":"TFS Loan No."},{"key":"loanAmount","type":"money","label":"Amount Financed"},{"key":"loanTermMonths","type":"integer","label":"Term (months)","total":false},{"key":"coverFrom","type":"date","label":"Cover From"},{"key":"coverTo","type":"date","label":"Cover To"},{"key":"sumInsured","type":"money","label":"Sum Insured"},{"key":"premium","type":"money","label":"Premium"},{"key":"insurer","type":"text","label":"Insurer"},{"key":"status","type":"text","label":"Status"},{"key":"issuedOn","type":"date","label":"Issued"},{"key":"emailed","type":"text","label":"E-mailed"}]',
  '{sales,processing,operations,accounting}', 'read:reports', 274)
ON CONFLICT (code) DO NOTHING;
