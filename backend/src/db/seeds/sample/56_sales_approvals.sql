-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Approver of the sample approved quotations (20_sales.sql keeps only the time): an account executive other than the
-- maker, from the sample users of 53_remittance.sql, so the quotation history names who approved. Idempotent.
UPDATE quotes q SET approved_by = u.id
FROM users u
WHERE u.username = 'agent.agarcia' AND q.id LIKE 'qt_sls_%' AND q.approved_at IS NOT NULL AND q.approved_by IS NULL;
