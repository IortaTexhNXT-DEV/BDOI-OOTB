-- Operations and accounting reference data (migrations 0290 to 0298): cover notes, cancellation return premium and the
-- short-period scale, post-dated cheques, instalment invoices, the claim document checklist, motor claim repairs, the
-- accounts payable sub-ledger and the fixed asset register. Settings, document numbering series, scheduled jobs,
-- e-mail templates and the masters a broker reviews before go-live. Idempotent: rows are added only when missing, so
-- administrator changes are kept. Fictional repair shops and suppliers are in sample/96_ops_accounting.sql.

-- ---------------------------------------------------------------- settings
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('cover_note.validity_days', '30', 'policies', 'Cover notes: days of cover from the cover start date', 'number'),
 ('cover_note.max_validity_days', '90', 'policies', 'Cover notes: longest cover period that may be entered (days)', 'number'),
 ('cover_note.reminder_days_before', '7', 'policies', 'Cover notes: remind the policy owner this many days before the cover note expires', 'number'),
 ('cover_note.quote_statuses', '["accepted","approved","submitted"]', 'policies', 'Cover notes: quotation statuses a cover note may be issued from', 'json'),
 ('cover_note.placement_statuses', '["sent","acknowledged","epolicy_received","checked"]', 'policies', 'Cover notes: placement slip statuses a cover note may be issued from (sent to the insurer and not yet booked)', 'json'),
 ('cover_note.wording', $j$"This cover note confirms that the insurance described below is in force for the period shown, subject to the terms, conditions and exclusions of the insurer's usual form of policy for this class of insurance. It ceases at the end of the cover period or when the policy is issued, whichever is earlier, and may be cancelled by the insurer by notice."$j$, 'policies', 'Cover notes: wording printed on the cover note', 'string'),
 ('endorsements.compute_cancellation_return', 'true', 'endorsements', 'Cancellations: compute the return premium (pro-rata, short-period or flat) instead of taking the amount entered', 'boolean'),
 ('endorsements.cancellation_allow_manual', 'false', 'endorsements', 'Cancellations: allow a return premium entered by hand (method manual)', 'boolean'),
 ('endorsements.short_period_for_insured', 'true', 'endorsements', 'Cancellations: apply the short-period scale when the insured cancels (insurer-initiated stays pro-rata)', 'boolean'),
 ('endorsements.default_cancellation_reason', '"INSURED_REQUEST"', 'endorsements', 'Cancellations: reason used when none is given (Cancellation Reason master code)', 'string'),
 ('endorsements.cancellation_returned_taxes', '{"vat":true,"dst":false,"lgt":true,"fst":false,"other":false}', 'endorsements', 'Cancellations: premium taxes returned with the return premium (documentary stamp tax is not refundable)', 'json'),
 ('endorsements.return_approval', 'true', 'endorsements', 'Cancellations and return premiums: booked by a user other than the one who raised them, holding approve:policies and within the Authority Matrix limit for return premiums', 'boolean'),
 ('pdc.due_window_days', '3', 'receipts', 'Post-dated cheques: show cheques due within this many days on the deposit due list and remind Accounting', 'number'),
 ('pdc.default_deposit_account', '""', 'receipts', 'Post-dated cheques: bank account (Bank Account master code) cheques are deposited to by default', 'string'),
 ('pdc.notify_client_on_bounce', 'true', 'receipts', 'Post-dated cheques: e-mail the client when a cheque bounces', 'boolean'),
 ('credit.instalment_invoices_on_save', 'false', 'credit', 'Instalment plans: issue a separate invoice per instalment as soon as the plan is saved', 'boolean'),
 ('claims.require_documents_before_submission', 'true', 'claims', 'Claims: refuse to submit a claim to the insurer while a required document is missing', 'boolean'),
 ('claims.document_reminder_days', '3', 'claims', 'Claims: days between automatic missing-document reminders to the claimant (0 = no automatic reminder)', 'number'),
 ('motor_claims.participation', '{"fixed":2000,"percentOfSumInsured":0.5,"rule":"higher"}', 'claims', 'Motor claims: participation (deductible) of the insured per claim: fixed amount, percent of the sum insured and which applies (higher, lower, fixed, percent)', 'json'),
 ('motor_claims.parts_depreciation_percent', '0', 'claims', 'Motor claims: depreciation charged to the insured on replaced parts (percent of the parts amount)', 'number'),
 ('motor_claims.loa_validity_days', '30', 'claims', 'Motor claims: days a letter of authority stays valid', 'number'),
 ('motor_claims.loa_wording', $j$"Please proceed with the repair of the vehicle described below in accordance with the approved estimate. The amount payable by the insurer is net of the participation of the insured and any depreciation, which the insured settles with you before the release of the vehicle. Any additional work needs a supplementary estimate approved by the insurer's adjuster."$j$, 'claims', 'Motor claims: wording printed on the letter of authority', 'string'),
 ('payables.default_terms_days', '30', 'accounting', 'Accounts payable: days from the invoice date to the due date when the supplier has no terms', 'number'),
 ('payables.input_vat_code', '"VAT12-IN"', 'accounting', 'Accounts payable: input VAT tax code of VAT-registered suppliers', 'string'),
 ('payables.maker_checker', 'true', 'accounting', 'Accounts payable: supplier invoices are approved by another user (approve:payables) before they post', 'boolean'),
 ('fixed_assets.first_month', '"in-service-month"', 'accounting', 'Fixed assets: first month depreciated (in-service-month or next-month)', 'string'),
 ('fixed_assets.depreciation_in_month_end', 'true', 'accounting', 'Fixed assets: post the monthly depreciation as a step of the month-end close', 'boolean')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('email.template.claim_missing_documents', $j${"subject":"{{companyName}}: documents still needed for claim {{claimNumber}}","html":"<p>Dear {{claimantName}},</p><p>To process claim <b>{{claimNumber}}</b> on policy {{policyNumber}} we still need the following documents:</p><ul>{{missingList}}</ul><p>Please send them to us at your earliest convenience.</p><p>Thank you,<br/>{{companyName}}</p>"}$j$, 'email', 'E-mail: missing claim documents reminder to the claimant', 'json'),
 ('email.template.pdc_bounced', $j${"subject":"{{companyName}}: cheque {{chequeNumber}} was returned by the bank","html":"<p>Dear {{clientName}},</p><p>Your cheque no. <b>{{chequeNumber}}</b> of {{bankName}} dated {{chequeDate}} for {{currency}} {{amount}} was returned by the bank ({{reason}}). Please replace it at your earliest convenience to keep policy {{policyNumber}} in force.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: bounced post-dated cheque to the client', 'json'),
 ('email.template.cover_note', $j${"subject":"{{companyName}}: cover note {{coverNoteNumber}}","html":"<p>Dear {{clientName}},</p><p>Your insurance is in force under cover note <b>{{coverNoteNumber}}</b> from {{coverFrom}} to {{coverTo}} while the insurer issues the policy.</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: cover note sent to the client', 'json')
ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------- document numbering series
INSERT INTO document_numbering(code, name, module, prefix, description, created_by)
SELECT s.code, s.name, s.module, s.prefix, s.description, 'seed'
FROM (VALUES ('cover_note', 'Cover Note', 'policies', 'CVN', 'Cover note (binder) issued while the policy is pending'),
             ('pdc', 'Post-Dated Cheque', 'receipts', 'PDC', 'Post-dated cheque registered in the cheque register'),
             ('claim_loa', 'Letter of Authority', 'claims', 'LOA', 'Letter of authority to a repair shop (motor claims)'),
             ('claim_payment_voucher', 'Claim Payment Voucher', 'claims', 'CPV', 'Payment of a claim settlement to the claimant'),
             ('supplier_invoice', 'Supplier Invoice Voucher', 'accounting', 'APV', 'Accounts payable voucher of a supplier invoice'),
             ('supplier_payment', 'Supplier Payment', 'accounting', 'SPV', 'Payment to a supplier'),
             ('fixed_asset', 'Fixed Asset', 'accounting', 'FA', 'Fixed asset register number')) AS s(code, name, module, prefix, description)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------- scheduled jobs
INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('cover-note-expiry', 'Cover note expiry', 'Remind the owners of cover notes about to expire, expire the cover notes past their end date and link those whose policy was issued', '20 6 * * *', 'coverNoteExpiry', '{}', true),
 ('pdc-deposit-due', 'Post-dated cheques due', 'Tell Accounting which post-dated cheques are due for deposit within the deposit window', '25 6 * * *', 'pdcDepositDue', '{}', true),
 ('claim-document-reminders', 'Missing claim documents', 'E-mail claimants the documents still missing on their open claims, at the reminder interval', '35 6 * * *', 'claimDocumentReminders', '{}', true)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------- masters
INSERT INTO master_types(code, label, category, screen, storage, table_name, code_field, label_field, fields, unique_keys, allow_extra, sort_order, is_system, created_by) VALUES
 ('short-period-rate', 'Short-Period Rate', 'general', NULL, 'generic', NULL, 'code', 'description',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"maxDays","label":"Cover Up To (days in force)","type":"integer","required":true},{"name":"retainedPercent","label":"Premium Retained (% of annual premium)","type":"number","required":true},{"name":"description","label":"Description","type":"string","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 150, true, 'seed'),
 ('cancellation-reason', 'Cancellation Reason', 'general', NULL, 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Reason","type":"string","required":true},{"name":"initiatedBy","label":"Initiated By","type":"select","required":true,"options":["insured","insurer"]},{"name":"method","label":"Return Premium Method","type":"select","required":true,"options":["auto","pro-rata","short-period","flat"]},{"name":"description","label":"Description","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 151, true, 'seed'),
 ('claim-document-requirement', 'Claim Document Checklist', 'general', NULL, 'generic', NULL, 'code', 'documentName',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"lineOfBusiness","label":"Line of Business (* = all)","type":"string","required":true},{"name":"claimType","label":"Claim Type (* = all)","type":"string","required":true},{"name":"documentName","label":"Document","type":"string","required":true},{"name":"required","label":"Required","type":"boolean","required":false},{"name":"sortOrder","label":"Sort Order","type":"integer","required":false},{"name":"description","label":"Description","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 152, true, 'seed'),
 ('repair-shop', 'Repair Shop', 'general', NULL, 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Repair Shop","type":"string","required":true},{"name":"address","label":"Address","type":"text","required":false},{"name":"city","label":"City / Municipality","type":"string","required":false},{"name":"contactPerson","label":"Contact Person","type":"string","required":false},{"name":"phone","label":"Phone","type":"string","required":false},{"name":"email","label":"E-mail","type":"email","required":false},{"name":"tin","label":"TIN","type":"string","required":false},{"name":"accredited","label":"Accredited","type":"boolean","required":false},{"name":"accreditedInsurers","label":"Accredited By (insurers)","type":"text","required":false},{"name":"labourRatePerHour","label":"Labour Rate per Hour","type":"number","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 153, true, 'seed'),
 ('supplier', 'Supplier', 'finance', NULL, 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Supplier","type":"string","required":true},{"name":"tin","label":"TIN","type":"string","required":false},{"name":"address","label":"Registered Address","type":"text","required":false},{"name":"vatRegistered","label":"VAT Registered","type":"boolean","required":false},{"name":"ewtCode","label":"EWT Tax Code","type":"string","required":false},{"name":"paymentTermsDays","label":"Payment Terms (days)","type":"integer","required":false},{"name":"expenseAccount","label":"Default Expense Account","type":"string","required":false},{"name":"contactPerson","label":"Contact Person","type":"string","required":false},{"name":"email","label":"E-mail","type":"email","required":false},{"name":"phone","label":"Phone","type":"string","required":false},{"name":"bankName","label":"Bank","type":"string","required":false},{"name":"bankAccountNo","label":"Bank Account No.","type":"string","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 160, true, 'seed'),
 ('asset-class', 'Asset Class', 'finance', NULL, 'generic', NULL, 'code', 'name',
  $j$[{"name":"code","label":"Code","type":"string","required":true},{"name":"name","label":"Asset Class","type":"string","required":true},{"name":"usefulLifeMonths","label":"Useful Life (months)","type":"integer","required":true},{"name":"salvagePercent","label":"Salvage Value (% of cost)","type":"number","required":false},{"name":"assetAccount","label":"Asset Account","type":"string","required":true},{"name":"accumulatedAccount","label":"Accumulated Depreciation Account","type":"string","required":true},{"name":"expenseAccount","label":"Depreciation Expense Account","type":"string","required":true},{"name":"description","label":"Description","type":"text","required":false},{"name":"modifiedBy","label":"Modified By","type":"audit-user","required":false},{"name":"modifiedOn","label":"Modified On","type":"audit-date","required":false}]$j$,
  $j$[["code"]]$j$, false, 161, true, 'seed')
ON CONFLICT (code) DO NOTHING;

-- Short-period scale: premium retained by the insurer when the insured cancels, by the days the policy was in force
-- (annual policies; a shorter term is scaled to a year). The common Philippine non-life scale.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'short-period-rate', v.code, v.description, jsonb_build_object('code', v.code, 'maxDays', v.days, 'retainedPercent', v.pct, 'description', v.description), 'active', 'seed'
FROM (VALUES ('SP01', 31, 20, 'Not exceeding 1 month'), ('SP02', 61, 30, 'Not exceeding 2 months'), ('SP03', 92, 40, 'Not exceeding 3 months'),
             ('SP04', 122, 50, 'Not exceeding 4 months'), ('SP05', 153, 60, 'Not exceeding 5 months'), ('SP06', 183, 70, 'Not exceeding 6 months'),
             ('SP07', 214, 75, 'Not exceeding 7 months'), ('SP08', 244, 80, 'Not exceeding 8 months'), ('SP09', 275, 85, 'Not exceeding 9 months'),
             ('SP10', 305, 90, 'Not exceeding 10 months'), ('SP11', 336, 95, 'Not exceeding 11 months'), ('SP12', 366, 100, 'Exceeding 11 months')) AS v(code, days, pct, description)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'short-period-rate');

INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'cancellation-reason', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'initiatedBy', v.by, 'method', v.method, 'description', v.description), 'active', 'seed'
FROM (VALUES ('INSURED_REQUEST', 'Cancelled at the request of the insured', 'insured', 'auto', 'Short-period scale applies'),
             ('VEHICLE_SOLD', 'Insured property sold or transferred', 'insured', 'auto', 'Short-period scale applies'),
             ('REPLACED', 'Replaced by another policy', 'insured', 'auto', 'Short-period scale applies'),
             ('NON_PAYMENT', 'Non-payment of premium (premium warranty)', 'insurer', 'auto', 'Pro-rata on the days left'),
             ('INSURER_DECISION', 'Cancelled by the insurer', 'insurer', 'auto', 'Pro-rata on the days left'),
             ('NOT_TAKEN_UP', 'Not taken up (cancelled from inception)', 'insured', 'flat', 'Full premium returned'),
             ('DUPLICATE', 'Duplicate or issued in error', 'insurer', 'flat', 'Full premium returned')) AS v(code, name, by, method, description)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'cancellation-reason' AND lower(m.code) = lower(v.code));

-- Claim document checklist: lines of business MOTOR / FIRE / * (any), claim types as on the claim (* = any)
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'claim-document-requirement', v.code, v.doc, jsonb_build_object('code', v.code, 'lineOfBusiness', v.lob, 'claimType', v.ctype, 'documentName', v.doc, 'required', v.req, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('ALL-CLAIMFORM', '*', '*', 'Duly accomplished claim form', true, 10),
             ('ALL-POLICY', '*', '*', 'Copy of the policy and official receipt of premium', true, 20),
             ('ALL-ID', '*', '*', 'Valid government ID of the claimant', true, 30),
             ('MTR-LICENCE', 'MOTOR', '*', 'Driver''s licence and its official receipt (LTO)', true, 40),
             ('MTR-CR-OR', 'MOTOR', '*', 'Certificate of registration and official receipt of the vehicle (LTO)', true, 50),
             ('MTR-POLICE', 'MOTOR', '*', 'Police report or affidavit of the driver', true, 60),
             ('MTR-PHOTOS', 'MOTOR', '*', 'Photos of the damaged vehicle', true, 70),
             ('MTR-ESTIMATE', 'MOTOR', '*', 'Repair estimate of an accredited repair shop', true, 80),
             ('MTR-TP-CLAIM', 'MOTOR', 'Third Party', 'Third party''s claim letter and estimate', false, 90),
             ('MTR-THEFT-HPG', 'MOTOR', 'Theft', 'PNP-HPG alarm sheet and certificate of non-recovery', true, 100),
             ('MTR-THEFT-KEYS', 'MOTOR', 'Theft', 'Original and duplicate keys', true, 110),
             ('FIR-BFP', 'FIRE', '*', 'Fire investigation report of the Bureau of Fire Protection', true, 40),
             ('FIR-INVENTORY', 'FIRE', '*', 'Inventory and valuation of the property lost or damaged', true, 50),
             ('FIR-PHOTOS', 'FIRE', '*', 'Photos of the damage', true, 60),
             ('FIR-PROOF', 'FIRE', '*', 'Proof of ownership (invoices, title, books of account)', false, 70)) AS v(code, lob, ctype, doc, req, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'claim-document-requirement' AND lower(m.code) = lower(v.code));

-- Asset classes on the chart of accounts (Property and Equipment, Intangible Assets; depreciation and amortization expense)
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'asset-class', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'usefulLifeMonths', v.life, 'salvagePercent', 0,
  'assetAccount', v.asset, 'accumulatedAccount', v.acc, 'expenseAccount', v.exp), 'active', 'seed'
FROM (VALUES ('OFFICE-EQUIPMENT', 'Office equipment', 60, '1401001', '1402001', '4406001'),
             ('FURNITURE', 'Furniture and fixtures', 60, '1401002', '1402002', '4406001'),
             ('COMPUTER', 'Computer equipment', 36, '1401003', '1402003', '4406001'),
             ('VEHICLE', 'Transportation equipment', 60, '1401004', '1402004', '4406001'),
             ('LEASEHOLD', 'Leasehold improvements', 60, '1401005', '1402005', '4406002'),
             ('SOFTWARE', 'Computer software and licences', 36, '1403001', '1403002', '4406002')) AS v(code, name, life, asset, acc, exp)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'asset-class' AND lower(m.code) = lower(v.code));
