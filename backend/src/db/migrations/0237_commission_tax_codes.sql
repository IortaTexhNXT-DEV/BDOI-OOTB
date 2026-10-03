-- Commission taxes: every rate comes from the tax codes master (Master > Finance > Taxation, tax_codes). Settings and
-- referrer records keep only WHICH code applies:
--   direct_bill.commission_vat_code   output VAT on direct-bill commission      (was direct_bill.commission_vat_rate)
--   direct_bill.insurer_ewt_code      EWT the insurer withholds, direct bill     (was direct_bill.insurer_ewt_rate)
--   commission.wht_code_by_type       WHT on sub-agent commission per type       (was commission.wht_rate_by_type)
--   commission.default_wht_code       WHT when the type has none / agent lines  (was tax.withholding_rate)
--   commission_referrers.wht_code     the payee's own WHT code                   (was commission_referrers.wht_rate)
-- Broker-billed commission already used tax.commission_vat_code / tax.commission_ewt_code.
--
-- Each old rate becomes the code that charges the same rate: the code already configured for that purpose when its
-- rate matches, else an active code of the same tax type, direction and payee kind with that rate, else a new code
-- "MIG-<type>-<rate>" created for it (so no amount changes). commission_referrers.wht_rate is kept for history and is
-- no longer read. The old rate settings are removed.

CREATE OR REPLACE FUNCTION pg_temp.code_for_rate(p_rate numeric, p_type text, p_applies text, p_preferred text[], p_payee text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_pct numeric := round(p_rate * 100, 4);
  v_code text;
BEGIN
  IF p_rate IS NULL THEN RETURN NULL; END IF;
  SELECT t.code INTO v_code FROM unnest(p_preferred) WITH ORDINALITY AS x(code, ord) JOIN tax_codes t ON t.code = x.code
   WHERE t.active AND t.rate = v_pct ORDER BY x.ord LIMIT 1;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  SELECT code INTO v_code FROM tax_codes
   WHERE active AND tax_type = p_type AND rate = v_pct AND applies_to IN (p_applies, 'both')
   ORDER BY (p_payee IS NOT NULL AND payee_kind = p_payee) DESC, (payee_kind = 'any') DESC, sort_order, code LIMIT 1;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  v_code := 'MIG-' || p_type || '-' || trim(to_char(v_pct, 'FM999990.9999'), '.');
  INSERT INTO tax_codes(code, description, tax_type, rate, gl_account, applies_to, payee_kind, effective_from, sort_order, remarks, created_by)
  VALUES (v_code, p_type || ' ' || trim(to_char(v_pct, 'FM999990.9999'), '.') || '% (rate kept in a setting before migration 0237)', p_type, v_pct,
          CASE WHEN p_type = 'VAT' THEN '2204003' WHEN p_applies = 'sales' THEN '1302001' ELSE '2204001' END,
          p_applies, COALESCE(p_payee, 'any'), DATE '2026-01-01', 900, 'Created by migration 0237: confirm the ATC with the tax team', 'migration:0237')
  ON CONFLICT (code) DO NOTHING;
  RETURN v_code;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.setting_num(p_key text) RETURNS numeric LANGUAGE sql AS $$
  SELECT CASE WHEN jsonb_typeof(value) = 'number' THEN (value #>> '{}')::numeric
              WHEN jsonb_typeof(value) = 'string' AND (value #>> '{}') ~ '^[0-9.]+$' THEN (value #>> '{}')::numeric END
    FROM app_settings WHERE key = p_key $$;
CREATE OR REPLACE FUNCTION pg_temp.setting_text(p_key text) RETURNS text LANGUAGE sql AS $$
  SELECT NULLIF(value #>> '{}', '') FROM app_settings WHERE key = p_key $$;
CREATE OR REPLACE FUNCTION pg_temp.atc_for(p_type text) RETURNS text LANGUAGE sql AS $$
  SELECT value ->> p_type FROM app_settings WHERE key = 'bir.atc_by_payee' AND jsonb_typeof(value) = 'object' $$;

-- 1. Direct-bill output VAT and insurer EWT.
INSERT INTO app_settings(key, value, "group", label, type)
SELECT 'direct_bill.commission_vat_code',
       to_jsonb(COALESCE(pg_temp.code_for_rate(COALESCE(pg_temp.setting_num('direct_bill.commission_vat_rate'), pg_temp.setting_num('tax.vat_rate')), 'VAT', 'sales',
                         ARRAY[pg_temp.setting_text('tax.commission_vat_code'), 'VAT12-OUT']), 'VAT12-OUT')),
       'direct_bill', 'Tax code of the output VAT on direct-bill commission (rate from Master > Finance > Taxation)', 'string'
ON CONFLICT (key) DO NOTHING;
INSERT INTO app_settings(key, value, "group", label, type)
SELECT 'direct_bill.insurer_ewt_code',
       to_jsonb(COALESCE(pg_temp.code_for_rate(pg_temp.setting_num('direct_bill.insurer_ewt_rate'), 'EWT', 'sales',
                         ARRAY[pg_temp.setting_text('tax.commission_ewt_code'), pg_temp.setting_text('bir.sawt_default_atc'), 'WC139'], 'corporate'), 'WC139')),
       'direct_bill', 'Tax code of the expanded withholding tax the insurer deducts from direct-bill commission (creditable, BIR Form 2307; rate from Master > Finance > Taxation)', 'string'
ON CONFLICT (key) DO NOTHING;

-- 2. Withholding tax on referrer (comsub) and agent commission.
INSERT INTO app_settings(key, value, "group", label, type)
SELECT 'commission.default_wht_code',
       to_jsonb(COALESCE(pg_temp.code_for_rate(pg_temp.setting_num('tax.withholding_rate'), 'EWT', 'purchases', ARRAY[pg_temp.atc_for('Agent'), 'WI515'], 'individual'), 'WI515')),
       'commission', 'Withholding tax code on commission when the referrer type has none (rate from Master > Finance > Taxation)', 'string'
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type)
SELECT 'commission.wht_code_by_type',
       COALESCE((SELECT jsonb_object_agg(e.key, pg_temp.code_for_rate((e.value #>> '{}')::numeric, 'EWT', 'purchases',
                         ARRAY[pg_temp.atc_for(e.key), CASE WHEN e.key = 'External' THEN 'WC515' ELSE 'WI515' END],
                         CASE WHEN e.key = 'External' THEN 'corporate' ELSE 'individual' END))
                   FROM app_settings s, jsonb_each(s.value) e
                  WHERE s.key IN ('commission.wht_rate_by_type') AND jsonb_typeof(s.value) = 'object' AND jsonb_typeof(e.value) = 'number'),
                '{"Agent": "WI515", "Sub-agent": "WI515", "External": "WC515"}'::jsonb),
       'commission', 'Withholding tax code on comsub per referrer type (rate from Master > Finance > Taxation; a referrer may name its own code)', 'json'
ON CONFLICT (key) DO NOTHING;

-- 3. The payee's own withholding tax code.
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS wht_code text;
COMMENT ON COLUMN commission_referrers.wht_code IS 'Payee''s withholding tax code (tax_codes); null: commission.wht_code_by_type for the referrer type';
COMMENT ON COLUMN commission_referrers.wht_rate IS 'History only (not read since migration 0237): the rate comes from wht_code';
UPDATE commission_referrers r
   SET wht_code = pg_temp.code_for_rate(r.wht_rate, 'EWT', 'purchases',
         ARRAY[pg_temp.atc_for(r.referrer_type), CASE WHEN r.referrer_type = 'External' THEN 'WC515' ELSE 'WI515' END],
         CASE WHEN r.referrer_type = 'External' THEN 'corporate' ELSE 'individual' END)
 WHERE r.wht_rate IS NOT NULL AND r.wht_code IS NULL;

-- 4. The rate settings are gone: the codes above carry the rates.
DELETE FROM app_settings WHERE key IN ('direct_bill.commission_vat_rate', 'direct_bill.insurer_ewt_rate', 'commission.wht_rate_by_type', 'tax.withholding_rate');
