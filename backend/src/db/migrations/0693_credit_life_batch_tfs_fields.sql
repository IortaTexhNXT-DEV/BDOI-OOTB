-- Credit Life batch: the fields of the TFS monthly loan file that the CLI Generated Report lists (TIS-BRD-PJRN-01,
-- INTG-03, TIS-BRD-RPT-OPS-01: reference, name, birthday / age, gender, outstanding, unit release / booking / start /
-- maturity dates and term), and the amount the statement of account bills the financing bank as a setting while TISPH
-- confirms the fixed year-1 charge per account (PJRN-03).
--
-- credit_life_members  gender (M / F), outstanding_balance, booking_date and maturity_date of the loan, kept from the
--                      bank's file or the encoded member (all optional; the release date stays the start of cover)
-- credit_life.soa_billing_basis       what the statement of account bills: premium (the premium of the issued accounts,
--                                     as before), per_account (credit_life.soa_amount_per_account for each account) or
--                                     none (the list of accounts without an amount due)
-- credit_life.soa_amount_per_account  the fixed amount per account of the per_account basis (PHP; 2,000 pending TISPH)
--
-- The CLI Generated Report gains the age, gender, outstanding balance, booking, release and maturity dates. Idempotent.

ALTER TABLE credit_life_members ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('M', 'F'));
ALTER TABLE credit_life_members ADD COLUMN IF NOT EXISTS outstanding_balance numeric(16,2);
ALTER TABLE credit_life_members ADD COLUMN IF NOT EXISTS booking_date date;
ALTER TABLE credit_life_members ADD COLUMN IF NOT EXISTS maturity_date date;

INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES
 ('credit_life.soa_billing_basis', '"premium"', 'credit_life', 'What the Credit Life Statement of Account bills the financing bank: premium (the premium of the issued accounts), per_account (credit_life.soa_amount_per_account for each account) or none (the accounts without an amount due)', 'string', true),
 ('credit_life.soa_amount_per_account', '2000', 'credit_life', 'Fixed amount per account billed to the financing bank when credit_life.soa_billing_basis is per_account (PHP; pending TISPH confirmation)', 'number', true)
ON CONFLICT (key) DO NOTHING;

UPDATE report_definitions SET
  description = 'Credit Life accounts generated from the financing bank''s batches for the period, the basis of the CLI billing to the insurer: the TFS 10-digit loan account, the borrower with birth date, age and gender, the outstanding balance, the booking, release, start and maturity dates, the term, the certificate, the sum insured and premium.',
  default_columns = '[{"key":"loanAccount","type":"text","label":"TFS Loan No."},{"key":"borrower","type":"text","label":"Borrower"},{"key":"birthDate","type":"date","label":"Birth Date"},{"key":"age","type":"integer","label":"Age","total":false},{"key":"gender","type":"text","label":"Gender"},{"key":"outstandingBalance","type":"money","label":"Outstanding Balance"},{"key":"loanAmount","type":"money","label":"Amount Financed"},{"key":"bookingDate","type":"date","label":"Booking Date"},{"key":"releaseDate","type":"date","label":"Release Date"},{"key":"coverFrom","type":"date","label":"Start Date"},{"key":"maturityDate","type":"date","label":"Maturity Date"},{"key":"loanTermMonths","type":"integer","label":"Term (months)","total":false},{"key":"coverTo","type":"date","label":"Cover To"},{"key":"certificateNumber","type":"text","label":"Certificate No."},{"key":"masterPolicy","type":"text","label":"Master Policy"},{"key":"customerNo","type":"text","label":"Customer No."},{"key":"sumInsured","type":"money","label":"Sum Insured"},{"key":"premium","type":"money","label":"Premium"},{"key":"insurer","type":"text","label":"Insurer"},{"key":"batchNumber","type":"text","label":"Batch"},{"key":"status","type":"text","label":"Status"},{"key":"issuedOn","type":"date","label":"Issued"},{"key":"emailed","type":"text","label":"E-mailed"}]'
 WHERE code = 'cli-generated';
