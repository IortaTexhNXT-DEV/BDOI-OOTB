-- Finance & accounting: configuration keys, chart of accounts, commission referrers and a linked sample ledger.
-- Idempotent: settings / accounts / referrers use ON CONFLICT DO NOTHING; sample transactions only touch policies
-- that have no receivable yet.
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.auto_post_system_entries', 'true', 'accounting', 'Post system-generated journals (receipts, bookings, payouts) immediately', 'boolean'),
 ('accounting.account.cash_on_hand', '"1101001"', 'accounting', 'GL: Cash on hand', 'string'),
 ('accounting.account.cash_in_bank', '"1102001"', 'accounting', 'GL: Cash in bank (default collection / disbursement account)', 'string'),
 ('accounting.account.petty_cash_fund', '"1103001"', 'accounting', 'GL: Petty cash fund', 'string'),
 ('accounting.account.premium_receivable', '"1202001"', 'accounting', 'GL: Premiums receivable', 'string'),
 ('accounting.account.commission_receivable', '"1203001"', 'accounting', 'GL: Commission receivable from insurers (direct billed)', 'string'),
 ('accounting.account.agent_receivable', '"1204001"', 'accounting', 'GL: Receivable from agents (commission clawback)', 'string'),
 ('accounting.account.employee_advances', '"1205001"', 'accounting', 'GL: Employee advances (petty cash returns)', 'string'),
 ('accounting.account.input_vat', '"1301001"', 'accounting', 'GL: Input VAT', 'string'),
 ('accounting.account.due_to_insurer', '"2201001"', 'accounting', 'GL: Premium payable to insurers', 'string'),
 ('accounting.account.commission_payable', '"2203001"', 'accounting', 'GL: Commission (comsub) payable to agents / referrers', 'string'),
 ('accounting.account.wht_payable', '"2204001"', 'accounting', 'GL: Withholding tax payable', 'string'),
 ('accounting.account.client_refund_payable', '"2205001"', 'accounting', 'GL: Client refunds payable', 'string'),
 ('accounting.account.supplier_payable', '"2206001"', 'accounting', 'GL: Accounts payable – suppliers', 'string'),
 ('accounting.account.commission_income', '"3201001"', 'accounting', 'GL: Brokerage commission income', 'string'),
 ('accounting.account.commission_expense', '"4401010"', 'accounting', 'GL: Commission expense (comsub)', 'string'),
 ('accounting.account.write_off', '"4401009"', 'accounting', 'GL: Bad debts written off', 'string'),
 ('accounting.payable_account_by_payee', '{"Insurer":"2201001","Customer":"2205001","Client":"2205001","Agent/Referrer":"2203001","Supplier":"2206001"}', 'accounting', 'GL payable account settled by a payment voucher, per payee type', 'json'),
 ('accounting.cash_account_by_payment_mode', '{"cash":"1101001","check":"1102001","bank-transfer":"1102001","card":"1102001","gcash":"1102002","online":"1102002"}', 'accounting', 'GL cash account per receipt payment mode', 'json'),
 ('finance.maker_checker_enabled', 'true', 'finance', 'Approver must differ from the maker (JVs, cheques, payouts, commission, petty cash)', 'boolean'),
 ('journal.require_approval', 'true', 'finance', 'Manual journal vouchers need approval before posting', 'boolean'),
 ('receipts.default_payment_mode', '"bank-transfer"', 'finance', 'Default payment mode for receipts without one', 'string'),
 ('receipts.print_title', '"Official Receipts"', 'finance', 'Title printed on receipt PDFs', 'string'),
 ('disbursements.default_payment_mode', '"check"', 'finance', 'Default payment mode for payment vouchers', 'string'),
 ('limits.bulk_upload_max_rows', '1000', 'limits', 'Maximum rows in a receipts / disbursements bulk upload', 'number'),
 ('collections.default_credit_days', '30', 'collections', 'Days after inception (or billing) that premium falls due', 'number'),
 ('collections.overdue_levels', '[30, 60]', 'collections', 'Overdue level thresholds in days (level 1 up to the first, level 2 up to the second, level 3 beyond)', 'json'),
 ('collections.current_window_days', '7', 'collections', 'Items due within this many days show as Current', 'number'),
 ('collections.reminder_days_before', '7', 'collections', 'Send due-date reminders this many days before the due date', 'number'),
 ('collections.reminder_repeat_days', '7', 'collections', 'Minimum days between reminders for the same item', 'number'),
 ('collections.email_subject', '"Premium payment reminder – Policy {{policyNumber}}"', 'collections', 'Collection e-mail subject ({{policyNumber}}, {{billNumber}}, {{amount}}, {{dueDate}})', 'string'),
 ('collections.email_template', '"<p>Dear {{clientName}},</p><p>This is a friendly reminder that the premium of <b>{{amount}}</b> for policy <b>{{policyNumber}}</b> (bill {{billNumber}}) is due on {{dueDate}}.</p><p>Please disregard this notice if payment has been made.</p><p>{{companyName}}</p>"', 'collections', 'Collection reminder e-mail body (HTML with placeholders)', 'string'),
 ('commission.comsub_rate_by_level', '{"L1": 0.08, "L2": 0.05}', 'commission', 'Default comsub rate per referrer level', 'json'),
 ('commission.wht_rate_by_type', '{"Agent": 0.05, "Sub-agent": 0.05, "External": 0.10}', 'commission', 'Withholding tax on comsub per referrer type (fallback tax.withholding_rate)', 'json'),
 ('commission.require_full_payment', 'true', 'commission', 'Commission lines become eligible only when the premium is fully collected', 'boolean'),
 ('commission.auto_eligible_on_full_payment', 'true', 'commission', 'Mark lines Eligible automatically when the premium is fully collected', 'boolean'),
 ('numbering.receipt_txn.prefix', '"RT"', 'numbering', 'Receipt transaction number prefix', 'string'),
 ('numbering.disbursement_txn.prefix', '"DT"', 'numbering', 'Payment voucher transaction number prefix', 'string'),
 ('numbering.invoice_list.prefix', '"IL"', 'numbering', 'Payable (invoice list) number prefix', 'string'),
 ('numbering.petty_cash.prefix', '"PC"', 'numbering', 'Petty cash transaction number prefix', 'string'),
 ('numbering.petty_cash_request.prefix', '"PCR"', 'numbering', 'Petty cash request number prefix', 'string'),
 ('numbering.petty_cash_receipt.prefix', '"PCRC"', 'numbering', 'Petty cash receipt number prefix', 'string')
ON CONFLICT (key) DO NOTHING;

-- Chart of accounts (codes follow the Journal Voucher screen: 1 assets, 2 liabilities, 3 income, 4 expenses, 5 equity)
INSERT INTO gl_accounts(code, name, account_type, parent_code, category, is_open_item, allow_manual) VALUES
 ('1101001','Cash on Hand','asset',NULL,'Cash',false,true),
 ('1102001','Cash in Bank – BDO Current','asset',NULL,'Cash',false,true),
 ('1102002','Cash in Bank – E-wallet Clearing (GCash)','asset',NULL,'Cash',false,true),
 ('1103001','Petty Cash Fund','asset',NULL,'Cash',false,true),
 ('1202001','Premiums Receivable - Direct Clients','asset',NULL,'Premiums Receivable',true,true),
 ('1202002','Premiums Receivable - Corporate Customers','asset',NULL,'Premiums Receivable',true,true),
 ('1202003','Premiums Receivable - Agents','asset',NULL,'Premiums Receivable',true,true),
 ('1202004','Premiums Receivable - Broker - Local','asset',NULL,'Premiums Receivable',true,true),
 ('1202005','Premiums Receivable - Broker - International','asset',NULL,'Premiums Receivable',true,true),
 ('1202006','Premiums Receivable - Banks','asset',NULL,'Premiums Receivable',true,true),
 ('1202007','Premiums Receivable - Insurance Co - Local','asset',NULL,'Premiums Receivable',true,true),
 ('1202008','Premiums Receivable - Insurance Co - International','asset',NULL,'Premiums Receivable',true,true),
 ('1202020','Provision for Bad Debt','asset',NULL,'Premiums Receivable',false,true),
 ('1203001','Commission Receivable - Insurers','asset',NULL,'Receivables',true,true),
 ('1204001','Receivable from Agents - Clawback','asset',NULL,'Receivables',true,true),
 ('1205001','Employee Advances','asset',NULL,'Receivables',true,true),
 ('1301001','Input VAT','asset',NULL,'Taxes',false,true),
 ('2201001','Premium Payable to Insurers','liability',NULL,'Payables',true,true),
 ('2203001','Commission Accrued - Agents','liability',NULL,'Commission Accrued',true,true),
 ('2203002','Commission Accrued - Banks','liability',NULL,'Commission Accrued',true,true),
 ('2203003','Commission Accrued - Broker - Local','liability',NULL,'Commission Accrued',true,true),
 ('2203004','Commission Accrued - Broker - International','liability',NULL,'Commission Accrued',true,true),
 ('2203005','Commission Accrued - Insurance Co - Local','liability',NULL,'Commission Accrued',true,true),
 ('2203006','Commission Accrued - Insurance Co - International','liability',NULL,'Commission Accrued',true,true),
 ('2204001','Withholding Tax Payable - Expanded','liability',NULL,'Taxes',false,true),
 ('2205001','Client Refunds Payable','liability',NULL,'Payables',true,true),
 ('2206001','Accounts Payable - Suppliers','liability',NULL,'Payables',true,true),
 ('3101001','Gross Written Premium','income',NULL,'Premium',false,true),
 ('3201001','Brokerage Commission Income','income',NULL,'Commission',false,true),
 ('4101001','Gross Claims Paid','expense',NULL,'Claims',false,true),
 ('4401001','Administrative Cost','expense',NULL,'Operating Expenses',false,true),
 ('4401002','Advertising','expense',NULL,'Operating Expenses',false,true),
 ('4401003','Audit Fees','expense',NULL,'Operating Expenses',false,true),
 ('4401004','Bank Charges','expense',NULL,'Operating Expenses',false,true),
 ('4401005','Building Cost Expense','expense',NULL,'Operating Expenses',false,true),
 ('4401006','Consultancy Fees','expense',NULL,'Operating Expenses',false,true),
 ('4401007','Communication and Courier','expense',NULL,'Operating Expenses',false,true),
 ('4401008','Office Supplies','expense',NULL,'Operating Expenses',false,true),
 ('4401009','Bad Debts Written Off','expense',NULL,'Operating Expenses',false,true),
 ('4401010','Commission Expense - Sub-agents (Comsub)','expense',NULL,'Commission',false,true),
 ('5101001','Retained Earnings','equity',NULL,'Equity',false,true)
ON CONFLICT (code) DO NOTHING;
INSERT INTO gl_accounts(code, name, account_type, parent_code, category) VALUES
 ('3101001001','Gross Written Premium - Motor','income','3101001','Premium'),('3101001002','Gross Written Premium - Fire','income','3101001','Premium'),
 ('3101001003','Gross Written Premium - Marine','income','3101001','Premium'),('3101001004','Gross Written Premium - Engineering','income','3101001','Premium'),
 ('3101001005','Gross Written Premium - General Accident','income','3101001','Premium'),
 ('4101001001','Gross Claims Paid - Motor','expense','4101001','Claims'),('4101001002','Gross Claims Paid - Fire','expense','4101001','Claims'),
 ('4101001003','Gross Claims Paid - Marine','expense','4101001','Claims'),('4101001004','Gross Claims Paid - Engineering','expense','4101001','Claims'),
 ('4101001005','Gross Claims Paid - General Accident','expense','4101001','Claims'),('4101001006','Gross Claims Paid - Liability','expense','4101001','Claims'),
 ('4101001007','Gross Claims Paid - Bonds','expense','4101001','Claims'),('4101001008','Gross Claims Paid - Aviation','expense','4101001','Claims'),
 ('4101001009','Gross Claims Paid - Oil and Gas','expense','4101001','Claims'),
 ('4401003001','Audit Fees Statutory','expense','4401003','Operating Expenses'),('4401003002','Audit Fees Other','expense','4401003','Operating Expenses'),
 ('4401003003','Internal Audit','expense','4401003','Operating Expenses')
ON CONFLICT (code) DO NOTHING;

-- Commission referrers (fictional)
INSERT INTO commission_referrers(id, name, referrer_type, level, parent_referrer_id, tin, email, phone, wht_rate, wht_applicable, bank_name, bank_account_no, status) VALUES
 ('ref-jdelacruz','Juan Dela Cruz','Agent','L1',NULL,'123-456-789-000','juan.delacruz@example.ph','+63 917 555 0101',NULL,true,'BDO','004560124521','Active'),
 ('ref-rbautista','Ramon Bautista','Agent','L1',NULL,'234-567-891-000','ramon.bautista@example.ph','+63 918 555 0102',NULL,true,'BPI','3179048830','Active'),
 ('ref-amendoza','Andres Mendoza','Agent','L1',NULL,'345-678-912-000','andres.mendoza@example.ph','+63 919 555 0103',NULL,true,'Metrobank','0072335519','Active'),
 ('ref-pvillanueva','Pia Villanueva','Agent','L1',NULL,'456-789-123-000','pia.villanueva@example.ph','+63 920 555 0104',NULL,true,'Security Bank','0000912207','Active'),
 ('ref-mreyes','Marites Reyes','Sub-agent','L2','ref-jdelacruz','567-891-234-000','marites.reyes@example.ph','+63 921 555 0105',NULL,true,'BDO','004560127742','Active'),
 ('ref-lgarcia','Liza Garcia','Sub-agent','L2','ref-rbautista','678-912-345-000','liza.garcia@example.ph','+63 922 555 0106',NULL,true,'Landbank','1234561188','Active'),
 ('ref-makatimotors','Makati Motors Trading Corp.','External',NULL,NULL,'789-123-456-000','accounts@makatimotors.example.ph','+63 2 8555 0107',NULL,true,'BDO','004560129901','Active'),
 ('ref-cebuprime','Cebu Prime Realty Inc.','External',NULL,NULL,'891-234-567-000','finance@cebuprime.example.ph','+63 32 555 0108',NULL,false,'Chinabank','1002033310','Active')
ON CONFLICT (id) DO NOTHING;

-- ---------- sample transactions ----------
-- Helpers (session-local): balanced journal, booking of a receivable, payment application.
CREATE OR REPLACE FUNCTION pg_temp.fin_setting(p_key text, p_default text) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = p_key), p_default) $$;

CREATE OR REPLACE FUNCTION pg_temp.fin_jv(p_date date, p_desc text, p_source text, p_entry text, p_txn text, p_ref_type text, p_ref_id text,
  p_client text, p_policy text, p_polno text, p_due date, p_lines jsonb, p_user text, p_status text DEFAULT 'posted') RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_id text; v_d numeric; v_c numeric; l jsonb; n int := 0;
BEGIN
  SELECT COALESCE(sum((x->>'d')::numeric),0), COALESCE(sum((x->>'c')::numeric),0) INTO v_d, v_c FROM jsonb_array_elements(p_lines) x;
  INSERT INTO journal_vouchers(jv_number, jv_date, description, status, total_debit, total_credit, source, transaction_code, entry_type, reference_type, reference_id,
    client_id, policy_id, policy_number, due_date, period, created_by, requires_approval)
  VALUES (next_number('journal', pg_temp.fin_setting('numbering.journal.prefix', 'JV')), p_date, p_desc, 'pending', v_d, v_c, p_source, p_txn, p_entry, p_ref_type, p_ref_id,
    p_client, p_policy, p_polno, p_due, to_char(p_date,'YYYY-MM'), p_user, p_source = 'manual')
  RETURNING id INTO v_id;
  FOR l IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
    IF COALESCE((l->>'d')::numeric,0) = 0 AND COALESCE((l->>'c')::numeric,0) = 0 THEN CONTINUE; END IF;
    n := n + 1;
    INSERT INTO journal_lines(jv_id, line_no, account_code, account_name, debit, credit, memo, currency_code, client_id, policy_id, due_date)
    VALUES (v_id, n, l->>'a', (SELECT name FROM gl_accounts WHERE code = l->>'a'), COALESCE((l->>'d')::numeric,0), COALESCE((l->>'c')::numeric,0), l->>'m', 'PHP', p_client, p_policy, p_due);
  END LOOP;
  IF p_status = 'posted' THEN UPDATE journal_vouchers SET status = 'posted', posted_by = p_user, posted_at = now() WHERE id = v_id;
  ELSIF p_status <> 'pending' THEN UPDATE journal_vouchers SET status = p_status WHERE id = v_id; END IF;
  RETURN v_id;
END $$;

-- Booking journal for a receivable: Dr Premium Receivable / Cr Due to Insurer / Cr Commission Income
CREATE OR REPLACE FUNCTION pg_temp.fin_book(p_rcv text, p_user text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r record; v_comm numeric; v_jv text;
BEGIN
  SELECT rv.*, p.policy_number, p.commission_amount AS pol_comm, p.premium_total, p.details, ic.commission_rate, ic.name AS ic_name INTO r
  FROM receivables rv JOIN policies p ON p.id = rv.policy_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE rv.id = p_rcv;
  IF r.id IS NULL OR r.booking_jv_id IS NOT NULL THEN RETURN r.booking_jv_id; END IF;
  v_comm := CASE WHEN r.commission_amount > 0 THEN r.commission_amount WHEN r.pol_comm > 0 AND abs(r.premium_total - r.amount) < 0.01 THEN r.pol_comm
                 ELSE round(COALESCE(NULLIF(r.net_premium, 0), (r.details->>'netPremium')::numeric, r.amount / 1.2525) * COALESCE(r.commission_rate, (pg_temp.fin_setting('commission.default_rate','0.15'))::numeric), 2) END;
  v_comm := LEAST(v_comm, r.amount);
  v_jv := pg_temp.fin_jv(LEAST(r.due_date - 30, current_date), 'Premium billed – ' || r.policy_number || ' (' || r.bill_number || ')', 'booking', 'NEW_BUSINESS', r.bill_number, 'Policy', r.policy_id,
    r.client_id, r.policy_id, r.policy_number, r.due_date, jsonb_build_array(
      jsonb_build_object('a','1202001','d',r.amount,'m','Premium receivable ' || r.bill_number),
      jsonb_build_object('a','2201001','c',r.amount - v_comm,'m','Premium due to ' || COALESCE(r.ic_name,'insurer')),
      jsonb_build_object('a','3201001','c',v_comm,'m','Brokerage commission')), p_user);
  UPDATE receivables SET booking_jv_id = v_jv, commission_amount = v_comm WHERE id = p_rcv;
  RETURN v_jv;
END $$;

-- Payment journal + application (receivable balance is maintained by the caller)
CREATE OR REPLACE FUNCTION pg_temp.fin_pay(p_rcv text, p_receipt text, p_line text, p_amount numeric, p_date date, p_mode text, p_user text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r record; v_or text; v_jv text;
BEGIN
  SELECT rv.*, p.policy_number INTO r FROM receivables rv JOIN policies p ON p.id = rv.policy_id WHERE rv.id = p_rcv;
  SELECT receipt_number INTO v_or FROM receipts WHERE id = p_receipt;
  v_jv := pg_temp.fin_jv(p_date, 'Premium collected – ' || r.policy_number || COALESCE(' (' || v_or || ')', ''), 'receipt', 'PAYMENT_RECEIPT', COALESCE(v_or, r.bill_number), 'Receipt', p_receipt,
    r.client_id, r.policy_id, r.policy_number, r.due_date, jsonb_build_array(
      jsonb_build_object('a', CASE p_mode WHEN 'cash' THEN '1101001' WHEN 'gcash' THEN '1102002' ELSE '1102001' END, 'd', p_amount, 'm', COALESCE(v_or, 'Premium collection')),
      jsonb_build_object('a','1202001','c',p_amount,'m','Settles ' || r.bill_number)), p_user);
  INSERT INTO receipt_applications(receipt_id, receipt_line_id, receivable_id, amount, journal_id, payment_mode, reference_no, applied_by, applied_at)
  VALUES (p_receipt, p_line, p_rcv, p_amount, v_jv, p_mode, v_or, p_user, p_date::timestamptz);
  RETURN v_jv;
END $$;

-- Official receipt with one line for an amount already reflected in the receivable balance
CREATE OR REPLACE FUNCTION pg_temp.fin_receipt(p_rcv text, p_amount numeric, p_date date, p_mode text, p_user text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r record; v_or text; v_line text;
BEGIN
  SELECT rv.*, p.policy_number, p.details, c.client_code, c.display_name INTO r FROM receivables rv JOIN policies p ON p.id = rv.policy_id LEFT JOIN clients c ON c.id = rv.client_id WHERE rv.id = p_rcv;
  INSERT INTO receipts(receipt_number, receivable_id, policy_id, client_id, amount, payment_mode, reference_no, received_date, status, remarks, created_by, receipt_type, receipt_status,
    transaction_code, transaction_number, customer_code, customer_name, currency_code, policy_number, source)
  VALUES (next_number('receipt', pg_temp.fin_setting('numbering.receipt.prefix', 'OR')), p_rcv, r.policy_id, r.client_id, p_amount, p_mode, NULL, p_date, 'posted',
    'Payment receipt for policy ' || r.policy_number, p_user, 'Payment', CASE WHEN p_amount >= r.amount THEN 'Converted' ELSE 'Draft' END, 'PAYMENT',
    next_number('receipt-txn', pg_temp.fin_setting('numbering.receipt_txn.prefix', 'RT')), r.client_code, r.display_name, r.currency, r.policy_number, 'api')
  RETURNING id INTO v_or;
  INSERT INTO receipt_lines(receipt_id, line_no, policy_id, policy_number, net_premium, paid, un_paid, vat, dst, lgt, lc_amount, status, applied_amount)
  VALUES (v_or, 1, r.policy_id, r.policy_number, COALESCE(NULLIF(r.net_premium, 0), (r.details->>'netPremium')::numeric, r.amount), p_amount, GREATEST(r.amount - p_amount, 0),
    r.vat, r.dst, r.lgt, r.amount, CASE WHEN p_amount >= r.amount THEN 'Paid' ELSE 'Pending' END, p_amount)
  RETURNING id INTO v_line;
  PERFORM pg_temp.fin_pay(p_rcv, v_or, v_line, p_amount, p_date, p_mode, p_user);
  RETURN v_or;
END $$;

DO $$
DECLARE
  v_admin text := (SELECT id FROM users WHERE username = 'BrokerVerse');
  v_first text[] := ARRAY['Maria','Jose','Ana','Paolo','Kristine','Miguel','Rhea','Carlo','Joanna','Ramil','Grace','Dennis','Leah','Vincent','Katrina','Noel'];
  v_last text[] := ARRAY['Santos','Reyes','Cruz','Bautista','Ocampo','Garcia','Mendoza','Torres','Aquino','Ramos','Castillo','Navarro','Flores','Domingo','Salazar','Villareal'];
  v_prod text[] := ARRAY['MOTOR','MOTOR','FIRE','MOTOR','PA','MARINE','MOTOR','FIRE','CTPL','CGL','MOTOR','PA','FIRE','MOTOR','EB','MOTOR'];
  v_ins text[] := ARRAY['MALAYAN','PIONEER','MAPFRE','FPG','STANDARD','MERCANTILE'];
  v_net numeric[] := ARRAY[18500,9800,42000,15200,3500,27600,21400,58000,1200,33500,16800,4200,36500,19900,120000,12750];
  v_chain jsonb[] := ARRAY[
    '{"primary":{"referrerId":"ref-jdelacruz","level":"L1"},"chain":[{"referrerId":"ref-mreyes","level":"L2"}]}',
    '{"primary":{"referrerId":"ref-rbautista","level":"L1"},"chain":[{"referrerId":"ref-lgarcia","level":"L2"}]}',
    '{"primary":{"referrerId":"ref-makatimotors","comsubPct":6},"chain":[]}',
    '{"primary":{"referrerId":"ref-amendoza","level":"L1"},"chain":[]}',
    '{"primary":{"referrerId":"ref-pvillanueva","level":"L1"},"chain":[]}',
    '{"primary":{"referrerId":"ref-cebuprime","comsubPct":5},"chain":[]}']::jsonb[];
  v_modes text[] := ARRAY['bank-transfer','gcash','check','cash'];
  i int; v_cl text; v_ic record; v_pr record; v_gross numeric; v_due date; v_rcv text; v_or text; v_line text; v_paid numeric; p record; e jsonb; pos int; v_ref record;
  v_pct numeric; v_comsub numeric; v_whtp numeric; v_wht numeric; v_status text; v_cm text; v_pv text; v_pvno text; v_jv text; v_net0 numeric; v_brk numeric; v_cycle date;
BEGIN
  -- A. top up sample clients / policies when the policy modules have not seeded enough
  IF (SELECT count(*) FROM policies) < 12 THEN
    FOR i IN 1..16 LOOP
      v_cl := 'cl_fin_' || lpad(i::text, 2, '0');
      SELECT * INTO v_ic FROM insurance_companies WHERE code = v_ins[1 + (i % 6)];
      SELECT * INTO v_pr FROM products WHERE code = v_prod[i];
      INSERT INTO clients(id, client_code, client_type, first_name, last_name, display_name, email, phone, city, country, status, owner_user_id, created_by)
      VALUES (v_cl, 'CL-2026-F' || lpad(i::text, 4, '0'), 'individual', v_first[i], v_last[i], v_first[i] || ' ' || v_last[i], lower(v_first[i] || '.' || v_last[i]) || '@example.ph',
        '+63 917 400 ' || lpad((1000 + i)::text, 4, '0'), (ARRAY['Makati','Quezon City','Pasig','Cebu City','Davao City','Taguig'])[1 + (i % 6)], 'Philippines', 'active', v_admin, 'seed')
      ON CONFLICT (id) DO NOTHING;
      v_gross := round(v_net[i] * 1.2525, 2);
      INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total, commission_amount, currency, details, created_by)
      VALUES ('pol_fin_' || lpad(i::text, 2, '0'), 'POL-2026-F' || lpad(i::text, 4, '0'), v_cl, v_pr.id, v_ic.id, v_admin, 'active', current_date - (160 - i * 9), current_date - (160 - i * 9) + 365,
        v_net[i] * 60, v_gross, round(v_net[i] * COALESCE(v_ic.commission_rate, 0.15), 2), 'PHP',
        jsonb_build_object('netPremium', v_net[i], 'valueAddedTax', round(v_net[i] * 0.12, 2), 'documentaryStampTax', round(v_net[i] * 0.125, 2), 'localGovernmentTax', round(v_net[i] * 0.0075, 2)), 'seed')
      ON CONFLICT (id) DO NOTHING;
    END LOOP;
  END IF;

  -- B. bill policies that have no receivable yet; collect about two thirds (some partially)
  i := 0;
  FOR p IN SELECT pl.* FROM policies pl WHERE pl.premium_total > 0 AND pl.status <> 'cancelled' AND NOT EXISTS (SELECT 1 FROM receivables r WHERE r.policy_id = pl.id)
           ORDER BY pl.created_at, pl.id LIMIT 40 LOOP
    i := i + 1;
    v_due := current_date + (ARRAY[20, 5, -10, -25, -45, -70, -100, 12, -3, -40, 30, -15, -65, 2, -95, 45])[1 + ((i - 1) % 16)];
    INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status, source, currency, net_premium, vat, dst, lgt, created_by)
    VALUES (next_number('invoice', pg_temp.fin_setting('numbering.invoice.prefix', 'INV')), p.id, p.client_id, p.premium_total, p.premium_total, v_due, 'open', 'policy', p.currency,
      COALESCE((p.details->>'netPremium')::numeric, 0), COALESCE((p.details->>'valueAddedTax')::numeric, 0), COALESCE((p.details->>'documentaryStampTax')::numeric, 0),
      COALESCE((p.details->>'localGovernmentTax')::numeric, 0), v_admin)
    RETURNING id INTO v_rcv;
    PERFORM pg_temp.fin_book(v_rcv, v_admin);
    IF i % 3 <> 0 THEN
      v_paid := CASE WHEN i % 5 = 0 THEN round(p.premium_total / 2, 2) ELSE p.premium_total END;
      UPDATE receivables SET balance = amount - v_paid, status = CASE WHEN v_paid >= amount THEN 'paid' ELSE 'partial' END, last_payment_at = now() WHERE id = v_rcv;
      PERFORM pg_temp.fin_receipt(v_rcv, v_paid, LEAST(v_due, current_date) - (i % 4), v_modes[1 + (i % 4)], v_admin);
    END IF;
  END LOOP;

  -- C. booking journals for receivables created by other modules
  FOR p IN SELECT id FROM receivables WHERE booking_jv_id IS NULL ORDER BY created_at, id LOOP PERFORM pg_temp.fin_book(p.id, v_admin); END LOOP;

  -- D. receipts created by other modules without lines: add the line, header fields and the payment journal
  FOR p IN SELECT rc.*, rv.amount AS rcv_amount, rv.net_premium, rv.vat, rv.dst, rv.lgt, pl.policy_number AS pol_no, c.client_code, c.display_name
           FROM receipts rc LEFT JOIN receivables rv ON rv.id = rc.receivable_id LEFT JOIN policies pl ON pl.id = rc.policy_id LEFT JOIN clients c ON c.id = rc.client_id
           WHERE NOT EXISTS (SELECT 1 FROM receipt_lines l WHERE l.receipt_id = rc.id) LOOP
    INSERT INTO receipt_lines(receipt_id, line_no, policy_id, policy_number, net_premium, paid, un_paid, vat, dst, lgt, lc_amount, status, applied_amount)
    VALUES (p.id, 1, p.policy_id, p.pol_no, COALESCE(NULLIF(p.net_premium, 0), p.amount), p.amount, GREATEST(COALESCE(p.rcv_amount, p.amount) - p.amount, 0), COALESCE(p.vat, 0), COALESCE(p.dst, 0),
      COALESCE(p.lgt, 0), COALESCE(p.rcv_amount, p.amount), CASE WHEN p.amount >= COALESCE(p.rcv_amount, p.amount) THEN 'Paid' ELSE 'Pending' END, p.amount)
    RETURNING id INTO v_line;
    UPDATE receipts SET customer_code = COALESCE(customer_code, p.client_code), customer_name = COALESCE(customer_name, p.display_name), policy_number = COALESCE(policy_number, p.pol_no),
      transaction_code = COALESCE(transaction_code, 'PAYMENT'), transaction_number = COALESCE(transaction_number, next_number('receipt-txn', pg_temp.fin_setting('numbering.receipt_txn.prefix', 'RT'))),
      receipt_status = CASE WHEN status = 'cancelled' THEN 'Cancelled' WHEN p.amount >= COALESCE(p.rcv_amount, p.amount) THEN 'Converted' ELSE 'Draft' END WHERE id = p.id;
    IF p.receivable_id IS NOT NULL AND p.status <> 'cancelled' AND NOT EXISTS (SELECT 1 FROM receipt_applications a WHERE a.receipt_id = p.id) THEN
      PERFORM pg_temp.fin_pay(p.receivable_id, p.id, v_line, p.amount, p.received_date, p.payment_mode, v_admin);
    END IF;
  END LOOP;

  -- E. receivables shown as (partly) paid without a recorded payment: raise the official receipt
  FOR p IN SELECT rv.id, rv.amount - rv.balance - COALESCE((SELECT sum(a.amount) FROM receipt_applications a WHERE a.receivable_id = rv.id AND a.status = 'applied'), 0) AS gap,
             rv.due_date, row_number() OVER (ORDER BY rv.created_at, rv.id) AS rn
           FROM receivables rv WHERE rv.amount - rv.balance > COALESCE((SELECT sum(a.amount) FROM receipt_applications a WHERE a.receivable_id = rv.id AND a.status = 'applied'), 0) LOOP
    PERFORM pg_temp.fin_receipt(p.id, p.gap, LEAST(p.due_date, current_date) - (p.rn % 5)::int, v_modes[1 + (p.rn % 4)], v_admin);
  END LOOP;

  -- F. legacy agent commission lines (no referrer): give each agent user a referrer account and complete the line
  INSERT INTO commission_referrers(id, name, referrer_type, level, user_id, email, status)
  SELECT DISTINCT 'ref-' || regexp_replace(lower(u.username), '[^a-z0-9]+', '-', 'g'), u.display_name, 'Agent', 'L1', u.id, u.email, 'Active'
  FROM commissions cm JOIN users u ON u.id = cm.agent_user_id WHERE cm.referrer_id IS NULL
  ON CONFLICT (id) DO NOTHING;
  UPDATE commissions cm SET referrer_id = r.id, policy_number = pl.policy_number, gross_premium = pl.premium_total, net_premium = cm.basis_amount,
    comsub_pct = round(cm.rate * 100, 2), wht_pct = round(CASE WHEN cm.amount > 0 THEN cm.withholding / cm.amount * 100 ELSE 0 END, 2),
    brokerage_pct = round(COALESCE(ic.commission_rate, 0.15) * 100, 2), brokerage_amount = round(cm.basis_amount * COALESCE(ic.commission_rate, 0.15), 2),
    product_label = pr.name, insurer_label = ic.short_name, cycle_date = COALESCE(to_date(cm.period, 'YYYY-MM'), date_trunc('month', cm.created_at)::date),
    accrued_at = COALESCE(cm.accrued_at, cm.created_at),
    status = CASE WHEN lower(cm.status) = 'paid' THEN 'Paid' WHEN lower(cm.status) = 'payable' THEN 'Approved'
                  WHEN NOT EXISTS (SELECT 1 FROM receivables rv WHERE rv.policy_id = cm.policy_id AND rv.balance > 0) THEN 'Eligible' ELSE 'Accrued' END,
    eligible_at = CASE WHEN NOT EXISTS (SELECT 1 FROM receivables rv WHERE rv.policy_id = cm.policy_id AND rv.balance > 0) THEN now() - interval '10 days' END
  FROM users u, commission_referrers r, policies pl LEFT JOIN insurance_companies ic ON ic.id = pl.insurance_company_id LEFT JOIN products pr ON pr.id = pl.product_id
  WHERE cm.referrer_id IS NULL AND u.id = cm.agent_user_id AND r.user_id = u.id AND pl.id = cm.policy_id;

  -- G. referral chains on collected policies: lines in every lifecycle state (with accrual / payout journals)
  i := 0;
  FOR p IN SELECT pl.*, ic.short_name AS ic_short, ic.commission_rate, pr.name AS product_name, rv.balance, rv.id AS rcv_id
           FROM policies pl JOIN receivables rv ON rv.policy_id = pl.id LEFT JOIN insurance_companies ic ON ic.id = pl.insurance_company_id LEFT JOIN products pr ON pr.id = pl.product_id
           WHERE NOT EXISTS (SELECT 1 FROM commissions cm WHERE cm.policy_id = pl.id AND cm.referrer_id LIKE 'ref-%' AND cm.chain_position >= 0 AND cm.referrer_id IN (SELECT id FROM commission_referrers WHERE user_id IS NULL))
           ORDER BY (rv.balance = 0) DESC, rv.due_date DESC, pl.id LIMIT 16 LOOP
    i := i + 1;
    v_net0 := COALESCE(NULLIF((p.details->>'netPremium')::numeric, 0), round(p.premium_total / 1.2525, 2));
    v_brk := round(COALESCE(p.commission_rate, 0.15) * 100, 2);
    UPDATE policies SET details = details || jsonb_build_object('commissionDetails', jsonb_build_object('brokeragePct', v_brk, 'productLabel', p.product_name) || v_chain[1 + ((i - 1) % 6)])
    WHERE id = p.id AND NOT (details ? 'commissionDetails');
    pos := 0;
    FOR e IN SELECT * FROM jsonb_array_elements(jsonb_build_array(v_chain[1 + ((i - 1) % 6)]->'primary') || (v_chain[1 + ((i - 1) % 6)]->'chain')) LOOP
      SELECT * INTO v_ref FROM commission_referrers WHERE id = e->>'referrerId';
      v_pct := COALESCE((e->>'comsubPct')::numeric, CASE e->>'level' WHEN 'L2' THEN 5 ELSE 8 END);
      v_comsub := round(v_net0 * v_pct / 100, 2);
      v_whtp := CASE WHEN v_ref.referrer_type = 'External' THEN 10 ELSE 5 END;
      v_wht := CASE WHEN v_ref.wht_applicable THEN round(v_comsub * v_whtp / 100, 2) ELSE 0 END;
      v_status := CASE WHEN p.balance > 0 THEN 'Accrued' ELSE (ARRAY['Paid','Approved','Eligible','Paid','Eligible','Approved','Paid','Eligible','Reversed','Approved','Eligible','Paid'])[1 + ((i - 1) % 12)] END;
      v_cycle := date_trunc('month', CASE WHEN v_status = 'Accrued' AND i % 2 = 0 THEN current_date + 32 WHEN v_status IN ('Paid','Reversed') THEN current_date - 35 ELSE current_date END)::date;
      INSERT INTO commissions(policy_id, referrer_id, policy_number, product_label, insurer_label, cycle_date, period, gross_premium, net_premium, brokerage_pct, brokerage_amount,
        comsub_pct, wht_pct, basis_amount, rate, amount, withholding, net_amount, status, accrued_at, eligible_at, approved_at, approved_by, chain_position, clawback, reversed_at, reversed_by,
        receipt_no)
      VALUES (p.id, v_ref.id, p.policy_number, p.product_name, p.ic_short, v_cycle, to_char(v_cycle, 'YYYY-MM'), p.premium_total, v_net0, v_brk, round(v_net0 * v_brk / 100, 2),
        v_pct, v_whtp, v_net0, v_pct / 100, v_comsub, v_wht, v_comsub - v_wht, v_status, now() - interval '40 days',
        CASE WHEN v_status <> 'Accrued' THEN now() - interval '30 days' END, CASE WHEN v_status IN ('Approved','Paid','Reversed') THEN now() - interval '20 days' END,
        CASE WHEN v_status IN ('Approved','Paid','Reversed') THEN v_admin END, pos, v_status = 'Reversed', CASE WHEN v_status = 'Reversed' THEN now() - interval '2 days' END,
        CASE WHEN v_status = 'Reversed' THEN v_admin END,
        (SELECT rc.receipt_number FROM receipts rc WHERE rc.policy_id = p.id ORDER BY rc.received_date DESC LIMIT 1))
      ON CONFLICT DO NOTHING RETURNING id INTO v_cm;
      pos := pos + 1;
      CONTINUE WHEN v_cm IS NULL OR v_status NOT IN ('Approved','Paid','Reversed');
      v_jv := pg_temp.fin_jv(current_date - 20, 'Comsub approved – ' || v_ref.name || ' – ' || p.policy_number, 'commission', 'COMMISSION_ACCRUAL', p.policy_number, 'Commission', v_cm,
        NULL, p.id, p.policy_number, NULL, jsonb_build_array(jsonb_build_object('a','4401010','d',v_comsub,'m','Comsub expense'), jsonb_build_object('a','2203001','c',v_comsub,'m','Payable to ' || v_ref.name)), v_admin);
      UPDATE commissions SET accrual_jv_id = v_jv WHERE id = v_cm;
      CONTINUE WHEN v_status = 'Approved';
      v_pvno := next_number('voucher', pg_temp.fin_setting('numbering.voucher.prefix', 'PV'));
      INSERT INTO disbursements(voucher_number, payee_type, payee_id, payee_name, amount, gross_amount, wht_amount, payment_mode, status, voucher_date, transaction_number, transaction_code,
        transaction_description, criteria, customer_code, referrer_id, referrer_name, instrument_currency, source, approved_by, approved_at, paid_at, created_by)
      VALUES (v_pvno, 'Agent/Referrer', v_ref.id, v_ref.name, v_comsub - v_wht, v_comsub, v_wht, 'bank-transfer', 'paid', current_date - 15,
        next_number('disbursement-txn', pg_temp.fin_setting('numbering.disbursement_txn.prefix', 'DT')), 'COMSUB', 'Comsub payout – ' || v_ref.name, 'Specific', v_ref.id, v_ref.id, v_ref.name,
        'PHP', 'agent-payout', v_admin, now() - interval '15 days', now() - interval '15 days', v_admin)
      RETURNING id INTO v_pv;
      v_jv := pg_temp.fin_jv(current_date - 15, 'Comsub payout ' || v_pvno || ' – ' || v_ref.name, 'disbursement', 'COMMISSION_PAYMENT', v_pvno, 'Disbursement', v_pv, NULL, NULL, NULL, NULL,
        jsonb_build_array(jsonb_build_object('a','2203001','d',v_comsub,'m','Comsub payable settled'), jsonb_build_object('a','1102001','c',v_comsub - v_wht,'m','Paid to ' || v_ref.name),
          jsonb_build_object('a','2204001','c',v_wht,'m','Withholding tax on commission')), v_admin);
      UPDATE disbursements SET journal_id = v_jv WHERE id = v_pv;
      UPDATE commissions SET paid_at = now() - interval '15 days', paid_by = v_admin, disbursement_id = v_pv, voucher_no = v_pvno, payment_jv_id = v_jv WHERE id = v_cm;
      IF v_status = 'Reversed' THEN
        PERFORM pg_temp.fin_jv(current_date - 2, 'Comsub clawback – ' || v_ref.name || ' – ' || p.policy_number, 'commission', 'COMMISSION_CLAWBACK', p.policy_number, 'Commission', v_cm, NULL, p.id, p.policy_number, NULL,
          jsonb_build_array(jsonb_build_object('a','1204001','d',v_comsub,'m','Clawback receivable from referrer'), jsonb_build_object('a','4401010','c',v_comsub,'m','Comsub clawback')), v_admin);
      END IF;
    END LOOP;
  END LOOP;

  -- every receivable has a collection item
  INSERT INTO collection_items(receivable_id, policy_id, client_id) SELECT r.id, r.policy_id, r.client_id FROM receivables r ON CONFLICT (receivable_id) DO NOTHING;
  -- a few follow-ups and commitments on overdue items
  IF NOT EXISTS (SELECT 1 FROM collection_actions) THEN
    INSERT INTO collection_actions(collection_id, action_type, action_date, action_by, call_outcome, notes)
    SELECT ci.id, (ARRAY['Call','Email','SMS'])[1 + (row_number() OVER (ORDER BY r.due_date))::int % 3], now() - interval '3 days', 'BrokerVerse',
      CASE WHEN (row_number() OVER (ORDER BY r.due_date))::int % 3 = 0 THEN 'Answered' END, 'Reminded client of the outstanding premium'
    FROM collection_items ci JOIN receivables r ON r.id = ci.receivable_id WHERE r.balance > 0;
    UPDATE collection_items ci SET commitment_date = current_date + 10, commitment_reason = 'Client will pay after payroll', last_follow_up_at = now() - interval '3 days'
    WHERE ci.id = (SELECT ci2.id FROM collection_items ci2 JOIN receivables r ON r.id = ci2.receivable_id WHERE r.balance > 0 AND r.due_date < current_date ORDER BY r.due_date DESC LIMIT 1);
  END IF;

  -- H. payment vouchers (insurer remittance with cheques in each state, supplier voucher), manual JVs, petty cash
  IF NOT EXISTS (SELECT 1 FROM invoice_lists WHERE source = 'seed') THEN
    FOR p IN SELECT r.id AS rcv_id, r.amount, r.commission_amount, pl.id, pl.policy_number, pl.client_id, c.client_code, c.display_name, ic.id AS ic_id, ic.name AS ic_name,
               row_number() OVER (ORDER BY r.due_date DESC, r.id) AS rn
             FROM receivables r JOIN policies pl ON pl.id = r.policy_id JOIN clients c ON c.id = r.client_id LEFT JOIN insurance_companies ic ON ic.id = pl.insurance_company_id
             WHERE r.status = 'paid' ORDER BY r.due_date DESC, r.id LIMIT 5 LOOP
      v_pvno := next_number('voucher', pg_temp.fin_setting('numbering.voucher.prefix', 'PV'));
      INSERT INTO disbursements(voucher_number, payee_type, payee_id, payee_name, amount, gross_amount, payment_mode, status, voucher_date, transaction_number, transaction_code, transaction_description,
        criteria, customer_code, client_id, insurance_company_id, insurer_name, policy_id, policy_number, instrument_currency, source, created_by, department_code, branch_code)
      VALUES (v_pvno, 'Insurer', p.ic_id::text, COALESCE(p.ic_name, 'Insurer'), p.amount - p.commission_amount, p.amount, 'check',
        CASE p.rn WHEN 1 THEN 'paid' WHEN 2 THEN 'approved' ELSE 'draft' END, current_date - (6 - p.rn)::int,
        next_number('disbursement-txn', pg_temp.fin_setting('numbering.disbursement_txn.prefix', 'DT')), 'REMT', 'Premium remittance – ' || p.policy_number,
        'Specific', p.client_code, p.client_id, p.ic_id, p.ic_name, p.id, p.policy_number, 'PHP', 'insurer-remittance', v_admin, 'FI', 'PHP')
      RETURNING id INTO v_pv;
      INSERT INTO invoice_lists(invoice_number, disbursement_id, customer_code, client_id, insurance_company_id, policy_id, policy_number, payee_type, payables, outstanding, lc_amount, comsub,
        bal_amount, total_amount, bank_code, bank_amount, is_invoice_paid, status, source, created_by)
      VALUES (next_number('invoice-list', pg_temp.fin_setting('numbering.invoice_list.prefix', 'IL')), CASE WHEN p.rn <= 4 THEN v_pv END, p.client_code, p.client_id, p.ic_id, p.id, p.policy_number, 'Insurer',
        p.amount, p.amount - p.commission_amount, p.amount, p.commission_amount, p.amount - p.commission_amount, p.amount - p.commission_amount, 'BDO', p.amount, true,
        CASE WHEN p.rn <= 2 THEN 'paid' WHEN p.rn = 3 THEN 'in-voucher' ELSE 'open' END, 'seed', v_admin)
      RETURNING id INTO v_cm;
      UPDATE receipt_applications SET remitted_invoice_id = v_cm WHERE receivable_id = p.rcv_id;
      IF p.rn <= 3 THEN
        v_jv := NULL;
        IF p.rn <= 2 THEN
          v_jv := pg_temp.fin_jv(current_date - (6 - p.rn)::int, 'Cheque ' || lpad((100 + p.rn)::text, 6, '0') || ' – ' || COALESCE(p.ic_name, 'Insurer'), 'disbursement', 'REMITTANCE', v_pvno, 'Disbursement', v_pv,
            p.client_id, p.id, p.policy_number, NULL, jsonb_build_array(jsonb_build_object('a','2201001','d',p.amount - p.commission_amount,'m','Payable settled (Insurer)'),
              jsonb_build_object('a','1102001','c',p.amount - p.commission_amount,'m','Cheque ' || lpad((100 + p.rn)::text, 6, '0'))), v_admin);
          UPDATE disbursements SET journal_id = v_jv, approved_by = v_admin, approved_at = now(), paid_at = CASE WHEN p.rn = 1 THEN now() END WHERE id = v_pv;
        END IF;
        INSERT INTO checkbooks(invoice_list_id, disbursement_id, customer_code, customer_name, main_account, instrument_book_id, instrument_no, instrument_date, totale_amount, status, journal_id,
          created_by, approved_by, approved_at, printed_by, printed_at)
        VALUES (v_cm, v_pv, p.client_code, p.display_name, '1102001', 'BDO-CB-2026-01', lpad((100 + p.rn)::text, 6, '0'), current_date - (6 - p.rn)::int, p.amount - p.commission_amount,
          CASE p.rn WHEN 1 THEN 'Printed' WHEN 2 THEN 'Approved' ELSE 'Pending' END, v_jv, v_admin, CASE WHEN p.rn <= 2 THEN v_admin END, CASE WHEN p.rn <= 2 THEN now() END,
          CASE WHEN p.rn = 1 THEN v_admin END, CASE WHEN p.rn = 1 THEN now() END);
      END IF;
    END LOOP;
    INSERT INTO disbursements(voucher_number, payee_type, payee_name, amount, payment_mode, status, voucher_date, transaction_number, transaction_code, transaction_description, criteria,
      instrument_currency, source, remarks, created_by, department_code, branch_code)
    VALUES (next_number('voucher', pg_temp.fin_setting('numbering.voucher.prefix', 'PV')), 'Supplier', 'LBC Express Inc.', 3850, 'check', 'draft', current_date - 1,
      next_number('disbursement-txn', pg_temp.fin_setting('numbering.disbursement_txn.prefix', 'DT')), 'SUPP', 'Courier services – September', 'Specific', 'PHP', 'manual', 'Monthly courier billing', v_admin, 'FI', 'PHP');

    PERFORM pg_temp.fin_jv(current_date - 6, 'Accrual of statutory audit fee FY2026', 'manual', 'JOURNAL_VOUCHER', 'JV01', 'JournalVoucher', NULL, NULL, NULL, NULL, NULL,
      '[{"a":"4401003001","d":85000,"m":"Statutory audit FY2026"},{"a":"2206001","c":85000,"m":"Accrued audit fee – external auditor"}]'::jsonb, v_admin);
    PERFORM pg_temp.fin_jv(current_date - 4, 'Reclass of advertising to consultancy', 'manual', 'JOURNAL_VOUCHER', 'JV03', 'JournalVoucher', NULL, NULL, NULL, NULL, NULL,
      '[{"a":"4401006","d":12000,"m":"Brand consultancy"},{"a":"4401002","c":12000,"m":"Reclass from advertising"}]'::jsonb, v_admin);
    PERFORM pg_temp.fin_jv(current_date - 1, 'Bank charges – current month', 'manual', 'JOURNAL_VOUCHER', 'JV02', 'JournalVoucher', NULL, NULL, NULL, NULL, NULL,
      '[{"a":"4401004","d":1250,"m":"BDO service charges"},{"a":"1102001","c":1250,"m":"Debit memo"}]'::jsonb, v_admin, 'for-approval');

    IF NOT EXISTS (SELECT 1 FROM petty_cash_funds WHERE code = 'PCF-MKT') THEN
      INSERT INTO petty_cash_funds(code, description, transaction_number, fund_size, max_limit, minimum_cashbox, available_cash, bank_code, main_account, currency, branch_code, department_code, created_by)
      VALUES ('PCF-MKT', 'Makati head office petty cash', next_number('petty-cash', pg_temp.fin_setting('numbering.petty_cash.prefix', 'PC')), 20000, 5000, 3000, 20000, 'BDO', '1103001', 'PHP', 'PHP', 'FI', v_admin),
             ('PCF-CEB', 'Cebu branch petty cash', next_number('petty-cash', pg_temp.fin_setting('numbering.petty_cash.prefix', 'PC')), 10000, 3000, 2000, 10000, 'BPI', '1103001', 'PHP', 'CEB', 'SL', v_admin);
      UPDATE petty_cash_funds SET journal_id = pg_temp.fin_jv(current_date - 20, 'Petty cash fund ' || code || ' established', 'petty-cash', 'PETTY_CASH_FUND', transaction_number, 'PettyCash', id, NULL, NULL, NULL, NULL,
        jsonb_build_array(jsonb_build_object('a','1103001','d',fund_size,'m','Fund ' || code), jsonb_build_object('a','1102001','c',fund_size,'m','Cheque to custodian')), v_admin);
      INSERT INTO petty_cash_requests(request_number, fund_id, requester_name, request_date, department_code, purpose, total_amount, status, approved_by, approved_at, created_by)
      SELECT next_number('petty-cash-request', pg_temp.fin_setting('numbering.petty_cash_request.prefix', 'PCR')), id, 'Ana Reyes', current_date - 4, 'FI', 'Courier and office supplies', 1850, 'disbursed', v_admin, now() - interval '3 days', v_admin
      FROM petty_cash_funds WHERE code = 'PCF-MKT';
      INSERT INTO petty_cash_request_lines(request_id, narration, amount, expense_account) SELECT id, 'LBC courier – policy documents', 650, '4401007' FROM petty_cash_requests WHERE purpose = 'Courier and office supplies';
      INSERT INTO petty_cash_request_lines(request_id, narration, amount, expense_account) SELECT id, 'Bond paper and toner', 1200, '4401008' FROM petty_cash_requests WHERE purpose = 'Courier and office supplies';
      INSERT INTO petty_cash_requests(request_number, fund_id, requester_name, request_date, department_code, purpose, total_amount, status, created_by)
      SELECT next_number('petty-cash-request', pg_temp.fin_setting('numbering.petty_cash_request.prefix', 'PCR')), id, 'Mark Tolentino', current_date, 'SL', 'Client meeting snacks', 950, 'submitted', v_admin FROM petty_cash_funds WHERE code = 'PCF-MKT';
      INSERT INTO petty_cash_request_lines(request_id, narration, amount, expense_account) SELECT id, 'Meeting snacks – Ayala client visit', 950, '4401001' FROM petty_cash_requests WHERE purpose = 'Client meeting snacks';
      INSERT INTO petty_cash_disbursements(transaction_number, transaction_code, fund_id, request_id, criteria, expense_account, amount, vat, wht, net_amount, vat_account, wht_account, remarks, disbursement_date, created_by)
      SELECT next_number('petty-cash', pg_temp.fin_setting('numbering.petty_cash.prefix', 'PC')), 'PCD', f.id, r.id, 'Specific', '4401008', 1850, 198.21, 0, 1850, '1301001', '2204001', 'Courier and office supplies', current_date - 3, v_admin
      FROM petty_cash_funds f JOIN petty_cash_requests r ON r.fund_id = f.id AND r.purpose = 'Courier and office supplies' WHERE f.code = 'PCF-MKT';
      UPDATE petty_cash_disbursements d SET journal_id = pg_temp.fin_jv(current_date - 3, 'Petty cash PCF-MKT: Courier and office supplies', 'petty-cash', 'PETTY_CASH_DISBURSEMENT', d.transaction_number, 'PettyCash', d.id,
        NULL, NULL, NULL, NULL, '[{"a":"4401008","d":1651.79,"m":"Courier and office supplies"},{"a":"1301001","d":198.21,"m":"Input VAT"},{"a":"1103001","c":1850,"m":"Paid from PCF-MKT"}]'::jsonb, v_admin)
      WHERE d.remarks = 'Courier and office supplies';
      UPDATE petty_cash_funds SET available_cash = 18150 WHERE code = 'PCF-MKT';
    END IF;
  END IF;
END $$;
