/**
 * GET /remittance/summary: per user, the counts of the Accounts > Remittance entries (each equal to the total of the
 * list it opens for the same user), the run strip (last run, next run, automation) and the landing page.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
const people = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(key, username, displayName, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  const call = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  call.id = r.body.data.userId;
  people[key] = call;
  return call;
}
const summary = async (who) => {
  const r = await people[who]('get', '/remittance/summary');
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data;
};
const totalOf = async (who, path) => {
  const r = await people[who]('get', path);
  expect(r.status, path).toBe(200);
  return r.body.total;
};

/** The totals of the lists the menu entries open, for `who`. */
async function listTotals(who, withPayments) {
  return {
    remittances: await totalOf(who, '/remittance/remittances?segment=my-work'),
    approvals: await totalOf(who, '/remittance/approvals?view=mine'),
    payments: withPayments ? await totalOf(who, '/remittance/payments?segment=to-pay') : null,
    exceptions: await totalOf(who, '/remittance/exceptions?status=Open,In%20Progress,Escalated&assignedTo=me'),
    billing: await totalOf(who, '/remittance/direct-bill?attention=mine'),
  };
}

beforeAll(async () => {
  ctx = await setup();
  await persona('maker', 'sum.maker', 'M. Reyes', ['tis-finance']);
  await persona('cruz', 'sum.cruz', 'J. Cruz', ['tis-finance']);
  await persona('recon', 'sum.recon', 'C. Recon', ['tis-ccd-recon']);
  await persona('ops', 'sum.ops', 'O. Officer', ['tis-ops-officer']);
  await persona('sales', 'sum.sales', 'S. Sales', ['sales']);
  const d = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'MALAYAN', period: '2026-10', lines: [{ policyNo: 'EXT-SUM-1', premium: 21000, commission: 1000, tax: 0 }] });
  expect(d.status).toBe(201);
  await people.maker('post', '/remittance/remittances').send({ insurerCode: 'MALAYAN', period: '2026-10', lines: [{ policyNo: 'EXT-SUM-2', premium: 11000, commission: 1000, tax: 0 }] });
  const s = await people.maker('post', '/remittance/remittances/submit').send({ items: [{ id: d.body.data.id }] });
  expect(s.body.data.submitted).toBe(1);
  const e = await ctx.api('post', '/remittance/exceptions').send({ type: 'Amount Mismatch', severity: 'High', amount: 800, description: 'Short credit', assignedTo: 'sum.recon' });
  expect(e.status).toBe(201);
});
afterAll(async () => { await pool.end(); });

describe('counts per menu entry', () => {
  it('each count equals the total of the list it opens, for the same user', async () => {
    for (const [who, payments] of [['maker', true], ['cruz', true], ['recon', false], ['ops', false]]) {
      const s = await summary(who);
      const lists = await listTotals(who, payments);
      expect({ remittances: s.counts.remittances, approvals: s.counts.approvals, payments: s.counts.payments, exceptions: s.counts.exceptions, billing: s.counts.billing }, who).toEqual(lists);
      expect(s.counts.setup).toBe(0);
    }
  });

  it('counts what waits on the user: drafts for a preparer, approvals for an approver who did not submit, exceptions for the assignee', async () => {
    const maker = await summary('maker');
    const cruz = await summary('cruz');
    expect(maker.counts.remittances).toBeGreaterThanOrEqual(1);
    expect(cruz.counts.approvals).toBe(maker.counts.approvals + 1);
    expect((await summary('recon')).counts.exceptions).toBe(1);
    expect(maker.counts.exceptions).toBe(0);
    const ops = await summary('ops');
    expect(ops.counts).toMatchObject({ remittances: 0, approvals: 0, payments: null, exceptions: 0 });
    // insurer statements to act on: the submitted ones a reconciliation approver did not prepare
    const [st] = await q("SELECT count(*)::int AS n FROM insurer_statements WHERE status = 'submitted' AND created_by IS DISTINCT FROM $1 AND submitted_by IS DISTINCT FROM $1", [people.recon.id]);
    const [drafts] = await q("SELECT count(*)::int AS n FROM insurer_statements WHERE status = 'draft' AND created_by = $1", [people.recon.id]);
    expect((await summary('recon')).counts.reconciliation).toBe(st.n + drafts.n);
    expect(ops.counts.reconciliation).toBe(0);
  });

  it('needs read:remittance', async () => {
    expect((await people.sales('get', '/remittance/summary')).status).toBe(403);
  });
});

describe('run strip and landing', () => {
  it('shows the next run of the weekly schedule and the automation off; no run yet', async () => {
    const s = await summary('maker');
    expect(s.runStrip.lastRun).toBeNull();
    expect(s.runStrip.nextRun).toMatchObject({ scheduleCode: 'TIS-WEEKLY', text: expect.stringMatching(/^Mon \d{2}\/\d{2}\/\d{4} 06:15$/) });
    expect(s.runStrip.automation).toMatchObject({ on: false, label: 'Automation Off', checkedDaily: '06:15' });
  });

  it('shows the last run once a schedule has run', async () => {
    const [w] = await q("SELECT id FROM master_records WHERE type_code = 'remittance-schedule' AND code = 'TIS-WEEKLY'");
    const r = await people.maker('post', `/remittance/schedules/${w.id}/run`).send({ reasonCode: 'ROC-GOLIVE' });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const s = await summary('ops');
    expect(s.runStrip.lastRun).toMatchObject({ id: r.body.data.run.id, scheduleCode: 'TIS-WEEKLY', result: r.body.data.run.result.code, failed: false, message: r.body.data.message });
  });

  it('lands on Approvals with something to decide, on Exceptions with exceptions assigned, else on My work', async () => {
    expect((await summary('cruz')).landing).toEqual({ code: 'approvals', link: '/finance/remittance/approvals' });
    expect((await summary('recon')).landing).toEqual({ code: 'exceptions', link: '/finance/remittance/exceptions' });
    expect((await summary('ops')).landing).toEqual({ code: 'remittances', link: '/finance/remittance/remittances?segment=my-work' });
  });
});
