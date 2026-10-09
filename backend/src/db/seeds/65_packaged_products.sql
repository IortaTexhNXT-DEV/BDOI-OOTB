-- Packaged products: permissions of the broker roles (the roles exist once the seed has created them), reference data
-- of the bundles, insurer rate tables and payment gateways. Idempotent.

-- Premium taxes and charges, LGU tax rates: Accounting maintains them (migration 0190 adds the permission).
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.code IN ('accounting', 'system-admin') AND p.code = 'write:premium-charges'
ON CONFLICT DO NOTHING;

-- Product master: the premium tax regime of a product (VAT, premium tax instead of VAT, or exempt), read by the tax engine.
UPDATE master_types SET fields = fields || $j$[{"name":"premiumTaxRegime","label":"Premium Tax Regime","type":"select","required":false,"options":["vat","premium_tax","exempt"],"column":"premium_tax_regime"}]$j$::jsonb
WHERE code = 'product' AND NOT fields @> '[{"name":"premiumTaxRegime"}]'::jsonb;

-- Burglary, sold as a section of the SME and home packages; outside the TISPH catalogue (migration 0341).
INSERT INTO products(code, name, line, description, business_type, customer_segment, status) VALUES
 ('BURGLARY', 'Burglary and Robbery', 'casualty', 'Loss of contents by burglary, robbery or theft with visible forced entry', 'package', 'both', 'inactive')
ON CONFLICT (code) DO NOTHING;
