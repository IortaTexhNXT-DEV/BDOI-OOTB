-- TISPH configuration from the Pre-BSM discovery workbook (iNXT Broker Suite Consolidated Pre-BSM Discovery v2.0, TISPH
-- panel of each sheet; sheet names below). Runs after the reference seeds, on a new database and on every start of an
-- existing one. Idempotent: a row is added only when missing, and a value of the reference seeds is replaced only while
-- it is still the reference value and nobody has changed it (updated_by empty), so administrator changes are kept.
-- Items the workbook leaves empty, ambiguous or in conflict with the BRD are not loaded here.

-- ---------------------------------------------------------------- M01 Broker Profile: company, letterhead, fiscal year
-- Registered entity, TIN and address of the default issuing office. The workbook's "IC broker licence" is the SEC
-- company registration number, so it is kept in the description, not in the licence field. Created by "system" like the
-- out-of-the-box company: the companies created by "seed" are demo data that the sample purge removes.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'company', 'TISPH', 'Toyota Insurance Services Philippines Corporation',
       jsonb_build_object('CompanyCode', 'TISPH', 'CompanyName', 'Toyota Insurance Services Philippines Corporation', 'LicenseNumber', '',
         'TIN', '685-442-861-00000', 'RDOCode', '', 'EmailID', '', 'PhoneNumber', '', 'Fax', '', 'Logo', '', 'Websitelink', '',
         'Description', 'SEC Company Reg. No. 2025090218085-01. Parent: Toyota Financial Services Philippines (TFSPH)',
         'AddressLine1', '27F GT TOWER INTERNATIONAL', 'AddressLine2', 'AYALA AVE. COR H V DELA COSTA ST.', 'AddressLine3', 'SALCEDO VILLAGE',
         'PinCode', '', 'City', 'Makati City', 'State', 'Metro Manila', 'Country', 'Philippines', 'IsPrimary', false),
       'active', 'system'
WHERE NOT EXISTS (SELECT 1 FROM master_records WHERE type_code = 'company' AND lower(code) = 'tisph');

-- TISPH becomes the letterhead company in place of the out-of-the-box company, unless an administrator has chosen one
-- (a change made by enabling a brand pack does not count: the pack only put its document logo on it).
UPDATE master_records m SET data = m.data || jsonb_build_object('IsPrimary', m.code = 'TISPH'), updated_at = now()
 WHERE m.type_code = 'company' AND m.code IN ('ITX', 'TISPH')
   AND EXISTS (SELECT 1 FROM master_records i WHERE i.type_code = 'company' AND i.code = 'ITX' AND i.status = 'active'
                 AND lower(COALESCE(i.data->>'IsPrimary', 'false')) IN ('true', 'yes', '1')
                 AND (i.updated_by IS NULL OR EXISTS (SELECT 1 FROM brand_pack_enablements e WHERE e.status = 'enabled'
                        AND e.previous->>'companyId' = i.id::text AND e.enabled_by_user_id = i.updated_by)))
   AND EXISTS (SELECT 1 FROM master_records t WHERE t.type_code = 'company' AND t.code = 'TISPH' AND t.status = 'active' AND t.updated_by IS NULL);

-- A brand pack in force put its document logo on the company that was the letterhead before (BRAND_PACK is enabled
-- once per environment, so it is not applied again): the logo moves to TISPH, the earlier company gets its own logo
-- back, and the enablement now records TISPH, so Back to default removes the pack logo from TISPH.
WITH moved AS (
  SELECT e.id AS enablement_id, e.previous->>'documentLogo' AS previous_logo, p.id AS previous_id, p.data->>'Logo' AS logo, t.id AS tisph_id
    FROM brand_pack_enablements e
    JOIN master_records p ON p.type_code = 'company' AND e.previous->>'companyId' = p.id::text
    JOIN master_records t ON t.type_code = 'company' AND t.code = 'TISPH' AND t.status = 'active'
   WHERE e.status = 'enabled' AND e.applied ? 'documentLogo' AND p.id <> t.id
     AND lower(COALESCE(t.data->>'IsPrimary', 'false')) IN ('true', 'yes', '1') AND COALESCE(t.data->>'Logo', '') = ''
     AND COALESCE(p.data->>'Logo', '') <> '' AND p.data->>'Logo' IS DISTINCT FROM e.previous->>'documentLogo'
), to_tisph AS (
  UPDATE master_records m SET data = m.data || jsonb_build_object('Logo', moved.logo), updated_at = now() FROM moved WHERE m.id = moved.tisph_id RETURNING m.id
), back AS (
  UPDATE master_records m SET data = CASE WHEN moved.previous_logo IS NULL THEN m.data - 'Logo' ELSE m.data || jsonb_build_object('Logo', moved.previous_logo) END,
         updated_at = now()
    FROM moved WHERE m.id = moved.previous_id RETURNING m.id
)
UPDATE brand_pack_enablements e SET previous = e.previous || jsonb_build_object('companyId', moved.tisph_id, 'documentLogo', NULL)
  FROM moved WHERE e.id = moved.enablement_id;

UPDATE app_settings SET value = to_jsonb(c.name), updated_at = now()
  FROM master_records c
 WHERE app_settings.key = 'general.company_name' AND app_settings.value = '"iorta TechNXT Corp."' AND app_settings.updated_by IS NULL
   AND c.type_code = 'company' AND c.code = 'TISPH' AND c.status = 'active' AND lower(COALESCE(c.data->>'IsPrimary', 'false')) = 'true';

-- Financial year April to March (M01 row 7, M32, BRD). A fiscal calendar already generated on the January start is
-- rebuilt while nothing has been closed in it: its fiscal years and adjustment periods are dropped and generated again
-- on the April start when next needed; the monthly periods keep their codes and status (a soft close stays). Once a
-- period or a year has been closed, closing entries or opening balances exist, the calendar is left as it is with a
-- warning in the start-up log, for Finance to decide.
DO $$
DECLARE blocker text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'accounting.fiscal_year_start_month' AND value = '1' AND updated_by IS NULL) THEN
    RETURN;
  END IF;
  SELECT CASE
           WHEN EXISTS (SELECT 1 FROM accounting_periods WHERE status IN ('closed', 'locked')) THEN 'a period is closed or locked'
           WHEN EXISTS (SELECT 1 FROM period_status_history WHERE to_status IN ('closed', 'locked')) THEN 'a period has been closed before'
           WHEN EXISTS (SELECT 1 FROM fiscal_years WHERE status <> 'open') THEN 'a fiscal year is being closed or is closed'
           WHEN EXISTS (SELECT 1 FROM year_end_runs) THEN 'a year-end close has been run'
           WHEN EXISTS (SELECT 1 FROM journal_vouchers WHERE period ~ '-13$') THEN 'closing entries exist'
           WHEN EXISTS (SELECT 1 FROM opening_balances) THEN 'opening balances are loaded'
         END INTO blocker;
  IF blocker IS NOT NULL THEN
    RAISE WARNING 'TISPH fiscal year April to March not applied: the fiscal calendar starts in January and % (accounting.fiscal_year_start_month stays 1)', blocker;
    RETURN;
  END IF;
  UPDATE accounting_periods SET fiscal_year = NULL, updated_at = now() WHERE fiscal_year IS NOT NULL;
  DELETE FROM accounting_periods WHERE is_adjustment;
  DELETE FROM fiscal_years;
  UPDATE period_close_runs SET fiscal_year = 'FY' || (left(period, 4)::int + CASE WHEN right(period, 2)::int >= 4 THEN 1 ELSE 0 END), updated_at = now()
   WHERE period ~ '^\d{4}-\d{2}$';
  UPDATE app_settings SET value = '4', updated_at = now() WHERE key = 'accounting.fiscal_year_start_month';
END $$;

-- ---------------------------------------------------------------- M02 Offices & Branches: Head Office
-- One office (M01 row 12). BR02 is a placeholder row. Region and "Issuing Office" have no field on the Branch master.
UPDATE branches SET address = '27F GT TOWER INTERNATIONAL',
       attrs = attrs || jsonb_build_object('AddressLine2', 'AYALA AVE. COR H V DELA COSTA ST.', 'AddressLine3', 'SALCEDO VILLAGE')
         || CASE WHEN attrs->>'City' = 'Makati' THEN '{"City": "Makati City"}'::jsonb ELSE '{}'::jsonb END
         || CASE WHEN attrs->>'CompanyName' = 'iorta TechNXT Corp.' THEN '{"CompanyName": "Toyota Insurance Services Philippines Corporation"}'::jsonb ELSE '{}'::jsonb END,
       updated_at = now()
 WHERE code = 'HO' AND address = 'Makati City' AND updated_by IS NULL;

-- ---------------------------------------------------------------- M03 Departments
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'department', v.code, v.name, jsonb_build_object('DepartmentCode', v.code, 'DepartmentName', v.name, 'BranchCode', 'HO'), 'active', 'seed'
FROM (VALUES ('10', 'TIS Sales'), ('20', 'TIS Operations'), ('30', 'Finance and General Accounting'), ('40', 'IT / Admin'), ('50', 'Cash Control')) AS v(code, name)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'department' AND lower(m.code) = lower(v.code));
-- the sample departments of the product (Underwriting, Reinsurance, Claims ...) are not TISPH's: inactive, so that no
-- form offers them; the transaction codes of Finance name TISPH's Finance department. A row an administrator changed is kept.
UPDATE master_records SET status = 'inactive', updated_at = now()
 WHERE type_code = 'department' AND code IN ('SLS', 'UW', 'CLM', 'FIN', 'CS', 'IT', 'RI', 'CMP') AND status = 'active' AND updated_by IS NULL;
UPDATE master_records SET data = data || '{"DepartmentCode": "30"}'::jsonb, updated_at = now()
 WHERE type_code = 'transaction-code' AND data->>'DepartmentCode' = 'FIN' AND updated_by IS NULL;

-- ---------------------------------------------------------------- M04 Insurer Panel
-- Panel: AXA, Malayan, Standard, Stronghold, Pioneer and Maagap, all active. AXA under its registered name. Contacts are
-- not in the workbook; "Credit Days" is not loaded (premium warranty or remittance term is still to be confirmed).
UPDATE insurance_companies SET name = 'AXA Philippines Life and General Insurance Corporation', updated_at = now()
 WHERE code = 'AXA' AND name = 'AXA Philippines' AND updated_by IS NULL;
UPDATE insurance_companies SET status = 'active', updated_at = now()
 WHERE code = 'STRONGHOLD' AND status = 'inactive' AND updated_by IS NULL;

-- ---------------------------------------------------------------- M28 Class & Sub-Class: policy types
-- Sub-classes of the Phase 1 products that have no policy type yet. Motor classes (PC, CV, MC) stay the tariff vehicle
-- classes; individual PA and travel keep the policy types they have.
INSERT INTO policy_types(product_id, code, name, attrs, created_by)
SELECT p.id, v.code, v.name, jsonb_build_object('policyTypeDescription', v.description), 'seed'
FROM (VALUES ('GPA', 'GRP-STD', 'Standard', 'Group PA (class PA-GRP)'),
             ('CL-VOL', 'DT-SP', 'Single Premium', 'Credit Life Voluntary (class CL-DT)'),
             ('PARCEL', 'PCL-OPN', 'Open Policy', 'Parcel / Courier (class MAR-PCL)')) AS v(product, code, name, description)
JOIN products p ON p.code = v.product
WHERE NOT EXISTS (SELECT 1 FROM policy_types t WHERE t.code = v.code);

-- ---------------------------------------------------------------- M13 Claim Nature & Cause
-- Causes of loss (nature - cause) of the Phase 1 lines: Motor M001-M007, Personal Accident PA001-PA005, Credit Life
-- CL001, Marine Cargo MC001-MC006 (Parcel / Courier). The other lines keep the reference list.
UPDATE app_settings SET value = value || $j${
  "MOTOR": ["Own Damage - Collision / Accident", "Theft", "Third Party Property Damage - Collision / Accident", "Personal Accident - Accident",
            "Acts of God - Flood / Typhoon / Earthquake", "Third Party Liability - Accident", "Bodily Injury - Accident"],
  "ACCIDENT": ["Death", "Disability", "Bodily Injury / Medical", "Travel Inconvenience", "Personal Liability"],
  "LIFE": ["Death - Natural Causes / Illness"],
  "MARINE": ["Cargo Loss - Theft / Non-Delivery", "Cargo Damage - Water / Heavy Weather", "Cargo Damage - Fire", "Cargo Damage - Breakage",
             "Cargo Loss / Damage - Collision / Grounding", "General Average - Marine Peril"]}$j$::jsonb,
       updated_at = now()
 WHERE key = 'claims.loss_causes' AND updated_by IS NULL
   AND value = $j${"FIRE": ["Fire", "Flood", "Typhoon", "Earthquake", "Lightning", "Other"], "MOTOR": ["Collision", "Theft / carnapping", "Fire", "Flood / typhoon", "Third-party liability", "Glass / windshield damage", "Other"], "MARINE": ["Loss in transit", "Water damage", "Theft / pilferage", "General average", "Other"], "default": ["Accident", "Fire", "Natural catastrophe", "Theft", "Other"], "ACCIDENT": ["Accidental injury", "Accidental death", "Medical reimbursement", "Other"]}$j$::jsonb;

-- ---------------------------------------------------------------- M14 Document Checklist: claims
-- Claim documents of Credit Life (LIFE), Motor, Personal Accident (ACCIDENT), Marine (Parcel / Courier) and "All" (*).
-- Code M14-<workbook row>. Duplicate rows 34 (Proof of Ownership) and 77 (Commercial Invoice) are left out. The e-Sign
-- column has no field.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'claim-document-requirement', v.code, v.doc, jsonb_build_object('code', v.code, 'lineOfBusiness', v.lob, 'claimType', '*', 'documentName', v.doc, 'required', v.req, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES
 ('M14-010', 'LIFE', 'Claim Statement Form - Beneficiary', true, 100),
 ('M14-011', 'LIFE', 'Notice of Default', true, 110),
 ('M14-012', 'LIFE', 'Attending Physician Statement for Contestable Claims', true, 120),
 ('M14-013', 'LIFE', 'Statement of Account', true, 130),
 ('M14-014', 'LIFE', 'Medical Records', true, 140),
 ('M14-015', '*', 'Valid ID of Claimant', true, 150),
 ('M14-016', 'LIFE', 'Valid ID of Assured', true, 160),
 ('M14-017', 'LIFE', 'Birth Certificate of Assured', true, 170),
 ('M14-018', 'LIFE', 'Marriage Certificate (If Applicable)', true, 180),
 ('M14-019', 'MOTOR', 'Claim Form', true, 190),
 ('M14-020', '*', 'Policy', true, 200),
 ('M14-021', 'MOTOR', 'Valid Government ID of Insured/Claimant', true, 210),
 ('M14-022', 'MOTOR', 'Proof of Loss / Incident Report', true, 220),
 ('M14-023', '*', 'Photos / Videos of Loss or Damage', true, 230),
 ('M14-024', '*', 'Police Report', true, 240),
 ('M14-025', 'MOTOR', 'Official Receipts / Invoices', true, 250),
 ('M14-026', 'MOTOR', 'Bank Account Details', true, 260),
 ('M14-027', 'MOTOR', 'Authorization Letter', true, 270),
 ('M14-028', '*', 'Affidavit / Sworn Statement', true, 280),
 ('M14-029', 'MOTOR', 'OR/CR', true, 290),
 ('M14-030', 'MOTOR', 'Driver''s License', true, 300),
 ('M14-031', '*', 'Repair Estimate', true, 310),
 ('M14-032', 'MOTOR', 'Stencils / Engine & Chassis Details', true, 320),
 ('M14-033', 'MOTOR', 'Proof of Ownership', true, 330),
 ('M14-035', 'MOTOR', 'Third-party driver''s license', true, 350),
 ('M14-036', 'MOTOR', 'Third-party OR/CR', true, 360),
 ('M14-037', 'MOTOR', 'Photos of all vehicles involved', true, 370),
 ('M14-038', 'MOTOR', 'Affidavit of Theft', true, 380),
 ('M14-039', 'MOTOR', 'Photos of missing/damaged parts', true, 390),
 ('M14-040', 'MOTOR', 'Evidence of the occurrence/event, if requested', true, 400),
 ('M14-046', 'ACCIDENT', 'PA Claim Forms', true, 460),
 ('M14-047', 'ACCIDENT', 'Death Certificate', true, 470),
 ('M14-048', 'ACCIDENT', 'Medical Certificate', true, 480),
 ('M14-049', 'ACCIDENT', 'Autopsy/Post-Mortem Report', true, 490),
 ('M14-050', 'ACCIDENT', 'Proof of relationship', true, 500),
 ('M14-051', 'ACCIDENT', 'Beneficiary documents', true, 510),
 ('M14-075', 'MARINE', 'Marine Claim Form', true, 750),
 ('M14-076', 'MARINE', 'Commercial Invoice', true, 760),
 ('M14-078', 'MARINE', 'Packing List', true, 780),
 ('M14-079', 'MARINE', 'Delivery Receipt', true, 790),
 ('M14-080', 'MARINE', 'Arrival Notice', true, 800),
 ('M14-081', 'MARINE', 'Import/Export Documents', true, 810),
 ('M14-082', 'MARINE', 'Survey Report', true, 820),
 ('M14-083', 'MARINE', 'Photos of Damaged Cargo', true, 830),
 ('M14-084', 'MARINE', 'Damage/Loss Report', true, 840),
 ('M14-085', 'MARINE', 'Short Landing Certificate, if applicable', true, 850),
 ('M14-086', 'MARINE', 'Warehouse Receipt, if applicable', true, 860),
 ('M14-087', 'MARINE', 'Customs Documents, if applicable', true, 870),
 ('M14-088', 'MARINE', 'Salvage Documentation, if applicable', true, 880),
 ('M14-089', 'MARINE', 'Repair/Replacement Quotation', true, 890),
 ('M14-090', 'MARINE', 'Proof of Value', true, 900),
 ('M14-091', 'MARINE', 'Proof of Claim against Carrier, if applicable', true, 910)) AS v(code, lob, doc, req, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'claim-document-requirement' AND lower(m.code) = lower(v.code));

-- The TISPH checklist replaces the reference checklist of Motor and of every line (*); unchanged reference rows only.
UPDATE master_records SET status = 'inactive', updated_at = now()
 WHERE type_code = 'claim-document-requirement' AND status = 'active' AND created_by = 'seed' AND updated_by IS NULL
   AND data->>'lineOfBusiness' IN ('*', 'MOTOR') AND code NOT LIKE 'M14-%';

-- ---------------------------------------------------------------- M24 Reason Codes: cancellation
-- Reasons whose wording says who cancels; the return premium follows the initiator (method auto). CAN-DUP, CAN-NONDISCL,
-- CAN-CLAIMRLTD, CAN-COMPL, CAN-POLDETAILS and CAN-OTHER do not say who initiates them; CAN-QUOT has no Active flag.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'cancellation-reason', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'initiatedBy', v.by, 'method', 'auto', 'description', 'A note is required'), 'active', 'seed'
FROM (VALUES ('CAN-NONPAY', 'Non-payment of premium', 'insurer'),
             ('CAN-CLT', 'Customer Initiated', 'insured'),
             ('CAN-NOTREQ', 'Cover No Longer Required', 'insured'),
             ('CAN-INS', 'Insurer-Initiated', 'insurer'),
             ('CAN-CHANGEINS', 'Change of Insurer', 'insured'),
             ('CAN-CHANGEVHCL', 'Vehicle Sold/Changed', 'insured'),
             ('CAN-PREMIUM', 'Premium Too Expensive', 'insured')) AS v(code, name, by)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'cancellation-reason' AND lower(m.code) = lower(v.code));

-- ---------------------------------------------------------------- M19 Bank & Payment Modes, M20 payment methods
-- M19 modes with their capture channel (CASH is a reference row already). FIN, OFFSET and REFUND have no capture
-- channel. From M20 only the methods M19 does not cover under another code (OFT, CC, CP and E-WT are M19's EFT, CARD,
-- CHCK and E-WALLET; PDC is a reference row; CI has no capture channel). M19 bank accounts are placeholders.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'payment-mode', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'channel', v.channel, 'description', v.description, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('EFT', 'Bank Transfer / EFT', 'bank-transfer', 'Electronic; clearing 2 days (M19)', 110),
             ('CARD', 'Card / Online', 'card', 'Card / gateway; clearing 1 day (M19)', 120),
             ('CHCK', 'Check', 'check', 'Check; clearing 2 days (M19)', 130),
             ('E-WALLET', 'E-WALLET', 'online', 'E-wallet; clearing 3 days (M19)', 140),
             ('OTC', 'Over-the-Counter Bank', 'bank-transfer', 'Immediate (M20)', 150),
             ('MC', 'Managers Cheque', 'check', 'Immediate (M20)', 160),
             ('ADA', 'Auto Debit Arrangement', 'bank-transfer', '0 to 90 days (M20)', 170)) AS v(code, name, channel, description, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'payment-mode' AND lower(m.code) = lower(v.code));
