-- Endorsement commission calculated by the insurer (TIS-BRD-COMM-07, Phase 1; gap register GAP-REMIT-14).
--
-- The insurer calculates the commission / service fee of an endorsement and supplies it to TISPH: recorded on one
-- endorsement (PUT /endorsements/:id/insurer-commission) or by a bulk file with the columns Endorsement No and
-- Commission (POST /endorsements/insurer-commission/upload), before the endorsement is booked. Booking takes it as the
-- commission of the premium change instead of the policy's commission ratio (endorsements/service.js).
-- The insurers' own file layouts are not in hand: the bulk file is BrokerVerse's two-column file.
--
-- Setting endorsements.insurer_commission_required: a financial endorsement (not a cancellation) is booked only with
-- the insurer's commission recorded (off).
-- Idempotent.

ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS insurer_commission numeric(14,2);
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS insurer_commission_source text;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS insurer_commission_at timestamptz;
ALTER TABLE endorsements ADD COLUMN IF NOT EXISTS insurer_commission_by text;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('endorsements.insurer_commission_required', 'false', 'endorsements', 'A financial endorsement is booked only once the commission the insurer calculated on it is recorded (single or bulk upload)', 'boolean', true)
ON CONFLICT (key) DO NOTHING;
