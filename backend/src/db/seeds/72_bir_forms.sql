-- BIR forms and invoicing (migrations 0280 to 0284): the one setting that says whether the broker is VAT registered is
-- direct_bill.broker_vat_registered (seeded by settings.json); it also drives the sales invoice wording and the 2551Q
-- working paper, so its label says so. Idempotent: only the label changes, the value the broker chose is kept.
UPDATE app_settings SET label = 'The broker is VAT registered: VAT on commission debit notes and sales invoices, VAT returns; off = non-VAT registered (percentage tax, BIR Form 2551Q)'
 WHERE key = 'direct_bill.broker_vat_registered' AND label NOT LIKE 'The broker is VAT registered:%';
