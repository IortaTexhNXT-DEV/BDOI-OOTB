-- Document Numbering master (Master > Document Numbering): one row per document series with its prefix, pattern,
-- sequence width and reset rule. next_document_number(code, branch, lob) issues the next number of a series inside
-- the caller's transaction; the counters stay in `sequences` (name = series code, period = the reset period key), so
-- the counters issued before this migration carry over. next_number(name, prefix, width) remains as a compatible
-- wrapper (seed SQL and older scripts) that routes to the series when one exists.
--
-- Pattern tokens: {PREFIX} {YYYY} {YY} {MM} {FY} {BRANCH} {LOB} {SEQ}. {FY} is the fiscal year, named by the calendar
-- year in which it ends (accounting.fiscal_year_start_month, 1 = January: FY = calendar year). {BRANCH} / {LOB} are
-- given by the caller; when absent they are dropped together with the separator in front of them.
-- The default pattern {PREFIX}-{YYYY}-{SEQ} (width 5, yearly reset) keeps every existing number format unchanged.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.fiscal_year_start_month', '1', 'accounting', 'Fiscal year start month (1 = January); used by the {FY} numbering token and fiscal-year resets', 'number')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS document_numbering (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  name text NOT NULL,
  module text NOT NULL DEFAULT 'general',
  prefix text NOT NULL CHECK (char_length(prefix) BETWEEN 1 AND 20),
  pattern text NOT NULL DEFAULT '{PREFIX}-{YYYY}-{SEQ}' CHECK (position('{SEQ}' IN pattern) > 0),
  seq_width int NOT NULL DEFAULT 5 CHECK (seq_width BETWEEN 1 AND 12),
  reset_rule text NOT NULL DEFAULT 'yearly' CHECK (reset_rule IN ('yearly', 'fiscal_yearly', 'monthly', 'never')),
  start_number bigint NOT NULL DEFAULT 1 CHECK (start_number >= 1),
  active boolean NOT NULL DEFAULT true,
  description text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DROP TRIGGER IF EXISTS document_numbering_updated ON document_numbering;
CREATE TRIGGER document_numbering_updated BEFORE UPDATE ON document_numbering FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------- helpers ----------

-- Today's business date in general.timezone (UTC when unset or invalid), the same rule as src/lib/dates.js.
CREATE OR REPLACE FUNCTION numbering_business_date() RETURNS date LANGUAGE plpgsql STABLE AS $$
DECLARE tz text;
BEGIN
  SELECT value #>> '{}' INTO tz FROM app_settings WHERE key = 'general.timezone';
  IF tz IS NULL OR tz = '' THEN RETURN (now() AT TIME ZONE 'UTC')::date; END IF;
  BEGIN
    RETURN (now() AT TIME ZONE tz)::date;
  EXCEPTION WHEN others THEN
    RETURN (now() AT TIME ZONE 'UTC')::date;
  END;
END $$;

-- Fiscal year of a date, named by the calendar year in which it ends (start month from accounting.fiscal_year_start_month).
CREATE OR REPLACE FUNCTION numbering_fiscal_year(p_date date) RETURNS int LANGUAGE plpgsql STABLE AS $$
DECLARE m int;
BEGIN
  SELECT CASE WHEN (value #>> '{}') ~ '^\d{1,2}$' THEN (value #>> '{}')::int END INTO m FROM app_settings WHERE key = 'accounting.fiscal_year_start_month';
  IF m IS NULL OR m < 1 OR m > 12 THEN m := 1; END IF;
  RETURN extract(year FROM p_date)::int + CASE WHEN m > 1 AND extract(month FROM p_date)::int >= m THEN 1 ELSE 0 END;
END $$;

-- Counter period key of a reset rule: yearly 2026, fiscal_yearly FY2027, monthly 2026-09, never ALL.
CREATE OR REPLACE FUNCTION numbering_period_key(p_reset text, p_date date) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE p_reset
    WHEN 'monthly' THEN to_char(p_date, 'YYYY-MM')
    WHEN 'fiscal_yearly' THEN 'FY' || numbering_fiscal_year(p_date)
    WHEN 'never' THEN 'ALL'
    ELSE to_char(p_date, 'YYYY') END
$$;

-- Replace an optional token; when the value is empty the token goes together with one adjacent separator.
CREATE OR REPLACE FUNCTION numbering_optional_token(p_text text, p_token text, p_value text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t text := regexp_replace(p_token, '([{}])', '\\\1', 'g');
BEGIN
  IF p_value IS NOT NULL AND p_value <> '' THEN RETURN replace(p_text, p_token, p_value); END IF;
  p_text := regexp_replace(p_text, '[-/_.]' || t, '', 'g');
  p_text := regexp_replace(p_text, t || '[-/_.]?', '', 'g');
  RETURN p_text;
END $$;

-- Format a number from a pattern (also used for previews).
CREATE OR REPLACE FUNCTION format_document_number(p_pattern text, p_prefix text, p_width int, p_seq bigint, p_date date,
  p_branch text DEFAULT NULL, p_lob text DEFAULT NULL) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE s text := p_pattern;
BEGIN
  s := replace(s, '{PREFIX}', COALESCE(p_prefix, ''));
  s := replace(s, '{YYYY}', to_char(p_date, 'YYYY'));
  s := replace(s, '{YY}', to_char(p_date, 'YY'));
  s := replace(s, '{MM}', to_char(p_date, 'MM'));
  IF position('{FY}' IN s) > 0 THEN s := replace(s, '{FY}', numbering_fiscal_year(p_date)::text); END IF;
  s := numbering_optional_token(s, '{BRANCH}', upper(btrim(COALESCE(p_branch, ''))));
  s := numbering_optional_token(s, '{LOB}', upper(btrim(COALESCE(p_lob, ''))));
  RETURN replace(s, '{SEQ}', lpad(p_seq::text, GREATEST(p_width, length(p_seq::text)), '0'));
END $$;

-- Issue the next number of a series. The series row is share-locked (its configuration cannot change mid-issue) and
-- the counter row is locked by the upsert until the caller's transaction ends, so concurrent callers never share a number.
CREATE OR REPLACE FUNCTION next_document_number(p_code text, p_branch text DEFAULT NULL, p_lob text DEFAULT NULL, p_date date DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE s document_numbering%ROWTYPE; d date := COALESCE(p_date, numbering_business_date()); v bigint;
BEGIN
  SELECT * INTO s FROM document_numbering WHERE code = p_code FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document numbering series % is not configured (Master > Document Numbering)', p_code USING ERRCODE = '22023'; END IF;
  IF NOT s.active THEN RAISE EXCEPTION 'Document numbering series % (%) is inactive (Master > Document Numbering)', s.code, s.name USING ERRCODE = '22023'; END IF;
  INSERT INTO sequences(name, period, value) VALUES (s.code, numbering_period_key(s.reset_rule, d), s.start_number)
    ON CONFLICT (name, period) DO UPDATE SET value = sequences.value + 1
    RETURNING value INTO v;
  RETURN format_document_number(s.pattern, s.prefix, s.seq_width, v, d, p_branch, p_lob);
END $$;

-- Compatible wrapper: a name that matches a series (hyphens read as underscores) uses the series; any other name keeps
-- the original behaviour (PREFIX-YYYY-NNNNN, yearly counter).
CREATE OR REPLACE FUNCTION next_number(p_name text, p_prefix text, p_width int DEFAULT 5)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE c text := replace(p_name, '-', '_'); v bigint; yr text;
BEGIN
  IF EXISTS (SELECT 1 FROM document_numbering WHERE code = c) THEN RETURN next_document_number(c); END IF;
  yr := to_char(numbering_business_date(), 'YYYY');
  INSERT INTO sequences(name, period, value) VALUES (p_name, yr, 1)
    ON CONFLICT (name, period) DO UPDATE SET value = sequences.value + 1
    RETURNING value INTO v;
  RETURN p_prefix || '-' || yr || '-' || lpad(v::text, p_width, '0');
END $$;

-- Seed scripts read prefixes through numbering_prefix(): the series is the source, the setting a fallback.
CREATE OR REPLACE FUNCTION numbering_prefix(p_entity text, p_default text) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT COALESCE((SELECT prefix FROM document_numbering WHERE code = replace(p_entity, '-', '_')),
                  (SELECT value #>> '{}' FROM app_settings WHERE key = 'numbering.' || p_entity || '.prefix'), p_default)
$$;

-- The numbering.<code>.prefix settings become a read-only mirror of the series prefix (edited on Master > Document Numbering).
CREATE OR REPLACE FUNCTION document_numbering_mirror_prefix() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO app_settings(key, value, "group", label, type, editable)
    VALUES ('numbering.' || NEW.code || '.prefix', to_jsonb(NEW.prefix), 'numbering', NEW.name || ' number prefix (Master > Document Numbering)', 'string', false)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, editable = false, updated_at = now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS document_numbering_mirror ON document_numbering;
CREATE TRIGGER document_numbering_mirror AFTER INSERT OR UPDATE OF prefix ON document_numbering FOR EACH ROW EXECUTE FUNCTION document_numbering_mirror_prefix();

-- ---------- series ----------
-- Prefixes: the current numbering.<code>.prefix setting when there is one (an existing installation), else the default.
INSERT INTO document_numbering(code, name, module, prefix, description, created_by)
SELECT s.code, s.name, s.module, COALESCE(NULLIF(btrim((SELECT value #>> '{}' FROM app_settings WHERE key = 'numbering.' || s.code || '.prefix')), ''), s.prefix),
       s.description, 'migration'
FROM (VALUES
  ('lead', 'Lead', 'sales', 'LD', 'Lead / prospect number'),
  ('quote', 'Quotation', 'sales', 'QT', 'Quotation number'),
  ('client', 'Client Code', 'sales', 'CL', 'Client code'),
  ('policy', 'Policy', 'policy', 'POL', 'Policy number when the insurer''s number is not given'),
  ('endorsement', 'Endorsement', 'policy', 'END', 'Endorsement number'),
  ('renewal', 'Renewal', 'renewals', 'RN', 'Renewal record number'),
  ('renewal_quote', 'Renewal Quotation', 'renewals', 'RQ', 'Renewal quotation number'),
  ('renewal_batch', 'Renewal Batch', 'renewals', 'RB', 'Batch renewal number'),
  ('campaign', 'Win-back Campaign', 'renewals', 'WB', 'Win-back campaign number'),
  ('claim', 'Claim', 'claims', 'CLM', 'Claim number'),
  ('broker_slip', 'Broker Slip', 'placement', 'BS', 'Broker slip sent to insurers'),
  ('placement', 'Placement Slip', 'placement', 'PS', 'Placement slip'),
  ('insurer_offer', 'Insurer Offer', 'placement', 'OFR', 'Insurer offer / quotation received'),
  ('receipt', 'Official Receipt', 'finance', 'OR', 'Official receipt number'),
  ('receipt_txn', 'Receipt Transaction', 'finance', 'RT', 'Receipt transaction number'),
  ('invoice', 'Invoice / Bill', 'finance', 'INV', 'Premium bill (receivable) number'),
  ('voucher', 'Payment Voucher', 'finance', 'PV', 'Payment voucher number'),
  ('disbursement_txn', 'Disbursement Transaction', 'finance', 'DT', 'Payment voucher transaction number'),
  ('invoice_list', 'Payable (Invoice List)', 'finance', 'IL', 'Payable (invoice list) number'),
  ('petty_cash', 'Petty Cash Transaction', 'finance', 'PC', 'Petty cash transaction number'),
  ('petty_cash_request', 'Petty Cash Request', 'finance', 'PCR', 'Petty cash request number'),
  ('petty_cash_receipt', 'Petty Cash Receipt', 'finance', 'PCRC', 'Petty cash receipt number'),
  ('commission_debit_note', 'Commission Debit Note', 'finance', 'DN', 'Commission debit note to an insurer (direct bill)'),
  ('dn_collection', 'Debit Note Collection', 'finance', 'DNC', 'Insurer payment of commission debit notes'),
  ('journal', 'Journal Voucher', 'accounting', 'JV', 'Journal voucher number'),
  ('period_close', 'Month-end Close', 'accounting', 'MEC', 'Accounting period (month-end) close'),
  ('year_end_close', 'Year-end Close', 'accounting', 'YEC', 'Year-end close'),
  ('recurring_journal', 'Recurring Journal', 'accounting', 'RJV', 'Recurring journal template / run'),
  ('bir_2307', 'BIR Form 2307', 'accounting', 'CWT', 'Certificate of creditable tax withheld at source (BIR 2307)'),
  ('remittance', 'Remittance', 'remittance', 'REM', 'Remittance number'),
  ('remittance_bill', 'Direct / Agency Bill', 'remittance', 'BIL', 'Direct / agency bill number'),
  ('remittance_batch', 'Remittance Batch', 'remittance', 'BLK', 'Remittance processing batch'),
  ('settlement', 'Settlement', 'remittance', 'SET', 'Settlement reference'),
  ('adjustment', 'Remittance Adjustment', 'remittance', 'ADJ', 'Remittance adjustment'),
  ('transfer', 'Electronic Transfer', 'remittance', 'TRF', 'Electronic transfer reference'),
  ('statement', 'Remittance Statement', 'remittance', 'STMT', 'Remittance statement'),
  ('remittance_exception', 'Remittance Exception', 'remittance', 'EXC', 'Remittance exception'),
  ('remittance_notice', 'Remittance Notification', 'remittance', 'NTF', 'Remittance notification'),
  ('remittance_schedule', 'Remittance Schedule', 'remittance', 'SCH', 'Remittance schedule'),
  ('remittance_report', 'Remittance Report', 'remittance', 'RPT', 'Remittance report'),
  ('bank_txn', 'Bank Transaction', 'remittance', 'BNK', 'Imported bank transaction'),
  ('reinsurer', 'Reinsurer', 'reinsurance', 'RE', 'Reinsurer id when none is entered'),
  ('treaty', 'Treaty', 'reinsurance', 'TRT', 'Treaty number when none is entered'),
  ('cession', 'Cession', 'reinsurance', 'CES', 'Cession number'),
  ('ri_recovery', 'RI Recovery Claim', 'reinsurance', 'RCL', 'Reinsurance recovery claim'),
  ('bordereau', 'Bordereau', 'reinsurance', 'BDX', 'Bordereau reference'),
  ('ri_reconciliation', 'RI Reconciliation', 'reinsurance', 'REC', 'Reinsurance reconciliation'),
  ('incentive_program', 'Incentive Program', 'incentive', 'INC', 'Incentive program code'),
  ('incentive_calc', 'Incentive Calculation', 'incentive', 'CALC', 'Incentive calculation batch'),
  ('product_template', 'Product Template', 'product', 'TPL', 'Product template code when none is entered')
) AS s(code, name, module, prefix, description)
ON CONFLICT (code) DO NOTHING;

-- Prefixes must be unique across active series: a duplicate carried over from the settings gets the series code appended.
UPDATE document_numbering d SET prefix = left(d.prefix || upper(regexp_replace(d.code, '[^a-z0-9]', '', 'g')), 20)
WHERE EXISTS (SELECT 1 FROM document_numbering o WHERE o.id < d.id AND upper(o.prefix) = upper(d.prefix));
CREATE UNIQUE INDEX IF NOT EXISTS document_numbering_active_prefix ON document_numbering (upper(prefix)) WHERE active;

-- Counters carry over: the hyphenated sequence names used before (receipt-txn, invoice-list, disbursement-txn,
-- petty-cash, petty-cash-request, petty-cash-receipt) move to the series code; the higher value wins.
INSERT INTO sequences(name, period, value)
SELECT replace(q.name, '-', '_'), q.period, q.value FROM sequences q
WHERE q.name LIKE '%-%' AND replace(q.name, '-', '_') IN (SELECT code FROM document_numbering)
ON CONFLICT (name, period) DO UPDATE SET value = GREATEST(sequences.value, EXCLUDED.value);
DELETE FROM sequences WHERE name LIKE '%-%' AND replace(name, '-', '_') IN (SELECT code FROM document_numbering);
