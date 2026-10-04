-- Configured next number of a counter period. Setting the next number of a series (Master > Document Numbering > Set
-- next number, or the Numbering sheet of the go-live configuration workbook: the last number of the old system + 1)
-- now also records it on the series as the start of that period's counter. A counter row created for that period
-- (after the transaction reset deleted it) starts there instead of at start_number, so a reset before go-live restarts
-- each series at the number the broker configured, not at 1. Other periods (next year of a yearly series) still start
-- at start_number.
ALTER TABLE document_numbering ADD COLUMN IF NOT EXISTS period_start_key text;
ALTER TABLE document_numbering ADD COLUMN IF NOT EXISTS period_start_number bigint;
COMMENT ON COLUMN document_numbering.period_start_key IS 'Counter period (numbering_period_key) whose counter starts at period_start_number';
COMMENT ON COLUMN document_numbering.period_start_number IS 'Configured next number of period period_start_key (Set next number / go-live Numbering sheet)';

-- First number of a series' counter in a period: the configured next number of that period, else start_number.
CREATE OR REPLACE FUNCTION numbering_start_number(p_code text, p_period text) RETURNS bigint LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN d.period_start_key = p_period AND d.period_start_number IS NOT NULL THEN d.period_start_number ELSE d.start_number END
  FROM document_numbering d WHERE d.code = p_code
$$;

CREATE OR REPLACE FUNCTION next_document_number(p_code text, p_branch text DEFAULT NULL, p_lob text DEFAULT NULL, p_date date DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE s document_numbering%ROWTYPE; d date := COALESCE(p_date, numbering_business_date()); v bigint; k text;
BEGIN
  SELECT * INTO s FROM document_numbering WHERE code = p_code FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document numbering series % is not configured (Master > Document Numbering)', p_code USING ERRCODE = '22023'; END IF;
  IF NOT s.active THEN RAISE EXCEPTION 'Document numbering series % (%) is inactive (Master > Document Numbering)', s.code, s.name USING ERRCODE = '22023'; END IF;
  k := numbering_period_key(s.reset_rule, d);
  INSERT INTO sequences(name, period, value)
    VALUES (s.code, k, CASE WHEN s.period_start_key = k AND s.period_start_number IS NOT NULL THEN s.period_start_number ELSE s.start_number END)
    ON CONFLICT (name, period) DO UPDATE SET value = sequences.value + 1
    RETURNING value INTO v;
  RETURN format_document_number(s.pattern, s.prefix, s.seq_width, v, d, p_branch, p_lob);
END $$;
