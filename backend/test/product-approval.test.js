/**
 * Product register maker-checker (migration 0660; TIS-BRD-PROD-03, SEC-03, GAP-PLAT-09): a template is drafted and
 * submitted by IT AppSupport and goes in force only when a Unit Head or the General Manager who neither created,
 * changed nor submitted it approves it; a return needs a note; nothing changes while it waits; with
 * product.lock_active_templates a template in force changes only through a new version.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withProducts } from './helpers.js';
import { pool, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
const tokens = {};
const PASSWORD = 'Welcome@123';
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tokens[who]}`);
const setSettings = async (settings) => {
  expect((await ctx.api('put', '/settings').send({ settings })).status).toBe(200);
  clearSettingsCache();
};
const draft = (code) => ({ templateCode: code, name: `Template ${code}`, category: 'Fire', lineOfBusiness: 'Fire', effectiveDate: '2026-01-01', status: 'Active' });

beforeAll(async () => {
  ctx = await setup();
  await withProducts();
  for (const [username, role] of [['pa.it', 'tis-it-admin'], ['pa.head', 'tis-ops-unit-head'], ['pa.gm', 'tis-general-manager'], ['pa.sales', 'tis-sales-associate']]) {
    const r = await ctx.api('post', '/users').send({ username, password: PASSWORD, displayName: username, email: `${username}@example.ph`, roles: [role] });
    expect(r.status).toBe(201);
    tokens[username] = await loginAs(ctx.app, username, PASSWORD);
  }
});
afterAll(async () => { await pool.end(); });

describe('draft, submit, approve', () => {
  let id;
  it('a new template starts as a draft and cannot be put in force by its maker', async () => {
    const c = await as('pa.it', 'post', '/product-configurator/products').send(draft('PA-FIRE-1'));
    expect(c.status).toBe(201);
    expect(c.body.data.status).toBe('Draft');
    expect(c.body.message).toMatch(/submit it for approval/);
    id = c.body.data.id;
    const direct = await as('pa.it', 'put', `/product-configurator/products/${id}`).send({ status: 'Active' });
    expect(direct.status).toBe(400);
    expect(direct.body.message).toMatch(/submit the template for approval/);
    expect((await as('pa.it', 'post', `/product-configurator/products/${id}/reactivate`)).status).toBe(400);
    // the approve permission is the Unit Heads' and the General Manager's, not IT AppSupport's
    expect((await as('pa.it', 'post', `/product-configurator/products/${id}/approve`)).status).toBe(403);
  });

  it('a submitted template is frozen; the maker cannot decide it; a return needs a note', async () => {
    const s = await as('pa.it', 'post', `/product-configurator/products/${id}/submit`).send({ note: 'New fire product' });
    expect(s.status).toBe(200);
    expect(s.body.data).toMatchObject({ status: 'Pending Approval', submittedBy: 'pa.it' });
    expect((await as('pa.it', 'post', `/product-configurator/products/${id}/submit`)).status).toBe(409);
    expect((await as('pa.it', 'put', `/product-configurator/products/${id}`).send({ baseRate: 0.4 })).status).toBe(409);
    const cov = await as('pa.it', 'post', '/product-configurator/coverages').send({ productId: id, coverageCode: 'FL', coverageName: 'Fire', type: 'Mandatory' });
    expect(cov.status).toBe(409);
    // an approver who holds write:products and submitted it is refused (here the administrator of the test)
    const mine = await ctx.api('post', '/product-configurator/products').send(draft('PA-FIRE-2'));
    await ctx.api('post', `/product-configurator/products/${mine.body.data.id}/submit`).send({});
    const own = await ctx.api('post', `/product-configurator/products/${mine.body.data.id}/approve`).send({});
    expect(own.status).toBe(403);
    expect(own.body.message).toMatch(/created, changed or submitted/);
    expect((await as('pa.head', 'post', `/product-configurator/products/${id}/return`).send({})).status).toBe(400);
    const back = await as('pa.head', 'post', `/product-configurator/products/${id}/return`).send({ note: 'Add the deductible' });
    expect(back.body.data).toMatchObject({ status: 'Draft', decision: 'returned', decisionNote: 'Add the deductible', decidedBy: 'pa.head' });
  });

  it('shows on the approver\'s My Work and goes in force when another user approves it, with the audit trail', async () => {
    expect((await as('pa.it', 'put', `/product-configurator/products/${id}`).send({ baseRate: 0.4 })).status).toBe(200);
    expect((await as('pa.it', 'post', `/product-configurator/products/${id}/submit`).send({})).status).toBe(200);
    const work = await as('pa.gm', 'get', '/my-work/items?category=approvals&pageSize=200');
    expect(work.status).toBe(200);
    expect(JSON.stringify(work.body)).toContain('PA-FIRE-1');
    const ok = await as('pa.gm', 'post', `/product-configurator/products/${id}/approve`).send({ note: 'Checked' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ status: 'Active', decision: 'approved', decidedBy: 'pa.gm' });
    const actions = (await pool.query("SELECT action FROM audit_log WHERE entity = 'product_template' AND entity_id = $1 ORDER BY id", [String(id)])).rows.map((r) => r.action);
    expect(actions).toEqual(['create', 'submit', 'return', 'update', 'submit', 'approve']);
    // retiring only takes the product out of use: one step
    expect((await as('pa.it', 'post', `/product-configurator/products/${id}/retire`).send({ reason: 'Replaced' })).body.data.status).toBe('Retired');
    // putting it back in force is reviewed again
    expect((await as('pa.it', 'post', `/product-configurator/products/${id}/submit`).send({})).body.data.status).toBe('Pending Approval');
    expect((await as('pa.it', 'post', `/product-configurator/products/${id}/withdraw`).send({})).body.data.status).toBe('Draft');
  });

  it('the Sales Associate reads templates but neither submits nor approves them', async () => {
    expect((await as('pa.sales', 'get', '/product-configurator/products')).status).toBe(200);
    expect((await as('pa.sales', 'post', `/product-configurator/products/${id}/submit`)).status).toBe(403);
    expect((await as('pa.sales', 'post', `/product-configurator/products/${id}/approve`)).status).toBe(403);
  });
});

describe('templates in force', () => {
  it('with product.lock_active_templates a template in force changes only through a new version', async () => {
    const t = await one("SELECT id FROM product_templates WHERE template_code = 'MOT-003-2025' AND status = 'Active' ORDER BY version DESC LIMIT 1");
    const cov = await one("SELECT id FROM product_components WHERE template_id = $1 AND kind = 'coverages' AND status = 'Active' LIMIT 1", [t.id]);
    // delivered off: the template in force is edited as before
    expect((await as('pa.it', 'put', `/product-configurator/products/${t.id}`).send({ description: 'Motor plan' })).status).toBe(200);
    await setSettings({ 'product.lock_active_templates': true });
    const edit = await as('pa.it', 'put', `/product-configurator/products/${t.id}`).send({ baseRate: 3 });
    expect(edit.status).toBe(409);
    expect(edit.body.message).toMatch(/new version/);
    expect((await as('pa.it', 'put', `/product-configurator/coverages/${cov.id}`).send({ description: 'x' })).status).toBe(409);
    expect((await as('pa.it', 'delete', `/product-configurator/coverages/${cov.id}`)).status).toBe(409);
    // the new version is a draft: it is changed freely and goes in force through the review
    const v = await as('pa.it', 'post', `/product-configurator/products/${t.id}/versions`).send({ effectiveDate: '2027-01-01' });
    expect(v.status).toBe(201);
    expect((await as('pa.it', 'put', `/product-configurator/products/${v.body.data.id}`).send({ baseRate: 3 })).status).toBe(200);
    expect((await as('pa.it', 'post', `/product-configurator/products/${v.body.data.id}/submit`).send({})).status).toBe(200);
    expect((await as('pa.head', 'post', `/product-configurator/products/${v.body.data.id}/approve`).send({})).body.data).toMatchObject({ status: 'Active', baseRate: 3 });
    await setSettings({ 'product.lock_active_templates': false });
  });

  it('with product.approval_required off the status is set directly, as on the base platform', async () => {
    await setSettings({ 'product.approval_required': false });
    const c = await as('pa.it', 'post', '/product-configurator/products').send(draft('PA-FIRE-3'));
    expect(c.body.data.status).toBe('Active');
    await setSettings({ 'product.approval_required': true });
  });
});
