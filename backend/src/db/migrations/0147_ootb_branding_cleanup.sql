-- OOTB branding leftovers (the BDO client theme). Only values still at the old seeded defaults change; a client's own
-- choices are kept.

-- 1. The built-in BDO logo preset is not part of the out-of-the-box product. It is dropped unless it is the logo in use
--    (then it stays, so System Settings still shows the selected logo). Logos a client added (builtIn false) are kept.
UPDATE app_settings s
SET value = COALESCE((SELECT jsonb_agg(e ORDER BY o) FROM jsonb_array_elements(s.value) WITH ORDINALITY x(e, o)
                      WHERE NOT (e->>'id' = 'bdo' AND COALESCE((e->>'builtIn')::boolean, false))), '[]'::jsonb),
    updated_at = now()
WHERE s.key = 'branding.logo_presets' AND jsonb_typeof(s.value) = 'array'
  AND s.value @> '[{"id":"bdo","builtIn":true}]'::jsonb
  AND NOT EXISTS (SELECT 1 FROM app_settings l WHERE l.key = 'branding.logo_url' AND l.value #>> '{}' = '/BDO_insure_logo.png.png');

-- 2. Chart of accounts: the operating bank account is not named after a bank.
UPDATE gl_accounts SET name = 'Cash in Bank – Operating Account', updated_at = now()
WHERE code = '1102001' AND name = 'Cash in Bank – Operating Account (BDO Current)';
