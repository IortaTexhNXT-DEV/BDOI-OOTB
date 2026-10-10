/**
 * Seeds: roles, permissions, the BrokerVerse admin, configuration defaults, scheduled jobs and the reference data in
 * seeds/*.sql; the demo data in seeds/sample/*.sql only when SEED_SAMPLE_DATA is on (see seeds/README.md). Idempotent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool, query } from './pool.js';
import { encryptSecret, isEncrypted } from '../lib/secrets.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROLES = [
  ['system-admin', 'System Administrator (Super Admin Access)', 'Full access to every module, configuration, user and role administration', true],
  ['sales', 'Sales & Marketing (Account Executive)', 'Prospects, leads, clients, quotation requests, renewals follow-up and own production', false],
  ['processing', 'Processing Team (Placement & Policy Processing)', 'Broker slips to insurers, offer comparison, quotation and placement slips, insurer confirmation, policy checking and issuance, endorsement processing, product templates', false],
  ['operations', 'Operations (Client Servicing)', 'Client servicing, endorsement requests, renewals, open items and documents', false],
  ['claims', 'Claims', 'Claims registration, follow-up with insurers, review and settlement', false],
  ['accounting', 'Accounting', 'Billing, collection, official receipts, remittance to insurers, commission, period end and BIR reporting', false],
  ['accounting-manager', 'Accounting Manager', 'Everything Accounting does, plus approving the month-end and year-end close and bank reconciliations, posting into soft-closed periods and reopening periods', false],
  // TISPH personas of the RBAC v4 matrix (migration 0348_tisph_roles.sql); the names carry the matrix labels.
  ['tis-sales-associate', 'TIS Sales Associate', 'RBAC v4 Sales Associate: leads, clients, quotations, placements, policies, endorsements and renewals (maker, no approval); reads claims, billing, receipting and commission', false],
  ['tis-sales-officer', 'TIS Sales Officer', 'RBAC v4 Sales Officer (also the Corporate Sales Officers of the user list): as the Sales Associate, plus lead allocation, campaigns and approving quotations, placement checks and renewals of another user', false],
  ['tis-sales-unit-head', 'TIS Sales Unit Head', 'RBAC v4 Sales Unit Head: as the Sales Officer, plus telesales incentives and approving supplier invoices; reads disbursements and payables', false],
  ['tis-ops-associate', 'TIS Operations Associate', 'RBAC v4 Operations Associate: placements, policies, endorsements, renewals and claims (maker, no approval); reads leads, clients and billing', false],
  ['tis-ops-officer', 'TIS Operations Officer', 'RBAC v4 Operations Officer: as the Operations Associate, plus reading journal vouchers and fixed assets', false],
  ['tis-ops-unit-head', 'TIS Operations Unit Head', 'RBAC v4 Operations Unit Head: as the Operations Officer, plus approving quotations, placement checks, renewals, claim decisions and supplier invoices of another user', false],
  ['tis-ccd-pdu', 'CCD-PDU (Post-Dated Cheques)', 'RBAC v4 CCD-PDU: post-dated cheque encoding, acknowledgement, deposit and cancellation (Cash Control)', false],
  ['tis-ccd-pdc', 'CCD-PDC / CCD-ADA', 'RBAC v4 persona named CCD-PDC in the screen matrix and CCD-ADA (auto-debit arrangements) in the department table: post-dated cheques; reads billing, receipting and reconciliations (Cash Control)', false],
  ['tis-ccd-bp', 'CCD-BP / QRPh (Receipting)', 'RBAC v4 CCD-BP/QRPh: official and acknowledgement receipts over the counter, bills payment and QRPh, posting of collections; no reversals (Cash Control)', false],
  ['tis-ccd-recon', 'CCD-Recon (Reconciliation and Reversals)', 'RBAC v4 CCD-Recon: daily payment reconciliation, reversals and adjustments, bank and insurer statement reconciliation, approving insurer statement reconciliations (Cash Control)', false],
  ['tis-finance', 'TIS Finance & General Accounting', 'RBAC v4 Finance & GenAcctg: disbursements, journal vouchers, payables, fixed assets, commission and remittance, period end, bank reconciliation and posting rule approvals; reads the front office', false],
  ['tis-it-admin', 'TIS IT AppSupport / Admin', 'RBAC v4 IT AppSupport/Admin: users, roles, access control, settings, reference masters, product configurator, schedules and interfaces; reads business data, enters no business transactions', false],
  ['tis-general-manager', 'TIS General Manager', 'RBAC v4 TIS General Manager: front office (leads to claims) with every approval of the front office and supplier invoices; reads accounting, administration and the audit trail', false],
  ['tis-superid', 'SUPERID (UAT only)', 'RBAC v4 SUPERID for user acceptance testing: includes the System Administrator. Set the role Inactive before go-live', false],
];
/** Role codes of earlier releases (renamed or merged by migration 0140_broker_roles.sql); a fresh seed never creates them. */
export const RETIRED_ROLES = ['it-admin', 'ba', 'user-access-admin', 'underwriting', 'customer-services', 'finance', 'finance-manager', 'agent'];
const MODULES = ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'claims', 'renewals', 'receipts', 'collections', 'disbursements', 'commission', 'remittance', 'incentive', 'products', 'masters', 'users', 'roles', 'settings', 'reports', 'schedules', 'notifications', 'journal-vouchers', 'audit', 'period-end', 'bank-reconciliation',
  // go-live data workbench (API /data-load, migration 0243): System Administrator only
  'data-load'];
// write:receipts (official receipts, cash posting, payment verification) is Accounting's (TISPH: Cash Control's), never
// the front office's: segregation of duties.
// Least privilege: the receipt register (read:receipts) is Accounting's; Sales and Operations see a policy's
// payments through read:policies. Claims officers read the lead through the policy, not the lead register.
// The System Administrator holds every permission (granted below), so it has no entry here.
const ROLE_PERMS = {
  sales: ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'renewals', 'reports', 'notifications', 'products:read', 'masters:read', 'claims:read',
    // full personal identifiers: account executives call and write to their clients (migration 0276)
    'pii:view'],
  processing: ['profile', 'leads:read', 'clients', 'quotations', 'policies', 'endorsements', 'renewals', 'products', 'reports', 'notifications', 'masters:read', 'claims:read'],
  operations: ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'renewals', 'claims:read', 'reports', 'notifications', 'masters:read', 'products:read',
    // full personal identifiers (migration 0276)
    'pii:view'],
  claims: ['profile', 'clients:read', 'policies:read', 'claims', 'reports', 'notifications', 'masters:read'],
  // Accounting calculates, approves (maker-checker, incentive:approve of migration 0387) and pays incentives; program
  // set-up stays with the system administrator.
  accounting: ['profile', 'clients:read', 'policies:read', 'claims:read', 'receipts', 'collections', 'disbursements', 'commission', 'remittance', 'incentive', 'incentive:approve', 'journal-vouchers', 'period-end', 'bank-reconciliation', 'reports', 'notifications', 'masters:read', 'schedules:read',
    // accounts payable sub-ledger and fixed asset register (permissions of migration 0298)
    'payables', 'fixed-assets',
    // full personal identifiers for BIR forms and payees' bank accounts (migration 0276)
    'pii:view',
    // remittance approvals of another user's remittances, settlements, adjustments and transfers, within the Authority
    // Matrix limit (migration 0400); the Accounting Manager has it through Accounting
    'remittance:approve'],
  // Accounting Manager inherits Accounting (ROLE_INHERITS) and adds the period-end approval (maker-checker on the close).
  // and the bank reconciliation approval (approve:bank-reconciliation: approve / reopen a reconciliation; not its preparer),
  // the insurer statement reconciliation approval (approve:insurer-reconciliation, permission added by migration 0172) and
  // the credit control approvals: warranty extensions and client credit limits (approve:credit-control, migration 0173),
  // and posting rule / account determination changes: propose (write) and approve another user's change (migration 0174).
  'accounting-manager': ['period-end:approve', 'bank-reconciliation:approve', 'insurer-reconciliation:approve', 'credit-control:approve', 'posting-rules:write', 'posting-rules:approve',
    // supplier invoices approved by a second user (migration 0298)
    'payables:approve'],
};
// Distribution, programmes and products (permissions of migrations 0300 to 0308): lead assignment rules and queue,
// distribution channels, brand-new vehicle programmes, fleet schedules, marine open covers, marketing campaigns.
const DISTRIBUTION_PERMS = {
  sales: ['channels:read', 'motor-programmes', 'campaigns', 'fleet:read', 'marine:read'],
  processing: ['channels:read', 'motor-programmes', 'fleet', 'marine'],
  operations: ['lead-assignment', 'channels:read', 'motor-programmes:read', 'fleet', 'marine', 'campaigns'],
  claims: ['fleet:read', 'marine:read'],
  accounting: ['channels:read', 'fleet:read', 'marine:read'],
};
for (const [role, items] of Object.entries(DISTRIBUTION_PERMS)) ROLE_PERMS[role].push(...items);
// Sales activities (permissions of migration 0320): account executives log calls, meetings, e-mails and visits; the
// Processing Team reads the timelines of the prospects and quotations it works on.
const SALES_ACTIVITY_PERMS = { sales: ['sales-activities'], operations: ['sales-activities'], processing: ['sales-activities:read'] };
for (const [role, items] of Object.entries(SALES_ACTIVITY_PERMS)) ROLE_PERMS[role].push(...items);
// Approvals of the front office (permissions of migration 0348): approving a quotation, the check of a placement
// against the slip, renewal terms and claim decisions. The approver is never the maker (maker-checker in the services).
const APPROVAL_PERMS = { sales: ['quotations:approve', 'policies:approve', 'renewals:approve'], processing: ['quotations:approve', 'policies:approve', 'renewals:approve'],
  operations: ['quotations:approve', 'policies:approve', 'renewals:approve'], claims: ['claims:approve'] };
for (const [role, items] of Object.entries(APPROVAL_PERMS)) ROLE_PERMS[role].push(...items);
// Post-dated cheque log (permissions of migration 0520, FRS COLL-05 default grants): Accounting encodes and forwards,
// the Accounting Manager approves cancellations, Operations reads.
const PDC_PERMS = { accounting: ['pdc'], 'accounting-manager': ['pdc:approve'], operations: ['pdc:read'] };
for (const [role, items] of Object.entries(PDC_PERMS)) ROLE_PERMS[role].push(...items);
// Insurer billing statements are approved by a second user holding approve:insurer-billing (migration 0522, FRS COMM-06);
// Accounting kept the decision it had with write:remittance, the Accounting Manager has it through Accounting
ROLE_PERMS.accounting.push('insurer-billing:approve');
// Receipt reversal (migration 0524): the roles that issue receipts request it, the Accounting Manager approves
ROLE_PERMS.accounting.push('receipts:reverse');
ROLE_PERMS['accounting-manager'].push('receipt-reversal:approve');

// TISPH personas (RBAC v4 screen matrix, migration 0348). Screen rights map to module permissions: C/U -> write,
// R -> read, A -> approve where the module has an approval. Sales and Operations both raise quotations, placements,
// policies, endorsements and renewals; Officers and Unit Heads approve another user's (Operations: Unit Head only).
const TIS_COMMON = ['profile', 'notifications', 'reports:read', 'masters:read'];
const TIS_FRONT_READS = ['products:read', 'channels:read', 'motor-programmes:read', 'commission:read', 'remittance:read', 'incentive:read', 'collections:read', 'receipts:read',
  'integrations:read', 'schedules:read'];
const TIS_MAKER = ['quotations', 'policies', 'endorsements', 'renewals', 'fleet', 'marine', 'pii:view'];
const TIS_FRONT_APPROVALS = ['quotations:approve', 'policies:approve', 'renewals:approve'];
const TIS_SALES = [...TIS_COMMON, ...TIS_FRONT_READS, ...TIS_MAKER, 'leads', 'clients', 'sales-activities', 'claims:read'];
const TIS_OPS = [...TIS_COMMON, ...TIS_FRONT_READS, ...TIS_MAKER, 'claims', 'leads:read', 'clients:read', 'sales-activities:read', 'lead-assignment:read'];
const TIS_CCD = [...TIS_COMMON, 'receipts'];
const TIS_ACCOUNTING_READS = ['disbursements:read', 'journal-vouchers:read', 'payables:read', 'fixed-assets:read'];
const TIS_BUSINESS_READS = ['leads:read', 'clients:read', 'quotations:read', 'policies:read', 'endorsements:read', 'renewals:read', 'claims:read'];
Object.assign(ROLE_PERMS, {
  'tis-sales-associate': [...TIS_SALES, 'lead-assignment:read', 'campaigns:read'],
  'tis-sales-officer': [...TIS_SALES, ...TIS_FRONT_APPROVALS, 'lead-assignment', 'campaigns'],
  'tis-sales-unit-head': [...TIS_SALES, ...TIS_FRONT_APPROVALS, 'lead-assignment', 'campaigns', 'incentive', 'incentive:approve', 'disbursements:read', 'payables:read', 'payables:approve'],
  'tis-ops-associate': [...TIS_OPS],
  'tis-ops-officer': [...TIS_OPS, 'journal-vouchers:read', 'fixed-assets:read'],
  'tis-ops-unit-head': [...TIS_OPS, ...TIS_FRONT_APPROVALS, 'claims:approve', ...TIS_ACCOUNTING_READS, 'payables:approve'],
  // PDC Management (RBAC v4): CCD-PDU CRU, CCD-PDC CRUD and the checker of cancellations, every other persona reads
  'tis-ccd-pdu': [...TIS_CCD, 'pdc'],
  'tis-ccd-pdc': [...TIS_CCD, 'collections:read', 'remittance:read', 'bank-reconciliation:read', 'pdc', 'pdc:approve'],
  'tis-ccd-bp': [...TIS_CCD, 'collections', 'remittance:read', 'bank-reconciliation:read'],
  // insurer statement reconciliation is prepared under write:remittance (see the role guide)
  'tis-ccd-recon': [...TIS_CCD, 'collections', 'remittance', 'insurer-reconciliation:approve', 'bank-reconciliation', 'disbursements:read'],
  // commission and remittance runs: Finance (the v4 matrix gives that screen no maker; see the role guide)
  'tis-finance': [...TIS_COMMON, ...TIS_BUSINESS_READS, 'collections:read', 'receipts:read', 'incentive:read', 'products:read', 'channels:read', 'motor-programmes:read',
    'integrations:read', 'schedules:read', 'audit:read', 'pii:view', 'commission', 'remittance', 'disbursements', 'journal-vouchers', 'payables', 'payables:approve', 'fixed-assets',
    'period-end', 'period-end:approve', 'bank-reconciliation', 'bank-reconciliation:approve', 'posting-rules:write', 'posting-rules:approve', 'credit-control:approve',
    // the proposed remittance approvers with the General Manager (migration 0400), until TISPH names them
    'remittance:approve'],
  'tis-it-admin': ['profile', 'notifications', 'reports:read', ...TIS_BUSINESS_READS, 'collections:read', 'receipts:read', 'remittance:read', 'commission:read', 'incentive:read',
    ...TIS_ACCOUNTING_READS, 'masters', 'channels', 'products', 'motor-programmes', 'premium-charges:write', 'users', 'roles', 'access-control', 'access-control:approve', 'settings',
    'integrations', 'schedules', 'audit:read'],
  'tis-general-manager': [...TIS_COMMON, ...TIS_FRONT_READS, ...TIS_MAKER, ...TIS_FRONT_APPROVALS, 'leads', 'clients', 'claims', 'claims:approve', 'sales-activities',
    'lead-assignment', 'campaigns', ...TIS_ACCOUNTING_READS, 'payables:approve', 'bank-reconciliation:read', 'period-end:read', 'audit:read', 'users:read',
    'roles:read', 'access-control:read', 'remittance:approve'],
});
for (const role of ['tis-sales-associate', 'tis-sales-officer', 'tis-sales-unit-head', 'tis-ops-associate', 'tis-ops-officer', 'tis-ops-unit-head', 'tis-ccd-bp', 'tis-ccd-recon',
  'tis-finance', 'tis-it-admin', 'tis-general-manager']) ROLE_PERMS[role].push('pdc:read');
for (const role of ['tis-finance', 'tis-general-manager']) ROLE_PERMS[role].push('insurer-billing:approve');
// RBAC v4: reversals sit with CCD-Recon, checked by a second CCD-Recon user or Finance
ROLE_PERMS['tis-ccd-recon'].push('receipts:reverse', 'receipt-reversal:approve');
ROLE_PERMS['tis-finance'].push('receipt-reversal:approve');
/** Roles that include other roles: the user also holds the inherited roles' permissions, menus and reports. */
const ROLE_INHERITS = { 'accounting-manager': ['accounting'], 'tis-superid': ['system-admin'] };
/** The permission codes of a ROLE_PERMS entry: "module" is read and write, "module:action" that one permission. */
export const permissionCodes = (items) => [...new Set(items.flatMap((i) => (i.includes(':') ? [`${i.split(':')[1]}:${i.split(':')[0]}`] : [`read:${i}`, `write:${i}`])))];
export const ROLE_PERMISSIONS = Object.fromEntries(Object.entries(ROLE_PERMS).map(([role, items]) => [role, permissionCodes(items)]));

/**
 * Whether the demo / sample seed files run (SEED_SAMPLE_DATA). An explicit value wins ("true"/"1"/"yes"/"on" or
 * "false"/"0"/"no"/"off"); otherwise sample data is on in development and test and off when NODE_ENV=production.
 */
export function seedSampleData(source = process.env) {
  const v = String(source.SEED_SAMPLE_DATA ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'off'].includes(v)) return false;
  return (source.NODE_ENV || 'development') !== 'production';
}

/** The SQL seed files to apply, in order: seeds/*.sql (reference) and, with sample, seeds/sample/*.sql, sorted by file name. */
export function seedFiles({ sample = true } = {}) {
  const list = (dir, kind) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter((x) => x.endsWith('.sql'))
    .map((x) => ({ name: kind === 'sample' ? `sample/${x}` : x, base: x, kind, path: path.join(dir, x) })) : []);
  const files = [...list(path.join(here, 'seeds'), 'reference'), ...(sample ? list(path.join(here, 'seeds', 'sample'), 'sample') : [])];
  // Same base name: the reference file first (it holds the configuration the sample rows read).
  return files.sort((a, b) => (a.base === b.base ? (a.kind === 'reference' ? -1 : 1) : a.base < b.base ? -1 : 1));
}

/** Applies the seed. `log` receives the progress lines and `warn` the warnings (a line starting with WARNING:; default `log`). */
export async function seed({ log = console.log, warn = log, sampleData } = {}) {
  for (const [code, name, description, isSystem] of ROLES) {
    await query(`INSERT INTO roles(code, name, description, is_system) VALUES ($1,$2,$3,$4)
                 ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`, [code, name, description, isSystem]);
  }
  for (const m of MODULES) {
    for (const a of ['read', 'write']) {
      await query(`INSERT INTO permissions(code, module, description) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING`, [`${a}:${m}`, m, `${a === 'read' ? 'View' : 'Create / update'} ${m}`]);
    }
  }
  const roleIds = Object.fromEntries((await query('SELECT id, code FROM roles')).rows.map((r) => [r.code, r.id]));
  const permIds = Object.fromEntries((await query('SELECT id, code FROM permissions')).rows.map((r) => [r.code, r.id]));
  const grant = async (role, codes) => {
    for (const c of codes) if (permIds[c]) await query('INSERT INTO role_permissions(role_id, permission_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [roleIds[role], permIds[c]]);
  };
  await grant('system-admin', Object.keys(permIds));
  for (const [role, codes] of Object.entries(ROLE_PERMISSIONS)) await grant(role, codes);
  for (const [role, inherits] of Object.entries(ROLE_INHERITS)) await query('UPDATE roles SET inherits = $2 WHERE code = $1', [role, inherits]);
  // First administrator. The password comes from ADMIN_PASSWORD; without it a random one is generated and shown once.
  // An existing administrator keeps the password it has.
  const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(12).toString('base64url');
  const adminHash = await bcrypt.hash(adminPassword, 10);
  // A generated password is temporary: the administrator must change it at the first sign-in.
  const admin = await query(`INSERT INTO users(username, password_hash, display_name, first_name, last_name, email, status, created_by, must_change_password)
    VALUES ('BrokerVerse', $1, 'BrokerVerse Administrator', 'BrokerVerse', 'Admin', 'admin@brokerverse.local', 'active', 'seed', $2)
    ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id, (xmax = 0) AS inserted`, [adminHash, !process.env.ADMIN_PASSWORD]);
  if (admin.rows[0].inserted && !process.env.ADMIN_PASSWORD) log(`administrator BrokerVerse created with password ${adminPassword} (change it after the first sign-in)`);
  await query('INSERT INTO user_roles(user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [admin.rows[0].id, roleIds['system-admin']]);
  // Configuration defaults (all editable from System Settings)
  const settings = JSON.parse(fs.readFileSync(path.join(here, 'seeds', 'settings.json'), 'utf8'));
  for (const s of settings) {
    await query(`INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (key) DO NOTHING`,
      [s.key, JSON.stringify(s.value), s.group, s.label, s.type || 'string', s.editable !== false]);
  }
  // Two-factor secrets stored before encryption at rest (DATA_ENCRYPTION_KEY) was introduced are encrypted now.
  const plain = await query(`SELECT id, totp_secret, totp_pending_secret FROM users
    WHERE (totp_secret IS NOT NULL AND totp_secret NOT LIKE 'enc:%') OR (totp_pending_secret IS NOT NULL AND totp_pending_secret NOT LIKE 'enc:%')`);
  for (const u of plain.rows) {
    await query('UPDATE users SET totp_secret = $2, totp_pending_secret = $3 WHERE id = $1',
      [u.id, isEncrypted(u.totp_secret) ? u.totp_secret : encryptSecret(u.totp_secret), isEncrypted(u.totp_pending_secret) ? u.totp_pending_secret : encryptSecret(u.totp_pending_secret)]);
  }
  if (plain.rows.length) log(`encrypted the two-factor secrets of ${plain.rows.length} user(s)`);
  const jobs = JSON.parse(fs.readFileSync(path.join(here, 'seeds', 'jobs.json'), 'utf8'));
  for (const j of jobs) {
    await query(`INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, handler = EXCLUDED.handler`,
      [j.code, j.name, j.description, j.cron, j.handler, JSON.stringify(j.params || {}), j.enabled !== false]);
  }
  // Module seed files, applied in file-name order (reference and sample interleaved so a sample file runs after the
  // reference files it builds on), each idempotent. Sample / demo files (seeds/sample) run only when sample data is on.
  const withSample = sampleData ?? seedSampleData();
  if (withSample && process.env.NODE_ENV === 'production') warn('WARNING: SEED_SAMPLE_DATA is on in production: demo leads, clients, policies and transactions are being seeded');
  // A seed file reports what it left undone with RAISE WARNING; the warning goes to the start-up log.
  // A reference file that fails stops the start. A sample file runs in a transaction of its own: demo data that does not
  // fit a database in use (rows of an earlier sample a user kept, records users changed) is rolled back and left out
  // with a warning, and the start goes on with the next file.
  const client = await pool.connect();
  const notice = (n) => (n.severity === 'WARNING' ? warn(`WARNING: ${n.message}`) : log(n.message));
  const skipped = [];
  client.on('notice', notice);
  try {
    for (const f of seedFiles({ sample: withSample })) {
      const sql = fs.readFileSync(f.path, 'utf8');
      if (f.kind !== 'sample') {
        await client.query(sql);
        log(`seeded ${f.name}`);
        continue;
      }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('COMMIT');
        log(`seeded ${f.name}`);
      } catch (e) {
        await client.query('ROLLBACK');
        skipped.push(f.name);
        warn(`WARNING: sample data file ${f.name} was rolled back and left out: ${e.message}${e.detail ? ` (${e.detail})` : ''}`);
      }
    }
  } finally {
    client.off('notice', notice);
    client.release();
  }
  if (!withSample) log('seed complete (reference data only; SEED_SAMPLE_DATA is off)');
  else if (skipped.length) log(`seed complete (reference + sample data; ${skipped.length} sample file(s) left out, see the warnings above)`);
  else log('seed complete (reference + sample data)');
  return { sampleData: withSample, sampleSkipped: skipped };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
