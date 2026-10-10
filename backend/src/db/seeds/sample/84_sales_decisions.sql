-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Deciders of the sample quotations of 84_sales.sql (which keeps only the time of each step), so the quotation history
-- names who decided. Idempotent.
-- Approved: an account executive other than the maker.
UPDATE quotes q SET approved_by = u.id
FROM users u
WHERE u.username = 'agent.agarcia' AND q.id LIKE 'qt_sls_%' AND q.approved_at IS NOT NULL AND q.approved_by IS NULL;

-- Rejected: recorded by the account executive of the prospect when the client declined (the reason is in remarks).
UPDATE quotes q SET updated_by = l.owner_user_id
FROM leads l
WHERE l.id = q.lead_id AND q.id LIKE 'qt_sls_%' AND q.status = 'rejected' AND q.updated_by IS NULL AND l.owner_user_id IS NOT NULL;
