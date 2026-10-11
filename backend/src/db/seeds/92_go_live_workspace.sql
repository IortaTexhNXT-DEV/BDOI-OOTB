-- Templates of Data Migration & Go-Live (migration 0444), from the TISPH Data Migration and Cutover Plan:
--   go_live_runbook_steps  the runbook copied into the checklist of each new run (Runs, Cutover): the production
--                          migration sequence before the cutover (PC-1 to PC-8, plan section 12), the cutover runbook
--                          (CO-1 to CO-10, section 13.2), go-live floor support (GL-1) and hypercare (HC-1, HC-2,
--                          section 18), each with its owner, timetable slot, planning duration, evidence and the steps
--                          it waits for
--   go_live_criteria       the Go / No-Go criteria G1 to G11 (section 16) copied into each decision; G2 to G5 are never
--                          waived; auto_check names the check computed by data-load/decisions.js
-- Idempotent: a step or criterion is added only when its code is missing, so administrator changes are kept.

INSERT INTO go_live_runbook_steps(code, title, phase, owner_role, offset_label, duration_minutes, evidence_hint, depends_on, sort) VALUES
 ('PC-1', 'Production deployed with reference data only', 'pre-cutover', 'DevOps lead', 'Weeks before cutover', 480, 'Deployment record, restore test', '{}', 10),
 ('PC-2', 'Configuration loaded and authority limits approved', 'pre-cutover', 'System Administrator', 'Weeks before cutover', 240, 'Configuration load number', '{PC-1}', 20),
 ('PC-3', 'Environment comparison mirrored', 'pre-cutover', 'System Administrator', 'C-10 business days', 60, 'Comparison workbook', '{PC-2}', 30),
 ('PC-4', 'Users and sign-in ready', 'pre-cutover', 'TISPH IT', 'C-5 business days', 120, 'User list, sign-in history', '{PC-2}', 40),
 ('PC-5', 'Smoke test or dress rehearsal, then reset', 'pre-cutover', 'Migration lead', 'C-5 business days', 240, 'Reset log', '{PC-2}', 50),
 ('PC-6', 'Bank accounts reconcile-from date set', 'pre-cutover', 'Finance Head', 'C-3 business days', 30, NULL, '{PC-5}', 60),
 ('PC-7', 'Cutover date set and fiscal year open', 'pre-cutover', 'Finance Head', 'C-3 business days', 30, NULL, '{PC-5}', 70),
 ('PC-8', 'Schedules paused and e-mail off', 'pre-cutover', 'System Administrator', 'Before the load', 15, NULL, '{PC-5}', 80),
 ('CO-1', 'Legacy freeze', 'cutover', 'Operations and Finance leads', 'Saturday 17:30', 30, 'Freeze notice, last numbers used', '{PC-3,PC-4,PC-6,PC-7,PC-8}', 110),
 ('CO-2', 'Extract and control figures', 'cutover', 'Data owners', 'Saturday 18:00 to 22:00', 240, 'Extract files with row counts and checksums, signed control figures', '{CO-1}', 120),
 ('CO-3', 'Pre-load checks and restore point', 'cutover', 'DevOps lead', 'Saturday 22:00', 30, 'Cutover log with the restore time', '{CO-2}', 130),
 ('CO-4', 'Validate', 'cutover', 'Migration lead', 'Sunday 08:00 to 11:00', 180, 'Load numbers, errors files', '{CO-3}', 140),
 ('CO-5', 'Migrate', 'cutover', 'Migration lead', 'Sunday 11:00 to 12:00', 60, 'Load approved and loaded', '{CO-4}', 150),
 ('CO-6', 'Reconcile', 'cutover', 'Finance Head', 'Sunday 12:00 to 14:00', 120, 'Reconciliation report', '{CO-5}', 160),
 ('CO-7', 'Differences explained and accepted', 'cutover', 'Finance Head', 'Sunday 14:00', 30, 'Difference list with decisions', '{CO-6}', 170),
 ('CO-8', 'Business validation samples', 'cutover', 'Operations Unit Head', 'Sunday 14:00 to 16:00', 120, 'Signed sample sheets', '{CO-7}', 180),
 ('CO-9', 'Go / No-Go', 'cutover', 'Steering committee', 'Sunday 16:00', 30, 'Decision minute', '{CO-8}', 190),
 ('CO-10', 'Production: lock on, interfaces on, evidence archived', 'cutover', 'System Administrator', 'Sunday 16:30 to 18:00', 90, 'Lock approval, job list, archive reference', '{CO-9}', 200),
 ('GL-1', 'Go-live floor support', 'go-live', 'Hypercare team', 'Monday 08:30', 540, NULL, '{CO-10}', 310),
 ('HC-1', 'Hypercare daily checks', 'hypercare', 'Hypercare team', 'Daily from go-live', NULL, 'Hypercare log', '{GL-1}', 410),
 ('HC-2', 'Hypercare exit', 'hypercare', 'Project Sponsor', 'End of hypercare', 60, 'Hypercare exit sign-off', '{HC-1}', 420)
ON CONFLICT (code) DO NOTHING;

INSERT INTO go_live_criteria(code, title, evidence_hint, auto_check, waivable, sort) VALUES
 ('G1', 'UAT signed off by each process owner; no open severity 1 or 2 defect', 'UAT sign-off', NULL, true, 10),
 ('G2', 'Migration load of the production run loaded with no row in error and not with valid rows only', 'Load record', 'production-load', false, 20),
 ('G3', 'Trial balance, receivables control and sub-ledger tie-outs agree or their differences are accepted', 'Reconciliation report', 'reconciliation-checks', false, 30),
 ('G4', 'Every legacy control figure reconciled within its tolerance; reconciliation signed', 'Signed reconciliation report', 'reconciliation-signed', false, 40),
 ('G5', 'Business validation samples passed', 'Signed sample sheets', NULL, false, 50),
 ('G6', 'Configuration mirrored with UAT apart from environment-specific values', 'Comparison workbook', 'environment-mirrored', true, 60),
 ('G7', 'Users ready: demo accounts and SUPERID inactive, password sign-in off except break-glass', 'User list, sign-in history', 'users-ready', true, 70),
 ('G8', 'Numbering continues above every legacy number in every period, branch and line, and every COC series', 'Numbering export', 'numbering', true, 80),
 ('G9', 'Restore point noted and rollback team available', 'Cutover log', 'restore-point', true, 90),
 ('G10', 'Hypercare team and support contacts in place', 'Hypercare roster', NULL, true, 100),
 ('G11', 'Evidence pack of the production run archived', 'Archive reference', 'evidence-archived', true, 110)
ON CONFLICT (code) DO NOTHING;
