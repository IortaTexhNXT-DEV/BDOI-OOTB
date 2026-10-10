/**
 * Activity log of a remittance (remittance/activity.js, GET /remittance/remittances/:id/activity): the decision under
 * the remittance with the approver's display name, the limit at decision and its source and the reason, no raw codes;
 * one entry for a decision audited twice; the payment voucher with its batch and cheque audit; the e-mails; the
 * "Download log (XLSX)"; who may read it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { collapseDuplicates } from '../src/modules/remittance/activity.js';

let ctx;
const people = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(key, username, displayName, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  people[key] = Object.assign((m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`), { id: r.body.data.userId });
}
async function submitted(policyNo, net) {
  const c = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'MALAYAN', period: '2026-09', lines: [{ policyNo, premium: net + 1000, commission: 1000, tax: 0 }] });
  expect(c.status).toBe(201);
  expect((await people.maker('post', '/remittance/remittances/process').send({ ids: [c.body.data.id] })).status).toBe(200);
  const [a] = await q("SELECT id FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1", [c.body.data.id]);
  return { id: Number(a.id), remittanceId: c.body.data.id, remittanceNo: c.body.data.remittanceNo };
}
const activity = async (who, id) => {
  const r = await people[who]('get', `/remittance/remittances/${id}/activity`);
  expect(r.status, JSON.stringify(r.body)).toBe(200);
  return r.body.data;
};
const RAW = /RRJ-|role tis-|tis-finance|create-agency-bill|for-approval|delegated by/;

beforeAll(async () => {
  ctx = await setup();
  await persona('maker', 'rac.maker', 'M. Reyes', ['accounting']);
  await persona('cruz', 'rac.cruz', 'J. Cruz', ['tis-finance']);
  await persona('sales', 'rac.sales', 'S. Sales', ['sales']);
});
afterAll(async () => { await pool.end(); });

describe('the decision under the remittance', () => {
  it('an approval reads as one entry with the approver, the limit at decision and its source', async () => {
    const a = await submitted('EXT-RAC-1', 15000);
    expect((await people.cruz('post', `/remittance/approvals/${a.id}/approve`).send({ comments: 'Checked against the statement' })).status).toBe(200);
    // the decision is audited under the approval and under the remittance
    expect(await q("SELECT entity FROM audit_log WHERE action = 'approve' AND ((entity = 'remittance' AND entity_id = $1) OR (entity = 'remittance_approval' AND entity_id = $2)) ORDER BY entity",
      [a.remittanceId, String(a.id)])).toEqual([{ entity: 'remittance' }, { entity: 'remittance_approval' }]);
    const log = await activity('maker', a.remittanceId);
    expect(log.map((e) => e.actionCode)).toEqual(['create', 'submit', 'approve']);
    const approved = log[2];
    expect(approved).toMatchObject({ actionLabel: 'Remittance approved', fromStatus: 'Pending Approval', toStatus: 'Approved', remarks: 'Checked against the statement',
      user: { displayName: 'J. Cruz', roles: ['TIS Finance & General Accounting'] },
      approval: { level: 1, requiredLevels: 1, limitAtDecision: 1000000, limitSourceLabel: 'Role limit: TIS Finance & General Accounting', reason: null } });
    expect(approved.changes).toEqual([
      { field: 'limitAtDecision', label: 'Limit at decision', before: null, after: '₱1,000,000.00' },
      { field: 'limitSource', label: 'Limit source', before: null, after: 'Role limit: TIS Finance & General Accounting' }]);
    // the record carries the same log
    expect((await people.maker('get', `/remittance/remittances/${a.remittanceId}`)).body.data.activityLog.map((e) => e.actionCode)).toEqual(['create', 'submit', 'approve']);
  });

  it('a rejection shows the reason in words; no reason or role code reaches the log', async () => {
    const a = await submitted('EXT-RAC-2', 16000);
    expect((await people.cruz('post', `/remittance/approvals/${a.id}/reject`).send({ reasonCode: 'RRJ-OTHER', note: 'OD rate of POL-1' })).status).toBe(200);
    const log = await activity('maker', a.remittanceId);
    const returned = log.find((e) => e.actionCode === 'reject');
    expect(returned).toMatchObject({ actionLabel: 'Remittance returned to the maker', toStatus: 'Returned', remarks: 'Other: OD rate of POL-1',
      approval: { reason: 'Other: OD rate of POL-1', limitAtDecision: 1000000 } });
    expect(JSON.stringify(log.map(({ approval, ...e }) => ({ ...e, approval: { ...approval, limitSource: undefined } })))).not.toMatch(RAW);
  });

  it('a decision kept on the approval history only still shows; duplicates within 2 seconds collapse', async () => {
    const a = await submitted('EXT-RAC-3', 17000);
    const at = new Date().toISOString();
    await q(`UPDATE remittance_approvals SET status = 'Approved', action_by = $2, action_at = $3::timestamptz,
      history = history || jsonb_build_array(jsonb_build_object('action', 'Approved', 'by', $2::text, 'at', $4::text, 'level', 1, 'limitAtDecision', 1000000, 'limitSource', 'role tis-finance'))
      WHERE id = $1`, [a.id, people.cruz.id, at, at]);
    const log = await activity('maker', a.remittanceId);
    expect(log.at(-1)).toMatchObject({ actionCode: 'approve', actionLabel: 'Remittance approved', user: { displayName: 'J. Cruz' }, approval: { limitSourceLabel: 'Role limit: TIS Finance & General Accounting' } });
    const t0 = '2026-10-09T02:00:00.000Z';
    const e = (id, at, actionCode, username, toStatus = null) => ({ id, at, actionCode, toStatus, changes: [], user: { username } });
    const out = collapseDuplicates([e('1', t0, 'approve', 'cruz'), e('2', '2026-10-09T02:00:01.500Z', 'approve', 'cruz', 'Approved'), e('3', '2026-10-09T02:00:03.000Z', 'approve', 'cruz'),
      e('4', '2026-10-09T02:00:01.000Z', 'approve', 'tan'), e('5', t0, 'submit', 'cruz')]);
    expect(out.map((x) => [x.id, x.toStatus])).toEqual([['1', 'Approved'], ['3', null], ['4', null], ['5', null]]);
  });
});

describe('payment and e-mails', () => {
  it('merges the payment voucher with its batch and cheque audit and the e-mails sent', async () => {
    const a = await submitted('EXT-RAC-4', 18000);
    expect((await people.cruz('post', `/remittance/approvals/${a.id}/approve`).send({})).status).toBe(200);
    const [pv] = await q(`INSERT INTO disbursements(id, voucher_number, payee_type, payee_name, amount, status, created_by, created_at)
      VALUES ('dv_rac4', 'PV-RAC-0004', 'insurer', 'Malayan', 18000, 'draft', $1, now() + interval '1 minute') RETURNING id`, [people.maker.id]);
    await q(`INSERT INTO remittance_items(kind, reference_no, amount, status, data, created_by) VALUES ('settlement', 'SET-RAC-0004', 18000, 'Approved', $1, $2)`,
      [JSON.stringify({ remittanceIds: [a.remittanceId], disbursementId: pv.id, voucherNumber: 'PV-RAC-0004' }), people.maker.id]);
    await q(`INSERT INTO checkbooks(id, disbursement_id, instrument_no, totale_amount, created_by) VALUES ('chk_rac4', 'dv_rac4', '000777', 18000, $1)`, [people.maker.id]);
    await q(`INSERT INTO audit_log(user_id, username, entity, entity_id, action, before_data, after_data, at) SELECT id, username, 'checkbook', 'chk_rac4', 'status:Approved',
      '{"status":"Pending"}', '{"status":"Approved"}', now() + interval '2 minutes' FROM users WHERE id = $1`, [people.cruz.id]);
    await q(`INSERT INTO email_outbox(to_address, subject, body_html, template, entity, entity_id, status, sent_at, created_at)
      VALUES ('remit@malayan.example', $2, '<p>x</p>', 'remittance-advice', 'remittance', $1, 'sent', now() + interval '3 minutes', now() + interval '3 minutes')`, [a.remittanceId, `Remittance advice ${a.remittanceNo}`]);
    const log = await activity('maker', a.remittanceId);
    expect(log.map((e) => e.actionCode).slice(-3)).toEqual(['raise-voucher', 'status:Approved', 'email']);
    expect(log.find((e) => e.actionCode === 'raise-voucher')).toMatchObject({ actionLabel: 'Payment voucher PV-RAC-0004 raised' });
    expect(log.find((e) => e.actionCode === 'status:Approved')).toMatchObject({ record: { type: 'Cheque', reference: '000777' }, user: { displayName: 'J. Cruz' } });
    expect(log.at(-1)).toMatchObject({ actionLabel: 'E-mail sent to remit@malayan.example', remarks: `Remittance advice ${a.remittanceNo}`, user: { displayName: 'System' } });
  });

  it('downloads the log as XLSX; readers of remittances only', async () => {
    const [r] = await q("SELECT id, remittance_number FROM remittances WHERE remittance_number IS NOT NULL ORDER BY created_at DESC LIMIT 1");
    const x = await people.maker('get', `/remittance/remittances/${r.id}/activity?format=xlsx`).buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(x.status).toBe(200);
    expect(x.headers['content-type']).toMatch(/spreadsheetml/);
    expect(x.headers['content-disposition']).toContain(`activity-${r.remittance_number}.xlsx`);
    expect(x.body.subarray(0, 2).toString()).toBe('PK');
    expect((await people.sales('get', `/remittance/remittances/${r.id}/activity`)).status).toBe(403);
    expect((await people.maker('get', '/remittance/remittances/nope/activity')).status).toBe(404);
  });
});
