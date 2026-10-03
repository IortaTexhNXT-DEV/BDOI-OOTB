/**
 * Shared fixtures for the finance test files (receipts, collections, disbursements, accounting, journal, commission,
 * payments). Uses the real app; if another module fails to load while it is being written, falls back to an app
 * with the core and finance modules only so the finance suites can still run.
 */
import express from 'express';
import request from 'supertest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/lib/errors.js';
import { query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { createOwnBookRole } from './helpers.js';

const FALLBACK = ['auth', 'users', 'notifications', 'settings', 'uploads', 'accounting', 'journal-vouchers', 'receipts', 'collections', 'disbursements', 'commission', 'payments'];

async function minimalApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  const api = express.Router();
  app.use('/api', api);
  for (const name of FALLBACK) {
    const m = await import(`../src/modules/${name}/router.js`);
    api.use(m.mount || '/', m.default);
    for (const [prefix, r] of m.extraMounts || []) api.use(prefix, r);
  }
  api.use((req, res) => res.status(404).json({ success: false, message: `Cannot ${req.method} /api${req.url}` }));
  app.use(errorHandler);
  return app;
}

const PASSWORD = 'Welcome@123';
export async function setupFinance() {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {} });
  clearSettingsCache();
  let app;
  try { app = await createApp(); } catch { app = await minimalApp(); }
  const login = async (username, password) => (await request(app).post('/api/auth/login').send({ username, password })).body.accessToken;
  const admin = await login('BrokerVerse', process.env.ADMIN_PASSWORD);
  const as = (token) => (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  const adminApi = as(admin);
  // 'agent': a role restricted to its own book (security.scoped_roles), with the withdrawn agent role's permissions
  const ownBook = await createOwnBookRole(adminApi);
  clearSettingsCache();
  const personas = { maker: ['fin.maker', 'accounting'], checker: ['fin.checker', 'accounting'], agent: ['agt.user', ownBook], claims: ['clm.user', 'claims'], sales: ['sls.user', 'sales'] };
  const tokens = {};
  const ids = {};
  for (const [k, [username, role]] of Object.entries(personas)) {
    const r = await adminApi('post', '/users').send({ username, password: PASSWORD, displayName: `${k} user`, roles: [role], email: `${username}@example.ph` });
    ids[k] = r.body.data?.userId;
    tokens[k] = await login(username, PASSWORD);
  }
  return { app, api: adminApi, as: (k) => as(tokens[k]), userIds: ids };
}

let seq = 0;
/** Insert a client + policy (and optionally set commission details) directly with SQL. */
export async function makePolicy({ net = 10000, insurer = 'MALAYAN', product = 'MOTOR', details = {}, owner = null, inceptionOffset = -10 } = {}) {
  seq += 1;
  const tag = `${Date.now().toString(36)}${seq}`;
  const client = (await query(`INSERT INTO clients(client_code, display_name, first_name, last_name, email, created_by) VALUES ($1,$2,'Test','Client ' || $3,$4,'test') RETURNING *`,
    [`CL-T-${tag}`, `Test Client ${tag}`, tag, `client.${tag}@example.ph`])).rows[0];
  const gross = Math.round(net * 1.2525 * 100) / 100;
  // the business date (Manila), not the database server's date: the two differ for eight hours a day
  const inception = addDays(await today(), inceptionOffset);
  const policy = (await query(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, premium_total, commission_amount, details)
    VALUES ($1,$2,(SELECT id FROM products WHERE code = $3),(SELECT id FROM insurance_companies WHERE code = $4),$5,'active', $6::date, $6::date + 365, $7, $8, $9) RETURNING *`,
  [`POL-T-${tag}`, client.id, product, insurer, owner, inception, gross, Math.round(net * 0.15 * 100) / 100, JSON.stringify({ netPremium: net, ...details })])).rows[0];
  return { client, policy, gross, net };
}

/** Assert that every journal is balanced and the receivables sub-ledger equals the GL control account. */
export async function ledgerIntegrity() {
  const unbalanced = (await query('SELECT jv_id FROM journal_lines GROUP BY jv_id HAVING sum(debit) <> sum(credit)')).rows.length;
  const diff = (await query(`SELECT (SELECT COALESCE(sum(balance),0) FROM receivables) - (SELECT COALESCE(sum(l.debit - l.credit),0) FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
    WHERE l.account_code = '1202001' AND j.status IN ('posted','reversed')) AS d`)).rows[0].d;
  return { unbalanced, diff: Number(diff) };
}
