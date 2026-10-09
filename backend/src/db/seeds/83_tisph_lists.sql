-- TISPH lists of the Pre-BSM workbook on the masters of seed 77_lead_sources_reason_codes.sql: the lead sources (M07)
-- and the reason codes (M24) that have no master of their own. Runs on a new database and on every start of one in
-- use. Idempotent: a record is added only when its code is missing, so administrator changes are kept.

-- ---------------------------------------------------------------- M07 Channels & Source: lead sources
-- TISPH listed the sources of its leads in this sheet (not distribution channels: dealers and banks are the
-- Distribution Channels master). Linked office HO for every row; no default commission given.
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'lead-source', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'channelType', v.kind, 'branchCode', 'HO', 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('CL', 'Call', 'Direct', 10),
             ('WI', 'Walk-In', 'Direct', 20),
             ('REF', 'Referral', 'Direct', 30),
             ('CORP', 'Corporate', 'Direct', 40),
             ('SCR', 'Used-Cars - SCR', 'Bancassurance / Affinity', 50),
             ('UCFP', 'Used-Cars - UCFP', 'Bancassurance / Affinity', 60),
             ('CCAR', 'Company Car', 'Bancassurance / Affinity', 70),
             ('REDEEM', 'Redemption', 'Bancassurance / Affinity', 80),
             ('REN', 'Renewal', 'Direct', 90),
             ('PROMO', 'Promo', 'Bancassurance / Affinity', 100),
             ('AGNT', 'Agent', 'Direct', 110),
             ('CLI', 'Credit Life', 'Bancassurance / Affinity / Direct', 120),
             ('WEB', 'Social Media / Website', 'Digital', 130),
             ('BNDL', 'Bundling', 'Bancassurance / Affinity / Direct', 140)) AS v(code, name, kind, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'lead-source' AND lower(m.code) = lower(v.code));

-- ---------------------------------------------------------------- M24 Reason Codes: reasons without a master of their own
-- Every row of the sheet requires a note and is active. Cancellation reasons are the cancellation-reason master (seed
-- 80); WO-SMALL is a write-off reason (it needs its GL account and maximum amount, not in the workbook).
INSERT INTO master_records(type_code, code, name, data, status, created_by)
SELECT 'reason-code', v.code, v.name, jsonb_build_object('code', v.code, 'name', v.name, 'context', v.context, 'requiresNote', true, 'sortOrder', v.sort), 'active', 'seed'
FROM (VALUES ('DEC-RISK', 'Uninsurable Risk', 'decline', 10),
             ('DEC-UNDERWRITING', 'Outside Underwriting Guidelines', 'decline', 20),
             ('DEC-INCDOCS', 'Incomplete Information / Documents', 'decline', 30),
             ('DEC-CLAIMS', 'Claim-Related', 'decline', 40),
             ('DEC-CONDITIONS', 'Age or Condition of Asset', 'decline', 50),
             ('DEC-KYC', 'Compliance or KYC Requirement', 'decline', 60),
             ('DEC-FRAUD', 'Fraud Concern', 'decline', 70),
             ('DEC-WDREW', 'Customer Withdrew Application', 'decline', 80),
             ('DEC-OTHER', 'Other', 'decline', 90),
             ('DEC-LOAN', 'Loan Terms', 'decline', 100),
             ('REP-EXCL', 'Policy exclusion', 'repudiation', 110),
             ('REP-LATE', 'Late notification', 'repudiation', 120),
             ('REP-INACTIVE', 'Policy Not Active', 'repudiation', 130),
             ('REP-MISREP', 'Misrepresentation', 'repudiation', 140),
             ('REP-FRAUD', 'Fraudulent Claim', 'repudiation', 150),
             ('REP-DOCS', 'Insufficient Documents', 'repudiation', 160),
             ('REP-NOTPROVEN', 'Loss Not Proven', 'repudiation', 170),
             ('REP-NOTCOVERED', 'Cause of Loss Not Covered', 'repudiation', 180),
             ('REP-BREACH', 'Breach of Policy Condition', 'repudiation', 190),
             ('REP-COND', 'Pre-Existing Damage/Condition', 'repudiation', 200),
             ('REP-INSURINT', 'No Insurable Interest', 'repudiation', 210),
             ('REP-UNAUTHOR', 'Unauthorized Use/Activity', 'repudiation', 220),
             ('REP-OTHER', 'Other', 'repudiation', 230),
             ('LAP-FUNDS', 'Insufficient Funds', 'lapse', 240),
             ('LAP-PAYMENT', 'Customer Forgot Payment', 'lapse', 250),
             ('LAP-COV', 'Customer No Longer Needs Coverage', 'lapse', 260),
             ('LAP-SERVDISSAT', 'Service Dissatisfaction', 'lapse', 270),
             ('LAP-NONRENEW', 'Non-Renewal', 'lapse', 280),
             ('LAP-OTHER', 'Other', 'lapse', 290),
             ('REF-CANCEL', 'Cancellation refund', 'refund', 300),
             ('ADJ-RECON', 'Adjustment of Reconciled Revenue', 'adjustment', 310),
             ('NON-MAT', 'Policy did not occur', 'non-materialise', 320)) AS v(code, name, context, sort)
WHERE NOT EXISTS (SELECT 1 FROM master_records m WHERE m.type_code = 'reason-code' AND lower(m.code) = lower(v.code));
