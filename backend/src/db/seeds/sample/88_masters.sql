-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Demo master records: TIS employees in the TISPH departments, the operating bank account (Metrobank, on the cash in
-- bank account of the chart), petty cash funds, dated exchange rates and the commission rates of the panel insurers per
-- product, and demo contact details on banks, insurers, signatories and branches. Idempotent by code.
-- commission rates per insurer and product as the retired Commission master kept them (inactive, for reference: the
-- Commission Rate Matrix prices the commission)
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'commission', v.code, v.code, jsonb_build_object('commissionCode', v.code, 'desc', v.descr, 'insuranceCompany', ic.name, 'product', pr.name, 'selectCover', v.covers::jsonb,
  'maxRate', v.max_rate, 'selectAgent', '', 'effectiveFrom', '2026-04-01', 'effectiveTo', '2027-03-31',
  'sharing', '[{"level":"Agent","sharingRate":60},{"level":"Unit Manager","sharingRate":25},{"level":"Branch Manager","sharingRate":15}]'::jsonb), 'inactive', 'seed'
FROM (VALUES ('COM-MTR-PIO', 'Motor comprehensive - Pioneer', 'PIONEER', 'MOTOR', '["Own Damage","Theft","Acts of Nature"]', 22.5),
             ('COM-MTR-MAA', 'Motor comprehensive - Maagap', 'MAAGAP', 'MOTOR', '["Own Damage","Theft","Acts of Nature"]', 20),
             ('COM-MTR-STR', 'Motor comprehensive - Stronghold', 'STRONGHOLD', 'MOTOR', '["Own Damage","Theft","Acts of Nature"]', 20),
             ('COM-CTPL-MAA', 'CTPL - Maagap', 'MAAGAP', 'CTPL', '["Compulsory Third Party Liability"]', 10),
             ('COM-PA-AXA', 'Personal accident - AXA', 'AXA', 'PA', '["Accidental Death and Disablement"]', 30),
             ('COM-CL-AXA', 'Credit life - AXA', 'AXA', 'CL-COMP', '["Death"]', 15)) AS v(code, descr, insurer, product, covers, max_rate)
JOIN insurance_companies ic ON ic.code = v.insurer JOIN products pr ON pr.code = v.product
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'commission' AND m.code = v.code);

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'employee', v.code, v.fn, jsonb_build_object('employeeCode', v.code, 'firstName', v.fn, 'middleName', v.mn, 'lastName', v.ln, 'employeeType', v.etype, 'designation', v.des,
  'reportingTo', v.reports, 'branchCode', v.branch, 'departmentCode', v.dept, 'idProofType', v.idtype, 'idNumber', v.idno, 'addressLine1', v.addr, 'city', v.city, 'state', v.state,
  'country', 'Philippines', 'email', lower(v.fn || '.' || replace(v.ln, ' ', '')) || '@tisph.example.ph'), 'active', 'seed'
FROM (VALUES
 ('EMP-0001','Maria','Luisa','Santos','Permanent','Sales Unit Head','','HO','10','UMID','0111-2345678-9','25 Kalayaan Ave.','Makati','Metro Manila'),
 ('EMP-0002','Jose','Rizal','Mercado','Permanent','Operations Officer','EMP-0001','HO','20','PhilSys ID','1234-5678-9012-3456','8 Scout Tuason St.','Quezon City','Metro Manila'),
 ('EMP-0003','Andrea','Cruz','Villanueva','Permanent','Operations Associate (Claims)','EMP-0002','HO','20','Passport','P1234567A','14 Lawton Ave.','Taguig','Metro Manila'),
 ('EMP-0004','Ramon','Dizon','Aquino','Permanent','Finance Supervisor','','HO','30','TIN ID','123-456-789-000','3 Shaw Blvd.','Pasig','Metro Manila'),
 ('EMP-0005','Kristine','Lim','Tan','Contractual','Operations Associate','EMP-0002','CEB','20','SSS ID','34-5678901-2','5 Escario St.','Cebu City','Cebu'),
 ('EMP-0006','Paolo','Reyes','Garcia','Permanent','Sales Associate','EMP-0001','DAV','10','Driver''s License','N01-23-456789','9 Ponciano St.','Davao City','Davao del Sur'),
 ('EMP-0007','Liza','Ramos','Bautista','Probationary','Sales Associate','EMP-0001','HO','10','UMID','0111-9876543-2','40 Taft Ave.','Manila','Metro Manila'),
 ('EMP-0008','Carlo','Mendoza','Navarro','Permanent','Cash Control Officer','EMP-0004','HO','50','PhilSys ID','9876-5432-1098-7654','12 A. Mabini St.','Mandaluyong','Metro Manila')
) AS v(code, fn, mn, ln, etype, des, reports, branch, dept, idtype, idno, addr, city, state)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'employee' AND m.code = v.code);

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'exchange-rate', NULL, v.cur, jsonb_build_object('EffectiveFrom', '2026-09-01', 'EffectiveTo', '2026-09-30', 'CurrencyCode', v.cur, 'ToCurrencyCode', 'PHP', 'ExchangeRate', v.rate,
  'CurrencyDescription', v.cur, 'ToCurrencyDescription', 'Philippine Peso'), 'active', 'seed'
FROM (VALUES ('USD', 56.5), ('EUR', 61.2), ('SGD', 42.1), ('JPY', 0.378)) AS v(cur, rate)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'exchange-rate' AND m.name = v.cur AND m.data->>'EffectiveFrom' = '2026-09-01');

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'bank-account', 'ACC-MBT-001', 'Toyota Insurance Services - Operating Account',
  jsonb_build_object('accountCode', 'ACC-MBT-001', 'glAccount', COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'accounting.account.cash_in_bank'), '106010'),
    'accountName', 'Toyota Insurance Services - Operating Account', 'bankCode', 'MBT', 'bankName', 'Metrobank', 'accountNumber', '561-7-56100561', 'accountType', 'Current Account',
    'currency', 'PHP', 'branch', 'Bonifacio Global City', 'branchCode', 'BGC', 'openingDate', '2025-10-01', 'contactPerson', 'Relationship Manager', 'contactNumber', '+63 2 8870 0700'),
  'active', 'seed'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'bank-account' AND code = 'ACC-MBT-001');

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'petty-cash', v.code, v.name, jsonb_build_object('pettycashcode', v.code, 'pettycashname', v.name, 'branchCode', v.branch), 'inactive', 'seed'
FROM (VALUES ('PC-HO', 'Head Office Petty Cash', 'HO'), ('PC-CEB', 'Cebu Branch Petty Cash', 'CEB'), ('PC-DAV', 'Davao Branch Petty Cash', 'DAV')) AS v(code, name, branch)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'petty-cash' AND m.code = v.code);

UPDATE banks SET attrs = jsonb_build_object('bankBranch', 'Main Branch', 'City', 'Makati', 'state', 'Metro Manila', 'Country', 'Philippines', 'mobile', '+63 2 8888 0000', 'email', lower(code) || '@bank.example', 'AddressLine1', 'Ayala Avenue', 'category', 'Universal Bank') || attrs WHERE NOT attrs ? 'bankBranch';
UPDATE insurance_companies SET attrs = jsonb_build_object('insuranceCompanyDescription', name || ' - non-life insurer', 'city', 'Makati', 'state', 'Metro Manila', 'country', 'Philippines') || attrs,
  address = COALESCE(address, 'Ayala Avenue, Makati City'), contact_phone = COALESCE(contact_phone, '+63 2 8888 0000'),
  contact_email = COALESCE(contact_email, 'placement@' || lower(code) || '.example.ph')
WHERE status = 'active' AND NOT attrs ? 'city';
UPDATE signatories SET attrs = jsonb_build_object('signatoryCode', 'SIG-' || lpad(id::text, 3, '0'), 'signatoryDescription', COALESCE(designation, 'Authorised signatory')) || attrs WHERE NOT attrs ? 'signatoryCode';
UPDATE branches SET attrs = jsonb_build_object('CompanyName', 'Toyota Insurance Services Philippines Corporation', 'EmailID', lower(code) || '@tisph.example.ph', 'City', split_part(address, ' City', 1), 'State', CASE code WHEN 'CEB' THEN 'Cebu' WHEN 'DAV' THEN 'Davao del Sur' ELSE 'Metro Manila' END, 'Country', 'Philippines', 'PhoneNumber', '+63 2 8858 8800') || attrs WHERE NOT attrs ? 'CompanyName';
