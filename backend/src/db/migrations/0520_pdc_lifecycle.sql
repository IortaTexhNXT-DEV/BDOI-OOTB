-- PDC lifecycle (TIS-BRD-COLL-05, FRS FR-PDC-001 to FR-PDC-060): the post-dated cheque register becomes the PDC
-- tracking log. A client's cheques are encoded as one set (PCS-) against the instalment plan of a bill, one cheque per
-- instalment, payable to the Insurance Partner (forwarded for warehousing with a transmittal PT-) or to TISPH
-- (retained and deposited on the one collection account). The partner's receipt, its maturity advice (cleared: the
-- acknowledgement receipt is raised and posted with pdc.partner_collected; bounced: the AR is cancelled), the
-- cancellation with a reason approved by a second user (pull-out when the partner holds the cheque), the replacement
-- and the return to the client are recorded on the cheque. Nothing is posted until a cheque is collected.
--
--   status: on-hand (Received at TIS) -> forwarded -> warehoused -> cleared | bounced -> replaced
--           on-hand (payee TISPH) -> deposited -> cleared | bounced
--           on-hand | forwarded | warehoused | bounced -> cancellation-pending -> cancelled -> returned
--
-- Permissions read:pdc, write:pdc and approve:pdc replace read:receipts / write:receipts on the screen; every role that
-- held those keeps the register (FRS 3.2), the TISPH personas follow the RBAC v4 screen matrix (CCD-PDU CRU, CCD-PDC
-- CRUD with the approval, others read). Idempotent.

INSERT INTO permissions(code, module, description) VALUES
 ('read:pdc', 'pdc', 'Open the post-dated cheque log, its sets, transmittals and cheque history; export'),
 ('write:pdc', 'pdc', 'Encode cheque sets, forward to the Insurance Partner, record partner receipts and maturity advices, request cancellations, replace and return cheques'),
 ('approve:pdc', 'pdc', 'Approve or return the cancellation of a post-dated cheque requested by another user (maker-checker)')
ON CONFLICT (code) DO NOTHING;

UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN role_permissions rp ON rp.role_id = ur.role_id JOIN permissions p ON p.id = rp.permission_id
               WHERE p.code IN ('read:receipts', 'write:receipts'))
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'read:pdc');

-- base roles: whoever read or wrote the register keeps it; the Accounting Manager approves cancellations
INSERT INTO role_permissions(role_id, permission_id)
SELECT DISTINCT rp.role_id, n.id FROM role_permissions rp JOIN permissions o ON o.id = rp.permission_id JOIN roles r ON r.id = rp.role_id
  JOIN permissions n ON n.code = CASE o.code WHEN 'read:receipts' THEN 'read:pdc' ELSE 'write:pdc' END
 WHERE o.code IN ('read:receipts', 'write:receipts') AND r.code NOT LIKE 'tis-%'
ON CONFLICT DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code = ANY(CASE r.code
    WHEN 'system-admin' THEN ARRAY['read:pdc', 'write:pdc', 'approve:pdc']
    WHEN 'accounting-manager' THEN ARRAY['approve:pdc']
    WHEN 'operations' THEN ARRAY['read:pdc']
    -- RBAC v4 PDC Management: CCD-PDU CRU, CCD-PDC CRUD (cancellations need the checker), every other persona reads
    WHEN 'tis-ccd-pdu' THEN ARRAY['read:pdc', 'write:pdc']
    WHEN 'tis-ccd-pdc' THEN ARRAY['read:pdc', 'write:pdc', 'approve:pdc']
    ELSE ARRAY['read:pdc'] END)
 WHERE r.code IN ('system-admin', 'accounting-manager', 'operations', 'tis-ccd-pdu', 'tis-ccd-pdc', 'tis-ccd-bp', 'tis-ccd-recon', 'tis-finance', 'tis-general-manager',
                  'tis-it-admin', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head')
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------- sets and transmittals
CREATE TABLE IF NOT EXISTS pdc_sets (
  id text PRIMARY KEY DEFAULT ('pds_' || encode(gen_random_bytes(8), 'hex')),
  set_number text NOT NULL UNIQUE,
  policy_id text REFERENCES policies(id),
  receivable_id text REFERENCES receivables(id),
  client_id text REFERENCES clients(id),
  insurance_company_id int REFERENCES insurance_companies(id),
  payee text NOT NULL CHECK (payee IN ('insurance-partner', 'tisph')),
  received_date date NOT NULL,
  received_by text,
  storage_location text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS pdc_sets_policy ON pdc_sets(policy_id);
CREATE INDEX IF NOT EXISTS pdc_sets_status ON pdc_sets(status);

CREATE TABLE IF NOT EXISTS pdc_transmittals (
  id text PRIMARY KEY DEFAULT ('pdt_' || encode(gen_random_bytes(8), 'hex')),
  transmittal_number text NOT NULL UNIQUE,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  forwarded_on date NOT NULL,
  sent_by text NOT NULL CHECK (sent_by IN ('courier', 'messenger', 'hand-carry')),
  courier_reference text,
  remarks text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'partly-received', 'received')),
  received_on date, received_by text, partner_reference text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS pdc_transmittals_insurer ON pdc_transmittals(insurance_company_id, status);

-- ---------------------------------------------------------------- the cheque
ALTER TABLE post_dated_cheques
  ADD COLUMN IF NOT EXISTS set_id text REFERENCES pdc_sets(id),
  ADD COLUMN IF NOT EXISTS instalment_seq int,
  ADD COLUMN IF NOT EXISTS instalment_count int,
  ADD COLUMN IF NOT EXISTS instalment_due_date date,
  ADD COLUMN IF NOT EXISTS payee text NOT NULL DEFAULT 'tisph',
  ADD COLUMN IF NOT EXISTS insurance_company_id int REFERENCES insurance_companies(id),
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS brstn text,
  ADD COLUMN IF NOT EXISTS custody text NOT NULL DEFAULT 'tis-vault',
  ADD COLUMN IF NOT EXISTS transmittal_id text REFERENCES pdc_transmittals(id),
  ADD COLUMN IF NOT EXISTS forwarded_on date,
  ADD COLUMN IF NOT EXISTS warehoused_on date,
  ADD COLUMN IF NOT EXISTS partner_received_by text,
  ADD COLUMN IF NOT EXISTS partner_receipt_reference text,
  ADD COLUMN IF NOT EXISTS collected_on date,
  ADD COLUMN IF NOT EXISTS partner_reference text,
  ADD COLUMN IF NOT EXISTS bounce_reason_code text,
  ADD COLUMN IF NOT EXISTS cancel_reason_code text,
  ADD COLUMN IF NOT EXISTS cancel_remarks text,
  ADD COLUMN IF NOT EXISTS replacement_follows text,
  ADD COLUMN IF NOT EXISTS cancel_requested_by text,
  ADD COLUMN IF NOT EXISTS cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_prior_status text,
  ADD COLUMN IF NOT EXISTS cancel_approved_by text,
  ADD COLUMN IF NOT EXISTS cancel_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS pullout_transmittal_id text REFERENCES pdc_transmittals(id),
  ADD COLUMN IF NOT EXISTS cancelled_on date,
  ADD COLUMN IF NOT EXISTS cancelled_by text,
  ADD COLUMN IF NOT EXISTS returned_to text;
COMMENT ON COLUMN post_dated_cheques.payee IS 'insurance-partner: forwarded to the insurer of the policy for warehousing; tisph: retained and deposited by TISPH';
COMMENT ON COLUMN post_dated_cheques.custody IS 'tis-vault | in-transit | partner | returned: where the cheque physically is';
COMMENT ON COLUMN post_dated_cheques.collected_on IS 'Collection date advised by the Insurance Partner (Partner cleared); the AR is dated on it';

ALTER TABLE post_dated_cheques DROP CONSTRAINT IF EXISTS post_dated_cheques_status_check;
ALTER TABLE post_dated_cheques ADD CONSTRAINT post_dated_cheques_status_check
  CHECK (status IN ('on-hand', 'forwarded', 'warehoused', 'deposited', 'cleared', 'bounced', 'replaced', 'cancellation-pending', 'cancelled', 'returned'));
ALTER TABLE post_dated_cheques DROP CONSTRAINT IF EXISTS post_dated_cheques_payee_check;
ALTER TABLE post_dated_cheques ADD CONSTRAINT post_dated_cheques_payee_check CHECK (payee IN ('insurance-partner', 'tisph'));
ALTER TABLE post_dated_cheques DROP CONSTRAINT IF EXISTS post_dated_cheques_custody_check;
ALTER TABLE post_dated_cheques ADD CONSTRAINT post_dated_cheques_custody_check CHECK (custody IN ('tis-vault', 'in-transit', 'partner', 'returned'));
CREATE INDEX IF NOT EXISTS post_dated_cheques_set ON post_dated_cheques(set_id);
CREATE INDEX IF NOT EXISTS post_dated_cheques_transmittal ON post_dated_cheques(transmittal_id);

-- the receipt raised on a partner's collection: who collected it and the partner's reference (FR-PDC-050)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS collected_by_insurer_id int REFERENCES insurance_companies(id);
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS partner_reference text;

-- ---------------------------------------------------------------- settings (Master > System > Configuration, group receipts)
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('pdc.default_payee', '"insurance-partner"', 'receipts', 'Post-dated cheques: payee proposed when a set is encoded (insurance-partner or tisph)', 'string'),
 ('pdc.max_cheques_per_set', '12', 'receipts', 'Post-dated cheques: most cheques in one set', 'number'),
 ('pdc.date_tolerance_days', '5', 'receipts', 'Post-dated cheques: days a cheque date may differ from the instalment due date', 'number'),
 ('pdc.brstn_required', 'false', 'receipts', 'Post-dated cheques: BRSTN of the drawee branch required on every cheque', 'boolean'),
 ('pdc.forward_ack_days', '5', 'receipts', 'Post-dated cheques: days after forwarding (or a pull-out approval) before the cheque is followed up', 'number'),
 ('pdc.confirmation_grace_days', '3', 'receipts', 'Post-dated cheques: days after the cheque date before a missing maturity advice is followed up', 'number')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------- numbering, job, posting rule
INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('pdc_set', 'PDC Set', 'receipts', 'PCS', 'Set of post-dated cheques encoded for one bill (PS is the placement slip prefix)', 'system'),
 ('pdc_transmittal', 'PDC Transmittal', 'receipts', 'PT', 'Cheques forwarded to an Insurance Partner in one batch', 'system')
ON CONFLICT (code) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('pdc-follow-up', 'PDC follow-up', 'List the cheques forwarded and not received by the Insurance Partner, matured cheques without a maturity advice and pull-outs not returned; tell Cash Control',
  '35 6 * * *', 'pdcFollowUp', '{}', true)
ON CONFLICT (code) DO NOTHING;

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'pdc.partner_collected', 1, 'Post-dated cheque collected by the Insurance Partner',
    'A forwarded post-dated cheque the Insurance Partner deposited and cleared: the premium payable to the partner against the premium receivable.',
    'receipts', 'PAYMENT_RECEIPT', 'receipt', 'Premium collected by {{insurer}} – {{policyNumber}} PDC {{chequeNumber}}', 'policy_owner', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'pdc.partner_collected') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'due_to_insurer', NULL::text, 'amount', false, 'Collected by {{insurer}} – {{memoRef}}'),
  (2, 'Cr', 'role', 'premium_receivable', NULL::text, 'amount', false, 'Settles {{billNumber}}')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
