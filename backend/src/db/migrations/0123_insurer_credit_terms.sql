-- Insurer credit terms (Master > Generals > Insurance Company), per insurer:
--   premium_warranty_days  days the client has to pay the premium (receivable due date); null: collections.default_credit_days
--   remittance_terms_days  days after collection within which the broker remits to the insurer; null: remittance.default_due_days
--   default_billing_mode   broker | direct billing when a policy does not say; null: direct_bill.default_billing_mode
-- Resolved by resolveCreditTerms() in src/modules/commission-rates/terms.js.
ALTER TABLE insurance_companies ADD COLUMN IF NOT EXISTS premium_warranty_days int;
ALTER TABLE insurance_companies ADD COLUMN IF NOT EXISTS remittance_terms_days int;
ALTER TABLE insurance_companies ADD COLUMN IF NOT EXISTS default_billing_mode text;
DO $$ BEGIN
  ALTER TABLE insurance_companies ADD CONSTRAINT insurance_companies_credit_terms_chk
    CHECK ((premium_warranty_days IS NULL OR premium_warranty_days BETWEEN 0 AND 3650)
       AND (remittance_terms_days IS NULL OR remittance_terms_days BETWEEN 0 AND 3650)
       AND (default_billing_mode IS NULL OR default_billing_mode IN ('broker', 'direct')));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- The insurer master screen edits the three columns through the insurance-company master type. Existing installations
-- get the fields here; a new database gets them from seeds/58_insurer_credit_terms.sql (the type is seeded after migrations).
UPDATE master_types t SET fields = t.fields || (
  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) FROM jsonb_array_elements($j$[
    {"name":"premiumWarrantyDays","label":"Premium Payment Warranty (days)","type":"integer","required":false,"column":"premium_warranty_days","min":0,"max":3650},
    {"name":"remittanceTermsDays","label":"Remittance Terms (days after collection)","type":"integer","required":false,"column":"remittance_terms_days","min":0,"max":3650},
    {"name":"defaultBillingMode","label":"Default Billing Mode","type":"select","required":false,"column":"default_billing_mode","options":["broker","direct"]}
  ]$j$::jsonb) f
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) e WHERE e->>'name' = f->>'name'))
WHERE t.code = 'insurance-company';
