/**
 * Reasons of the accounting decisions (seed 88_accounting_reasons.sql) on the Reason Codes master: the contexts on the
 * Used For list, their reasons, the reason check the routes use (requiredReason) and who may read the reasons.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { requiredReason } from '../src/modules/ops-masters/records.js';

const CONTEXTS = ['period_close', 'period_reopen', 'year_end_reverse', 'year_end_cancel', 'cas_print_void', 'cas_document_change', 'incentive_batch_reject', 'incentive_adjustment'];
const SEED = path.join(path.dirname(new URL(import.meta.url).pathname), '../src/db/seeds/88_accounting_reasons.sql');

let ctx;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, permissions) {
  const role = `${username.replace(/\./g, '-')}-role`;
  expect((await ctx.api('post', '/roles').send({ code: role, name: role, permissions })).status).toBe(201);
  expect((await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles: [role] })).status).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('the accounting contexts of the Reason Codes master', () => {
  it('are on the Used For list with their reasons, each with an Other that needs a note', async () => {
    const [type] = await q("SELECT fields FROM master_types WHERE code = 'reason-code'");
    const options = type.fields.find((f) => f.name === 'context').options;
    expect(options).toEqual(expect.arrayContaining(['decline', 'reassignment', ...CONTEXTS]));
    expect(new Set(options).size).toBe(options.length);
    const counts = await q("SELECT data->>'context' AS context, count(*)::int AS n FROM master_records WHERE type_code = 'reason-code' AND data->>'context' = ANY($1) GROUP BY 1 ORDER BY 1", [CONTEXTS]);
    expect(counts).toEqual([{ context: 'cas_document_change', n: 6 }, { context: 'cas_print_void', n: 5 }, { context: 'incentive_adjustment', n: 5 },
      { context: 'incentive_batch_reject', n: 6 }, { context: 'period_close', n: 6 }, { context: 'period_reopen', n: 6 }, { context: 'year_end_cancel', n: 4 },
      { context: 'year_end_reverse', n: 4 }]);
    const others = await q("SELECT data->>'context' AS context, data->'requiresNote' AS note FROM master_records WHERE type_code = 'reason-code' AND code LIKE '%-OTHER' AND data->>'context' = ANY($1)", [CONTEXTS]);
    expect(others).toHaveLength(CONTEXTS.length);
    expect(others.every((o) => o.note === true)).toBe(true);
  });

  it('keeps the administrator changes when the seed runs again', async () => {
    await q("UPDATE master_records SET name = 'Month-end close done', status = 'inactive' WHERE type_code = 'reason-code' AND code = 'PCL-MONTHEND'");
    await q("UPDATE master_types SET fields = (SELECT jsonb_agg(CASE WHEN f->>'name' = 'context' THEN jsonb_set(f, '{options}', (f->'options') - 'cas_print_void') ELSE f END ORDER BY i) FROM jsonb_array_elements(fields) WITH ORDINALITY AS x(f, i)) WHERE code = 'reason-code'");
    await pool.query(fs.readFileSync(SEED, 'utf8'));
    await pool.query(fs.readFileSync(SEED, 'utf8'));
    const [r] = await q("SELECT name, status FROM master_records WHERE type_code = 'reason-code' AND code = 'PCL-MONTHEND'");
    expect(r).toEqual({ name: 'Month-end close done', status: 'inactive' });
    const [type] = await q("SELECT fields FROM master_types WHERE code = 'reason-code'");
    const options = type.fields.find((f) => f.name === 'context').options;
    expect(options.filter((o) => o === 'cas_print_void')).toHaveLength(1);
    expect((await q("SELECT count(*)::int AS n FROM master_records WHERE type_code = 'reason-code' AND code LIKE 'PCL-%'"))[0].n).toBe(6);
    await q("UPDATE master_records SET name = 'Month-end close completed', status = 'active' WHERE type_code = 'reason-code' AND code = 'PCL-MONTHEND'");
  });
});

describe('requiredReason', () => {
  const failure = async (promise) => {
    const e = await promise.catch((err) => err);
    expect(e.status).toBe(400);
    return e.details[0];
  };

  it('needs an active reason of the context of the action', async () => {
    expect(await failure(requiredReason(pool, 'period_close', {}))).toMatchObject({ path: 'reasonCode', message: 'Choose the reason' });
    expect(await failure(requiredReason(pool, 'period_close', { reasonCode: 'PRO-LATEDOC' }))).toMatchObject({ path: 'reasonCode' });
    expect(await failure(requiredReason(pool, 'period_close', { reasonCode: 'NOPE' }))).toMatchObject({ path: 'reasonCode' });
    await q("UPDATE master_records SET status = 'inactive' WHERE type_code = 'reason-code' AND code = 'PCL-AUDIT'");
    expect(await failure(requiredReason(pool, 'period_close', { reasonCode: 'PCL-AUDIT' }))).toMatchObject({ path: 'reasonCode' });
    await q("UPDATE master_records SET status = 'active' WHERE type_code = 'reason-code' AND code = 'PCL-AUDIT'");
  });

  it('needs the note of a reason that asks for one and gives the code with the text to keep', async () => {
    expect(await failure(requiredReason(pool, 'incentive_batch_reject', { reasonCode: 'IBR-OTHER', note: '  ' }))).toMatchObject({ path: 'note' });
    expect(await requiredReason(pool, 'incentive_batch_reject', { reasonCode: 'ibr-other', note: ' Agent list of the wrong branch ' }))
      .toEqual({ code: 'IBR-OTHER', name: 'Other', note: 'Agent list of the wrong branch', text: 'Other: Agent list of the wrong branch' });
    expect(await requiredReason(pool, 'period_close', { reasonCode: 'PCL-MONTHEND' }))
      .toEqual({ code: 'PCL-MONTHEND', name: 'Month-end close completed', note: null, text: 'Month-end close completed' });
  });

  it('can be stored beside the reason text of the decisions', async () => {
    const columns = await q(`SELECT table_name, column_name FROM information_schema.columns
      WHERE (table_name, column_name) IN (('period_status_history', 'reason_code'), ('year_end_runs', 'reverse_reason_code'), ('cas_book_prints', 'void_reason_code'),
        ('incentive_calculations', 'rejection_reason_code')) ORDER BY 1`);
    expect(columns.map((c) => c.table_name)).toEqual(['cas_book_prints', 'incentive_calculations', 'period_status_history', 'year_end_runs']);
  });
});

describe('reading the reasons', () => {
  it('is open to period-end and incentive users, by context; changing them stays with masters maintenance', async () => {
    const closer = await persona('rsn.closer', ['read:profile', 'read:period-end', 'write:period-end']);
    const res = await closer('get', '/ops-masters/reason-code?status=Active&context=period_reopen');
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.code).sort()).toEqual(['PRO-AUDITADJ', 'PRO-BIRAMEND', 'PRO-LATEDOC', 'PRO-OTHER', 'PRO-POSTERR', 'PRO-RECON']);
    expect((await closer('post', '/ops-masters/reason-code').send({ code: 'PCL-X', name: 'X', context: 'period_close' })).status).toBe(403);
    const approver = await persona('rsn.incentive', ['read:profile', 'read:incentive']);
    expect((await approver('get', '/ops-masters/reason-code?context=incentive_batch_reject')).body.data).toHaveLength(6);
    const other = await persona('rsn.none', ['read:profile']);
    expect((await other('get', '/ops-masters/reason-code')).status).toBe(403);
  });
});
