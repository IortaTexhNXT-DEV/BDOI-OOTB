-- Broker branding and e-signatures.
--
-- e_signatures: signature images of the company's authorised signatories (Master > Signatories) and of users who
-- approve or issue documents (accounting manager on payment vouchers, account executive on quotations). Every capture
-- is a new version with an effective period; the image lives in the uploads storage under e-signatures/ and is never
-- served through the public file links (GET /api/e-signatures/:id/image checks the caller). Capture, replacement and
-- revocation are written to the audit trail with the consent statement the signer accepted.
CREATE TABLE IF NOT EXISTS e_signatures (
  id serial PRIMARY KEY,
  owner_type text NOT NULL CHECK (owner_type IN ('signatory', 'user')),
  owner_id text NOT NULL,
  version int NOT NULL,
  storage_key text NOT NULL,
  content_type text NOT NULL,
  content_hash text NOT NULL,
  method text NOT NULL CHECK (method IN ('drawn', 'uploaded')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'replaced', 'revoked')),
  consent_text text NOT NULL,
  consent_at timestamptz NOT NULL DEFAULT now(),
  consent_ip text,
  captured_by text,
  captured_at timestamptz NOT NULL DEFAULT now(),
  revoked_by text,
  revoked_at timestamptz,
  revoke_reason text,
  UNIQUE (owner_type, owner_id, version)
);
CREATE INDEX IF NOT EXISTS e_signatures_owner_idx ON e_signatures(owner_type, owner_id, status);

-- Which signatures print on which document: document type -> slot -> source (the signatory chosen on the document,
-- a named signatory, the default signatory, the approving user or the issuing user) and the condition (only once the
-- document is issued, only once approved, or always). A draft prints the slots without images and an
-- "UNSIGNED DRAFT" watermark.
CREATE TABLE IF NOT EXISTS document_signature_slots (
  id serial PRIMARY KEY,
  document_type text NOT NULL,
  slot text NOT NULL,
  label text NOT NULL,
  source text NOT NULL CHECK (source IN ('document-signatory', 'named-signatory', 'default-signatory', 'approving-user', 'issuing-user')),
  signatory_id int REFERENCES signatories(id),
  condition text NOT NULL DEFAULT 'issued' CHECK (condition IN ('issued', 'approved', 'always')),
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type, slot)
);

INSERT INTO document_signature_slots(document_type, slot, label, source, condition, sort_order, active) VALUES
 ('quotation', 'authorized', 'For {{companyName}}', 'document-signatory', 'issued', 1, true),
 ('quotation', 'account-executive', 'Account executive', 'issuing-user', 'issued', 2, false),
 ('policy-schedule', 'authorized', 'For {{companyName}}', 'default-signatory', 'issued', 1, true),
 ('endorsement', 'authorized', 'For {{companyName}}', 'default-signatory', 'issued', 1, true),
 ('official-receipt', 'authorized', 'Authorized signature', 'default-signatory', 'issued', 1, true),
 ('acknowledgement-receipt', 'received-by', 'Received by', 'issuing-user', 'issued', 1, true),
 ('payment-voucher', 'prepared-by', 'Prepared by', 'issuing-user', 'issued', 1, true),
 ('payment-voucher', 'approved-by', 'Approved by', 'approving-user', 'approved', 3, true),
 ('debit-note', 'prepared-by', 'Prepared by', 'issuing-user', 'issued', 1, true),
 ('debit-note', 'approved-by', 'Approved by', 'default-signatory', 'issued', 2, true),
 ('billing-statement', 'authorized', 'For {{companyName}}', 'default-signatory', 'always', 1, true),
 ('statement-of-account', 'authorized', 'For {{companyName}}', 'default-signatory', 'always', 1, true),
 ('journal-voucher', 'prepared-by', 'Prepared by', 'issuing-user', 'issued', 1, true),
 ('journal-voucher', 'approved-by', 'Approved by', 'approving-user', 'approved', 2, true),
 ('claim-settlement-letter', 'authorized', 'For {{companyName}}', 'default-signatory', 'approved', 1, true)
ON CONFLICT (document_type, slot) DO NOTHING;

-- The claim settlement letter (claims.documents, Claims > Claim detail > Documents) for databases seeded before it
-- existed; {{signature:authorized}} places the mapped signature.
UPDATE app_settings SET value = value || jsonb_build_object('Claim Settlement Letter', jsonb_build_array(
  'We are pleased to advise that your claim {{claimNumber}} under policy {{policyNumber}} has been approved for settlement.',
  'Insured: {{insuredName}}', 'Insurer: {{insurerName}}', 'Date of loss: {{lossDate}}', 'Approved amount: {{currency}} {{approvedAmount}}',
  'Settlement type: {{settlementType}}',
  'Please sign and return the discharge voucher so that the insurer can release the payment.',
  '{{signature:authorized}}'))
WHERE key = 'claims.documents' AND jsonb_typeof(value) = 'object' AND NOT value ? 'Claim Settlement Letter';
