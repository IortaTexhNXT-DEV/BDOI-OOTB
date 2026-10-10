/**
 * Accounts > Remittance > Remittances: the register (segments, filters, flags, next step, actions, totals and KPI
 * figures of the filtered set), the record's register data, the submission of several drafts with a result per draft
 * and the register export. Agency bills never appear. TISPH values: seed 90 (tis-finance PHP 1,000,000.00,
 * tis-general-manager no limit, Returned and "Settled (voucher raised)" labels).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';

let ctx;
let insurerId;
const people = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const binary = (r) => r.buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });

async function persona(key, username, displayName, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  const call = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  call.id = r.body.data.userId;
  people[key] = call;
  return call;
}

/** A draft of the test insurer due to it for `net` PHP (premium net + 1,000, commission 1,000), made by `by`. */
async function draft(policyNo, net, by = 'maker') {
  const c = await people[by]('post', '/remittance/remittances').send({ insurerCode: 'RGTEST', period: '2026-10', lines: [{ policyNo, premium: net + 1000, commission: 1000, tax: 0 }] });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  return c.body.data;
}
const list = async (who, qs) => {
  const r = await people[who]('get', `/remittance/remittances?insurerId=${insurerId}&${qs}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
};
const versionOf = async (id) => (await q('SELECT version FROM remittances WHERE id = $1', [id]))[0].version;

beforeAll(async () => {
  ctx = await setup();
  [{ id: insurerId }] = await q("INSERT INTO insurance_companies(code, name, short_name, status) VALUES ('RGTEST', 'Register Test Insurance Corp.', 'Register Test', 'active') RETURNING id");
  await persona('maker', 'rgt.maker', 'M. Reyes', ['tis-finance']);
  await persona('cruz', 'rgt.cruz', 'J. Cruz', ['tis-finance']);
  await persona('tan', 'rgt.tan', 'A. Tan', ['tis-general-manager']);
  await persona('recon', 'rgt.recon', 'C. Recon', ['tis-ccd-recon']);
});
afterAll(async () => { await pool.end(); });

describe('segments, next step and actions', () => {
  let small;
  let big;
  let plain;
  beforeAll(async () => {
    small = await draft('EXT-RGT-1', 17000);
    big = await draft('EXT-RGT-2', 1820000);
    plain = await draft('EXT-RGT-3', 5000);
    const r = await people.maker('post', '/remittance/remittances/submit').send({ items: [{ id: small.id, version: await versionOf(small.id) }, { id: big.id }] });
    expect(r.status).toBe(200);
  });

  it('a pending row has no submit action and waits on its approvers by name or by count', async () => {
    const body = await list('maker', 'segment=in-approval');
    const s = body.data.find((x) => x.id === small.id);
    const b = body.data.find((x) => x.id === big.id);
    expect(s).toMatchObject({ status: 'for-approval', statusLabel: 'Pending Approval', kind: 'direct-bill' });
    expect(s.actions.map((a) => a.code)).not.toContain('submit');
    // the TIS Finance and General Manager approvers of the reference and sample data, not the submitter
    const eligible = s.decision.eligibleApprovers;
    expect(eligible.map((u) => u.name)).toEqual(expect.arrayContaining(['J. Cruz', 'A. Tan']));
    expect(eligible.map((u) => u.name)).not.toContain('M. Reyes');
    expect(s.nextStep.label).toBe(`Awaiting remittance approver (${eligible.length})`);
    expect(s.nextStep.actor).toMatchObject({ type: 'users', ids: expect.arrayContaining([people.cruz.id, people.tan.id]) });
    // above the PHP 1,000,000.00 limit of TIS Finance only the General Manager decides; one approver is named
    expect(b.decision.eligibleApprovers.map((u) => u.name)).not.toContain('J. Cruz');
    if (b.decision.eligibleApprovers.length === 1) {
      expect(b.nextStep.label).toBe('Awaiting A. Tan');
      expect(b.nextStep.actor).toMatchObject({ type: 'user', id: people.tan.id, name: 'A. Tan' });
    } else expect(b.nextStep.label).toBe(`Awaiting remittance approver (${b.decision.eligibleApprovers.length})`);
    expect(body.data.map((x) => x.id)).not.toContain(plain.id);
  });

  it('a draft offers submit and the downloads to its preparer, and waits on the preparer', async () => {
    const row = (await list('maker', 'segment=drafts')).data.find((x) => x.id === plain.id);
    expect(row.nextStep).toMatchObject({ code: 'submit', label: 'Submit for approval' });
    expect(row.actions.map((a) => a.code)).toEqual(['view', 'submit', 'download-schedule-xlsx', 'download-schedule-pdf']);
    expect(row.actions.find((a) => a.code === 'submit')).toMatchObject({ allowed: true });
    expect(row.actions.find((a) => a.code === 'view').link).toBe(`/finance/remittance/remittances/${plain.id}`);
    expect(row).toMatchObject({ source: { code: 'manual', label: 'Manual' }, flags: { offCycle: false, overdue: false, openExceptions: 0 }, basis: 'net', productLine: null,
      coverageWeek: { from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) } });
  });

  it('the General Manager is offered View and the downloads only, and has no My work', async () => {
    const body = await list('tan', 'segment=all');
    for (const id of [small.id, plain.id]) {
      const row = body.data.find((x) => x.id === id);
      expect(row.actions.map((a) => a.code).every((c) => c === 'view' || c.startsWith('download-')), JSON.stringify(row.actions)).toBe(true);
    }
    const mine = await list('tan', 'segment=my-work');
    expect(mine.total).toBe(0);
    expect(mine.segments['my-work']).toBe(0);
  });

  it('agency bills never appear, whatever the filters', async () => {
    const [agency] = await q("INSERT INTO remittances(remittance_number, insurance_company_id, kind, status, net_due, policy_count) VALUES ('BIL-RGT-1', $1, 'agency-bill', 'draft', 100, 1) RETURNING id", [insurerId]);
    for (const seg of ['all', 'drafts', 'my-work']) {
      const body = await list('maker', `segment=${seg}`);
      expect(body.data.map((x) => x.id)).not.toContain(agency.id);
    }
    const all = await people.maker('get', '/remittance/remittances?segment=all&perPage=500&q=BIL-RGT');
    expect(all.body.total).toBe(0);
  });

  it('the submitter\'s record has no approve or reject action and names the eligible approvers', async () => {
    const rec = (await people.maker('get', `/remittance/remittances/${small.id}`)).body.data;
    expect(rec.actions.map((a) => a.code)).not.toEqual(expect.arrayContaining(['approve']));
    expect(rec.actions.map((a) => a.code)).not.toContain('reject');
    expect(rec.decision).toMatchObject({ canDecide: false, blockedCode: 'SUBMITTER' });
    expect(rec.decision.eligibleApprovers.map((u) => u.name)).toEqual(expect.arrayContaining(['A. Tan', 'J. Cruz']));
    expect(rec.decision.eligibleApprovers.map((u) => u.name)).not.toContain('M. Reyes');
    expect(rec.nextStep.label).toMatch(/^Awaiting remittance approver: /);
    expect(rec).toMatchObject({ status: 'Pending Approval', statusCode: 'for-approval', statusLabel: 'Pending Approval', remittanceNo: small.remittanceNo, payment: null });
    expect(rec.downloads.map((d) => d.code)).toEqual(['schedule-xlsx', 'schedule-pdf']);
    expect(rec.lines).toHaveLength(1);
  });

  it('a returned remittance reads Returned and waits on its preparer with the reason', async () => {
    const [a] = await q("SELECT id, version FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1 AND status = 'Pending'", [small.id]);
    const r = await people.cruz('post', `/remittance/approvals/${a.id}/reject`).send({ reasonCode: 'RRJ-RATES', version: a.version });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const row = (await list('maker', 'segment=my-work')).data.find((x) => x.id === small.id);
    expect(row).toMatchObject({ status: 'rejected', statusLabel: 'Returned', nextStep: { code: 'resubmit', label: 'Correct and resubmit', reason: 'Rates to be corrected' } });
    expect(row.returned).toMatchObject({ by: 'J. Cruz', reason: 'Rates to be corrected' });
    expect(row.actions.map((a) => a.code)).toContain('submit');
  });
});

describe('submitting several drafts', () => {
  it('submits the good drafts and gives the reason of each one that is not submitted', async () => {
    const good1 = await draft('EXT-RGT-S1', 1500);
    const good2 = await draft('EXT-RGT-S2', 2500);
    const zero = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'RGTEST', lines: [{ policyNo: 'EXT-RGT-S3', premium: 1000, commission: 1000, tax: 0 }] });
    const stale = await draft('EXT-RGT-S4', 3500);
    const r = await people.maker('post', '/remittance/remittances/submit').send({ items: [
      { id: good1.id, version: await versionOf(good1.id) }, { id: zero.body.data.id }, { id: good2.id }, { id: stale.id, version: 99 }, { id: 'rm_missing' }] });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ submitted: 2, refused: 3, batchId: expect.stringMatching(/^BLK-/) });
    expect(r.body.data.results.map((x) => [x.ok, x.code || x.message])).toEqual([[true, 'Submitted'], [false, 'INVALID'], [true, 'Submitted'], [false, 'STALE'], [false, 'NOT_FOUND']]);
    expect(r.body.data.results[1].message).toBe('Not submitted: Net amount must be greater than zero');
    expect(r.body.data.results[3].message).toBe(`Not submitted: ${stale.remittanceNo} changed since it was shown. Reload.`);
    expect((await q('SELECT status FROM remittances WHERE id = ANY($1) ORDER BY remittance_number', [[good1.id, good2.id]])).map((x) => x.status)).toEqual(['for-approval', 'for-approval']);
    expect((await q("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'remittance' AND action = 'submit' AND entity_id = ANY($1)", [[good1.id, good2.id]]))[0].n).toBe(2);
    // submitted again from a stale screen: who submitted it and when
    const again = await people.cruz('post', '/remittance/remittances/submit').send({ items: [{ id: good1.id }] });
    expect(again.body.data.results[0]).toMatchObject({ ok: false, code: 'ALREADY_SUBMITTED' });
    expect(again.body.data.results[0].message).toMatch(new RegExp(`^${good1.remittanceNo} was submitted by M\\. Reyes at \\d{2}:\\d{2}\\.$`));
  });

  it('needs write:remittance and a list of items', async () => {
    expect((await people.tan('post', '/remittance/remittances/submit').send({ items: [{ id: 'x' }] })).status).toBe(403);
    expect((await people.maker('post', '/remittance/remittances/submit').send({ items: [] })).status).toBe(400);
  });
});

describe('totals and KPI figures of the filtered set', () => {
  it('equal the sums of every matching remittance, not of the page', async () => {
    const all = await list('maker', 'segment=all&perPage=500');
    const page = await list('maker', 'segment=all&perPage=2&page=1');
    expect(page.data).toHaveLength(2);
    expect(page.total).toBe(all.data.length);
    const sum = (rows, f = () => true) => Math.round(rows.filter(f).reduce((s, r) => s + r.dueToInsurer, 0) * 100) / 100;
    expect(page.totals).toMatchObject({ count: all.data.length, dueToInsurer: sum(all.data) });
    expect(page.kpis.toSubmit).toEqual({ count: all.data.filter((r) => ['draft', 'rejected'].includes(r.status)).length, amount: sum(all.data, (r) => ['draft', 'rejected'].includes(r.status)) });
    expect(page.kpis.awaitingApproval).toEqual({ count: all.data.filter((r) => r.status === 'for-approval').length, amount: sum(all.data, (r) => r.status === 'for-approval') });
    expect(page.segments).toMatchObject({ drafts: page.kpis.toSubmit.count, 'in-approval': page.kpis.awaitingApproval.count, all: all.data.length });
    // the KPI figures follow the filters, not the segment
    const drafts = await list('maker', 'segment=drafts&perPage=1');
    expect(drafts.kpis).toEqual(page.kpis);
    expect(drafts.totals.count).toBe(page.kpis.toSubmit.count);
    // a KPI card filters the table
    const awaiting = await list('maker', 'segment=all&kpi=awaiting-approval&perPage=500');
    expect(awaiting.data.every((r) => r.status === 'for-approval')).toBe(true);
    expect(awaiting.totals.dueToInsurer).toBe(page.kpis.awaitingApproval.amount);
  });

  it('overdue rows are flagged and counted', async () => {
    const d = await draft('EXT-RGT-OD', 4200);
    await q("UPDATE remittances SET due_date = DATE '2026-01-05' WHERE id = $1", [d.id]);
    const body = await list('maker', 'segment=all&kpi=overdue&perPage=500');
    expect(body.data.map((r) => r.id)).toContain(d.id);
    expect(body.data.find((r) => r.id === d.id)).toMatchObject({ overdue: true, flags: { overdue: true } });
    expect(body.kpis.overdue.count).toBeGreaterThanOrEqual(1);
  });

  it('filters by search, source, status and coverage week; sorts on the server', async () => {
    const d = await draft('EXT-RGT-FIND', 777);
    expect((await list('maker', 'segment=all&q=EXT-RGT-FIND')).data.map((r) => r.id)).toEqual([d.id]);
    expect((await list('maker', `segment=all&q=${d.remittanceNo}`)).total).toBe(1);
    expect((await list('maker', 'segment=all&source=import')).total).toBe(0);
    expect((await list('maker', 'segment=all&source=manual&perPage=500')).total).toBe((await list('maker', 'segment=all&perPage=500')).total);
    const returned = await list('maker', 'segment=all&status=Returned');
    expect(returned.data.every((r) => r.status === 'rejected')).toBe(true);
    expect(returned.total).toBeGreaterThanOrEqual(1);
    const week = (await list('maker', 'segment=all&q=EXT-RGT-FIND')).data[0].coverageWeek.from;
    expect((await list('maker', `segment=all&week=${week}&perPage=500`)).data.map((r) => r.id)).toContain(d.id);
    expect((await list('maker', 'segment=all&week=2020-01-06')).total).toBe(0);
    const sorted = (await list('maker', 'segment=all&sort=-dueToInsurer&perPage=500')).data.map((r) => r.dueToInsurer);
    expect(sorted).toEqual([...sorted].sort((a, b) => b - a));
  });

  it('a user without read:remittance gets nothing', async () => {
    await ctx.api('post', '/users').send({ username: 'rgt.sales', password: 'Welcome@123', displayName: 'S. Ales', roles: ['sales'] });
    const token = await loginAs(ctx.app, 'rgt.sales', 'Welcome@123');
    expect((await request(ctx.app).get('/api/remittance/remittances?segment=all').set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });
});

describe('register export', () => {
  it('writes every column of the whole filtered set under the letterhead and the filter summary', async () => {
    const all = await list('maker', 'segment=drafts&perPage=500');
    const r = await binary(people.tan('get', `/remittance/remittances/export.xlsx?segment=drafts&insurerId=${insurerId}`));
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toMatch(/filename="Remittances_Register_\d{8}\.xlsx"/);
    const [sheet] = readWorkbook(r.body);
    const at = sheet.rows.findIndex((row) => row[0] === 'Remittance no');
    expect(at).toBeGreaterThan(0);
    const banner = sheet.rows.slice(0, at).map((row) => row[0]).join(' | ');
    expect(banner).toContain('Remittances');
    expect(banner).toContain('Segment Drafts · Insurer Register Test Insurance Corp.');
    expect(sheet.rows[at]).toEqual(['Remittance no', 'Insurer', 'Product line', 'Basis', 'Coverage week', 'Off-cycle reason', 'Policies', 'Due to insurer', 'Due date', 'Status',
      'Next step', 'Source', 'Voucher no', 'Paid on', 'Bank ref', 'Submitted by', 'Created on']);
    const data = sheet.rows.slice(at + 1);
    expect(data).toHaveLength(all.data.length + 1);
    expect(data.at(-1)[0]).toBe('TOTAL');
    expect(data.slice(0, -1).map((row) => row[0]).sort()).toEqual(all.data.map((x) => x.remittanceNo).sort());
  });
});
