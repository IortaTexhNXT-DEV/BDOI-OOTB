/**
 * Placement slip approved by a second user before it is sent to the insurer (GAP-POLICY-21, migration 0686):
 * placement.send_requires_approval (delivered on) and placement.send_approval_roles; the maker submits, a user of the
 * approval roles who neither raised nor submitted the slip approves or rejects (with the reason), My Work lists the
 * slips waiting, an edit clears the approval, and the setting switched off sends at once.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withProducts } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
let ic;
const as = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const setting = async (key, value) => { await q('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const raise = async (api, extra = {}) => {
  const r = await api('post', '/placements').send({ clientId: 'cl_sls_92', productType: 'Marine Cargo', riskDetails: { voyage: 'Manila to Cebu', cargo: 'Appliances' }, sumInsured: 500000, netPremium: 2500, inceptionDate: '2026-11-01',
    participants: [{ insuranceCompanyId: ic.MALAYAN, sharePercent: 100, isLead: true }], ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body;
};

beforeAll(async () => {
  ctx = await setup();
  // Marine Cargo is placed without a quotation (a line TISPH does not sell yet, switched on as an administrator would)
  await withProducts();
  ic = Object.fromEntries((await q('SELECT code, id FROM insurance_companies')).map((r) => [r.code, r.id]));
  await persona('sa.maker', ['tis-ops-officer']);
  await persona('sa.associate', ['tis-ops-associate']);
  await persona('sa.officer', ['tis-sales-officer']);
  await persona('sa.head', ['tis-ops-unit-head']);
});
afterAll(async () => { await pool.end(); });

describe('approval before the placement slip is sent (GAP-POLICY-21)', () => {
  it('is delivered on with the approval roles', async () => {
    const rows = Object.fromEntries((await q("SELECT key, value FROM app_settings WHERE key IN ('placement.send_requires_approval', 'placement.send_approval_roles')")).map((r) => [r.key, r.value]));
    expect(rows['placement.send_requires_approval']).toBe(true);
    expect(rows['placement.send_approval_roles']).toEqual(expect.arrayContaining(['tis-sales-officer', 'tis-ops-unit-head', 'tis-general-manager']));
    expect(rows['placement.send_approval_roles']).not.toContain('tis-ops-associate');
  });

  it('refuses to send a raised slip until a second user approved it', async () => {
    const p = await raise(as['sa.maker']);
    const early = await as['sa.maker']('post', `/placements/${p.id}/send`).send({});
    expect(early.status).toBe(409);
    expect(early.body.message).toMatch(/must be approved by a second user before it is sent to the insurer/);
    const sub = await as['sa.maker']('post', `/placements/${p.id}/request-approval`).send({ remarks: 'Firm order as quoted' });
    expect(sub.status, JSON.stringify(sub.body)).toBe(200);
    expect(sub.body.sendApproval).toMatchObject({ status: 'pending', requestedBy: 'sa.maker' });
    expect((await as['sa.maker']('post', `/placements/${p.id}/request-approval`).send({})).status).toBe(409);
    const waiting = await as['sa.maker']('post', `/placements/${p.id}/send`).send({});
    expect(waiting.body.message).toMatch(/is waiting for approval/);
    // the maker never approves, nor a role outside placement.send_approval_roles
    const own = await as['sa.maker']('post', `/placements/${p.id}/approval`).send({ decision: 'approve' });
    expect(own.status).toBe(403);
    const assoc = await as['sa.associate']('post', `/placements/${p.id}/approval`).send({ decision: 'approve' });
    expect(assoc.status).toBe(403);
    expect(assoc.body.message).toMatch(/placement.send_approval_roles/);
    // the approver finds it in My Work
    const work = await as['sa.officer']('get', '/my-work/items?category=approvals&pageSize=100');
    expect(JSON.stringify(work.body)).toContain(p.placementNumber);
    const makerWork = await as['sa.maker']('get', '/my-work/items?category=approvals&pageSize=100');
    expect(JSON.stringify(makerWork.body)).not.toContain(p.placementNumber);
    const ok = await as['sa.officer']('post', `/placements/${p.id}/approval`).send({ decision: 'approve' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.sendApproval).toMatchObject({ status: 'approved', decidedBy: 'sa.officer' });
    const sent = await as['sa.maker']('post', `/placements/${p.id}/send`).send({});
    expect(sent.status, JSON.stringify(sent.body)).toBe(200);
    expect(sent.body.data.status).toBe('sent');
    const trail = (await q("SELECT action FROM audit_log WHERE entity = 'placement' AND entity_id = $1 ORDER BY id", [p.id])).map((r) => r.action);
    expect(trail).toEqual(expect.arrayContaining(['submit-approval', 'approve-send', 'send']));
    // the order already with the insurer is sent again without a new approval
    expect((await as['sa.maker']('post', `/placements/${p.id}/send`).send({})).status).toBe(200);
  });

  it('a rejection needs the reason and goes back to the maker; an edit clears an approval', async () => {
    const p = await raise(as['sa.maker']);
    await as['sa.maker']('post', `/placements/${p.id}/request-approval`).send({});
    const noReason = await as['sa.head']('post', `/placements/${p.id}/approval`).send({ decision: 'reject' });
    expect(noReason.status).toBe(400);
    const rejected = await as['sa.head']('post', `/placements/${p.id}/approval`).send({ decision: 'reject', note: 'Premium differs from the quotation' });
    expect(rejected.body.sendApproval).toMatchObject({ status: 'rejected', note: 'Premium differs from the quotation' });
    const [n] = await q("SELECT title FROM notifications WHERE entity_id = $1 AND user_id = (SELECT id FROM users WHERE username = 'sa.maker') ORDER BY id DESC LIMIT 1", [p.id]);
    expect(n?.title).toMatch(/rejected/);
    expect((await as['sa.maker']('post', `/placements/${p.id}/send`).send({})).status).toBe(409);
    expect((await as['sa.maker']('post', `/placements/${p.id}/request-approval`).send({})).status).toBe(200);
    expect((await as['sa.head']('post', `/placements/${p.id}/approval`).send({ decision: 'approve' })).status).toBe(200);
    const edited = await as['sa.maker']('put', `/placements/${p.id}`).send({ remarks: 'Period moved' });
    expect(edited.status, JSON.stringify(edited.body)).toBe(200);
    expect(edited.body.sendApproval).toBeNull();
    expect((await as['sa.maker']('post', `/placements/${p.id}/send`).send({})).status).toBe(409);
  });

  it('sends at once when placement.send_requires_approval is off', async () => {
    await setting('placement.send_requires_approval', false);
    try {
      const p = await raise(as['sa.maker']);
      expect((await as['sa.maker']('post', `/placements/${p.id}/request-approval`).send({})).status).toBe(409);
      expect((await as['sa.maker']('post', `/placements/${p.id}/send`).send({})).status).toBe(200);
    } finally {
      await setting('placement.send_requires_approval', true);
    }
  });
});
