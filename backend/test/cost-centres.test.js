/**
 * Cost centres (migration 0346, FGA.04): the master on Master > Finance > Cost Centres with TISPH's 900901 as the
 * default; every journal line carries a cost centre (the default when none is chosen); manual vouchers choose valid
 * ones; the journal voucher, the accounting query and its export and the general ledger detail report show it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query } from '../src/db/pool.js';
import { today } from '../src/lib/dates.js';
import { withoutConfigurationApproval } from './helpers.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); await withoutConfigurationApproval(); });
afterAll(async () => { await pool.end(); });

const entries = (extra = {}) => [{ mainAccount: '658000', entryType: 'Debit', localAmount: 1200, remarks: 'Audit fee', ...extra }, { mainAccount: '210030', entryType: 'Credit', localAmount: 1200, remarks: 'Accrued' }];
const costCentres = async (jvId) => (await query('SELECT cost_centre FROM journal_lines WHERE jv_id = $1 ORDER BY line_no', [jvId])).rows.map((r) => r.cost_centre);

describe('cost centres', () => {
  it('ships the cost centre master with 900901 Toyota Insurance Services as the default', async () => {
    const r = await ctx.as('maker')('get', '/masters/cost-centre?status=all');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    const rows = r.body.data.rows || r.body.data;
    expect(rows.find((x) => x.code === '900901' || x.Code === '900901')).toBeTruthy();
    const [cc] = (await query("SELECT name, data FROM master_records WHERE type_code = 'cost-centre' AND code = '900901'")).rows;
    expect(cc).toMatchObject({ name: 'Toyota Insurance Services', data: { isDefault: true, companyCode: 'TISPH' } });
  });

  it('Master > Finance > Cost Centres lists and maintains the master for Accounting; the front office cannot change it', async () => {
    const list = await ctx.as('maker')('get', '/ops-masters/cost-centre?status=all');
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(list.body.type.fields.map((f) => f.name)).toEqual(expect.arrayContaining(['code', 'name', 'companyCode', 'isDefault']));
    expect(list.body.data.find((x) => x.code === '900901')).toMatchObject({ name: 'Toyota Insurance Services' });
    const add = await ctx.as('maker')('post', '/ops-masters/cost-centre').send({ code: '900903', name: 'Toyota Insurance Services - Operations', companyCode: 'TISPH' });
    expect(add.status, JSON.stringify(add.body)).toBe(201);
    expect((await ctx.as('maker')('put', `/ops-masters/cost-centre/${add.body.data.id}`).send({ responsiblePerson: 'Finance Head' })).status).toBe(200);
    expect((await ctx.as('sales')('post', '/ops-masters/cost-centre').send({ code: '900904', name: 'No' })).status).toBe(403);
  });

  it('stamps the default cost centre on system journals', async () => {
    const m = await makePolicy({ net: 8000 });
    expect((await ctx.as('maker')('post', '/receipts').send({ policyId: m.policy.id, amount: m.gross })).status).toBe(201);
    const jvs = (await query('SELECT id FROM journal_vouchers WHERE policy_id = $1', [m.policy.id])).rows;
    expect(jvs.length).toBeGreaterThan(1);
    for (const j of jvs) expect(new Set(await costCentres(j.id))).toEqual(new Set(['900901']));
  });

  it('a manual voucher takes the cost centre chosen per line, refuses an unknown or expired one and shows it', async () => {
    const add = await ctx.api('post', '/masters/cost-centre').send({ code: '900902', name: 'Toyota Insurance Services - Sales', companyCode: 'TISPH', validTo: '2020-12-31' });
    expect(add.status, JSON.stringify(add.body)).toBe(201);
    expect((await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV01', entries: entries({ costCentre: 'NOPE' }) })).status).toBe(400);
    const expired = await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV01', entries: entries({ costCentre: '900902' }) });
    expect(expired.status).toBe(400);
    expect(expired.body.message).toMatch(/900902/);
    await query("UPDATE master_records SET data = data - 'validTo' WHERE type_code = 'cost-centre' AND code = '900902'");
    const ok = await ctx.as('maker')('post', '/journal-vouchers').send({ transactionCode: 'JV01', entries: entries({ costCentre: '900902' }) });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    expect(await costCentres(ok.body.data.id)).toEqual(['900902', '900901']);
    const detail = await ctx.as('maker')('get', `/journal-vouchers/${ok.body.data.id}`);
    expect(detail.body.data.entries.map((e) => e.costCentre)).toEqual(['900902', '900901']);
    expect((await ctx.as('checker')('post', `/journal-vouchers/${ok.body.data.id}/approve`)).status).toBe(200);
    // a reversal keeps the cost centres of the original
    const rev = await ctx.as('maker')('post', '/journal-vouchers/reversal').send({ transactionNumber: ok.body.data.transactionNumber });
    expect(await costCentres(rev.body.data.id)).toEqual(['900902', '900901']);
  });

  it('the accounting query, its export and the general ledger detail show the cost centre', async () => {
    const found = await ctx.as('maker')('get', '/accounting/entries/search?costCentre=900902&pageSize=50');
    expect(found.status).toBe(200);
    expect(found.body.data.length).toBeGreaterThan(0);
    expect(found.body.data.every((e) => e.costCentre === '900902')).toBe(true);
    const csv = await ctx.as('maker')('get', '/accounting/export?costCentre=900902');
    expect(csv.status).toBe(200);
    expect(csv.text.split('\n')[0]).toContain('Cost centre');
    const d = await today();
    const gl = await ctx.api('post', '/reports/gl-detail/run').send({ ReportCriteria: 'Overall', FromDate: d, ToDate: d, Account: '658000', perPage: 500 });
    expect(gl.status, JSON.stringify(gl.body)).toBe(200);
    expect(gl.body.data.columns.map((c) => c.key)).toContain('costCentre');
    expect(gl.body.data.rows.filter((r) => r.journalNumber).map((r) => r.costCentre)).toContain('900902');
  });
});
