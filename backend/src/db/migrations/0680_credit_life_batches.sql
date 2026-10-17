-- Credit Life batches, master policies and certificates of cover (TIS-BRD-PJRN-01, TIS-BRD-PJRN-02, FGA CL-01 to CL-04;
-- gap register GAP-QUOTE-18).
--
-- credit_life_batches          the monthly batch of a financing bank (TFS): its customers' loan accounts, loaded from
--                              the bank's file or encoded one by one, checked against the Credit Life rules
--                              (credit_life.rules of QUOT-06: age, number of accounts, loan tenor, sum insured), issued
--                              and forwarded to the insurer
-- credit_life_master_policies  one master policy per customer of the financing bank with an insurer, covering all the
--                              customer's loans (PJRN-02)
-- credit_life_members          one row per loan account of a batch: the borrower, the loan, the sum insured and premium,
--                              the checks that failed, and once issued the certificate of cover (CLC series) on the
--                              customer's master policy, e-mailed as a password-protected PDF (credit_life.certificate_password)
--
-- Permissions read:credit-life and write:credit-life (Operations > Credit Life). Idempotent.

CREATE TABLE IF NOT EXISTS credit_life_batches (
  id text PRIMARY KEY DEFAULT ('clb_' || encode(gen_random_bytes(8), 'hex')),
  batch_number text NOT NULL UNIQUE,
  financing_client_id text NOT NULL REFERENCES clients(id),
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  product_id int REFERENCES products(id),
  period text NOT NULL,                              -- YYYY-MM of the bank's batch
  file_name text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'sent', 'cancelled')),
  notes text,
  issued_at timestamptz,
  issued_by text,
  sent_at timestamptz,
  sent_to text,
  email_id bigint,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_life_batches_client_idx ON credit_life_batches(financing_client_id, period);
CREATE INDEX IF NOT EXISTS credit_life_batches_insurer_idx ON credit_life_batches(insurance_company_id);
CREATE INDEX IF NOT EXISTS credit_life_batches_product_idx ON credit_life_batches(product_id);

CREATE TABLE IF NOT EXISTS credit_life_master_policies (
  id text PRIMARY KEY DEFAULT ('clm_' || encode(gen_random_bytes(8), 'hex')),
  master_number text NOT NULL UNIQUE,
  financing_client_id text NOT NULL REFERENCES clients(id),
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  product_id int REFERENCES products(id),
  customer_key text NOT NULL,                        -- the bank's customer number, else name and birth date
  customer_no text,
  first_name text,
  last_name text,
  birth_date date,
  email text,
  mobile text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (financing_client_id, insurance_company_id, customer_key)
);
CREATE INDEX IF NOT EXISTS credit_life_master_policies_insurer_idx ON credit_life_master_policies(insurance_company_id);
CREATE INDEX IF NOT EXISTS credit_life_master_policies_product_idx ON credit_life_master_policies(product_id);

CREATE TABLE IF NOT EXISTS credit_life_members (
  id text PRIMARY KEY DEFAULT ('clmb_' || encode(gen_random_bytes(8), 'hex')),
  batch_id text NOT NULL REFERENCES credit_life_batches(id) ON DELETE CASCADE,
  master_policy_id text REFERENCES credit_life_master_policies(id),
  row_no int,
  certificate_number text UNIQUE,
  customer_no text,
  first_name text,
  last_name text,
  birth_date date,
  email text,
  mobile text,
  address text,
  city text,
  province text,
  loan_account text NOT NULL,
  loan_amount numeric(16,2),
  loan_term_months int,
  release_date date,
  account_count int,
  sum_insured numeric(16,2) NOT NULL DEFAULT 0,
  premium numeric(14,2) NOT NULL DEFAULT 0,
  cover_from date,
  cover_to date,
  status text NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'error', 'issued', 'cancelled')),
  errors jsonb NOT NULL DEFAULT '[]',
  email_id bigint,
  emailed_at timestamptz,
  issued_at timestamptz,
  cancel_reason text,
  cancelled_by text,
  cancelled_at timestamptz,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_life_members_batch_idx ON credit_life_members(batch_id, row_no);
CREATE INDEX IF NOT EXISTS credit_life_members_master_idx ON credit_life_members(master_policy_id);
CREATE INDEX IF NOT EXISTS credit_life_members_loan_idx ON credit_life_members(loan_account, status);

INSERT INTO document_numbering(code, name, module, prefix, pattern, seq_width, reset_rule, description, created_by) VALUES
 ('credit_life_batch', 'Credit Life Batch', 'credit-life', 'CLB', '{PREFIX}-{YYYY}-{SEQ}', 5, 'yearly', 'Monthly Credit Life batch of a financing bank (Operations > Credit Life)', 'migration:0680'),
 ('credit_life_master', 'Credit Life Master Policy', 'credit-life', 'CLMP', '{PREFIX}-{YYYY}-{SEQ}', 6, 'yearly', 'Credit Life master policy of one customer of a financing bank', 'migration:0680'),
 ('credit_life_certificate', 'Credit Life Certificate', 'credit-life', 'CLC', '{PREFIX}-{YYYY}-{SEQ}', 6, 'yearly', 'Credit Life certificate of cover of one loan account', 'migration:0680')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('credit_life.batch_product', '"CL-COMP"', 'credit_life', 'Product of a new Credit Life batch (the complimentary year-1 cover of a TFS motor loan)', 'string', true),
 ('credit_life.batch_sum_insured', '1000000', 'credit_life', 'Sum insured of a batch member without one (at most credit_life.rules defaultSumInsured)', 'number', true),
 ('credit_life.batch_premium_basis', '"fixed"', 'credit_life', 'Premium of a batch member: fixed (credit_life.batch_premium_per_account) or rate (sum insured / 1,000 x credit_life.rules ratePerThousand)', 'string', true),
 ('credit_life.batch_premium_per_account', '2000', 'credit_life', 'Fixed premium per loan account paid by the financing bank (PHP)', 'number', true),
 ('credit_life.cover_start', '"release_date"', 'credit_life', 'Start of cover of a certificate: release_date (the loan release date of the row) or batch_period (the first day of the batch month)', 'string', true),
 ('credit_life.max_upload_rows', '10000', 'credit_life', 'Rows per Credit Life batch upload', 'number', true),
 ('credit_life.email_certificate', 'true', 'credit_life', 'E-mail the certificate of cover to the borrower when an e-mail address is given (password-protected PDF)', 'boolean', true),
 ('credit_life.certificate_password', '"birth_ddmmyyyy"', 'credit_life', 'Password of the e-mailed certificate: birth_ddmmyyyy (birth date DDMMYYYY), loan_last4 or loan_last6 (last digits of the loan account), or none', 'string', true),
 ('credit_life.certificate_email_subject', '"Your Credit Life certificate of cover {{certificateNumber}}"', 'credit_life', 'Subject of the e-mail that sends the certificate of cover ({{certificateNumber}}, {{borrowerName}}, {{loanAccount}})', 'string', true),
 ('credit_life.certificate_email_body', '"<p>Dear {{borrowerName}},</p><p>Your loan {{loanAccount}} is covered by Credit Life insurance. Your certificate of cover {{certificateNumber}} is attached. {{passwordHint}}</p><p>Thank you.</p>"', 'credit_life', 'Body of the e-mail that sends the certificate of cover ({{passwordHint}} explains the password)', 'string', true),
 ('credit_life.certificate_wording', '"This certifies that the borrower named above is insured under the Credit Life master policy shown, for the sum insured and period stated, against death from any cause, subject to the terms, conditions and exclusions of the master policy. The benefit is paid to the financing bank up to the outstanding loan balance, the excess to the beneficiaries of the borrower."', 'credit_life', 'Wording printed on the Credit Life certificate of cover', 'string', true),
 ('credit_life.insurer_email_subject', '"Credit Life batch {{batchNumber}} - {{period}} - {{members}} accounts"', 'credit_life', 'Subject of the e-mail that forwards the validated accounts of a batch to the insurer', 'string', true),
 ('credit_life.insurer_email_body', '"<p>Dear {{insurerName}},</p><p>Please find attached the {{members}} validated accounts of Credit Life batch {{batchNumber}} of {{period}} for {{bankName}}, total premium {{premium}}.</p>"', 'credit_life', 'Body of the e-mail that forwards a batch to the insurer', 'string', true)
ON CONFLICT (key) DO NOTHING;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id
               WHERE r.code IN ('sales', 'processing', 'operations', 'tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer',
                 'tis-ops-unit-head', 'tis-general-manager'))
   AND NOT EXISTS (SELECT 1 FROM permissions WHERE code = 'read:credit-life');

INSERT INTO permissions(code, module, description) VALUES
 ('read:credit-life', 'credit-life', 'Open Operations > Credit Life: batches, members, master policies and certificates of cover; print certificates'),
 ('write:credit-life', 'credit-life', 'Create Credit Life batches, upload or encode members, issue the certificates, forward a batch to the insurer, cancel a certificate')
ON CONFLICT (code) DO NOTHING;

-- Operations and the Processing Team run the monthly batches, Sales reads them; TISPH personas (proposal until TISPH
-- names the users): the Operations personas run them, the Sales personas and the General Manager read them
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('system-admin', 'read:credit-life'), ('system-admin', 'write:credit-life'), ('processing', 'read:credit-life'), ('processing', 'write:credit-life'),
  ('operations', 'read:credit-life'), ('operations', 'write:credit-life'), ('sales', 'read:credit-life'),
  ('tis-ops-associate', 'read:credit-life'), ('tis-ops-associate', 'write:credit-life'), ('tis-ops-officer', 'read:credit-life'), ('tis-ops-officer', 'write:credit-life'),
  ('tis-ops-unit-head', 'read:credit-life'), ('tis-ops-unit-head', 'write:credit-life'), ('tis-sales-associate', 'read:credit-life'), ('tis-sales-officer', 'read:credit-life'),
  ('tis-sales-unit-head', 'read:credit-life'), ('tis-general-manager', 'read:credit-life')
) v(role, perm) JOIN roles r ON r.code = v.role JOIN permissions p ON p.code = v.perm
ON CONFLICT DO NOTHING;
