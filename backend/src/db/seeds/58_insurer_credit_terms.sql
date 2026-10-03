-- Credit-term fields on the insurance company master screen (columns from migration 0123). Idempotent: a field is
-- added only when the type does not have it yet, so administrator edits of the definition are kept.
UPDATE master_types t SET fields = t.fields || (
  SELECT COALESCE(jsonb_agg(f), '[]'::jsonb) FROM jsonb_array_elements($j$[
    {"name":"premiumWarrantyDays","label":"Premium Payment Warranty (days)","type":"integer","required":false,"column":"premium_warranty_days","min":0,"max":3650},
    {"name":"remittanceTermsDays","label":"Remittance Terms (days after collection)","type":"integer","required":false,"column":"remittance_terms_days","min":0,"max":3650},
    {"name":"defaultBillingMode","label":"Default Billing Mode","type":"select","required":false,"column":"default_billing_mode","options":["broker","direct"]}
  ]$j$::jsonb) f
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) e WHERE e->>'name' = f->>'name'))
WHERE t.code = 'insurance-company';
