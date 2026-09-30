-- Product classification, as Philippine brokers sell:
--   package      standard tariff / fixed-wording products sold quickly, mostly to individuals (motor, CTPL, personal
--                accident, travel, householder, micro-insurance, group PA packages): quick quote -> quotation -> policy;
--   non_package  risks underwritten one by one and placed with insurers through the broker slip, quotation slip and
--                placement slip, mostly corporate (fire, IAR, engineering, marine, liability, bonds, employee benefits).
-- The values of the seeded products are set by seeds/64_product_classification.sql and edited on the Product master.
ALTER TABLE products ADD COLUMN IF NOT EXISTS business_type text CHECK (business_type IN ('package', 'non_package'));
ALTER TABLE products ADD COLUMN IF NOT EXISTS customer_segment text NOT NULL DEFAULT 'both' CHECK (customer_segment IN ('retail', 'corporate', 'both'));

-- The journey of a product now starts from its business type; placement.journey entries (product type or line) still
-- override it. The line entries seeded by 0125 are the same as the business-type defaults below, so those still
-- unchanged are removed and the business type decides; an entry an administrator changed is kept.
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('placement.journey_by_business_type', '{
   "package": {"brokerSlip": "optional", "quotationSlip": "required", "placementSlip": "optional", "directPolicy": "optional"},
   "non_package": {"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "required", "directPolicy": "optional"}
 }', 'placement', 'Placement journey by product business type (Product master): package / non_package. Steps brokerSlip, quotationSlip, placementSlip, directPolicy: required | optional | skip. An entry in placement.journey for the product type or line of business overrides it', 'json')
ON CONFLICT (key) DO NOTHING;

UPDATE app_settings SET value = value - 'MOTOR', updated_at = now()
 WHERE key = 'placement.journey' AND value->'MOTOR' = '{"brokerSlip": "optional", "quotationSlip": "required", "placementSlip": "optional", "directPolicy": "optional"}'::jsonb;
UPDATE app_settings SET value = value - ARRAY(
    SELECT k FROM unnest(ARRAY['FIRE', 'IAR', 'MARINE', 'CASUALTY', 'ENGINEERING']) AS k
     WHERE value->k = '{"brokerSlip": "optional", "quotationSlip": "optional", "placementSlip": "required", "directPolicy": "optional"}'::jsonb),
       updated_at = now()
 WHERE key = 'placement.journey';

UPDATE app_settings SET label = 'Placement journey per product type or line of business (key: product type, LOB code or "default"); an entry overrides the business-type journey (placement.journey_by_business_type). Steps brokerSlip, quotationSlip, placementSlip, directPolicy: required | optional | skip'
 WHERE key = 'placement.journey';
