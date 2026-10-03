-- The legacy taxation master (master type 'taxation', screen /master/finance/taxation-legacy) is retired. Saving one
-- of its records wrote the linked tax.* setting (settingKey), a second way to change premium tax rates next to
-- Master > Finance > Premium Taxes & LGU Rates. Master > Finance > Taxation (tax_codes) replaces it.
--  * the type is inactive and no longer has a screen; the API refuses changes to its records (masters RETIRED_TYPES)
--  * its records are kept for reference, inactive and without the link to a setting
UPDATE master_types SET status = 'inactive', screen = NULL, updated_at = now(),
  fields = (SELECT COALESCE(jsonb_agg(f ORDER BY ord), '[]'::jsonb) FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f, ord) WHERE f->>'name' <> 'settingKey')
WHERE code = 'taxation';

UPDATE master_records SET data = data - 'settingKey', status = CASE WHEN status = 'active' THEN 'inactive' ELSE status END, updated_at = now()
WHERE type_code = 'taxation' AND (data ? 'settingKey' OR status = 'active');
