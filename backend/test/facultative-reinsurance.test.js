import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { splitShares } from '../src/modules/reinsurance/facultative.js';

let ctx;
let processing;
let sales;
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const glBalance = async (code) => Number((await pool.query('SELECT COALESCE(sum(debit - credit), 0) AS b FROM journal_lines WHERE account_code = $1', [code])).rows[0].b);

beforeAll(async () => {
  ctx = await setup();
  processing = await persona('fr.processing', ['processing']);
  sales = await persona('fr.sales', ['sales']);
});
afterAll(async () => { await pool.end(); });

describe('facultative split', () => {
  it('splits premium, commission and brokerage over the lines; the last line takes the rounding', () => {
    const out = splitShares({ fac_premium: 1000, ceding_commission_pct: 25, brokerage_pct: 10 }, [{ id: 1, share_pct: 33.3333 }, { id: 2, share_pct: 33.3333 }, { id: 3, share_pct: 33.3334 }]);
    expect(out.reduce((s, x) => s + x.premium, 0)).toBeCloseTo(1000, 2);
    expect(out.reduce((s, x) => s + x.ceding, 0)).toBeCloseTo(250, 2);
    expect(out.reduce((s, x) => s + x.brokerage, 0)).toBeCloseTo(100, 2);
    expect(out.reduce((s, x) => s + x.net, 0)).toBeCloseTo(650, 2);
  });
});

describe('facultative placement as reinsurance broker', () => {
  let id;
  it('prepares a slip for a cedant: the facultative share, its premium and the default commissions', async () => {
    expect((await sales('post', '/reinsurance/facultative').send({})).status).toBe(403);
    const r = await processing('post', '/reinsurance/facultative').send({ cedantId: 3, cedantPolicyNumber: 'PIS-FIRE-2026-0071', insuredName: 'Mindanao Power Holdings Inc.',
      riskDescription: 'Power plant, property damage and machinery breakdown', riskLocation: 'Misamis Oriental', lineOfBusiness: 'Property', periodFrom: '2026-11-01', periodTo: '2027-11-01',
      sumInsured: 4500000000, grossPremium: 6750000, facSharePct: 40, shares: [{ reinsurerId: 'RE002', sharePct: 60 }, { reinsurerId: 'RE003', sharePct: 40 }] });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ status: 'draft', facSumInsured: 1800000000, facPremium: 2700000, cedingCommissionPct: 25, brokeragePct: 10, cedingCommission: 675000, brokerage: 270000, dueFromCedant: 2025000 });
    expect(r.body.data.shares.map((s) => s.status)).toEqual(['approached', 'approached']);
    id = r.body.data.id;
    // a reinsurer below the minimum security rating is refused
    const weak = await processing('post', `/reinsurance/facultative/${id}/shares`).send({ reinsurerId: 'RE005', sharePct: 10 });
    expect(weak.status).toBe(400);
  });

  it('sends the slip to the market (e-mail with the slip to each reinsurer) and prints it', async () => {
    const s = await processing('post', `/reinsurance/facultative/${id}/send`).send({ email: true });
    expect(s.status).toBe(200);
    expect(s.body.data.status).toBe('in-market');
    expect(s.body.queued).toBe(2);
    const pdf = await processing('get', `/reinsurance/facultative/${id}/documents/slip`).buffer(true).parse(binary);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect((await processing('get', `/reinsurance/facultative/${id}/documents/cover-note`)).status).toBe(400);
  });

  it('is placed when the accepted lines reach 100% of the share; over-placement is refused; binding needs a full placement', async () => {
    await processing('post', `/reinsurance/facultative/${id}/shares`).send({ reinsurerId: 'RE002', sharePct: 60, status: 'accepted', reinsurerReference: 'SRA-FAC-77812' });
    expect((await processing('post', `/reinsurance/facultative/${id}/bind`)).status).toBe(409);
    const over = await processing('post', `/reinsurance/facultative/${id}/shares`).send({ reinsurerId: 'RE003', sharePct: 50, status: 'accepted' });
    expect(over.status).toBe(400);
    const ok = await processing('post', `/reinsurance/facultative/${id}/shares`).send({ reinsurerId: 'RE003', sharePct: 40, status: 'accepted', reinsurerReference: 'MRS-55120' });
    expect(ok.body.data).toMatchObject({ status: 'placed', placedPct: 100 });
  });

  let swissShare;
  it('binding books the premium due from the cedant, the net due to each reinsurer and the brokerage', async () => {
    const recv0 = await glBalance('1203003');
    const pay0 = await glBalance('2201005');
    const inc0 = await glBalance('3201003');
    const b = await processing('post', `/reinsurance/facultative/${id}/bind`);
    expect(b.status).toBe(200);
    expect(b.body.data).toMatchObject({ dueFromCedant: 2025000, brokerage: 270000, cedingCommission: 675000, lines: 2 });
    expect(await glBalance('1203003') - recv0).toBeCloseTo(2025000, 2);
    expect(await glBalance('2201005') - pay0).toBeCloseTo(-1755000, 2);
    expect(await glBalance('3201003') - inc0).toBeCloseTo(-270000, 2);
    const p = (await processing('get', `/reinsurance/facultative/${id}`)).body.data;
    swissShare = p.shares.find((s) => s.reinsurerId === 'RE002');
    expect(swissShare).toMatchObject({ premium: 1620000, cedingCommission: 405000, brokerage: 162000, netPremium: 1053000, outstanding: 1053000 });
    expect(p.premiumDueDate).toBeTruthy();
    for (const kind of ['cover-note', 'debit-note']) {
      const pdf = await processing('get', `/reinsurance/facultative/${id}/documents/${kind}`).buffer(true).parse(binary);
      expect(pdf.status).toBe(200);
    }
    const cn = await processing('get', `/reinsurance/facultative/${id}/documents/credit-note?shareId=${swissShare.id}`).buffer(true).parse(binary);
    expect(cn.status).toBe(200);
  });

  it('records the premium received and paid with their journals, and closes once both sides are settled', async () => {
    const tooMuch = await processing('post', `/reinsurance/facultative/${id}/settlements`).send({ direction: 'received', amount: 3000000 });
    expect(tooMuch.status).toBe(400);
    const r = await processing('post', `/reinsurance/facultative/${id}/settlements`).send({ direction: 'received', amount: 2025000, settledOn: '2026-10-01', reference: 'PIS-TT-1' });
    expect(r.status).toBe(200);
    const p = (await processing('get', `/reinsurance/facultative/${id}`)).body.data;
    for (const s of p.shares) {
      const x = await processing('post', `/reinsurance/facultative/${id}/settlements`).send({ direction: 'paid', shareId: s.id, amount: s.netPremium, settledOn: '2026-10-02', reference: `TT-${s.id}` });
      expect(x.status).toBe(200);
    }
    const after = (await processing('get', `/reinsurance/facultative/${id}`)).body.data;
    expect(after.status).toBe('closed');
    expect(after.settlements.length).toBe(3);
    expect(after.settlements.every((s) => s.journalNumber)).toBe(true);
  });

  it('produces the facultative bordereau (file or kept with the other bordereaux)', async () => {
    const x = await processing('get', '/reinsurance/facultative/bordereau?from=2026-01-01&to=2026-12-31&format=csv');
    expect(x.status).toBe(200);
    expect(x.text).toMatch(/Mindanao Power Holdings/);
    const pdf = await processing('get', '/reinsurance/facultative/bordereau?from=2026-01-01&to=2026-12-31&format=pdf&reinsurerId=RE002').buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    const period = new Date().toISOString().slice(0, 7);
    const g = await processing('post', '/reinsurance/facultative/bordereau').send({ period, reinsurerId: 'RE002' });
    expect(g.status).toBe(201);
    expect(g.body.data).toMatchObject({ entries: 1 });
    expect(g.body.data.totals.netPremium).toBe(1053000);
    const list = await processing('get', '/reinsurance/bordereaux?type=Facultative');
    expect(list.body.data.some((b) => b.reference === g.body.data.reference)).toBe(true);
  });

  it('a slip not yet bound can be cancelled; a bound one cannot', async () => {
    expect((await processing('post', `/reinsurance/facultative/${id}/cancel`).send({ reason: 'x' })).status).toBe(409);
    const d = await processing('post', '/reinsurance/facultative').send({ cedantId: 4, insuredName: 'Small Mall Inc.', riskDescription: 'Shopping mall', periodFrom: '2026-12-01', periodTo: '2027-12-01',
      sumInsured: 900000000, grossPremium: 1200000, facSharePct: 30 });
    const c = await processing('post', `/reinsurance/facultative/${d.body.data.id}/cancel`).send({ reason: 'Cedant retained the risk' });
    expect(c.body.data.status).toBe('cancelled');
  });
});
