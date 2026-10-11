-- Origin column, criteria and filter on the production register and the dealer production report (migration 0440,
-- Data Migration & Go-Live): policies of the old system loaded at go-live ("Migrated") are told apart from business
-- issued in BrokerVerse ("Issued in BrokerVerse"); Report Criteria "Origin" groups by it and the Origin filter keeps one
-- of them (premium by product and new business vs renewals take the filter too). The same on the reports where migrated
-- and new business meet after go-live: claims (the claim migrated or registered), receivables and collections (the open
-- item migrated or the bill issued), receipts (what they collect), commission and renewals (the policy). Replaces the
-- Source column and criteria of the earlier version of this file. Idempotent.
UPDATE report_definitions SET default_columns = (SELECT COALESCE(jsonb_agg(c ORDER BY i), '[]'::jsonb) FROM jsonb_array_elements(default_columns) WITH ORDINALITY AS x(c, i)
    WHERE c->>'key' <> 'source'), updated_at = now()
 WHERE code = 'production-register' AND default_columns @> '[{"key":"source"}]'::jsonb;
UPDATE report_definitions SET default_columns = default_columns || '[{"key":"origin","label":"Origin","type":"text"}]'::jsonb, updated_at = now()
 WHERE code IN ('production-register', 'dealer-production') AND NOT default_columns @> '[{"key":"origin"}]'::jsonb;
UPDATE report_definitions SET parameters = jsonb_set(parameters, '{properties,ReportCriteria,enum}', (SELECT COALESCE(jsonb_agg(e ORDER BY i), '[]'::jsonb)
    FROM jsonb_array_elements(parameters #> '{properties,ReportCriteria,enum}') WITH ORDINALITY AS x(e, i) WHERE e <> '"Source"'::jsonb)), updated_at = now()
 WHERE code = 'production-register' AND (parameters #> '{properties,ReportCriteria,enum}') @> '["Source"]'::jsonb;
UPDATE report_definitions SET parameters = jsonb_set(parameters, '{properties,ReportCriteria,enum}', (parameters #> '{properties,ReportCriteria,enum}') || '["Origin"]'::jsonb), updated_at = now()
 WHERE code IN ('production-register', 'dealer-production') AND NOT (parameters #> '{properties,ReportCriteria,enum}') @> '["Origin"]'::jsonb;
UPDATE report_definitions SET parameters = jsonb_set(parameters, '{properties,Origin}', '{"type":"string","title":"Origin","enum":["Issued in BrokerVerse","Migrated"]}'::jsonb), updated_at = now()
 WHERE code IN ('production-register', 'premium-by-product', 'new-vs-renewal', 'dealer-production') AND parameters ? 'properties' AND NOT (parameters -> 'properties') ? 'Origin';

UPDATE report_definitions SET default_columns = default_columns || '[{"key":"origin","label":"Origin","type":"text"}]'::jsonb, updated_at = now()
 WHERE code IN ('claims-position', 'premium-receivable-soa', 'collections-ageing', 'collections-summary', 'commission-statement', 'receipts-register', 'renewal-retention')
   AND NOT default_columns @> '[{"key":"origin"}]'::jsonb;
UPDATE report_definitions SET parameters = jsonb_set(parameters, '{properties,ReportCriteria,enum}', (parameters #> '{properties,ReportCriteria,enum}') || '["Origin"]'::jsonb), updated_at = now()
 WHERE code IN ('claims-position', 'claims-ageing', 'premium-receivable-soa', 'collections-ageing', 'collections-summary', 'commission-statement', 'receipts-register',
                'renewal-retention')
   AND jsonb_typeof(parameters #> '{properties,ReportCriteria,enum}') = 'array' AND NOT (parameters #> '{properties,ReportCriteria,enum}') @> '["Origin"]'::jsonb;
UPDATE report_definitions SET parameters = jsonb_set(parameters, '{properties,Origin}', '{"type":"string","title":"Origin","enum":["Issued in BrokerVerse","Migrated"]}'::jsonb), updated_at = now()
 WHERE code IN ('claims-position', 'claims-ageing', 'premium-receivable-soa', 'collections-ageing', 'collections-summary', 'commission-statement', 'receipts-register',
                'renewal-retention')
   AND parameters ? 'properties' AND NOT (parameters -> 'properties') ? 'Origin';
