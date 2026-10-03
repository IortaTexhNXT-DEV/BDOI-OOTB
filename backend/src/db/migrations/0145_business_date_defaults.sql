-- Business-date column defaults: every "date NOT NULL DEFAULT current_date" column (journal voucher date, receipt date,
-- voucher date, remittance date, ...) takes today's business date in general.timezone (Asia/Manila by the seed) instead
-- of the database server's date, which is still yesterday in Manila until 08:00 when the server runs on UTC.
-- numbering_business_date() (migration 0121) applies the same rule as src/lib/dates.js today().
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND data_type = 'date' AND lower(column_default) = 'current_date'
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT numbering_business_date()', c.table_name, c.column_name);
  END LOOP;
END $$;
