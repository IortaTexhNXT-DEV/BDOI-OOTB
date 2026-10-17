/**
 * Finance control settings (GAP-FIN-05; TIS-BRD-NFR-5.2, NFR-02): IT AppSupport keeps the system configuration but
 * cannot switch off a control of Finance; Finance changes them on Period Management > Finance Controls, and nothing but
 * the finance controls there. The System Administrator always passes.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setup } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache, getSetting } from '../src/lib/settings.js';
import { FINANCE_CONTROL_KEYS } from '../src/lib/financeControls.js';

let ctx; let it1; let finance; let ops;
const PASSWORD = 'Welcome@123';
async function person(username, role) {
  const r = await ctx.api('post', '/users').send({ username, password: PASSWORD, displayName: `${username} user`, roles: [role], email: `${username}@example.ph` });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const token = (await request(ctx.app).post('/api/auth/login').send({ username, password: PASSWORD })).body.accessToken;
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const value = async (key) => { clearSettingsCache(); return getSetting(key); };

beforeAll(async () => {
  ctx = await setup();
  it1 = await person('fc.it', 'tis-it-admin');
  finance = await person('fc.finance', 'tis-finance');
  ops = await person('fc.sales', 'tis-sales-associate');
});
afterAll(async () => { await pool.end(); });

describe('finance controls', () => {
  it('IT AppSupport changes the configuration but not a finance control', async () => {
    const refused = await it1('put', '/system-settings/configuration').send({ settings: { 'finance.maker_checker_enabled': false } });
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/finance control/);
    expect(await value('finance.maker_checker_enabled')).toBe(true);
    // the same value again is no change and passes; another setting passes
    expect((await it1('put', '/system-settings/configuration').send({ settings: { 'finance.maker_checker_enabled': true } })).status).toBe(200);
    expect((await it1('put', '/system-settings/configuration').send({ settings: { 'limits.bulk_upload_max_rows': 900 } })).status).toBe(200);
    expect((await it1('put', '/period-end/finance-controls').send({ settings: { 'journal.require_approval': false } })).status).toBe(403);
  });

  it('Finance lists and changes its controls on Finance Controls, and nothing else there', async () => {
    const list = await finance('get', '/period-end/finance-controls');
    expect(list.status).toBe(200);
    expect(list.body.data.map((r) => r.key)).toEqual(FINANCE_CONTROL_KEYS);
    expect(list.body.data.every((r) => r.canChange)).toBe(true);
    const saved = await finance('put', '/period-end/finance-controls').send({ settings: { 'accounting.reopen_closed_periods': true } });
    expect(saved.status, JSON.stringify(saved.body)).toBe(200);
    expect(await value('accounting.reopen_closed_periods')).toBe(true);
    const audit = (await query('SELECT after_data FROM audit_log WHERE entity = \'settings\' ORDER BY id DESC LIMIT 1')).rows[0];
    expect(audit.after_data).toEqual({ 'accounting.reopen_closed_periods': true });
    const other = await finance('put', '/period-end/finance-controls').send({ settings: { 'limits.bulk_upload_max_rows': 10 } });
    expect(other.status).toBe(400);
    expect((await finance('put', '/period-end/finance-controls').send({ settings: { 'accounting.parked_events': ['no.such.event'] } })).status).toBe(400);
    await finance('put', '/period-end/finance-controls').send({ settings: { 'accounting.reopen_closed_periods': false } });
  });

  it('a reader of period end sees the controls without the right to change them; the administrator passes', async () => {
    const gm = await person('fc.gm', 'tis-general-manager');
    const list = await gm('get', '/period-end/finance-controls');
    expect(list.status).toBe(200);
    expect(list.body.data.every((r) => r.canChange === false)).toBe(true);
    expect((await ops('get', '/period-end/finance-controls')).status).toBe(403);
    expect((await ctx.api('put', '/settings').send({ settings: { 'payables.maker_checker': false } })).status).toBe(200);
    expect(await value('payables.maker_checker')).toBe(false);
    await ctx.api('put', '/settings').send({ settings: { 'payables.maker_checker': true } });
  });
});
