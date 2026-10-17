/**
 * TISPH decisions of 11 Oct 2026 on access (migration 0687): Operations maintains the client KYC (GAP-POLICY-09,
 * write:client-kyc) and the Scheme Master and the promotions are kept by the Sales Unit Head, the General Manager and
 * IT AppSupport, Operations reading them (GAP-SALES-17). The decisions are recorded on the feature catalogue.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { FEATURES, catalogueProblems } from '../src/modules/features/catalogue.js';

let ctx;
const as = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const grants = async (role) => (await q(`SELECT p.code FROM role_permissions rp JOIN roles r ON r.id = rp.role_id JOIN permissions p ON p.id = rp.permission_id
  WHERE r.code = $1 ORDER BY p.code`, [role])).map((x) => x.code);

beforeAll(async () => {
  ctx = await setup();
  for (const [u, role] of [['d.oa', 'tis-ops-associate'], ['d.oo', 'tis-ops-officer'], ['d.ouh', 'tis-ops-unit-head'], ['d.fin', 'tis-finance'], ['d.sa', 'tis-sales-associate'],
    ['d.suh', 'tis-sales-unit-head'], ['d.gm', 'tis-general-manager'], ['d.it', 'tis-it-admin']]) await persona(u, [role]);
});
afterAll(async () => { await pool.end(); });

describe('Operations maintains the client KYC (GAP-POLICY-09)', () => {
  it('lets the Operations personas keep the KYC of a client but not the rest of the client record', async () => {
    for (const u of ['d.oa', 'd.oo', 'd.ouh']) {
      const r = await as[u]('put', '/clients/cl_sls_92/kyc').send({ occupation: `Engineer ${u}` });
      expect(r.status, `${u} ${JSON.stringify(r.body)}`).toBe(200);
    }
    const [c] = await q("SELECT occupation FROM clients WHERE id = 'cl_sls_92'");
    expect(c.occupation).toBe('Engineer d.ouh');
    expect((await as['d.oa']('put', '/clients/cl_sls_92').send({ remarks: 'x' })).status).toBe(403);
    const sig = await as['d.oa']('post', '/clients/cl_sls_92/signatories').send({ fullName: 'Maria Reyes', position: 'Treasurer' });
    expect(sig.status, JSON.stringify(sig.body)).not.toBe(403);
  });
  it('leaves the others as they were: Finance reads, Sales edits with the client', async () => {
    expect((await as['d.fin']('put', '/clients/cl_sls_92/kyc').send({ occupation: 'Clerk' })).status).toBe(403);
    expect((await as['d.fin']('get', '/clients/cl_sls_92/profile')).status).toBe(200);
    expect((await as['d.sa']('put', '/clients/cl_sls_92/kyc').send({ occupation: 'Teacher' })).status).toBe(200);
    for (const role of ['tis-finance', 'tis-sales-associate', 'tis-it-admin', 'tis-general-manager']) expect(await grants(role), role).not.toContain('write:client-kyc');
  });
});

describe('scheme and promotion masters (GAP-SALES-17)', () => {
  it('are made and approved by the Sales Unit Head, the General Manager and IT AppSupport', async () => {
    for (const role of ['tis-sales-unit-head', 'tis-general-manager', 'tis-it-admin']) {
      expect(await grants(role), role).toEqual(expect.arrayContaining(['read:schemes', 'write:schemes', 'approve:schemes', 'read:promotions', 'write:promotions', 'approve:promotions']));
    }
    // past the permission, the body is checked (400): the maker may create
    for (const u of ['d.suh', 'd.gm', 'd.it']) {
      expect((await as[u]('post', '/schemes').send({})).status, u).toBe(400);
      expect((await as[u]('post', '/promotions').send({})).status, u).toBe(400);
    }
  });
  it('are read only for Operations and every other persona', async () => {
    for (const role of ['tis-ops-officer', 'tis-ops-unit-head', 'tis-ops-associate', 'tis-sales-officer', 'tis-finance']) {
      const g = await grants(role);
      expect(g, role).toContain('read:schemes');
      expect(g, role).not.toContain('write:schemes');
      expect(g, role).not.toContain('write:promotions');
    }
    expect(await grants('tis-ops-officer')).toContain('write:discount-caps');
    for (const u of ['d.oo', 'd.ouh']) {
      expect((await as[u]('post', '/schemes').send({})).status, u).toBe(403);
      expect((await as[u]('post', '/promotions').send({})).status, u).toBe(403);
      expect((await as[u]('get', '/schemes')).status, u).toBe(200);
    }
  });
});

describe('decisions recorded on the feature catalogue', () => {
  it('names the decision, its answer and its date for each gap', () => {
    const decided = Object.fromEntries(FEATURES.filter((f) => f.decision?.decided).map((f) => [`${f.key}:${f.decision.id}`, f.decision.decided]));
    for (const k of ['clients:GAP-POLICY-09', 'product-configurator:GAP-POLICY-25', 'dealer-programmes:GAP-SALES-17', 'promotions:GAP-SALES-17', 'quotations:GAP-QUOTE-23']) {
      expect(decided[k], k).toMatchObject({ by: 'TISPH', on: '2026-10-11' });
    }
    expect(decided['product-configurator:GAP-POLICY-25'].answer).toBe('Standard BrokerVerse prints');
    expect(catalogueProblems()).toEqual([]);
  });
});
