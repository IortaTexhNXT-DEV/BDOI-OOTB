-- Offices and document numbering per the TISPH structure (TIS-BRD-MAS-02, TIS-BRD-DOC-01, Pre-BSM M21, MOM session 10).
--
-- Branch master: Issuing Office (the office whose code enters document numbers), Region and Numbering Code (the digit
-- the office contributes to a numeric reference). Office-level data scope: security.office_scoped_roles.
--
-- Numbering tokens added to the series patterns: {OFFICE} (numbering code of the issuing office), {PRODUCT},
-- {SUBLINE}, {BUSINESS} (codes of the Numbering Segments master for the product, the sub-line / policy type and the
-- business type new / renewal) and {PARENT} (the number of the parent document: an endorsement or a cancellation
-- notice numbered under its policy). Reset rule per_document counts under the parent number. The TIS Policy Number
-- proposed by the panel (PRN 1101000001 = product type, sub-line, business type, office + a 6-digit sequence), the
-- cover note CN-YY-HO-#######, the endorsement ENDT-<PRN>-nn, the cancellation notice CAN-<PRN>-n and the placement slip
-- PS/HO/YY/##### are held in the setting numbering.structure and applied from Master > Document Numbering (Apply
-- numbering structure), so the delivered series keep their format until TISPH confirms the structure. Idempotent.

-- ---------------------------------------------------------------- branch master fields
UPDATE master_types SET fields = fields || $j$[
  {"name":"IssuingOffice","label":"Issuing Office","type":"boolean","required":false,"default":false},
  {"name":"Region","label":"Region","type":"select","required":false,"options":["NCR","CAR","Region I","Region II","Region III","Region IV-A","MIMAROPA","Region V","Region VI","Region VII","Region VIII","Region IX","Region X","Region XI","Region XII","Region XIII","BARMM"]},
  {"name":"NumberingCode","label":"Numbering Code","type":"string","required":false,"maxLength":3}
]$j$::jsonb, updated_at = now()
WHERE code = 'branch' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'name' = 'IssuingOffice');

ALTER TABLE branches ADD COLUMN IF NOT EXISTS attrs jsonb NOT NULL DEFAULT '{}'::jsonb;
-- the head office issues documents; its numbering code is the first digit of the office segment
UPDATE branches SET attrs = attrs || '{"IssuingOffice": true, "Region": "NCR", "NumberingCode": "1"}'::jsonb
 WHERE code = 'HO' AND NOT (attrs ? 'IssuingOffice');

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('security.office_scoped_roles', '[]', 'security', 'Roles whose holders only see the records of their own office (branch of the user; office-level data scope)', 'json', true),
 ('numbering.default_office', '"HO"', 'numbering', 'Office whose code enters document numbers when the user has no office', 'string', true)
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------- numbering segments master
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by)
VALUES ($s$numbering-segment$s$, $s$Numbering Segment$s$, $s$general$s$, NULL, $s$generic$s$, NULL, $s$code$s$, $s$name$s$,
  $j$[{"name":"code","label":"Code","type":"string","required":true},
      {"name":"name","label":"Name","type":"string","required":true},
      {"name":"segment","label":"Segment","type":"select","required":true,"options":["PRODUCT","SUBLINE","BUSINESS"]},
      {"name":"key","label":"Key","type":"string","required":true},
      {"name":"value","label":"Value","type":"string","required":true,"maxLength":3},
      {"name":"description","label":"Description","type":"text","required":false}]$j$,
  $j$[["code"],["segment","key"]]$j$, false, 95, true, 'seed')
ON CONFLICT (code) DO NOTHING;

-- TISPH proposal (decision PLAT-NUM-01): product type, sub-line and business type digits of the TIS Policy Number
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'numbering-segment', v.code, v.name,
       jsonb_build_object('code', v.code, 'name', v.name, 'segment', v.segment, 'key', v.key, 'value', v.value, 'description', v.description), 'active', 'seed'
FROM (VALUES
  ('PRODUCT-MOTOR', 'Motor', 'PRODUCT', 'MOTOR', '1', 'Motor comprehensive (own damage, theft, liabilities)'),
  ('PRODUCT-CTPL', 'CTPL', 'PRODUCT', 'CTPL', '2', 'Compulsory third party liability'),
  ('PRODUCT-PA', 'Personal Accident', 'PRODUCT', 'PA', '3', 'Personal accident'),
  ('PRODUCT-GPA', 'Group Personal Accident', 'PRODUCT', 'GPA', '3', 'Group personal accident'),
  ('PRODUCT-TRAVEL', 'Travel', 'PRODUCT', 'TRAVEL', '4', 'Travel insurance'),
  ('PRODUCT-CL-COMP', 'Credit Life - Compulsory', 'PRODUCT', 'CL-COMP', '5', 'Credit life, compulsory'),
  ('PRODUCT-CL-VOL', 'Credit Life - Voluntary', 'PRODUCT', 'CL-VOL', '5', 'Credit life, voluntary'),
  ('PRODUCT-PARCEL', 'Parcel / Courier', 'PRODUCT', 'PARCEL', '6', 'Parcel and courier insurance'),
  ('SUBLINE-COMP', 'Comprehensive', 'SUBLINE', 'COMP', '1', 'Comprehensive cover'),
  ('SUBLINE-CTPL', 'CTPL', 'SUBLINE', 'CTPL', '2', 'Compulsory third party liability only'),
  ('SUBLINE-STANDARD', 'Standard', 'SUBLINE', 'STANDARD', '1', 'Standard cover of the product'),
  ('SUBLINE-DEFAULT', 'Not classified', 'SUBLINE', '*', '0', 'Used when the policy type has no segment code'),
  ('BUSINESS-NEW', 'New business', 'BUSINESS', 'NEW', '1', 'New policy'),
  ('BUSINESS-RENEWAL', 'Renewal', 'BUSINESS', 'RENEWAL', '2', 'Renewal of an expiring policy')
) AS v(code, name, segment, key, value, description)
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'numbering-segment' AND lower(code) = lower(v.code));

-- ---------------------------------------------------------------- series: reset rule per_document, cancellation notice
ALTER TABLE document_numbering DROP CONSTRAINT IF EXISTS document_numbering_reset_rule_check;
ALTER TABLE document_numbering ADD CONSTRAINT document_numbering_reset_rule_check CHECK (reset_rule IN ('yearly', 'fiscal_yearly', 'monthly', 'never', 'per_document'));

INSERT INTO document_numbering(code, name, module, prefix, description, active, created_by)
VALUES ('cancellation_notice', 'Cancellation Notice', 'policy', 'CAN', 'Cancellation notice of a policy (a cancellation endorsement numbered under its policy); when inactive, cancellations take an endorsement number', false, 'migration')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------- functions
-- Counter period key: per_document counts under the parent document number (given at issue time).
CREATE OR REPLACE FUNCTION numbering_period_key(p_reset text, p_date date) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE p_reset
    WHEN 'monthly' THEN to_char(p_date, 'YYYY-MM')
    WHEN 'fiscal_yearly' THEN 'FY' || numbering_fiscal_year(p_date)
    WHEN 'never' THEN 'ALL'
    WHEN 'per_document' THEN 'PER-DOCUMENT'
    ELSE to_char(p_date, 'YYYY') END
$$;

-- Format a number from a pattern; p_segments holds the values of {OFFICE}, {PRODUCT}, {SUBLINE}, {BUSINESS} and {PARENT}.
DROP FUNCTION IF EXISTS format_document_number(text, text, int, bigint, date, text, text);
CREATE OR REPLACE FUNCTION format_document_number(p_pattern text, p_prefix text, p_width int, p_seq bigint, p_date date,
  p_branch text DEFAULT NULL, p_lob text DEFAULT NULL, p_segments jsonb DEFAULT NULL) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE s text := p_pattern; k text;
BEGIN
  s := replace(s, '{PREFIX}', COALESCE(p_prefix, ''));
  s := replace(s, '{YYYY}', to_char(p_date, 'YYYY'));
  s := replace(s, '{YY}', to_char(p_date, 'YY'));
  s := replace(s, '{MM}', to_char(p_date, 'MM'));
  IF position('{FY}' IN s) > 0 THEN s := replace(s, '{FY}', numbering_fiscal_year(p_date)::text); END IF;
  s := numbering_optional_token(s, '{BRANCH}', upper(btrim(COALESCE(p_branch, ''))));
  s := numbering_optional_token(s, '{LOB}', upper(btrim(COALESCE(p_lob, ''))));
  FOREACH k IN ARRAY ARRAY['OFFICE', 'PRODUCT', 'SUBLINE', 'BUSINESS', 'PARENT'] LOOP
    s := numbering_optional_token(s, '{' || k || '}', upper(btrim(COALESCE(p_segments ->> k, ''))));
  END LOOP;
  RETURN replace(s, '{SEQ}', lpad(p_seq::text, GREATEST(p_width, length(p_seq::text)), '0'));
END $$;

-- Issue the next number; a per_document series counts under the parent number in p_segments ->> 'PARENT'.
DROP FUNCTION IF EXISTS next_document_number(text, text, text, date);
CREATE OR REPLACE FUNCTION next_document_number(p_code text, p_branch text DEFAULT NULL, p_lob text DEFAULT NULL, p_date date DEFAULT NULL, p_segments jsonb DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE s document_numbering%ROWTYPE; d date := COALESCE(p_date, numbering_business_date()); v bigint; k text;
BEGIN
  SELECT * INTO s FROM document_numbering WHERE code = p_code FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document numbering series % is not configured (Master > Document Numbering)', p_code USING ERRCODE = '22023'; END IF;
  IF NOT s.active THEN RAISE EXCEPTION 'Document numbering series % (%) is inactive (Master > Document Numbering)', s.code, s.name USING ERRCODE = '22023'; END IF;
  IF s.reset_rule = 'per_document' THEN
    k := btrim(COALESCE(p_segments ->> 'PARENT', ''));
    IF k = '' THEN RAISE EXCEPTION 'Document numbering series % (%) counts per document: the parent document number is required', s.code, s.name USING ERRCODE = '22023'; END IF;
    k := 'DOC:' || k;
  ELSE
    k := numbering_period_key(s.reset_rule, d);
  END IF;
  INSERT INTO sequences(name, period, value)
    VALUES (s.code, k, CASE WHEN s.period_start_key = k AND s.period_start_number IS NOT NULL THEN s.period_start_number ELSE s.start_number END)
    ON CONFLICT (name, period) DO UPDATE SET value = sequences.value + 1
    RETURNING value INTO v;
  RETURN format_document_number(s.pattern, s.prefix, s.seq_width, v, d, p_branch, p_lob, p_segments);
END $$;

-- ---------------------------------------------------------------- the structure proposed for TISPH
INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('numbering.structure', $j${
   "policy": {"name": "TIS Policy Number (PRN)", "prefix": "PRN", "pattern": "{PRODUCT}{SUBLINE}{BUSINESS}{OFFICE}{SEQ}", "seqWidth": 6, "resetRule": "never"},
   "cover_note": {"prefix": "CN", "pattern": "{PREFIX}-{YY}-{BRANCH}-{SEQ}", "seqWidth": 7, "resetRule": "yearly"},
   "endorsement": {"prefix": "ENDT", "pattern": "{PREFIX}-{PARENT}-{SEQ}", "seqWidth": 2, "resetRule": "per_document"},
   "cancellation_notice": {"prefix": "CAN", "pattern": "{PREFIX}-{PARENT}-{SEQ}", "seqWidth": 1, "resetRule": "per_document", "active": true},
   "placement": {"prefix": "PS", "pattern": "{PREFIX}/{BRANCH}/{YY}/{SEQ}", "seqWidth": 5, "resetRule": "yearly"}
 }$j$::jsonb, 'numbering', 'Document numbering structure proposed for TISPH (Pre-BSM M21): applied from Master > Document Numbering', 'json', true)
ON CONFLICT (key) DO NOTHING;
