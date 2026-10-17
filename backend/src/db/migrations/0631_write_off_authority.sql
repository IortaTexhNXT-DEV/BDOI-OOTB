-- Write-off authority and the TISPH small-balance write-off (Pre-BSM M24 WO-SMALL, M23 write-off posting, M32 controls;
-- GAP-CASH-12, GAP-FIN-23).
--
-- A write-off on Open Entry Matching is now checked against the user's write_off limit of the Authority Matrix (as the
-- other approval steps are; access.authority_without_limit decides for a user without a limit). WO-SMALL, a reason of the
-- Reason Codes master only, becomes a write-off reason posting to the bad debt account (accounting.account.write_off:
-- Dr Bad Debt Expense / Cr Client Premium Receivable) with the small-balance maximum of the delivered SMALL_BALANCE
-- reason; Finance sets TISPH's maximum on Master > Finance > Account Determination > Write-off Reasons. Idempotent.

INSERT INTO write_off_reasons(code, name, gl_account, max_amount, description, created_by)
SELECT 'WO-SMALL', 'Small balance write-off', COALESCE(NULLIF((SELECT value #>> '{}' FROM app_settings WHERE key = 'accounting.account.write_off'), ''), '4401009'), 100,
       'TISPH small balance left on a client premium receivable (Pre-BSM M24); written off to bad debt expense', 'system'
WHERE NOT EXISTS (SELECT 1 FROM write_off_reasons WHERE code = 'WO-SMALL');
