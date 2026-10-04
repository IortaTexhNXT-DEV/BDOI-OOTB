-- Motor claims are often paid by the insurer straight to its accredited repair shop: add that settlement type to the
-- master where it is still missing (an installation that has edited its list keeps its own entries).
UPDATE app_settings
   SET value = value || '[{"value": "Repair Shop", "label": "Paid by insurer to the repair shop"}]'::jsonb
 WHERE key = 'claims.settlement_types'
   AND jsonb_typeof(value) = 'array'
   AND NOT (value @> '[{"value": "Repair Shop"}]'::jsonb);
