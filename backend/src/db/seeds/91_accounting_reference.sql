-- Accounting Flow (Master > Finance > Accounting Flow), the Finance accounting reference: accounts that stand in until
-- Finance confirms the SAP account are shown as "Mapping pending", like the accounts outside the chart the SAP GL file
-- accepts (sap_gl.account_pattern).
--
-- TISPH: 210245 Accounts Payable - Insurance Company is the placeholder of FGA.09 (seed 81_tisph_finance.sql) for the
-- premium payable to insurers and its premium tax roles.
--
-- Idempotent: the setting is added once; 210245 is listed only while the list is still empty, nobody has changed it
-- and the account exists, so a list Finance edits (also an empty one) is kept.

INSERT INTO app_settings(key, value, "group", label, type)
VALUES ('accounting.provisional_accounts', '[]'::jsonb, 'accounting',
        'GL accounts that stand in until Finance confirms the account; the Accounting Flow shows them as Mapping pending', 'json')
ON CONFLICT (key) DO NOTHING;

UPDATE app_settings SET value = '["210245"]'::jsonb, updated_at = now()
WHERE key = 'accounting.provisional_accounts' AND value = '[]'::jsonb AND updated_by IS NULL
  AND EXISTS (SELECT 1 FROM gl_accounts WHERE code = '210245');
