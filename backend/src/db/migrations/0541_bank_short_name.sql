-- A bank gets a short name (Metrobank, BDO, BPI) for lists where its registered name is too long to read on one
-- line: the PDC tracking log shows the short name with the cheque number and keeps the full name on hover. The Bank
-- master edits it through the bank master type. The seeded Philippine banks get theirs here; a bank added by an
-- administrator shows its code until a short name is given. Forward-only and idempotent.

ALTER TABLE banks ADD COLUMN IF NOT EXISTS short_name text;

UPDATE banks b SET short_name = v.short_name FROM (VALUES
 ('BDO', 'BDO'), ('BPI', 'BPI'), ('MBT', 'Metrobank'), ('LBP', 'Landbank'), ('PNB', 'PNB'), ('SECB', 'Security Bank'), ('UBP', 'UnionBank'),
 ('RCBC', 'RCBC'), ('CBC', 'Chinabank'), ('EWB', 'EastWest'), ('DBP', 'DBP'), ('PSB', 'PSBank'), ('AUB', 'AUB'), ('MAYBANK', 'Maybank'),
 ('PBCOM', 'PBCOM'), ('BOC', 'Bank of Commerce'), ('PVB', 'Veterans Bank')
) AS v(code, short_name)
WHERE upper(b.code) = v.code AND COALESCE(b.short_name, '') = '';

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(e ORDER BY i) FROM (
    SELECT e, i FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS a(e, i)
    UNION ALL
    SELECT '{"name":"shortName","label":"Short Name","type":"string","required":false,"column":"short_name","maxLength":30}'::jsonb,
           (SELECT i + 0.5 FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS b(e, i) WHERE e->>'name' = 'bankName')
  ) x)
WHERE t.code = 'bank' AND NOT t.fields @> '[{"name":"shortName"}]';
