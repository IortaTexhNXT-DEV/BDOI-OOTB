-- Sample data of the TISPH sales features (fictional): the TFS account details of the TFS-sourced sample prospects, a
-- TFS import batch with two new accounts waiting for assignment, a direct customer, and the vehicles of the sample Motor
-- policies (read by the Talkbot call list and the APR Operation Report: Toyota new car, a Hino unit counted as OEM and
-- a repossessed unit counted as ROPA). Idempotent: rows are added once and a value is set only while it is empty.

-- The TFS accounts behind the sample prospects of the TFS channels (84_sales.sql)
UPDATE leads l SET customer_type = 'TFS', loan_id = v.loan, tfs_reference = v.ref, product_group = 'Motor',
       insurance_provider_id = (SELECT id FROM insurance_companies WHERE code = v.insurer), policy_expiry_date = v.expiry::date,
       loan_start_date = v.loan_start::date, loan_booking_date = v.loan_start::date - 5, loan_maturity_date = v.loan_start::date + 1825, srp = v.srp,
       vehicle = jsonb_build_object('make', 'Toyota', 'model', v.model, 'variant', v.variant, 'modelYear', v.year)
  FROM (VALUES ('ld_sls_01', 'TFS-2604511', 'REF-2604511', 'MALAYAN', '2027-04-18', '2026-04-15', 2450000, 'Fortuner', '2.4 G 4x2 AT', '2026'),
               ('ld_sls_02', 'TFS-2604622', 'REF-2604622', 'PIONEER', '2027-05-02', '2026-04-30', 1078000, 'Vios', '1.3 XLE CVT', '2026'),
               ('ld_sls_03', 'TFS-2504733', 'REF-2504733', 'STANDARD', '2026-12-10', '2025-12-08', 1380000, 'Hilux', '2.4 E 4x2 MT', '2025'),
               ('ld_sls_05', 'TFS-2604855', 'REF-2604855', 'MALAYAN', '2027-07-01', '2026-06-28', 1078000, 'Vios', '1.3 XLE CVT', '2026'))
       AS v(id, loan, ref, insurer, expiry, loan_start, srp, model, variant, year)
 WHERE l.id = v.id AND l.loan_id IS NULL;

-- A TFS import batch: two accounts loaded by the Sales Officer, not yet assigned
INSERT INTO lead_import_batches(id, batch_number, kind, file_name, rows_total, created, updated, failed, errors, created_by, created_at)
VALUES ('lib_seed_tfs_01', 'LIB-2026-00001', 'tfs', 'TFS_accounts_expiring_Dec2026.xlsx', 3, 2, 0, 1,
        '[{"row": 4, "message": "Row 4: No policy expiry date: no prospect is created for this account"}]',
        (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - interval '1 day')
ON CONFLICT (id) DO NOTHING;

INSERT INTO leads(id, lead_number, lead_type, first_name, last_name, display_name, email, phone, city, state, country, lead_category, lob, product_interest,
  product_id, source, status, customer_type, loan_id, tfs_reference, insurance_provider_id, policy_expiry_date, loan_start_date, loan_booking_date,
  loan_maturity_date, srp, product_group, vehicle, import_batch_id, notes, created_by, created_at, updated_at)
SELECT v.id, (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.lead.prefix') || '-' || to_char(current_date, 'YYYY') || '-' || v.num,
  'individual', v.fn, v.ln, v.fn || ' ' || v.ln, v.email, v.phone, v.city, 'Metro Manila', 'Philippines', 'Retail', 'MOTOR',
  (SELECT name FROM products WHERE code = 'MOTOR'), (SELECT id FROM products WHERE code = 'MOTOR'), 'TFS', 'New', 'TFS', v.loan, v.ref,
  (SELECT id FROM insurance_companies WHERE code = v.insurer), v.expiry::date, v.loan_start::date, v.loan_start::date - 5, v.loan_start::date + 1825, v.srp, 'Motor',
  jsonb_build_object('make', 'Toyota', 'model', v.model, 'variant', v.variant, 'modelYear', v.year, 'plateNumber', v.plate), 'lib_seed_tfs_01',
  'TFS account loaded from the expiry list', (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - interval '1 day', now() - interval '1 day'
FROM (VALUES
  ('ld_tfs_01', '95101', 'Andrea', 'Villanueva', 'andrea.villanueva@example.ph', '+639173047105', 'Pasig', 'TFS-2312901', 'REF-2312901', 'MALAYAN', '2026-12-15', '2023-12-15', 1078000, 'Raize', '1.0 Turbo CVT', '2023', 'NAB 1234'),
  ('ld_tfs_02', '95102', 'Dennis', 'Navarro', 'dennis.navarro@example.ph', '+639182223344', 'Quezon City', 'TFS-2312944', 'REF-2312944', 'PIONEER', '2026-12-20', '2023-12-20', 1650000, 'Innova', '2.8 E AT', '2023', 'NCD 5521'))
  AS v(id, num, fn, ln, email, phone, city, loan, ref, insurer, expiry, loan_start, srp, model, variant, year, plate)
ON CONFLICT (id) DO NOTHING;

-- A walk-in prospect of a dealer: a direct customer, not a TFS account
UPDATE leads SET customer_type = 'Direct Customer' WHERE id = 'ld_sls_12' AND customer_type IS NULL;
UPDATE leads SET customer_type = 'TFS' WHERE source = 'TFS' AND customer_type IS NULL;

-- The vehicles of the sample Motor policies (Talkbot car model, APR business category)
UPDATE policies p SET details = p.details || v.vehicle::jsonb
  FROM (VALUES ('POL-2025-90019', '{"vehicleBrand": "Toyota", "vehicleModel": "Vios", "modelVariant": "1.3 XLE CVT", "modelYear": "2025", "plateNumber": "NFE 7731"}'),
               ('POL-2025-90012', '{"vehicleBrand": "Toyota", "vehicleModel": "Innova", "modelVariant": "2.8 E AT", "modelYear": "2025", "plateNumber": "NGA 2205"}'),
               ('POL-2025-90014', '{"vehicleBrand": "Hino", "vehicleModel": "300 Series", "modelVariant": "XZU", "modelYear": "2024", "plateNumber": "NBX 4410"}'),
               ('POL-2025-90015', '{"vehicleBrand": "Toyota", "vehicleModel": "Hilux", "modelVariant": "2.4 E 4x2 MT", "modelYear": "2024", "plateNumber": "NCK 8810", "aprCategory": "ROPA"}'),
               ('POL-2025-90018', '{"vehicleBrand": "Toyota", "vehicleModel": "Fortuner", "modelVariant": "2.4 G 4x2 AT", "modelYear": "2025", "plateNumber": "NHA 1020"}'))
       AS v(num, vehicle)
 WHERE p.policy_number = v.num AND NOT p.details ? 'vehicleBrand';
