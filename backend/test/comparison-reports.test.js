import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { comparisonReportSpec } from '../src/modules/comparison-reports/service.js';

let ctx;
let sales;
let claims;
const binary = (res, cb) => { const d = []; res.on('data', (c) => d.push(c)); res.on('end', () => cb(null, Buffer.concat(d))); };
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('cr.sales', ['sales']);
  claims = await persona('cr.claims', ['claims']);
});
afterAll(async () => { await pool.end(); });

describe('client comparison and recommendation report', () => {
  let report;
  it('is prepared from the offers of a request for quotation, ranked by total premium, cheapest recommended by default', async () => {
    expect((await claims('post', '/comparison-reports').send({ brokerSlipId: 'bs_sample_01' })).status).toBe(403);
    const r = await sales('post', '/comparison-reports').send({ brokerSlipId: 'bs_sample_01' });
    expect(r.status).toBe(201);
    report = r.body.data;
    expect(report.reportNumber).toMatch(/^CMP-\d{4}-\d{5}$/);
    expect(report.options.length).toBe(2);
    expect(report.options[0].rank).toBe(1);
    expect(report.options[0].grossPremium).toBeLessThanOrEqual(report.options[1].grossPremium);
    expect(report.recommendedKey).toBe(report.options[0].key);
    expect(report.reasons).toEqual(['Lowest total premium for the cover requested']);
    expect(report.disclaimer).toMatch(/does not replace the policy wording/);
    // no commission in what the client sees
    expect(JSON.stringify(report.options)).not.toMatch(/commission/i);
  });

  it('a slip with fewer than two offers or quotations of different clients cannot be compared', async () => {
    expect((await sales('post', '/comparison-reports').send({ brokerSlipId: 'bs_sample_02' })).status).toBe(400);
    expect((await sales('post', '/comparison-reports').send({ quoteIds: ['x'] })).status).toBe(400);
  });

  it('the broker changes the recommendation and reasons; the report prints with letterhead, the recommendation and no commission', async () => {
    const other = report.options[1].key;
    const u = await sales('put', `/comparison-reports/${report.id}`).send({ recommendedKey: other, reasons: ['Broadest cover and lowest deductible among the offers', 'Fast claims service'],
      highlights: { [other]: 'Includes earthquake cover' } });
    expect(u.status).toBe(200);
    expect(u.body.data.recommended.key).toBe(other);
    expect(u.body.data.options.find((o) => o.key === other).highlights).toBe('Includes earthquake cover');
    const bad = await sales('put', `/comparison-reports/${report.id}`).send({ recommendedKey: 'ofr_nope' });
    expect(bad.status).toBe(400);
    const spec = await comparisonReportSpec(report.id);
    const text = JSON.stringify(spec);
    expect(text).toMatch(/Our recommendation/);
    expect(text).toMatch(/Fast claims service/);
    expect(text).toMatch(/\(recommended\)/);
    expect(text).not.toMatch(/commission/i);
    expect(spec.letterhead).toBeTruthy();
    const pdf = await sales('get', `/comparison-reports/${report.id}/pdf`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect((await sales('get', `/comparison-reports/${report.id}`)).body.data.status).toBe('issued');
  });

  it('is e-mailed to the client through the outbox with the PDF attached, and records the client\'s choice', async () => {
    const m = await sales('post', `/comparison-reports/${report.id}/email`).send({ to: 'client@example.ph' });
    expect(m.status).toBe(200);
    const o = (await pool.query('SELECT subject, attachments FROM email_outbox WHERE id = $1', [m.body.data.outboxId])).rows[0];
    expect(o.subject).toBe(`Insurance proposal ${report.reportNumber}`);
    expect(o.attachments[0]).toMatchObject({ document: 'comparison-report' });
    const a = await sales('post', `/comparison-reports/${report.id}/accept`).send({ chosenKey: report.options[0].key });
    expect(a.body.data).toMatchObject({ status: 'accepted', chosenKey: report.options[0].key });
    expect((await sales('put', `/comparison-reports/${report.id}`).send({ title: 'x' })).status).toBe(409);
  });

  it('can compare quotations of the same prospect', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Quinn', lob: 'MOTOR' });
    const q = [];
    for (const [insurer, rate] of [['Malayan Insurance Co., Inc.', 1.5], ['Pioneer Insurance & Surety Corp.', 1.3]]) {
      const r = await sales('post', '/quotations').send({ leadRefId: lead.body.id, productType: 'Motor', lob: 'MOTOR', insuranceCompanyName: insurer, vehicleType: 'private_cars',
        lossAndDamageCoverage: 900000, lossAndDamageCoverageRate: rate, totalSumInsured: 900000 });
      q.push(r.body.data?.id || r.body.id);
    }
    const r = await sales('post', '/comparison-reports').send({ quoteIds: q });
    expect(r.status).toBe(201);
    expect(r.body.data.sourceType).toBe('quotations');
    expect(r.body.data.options[0].insurer).toBe('Pioneer Insurance & Surety Corp.');
    expect(r.body.data.preparedFor).toBe('Quinn');
  });
});
