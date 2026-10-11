-- Origin of the records on the reports (Data Migration & Go-Live): the criterion Origin that 68_report_source.sql adds to
-- the claims, receivables, collections, receipts, commission and renewal reports, again after the seeds that redefine
-- their criteria (92_renewals_claims.sql: Claims Position). Runs on a new database and on every start of an existing
-- one. Idempotent: a report that already offers Origin is left as it is.
UPDATE report_definitions SET parameters = jsonb_set(parameters, '{properties,ReportCriteria,enum}', (parameters #> '{properties,ReportCriteria,enum}') || '["Origin"]'::jsonb), updated_at = now()
 WHERE code IN ('claims-position', 'claims-ageing', 'premium-receivable-soa', 'collections-ageing', 'collections-summary', 'commission-statement', 'receipts-register',
                'renewal-retention')
   AND jsonb_typeof(parameters #> '{properties,ReportCriteria,enum}') = 'array' AND NOT (parameters #> '{properties,ReportCriteria,enum}') @> '["Origin"]'::jsonb;
