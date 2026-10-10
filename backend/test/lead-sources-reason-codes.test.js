/**
 * Lead sources (Pre-BSM M07) and reason codes (M24): the masters and their TISPH values (seeds 77 and 83); the Source
 * of a prospect (form, API, upload) taken from the Lead Source master, free text kept unless leads.source_list_only;
 * coded reasons on a claim repudiation, a renewal lapse and a declined or dropped quotation, free text still accepted.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';

let ctx;
const as = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  await persona('ls.sales', ['tis-sales-officer']);
  await persona('ls.ops', ['tis-ops-unit-head']);
});
afterAll(async () => { await pool.end(); });

describe('masters', () => {
  it('ships the 14 TISPH lead sources, the 32 reason codes without a master of their own and the 8 reassignment reasons', async () => {
    const sources = await q("SELECT code, name, data FROM master_records WHERE type_code = 'lead-source' AND status = 'active' ORDER BY (data->>'sortOrder')::int");
    expect(sources).toHaveLength(14);
    expect(sources[0]).toMatchObject({ code: 'CL', name: 'Call', data: { channelType: 'Direct', branchCode: 'HO' } });
    expect(sources.map((s) => s.code)).toContain('UCFP');
    // the reasons of the accounting decisions (seed 88) are counted in accounting-reasons.test.js, those of the remittance
    // decisions (seed 89) in remittance-authority.test.js, the invoice cancellations (seed 89) in bir-forms.test.js,
    // those of access decisions (seeds 91) in role-permissions.test.js and access-screens.test.js
    const reasons = await q(`SELECT data->>'context' AS context, count(*)::int AS n FROM master_records WHERE type_code = 'reason-code'
      AND data->>'context' NOT IN ('period_close', 'period_reopen', 'year_end_reverse', 'year_end_cancel', 'cas_print_void', 'cas_document_change', 'incentive_batch_reject',
      'incentive_adjustment', 'sales_invoice_cancel', 'invoice_payment_cancel', 'access_change', 'delegation', 'delegation_end', 'sod_exception', 'access_review')
      AND data->>'context' !~ '^(remittance|exception|reconciliation|confirmation|payment|billing|feature)_' GROUP BY 1 ORDER BY 1`);
    expect(reasons).toEqual([{ context: 'adjustment', n: 1 }, { context: 'decline', n: 10 }, { context: 'lapse', n: 6 }, { context: 'non-materialise', n: 1 },
      { context: 'reassignment', n: 8 }, { context: 'refund', n: 1 }, { context: 'repudiation', n: 13 }]);
    const type = (await q("SELECT fields FROM master_types WHERE code = 'reason-code'"))[0];
    expect(type.fields.find((f) => f.name === 'context').options).toContain('reassignment');
    expect(await q("SELECT 1 FROM master_records WHERE type_code = 'reason-code' AND code LIKE 'CAN-%'")).toEqual([]);
  });

  it('the teams read them through their module; only masters maintenance changes them', async () => {
    expect((await as['ls.sales']('get', '/ops-masters/lead-source')).body.data).toHaveLength(14);
    expect((await as['ls.ops']('get', '/ops-masters/reason-code')).status).toBe(200);
    expect((await as['ls.sales']('post', '/ops-masters/lead-source').send({ code: 'X', name: 'X' })).status).toBe(403);
    expect((await as['ls.ops']('post', '/ops-masters/reason-code').send({ code: 'X', name: 'X', context: 'lapse' })).status).toBe(403);
    const added = await ctx.api('post', '/ops-masters/reason-code').send({ code: 'LAP-PRICE', name: 'Cheaper elsewhere', context: 'lapse', requiresNote: false });
    expect(added.status).toBe(201);
  });
});

describe('the Source of a prospect', () => {
  it('is matched to the Lead Source master by code or name and stored as its name; an unknown source is kept unless the list is enforced', async () => {
    const lead = (body) => as['ls.sales']('post', '/leads').send({ firstName: 'Source', lastName: 'Test', emailId: 'source@example.ph', contactNumber: '09170002222', ...body });
    expect((await lead({ source: 'ucfp' })).body.source).toBe('Used-Cars - UCFP');
    expect((await lead({ source: 'walk-in' })).body.source).toBe('Walk-In');
    const typed = await lead({ source: 'Radio ad' });
    expect(typed.body.source).toBe('Radio ad');
    await q("UPDATE app_settings SET value = 'true' WHERE key = 'leads.source_list_only'");
    clearSettingsCache();
    const refused = await lead({ source: 'Radio ad' });
    expect(refused.status).toBe(400);
    expect(refused.body.errors[0].path).toBe('source');
    expect((await as['ls.sales']('put', `/leads/${typed.body.leadId}`).send({ source: 'WEB' })).body.source).toBe('Social Media / Website');
    // the lead upload: the source by code; an empty source stays bulk-upload
    const csv = 'First Name,Last Name,Email,Contact Number,Source\nUp,One,up.one@example.ph,09170003333,REF\nUp,Two,up.two@example.ph,09170004444,\nUp,Three,up.three@example.ph,09170005555,Billboard\n';
    const up = await as['ls.sales']('post', '/leads/bulk-upload').attach('file', Buffer.from(csv), 'leads.csv');
    expect(up.body.data).toMatchObject({ total: 3, created: 2, failed: 1 });
    expect(up.body.data.errors[0]).toMatchObject({ row: 4 });
    const stored = await q("SELECT last_name, source FROM leads WHERE first_name = 'Up' ORDER BY last_name");
    expect(stored).toEqual([{ last_name: 'One', source: 'Referral' }, { last_name: 'Two', source: 'bulk-upload' }]);
    await q("UPDATE app_settings SET value = 'false' WHERE key = 'leads.source_list_only'");
    clearSettingsCache();
  });
});

describe('coded reasons', () => {
  it('a claim repudiation takes a repudiation code with its note; free text still works', async () => {
    const noNote = await as['ls.ops']('put', '/claims/rejectclaim/clm_crs_02').send({ reasonCode: 'REP-NOTCOVERED' });
    expect(noNote.status).toBe(400);
    expect(noNote.body.errors[0].path).toBe('reason');
    const wrong = await as['ls.ops']('put', '/claims/rejectclaim/clm_crs_02').send({ reasonCode: 'LAP-FUNDS', reason: 'x' });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors[0].path).toBe('reasonCode');
    const r = await as['ls.ops']('put', '/claims/rejectclaim/clm_crs_02').send({ reasonCode: 'rep-notcovered', reason: 'Flood excluded' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ rejectedReason: 'Cause of Loss Not Covered: Flood excluded', rejectedReasonCode: 'REP-NOTCOVERED' });
    const typed = await as['ls.ops']('put', '/claims/updatestatus/clm_crs_03').send({ claimStatus: 'rejected', note: 'Insurer declined the claim' });
    expect(typed.status).toBe(200);
    expect((await q("SELECT rejected_reason, rejected_reason_code FROM claims WHERE id = 'clm_crs_03'"))[0]).toEqual({ rejected_reason: 'Insurer declined the claim', rejected_reason_code: null });
  });

  it('a renewal lapse takes a lapse code; a code that needs no note may come alone', async () => {
    const r = await as['ls.ops']('post', '/renewals/rnw_crs_11/lapse').send({ reasonCode: 'LAP-PRICE' });
    expect(r.status).toBe(200);
    expect((await q("SELECT lapse_reason, lapse_reason_code FROM renewals WHERE id = 'rnw_crs_11'"))[0]).toEqual({ lapse_reason: 'Cheaper elsewhere', lapse_reason_code: 'LAP-PRICE' });
    expect((await as['ls.ops']('post', '/renewals/rnw_crs_16/lapse').send({})).status).toBe(400);
    const typed = await as['ls.ops']('post', '/renewals/rnw_crs_16/lapse').send({ reason: 'Client moved to another broker' });
    expect(typed.status).toBe(200);
  });

  it('a dropped quotation takes a decline or non-materialise code, kept in the audit trail', async () => {
    const bad = await as['ls.sales']('patch', '/quotations/qt_sls_09/status').send({ status: 'Dropped', reasonCode: 'REP-LATE', reason: 'x' });
    expect(bad.status).toBe(400);
    const r = await as['ls.sales']('patch', '/quotations/qt_sls_09/status').send({ status: 'Dropped', reasonCode: 'DEC-WDREW', reason: 'Bought elsewhere' });
    expect(r.status).toBe(200);
    const [trail] = await q("SELECT after_data AS after FROM audit_log WHERE entity = 'quotation' AND entity_id = 'qt_sls_09' AND action = 'status' ORDER BY id DESC LIMIT 1");
    expect(trail.after).toMatchObject({ quotationStatus: 'Dropped', reason: 'Customer Withdrew Application: Bought elsewhere', reasonCode: 'DEC-WDREW' });
  });
});
