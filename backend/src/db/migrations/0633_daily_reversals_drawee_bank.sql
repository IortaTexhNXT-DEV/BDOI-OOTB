-- Daily Reversals Report (TIS-BRD-RPT-CCD-02): the drawee bank of the reversed receipt or bounced cheque, after the
-- cheque number, on a database where the report is already in the catalogue (a new database takes it from seed 95).
-- A layout changed on the screen keeps its columns apart from this one. Idempotent.

UPDATE report_definitions d
   SET default_columns = (SELECT jsonb_agg(c ORDER BY n) FROM (
         SELECT c, n FROM jsonb_array_elements(d.default_columns) WITH ORDINALITY AS x(c, n)
         UNION ALL
         SELECT '{"key":"draweeBank","label":"Drawee Bank","type":"text"}'::jsonb,
                COALESCE((SELECT n FROM jsonb_array_elements(d.default_columns) WITH ORDINALITY AS y(c, n) WHERE c->>'key' = 'chequeNumber'), 1000) + 0.5) z)
 WHERE d.code = 'tisph-daily-reversals'
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(d.default_columns) c WHERE c->>'key' = 'draweeBank');
