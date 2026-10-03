-- Commission taxes on broker-billed business, as on direct bill: output VAT on the brokerage commission and the
-- expanded withholding tax the insurer withholds on it (creditable withholding tax receivable, BIR 2307).
-- The broker keeps commission + VAT out of the premium it remits and pays the EWT back with it, so:
--   Dr Premium Receivable            gross
--   Dr Creditable Withholding Tax    EWT on commission
--      Cr Premium Due to Insurer     gross - premium taxes - commission - VAT on commission + EWT
--      Cr Premium VAT / DST / LGT    premium taxes
--      Cr Commission Income          commission
--      Cr Output VAT                 VAT on commission
-- Rates and GL accounts come from the tax codes master (tax.commission_vat_code, tax.commission_ewt_code), falling back
-- to the account roles output_vat and creditable_wht. Journals already posted are not touched: the new rule versions
-- only add lines, and the amounts they read are zero on bills booked before this change (receivables.commission_vat /
-- commission_ewt default 0), so their remittance and returns keep the figures they were booked with.
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.broker_billed_commission_vat', 'true', 'accounting', 'Broker-billed policies: book output VAT on the brokerage commission (tax code tax.commission_vat_code)', 'boolean'),
 ('accounting.broker_billed_commission_ewt', 'true', 'accounting', 'Broker-billed policies: book the EWT the insurer withholds on the commission as creditable withholding tax (tax code tax.commission_ewt_code)', 'boolean'),
 ('tax.commission_vat_code', '"VAT12-OUT"', 'accounting', 'Tax code of the output VAT on brokerage commission (rate and GL account from the tax codes master)', 'string'),
 ('tax.commission_ewt_code', '"WC139"', 'accounting', 'Tax code of the EWT insurers withhold on brokerage commission (rate, ATC and GL account from the tax codes master; confirm the ATC with the tax team)', 'string')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE receivables ADD COLUMN IF NOT EXISTS commission_vat numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivables ADD COLUMN IF NOT EXISTS commission_ewt numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivable_participants ADD COLUMN IF NOT EXISTS commission_vat numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE receivable_participants ADD COLUMN IF NOT EXISTS commission_ewt numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE remittance_allocations ADD COLUMN IF NOT EXISTS commission_vat numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE remittance_allocations ADD COLUMN IF NOT EXISTS commission_ewt numeric(14,2) NOT NULL DEFAULT 0;

-- New version of the premium booking and return rules: the latest version's lines plus the two commission tax lines.
-- The version keeps the effective date of the one it follows, so it is the version in force wherever that one was.
DO $$
DECLARE
  ev record;
  prev posting_rules%ROWTYPE;
  new_id int;
  next_line int;
BEGIN
  FOR ev IN SELECT * FROM (VALUES
      ('policy.issue.broker_billed', false), ('endorsement.additional_premium', false), ('policy.renewal.broker_billed', false),
      ('endorsement.return_premium', true), ('policy.cancel', true)) AS v(code, is_return) LOOP
    SELECT * INTO prev FROM posting_rules WHERE event_code = ev.code ORDER BY version DESC LIMIT 1;
    CONTINUE WHEN prev.id IS NULL;
    CONTINUE WHEN EXISTS (SELECT 1 FROM posting_rule_lines WHERE rule_id = prev.id AND amount_key IN ('commission_vat', 'commission_ewt'));
    INSERT INTO posting_rules(event_code, version, name, description, module, entry_type, source, narration, branch_source, effective_from, active, change_note, created_by, updated_by)
    VALUES (prev.event_code, prev.version + 1, prev.name,
      prev.description || CASE WHEN ev.is_return THEN ' The output VAT and EWT on the commission returned are reversed.'
                               ELSE ' Output VAT on the commission and the EWT the insurer withholds on it are booked, as on direct bill.' END,
      prev.module, prev.entry_type, prev.source, prev.narration, prev.branch_source, prev.effective_from, true,
      'Output VAT and creditable withholding tax on commission (broker billed, consistent with direct bill)', 'migration:0170', 'migration:0170')
    RETURNING id INTO new_id;
    INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration)
    SELECT new_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration FROM posting_rule_lines WHERE rule_id = prev.id;
    SELECT COALESCE(max(line_no), 0) + 1 INTO next_line FROM posting_rule_lines WHERE rule_id = new_id;
    IF ev.is_return THEN
      INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration) VALUES
        (new_id, next_line, 'Dr', 'resolver', 'commission_vat_account', 'output_vat', 'commission_vat', true, 'Output VAT on commission returned{{participantSuffix}}'),
        (new_id, next_line + 1, 'Cr', 'resolver', 'commission_ewt_account', 'creditable_wht', 'commission_ewt', true, 'EWT on commission returned ({{insurer}})');
    ELSE
      INSERT INTO posting_rule_lines(rule_id, line_no, side, account_type, account, fallback_role, amount_key, per_participant, narration) VALUES
        (new_id, next_line, 'Cr', 'resolver', 'commission_vat_account', 'output_vat', 'commission_vat', true, 'Output VAT on commission{{participantSuffix}}'),
        (new_id, next_line + 1, 'Dr', 'resolver', 'commission_ewt_account', 'creditable_wht', 'commission_ewt', true, 'EWT on commission withheld by {{insurer}}');
    END IF;
  END LOOP;
END $$;
