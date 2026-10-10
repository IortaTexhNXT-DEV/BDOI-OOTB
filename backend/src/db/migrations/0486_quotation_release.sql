-- Quotation approval before it reaches the client (TIS-BRD-QUOT-03, MC-08).
--
-- quotations.approve_before_send: a Draft quotation is sent to the client only by a second user holding
-- approve:quotations; the approval stamps approved_by / approved_at and sends it (the client's e-mail carries the
-- quotation slip PDF and the approval link). A new version clears the approval. Off by default (the raiser sends);
-- TISPH switches it on (seed 95_tisph_quote_policy.sql).
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('quotations.approve_before_send', 'false', 'quotations', 'A second user with the quotation approval approves a quotation, which sends it to the client', 'boolean')
ON CONFLICT (key) DO NOTHING;
