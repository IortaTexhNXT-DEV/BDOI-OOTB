-- Cash Control reference data (TIS-BRD-COLL-05 and the collections of TISPH), on the masters and settings a broker
-- reviews before go-live:
--   pdc_cancel   reasons for cancelling a post-dated cheque (FRS COLL-05 6.3): a cheque or cash replacement follows, or none
--   pdc_bounce   reasons a cheque was returned by the bank or reported bounced by the Insurance Partner
--   receipt_reversal         reasons a receipt is reversed (cancelled, its payment journals reversed)
--   receipt_reversal_reject  reasons a checker returns a reversal request
-- The contexts are added to the Used For list of the Reason Codes master and their reasons to the master; an action of
-- these kinds is taken with a reason code of its context (requiredReason in src/modules/ops-masters/records.js).
-- Idempotent: a context is added once and a reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['pdc_cancel', 'pdc_bounce', 'receipt_reversal', 'receipt_reversal_reject']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['pdc_cancel', 'pdc_bounce', 'receipt_reversal', 'receipt_reversal_reject']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('PDC-CXL-CASH', 'Cash replacement', 'pdc_cancel', false, 3000),
             ('PDC-CXL-CHEQUE', 'Cheque replacement', 'pdc_cancel', false, 3010),
             ('PDC-CXL-NOSIG', 'Technical defect - no signature', 'pdc_cancel', false, 3020),
             ('PDC-CXL-DEFECT', 'Technical defect - other', 'pdc_cancel', true, 3030),
             ('PDC-CXL-POLICY', 'Policy cancelled', 'pdc_cancel', false, 3040),
             ('PDC-CXL-PAIDOFF', 'Account paid off', 'pdc_cancel', false, 3050),
             ('PDC-CXL-ERROR', 'Encoded in error', 'pdc_cancel', false, 3060),
             ('PDC-BNC-DAIF', 'DAIF - drawn against insufficient funds', 'pdc_bounce', false, 3100),
             ('PDC-BNC-CLOSED', 'Account closed', 'pdc_bounce', false, 3110),
             ('PDC-BNC-STOP', 'Stop payment', 'pdc_bounce', false, 3120),
             ('PDC-BNC-SIGNATURE', 'Signature differs', 'pdc_bounce', false, 3130),
             ('PDC-BNC-STALE', 'Stale or post-dated', 'pdc_bounce', false, 3140),
             ('PDC-BNC-OTHER', 'Other', 'pdc_bounce', true, 3190),
             ('RCT-REV-DAIF', 'Cheque returned DAIF', 'receipt_reversal', false, 3200),
             ('RCT-REV-BOUNCED', 'Cheque returned - other reason', 'receipt_reversal', true, 3210),
             ('RCT-REV-DUPLICATE', 'Duplicate receipt', 'receipt_reversal', false, 3220),
             ('RCT-REV-AMOUNT', 'Wrong amount', 'receipt_reversal', false, 3230),
             ('RCT-REV-POLICY', 'Applied to the wrong policy or client', 'receipt_reversal', false, 3240),
             ('RCT-REV-NOFUNDS', 'Payment not received in the bank', 'receipt_reversal', false, 3250),
             ('RCT-REV-OTHER', 'Other', 'receipt_reversal', true, 3290),
             ('RCT-REJ-NOPROOF', 'No supporting document', 'receipt_reversal_reject', false, 3300),
             ('RCT-REJ-WRONG', 'Wrong receipt selected', 'receipt_reversal_reject', false, 3310),
             ('RCT-REJ-OTHER', 'Other', 'receipt_reversal_reject', true, 3390)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
