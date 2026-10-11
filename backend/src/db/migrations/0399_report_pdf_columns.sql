-- Bank Reconciliation Statement report: the printed PDF leaves out the columns that repeat what the other columns
-- already say (account name, GL account, period, preparation and approval times), so the statement fits a landscape
-- page with whole column headers. The Excel and CSV files keep every column.
UPDATE report_definitions d SET default_columns = (
    SELECT jsonb_agg(CASE WHEN c.col->>'key' IN ('bankAccountName', 'glAccount', 'period', 'preparedAt', 'approvedAt')
      THEN c.col || '{"pdf": false}'::jsonb ELSE c.col END ORDER BY c.ord)
    FROM jsonb_array_elements(d.default_columns) WITH ORDINALITY AS c(col, ord)),
  updated_at = now()
WHERE d.code = 'bank-reconciliation-statement' AND jsonb_typeof(d.default_columns) = 'array';
