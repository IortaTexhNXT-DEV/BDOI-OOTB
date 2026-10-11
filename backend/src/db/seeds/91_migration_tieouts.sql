-- Accounts of the sub-ledger tie-outs of the reconciliation of migration loads (setting migration.subledger_tieouts,
-- migration 0443; Data Migration & Go-Live > Reconciliation): a tie-out with no account yet takes the account of its
-- accounting.account.* setting (seeds 40_finance.sql and 81_tisph_finance.sql), which a new database only has after the
-- migrations ran. Idempotent: a tie-out that already names its accounts is kept as the Finance Head maintains it.

UPDATE app_settings s SET value = (
  SELECT jsonb_agg(CASE WHEN jsonb_array_length(COALESCE(t->'accounts', '[]'::jsonb)) = 0 AND m.setting IS NOT NULL
      AND EXISTS (SELECT 1 FROM app_settings a WHERE a.key = m.setting AND COALESCE(a.value #>> '{}', '') <> '')
    THEN jsonb_set(t, '{accounts}', jsonb_build_array((SELECT a.value #>> '{}' FROM app_settings a WHERE a.key = m.setting)))
    ELSE t END ORDER BY i)
  FROM jsonb_array_elements(s.value) WITH ORDINALITY AS x(t, i)
  LEFT JOIN (VALUES ('premiums-receivable', 'accounting.account.premium_receivable'),
                    ('due-to-insurers', 'accounting.account.due_to_insurer'),
                    ('commission-receivable', 'accounting.account.commission_receivable')) AS m(tieout, setting) ON m.tieout = t->>'key')
WHERE s.key = 'migration.subledger_tieouts' AND jsonb_typeof(s.value) = 'array' AND jsonb_array_length(s.value) > 0;
