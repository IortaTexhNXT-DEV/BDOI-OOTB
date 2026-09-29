-- Report criteria "Principle Insurance" is spelled "Principal Insurer" (persona walk 2). Saved schedules keep working:
-- the report engine still accepts the old value as an alias.
UPDATE report_definitions
   SET parameters = replace(parameters::text, '"Principle Insurance"', '"Principal Insurer"')::jsonb, updated_at = now()
 WHERE parameters::text LIKE '%"Principle Insurance"%';

UPDATE report_schedules
   SET params = jsonb_set(params, '{ReportCriteria}', '"Principal Insurer"'), updated_at = now()
 WHERE params->>'ReportCriteria' = 'Principle Insurance';
