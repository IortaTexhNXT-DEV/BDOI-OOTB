-- Source column on the production register: policies of the old system loaded by the go-live migration ("Migrated")
-- are told apart from business written in BrokerVerse; Report Criteria "Source" groups by it. Idempotent.
UPDATE report_definitions SET default_columns = default_columns || '[{"key":"source","label":"Source","type":"text"}]'::jsonb, updated_at = now()
 WHERE code = 'production-register' AND NOT default_columns @> '[{"key":"source"}]'::jsonb;
UPDATE report_definitions SET parameters = jsonb_set(parameters, '{properties,ReportCriteria,enum}', (parameters #> '{properties,ReportCriteria,enum}') || '["Source"]'::jsonb), updated_at = now()
 WHERE code = 'production-register' AND NOT (parameters #> '{properties,ReportCriteria,enum}') @> '["Source"]'::jsonb;
