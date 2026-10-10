-- TISPH quotation and policy configuration (TIS-BRD-QUOT-04, PROD-03). Runs on a new database and on every start of an
-- existing one. Idempotent: a field or row is added only when missing, and a reference value is replaced only while it
-- is still the reference value and nobody has changed it (updated_by empty), so administrator changes are kept.

-- Product Master: quotation validity in days per product (migration 0480); empty = limits.quote_validity_days.
UPDATE master_types SET fields = fields || $j$[{"name":"quoteValidityDays","label":"Quotation Validity (days)","type":"integer","required":false,"column":"quote_validity_days"}]$j$::jsonb
WHERE code = 'product' AND NOT fields @> '[{"name":"quoteValidityDays"}]'::jsonb;

-- Quotations loaded without their issue date (go-live load, sample data) count from the day they were created.
UPDATE quotes SET issued_on = (created_at AT TIME ZONE 'Asia/Manila')::date WHERE issued_on IS NULL;

-- A spoiled quotation is not revived (QUOT-04): Expired has no way back to Draft; the customer gets a new quotation.
UPDATE app_settings SET value = value - 'Expired', updated_at = now()
 WHERE key = 'quotations.transitions' AND updated_by IS NULL AND value->'Expired' = '["Draft"]'::jsonb;

-- The insurer issues every TISPH policy through the placement slip (ISSUE-01): the policy bulk upload only loads the
-- in-force book at go-live (migration 0481).
UPDATE app_settings SET value = 'false'::jsonb, updated_at = now()
 WHERE key = 'policies.bulk_upload_issue' AND updated_by IS NULL AND value = 'true'::jsonb;

-- Reasons of the policy decisions on the Reason Codes master (Master > Insurance Management > Reason Codes), checked by
-- requiredReason() in src/modules/ops-masters/records.js:
--   policy_correction          request a correction of the core data of an issued policy (migration 0481)
--   policy_correction_reject   reject a requested correction
-- A context is added to the Used For list once and a reason only when its code is missing, so administrator changes are kept.
UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['policy_correction', 'policy_correction_reject']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['policy_correction', 'policy_correction_reject']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('PCR-ENCODING', 'Encoding error at issuance', 'policy_correction', false, 2000),
             ('PCR-INSURER', 'Corrected policy issued by the insurer', 'policy_correction', false, 2010),
             ('PCR-NAME', 'Name of the insured as on the ID or registration', 'policy_correction', false, 2020),
             ('PCR-PERIOD', 'Period of cover confirmed by the insurer', 'policy_correction', false, 2030),
             ('PCR-OTHER', 'Other', 'policy_correction', true, 2090),
             ('PCRR-NOPROOF', 'Insurer confirmation not attached or not matching', 'policy_correction_reject', false, 2100),
             ('PCRR-ENDORSE', 'Change to be made by endorsement', 'policy_correction_reject', false, 2110),
             ('PCRR-WRONG', 'Requested values are wrong', 'policy_correction_reject', true, 2120),
             ('PCRR-OTHER', 'Other', 'policy_correction_reject', true, 2190)
) AS v(code, name, context, note, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND m.code = v.code);

-- ---------------------------------------------------------------- M12 Endorsement Types (ENDT-01, ENDT-04)
-- The endorsement types of the TISPH panel of M12 with the financial flag, the premium impact and the lines they apply
-- to (* = all lines). Section: the part of the endorsement the change belongs to (insured, vehicle, cover, period,
-- cancellation, other); the types of one endorsement are printed by section, so several changes make one grouped
-- endorsement (migration 0482). TISPH has not yet marked which types apply per product: every type is loaded active.
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by) VALUES
 ('endorsement-type', 'Endorsement Type', 'general', NULL, 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Endorsement Type","type":"string","required":true},{"name":"financial","label":"Financial","type":"boolean","required":false},{"name":"premiumImpact","label":"Premium Impact","type":"boolean","required":false},{"name":"lines","label":"Lines (* = all)","type":"string","required":true},{"name":"section","label":"Section","type":"select","required":true,"options":["insured","vehicle","cover","period","cancellation","other"]},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 154, true, 'seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'endorsement-type', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'financial', v.fin, 'premiumImpact', v.prem, 'lines', v.lines, 'section', v.section, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('AASR', 'Additional Assured', false, false, '*', 'insured', 10),
             ('CADR', 'Change of Address', false, false, '*', 'insured', 20),
             ('CASR', 'Change of Assured Name', false, false, '*', 'insured', 30),
             ('TOWN', 'Transfer of Ownership', false, false, '*', 'insured', 40),
             ('CBEN', 'Correction of Beneficiary', false, false, 'ACCIDENT', 'insured', 50),
             ('AMTG', 'Addition of Mortgagee', false, false, 'FIRE,MOTOR', 'insured', 60),
             ('DMTG', 'Deletion of Mortgagee', false, false, 'FIRE,MOTOR', 'insured', 70),
             ('CMTG', 'Change of Mortgagee', false, false, 'MOTOR', 'insured', 80),
             ('CPLT', 'Change of Plate Number', false, false, 'MOTOR', 'vehicle', 100),
             ('CMTR', 'Change of Motor Number', false, false, 'MOTOR', 'vehicle', 110),
             ('CSER', 'Change of Serial Number', false, false, 'MOTOR', 'vehicle', 120),
             ('CCOL', 'Change of Vehicle Color', false, false, 'MOTOR', 'vehicle', 130),
             ('CDES', 'Change of Unit Description', false, false, 'MOTOR', 'vehicle', 140),
             ('CYR', 'Change of Year Model', false, false, 'MOTOR', 'vehicle', 150),
             ('APER', 'Additional Perils', true, true, '*', 'cover', 200),
             ('APRM', 'Additional Premium', true, true, '*', 'cover', 210),
             ('CPRM', 'Correction of Premium', true, true, '*', 'cover', 220),
             ('ICOV', 'Increase in Coverage', true, true, '*', 'cover', 230),
             ('ISI', 'Increase in Sum Insured', true, true, '*', 'cover', 240),
             ('DSI', 'Decrease in Sum Insured', true, true, '*', 'cover', 250),
             ('CONT', 'Contingency Clause', true, true, '*', 'cover', 260),
             ('CSID', 'Correction of Sum Insured or Deductible', false, false, '*', 'cover', 270),
             ('ICLA', 'Inclusion of Clause', false, false, '*', 'cover', 280),
             ('DCLA', 'Deletion of Clause', false, false, '*', 'cover', 290),
             ('EXCL', 'Exclusion Endorsement', false, false, '*', 'cover', 300),
             ('AACC', 'Additional Accessories', false, true, 'MOTOR', 'cover', 310),
             ('CUPP', 'Correction of UPPA Limit', true, true, 'MOTOR', 'cover', 320),
             ('IRAS', 'Inclusion of Road Assist', true, true, 'MOTOR', 'cover', 330),
             ('RCMV', 'Revised Coverage and Schedule under CMVLI (CTPL)', true, true, 'MOTOR', 'cover', 340),
             ('VIE', 'Vehicle Inclusion / Exclusion', true, true, 'MOTOR', 'cover', 350),
             ('DAON', 'Deletion of AON Wordings', false, false, 'MOTOR', 'cover', 360),
             ('APRP', 'Additional Property', true, true, 'FIRE', 'cover', 370),
             ('CLOC', 'Correction of Location', false, false, 'FIRE', 'cover', 380),
             ('CCON', 'Correction of Construction / Boundaries', false, false, 'ENGINEERING', 'cover', 390),
             ('MLOC', 'Additional Location', false, false, 'CASUALTY', 'cover', 400),
             ('EPER', 'Extension of Policy Period', true, true, '*', 'period', 500),
             ('CPER', 'Correction of Policy Period', false, false, '*', 'period', 510),
             ('BEXT', 'Bond Extension', true, true, 'CASUALTY', 'period', 520),
             ('CAN', 'Cancellation of Policy', true, true, '*', 'cancellation', 600),
             ('BCAN', 'Bond Cancellation', true, true, 'CASUALTY', 'cancellation', 610),
             ('NREN', 'Non-Renewal', false, false, '*', 'other', 700),
             ('CCOC', 'Correction of COC', false, false, '*', 'other', 710),
             ('IOTH', 'Inclusion of Endorsement - Others', false, false, '*', 'other', 720),
             ('INOT', 'Internal Endorsement - Others', false, false, '*', 'other', 730),
             ('VEND', 'Various Endorsement', false, false, '*', 'other', 740)) AS v(code, name, fin, prem, lines, section, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'endorsement-type' AND lower(m.code) = lower(v.code));

-- ---------------------------------------------------------------- endorsement and cancellation decisions
-- endorsement_reject: reject an endorsement submitted for approval (migration 0482)
UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['endorsement_reject']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'name' = 'context' AND NOT (f->'options' ? 'endorsement_reject'));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('ENR-DOCS', 'Supporting documents missing', 'endorsement_reject', false, 2200),
             ('ENR-PREMIUM', 'Premium change to be checked', 'endorsement_reject', false, 2210),
             ('ENR-TYPE', 'Wrong endorsement type', 'endorsement_reject', false, 2220),
             ('ENR-NOTALLOWED', 'Change not allowed on this product', 'endorsement_reject', false, 2230),
             ('ENR-OTHER', 'Other', 'endorsement_reject', true, 2290)) AS v(code, name, context, note, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND m.code = v.code);

-- M24 cancellation reasons whose initiator the workbook does not state, loaded with the proposed initiator (recorded
-- for TISPH's decision); a duplicate policy is cancelled flat.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'cancellation-reason', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'initiatedBy', v.by, 'method', v.method, 'description', 'A note is required'), 'active', 'seed'
FROM (VALUES ('CAN-DUP', 'Duplicate Policy', 'insured', 'flat'),
             ('CAN-NONDISCL', 'Non-Disclosure/Incorrect Information', 'insurer', 'auto'),
             ('CAN-CLAIMRLTD', 'Claim-Related', 'insurer', 'auto'),
             ('CAN-COMPL', 'Regulatory/Compliance Requirement', 'insurer', 'auto'),
             ('CAN-POLDETAILS', 'Incorrect Policy Details', 'insured', 'auto'),
             ('CAN-OTHER', 'Other', 'insured', 'auto')) AS v(code, name, by, method)
WHERE EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'cancellation-reason' AND m.code = 'CAN-NONPAY')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'cancellation-reason' AND lower(m.code) = lower(v.code));

-- CANC-03: a cancellation returns premium pro-rata on the days left whoever initiates it, and takes back no commission.
UPDATE app_settings SET value = 'false'::jsonb, updated_at = now()
 WHERE key IN ('endorsements.short_period_for_insured', 'endorsements.cancellation_reverses_commission') AND updated_by IS NULL AND value = 'true'::jsonb;

-- ---------------------------------------------------------------- Credit Life journey (QUOT-01)
-- New business (CL-COMP) is placed without a quotation; a renewal (CL-VOL) needs its quotation (migration 0484).
UPDATE app_settings SET value = value || $j${"CL-COMP": {"brokerSlip": "skip", "quotationSlip": "skip", "placementSlip": "required", "directPolicy": "skip"},
  "CL-VOL": {"brokerSlip": "skip", "quotationSlip": "required", "placementSlip": "required", "directPolicy": "skip"}}$j$::jsonb, updated_at = now()
 WHERE key = 'placement.journey' AND updated_by IS NULL AND NOT (value ? 'CL-COMP');

-- ---------------------------------------------------------------- approval limits of the TISPH approvers (ISSUE-04, SEC-01)
-- Proposed limits until TISPH confirms its signing authority (Master > User Management > Authority Matrix): the check of
-- an e-policy (policy issue, sum insured), the return premium of an endorsement or cancellation and the underwriting
-- referral (sum insured), in PHP; the quotation discount in percent; NULL = no limit. A role / type pair that already
-- has a limit in any state is left alone.
INSERT INTO authority_limits(transaction_type, role_code, max_amount, status, remarks, decided_at, decision_note)
SELECT v.type, v.role, v.amount, 'active', 'Proposed TISPH limit, to be confirmed', now(), 'TISPH proposal'
FROM (VALUES
 ('policy_issue', 'tis-sales-officer', 3000000::numeric), ('policy_issue', 'tis-sales-unit-head', 10000000), ('policy_issue', 'tis-ops-unit-head', 10000000), ('policy_issue', 'tis-general-manager', NULL),
 ('return_premium', 'tis-sales-officer', 50000), ('return_premium', 'tis-sales-unit-head', 250000), ('return_premium', 'tis-ops-unit-head', 250000), ('return_premium', 'tis-general-manager', NULL),
 ('underwriting_referral', 'tis-sales-officer', 3000000), ('underwriting_referral', 'tis-sales-unit-head', 10000000), ('underwriting_referral', 'tis-ops-unit-head', 10000000), ('underwriting_referral', 'tis-general-manager', NULL),
 ('quotation_discount', 'tis-sales-officer', 10), ('quotation_discount', 'tis-sales-unit-head', 15), ('quotation_discount', 'tis-ops-unit-head', 15), ('quotation_discount', 'tis-general-manager', 25)
) AS v(type, role, amount)
WHERE EXISTS (SELECT 1 FROM roles r WHERE r.code = v.role)
  AND NOT EXISTS (SELECT 1 FROM authority_limits l WHERE l.transaction_type = v.type AND l.role_code = v.role);

-- ---------------------------------------------------------------- promotions and discount caps (PROD-15)
-- Reason contexts (migration 0485): promotion_return (return a submitted promotion), promotion_status (suspend, resume,
-- withdraw), discount_cap_return (return a proposed discount cap).
UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['promotion_return', 'promotion_status', 'discount_cap_return']) WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f, unnest(ARRAY['promotion_return', 'promotion_status', 'discount_cap_return']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('PRMR-RATES', 'Rates not agreed with the insurer', 'promotion_return', false, 2200),
             ('PRMR-PERIOD', 'Period or quota to be corrected', 'promotion_return', false, 2210),
             ('PRMR-VARIANTS', 'Vehicle variants to be corrected', 'promotion_return', false, 2220),
             ('PRMR-OTHER', 'Other', 'promotion_return', true, 2290),
             ('PRMS-INSURER', 'Rate under renegotiation with the insurer', 'promotion_status', false, 2300),
             ('PRMS-STOCK', 'Vehicle stock or campaign ended', 'promotion_status', false, 2310),
             ('PRMS-RESUME', 'Terms confirmed, promotion resumed', 'promotion_status', false, 2320),
             ('PRMS-OTHER', 'Other', 'promotion_status', true, 2390),
             ('DCR-VALUES', 'Discount range not agreed with TIS Sales', 'discount_cap_return', false, 2400),
             ('DCR-DATES', 'Effective dates to be corrected', 'discount_cap_return', false, 2410),
             ('DCR-OTHER', 'Other', 'discount_cap_return', true, 2490)
) AS v(code, name, context, note, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND m.code = v.code);

-- Proposed discount caps of the Motor product per channel type (FR-PRM-010 R3, to be confirmed by TIS Sales; change
-- them on Master > Finance > Discount Caps). Only where the product and channel type have no cap yet.
INSERT INTO discount_caps(product_id, channel_type, min_pct, max_pct, lowest_od, effective_from, status, remarks, created_by, decided_at, decision_note)
SELECT p.id, v.type, v.min, v.max, v.lowest, DATE '2026-01-01', 'approved', 'Proposed TISPH cap, to be confirmed', 'seed', now(), 'TISPH proposal'
FROM products p, (VALUES ('financing_bank', 0, 25, 1.40), ('dealer', 0, 20, 1.50), ('direct', 0, 25, 1.40), ('agent', 0, 15, 1.60)) AS v(type, min, max, lowest)
WHERE p.code = 'MOTOR' AND NOT EXISTS (SELECT 1 FROM discount_caps c WHERE c.product_id = p.id AND c.channel_type = v.type);

-- ---------------------------------------------------------------- cover notes once the insurer holds the order (ISSUE-01)
-- Proposal (DECISIONS D-QP-18): a cover note evidences cover only once the insurer has acknowledged the placement slip;
-- none from a quotation. Only while the platform values are unchanged.
UPDATE app_settings SET value = '[]'::jsonb, updated_at = now()
 WHERE key = 'cover_note.quote_statuses' AND updated_by IS NULL AND value = '["accepted","approved","submitted"]'::jsonb;
UPDATE app_settings SET value = '["acknowledged","epolicy_received","checked"]'::jsonb, updated_at = now()
 WHERE key = 'cover_note.placement_statuses' AND updated_by IS NULL AND value = '["sent","acknowledged","epolicy_received","checked"]'::jsonb;

-- ---------------------------------------------------------------- quotation approval before the client (QUOT-03)
-- Proposal (DECISIONS D-QP-19): the raiser never sends a quotation; a second user holding approve:quotations approves
-- it, which e-mails it to the client with the quotation slip.
UPDATE app_settings SET value = 'true'::jsonb, updated_at = now()
 WHERE key = 'quotations.approve_before_send' AND updated_by IS NULL AND value = 'false'::jsonb;
