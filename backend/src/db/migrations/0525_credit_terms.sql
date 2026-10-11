-- Credit control terms of TISPH (TIS-BRD-COLL-01; MOM-S3-COLL-INSTAL-MONTHLY, MOM-S3-COLL-CREDIT-TERMS).
--
-- Instalment plans are monthly only: credit.instalment_frequencies keeps "monthly" while nobody has changed it.
-- collections.corporate_credit_days: days a corporate client has to pay the premium when its insurer sets no premium
-- warranty days (corporate default of three months; individual clients keep collections.default_credit_days).
-- Idempotent; a value changed on the screen is kept.

UPDATE app_settings SET value = '{"monthly":1}'::jsonb, updated_at = now()
 WHERE key = 'credit.instalment_frequencies' AND updated_by IS NULL AND value = '{"monthly":1,"quarterly":3,"semi-annual":6}'::jsonb;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('collections.corporate_credit_days', '90', 'collections', 'Credit days of a corporate client (receivable due date and premium warranty) when the insurer sets none; empty = the default credit days', 'number')
ON CONFLICT (key) DO NOTHING;
