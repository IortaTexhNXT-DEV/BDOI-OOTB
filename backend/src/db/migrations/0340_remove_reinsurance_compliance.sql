-- Reinsurance and the Compliance menu are withdrawn from this build.
--
-- Reinsurance: treaties, cessions, recoveries, bordereaux, reconciliations and facultative placements (migrations 0004,
-- 0043 and 0305) with their settings, number series, posting rules, masters (security ratings, report templates), the
-- cession register report and the read:reinsurance / write:reinsurance permissions.
-- Compliance: AML/CFT (risk rating, EDD, screening, transaction monitoring, cases and AMLC reports, 0261 to 0263), the
-- Insurance Commission registers (licences, fit and proper, insurer authority, complaints, IC annual statement, 0270
-- to 0274) and the NPC breach register (0273), with their settings, number series, scheduled jobs, the read / write /
-- approve permissions of aml, compliance and complaints and the Compliance Officer role.
--
-- Kept: client onboarding and KYC (the client columns of 0260, client_signatories, client_beneficial_owners,
-- client_kyc_documents), the data privacy registers (0221) and the IC licence fields of the insurer and company masters.
-- The beneficial ownership threshold of onboarding becomes clients.beneficial_owner_threshold. GL accounts of
-- reinsurance stay where something was posted to them and are made inactive otherwise.

-- tables, children first
DROP TABLE IF EXISTS fac_settlements;
DROP TABLE IF EXISTS fac_placement_shares;
DROP TABLE IF EXISTS fac_placements;
DROP TABLE IF EXISTS reinsurance_exceptions;
DROP TABLE IF EXISTS reinsurance_reconciliations;
DROP TABLE IF EXISTS reinsurance_bordereaux;
DROP TABLE IF EXISTS reinsurance_recoveries;
DROP TABLE IF EXISTS cessions;
DROP TABLE IF EXISTS reinsurance_treaties;
DROP TABLE IF EXISTS reinsurers;

DROP TABLE IF EXISTS aml_report_items;
DROP TABLE IF EXISTS aml_reports;
DROP TABLE IF EXISTS aml_alerts;
DROP TABLE IF EXISTS aml_rules;
DROP TABLE IF EXISTS aml_provider_requests;
DROP TABLE IF EXISTS aml_screening_hits;
DROP TABLE IF EXISTS aml_cases;
DROP TABLE IF EXISTS aml_screenings;
ALTER TABLE IF EXISTS aml_screening_lists DROP CONSTRAINT IF EXISTS aml_screening_lists_current_version_fk;
DROP TABLE IF EXISTS aml_list_entries;
DROP TABLE IF EXISTS aml_list_versions;
DROP TABLE IF EXISTS aml_screening_lists;
DROP TABLE IF EXISTS aml_edd_reviews;
DROP TABLE IF EXISTS aml_risk_assessments;
DROP TABLE IF EXISTS aml_risk_factors;

DROP TABLE IF EXISTS compliance_licence_reminders;
DROP TABLE IF EXISTS compliance_licences;
DROP TABLE IF EXISTS compliance_fit_proper;
DROP TABLE IF EXISTS complaint_reminders;
DROP TABLE IF EXISTS complaints;
DROP TABLE IF EXISTS ic_statement_lines;
DROP TABLE IF EXISTS personal_data_breach_reminders;
DROP TABLE IF EXISTS personal_data_breaches;

-- client KYC: the status follows the identification only (no rating, screening or EDD any more); documents filed
-- against an EDD review stay with the client
UPDATE clients SET kyc_status = 'pending' WHERE kyc_status IN ('edd-required', 'refresh-due', 'blocked');
UPDATE client_kyc_documents SET related_type = 'client', related_id = NULL WHERE related_type = 'edd';

-- settings
INSERT INTO app_settings(key, value, "group", label, type)
SELECT 'clients.beneficial_owner_threshold', COALESCE((SELECT a.value FROM app_settings a WHERE a.key IN ('aml.beneficial_owner_threshold')), '25'::jsonb), 'clients',
  'Ownership percentage from which a natural person is a beneficial owner of a juridical client (onboarding)', 'number'
ON CONFLICT (key) DO NOTHING;

DELETE FROM app_settings
 WHERE "group" IN ('aml', 'compliance', 'complaints', 'reinsurance')
    OR key LIKE 'aml.%' OR key LIKE 'compliance.%' OR key LIKE 'complaints.%' OR key LIKE 'reinsurance.%'
    OR key IN ('privacy.breach_notify_hours', 'privacy.breach_reminder_hours', 'privacy.breach_data_categories', 'housekeeping.aml_provider_requests_days',
      'accounting.account.ri_premium_receivable', 'accounting.account.due_to_reinsurer', 'accounting.account.due_from_reinsurer',
      'accounting.account.ri_recovery_payable', 'accounting.account.ri_commission_income');
UPDATE app_settings SET value = value - 'reinsurance', updated_at = now() WHERE key = 'system.group_labels' AND value ? 'reinsurance';

-- number series
DELETE FROM app_settings WHERE key IN ('numbering.reinsurer.prefix', 'numbering.treaty.prefix', 'numbering.cession.prefix', 'numbering.ri_recovery.prefix',
  'numbering.bordereau.prefix', 'numbering.ri_reconciliation.prefix', 'numbering.fac_slip.prefix', 'numbering.aml_edd.prefix', 'numbering.aml_alert.prefix',
  'numbering.aml_case.prefix', 'numbering.aml_report.prefix', 'numbering.complaint.prefix', 'numbering.data_breach.prefix');
DELETE FROM sequences WHERE name IN ('reinsurer', 'treaty', 'cession', 'ri_recovery', 'bordereau', 'ri_reconciliation', 'fac_slip', 'aml_edd', 'aml_alert',
  'aml_case', 'aml_report', 'complaint', 'data_breach');
DELETE FROM document_numbering WHERE code IN ('reinsurer', 'treaty', 'cession', 'ri_recovery', 'bordereau', 'ri_reconciliation', 'fac_slip', 'aml_edd', 'aml_alert',
  'aml_case', 'aml_report', 'complaint', 'data_breach');

-- posting rules: removed unless a journal voucher or an approved configuration change names them (then switched off)
UPDATE posting_rules r SET active = false, updated_at = now()
 WHERE r.event_code LIKE 'ri.%' AND r.active
   AND (EXISTS (SELECT 1 FROM journal_vouchers j WHERE j.posting_rule_id = r.id) OR EXISTS (SELECT 1 FROM accounting_config_changes c WHERE c.rule_id = r.id));
DELETE FROM posting_rules r
 WHERE r.event_code LIKE 'ri.%'
   AND NOT EXISTS (SELECT 1 FROM journal_vouchers j WHERE j.posting_rule_id = r.id)
   AND NOT EXISTS (SELECT 1 FROM accounting_config_changes c WHERE c.rule_id = r.id);

-- GL accounts of reinsurance: inactive where nothing was posted (the chart of accounts mirror follows)
UPDATE gl_accounts a SET status = 'inactive', updated_at = now()
 WHERE a.code IN ('1203003', '1203004', '2201005', '2205004', '3201003') AND a.status = 'active'
   AND NOT EXISTS (SELECT 1 FROM journal_lines l WHERE l.account_code = a.code)
   AND NOT EXISTS (SELECT 1 FROM opening_balances o WHERE o.account_code = a.code);
UPDATE master_records m SET status = 'inactive', updated_at = now()
 WHERE m.type_code IN ('main-account', 'sub-account') AND m.status = 'active'
   AND EXISTS (SELECT 1 FROM gl_accounts a WHERE a.code = m.code AND a.status = 'inactive' AND a.code IN ('1203003', '1203004', '2201005', '2205004', '3201003'));

-- scheduled jobs
DELETE FROM scheduled_jobs WHERE code IN ('aml-transaction-monitoring', 'aml-kyc-refresh-due', 'aml-provider-retry', 'compliance-reminders',
  'complaints-deadlines', 'privacy-breach-deadlines');
UPDATE scheduled_jobs SET description = replace(description, 'EIS submissions, AML provider requests and go-live workbook rows', 'EIS submissions and go-live workbook rows')
 WHERE code = 'housekeeping' AND description LIKE '%AML provider requests%';

-- masters and the cession register report
DELETE FROM master_records WHERE type_code IN ('security-rating', 'reinsurance-report-template');
DELETE FROM master_types WHERE code IN ('security-rating', 'reinsurance-report-template');
DELETE FROM report_schedules WHERE report_code = 'cession-register';
DELETE FROM report_definitions WHERE code = 'cession-register';

-- the Compliance Officer role: its users keep working as Operations
INSERT INTO user_roles(user_id, role_id)
SELECT ur.user_id, o.id FROM user_roles ur JOIN roles r ON r.id = ur.role_id JOIN roles o ON o.code = 'operations'
 WHERE r.code = 'compliance-officer'
ON CONFLICT DO NOTHING;
UPDATE report_definitions SET roles = array_remove(roles, 'compliance-officer') WHERE 'compliance-officer' = ANY(roles);
UPDATE report_builder_reports SET shared_roles = array_remove(shared_roles, 'compliance-officer') WHERE 'compliance-officer' = ANY(shared_roles);
UPDATE roles SET inherits = array_remove(inherits, 'compliance-officer') WHERE 'compliance-officer' = ANY(inherits);
DELETE FROM roles WHERE code = 'compliance-officer';

-- permissions (role grants go with them)
DELETE FROM permissions WHERE module IN ('aml', 'compliance', 'complaints', 'reinsurance')
   OR code IN ('read:aml', 'write:aml', 'approve:aml', 'read:compliance', 'write:compliance', 'read:complaints', 'write:complaints', 'approve:complaints',
     'read:reinsurance', 'write:reinsurance');
