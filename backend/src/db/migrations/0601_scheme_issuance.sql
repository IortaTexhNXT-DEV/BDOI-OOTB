-- Scheme 1 & 2 issuance (TIS-BRD-SCHM-01, CR-05; FRS SCHM-01 FR-SIS-001 to FR-SIS-040).
--
-- scheme_applications: one application per TFS loan account (SAP-yyyy-nnnnn), created on screen or from the loan bookings
-- upload, priced from the scheme without a quotation (pricing: year 1 and the premium schedule of the loan term), with
-- the borrower (JSON, identifiers encrypted by the personal data trigger), the KYC source (tfs: TFSPH KYC
-- confirmation; full: the borrower's IDs), the vehicle, dealer and insurer, the Auto Renewal Agreement of Scheme 1, the
-- placement slip it was sent on (source scheme), the policy it became and the cancellation. Status draft,
-- documents-pending, ready, sent, declined, issued, cancelled. A loan account and a chassis number are on one open
-- application only.
-- scheme_checklist_items: the documents of an application copied from the Scheme Document Checklist master (scheme
-- type, KYC source, condition), with the file, receipt, waiver request and the waiver decision of a second user.
-- scheme_booking_batches: the loan bookings uploads (SB-yyyy-nnnnn) with their counts and failed rows.
--
-- Settings (group schemes): schemes.financing_banks, schemes.kyc_confirmation_banks, schemes.inception_basis,
-- schemes.max_backdating_days, schemes.max_document_mb, schemes.attach_documents_to_placement, schemes.kyc_primary_ids,
-- schemes.kyc_secondary_ids, schemes.ara_payment_modes, schemes.placement_confirmation,
-- schemes.skip_payment_verification, schemes.application_schedule_ctpl, schemes.loan_term_months,
-- schemes.require_billing_client. Numbering
-- scheme_application (SAP) and scheme_booking_batch (SB). Permissions read:scheme-issuance, write:scheme-issuance,
-- approve:scheme-issuance. The master type scheme-document-checklist and its twelve delivered records, and the reason
-- codes of the cancellation, are in seeds/97_dealer_schemes.sql. Idempotent.

CREATE TABLE IF NOT EXISTS scheme_booking_batches (
  id text PRIMARY KEY DEFAULT 'sbb_' || encode(gen_random_bytes(8), 'hex'),
  batch_number text UNIQUE,
  file_name text,
  rows_total integer NOT NULL DEFAULT 0,
  rows_created integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'processed', 'partial', 'failed')),
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scheme_booking_batches_created_by_fk_idx ON scheme_booking_batches (created_by);
COMMENT ON TABLE scheme_booking_batches IS 'Loan bookings uploads of Scheme Issuance (SCHM-01 FR-SIS-002)';

CREATE TABLE IF NOT EXISTS scheme_applications (
  id text PRIMARY KEY DEFAULT 'sap_' || encode(gen_random_bytes(8), 'hex'),
  application_number text UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'documents-pending', 'ready', 'sent', 'declined', 'issued', 'cancelled')),
  scheme_id text REFERENCES schemes(id),
  scheme_no text,
  scheme_type text,
  loan_account text,
  bank_channel_id text REFERENCES distribution_channels(id),
  booking_date date,
  loan_term_months integer,
  release_date date,
  client_id text REFERENCES clients(id),
  borrower jsonb NOT NULL DEFAULT '{}'::jsonb,
  kyc_source text NOT NULL DEFAULT 'tfs' CHECK (kyc_source IN ('tfs', 'full')),
  dealer_channel_id text REFERENCES distribution_channels(id),
  vehicle jsonb NOT NULL DEFAULT '{}'::jsonb,
  chassis_number text,
  invoice_price numeric(16,2),
  insurance_company_id integer REFERENCES insurance_companies(id),
  ara_signed_on date,
  ara_payment_mode text,
  line_no integer,
  pricing jsonb,
  gross_premium numeric(14,2),
  problems jsonb NOT NULL DEFAULT '[]'::jsonb,
  placement_id text REFERENCES placements(id),
  policy_id text REFERENCES policies(id),
  batch_id text REFERENCES scheme_booking_batches(id),
  row_no integer,
  decline_reason text,
  cancel_reason_code text,
  cancel_reason text,
  cancelled_by text REFERENCES users(id),
  cancelled_at timestamptz,
  sent_by text REFERENCES users(id),
  sent_at timestamptz,
  issued_by text REFERENCES users(id),
  issued_at timestamptz,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS scheme_applications_loan_open ON scheme_applications (loan_account) WHERE status <> 'cancelled' AND loan_account IS NOT NULL;
CREATE INDEX IF NOT EXISTS scheme_applications_chassis_idx ON scheme_applications (upper(chassis_number)) WHERE status <> 'cancelled';
CREATE INDEX IF NOT EXISTS scheme_applications_status_idx ON scheme_applications (status, created_at DESC);
CREATE INDEX IF NOT EXISTS scheme_applications_scheme_id_fk_idx ON scheme_applications (scheme_id);
CREATE INDEX IF NOT EXISTS scheme_applications_bank_channel_id_fk_idx ON scheme_applications (bank_channel_id);
CREATE INDEX IF NOT EXISTS scheme_applications_client_id_fk_idx ON scheme_applications (client_id);
CREATE INDEX IF NOT EXISTS scheme_applications_dealer_channel_id_fk_idx ON scheme_applications (dealer_channel_id);
CREATE INDEX IF NOT EXISTS scheme_applications_insurance_company_id_fk_idx ON scheme_applications (insurance_company_id);
CREATE INDEX IF NOT EXISTS scheme_applications_placement_id_fk_idx ON scheme_applications (placement_id);
CREATE INDEX IF NOT EXISTS scheme_applications_policy_id_fk_idx ON scheme_applications (policy_id);
CREATE INDEX IF NOT EXISTS scheme_applications_batch_id_fk_idx ON scheme_applications (batch_id);
CREATE INDEX IF NOT EXISTS scheme_applications_cancelled_by_fk_idx ON scheme_applications (cancelled_by);
CREATE INDEX IF NOT EXISTS scheme_applications_sent_by_fk_idx ON scheme_applications (sent_by);
CREATE INDEX IF NOT EXISTS scheme_applications_issued_by_fk_idx ON scheme_applications (issued_by);
CREATE INDEX IF NOT EXISTS scheme_applications_created_by_fk_idx ON scheme_applications (created_by);
CREATE INDEX IF NOT EXISTS scheme_applications_updated_by_fk_idx ON scheme_applications (updated_by);
COMMENT ON TABLE scheme_applications IS 'Scheme 1 and 2 applications on TFS loan documents, issued without a quotation (SCHM-01)';
DROP TRIGGER IF EXISTS scheme_applications_pii ON scheme_applications;
CREATE TRIGGER scheme_applications_pii BEFORE INSERT OR UPDATE ON scheme_applications FOR EACH ROW EXECUTE FUNCTION pii_protect_columns('json:borrower');

CREATE TABLE IF NOT EXISTS scheme_checklist_items (
  id bigserial PRIMARY KEY,
  application_id text NOT NULL REFERENCES scheme_applications(id) ON DELETE CASCADE,
  code text NOT NULL,
  document text NOT NULL,
  kyc boolean NOT NULL DEFAULT false,
  required boolean NOT NULL DEFAULT true,
  can_waive boolean NOT NULL DEFAULT false,
  added boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'waiver-requested', 'waived')),
  file_key text,
  file_name text,
  received_at timestamptz,
  received_by text REFERENCES users(id),
  remark text,
  waiver_reason text,
  waiver_requested_by text REFERENCES users(id),
  waiver_requested_at timestamptz,
  waiver_decided_by text REFERENCES users(id),
  waiver_decided_at timestamptz,
  waiver_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, code)
);
CREATE INDEX IF NOT EXISTS scheme_checklist_items_waiver_idx ON scheme_checklist_items (status) WHERE status = 'waiver-requested';
CREATE INDEX IF NOT EXISTS scheme_checklist_items_received_by_fk_idx ON scheme_checklist_items (received_by);
CREATE INDEX IF NOT EXISTS scheme_checklist_items_waiver_requested_by_fk_idx ON scheme_checklist_items (waiver_requested_by);
CREATE INDEX IF NOT EXISTS scheme_checklist_items_waiver_decided_by_fk_idx ON scheme_checklist_items (waiver_decided_by);
COMMENT ON TABLE scheme_checklist_items IS 'Document checklist of a scheme application (SCHM-01 FR-SIS-011 to 014)';

ALTER TABLE policy_schemes DROP CONSTRAINT IF EXISTS policy_schemes_application_fk;
ALTER TABLE policy_schemes ADD CONSTRAINT policy_schemes_application_fk FOREIGN KEY (application_id) REFERENCES scheme_applications(id);
CREATE INDEX IF NOT EXISTS policy_schemes_application_id_fk_idx ON policy_schemes (application_id);

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('scheme_application', 'Scheme Application', 'sales', 'SAP', 'Scheme 1 and 2 application on TFS loan documents (Operations > Sales & Marketing > Scheme Issuance)', 'migration:0601'),
 ('scheme_booking_batch', 'Loan Bookings Upload', 'sales', 'SB', 'Upload of TFS loan bookings (Scheme Issuance > Loan Bookings Upload)', 'migration:0601')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('schemes.financing_banks', '["TFS", "TFSPH"]', 'schemes', 'Distribution channel codes allowed as the financing bank of a scheme application (and their bank branches)', 'json', true),
 ('schemes.kyc_confirmation_banks', '["TFS", "TFSPH"]', 'schemes', 'Financing banks whose KYC confirmation replaces the full KYC (KYC source TFSPH KYC confirmation by default)', 'json', true),
 ('schemes.inception_basis', '"release_date"', 'schemes', 'Inception of the year-1 scheme policy: release_date (vehicle release date) or booking_date (loan booking date)', 'string', true),
 ('schemes.max_backdating_days', '30', 'schemes', 'How many days before today the vehicle release date of a scheme application may be', 'number', true),
 ('schemes.max_document_mb', '10', 'schemes', 'Largest file of a scheme application checklist, in MB', 'number', true),
 ('schemes.attach_documents_to_placement', 'true', 'schemes', 'Attach the checklist files of a scheme application to the placement order e-mailed to the insurer', 'boolean', true),
 ('schemes.kyc_primary_ids', '["PhilID", "LTO Driver''s License", "Passport", "UMID", "SSS ID", "PRC ID", "IBP ID", "Senior Citizen ID", "Postal ID", "OWWA ID", "MARINA ID", "GSIS e-card", "ACR / ICR", "Government office and GOCC ID", "OFW ID"]', 'schemes', 'TFSPH list of primary IDs accepted for the KYC of a scheme borrower', 'json', true),
 ('schemes.kyc_secondary_ids', '["Police clearance", "NBI clearance", "PhilHealth ID", "Pag-IBIG Loyalty Card Plus", "DSWD certification", "Seaman''s Book", "Barangay certification (with photo)", "Company ID (BSP / SEC / IC regulated company)", "NCWDP ID", "PWD ID"]', 'schemes', 'TFSPH list of secondary IDs: Full KYC needs one primary ID or two different secondary IDs', 'json', true),
 ('schemes.ara_payment_modes', '[{"code": "ADA", "label": "Automatic Debit Arrangement (ADA)"}, {"code": "PDC", "label": "Post-dated cheques"}, {"code": "ONLINE", "label": "Online banking / OTC / QR"}, {"code": "CARD", "label": "Credit card"}]', 'schemes', 'Payment modes of the renewal premiums under the Auto Renewal Agreement of Scheme 1', 'json', true),
 ('schemes.placement_confirmation', '"acknowledgement"', 'schemes', 'Insurer confirmation that lets a scheme policy be issued: acknowledgement (the insurer''s acknowledgement with its policy number on the placement slip) or epolicy-check (the e-policy recorded and checked against the slip)', 'string', true),
 ('schemes.skip_payment_verification', 'true', 'schemes', 'A placement slip of a scheme application is sent and issued without the proof of payment (the customer pays nothing; the dealer or TFSPH is billed at issuance)', 'boolean', true),
 ('schemes.application_schedule_ctpl', 'false', 'schemes', 'The premium schedule of an application includes the annual CTPL of the years after the 3-year CTPL (false: added at renewal)', 'boolean', true),
 ('schemes.loan_term_months', '{"min": 12, "max": 84}', 'schemes', 'Shortest and longest TFS loan term of a scheme application, in months', 'json', true),
 ('schemes.require_billing_client', 'true', 'schemes', 'A dealer or TFSPH without a billing client on Distribution Channels blocks the issue of a scheme policy (false: the billing client is created from the channel)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('sales', 'processing', 'operations', 'accounting', 'accounting-manager', 'compliance-officer', 'tis-sales-associate', 'tis-sales-officer',
                 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-finance', 'tis-general-manager', 'tis-it-admin'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'read:scheme-issuance');

INSERT INTO permissions(code, module, description) VALUES
 ('read:scheme-issuance', 'scheme-issuance', 'View Scheme Issuance: applications, checklists and loan bookings uploads; export'),
 ('write:scheme-issuance', 'scheme-issuance', 'Create, edit and upload scheme applications; receive documents; request waivers; send to the insurer; cancel before sending'),
 ('approve:scheme-issuance', 'scheme-issuance', 'Approve or reject a checklist waiver (never one you requested); cancel an application already sent to the insurer')
ON CONFLICT (code) DO NOTHING;

-- FRS SCHM-01 3.3 default grants; TISPH personas (proposal until TISPH names the users): the Operations personas create
-- and work the applications, the Operations Unit Head and the General Manager approve the waivers, everyone else reads.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('system-admin', 'read:scheme-issuance'), ('system-admin', 'write:scheme-issuance'), ('system-admin', 'approve:scheme-issuance'),
  ('processing', 'read:scheme-issuance'), ('processing', 'write:scheme-issuance'),
  ('sales', 'read:scheme-issuance'), ('operations', 'read:scheme-issuance'), ('accounting', 'read:scheme-issuance'),
  ('accounting-manager', 'read:scheme-issuance'), ('accounting-manager', 'approve:scheme-issuance'), ('compliance-officer', 'read:scheme-issuance'),
  ('tis-sales-associate', 'read:scheme-issuance'), ('tis-sales-officer', 'read:scheme-issuance'), ('tis-sales-unit-head', 'read:scheme-issuance'),
  ('tis-ops-associate', 'read:scheme-issuance'), ('tis-ops-associate', 'write:scheme-issuance'), ('tis-ops-officer', 'read:scheme-issuance'), ('tis-ops-officer', 'write:scheme-issuance'),
  ('tis-ops-unit-head', 'read:scheme-issuance'), ('tis-ops-unit-head', 'write:scheme-issuance'), ('tis-ops-unit-head', 'approve:scheme-issuance'),
  ('tis-finance', 'read:scheme-issuance'), ('tis-it-admin', 'read:scheme-issuance'),
  ('tis-general-manager', 'read:scheme-issuance'), ('tis-general-manager', 'approve:scheme-issuance')
) AS g(role, perm)
JOIN roles r ON r.code = g.role JOIN permissions p ON p.code = g.perm
ON CONFLICT DO NOTHING;
