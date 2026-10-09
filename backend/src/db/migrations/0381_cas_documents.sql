-- CAS registration documents kept as controlled documents: the system description and controls and the backup and
-- restore procedure are edited in the application (sections of heading and text, with {{field}} placeholders that
-- print the Company master and CAS values of the day), versioned and approved by a second user before they print as
-- the document of the registration file.
--   draft -> submitted -> approved -> superseded (when a later version is approved); submitted -> draft (rejected);
--   draft -> cancelled (discarded). One open (draft or submitted) and one approved version per document.
-- The reason of a change is a code of the Reason Codes master (context cas_document_change) with its name and note in
-- reason. Also the CAS permit date and the users named as backup custodian and system contact. Idempotent.
CREATE TABLE IF NOT EXISTS cas_documents (
  id text PRIMARY KEY DEFAULT ('casd_' || encode(gen_random_bytes(8), 'hex')),
  doc_type text NOT NULL CHECK (doc_type IN ('system_description', 'backup_procedure')),
  version int NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'superseded', 'cancelled')),
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,           -- [{ key, heading, text }]
  change_note text,
  reason_code text,                                      -- master reason-code, context cas_document_change
  reason text,                                           -- name of the reason and its note
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_by text, submitted_at timestamptz,
  approved_by text, approved_at timestamptz, approval_remarks text,
  rejected_by text, rejected_at timestamptz, rejection_remarks text,
  superseded_at timestamptz,
  UNIQUE (doc_type, version));
CREATE UNIQUE INDEX IF NOT EXISTS cas_documents_open_uq ON cas_documents(doc_type) WHERE status IN ('draft', 'submitted');
CREATE UNIQUE INDEX IF NOT EXISTS cas_documents_approved_uq ON cas_documents(doc_type) WHERE status = 'approved';

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('cas.permit_date', '""', 'cas', 'Date of the CAS Permit to Use / Acknowledgement Certificate (YYYY-MM-DD)', 'string'),
 ('cas.backup_custodian_user', '""', 'cas', 'User named as backup custodian (CAS Books and Documents); cas.backup_custodian keeps the name and position printed', 'string'),
 ('cas.system_contact_user', '""', 'cas', 'User named as system contact person (CAS Books and Documents); cas.system_contact keeps the name, position and e-mail printed', 'string')
ON CONFLICT (key) DO NOTHING;
