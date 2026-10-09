-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Parcel / Courier: the AXA open policy of Toyota Financial Services for the parcels it couriers to its customers
-- (registration papers and plates, duplicate keys, accessories), with a certificate per customer shipment, last month's
-- declaration billed and this month's still open. Fictional; idempotent by fixed id.
INSERT INTO clients(id, client_code, client_type, company_name, display_name, email, phone, address, city, state, country, postal_code, lead_category, source, status, owner_user_id, created_by)
SELECT 'cl_sls_93', (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.client.prefix') || '-' || to_char(current_date, 'YYYY') || '-95093', 'corporate',
  'Toyota Financial Services Philippines Corporation', 'Toyota Financial Services Philippines Corporation', 'insurance.desk@tfs.example.ph', '+63288588000',
  'Bonifacio Global City', 'Taguig', 'Metro Manila', 'Philippines', '1634', 'Corporate', 'Corporate', 'active', (SELECT id FROM users WHERE username = 'BrokerVerse'),
  (SELECT id FROM users WHERE username = 'BrokerVerse')
ON CONFLICT (id) DO NOTHING;

-- the contract and its open policy (issued without a bill: the declarations are billed)
INSERT INTO open_covers(id, cover_number, client_id, insurance_company_id, product_id, insurer_reference, period_from, period_to, goods_description, voyage_scope, clauses, currency,
  rates, markup_percent, minimum_premium, estimated_annual_value, declaration_frequency, commission_rate, status, owner_user_id, created_by, updated_by, created_at)
SELECT 'oc_seed_01', next_number('open_cover', 'MOC'), 'cl_sls_93', ic.id, pr.id, 'AXA-PCL-2026-0007', date_trunc('month', current_date - 60)::date,
  (date_trunc('month', current_date - 60) + interval '1 year' - interval '1 day')::date,
  'Parcels couriered by TFS to its customers: vehicle registration papers (OR/CR) and plates, duplicate keys, accessories and loan documents',
  'Door-to-door courier within the Philippines', 'Courier all risks; theft, pilferage and non-delivery; excluding cash and negotiable instruments', 'PHP',
  '[{"conveyance":"Land","ratePercent":0.25,"limit":500000},{"conveyance":"Air","ratePercent":0.35,"limit":300000}]', 0, 50, 6000000, 'monthly',
  pg_temp.smp_comm_rate('AXA', 'PARCEL'), 'active', (SELECT id FROM users WHERE username = 'BrokerVerse'), (SELECT id FROM users WHERE username = 'BrokerVerse'),
  (SELECT id FROM users WHERE username = 'BrokerVerse'), now() - interval '62 days'
FROM insurance_companies ic, products pr WHERE ic.code = 'AXA' AND pr.code = 'PARCEL'
ON CONFLICT (id) DO NOTHING;

INSERT INTO policies(id, policy_number, client_id, product_id, policy_type_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, issued_date, sum_insured,
  net_premium, premium_total, commission_amount, currency, insured_name, product_type, lob, doc, details, created_by, created_at)
SELECT 'pol_sls_93', (SELECT value#>>'{}' FROM app_settings WHERE key = 'numbering.policy.prefix') || '-' || to_char(current_date, 'YYYY') || '-95093', o.client_id, o.product_id,
  (SELECT id FROM policy_types WHERE code = 'PCL-OPN'), o.insurance_company_id, o.owner_user_id, 'active', o.period_from, o.period_to, o.period_from - 1, o.estimated_annual_value,
  0, 0, 0, o.currency, c.display_name, pr.name, 'MARINE',
  jsonb_build_object('source', 'open-cover', 'openCoverId', o.id, 'coverNumber', o.cover_number, 'isOpenCover', true, 'insurerReference', o.insurer_reference,
    'insurerPolicyNumber', o.insurer_reference, 'insuranceCompanyName', ic.name,
    'riskDetails', jsonb_build_object('goods', o.goods_description, 'voyages', o.voyage_scope, 'conveyances', 'Land 0.25% up to 500000; Air 0.35% up to 300000')),
  jsonb_build_object('businessType', 'New Business', 'source', 'seed'), o.created_by, (o.period_from - 1 + time '10:00') AT TIME ZONE 'Asia/Manila'
FROM open_covers o JOIN clients c ON c.id = o.client_id JOIN products pr ON pr.id = o.product_id JOIN insurance_companies ic ON ic.id = o.insurance_company_id
WHERE o.id = 'oc_seed_01'
ON CONFLICT (id) DO NOTHING;
UPDATE open_covers SET policy_id = 'pol_sls_93' WHERE id = 'oc_seed_01' AND policy_id IS NULL;

-- one certificate per customer shipment (premium = insured value x rate, at least the minimum premium)
INSERT INTO open_cover_certificates(id, certificate_number, open_cover_id, kind, shipment_date, conveyance, vessel_name, voyage_from, voyage_to, bill_of_lading, goods_description,
  packing, consignee, invoice_value, markup_percent, insured_value, rate_percent, premium, issued_by, issued_at)
SELECT v.id, next_number('marine_certificate', 'MIC'), o.id, 'certificate', date_trunc('month', current_date)::date - v.days_back, v.conv, NULL, 'TFS Document Centre, Taguig', v.dest, v.awb,
  v.goods, v.packing, v.consignee, v.value, 0, v.value, r.rate, GREATEST(round(v.value * r.rate / 100, 2), o.minimum_premium), o.created_by,
  (date_trunc('month', current_date)::date - v.days_back)::timestamptz
FROM (VALUES
 ('occ_seed_01', 25, 'Land', 'Makati City', 'LBC-1104455120', 'OR/CR and plates of a Toyota Fortuner', 'Document pouch', 'Miguel Aquino', 15000),
 ('occ_seed_02', 22, 'Land', 'Quezon City', 'LBC-1104455133', 'OR/CR and plates of a Toyota Vios', 'Document pouch', 'Kristine Soriano', 15000),
 ('occ_seed_03', 18, 'Air', 'Cebu City', 'AP-26-0098821', 'Duplicate key and floor mats of a Toyota Hilux', 'Box', 'Rafael Navarro', 42000),
 ('occ_seed_04', 12, 'Land', 'Bacoor, Cavite', 'LBC-1104467002', 'OR/CR and plates of a Toyota Vios', 'Document pouch', 'Bianca Lorenzo', 15000),
 ('occ_seed_05', 6, 'Land', 'Pasig City', 'LBC-1104471210', 'Dashcam and accessories of a Toyota Innova', 'Box', 'Kalayaan Foods Distribution Corp.', 68000),
 ('occ_seed_06', -3, 'Land', 'Taguig City', 'LBC-1104480871', 'OR/CR and plates of a Toyota Vios', 'Document pouch', 'Sheila Cabrera', 15000),
 ('occ_seed_07', -5, 'Air', 'Iloilo City', 'AP-26-0101342', 'Release of mortgage and loan documents', 'Document pouch', 'Paolo Fernandez', 5000),
 ('occ_seed_08', -7, 'Land', 'Pasig City', 'LBC-1104483390', 'Duplicate key of a Toyota Fortuner', 'Box', 'Ronaldo Pascual', 35000)
) AS v(id, days_back, conv, dest, awb, goods, packing, consignee, value)
JOIN open_covers o ON o.id = 'oc_seed_01'
CROSS JOIN LATERAL (SELECT (x->>'ratePercent')::numeric AS rate FROM jsonb_array_elements(o.rates) x WHERE x->>'conveyance' = v.conv) r
WHERE date_trunc('month', current_date)::date - v.days_back <= current_date
ON CONFLICT (id) DO NOTHING;

-- declarations: last month's billed on the open policy, this month's open
DO $$
DECLARE o record; d record; v_id text; v_prem numeric; v_tax jsonb; v_rcv text; v_comm numeric; m int;
BEGIN
  SELECT * INTO o FROM open_covers WHERE id = 'oc_seed_01';
  IF o.id IS NULL OR EXISTS (SELECT 1 FROM open_cover_declarations WHERE open_cover_id = o.id) THEN RETURN; END IF;
  FOR m IN REVERSE 1..0 LOOP
    INSERT INTO open_cover_declarations(declaration_number, open_cover_id, period, period_from, period_to, shipments, total_insured, premium, vat, dst, lgt, other_charges, gross_premium,
      status, submitted_at, submitted_by, created_by, created_at)
    SELECT next_number('marine_declaration', 'MDC'), o.id, to_char(date_trunc('month', current_date) - make_interval(months => m), 'YYYY-MM'),
      (date_trunc('month', current_date) - make_interval(months => m))::date, (date_trunc('month', current_date) - make_interval(months => m - 1) - interval '1 day')::date,
      0, 0, 0, 0, 0, 0, 0, 0, CASE WHEN m = 1 THEN 'submitted' ELSE 'draft' END, CASE WHEN m = 1 THEN LEAST(date_trunc('month', current_date) + interval '2 days', now()) END,
      CASE WHEN m = 1 THEN o.owner_user_id END, o.owner_user_id, date_trunc('month', current_date) - make_interval(months => m)
    RETURNING id INTO v_id;
    UPDATE open_cover_certificates c SET declaration_id = v_id FROM open_cover_declarations d0
    WHERE d0.id = v_id AND c.open_cover_id = o.id AND c.status <> 'cancelled' AND c.declaration_id IS NULL AND c.shipment_date BETWEEN d0.period_from AND d0.period_to;
    SELECT count(*)::int AS n, COALESCE(sum(insured_value), 0) AS insured, COALESCE(sum(premium), 0) AS premium INTO d FROM open_cover_certificates WHERE declaration_id = v_id;
    v_prem := d.premium;
    v_tax := pg_temp.smp_price('PARCEL', v_prem);
    UPDATE open_cover_declarations SET shipments = d.n, total_insured = d.insured, premium = v_prem, vat = (v_tax->>'vat')::numeric, dst = (v_tax->>'dst')::numeric,
      lgt = (v_tax->>'lgt')::numeric, other_charges = (v_tax->>'others')::numeric + (v_tax->>'fst')::numeric, gross_premium = (v_tax->>'gross')::numeric WHERE id = v_id;
    CONTINUE WHEN m <> 1 OR v_prem <= 0;
    -- bill the closed month on the open policy (booked and collected by 89_finance.sql)
    v_comm := round(v_prem * COALESCE(o.commission_rate, 0), 2);
    INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status, source, reference, currency, net_premium, vat, dst, lgt, other_charges,
      commission_amount, created_by, created_at)
    SELECT next_number('invoice', COALESCE((SELECT value #>> '{}' FROM app_settings WHERE key = 'numbering.invoice.prefix'), 'INV')), o.policy_id, o.client_id, x.gross_premium, 0,
      date_trunc('month', current_date)::date + 3 + COALESCE((SELECT (value #>> '{}')::int FROM app_settings WHERE key = 'marine.declaration_due_days'), 15), 'paid', 'declaration',
      x.declaration_number, o.currency, x.premium, x.vat, x.dst, x.lgt, x.other_charges, v_comm, o.owner_user_id, LEAST(date_trunc('month', current_date) + interval '3 days', now())
    FROM open_cover_declarations x WHERE x.id = v_id
    RETURNING id INTO v_rcv;
    UPDATE open_cover_declarations x SET status = 'billed', receivable_id = v_rcv, bill_number = r.bill_number, billed_at = r.created_at, billed_by = o.owner_user_id
    FROM receivables r WHERE r.id = v_rcv AND x.id = v_id;
    UPDATE policies p SET premium_total = p.premium_total + x.gross_premium, net_premium = p.net_premium + x.premium, commission_amount = p.commission_amount + v_comm,
      bill_number = COALESCE(p.bill_number, x.bill_number), payment_status = 'Completed'
    FROM open_cover_declarations x WHERE x.id = v_id AND p.id = o.policy_id;
  END LOOP;
END $$;
