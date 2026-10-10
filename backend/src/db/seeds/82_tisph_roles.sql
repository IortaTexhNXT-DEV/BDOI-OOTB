-- TISPH roles of the Pre-BSM workbook (M17 RBAC v4, created by db/seed.js and migration 0348) in the report catalogue
-- and the role-list settings, and a segregation-of-duties rule of the v4 department table. Runs after the reference
-- seeds, on a new database and on every start of one in use. Idempotent: a report or a role list is extended only
-- while it names no TISPH role (and, for a setting, nobody has changed it), so administrator changes are kept.

-- ---------------------------------------------------------------- M17 RBAC v4: report catalogue and role lists
-- Each TISPH role sees the reports of the broker role closest to it (the report's permission still applies): Sales
-- those of Sales & Marketing; Operations those of the Processing Team, Operations and Claims; Finance those of
-- Accounting; Cash Control the collection, receipt, bank and remittance reports of Accounting; the General Manager and
-- IT AppSupport all of them. SUPERID includes the System Administrator.
WITH map(base, tis, reports) AS (VALUES
  ('sales', ARRAY['tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-general-manager', 'tis-it-admin'], NULL::text[]),
  ('processing', ARRAY['tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-general-manager', 'tis-it-admin'], NULL),
  ('operations', ARRAY['tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-general-manager', 'tis-it-admin'], NULL),
  ('claims', ARRAY['tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-general-manager', 'tis-it-admin'], NULL),
  ('accounting', ARRAY['tis-finance', 'tis-general-manager', 'tis-it-admin'], NULL),
  ('accounting', ARRAY['tis-ccd-pdu', 'tis-ccd-pdc', 'tis-ccd-bp', 'tis-ccd-recon'],
   ARRAY['receipts-register', 'collections-summary', 'collections-ageing', 'premium-receivable-soa', 'remittance-summary', 'bank-book', 'bank-deposits-in-transit',
         'bank-outstanding-cheques', 'bank-reconciliation-statement', 'bank-unmatched-lines']))
UPDATE report_definitions d
   SET roles = d.roles || ARRAY(SELECT DISTINCT t FROM map, unnest(map.tis) AS t WHERE map.base = ANY(d.roles) AND (map.reports IS NULL OR d.code = ANY(map.reports)) ORDER BY t),
       updated_at = now()
 WHERE d.roles && ARRAY['sales', 'processing', 'operations', 'claims', 'accounting']
   AND NOT d.roles && ARRAY(SELECT DISTINCT t FROM map, unnest(map.tis) AS t)
   AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-finance');

-- Role lists of the settings:
--   quotations.approval_notify_roles  told when a quotation is sent for approval: the Sales and Operations Unit Heads
--   renewals.approver_roles           told to approve renewal terms (and shown them on My Work): the same
--   incentive.eligible_roles          take part in the telesales incentives: the Sales roles
--   payments.notify_roles_on_error    told when a gateway payment fails: Finance and CCD-BP (receipting)
UPDATE app_settings s
   SET value = s.value || to_jsonb(v.roles), updated_at = now()
  FROM (VALUES ('quotations.approval_notify_roles', ARRAY['tis-sales-unit-head', 'tis-ops-unit-head']),
               ('renewals.approver_roles', ARRAY['tis-sales-unit-head', 'tis-ops-unit-head']),
               ('incentive.eligible_roles', ARRAY['tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head']),
               ('payments.notify_roles_on_error', ARRAY['tis-finance', 'tis-ccd-bp'])) AS v(key, roles)
 WHERE s.key = v.key AND s.updated_by IS NULL AND jsonb_typeof(s.value) = 'array' AND NOT s.value ?| v.roles;

-- Department table of v4: CCD-BP issues receipts and "has no reversal rights (sits with CCD-Recon)". The v4 user list
-- gives one user both personas, so the rule warns instead of blocking.
INSERT INTO sod_rules(code, name, role_a, role_b, action, reason)
SELECT 'SOD-TIS-BP-RECON', 'Receipting and reversals', 'tis-ccd-bp', 'tis-ccd-recon', 'warn',
       'CCD-BP issues the receipts and has no reversal rights; reversals and adjustments sit with CCD-Recon'
WHERE EXISTS (SELECT 1 FROM roles WHERE code = 'tis-ccd-bp') AND EXISTS (SELECT 1 FROM roles WHERE code = 'tis-ccd-recon')
ON CONFLICT (code) DO NOTHING;
-- the reason of an earlier seed named the workbook sheet; a reason changed on the screen is kept
UPDATE sod_rules SET reason = 'CCD-BP issues the receipts and has no reversal rights; reversals and adjustments sit with CCD-Recon'
 WHERE code = 'SOD-TIS-BP-RECON' AND reason = 'RBAC v4: CCD-BP issues the receipts and has no reversal rights; reversals and adjustments sit with CCD-Recon';
