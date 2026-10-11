import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, enableFeatures } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let sales;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

beforeAll(async () => {
  ctx = await setup();
  // functions of a later release (modules/features), enabled as the platform administrators do
  await enableFeatures(ctx.app, ['rfq-multi-insurer']);
  await ctx.api('post', '/users').send({ username: 'rfq.sales', password: 'Welcome@123', displayName: 'rfq.sales', email: 'rfq.sales@example.ph', roles: ['sales'] });
  const token = await loginAs(ctx.app, 'rfq.sales', 'Welcome@123');
  sales = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
});
afterAll(async () => { await pool.end(); });

describe('Request for Quotation (broker slip) with a new prospect', () => {
  const rfq = (extra) => ({ productType: 'Contractor\'s All Risks', riskDetails: { project: 'Warehouse, Calamba' }, requestedCovers: [{ cover: 'Contract works', sumInsured: 45000000 }],
    insurers: ['MALAYAN', 'PIONEER'], ...extra });

  it('saves the prospect as a lead and the slip against it in one step', async () => {
    const r = await sales('post', '/broker-slips').send(rfq({ prospect: { companyName: 'Laguna Builders Corp.', emailId: 'projects@lagunabuilders.example.ph', contactNumber: '0495550101' } }));
    expect(r.status).toBe(201);
    expect(r.body.newProspectId).toMatch(/^ld_/);
    expect(r.body.insuredName).toBe('Laguna Builders Corp.');
    const [lead] = await q('SELECT company_name, email, lead_category, lob, owner_user_id FROM leads WHERE id = $1', [r.body.newProspectId]);
    expect(lead).toMatchObject({ company_name: 'Laguna Builders Corp.', email: 'projects@lagunabuilders.example.ph', lead_category: 'Corporate', lob: 'ENGINEERING' });
    const [slip] = await q('SELECT lead_id FROM broker_slips WHERE id = $1', [r.body.brokerSlipId || r.body.id]);
    expect(slip.lead_id).toBe(r.body.newProspectId);
    const audit = await q("SELECT after_data FROM audit_log WHERE entity = 'lead' AND entity_id = $1 AND action = 'create'", [r.body.newProspectId]);
    expect(audit[0].after_data.source).toBe('request-for-quotation');
    // the new prospect is in the owner's prospect list
    expect((await sales('get', `/leads/${r.body.newProspectId}`)).status).toBe(200);
  });

  it('needs a lead, a client or a prospect with a name, and saves nothing on failure', async () => {
    const before = (await q('SELECT count(*)::int AS n FROM leads'))[0].n;
    expect((await sales('post', '/broker-slips').send(rfq({ prospect: { emailId: 'x@example.ph' } }))).status).toBe(400);
    expect((await sales('post', '/broker-slips').send(rfq({}))).status).toBe(400);
    expect((await sales('post', '/broker-slips').send(rfq({ prospect: { firstName: 'Ana' }, productType: 'Nonexistent', insurers: ['NO-SUCH-INSURER'] }))).status).toBe(400);
    expect((await q('SELECT count(*)::int AS n FROM leads'))[0].n).toBe(before);
  });
});
