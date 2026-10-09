/**
 * Remittance decisions: the reasons of the remittance, exception, insurer reconciliation and insurer billing decisions
 * on the Reason Codes master (seed 89_remittance_reasons.sql), the reason check of the routes (requiredReason) and who
 * may read them; the steps of a remittance in its activity log (lib/auditLabels.js).
 */
import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { requiredReason } from '../src/modules/ops-masters/records.js';
import { actionTitle } from '../src/lib/auditLabels.js';

const CONTEXTS = ['remittance_reject', 'remittance_withdraw', 'remittance_cancel', 'remittance_revoke', 'remittance_off_cycle', 'remittance_line_exclude',
  'exception_escalate', 'exception_resolve', 'exception_reopen', 'reconciliation_difference', 'reconciliation_unmatch', 'confirmation_difference',
  'payment_duplicate_override', 'billing_reject', 'billing_cancel'];
const REASONS_SEED = new URL('../src/db/seeds/89_remittance_reasons.sql', import.meta.url);

let ctx;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, { roles, permissions }) {
  let codes = roles;
  if (permissions) {
    const role = `${username.replace(/\./g, '-')}-role`;
    expect((await ctx.api('post', '/roles').send({ code: role, name: role, permissions })).status).toBe(201);
    codes = [role];
  }
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles: codes });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  const call = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  call.id = r.body.data.userId;
  return call;
}

beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('the remittance contexts of the Reason Codes master', () => {
  it('are on the Used For list with their reasons, every Other needing a note; exception_resolve waits for the exception types', async () => {
    const [type] = await q("SELECT fields FROM master_types WHERE code = 'reason-code'");
    const options = type.fields.find((f) => f.name === 'context').options;
    expect(options).toEqual(expect.arrayContaining(['decline', 'period_close', ...CONTEXTS]));
    expect(new Set(options).size).toBe(options.length);
    const counts = Object.fromEntries((await q(`SELECT data->>'context' AS context, count(*)::int AS n FROM master_records
      WHERE type_code = 'reason-code' AND data->>'context' = ANY($1) GROUP BY 1`, [CONTEXTS])).map((r) => [r.context, r.n]));
    expect(counts).toEqual({ remittance_reject: 6, remittance_withdraw: 3, remittance_cancel: 5, remittance_revoke: 4, remittance_off_cycle: 6,
      remittance_line_exclude: 4, exception_escalate: 4, exception_reopen: 3, reconciliation_difference: 6, reconciliation_unmatch: 3,
      confirmation_difference: 5, payment_duplicate_override: 3, billing_reject: 4, billing_cancel: 4 });
    const others = await q(`SELECT data->>'context' AS context, data->'requiresNote' AS note FROM master_records
      WHERE type_code = 'reason-code' AND name = 'Other' AND data->>'context' = ANY($1)`, [CONTEXTS]);
    expect(others.map((o) => o.context).sort()).toEqual(CONTEXTS.filter((c) => !['remittance_off_cycle', 'exception_resolve'].includes(c)).sort());
    expect(others.every((o) => o.note === true)).toBe(true);
    const reject = await q("SELECT name FROM master_records WHERE type_code = 'reason-code' AND data->>'context' = 'remittance_reject' ORDER BY (data->>'sortOrder')::int");
    expect(reject.map((r) => r.name)).toEqual(['Amount differs from insurer terms', 'Proof of payment doubtful', 'Wrong insurer or product line',
      'Rates to be corrected', 'Duplicate', 'Other']);
  });

  it('keeps the administrator changes when the seed runs again', async () => {
    await q("UPDATE master_records SET name = 'Insurer terms differ', status = 'inactive' WHERE type_code = 'reason-code' AND code = 'RRJ-AMOUNT'");
    await q(`UPDATE master_types SET fields = (SELECT jsonb_agg(CASE WHEN f->>'name' = 'context' THEN jsonb_set(f, '{options}', (f->'options') - 'billing_cancel') ELSE f END ORDER BY i)
      FROM jsonb_array_elements(fields) WITH ORDINALITY AS x(f, i)) WHERE code = 'reason-code'`);
    await pool.query(fs.readFileSync(REASONS_SEED, 'utf8'));
    await pool.query(fs.readFileSync(REASONS_SEED, 'utf8'));
    expect(await q("SELECT name, status FROM master_records WHERE type_code = 'reason-code' AND code = 'RRJ-AMOUNT'")).toEqual([{ name: 'Insurer terms differ', status: 'inactive' }]);
    const [type] = await q("SELECT fields FROM master_types WHERE code = 'reason-code'");
    expect(type.fields.find((f) => f.name === 'context').options.filter((o) => o === 'billing_cancel')).toHaveLength(1);
    expect((await q("SELECT count(*)::int AS n FROM master_records WHERE type_code = 'reason-code' AND code LIKE 'RRJ-%'"))[0].n).toBe(6);
    await q("UPDATE master_records SET name = 'Amount differs from insurer terms', status = 'active' WHERE type_code = 'reason-code' AND code = 'RRJ-AMOUNT'");
  });

  it('a decision takes a reason of its own context, with the note an Other needs', async () => {
    const failure = async (promise) => {
      const e = await promise.catch((err) => err);
      expect(e.status).toBe(400);
      return e.details[0];
    };
    expect(await failure(requiredReason(pool, 'remittance_reject', {}))).toMatchObject({ path: 'reasonCode' });
    expect(await failure(requiredReason(pool, 'remittance_reject', { reasonCode: 'BRJ-DUPLICATE' }))).toMatchObject({ path: 'reasonCode' });
    expect(await failure(requiredReason(pool, 'remittance_reject', { reasonCode: 'RRJ-OTHER' }))).toMatchObject({ path: 'note' });
    expect(await requiredReason(pool, 'remittance_reject', { reasonCode: 'rrj-duplicate' })).toEqual({ code: 'RRJ-DUPLICATE', name: 'Duplicate', note: null, text: 'Duplicate' });
    expect(await requiredReason(pool, 'billing_cancel', { reasonCode: 'BCN-OTHER', note: 'Statement sent twice' }))
      .toMatchObject({ code: 'BCN-OTHER', text: 'Other: Statement sent twice' });
  });

  it('remittance users read the reasons without read:masters; changing them stays with masters maintenance', async () => {
    const viewer = await persona('rr.viewer', { permissions: ['read:profile', 'read:remittance'] });
    const res = await viewer('get', '/ops-masters/reason-code?status=Active&context=remittance_withdraw');
    expect(res.status).toBe(200);
    expect(res.body.data.map((r) => r.code).sort()).toEqual(['RWD-CORRECT', 'RWD-OTHER', 'RWD-WEEK']);
    expect((await viewer('post', '/ops-masters/reason-code').send({ code: 'RWD-X', name: 'X', context: 'remittance_withdraw' })).status).toBe(403);
  });
});

describe('the steps of a remittance in its activity log', () => {
  const STEPS = ['create', 'submit', 'withdraw', 'return', 'approve', 'revoke', 'cancel', 'exclude-line', 'include-line', 'recompute', 'raise-voucher',
    'in-payment', 'pay', 'payment-failed', 'send-advice', 'record-confirmation', 'remind', 'import', 'run'];

  it('each of the 19 steps, and the codes of earlier releases, reads as a sentence', () => {
    const titles = Object.fromEntries([...STEPS, 'reject', 'create-agency-bill', 'send-bill', 'settle'].map((a) => [a, actionTitle('remittance', a)]));
    expect(titles).toEqual({
      create: 'Remittance created', submit: 'Remittance submitted', withdraw: 'Remittance withdrawn from approval', return: 'Remittance returned to the maker',
      approve: 'Remittance approved', revoke: 'Remittance approval revoked', cancel: 'Remittance cancelled', 'exclude-line': 'Policy line excluded from the remittance',
      'include-line': 'Policy line included in the remittance again', recompute: 'Remittance recomputed', 'raise-voucher': 'Payment voucher raised for the remittance',
      'in-payment': 'Payment to the insurer started', pay: 'Remittance paid to the insurer', 'payment-failed': 'Payment to the insurer failed',
      'send-advice': 'Remittance advice sent to the insurer', 'record-confirmation': 'Insurer confirmation recorded', remind: 'Reminder sent',
      import: 'Remittance created from an imported policy list', run: 'Remittance created by a remittance run',
      reject: 'Remittance returned to the maker', 'create-agency-bill': 'Agency bill created', 'send-bill': 'Bill sent to the insurer', settle: 'Remittance settled',
    });
    expect(actionTitle('remittance_approval', 'approve')).toBe('Approval given');
  });

  it('the activity log of a remittance shows no raw action code', async () => {
    const c = await ctx.api('post', '/remittance/remittances').send({ insurerCode: 'MALAYAN', period: '2026-09', lines: [{ policyNo: 'EXT-STEPS-1', premium: 1000, commission: 150, tax: 0 }] });
    expect(c.status).toBe(201);
    const id = c.body.data.id;
    // the steps the later screens record, as the audit trail keeps them
    for (const action of [...STEPS.filter((a) => a !== 'create'), 'create-agency-bill', 'send-bill']) {
      await q(`INSERT INTO audit_log(user_id, username, entity, entity_id, action, after_data) SELECT id, username, 'remittance', $1, $2, '{}'::jsonb FROM users WHERE username = 'BrokerVerse'`, [id, action]);
    }
    const log = (await ctx.api('get', `/remittance/remittances/${id}`)).body.data.activityLog;
    expect(log).toHaveLength(STEPS.length + 2);
    expect(log.filter((e) => !e.actionLabel || /-/.test(e.actionLabel) || e.actionLabel === e.actionCode)).toEqual([]);
    expect(log.map((e) => e.actionLabel)).toEqual(expect.arrayContaining(['Remittance created', 'Policy line excluded from the remittance', 'Agency bill created']));
  });
});
