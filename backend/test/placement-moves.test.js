import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let associate;
let officer;
let associateId;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}

beforeAll(async () => {
  ctx = await setup();
  const a = await persona('m.associate', ['tis-ops-associate']);
  associate = a.api; associateId = a.id;
  officer = (await persona('m.officer', ['tis-sales-officer'])).api;
});
afterAll(async () => { await pool.end(); });

describe('placement moves carry a remark (ISSUE-04)', () => {
  it('an acknowledgement needs the insurer reference or a remark', async () => {
    const r = await associate('post', '/placements/plc_sample_12/acknowledge').send({});
    expect(r.status).toBe(400);
    expect(r.body.errors[0].message).toContain('acknowledgement reference');
    const ok = await associate('post', '/placements/plc_sample_12/acknowledge').send({ reference: 'AXA-ACK-2026-0091' });
    expect(ok.body.data.status).toBe('acknowledged');
  });

  it('a declined line needs its reason', async () => {
    const [x] = await q("SELECT insurance_company_id FROM risk_participants WHERE entity_type = 'placement' AND entity_id = 'plc_sample_91'");
    const r = await associate('post', '/placements/plc_sample_91/decline').send({ insuranceCompanyId: x.insurance_company_id });
    expect(r.status).toBe(400);
    expect(r.body.errors[0].message).toBe('Enter why the insurer declined');
  });
});

describe('cancelling a placement slip the insurer holds (FR-SIS-024)', () => {
  it('needs a reason, and an approver other than the raiser', async () => {
    expect((await officer('post', '/placements/plc_sample_17/cancel').send({})).status).toBe(400);
    const maker = await associate('post', '/placements/plc_sample_17/cancel').send({ reason: 'Client withdrew' });
    expect(maker.status).toBe(403);
    expect(maker.body.message).toContain('an approver');
    await q('UPDATE placements SET created_by = $2 WHERE id = $1', ['plc_sample_18', associateId]);
    expect((await ctx.api('post', '/placements/plc_sample_18/cancel').send({ reason: 'Wrong vehicle' })).status).toBe(200);
  });

  it('an approver cancels it and each insurer holding it is told', async () => {
    const r = await officer('post', '/placements/plc_sample_17/cancel').send({ reason: 'Client withdrew the order' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('cancelled');
    const mail = await q("SELECT to_address, body_html FROM email_outbox WHERE template = 'placement_cancelled' AND entity_id = 'plc_sample_17'");
    expect(mail.map((m) => m.to_address)).toEqual(['placement@maagap.example.ph']);
    expect(mail[0].body_html).toContain('Client withdrew the order');
    const [a] = await q("SELECT after_data FROM audit_log WHERE entity = 'placement' AND entity_id = 'plc_sample_17' AND action = 'cancel'");
    expect(a.after_data.insurersTold).toEqual(['placement@maagap.example.ph']);
  });

  it('a draft placement slip is cancelled by its maker without the insurer', async () => {
    const r = await associate('post', '/placements/plc_sample_11/cancel').send({ reason: 'Raised twice' });
    expect(r.status).toBe(200);
    expect((await q("SELECT count(*)::int AS n FROM email_outbox WHERE template = 'placement_cancelled' AND entity_id = 'plc_sample_11'"))[0].n).toBe(0);
  });
});
