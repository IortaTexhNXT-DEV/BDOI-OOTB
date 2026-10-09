-- Reasons of the accounting decisions on the Reason Codes master of seed 77_lead_sources_reason_codes.sql (Master >
-- Insurance Management > Reason Codes): the contexts are added to the Used For list of the master and their reasons to
-- the master. A decision of these kinds is taken with a reason code of its context (and a note when the reason needs
-- one), checked by requiredReason() in src/modules/ops-masters/records.js:
--   period_close            soft-close, close or lock an accounting period (Accounts > Period End > Period Management)
--   period_reopen           reopen a soft-closed or closed period
--   year_end_reverse        reverse a year-end close (Accounts > Period End > Year-End Close)
--   cas_print_void          void a print of a loose-leaf book (Accounts > Tax > CAS Books and Documents)
--   cas_document_change     change the system description or the backup procedure of the CAS registration
--   incentive_batch_reject  reject an incentive calculation batch (Incentive > Approvals)
-- Idempotent: a context is added once and a reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['period_close', 'period_reopen', 'year_end_reverse', 'cas_print_void', 'cas_document_change', 'incentive_batch_reject']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['period_close', 'period_reopen', 'year_end_reverse', 'cas_print_void', 'cas_document_change', 'incentive_batch_reject']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('PCL-MONTHEND', 'Month-end close completed', 'period_close', false, 500),
             ('PCL-SIGNOFF', 'Reconciliations reviewed and signed off', 'period_close', false, 510),
             ('PCL-BIRFILED', 'BIR returns for the period filed', 'period_close', false, 520),
             ('PCL-AUDIT', 'Books locked for the external audit', 'period_close', false, 530),
             ('PCL-MGMT', 'Instruction of the Finance Head', 'period_close', true, 540),
             ('PCL-OTHER', 'Other', 'period_close', true, 590),
             ('PRO-LATEDOC', 'Late insurer statement or supplier invoice', 'period_reopen', false, 600),
             ('PRO-POSTERR', 'Correction of a posting error', 'period_reopen', true, 610),
             ('PRO-AUDITADJ', 'External audit adjustment', 'period_reopen', false, 620),
             ('PRO-RECON', 'Reconciliation difference to resolve', 'period_reopen', true, 630),
             ('PRO-BIRAMEND', 'Amended BIR return', 'period_reopen', false, 640),
             ('PRO-OTHER', 'Other', 'period_reopen', true, 690),
             ('YER-AUDITADJ', 'Audit adjustments after the year-end close', 'year_end_reverse', false, 700),
             ('YER-WRONGRUN', 'Year-end close run on incomplete books', 'year_end_reverse', true, 710),
             ('YER-RETEARN', 'Retained earnings account to be corrected', 'year_end_reverse', false, 720),
             ('YER-OTHER', 'Other', 'year_end_reverse', true, 790),
             ('CPV-MISPRINT', 'Printer error or misprint', 'cas_print_void', false, 800),
             ('CPV-WRONGBOOK', 'Wrong book or period printed', 'cas_print_void', false, 810),
             ('CPV-DAMAGED', 'Pages damaged or lost', 'cas_print_void', true, 820),
             ('CPV-CORRECTED', 'Entries corrected after printing', 'cas_print_void', false, 830),
             ('CPV-OTHER', 'Other', 'cas_print_void', true, 890),
             ('CDC-SYSTEM', 'System or software version change', 'cas_document_change', false, 900),
             ('CDC-BACKUP', 'Change of backup or retention procedure', 'cas_document_change', false, 910),
             ('CDC-CUSTODIAN', 'Change of custodian or contact person', 'cas_document_change', false, 920),
             ('CDC-BIR', 'BIR request or audit finding', 'cas_document_change', true, 930),
             ('CDC-TEXT', 'Correction of the document text', 'cas_document_change', false, 940),
             ('CDC-OTHER', 'Other', 'cas_document_change', true, 990),
             ('IBR-DATA', 'Production data incomplete or incorrect', 'incentive_batch_reject', false, 1000),
             ('IBR-PERIOD', 'Wrong program or period selected', 'incentive_batch_reject', false, 1010),
             ('IBR-RATES', 'Rates or targets to be corrected', 'incentive_batch_reject', false, 1020),
             ('IBR-ELIGIBLE', 'Eligibility of participants to be reviewed', 'incentive_batch_reject', false, 1030),
             ('IBR-DUPLICATE', 'Duplicate calculation batch', 'incentive_batch_reject', false, 1040),
             ('IBR-OTHER', 'Other', 'incentive_batch_reject', true, 1090)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
