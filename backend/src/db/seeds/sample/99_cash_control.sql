-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Cash Control sample on the sample ledger of 89_finance.sql:
--   post-dated cheques   a set of three cheques payable to the Insurance Partner, forwarded on a transmittal and
--                        waiting for the partner's receipt; a set of two cheques payable to TISPH, in the vault
--   unapplied cash       a floating bank credit not yet identified (past its allocation date) and an advance payment
--                        of a client, each posted Dr cash in bank / Cr clients' deposits and unapplied collections
--   receipt batches      an uploaded receipt voucher batch whose combined rows carried commission kept apart
--   reversal             a receipt whose reversal waits for a second user
--   remittance hold      a part-paid policy on an instalment plan, held from the fully paid remittance
--   settings             the one collection account of the retained cheques (pdc.default_deposit_account) and the TINs
--                        of the panel insurers (needed to approve their billing statements), where still empty
-- Idempotent: each part is added once (sample rows carry "Sample:" in their remarks).

DO $$
DECLARE
  v_admin text := (SELECT id FROM users WHERE username = 'BrokerVerse');
  v_bank text := COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'accounting.account.cash_in_bank'), '106010');
  v_hold text := COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'accounting.account.unapplied_collections'), '2202001');
  v_set text; v_tr text; v_jv text; r record; v_n int := 0;
BEGIN
  IF v_admin IS NULL THEN RETURN; END IF;

  -- settings left empty by the reference data
  IF EXISTS (SELECT 1 FROM master_records WHERE type_code = 'bank-account' AND code = 'ACC-MBT-001') THEN
    UPDATE app_settings SET value = '"ACC-MBT-001"'::jsonb WHERE key = 'pdc.default_deposit_account' AND COALESCE(value #>> '{}', '') = '' AND updated_by IS NULL;
  END IF;
  UPDATE insurance_companies ic SET tin = v.tin
    FROM (VALUES ('MALAYAN', '000-406-765-000'), ('STANDARD', '000-445-581-000'), ('PIONEER', '000-470-911-000'), ('FPG', '005-219-317-000'),
                 ('MAPFRE', '000-405-133-000'), ('AXA', '000-389-726-000'), ('MERCANTILE', '000-457-262-000'), ('STRONGHOLD', '000-321-888-000'),
                 ('MAAGAP', '000-509-102-000')) AS v(code, tin)
   WHERE ic.code = v.code AND COALESCE(ic.tin, '') = '';

  -- a set of three cheques payable to the Insurance Partner, forwarded and waiting for the partner's receipt
  IF NOT EXISTS (SELECT 1 FROM pdc_sets WHERE remarks LIKE 'Sample:%') THEN
    SELECT rv.*, p.insurance_company_id AS insurer_id INTO r FROM receivables rv JOIN policies p ON p.id = rv.policy_id
     WHERE rv.id = 'rcv_crs_03' AND rv.status IN ('open', 'partial');
    IF r.id IS NOT NULL THEN
      INSERT INTO pdc_sets(set_number, policy_id, receivable_id, client_id, insurance_company_id, payee, received_date, received_by, storage_location, status, remarks, created_by, updated_by)
      VALUES (next_number('pdc_set', 'PCS'), r.policy_id, r.id, r.client_id, r.insurer_id, 'insurance-partner', current_date - 6, v_admin, 'Cash Control vault, tray 1', 'open',
        'Sample: three monthly cheques for the instalments of the bill', v_admin, v_admin) RETURNING id INTO v_set;
      INSERT INTO pdc_transmittals(transmittal_number, insurance_company_id, forwarded_on, sent_by, courier_reference, remarks, status, created_by, updated_by)
      VALUES (next_number('pdc_transmittal', 'PT'), r.insurer_id, current_date - 4, 'courier', 'LBC 1029-5512', 'Sample: cheques of set for warehousing', 'sent', v_admin, v_admin)
      RETURNING id INTO v_tr;
      INSERT INTO post_dated_cheques(pdc_number, client_id, policy_id, receivable_id, set_id, bank_id, drawee_bank, branch, account_number, cheque_number, cheque_date, amount,
          received_date, storage_location, status, payee, insurance_company_id, custody, transmittal_id, forwarded_on, instalment_seq, instalment_count, instalment_due_date,
          remarks, created_by, updated_by)
      SELECT next_number('pdc', 'PDC'), r.client_id, r.policy_id, r.id, v_set, b.id, b.name, 'Makati Ayala', '0021-4455-6677', x.chq, current_date + x.days,
        round(r.balance / 3, 2) + CASE WHEN x.seq = 3 THEN r.balance - 3 * round(r.balance / 3, 2) ELSE 0 END, current_date - 6, 'In transit', 'forwarded', 'insurance-partner',
        r.insurer_id, 'in-transit', v_tr, current_date - 4, x.seq, 3, current_date + x.days, 'Sample: instalment ' || x.seq || ' of 3', v_admin, v_admin
      FROM (VALUES (1, '0081201', 15), (2, '0081202', 45), (3, '0081203', 75)) AS x(seq, chq, days)
      LEFT JOIN banks b ON b.code = 'BDO';
    END IF;
    -- a set of two cheques payable to TISPH, kept in the vault until their dates
    SELECT rv.* INTO r FROM receivables rv WHERE rv.id = 'rcv_crs_16' AND rv.status IN ('open', 'partial');
    IF r.id IS NOT NULL THEN
      INSERT INTO pdc_sets(set_number, policy_id, receivable_id, client_id, insurance_company_id, payee, received_date, received_by, storage_location, status, remarks, created_by, updated_by)
      SELECT next_number('pdc_set', 'PCS'), r.policy_id, r.id, r.client_id, p.insurance_company_id, 'tisph', current_date - 2, v_admin, 'Cash Control vault, tray 2', 'open',
        'Sample: two cheques payable to TISPH', v_admin, v_admin FROM policies p WHERE p.id = r.policy_id RETURNING id INTO v_set;
      INSERT INTO post_dated_cheques(pdc_number, client_id, policy_id, receivable_id, set_id, bank_id, drawee_bank, branch, account_number, cheque_number, cheque_date, amount,
          received_date, storage_location, status, payee, custody, instalment_seq, instalment_count, instalment_due_date, remarks, created_by, updated_by)
      SELECT next_number('pdc', 'PDC'), r.client_id, r.policy_id, r.id, v_set, b.id, b.name, 'Cebu Mango', '1182-0099-21', x.chq, current_date + x.days,
        round(r.balance / 2, 2) + CASE WHEN x.seq = 2 THEN r.balance - 2 * round(r.balance / 2, 2) ELSE 0 END, current_date - 2, 'Cash Control vault, tray 2', 'on-hand', 'tisph',
        'tis-vault', x.seq, 2, current_date + x.days, 'Sample: instalment ' || x.seq || ' of 2', v_admin, v_admin
      FROM (VALUES (1, '5520031', 10), (2, '5520032', 40)) AS x(seq, chq, days)
      LEFT JOIN banks b ON b.code = 'MBT';
    END IF;
  END IF;

  -- unapplied collections: a floating bank credit past its allocation date, an advance payment of a client
  IF NOT EXISTS (SELECT 1 FROM unapplied_collections WHERE remarks LIKE 'Sample:%') THEN
    FOR r IN SELECT * FROM (VALUES
        ('floating', 12500.00::numeric, current_date - 5, current_date - 3, 'MBT-CR-0099812', 'Unknown depositor', NULL::text, 'Sample: bank credit without a reference the bank can match'),
        ('advance', 8000.00, current_date - 1, current_date + 1, 'BDO-DEP-77120', NULL, 'cl_crs_05', 'Sample: deposit before the renewal bill'))
      AS x(kind, amount, received, allocate_by, ref, payer, client, remarks) LOOP
      IF r.client IS NOT NULL AND NOT EXISTS (SELECT 1 FROM clients WHERE id = r.client) THEN CONTINUE; END IF;
      v_n := v_n + 1;
      INSERT INTO journal_vouchers(jv_number, jv_date, description, status, total_debit, total_credit, source, transaction_code, entry_type, reference_type, client_id, period, created_by)
      VALUES (next_number('journal', 'JV'), r.received, 'Unapplied collection ' || r.kind || ' – ' || COALESCE(r.payer, (SELECT display_name FROM clients WHERE id = r.client)),
        'pending', r.amount, r.amount, 'receipt', r.ref, 'PAYMENT_RECEIPT', 'Unapplied collection', r.client, to_char(r.received, 'YYYY-MM'), v_admin) RETURNING id INTO v_jv;
      INSERT INTO journal_lines(jv_id, line_no, account_code, account_name, debit, credit, memo, currency_code, client_id) VALUES
        (v_jv, 1, v_bank, (SELECT name FROM gl_accounts WHERE code = v_bank), r.amount, 0, r.ref, 'PHP', r.client),
        (v_jv, 2, v_hold, (SELECT name FROM gl_accounts WHERE code = v_hold), 0, r.amount, 'Held unapplied', 'PHP', r.client);
      UPDATE journal_vouchers SET status = 'posted', posted_by = v_admin, posted_at = now() WHERE id = v_jv;
      INSERT INTO unapplied_collections(client_id, kind, amount, balance, received_date, allocate_by, reference_no, payment_mode, payer_name, remarks, journal_id, created_by, updated_by)
      VALUES (r.client, r.kind, r.amount, r.amount, r.received, r.allocate_by, r.ref, 'bank-transfer', COALESCE(r.payer, (SELECT display_name FROM clients WHERE id = r.client)),
        r.remarks, v_jv, v_admin, v_admin);
    END LOOP;
  END IF;

  -- a receipt voucher batch whose combined premium-and-commission rows kept the commission apart
  IF NOT EXISTS (SELECT 1 FROM receipt_batches WHERE file_name LIKE 'sample-%') THEN
    INSERT INTO receipt_batches(batch_number, kind, file_name, row_count, created_count, failed_count, premium_total, commission_total, commission_lines, created_by, created_at)
    SELECT next_number('receipt_batch', 'RVB'), 'receipts', 'sample-rv-batch.xlsx', 3, 2, 1, COALESCE(sum(rc.amount), 0), 1850.00,
      jsonb_build_array(jsonb_build_object('row', 2, 'policyNumber', min(rc.policy_number), 'clientName', min(rc.customer_name), 'insurer', 'Malayan Insurance Co., Inc.', 'amount', 1850.00,
        'premium', min(rc.amount), 'receiptNumber', min(rc.receipt_number), 'referenceNo', 'RV-SAMPLE-1', 'receiptDate', to_char(current_date - 3, 'YYYY-MM-DD'))),
      v_admin, now() - interval '3 days'
    FROM (SELECT * FROM receipts WHERE receipt_status = 'Converted' ORDER BY received_date DESC, receipt_number LIMIT 2) rc;
  END IF;

  -- a receipt whose reversal waits for a second user
  IF NOT EXISTS (SELECT 1 FROM receipts WHERE reversal_status IS NOT NULL) THEN
    UPDATE receipts SET reversal_status = 'pending', reversal_reason_code = 'RCT-REV-DAIF', reversal_reason = 'Cheque returned DAIF', reversal_requested_by = v_admin,
        reversal_requested_at = now() - interval '2 hours'
     WHERE id = (SELECT id FROM receipts WHERE receipt_status = 'Converted' AND payment_mode = 'check' ORDER BY received_date DESC, receipt_number LIMIT 1);
  END IF;

  -- a part-paid policy on an instalment plan, held from the fully paid remittance
  INSERT INTO remittance_holds(policy_id, insurance_company_id, status, held_since, last_checked, premium, paid_to_date, balance, next_due)
  SELECT p.id, p.insurance_company_id, 'held', current_date - 10, current_date, sum(rv.amount), sum(rv.amount - rv.balance), sum(rv.balance), min(rv.due_date) FILTER (WHERE rv.balance > 0)
  FROM receivables rv JOIN policies p ON p.id = rv.policy_id
  WHERE rv.id = 'rcv_crs_02' AND rv.status = 'partial'
  GROUP BY p.id, p.insurance_company_id
  ON CONFLICT (policy_id) DO NOTHING;
END $$;
