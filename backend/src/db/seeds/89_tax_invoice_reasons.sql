-- Reasons of the cancellations on Accounts > Tax > Sales Invoices, on the Reason Codes master of seed
-- 77_lead_sources_reason_codes.sql (Master > Insurance Management > Reason Codes), checked by requiredReason() in
-- src/modules/ops-masters/records.js:
--   sales_invoice_cancel    cancel an issued sales invoice (kept with its number, printed CANCELLED, sent to the EIS)
--   invoice_payment_cancel  cancel a payment acknowledgement of a sales invoice
-- Idempotent: a context is added once and a reason only when its code is missing, so administrator changes are kept.

UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['sales_invoice_cancel', 'invoice_payment_cancel']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['sales_invoice_cancel', 'invoice_payment_cancel']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('SIC-WRONGBUYER', 'Wrong buyer or buyer details', 'sales_invoice_cancel', false, 1100),
             ('SIC-WRONGAMT', 'Wrong amount or VAT', 'sales_invoice_cancel', false, 1110),
             ('SIC-DUPLICATE', 'Duplicate invoice', 'sales_invoice_cancel', false, 1120),
             ('SIC-NOSALE', 'Service not rendered or commission reversed', 'sales_invoice_cancel', true, 1130),
             ('SIC-OTHER', 'Other', 'sales_invoice_cancel', true, 1190),
             ('IPC-RETURNED', 'Cheque returned or payment reversed by the bank', 'invoice_payment_cancel', false, 1200),
             ('IPC-WRONGINV', 'Payment recorded against the wrong invoice', 'invoice_payment_cancel', false, 1210),
             ('IPC-WRONGAMT', 'Wrong amount or withholding tax', 'invoice_payment_cancel', false, 1220),
             ('IPC-DUPLICATE', 'Duplicate payment acknowledgement', 'invoice_payment_cancel', false, 1230),
             ('IPC-OTHER', 'Other', 'invoice_payment_cancel', true, 1290)) AS v(code, name, context, note, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'reason-code')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
