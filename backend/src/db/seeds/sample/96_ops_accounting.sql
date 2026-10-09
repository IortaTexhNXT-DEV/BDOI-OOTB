-- Sample data for operations and accounting (fictional): accredited repair shops and suppliers. Idempotent.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'repair-shop', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'address', v.address, 'city', v.city, 'contactPerson', v.contact,
  'phone', v.phone, 'email', v.email, 'accredited', true, 'accreditedInsurers', 'Malayan, FPG, Pioneer', 'labourRatePerHour', v.rate), 'active', 'seed'
FROM (VALUES ('RS-001', 'Sample Auto Body Works', '123 Sample St., Barangay Uno', 'Quezon City', 'Sample Service Advisor', '+63 2 8000 0001', 'service@sample-autobody.example.ph', 650),
             ('RS-002', 'Demo Motors Service Center', '45 Demo Avenue', 'Makati', 'Demo Service Manager', '+63 2 8000 0002', 'service@demo-motors.example.ph', 800)) AS v(code, name, address, city, contact, phone, email, rate)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'repair-shop' AND lower(m.code) = lower(v.code));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'supplier', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'tin', v.tin, 'address', v.address, 'vatRegistered', v.vat, 'ewtCode', v.ewt,
  'paymentTermsDays', v.terms, 'expenseAccount', v.account, 'contactPerson', 'Sample Contact', 'email', v.email), 'active', 'seed'
FROM (VALUES ('SUP-001', 'Sample Office Supplies Trading', '999-000-001-000', '1 Sample Road, Pasig', true, 'WC158', 30, '4401008', 'billing@sample-office.example.ph'),
             ('SUP-002', 'Demo IT Services Inc.', '999-000-002-000', '2 Demo Tower, Taguig', true, 'WC160', 15, '4407002', 'ar@demo-it.example.ph'),
             ('SUP-003', 'Sample Property Leasing Corp.', '999-000-003-000', '3 Sample Plaza, Makati', true, 'WC100', 5, '4402001', 'leasing@sample-property.example.ph')) AS v(code, name, tin, address, vat, ewt, terms, account, email)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'supplier' AND lower(m.code) = lower(v.code));
