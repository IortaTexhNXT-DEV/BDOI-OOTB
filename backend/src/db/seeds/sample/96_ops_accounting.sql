-- Sample data for operations and accounting (fictional): the service centres of the Toyota dealers accredited as repair
-- shops by the panel insurers, and suppliers. Idempotent.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'repair-shop', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'address', v.address, 'city', v.city, 'contactPerson', v.contact,
  'phone', v.phone, 'email', v.email, 'accredited', true, 'accreditedInsurers', v.insurers, 'labourRatePerHour', v.rate), 'active', 'seed'
FROM (VALUES ('RS-001', 'Toyota Makati Service Center', 'Chino Roces Avenue', 'Makati', 'Service Advisor', '+63 2 8812 4420', 'service@toyotamakati.example.ph', 'Pioneer, Maagap, AXA, Stronghold', 850),
             ('RS-002', 'Toyota Quezon Avenue Service Center', 'Quezon Avenue', 'Quezon City', 'Service Manager', '+63 2 8712 3320', 'service@toyotaqave.example.ph', 'Pioneer, AXA, Malayan', 800),
             ('RS-003', 'Toyota Pasig Service Center', 'Ortigas Avenue Extension', 'Pasig', 'Body and Paint Supervisor', '+63 2 8655 2210', 'service@toyotapasig.example.ph', 'Maagap, Stronghold, Standard', 800),
             ('RS-004', 'Toyota Cebu Service Center', 'Archbishop Reyes Avenue', 'Cebu City', 'Service Advisor', '+63 32 412 7795', 'service@toyotacebu.example.ph', 'Pioneer, Stronghold', 750)) AS v(code, name, address, city, contact, phone, email, insurers, rate)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'repair-shop' AND lower(m.code) = lower(v.code));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'supplier', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'tin', v.tin, 'address', v.address, 'vatRegistered', v.vat, 'ewtCode', v.ewt,
  'paymentTermsDays', v.terms, 'expenseAccount', v.account, 'contactPerson', v.contact, 'email', v.email), 'active', 'seed'
FROM (VALUES ('SUP-001', 'Sample Office Supplies Trading', '999-000-001-000', '1 Sample Road, Pasig', true, 'WC158', 30, '640400', 'Account Officer', 'billing@sample-office.example.ph'),
             ('SUP-002', 'Demo IT Services Inc.', '999-000-002-000', '2 Demo Tower, Taguig', true, 'WC160', 15, '610300', 'Account Manager', 'ar@demo-it.example.ph'),
             ('SUP-003', 'Sample Property Leasing Corp.', '999-000-003-000', '3 Sample Plaza, Taguig', true, 'WC100', 5, '620000', 'Leasing Officer', 'leasing@sample-property.example.ph')) AS v(code, name, tin, address, vat, ewt, terms, account, contact, email)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'supplier' AND lower(m.code) = lower(v.code));
