-- Broker-mediated endorsement flow (TIS-BRD-ENDT-01 to ENDT-04, CANC-03; Pre-BSM M12, M24).
--
-- raise -> submit for approval -> approve (maker-checker, approve:policies, never the raiser) -> send to the insurer ->
-- insurer confirmed (its endorsement number) -> book (a user other than the raiser). The client is e-mailed the
-- endorsement when it is booked. A financial endorsement is priced pro-rata over the unexpired days of the policy, the
-- days and the factor kept on the endorsement with the policy before and after.
--
-- Endorsement types (master endorsement-type, seed 95_tisph_quote_policy.sql): the TISPH M12 list with the financial
-- flag, premium impact, the lines it applies to and the section of the endorsement it belongs to. An endorsement names
-- its types (endorsement_type_codes); several types on one endorsement are one grouped endorsement (ENDT-04).
--
-- Settings:
--   endorsements.approval_before_send          an endorsement is approved by a second user before it goes to the insurer
--   endorsements.complete_needs_insurer        booking needs the endorsement sent to the insurer and its endorsement number
--   endorsements.complete_maker_checker        the user who raised an endorsement never books it
--   endorsements.prorata                       a financial change is priced over the unexpired days of the policy
--   endorsements.notify_client_on_booking      the client is e-mailed the endorsement once booked
--   endorsements.non_financial_lines           lines that take no financial endorsement (Credit Life: PJRN-03)
--   endorsements.types_required                an endorsement is submitted only with its endorsement types
--   endorsements.cancellation_note_required    a cancellation needs a note (M24: every cancellation reason needs one)
--   endorsements.cancellation_reverses_commission  the commission on a returned premium is taken back (CANC-03: off)
-- Idempotent.

ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS endorsement_type_codes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS submitted_at timestamptz;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS submitted_by text REFERENCES users(id);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS approved_by text REFERENCES users(id);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS rejected_at timestamptz;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS rejected_by text REFERENCES users(id);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS rejection_reason_code text;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS rejection_reason text;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('endorsements.approval_before_send', 'true', 'endorsements', 'An endorsement is approved by a second user (approve:policies) before it is sent to the insurer', 'boolean'),
 ('endorsements.complete_needs_insurer', 'true', 'endorsements', 'An endorsement is booked only once sent to the insurer, with the insurer''s endorsement number', 'boolean'),
 ('endorsements.complete_maker_checker', 'true', 'endorsements', 'The user who raised an endorsement never books it', 'boolean'),
 ('endorsements.prorata', 'true', 'endorsements', 'A coverage change is priced over the unexpired days of the policy (pro-rata)', 'boolean'),
 ('endorsements.notify_client_on_booking', 'true', 'endorsements', 'The client is e-mailed the endorsement once it is booked', 'boolean'),
 ('endorsements.non_financial_lines', '["LIFE"]', 'endorsements', 'Lines of business that take no financial endorsement', 'json'),
 ('endorsements.types_required', 'true', 'endorsements', 'An endorsement is submitted for approval only with its endorsement types (Endorsement Types master)', 'boolean'),
 ('endorsements.cancellation_note_required', 'true', 'endorsements', 'A cancellation needs a note', 'boolean'),
 ('endorsements.cancellation_reverses_commission', 'true', 'endorsements', 'The commission on a returned premium is taken back when a policy is cancelled', 'boolean'),
 ('email.template.endorsement_booked', $j${"subject":"{{companyName}}: endorsement {{endorsementNumber}} to policy {{policyNumber}}","html":"<p>Dear {{customerName}},</p><p>The {{action}} <b>{{endorsementNumber}}</b> to your policy <b>{{policyNumber}}</b> has been issued by {{insurerName}} (endorsement {{insurerEndorsementNumber}}), effective {{effectiveDate}}.</p><p>Premium change: {{currency}} {{premiumDelta}}. The endorsement is attached.</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail: endorsement booked, to the client', 'json')
ON CONFLICT (key) DO NOTHING;
