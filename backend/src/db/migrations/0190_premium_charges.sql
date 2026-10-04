-- Philippine premium taxes and charges (Master > Packaged Products > Taxes & Charges, LGU Tax Rates).
--
-- One rule per tax or charge added to an insurance premium:
--   vat          Value Added Tax on the premium (products taxed under the VAT regime)
--   premium_tax  Premium Tax instead of VAT (products whose tax regime is premium_tax, Product master)
--   dst          Documentary Stamp Tax (NIRC: P0.50 on each P4.00 of premium or fractional part: method per_unit)
--   fst          Fire Service Tax, only on fire / property lines (rule lines) or sections flagged as property
--   lgt          Local Government (Premium) Tax at the rate of the city or municipality (lgu_tax_rates), else the rule rate
--   other        any other charge: notarial fee, policy stamps (flat, percent or per unit)
-- method: percent (rate % of the base), per_unit (unit_amount for every unit_size of the base; fraction_rule round_up
-- counts a fractional unit as a whole one, prorate charges it proportionally) or flat (unit_amount once per document).
-- Existing quotations and policies keep the amounts they were saved with; the engine is used by the packaged product
-- screens, and by quotations when tax.charge_engine.quotations is on or the quotation was priced from a comparison.
ALTER TABLE products ADD COLUMN IF NOT EXISTS premium_tax_regime text NOT NULL DEFAULT 'vat';
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_premium_tax_regime_chk CHECK (premium_tax_regime IN ('vat', 'premium_tax', 'exempt'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS premium_charge_rules (
  code text PRIMARY KEY CHECK (code ~ '^[A-Z][A-Z0-9_-]*$'),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('vat', 'premium_tax', 'dst', 'fst', 'lgt', 'other')),
  method text NOT NULL DEFAULT 'percent' CHECK (method IN ('percent', 'per_unit', 'flat')),
  rate numeric(9,6) NOT NULL DEFAULT 0 CHECK (rate >= 0 AND rate <= 100),          -- percent, e.g. 12 = 12%
  unit_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_amount >= 0),           -- per_unit: amount per unit; flat: the amount
  unit_size numeric(14,2) NOT NULL DEFAULT 0 CHECK (unit_size >= 0),               -- per_unit: premium per unit (4.00)
  fraction_rule text NOT NULL DEFAULT 'round_up' CHECK (fraction_rule IN ('round_up', 'prorate')),
  lines text[],                                                                    -- product lines it applies to (null: all)
  regimes text[],                                                                  -- product tax regimes it applies to (null: all)
  minimum_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (minimum_amount >= 0),
  sort_order int NOT NULL DEFAULT 100,
  active boolean NOT NULL DEFAULT true,
  effective_from date NOT NULL DEFAULT DATE '2026-01-01',
  effective_to date,
  remarks text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from),
  CHECK (method <> 'per_unit' OR unit_size > 0));
DROP TRIGGER IF EXISTS premium_charge_rules_updated ON premium_charge_rules;
CREATE TRIGGER premium_charge_rules_updated BEFORE UPDATE ON premium_charge_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO premium_charge_rules(code, name, kind, method, rate, unit_amount, unit_size, fraction_rule, lines, regimes, sort_order, active, remarks, created_by) VALUES
 ('VAT', 'Value Added Tax', 'vat', 'percent', 12, 0, 0, 'round_up', NULL, ARRAY['vat'], 10, true, 'VAT on the premium of products under the VAT regime', 'migration'),
 ('PT', 'Premium Tax', 'premium_tax', 'percent', 2, 0, 0, 'round_up', NULL, ARRAY['premium_tax'], 20, true, 'Premium tax instead of VAT (product tax regime premium_tax)', 'migration'),
 ('DST', 'Documentary Stamp Tax', 'dst', 'per_unit', 0, 0.50, 4.00, 'round_up', NULL, NULL, 30, true, 'NIRC: P0.50 on each P4.00 of premium or fractional part thereof (12.5%)', 'migration'),
 ('FST', 'Fire Service Tax', 'fst', 'percent', 2, 0, 0, 'round_up', ARRAY['fire'], NULL, 40, true, 'Fire Code: 2% of the premium of fire and property insurance', 'migration'),
 ('LGT', 'Local Government Tax', 'lgt', 'percent', 0.2, 0, 0, 'round_up', NULL, NULL, 50, true, 'Rate of the city / municipality in LGU Tax Rates; this rate when the location has none', 'migration'),
 ('NOTARIAL', 'Notarial Fee', 'other', 'flat', 0, 100.00, 0, 'round_up', NULL, NULL, 90, false, 'Example of another charge: switch on and set the amount when it applies', 'migration')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS lgu_tax_rates (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  name text NOT NULL,                                  -- city or municipality
  province text,
  city_id int REFERENCES cities(id),
  rate numeric(7,4) NOT NULL CHECK (rate >= 0 AND rate <= 100),   -- percent of the premium, e.g. 0.2 = 0.2%
  effective_from date NOT NULL DEFAULT DATE '2026-01-01',
  effective_to date,
  active boolean NOT NULL DEFAULT true,
  remarks text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_to >= effective_from));
CREATE INDEX IF NOT EXISTS lgu_tax_rates_city_idx ON lgu_tax_rates(city_id);
DROP TRIGGER IF EXISTS lgu_tax_rates_updated ON lgu_tax_rates;
CREATE TRIGGER lgu_tax_rates_updated BEFORE UPDATE ON lgu_tax_rates FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO lgu_tax_rates(code, name, province, city_id, rate, remarks, created_by)
SELECT v.code, v.name, 'Metro Manila', (SELECT c.id FROM cities c WHERE lower(c.name) = lower(v.name) ORDER BY c.id LIMIT 1), 0.2,
       'Default rate: confirm against the city revenue code', 'migration'
FROM (VALUES ('MNL', 'Manila'), ('QC', 'Quezon City'), ('MKT', 'Makati'), ('PSG', 'Pasig'), ('TGG', 'Taguig'), ('PSY', 'Pasay'),
             ('MND', 'Mandaluyong'), ('SJN', 'San Juan'), ('CAL', 'Caloocan'), ('MUN', 'Muntinlupa')) AS v(code, name)
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('write:premium-charges', 'masters', 'Maintain premium taxes and charges and the LGU tax rates')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code IN ('accounting', 'system-admin') AND p.code = 'write:premium-charges'
ON CONFLICT DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('tax.charge_engine.quotations', 'false', 'tax', 'Price every quotation with the premium tax and charge engine (Taxes & Charges, LGU Tax Rates). Off: only quotations priced from a comparison or package use it; saved quotations keep their amounts until re-quoted', 'boolean'),
 ('tax.charge_engine.default_lgu', '""', 'tax', 'LGU tax rate code used when a quotation names no city or municipality (empty: the LGT rule rate)', 'string')
ON CONFLICT (key) DO NOTHING;
