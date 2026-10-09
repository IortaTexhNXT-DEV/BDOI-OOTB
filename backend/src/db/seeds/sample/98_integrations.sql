-- Demo data of the integrations (sample): CTPL certificate of cover (COC) series of three panel insurers, bank accounts of
-- the panel insurers as payees and an API mapping for Pioneer on the test-mode insurer connector. The purge script
-- empties these tables (PURGE_DEMO_CONFIG_TABLES). Idempotent.

INSERT INTO coc_series(insurance_company_id, branch_code, prefix, series_from, series_to, next_number, number_width, received_date, remarks, created_by)
SELECT ic.id, NULL, v.prefix, v.f, v.t, v.f, 8, current_date - 40, 'Demo series', 'seed'
FROM (VALUES ('PIONEER', 'PIO', 20000, 20499), ('MAAGAP', 'MAA', 30000, 30249), ('STRONGHOLD', 'STR', 40000, 40249)) AS v(code, prefix, f, t)
JOIN insurance_companies ic ON ic.code = v.code
WHERE NOT EXISTS (SELECT 1 FROM coc_series s WHERE s.insurance_company_id = ic.id AND s.prefix = v.prefix);

INSERT INTO payee_bank_accounts(payee_type, payee_id, payee_name, bank_code, account_number, account_name, account_type, is_default, email, created_by)
SELECT 'Insurer', ic.id::text, ic.name, v.bank, v.acct, ic.name, 'current', true, v.email, 'seed'
FROM (VALUES ('PIONEER', 'BPI', '3081-9988-01', 'remittance@pioneer.example.ph'), ('MAAGAP', 'MBT', '0071-5566-12', 'remittance@maagap.example.ph'),
  ('AXA', 'BDO', '0045-6677-889', 'remittance@axa.example.ph'), ('STRONGHOLD', 'MBT', '0071-2345-67', 'remittance@stronghold.example.ph')) AS v(code, bank, acct, email)
JOIN insurance_companies ic ON ic.code = v.code
WHERE NOT EXISTS (SELECT 1 FROM payee_bank_accounts a WHERE a.payee_type = 'Insurer' AND a.payee_id = ic.id::text);

INSERT INTO insurer_api_mappings(insurance_company_id, connector_code, enabled, broker_code, auto_issue_request, product_map, response_map, claim_status_map, remarks, created_by)
SELECT ic.id, 'INSURER_API', true, 'TIS-DEMO-001', false, $j${"MOTOR":"MC","Motor":"MC","CTPL":"CTPL","PA":"PA","Personal Accident":"PA"}$j$,
  $j${"policyNumber":"policyNumber","status":"status","premium":"premium","remarks":"remarks"}$j$,
  $j${"UNDER EVALUATION":"In review","FOR APPROVAL":"Pending approval","APPROVED":"Approved","PAID":"Settled","DENIED":"Rejected"}$j$, 'Demo mapping on the test-mode connector', 'seed'
FROM insurance_companies ic WHERE ic.code = 'PIONEER'
ON CONFLICT (insurance_company_id) DO NOTHING;
