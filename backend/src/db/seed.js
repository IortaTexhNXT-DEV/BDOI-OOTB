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
  ['processing', 'Processing Team (Placement & Policy Processing)', 'Broker slips to insurers, offer comparison, quotation and placement slips, insurer confirmation, policy checking and issuance, endorsement processing, reinsurance, product templates', false],
  ['operations', 'Operations (Client Servicing)', 'Client servicing, endorsement requests, renewals, open items and documents', false],
  ['claims', 'Claims', 'Claims registration, follow-up with insurers, review and settlement', false],
  ['accounting', 'Accounting', 'Billing, collection, official receipts, remittance to insurers, commission, period end and BIR reporting', false],
  ['accounting-manager', 'Accounting Manager', 'Everything Accounting does, plus approving the month-end and year-end close and bank reconciliations, posting into soft-closed periods and reopening periods', false],
];
/** Role codes of earlier releases (renamed or merged by migration 0140_broker_roles.sql); a fresh seed never creates them. */
export const RETIRED_ROLES = ['it-admin', 'ba', 'user-access-admin', 'underwriting', 'customer-services', 'finance', 'finance-manager', 'agent'];
const MODULES = ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'claims', 'renewals', 'receipts', 'collections', 'disbursements', 'commission', 'remittance', 'reinsurance', 'incentive', 'products', 'masters', 'users', 'roles', 'settings', 'reports', 'schedules', 'notifications', 'journal-vouchers', 'audit', 'period-end', 'bank-reconciliation'];
// write:receipts (official receipts, cash posting, payment verification) is Accounting-only: segregation of duties.
// Least privilege: the receipt register (read:receipts) is Accounting's; Sales and Operations see a policy's
// payments through read:policies. Claims officers read the lead through the policy, not the lead register.
// The System Administrator holds every permission (granted below), so it has no entry here.
const ROLE_PERMS = {
  sales: ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'renewals', 'reports', 'notifications', 'products:read', 'masters:read', 'claims:read'],
  processing: ['profile', 'leads:read', 'clients', 'quotations', 'policies', 'endorsements', 'renewals', 'reinsurance', 'products', 'reports', 'notifications', 'masters:read', 'claims:read'],
  operations: ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'renewals', 'claims:read', 'reports', 'notifications', 'masters:read', 'products:read'],
  claims: ['profile', 'clients:read', 'policies:read', 'claims', 'reports', 'notifications', 'masters:read'],
  // Accounting calculates, approves (maker-checker) and pays incentives; program set-up stays with the system administrator.
  accounting: ['profile', 'clients:read', 'policies:read', 'claims:read', 'receipts', 'collections', 'disbursements', 'commission', 'remittance', 'incentive', 'journal-vouchers', 'period-end', 'bank-reconciliation', 'reports', 'notifications', 'masters:read', 'schedules:read'],
  // Accounting Manager inherits Accounting (ROLE_INHERITS) and adds the period-end approval (maker-checker on the close).
  // and the bank reconciliation approval (approve:bank-reconciliation: approve / reopen a reconciliation; not its preparer),
  // the insurer statement reconciliation approval (approve:insurer-reconciliation, permission added by migration 0172) and
  // the credit control approvals: warranty extensions and client credit limits (approve:credit-control, migration 0173),
  // and posting rule / account determination changes: propose (write) and approve another user's change (migration 0174).
  'accounting-manager': ['period-end:approve', 'bank-reconciliation:approve', 'insurer-reconciliation:approve', 'credit-control:approve', 'posting-rules:write', 'posting-rules:approve'],
};
/** Roles that include other roles: the user also holds the inherited roles' permissions, menus and reports. */
const ROLE_INHERITS = { 'accounting-manager': ['accounting'] };

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

export async function seed({ log = console.log, sampleData } = {}) {
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
  for (const [role, items] of Object.entries(ROLE_PERMS)) {
    const codes = items.flatMap((i) => (i.includes(':') ? [`${i.split(':')[1]}:${i.split(':')[0]}`] : [`read:${i}`, `write:${i}`]));
    await grant(role, codes);
  }
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
  if (withSample && process.env.NODE_ENV === 'production') log('WARNING: SEED_SAMPLE_DATA is on in production: demo leads, clients, policies and transactions are being seeded');
  for (const f of seedFiles({ sample: withSample })) {
    await query(fs.readFileSync(f.path, 'utf8'));
    log(`seeded ${f.name}`);
  }
  log(withSample ? 'seed complete (reference + sample data)' : 'seed complete (reference data only; SEED_SAMPLE_DATA is off)');
  return { sampleData: withSample };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
