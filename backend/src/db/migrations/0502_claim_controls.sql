-- Claim intake and handling controls (Operations > Claims; TIS-BRD-CLAIM-01 to 08, FGA CM-03 to CM-10, Pre-BSM M15):
--   * FNOL source (TFS, Call Centre, Insurer, ...), late intimation flagged and alerted, duplicate FNOL refused unless
--     confirmed, estimate never negative, loss date never in the future
--   * the claims handler picked by the assignment roles (least open claims first)
--   * the insurer's advice on the claim: insurer claim handler, advice status (cheque available, incomplete
--     requirements, LOA issued, under evaluation, approved, denied), authorisation code, offered amount
--   * a claim registered in error is cancelled with a coded reason (status cancelled); a rejection needs its reason,
--     which is sent to the client
--   * the follow-up due date of an unsettled claim by line of business, loss extent or product
--     (claims.followup_days); a Credit Life claim is a death benefit claim only, and its death is verified
--   * end-of-day service levels: a FNOL not submitted to the insurer by the end of its day, and an authorisation code
--     not received within claims.authorisation_days working days, alert the handler (job claim-service-levels)
--   * settlement approval within the Authority Matrix limit (claims.require_authority_limit)
--   * settlement cash: funds received from insurers recorded under write:claim-funds; reversal of a movement recorded
--     in error under reverse:claim-cash with a coded reason; a claimant paid only from funds received
--     (claims.pay_claimant_from_funds)
--
-- The status labels of the new statuses (cancelled, partially-settled) and the TISPH values are set by seed
-- 92_renewals_claims.sql. Idempotent.

ALTER TABLE claims ADD COLUMN IF NOT EXISTS fnol_source text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS loss_extent text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS late_intimation boolean NOT NULL DEFAULT false;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS insurer_handler text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS insurer_handler_contact text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS insurer_advice text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS insurer_advice_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS insurer_offer_amount numeric(14,2);
ALTER TABLE claims ADD COLUMN IF NOT EXISTS authorisation_code text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS authorisation_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS cancelled_reason text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS cancelled_reason_code text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS death_verified_on date;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS death_verified_by text;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS fnol_alerted_at timestamptz;
ALTER TABLE claims ADD COLUMN IF NOT EXISTS authorisation_alerted_at timestamptz;
COMMENT ON COLUMN claims.fnol_source IS 'Where the first notice of loss came from (claims.fnol_sources)';
COMMENT ON COLUMN claims.loss_extent IS 'Partial or total loss (motor), for the follow-up days of claims.followup_days';
COMMENT ON COLUMN claims.insurer_advice IS 'Latest advice of the insurer on the claim (claims.insurer_advice_statuses)';

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('claims.require_authority_limit', 'false', 'claims', 'An approver of a claim settlement needs a claim settlement limit in the Authority Matrix', 'boolean'),
 ('claims.fnol_sources', '["TFS", "Call Centre", "Insurer", "Dealer", "Walk-in or e-mail", "Other"]', 'claims', 'Where a first notice of loss can come from', 'json'),
 ('claims.late_intimation_days', '30', 'claims', 'A claim reported more than this many days after the loss is a late intimation (0: no check)', 'number'),
 ('claims.duplicate_check', 'true', 'claims', 'Refuse a second claim on the same policy with the same date of loss unless the user confirms it', 'boolean'),
 ('claims.assignment_roles', '["claims"]', 'claims', 'Roles whose active users are given new claims (the user with the fewest open claims first)', 'json'),
 ('claims.insurer_advice_statuses', '{"under-evaluation": "Under evaluation", "incomplete-requirements": "Incomplete requirements", "loa-issued": "LOA issued", "cheque-available": "Cheque available", "approved": "Approved by the insurer", "denied": "Denied by the insurer"}', 'claims', 'Advice statuses of the insurer on a claim', 'json'),
 ('claims.followup_days', '{"default": 20}', 'claims', 'Days from the report date to the follow-up due date of an unsettled claim, by line of business, line:extent (MOTOR:partial) or product code', 'json'),
 ('claims.authorisation_days', '2', 'claims', 'Working days after the submission to the insurer within which the authorisation code is expected', 'number'),
 ('claims.death_benefit_products', '[]', 'claims', 'Products whose claims are death benefit claims only (claim type or cause of loss Death)', 'json'),
 ('claims.pay_claimant_from_funds', 'false', 'claims', 'A claimant is paid only from the settlement funds already received from the insurers', 'boolean')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('email.template.claim_rejection', $j${"subject":"{{companyName}}: claim {{claimNumber}} was not accepted","html":"<p>Dear {{claimantName}},</p><p>We regret to inform you that claim <b>{{claimNumber}}</b> on policy {{policyNumber}} was not accepted by {{insurerName}}.</p><p>Reason: {{reason}}</p><p>Please contact us if you have any question about this decision.</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail: rejection of a claim to the client, with the reason', 'json'),
 ('email.template.claim_insurer_submission', $j${"subject":"Claim file {{claimNumber}} / {{policyNumber}} - {{insuredName}}","html":"<p>Dear {{insurerName}},</p><p>Please find the claim file of <b>{{insuredName}}</b> under policy <b>{{policyNumber}}</b>, our reference {{claimNumber}}, date of loss {{lossDate}}.</p><p>Documents submitted:</p><ul>{{documentList}}</ul><p>{{note}}</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail: submission of a claim file to the insurer with the documents submitted', 'json'),
 ('email.template.claim_insurer_followup', $j${"subject":"Follow-up: claim {{claimNumber}} / {{policyNumber}} - {{insuredName}}","html":"<p>Dear {{insurerName}},</p><p>We follow up on claim {{insurerClaimNumber}} of <b>{{insuredName}}</b> under policy <b>{{policyNumber}}</b> (our reference {{claimNumber}}).</p><p>{{message}}</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail: follow-up of a claim to the insurer', 'json'),
 ('email.template.claim_estimate_update', $j${"subject":"{{companyName}}: repair estimate of claim {{claimNumber}}","html":"<p>Dear {{claimantName}},</p><p>The repair estimate of claim <b>{{claimNumber}}</b> on policy {{policyNumber}} was updated: {{update}}.</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail: repair estimate update of a motor claim to the client', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('write:claim-funds', 'claims', 'Record claim settlement funds received from an insurer (Accounts > Claims Settlements)'),
 ('reverse:claim-cash', 'claims', 'Reverse claim settlement funds received or a payment to the claimant recorded in error')
ON CONFLICT (code) DO NOTHING;

-- Users of the roles that gain a permission get a new token version (the permissions travel in the access token); only
-- on the first run, while no role holds write:claim-funds yet.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('accounting', 'accounting-manager', 'tis-ccd-bp', 'tis-ccd-recon', 'tis-finance', 'system-admin'))
   AND NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE p.code = 'write:claim-funds');

-- Funds received: Accounting, CCD-BP and CCD-Recon (RBAC v4: claims settlement cash sits with Receipting and
-- Reconciliation; CCD-PDU and CCD-PDC no longer record it through write:receipts). Reversals: Accounting Manager, CCD-Recon
-- (reversals and adjustments) and TIS Finance (payments to claimants).
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON (p.code = 'write:claim-funds' AND r.code IN ('accounting', 'tis-ccd-bp', 'tis-ccd-recon', 'system-admin'))
   OR (p.code = 'reverse:claim-cash' AND r.code IN ('accounting-manager', 'tis-ccd-recon', 'tis-finance', 'system-admin'))
ON CONFLICT DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('claim-service-levels', 'Claim service levels', 'End of the working day: alert the claims handler of a FNOL not yet submitted to the insurer, an authorisation code overdue from the insurer and a claim follow-up past its date', '30 17 * * *', 'claimServiceLevels', '{}', true)
ON CONFLICT (code) DO NOTHING;
