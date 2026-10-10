-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true. Quotation validity and versions (all fictional):
--  * QT-2026-95010 was sent to the customer, changed at the customer's request (acts of nature removed) and sent again:
--    version 1 is kept read-only, version 2 waits for the customer;
--  * QT-2026-95011, accepted by the customer, had its validity extended once by 30 days while the loan was released.
-- Idempotent: each change is made only while the quotation is still as 84_sales.sql left it.

INSERT INTO quote_versions(quote_id, version, status, doc, sum_insured, premium_base, premium_total, commission_rate, commission_amount, currency,
  insurance_company_id, valid_until, approval_sent_to, approval_sent_at, version_started_at, superseded_by, superseded_at, change_reason)
SELECT q.id, 1, 'sent', q.doc, q.sum_insured, round(q.premium_base * 1.08, 2), round(q.premium_total * 1.08, 2), q.commission_rate,
       round(q.commission_amount * 1.08, 2), q.currency, q.insurance_company_id, q.valid_until, COALESCE(q.approval_sent_to, l.email), q.created_at + interval '2 hours',
       q.created_at, (SELECT id FROM users WHERE username = 'agent.msantos'), q.created_at + interval '1 day', 'Customer asked to remove the acts of nature cover'
  FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id
 WHERE q.id = 'qt_sls_10' AND q.version = 1 AND q.status = 'sent'
ON CONFLICT (quote_id, version) DO NOTHING;

UPDATE quotes SET version = 2, version_started_at = created_at + interval '1 day'
 WHERE id = 'qt_sls_10' AND version = 1 AND EXISTS (SELECT 1 FROM quote_versions v WHERE v.quote_id = 'qt_sls_10' AND v.version = 1);

UPDATE quotes SET valid_until = valid_until + 30, extension_count = 1, extended_at = created_at + interval '5 days',
       extended_by = (SELECT id FROM users WHERE username = 'agent.msantos'), extension_remarks = 'Customer waiting for the release of the auto loan'
 WHERE id = 'qt_sls_11' AND extension_count = 0 AND status = 'accepted';
