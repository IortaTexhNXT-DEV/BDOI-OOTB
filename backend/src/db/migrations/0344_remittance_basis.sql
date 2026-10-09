-- Remittance basis per insurer and product (TIS-BRD-GL-03, COMM-03 / COMM-04; FGA workbook sheet FGA.09).
--
--   net    (default) the broker keeps its commission out of the premium it collects and remits the rest: the bill is
--          booked Dr Premium Receivable / Cr Due to Insurer (net of commission) / Cr Commission Income, as before.
--   gross  the premium collected is payable to the insurer in full and remitted in full; the commission is billed to
--          the insurer separately. The bill is booked Dr Premium Receivable / Cr Due to Insurer (whole premium), the
--          commission becomes an unbilled item on Direct Bill Processing (no journal yet), and a commission billing
--          statement raised there posts Dr Commission Receivable / Cr Commission Income / Cr Output VAT when a second
--          user approves it (FGA.09: Saved > Parked, Approved > Posted). The insurer's payment of the statement is the
--          existing debit note collection (Dr Cash, Dr Creditable Withholding Tax / Cr Commission Receivable).
--
--   remittance.basis_rules   [{ "insurer": "<insurer code>", "product": "<product code>", "basis": "gross" | "net" }],
--                            insurer or product may be left out; the most specific matching rule wins
--   receivables.remittance_basis      basis the bill was booked on (kept when the rules change later)
--   direct_bill_items.basis           direct (direct-bill policy, booked at issue) | gross (gross remittance, posted by
--                                     the billing statement)
--   commission_debit_notes.basis      basis of the items on the note (one basis per note), journal_id / reversal_jv_id
--                                     the journal a gross note posts on approval and its reversal on cancellation
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('remittance.default_basis', '"net"', 'remittance', 'Remittance basis when no rule of remittance.basis_rules matches: net (the broker keeps its commission and remits the rest) or gross (the whole premium is remitted and the commission is billed to the insurer with a billing statement)', 'string'),
 ('remittance.basis_rules', '[]', 'remittance', 'Remittance basis by insurer and product: [{"insurer": "<insurer code>", "product": "<product code>", "basis": "gross"}]; leave insurer or product out to match any; the most specific rule wins', 'json')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE receivables ADD COLUMN IF NOT EXISTS remittance_basis text NOT NULL DEFAULT 'net';
DO $$ BEGIN
  ALTER TABLE receivables ADD CONSTRAINT receivables_remittance_basis_chk CHECK (remittance_basis IN ('net', 'gross'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE direct_bill_items ADD COLUMN IF NOT EXISTS basis text NOT NULL DEFAULT 'direct';
DO $$ BEGIN
  ALTER TABLE direct_bill_items ADD CONSTRAINT direct_bill_items_basis_chk CHECK (basis IN ('direct', 'gross'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE commission_debit_notes ADD COLUMN IF NOT EXISTS basis text NOT NULL DEFAULT 'direct';
ALTER TABLE commission_debit_notes ADD COLUMN IF NOT EXISTS journal_id text REFERENCES journal_vouchers(id);
ALTER TABLE commission_debit_notes ADD COLUMN IF NOT EXISTS reversal_jv_id text REFERENCES journal_vouchers(id);
DO $$ BEGIN
  ALTER TABLE commission_debit_notes ADD CONSTRAINT commission_debit_notes_basis_chk CHECK (basis IN ('direct', 'gross'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Numbering of the billing statements (neutral default; the TISPH finance series formats of FGA.05 are not applied
-- until the numbering conflict with M21 is decided)
INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('billing_statement', 'Commission Billing Statement', 'finance', 'CBS', 'Commission billed to an insurer on gross-remittance business (premium remitted in full)', 'migration:0344')
ON CONFLICT (code) DO NOTHING;

WITH r AS (INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, change_note, created_by, updated_by)
  SELECT 'commission.billing_statement', 1, 'Commission billing statement approved', 'Commission (and output VAT) billed to an insurer on gross-remittance business, posted when a second user approves the billing statement; reversed when an approved statement is cancelled.',
    'remittance', 'COMMISSION_BILLING', 'booking', 'Billing statement {{statementNumber}} – {{insurer}}', 'user', 'Initial rule', 'system', 'system'
  WHERE NOT EXISTS (SELECT 1 FROM posting_rules WHERE event_code = 'commission.billing_statement') RETURNING id)
INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
SELECT r.id, v.line_no, v.side, v.account_type, v.account, v.fallback_role, v.amount_key, v.per_participant, v.narration FROM r, (VALUES
  (1, 'Dr', 'role', 'commission_receivable', NULL::text, 'amount', false, 'Commission billed to {{insurer}} ({{statementNumber}})'),
  (2, 'Cr', 'role', 'commission_income', NULL::text, 'commission', false, 'Brokerage commission ({{statementNumber}})'),
  (3, 'Cr', 'role', 'output_vat', NULL::text, 'vat', false, 'Output VAT on commission ({{statementNumber}})')
) v(line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration);
