-- Chart of accounts: financial-statement classification for the Philippine broker chart.
--   fs_group        statement line group: Current Assets, Non-current Assets, Current Liabilities, Non-current Liabilities,
--                   Equity, Revenue, Other Income, Cost of Services, Operating Expenses, Other Expenses, Income Tax
--   normal_balance  debit | credit (contra accounts such as accumulated depreciation or allowances differ from their type)
--   description     free text shown on the chart of accounts screen
-- Codes, types and parent codes are unchanged: journals keep posting to the same accounts.
ALTER TABLE gl_accounts ADD COLUMN IF NOT EXISTS fs_group text;
ALTER TABLE gl_accounts ADD COLUMN IF NOT EXISTS normal_balance text;
ALTER TABLE gl_accounts ADD COLUMN IF NOT EXISTS description text;
DO $$ BEGIN
  ALTER TABLE gl_accounts ADD CONSTRAINT gl_accounts_normal_balance_chk CHECK (normal_balance IN ('debit', 'credit'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Default normal balance from the account type when none is given.
CREATE OR REPLACE FUNCTION gl_accounts_defaults() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.normal_balance IS NULL THEN
    NEW.normal_balance := CASE WHEN NEW.account_type IN ('asset', 'expense') THEN 'debit' ELSE 'credit' END;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS gl_accounts_defaults_trg ON gl_accounts;
CREATE TRIGGER gl_accounts_defaults_trg BEFORE INSERT OR UPDATE ON gl_accounts FOR EACH ROW EXECUTE FUNCTION gl_accounts_defaults();

UPDATE gl_accounts SET normal_balance = CASE WHEN account_type IN ('asset', 'expense') THEN 'debit' ELSE 'credit' END WHERE normal_balance IS NULL;
CREATE INDEX IF NOT EXISTS gl_accounts_type_idx ON gl_accounts(account_type, code);
