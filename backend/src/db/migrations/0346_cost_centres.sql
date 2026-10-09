-- Cost centres (TIS-BRD-GL-04 "cost centres taggable", FGA workbook sheet FGA.04; the cost centre report RPT-FGA-08):
--   master type cost-centre   Master > Finance > Cost Centres: code, name, company, department, responsible person,
--                             validity, default flag (the cost centre stamped on journal lines that name none)
--   journal_lines.cost_centre the cost centre of each journal line (manual vouchers choose it; every other journal takes
--                             the default cost centre); shown on the journal voucher, the accounting query and its export,
--                             the general ledger detail report and the SAP GL file
-- Lines posted before this migration keep an empty cost centre. Idempotent.

INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by) VALUES
 ('cost-centre', 'Cost Centre', 'finance', '/master/finance/cost-centres', 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Cost Centre Code","type":"string","required":true},{"name":"name","label":"Cost Centre","type":"string","required":true},{"name":"companyCode","label":"Company","type":"string","required":false,"optionsFrom":"company"},{"name":"controllingArea","label":"Controlling Area","type":"string","required":false},{"name":"department","label":"Department","type":"string","required":false,"optionsFrom":"department"},{"name":"responsiblePerson","label":"Responsible Person","type":"string","required":false},{"name":"validFrom","label":"Valid From","type":"date","required":false},{"name":"validTo","label":"Valid To","type":"date","required":false},{"name":"isDefault","label":"Default Cost Centre","type":"boolean","required":false},{"name":"description","label":"Description","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 162, true, 'migration:0346')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE journal_lines ADD COLUMN IF NOT EXISTS cost_centre text;
CREATE INDEX IF NOT EXISTS journal_lines_cost_centre_idx ON journal_lines(cost_centre) WHERE cost_centre IS NOT NULL;

-- General ledger detail: the cost centre after the source column (administrator column edits are kept)
UPDATE report_definitions d SET default_columns = (
    SELECT jsonb_agg(x.col ORDER BY x.ord, x.sub) FROM (
      SELECT c.col, c.ord, 0 AS sub FROM jsonb_array_elements(d.default_columns) WITH ORDINALITY AS c(col, ord)
      UNION ALL
      SELECT '{"key":"costCentre","label":"Cost Centre","type":"text"}'::jsonb,
             COALESCE((SELECT o.ord FROM jsonb_array_elements(d.default_columns) WITH ORDINALITY AS o(col, ord) WHERE o.col->>'key' = 'source'),
                      jsonb_array_length(d.default_columns)), 1) x),
  updated_at = now()
WHERE d.code = 'gl-detail' AND NOT d.default_columns @> '[{"key":"costCentre"}]';
