-- Sample agents / approvers (used by agency bills, incentives and maker-checker samples). Passwords are random and
-- unusable; administrators set real ones through Master > User. Idempotent by username.
INSERT INTO users(username, password_hash, display_name, first_name, last_name, email, employee_code, branch_code, designation, status, must_change_password, created_by)
SELECT v.u, crypt(gen_random_uuid()::text, gen_salt('bf', 8)), v.f || ' ' || v.l, v.f, v.l, v.e, v.code, v.branch, v.des, 'active', true, 'seed'
FROM (VALUES
  ('agent.jdelacruz', 'Juan', 'Dela Cruz', 'juan.delacruz@agents.example', 'AG001', 'HO', 'Senior Agent'),
  ('agent.msantos', 'Maria', 'Santos', 'maria.santos@agents.example', 'AG002', 'HO', 'Agent'),
  ('agent.preyes', 'Pedro', 'Reyes', 'pedro.reyes@agents.example', 'AG003', 'HO', 'Agent'),
  ('agent.agarcia', 'Ana', 'Garcia', 'ana.garcia@agents.example', 'AG004', 'CEB', 'Unit Manager'),
  ('agent.jmartinez', 'Jose', 'Martinez', 'jose.martinez@agents.example', 'AG005', 'DAV', 'Agent'),
  ('fin.approver', 'Ramon', 'Aquino', 'ramon.aquino@brokerverse.example', 'EMP-0004', 'HO', 'Finance Manager')
) AS v(u, f, l, e, code, branch, des)
ON CONFLICT (username) DO NOTHING;
INSERT INTO user_roles(user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.code = CASE WHEN u.username = 'fin.approver' THEN 'finance' ELSE 'agent' END
WHERE u.username IN ('agent.jdelacruz', 'agent.msantos', 'agent.preyes', 'agent.agarcia', 'agent.jmartinez', 'fin.approver')
ON CONFLICT DO NOTHING;

-- Remittances, bills, work items and approvals built from the seeded policies. Runs once (marker in remittances.data).
DO $$
DECLARE
  admin_id text := (SELECT id FROM users WHERE username = 'BrokerVerse');
  checker_id text := (SELECT id FROM users WHERE username = 'fin.approver');
  pfx text := COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'numbering.remittance.prefix'), 'REM');
  bill_pfx text := COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'numbering.remittance_bill.prefix'), 'BIL');
  cur text := COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'currency.default'), 'PHP');
  rec record;
  rid text;
  n int := 0;
  st text;
  ag record;
BEGIN
  IF EXISTS (SELECT 1 FROM remittances WHERE data->>'seed' = 'remittance-v1') OR admin_id IS NULL THEN RETURN; END IF;

  -- Direct-bill remittances: one per insurer and inception year of the policies.
  FOR rec IN
    SELECT p.insurance_company_id AS ins, to_char(p.inception_date, 'YYYY') AS yr, max(p.inception_date) AS last_date,
           count(*)::int AS cnt, sum(p.premium_total) AS gross, sum(p.commission_amount) AS comm
    FROM policies p WHERE p.insurance_company_id IS NOT NULL AND p.status IN ('active', 'expired', 'renewed', 'issued')
    GROUP BY 1, 2 ORDER BY 2, 1
  LOOP
    n := n + 1;
    st := CASE WHEN rec.yr < '2026' THEN (CASE WHEN n % 3 = 0 THEN 'approved' ELSE 'settled' END)
               ELSE (CASE n % 4 WHEN 0 THEN 'draft' WHEN 1 THEN 'for-approval' WHEN 2 THEN 'approved' ELSE 'draft' END) END;
    INSERT INTO remittances(remittance_number, insurance_company_id, kind, period, gross_premium, commission, tax, net_due, status, remarks, created_by, remittance_date, due_date,
                            policy_count, currency, submitted_by, submitted_at, approved_by, approved_at, settled_at, data, updated_by)
    VALUES (next_number('remittance', pfx), rec.ins, 'direct-bill', to_char(rec.last_date, 'YYYY-MM'), rec.gross, rec.comm, 0, rec.gross - rec.comm, st,
            'Premium remittance for ' || rec.yr || ' policies', admin_id, rec.last_date + 5, rec.last_date + 35, rec.cnt, cur,
            CASE WHEN st <> 'draft' THEN admin_id END, CASE WHEN st <> 'draft' THEN (rec.last_date + 6)::timestamptz END,
            CASE WHEN st IN ('approved', 'settled') THEN checker_id END, CASE WHEN st IN ('approved', 'settled') THEN (rec.last_date + 7)::timestamptz + interval '6 hours' END,
            CASE WHEN st = 'settled' THEN (rec.last_date + 20)::timestamptz END, '{"seed":"remittance-v1"}', admin_id)
    RETURNING id INTO rid;
    INSERT INTO remittance_lines(remittance_id, policy_id, premium, commission, net, policy_number, insured_name, product, tax, effective_date, status)
    SELECT rid, p.id, p.premium_total, p.commission_amount, p.premium_total - p.commission_amount, p.policy_number, c.display_name, initcap(pr.line), 0, p.inception_date,
           CASE WHEN st = 'settled' THEN 'Settled' ELSE 'Active' END
    FROM policies p LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE p.insurance_company_id = rec.ins AND to_char(p.inception_date, 'YYYY') = rec.yr AND p.status IN ('active', 'expired', 'renewed', 'issued');
    IF st = 'for-approval' THEN
      INSERT INTO remittance_approvals(entity, entity_id, reference_no, transaction_type, amount, description, priority, sla_hours, required_levels, initiator_id, history, created_at)
      SELECT 'remittance', r.id, r.remittance_number, 'Insurer Remittance', r.net_due, 'Remittance ' || r.remittance_number || ' (' || r.policy_count || ' policies)',
             CASE WHEN r.net_due >= 250000 THEN 'High' WHEN r.net_due >= 20000 THEN 'Normal' ELSE 'Low' END, CASE WHEN r.net_due >= 250000 THEN 12 WHEN r.net_due >= 20000 THEN 24 ELSE 48 END,
             CASE WHEN r.net_due > 1000000 THEN 3 WHEN r.net_due > 100000 THEN 2 ELSE 1 END, admin_id,
             jsonb_build_array(jsonb_build_object('action', 'Submitted', 'by', admin_id, 'at', now() - interval '1 day')), now() - interval '1 day'
      FROM remittances r WHERE r.id = rid;
    ELSIF st IN ('approved', 'settled') THEN
      INSERT INTO remittance_approvals(entity, entity_id, reference_no, transaction_type, amount, description, priority, sla_hours, initiator_id, status, action_by, action_at, remarks, history, created_at)
      SELECT 'remittance', r.id, r.remittance_number, 'Insurer Remittance', r.net_due, 'Remittance ' || r.remittance_number, 'Normal', 24, admin_id, 'Approved', checker_id, r.approved_at, 'Verified against insurer statement',
             jsonb_build_array(jsonb_build_object('action', 'Submitted', 'by', admin_id, 'at', r.submitted_at), jsonb_build_object('action', 'Approved', 'by', checker_id, 'at', r.approved_at, 'remarks', 'Verified against insurer statement', 'level', 1)),
             r.submitted_at
      FROM remittances r WHERE r.id = rid;
    END IF;
  END LOOP;

  -- Agency bills for three agents (lines reference recent policies; amounts are the agent's placements).
  n := 0;
  FOR ag IN SELECT id, employee_code, display_name FROM users WHERE username IN ('agent.jdelacruz', 'agent.msantos', 'agent.preyes') ORDER BY employee_code LOOP
    n := n + 1;
    INSERT INTO remittances(remittance_number, kind, period, gross_premium, commission, tax, net_due, status, created_by, remittance_date, due_date, policy_count, currency,
                            bill_number, agent_user_id, agency_code, agency_name, previous_balance, config_code, delivery_method, sent_at, settled_at, data, updated_by)
    SELECT next_number('remittance', pfx), 'agency-bill', '2026-08', sum(p.premium_total), sum(p.commission_amount), 0, sum(p.premium_total) - sum(p.commission_amount),
           CASE n WHEN 3 THEN 'settled' ELSE 'draft' END, admin_id, DATE '2026-09-01', DATE '2026-10-01', count(*), cur, next_number('remittance_bill', bill_pfx),
           ag.id, ag.employee_code, ag.display_name, CASE n WHEN 2 THEN 5000 ELSE 0 END, 'ABL-001', '["email"]', CASE WHEN n >= 2 THEN now() - interval '20 days' END,
           CASE n WHEN 3 THEN now() - interval '5 days' END, '{"seed":"remittance-v1"}', admin_id
    FROM (SELECT * FROM policies WHERE inception_date >= DATE '2026-04-01' ORDER BY policy_number OFFSET (n - 1) * 2 LIMIT 2) p
    RETURNING id INTO rid;
    INSERT INTO remittance_lines(remittance_id, policy_id, premium, commission, net, policy_number, insured_name, product, tax, effective_date)
    SELECT rid, p.id, p.premium_total, p.commission_amount, p.premium_total - p.commission_amount, p.policy_number, c.display_name, initcap(pr.line), 0, p.inception_date
    FROM (SELECT * FROM policies WHERE inception_date >= DATE '2026-04-01' ORDER BY policy_number OFFSET (n - 1) * 2 LIMIT 2) p
    LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN products pr ON pr.id = p.product_id;
  END LOOP;
END $$;

-- Work items for the remittance screens (settlements, adjustments, transfers, exceptions, notifications, bank lines, executions).
DO $$
DECLARE
  admin_id text := (SELECT id FROM users WHERE username = 'BrokerVerse');
  checker_id text := (SELECT id FROM users WHERE username = 'fin.approver');
  settled record;
  item_id text;
BEGIN
  IF EXISTS (SELECT 1 FROM remittance_items WHERE data->>'seed' = 'remittance-v1') OR admin_id IS NULL THEN RETURN; END IF;

  SELECT r.*, i.code AS icode, i.name AS iname INTO settled FROM remittances r JOIN insurance_companies i ON i.id = r.insurance_company_id
  WHERE r.status = 'settled' AND r.kind = 'direct-bill' ORDER BY r.remittance_date DESC LIMIT 1;
  IF settled.id IS NOT NULL THEN
    INSERT INTO remittance_items(kind, reference_no, remittance_id, insurance_company_id, amount, status, data, created_by, updated_by, approved_by, approved_at, created_at)
    SELECT 'settlement', next_number('settlement', numbering_prefix('settlement', 'SET')), settled.id, settled.insurance_company_id, settled.net_due, 'Approved',
      jsonb_build_object('seed', 'remittance-v1', 'settlementDate', settled.remittance_date + 15, 'settlementType', 'Regular', 'insurerCode', settled.icode, 'insurerName', settled.iname,
        'settlementPeriod', jsonb_build_array(settled.remittance_date - 30, settled.remittance_date), 'previousBalance', 0, 'creditNotes', 0, 'debitNotes', 0, 'otherAdjustments', 0,
        'paymentMethod', 'bank_transfer', 'bankAccount', 'ACC-MBT-001', 'paymentReference', 'PESONET-' || substr(md5(settled.id), 1, 8),
        'lineIds', (SELECT jsonb_agg(l.id) FROM remittance_lines l WHERE l.remittance_id = settled.id), 'remittanceIds', jsonb_build_array(settled.id),
        'totalPremium', settled.gross_premium, 'totalCommission', settled.commission, 'totalTax', 0, 'totalAdjustments', 0, 'netAmount', settled.net_due),
      admin_id, checker_id, checker_id, settled.settled_at - interval '1 day', settled.settled_at - interval '2 days';
  END IF;

  -- adjustments
  INSERT INTO remittance_items(kind, reference_no, amount, status, data, created_by, updated_by, approved_by, approved_at, created_at)
  VALUES
   ('adjustment', next_number('adjustment', numbering_prefix('adjustment', 'ADJ')), -5000, 'Pending Approval', '{"seed":"remittance-v1","adjustmentType":"Premium Adjustment","adjustmentCode":"ADJ-002","policyNo":"POL-2026-90002","clientName":"Malayan Insurance Co., Inc.","originalAmount":121125,"adjustmentAmount":-5000,"newAmount":116125,"reason":"Policy correction due to coverage change","description":"Removed acts of nature cover","effectiveDate":"2026-09-26","requestedBy":"BrokerVerse","approvalLevel":1,"dueDate":"2026-09-30"}', admin_id, admin_id, NULL, NULL, now() - interval '2 days'),
   ('adjustment', next_number('adjustment', numbering_prefix('adjustment', 'ADJ')), 2500, 'Approved', '{"seed":"remittance-v1","adjustmentType":"Commission Adjustment","adjustmentCode":"ADJ-003","policyNo":"POL-2026-90006","clientName":"Mercantile Insurance Co., Inc.","originalAmount":142800,"adjustmentAmount":2500,"newAmount":145300,"reason":"Additional commission for renewal incentive","description":"Renewal override","effectiveDate":"2026-09-20","requestedBy":"BrokerVerse","approvalLevel":2}', admin_id, checker_id, checker_id, now() - interval '5 days', now() - interval '6 days'),
   ('adjustment', next_number('adjustment', numbering_prefix('adjustment', 'ADJ')), 1500, 'Completed', '{"seed":"remittance-v1","adjustmentType":"Tax Adjustment","adjustmentCode":"ADJ-004","policyNo":"POL-2026-90003","clientName":"Pioneer Insurance & Surety Corp.","originalAmount":25823,"adjustmentAmount":1500,"newAmount":27323,"reason":"LGT recomputation","effectiveDate":"2026-09-10","requestedBy":"BrokerVerse","approvalLevel":1}', admin_id, checker_id, checker_id, now() - interval '12 days', now() - interval '14 days'),
   ('adjustment', next_number('adjustment', numbering_prefix('adjustment', 'ADJ')), -800, 'Rejected', '{"seed":"remittance-v1","adjustmentType":"Penalty Adjustment","adjustmentCode":"ADJ-006","policyNo":"POL-2026-90005","clientName":"FPG Insurance Co., Inc.","originalAmount":55080,"adjustmentAmount":-800,"newAmount":54280,"reason":"Penalty waiver request","effectiveDate":"2026-09-05","requestedBy":"BrokerVerse","approvalLevel":1}', admin_id, checker_id, NULL, NULL, now() - interval '20 days');

  -- electronic transfers
  INSERT INTO remittance_items(kind, reference_no, amount, status, data, created_by, updated_by, approved_by, approved_at, created_at) VALUES
   ('transfer', next_number('transfer', numbering_prefix('transfer', 'TRF')), 125000, 'Pending', '{"seed":"remittance-v1","beneficiary":"Malayan Insurance Co., Inc.","method":"PESONet","accountNumber":"0012-3456-78","bankName":"Banco de Oro","purpose":"September premium remittance","scheduledDate":"2026-09-29"}', admin_id, admin_id, NULL, NULL, now() - interval '1 day'),
   ('transfer', next_number('transfer', numbering_prefix('transfer', 'TRF')), 87500, 'Approved', '{"seed":"remittance-v1","beneficiary":"Pioneer Insurance & Surety Corp.","method":"RTGS","accountNumber":"3081-0456-78","bankName":"Bank of the Philippine Islands","purpose":"August premium remittance","scheduledDate":"2026-09-26"}', admin_id, checker_id, checker_id, now() - interval '2 days', now() - interval '3 days'),
   ('transfer', next_number('transfer', numbering_prefix('transfer', 'TRF')), 156000, 'Completed', '{"seed":"remittance-v1","beneficiary":"FPG Insurance Co., Inc.","method":"Wire","purpose":"July premium remittance","scheduledDate":"2026-09-20","bankReference":"WIRE-20260920-1182"}', admin_id, checker_id, checker_id, now() - interval '9 days', now() - interval '10 days'),
   ('transfer', next_number('transfer', numbering_prefix('transfer', 'TRF')), 34500, 'Failed', '{"seed":"remittance-v1","beneficiary":"Standard Insurance Co., Inc.","method":"InstaPay","purpose":"Refund","scheduledDate":"2026-09-18","failureReason":"Beneficiary account closed"}', admin_id, checker_id, checker_id, now() - interval '11 days', now() - interval '12 days');
  INSERT INTO remittance_approvals(entity, entity_id, reference_no, transaction_type, amount, description, priority, sla_hours, required_levels, initiator_id, history, created_at)
  SELECT 'item', x.id, x.reference_no, CASE x.kind WHEN 'transfer' THEN 'Electronic Transfer' ELSE 'Adjustment' END, x.amount,
         COALESCE(x.data->>'purpose', (x.data->>'adjustmentType') || ': ' || (x.data->>'reason')), CASE WHEN abs(x.amount) >= 20000 THEN 'Normal' ELSE 'Low' END,
         CASE WHEN abs(x.amount) >= 20000 THEN 24 ELSE 48 END, CASE WHEN abs(x.amount) > 100000 THEN 2 ELSE 1 END, admin_id,
         jsonb_build_array(jsonb_build_object('action', 'Submitted', 'by', admin_id, 'at', x.created_at)), x.created_at
  FROM remittance_items x WHERE x.data->>'seed' = 'remittance-v1' AND x.status IN ('Pending', 'Pending Approval');
  INSERT INTO remittance_approvals(entity, entity_id, reference_no, transaction_type, amount, description, priority, sla_hours, initiator_id, status, action_by, action_at, remarks, history, created_at)
  SELECT 'item', x.id, x.reference_no, CASE x.kind WHEN 'transfer' THEN 'Electronic Transfer' WHEN 'settlement' THEN 'Settlement' ELSE 'Adjustment' END, x.amount, x.kind, 'Normal', 24, admin_id,
         CASE WHEN x.status = 'Rejected' THEN 'Rejected' ELSE 'Approved' END, checker_id, COALESCE(x.approved_at, x.created_at + interval '1 day'),
         CASE WHEN x.status = 'Rejected' THEN 'Missing supporting documents' ELSE 'Verified and approved as per guidelines' END,
         jsonb_build_array(jsonb_build_object('action', 'Submitted', 'by', admin_id, 'at', x.created_at),
                           jsonb_build_object('action', CASE WHEN x.status = 'Rejected' THEN 'Rejected' ELSE 'Approved' END, 'by', checker_id, 'at', COALESCE(x.approved_at, x.created_at + interval '1 day'),
                                              'remarks', CASE WHEN x.status = 'Rejected' THEN 'Missing supporting documents' ELSE 'Verified and approved as per guidelines' END, 'level', 1)), x.created_at
  FROM remittance_items x WHERE x.data->>'seed' = 'remittance-v1' AND x.status IN ('Approved', 'Completed', 'Failed', 'Rejected') AND x.kind IN ('transfer', 'adjustment', 'settlement');

  -- exceptions
  INSERT INTO remittance_items(kind, reference_no, amount, status, priority, data, created_by, updated_by, created_at)
  SELECT 'exception', next_number('remittance_exception', numbering_prefix('remittance_exception', 'EXC')), v.amt, v.st, v.sev,
         jsonb_build_object('seed', 'remittance-v1', 'type', v.t, 'severity', v.sev, 'remittanceNo', (SELECT remittance_number FROM remittances ORDER BY remittance_date DESC OFFSET v.o LIMIT 1),
                            'description', v.d, 'assignedTo', v.a, 'detectedOn', (current_date - v.age)::text, 'action', 'Review'), admin_id, admin_id, now() - (v.age || ' days')::interval
  FROM (VALUES ('Amount Mismatch', 'Critical', 25000, 'Open', 'Insurer statement differs from remittance by 25,000', 'Ramon Aquino', 2, 0),
               ('Missing Document', 'High', 15000, 'In Progress', 'Official receipt from insurer not yet received', 'Ramon Aquino', 5, 1),
               ('Duplicate Entry', 'Medium', 8500, 'Open', 'Policy appears on two remittances', '', 1, 2),
               ('Date Discrepancy', 'Low', 3200, 'Resolved', 'Remittance date after insurer cut-off', 'BrokerVerse Administrator', 3, 3)) AS v(t, sev, amt, st, d, a, age, o);

  -- sent notifications
  INSERT INTO remittance_items(kind, reference_no, status, priority, data, created_by, updated_by, created_at)
  SELECT 'notification', next_number('remittance_notice', numbering_prefix('remittance_notice', 'NTF')), 'Sent', v.p,
         jsonb_build_object('seed', 'remittance-v1', 'type', v.t, 'subject', v.s, 'content', v.c, 'recipients', jsonb_build_array(v.r), 'recipientType', v.rt, 'channel', 'Email', 'queuedEmails', 1), admin_id, admin_id, now() - (v.age || ' days')::interval
  FROM (VALUES ('Payment Reminder', 'High', 'Payment overdue - POL-2026-90002', 'Your premium payment is overdue. Please settle to avoid lapse.', 'accounts@client.example', 'Client', 3),
               ('Settlement Alert', 'Normal', 'Settlement completed - September', 'Premium settlement for September has been remitted.', 'uw@malayan.example', 'Insurer', 5),
               ('Statement Ready', 'Normal', 'Remittance statement available', 'The August remittance statement is ready for download.', 'uw@pioneer.example', 'Insurer', 12)) AS v(t, p, s, c, r, rt, age);

  -- bank statement lines: two match approved remittances exactly, others are unmatched
  INSERT INTO remittance_items(kind, reference_no, amount, status, data, created_by, updated_by)
  SELECT 'bank-txn', next_number('bank_txn', numbering_prefix('bank_txn', 'BNK')), r.net_due, 'unmatched', jsonb_build_object('seed', 'remittance-v1', 'transDate', (r.remittance_date + 3)::text, 'bankReference', 'CR-' || r.remittance_number, 'description', 'Credit - ' || i.name), admin_id, admin_id
  FROM remittances r JOIN insurance_companies i ON i.id = r.insurance_company_id WHERE r.status IN ('approved', 'settled') ORDER BY r.remittance_date DESC LIMIT 2;
  INSERT INTO remittance_items(kind, reference_no, amount, status, data, created_by, updated_by)
  SELECT 'bank-txn', next_number('bank_txn', numbering_prefix('bank_txn', 'BNK')), v.a, 'unmatched', jsonb_build_object('seed', 'remittance-v1', 'transDate', v.d, 'bankReference', v.r, 'description', v.t), admin_id, admin_id
  FROM (VALUES (7500.00, '2026-09-21', 'REF002', 'Unidentified credit'), (9800.00, '2026-09-23', 'REF004', 'Partial payment'), (4500.00, '2026-09-24', 'REF005', 'InstaPay credit')) AS v(a, d, r, t);

  -- automated execution history
  INSERT INTO remittance_items(kind, reference_no, amount, status, data, created_by, updated_by, created_at) VALUES
   ('execution', next_number('remittance_batch', numbering_prefix('remittance_batch', 'BLK')), 250000, 'Success', '{"seed":"remittance-v1","configCode":"ARM-001","executionDate":"2026-08-15","recordsProcessed":12,"itemCount":3,"durationMs":135000,"triggeredBy":"schedule"}', admin_id, admin_id, TIMESTAMPTZ '2026-08-15 09:00+08'),
   ('execution', next_number('remittance_batch', numbering_prefix('remittance_batch', 'BLK')), 98500, 'Success', '{"seed":"remittance-v1","configCode":"ARM-001","executionDate":"2026-07-15","recordsProcessed":7,"itemCount":2,"durationMs":105000,"triggeredBy":"schedule"}', admin_id, admin_id, TIMESTAMPTZ '2026-07-15 09:00+08');

  INSERT INTO remittance_delegations(delegator_id, delegate_id, from_date, to_date, trans_types, amount_limit, reason, status)
  SELECT checker_id, admin_id, current_date - 2, current_date + 5, '["All"]', 500000, 'Annual leave', 'Active' WHERE checker_id IS NOT NULL;
END $$;
