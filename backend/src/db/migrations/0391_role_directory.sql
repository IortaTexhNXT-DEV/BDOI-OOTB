-- Role directory of the user form and the access screens (Master > Users and Access): the department of each TISPH
-- role with a one-line summary, in the order of the departments (Sales, Operations, Cash Control, Finance and
-- Accounting, IT, Management), and the roles of the base platform, which are listed only when asked for. Read by
-- roleDirectory() in src/modules/access-control/roles.js. A role in no department (created later) is listed under
-- Other roles. The user form reads the same settings.
-- Idempotent: values changed by an administrator are kept.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('access.role_groups', $j$[
  {"name": "Sales", "roles": [
    {"code": "tis-sales-associate", "summary": "Leads, clients, quotations, placements, policies, endorsements and renewals; no approvals"},
    {"code": "tis-sales-officer", "summary": "As the Sales Associate, plus lead allocation, campaigns and approving the work of others"},
    {"code": "tis-sales-unit-head", "summary": "As the Sales Officer, plus telesales incentives and supplier invoice approval"}]},
  {"name": "Operations", "roles": [
    {"code": "tis-ops-associate", "summary": "Placements, policies, endorsements, renewals and claims; no approvals"},
    {"code": "tis-ops-officer", "summary": "As the Operations Associate, plus reading journal vouchers and fixed assets"},
    {"code": "tis-ops-unit-head", "summary": "As the Operations Officer, plus approving quotations, placements, renewals and claims"}]},
  {"name": "Cash Control", "roles": [
    {"code": "tis-ccd-pdu", "summary": "Post-dated cheques: encoding, acknowledgement, deposit and cancellation"},
    {"code": "tis-ccd-pdc", "summary": "Post-dated cheques and auto-debit arrangements"},
    {"code": "tis-ccd-bp", "summary": "Official and acknowledgement receipts, bills payment and QRPh; no reversals"},
    {"code": "tis-ccd-recon", "summary": "Payment reconciliation, reversals and adjustments, bank and insurer statements"}]},
  {"name": "Finance and Accounting", "roles": [
    {"code": "tis-finance", "summary": "Disbursements, journal vouchers, payables, fixed assets, commission, remittance and period end"}]},
  {"name": "IT", "roles": [
    {"code": "tis-it-admin", "summary": "Users, roles, settings, reference masters and interfaces; no business transactions"},
    {"code": "tis-superid", "summary": "User acceptance testing only: includes the System Administrator"}]},
  {"name": "Management", "roles": [
    {"code": "tis-general-manager", "summary": "Front office with every approval; reads accounting and the audit trail"}]}
 ]$j$, 'access', 'Roles offered on the user form by department, each with a one-line summary (a role in no department is offered under Other roles)', 'json'),
 ('access.platform_roles', '["system-admin", "sales", "processing", "operations", "claims", "accounting", "accounting-manager"]', 'access',
  'Roles of the base platform: not offered for a new assignment on the user form and left out of the Role list unless asked for', 'json')
ON CONFLICT (key) DO NOTHING;
