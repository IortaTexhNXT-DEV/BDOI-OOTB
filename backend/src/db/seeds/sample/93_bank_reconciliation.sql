-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Bank reconciliation demo: the sample Metrobank operating account is linked to the cash in bank account of the chart
-- (accounting.account.cash_in_bank, where the receipts by cheque and bank transfer and the cheque payments post) and
-- gets last month's bank statement built from the sample ledger: deposits of the official receipts (the last two days'
-- deposits still in transit), encashed cheques and fund transfers, plus bank items not yet in the books (interest,
-- final tax, service charge). Runs once (marker: a statement of the account).
UPDATE master_records SET data = data || jsonb_build_object('glAccountCode', (SELECT value #>> '{}' FROM app_settings WHERE key = 'accounting.account.cash_in_bank'), 'statementFormat', 'MBT-SAMPLE')
WHERE type_code = 'bank-account' AND code = 'ACC-MBT-001' AND COALESCE(data->>'glAccountCode', '') = ''
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'bank-account' AND m.data->>'glAccountCode' = (SELECT value #>> '{}' FROM app_settings WHERE key = 'accounting.account.cash_in_bank'));

DO $$
DECLARE
  acct record;
  admin_id text := (SELECT id FROM users WHERE username = 'BrokerVerse');
  v_from date := date_trunc('month', current_date - interval '1 month')::date;
  v_to date := (date_trunc('month', current_date) - interval '1 day')::date;
  v_open numeric;
  v_sid text;
  v_no int := 0;
  v_run numeric;
  r record;
BEGIN
  SELECT * INTO acct FROM bank_account_links WHERE bank_account_code = 'ACC-MBT-001' AND gl_account_code IS NOT NULL;
  IF acct IS NULL OR EXISTS (SELECT 1 FROM bank_statements WHERE bank_account_id = acct.bank_account_id) THEN RETURN; END IF;
  SELECT COALESCE(sum(l.debit - l.credit), 0) INTO v_open FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
   WHERE l.account_code = acct.gl_account_code AND j.status IN ('posted', 'reversed') AND j.jv_date < v_from;

  CREATE TEMP TABLE tmp_bank_lines (d date, descr text, ref text, amt numeric) ON COMMIT DROP;
  INSERT INTO tmp_bank_lines
  SELECT CASE WHEN l.debit > 0 THEN LEAST(j.jv_date + 1, v_to) WHEN ck.id IS NOT NULL THEN LEAST(j.jv_date + 3, v_to) ELSE j.jv_date END,
         CASE WHEN l.debit > 0 THEN 'DEPOSIT ' || COALESCE(j.transaction_code, j.jv_number) WHEN ck.id IS NOT NULL THEN 'CHECK ENCASHMENT' ELSE 'FUND TRANSFER ' || COALESCE(j.transaction_code, '') END,
         CASE WHEN ck.id IS NOT NULL THEN ck.instrument_no ELSE j.transaction_code END,
         l.debit - l.credit
  FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
  LEFT JOIN LATERAL (SELECT c.* FROM checkbooks c WHERE c.journal_id = j.id AND c.status = 'Printed' LIMIT 1) ck ON true
  WHERE l.account_code = acct.gl_account_code AND j.status IN ('posted', 'reversed') AND j.jv_date BETWEEN v_from AND v_to
    AND (l.debit = 0 OR j.jv_date <= v_to - 2)                        -- last two days' deposits are in transit
    AND (l.credit = 0 OR ck.id IS NOT NULL OR j.source <> 'disbursement' OR NOT EXISTS (SELECT 1 FROM checkbooks c WHERE c.journal_id = j.id));
  INSERT INTO tmp_bank_lines VALUES
    (v_to, 'INTEREST CREDIT', NULL, 125.40),
    (v_to, 'W/TAX ON INTEREST', NULL, -25.08),
    (v_to, 'SERVICE CHARGE - MAINTAINING BAL', NULL, -250.00);

  SELECT next_document_number('bank_statement') INTO v_sid;
  INSERT INTO bank_statements(statement_number, bank_account_id, bank_account_code, gl_account_code, statement_ref, period_from, period_to, opening_balance, closing_balance,
    total_debits, total_credits, line_count, format_code, file_name, source, remarks, created_by)
  SELECT v_sid, acct.bank_account_id, acct.bank_account_code, acct.gl_account_code, 'SOA ' || to_char(v_from, 'Mon YYYY'), v_from, v_to, v_open, v_open + COALESCE(sum(amt), 0),
    COALESCE(sum(-amt) FILTER (WHERE amt < 0), 0), COALESCE(sum(amt) FILTER (WHERE amt > 0), 0), count(*), 'MBT-SAMPLE', 'mbt-sample-statement.csv', 'import', 'Sample statement (demo data)', admin_id
  FROM tmp_bank_lines
  RETURNING id INTO v_sid;
  v_run := v_open;
  FOR r IN SELECT t.*, row_number() OVER (PARTITION BY t.d, t.amt, t.ref, t.descr) - 1 AS occ FROM tmp_bank_lines t ORDER BY t.d, t.amt DESC LOOP
    v_no := v_no + 1;
    v_run := v_run + r.amt;
    INSERT INTO bank_statement_lines(statement_id, bank_account_id, line_no, txn_date, description, reference, debit, credit, amount, running_balance, line_hash, source, type_code, created_by, updated_by)
    VALUES (v_sid, acct.bank_account_id, v_no, r.d, r.descr, r.ref, GREATEST(-r.amt, 0), GREATEST(r.amt, 0), r.amt, v_run,
      encode(digest(concat_ws('|', acct.bank_account_id, r.d::text, to_char(r.amt, 'FM999999999990.00'), upper(regexp_replace(COALESCE(r.ref, ''), '\s+', '', 'g')),
        btrim(upper(regexp_replace(r.descr, '\s+', ' ', 'g'))), r.occ), 'sha256'), 'hex'),
      'import', CASE WHEN r.descr LIKE 'INTEREST%' THEN 'INT' WHEN r.descr LIKE 'W/TAX%' THEN 'FTAX' WHEN r.descr LIKE 'SERVICE CHARGE%' THEN 'BCHG' END, admin_id, admin_id);
  END LOOP;
END $$;
