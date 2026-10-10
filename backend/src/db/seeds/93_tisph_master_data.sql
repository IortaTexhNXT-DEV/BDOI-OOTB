-- TISPH master data hygiene (TISPH Scope Register, Table 4): reference records of the product that TISPH does not use
-- are set inactive, so that no form offers them. Runs on a new database and on every start of an existing one. A row
-- changes only while nobody has changed it (updated_by empty), so a record an administrator activates again stays active.

-- ---------------------------------------------------------------- Line of Business
-- MARINE carries the Parcel / Courier product only (MOM s.28 and s.29: no marine cargo or hull).
UPDATE master_records SET data = data || '{"LOBDescription": "Parcel / Courier"}'::jsonb, updated_at = now()
 WHERE type_code = 'line-of-business' AND code = 'MARINE' AND data->>'LOBDescription' = 'Marine cargo and hull' AND updated_by IS NULL;

-- ---------------------------------------------------------------- Insurers
-- Starter insurers that are not on the TISPH panel (80_tisph_configuration.sql, M04). One still named on a quotation,
-- placement or policy stays active.
UPDATE insurance_companies i SET status = 'inactive', updated_at = now()
 WHERE i.code IN ('MAPFRE', 'FPG', 'MERCANTILE') AND i.status = 'active' AND i.updated_by IS NULL
   AND NOT EXISTS (SELECT 1 FROM quotes q WHERE q.insurance_company_id = i.id)
   AND NOT EXISTS (SELECT 1 FROM placements p WHERE p.insurance_company_id = i.id)
   AND NOT EXISTS (SELECT 1 FROM policies p WHERE p.insurance_company_id = i.id);

-- ---------------------------------------------------------------- Currencies and countries
-- TISPH works in pesos only (PBSM-M01-M03-ORG).
UPDATE currencies SET status = 'inactive', updated_at = now()
 WHERE code <> 'PHP' AND NOT is_base AND status = 'active' AND updated_by IS NULL;
-- The foreign countries of the starter list, each only while no address, client, prospect, user or master record uses it.
UPDATE countries c SET status = 'inactive', updated_at = now()
 WHERE c.code IN ('SG', 'MY', 'TH', 'US') AND c.status = 'active' AND c.updated_by IS NULL
   AND NOT EXISTS (SELECT 1 FROM states s WHERE s.country_id = c.id)
   AND NOT EXISTS (SELECT 1 FROM regions r WHERE r.country_id = c.id)
   AND NOT EXISTS (SELECT 1 FROM postal_codes p WHERE p.country_code = c.code)
   AND NOT EXISTS (SELECT 1 FROM clients x WHERE x.country IN (c.code, c.name) OR x.incorporation_country IN (c.code, c.name))
   AND NOT EXISTS (SELECT 1 FROM leads x WHERE x.country IN (c.code, c.name))
   AND NOT EXISTS (SELECT 1 FROM users x WHERE x.country IN (c.code, c.name))
   AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.status = 'active'
                     AND (m.data->>'countryCode' IN (c.code, c.name) OR m.data->>'CountryCode' IN (c.code, c.name) OR m.data->>'Country' IN (c.code, c.name)));

-- ---------------------------------------------------------------- Company
-- The out-of-the-box company, once TISPH is the active letterhead company.
UPDATE master_records m SET status = 'inactive', updated_at = now()
 WHERE m.type_code = 'company' AND m.code = 'ITX' AND m.status = 'active' AND m.updated_by IS NULL
   AND lower(COALESCE(m.data->>'IsPrimary', 'false')) NOT IN ('true', 'yes', '1')
   AND EXISTS (SELECT 1 FROM master_records t WHERE t.type_code = 'company' AND t.code = 'TISPH' AND t.status = 'active'
                 AND lower(COALESCE(t.data->>'IsPrimary', 'false')) IN ('true', 'yes', '1'));

-- ---------------------------------------------------------------- Bank file layouts
-- TISPH disburses through Metrobank only (TIS-BRD-DISB-01): the other starter layouts are set inactive while no bank
-- payment file uses them.
UPDATE bank_file_layouts l SET active = false, updated_at = now()
 WHERE l.code IN ('BDO-BULK', 'BPI-BULK', 'LBP-BULK', 'UBP-BULK', 'GENERIC-CSV') AND l.active AND l.updated_by IS NULL
   AND NOT EXISTS (SELECT 1 FROM bank_payment_batches b WHERE b.layout_code = l.code);
