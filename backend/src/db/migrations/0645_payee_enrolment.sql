-- Enrolment of agents, dealers and vendors for payment (FGA EN-01, EN-02; gap register GAP-REMIT-18; TIS-BRD-COMM-05,
-- SEC-03).
--
-- A payee (commission_referrers) gets the vendor fields of the FGA enrolment form: vendor group (a value of
-- commission.vendor_groups), vendor code (unique), address and contact person, next to the name, TIN, e-mail, phone and
-- bank details it already had. Commission > Agents/Referrer Accounts adds and edits payees.
--
-- With commission.payee_verification_required a new payee, and a change to what decides who is paid and how (name,
-- TIN, bank, account number, withholding tax), awaits verification by a second user holding approve:commission (never
-- the user who made the change); commission lines of a payee awaiting verification are neither approved nor paid.
-- verification_changes keeps the fields of the change under verification with their old values. Payees enrolled before
-- this migration count as verified.
--
-- Settings:
--   commission.payee_verification_required   a new payee or a change of its payment details is verified by a second user
--                                            before commission is approved or paid (off here; on for TISPH, seed
--                                            96_tisph_commission.sql)
--   commission.vendor_groups                 the vendor groups of the enrolment form
-- Idempotent.

ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS vendor_group text;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS vendor_code text;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'verified';
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS verification_changes jsonb;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS verification_requested_by text;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS verified_by text;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE commission_referrers ADD COLUMN IF NOT EXISTS verification_note text;

DO $$ BEGIN
  ALTER TABLE commission_referrers ADD CONSTRAINT commission_referrers_verification_chk CHECK (verification_status IN ('verified', 'pending'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS commission_referrers_vendor_code_uq ON commission_referrers(upper(vendor_code)) WHERE vendor_code IS NOT NULL;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('commission.payee_verification_required', 'false', 'commission', 'A new payee (agent, dealer, referral, vendor) or a change of its name, TIN, bank details or withholding tax is verified by a second user holding approve:commission before its commission is approved or paid', 'boolean', true),
 ('commission.vendor_groups', '["Agents", "Dealers", "Referrals", "TFS team members", "Vendors"]', 'commission', 'Vendor groups of the payee enrolment form (Commission > Agents/Referrer Accounts)', 'json', true)
ON CONFLICT (key) DO NOTHING;
