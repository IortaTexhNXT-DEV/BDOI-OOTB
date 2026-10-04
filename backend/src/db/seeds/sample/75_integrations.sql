-- Demo data of the integrations (sample): COC series of two insurers, bank accounts of insurer payees and an API
-- mapping for Malayan on the test-mode insurer connector. The purge script empties these tables
-- (PURGE_DEMO_CONFIG_TABLES). Idempotent.

INSERT INTO coc_series(insurance_company_id, branch_code, prefix, series_from, series_to, next_number, number_width, received_date, remarks, created_by)
SELECT ic.id, NULL, v.prefix, v.f, v.t, v.f, 8, DATE '2026-09-01', 'Demo series', 'seed'
FROM (VALUES ('MALAYAN', 'MIC', 10000, 10499), ('PIONEER', 'PIS', 20000, 20249)) AS v(code, prefix, f, t)
JOIN insurance_companies ic ON ic.code = v.code
WHERE NOT EXISTS (SELECT 1 FROM coc_series s WHERE s.insurance_company_id = ic.id AND s.prefix = v.prefix);

INSERT INTO payee_bank_accounts(payee_type, payee_id, payee_name, bank_code, account_number, account_name, account_type, is_default, email, created_by)
SELECT 'Insurer', ic.id::text, ic.name, v.bank, v.acct, ic.name, 'current', true, v.email, 'seed'
FROM (VALUES ('MALAYAN', 'MBT', '0071-2345-67', 'remittance@malayan.example'), ('PIONEER', 'BPI', '3081-9988-01', 'remittance@pioneer.example'),
  ('MAPFRE', 'BDO', '0045-6677-889', 'remittance@mapfre.example')) AS v(code, bank, acct, email)
JOIN insurance_companies ic ON ic.code = v.code
WHERE NOT EXISTS (SELECT 1 FROM payee_bank_accounts a WHERE a.payee_type = 'Insurer' AND a.payee_id = ic.id::text);

INSERT INTO insurer_api_mappings(insurance_company_id, connector_code, enabled, broker_code, auto_issue_request, product_map, response_map, claim_status_map, remarks, created_by)
SELECT ic.id, 'INSURER_API', true, 'BRK-DEMO-001', false, $j${"MOTOR":"PC","Motor":"PC","FIRE":"FI","Fire":"FI"}$j$,
  $j${"policyNumber":"policyNumber","status":"status","premium":"premium","remarks":"remarks"}$j$,
  $j${"UNDER EVALUATION":"In review","FOR APPROVAL":"Pending approval","APPROVED":"Approved","PAID":"Settled","DENIED":"Rejected"}$j$, 'Demo mapping on the test-mode connector', 'seed'
FROM insurance_companies ic WHERE ic.code = 'MALAYAN'
ON CONFLICT (insurance_company_id) DO NOTHING;
