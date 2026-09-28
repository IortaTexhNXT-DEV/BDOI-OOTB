/** Seeds: roles, permissions, the BrokerVerse admin, configuration defaults and scheduled jobs. Idempotent. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { pool, query } from './pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export const ROLES = [
  ['it-admin', 'IT Administrator', 'Full access: user, role and system administration', true],
  ['ba', 'Business Administrator', 'Full access: business configuration and masters', true],
  ['sales', 'Sales / Relationship Manager', 'Leads, clients, quotations, policies, renewals, open items, payments', false],
  ['underwriting', 'Underwriter', 'Quotation review, policy issuance, product templates', false],
  ['customer-services', 'Customer Services', 'Client servicing, endorsements, renewals, open items', false],
  ['claims', 'Claims Officer', 'Claims registration, review and settlement', false],
  ['finance', 'Finance / Accounts', 'Receipts, collections, disbursement, commission, financial reports', false],
  ['agent', 'Agent / Referrer', 'Own leads, quotations and policies', false],
];
const MODULES = ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'claims', 'renewals', 'receipts', 'collections', 'disbursements', 'commission', 'remittance', 'reinsurance', 'incentive', 'products', 'masters', 'users', 'roles', 'settings', 'reports', 'schedules', 'notifications', 'journal-vouchers', 'audit'];
const ROLE_PERMS = {
  sales: ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'renewals', 'receipts', 'reports', 'notifications', 'products:read', 'masters:read', 'claims:read'],
  underwriting: ['profile', 'leads:read', 'clients', 'quotations', 'policies', 'endorsements', 'renewals', 'reinsurance', 'products', 'reports', 'notifications', 'masters:read', 'claims:read'],
  'customer-services': ['profile', 'leads', 'clients', 'quotations', 'policies', 'endorsements', 'renewals', 'claims:read', 'receipts:read', 'reports', 'notifications', 'masters:read', 'products:read'],
  claims: ['profile', 'clients:read', 'policies:read', 'claims', 'reports', 'notifications', 'masters:read'],
  finance: ['profile', 'clients:read', 'policies:read', 'receipts', 'collections', 'disbursements', 'commission', 'remittance', 'journal-vouchers', 'reports', 'notifications', 'masters:read', 'schedules:read'],
  agent: ['profile', 'leads', 'clients:read', 'quotations', 'policies', 'notifications'],
};

export async function seed({ log = console.log } = {}) {
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
  await grant('it-admin', Object.keys(permIds));
  await grant('ba', Object.keys(permIds));
  for (const [role, items] of Object.entries(ROLE_PERMS)) {
    const codes = items.flatMap((i) => (i.includes(':') ? [`${i.split(':')[1]}:${i.split(':')[0]}`] : [`read:${i}`, `write:${i}`]));
    await grant(role, codes);
  }
  // Admin login requested for the platform
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Technxt@1', 10);
  const admin = await query(`INSERT INTO users(username, password_hash, display_name, first_name, last_name, email, status, created_by)
    VALUES ('BrokerVerse', $1, 'BrokerVerse Administrator', 'BrokerVerse', 'Admin', 'admin@brokerverse.local', 'active', 'seed')
    ON CONFLICT (username) DO UPDATE SET display_name = EXCLUDED.display_name RETURNING id`, [adminHash]);
  await query('INSERT INTO user_roles(user_id, role_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [admin.rows[0].id, roleIds['it-admin']]);
  // Configuration defaults (all editable from System Settings)
  const settings = JSON.parse(fs.readFileSync(path.join(here, 'seeds', 'settings.json'), 'utf8'));
  for (const s of settings) {
    await query(`INSERT INTO app_settings(key, value, "group", label, type, editable) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (key) DO NOTHING`,
      [s.key, JSON.stringify(s.value), s.group, s.label, s.type || 'string', s.editable !== false]);
  }
  const jobs = JSON.parse(fs.readFileSync(path.join(here, 'seeds', 'jobs.json'), 'utf8'));
  for (const j of jobs) {
    await query(`INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES ($1,$2,$3,$4,$5,$6,$7)
                 ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, handler = EXCLUDED.handler`,
      [j.code, j.name, j.description, j.cron, j.handler, JSON.stringify(j.params || {}), j.enabled !== false]);
  }
  // Module seed files (masters and sample data), applied in order, each idempotent
  const dir = path.join(here, 'seeds');
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await query(fs.readFileSync(path.join(dir, f), 'utf8'));
    log(`seeded ${f}`);
  }
  log('seed complete');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().then(() => pool.end()).catch((e) => { console.error(e); process.exit(1); });
}
