-- Claim document checklist (Operations > Claim Documents) and claims paid through the broker from the Accounting menu.
--   claim_document_items      the documents a claim needs, copied from the checklist master (claim-document-requirement:
--                             line of business, claim type, required / optional) when the claim is first opened, with
--                             their received / waived status
--   claim_document_reminders  missing-document reminders sent to the claimant (e-mail template claim_missing_documents)
--   claims.submitted_to_insurer_at   the claim file was submitted to the insurer; refused while a required document is
--                             missing when claims.require_documents_before_submission is on
--   claim_settlement_movements.voucher_number   claim payment voucher (CPV) of a payment to the claimant, printed with
--                             the release form from Accounts > Claims Settlements
CREATE TABLE IF NOT EXISTS claim_document_items (
  id bigserial PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  requirement_code text,                               -- code of the checklist master record (null: added on the claim)
  document_name text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'waived')),
  received_on date,
  document_id text REFERENCES documents(id),           -- the uploaded copy, when there is one
  waive_reason text,
  sort_order int NOT NULL DEFAULT 100,
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, document_name));
CREATE INDEX IF NOT EXISTS claim_document_items_claim ON claim_document_items(claim_id, status);

CREATE TABLE IF NOT EXISTS claim_document_reminders (
  id bigserial PRIMARY KEY,
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  recipient_email text,
  missing jsonb NOT NULL DEFAULT '[]',
  email_id text,
  automatic boolean NOT NULL DEFAULT false,
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS claim_document_reminders_claim ON claim_document_reminders(claim_id, created_at DESC);

ALTER TABLE claims ADD COLUMN IF NOT EXISTS submitted_to_insurer_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS submitted_to_insurer_by text;

ALTER TABLE claim_settlement_movements ADD COLUMN IF NOT EXISTS voucher_number text;
CREATE UNIQUE INDEX IF NOT EXISTS claim_settlement_movements_voucher_uq ON claim_settlement_movements(voucher_number) WHERE voucher_number IS NOT NULL;
