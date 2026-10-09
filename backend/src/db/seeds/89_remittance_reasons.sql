-- Reasons of the remittance decisions on the Reason Codes master of seed 77_lead_sources_reason_codes.sql (Master >
-- Insurance Management > Reason Codes): the contexts are added to the Used For list of the master and their reasons to
-- the master. A decision of these kinds is taken with a reason code of its context (and a note when the reason needs
-- one), checked by requiredReason() in src/modules/ops-masters/records.js:
--   remittance_reject           reject a remittance approval: the remittance returns to the maker
--   remittance_withdraw         withdraw a remittance from approval
--   remittance_cancel           cancel a remittance
--   remittance_revoke           revoke the approval of a remittance before it is paid
--   remittance_off_cycle        create a remittance outside the weekly run (Run now, import of a policy list)
--   remittance_line_exclude     take a policy line off a remittance
--   exception_escalate          escalate a remittance exception
--   exception_resolve           resolve a remittance exception (reasons per exception type, seeded with the types)
--   exception_reopen            reopen a resolved exception
--   reconciliation_difference   match an insurer statement line with a difference
--   reconciliation_unmatch      undo a match of an insurer statement line
--   confirmation_difference     record an insurer confirmation for another amount than paid
--   payment_duplicate_override  pay an insurer the same amount again within the duplicate window
--   billing_reject              reject an insurer billing statement
--   billing_cancel              cancel an insurer billing statement
-- Idempotent: a context is added once and a reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['remittance_reject', 'remittance_withdraw', 'remittance_cancel', 'remittance_revoke', 'remittance_off_cycle', 'remittance_line_exclude',
                        'exception_escalate', 'exception_resolve', 'exception_reopen', 'reconciliation_difference', 'reconciliation_unmatch',
                        'confirmation_difference', 'payment_duplicate_override', 'billing_reject', 'billing_cancel']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f,
    unnest(ARRAY['remittance_reject', 'remittance_withdraw', 'remittance_cancel', 'remittance_revoke', 'remittance_off_cycle', 'remittance_line_exclude',
                 'exception_escalate', 'exception_resolve', 'exception_reopen', 'reconciliation_difference', 'reconciliation_unmatch',
                 'confirmation_difference', 'payment_duplicate_override', 'billing_reject', 'billing_cancel']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('RRJ-AMOUNT', 'Amount differs from insurer terms', 'remittance_reject', false, 1100),
             ('RRJ-PROOF', 'Proof of payment doubtful', 'remittance_reject', false, 1110),
             ('RRJ-INSURER', 'Wrong insurer or product line', 'remittance_reject', false, 1120),
             ('RRJ-RATES', 'Rates to be corrected', 'remittance_reject', false, 1130),
             ('RRJ-DUPLICATE', 'Duplicate', 'remittance_reject', false, 1140),
             ('RRJ-OTHER', 'Other', 'remittance_reject', true, 1190),
             ('RWD-CORRECT', 'Correction needed', 'remittance_withdraw', false, 1200),
             ('RWD-WEEK', 'Wrong week', 'remittance_withdraw', false, 1210),
             ('RWD-OTHER', 'Other', 'remittance_withdraw', true, 1290),
             ('RCN-DUPLICATE', 'Duplicate of another remittance', 'remittance_cancel', false, 1300),
             ('RCN-WRONGDATA', 'Built on wrong data', 'remittance_cancel', false, 1310),
             ('RCN-INSURER', 'Insurer request', 'remittance_cancel', false, 1320),
             ('RCN-GOLIVE', 'Go-live clean-up', 'remittance_cancel', false, 1330),
             ('RCN-OTHER', 'Other', 'remittance_cancel', true, 1390),
             ('RRV-BANKACCT', 'Insurer bank account changed', 'remittance_revoke', false, 1400),
             ('RRV-AMOUNT', 'Amount to be corrected', 'remittance_revoke', false, 1410),
             ('RRV-ERROR', 'Approved in error', 'remittance_revoke', false, 1420),
             ('RRV-OTHER', 'Other', 'remittance_revoke', true, 1490),
             ('ROC-MISSED', 'Missed run', 'remittance_off_cycle', false, 1500),
             ('ROC-FAILED', 'Failed run', 'remittance_off_cycle', false, 1510),
             ('ROC-GOLIVE', 'Go-live opening', 'remittance_off_cycle', false, 1520),
             ('ROC-CATCHUP', 'Catch-up', 'remittance_off_cycle', false, 1530),
             ('ROC-INSURER', 'Insurer request', 'remittance_off_cycle', false, 1540),
             ('ROC-CORRECTION', 'Correction', 'remittance_off_cycle', false, 1550),
             ('RLX-DISPUTE', 'Insurer disputes the policy', 'remittance_line_exclude', false, 1600),
             ('RLX-REVIEW', 'Policy under review', 'remittance_line_exclude', false, 1610),
             ('RLX-ENDORSE', 'Endorsement pending', 'remittance_line_exclude', false, 1620),
             ('RLX-OTHER', 'Other', 'remittance_line_exclude', true, 1690),
             ('EXE-SLA', 'Past SLA', 'exception_escalate', false, 1700),
             ('EXE-DECISION', 'Needs decision', 'exception_escalate', false, 1710),
             ('EXE-INSURER', 'Insurer not responding', 'exception_escalate', false, 1720),
             ('EXE-OTHER', 'Other', 'exception_escalate', true, 1790),
             ('EXR-ERROR', 'Resolved in error', 'exception_reopen', false, 1800),
             ('EXR-NEWINFO', 'New information', 'exception_reopen', false, 1810),
             ('EXR-OTHER', 'Other', 'exception_reopen', true, 1890),
             ('RCD-TIMING', 'Timing', 'reconciliation_difference', false, 1900),
             ('RCD-INSRATE', 'Insurer rate error', 'reconciliation_difference', false, 1910),
             ('RCD-TISRATE', 'TISPH rate error', 'reconciliation_difference', false, 1920),
             ('RCD-ENDORSE', 'Endorsement not on SOA', 'reconciliation_difference', false, 1930),
             ('RCD-ROUNDING', 'Rounding', 'reconciliation_difference', false, 1940),
             ('RCD-OTHER', 'Other', 'reconciliation_difference', true, 1990),
             ('RCU-ERROR', 'Matched in error', 'reconciliation_unmatch', false, 2000),
             ('RCU-POLICY', 'Wrong policy', 'reconciliation_unmatch', false, 2010),
             ('RCU-OTHER', 'Other', 'reconciliation_unmatch', true, 2090),
             ('CFD-CHARGES', 'Insurer deducted charges', 'confirmation_difference', false, 2100),
             ('CFD-SHORT', 'Insurer short-paid', 'confirmation_difference', false, 2110),
             ('CFD-OVER', 'Insurer over-receipted', 'confirmation_difference', false, 2120),
             ('CFD-TIMING', 'Timing', 'confirmation_difference', false, 2130),
             ('CFD-OTHER', 'Other', 'confirmation_difference', true, 2190),
             ('PDO-WEEKS', 'Separate weeks, same amount', 'payment_duplicate_override', false, 2200),
             ('PDO-INSTALMENT', 'Insurer instalment', 'payment_duplicate_override', false, 2210),
             ('PDO-OTHER', 'Other', 'payment_duplicate_override', true, 2290),
             ('BRJ-AMOUNT', 'Amount to be corrected', 'billing_reject', false, 2300),
             ('BRJ-INSURER', 'Wrong insurer or product line', 'billing_reject', false, 2310),
             ('BRJ-DUPLICATE', 'Duplicate', 'billing_reject', false, 2320),
             ('BRJ-OTHER', 'Other', 'billing_reject', true, 2390),
             ('BCN-AMOUNT', 'Amount to be corrected', 'billing_cancel', false, 2400),
             ('BCN-INSURER', 'Wrong insurer or product line', 'billing_cancel', false, 2410),
             ('BCN-DUPLICATE', 'Duplicate', 'billing_cancel', false, 2420),
             ('BCN-OTHER', 'Other', 'billing_cancel', true, 2490)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
