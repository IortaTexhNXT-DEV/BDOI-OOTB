-- Lock-in handling: TFS loan status upload, lock-in changes with approval, the 60-day Lock-in Review with its decisions
-- and approval, and the Lock-in / Scheme 2 expiry report (TIS-BRD-SCHM-03, TIS-BRD-RPT-SLS-05, CR-05; FRS SCHM-03
-- FR-LCK-002, 003, 004, 014, 020 to 023, 030 to 032, 040, 041, 050, 051). The lock-in record and the notice gate are
-- migration 0501.
--
-- policy_lock_ins (0501) gains: loan status early-terminated; source loan (a TFS loan account kept on a policy without a
-- lock-in, so the loan status rule applies to its notices); lock-in status not-renewed; the TFS status date, the days
-- past due and maturity of the loan, whether the status was set by hand (manual: not overwritten by the TFS file), the
-- upload batch, and why and when a lock-in ended.
-- loan_status_batches: the TFS account status uploads (LS-yyyy-nnnnn) with their counts (loaded, not changed, failed,
-- notices held, holds lifted) and failed rows. loan_status_history: every change of a loan status (upload or by hand).
-- lock_in_reviews: one review item per locked or Scheme 2 policy term, raised by the job Lock-in review on the review
-- date: review-due, lockin-ends (last lock-in year, information only), on-hold (re-review date), pending-approval,
-- returned, and the closed decisions renew (Renew under lock-in), released (Release to standard renewal) and
-- not-renewed (Not for renewal).
-- lock_in_changes: Change lock-in requests (add, correct, end) applied once a second user approves them.
--
-- Settings (group lockin): lockin.hold_max_days, lockin.loan_status_stale_days, lockin.upload_max_rows,
-- lockin.release_maker_checker, lockin.review_roles, lockin.tfs_status_map, lockin.report_max_days; the blocking
-- statuses gain early-terminated where the delivered value is unchanged. The review window is lockin.review_days_before
-- (0501). Job lock-in-review (daily 05:15). Numbering loan_status_batch (LS). Permissions read:lock-in, write:lock-in,
-- approve:lock-in, write:loan-status. Report lock-in-expiry (Reports > Operational Reports). Idempotent.

ALTER TABLE policy_lock_ins DROP CONSTRAINT IF EXISTS policy_lock_ins_loan_status_check;
ALTER TABLE policy_lock_ins ADD CONSTRAINT policy_lock_ins_loan_status_check
  CHECK (loan_status IN ('current', 'past-due', 'fraud', 'early-terminated', 'terminated', 'legal-dispute', 'closed'));
ALTER TABLE policy_lock_ins DROP CONSTRAINT IF EXISTS policy_lock_ins_source_check;
ALTER TABLE policy_lock_ins ADD CONSTRAINT policy_lock_ins_source_check CHECK (source IN ('promotion', 'scheme1-ara', 'scheme2', 'loan'));
ALTER TABLE policy_lock_ins DROP CONSTRAINT IF EXISTS policy_lock_ins_status_check;
ALTER TABLE policy_lock_ins ADD CONSTRAINT policy_lock_ins_status_check CHECK (status IN ('active', 'ended', 'released', 'not-renewed', 'cancelled'));
ALTER TABLE policy_lock_ins ADD COLUMN IF NOT EXISTS loan_status_date date;
ALTER TABLE policy_lock_ins ADD COLUMN IF NOT EXISTS loan_status_manual boolean NOT NULL DEFAULT false;
ALTER TABLE policy_lock_ins ADD COLUMN IF NOT EXISTS loan_status_batch_id text;
ALTER TABLE policy_lock_ins ADD COLUMN IF NOT EXISTS days_past_due integer;
ALTER TABLE policy_lock_ins ADD COLUMN IF NOT EXISTS loan_maturity_date date;
ALTER TABLE policy_lock_ins ADD COLUMN IF NOT EXISTS ended_reason text;
ALTER TABLE policy_lock_ins ADD COLUMN IF NOT EXISTS ended_at timestamptz;
COMMENT ON COLUMN policy_lock_ins.loan_status_manual IS 'The loan status was set by hand (Set loan status): the TFS status file does not overwrite it';

CREATE TABLE IF NOT EXISTS loan_status_batches (
  id text PRIMARY KEY DEFAULT 'lsb_' || encode(gen_random_bytes(8), 'hex'),
  batch_number text UNIQUE,
  file_name text,
  status_date date,
  rows_total integer NOT NULL DEFAULT 0,
  rows_loaded integer NOT NULL DEFAULT 0,
  rows_not_changed integer NOT NULL DEFAULT 0,
  rows_failed integer NOT NULL DEFAULT 0,
  notices_held integer NOT NULL DEFAULT 0,
  holds_lifted integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  not_changed jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loan_status_batches_created_by_fk_idx ON loan_status_batches (created_by);
COMMENT ON TABLE loan_status_batches IS 'TFS account status uploads (SCHM-03 FR-LCK-020)';

CREATE TABLE IF NOT EXISTS loan_status_history (
  id bigserial PRIMARY KEY,
  loan_account text NOT NULL,
  policy_id text NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  status_date date,
  source text NOT NULL CHECK (source IN ('upload', 'manual', 'system')),
  batch_id text REFERENCES loan_status_batches(id),
  treatment text,
  remark text,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loan_status_history_loan_idx ON loan_status_history (loan_account, changed_at DESC);
CREATE INDEX IF NOT EXISTS loan_status_history_policy_id_fk_idx ON loan_status_history (policy_id);
CREATE INDEX IF NOT EXISTS loan_status_history_batch_id_fk_idx ON loan_status_history (batch_id);
COMMENT ON TABLE loan_status_history IS 'Every change of the TFS loan status of a policy (SCHM-03 FR-LCK-020, 021, 050)';

CREATE TABLE IF NOT EXISTS lock_in_reviews (
  id text PRIMARY KEY DEFAULT 'lkr_' || encode(gen_random_bytes(8), 'hex'),
  policy_id text NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  renewal_id text REFERENCES renewals(id),
  term_expiry date NOT NULL,
  review_date date NOT NULL,
  lock_in_year integer,
  lock_in_years integer,
  status text NOT NULL DEFAULT 'review-due' CHECK (status IN ('review-due', 'lockin-ends', 'on-hold', 'pending-approval', 'returned', 'renew', 'released', 'not-renewed')),
  decision text CHECK (decision IS NULL OR decision IN ('renew', 'hold', 'release', 'not-renewed')),
  reason_code text,
  reason text,
  remark text,
  re_review_date date,
  decided_by text REFERENCES users(id),
  decided_at timestamptz,
  approved_by text REFERENCES users(id),
  approved_at timestamptz,
  return_note text,
  owner_user_id text REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (policy_id, term_expiry)
);
CREATE INDEX IF NOT EXISTS lock_in_reviews_status_idx ON lock_in_reviews (status, review_date);
CREATE INDEX IF NOT EXISTS lock_in_reviews_renewal_id_fk_idx ON lock_in_reviews (renewal_id);
CREATE INDEX IF NOT EXISTS lock_in_reviews_decided_by_fk_idx ON lock_in_reviews (decided_by);
CREATE INDEX IF NOT EXISTS lock_in_reviews_approved_by_fk_idx ON lock_in_reviews (approved_by);
CREATE INDEX IF NOT EXISTS lock_in_reviews_owner_user_id_fk_idx ON lock_in_reviews (owner_user_id);
COMMENT ON TABLE lock_in_reviews IS 'Lock-in Review items: lock-in and Scheme 2 accounts 60 days before expiry and their decision (SCHM-03 FR-LCK-030 to 041)';

CREATE TABLE IF NOT EXISTS lock_in_changes (
  id text PRIMARY KEY DEFAULT 'lkc_' || encode(gen_random_bytes(8), 'hex'),
  policy_id text NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('add', 'correct', 'end')),
  before_values jsonb,
  proposed jsonb NOT NULL DEFAULT '{}'::jsonb,
  remark text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'returned')),
  requested_by text REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by text REFERENCES users(id),
  decided_at timestamptz,
  decision_note text
);
CREATE UNIQUE INDEX IF NOT EXISTS lock_in_changes_one_pending ON lock_in_changes (policy_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS lock_in_changes_requested_by_fk_idx ON lock_in_changes (requested_by);
CREATE INDEX IF NOT EXISTS lock_in_changes_decided_by_fk_idx ON lock_in_changes (decided_by);
COMMENT ON TABLE lock_in_changes IS 'Change lock-in requests (add, correct, end), applied on the approval of a second user (SCHM-03 FR-LCK-002)';

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('loan_status_batch', 'TFS Loan Status Upload', 'renewals', 'LS', 'Upload of the TFS account status file (Operations > Renewals > Lock-in Review > Upload loan status)', 'migration:0602')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('lockin.hold_max_days', '30', 'lockin', 'Longest Hold of a lock-in review before the account is reviewed again, in days', 'number', true),
 ('lockin.loan_status_stale_days', '45', 'lockin', 'Age in days after which a TFS loan status is flagged as old', 'number', true),
 ('lockin.upload_max_rows', '5000', 'lockin', 'Rows per TFS account status upload', 'number', true),
 ('lockin.release_maker_checker', 'true', 'lockin', 'Release to standard renewal and Not for renewal need the approval of a second user (approve:lock-in)', 'boolean', true),
 ('lockin.review_roles', '["processing"]', 'lockin', 'Roles that get the lock-in review task when the policy has no owner', 'json', true),
 ('lockin.tfs_status_map', '{"CURRENT": "current", "ACTIVE": "current", "PAST DUE": "past-due", "MISSED PAYMENT": "past-due", "DELINQUENT": "past-due", "FRAUD": "fraud", "PRE-TERMINATED": "early-terminated", "EARLY TERMINATED": "early-terminated", "TERMINATED": "terminated", "REPOSSESSED": "terminated", "LEGAL": "legal-dispute", "LITIGATION": "legal-dispute", "LEGAL DISPUTE": "legal-dispute", "CLOSED": "closed", "FULLY PAID": "closed", "MATURED": "closed"}', 'lockin', 'TFS loan status codes of the account status file and the BrokerVerse loan status each one means', 'json', true),
 ('lockin.report_max_days', '365', 'lockin', 'Widest Days to expiry window of the Lock-in / Scheme 2 expiry report', 'number', true)
ON CONFLICT (key) DO NOTHING;

UPDATE app_settings SET value = '["past-due", "fraud", "early-terminated", "terminated", "legal-dispute"]'::jsonb, updated_at = now()
 WHERE key = 'lockin.blocking_loan_statuses' AND value = '["past-due", "fraud", "terminated", "legal-dispute"]'::jsonb;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('lock-in-review', 'Lock-in review', 'Lock-in years and review dates of the locked terms, review items and tasks of the lock-in and Scheme 2 accounts whose review date has come, holds due for review, ended lock-ins, and the day''s Lock-in / Scheme 2 expiry report', '15 5 * * *', 'lockInReview', '{}', true)
ON CONFLICT (code) DO NOTHING;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('sales', 'processing', 'operations', 'accounting', 'accounting-manager', 'compliance-officer', 'tis-sales-associate', 'tis-sales-officer',
                 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-finance', 'tis-general-manager', 'tis-it-admin'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'read:lock-in');

INSERT INTO permissions(code, module, description) VALUES
 ('read:lock-in', 'lock-in', 'Open Lock-in Review, the Lock-in & loan panel of a policy and the Lock-in / Scheme 2 expiry report; export'),
 ('write:lock-in', 'lock-in', 'Record lock-in review decisions; request a lock-in change on a policy'),
 ('approve:lock-in', 'lock-in', 'Approve or return Release to standard renewal, Not for renewal and lock-in changes (never one you requested)'),
 ('write:loan-status', 'lock-in', 'Upload the TFS account status file; set the loan status of a policy by hand')
ON CONFLICT (code) DO NOTHING;

-- FRS SCHM-03 3.3 default grants; TISPH personas (proposal until TISPH names the users): Sales and Operations review and
-- decide, the Sales Unit Head and the General Manager approve, Operations upload the TFS file, everyone else reads.
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('system-admin', 'read:lock-in'), ('system-admin', 'write:lock-in'), ('system-admin', 'approve:lock-in'), ('system-admin', 'write:loan-status'),
  ('processing', 'read:lock-in'), ('processing', 'write:lock-in'), ('sales', 'read:lock-in'), ('sales', 'write:lock-in'),
  ('operations', 'read:lock-in'), ('operations', 'write:loan-status'), ('accounting', 'read:lock-in'),
  ('accounting-manager', 'read:lock-in'), ('accounting-manager', 'approve:lock-in'), ('compliance-officer', 'read:lock-in'), ('compliance-officer', 'write:loan-status'),
  ('tis-sales-associate', 'read:lock-in'), ('tis-sales-associate', 'write:lock-in'), ('tis-sales-officer', 'read:lock-in'), ('tis-sales-officer', 'write:lock-in'),
  ('tis-sales-unit-head', 'read:lock-in'), ('tis-sales-unit-head', 'write:lock-in'), ('tis-sales-unit-head', 'approve:lock-in'),
  ('tis-ops-associate', 'read:lock-in'), ('tis-ops-associate', 'write:loan-status'), ('tis-ops-officer', 'read:lock-in'), ('tis-ops-officer', 'write:lock-in'), ('tis-ops-officer', 'write:loan-status'),
  ('tis-ops-unit-head', 'read:lock-in'), ('tis-ops-unit-head', 'write:lock-in'), ('tis-ops-unit-head', 'write:loan-status'),
  ('tis-finance', 'read:lock-in'), ('tis-it-admin', 'read:lock-in'),
  ('tis-general-manager', 'read:lock-in'), ('tis-general-manager', 'approve:lock-in')
) AS g(role, perm)
JOIN roles r ON r.code = g.role JOIN permissions p ON p.code = g.perm
ON CONFLICT DO NOTHING;

INSERT INTO report_definitions(code, name, category, description, screen, parameters, query_name, default_columns, roles, permission, sort_order) VALUES
 ('lock-in-expiry', 'Lock-in / Scheme 2 Expiry', 'operational',
  'Lock-in and Scheme 2 accounts expiring within the chosen days of the as-of date (60 by default), with the unit, premium, TFS loan status, lock-in year, notice treatment and review decision, so that past-due and early-terminated accounts are seen before the renewal is issued (TIS-BRD-RPT-SLS-05).',
  'Reports > Operational Reports > Lock-in / Scheme 2 Expiry',
  '{"type": "object", "required": ["ReportCriteria"], "properties": {"ToDate": {"type": "string", "title": "As of Date", "format": "date"}, "ReportCriteria": {"enum": ["Lock-in / Scheme 2 expiry (60 days)", "Expiring within 30 days", "Expiring within 90 days", "Loan status blocking", "Scheme 1 ARA and promotion lock-ins", "Scheme 2 accounts", "Review pending"], "type": "string", "title": "Report Criteria", "default": "Lock-in / Scheme 2 expiry (60 days)"}, "Status": {"enum": ["", "Current", "Past due", "Fraud", "Early terminated", "Terminated", "Legal dispute", "Closed"], "type": "string", "title": "Loan status"}, "Agent": {"type": "string", "title": "Account coordinator", "x-options": "agents", "description": "id, username or name"}, "Company": {"type": "string", "title": "Insurer", "x-options": "insurance_companies", "description": "id, code or name"}, "Product": {"type": "string", "title": "Product", "x-options": "products", "description": "id, code or name"}, "format": {"enum": ["csv", "xlsx", "pdf"], "type": "string", "title": "File format (generate only)", "default": "xlsx"}, "period": {"enum": ["today"], "type": "string", "title": "Relative period (schedules; the as-of date is the day of the run)"}}}',
  'lockInExpiry',
  '[{"key":"asOfDate","type":"date","label":"As of Date"},{"key":"coordinator","type":"text","label":"Account Coordinator"},{"key":"policyNumber","type":"text","label":"Policy No."},{"key":"insurer","type":"text","label":"Insurer"},{"key":"product","type":"text","label":"Product"},{"key":"inceptionDate","type":"date","label":"Inception"},{"key":"expiryDate","type":"date","label":"Expiry"},{"key":"daysToExpiry","type":"integer","label":"Days to Expiry","total":false},{"key":"client","type":"text","label":"Assured Name"},{"key":"email","type":"text","label":"E-mail Address","pdf":false},{"key":"mobile","type":"text","label":"Contact Number","pdf":false},{"key":"unit","type":"text","label":"Unit Model"},{"key":"plateNumber","type":"text","label":"Plate No.","pdf":false},{"key":"chassisNumber","type":"text","label":"Chassis No.","pdf":false},{"key":"engineNumber","type":"text","label":"Engine No.","pdf":false},{"key":"color","type":"text","label":"Color","pdf":false},{"key":"sumInsured","type":"money","label":"FMV (Sum Insured)"},{"key":"premium","type":"money","label":"Current Total Premium"},{"key":"loanAccount","type":"text","label":"TFS Loan Account"},{"key":"loanStatus","type":"text","label":"Loan Status"},{"key":"loanStatusDate","type":"date","label":"Loan Status Date"},{"key":"daysPastDue","type":"integer","label":"Days Past Due","total":false},{"key":"lockInSource","type":"text","label":"Lock-in Source"},{"key":"reference","type":"text","label":"Reference"},{"key":"lockInYear","type":"text","label":"Lock-in Year"},{"key":"lockInEnd","type":"date","label":"Lock-in End"},{"key":"reviewDate","type":"date","label":"Review Date"},{"key":"noticeTreatment","type":"text","label":"Notice Treatment"},{"key":"notices","type":"text","label":"Notices Sent / Skipped / Cancelled","pdf":false},{"key":"reviewStatus","type":"text","label":"Review Status"},{"key":"decision","type":"text","label":"Decision"},{"key":"decidedBy","type":"text","label":"Decided By","pdf":false},{"key":"decidedOn","type":"date","label":"Decided On","pdf":false},{"key":"remark","type":"text","label":"Remark","pdf":false}]',
  '{sales,processing,operations,accounting}', 'read:lock-in', 274)
ON CONFLICT (code) DO NOTHING;
