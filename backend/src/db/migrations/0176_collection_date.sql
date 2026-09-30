-- The date premium was collected, kept on every application of a payment to a bill. The remittance ageing, the insurer
-- remittance voucher's period filter and the payment history used the time the application was keyed in (applied_at),
-- so a receipt dated in April but entered in September counted as collected in September: never overdue to the insurer
-- and outside an April remittance. collected_on is the receipt's date (else the date of the application's journal).
ALTER TABLE receipt_applications ADD COLUMN IF NOT EXISTS collected_on date;

CREATE OR REPLACE FUNCTION receipt_applications_collected_on() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.collected_on IS NULL THEN
    NEW.collected_on := COALESCE(
      (SELECT r.received_date FROM receipts r WHERE r.id = NEW.receipt_id),
      (SELECT j.jv_date FROM journal_vouchers j WHERE j.id = NEW.journal_id),
      NEW.applied_at::date, numbering_business_date());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS receipt_applications_collected_on ON receipt_applications;
CREATE TRIGGER receipt_applications_collected_on BEFORE INSERT ON receipt_applications
  FOR EACH ROW EXECUTE FUNCTION receipt_applications_collected_on();

UPDATE receipt_applications a SET collected_on = COALESCE(
    (SELECT r.received_date FROM receipts r WHERE r.id = a.receipt_id),
    (SELECT j.jv_date FROM journal_vouchers j WHERE j.id = a.journal_id),
    a.applied_at::date)
WHERE a.collected_on IS NULL;

CREATE INDEX IF NOT EXISTS receipt_applications_collected_on_idx ON receipt_applications(collected_on);
