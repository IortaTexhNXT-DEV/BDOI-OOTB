-- Accounting base currency and exchange rates, one source each.
--
-- Base currency: the Currency master row flagged is_base. Exactly one currency is the base (constraint
-- currencies_one_base, checked at the end of each statement so the flag can move in one UPDATE); it is locked once a
-- journal exists (modules/masters/currency.js). Journal vouchers, FX revaluation and every ledger record default to
-- it. currency.default (System Settings > Display currency) only labels amounts on screens and documents.
--
-- Exchange rates: the dated Exchange Rate master (master_records type exchange-rate) is the only source. Journal
-- vouchers convert at the rate in force on the voucher date, month-end revaluation at the rate in force on the period
-- end. currencies.exchange_rate is kept for history and is no longer read: a rate kept there (foreign units per base
-- unit, e.g. USD 0.0177) is copied once into a dated record (base units per foreign unit, 1 / rate) effective from the
-- earliest journal date (today when there is none), when the Exchange Rate master has no record for that currency yet.
-- The default value 1 is treated as "never set" and not copied.

-- 1. Exactly one base currency. A database with none (or several) keeps / gets the currency its journals are kept in,
--    else the display currency, else PHP, else the first active currency.
WITH ledger AS (
  SELECT upper(currency) AS code FROM journal_vouchers WHERE currency IS NOT NULL GROUP BY 1 ORDER BY count(*) DESC LIMIT 1
), pick AS (
  SELECT c.id FROM currencies c
   WHERE c.status = 'active'
   ORDER BY (upper(c.code) = (SELECT code FROM ledger)) DESC NULLS LAST,
            c.is_base DESC,
            (upper(c.code) = upper(COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'currency.default'), 'PHP'))) DESC,
            (upper(c.code) = 'PHP') DESC, c.id
   LIMIT 1
)
UPDATE currencies SET is_base = (id = (SELECT id FROM pick))
 WHERE (SELECT count(*) FROM currencies WHERE is_base AND status = 'active') <> 1
   AND EXISTS (SELECT 1 FROM pick)
   AND (is_base OR id = (SELECT id FROM pick));

DO $$ BEGIN
  ALTER TABLE currencies ADD CONSTRAINT currencies_one_base EXCLUDE USING btree (is_base WITH =) WHERE (is_base) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;
COMMENT ON COLUMN currencies.is_base IS 'Accounting base currency (exactly one; locked once journals exist)';
COMMENT ON COLUMN currencies.exchange_rate IS 'History only (not read since migration 0235): rates come from the dated Exchange Rate master';

-- 2. Rates kept on the Currency master become dated Exchange Rate records (only where that currency has none).
INSERT INTO master_records(type_code, code, name, data, status, created_by, updated_by)
SELECT 'exchange-rate', NULL, c.code,
       jsonb_build_object('EffectiveFrom', to_char(d.from_date, 'YYYY-MM-DD'), 'EffectiveTo', NULL, 'CurrencyCode', c.code, 'ToCurrencyCode', b.code,
                          'ExchangeRate', round(1 / c.exchange_rate, 6), 'CurrencyDescription', c.name, 'ToCurrencyDescription', b.name),
       'active', 'migration', 'migration'
  FROM currencies c
  CROSS JOIN (SELECT code, name FROM currencies WHERE is_base AND status = 'active' ORDER BY id LIMIT 1) b
  CROSS JOIN (SELECT COALESCE(min(jv_date), current_date) AS from_date FROM journal_vouchers) d
 WHERE NOT c.is_base AND c.status = 'active' AND c.exchange_rate > 0 AND c.exchange_rate <> 1
   AND EXISTS (SELECT 1 FROM master_types WHERE code = 'exchange-rate')
   AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'exchange-rate' AND m.status <> 'deleted'
                    AND upper(c.code) IN (upper(m.data->>'CurrencyCode'), upper(m.data->>'ToCurrencyCode')));

-- 3. The Currency form no longer edits a rate; the base flag is labelled for what it is.
UPDATE master_types
   SET fields = (SELECT jsonb_agg(CASE WHEN f->>'name' = 'isBase' THEN f || '{"label":"Accounting base currency"}'::jsonb ELSE f END ORDER BY ord)
                   FROM jsonb_array_elements(fields) WITH ORDINALITY AS x(f, ord) WHERE f->>'name' <> 'exchangeRate'),
       updated_at = now()
 WHERE code = 'currency' AND fields @> '[{"name":"exchangeRate"}]'::jsonb;

-- 4. Labels: what each currency setting decides now.
UPDATE app_settings SET label = v.label
FROM (VALUES
 ('currency.default', 'Display currency: labels amounts on screens and documents (the ledger is kept in the base currency of Master > Finance > Currency)'),
 ('currency.allowed', 'Locale and region of each display currency (fallback; the choices are the active currencies of Master > Finance > Currency)')
) AS v(key, label)
WHERE app_settings.key = v.key;
