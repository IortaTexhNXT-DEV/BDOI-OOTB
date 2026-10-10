-- TISPH quotation and policy configuration (TIS-BRD-QUOT-04, PROD-03). Runs on a new database and on every start of an
-- existing one. Idempotent: a field or row is added only when missing, and a reference value is replaced only while it
-- is still the reference value and nobody has changed it (updated_by empty), so administrator changes are kept.

-- Product Master: quotation validity in days per product (migration 0480); empty = limits.quote_validity_days.
UPDATE master_types SET fields = fields || $j$[{"name":"quoteValidityDays","label":"Quotation Validity (days)","type":"integer","required":false,"column":"quote_validity_days"}]$j$::jsonb
WHERE code = 'product' AND NOT fields @> '[{"name":"quoteValidityDays"}]'::jsonb;

-- A spoiled quotation is not revived (QUOT-04): Expired has no way back to Draft; the customer gets a new quotation.
UPDATE app_settings SET value = value - 'Expired', updated_at = now()
 WHERE key = 'quotations.transitions' AND updated_by IS NULL AND value->'Expired' = '["Draft"]'::jsonb;
