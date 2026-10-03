-- Master codes issued by the system and open-ended effective dates.
--
-- Commission, employee and petty cash fund codes come from Document Numbering series instead of being typed in
-- (a field declared with "numbering" gets the next number when a record is saved without one). Effective To is
-- optional on the commission, taxation and exchange rate masters (blank = open ended) and may not be earlier
-- than Effective From ("notBefore"). A commission record covers a list of covers and applies to every sales
-- person when none is chosen ("blankMatchesAll").
-- A new database gets the same definitions from seeds/51_masters.sql (the types are seeded after migrations).

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('commission_master', 'Commission Code', 'masters', 'COM', '{PREFIX}-{SEQ}', 5, 'never', 'Code of a commission master record (Master > Generals > Commission)', 'migration'),
 ('employee', 'Employee Code', 'masters', 'EMP', '{PREFIX}-{SEQ}', 4, 'never', 'Employee code (Master > Generals > Employee Management > Employee)', 'migration'),
 ('petty_cash_fund', 'Petty Cash Code', 'masters', 'PCF', '{PREFIX}-{SEQ}', 3, 'never', 'Code of a petty cash fund (Master > Finance > Petty Cash)', 'migration')
ON CONFLICT (code) DO NOTHING;

-- Merge a patch object into the named field of a master type definition.
CREATE OR REPLACE FUNCTION pg_temp.patch_master_field(type_code text, field_name text, patch jsonb) RETURNS void LANGUAGE sql AS $$
  UPDATE master_types t SET fields = (
    SELECT jsonb_agg(CASE WHEN e->>'name' = field_name THEN e || patch ELSE e END ORDER BY i)
    FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS a(e, i))
  WHERE t.code = type_code AND t.fields @> jsonb_build_array(jsonb_build_object('name', field_name));
$$;

SELECT pg_temp.patch_master_field('commission', 'commissionCode', '{"numbering":"commission_master"}');
SELECT pg_temp.patch_master_field('commission', 'selectCover', '{"label":"Covers","type":"multiselect"}');
SELECT pg_temp.patch_master_field('commission', 'selectAgent', '{"label":"Sales person","required":false,"blankMatchesAll":true}');
SELECT pg_temp.patch_master_field('commission', 'effectiveTo', '{"required":false,"notBefore":"effectiveFrom"}');
SELECT pg_temp.patch_master_field('employee', 'employeeCode', '{"numbering":"employee"}');
SELECT pg_temp.patch_master_field('petty-cash', 'pettycashcode', '{"numbering":"petty_cash_fund"}');
SELECT pg_temp.patch_master_field('taxation', 'effectiveTo', '{"required":false,"notBefore":"effectiveFrom"}');
SELECT pg_temp.patch_master_field('exchange-rate', 'EffectiveTo', '{"required":false,"notBefore":"EffectiveFrom"}');
SELECT pg_temp.patch_master_field('account-setup', 'effectiveTo', '{"notBefore":"effectiveFrom"}');

-- Commission records kept one cover as text; they now keep a list.
UPDATE master_records SET data = jsonb_set(data, '{selectCover}',
  CASE WHEN COALESCE(btrim(data->>'selectCover'), '') = '' THEN '[]'::jsonb ELSE jsonb_build_array(data->>'selectCover') END)
WHERE type_code = 'commission' AND jsonb_typeof(data->'selectCover') IS DISTINCT FROM 'array';
