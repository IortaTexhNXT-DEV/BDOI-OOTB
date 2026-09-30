-- Acknowledgement receipt (AR) of a premium payment captured on a policy (Policy > Payment). In Philippine practice the
-- broker hands the client an AR when it takes the money; the official receipt (OR) follows when Accounting confirms
-- the payment. Each capture gets its AR number from the Document Numbering master (series acknowledgement_receipt).

ALTER TABLE policy_payments ADD COLUMN IF NOT EXISTS ar_number text;
CREATE UNIQUE INDEX IF NOT EXISTS policy_payments_ar_number_idx ON policy_payments(ar_number) WHERE ar_number IS NOT NULL;

INSERT INTO document_numbering(code, name, module, prefix, description, created_by)
VALUES ('acknowledgement_receipt', 'Acknowledgement Receipt', 'accounting', 'AR',
        'Acknowledgement receipt handed to the client when a premium payment is recorded on a policy', 'seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type)
VALUES ('documents.acknowledgement_receipt_note', '"This acknowledgement receipt is not an official receipt. The official receipt is issued once the payment is verified by Accounting."',
        'documents', 'Note printed on acknowledgement receipts (blank: none)', 'string')
ON CONFLICT (key) DO NOTHING;
