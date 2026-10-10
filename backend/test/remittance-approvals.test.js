/**
 * Accounts > Remittance > Approvals: the decision block of every approval (remittance/decision.js: SUBMITTER,
 * ABOVE_LIMIT, NO_AUTHORITY, NO_PERMISSION, ALREADY_DECIDED, STALE), the inbox views with the next step and the KPI
 * figures, the review panel, bulk decisions with per-item results, the reason a rejection needs, the reminder of the
 * approvers, the notifications to the eligible approvers only, decisions under a dated delegation and the business
 * time zone of "today" and the SLA. TISPH values: seed 90 (tis-finance PHP 1,000,000.00, tis-general-manager no limit,
 * remittance.require_authority_limit on).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { approvalInbox } from '../src/modules/remittance/approvals.js';
import { decisionFor, eligibleApprovers, decisionContext } from '../src/modules/remittance/decision.js';

let ctx;
const people = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(key, username, displayName, { roles, permissions }) {
  let codes = roles;
  if (permissions) {
    const role = `${username.replace(/\./g, '-')}-role`;
    expect((await ctx.api('post', '/roles').send({ code: role, name: role, permissions })).status).toBe(201);
    codes = [role];
  }
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles: codes });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  const call = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  call.id = r.body.data.userId;
  // the user as the routes see it: the roles and permissions travel in the access token
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
  call.user = { id: call.id, username, roles: claims.roles || codes, permissions: claims.permissions || [] };
  people[key] = call;
  return call;
}

/** A remittance of `net` PHP created and submitted by the maker; returns its approval row of the legacy list. */
async function submitted(policyNo, net, by = 'maker') {
  const c = await people[by]('post', '/remittance/remittances').send({ insurerCode: 'MALAYAN', period: '2026-09', lines: [{ policyNo, premium: net + 1000, commission: 1000, tax: 0 }] });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  expect((await people[by]('post', '/remittance/remittances/process').send({ ids: [c.body.data.id] })).status).toBe(200);
  const [a] = await q("SELECT id, version, reference_no FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1 AND status = 'Pending'", [c.body.data.id]);
  return { id: Number(a.id), version: a.version, reference: a.reference_no, remittanceId: c.body.data.id };
}
const inbox = async (who, view, qs = '') => {
  const r = await people[who]('get', `/remittance/approvals?view=${view}&perPage=500${qs}`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body;
};
const rowOf = (body, id) => body.data.find((x) => x.id === id);

beforeAll(async () => {
  ctx = await setup();
  await persona('maker', 'rap.maker', 'M. Reyes', { roles: ['accounting'] });
  await persona('cruz', 'rap.cruz', 'J. Cruz', { roles: ['tis-finance'] });
  await persona('tan', 'rap.tan', 'A. Tan', { roles: ['tis-general-manager'] });
  await persona('nolimit', 'rap.nolimit', 'N. Limit', { permissions: ['read:profile', 'read:remittance', 'approve:remittance'] });
  await persona('recon', 'rap.recon', 'C. Recon', { roles: ['tis-ccd-recon'] });
  await persona('night', 'rap.night', 'N. Night', { roles: ['tis-general-manager'] });
});
afterAll(async () => { await pool.end(); });

describe('who may decide, and why not', () => {
  let small;
  let big;
  beforeAll(async () => {
    small = await submitted('EXT-RAP-1', 17000);
    big = await submitted('EXT-RAP-2', 1820000);
  });

  it('the submitter sees their item under Submitted by me only, waiting on the eligible approvers', async () => {
    expect(rowOf(await inbox('maker', 'mine'), small.id)).toBeUndefined();
    const row = rowOf(await inbox('maker', 'submitted'), small.id);
    expect(row).toMatchObject({ reference: small.reference, type: 'remittance', typeLabel: 'Remittance', amount: 17000, submittedBy: { id: people.maker.id, name: 'M. Reyes' },
      level: { current: 1, required: 1, label: '1 of 1' }, status: 'Pending',
      decision: { canDecide: false, blockedCode: 'SUBMITTER', blockedReason: 'You submitted this remittance. Another user with remittance authority must approve it.' } });
    expect(row.nextStep.label).toMatch(/^Awaiting remittance approver: /);
    expect(row.nextStep.label).toContain('J. Cruz');
    expect(row.nextStep.label).toContain('A. Tan');
    expect(row.nextStep.label).not.toContain('M. Reyes');
    expect(row.actions.find((x) => x.code === 'approve')).toMatchObject({ allowed: false, blockedCode: 'SUBMITTER' });
    expect(row.actions.find((x) => x.code === 'remind')).toMatchObject({ allowed: true });
    expect(new Date(row.submittedAt).toISOString()).toBe(row.submittedAt);
    // the record says the same and names the approvers
    const rec = (await people.maker('get', `/remittance/remittances/${small.remittanceId}`)).body.data;
    expect(rec.decision).toMatchObject({ canDecide: false, blockedCode: 'SUBMITTER' });
    expect(rec.decision.eligibleApprovers.map((u) => u.name)).toEqual(expect.arrayContaining(['J. Cruz', 'A. Tan']));
    expect(rec.decision.eligibleApprovers.find((u) => u.name === 'J. Cruz')).toMatchObject({ role: 'TIS Finance & General Accounting', limit: 1000000 });
    expect(rec.nextStep.label).toMatch(/^Awaiting remittance approver: /);
    expect(rec.version).toBeGreaterThan(1);
  });

  it('an approver with a PHP 1,000,000.00 limit sees a PHP 1,820,000.00 remittance only under All pending, above the limit', async () => {
    expect(rowOf(await inbox('cruz', 'mine'), big.id)).toBeUndefined();
    expect(rowOf(await inbox('cruz', 'mine'), small.id)).toMatchObject({ decision: { canDecide: true, myLimit: 1000000, limitSourceLabel: 'Role limit: TIS Finance & General Accounting' } });
    const row = rowOf(await inbox('cruz', 'all'), big.id);
    expect(row.decision).toMatchObject({ canDecide: false, blockedCode: 'ABOVE_LIMIT', blockedReason: '₱1,820,000.00 is above your approval limit of ₱1,000,000.00.', myLimit: 1000000 });
    const refused = await people.cruz('post', `/remittance/approvals/${big.id}/approve`).send({ version: big.version });
    expect(refused.status).toBe(403);
    expect(refused.body.errors[0].code).toBe('ABOVE_LIMIT');
    expect(rowOf(await inbox('tan', 'mine'), big.id)).toMatchObject({ decision: { canDecide: true, unlimited: true } });
    expect(row.decision.eligibleApprovers.map((u) => u.name)).toContain('A. Tan');
    expect(row.decision.eligibleApprovers.map((u) => u.name)).not.toContain('J. Cruz');
  });

  it('approve:remittance without a remittance limit: NO_AUTHORITY; without approve:remittance: NO_PERMISSION', async () => {
    expect(rowOf(await inbox('nolimit', 'mine'), small.id)).toBeUndefined();
    expect(rowOf(await inbox('nolimit', 'all'), small.id).decision).toMatchObject({ canDecide: false, blockedCode: 'NO_AUTHORITY',
      blockedReason: 'You have no approval limit for Remittance approval. Ask an administrator to set one in the Authority Matrix.' });
    const r = await people.nolimit('post', '/remittance/approvals/decide').send({ items: [{ id: small.id, version: small.version }], action: 'approve' });
    expect(r.status).toBe(200);
    expect(r.body.data.results).toEqual([{ id: small.id, ok: false, code: 'NO_AUTHORITY', message: expect.stringMatching(/^You have no approval limit/) }]);
    expect(rowOf(await inbox('recon', 'all'), small.id).decision).toMatchObject({ blockedCode: 'NO_PERMISSION', blockedReason: 'You can view approvals but not decide them.' });
    expect((await people.recon('post', '/remittance/approvals/decide').send({ items: [{ id: small.id }], action: 'approve' })).status).toBe(403);
  });

  it('the authority chips: a limit, no limit while one is required, or no approve:remittance', async () => {
    expect((await inbox('cruz', 'all')).authority).toEqual({ permission: true, canDecide: true, limit: 1000000, unlimited: false,
      limitSourceLabel: 'Role limit: TIS Finance & General Accounting', covering: [] });
    expect((await inbox('tan', 'all')).authority).toMatchObject({ permission: true, canDecide: true, limit: null, unlimited: true });
    expect((await inbox('nolimit', 'all')).authority).toMatchObject({ permission: true, canDecide: false, limit: null, unlimited: false, covering: [] });
    expect((await inbox('recon', 'all')).authority).toMatchObject({ permission: false, canDecide: false });
  });

  it('the record page carries its approval: no decision for the submitter, Remind instead; the checker may approve or reject', async () => {
    const mine = (await people.maker('get', `/remittance/remittances/${small.remittanceId}`)).body.data.approval;
    expect(mine).toMatchObject({ id: small.id, status: 'Pending', level: { label: '1 of 1' }, submittedBy: { name: 'M. Reyes' }, outcome: null, contentUnchanged: true });
    expect(mine.actions.find((x) => x.code === 'approve')).toMatchObject({ allowed: false, blockedCode: 'SUBMITTER' });
    expect(mine.actions.find((x) => x.code === 'reject')).toMatchObject({ allowed: false });
    expect(mine.actions.find((x) => x.code === 'remind')).toMatchObject({ allowed: true });
    expect(mine.checks.map((c) => c.code)).toEqual(['content-unchanged', 'period-open']);
    const checker = (await people.cruz('get', `/remittance/remittances/${small.remittanceId}`)).body.data.approval;
    expect(checker.actions.find((x) => x.code === 'approve')).toMatchObject({ allowed: true });
    expect(checker.actions.find((x) => x.code === 'remind')).toMatchObject({ allowed: false });
    const draft = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'MALAYAN', period: '2026-09', lines: [{ policyNo: 'EXT-RAP-R0', premium: 2000, commission: 100, tax: 0 }] });
    expect((await people.maker('get', `/remittance/remittances/${draft.body.data.id}`)).body.data.approval).toBeNull();
  });

  it('Export XLSX holds every row of the view', async () => {
    const r = await people.cruz('get', '/remittance/approvals/export.xlsx?view=all').buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/spreadsheetml/);
    expect(r.headers['content-disposition']).toContain('approvals-all.xlsx');
    expect(r.body.subarray(0, 2).toString()).toBe('PK');
  });

  it('decisionFor and eligibleApprovers are the same rules for other callers', async () => {
    const [a] = await q("SELECT a.*, r.created_by AS maker_id FROM remittance_approvals a JOIN remittances r ON r.id = a.entity_id WHERE a.id = $1", [big.id]);
    const c = await decisionContext(people.cruz.user);
    expect(await decisionFor(a, people.cruz.user, c)).toMatchObject({ blockedCode: 'ABOVE_LIMIT', level: { current: 1, required: 1 } });
    // a rejection is not bound by the amount
    expect(await decisionFor(a, people.cruz.user, c, { action: 'reject' })).toMatchObject({ canDecide: true });
    const names = (await eligibleApprovers(1820000, [people.maker.id], 'remittance', c)).map((u) => u.name);
    expect(names).toContain('A. Tan');
    expect(names).not.toEqual(expect.arrayContaining(['J. Cruz']));
    expect(names).not.toContain('M. Reyes');
    expect(names).not.toContain('N. Limit');
  });
});

describe('deciding', () => {
  it('bulk approve of 3 items, one already approved by someone else: 2 Approved and 1 Already approved by', async () => {
    const items = [await submitted('EXT-RAP-B1', 1000), await submitted('EXT-RAP-B2', 2000), await submitted('EXT-RAP-B3', 3000)];
    expect((await people.tan('post', `/remittance/approvals/${items[1].id}/approve`).send({ comments: 'Checked' })).status).toBe(200);
    const r = await people.cruz('post', '/remittance/approvals/decide').send({ items: items.map((i) => ({ id: i.id, version: i.version })), action: 'approve', note: 'Checked' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ action: 'approve', decided: 2, refused: 1 });
    expect(r.body.data.results.map((x) => x.message.replace(/\d{2}:\d{2}/, 'hh:mm'))).toEqual(['Approved', 'Already approved by A. Tan at hh:mm.', 'Approved']);
    expect(r.body.data.results[1]).toMatchObject({ ok: false, code: 'ALREADY_DECIDED' });
    // the single route answers 409 with the same code
    const again = await people.cruz('post', `/remittance/approvals/${items[0].id}/approve`).send({});
    expect(again.status).toBe(409);
    expect(again.body).toMatchObject({ errors: [{ code: 'ALREADY_DECIDED' }] });
    expect(again.body.message).toMatch(/^Approved by J\. Cruz at \d{2}:\d{2}\.$/);
    expect((await people.cruz('post', `/remittance/remittances/${items[0].remittanceId}/approve`).send({})).status).toBe(409);
    // decided items move to Decided with the decision in words
    const decided = rowOf(await inbox('cruz', 'decided'), items[0].id);
    expect(decided.outcome).toMatchObject({ action: 'Approved', by: { name: 'J. Cruz' }, limitAtDecision: 1000000, limitSourceLabel: 'Role limit: TIS Finance & General Accounting' });
    expect(decided.decision.blockedCode).toBe('ALREADY_DECIDED');
  });

  it('a decision on a version that moved on is refused: STALE', async () => {
    const a = await submitted('EXT-RAP-S1', 4000);
    const r = await people.cruz('post', `/remittance/approvals/${a.id}/approve`).send({ version: a.version + 1 });
    expect(r.status).toBe(409);
    expect(r.body.errors[0].code).toBe('STALE');
    expect((await q('SELECT status FROM remittance_approvals WHERE id = $1', [a.id]))[0].status).toBe('Pending');
  });

  it('a rejection needs a remittance_reject reason; the remittance returns to the maker, who is told with a link to the record', async () => {
    const a = await submitted('EXT-RAP-R1', 5000);
    for (const body of [{}, { comments: 'Rates wrong' }, { reasonCode: 'BRJ-DUPLICATE' }]) {
      expect((await people.cruz('post', `/remittance/approvals/${a.id}/reject`).send(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await people.cruz('post', '/remittance/approvals/decide').send({ items: [{ id: a.id, version: a.version }], action: 'reject' })).status).toBe(400);
    const r = await people.cruz('post', '/remittance/approvals/decide').send({ items: [{ id: a.id, version: a.version }], action: 'reject', reasonCode: 'RRJ-RATES', note: 'OD rate of September' });
    expect(r.body.data.results[0]).toMatchObject({ ok: true, status: 'Rejected', message: 'Rejected' });
    expect((await ctx.api('get', `/remittance/remittances/${a.remittanceId}`)).body.data.statusCode).toBe('rejected');
    const [n] = await q('SELECT title, message, link, type FROM notifications WHERE user_id = $1 AND entity = \'remittance\' AND entity_id = $2', [people.maker.id, a.remittanceId]);
    expect(n).toMatchObject({ link: `/finance/remittance/remittances/${a.remittanceId}`, type: 'alert' });
    expect(n.title).toBe(`Insurer Remittance ${a.reference} returned`);
    expect(n.message).toBe('Returned by J. Cruz: Rates to be corrected: OD rate of September');
    const [h] = await q('SELECT history FROM remittance_approvals WHERE id = $1', [a.id]);
    expect(h.history.at(-1)).toMatchObject({ action: 'Rejected', reasonCode: 'RRJ-RATES', limitAtDecision: 1000000, limitSource: 'role tis-finance' });
  });

  it('a delegate covering J. Cruz decides with her limit; the decision keeps the delegation as its limit source', async () => {
    const d = await ctx.api('post', '/access-control/delegations').send({ delegatorId: people.cruz.id, delegateId: people.nolimit.id, transactionTypes: ['remittance'],
      dateFrom: '2026-01-01', dateTo: '2099-12-31', reason: 'Annual leave' });
    expect(d.status).toBe(201);
    try {
      const a = await submitted('EXT-RAP-D1', 6000);
      const row = rowOf(await inbox('nolimit', 'mine'), a.id);
      expect(row.decision).toMatchObject({ canDecide: true, myLimit: 1000000, limitSourceLabel: 'Delegation from J. Cruz (Role limit: TIS Finance & General Accounting)' });
      expect(row.decision.eligibleApprovers.find((u) => u.name === 'N. Limit')).toMatchObject({ coveringFor: 'J. Cruz' });
      // the authority chips: the limit through the delegation and whom it covers, until when
      expect((await inbox('nolimit', 'mine')).authority).toMatchObject({ permission: true, canDecide: true, limit: 1000000,
        limitSourceLabel: 'Delegation from J. Cruz (Role limit: TIS Finance & General Accounting)', covering: [{ name: 'J. Cruz', until: '2099-12-31' }] });
      expect((await people.nolimit('post', `/remittance/approvals/${a.id}/approve`).send({ version: a.version })).status).toBe(200);
      const [h] = await q('SELECT history FROM remittance_approvals WHERE id = $1', [a.id]);
      expect(h.history.at(-1)).toMatchObject({ by: people.nolimit.id, limitAtDecision: 1000000, limitSource: 'delegated by J. Cruz (role tis-finance)' });
    } finally {
      await ctx.api('post', `/access-control/delegations/${d.body.data.id}/revoke`);
    }
  });

  it('per-item delegation is closed for TISPH: 409', async () => {
    const a = await submitted('EXT-RAP-D2', 6500);
    expect((await people.cruz('post', `/remittance/approvals/${a.id}/delegate`).send({ delegateTo: 'rap.tan' })).status).toBe(409);
  });
});

describe('notifications and reminders', () => {
  it('a submission reaches the eligible approvers only, with a link to its approval', async () => {
    const a = await submitted('EXT-RAP-N1', 7000);
    const big = await submitted('EXT-RAP-N2', 1500000);
    const of = async (who, approval) => q(`SELECT link FROM notifications WHERE entity = 'remittance' AND entity_id = $1 AND type = 'approval' AND user_id = $2`,
      [approval.remittanceId, people[who].id]);
    expect(await of('cruz', a)).toEqual([{ link: `/finance/remittance/approvals?approval=${a.id}` }]);
    expect(await of('tan', a)).toHaveLength(1);
    expect(await of('cruz', big)).toEqual([]);
    expect(await of('tan', big)).toHaveLength(1);
    expect(await of('nolimit', a)).toEqual([]);
    expect(await of('recon', a)).toEqual([]);
    expect(await of('maker', a)).toEqual([]);
    // no notification goes to a permission or a role any more
    expect(await q("SELECT count(*)::int AS n FROM notifications WHERE entity = 'remittance' AND entity_id = $1 AND user_id IS NULL", [a.remittanceId])).toEqual([{ n: 0 }]);
  });

  it('the submitter reminds the approvers once per 4 hours', async () => {
    const a = await submitted('EXT-RAP-M1', 8000);
    expect((await people.cruz('post', `/remittance/approvals/${a.id}/remind`)).status).toBe(403);
    const r = await people.maker('post', `/remittance/approvals/${a.id}/remind`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.sentTo.map((u) => u.name)).toEqual(expect.arrayContaining(['J. Cruz', 'A. Tan']));
    expect(r.body.data.message).toMatch(/^Reminder sent to .*J\. Cruz/);
    expect(new Date(r.body.data.nextReminderAt) - new Date(r.body.data.remindedAt)).toBe(4 * 3600000);
    const again = await people.maker('post', `/remittance/approvals/${a.id}/remind`);
    expect(again.status).toBe(409);
    expect(again.body.errors[0].code).toBe('REMINDED');
    expect(again.body.message).toMatch(/^Reminded (\d{2}\/\d{2}\/\d{4} )?\d{2}:\d{2} · next from (\d{2}\/\d{2}\/\d{4} )?\d{2}:\d{2}$/);
    const row = rowOf(await inbox('maker', 'submitted'), a.id);
    expect(row.actions.find((x) => x.code === 'remind')).toMatchObject({ allowed: false });
    expect(await q("SELECT title, link FROM notifications WHERE user_id = $1 AND title LIKE 'Reminder:%' AND entity_id = $2", [people.cruz.id, a.remittanceId]))
      .toEqual([{ title: `Reminder: Insurer Remittance ${a.reference} awaiting approval`, link: `/finance/remittance/approvals?approval=${a.id}` }]);
    expect(await q("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'remittance' AND entity_id = $1 AND action = 'remind'", [a.remittanceId])).toEqual([{ n: 1 }]);
    // a reminder does not change what the approver decides on
    expect((await people.cruz('post', `/remittance/approvals/${a.id}/approve`).send({ version: a.version })).status).toBe(200);
  });
});

describe('the review panel and the inbox figures', () => {
  it('shows the header, totals, first lines, previous remittance, checks, exceptions and activity', async () => {
    const first = await submitted('EXT-RAP-P1', 10000);
    expect((await people.cruz('post', `/remittance/approvals/${first.id}/approve`).send({})).status).toBe(200);
    const a = await submitted('EXT-RAP-P2', 11000);
    const r = await people.cruz('get', `/remittance/approvals/${a.id}`);
    expect(r.status).toBe(200);
    const s = r.body.data;
    expect(s).toMatchObject({ id: a.id, decision: { canDecide: true }, record: { remittanceNo: a.reference, insurer: { name: expect.any(String) } },
      totals: { policies: 1, premium: 12000, commission: 1000, dueToInsurer: 11000 }, lineCount: 1, exceptions: { count: 0, items: [] } });
    expect(s.lines).toEqual([expect.objectContaining({ policyNo: 'EXT-RAP-P2', premium: 12000, dueToInsurer: 11000 })]);
    expect(s.previous).toMatchObject({ remittanceNo: first.reference, amount: 10000, changePercent: 10 });
    expect(s.checks.find((c) => c.code === 'content-unchanged')).toMatchObject({ result: 'pass' });
    expect(s.checks.find((c) => c.code === 'period-open').label).toMatch(/^Period [A-Z][a-z]{2} \d{4} open$/);
    expect(s.activity.map((e) => e.actionCode)).toEqual(['create', 'submit']);
    expect((await people.cruz('get', `/remittance/approvals/remittance:${a.id}`)).body.data.id).toBe(a.id);
    expect((await people.cruz('get', '/remittance/approvals/999999')).status).toBe(404);
    // a change of the amounts after submission shows on the check
    await q('UPDATE remittances SET net_due = net_due + 1 WHERE id = $1', [a.remittanceId]);
    expect((await people.cruz('get', `/remittance/approvals/${a.id}`)).body.data.checks.find((c) => c.code === 'content-unchanged')).toMatchObject({ result: 'fail' });
  });

  it('filters by type, insurer and reference, with server totals and KPI figures', async () => {
    const a = await submitted('EXT-RAP-F1', 12345);
    const body = await inbox('cruz', 'mine', `&type=remittance&q=${a.reference}`);
    expect(body.data.map((x) => x.id)).toEqual([a.id]);
    expect(body).toMatchObject({ view: 'mine', total: 1, totals: { count: 1, amount: 12345 } });
    expect(body.kpis.awaitingMine.count).toBeGreaterThanOrEqual(1);
    expect((await inbox('cruz', 'mine', '&type=settlement')).data.find((x) => x.id === a.id)).toBeUndefined();
    const k = (await inbox('maker', 'submitted')).kpis;
    expect(k.submittedByMe.count).toBeGreaterThanOrEqual(1);
    expect(k.decidedByMeToday).toMatchObject({ count: 0 });
  });

  it('ages and "decided today" are taken in Manila time between 00:00 and 08:00', async () => {
    const tz = (await q("SELECT value FROM app_settings WHERE key = 'general.timezone'"))[0].value;
    expect(tz).toBe('Asia/Manila');
    // decisions of N. Night at 23:30 on 8 October and at 00:30 on 9 October, Manila time (15:30 and 16:30 UTC)
    const hist = [{ action: 'Submitted', by: people.maker.id, at: '2026-10-08T10:00:00Z' }];
    for (const [ref, at] of [['RAP-T-1', '2026-10-08T15:30:00Z'], ['RAP-T-2', '2026-10-08T16:30:00Z']]) {
      await q(`INSERT INTO remittance_approvals(entity, entity_id, reference_no, transaction_type, amount, status, initiator_id, action_by, action_at, history, created_at)
        VALUES ('item', $1, $1, 'Adjustment', 100, 'Approved', $2, $3, $4, $5, '2026-10-08T10:00:00Z')`,
      [ref, people.maker.id, people.night.id, at, JSON.stringify([...hist, { action: 'Approved', by: people.night.id, at, level: 1 }])]);
    }
    // submitted at 00:00 Manila on 9 October with a 24-hour SLA
    const [p] = await q(`INSERT INTO remittance_approvals(entity, entity_id, reference_no, transaction_type, amount, sla_hours, initiator_id, history, created_at)
      VALUES ('item', 'RAP-T-3', 'RAP-T-3', 'Adjustment', 100, 24, $1, '[]', '2026-10-08T16:00:00Z') RETURNING id`, [people.maker.id]);
    try {
      const at = async (now) => approvalInbox({ view: 'all', q: 'RAP-T-' }, people.night.user, { limit: 50, offset: 0 }, { now: new Date(now) });
      // 07:00 on 9 October in Manila (23:00 UTC on the 8th): the 00:30 decision is today's, the 23:30 one is not
      const morning = await at('2026-10-08T23:00:00Z');
      expect(morning.kpis.decidedByMeToday).toEqual({ count: 1, approved: 1, rejected: 0 });
      expect(morning.rows.find((x) => x.reference === 'RAP-T-3').sla).toMatchObject({ ageHours: 7, overdue: false, label: 'Due in 17 h' });
      // 23:45 on 8 October in Manila: only the 23:30 decision
      expect((await at('2026-10-08T15:45:00Z')).kpis.decidedByMeToday).toEqual({ count: 1, approved: 1, rejected: 0 });
      // 00:30 on 10 October in Manila (16:30 UTC on the 9th): overdue by half an hour
      expect((await at('2026-10-09T16:30:00Z')).rows.find((x) => x.reference === 'RAP-T-3').sla).toMatchObject({ overdue: true, label: 'Overdue 1 h' });
    } finally {
      await q("DELETE FROM remittance_approvals WHERE reference_no LIKE 'RAP-T-%'");
    }
    expect(p.id).toBeTruthy();
  });
});
