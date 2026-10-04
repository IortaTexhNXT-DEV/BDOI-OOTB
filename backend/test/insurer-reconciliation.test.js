/**
 * Insurer statement reconciliation: import with a format, auto and manual matching, differences report, resolutions,
 * approval by the Accounting Manager (adjustment journal through the posting engine) and exports.
 *
 * Remittance of three policies to FPG (gross 12,525.00, commission 1,500.00, net 11,025.00 each). The statement lists
 * A exactly, B with 100.00 less commission and a policy the broker does not have; C is missing on the statement.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupFinance, makePolicy, ledgerIntegrity } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { parseRows } from '../src/modules/insurer-reconciliation/statements.js';
import { compare, normPolicy } from '../src/modules/insurer-reconciliation/matching.js';

let ctx;
let manager;
beforeAll(async () => {
  ctx = await setupFinance();
  const u = await ctx.api('post', '/users').send({ username: 'isr.manager', password: 'Welcome@123', displayName: 'ISR manager', roles: ['accounting-manager'], email: 'isr.manager@example.ph' });
  expect(u.status).toBe(201);
  const token = (await request(ctx.app).post('/api/auth/login').send({ username: 'isr.manager', password: 'Welcome@123' })).body.accessToken;
  manager = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
});
afterAll(async () => { await pool.end(); });

const csv = (rows) => Buffer.from(['Policy No,Insured,Date,Reference,Gross Premium,Commission,Taxes,Amount Paid', ...rows, 'TOTAL,,,,,,,'].join('\n'));
const importFile = (file, fields, who = 'maker') => {
  let r = ctx.as(who)('post', '/insurer-reconciliation/statements/import').attach('file', file, 'soa.csv');
  for (const [k, v] of Object.entries(fields)) r = r.field(k, String(v));
  return r;
};

describe('parsing and comparing', () => {
  it('reads a file with a format and flags rows it cannot read', () => {
    const table = [['Title'], ['Pol #', 'Assured', 'Gross', 'Comm'], ['P-1', 'Juan', '1,000.00', '150'], ['P-2', 'Maria', 'abc', '10'], ['', '', '', ''], ['Grand total', '', '1000', '150']];
    const out = parseRows(table, { code: 'X', skip_rows: 1, has_header: true, columns: { policyNo: 'pol', insured: 'assured', grossPremium: 'gross', commission: 'comm' }, date_format: 'YYYY-MM-DD', skip_pattern: '^grand total' });
    expect(out.lines).toEqual([expect.objectContaining({ policyNo: 'P-1', insured: 'Juan', grossPremium: 1000, commission: 150 })]);
    expect(out.errors).toEqual([expect.objectContaining({ row: 4 })]);
    expect(normPolicy('pol-2026 / 001')).toBe('POL2026001');
    const st = { tolerance: 1, statement_type: 'premium' };
    expect(compare({ gross_premium: 1000.5, commission: 150, taxes: 0, amount_paid: 0 }, { grossPremium: 1000, commission: 150, taxes: 9, amount: 850 }, st).status).toBe('matched');
    expect(compare({ gross_premium: 1000, commission: 140, taxes: 0, amount_paid: 0 }, { grossPremium: 1000, commission: 150, taxes: 0, amount: 850 }, st))
      .toEqual({ status: 'difference', diffs: { grossPremium: 0, commission: -10, taxes: 0, amountPaid: 0 } });
  });
});

describe('insurer statement reconciliation', () => {
  let a; let b; let c; let s;
  it('imports a statement, auto-matches by policy number and reports the differences', async () => {
    [a, b, c] = [await makePolicy({ insurer: 'FPG' }), await makePolicy({ insurer: 'FPG' }), await makePolicy({ insurer: 'FPG' })];
    const rem = await ctx.as('maker')('post', '/remittance/remittances').send({ insurerCode: 'FPG', lines: [a, b, c].map((m) => ({ policyId: m.policy.id })) });
    expect(rem.status).toBe(201);
    const today = (await query('SELECT remittance_date::text AS d FROM remittances WHERE id = $1', [rem.body.data.id])).rows[0].d;
    const file = csv([
      `${a.policy.policy_number.toLowerCase()},Client A,${today},OR-1,"12,525.00","1,500.00",,"11,025.00"`,
      `${b.policy.policy_number},Client B,${today},OR-2,12525,1400,,11125`,
      `POL-NOT-OURS,Somebody,${today},OR-3,5000,500,,4500`,
    ]);
    const fpg = (await query('SELECT id FROM insurance_companies WHERE code = \'FPG\'')).rows[0].id;
    const preview = await ctx.as('maker')('post', '/insurer-reconciliation/statements/preview').attach('file', file, 'soa.csv').field('insurerId', String(fpg));
    expect(preview.status).toBe(200);
    expect(preview.body.data.totals).toMatchObject({ count: 3, grossPremium: 30050 });
    const r = await importFile(file, { insurerId: fpg, statementType: 'premium', periodFrom: today, periodTo: today, statementRef: 'SOA-FPG-1' });
    expect(r.status).toBe(201);
    s = r.body.data;
    expect(s.statementNumber).toMatch(/^ISR/);
    const byPolicy = Object.fromEntries(s.lines.map((l) => [normPolicy(l.policyNumber), l]));
    expect(byPolicy[normPolicy(a.policy.policy_number)].matchStatus).toBe('matched');
    expect(byPolicy[normPolicy(b.policy.policy_number)]).toMatchObject({ matchStatus: 'difference', brokerType: 'remittance_line', differences: { commission: -100, amountPaid: 100 } });
    expect(byPolicy.POLNOTOURS.matchStatus).toBe('unmatched');
    expect(s.missingInInsurer.map((x) => x.policyNumber)).toContain(c.policy.policy_number);
    expect((await importFile(file, { insurerId: fpg, statementType: 'premium', periodFrom: today, periodTo: today })).status).toBe(409);
  });

  it('matches by hand, and needs every difference resolved before submitting', async () => {
    const lineA = s.lines.find((l) => l.matchStatus === 'matched');
    expect((await ctx.as('maker')('delete', `/insurer-reconciliation/statements/${s.id}/lines/${lineA.id}/match`)).status).toBe(200);
    const cands = await ctx.as('maker')('get', `/insurer-reconciliation/statements/${s.id}/candidates?search=${a.policy.policy_number}`);
    const remLine = cands.body.data.find((x) => x.type === 'remittance_line');
    const m = await ctx.as('maker')('post', `/insurer-reconciliation/statements/${s.id}/lines/${lineA.id}/match`).send({ brokerType: 'remittance_line', brokerId: remLine.id });
    expect(m.body.data.status).toBe('matched');
    expect((await ctx.as('maker')('post', `/insurer-reconciliation/statements/${s.id}/submit`)).status).toBe(409);
    const lineB = s.lines.find((l) => l.matchStatus === 'difference');
    const unknown = s.lines.find((l) => l.matchStatus === 'unmatched');
    expect((await ctx.as('maker')('post', `/insurer-reconciliation/statements/${s.id}/resolutions`).send({ lineId: lineA.id, kind: 'note', note: 'fine' })).status).toBe(409);
    expect((await ctx.as('maker')('post', `/insurer-reconciliation/statements/${s.id}/resolutions`).send({ lineId: lineB.id, kind: 'adjustment', note: 'Insurer applied 11.18%' })).status).toBe(400);
    const adj = await ctx.as('maker')('post', `/insurer-reconciliation/statements/${s.id}/resolutions`).send({ lineId: lineB.id, kind: 'adjustment', note: 'Insurer applied the lower rate', commissionAdjustment: 100 });
    expect(adj.status).toBe(201);
    expect(adj.body.data).toMatchObject({ kind: 'adjustment', commissionAdjustment: 100, commissionSide: 'due_to_insurer' });
    await ctx.as('maker')('post', `/insurer-reconciliation/statements/${s.id}/resolutions`).send({ lineId: unknown.id, kind: 'note', note: 'Placed by another broker; insurer to remove' });
    const detail = await ctx.as('maker')('get', `/insurer-reconciliation/statements/${s.id}`);
    for (const x of detail.body.data.missingInInsurer) {
      await ctx.as('maker')('post', `/insurer-reconciliation/statements/${s.id}/resolutions`).send({ brokerType: x.type, brokerId: x.id, kind: 'note', note: 'Remitted after the statement cut-off' });
    }
    const sub = await ctx.as('maker')('post', `/insurer-reconciliation/statements/${s.id}/submit`);
    expect(sub.status).toBe(200);
    expect(sub.body.data.status).toBe('submitted');
  });

  it('only a different user with approve:insurer-reconciliation approves; approval posts the adjustment through the posting rule', async () => {
    expect((await ctx.as('checker')('post', `/insurer-reconciliation/statements/${s.id}/approve`).send({})).status).toBe(403);
    expect((await manager('post', `/insurer-reconciliation/statements/${s.id}/reject`).send({})).status).toBe(400);
    const ap = await manager('post', `/insurer-reconciliation/statements/${s.id}/approve`).send({ remarks: 'Agreed with FPG' });
    expect(ap.status).toBe(200);
    expect(ap.body.data.status).toBe('approved');
    const res = ap.body.data.amountDifferences[0].resolution;
    expect(res.journalNumber).toBeTruthy();
    const jv = (await query('SELECT j.*, p.event_code FROM journal_vouchers j JOIN posting_rules p ON p.id = j.posting_rule_id WHERE j.id = $1', [res.journalId])).rows[0];
    expect(jv.event_code).toBe('insurer_statement.adjustment');
    const lines = (await query('SELECT account_code, debit::float AS d, credit::float AS c FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [res.journalId])).rows;
    expect(lines).toEqual([{ account_code: '3201001', d: 100, c: 0 }, { account_code: '2201001', d: 0, c: 100 }]);
    expect((await ledgerIntegrity()).unbalanced).toBe(0);
    expect((await ctx.as('maker')('post', `/insurer-reconciliation/statements/${s.id}/resolutions`).send({ lineId: ap.body.data.amountDifferences[0].id, kind: 'note', note: 'late' })).status).toBe(409);
  });

  it('exports the differences report as Excel, CSV and PDF', async () => {
    const x = await ctx.as('maker')('get', `/insurer-reconciliation/statements/${s.id}/report`);
    expect(x.status).toBe(200);
    expect(x.headers['content-type']).toContain('spreadsheetml');
    const c2 = await ctx.as('maker')('get', `/insurer-reconciliation/statements/${s.id}/report?format=csv`);
    expect(c2.text).toContain(b.policy.policy_number);
    expect(c2.text).toContain('Missing on the insurer statement');
    const p = await ctx.as('maker')('get', `/insurer-reconciliation/statements/${s.id}/report?format=pdf`);
    expect(p.headers['content-type']).toContain('application/pdf');
    const list = await ctx.as('maker')('get', '/insurer-reconciliation/statements?status=approved');
    expect(list.body.data.map((z) => z.id)).toContain(s.id);
  });

  it('keeps a column mapping per insurer', async () => {
    const f = await ctx.api('post', '/insurer-reconciliation/formats').send({ code: 'FPG-SOA', name: 'FPG statement', insurerId: (await query('SELECT id FROM insurance_companies WHERE code = \'FPG\'')).rows[0].id,
      columns: { policyNo: 1, grossPremium: 3, commission: 4 }, hasHeader: false });
    expect(f.status).toBe(201);
    expect((await ctx.api('post', '/insurer-reconciliation/formats').send({ code: 'BAD', name: 'Bad', columns: { grossPremium: 2 } })).status).toBe(400);
    const list = await ctx.as('maker')('get', `/insurer-reconciliation/formats?insurerId=${f.body.data.insurerId}`);
    expect(list.body.data.map((x) => x.code)).toEqual(expect.arrayContaining(['FPG-SOA', 'GENERIC']));
  });
});
