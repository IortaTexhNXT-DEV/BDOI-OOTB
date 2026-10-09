-- TISPH sample data. The sample business of earlier releases (seeds/sample, loaded with SEED_SAMPLE_DATA on: fire, IAR,
-- CGL, marine and home business, fictional insurers and insurers outside the TISPH panel, generic SME clients) is
-- replaced by the TISPH sample of the same files: TFS-referred buyers of Toyota cars, motor with the motor tariff,
-- CTPL, personal accident, group PA, travel, credit life and parcel, placed with the panel insurers. This migration
-- removes the earlier sample rows from a database in use so the sample seed of the next start loads the new ones under
-- the same fixed ids.
--
-- Only sample rows are removed: the rows of the sample seed files (fixed ids ld_sls_, cl_sls_ / cl_crs_ / cl_fin_,
-- qt_sls_, pol_sls_ / pol_crs_ / pol_fin_, end_sls_, clm_crs_, rnw_crs_, bs_sample_, plc_sample_ ...; seed markers;
-- rows created by 'seed') and the documents the sample ledger generated on them (bills, receipts, journals, commissions,
-- collections, remittances, vouchers). A sample client, prospect or policy that a user has worked on (a quotation,
-- policy, claim, endorsement, renewal, placement, request for quotation, cheque, upload, receipt with other bills ...
-- of a user refers to it) is kept with everything on it. Sample masters that a user's record refers to (insurers,
-- channels, referrers, programmes, templates, bundles, rate tables) are made inactive instead of deleted. If anything
-- else still refers to a row to remove, the sample business is left as it is. The audit trail records the conversion
-- (entity database, id sample-data, action convert) with the records kept and the reason when nothing was removed.
-- A new database, or one never seeded with sample data, is not changed. Runs once (schema_migrations).

DO $$
DECLARE
  v_admin text := (SELECT id FROM users WHERE username = 'BrokerVerse');
  v_kept jsonb;
  v_error text;
  r record;
BEGIN
  -- only a database holding the sample of earlier releases (its fictional insurers, dealer channels or non-TISPH business)
  IF NOT EXISTS (SELECT 1 FROM insurance_companies WHERE code IN ('SECUREGUARD','APEX','LIBERTYSHIELD','SENTINEL','GOLDENHORIZON','INTEGRITY','EVERSAFE'))
     AND NOT EXISTS (SELECT 1 FROM distribution_channels WHERE id IN ('ch_seed_mmg','ch_seed_bdo','ch_seed_cpr'))
     AND NOT EXISTS (SELECT 1 FROM policies p JOIN products pr ON pr.id = p.product_id
                      WHERE p.id ~ '^pol_(sls|crs|fin)_' AND pr.code IN ('FIRE','IAR','MARINE','CGL','EB','HOME','BURGLARY')) THEN
    RETURN;
  END IF;

  -- ---------------------------------------------------------------- the sample parties and policies
  CREATE TEMP TABLE smp_lead ON COMMIT DROP AS SELECT id, client_id FROM leads WHERE id ~ '^ld_sls_';
  CREATE TEMP TABLE smp_client ON COMMIT DROP AS SELECT id FROM clients WHERE id ~ '^cl_(sls|crs|fin)_';
  CREATE TEMP TABLE smp_quote ON COMMIT DROP AS SELECT id, lead_id, client_id FROM quotes WHERE id ~ '^qt_sls_';
  CREATE TEMP TABLE smp_policy ON COMMIT DROP AS SELECT id, client_id, lead_id, quote_id FROM policies WHERE id ~ '^pol_(sls|crs|fin)_';

  -- sample records a user has worked on: the client (or prospect) behind them is kept with everything on it
  CREATE TEMP TABLE smp_keep_client(id text) ON COMMIT DROP;
  CREATE TEMP TABLE smp_keep_lead(id text) ON COMMIT DROP;
  INSERT INTO smp_keep_client
    SELECT client_id FROM leads WHERE id !~ '^ld_sls_' AND client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM quotes WHERE id !~ '^qt_sls_' AND client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM policies WHERE id !~ '^pol_(sls|crs|fin)_' AND client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM claims WHERE id !~ '^clm_crs_' AND client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM placements WHERE id !~ '^plc_sample_' AND client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM broker_slips WHERE id !~ '^bs_sample_' AND client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM post_dated_cheques WHERE client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM open_covers WHERE client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM fleet_schedules WHERE client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM package_quotes WHERE client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM cover_notes WHERE client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM comparison_reports WHERE client_id IN (SELECT id FROM smp_client)
    UNION SELECT client_id FROM sales_activities WHERE client_id IN (SELECT id FROM smp_client)
    UNION SELECT entity_id FROM documents WHERE entity = 'client' AND entity_id IN (SELECT id FROM smp_client)
    -- sample policies a user has worked on
    UNION SELECT p.client_id FROM smp_policy p WHERE
          EXISTS (SELECT 1 FROM claims c WHERE c.policy_id = p.id AND c.id !~ '^clm_crs_')
       OR EXISTS (SELECT 1 FROM endorsements e WHERE e.policy_id = p.id AND e.id !~ '^end_sls_')
       OR EXISTS (SELECT 1 FROM renewals n WHERE (n.policy_id = p.id OR n.new_policy_id = p.id) AND n.id !~ '^rnw_crs_' AND n.created_by IS DISTINCT FROM 'seed')
       OR EXISTS (SELECT 1 FROM policies o WHERE o.renewed_from = p.id AND o.id !~ '^pol_(sls|crs|fin)_')
       OR EXISTS (SELECT 1 FROM placements pl WHERE pl.policy_id = p.id AND pl.id !~ '^plc_sample_')
       OR EXISTS (SELECT 1 FROM post_dated_cheques d WHERE d.policy_id = p.id)
       OR EXISTS (SELECT 1 FROM dealer_sales d WHERE d.policy_id = p.id)
       OR EXISTS (SELECT 1 FROM fleet_schedules f WHERE f.policy_id = p.id)
       OR EXISTS (SELECT 1 FROM open_covers o WHERE o.policy_id = p.id)
       OR EXISTS (SELECT 1 FROM cover_notes c WHERE c.policy_id = p.id)
       OR EXISTS (SELECT 1 FROM policy_payments x WHERE x.policy_id = p.id)
       OR EXISTS (SELECT 1 FROM payment_links x WHERE x.policy_id = p.id)
       OR EXISTS (SELECT 1 FROM package_quotes x WHERE x.policy_id = p.id OR x.renewal_of = p.id)
       OR EXISTS (SELECT 1 FROM documents d WHERE d.entity IN ('policy', 'claim', 'endorsement') AND d.entity_id IN (SELECT p.id UNION SELECT c.id FROM claims c WHERE c.policy_id = p.id))
       -- a receipt that also settles bills outside the sample
       OR EXISTS (SELECT 1 FROM receipt_applications a JOIN receivables b ON b.id = a.receivable_id
                   WHERE b.policy_id = p.id AND EXISTS (SELECT 1 FROM receipt_applications a2 JOIN receivables b2 ON b2.id = a2.receivable_id
                     WHERE a2.receipt_id = a.receipt_id AND b2.policy_id NOT IN (SELECT id FROM smp_policy)))
    -- sample quotations a user has taken further
    UNION SELECT q.client_id FROM smp_quote q WHERE
          EXISTS (SELECT 1 FROM policies o WHERE o.quote_id = q.id AND o.id !~ '^pol_(sls|crs|fin)_')
       OR EXISTS (SELECT 1 FROM placements pl WHERE pl.quote_id = q.id AND pl.id !~ '^plc_sample_')
       OR EXISTS (SELECT 1 FROM cover_notes c WHERE c.quote_id = q.id)
       OR EXISTS (SELECT 1 FROM dealer_sales d WHERE d.quote_id = q.id)
       OR EXISTS (SELECT 1 FROM sales_activities s WHERE s.entity = 'quote' AND s.entity_id = q.id)
       OR EXISTS (SELECT 1 FROM documents d WHERE d.entity = 'quotation' AND d.entity_id = q.id);
  -- prospects worked on (also those that never became a client)
  INSERT INTO smp_keep_lead
    SELECT lead_id FROM quotes WHERE id !~ '^qt_sls_' AND lead_id IN (SELECT id FROM smp_lead)
    UNION SELECT lead_id FROM policies WHERE id !~ '^pol_(sls|crs|fin)_' AND lead_id IN (SELECT id FROM smp_lead)
    UNION SELECT lead_id FROM placements WHERE id !~ '^plc_sample_' AND lead_id IN (SELECT id FROM smp_lead)
    UNION SELECT lead_id FROM broker_slips WHERE id !~ '^bs_sample_' AND lead_id IN (SELECT id FROM smp_lead)
    UNION SELECT lead_id FROM package_quotes WHERE lead_id IN (SELECT id FROM smp_lead)
    UNION SELECT lead_id FROM dealer_sales WHERE lead_id IN (SELECT id FROM smp_lead)
    UNION SELECT lead_id FROM comparison_reports WHERE lead_id IN (SELECT id FROM smp_lead)
    UNION SELECT lead_id FROM sales_activities WHERE lead_id IN (SELECT id FROM smp_lead)
    UNION SELECT q.lead_id FROM smp_quote q WHERE q.client_id IS NULL AND (
          EXISTS (SELECT 1 FROM placements pl WHERE pl.quote_id = q.id AND pl.id !~ '^plc_sample_')
       OR EXISTS (SELECT 1 FROM sales_activities s WHERE s.entity = 'quote' AND s.entity_id = q.id))
    UNION SELECT entity_id FROM documents WHERE entity = 'lead' AND entity_id IN (SELECT id FROM smp_lead);
  -- a kept prospect keeps its client and the other way round
  INSERT INTO smp_keep_client SELECT l.client_id FROM smp_lead l WHERE l.id IN (SELECT id FROM smp_keep_lead) AND l.client_id IS NOT NULL;
  INSERT INTO smp_keep_lead SELECT l.id FROM smp_lead l WHERE l.client_id IN (SELECT id FROM smp_keep_client);
  INSERT INTO smp_keep_lead SELECT c.lead_id FROM clients c WHERE c.id IN (SELECT id FROM smp_keep_client) AND c.lead_id IN (SELECT id FROM smp_lead);
  -- the broker slip and the direct placement of the earlier sample name a sample prospect / client of their own
  DELETE FROM smp_keep_client WHERE id IS NULL;
  DELETE FROM smp_keep_lead WHERE id IS NULL;

  SELECT COALESCE(jsonb_agg(DISTINCT x ORDER BY x), '[]'::jsonb) INTO v_kept FROM (SELECT id AS x FROM smp_keep_client UNION SELECT id FROM smp_keep_lead) k;

  -- what is removed
  DELETE FROM smp_client WHERE id IN (SELECT id FROM smp_keep_client);
  DELETE FROM smp_lead WHERE id IN (SELECT id FROM smp_keep_lead) OR client_id IN (SELECT id FROM smp_keep_client);
  DELETE FROM smp_quote WHERE lead_id IN (SELECT id FROM smp_keep_lead) OR client_id IN (SELECT id FROM smp_keep_client);
  DELETE FROM smp_policy WHERE client_id IN (SELECT id FROM smp_keep_client) OR lead_id IN (SELECT id FROM smp_keep_lead) OR quote_id NOT IN (SELECT id FROM smp_quote);
  CREATE TEMP TABLE smp_rcv ON COMMIT DROP AS SELECT id FROM receivables WHERE policy_id IN (SELECT id FROM smp_policy);
  CREATE TEMP TABLE smp_receipt ON COMMIT DROP AS SELECT id FROM receipts
    WHERE (policy_id IN (SELECT id FROM smp_policy) OR receivable_id IN (SELECT id FROM smp_rcv) OR id ~ '^or_sls_')
      AND NOT EXISTS (SELECT 1 FROM receipt_applications a WHERE a.receipt_id = receipts.id AND a.receivable_id NOT IN (SELECT id FROM smp_rcv));
  CREATE TEMP TABLE smp_comm ON COMMIT DROP AS SELECT id, disbursement_id, accrual_jv_id, payment_jv_id FROM commissions WHERE policy_id IN (SELECT id FROM smp_policy);
  CREATE TEMP TABLE smp_remit ON COMMIT DROP AS SELECT id, remittance_number FROM remittances WHERE data->>'seed' = 'remittance-v1';
  CREATE TEMP TABLE smp_il ON COMMIT DROP AS SELECT id, disbursement_id FROM invoice_lists WHERE source = 'seed';
  CREATE TEMP TABLE smp_pv ON COMMIT DROP AS
    SELECT disbursement_id AS id FROM smp_comm WHERE disbursement_id IS NOT NULL
    UNION SELECT disbursement_id FROM smp_il WHERE disbursement_id IS NOT NULL
    UNION SELECT id FROM disbursements WHERE source = 'insurer-remittance' AND policy_id IN (SELECT id FROM smp_policy)
    UNION SELECT id FROM disbursements WHERE source = 'manual' AND payee_name = 'LBC Express Inc.' AND transaction_description = 'Courier services – September' AND created_by = v_admin;
  CREATE TEMP TABLE smp_pcf ON COMMIT DROP AS SELECT id FROM petty_cash_funds f WHERE code IN ('PCF-MKT', 'PCF-CEB') AND created_by = v_admin
    AND NOT EXISTS (SELECT 1 FROM petty_cash_receipts x WHERE x.fund_id = f.id) AND NOT EXISTS (SELECT 1 FROM petty_cash_replenishments x WHERE x.fund_id = f.id);
  CREATE TEMP TABLE smp_jv ON COMMIT DROP AS SELECT id FROM journal_vouchers WHERE
       policy_id IN (SELECT id FROM smp_policy)
    OR (reference_type = 'Receipt' AND reference_id IN (SELECT id FROM smp_receipt))
    OR (reference_type = 'Commission' AND reference_id IN (SELECT id FROM smp_comm))
    OR (reference_type = 'Disbursement' AND reference_id IN (SELECT id FROM smp_pv))
    OR id IN (SELECT booking_jv_id FROM receivables WHERE id IN (SELECT id FROM smp_rcv))
    OR id IN (SELECT journal_id FROM receipt_applications WHERE receipt_id IN (SELECT id FROM smp_receipt))
    OR id IN (SELECT accrual_jv_id FROM smp_comm UNION SELECT payment_jv_id FROM smp_comm UNION SELECT journal_id FROM disbursements WHERE id IN (SELECT id FROM smp_pv))
    OR id IN (SELECT journal_id FROM petty_cash_funds WHERE id IN (SELECT id FROM smp_pcf) UNION SELECT journal_id FROM petty_cash_disbursements WHERE fund_id IN (SELECT id FROM smp_pcf))
    OR (source = 'manual' AND created_by = v_admin AND transaction_code IN ('JV01', 'JV02', 'JV03')
        AND description IN ('Accrual of statutory audit fee FY2026', 'Reclass of advertising to consultancy', 'Bank charges – current month'));
  -- journals reversed or corrected by a user's journal stay (their reversal would point nowhere)
  DELETE FROM smp_jv WHERE id IN (SELECT reversal_of FROM journal_vouchers WHERE reversal_of IS NOT NULL AND id NOT IN (SELECT id FROM smp_jv)
                                  UNION SELECT correction_of FROM journal_vouchers WHERE correction_of IS NOT NULL AND id NOT IN (SELECT id FROM smp_jv));

  BEGIN
    -- remittances, work items, approvals and bank lines of the remittance sample: their lines on the sample policies go,
    -- a remittance left without lines goes too, one that also lists kept policies stays with its totals recomputed
    DELETE FROM remittance_lines WHERE remittance_id IN (SELECT id FROM smp_remit) AND policy_id IN (SELECT id FROM smp_policy);
    UPDATE remittances rm SET gross_premium = t.g, commission = t.c, net_due = t.g - t.c, policy_count = t.n, updated_at = now()
    FROM (SELECT remittance_id, sum(premium) AS g, sum(commission) AS c, count(*)::int AS n FROM remittance_lines WHERE remittance_id IN (SELECT id FROM smp_remit) GROUP BY 1) t
    WHERE rm.id = t.remittance_id;
    DELETE FROM smp_remit WHERE id IN (SELECT remittance_id FROM remittance_lines);
    DELETE FROM remittance_approvals WHERE (entity = 'remittance' AND entity_id IN (SELECT id FROM smp_remit))
      OR (entity = 'item' AND entity_id IN (SELECT id FROM remittance_items WHERE data->>'seed' = 'remittance-v1'));
    DELETE FROM remittance_items WHERE data->>'seed' = 'remittance-v1';
    DELETE FROM bank_statement_lines WHERE statement_id IS NULL AND source = 'remittance' AND created_by = v_admin
      AND (reference IN ('REF002', 'REF004', 'REF005') OR reference IN (SELECT 'CR-' || remittance_number FROM smp_remit))
      AND NOT EXISTS (SELECT 1 FROM bank_rec_match_items m WHERE m.bank_line_id = bank_statement_lines.id);
    DELETE FROM remittances WHERE id IN (SELECT id FROM smp_remit);
    DELETE FROM remittance_delegations WHERE reason = 'Annual leave' AND delegate_id = v_admin
      AND delegator_id = (SELECT id FROM users WHERE username = 'fin.approver' AND created_by = 'seed');
    -- the sample bank statement (unless a reconciliation matched its lines)
    DELETE FROM bank_statement_lines WHERE statement_id IN (SELECT id FROM bank_statements WHERE remarks = 'Sample statement (demo data)')
      AND NOT EXISTS (SELECT 1 FROM bank_rec_match_items m JOIN bank_statement_lines l ON l.id = m.bank_line_id WHERE l.statement_id = bank_statement_lines.statement_id);
    DELETE FROM bank_statements s WHERE remarks = 'Sample statement (demo data)' AND NOT EXISTS (SELECT 1 FROM bank_statement_lines l WHERE l.statement_id = s.id);

    -- incentive programmes and their calculations
    DELETE FROM incentive_results WHERE program_id IN (SELECT id FROM incentive_programs WHERE program_code IN ('INC-2026-001','INC-2026-002','INC-2026-003','INC-2026-004'));
    DELETE FROM incentive_calculations c WHERE programs_included ?| ARRAY['INC-2026-001','INC-2026-002','INC-2026-003','INC-2026-004']
      AND NOT EXISTS (SELECT 1 FROM incentive_results ir WHERE ir.calculation_id = c.batch_id);
    DELETE FROM incentive_programs p WHERE program_code IN ('INC-2026-001','INC-2026-002','INC-2026-003','INC-2026-004')
      AND NOT EXISTS (SELECT 1 FROM incentive_results ir WHERE ir.program_id = p.id);

    -- insurer remittance vouchers and cheques, comsub payouts, the supplier voucher
    DELETE FROM checkbooks WHERE invoice_list_id IN (SELECT id FROM smp_il) OR disbursement_id IN (SELECT id FROM smp_pv);
    UPDATE receipt_applications SET remitted_invoice_id = NULL WHERE remitted_invoice_id IN (SELECT id FROM smp_il);
    DELETE FROM invoice_lists WHERE id IN (SELECT id FROM smp_il);
    UPDATE commissions SET disbursement_id = NULL, accrual_jv_id = NULL, payment_jv_id = NULL WHERE id IN (SELECT id FROM smp_comm);
    UPDATE disbursements SET journal_id = NULL WHERE id IN (SELECT id FROM smp_pv);
    DELETE FROM commissions WHERE id IN (SELECT id FROM smp_comm);
    DELETE FROM disbursements WHERE id IN (SELECT id FROM smp_pv);

    -- petty cash funds of the sample
    UPDATE petty_cash_funds SET journal_id = NULL WHERE id IN (SELECT id FROM smp_pcf);
    DELETE FROM petty_cash_disbursements WHERE fund_id IN (SELECT id FROM smp_pcf);
    DELETE FROM petty_cash_requests WHERE fund_id IN (SELECT id FROM smp_pcf);
    DELETE FROM petty_cash_funds WHERE id IN (SELECT id FROM smp_pcf);

    -- bills, receipts and collections of the sample policies
    DELETE FROM collection_items WHERE receivable_id IN (SELECT id FROM smp_rcv);
    DELETE FROM receipt_applications WHERE receipt_id IN (SELECT id FROM smp_receipt);
    DELETE FROM receipts WHERE id IN (SELECT id FROM smp_receipt);
    DELETE FROM receivable_participants WHERE receivable_id IN (SELECT id FROM smp_rcv);
    UPDATE endorsements SET receivable_id = NULL WHERE receivable_id IN (SELECT id FROM smp_rcv);
    UPDATE receivables SET booking_jv_id = NULL WHERE id IN (SELECT id FROM smp_rcv);
    DELETE FROM receivables WHERE id IN (SELECT id FROM smp_rcv);
    DELETE FROM journal_vouchers WHERE id IN (SELECT id FROM smp_jv);

    -- claims, endorsements, renewals, placements and requests for quotation of the sample
    DELETE FROM claims WHERE policy_id IN (SELECT id FROM smp_policy);
    DELETE FROM endorsements WHERE policy_id IN (SELECT id FROM smp_policy);
    DELETE FROM renewal_batch_policies WHERE policy_id IN (SELECT id FROM smp_policy) OR batch_id IN ('rb_crs_01', 'rb_crs_02');
    DELETE FROM renewal_batches WHERE id IN ('rb_crs_01', 'rb_crs_02') AND NOT EXISTS (SELECT 1 FROM renewal_batch_policies b WHERE b.batch_id = renewal_batches.id);
    DELETE FROM renewals WHERE policy_id IN (SELECT id FROM smp_policy) OR new_policy_id IN (SELECT id FROM smp_policy);
    DELETE FROM winback_campaigns WHERE id = 'wb_crs_01';
    UPDATE policies SET placement_id = NULL WHERE id IN (SELECT id FROM smp_policy);
    DELETE FROM risk_participants WHERE (entity_type = 'placement' AND entity_id IN (SELECT id FROM placements WHERE id ~ '^plc_sample_'))
      OR (entity_type = 'quote' AND entity_id IN (SELECT id FROM smp_quote)) OR (entity_type = 'policy' AND entity_id IN (SELECT id FROM smp_policy))
      OR (entity_type = 'broker_slip' AND entity_id IN (SELECT id FROM broker_slips WHERE id ~ '^bs_sample_'));
    DELETE FROM placements WHERE id ~ '^plc_sample_';
    UPDATE quotes SET broker_slip_id = NULL WHERE id IN (SELECT id FROM smp_quote) AND broker_slip_id ~ '^bs_sample_';
    DELETE FROM broker_slips WHERE id ~ '^bs_sample_';

    -- the sample policies, quotations, prospects and clients
    UPDATE quotes SET policy_id = NULL WHERE id IN (SELECT id FROM smp_quote);
    UPDATE policies SET renewed_from = NULL, renewed_to = NULL WHERE id IN (SELECT id FROM smp_policy);
    DELETE FROM policies WHERE id IN (SELECT id FROM smp_policy);
    DELETE FROM quotes WHERE id IN (SELECT id FROM smp_quote);
    UPDATE leads SET client_id = NULL WHERE id IN (SELECT id FROM smp_lead);
    UPDATE clients SET lead_id = NULL WHERE id IN (SELECT id FROM smp_client);
    DELETE FROM leads WHERE id IN (SELECT id FROM smp_lead);
    DELETE FROM clients WHERE id IN (SELECT id FROM smp_client);
  EXCEPTION WHEN foreign_key_violation THEN
    v_error := SQLERRM;
  END;

  -- ---------------------------------------------------------------- sample masters and configuration rows
  -- removed when nothing refers to them any more, else made inactive
  FOR r IN SELECT id FROM motor_programmes WHERE created_by = 'seed' AND code IN ('MMG-BDO-2026', 'MMG-CASH-2026') LOOP
    BEGIN DELETE FROM motor_programmes WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN UPDATE motor_programmes SET status = 'inactive', updated_at = now() WHERE id = r.id; END;
  END LOOP;
  DELETE FROM lead_assignment_rules WHERE created_by = 'seed' AND name = 'Website motor prospects';
  -- channels: branches before their group
  FOR r IN SELECT id FROM distribution_channels WHERE id IN ('ch_seed_mmg_mkt', 'ch_seed_mmg_alb', 'ch_seed_bdo_mkt', 'ch_seed_cpr', 'ch_seed_mmg', 'ch_seed_bdo')
           ORDER BY parent_id IS NULL, id LOOP
    BEGIN DELETE FROM distribution_channels WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN UPDATE distribution_channels SET status = 'inactive', updated_at = now() WHERE id = r.id; END;
  END LOOP;
  FOR r IN SELECT id FROM commission_referrers WHERE id IN ('ref-makatimotors', 'ref-cebuprime') LOOP
    BEGIN DELETE FROM commission_referrers WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN UPDATE commission_referrers SET status = 'Inactive' WHERE id = r.id; END;
  END LOOP;
  FOR r IN SELECT id FROM campaign_templates WHERE created_by = 'seed' AND code IN ('HOME-PROTECT', 'MOTOR-RENEW') AND updated_by = 'seed' LOOP
    BEGIN DELETE FROM campaign_templates WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN UPDATE campaign_templates SET status = 'inactive', updated_at = now() WHERE id = r.id AND code = 'HOME-PROTECT'; END;
  END LOOP;
  UPDATE report_builder_reports SET name = 'Premium by panel insurer', description = 'Policies, premium and commission per insurer of the panel', updated_at = now()
   WHERE id = 'rbr_seed_premium_by_insurer' AND name = 'Premium by insurer' AND updated_by = 'seed';
  FOR r IN SELECT id FROM package_bundles WHERE created_by = 'seed' AND code IN ('SME-SHIELD', 'HOME-PROTECT') LOOP
    BEGIN DELETE FROM package_bundles WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN UPDATE package_bundles SET status = 'inactive', updated_at = now() WHERE id = r.id; END;
  END LOOP;
  FOR r IN SELECT x.id FROM insurer_rate_tables x JOIN insurance_companies ic ON ic.id = x.insurance_company_id
           WHERE x.created_by = 'seed' AND x.remarks = 'Sample rate' AND x.effective_from = DATE '2026-01-01' AND ic.code IN ('MALAYAN', 'STANDARD', 'PIONEER', 'MAPFRE', 'FPG') LOOP
    BEGIN DELETE FROM insurer_rate_tables WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN UPDATE insurer_rate_tables SET active = false, updated_at = now() WHERE id = r.id; END;
  END LOOP;
  FOR r IN SELECT id FROM override_agreements WHERE created_by = 'seed' AND agreement_code IN ('MERC-OVR-SAMPLE', 'PIONEER-LR-SAMPLE') LOOP
    BEGIN DELETE FROM override_agreements WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN UPDATE override_agreements SET status = 'inactive', updated_at = now() WHERE id = r.id; END;
  END LOOP;
  DELETE FROM coc_series s WHERE created_by = 'seed' AND remarks = 'Demo series' AND next_number = series_from
    AND insurance_company_id IN (SELECT id FROM insurance_companies WHERE code IN ('MALAYAN', 'PIONEER'));
  DELETE FROM payee_bank_accounts WHERE created_by = 'seed' AND payee_type = 'Insurer'
    AND payee_id IN (SELECT id::text FROM insurance_companies WHERE code IN ('MALAYAN', 'PIONEER', 'MAPFRE'));
  DELETE FROM insurer_api_mappings WHERE created_by = 'seed' AND broker_code = 'BRK-DEMO-001';
  -- the fictional insurers of the quotation Share dialog
  FOR r IN SELECT id FROM insurance_companies WHERE code IN ('SECUREGUARD','APEX','LIBERTYSHIELD','SENTINEL','GOLDENHORIZON','INTEGRITY','EVERSAFE') LOOP
    BEGIN DELETE FROM insurance_companies WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN UPDATE insurance_companies SET status = 'inactive', updated_at = now() WHERE id = r.id; END;
  END LOOP;
  -- demo master records of the broker companies, bank accounts, employees, commission rates, repair shops and suppliers
  FOR r IN SELECT id FROM master_records WHERE created_by = 'seed' AND updated_by IS NULL AND (
        (type_code = 'company' AND code IN ('BVB', 'BVR', 'BVV'))
     OR (type_code = 'bank-account' AND code IN ('ACC-BDO-001', 'ACC-BPI-001', 'ACC-MBT-001') AND name LIKE 'BrokerVerse - %')
     OR (type_code = 'employee' AND code ~ '^EMP-000[1-8]$' AND data->>'email' LIKE '%@brokerverse.example')
     OR (type_code = 'commission' AND code IN ('COM-MTR-MAL', 'COM-MTR-PIO', 'COM-FIRE-FPG', 'COM-CTPL-STD', 'COM-PA-MAP'))
     OR (type_code = 'repair-shop' AND code IN ('RS-001', 'RS-002') AND name IN ('Sample Auto Body Works', 'Demo Motors Service Center'))
     OR (type_code = 'supplier' AND code IN ('SUP-001', 'SUP-002', 'SUP-003') AND data->>'expenseAccount' IN ('4401008', '4407002', '4402001'))) LOOP
    BEGIN DELETE FROM master_records WHERE id = r.id;
    EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  END LOOP;
  -- the sample account executives and approver: TISPH designations and e-mail addresses
  UPDATE users u SET email = v.email, designation = v.des, updated_at = now()
  FROM (VALUES ('agent.jdelacruz', 'juan.delacruz@tisph.example.ph', 'Sales Officer'), ('agent.msantos', 'maria.santos@tisph.example.ph', 'Sales Associate'),
               ('agent.preyes', 'pedro.reyes@tisph.example.ph', 'Sales Associate'), ('agent.agarcia', 'ana.garcia@tisph.example.ph', 'Sales Unit Head'),
               ('agent.jmartinez', 'jose.martinez@tisph.example.ph', 'Sales Associate'), ('fin.approver', 'ramon.aquino@tisph.example.ph', 'Finance Supervisor')) AS v(username, email, des)
  WHERE u.username = v.username AND u.created_by = 'seed' AND (u.email LIKE '%@agents.example' OR u.email LIKE '%@brokerverse.example');

  INSERT INTO audit_log(username, entity, entity_id, action, after_data)
  VALUES ('system', 'database', 'sample-data', 'convert', jsonb_build_object('migration', '0365_tisph_sample_data', 'keptRecords', v_kept,
    'businessRemoved', v_error IS NULL, 'reason', v_error));
END $$;
