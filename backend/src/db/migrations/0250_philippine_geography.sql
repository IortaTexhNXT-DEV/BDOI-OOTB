-- Philippine geography out of the box (PSGC of the Philippine Statistics Authority).
--   * Region above Province: regions table (Region master), states.region_id. "State" (a leftover of an earlier product)
--     is called Province on every screen; the table, the master type code (state) and the field names (StateCode,
--     StateName, State) are kept so existing API clients, uploads and workbooks keep working.
--   * PSGC codes on regions, provinces, cities / municipalities and barangays; city class (HUC / ICC / component city /
--     municipality), ZIP code and region of a city / municipality.
--   * Barangays (districts table) become a master type (Barangay); the full PSGC barangay list is an optional load
--     (scripts/load-barangays.js).
--   * Region on the addresses of leads, clients and users (Philippine address format).
--   * Thai reference rows (provinces, cities, districts, postal codes) are deactivated, never deleted (data may name them).
-- The reference rows themselves are loaded by seeds/12_ph_geography.sql.

CREATE TABLE IF NOT EXISTS regions (
  id serial PRIMARY KEY,
  country_id int NOT NULL REFERENCES countries(id),
  code text NOT NULL,
  name text NOT NULL,
  designation text,
  psgc_code text,
  sort_order int NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'active',
  attrs jsonb NOT NULL DEFAULT '{}',
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS regions_country_code_uidx ON regions(country_id, lower(code));
CREATE UNIQUE INDEX IF NOT EXISTS regions_psgc_uidx ON regions(psgc_code) WHERE psgc_code IS NOT NULL;
DROP TRIGGER IF EXISTS regions_updated ON regions;
CREATE TRIGGER regions_updated BEFORE UPDATE ON regions FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE states ADD COLUMN IF NOT EXISTS region_id int REFERENCES regions(id);
ALTER TABLE states ADD COLUMN IF NOT EXISTS psgc_code text;
CREATE INDEX IF NOT EXISTS states_region_idx ON states(region_id);
CREATE INDEX IF NOT EXISTS states_country_idx ON states(country_id);
CREATE UNIQUE INDEX IF NOT EXISTS states_psgc_uidx ON states(psgc_code) WHERE psgc_code IS NOT NULL;

ALTER TABLE cities ADD COLUMN IF NOT EXISTS region_id int REFERENCES regions(id);
ALTER TABLE cities ADD COLUMN IF NOT EXISTS psgc_code text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS city_class text;
ALTER TABLE cities ADD COLUMN IF NOT EXISTS zip_code text;
CREATE INDEX IF NOT EXISTS cities_state_idx ON cities(state_id);
CREATE INDEX IF NOT EXISTS cities_region_idx ON cities(region_id);
CREATE UNIQUE INDEX IF NOT EXISTS cities_psgc_uidx ON cities(psgc_code) WHERE psgc_code IS NOT NULL;
-- the ZIP code entered on the City screen was kept in attrs.PostalCode; it is a column now
UPDATE cities SET zip_code = NULLIF(trim(attrs->>'PostalCode'), '') WHERE zip_code IS NULL AND attrs ? 'PostalCode';
UPDATE cities SET attrs = attrs - 'PostalCode' WHERE attrs ? 'PostalCode';

-- A city / municipality lies in the region of its province unless a region is given (Isabela City: Region IX, in Basilan).
CREATE OR REPLACE FUNCTION cities_default_region() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.region_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.state_id IS DISTINCT FROM OLD.state_id AND NEW.region_id IS NOT DISTINCT FROM OLD.region_id) THEN
    NEW.region_id := (SELECT s.region_id FROM states s WHERE s.id = NEW.state_id);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cities_region ON cities;
CREATE TRIGGER cities_region BEFORE INSERT OR UPDATE ON cities FOR EACH ROW EXECUTE FUNCTION cities_default_region();

-- Place-name key that ignores case, accents, punctuation and the "City of" / "City" wording ("City of Makati",
-- "Makati City" and "MAKATI" give the same key): matches cities entered before the PSGC list to their PSGC record.
CREATE OR REPLACE FUNCTION ph_place_key(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(regexp_replace(regexp_replace(translate(lower(coalesce(t, '')), 'ñáéíóúü', 'naeiouu'),
    '^\s*city of\s+', ''), '\s+city\s*$', ''), '[^a-z0-9]', '', 'g')
$$;

ALTER TABLE districts ADD COLUMN IF NOT EXISTS psgc_code text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS attrs jsonb NOT NULL DEFAULT '{}';
ALTER TABLE districts ADD COLUMN IF NOT EXISTS created_by text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS updated_by text;
ALTER TABLE districts ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE districts ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS districts_psgc_uidx ON districts(psgc_code) WHERE psgc_code IS NOT NULL;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS region text;

-- ---------- Thai reference rows: deactivated (kept for any record that names them) ----------
UPDATE districts SET status = 'inactive' WHERE status = 'active' AND city_id IN (
  SELECT ci.id FROM cities ci JOIN states s ON s.id = ci.state_id JOIN countries c ON c.id = s.country_id WHERE c.code = 'TH');
UPDATE cities SET status = 'inactive' WHERE status = 'active' AND state_id IN (
  SELECT s.id FROM states s JOIN countries c ON c.id = s.country_id WHERE c.code = 'TH');
UPDATE states SET status = 'inactive' WHERE status = 'active' AND country_id IN (SELECT id FROM countries WHERE code = 'TH');
-- postal_codes is a look-up list only (no record points to it)
DELETE FROM postal_codes WHERE upper(country_code) = 'TH';
-- Thai was withdrawn from the language pickers: drop it from the shipped language list when still unchanged
UPDATE app_settings SET value = '[{"code":"en","label":"English"},{"code":"fil","label":"Filipino"}]'::jsonb
WHERE key = 'general.languages' AND value = '[{"code":"en","label":"English"},{"code":"th","label":"Thai"},{"code":"fil","label":"Filipino"}]'::jsonb;

-- ---------- master screens: Region, Province (was State), City / Municipality, Barangay ----------
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$region$s$, $s$Region$s$, 'general', $s$/master/generals/location/region$s$, 'table', $s$regions$s$, $s$RegionCode$s$, $s$RegionName$s$, $j$[{"name":"RegionCode","label":"Region Code","type":"string","required":true,"column":"code"},{"name":"RegionName","label":"Region Name","type":"string","required":true,"column":"name"},{"name":"Designation","label":"Designation","type":"string","required":false,"column":"designation"},{"name":"PsgcCode","label":"PSGC Code","type":"string","required":false,"column":"psgc_code"},{"name":"Country","label":"Country","type":"string","required":true,"optionsFrom":"country","column":"country_id","ref":{"table":"countries","type":"country","labelColumn":"name","codeColumn":"code"}},{"name":"SortOrder","label":"Sort Order","type":"integer","required":false,"column":"sort_order"},{"name":"Modifiedby","label":"Modified By","type":"audit-user","required":false},{"name":"ModifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["Country","RegionCode"]]$j$, false, 90, true, 'migration')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, fields = EXCLUDED.fields, updated_at = now();
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$state$s$, $s$Province$s$, 'general', $s$/master/generals/location/state$s$, 'table', $s$states$s$, $s$StateCode$s$, $s$StateName$s$, $j$[{"name":"StateCode","label":"Province Code","type":"string","required":true,"column":"code","aliases":["State Code","ProvinceCode"]},{"name":"StateName","label":"Province Name","type":"string","required":true,"column":"name","aliases":["State Name","ProvinceName"]},{"name":"Description","label":"Description","type":"text","required":false},{"name":"Region","label":"Region","type":"string","required":false,"optionsFrom":"region","column":"region_id","ref":{"table":"regions","type":"region","labelColumn":"name","codeColumn":"code"}},{"name":"Country","label":"Country","type":"string","required":true,"optionsFrom":"country","column":"country_id","ref":{"table":"countries","type":"country","labelColumn":"name","codeColumn":"code"}},{"name":"Level","label":"Level","type":"select","required":false,"options":["Province","Metropolitan area","Special Geographic Area","Province / state outside the Philippines"]},{"name":"PsgcCode","label":"PSGC Code","type":"string","required":false,"column":"psgc_code"},{"name":"Modifiedby","label":"Modified By","type":"audit-user","required":false},{"name":"ModifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["Country","StateName"]]$j$, false, 91, true, 'migration')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, fields = EXCLUDED.fields, updated_at = now();
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$city$s$, $s$City / Municipality$s$, 'general', $s$/master/generals/location/city$s$, 'table', $s$cities$s$, $s$CityCode$s$, $s$CityName$s$, $j$[{"name":"CityCode","label":"City / Municipality Code","type":"string","required":true,"aliases":["City Code"]},{"name":"CityName","label":"City / Municipality Name","type":"string","required":true,"column":"name","aliases":["City Name","Municipality"]},{"name":"Description","label":"Description","type":"text","required":false},{"name":"State","label":"Province","type":"string","required":true,"optionsFrom":"state","column":"state_id","aliases":["Province"],"ref":{"table":"states","type":"state","labelColumn":"name","codeColumn":"code"}},{"name":"Region","label":"Region","type":"string","required":false,"optionsFrom":"region","column":"region_id","ref":{"table":"regions","type":"region","labelColumn":"name","codeColumn":"code"}},{"name":"CityClass","label":"Class","type":"select","required":false,"column":"city_class","options":["Highly Urbanized City","Independent Component City","Component City","Municipality"]},{"name":"PostalCode","label":"ZIP Code","type":"string","required":false,"column":"zip_code","aliases":["Postal Code","ZIP"]},{"name":"NcrDistrict","label":"Metro Manila District","type":"string","required":false},{"name":"PsgcCode","label":"PSGC Code","type":"string","required":false,"column":"psgc_code"},{"name":"Modifiedby","label":"Modified By","type":"audit-user","required":false},{"name":"ModifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["State","CityName"]]$j$, false, 92, true, 'migration')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, fields = EXCLUDED.fields, updated_at = now();
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$barangay$s$, $s$Barangay$s$, 'general', NULL, 'table', $s$districts$s$, $s$BarangayCode$s$, $s$BarangayName$s$, $j$[{"name":"BarangayCode","label":"Barangay Code (PSGC)","type":"string","required":false,"column":"psgc_code"},{"name":"BarangayName","label":"Barangay Name","type":"string","required":true,"column":"name"},{"name":"City","label":"City / Municipality","type":"string","required":true,"optionsFrom":"city","column":"city_id","ref":{"table":"cities","type":"city","labelColumn":"name","codeColumn":"psgc_code"}},{"name":"PostalCode","label":"ZIP Code","type":"string","required":false,"column":"postal_code"},{"name":"Modifiedby","label":"Modified By","type":"audit-user","required":false},{"name":"ModifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$, $j$[["City","BarangayName"]]$j$, false, 93, true, 'migration')
ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label, fields = EXCLUDED.fields, updated_at = now();
-- address fields of the other masters (Company, Branch, Insurance Company, Employee, Bank ...): Philippine wording;
-- the field names stay (State, City, PinCode, ifscCode)
UPDATE master_types mt SET fields = (
  SELECT jsonb_agg(CASE f->>'label'
      WHEN 'State' THEN jsonb_set(f, '{label}', '"Province"')
      WHEN 'City' THEN jsonb_set(f, '{label}', '"City / Municipality"')
      WHEN 'Pin Code' THEN jsonb_set(f, '{label}', '"ZIP Code"')
      WHEN 'IFSC / SWIFT Code' THEN jsonb_set(f, '{label}', '"SWIFT Code"')
      ELSE f END ORDER BY ord)
  FROM jsonb_array_elements(mt.fields) WITH ORDINALITY AS x(f, ord))
WHERE mt.code NOT IN ('region', 'state', 'city', 'barangay')
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(mt.fields) f WHERE f->>'label' IN ('State', 'City', 'Pin Code', 'IFSC / SWIFT Code'));
