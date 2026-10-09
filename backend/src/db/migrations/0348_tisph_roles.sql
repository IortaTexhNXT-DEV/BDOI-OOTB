-- TISPH roles of the Pre-BSM workbook, sheet M17 RBAC v4 (13 TIS personas of the screen matrix and SUPERID for user
-- acceptance testing), and the approval permissions of the front office they need.
--
-- Client decision on the makers: Sales and Operations both raise quotations, placements, policies, endorsements and
-- renewals (write); the approval is another user's (maker-checker, unchanged) holding the approval permission:
--   approve:quotations   approving a quotation (status Approved)
--   approve:policies     deciding the check of a placement against the slip (confirm, accept differences, return)
--   approve:renewals     approving or returning renewal terms
--   approve:claims       claim decisions: review, reject (repudiation), settle, settlement approval, close
-- The roles that made these decisions before keep them: Sales & Marketing, the Processing Team and Operations (they
-- held write:quotations / write:renewals) and Claims (the claim decisions were the Claims role's).
--
-- The CCD persona named CCD-PDC in the screen matrix is CCD-ADA in the department table of the same sheet: one role
-- (tis-ccd-pdc) whose name and description carry both labels. The permission sets are those of db/seed.js
-- (ROLE_PERMS); on a new database the seed creates the roles, here they are added to a database in use. Roles and
-- grants already present are kept. Idempotent.

INSERT INTO permissions(code, module, description) VALUES
 ('approve:quotations', 'quotations', 'Approve a quotation created by another user (maker-checker)'),
 ('approve:policies', 'policies', 'Decide the check of a placement against the slip (confirm, accept differences, return to the insurer); not the user who recorded the e-policy'),
 ('approve:renewals', 'renewals', 'Approve or return renewal terms submitted by another user (maker-checker)'),
 ('approve:claims', 'claims', 'Claim decisions: review, reject (repudiation), settle, approve a settlement, close')
ON CONFLICT (code) DO NOTHING;

-- Users of the roles that gain a permission get a new token version (the permissions travel in the access token);
-- only on the first run, while the Claims role does not hold approve:claims yet.
UPDATE users SET token_version = token_version + 1
 WHERE id IN (SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.code IN ('sales', 'processing', 'operations', 'claims'))
   AND NOT EXISTS (SELECT 1 FROM roles r JOIN role_permissions rp ON rp.role_id = r.id JOIN permissions p ON p.id = rp.permission_id
                    WHERE r.code = 'claims' AND p.code = 'approve:claims');

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE (r.code IN ('sales', 'processing', 'operations', 'system-admin') AND p.code IN ('approve:quotations', 'approve:policies', 'approve:renewals'))
   OR (r.code IN ('claims', 'system-admin') AND p.code = 'approve:claims')
ON CONFLICT DO NOTHING;

-- On a new database the roles table is still empty here: the seed creates every role, in its order.
INSERT INTO roles(code, name, description, is_system)
SELECT v.code, v.name, v.description, v.is_system FROM (VALUES
 ('tis-sales-associate', 'TIS Sales Associate', 'RBAC v4 Sales Associate: leads, clients, quotations, placements, policies, endorsements and renewals (maker, no approval); reads claims, billing, receipting and commission', false),
 ('tis-sales-officer', 'TIS Sales Officer', 'RBAC v4 Sales Officer (also the Corporate Sales Officers of the user list): as the Sales Associate, plus lead allocation, campaigns and approving quotations, placement checks and renewals of another user', false),
 ('tis-sales-unit-head', 'TIS Sales Unit Head', 'RBAC v4 Sales Unit Head: as the Sales Officer, plus telesales incentives and approving supplier invoices; reads disbursements and payables', false),
 ('tis-ops-associate', 'TIS Operations Associate', 'RBAC v4 Operations Associate: placements, policies, endorsements, renewals and claims (maker, no approval); reads leads, clients and billing', false),
 ('tis-ops-officer', 'TIS Operations Officer', 'RBAC v4 Operations Officer: as the Operations Associate, plus reading journal vouchers and fixed assets', false),
 ('tis-ops-unit-head', 'TIS Operations Unit Head', 'RBAC v4 Operations Unit Head: as the Operations Officer, plus approving quotations, placement checks, renewals, claim decisions and supplier invoices of another user', false),
 ('tis-ccd-pdu', 'CCD-PDU (Post-Dated Cheques)', 'RBAC v4 CCD-PDU: post-dated cheque encoding, acknowledgement, deposit and cancellation (Cash Control)', false),
 ('tis-ccd-pdc', 'CCD-PDC / CCD-ADA', 'RBAC v4 persona named CCD-PDC in the screen matrix and CCD-ADA (auto-debit arrangements) in the department table: post-dated cheques; reads billing, receipting and reconciliations (Cash Control)', false),
 ('tis-ccd-bp', 'CCD-BP / QRPh (Receipting)', 'RBAC v4 CCD-BP/QRPh: official and acknowledgement receipts over the counter, bills payment and QRPh, posting of collections; no reversals (Cash Control)', false),
 ('tis-ccd-recon', 'CCD-Recon (Reconciliation and Reversals)', 'RBAC v4 CCD-Recon: daily payment reconciliation, reversals and adjustments, bank and insurer statement reconciliation, approving insurer statement reconciliations (Cash Control)', false),
 ('tis-finance', 'TIS Finance & General Accounting', 'RBAC v4 Finance & GenAcctg: disbursements, journal vouchers, payables, fixed assets, commission and remittance, period end, bank reconciliation and posting rule approvals; reads the front office', false),
 ('tis-it-admin', 'TIS IT AppSupport / Admin', 'RBAC v4 IT AppSupport/Admin: users, roles, access control, settings, reference masters, product configurator, schedules and interfaces; reads business data, enters no business transactions', false),
 ('tis-general-manager', 'TIS General Manager', 'RBAC v4 TIS General Manager: front office (leads to claims) with every approval of the front office and supplier invoices; reads accounting, administration and the audit trail', false),
 ('tis-superid', 'SUPERID (UAT only)', 'RBAC v4 SUPERID for user acceptance testing: includes the System Administrator. Set the role Inactive before go-live', false)
) AS v(code, name, description, is_system)
WHERE EXISTS (SELECT 1 FROM roles WHERE code = 'system-admin')
ON CONFLICT (code) DO NOTHING;

-- SUPERID holds what the System Administrator holds (role inheritance), for as long as the role is active.
UPDATE roles SET inherits = ARRAY['system-admin'] WHERE code = 'tis-superid' AND inherits = '{}';

INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM (VALUES
  ('tis-sales-associate', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:products', 'read:channels', 'read:motor-programmes', 'read:commission', 'read:remittance', 'read:incentive', 'read:collections', 'read:receipts', 'read:integrations', 'read:schedules', 'read:quotations', 'write:quotations', 'read:policies', 'write:policies', 'read:endorsements', 'write:endorsements', 'read:renewals', 'write:renewals', 'read:fleet', 'write:fleet', 'read:marine', 'write:marine', 'view:pii', 'read:leads', 'write:leads', 'read:clients', 'write:clients', 'read:sales-activities', 'write:sales-activities', 'read:privacy', 'write:privacy', 'read:claims', 'read:lead-assignment', 'read:campaigns']),
  ('tis-sales-officer', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:products', 'read:channels', 'read:motor-programmes', 'read:commission', 'read:remittance', 'read:incentive', 'read:collections', 'read:receipts', 'read:integrations', 'read:schedules', 'read:quotations', 'write:quotations', 'read:policies', 'write:policies', 'read:endorsements', 'write:endorsements', 'read:renewals', 'write:renewals', 'read:fleet', 'write:fleet', 'read:marine', 'write:marine', 'view:pii', 'read:leads', 'write:leads', 'read:clients', 'write:clients', 'read:sales-activities', 'write:sales-activities', 'read:privacy', 'write:privacy', 'read:claims', 'approve:quotations', 'approve:policies', 'approve:renewals', 'read:lead-assignment', 'write:lead-assignment', 'read:campaigns', 'write:campaigns']),
  ('tis-sales-unit-head', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:products', 'read:channels', 'read:motor-programmes', 'read:commission', 'read:remittance', 'read:incentive', 'read:collections', 'read:receipts', 'read:integrations', 'read:schedules', 'read:quotations', 'write:quotations', 'read:policies', 'write:policies', 'read:endorsements', 'write:endorsements', 'read:renewals', 'write:renewals', 'read:fleet', 'write:fleet', 'read:marine', 'write:marine', 'view:pii', 'read:leads', 'write:leads', 'read:clients', 'write:clients', 'read:sales-activities', 'write:sales-activities', 'read:privacy', 'write:privacy', 'read:claims', 'approve:quotations', 'approve:policies', 'approve:renewals', 'read:lead-assignment', 'write:lead-assignment', 'read:campaigns', 'write:campaigns', 'write:incentive', 'read:disbursements', 'read:payables', 'approve:payables']),
  ('tis-ops-associate', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:products', 'read:channels', 'read:motor-programmes', 'read:commission', 'read:remittance', 'read:incentive', 'read:collections', 'read:receipts', 'read:integrations', 'read:schedules', 'read:quotations', 'write:quotations', 'read:policies', 'write:policies', 'read:endorsements', 'write:endorsements', 'read:renewals', 'write:renewals', 'read:fleet', 'write:fleet', 'read:marine', 'write:marine', 'view:pii', 'read:claims', 'write:claims', 'read:leads', 'read:clients', 'read:sales-activities', 'read:lead-assignment', 'read:privacy']),
  ('tis-ops-officer', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:products', 'read:channels', 'read:motor-programmes', 'read:commission', 'read:remittance', 'read:incentive', 'read:collections', 'read:receipts', 'read:integrations', 'read:schedules', 'read:quotations', 'write:quotations', 'read:policies', 'write:policies', 'read:endorsements', 'write:endorsements', 'read:renewals', 'write:renewals', 'read:fleet', 'write:fleet', 'read:marine', 'write:marine', 'view:pii', 'read:claims', 'write:claims', 'read:leads', 'read:clients', 'read:sales-activities', 'read:lead-assignment', 'read:privacy', 'read:journal-vouchers', 'read:fixed-assets']),
  ('tis-ops-unit-head', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:products', 'read:channels', 'read:motor-programmes', 'read:commission', 'read:remittance', 'read:incentive', 'read:collections', 'read:receipts', 'read:integrations', 'read:schedules', 'read:quotations', 'write:quotations', 'read:policies', 'write:policies', 'read:endorsements', 'write:endorsements', 'read:renewals', 'write:renewals', 'read:fleet', 'write:fleet', 'read:marine', 'write:marine', 'view:pii', 'read:claims', 'write:claims', 'read:leads', 'read:clients', 'read:sales-activities', 'read:lead-assignment', 'read:privacy', 'approve:quotations', 'approve:policies', 'approve:renewals', 'approve:claims', 'read:disbursements', 'read:journal-vouchers', 'read:payables', 'read:fixed-assets', 'approve:payables']),
  ('tis-ccd-pdu', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:receipts', 'write:receipts']),
  ('tis-ccd-pdc', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:receipts', 'write:receipts', 'read:collections', 'read:remittance', 'read:bank-reconciliation']),
  ('tis-ccd-bp', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:receipts', 'write:receipts', 'read:collections', 'write:collections', 'read:remittance', 'read:bank-reconciliation']),
  ('tis-ccd-recon', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:receipts', 'write:receipts', 'read:collections', 'write:collections', 'read:remittance', 'write:remittance', 'approve:insurer-reconciliation', 'read:bank-reconciliation', 'write:bank-reconciliation', 'read:disbursements']),
  ('tis-finance', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:leads', 'read:clients', 'read:quotations', 'read:policies', 'read:endorsements', 'read:renewals', 'read:claims', 'read:collections', 'read:receipts', 'read:incentive', 'read:products', 'read:channels', 'read:motor-programmes', 'read:integrations', 'read:schedules', 'read:audit', 'view:pii', 'read:commission', 'write:commission', 'read:remittance', 'write:remittance', 'read:disbursements', 'write:disbursements', 'read:journal-vouchers', 'write:journal-vouchers', 'read:payables', 'write:payables', 'approve:payables', 'read:fixed-assets', 'write:fixed-assets', 'read:period-end', 'write:period-end', 'approve:period-end', 'read:bank-reconciliation', 'write:bank-reconciliation', 'approve:bank-reconciliation', 'write:posting-rules', 'approve:posting-rules', 'approve:credit-control']),
  ('tis-it-admin', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:leads', 'read:clients', 'read:quotations', 'read:policies', 'read:endorsements', 'read:renewals', 'read:claims', 'read:collections', 'read:receipts', 'read:remittance', 'read:commission', 'read:incentive', 'read:disbursements', 'read:journal-vouchers', 'read:payables', 'read:fixed-assets', 'read:masters', 'write:masters', 'read:channels', 'write:channels', 'read:products', 'write:products', 'read:motor-programmes', 'write:motor-programmes', 'write:premium-charges', 'read:users', 'write:users', 'read:roles', 'write:roles', 'read:access-control', 'write:access-control', 'approve:access-control', 'read:settings', 'write:settings', 'read:integrations', 'write:integrations', 'read:schedules', 'write:schedules', 'read:audit']),
  ('tis-general-manager', ARRAY['read:profile', 'write:profile', 'read:notifications', 'write:notifications', 'read:reports', 'read:masters', 'read:products', 'read:channels', 'read:motor-programmes', 'read:commission', 'read:remittance', 'read:incentive', 'read:collections', 'read:receipts', 'read:integrations', 'read:schedules', 'read:quotations', 'write:quotations', 'read:policies', 'write:policies', 'read:endorsements', 'write:endorsements', 'read:renewals', 'write:renewals', 'read:fleet', 'write:fleet', 'read:marine', 'write:marine', 'view:pii', 'approve:quotations', 'approve:policies', 'approve:renewals', 'read:leads', 'write:leads', 'read:clients', 'write:clients', 'read:claims', 'write:claims', 'approve:claims', 'read:sales-activities', 'write:sales-activities', 'read:lead-assignment', 'write:lead-assignment', 'read:campaigns', 'write:campaigns', 'read:privacy', 'read:disbursements', 'read:journal-vouchers', 'read:payables', 'read:fixed-assets', 'approve:payables', 'read:bank-reconciliation', 'read:period-end', 'read:audit', 'read:users', 'read:roles', 'read:access-control'])
) AS v(role, perms)
JOIN roles r ON r.code = v.role
JOIN permissions p ON p.code = ANY(v.perms)
ON CONFLICT DO NOTHING;
