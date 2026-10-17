-- Credit Life batch statement of account to the financing bank (TIS-BRD-PJRN-01: "insurer SOA to TFS"): the premium of
-- the issued accounts of a batch, per account and in total, sent back to the bank by e-mail after the batch has been
-- forwarded to the insurer; the insurer's own SOA reference can be recorded on it. Idempotent.

ALTER TABLE credit_life_batches ADD COLUMN IF NOT EXISTS insurer_soa_reference text;
ALTER TABLE credit_life_batches ADD COLUMN IF NOT EXISTS soa_sent_at timestamptz;
ALTER TABLE credit_life_batches ADD COLUMN IF NOT EXISTS soa_sent_to text;
ALTER TABLE credit_life_batches ADD COLUMN IF NOT EXISTS soa_email_id bigint;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('credit_life.soa_email_subject', '"Credit Life statement of account {{batchNumber}} - {{period}}"', 'credit_life', 'Subject of the e-mail that sends the statement of account of a batch to the financing bank', 'string', true),
 ('credit_life.soa_email_body', '"<p>Dear {{bankName}},</p><p>Please find attached the Credit Life statement of account of batch {{batchNumber}} of {{period}} with {{insurerName}}: {{members}} accounts, total premium {{premium}}.</p>"', 'credit_life', 'Body of the e-mail that sends the statement of account of a batch to the financing bank', 'string', true)
ON CONFLICT (key) DO NOTHING;
