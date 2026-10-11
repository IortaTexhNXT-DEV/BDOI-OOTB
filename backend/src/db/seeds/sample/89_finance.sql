-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Sample ledger built on the sample policies (receivables, receipts, post-dated cheques, collections, comsub of the
-- referrers, disbursements, petty cash, journals). Every journal balances and posts to the accounts the configuration
-- names (accounting.account.*, the cash account per payment mode and the payable account per payee), so the sample
-- follows the TISPH chart of accounts. Idempotent: sample transactions only touch policies that have no receivable yet.

-- ---------- helpers (session-local): balanced journal, booking of a receivable, payment application ----------
CREATE OR REPLACE FUNCTION pg_temp.fin_setting(p_key text, p_default text) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = p_key), p_default) $$;
-- GL account of a role (accounting.account.<role>)
CREATE OR REPLACE FUNCTION pg_temp.fin_acct(p_role text) RETURNS text LANGUAGE sql AS $$
  SELECT value #>> '{}' FROM app_settings WHERE key = format('accounting.account.%s', p_role) $$;
-- cash account of a payment mode, else cash in bank
CREATE OR REPLACE FUNCTION pg_temp.fin_cash(p_mode text) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE((SELECT value->>p_mode FROM app_settings WHERE key = 'accounting.cash_account_by_payment_mode'), pg_temp.fin_acct('cash_in_bank')) $$;
-- payable account of a payee type, else due to insurer
CREATE OR REPLACE FUNCTION pg_temp.fin_payable(p_payee text) RETURNS text LANGUAGE sql AS $$
  SELECT COALESCE((SELECT value->>p_payee FROM app_settings WHERE key = 'accounting.payable_account_by_payee'), pg_temp.fin_acct('due_to_insurer')) $$;
-- rate (fraction) of a tax code
CREATE OR REPLACE FUNCTION pg_temp.fin_tax_rate(p_code text) RETURNS numeric LANGUAGE sql AS $$
  SELECT COALESCE((SELECT rate / 100 FROM tax_codes WHERE code = p_code AND active), 0) $$;

CREATE OR REPLACE FUNCTION pg_temp.fin_jv(p_date date, p_desc text, p_source text, p_entry text, p_txn text, p_ref_type text, p_ref_id text,
  p_client text, p_policy text, p_polno text, p_due date, p_lines jsonb, p_user text, p_status text DEFAULT 'posted') RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_id text; v_d numeric; v_c numeric; l jsonb; n int := 0;
BEGIN
  SELECT COALESCE(sum((x->>'d')::numeric),0), COALESCE(sum((x->>'c')::numeric),0) INTO v_d, v_c FROM jsonb_array_elements(p_lines) x;
  IF v_d <> v_c THEN RAISE EXCEPTION 'sample journal % does not balance: debit % credit %', p_desc, v_d, v_c; END IF;
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

-- Booking journal of a bill, as the broker-billed posting rule makes it: Dr premium receivable / Cr premium due to the
-- insurer, Cr the premium taxes in their payable accounts, Cr brokerage commission, Cr output VAT on the commission and
-- Dr creditable withholding tax on it (accounting.broker_billed_commission_vat / _ewt).
CREATE OR REPLACE FUNCTION pg_temp.fin_book(p_rcv text, p_user text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r record; v_comm numeric; v_cvat numeric; v_cewt numeric; v_tax numeric; v_jv text;
BEGIN
  SELECT rv.*, p.policy_number, p.commission_amount AS pol_comm, p.premium_total, p.net_premium AS pol_net, p.details, ic.commission_rate, ic.name AS ic_name INTO r
  FROM receivables rv JOIN policies p ON p.id = rv.policy_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE rv.id = p_rcv;
  IF r.id IS NULL OR r.booking_jv_id IS NOT NULL THEN RETURN r.booking_jv_id; END IF;
  v_comm := CASE WHEN r.commission_amount > 0 THEN r.commission_amount WHEN abs(r.premium_total - r.amount) < 0.01 THEN r.pol_comm
                 ELSE round(COALESCE(NULLIF(r.net_premium, 0), r.pol_net) * COALESCE(r.commission_rate, (pg_temp.fin_setting('commission.default_rate','0.15'))::numeric), 2) END;
  v_comm := LEAST(v_comm, r.amount);
  v_cvat := CASE WHEN pg_temp.fin_setting('accounting.broker_billed_commission_vat', 'true') <> 'false'
                 THEN round(v_comm * pg_temp.fin_tax_rate(pg_temp.fin_setting('tax.commission_vat_code', 'VAT12-OUT')), 2) ELSE 0 END;
  v_cewt := CASE WHEN pg_temp.fin_setting('accounting.broker_billed_commission_ewt', 'true') <> 'false'
                 THEN round(v_comm * pg_temp.fin_tax_rate(pg_temp.fin_setting('tax.commission_ewt_code', 'WC139')), 2) ELSE 0 END;
  -- premium taxes go to their own accounts only while they fit in the amount due to the insurer
  v_tax := CASE WHEN COALESCE(r.vat, 0) + COALESCE(r.dst, 0) + COALESCE(r.lgt, 0) <= r.amount - v_comm - v_cvat THEN COALESCE(r.vat, 0) + COALESCE(r.dst, 0) + COALESCE(r.lgt, 0) ELSE 0 END;
  v_jv := pg_temp.fin_jv(LEAST(r.created_at::date, current_date), 'Premium billed – ' || r.policy_number || ' (' || r.bill_number || ')', 'booking',
    CASE r.source WHEN 'renewal' THEN 'RENEWAL' WHEN 'endorsement' THEN 'ENDORSEMENT' ELSE 'NEW_BUSINESS' END, r.bill_number, 'Policy', r.policy_id,
    r.client_id, r.policy_id, r.policy_number, r.due_date, jsonb_build_array(
      jsonb_build_object('a',pg_temp.fin_acct('premium_receivable'),'d',r.amount,'m','Premium receivable ' || r.bill_number),
      jsonb_build_object('a',pg_temp.fin_acct('due_to_insurer'),'c',r.amount - v_comm - v_cvat + v_cewt - v_tax,'m','Premium due to ' || COALESCE(r.ic_name,'insurer')),
      jsonb_build_object('a',pg_temp.fin_acct('premium_vat_payable'),'c',CASE WHEN v_tax > 0 THEN COALESCE(r.vat, 0) ELSE 0 END,'m','VAT on premium'),
      jsonb_build_object('a',pg_temp.fin_acct('premium_dst_payable'),'c',CASE WHEN v_tax > 0 THEN COALESCE(r.dst, 0) ELSE 0 END,'m','DST on premium'),
      jsonb_build_object('a',pg_temp.fin_acct('premium_lgt_payable'),'c',CASE WHEN v_tax > 0 THEN COALESCE(r.lgt, 0) ELSE 0 END,'m','LGT on premium'),
      jsonb_build_object('a',pg_temp.fin_acct('commission_income'),'c',v_comm,'m','Brokerage commission'),
      jsonb_build_object('a',pg_temp.fin_acct('output_vat'),'c',v_cvat,'m','Output VAT on commission'),
      jsonb_build_object('a',pg_temp.fin_acct('creditable_wht'),'d',v_cewt,'m','EWT withheld by the insurer on commission')), p_user);
  UPDATE receivables SET booking_jv_id = v_jv, commission_amount = v_comm, commission_vat = v_cvat, commission_ewt = v_cewt WHERE id = p_rcv;
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
      jsonb_build_object('a', pg_temp.fin_cash(p_mode), 'd', p_amount, 'm', COALESCE(v_or, 'Premium collection')),
      jsonb_build_object('a', pg_temp.fin_acct('premium_receivable'), 'c', p_amount, 'm', 'Settles ' || r.bill_number)), p_user);
  INSERT INTO receipt_applications(receipt_id, receipt_line_id, receivable_id, amount, journal_id, payment_mode, reference_no, applied_by, applied_at)
  VALUES (p_receipt, p_line, p_rcv, p_amount, v_jv, p_mode, v_or, p_user, p_date::timestamptz);
  RETURN v_jv;
END $$;

-- Official receipt with one line for an amount already reflected in the receivable balance
CREATE OR REPLACE FUNCTION pg_temp.fin_receipt(p_rcv text, p_amount numeric, p_date date, p_mode text, p_user text) RETURNS text LANGUAGE plpgsql AS $$
DECLARE r record; v_or text; v_line text;
BEGIN
  SELECT rv.*, p.policy_number, c.client_code, c.display_name INTO r FROM receivables rv JOIN policies p ON p.id = rv.policy_id LEFT JOIN clients c ON c.id = rv.client_id WHERE rv.id = p_rcv;
  INSERT INTO receipts(receipt_number, receivable_id, policy_id, client_id, amount, payment_mode, reference_no, received_date, status, remarks, created_by, receipt_type, receipt_status,
    transaction_code, transaction_number, customer_code, customer_name, currency_code, policy_number, source, bank_account_code)
  VALUES (next_number('receipt', pg_temp.fin_setting('numbering.receipt.prefix', 'OR')), p_rcv, r.policy_id, r.client_id, p_amount, p_mode,
    CASE p_mode WHEN 'check' THEN 'MBTC ' || lpad((abs(hashtext(p_rcv)) % 900000 + 100000)::text, 6, '0') WHEN 'gcash' THEN 'GC-' || lpad((abs(hashtext(p_rcv)) % 90000000)::text, 8, '0')
                WHEN 'bank-transfer' THEN 'IBFT-' || lpad((abs(hashtext(p_rcv)) % 9000000)::text, 7, '0') END,
    p_date, 'posted', 'Payment receipt for policy ' || r.policy_number, p_user, 'Payment', CASE WHEN p_amount >= r.amount THEN 'Converted' ELSE 'Draft' END, 'PAYMENT',
    next_number('receipt-txn', pg_temp.fin_setting('numbering.receipt_txn.prefix', 'RT')), r.client_code, r.display_name, r.currency, r.policy_number, 'api',
    CASE WHEN p_mode IN ('check', 'bank-transfer') THEN 'ACC-MBT-001' END)
  RETURNING id INTO v_or;
  INSERT INTO receipt_lines(receipt_id, line_no, policy_id, policy_number, net_premium, paid, un_paid, vat, dst, lgt, lc_amount, status, applied_amount)
  VALUES (v_or, 1, r.policy_id, r.policy_number, COALESCE(NULLIF(r.net_premium, 0), r.amount), p_amount, GREATEST(r.amount - p_amount, 0),
    r.vat, r.dst, r.lgt, r.amount, CASE WHEN p_amount >= r.amount THEN 'Paid' ELSE 'Pending' END, p_amount)
  RETURNING id INTO v_line;
  PERFORM pg_temp.fin_pay(p_rcv, v_or, v_line, p_amount, p_date, p_mode, p_user);
  RETURN v_or;
END $$;

DO $$
DECLARE
  v_admin text := (SELECT id FROM users WHERE username = 'BrokerVerse');
  v_first text[] := ARRAY['Maricel','Jose','Ana','Paolo','Kristine','Miguel','Rhea','Carlo','Joanna','Ramil','Grace','Dennis'];
  v_last text[] := ARRAY['Santos','Reyes','Cruz','Bautista','Ocampo','Garcia','Mendoza','Torres','Aquino','Ramos','Castillo','Navarro'];
  v_prod text[] := ARRAY['MOTOR','MOTOR','PA','MOTOR','CL-COMP','MOTOR','GPA','MOTOR','TRAVEL','MOTOR','PA','MOTOR'];
  v_ins text[] := ARRAY['PIONEER','MAAGAP','AXA','STRONGHOLD','MALAYAN','STANDARD'];
  v_net numeric[] := ARRAY[29200,23460,1500,40125,6150,26770,17500,22100,2500,31480,3000,25210];
  v_modes text[] := ARRAY['bank-transfer','gcash','check','cash'];
  i int; v_cl text; v_ic record; v_pr record; v_gross numeric; v_due date; v_rcv text; v_paid numeric; p record; e jsonb; pos int; v_ref record;
  v_pct numeric; v_comsub numeric; v_whtp numeric; v_wht numeric; v_status text; v_cm text; v_pv text; v_pvno text; v_jv text; v_net0 numeric; v_brk numeric; v_cycle date;
BEGIN
  -- A. top up sample clients / policies when the policy samples have not seeded enough
  IF (SELECT count(*) FROM policies) < 12 THEN
    FOR i IN 1..12 LOOP
      v_cl := 'cl_fin_' || lpad(i::text, 2, '0');
      SELECT * INTO v_ic FROM insurance_companies WHERE code = v_ins[1 + (i % 6)];
      SELECT * INTO v_pr FROM products WHERE code = v_prod[i];
      INSERT INTO clients(id, client_code, client_type, first_name, last_name, display_name, email, phone, city, country, status, owner_user_id, created_by)
      VALUES (v_cl, 'CL-2026-F' || lpad(i::text, 4, '0'), 'individual', v_first[i], v_last[i], v_first[i] || ' ' || v_last[i], lower(v_first[i] || '.' || v_last[i]) || '@example.ph',
        '+63917400' || lpad((1000 + i)::text, 4, '0'), (ARRAY['Makati','Quezon City','Pasig','Cebu City','Davao City','Taguig'])[1 + (i % 6)], 'Philippines', 'active', v_admin, 'seed')
      ON CONFLICT (id) DO NOTHING;
      v_gross := (pg_temp.smp_price(v_prod[i], v_net[i])->>'gross')::numeric;
      INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, net_premium, premium_total,
        commission_amount, currency, details, created_by)
      VALUES ('pol_fin_' || lpad(i::text, 2, '0'), 'POL-2026-F' || lpad(i::text, 4, '0'), v_cl, v_pr.id, v_ic.id, v_admin, 'active', current_date - (160 - i * 9), current_date - (160 - i * 9) + 365,
        v_net[i] * 40, v_net[i], v_gross, round(v_net[i] * pg_temp.smp_comm_rate(v_ic.code, v_pr.code), 2), 'PHP',
        jsonb_build_object('netPremium', v_net[i], 'valueAddedTax', pg_temp.smp_tax(v_net[i], v_pr.code, 'vat'), 'documentaryStampTax', pg_temp.smp_tax(v_net[i], v_pr.code, 'dst'),
          'localGovernmentTax', pg_temp.smp_tax(v_net[i], v_pr.code, 'lgt')), 'seed')
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
      COALESCE((p.details->>'netPremium')::numeric, p.net_premium, 0), COALESCE((p.details->>'valueAddedTax')::numeric, 0), COALESCE((p.details->>'documentaryStampTax')::numeric, 0),
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
    RETURNING id INTO v_cm;
    UPDATE receipts SET customer_code = COALESCE(customer_code, p.client_code), customer_name = COALESCE(customer_name, p.display_name), policy_number = COALESCE(policy_number, p.pol_no),
      transaction_code = COALESCE(transaction_code, 'PAYMENT'), transaction_number = COALESCE(transaction_number, next_number('receipt-txn', pg_temp.fin_setting('numbering.receipt_txn.prefix', 'RT'))),
      bank_account_code = COALESCE(bank_account_code, CASE WHEN p.payment_mode IN ('check', 'bank-transfer') THEN 'ACC-MBT-001' END),
      receipt_status = CASE WHEN status = 'cancelled' THEN 'Cancelled' WHEN p.amount >= COALESCE(p.rcv_amount, p.amount) THEN 'Converted' ELSE 'Draft' END WHERE id = p.id;
    IF p.receivable_id IS NOT NULL AND p.status <> 'cancelled' AND NOT EXISTS (SELECT 1 FROM receipt_applications a WHERE a.receipt_id = p.id) THEN
      PERFORM pg_temp.fin_pay(p.receivable_id, p.id, v_cm, p.amount, p.received_date, p.payment_mode, v_admin);
    END IF;
  END LOOP;

  -- E. receivables shown as (partly) paid without a recorded payment: raise the official receipt (a cheque for the fleet accounts)
  FOR p IN SELECT rv.id, rv.amount - rv.balance - COALESCE((SELECT sum(a.amount) FROM receipt_applications a WHERE a.receivable_id = rv.id AND a.status = 'applied'), 0) AS gap,
             rv.due_date, rv.created_at, c.client_type, row_number() OVER (ORDER BY rv.created_at, rv.id) AS rn
           FROM receivables rv LEFT JOIN clients c ON c.id = rv.client_id
           WHERE rv.amount - rv.balance > COALESCE((SELECT sum(a.amount) FROM receipt_applications a WHERE a.receivable_id = rv.id AND a.status = 'applied'), 0) LOOP
    PERFORM pg_temp.fin_receipt(p.id, p.gap, LEAST(GREATEST(p.created_at::date + 3 + (p.rn % 5)::int, p.created_at::date), current_date),
      CASE WHEN p.client_type = 'corporate' THEN 'check' ELSE v_modes[1 + (p.rn % 4)] END, v_admin);
  END LOOP;

  -- F. legacy agent commission lines (no referrer): give each agent user a referrer account and complete the line
  INSERT INTO commission_referrers(id, name, referrer_type, level, user_id, email, status)
  SELECT DISTINCT 'ref-' || regexp_replace(lower(u.username), '[^a-z0-9]+', '-', 'g'), u.display_name, 'Agent', 'L1', u.id, u.email, 'Active'
  FROM commissions cm JOIN users u ON u.id = cm.agent_user_id WHERE cm.referrer_id IS NULL
    AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id WHERE ur.user_id = u.id
      AND ro.code IN (SELECT jsonb_array_elements_text(COALESCE((SELECT value FROM app_settings WHERE key = 'commission.eligible_roles'), '["sales"]'::jsonb))))
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

  -- G. comsub of the referrers named on the policies (agents with their sub-agents, the dealers' referral accounts):
  -- lines in every lifecycle state, with the accrual, payout and clawback journals
  i := 0;
  FOR p IN SELECT pl.*, ic.short_name AS ic_short, ic.commission_rate, pr.name AS product_name, rv.balance, rv.id AS rcv_id
           FROM policies pl JOIN receivables rv ON rv.policy_id = pl.id LEFT JOIN insurance_companies ic ON ic.id = pl.insurance_company_id LEFT JOIN products pr ON pr.id = pl.product_id
           WHERE jsonb_typeof(pl.details->'commissionDetails'->'primary') = 'object' AND pl.details->'commissionDetails'->'primary'->>'referrerId' <> 'direct'
             AND NOT EXISTS (SELECT 1 FROM commissions cm WHERE cm.policy_id = pl.id AND cm.chain_position >= 0)
           ORDER BY (rv.balance = 0) DESC, pl.id LOOP
    i := i + 1;
    v_net0 := COALESCE(NULLIF(p.net_premium, 0), round(p.premium_total / 1.2525, 2));
    v_brk := round(COALESCE(NULLIF(p.commission_amount, 0) / NULLIF(v_net0, 0), p.commission_rate, 0.15) * 100, 2);
    UPDATE policies SET details = jsonb_set(details, '{commissionDetails}', details->'commissionDetails' || jsonb_build_object('brokeragePct', v_brk, 'productLabel', p.product_name))
    WHERE id = p.id AND NOT (details->'commissionDetails' ? 'brokeragePct');
    pos := 0;
    FOR e IN SELECT * FROM jsonb_array_elements(jsonb_build_array(p.details->'commissionDetails'->'primary') || COALESCE(p.details->'commissionDetails'->'chain', '[]'::jsonb)) LOOP
      SELECT * INTO v_ref FROM commission_referrers WHERE id = e->>'referrerId';
      CONTINUE WHEN v_ref.id IS NULL;
      v_pct := COALESCE((e->>'comsubPct')::numeric, CASE e->>'level' WHEN 'L2' THEN 5 ELSE 8 END);
      v_comsub := round(v_net0 * v_pct / 100, 2);
      v_whtp := CASE WHEN v_ref.referrer_type = 'External' THEN 10 ELSE 5 END;
      v_wht := CASE WHEN v_ref.wht_applicable THEN round(v_comsub * v_whtp / 100, 2) ELSE 0 END;
      v_status := CASE WHEN p.balance > 0 THEN 'Accrued' ELSE (ARRAY['Paid','Approved','Paid','Eligible','Reversed','Approved','Paid','Eligible'])[1 + ((i - 1) % 8)] END;
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
        NULL, p.id, p.policy_number, NULL, jsonb_build_array(jsonb_build_object('a',pg_temp.fin_acct('commission_expense'),'d',v_comsub,'m','Comsub expense'),
          jsonb_build_object('a',pg_temp.fin_acct('commission_payable'),'c',v_comsub,'m','Payable to ' || v_ref.name)), v_admin);
      UPDATE commissions SET accrual_jv_id = v_jv WHERE id = v_cm;
      CONTINUE WHEN v_status = 'Approved';
      v_pvno := next_number('voucher', pg_temp.fin_setting('numbering.voucher.prefix', 'PV'));
      INSERT INTO disbursements(voucher_number, payee_type, payee_id, payee_name, amount, gross_amount, wht_amount, payment_mode, status, voucher_date, transaction_number, transaction_code,
        transaction_description, criteria, customer_code, referrer_id, referrer_name, instrument_currency, source, approved_by, approved_at, paid_at, created_by, department_code, branch_code)
      VALUES (v_pvno, 'Agent/Referrer', v_ref.id, v_ref.name, v_comsub - v_wht, v_comsub, v_wht, 'bank-transfer', 'paid', current_date - 15,
        next_number('disbursement-txn', pg_temp.fin_setting('numbering.disbursement_txn.prefix', 'DT')), 'COMSUB', 'Comsub payout – ' || v_ref.name, 'Specific', v_ref.id, v_ref.id, v_ref.name,
        'PHP', 'agent-payout', v_admin, now() - interval '15 days', now() - interval '15 days', v_admin, '30', 'HO')
      RETURNING id INTO v_pv;
      v_jv := pg_temp.fin_jv(current_date - 15, 'Comsub payout ' || v_pvno || ' – ' || v_ref.name, 'disbursement', 'COMMISSION_PAYMENT', v_pvno, 'Disbursement', v_pv, NULL, NULL, NULL, NULL,
        jsonb_build_array(jsonb_build_object('a',pg_temp.fin_acct('commission_payable'),'d',v_comsub,'m','Comsub payable settled'),
          jsonb_build_object('a',pg_temp.fin_cash('bank-transfer'),'c',v_comsub - v_wht,'m','Paid to ' || v_ref.name),
          jsonb_build_object('a',pg_temp.fin_acct('wht_payable'),'c',v_wht,'m','Withholding tax on commission')), v_admin);
      UPDATE disbursements SET journal_id = v_jv WHERE id = v_pv;
      UPDATE commissions SET paid_at = now() - interval '15 days', paid_by = v_admin, disbursement_id = v_pv, voucher_no = v_pvno, payment_jv_id = v_jv WHERE id = v_cm;
      IF v_status = 'Reversed' THEN
        PERFORM pg_temp.fin_jv(current_date - 2, 'Comsub clawback – ' || v_ref.name || ' – ' || p.policy_number, 'commission', 'COMMISSION_CLAWBACK', p.policy_number, 'Commission', v_cm, NULL, p.id, p.policy_number, NULL,
          jsonb_build_array(jsonb_build_object('a',pg_temp.fin_acct('agent_receivable'),'d',v_comsub,'m','Clawback receivable from referrer'),
            jsonb_build_object('a',pg_temp.fin_acct('commission_expense'),'c',v_comsub,'m','Comsub clawback')), v_admin);
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
    UPDATE collection_items ci SET commitment_date = current_date + 10, commitment_reason = 'Client will pay after payday', last_follow_up_at = now() - interval '3 days'
    WHERE ci.id = (SELECT ci2.id FROM collection_items ci2 JOIN receivables r ON r.id = ci2.receivable_id WHERE r.balance > 0 AND r.due_date < current_date ORDER BY r.due_date DESC LIMIT 1);
  END IF;

  -- I. post-dated cheques: the fleet account pays its premium in two cheques (the first cleared, the second on hand)
  -- and a client issued a cheque dated next week for the whole premium
  IF NOT EXISTS (SELECT 1 FROM post_dated_cheques WHERE remarks LIKE 'Sample:%') THEN
    INSERT INTO post_dated_cheques(pdc_number, client_id, policy_id, receivable_id, bank_id, drawee_bank, branch, cheque_number, cheque_date, amount, received_date, storage_location,
      status, deposit_account, deposited_on, deposited_by, receipt_id, cleared_on, remarks, created_by, updated_by)
    SELECT next_number('pdc', pg_temp.fin_setting('numbering.pdc.prefix', 'PDC')), rv.client_id, rv.policy_id, rv.id, b.id, b.name, v.branch, v.chq, v.chq_date, v.amount,
      rv.created_at::date, 'Finance vault, drawer 2', v.status, CASE WHEN v.status = 'cleared' THEN 'ACC-MBT-001' END, CASE WHEN v.status = 'cleared' THEN v.chq_date END,
      CASE WHEN v.status = 'cleared' THEN v_admin END,
      CASE WHEN v.status = 'cleared' THEN (SELECT a.receipt_id FROM receipt_applications a WHERE a.receivable_id = rv.id ORDER BY a.applied_at LIMIT 1) END,
      CASE WHEN v.status = 'cleared' THEN v.chq_date + 2 END, 'Sample: ' || v.remarks, v_admin, v_admin
    FROM (VALUES ('rcv_crs_02', 'BPI', 'Ortigas', '0004512', NULL::date, 'cleared', 1, 'first of two instalment cheques'),
                 ('rcv_crs_02', 'BPI', 'Ortigas', '0004513', current_date + 20, 'on-hand', 2, 'second instalment cheque'),
                 ('rcv_sls_07', 'MBT', 'Iloilo Iznart', '0187731', current_date + 6, 'on-hand', 0, 'full premium, cheque dated next week')) AS x(rcv, bank, branch, chq, chq_date0, status, part, remarks)
    JOIN receivables rv ON rv.id = x.rcv
    LEFT JOIN banks b ON b.code = x.bank
    CROSS JOIN LATERAL (SELECT x.branch, x.chq, x.status, x.remarks,
      COALESCE(x.chq_date0, (SELECT a.applied_at::date FROM receipt_applications a WHERE a.receivable_id = rv.id ORDER BY a.applied_at LIMIT 1), current_date - 30) AS chq_date,
      CASE x.part WHEN 0 THEN rv.balance WHEN 1 THEN rv.amount - rv.balance ELSE rv.balance END AS amount) v
    WHERE v.amount > 0;
  END IF;

  -- H. payment vouchers (insurer remittance with cheques in each state, supplier voucher), manual JVs, petty cash
  IF NOT EXISTS (SELECT 1 FROM invoice_lists WHERE source = 'seed') THEN
    FOR p IN SELECT r.id AS rcv_id, r.amount, r.commission_amount, r.commission_vat, r.commission_ewt, pl.id, pl.policy_number, pl.client_id, c.client_code, c.display_name,
               ic.id AS ic_id, ic.name AS ic_name, row_number() OVER (ORDER BY r.due_date DESC, r.id) AS rn
             FROM receivables r JOIN policies pl ON pl.id = r.policy_id JOIN clients c ON c.id = r.client_id LEFT JOIN insurance_companies ic ON ic.id = pl.insurance_company_id
             WHERE r.status = 'paid' ORDER BY r.due_date DESC, r.id LIMIT 5 LOOP
      v_net0 := p.amount - p.commission_amount - COALESCE(p.commission_vat, 0) + COALESCE(p.commission_ewt, 0);
      v_pvno := next_number('voucher', pg_temp.fin_setting('numbering.voucher.prefix', 'PV'));
      INSERT INTO disbursements(voucher_number, payee_type, payee_id, payee_name, amount, gross_amount, payment_mode, status, voucher_date, transaction_number, transaction_code, transaction_description,
        criteria, customer_code, client_id, insurance_company_id, insurer_name, policy_id, policy_number, instrument_currency, source, created_by, department_code, branch_code)
      VALUES (v_pvno, 'Insurer', p.ic_id::text, COALESCE(p.ic_name, 'Insurer'), v_net0, p.amount, 'check',
        CASE p.rn WHEN 1 THEN 'paid' WHEN 2 THEN 'approved' ELSE 'draft' END, current_date - (6 - p.rn)::int,
        next_number('disbursement-txn', pg_temp.fin_setting('numbering.disbursement_txn.prefix', 'DT')), 'REMT', 'Premium remittance – ' || p.policy_number,
        'Specific', p.client_code, p.client_id, p.ic_id, p.ic_name, p.id, p.policy_number, 'PHP', 'insurer-remittance', v_admin, '30', 'HO')
      RETURNING id INTO v_pv;
      INSERT INTO invoice_lists(invoice_number, disbursement_id, customer_code, client_id, insurance_company_id, policy_id, policy_number, payee_type, payables, outstanding, lc_amount, comsub,
        bal_amount, total_amount, bank_code, bank_amount, is_invoice_paid, status, source, created_by)
      VALUES (next_number('invoice-list', pg_temp.fin_setting('numbering.invoice_list.prefix', 'IL')), CASE WHEN p.rn <= 4 THEN v_pv END, p.client_code, p.client_id, p.ic_id, p.id, p.policy_number, 'Insurer',
        p.amount, v_net0, p.amount, p.commission_amount, v_net0, v_net0, 'MBT', p.amount, true,
        CASE WHEN p.rn = 1 THEN 'paid' WHEN p.rn <= 3 THEN 'in-voucher' ELSE 'open' END, 'seed', v_admin)
      RETURNING id INTO v_cm;
      UPDATE receipt_applications SET remitted_invoice_id = v_cm WHERE receivable_id = p.rcv_id;
      IF p.rn <= 3 THEN
        v_jv := NULL;
        IF p.rn <= 2 THEN
          v_jv := pg_temp.fin_jv(current_date - (6 - p.rn)::int, 'Cheque ' || lpad((100 + p.rn)::text, 6, '0') || ' – ' || COALESCE(p.ic_name, 'Insurer'), 'disbursement', 'REMITTANCE', v_pvno, 'Disbursement', v_pv,
            p.client_id, p.id, p.policy_number, NULL, jsonb_build_array(jsonb_build_object('a',pg_temp.fin_payable('Insurer'),'d',v_net0,'m','Payable settled (Insurer)'),
              jsonb_build_object('a',pg_temp.fin_cash('check'),'c',v_net0,'m','Cheque ' || lpad((100 + p.rn)::text, 6, '0'))), v_admin);
          UPDATE disbursements SET journal_id = v_jv, approved_by = v_admin, approved_at = now(), paid_at = CASE WHEN p.rn = 1 THEN now() END WHERE id = v_pv;
        END IF;
        INSERT INTO checkbooks(invoice_list_id, disbursement_id, customer_code, customer_name, main_account, instrument_book_id, instrument_no, instrument_date, totale_amount, status, journal_id,
          created_by, approved_by, approved_at, printed_by, printed_at)
        VALUES (v_cm, v_pv, p.client_code, p.display_name, pg_temp.fin_cash('check'), 'MBT-CB-2026-01', lpad((100 + p.rn)::text, 6, '0'), current_date - (6 - p.rn)::int, v_net0,
          CASE p.rn WHEN 1 THEN 'Printed' WHEN 2 THEN 'Approved' ELSE 'Pending' END, v_jv, v_admin, CASE WHEN p.rn <= 2 THEN v_admin END, CASE WHEN p.rn <= 2 THEN now() END,
          CASE WHEN p.rn = 1 THEN v_admin END, CASE WHEN p.rn = 1 THEN now() END);
      END IF;
    END LOOP;
    INSERT INTO disbursements(voucher_number, payee_type, payee_name, amount, payment_mode, status, voucher_date, transaction_number, transaction_code, transaction_description, criteria,
      instrument_currency, source, remarks, created_by, department_code, branch_code)
    VALUES (next_number('voucher', pg_temp.fin_setting('numbering.voucher.prefix', 'PV')), 'Supplier', 'LBC Express Inc.', 3850, 'check', 'draft', current_date - 1,
      next_number('disbursement-txn', pg_temp.fin_setting('numbering.disbursement_txn.prefix', 'DT')), 'SUPP', 'Courier of policy documents to clients – last month', 'Specific', 'PHP', 'manual',
      'Monthly courier billing', v_admin, '30', 'HO');

    PERFORM pg_temp.fin_jv(current_date - 6, 'Accrual of statutory audit fee for the fiscal year', 'manual', 'JOURNAL_VOUCHER', 'JV01', 'JournalVoucher', NULL, NULL, NULL, NULL, NULL,
      jsonb_build_array(jsonb_build_object('a','658000','d',85000,'m','Statutory audit fee'), jsonb_build_object('a',pg_temp.fin_acct('accrued_expenses'),'c',85000,'m','Accrued audit fee – external auditor')), v_admin);
    PERFORM pg_temp.fin_jv(current_date - 4, 'Reclass of courier of policy documents to client courier', 'manual', 'JOURNAL_VOUCHER', 'JV03', 'JournalVoucher', NULL, NULL, NULL, NULL, NULL,
      '[{"a":"612881","d":12000,"m":"Courier of e-policies and OR/CR to clients"},{"a":"612880","c":12000,"m":"Reclass from postage"}]'::jsonb, v_admin);
    PERFORM pg_temp.fin_jv(current_date - 1, 'Bank charges – current month', 'manual', 'JOURNAL_VOUCHER', 'JV02', 'JournalVoucher', NULL, NULL, NULL, NULL, NULL,
      jsonb_build_array(jsonb_build_object('a',pg_temp.fin_acct('bank_charges'),'d',1250,'m','Metrobank service charges'), jsonb_build_object('a',pg_temp.fin_acct('cash_in_bank'),'c',1250,'m','Debit memo')),
      v_admin, 'for-approval');

    IF NOT EXISTS (SELECT 1 FROM petty_cash_funds WHERE code = 'PCF-MKT') THEN
      INSERT INTO petty_cash_funds(code, description, transaction_number, fund_size, max_limit, minimum_cashbox, available_cash, bank_code, main_account, currency, branch_code, department_code, created_by)
      VALUES ('PCF-MKT', 'Head office petty cash (BGC)', next_number('petty-cash', pg_temp.fin_setting('numbering.petty_cash.prefix', 'PC')), 20000, 5000, 3000, 20000, 'MBT', pg_temp.fin_acct('petty_cash_fund'), 'PHP', 'HO', '50', v_admin),
             ('PCF-CEB', 'Cebu branch petty cash', next_number('petty-cash', pg_temp.fin_setting('numbering.petty_cash.prefix', 'PC')), 10000, 3000, 2000, 10000, 'MBT', pg_temp.fin_acct('petty_cash_fund'), 'PHP', 'CEB', '10', v_admin);
      UPDATE petty_cash_funds SET journal_id = pg_temp.fin_jv(current_date - 20, 'Petty cash fund ' || code || ' established', 'petty-cash', 'PETTY_CASH_FUND', transaction_number, 'PettyCash', id, NULL, NULL, NULL, NULL,
        jsonb_build_array(jsonb_build_object('a',main_account,'d',fund_size,'m','Fund ' || code), jsonb_build_object('a',pg_temp.fin_cash('check'),'c',fund_size,'m','Cheque to custodian')), v_admin)
      WHERE code IN ('PCF-MKT', 'PCF-CEB') AND journal_id IS NULL;
      INSERT INTO petty_cash_requests(request_number, fund_id, requester_name, request_date, department_code, purpose, total_amount, status, approved_by, approved_at, created_by, created_at)
      SELECT next_number('petty-cash-request', pg_temp.fin_setting('numbering.petty_cash_request.prefix', 'PCR')), id, 'Ana Reyes', current_date - 4, '20', 'Courier and office supplies', 1850, 'disbursed', v_admin, now() - interval '3 days', v_admin, now() - interval '4 days'
      FROM petty_cash_funds WHERE code = 'PCF-MKT';
      INSERT INTO petty_cash_request_lines(request_id, narration, amount, expense_account) SELECT id, 'LBC courier – e-policies to clients', 650, '612881' FROM petty_cash_requests WHERE purpose = 'Courier and office supplies';
      INSERT INTO petty_cash_request_lines(request_id, narration, amount, expense_account) SELECT id, 'Bond paper and toner', 1200, '640400' FROM petty_cash_requests WHERE purpose = 'Courier and office supplies';
      INSERT INTO petty_cash_requests(request_number, fund_id, requester_name, request_date, department_code, purpose, total_amount, status, created_by)
      SELECT next_number('petty-cash-request', pg_temp.fin_setting('numbering.petty_cash_request.prefix', 'PCR')), id, 'Mark Tolentino', current_date, '10', 'Dealer visit meals', 950, 'submitted', v_admin FROM petty_cash_funds WHERE code = 'PCF-MKT';
      INSERT INTO petty_cash_request_lines(request_id, narration, amount, expense_account) SELECT id, 'Meals – Toyota Makati sales team briefing', 950, '600562' FROM petty_cash_requests WHERE purpose = 'Dealer visit meals';
      INSERT INTO petty_cash_disbursements(transaction_number, transaction_code, fund_id, request_id, criteria, expense_account, amount, vat, wht, net_amount, vat_account, wht_account, remarks, disbursement_date, created_by, created_at)
      SELECT next_number('petty-cash', pg_temp.fin_setting('numbering.petty_cash.prefix', 'PC')), 'PCD', f.id, r.id, 'Specific', '640400', 1850, 198.21, 0, 1850, pg_temp.fin_acct('input_vat'),
        pg_temp.fin_acct('wht_payable'), 'Courier and office supplies', current_date - 3, v_admin, now() - interval '3 days'
      FROM petty_cash_funds f JOIN petty_cash_requests r ON r.fund_id = f.id AND r.purpose = 'Courier and office supplies' WHERE f.code = 'PCF-MKT';
      UPDATE petty_cash_disbursements d SET journal_id = pg_temp.fin_jv(current_date - 3, 'Petty cash PCF-MKT: Courier and office supplies', 'petty-cash', 'PETTY_CASH_DISBURSEMENT', d.transaction_number, 'PettyCash', d.id,
        NULL, NULL, NULL, NULL, jsonb_build_array(jsonb_build_object('a','612881','d',580.36,'m','LBC courier – e-policies to clients'), jsonb_build_object('a','640400','d',1071.43,'m','Bond paper and toner'),
          jsonb_build_object('a',pg_temp.fin_acct('input_vat'),'d',198.21,'m','Input VAT'), jsonb_build_object('a',pg_temp.fin_acct('petty_cash_fund'),'c',1850,'m','Paid from PCF-MKT')), v_admin)
      WHERE d.remarks = 'Courier and office supplies' AND d.journal_id IS NULL;
      UPDATE petty_cash_funds SET available_cash = 18150 WHERE code = 'PCF-MKT';
    END IF;
  END IF;
END $$;
