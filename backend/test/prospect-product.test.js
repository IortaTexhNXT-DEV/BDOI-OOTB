/**
 * Prospects without a product: created with Skip - tag product later (and by the lead upload without LOB or Product),
 * listed on the tab Product not yet tagged, tagged later with an audit trail, asked for a product before the first
 * quotation, left to the assignment rules without a line; the products grouped by line of business for the pickers,
 * with the product checked against the chosen line.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
const as = {};
const ids = {};
const product = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const setting = async (key, value) => {
  await pool.query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  ids[username] = (await q('SELECT id FROM users WHERE username = $1', [username]))[0].id;
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

const prospect = (body = {}) => as['pp.sales']('post', '/leads').send({ firstName: 'Tala', lastName: 'Reyes', emailId: 'tala.reyes@example.ph', contactNumber: '09171112222', ...body });

beforeAll(async () => {
  ctx = await setup();
  await persona('pp.sales', ['tis-sales-officer']);
  await persona('pp.ae', ['tis-sales-associate']);
  await persona('pp.claims', ['claims']);
  for (const r of await q("SELECT id, code FROM products WHERE code IN ('MOTOR', 'CTPL', 'PA', 'TRAVEL', 'FIRE', 'CL-COMP')")) product[r.code] = r.id;
});
afterAll(async () => { await pool.end(); });

describe('products grouped by line of business', () => {
  it('lists the active lines that have active products, Motor first, each with its active products', async () => {
    const r = await as['pp.sales']('get', '/placements/product-lines');
    expect(r.status).toBe(200);
    const { lines } = r.body.data;
    expect(lines[0].code).toBe('MOTOR');
    expect(lines.map((l) => l.code).sort()).toEqual(['ACCIDENT', 'LIFE', 'MARINE', 'MOTOR']);
    expect(lines[0].products.map((p) => p.code).sort()).toEqual(['CTPL', 'MOTOR']);
    expect(lines.find((l) => l.code === 'ACCIDENT')).toMatchObject({ name: 'Personal Accident' });
    expect(lines.find((l) => l.code === 'ACCIDENT').products.map((p) => p.code)).not.toContain('MICRO');
    expect(lines.flatMap((l) => l.products).find((p) => p.code === 'PA')).toMatchObject({ line: 'ACCIDENT', lob: 'ACCIDENT', businessType: 'package' });
    // a line switched off in the Line of Business master is not offered, even with an active product
    await q("UPDATE master_records SET status = 'inactive' WHERE type_code = 'line-of-business' AND code = 'MARINE'");
    try {
      expect((await as['pp.sales']('get', '/placements/product-lines')).body.data.lines.map((l) => l.code)).not.toContain('MARINE');
    } finally { await q("UPDATE master_records SET status = 'active' WHERE type_code = 'line-of-business' AND code = 'MARINE'"); }
    const nonPackage = (await as['pp.sales']('get', '/placements/product-lines?businessType=non_package')).body.data.lines;
    expect(nonPackage.flatMap((l) => l.products).every((p) => p.businessType === 'non_package')).toBe(true);
    expect((await as['pp.claims']('get', '/placements/product-lines')).status).toBe(403);
  });
});

describe('a prospect without a product', () => {
  let untagged;
  it('is created with no line of business and no product, and listed on its own tab', async () => {
    const r = await prospect();
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ lob: null, productId: null, productTagged: false });
    untagged = r.body.leadId;
    const tab = await as['pp.sales']('get', '/leads?lob=none&pageSize=100');
    expect(tab.body.data.map((l) => l.leadId)).toContain(untagged);
    expect(tab.body.data.every((l) => l.lob === null)).toBe(true);
    expect((await as['pp.sales']('get', '/leads?lob=MOTOR&pageSize=100')).body.data.map((l) => l.leadId)).not.toContain(untagged);
    const stats = (await as['pp.sales']('get', '/leads/stats')).body;
    expect(stats.untaggedLeads).toBeGreaterThanOrEqual(1);
    expect(stats.leadsByLob.find((x) => x.lob === 'Product not yet tagged').count).toBe(stats.untaggedLeads);
    const csv = (await as['pp.sales']('get', '/leads/report?format=csv')).text.split('\r\n');
    expect(csv[0].split(',').slice(-1)[0]).toBe('Product');
    expect(csv.find((line) => line.includes('tala.reyes@example.ph'))).toContain('Product not yet tagged');
  });

  it('is refused when leads.product_required is on', async () => {
    await setting('leads.product_required', true);
    try {
      const r = await prospect({ emailId: 'required@example.ph' });
      expect(r.status).toBe(400);
      expect(r.body.errors[0].path).toBe('lob');
      expect((await prospect({ emailId: 'required@example.ph', lob: 'MOTOR', productId: product.CTPL })).status).toBe(201);
    } finally { await setting('leads.product_required', false); }
  });

  it('takes a product only from the chosen line', async () => {
    const wrong = await prospect({ emailId: 'wrong.line@example.ph', lob: 'MOTOR', productId: product.PA });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors[0]).toMatchObject({ path: 'productId', message: 'Personal Accident is not a product of the line of business MOTOR' });
    const inactive = await prospect({ emailId: 'inactive@example.ph', lob: 'FIRE', productId: product.FIRE });
    expect(inactive.status).toBe(400);
    const ok = await prospect({ emailId: 'travel@example.ph', lob: 'ACCIDENT', productId: product.TRAVEL });
    expect(ok.body).toMatchObject({ lob: 'ACCIDENT', productId: product.TRAVEL, productName: 'Travel Insurance', productType: 'Travel Insurance', productTagged: true });
  });

  it('is tagged later, and changed, with an audit trail', async () => {
    const missing = await as['pp.sales']('put', `/leads/${untagged}/product`).send({ lob: 'MOTOR' });
    expect(missing.status).toBe(400);
    expect(missing.body.errors[0].path).toBe('productId');
    expect((await as['pp.sales']('put', `/leads/${untagged}/product`).send({ lob: 'LIFE', productId: product.CTPL })).status).toBe(400);
    const tagged = await as['pp.sales']('put', `/leads/${untagged}/product`).send({ lob: 'MOTOR', productId: product.CTPL });
    expect(tagged.status).toBe(200);
    expect(tagged.body).toMatchObject({ message: 'Product tagged', lob: 'MOTOR', productId: product.CTPL, productName: 'Compulsory Third Party Liability', productTagged: true });
    const changed = await as['pp.sales']('put', `/leads/${untagged}/product`).send({ lob: 'ACCIDENT', productId: product.PA });
    expect(changed.body).toMatchObject({ message: 'Product changed', lob: 'ACCIDENT', productName: 'Personal Accident' });
    const trail = await q("SELECT before_data AS before, after_data AS after FROM audit_log WHERE entity = 'lead' AND entity_id = $1 AND action = 'tag-product' ORDER BY id", [untagged]);
    expect(trail).toHaveLength(2);
    expect(trail[0].before).toMatchObject({ lob: null, productId: null });
    expect(trail[0].after).toMatchObject({ lob: 'MOTOR', productId: product.CTPL, productName: 'Compulsory Third Party Liability' });
    expect(trail[1].before).toMatchObject({ lob: 'MOTOR' });
    expect((await as['pp.claims']('put', `/leads/${untagged}/product`).send({ lob: 'MOTOR', productId: product.MOTOR })).status).toBe(403);
  });

  it('needs a product before its first quotation', async () => {
    const lead = (await prospect({ emailId: 'quote.first@example.ph' })).body;
    const refused = await as['pp.sales']('post', '/quotations').send({ leadRefId: lead.leadId, netPremium: '1000' });
    expect(refused.status).toBe(400);
    expect(refused.body.errors[0]).toMatchObject({ path: 'productId', message: expect.stringMatching(/no product yet/) });
    const wrongLine = await as['pp.sales']('post', '/quotations').send({ leadRefId: lead.leadId, lob: 'ACCIDENT', productId: product.MOTOR, productType: 'Motor', netPremium: '1000' });
    expect(wrongLine.status).toBe(400);
    const quoted = await as['pp.sales']('post', '/quotations').send({ leadRefId: lead.leadId, productType: 'Motor', netPremium: '1000' });
    expect(quoted.status).toBe(201);
  });

  it('comes from a lead upload without LOB and Product; a product is checked against the LOB', async () => {
    const csv = 'First Name,Last Name,Email,LOB,Product\nUp,Untagged,up.untagged@example.ph,,\nUp,Ctpl,up.ctpl@example.ph,Motor,CTPL\nUp,ByProduct,up.byproduct@example.ph,,Personal Accident\nUp,Wrong,up.wrong@example.ph,Motor,PA\n';
    const r = await as['pp.sales']('post', '/leads/bulk-upload').attach('file', Buffer.from(csv), 'leads.csv');
    expect(r.body.data).toMatchObject({ total: 4, created: 3, failed: 1 });
    expect(r.body.data.errors[0]).toMatchObject({ row: 5, message: expect.stringMatching(/not a product of the line of business MOTOR/) });
    const rows = await q("SELECT last_name, lob, product_id FROM leads WHERE first_name = 'Up' ORDER BY last_name");
    expect(rows).toEqual([{ last_name: 'ByProduct', lob: 'ACCIDENT', product_id: product.PA }, { last_name: 'Ctpl', lob: 'MOTOR', product_id: product.CTPL },
      { last_name: 'Untagged', lob: null, product_id: null }]);
  });

  it('follows the assignment rules without a line; once tagged, a prospect queued for want of a matching rule is assigned', async () => {
    await q('DELETE FROM lead_assignment_rules');
    const rule = await as['pp.sales']('post', '/lead-assignment/rules').send({ name: 'Motor desk', priority: 10, method: 'fixed', conditions: { lob: 'MOTOR' }, assignees: [ids['pp.ae']] });
    expect(rule.status).toBe(201);
    await setting('leads.assignment_fallback', 'queue');
    try {
      const lead = (await prospect({ emailId: 'queued@example.ph' })).body;
      expect(lead).toMatchObject({ assignmentStatus: 'queued', queueReason: 'No assignment rule matched' });
      await as['pp.sales']('put', `/leads/${lead.leadId}/product`).send({ lob: 'ACCIDENT', productId: product.PA });
      expect((await as['pp.sales']('get', `/leads/${lead.leadId}`)).body.assignmentStatus).toBe('queued');
      await as['pp.sales']('put', `/leads/${lead.leadId}/product`).send({ lob: 'MOTOR', productId: product.MOTOR });
      const after = (await as['pp.sales']('get', `/leads/${lead.leadId}`)).body;
      expect(after).toMatchObject({ assignmentStatus: 'assigned', ownerUserId: ids['pp.ae'] });
      const history = await q('SELECT action FROM lead_assignment_history WHERE lead_id = $1 ORDER BY id', [lead.leadId]);
      expect(history.map((h) => h.action)).toEqual(['queued', 'auto']);
    } finally {
      await setting('leads.assignment_fallback', 'creator');
      await q('DELETE FROM lead_assignment_rules');
    }
  });
});
