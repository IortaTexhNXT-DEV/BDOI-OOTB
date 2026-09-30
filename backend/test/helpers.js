import request from 'supertest';
import { migrate } from '../src/db/migrate.js';
import { seed } from '../src/db/seed.js';
import { createApp } from '../src/app.js';

/** Fresh schema + seed, an app instance and an admin token. Call once per test file (beforeAll). */
export async function setup() {
  await migrate({ reset: true, log: () => {} });
  await seed({ log: () => {} });
  const app = await createApp();
  const r = await request(app).post('/api/auth/login').send({ username: 'BrokerVerse', password: process.env.ADMIN_PASSWORD });
  return { app, token: r.body.accessToken, api: (m, p) => request(app)[m](`/api${p}`).set('Authorization', `Bearer ${r.body.accessToken}`) };
}
/**
 * A custom role limited to its own book, for the record-scoping tests. The Agent / Referrer login role was withdrawn
 * (referrers do not sign in), but any role an administrator creates can be restricted to its own book through
 * security.scoped_roles; this one has the permissions the withdrawn agent role had.
 */
export const OWN_BOOK_ROLE = 'own-book';
export const OWN_BOOK_PERMISSIONS = ['profile', 'leads', 'quotations', 'policies', 'endorsements', 'claims', 'notifications']
  .flatMap((m) => [`read:${m}`, `write:${m}`]).concat('read:clients');
export async function createOwnBookRole(api) {
  const r = await api('post', '/roles').send({ code: OWN_BOOK_ROLE, name: 'Own book (test)', permissions: OWN_BOOK_PERMISSIONS });
  if (r.status !== 201) throw new Error(`own-book role: ${r.status} ${JSON.stringify(r.body)}`);
  const s = await api('put', '/settings').send({ settings: { 'security.scoped_roles': [OWN_BOOK_ROLE] } });
  if (s.status !== 200) throw new Error(`scoped roles: ${s.status}`);
  return OWN_BOOK_ROLE;
}
/**
 * A custom user-administration role that is not an administrator (what the withdrawn User Access Administrator did):
 * users, roles, the audit trail. Used to check the protections of the System Administrator role and of one's own access.
 */
export const USER_DESK_ROLE = 'user-desk';
export async function createUserDeskRole(api) {
  const permissions = ['read:profile', 'write:profile', 'read:users', 'write:users', 'read:roles', 'write:roles', 'read:audit', 'read:notifications', 'write:notifications', 'read:settings'];
  const r = await api('post', '/roles').send({ code: USER_DESK_ROLE, name: 'User desk (test)', permissions });
  if (r.status !== 201) throw new Error(`user-desk role: ${r.status} ${JSON.stringify(r.body)}`);
  return USER_DESK_ROLE;
}
export async function loginAs(app, username, password) {
  const r = await request(app).post('/api/auth/login').send({ username, password });
  return r.body.accessToken;
}
/**
 * Switch off the output VAT and EWT on broker-billed commission (migration 0170), for suites whose expected figures
 * are the premium due to insurers without commission taxes. test/commission-taxes.test.js covers them switched on.
 */
export async function withoutCommissionTaxes() {
  const { query } = await import('../src/db/pool.js');
  const { clearSettingsCache } = await import('../src/lib/settings.js');
  await query('UPDATE app_settings SET value = \'false\' WHERE key IN (\'accounting.broker_billed_commission_vat\', \'accounting.broker_billed_commission_ewt\')');
  clearSettingsCache();
}
