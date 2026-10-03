-- Attachments of a queued e-mail. Each entry is either a document reference, generated as a PDF when the message is
-- sent (so the queue stays small and the PDF shows the record as it is then):
--   { "fileName": "receipt-OR-2026-00001.pdf", "contentType": "application/pdf", "kind": "document",
--     "document": "official-receipt", "params": { "receiptId": "..." } }
-- or a file already in the uploads store:
--   { "fileName": "slip.pdf", "contentType": "application/pdf", "kind": "file", "key": "print/1767225600-...-slip.pdf" }
ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
