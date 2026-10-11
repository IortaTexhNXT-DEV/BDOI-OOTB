-- Dealer schemes (TIS-BRD-SCHM-01 to 03, CR-05): the Scheme Document Checklist master with its twelve delivered
-- records (FRS SCHM-01 7.4), and the reason codes of the scheme decisions (migrations 0600 to 0602):
--   dealer_scheme_return       return a submitted scheme of the Scheme Master to its maker
--   dealer_scheme_status       suspend, resume or withdraw a scheme
--   scheme_application_cancel  cancel a scheme application
--   lockin_renew, lockin_hold, lockin_release, lockin_not_renewed   the decision of a lock-in review
--   lockin_end                 end a lock-in by hand (Change lock-in)
-- Idempotent: a record is added only when its code is not there yet, so the business keeps its changes.

-- ---------------------------------------------------------------- Scheme Document Checklist (FR-SIS-010)
-- canWaive declares notWhen: a KYC item can never be waived (R1).
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by) VALUES
 ('scheme-document-checklist', 'Scheme Document Checklist', 'general', NULL, 'generic', NULL, 'code', 'documentName',
  $j$[{"name":"code","label":"Code","type":"string","required":true},
      {"name":"schemeType","label":"Scheme Type","type":"select","required":true,"options":["*","Scheme 1","Scheme 2"],"default":"*"},
      {"name":"kycSource","label":"KYC Source","type":"select","required":true,"options":["*","TFSPH","Full KYC"],"default":"*"},
      {"name":"condition","label":"Condition","type":"select","required":true,"options":["Always","Non-Filipino borrower","Borrower 21 or younger","ARA payment by ADA"],"default":"Always"},
      {"name":"documentName","label":"Document","type":"string","required":true},
      {"name":"kycItem","label":"KYC Item","type":"boolean","required":false,"default":false},
      {"name":"required","label":"Required","type":"boolean","required":false,"default":true},
      {"name":"canWaive","label":"Can Be Waived","type":"boolean","required":false,"default":false,"notWhen":{"field":"kycItem","value":true,"message":"A KYC item cannot be waived"}},
      {"name":"sortOrder","label":"Sort Order","type":"integer","required":false,"default":100},
      {"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},
      {"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 154, true, 'seed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'scheme-document-checklist', v.code, v.name, jsonb_build_object('code', v.code, 'schemeType', v.scheme, 'kycSource', v.kyc, 'condition', v.cond, 'documentName', v.name,
  'kycItem', v.kyc_item, 'required', v.req, 'canWaive', v.waive, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES
  ('SCH-LOAN', '*', '*', 'Always', 'Loan booking advice from TFSPH', false, true, false, 10),
  ('SCH-INVOICE', '*', '*', 'Always', 'Vehicle sales invoice', false, true, false, 20),
  ('SCH-DR', '*', '*', 'Always', 'Delivery receipt with chassis, engine and conduction sticker numbers', false, true, true, 30),
  ('SCH-MORTGAGE', '*', '*', 'Always', 'Chattel mortgage or disclosure statement naming TFSPH as mortgagee', false, true, true, 40),
  ('SCH1-ARA', 'Scheme 1', '*', 'Always', 'Deed of undertaking on the Auto Renewal Agreement (ARA), signed', false, true, false, 50),
  ('SCH1-ADA', 'Scheme 1', '*', 'ARA payment by ADA', 'ADA enrolment form', false, true, true, 60),
  ('KYC-TFS', '*', 'TFSPH', 'Always', 'TFSPH KYC confirmation (name, birthday, mobile or e-mail, ID presented)', true, true, false, 70),
  ('KYC-TFS-ID', '*', 'TFSPH', 'Always', 'Copy of the ID presented at loan approval', true, false, false, 80),
  ('KYC-ID', '*', 'Full KYC', 'Always', 'One primary ID, or two secondary IDs, of the borrower', true, true, false, 90),
  ('KYC-FOREIGN', '*', '*', 'Non-Filipino borrower', 'SRRV or ACR / ICR', true, true, false, 100),
  ('KYC-MINOR', '*', '*', 'Borrower 21 or younger', 'Birth certificate', true, true, false, 110),
  ('SCH-PHOTOS', '*', '*', 'Always', 'Photos of the vehicle (4 sides)', false, false, false, 120)
) AS v(code, scheme, kyc, cond, name, kyc_item, req, waive, sort)
WHERE EXISTS (SELECT 1 FROM master_types WHERE code = 'scheme-document-checklist')
  AND NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'scheme-document-checklist' AND lower(m.code) = lower(v.code));

-- ---------------------------------------------------------------- reason codes
UPDATE master_types t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'name' = 'context'
    THEN jsonb_set(f, '{options}', (f->'options') || (
      SELECT COALESCE(jsonb_agg(c ORDER BY n), '[]'::jsonb)
      FROM unnest(ARRAY['dealer_scheme_return', 'dealer_scheme_status', 'scheme_application_cancel', 'lockin_renew', 'lockin_hold', 'lockin_release', 'lockin_not_renewed', 'lockin_end'])
        WITH ORDINALITY AS a(c, n)
      WHERE NOT (f->'options' ? c)))
    ELSE f END ORDER BY i)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, i))
WHERE t.code = 'reason-code' AND EXISTS (
  SELECT 1 FROM jsonb_array_elements(t.fields) f,
    unnest(ARRAY['dealer_scheme_return', 'dealer_scheme_status', 'scheme_application_cancel', 'lockin_renew', 'lockin_hold', 'lockin_release', 'lockin_not_renewed', 'lockin_end']) c
  WHERE f->>'name' = 'context' AND NOT (f->'options' ? c));

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', v.note, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('DSR-RATES', 'Rates not agreed with the insurers', 'dealer_scheme_return', false, 3000),
             ('DSR-LINES', 'Vehicle lines to be corrected', 'dealer_scheme_return', false, 3010),
             ('DSR-COMMISSION', 'Commission or dealer commission to be corrected', 'dealer_scheme_return', false, 3020),
             ('DSR-OTHER', 'Other', 'dealer_scheme_return', true, 3090),
             ('DSS-INSURER', 'Rate disputed with an insurer', 'dealer_scheme_status', false, 3100),
             ('DSS-TFS', 'Withdrawn by TFS or the dealers', 'dealer_scheme_status', false, 3110),
             ('DSS-RESUME', 'Terms confirmed, scheme resumed', 'dealer_scheme_status', false, 3120),
             ('DSS-OTHER', 'Other', 'dealer_scheme_status', true, 3190),
             ('SAC-NOT-RELEASED', 'Loan not released', 'scheme_application_cancel', false, 3200),
             ('SAC-WRONG-SCHEME', 'Wrong scheme', 'scheme_application_cancel', false, 3210),
             ('SAC-DUPLICATE', 'Duplicate', 'scheme_application_cancel', false, 3220),
             ('SAC-WITHDREW', 'Customer withdrew', 'scheme_application_cancel', false, 3230),
             ('SAC-OTHER', 'Other', 'scheme_application_cancel', true, 3290),
             ('LKR-CONFIRMED', 'Lock-in confirmed', 'lockin_renew', false, 3300),
             ('LKH-PAST-DUE', 'Loan past due', 'lockin_hold', false, 3400),
             ('LKH-AWAITING', 'Awaiting TFS status', 'lockin_hold', false, 3410),
             ('LKH-CONTACT', 'Client contact pending', 'lockin_hold', false, 3420),
             ('LKH-OTHER', 'Other', 'lockin_hold', true, 3490),
             ('LKL-CLIENT', 'Client request', 'lockin_release', false, 3500),
             ('LKL-CLOSED', 'Loan closed', 'lockin_release', false, 3510),
             ('LKL-WITHDRAWN', 'Scheme withdrawn', 'lockin_release', false, 3520),
             ('LKL-OTHER', 'Other', 'lockin_release', true, 3590),
             ('LKN-EARLY', 'Loan early terminated', 'lockin_not_renewed', false, 3600),
             ('LKN-TERMINATED', 'Loan terminated', 'lockin_not_renewed', false, 3610),
             ('LKN-FRAUD', 'Fraud', 'lockin_not_renewed', false, 3620),
             ('LKN-LEGAL', 'Legal dispute', 'lockin_not_renewed', false, 3630),
             ('LKN-SOLD', 'Vehicle sold', 'lockin_not_renewed', false, 3640),
             ('LKN-TOTAL-LOSS', 'Total loss', 'lockin_not_renewed', false, 3650),
             ('LKN-OTHER', 'Other', 'lockin_not_renewed', true, 3690),
             ('LKE-CLIENT', 'Client request', 'lockin_end', false, 3700),
             ('LKE-SOLD', 'Vehicle sold', 'lockin_end', false, 3710),
             ('LKE-CLOSED', 'Loan closed', 'lockin_end', false, 3720),
             ('LKE-WITHDRAWN', 'Scheme withdrawn', 'lockin_end', false, 3730),
             ('LKE-CORRECTION', 'Data correction', 'lockin_end', false, 3740),
             ('LKE-OTHER', 'Other', 'lockin_end', true, 3790)
) AS v(code, name, context, note, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND m.code = v.code);
