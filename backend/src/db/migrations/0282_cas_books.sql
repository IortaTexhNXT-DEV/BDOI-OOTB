-- Computerized accounting system (CAS) registration pack: the loose-leaf books of accounts printed per period
-- (general journal, general ledger, cash receipts book, cash disbursements book, sales book, purchase book) with page
-- numbers that run on through the taxable year, the system description and controls document, the audit trail
-- extract and the backup procedure. cas_book_prints keeps every print: the pages it used, so the next period of the
-- same book continues the numbering, and reprints keep their original pages. Idempotent.
CREATE TABLE IF NOT EXISTS cas_book_prints (
  id text PRIMARY KEY DEFAULT ('cbp_' || encode(gen_random_bytes(8), 'hex')),
  book_code text NOT NULL CHECK (book_code IN ('general_journal', 'general_ledger', 'cash_receipts', 'cash_disbursements', 'sales', 'purchases')),
  fiscal_year int NOT NULL,
  period text NOT NULL,                                  -- YYYY-MM
  period_from date NOT NULL, period_to date NOT NULL,
  first_page int NOT NULL, last_page int NOT NULL, pages int NOT NULL,
  entries int NOT NULL DEFAULT 0,
  total_debit numeric(18,2) NOT NULL DEFAULT 0, total_credit numeric(18,2) NOT NULL DEFAULT 0,
  file_hash text,                                        -- SHA-256 of the first print, so a reprint can be compared
  reprints int NOT NULL DEFAULT 0, last_reprinted_at timestamptz, last_reprinted_by text,
  status text NOT NULL DEFAULT 'printed' CHECK (status IN ('printed', 'voided')),
  void_reason text, voided_by text, voided_at timestamptz,
  printed_by text, printed_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS cas_book_prints_uq ON cas_book_prints(book_code, period) WHERE status = 'printed';

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('cas.software_name', '"iNXT BrokerVerse"', 'cas', 'Name of the computerized accounting system on the CAS documents and book prints', 'string'),
 ('cas.books_form', '"loose-leaf"', 'cas', 'Form of the books of accounts: loose-leaf (printed and bound per period) or computerized (kept in the system, submitted on storage media)', 'string'),
 ('cas.enforce_print_order', 'true', 'cas', 'Loose-leaf books: a period can be printed only after the previous period of the same book and taxable year', 'boolean'),
 ('cas.permit_number', '""', 'cas', 'CAS Permit to Use / Acknowledgement Certificate number (printed on the book prints)', 'string'),
 ('cas.backup_frequency', '"Daily full backup with continuous transaction log archiving (point-in-time recovery)"', 'cas', 'Backup frequency stated in the backup procedure', 'string'),
 ('cas.backup_retention', '"Daily backups kept 35 days; monthly backups kept 10 years (NIRC Sec. 235 retention)"', 'cas', 'Backup retention stated in the backup procedure', 'string'),
 ('cas.backup_location', '"Managed database service of the hosting provider in the Philippines region, with an encrypted off-site copy"', 'cas', 'Where the backups are kept', 'string'),
 ('cas.backup_custodian', '""', 'cas', 'Person responsible for the backups and the restore test (name and position)', 'string'),
 ('cas.system_contact', '""', 'cas', 'Contact person of the taxpayer for the CAS (name, position, e-mail)', 'string')
ON CONFLICT (key) DO NOTHING;
