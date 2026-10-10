/**
 * Authority Matrix (Master > Users and Access): the matrix by department with the approval steps that check each
 * transaction, changes of limits through the configuration approval (another administrator holding
 * approve:access-control, never the requester), effective dating, removal as a proposal, authority references, the
 * Excel template and upload (checked as a whole, sent for approval as one change), the exports for audit, My Work, the
 * registry of the approval steps and migration 0394 run twice.
 */
import fs from 'node:fs';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { formatDate } from '../src/lib/pdf/format.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { readWorkbook, readZip } from '../src/modules/documents/xlsx.js';
import { effectiveAuthority } from '../src/modules/access-control/service.js';
import { AUTHORITY_STEPS } from '../src/modules/access-control/authority.js';

const PW = 'Welcome@123';
const REF = { referenceNo: 'BR-2026-014', referenceDate: '2026-09-25' };
let ctx;
let day;
const as = {};
const ids = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const binary = (r) => r.buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });
const setSetting = async (key, value) => { await q('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: PW, displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids[username] = r.body.data.userId;
  const token = await loginAs(ctx.app, username, PW);
  as[username] = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
const matrix = async (who = 'am.it') => {
  const r = await as[who]('get', '/access-control/authority-matrix');
  expect(r.status).toBe(200);
  return r.body.data;
};
const cell = async (type, role) => (await matrix()).rows.find((x) => x.code === type).cells[role];
const propose = (who, lines, extra = {}) => as[who]('post', '/access-control/authority-changes').send({ lines, ...extra });
const decide = (who, id, decision, remarks) => as[who]('post', `/access-control/changes/${id}/decision`).send({ decision, remarks });

/** A filled template as an uploaded file: header row and the rows given. */
const workbook = (rows) => writeXlsx({ sheets: [{ name: 'Data', columns: ['Transaction', 'Role', 'Limit', 'No limit', 'Effective from', 'Authority reference', 'Reference date',
  'Transaction code', 'Role code'].map((header) => ({ header })), rows }] });
const upload = (who, rows) => as[who]('post', '/access-control/authority-matrix/uploads').attach('file', workbook(rows), 'authority.xlsx');

beforeAll(async () => {
  ctx = await setup();
  day = await today();
  for (const [u, roles] of [['am.it', ['tis-it-admin']], ['am.it2', ['tis-it-admin']], ['am.fin', ['tis-finance']], ['am.gm', ['tis-general-manager']]]) await persona(u, roles);
});
afterAll(async () => { await pool.end(); });

describe('the matrix', () => {
  it('lists the TISPH roles by department, flags the base platform roles and says which types each role can approve', async () => {
    const m = await matrix();
    expect(m.departments.map((d) => d.name)).toEqual(['Sales', 'Operations', 'Cash Control', 'Finance and Accounting', 'IT', 'Management']);
    const fin = m.roles.find((r) => r.code === 'tis-finance');
    expect(fin).toMatchObject({ department: 'Finance and Accounting', platform: false });
    expect(fin.approves).toEqual(expect.arrayContaining(['payment_voucher', 'journal_voucher', 'remittance', 'remittance_settlement']));
    expect(m.roles.find((r) => r.code === 'tis-sales-associate').approves).toEqual([]);
    expect(m.roles.find((r) => r.code === 'processing').approves).toContain('underwriting_referral');
    expect(m.roles.find((r) => r.code === 'accounting')).toMatchObject({ platform: true, department: null });
    expect(m.rows.find((r) => r.code === 'journal_voucher')).toMatchObject({ checked: true, step: 'Accounts > Journal Vouchers > Approve' });
    expect(m.rows.find((r) => r.code === 'quotation_discount')).toMatchObject({ checked: false, step: null });
    expect(m).toMatchObject({ withoutLimit: 'allow', referenceRequired: true, asOf: day, abilities: { edit: true, approve: true } });
    expect(m.rows.find((r) => r.code === 'payment_voucher').cells.accounting).toMatchObject({ set: true, maxAmount: 2000000, pending: null });
  });

  it('is read with read:access-control only; changes need write:access-control', async () => {
    expect((await as['am.gm']('get', '/access-control/authority-matrix')).body.data.abilities).toEqual({ edit: false, approve: false });
    expect((await as['am.fin']('get', '/access-control/authority-matrix')).status).toBe(403);
    expect((await propose('am.gm', [{ transactionType: 'journal_voucher', roleCode: 'tis-finance', maxAmount: 1, ...REF }])).status).toBe(403);
    expect((await as['am.gm']('post', '/access-control/authority-matrix/uploads').attach('file', workbook([]), 'a.xlsx')).status).toBe(403);
    const html = await as['am.it']('post', '/access-control/authority-matrix/uploads').attach('file', Buffer.from('Transaction,Role\n'), 'm.html');
    expect(html.status).toBe(400);
    expect(html.body.errors[0].message).toMatch(/\.xlsx.*\.csv/);
  });

  it('every transaction type an approval step checks is in the registry', () => {
    const files = ['journal-vouchers/service.js', 'quotations/service.js', 'disbursements/service.js', 'claims/service.js', 'integrations/bankfiles/batches.js', 'remittance/service.js'];
    const used = new Set();
    for (const f of files) {
      const src = fs.readFileSync(new URL(`../src/modules/${f}`, import.meta.url), 'utf8');
      for (const m of src.matchAll(/assertAuthority\([^,]+,\s*[^,]+,\s*'([a-z_]+)'/g)) used.add(m[1]);
      if (src.includes('authorityTypeOf(')) ['remittance', 'remittance_settlement'].forEach((t) => used.add(t));
    }
    expect(used.size).toBeGreaterThan(4);
    for (const t of used) expect(AUTHORITY_STEPS[t], t).toBeTruthy();
  });
});

describe('a change of one limit', () => {
  let changeId;
  it('checks the line: reference, effective date, percent, negative amount and a change that changes nothing', async () => {
    const line = { transactionType: 'journal_voucher', roleCode: 'tis-finance', maxAmount: 1000000 };
    const noRef = await propose('am.it', [line]);
    expect(noRef.status).toBe(400);
    expect(noRef.body.errors.map((e) => e.path)).toEqual(['lines.0.referenceNo', 'lines.0.referenceDate']);
    expect((await propose('am.it', [{ ...line, ...REF, effectiveFrom: addDays(day, -1) }])).body.errors[0]).toMatchObject({ path: 'lines.0.effectiveFrom' });
    expect((await propose('am.it', [{ ...line, ...REF, referenceDate: addDays(day, 3) }])).body.errors[0]).toMatchObject({ path: 'lines.0.referenceDate' });
    expect((await propose('am.it', [{ transactionType: 'quotation_discount', roleCode: 'tis-sales-officer', maxAmount: 120, ...REF }])).body.errors[0].message).toMatch(/over 100/);
    expect((await propose('am.it', [{ ...line, maxAmount: -5, ...REF }])).body.errors[0].message).toMatch(/negative/);
    expect((await propose('am.it', [{ transactionType: 'payment_voucher', roleCode: 'accounting', maxAmount: 2000000, ...REF }])).body.errors[0].message).toMatch(/No change/);
    await setSetting('access.authority_reference_required', false);
    const optional = await propose('am.it', [{ transactionType: 'write_off', roleCode: 'tis-finance', maxAmount: 500 }]);
    expect(optional.status).toBe(201);
    expect((await as['am.it']('post', `/access-control/changes/${optional.body.data.id}/withdraw`)).status).toBe(200);
    await setSetting('access.authority_reference_required', true);
  });

  it('waits for another administrator: the requester and a user without approve:access-control are refused', async () => {
    const r = await propose('am.it', [{ transactionType: 'journal_voucher', roleCode: 'tis-finance', maxAmount: 1000000, ...REF }], { remarks: 'Signing authority 2026' });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    changeId = r.body.data.id;
    expect(r.body.data).toMatchObject({ kind: 'authority-limits', status: 'pending', targetLabel: 'Journal voucher approval · TIS Finance & General Accounting', canDecide: false, canWithdraw: true });
    expect(r.body.data.summary[0]).toMatch(/Not set → PHP 1,000,000.00 from .* \(BR-2026-014\)/);
    const c = await cell('journal_voucher', 'tis-finance');
    expect(c).toMatchObject({ set: false, pending: { ref: `CFG-${changeId}`, maxAmount: 1000000, canDecide: false, canWithdraw: true } });
    const notice = await q("SELECT * FROM notifications WHERE entity = 'accounting_config_change' AND entity_id = $1 AND type = 'approval'", [String(changeId)]);
    expect(notice).toHaveLength(1);
    expect(notice[0].message).toMatch(/proposed a change of the Authority Matrix/);
    expect((await decide('am.it', changeId, 'approve')).status).toBe(403);
    expect((await decide('am.gm', changeId, 'approve')).status).toBe(403);
    expect((await propose('am.it2', [{ transactionType: 'journal_voucher', roleCode: 'tis-finance', maxAmount: 5, ...REF }])).status).toBe(409);
    const legacy = await as['am.it2']('post', '/access-control/authority-limits').send({ transactionType: 'journal_voucher', roleCode: 'tis-finance', maxAmount: 5, ...REF });
    expect(legacy.status).toBe(409);
    const items = (await as['am.it2']('get', '/my-work/items?category=approvals')).body.data;
    expect(items.find((i) => i.ref === `CFG-${changeId}`)).toMatchObject({ kind: 'Authority matrix change', title: 'Journal voucher approval · TIS Finance & General Accounting' });
    expect((await as['am.it']('get', '/my-work/items?category=approvals')).body.data.map((i) => i.ref)).not.toContain(`CFG-${changeId}`);
    // an approver rejects with a reason; only the requester withdraws
    expect((await as['am.it2']('post', `/access-control/changes/${changeId}/withdraw`)).status).toBe(403);
  });

  it('refuses an approver who holds the role whose limit changes', async () => {
    const r = await propose('am.it', [{ transactionType: 'write_off', roleCode: 'tis-it-admin', maxAmount: 1000, ...REF }]);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await as['am.it2']('get', `/access-control/changes/${r.body.data.id}`)).body.data.canDecide).toBe(false);
    const refused = await decide('am.it2', r.body.data.id, 'approve');
    expect(refused.status).toBe(403);
    expect(refused.body.message).toMatch(/role you hold/);
    expect((await as['am.it']('post', `/access-control/changes/${r.body.data.id}/withdraw`)).status).toBe(200);
  });

  it('applies when approved, with the reference and the change it came from', async () => {
    const r = await decide('am.it2', changeId, 'approve');
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toMatch(/approval limit of .* is changed/);
    expect(await cell('journal_voucher', 'tis-finance')).toMatchObject({ set: true, maxAmount: 1000000, effectiveFrom: day, referenceNo: 'BR-2026-014', changeId, approvedBy: 'am.it2', pending: null });
    const fin = await q("SELECT id FROM users WHERE username = 'am.fin'");
    expect(await effectiveAuthority(pool, fin[0].id, 'journal_voucher')).toMatchObject({ found: true, limit: 1000000 });
    const audit = await q("SELECT action FROM audit_log WHERE entity = 'authority_limit' AND entity_id = $1", [`CFG-${changeId}`]);
    expect(audit.map((a) => a.action)).toEqual(['apply']);
  });

  it('a rejection needs a reason', async () => {
    const r = await propose('am.it', [{ transactionType: 'payment_voucher', roleCode: 'tis-finance', unlimited: true, ...REF }]);
    expect((await decide('am.it2', r.body.data.id, 'reject')).status).toBe(400);
    expect((await decide('am.it2', r.body.data.id, 'reject', 'Not per the resolution')).body.data).toMatchObject({ status: 'rejected', decisionRemarks: 'Not per the resolution' });
    expect((await cell('payment_voucher', 'tis-finance')).set).toBe(false);
  });
});

describe('effective dating and removal', () => {
  it('a future-dated limit leaves the limit in effect until the day before', async () => {
    const from = addDays(day, 5);
    const r = await propose('am.it', [{ transactionType: 'journal_voucher', roleCode: 'tis-finance', maxAmount: 2500000, effectiveFrom: from, ...REF }]);
    expect((await decide('am.it2', r.body.data.id, 'approve')).status).toBe(200);
    const c = await cell('journal_voucher', 'tis-finance');
    expect(c).toMatchObject({ maxAmount: 1000000, endsOn: addDays(from, -1), scheduled: { maxAmount: 2500000, effectiveFrom: from } });
    const fin = ids['am.fin'];
    expect(await effectiveAuthority(pool, fin, 'journal_voucher', addDays(from, -1))).toMatchObject({ limit: 1000000 });
    expect(await effectiveAuthority(pool, fin, 'journal_voucher', from)).toMatchObject({ limit: 2500000 });
  });

  it('a removal is a proposal that applies only once another administrator approves it', async () => {
    const before = await cell('write_off', 'accounting');
    expect(before.set).toBe(true);
    expect((await as['am.it']('delete', `/access-control/authority-limits/${before.limitId}`).send({})).status).toBe(400);
    const r = await as['am.it']('delete', `/access-control/authority-limits/${before.limitId}`).send(REF);
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect((await cell('write_off', 'accounting'))).toMatchObject({ set: true, pending: { removes: true } });
    expect((await decide('am.it', r.body.data.id, 'approve')).status).toBe(403);
    expect((await decide('am.it2', r.body.data.id, 'approve')).status).toBe(200);
    expect((await cell('write_off', 'accounting'))).toMatchObject({ set: false, pending: null });
  });

  it('a proposal of the API is withdrawn by its proposer and rejected only with a note', async () => {
    const p = await as['am.it']('post', '/access-control/authority-limits').send({ transactionType: 'claim_settlement', roleCode: 'tis-ops-unit-head', maxAmount: 300000, ...REF });
    expect(p.status).toBe(201);
    expect((await as['am.it2']('post', `/access-control/authority-limits/${p.body.data.id}/decision`).send({ decision: 'reject' })).status).toBe(400);
    expect((await as['am.it']('delete', `/access-control/authority-limits/${p.body.data.id}`)).body.data.status).toBe('withdrawn');
  });

  it('nobody approves a change of their own personal limit', async () => {
    const r = await propose('am.it', [{ transactionType: 'payment_voucher', userId: ids['am.it2'], maxAmount: 50000, ...REF }]);
    expect(r.status).toBe(201);
    expect((await decide('am.it2', r.body.data.id, 'approve')).status).toBe(403);
    expect((await ctx.api('post', `/access-control/changes/${r.body.data.id}/decision`).send({ decision: 'approve' })).status).toBe(200);
    expect((await matrix()).userLimits.find((p) => p.userId === ids['am.it2'])).toMatchObject({ transactionType: 'payment_voucher', maxAmount: 50000, set: true });
  });
});

describe('upload', () => {
  it('the template is the matrix with drop-down lists and the rules', async () => {
    const r = await binary(as['am.gm']('get', '/access-control/authority-matrix/template'));
    expect(r.status).toBe(200);
    const sheets = readWorkbook(r.body);
    expect(sheets.map((s) => s.name)).toEqual(['Data', 'Lists', 'Instructions']);
    expect(sheets[0].rows[0].slice(0, 7)).toEqual(['Transaction', 'Role', 'Department', 'Measure', 'In effect', 'Limit', 'No limit']);
    const jv = sheets[0].rows.find((x) => x[11] === 'journal_voucher' && x[12] === 'tis-finance');
    expect(jv.slice(0, 7)).toEqual(['Journal voucher approval', 'TIS Finance & General Accounting', 'Finance and Accounting', 'Amount in PHP', 'PHP 1,000,000.00', '1000000', 'No']);
    expect(sheets[0].rows.some((x) => x[12] === 'accounting')).toBe(false);
    expect(sheets[0].rows.some((x) => x[11] === 'quotation_discount')).toBe(false);
    const base = readWorkbook((await binary(as['am.gm']('get', '/access-control/authority-matrix/template?base=1'))).body);
    expect(base[0].rows.some((x) => x[12] === 'accounting' && x[11] === 'payment_voucher')).toBe(true);
    expect(base[0].rows.some((x) => x[11] === 'quotation_discount')).toBe(false);
    const every = readWorkbook((await binary(as['am.gm']('get', '/access-control/authority-matrix/template?unchecked=1&all=1'))).body);
    expect(every[0].rows.some((x) => x[12] === 'tis-sales-associate' && x[11] === 'quotation_discount')).toBe(true);
    const data = String(readZip(r.body).get('xl/worksheets/sheet1.xml'));
    expect(data).toContain('<formula1>Lists!$B$2:$B$');
  });

  it('checks the whole file and saves nothing when a row is wrong', async () => {
    const docs = (await q('SELECT count(*)::int AS n FROM documents'))[0].n;
    const r = await upload('am.it', [
      ['Journal voucher approval', 'Unknown role', '5', '', '', 'BR-1', '2026-01-01', '', ''],
      ['', '', '120', '', '', 'BR-1', '2026-01-01', 'quotation_discount', 'tis-sales-officer'],
      ['', '', '100', 'Yes', '', 'BR-1', '2026-01-01', 'remittance', 'tis-finance'],
      ['', '', '', '', '', '', '', 'journal_voucher', 'tis-finance'],
      ['', '', '700', '', addDays(day, -2), 'BR-1', '2026-01-01', 'remittance', 'tis-ccd-recon'],
      ['', '', '800', '', '', 'BR-1', '2026-01-01', 'claim_settlement', 'tis-ops-unit-head'],
      ['', '', '900', '', '', 'BR-1', '2026-01-01', 'claim_settlement', 'tis-ops-unit-head'],
      ['', '', '900', '', '', '', '', 'claim_settlement', 'tis-general-manager'],
    ]);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ created: 0, updated: 0, file: null });
    expect(r.body.message).toBe('Checked 8 rows: 8 errors. Nothing was saved.');
    const byRow = {};
    r.body.data.errors.forEach((e) => { byRow[e.row] = [byRow[e.row], e.message].filter(Boolean).join(' | '); });
    expect(byRow[2]).toMatch(/Role "Unknown role" is unknown/);
    expect(byRow[3]).toMatch(/Limit: A percent limit cannot be over 100/);
    expect(byRow[4]).toMatch(/not both/);
    expect(byRow[5]).toMatch(/removed on the Authority Matrix screen/);
    expect(byRow[6]).toMatch(/Effective from: The effective date cannot be in the past/);
    expect(byRow[8]).toMatch(/already on row 7/);
    expect(byRow[9]).toMatch(/Authority reference: Enter the authority reference/);
    expect((await q('SELECT count(*)::int AS n FROM documents'))[0].n).toBe(docs);
  });

  it('a valid file goes for approval as one change and applies all its lines at once', async () => {
    const rows = [
      ['', '', '1,000,000.00', 'No', '', 'BR-2026-020', '2026-10-01', 'journal_voucher', 'tis-finance'],
      ['Remittance approval', 'CCD-Recon (Reconciliation)', '750000', '', '', 'BR-2026-020', '2026-10-01', '', ''],
      ['', '', '', 'Yes', '', 'BR-2026-020', '2026-10-01', 'claim_settlement', 'tis-general-manager'],
      ['', '', '400000', '', '', 'BR-2026-020', '2026-10-01', 'claim_settlement', 'tis-ops-unit-head'],
      ['', '', '', '', '', '', '', 'payment_voucher', 'tis-finance'],
    ];
    const recon = (await matrix()).roles.find((x) => x.code === 'tis-ccd-recon');
    rows[1][1] = recon.name;
    const r = await upload('am.it', rows);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.message).toBe('Checked 5 rows: 3 changes ready to review, 2 unchanged.');
    expect(r.body.data.changes.map((c) => [c.row, c.transactionType, c.roleCode, c.maxAmount, c.unlimited])).toEqual([
      [3, 'remittance', 'tis-ccd-recon', 750000, false], [4, 'claim_settlement', 'tis-general-manager', null, true], [5, 'claim_settlement', 'tis-ops-unit-head', 400000, false]]);
    const file = r.body.data.file;
    expect(file.key).toMatch(/^authority-matrix\//);
    expect((await as['am.it2']('post', '/access-control/authority-changes').send({ lines: r.body.data.changes, file })).status).toBe(400);
    const sent = await as['am.it']('post', '/access-control/authority-changes').send({ lines: r.body.data.changes, file, rowsRead: 5, unchanged: 2, remarks: 'Board resolution 2026-020' });
    expect(sent.status, JSON.stringify(sent.body)).toBe(201);
    const c = sent.body.data;
    expect(c).toMatchObject({ target: 'upload', targetLabel: '3 approval limits · authority.xlsx', payload: { source: 'upload', rowsRead: 5, unchanged: 2 } });
    expect(await q("SELECT entity, entity_id FROM documents WHERE storage_key = $1", [file.key])).toEqual([{ entity: 'accounting_config_change', entity_id: String(c.id) }]);
    expect(await q("SELECT id FROM notifications WHERE entity = 'accounting_config_change' AND entity_id = $1 AND type = 'approval'", [String(c.id)])).toHaveLength(1);
    expect((await cell('claim_settlement', 'tis-ops-unit-head')).pending).toMatchObject({ ref: c.ref, lines: 3 });
    expect((await upload('am.it', [['', '', '1', '', '', 'BR-1', '2026-01-01', 'remittance', 'tis-ccd-recon']])).body.data.errors[0].message).toMatch(new RegExp(`waiting for approval \\(${c.ref}\\)`));
    expect((await decide('am.it', c.id, 'approve')).status).toBe(403);
    const approved = await decide('am.it2', c.id, 'approve');
    expect(approved.status, JSON.stringify(approved.body)).toBe(200);
    expect(approved.body.message).toMatch(/3 approval limits are changed/);
    const m = await matrix();
    const at = (type, role) => m.rows.find((x) => x.code === type).cells[role];
    expect(at('remittance', 'tis-ccd-recon')).toMatchObject({ set: true, maxAmount: 750000, referenceNo: 'BR-2026-020', changeId: c.id });
    expect(at('claim_settlement', 'tis-general-manager')).toMatchObject({ set: true, unlimited: true });
    expect(at('claim_settlement', 'tis-ops-unit-head')).toMatchObject({ set: true, maxAmount: 400000 });
  });
});

describe('exports for audit', () => {
  it('downloads the matrix and the change history as Excel and CSV', async () => {
    const x = await binary(as['am.gm']('get', '/access-control/authority-matrix?format=xlsx'));
    expect(x.status).toBe(200);
    const rows = readWorkbook(x.body)[0].rows;
    const header = rows.findIndex((r) => r[0] === 'Department');
    expect(rows[header].slice(0, 7)).toEqual(['Department', 'Role', 'Base platform role', 'Transaction', 'Checked at', 'Measure', 'Limit in effect']);
    expect(rows.find((r) => r[1] === 'TIS Finance & General Accounting' && r[3] === 'Journal voucher approval').slice(6, 10))
      .toEqual(['PHP 1,000,000.00', formatDate(day), formatDate(addDays(day, 4)), 'BR-2026-014']);
    const csv = await as['am.gm']('get', '/access-control/authority-matrix?format=csv');
    expect(csv.text).toContain('Base platform roles,Accounting,Yes,Journal voucher approval');
    const history = await as['am.gm']('get', '/access-control/authority-limits?status=all&format=csv');
    expect(history.status).toBe(200);
    expect(history.text).toMatch(/Journal voucher approval,TIS Finance & General Accounting,"PHP 2,500,000.00",.*,Scheduled,BR-2026-014/);
    const list = (await as['am.gm']('get', '/access-control/authority-limits?status=all')).body.data;
    expect(list.find((l) => l.transactionType === 'write_off' && l.roleCode === 'accounting').statusLabel).toBe('Retired');
    expect((await q("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'authority_limit' AND action = 'export'"))[0].n).toBe(3);
  });
});

describe('migration 0394 on a database in use', () => {
  it('changes nothing when run again', async () => {
    const state = async () => ({
      setting: await q("SELECT value FROM app_settings WHERE key = 'access.authority_reference_required'"),
      limits: await q('SELECT id, status, reference_no, change_id FROM authority_limits ORDER BY id'),
    });
    const first = await state();
    await pool.query(fs.readFileSync(new URL('../src/db/migrations/0394_authority_matrix_changes.sql', import.meta.url), 'utf8'));
    expect(await state()).toEqual(first);
  });
});
