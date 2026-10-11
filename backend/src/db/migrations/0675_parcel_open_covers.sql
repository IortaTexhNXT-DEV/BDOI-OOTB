-- Parcel / Courier open policy and declarations (TIS-BRD-PJRN-09, FRS PJRN-09 FR-PCL-001 to 061; gap register
-- GAP-QUOTE-20, GAP-QUOTE-21, GAP-QUOTE-22, GAP-QUOTE-24).
--
-- open_covers                 open cover type (cargo: rate and limit per conveyance; parcel: flat covers on each
--                             certificate), the covers, the charge per certificate billed to the client, the delivery
--                             types (reference), the remittance basis (net / gross), the daily declaration and the
--                             declaration file to the insurer (frequency, layout, e-mail)
-- open_cover_certificates     parcel certificates (kind parcel, PCC series): customer, TFS loan account, delivery
--                             address, documents, courier and waybill, the covers as issued, the charge; late and
--                             possible-duplicate flags, the daily declaration, the e-mail, the reversal after the
--                             month was declared (status reversed, a negative line on a later monthly declaration)
-- open_cover_daily_declarations   one per open cover and day (MDD series): open, closed or nil by the job "Daily
--                             declaration close", declared when its month is submitted
-- open_cover_declarations     the monthly declaration gains the lines per cover with the taxes inside a flat premium,
--                             the charge billed, the service fee, the commission, the file status and the insurer's
--                             acceptance
-- open_cover_declaration_files    every version of the declaration file written for the insurer
-- open_cover_endorsements     endorsements of the open policy (MOE series), approved by a second user (approve:marine)
-- open_cover_uploads          the parcel and shipment uploads with their counts and failed rows
--
-- Permissions: write:parcel-certificates (upload, add, cancel, print of the day), approve:marine (endorsements and
-- reversals, never one's own). FRS 3.3 default grants; the TISPH Sales personas keep read:marine and get
-- write:parcel-certificates instead of write:marine (set-up, endorsement and billing are Operations'). Idempotent.

ALTER TABLE open_covers ADD COLUMN IF NOT EXISTS cover_type text NOT NULL DEFAULT 'cargo';
ALTER TABLE open_covers ADD COLUMN IF NOT EXISTS covers jsonb NOT NULL DEFAULT '[]';
ALTER TABLE open_covers ADD COLUMN IF NOT EXISTS charge_per_certificate numeric(14,2);
ALTER TABLE open_covers ADD COLUMN IF NOT EXISTS delivery_types jsonb NOT NULL DEFAULT '[]';
ALTER TABLE open_covers ADD COLUMN IF NOT EXISTS remittance_basis text NOT NULL DEFAULT 'net';
ALTER TABLE open_covers ADD COLUMN IF NOT EXISTS daily_declaration boolean NOT NULL DEFAULT false;
ALTER TABLE open_covers ADD COLUMN IF NOT EXISTS file_frequency text;
ALTER TABLE open_covers ADD COLUMN IF NOT EXISTS file_layout text;
ALTER TABLE open_covers ADD COLUMN IF NOT EXISTS declaration_email text;
COMMENT ON COLUMN open_covers.covers IS 'Parcel covers on each certificate: [{ name, line (MARINE | PA), insurerPolicyNo, sumInsured, premium (inclusive of taxes), commissionPercent, coverDays (null = transit) }]';
COMMENT ON COLUMN open_covers.delivery_types IS 'Delivery types and the flat charge the client collects from its customer (reference only): [{ code, label, charge }]';
DO $$ BEGIN
  ALTER TABLE open_covers ADD CONSTRAINT open_covers_type_chk CHECK (cover_type IN ('cargo', 'parcel'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE open_covers ADD CONSTRAINT open_covers_remittance_basis_chk CHECK (remittance_basis IN ('net', 'gross'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE open_covers ADD CONSTRAINT open_covers_file_frequency_chk CHECK (file_frequency IS NULL OR file_frequency IN ('monthly', 'daily'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- the open covers of the PARCEL product made before the type existed are parcel covers
UPDATE open_covers o SET cover_type = 'parcel' FROM products p WHERE p.id = o.product_id AND upper(p.code) = 'PARCEL' AND o.cover_type = 'cargo' AND o.covers <> '[]'::jsonb;

CREATE TABLE IF NOT EXISTS open_cover_daily_declarations (
  id text PRIMARY KEY DEFAULT ('odd_' || encode(gen_random_bytes(8), 'hex')),
  declaration_number text NOT NULL UNIQUE,
  open_cover_id text NOT NULL REFERENCES open_covers(id),
  declaration_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'nil', 'declared')),
  monthly_declaration_id text REFERENCES open_cover_declarations(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (open_cover_id, declaration_date)
);
CREATE INDEX IF NOT EXISTS open_cover_daily_declarations_monthly_idx ON open_cover_daily_declarations(monthly_declaration_id);

CREATE TABLE IF NOT EXISTS open_cover_uploads (
  id text PRIMARY KEY DEFAULT ('ocu_' || encode(gen_random_bytes(8), 'hex')),
  open_cover_id text NOT NULL REFERENCES open_covers(id),
  kind text NOT NULL CHECK (kind IN ('parcels', 'shipments')),
  file_name text,
  item_date date,
  rows_total int NOT NULL DEFAULT 0,
  rows_created int NOT NULL DEFAULT 0,
  rows_failed int NOT NULL DEFAULT 0,
  messages jsonb NOT NULL DEFAULT '[]',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS open_cover_uploads_cover_idx ON open_cover_uploads(open_cover_id, created_at);

ALTER TABLE open_cover_certificates ALTER COLUMN conveyance DROP NOT NULL;
ALTER TABLE open_cover_certificates ALTER COLUMN voyage_from DROP NOT NULL;
ALTER TABLE open_cover_certificates ALTER COLUMN voyage_to DROP NOT NULL;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS customer_name text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS loan_account text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS address_line text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS barangay text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS city text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS province text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS zip_code text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS mobile text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS documents_sent text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS courier text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS waybill_no text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS delivery_type text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS delivery_charge numeric(14,2);
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS covers jsonb NOT NULL DEFAULT '[]';
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS charge numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS late boolean NOT NULL DEFAULT false;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS possible_duplicate boolean NOT NULL DEFAULT false;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS daily_declaration_id text REFERENCES open_cover_daily_declarations(id);
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS upload_id text REFERENCES open_cover_uploads(id);
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS emailed_at timestamptz;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS email_id bigint;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS cancelled_by text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS reversal_status text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS reversal_reason text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS reversal_requested_by text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS reversal_requested_at timestamptz;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS reversal_decided_by text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS reversal_decided_at timestamptz;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS reversal_remark text;
ALTER TABLE open_cover_certificates ADD COLUMN IF NOT EXISTS reversal_declaration_id text REFERENCES open_cover_declarations(id);
COMMENT ON COLUMN open_cover_certificates.covers IS 'Covers of a parcel certificate as issued (terms in force on the parcel date): [{ name, line, insurerPolicyNo, sumInsured, premium, commissionPercent, coverDays, from, to }]';
ALTER TABLE open_cover_certificates DROP CONSTRAINT IF EXISTS open_cover_certificates_kind_check;
ALTER TABLE open_cover_certificates DROP CONSTRAINT IF EXISTS open_cover_certificates_status_check;
DO $$ BEGIN
  ALTER TABLE open_cover_certificates ADD CONSTRAINT open_cover_certificates_kind_chk CHECK (kind IN ('certificate', 'declared', 'parcel'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE open_cover_certificates ADD CONSTRAINT open_cover_certificates_status_chk CHECK (status IN ('issued', 'declared', 'cancelled', 'reversed'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE open_cover_certificates ADD CONSTRAINT open_cover_certificates_reversal_chk CHECK (reversal_status IS NULL OR reversal_status IN ('pending', 'approved', 'returned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS open_cover_certificates_waybill_uq ON open_cover_certificates(open_cover_id, waybill_no) WHERE waybill_no IS NOT NULL AND status <> 'cancelled';
CREATE INDEX IF NOT EXISTS open_cover_certificates_loan_idx ON open_cover_certificates(open_cover_id, loan_account, shipment_date);
CREATE INDEX IF NOT EXISTS open_cover_certificates_daily_idx ON open_cover_certificates(daily_declaration_id);
CREATE INDEX IF NOT EXISTS open_cover_certificates_reversal_decl_idx ON open_cover_certificates(reversal_declaration_id);
CREATE INDEX IF NOT EXISTS open_cover_certificates_upload_idx ON open_cover_certificates(upload_id);

ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS reversals int NOT NULL DEFAULT 0;
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS charge_total numeric(16,2) NOT NULL DEFAULT 0;
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS service_fee numeric(16,2) NOT NULL DEFAULT 0;
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS commission numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS taxes_inside boolean NOT NULL DEFAULT false;
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS cover_lines jsonb NOT NULL DEFAULT '[]';
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS file_status text NOT NULL DEFAULT 'not-generated';
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS file_sent_at timestamptz;
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS file_sent_to text;
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS email_id bigint;
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS acceptance jsonb;
ALTER TABLE open_cover_declarations ADD COLUMN IF NOT EXISTS opened_by_job boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN open_cover_declarations.cover_lines IS 'Parcel cover: per cover the certificates, sum insured, premium (inclusive of taxes), net premium, VAT, DST, LGT and commission';
DO $$ BEGIN
  ALTER TABLE open_cover_declarations ADD CONSTRAINT open_cover_declarations_file_status_chk CHECK (file_status IN ('not-generated', 'generated', 'sent', 'accepted', 'accepted-with-differences'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS open_cover_declaration_files (
  id text PRIMARY KEY DEFAULT ('odf_' || encode(gen_random_bytes(8), 'hex')),
  declaration_id text NOT NULL REFERENCES open_cover_declarations(id) ON DELETE CASCADE,
  daily_declaration_id text REFERENCES open_cover_daily_declarations(id),
  version int NOT NULL,
  layout text NOT NULL,
  file_name text NOT NULL,
  rows_count int NOT NULL DEFAULT 0,
  total_premium numeric(16,2) NOT NULL DEFAULT 0,
  content bytea NOT NULL,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS open_cover_declaration_files_decl_idx ON open_cover_declaration_files(declaration_id, version);
CREATE INDEX IF NOT EXISTS open_cover_declaration_files_daily_idx ON open_cover_declaration_files(daily_declaration_id);

CREATE TABLE IF NOT EXISTS open_cover_endorsements (
  id text PRIMARY KEY DEFAULT ('oce_' || encode(gen_random_bytes(8), 'hex')),
  endorsement_number text UNIQUE,
  open_cover_id text NOT NULL REFERENCES open_covers(id),
  effective_from date NOT NULL,
  reason text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}',
  before_terms jsonb,
  after_terms jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'returned', 'recalled')),
  requested_by text,
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text,
  decided_at timestamptz,
  remark text
);
CREATE INDEX IF NOT EXISTS open_cover_endorsements_cover_idx ON open_cover_endorsements(open_cover_id, status);
CREATE UNIQUE INDEX IF NOT EXISTS open_cover_endorsements_pending_uq ON open_cover_endorsements(open_cover_id) WHERE status = 'pending';

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('parcel_certificate', 'Parcel Certificate', 'marine', 'PCC', '{PREFIX}-{YYYY}-{SEQ}', 6, 'yearly', 'Certificate of insurance of one parcel under a Parcel / Courier open cover', 'migration:0675'),
 ('daily_declaration', 'Daily Declaration', 'marine', 'MDD', '{PREFIX}-{YYYY}-{SEQ}', 6, 'yearly', 'Daily declaration of the certificates or shipments of one day under an open cover', 'migration:0675'),
 ('open_cover_endorsement', 'Open Policy Endorsement', 'marine', 'MOE', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly', 'Endorsement of an open policy (Marine Open Covers), numbered on approval', 'migration:0675')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('parcel.default_charge', '500', 'parcel', 'Charge per certificate proposed on a new Parcel / Courier open cover (PHP)', 'number', true),
 ('parcel.delivery_types', '[{"code": "RUSH", "label": "Rush", "charge": 2500}, {"code": "REGULAR", "label": "Regular", "charge": 2000}]', 'parcel', 'Delivery types and the flat charge the client collects from its customer for each (reference only, used in no computation)', 'json', true),
 ('parcel.max_covers', '5', 'parcel', 'Most covers on one parcel certificate', 'number', true),
 ('parcel.default_covers', '[{"name": "Marine (parcel)", "line": "MARINE", "insurerPolicyNo": "", "sumInsured": 10000, "premium": 12, "commissionPercent": 3, "coverDays": null}, {"name": "Personal Accident", "line": "PA", "insurerPolicyNo": "", "sumInsured": 50000, "premium": 50, "commissionPercent": 3, "coverDays": 365}]', 'parcel', 'Covers proposed on a new Parcel / Courier open cover (premium inclusive of taxes; coverDays empty = transit)', 'json', true),
 ('parcel.cover_lines', '["MARINE", "PA"]', 'parcel', 'Lines of business a parcel cover may be on', 'json', true),
 ('parcel.max_upload_rows', '2000', 'parcel', 'Rows per parcel or shipment upload', 'number', true),
 ('parcel.max_backdate_days', '30', 'parcel', 'Oldest parcel date accepted, in days before today (an older parcel is referred to the insurer)', 'number', true),
 ('parcel.duplicate_days', '7', 'parcel', 'Days within which the same loan account on another certificate gives the possible-duplicate warning', 'number', true),
 ('parcel.reversal_max_days', '60', 'parcel', 'Days after the parcel date within which a declared certificate can be reversed', 'number', true),
 ('parcel.daily_cutoff_time', '"23:59"', 'parcel', 'End of the declaration day (HH:MM, business time zone): the job closes the days already ended', 'string', true),
 ('parcel.default_courier', '"LBC Express"', 'parcel', 'Courier of a parcel row without one', 'string', true),
 ('parcel.documents_sent', '["Certificate of registration", "Deed of sale", "Other"]', 'parcel', 'Documents a parcel may carry (DOCUMENTS column, several separated by ;)', 'json', true),
 ('parcel.cancel_reasons', '["Parcel not sent", "Wrong customer details", "Duplicate", "Other"]', 'parcel', 'Reasons for cancelling or reversing a parcel certificate', 'json', true),
 ('parcel.certificate_wording', '"The limit of liability per parcel is the sum insured of the Marine (parcel) cover, in excess of what is recoverable from the courier. Loss or damage must be reported to the insurer within 30 days of the delivery date with this certificate and the waybill. Cover is subject to the terms, conditions and clauses of the open policy named above."', 'parcel', 'Wording printed on the parcel certificate of insurance', 'string', true),
 ('parcel.email_certificate', 'true', 'parcel', 'E-mail the certificate to the customer when an e-mail address is given (password-protected PDF)', 'boolean', true),
 ('parcel.certificate_password', '"loan_last6"', 'parcel', 'Password of the e-mailed parcel certificate: loan_last6 or loan_last4 (last digits of the loan account), mobile_last4, or none', 'string', true),
 ('parcel.certificate_email_subject', '"Your parcel insurance certificate {{certificateNumber}}"', 'parcel', 'Subject of the e-mail that sends the parcel certificate ({{certificateNumber}}, {{customerName}}, {{waybillNo}})', 'string', true),
 ('parcel.certificate_email_body', '"<p>Dear {{customerName}},</p><p>Your parcel with waybill {{waybillNo}} is insured. Your certificate of insurance {{certificateNumber}} is attached. {{passwordHint}}</p><p>Thank you.</p>"', 'parcel', 'Body of the e-mail that sends the parcel certificate ({{passwordHint}} explains the password)', 'string', true),
 ('parcel.commission_base', '"gross"', 'parcel', 'Commission of a parcel cover on the premium with the taxes inside it (gross) or on the premium net of taxes (net)', 'string', true),
 ('parcel.service_fee_vat', '"inclusive"', 'parcel', 'VAT on the service fee (charge less premium): inclusive (output VAT inside the fee) or exempt', 'string', true),
 ('marine.default_daily_declaration', 'true', 'marine', 'A new open cover keeps a daily declaration (closed each night by the job) unless switched off on the cover', 'boolean', true),
 ('marine.endorse_active_covers', 'true', 'marine', 'An active open cover is changed only by an endorsement approved by a second user (approve:marine); off: edited in place', 'boolean', true),
 ('marine.declaration_file_layouts', '{"axa-parcel": {"label": "AXA parcel layout", "kind": "parcel", "fileName": "{insurerCode}_{policyNo}_{period}_{declarationNo}.xlsx", "columns": ["DECL_NO", "DECL_DATE", "CERT_NO", "POLICY_NO", "COVER", "ASSURED", "CUSTOMER", "LOAN_ACCOUNT", "ADDRESS", "WAYBILL", "COURIER", "PARCEL_DATE", "LATE", "SUM_INSURED", "PREMIUM", "NET_PREMIUM", "TAXES", "STATUS"], "nameFormat": "LAST, FIRST", "upperCaseNames": true}, "cargo": {"label": "Cargo layout", "kind": "cargo", "fileName": "{insurerCode}_{policyNo}_{period}_{declarationNo}.xlsx", "columns": ["DECL_NO", "DECL_DATE", "CERT_NO", "POLICY_NO", "SHIPMENT_DATE", "CONVEYANCE", "VOYAGE_FROM", "VOYAGE_TO", "DELIVERY_RECEIPT", "TRUCK_PLATE", "GOODS", "CONSIGNEE", "INVOICE_VALUE", "MARKUP_PCT", "INSURED_VALUE", "RATE_PCT", "PREMIUM", "STATUS"]}}', 'marine', 'Declaration file layouts sent to the insurer: columns of the Declaration sheet (from the list of the FRS), file name pattern, name format', 'json', true),
 ('marine.declaration_email_subject', '"Declaration {{declarationNumber}} - {{policyNo}} - {{period}}"', 'marine', 'Subject of the e-mail that sends a declaration file to the insurer', 'string', true),
 ('marine.declaration_email_body', '"<p>Dear {{insurerName}},</p><p>Please find attached declaration {{declarationNumber}} of {{period}} under open policy {{policyNo}}: {{rows}} rows, total premium {{premium}}, with the declaration summary and the certificate register.</p><p>Kindly confirm your acceptance with your reference.</p>"', 'marine', 'Body of the e-mail that sends a declaration file to the insurer', 'string', true)
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('marine-daily-declaration-close', 'Daily declaration close', 'Closes the daily declarations of the open covers for the days already ended (parcel.daily_cutoff_time); a day without certificates or shipments is recorded as Nil', '10 0 * * *', 'marineDailyDeclarationClose', '{}', true),
 ('marine-monthly-declaration-open', 'Monthly declaration open', 'Opens the monthly declaration of the previous month for each active open cover with a daily declaration and attaches its daily declarations, late items and reversals', '0 1 1 * *', 'marineMonthlyDeclarationOpen', '{}', true)
ON CONFLICT (code) DO NOTHING;

-- the service fee of a parcel bill (charge per certificate less the premium), FR-PCL-040; income account from Finance
INSERT INTO app_settings(key, value, "group", label, type, editable)
SELECT 'accounting.account.parcel_service_fee_income', COALESCE((SELECT value FROM app_settings WHERE key = 'accounting.account.service_fee_income'), '"3202001"'::jsonb),
  'accounting', 'GL: Parcel service fee income (charge per certificate less the premium, FR-PCL-040)', 'string', true
ON CONFLICT (key) DO NOTHING;
WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'parcel.service_fee', 1, 'Parcel service fee billed', 'The service fee on a parcel declaration bill (charge per certificate less the premium remitted to the insurer): receivable from the client, fee income and the output VAT inside it (parcel.service_fee_vat).',
    'marine', 'NEW_BUSINESS', 'booking', 'Parcel service fee – {{policyNumber}} ({{billNumber}})', 'policy_owner', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'parcel.service_fee') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'premium_receivable', NULL::text, 'amount', false, 'Service fee {{billNumber}} – {{policyNumber}}'),
  (2, 'Cr', 'role', 'parcel_service_fee_income', NULL::text, 'fee', false, 'Parcel service fee ({{billNumber}})'),
  (3, 'Cr', 'role', 'output_vat', NULL::text, 'vat', false, 'Output VAT on the parcel service fee ({{billNumber}})')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('sales', 'processing', 'operations', 'accounting-manager', 'compliance-officer', 'tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head',
                 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-finance', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'write:parcel-certificates');

INSERT INTO permissions(code, module, description) VALUES
 ('write:parcel-certificates', 'marine', 'Upload parcels, add a parcel, cancel a certificate not yet declared, request a reversal, print the certificates of the day'),
 ('approve:marine', 'marine', 'Approve or return open policy endorsements and reversals of declared certificates (never one you requested)')
ON CONFLICT (code) DO NOTHING;
UPDATE permissions SET description = 'Set up and activate open covers, request endorsements, upload cargo shipments, submit, send and bill declarations' WHERE code = 'write:marine';

-- FRS PJRN-09 3.3 default grants; TISPH personas (proposal until TISPH names the users): Sales uploads and adds parcels,
-- Operations does everything but approve, TIS Finance and the General Manager approve
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('system-admin', 'write:parcel-certificates'), ('system-admin', 'approve:marine'),
  ('processing', 'write:parcel-certificates'), ('operations', 'write:parcel-certificates'), ('sales', 'write:parcel-certificates'),
  ('accounting-manager', 'read:marine'), ('accounting-manager', 'approve:marine'), ('compliance-officer', 'read:marine'),
  ('tis-sales-associate', 'read:marine'), ('tis-sales-associate', 'write:parcel-certificates'), ('tis-sales-officer', 'read:marine'), ('tis-sales-officer', 'write:parcel-certificates'),
  ('tis-sales-unit-head', 'read:marine'), ('tis-sales-unit-head', 'write:parcel-certificates'),
  ('tis-ops-associate', 'write:parcel-certificates'), ('tis-ops-officer', 'write:parcel-certificates'), ('tis-ops-unit-head', 'write:parcel-certificates'),
  ('tis-finance', 'read:marine'), ('tis-finance', 'approve:marine'), ('tis-general-manager', 'write:parcel-certificates'), ('tis-general-manager', 'approve:marine')
) v(role, perm) JOIN roles r ON r.code = v.role JOIN permissions p ON p.code = v.perm
ON CONFLICT DO NOTHING;

-- Sales personas no longer set up, endorse or bill open covers (GAP-QUOTE-24)
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
               WHERE r.code IN ('tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head') AND p.code = 'write:marine');
DELETE FROM role_permissions rp USING roles r, permissions p
 WHERE r.id = rp.role_id AND p.id = rp.permission_id AND r.code IN ('tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head') AND p.code = 'write:marine';
