/**
 * Accounts > Remittance > Remittances > Import policy list: the template (Data, Columns, Instructions), the limits, the
 * validation of a file with a result per row (the file selects policies, the amounts are the system's), the commit
 * into off-cycle drafts from the ready rows only, the error report, the same committed file refused, a policy
 * remitted meanwhile skipped, discard and expiry, and the permissions.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';

let ctx;
const people = {};
const ins = {};
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const binary = (r) => r.buffer(true).parse((res, cb) => { const b = []; res.on('data', (c) => b.push(c)); res.on('end', () => cb(null, Buffer.concat(b))); });
const HEADER = ['Policy No', 'Insurer Code', 'Product Line', 'Expected Due to Insurer', 'Insurer Reference', 'Remark'];
const csv = (rows, header = HEADER) => Buffer.from([header, ...rows].map((r) => r.join(',')).join('\r\n'));

async function persona(key, username, displayName, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles });
  expect(r.status, username).toBe(201);
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  const call = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
  call.id = r.body.data.userId;
  people[key] = call;
}

/** An issued policy of the insurer: premium 10,000 + n, commission 1,500, taxes 0, so 8,500 + n is due to the insurer. */
async function policy(no, insurer, { product = 'MOTOR', status = 'issued', billingMode = 'broker', n = 0 } = {}) {
  const [p] = await q(`INSERT INTO policies(policy_number, client_id, product_id, insurance_company_id, status, inception_date, expiry_date, premium_total, commission_amount, billing_mode, sum_insured)
    VALUES ($1, (SELECT id FROM clients ORDER BY id LIMIT 1), (SELECT id FROM products WHERE code = $2), $3, $4, DATE '2026-10-01', DATE '2027-10-01', $5, 1500, $6, 850000) RETURNING id`,
  [no, product, insurer, status, 10000 + n, billingMode]);
  return p.id;
}
const validate = (who, buffer, name = 'list.csv', purpose = 'ROC-GOLIVE') => people[who]('post', '/remittance/imports/validate').field('purposeCode', purpose).attach('file', buffer, name);

beforeAll(async () => {
  ctx = await setup();
  for (const [key, code, name] of [['a', 'IMPA', 'Import Alpha Insurance Corp.'], ['b', 'IMPB', 'Import Beta Insurance Corp.']]) {
    [ins[key]] = await q("INSERT INTO insurance_companies(code, name, short_name, status) VALUES ($1, $2, $3, 'active') RETURNING id, code", [code, name, name.split(' ').slice(0, 2).join(' ')]);
  }
  await persona('maker', 'imp.maker', 'M. Reyes', ['tis-finance']);
  await persona('recon', 'imp.recon', 'C. Recon', ['tis-ccd-recon']);
  await persona('gm', 'imp.gm', 'A. Tan', ['tis-general-manager']);
});
afterAll(async () => { await pool.end(); });

describe('template and limits', () => {
  it('downloads the 3-sheet template; the Columns sheet lists the active insurer codes and the other accepted headers', async () => {
    const r = await binary(people.maker('get', '/remittance/imports/template'));
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toContain('Remittance_Policy_List_Template.xlsx');
    const sheets = readWorkbook(r.body);
    expect(sheets.map((s) => s.name)).toEqual(['Data', 'Columns', 'Instructions']);
    expect(sheets[0].rows[0]).toEqual(HEADER);
    expect(sheets[0].rows.slice(1).map((row) => row[0])).toEqual(['TISPH-PC-0001234', 'TISPH-PC-0001235']);
    const cols = sheets[1].rows;
    expect(cols[0]).toEqual(['Column', 'Required', 'Format', 'Allowed values', 'Example', 'Other accepted headers']);
    const insurer = cols.find((c) => c[0] === 'Insurer Code');
    const active = (await q("SELECT code FROM insurance_companies WHERE status = 'active' AND code IS NOT NULL")).map((x) => x.code);
    expect(insurer[3].split(', ').sort()).toEqual(active.sort());
    expect(insurer[3]).not.toContain('AIG');
    expect(cols.find((c) => c[0] === 'Policy No')).toEqual(expect.arrayContaining(['Yes', expect.stringContaining('Policy Number')]));
    expect(cols.find((c) => c[0] === 'Product Line')[3]).toBe('Motor, Personal Accident, Credit Life, Marine');
    const text = sheets[2].rows.map((row) => row.join(' ')).join('\n');
    for (const point of ['1. Use this file for go-live opening remittances', '2. Fill the Data sheet', '3. Amounts are computed by BrokerVerse', '4. Policies not fully paid are listed as Held',
      '5. Limits: .xlsx or .csv; at most 10 MB (IMPORT_MAX_MB) and 5,000 rows.', '6. The drafts still need Submit for approval']) expect(text).toContain(point);
  });

  it('answers the limits of the dialog', async () => {
    const r = await people.maker('get', '/remittance/imports/limits');
    expect(r.body.data).toEqual({ maxBytes: 10485760, maxMb: 10, maxRows: 5000, fileTypes: ['.xlsx', '.csv'], message: 'Choose an .xlsx or .csv file of at most 10 MB.' });
  });

  it('refuses a 12 MB file, another file type, a missing column, too many rows and a purpose that is not an off-cycle reason', async () => {
    const big = await validate('maker', Buffer.alloc(12 * 1048576, 65), 'big.xlsx');
    expect(big.status).toBe(400);
    expect(big.body).toMatchObject({ message: 'Choose an .xlsx or .csv file of at most 10 MB.', errors: [{ code: 'FILE_TOO_LARGE' }] });
    const txt = await validate('maker', Buffer.from('Policy No\nX'), 'list.txt');
    expect(txt.body.errors[0]).toMatchObject({ code: 'FILE_TYPE', message: 'Choose an .xlsx or .csv file of at most 10 MB.' });
    const header = await validate('maker', csv([['IMPA', 'Motor']], ['Insurer Code', 'Product Line']));
    expect(header.status).toBe(400);
    expect(header.body).toMatchObject({ message: 'Column Policy No not found.', errors: [{ code: 'HEADER_MISSING' }] });
    await q("UPDATE app_settings SET value = '3' WHERE key = 'remittance.import_max_rows'");
    const { clearSettingsCache } = await import('../src/lib/settings.js');
    clearSettingsCache();
    const many = await validate('maker', csv([['A', 'IMPA'], ['B', 'IMPA'], ['C', 'IMPA'], ['D', 'IMPA']]));
    expect(many.body).toMatchObject({ message: 'The file has 4 rows; at most 3 rows are accepted.', errors: [{ code: 'TOO_MANY_ROWS' }] });
    await q("UPDATE app_settings SET value = '5000' WHERE key = 'remittance.import_max_rows'");
    clearSettingsCache();
    const purpose = await validate('maker', csv([['A', 'IMPA']]), 'list.csv', 'RRJ-RATES');
    expect(purpose.status).toBe(400);
    expect(purpose.body.errors[0].path).toBe('reasonCode');
    expect((await q('SELECT count(*)::int AS n FROM remittance_imports'))[0].n).toBe(0);
  });

  it('validating and committing need write:remittance', async () => {
    expect((await validate('gm', csv([['A', 'IMPA']]))).status).toBe(403);
    expect((await people.gm('get', '/remittance/imports/template')).status).toBe(200);
  });
});

describe('a file of 52 rows: 46 ready, 6 not', () => {
  let imp;
  let buffer;
  const variance = new Map();
  beforeAll(async () => {
    const rows = [];
    for (let i = 1; i <= 40; i += 1) {
      const no = `TISPH-PC-IA-${String(i).padStart(4, '0')}`;
      await policy(no, ins.a.id, { n: i });
      // rows 1-4 expect a different amount (variance), row 5 a difference within PHP 1.00
      const expected = i <= 4 ? 8500 + i + 54 : i === 5 ? 8500 + i + 0.5 : '';
      if (expected !== '') variance.set(no, expected);
      rows.push([no, 'IMPA', 'Motor', expected, i === 1 ? 'SOA-IA-1' : '', i === 1 ? 'Opening' : '']);
    }
    for (let i = 1; i <= 4; i += 1) {
      const no = `TISPH-PA-IA-${String(i).padStart(4, '0')}`;
      await policy(no, ins.a.id, { product: 'PA', n: 100 + i });
      rows.push([no, 'impa', 'Personal Accident', '', '', '']);
    }
    for (let i = 1; i <= 2; i += 1) {
      const no = `TISPH-PC-IB-${String(i).padStart(4, '0')}`;
      await policy(no, ins.b.id, { n: 200 + i });
      rows.push([no, 'IMPB', '', '', '', '']);
    }
    await policy('TISPH-PC-IX-CANCEL', ins.a.id, { status: 'cancelled' });
    await policy('TISPH-PC-IX-DIRECT', ins.a.id, { billingMode: 'direct' });
    const onRem = await policy('TISPH-PC-IX-ONREM', ins.a.id);
    const rem = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'IMPA', lines: [{ policyId: onRem }] });
    expect(rem.status).toBe(201);
    rows.push(['TISPH-PC-IX-NOPE', 'IMPA', '', '', '', ''], ['TISPH-PC-IB-0001', 'IMPA', '', '', '', ''], ['TISPH-PC-IX-CANCEL', 'IMPA', '', '', '', ''],
      ['TISPH-PC-IX-DIRECT', 'IMPA', '', '', '', ''], ['TISPH-PC-IA-0007', 'IMPA', 'Motor', '', '', ''], ['TISPH-PC-IX-ONREM', 'IMPA', '', '', '', '']);
    buffer = csv(rows);
    const r = await validate('maker', buffer, 'golive.csv');
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    imp = r.body.data;
  });

  it('keeps a result per row under an IMP number and creates nothing', async () => {
    expect(imp).toMatchObject({ importNo: expect.stringMatching(/^IMP-\d{4}-\d{4}$/), status: 'validated', statusLabel: 'Validated', canCommit: true,
      purpose: { code: 'ROC-GOLIVE', name: 'Go-live opening', text: 'Go-live opening' }, file: { name: 'golive.csv', hash: expect.stringMatching(/^[0-9a-f]{64}$/) },
      counts: { rows: 52, ready: 46, warnings: 4, errors: 6, held: 0, exceptions: 0 } });
    expect(imp.toCreate.map((g) => [g.insurer.name, g.productLine, g.policies, g.varianceRows])).toEqual([
      ['Import Alpha Insurance Corp.', 'Personal Accident', 4, 0], ['Import Alpha Insurance Corp.', 'Motor', 40, 4], ['Import Beta Insurance Corp.', 'Motor', 2, 0]].sort((x, y) => `${x[0]}${x[1]}`.localeCompare(`${y[0]}${y[1]}`)));
    expect(imp.totals).toMatchObject({ remittances: 3, policies: 46 });
    expect(imp.toCreate.every((g) => g.basis === 'net' && g.basisLabel === 'Net')).toBe(true);
    expect((await q("SELECT count(*)::int AS n FROM remittances WHERE data->>'importId' = $1", [imp.id]))[0].n).toBe(0);
    const errors = await people.maker('get', `/remittance/imports/${imp.id}/rows?result=errors`);
    expect(errors.body.data.map((x) => [x.rowNo, x.resultLabel, x.message])).toEqual([
      [48, 'Not found', 'Policy not found'], [49, 'Insurer differs', 'Policy insurer is Import Beta'], [50, 'Not issued', 'Policy is cancelled'],
      [51, 'Direct bill', 'Direct-bill policy: the client paid the insurer'], [52, 'Duplicate in file', 'Also on row 8'],
      [53, 'Already on REM', expect.stringMatching(/^Already on REM-\d{4}-\d{5} \(Draft\)$/)]]);
    const warn = await people.maker('get', `/remittance/imports/${imp.id}/rows?result=warnings`);
    expect(warn.body.total).toBe(4);
    expect(warn.body.data[0]).toMatchObject({ rowNo: 2, policyNo: 'TISPH-PC-IA-0001', result: 'ready-variance', resultLabel: 'Ready · Variance', kind: 'warning',
      systemDue: 8501, expectedDue: 8555, variance: -54, message: 'File 8,555.00, system 8,501.00, difference -54.00' });
    const ready = await people.maker('get', `/remittance/imports/${imp.id}/rows?result=ready&perPage=500`);
    expect(ready.body.total).toBe(46);
    expect(ready.body.data.find((x) => x.policyNo === 'TISPH-PC-IA-0005')).toMatchObject({ result: 'ready', variance: -0.5 });
  });

  it('the error report has every row of the file with Result and Message', async () => {
    const r = await binary(people.maker('get', `/remittance/imports/${imp.id}/errors.xlsx`));
    expect(r.status).toBe(200);
    expect(r.headers['content-disposition']).toMatch(new RegExp(`filename="${imp.importNo}_Errors_\\d{8}\\.xlsx"`));
    const [sheet] = readWorkbook(r.body);
    expect(sheet.rows[0]).toEqual([...HEADER, 'Result', 'Message']);
    expect(sheet.rows).toHaveLength(53);
    expect(sheet.rows[1].slice(0, 2)).toEqual(['TISPH-PC-IA-0001', 'IMPA']);
    expect(sheet.rows[1].slice(-2)).toEqual(['Ready · Variance', 'File 8,555.00, system 8,501.00, difference -54.00']);
    expect(sheet.rows[47].slice(-2)).toEqual(['Not found', 'Policy not found']);
  });

  it('creates drafts from the 46 ready rows at the system amounts, off-cycle with the import and its purpose', async () => {
    const r = await people.maker('post', `/remittance/imports/${imp.id}/commit`).send({ version: imp.version });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.data.drafts).toHaveLength(3);
    expect(r.body.data.drafts.reduce((s, d) => s + d.policies, 0)).toBe(46);
    expect(r.body.data.skipped).toEqual([]);
    expect(r.body.data.message).toMatch(new RegExp(`^3 drafts created: REM-.* · Off-cycle · ${imp.importNo}$`));
    expect(r.body.data.import).toMatchObject({ status: 'committed', canCommit: false, drafts: expect.any(Array) });
    const lines = await q(`SELECT rl.policy_number, rl.premium, rl.commission, rl.net, rl.expected_due, rl.variance, rl.insurer_reference, rl.remark FROM remittance_lines rl
      JOIN remittances r ON r.id = rl.remittance_id WHERE r.data->>'importId' = $1 ORDER BY rl.policy_number`, [imp.id]);
    expect(lines).toHaveLength(46);
    const first = lines.find((l) => l.policy_number === 'TISPH-PC-IA-0001');
    expect(first).toMatchObject({ premium: 10001, commission: 1500, net: 8501, expected_due: 8555, variance: -54, insurer_reference: 'SOA-IA-1', remark: 'Opening' });
    for (const l of lines) {
      if (variance.has(l.policy_number)) expect(l.expected_due).toBe(variance.get(l.policy_number));
      else expect(l.expected_due).toBeNull();
    }
    const [draft] = r.body.data.drafts;
    const row = (await people.maker('get', `/remittance/remittances?segment=drafts&source=import&q=${draft.remittanceNo}`)).body.data[0];
    expect(row).toMatchObject({ status: 'draft', source: { code: 'import', label: `Import ${imp.importNo}`, importNo: imp.importNo },
      offCycleReason: { code: 'ROC-GOLIVE', name: 'Go-live opening', text: 'Go-live opening' }, flags: { offCycle: true, offCycleReason: 'Go-live opening' } });
    const rec = (await people.maker('get', `/remittance/remittances/${draft.id}`)).body.data;
    expect(rec.activityLog.map((e) => e.actionLabel)).toContain(`Imported from ${imp.importNo}`);
    expect(rec.activityLog.find((e) => e.actionCode === 'import')).toMatchObject({ remarks: 'Off-cycle: Go-live opening', toStatus: 'Draft' });
    // the approver sees the source and the purpose
    const sub = await people.maker('post', '/remittance/remittances/submit').send({ items: [{ id: draft.id }] });
    expect(sub.body.data.submitted).toBe(1);
    const [a] = await q("SELECT id FROM remittance_approvals WHERE entity = 'remittance' AND entity_id = $1 AND status = 'Pending'", [draft.id]);
    const panel = (await people.gm('get', `/remittance/approvals/${a.id}`)).body.data;
    expect(panel.record).toMatchObject({ source: { code: 'import', label: `Import ${imp.importNo}` }, offCycle: true, offCycleReason: 'Go-live opening' });
    expect((await q("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'remittance_import' AND entity_id = $1 AND action IN ('validate', 'commit')", [imp.id]))[0].n).toBe(2);
  });

  it('the same committed file cannot create drafts again', async () => {
    expect((await people.maker('post', `/remittance/imports/${imp.id}/commit`).send({})).body.errors[0].code).toBe('ALREADY_COMMITTED');
    const again = await validate('recon', buffer, 'golive-copy.csv');
    expect(again.status).toBe(201);
    expect(again.body.data).toMatchObject({ canCommit: false, sameFile: { id: imp.id, importNo: imp.importNo, drafts: 3 } });
    expect(again.body.data.commitBlockedReason).toMatch(new RegExp(`^This file was imported on \\d{2}/\\d{2}/\\d{4} as ${imp.importNo} \\(3 drafts\\)\\.$`));
    const r = await people.recon('post', `/remittance/imports/${again.body.data.id}/commit`).send({});
    expect(r.status).toBe(409);
    expect(r.body.errors[0].code).toBe('SAME_FILE');
    expect((await q("SELECT count(*)::int AS n FROM remittances WHERE data->>'importId' = $1", [again.body.data.id]))[0].n).toBe(0);
  });

  it('lists the imports, newest first', async () => {
    const r = await people.gm('get', '/remittance/imports');
    expect(r.status).toBe(200);
    expect(r.body.data[1]).toMatchObject({ id: imp.id, status: 'committed', statusLabel: 'Committed', drafts: expect.arrayContaining([expect.objectContaining({ remittanceNo: expect.stringMatching(/^REM-/) })]) });
  });

  it('downloads the file of an import as it was uploaded, for a reader of remittances', async () => {
    const r = await binary(people.gm('get', `/remittance/imports/${imp.importNo}/file`));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/^text\/csv/);
    expect(r.headers['content-disposition']).toBe('attachment; filename="golive.csv"');
    expect(Buffer.compare(r.body, buffer)).toBe(0);
    expect((await people.gm('get', '/remittance/imports/IMP-1999-0001/file')).status).toBe(404);
    const outsider = await ctx.api('post', '/users').send({ username: 'imp.outsider', password: 'Welcome@123', displayName: 'No Access', email: 'imp.outsider@example.ph', roles: ['tis-ccd-pdu'] });
    expect(outsider.status).toBe(201);
    const token = await loginAs(ctx.app, 'imp.outsider', 'Welcome@123');
    expect((await request(ctx.app).get(`/api/remittance/imports/${imp.id}/file`).set('Authorization', `Bearer ${token}`)).status).toBe(403);
  });
});

describe('rows that change between validation and commit', () => {
  it('a typed amount is only compared, and a policy remitted meanwhile is skipped', async () => {
    const p1 = await policy('TISPH-PC-RC-0001', ins.b.id, { n: 1 });
    await policy('TISPH-PC-RC-0002', ins.b.id, { n: 2 });
    const v = await validate('maker', csv([['TISPH-PC-RC-0001', 'IMPB', 'Motor', '99999.99', '', ''], ['TISPH-PC-RC-0002', 'IMPB', 'Motor', '', '', '']]), 'race.csv', 'ROC-CATCHUP');
    expect(v.body.data.counts).toMatchObject({ ready: 2, warnings: 1 });
    const other = await people.maker('post', '/remittance/remittances').send({ insurerCode: 'IMPB', lines: [{ policyId: p1 }] });
    const c = await people.maker('post', `/remittance/imports/${v.body.data.id}/commit`).send({ version: v.body.data.version });
    expect(c.status).toBe(200);
    expect(c.body.data.skipped).toEqual([{ rowNo: 2, policyNo: 'TISPH-PC-RC-0001', message: `Skipped: already on ${other.body.data.remittanceNo}` }]);
    expect(c.body.data.drafts).toHaveLength(1);
    const [line] = await q('SELECT net, expected_due FROM remittance_lines WHERE remittance_id = $1', [c.body.data.drafts[0].id]);
    expect(line).toEqual({ net: 8502, expected_due: null });
    const rows = (await people.maker('get', `/remittance/imports/${v.body.data.id}/rows`)).body.data;
    expect(rows[0]).toMatchObject({ result: 'skipped', resultLabel: 'Skipped' });
    expect(rows[1]).toMatchObject({ result: 'ready', remittance: { id: c.body.data.drafts[0].id } });
  });

  it('product line differs; a discarded or expired import is not committed; nothing ready is refused', async () => {
    await policy('TISPH-PC-PL-0001', ins.a.id);
    const v = await validate('maker', csv([['TISPH-PC-PL-0001', 'IMPA', 'Personal Accident', '', '', '']]), 'pl.csv');
    expect(v.body.data).toMatchObject({ counts: { ready: 0, errors: 1 }, canCommit: false, commitBlockedReason: 'No row is ready to remit.' });
    expect((await people.maker('get', `/remittance/imports/${v.body.data.id}/rows`)).body.data[0]).toMatchObject({ result: 'product-line-differs', message: 'Policy product line is Motor' });
    expect((await people.maker('post', `/remittance/imports/${v.body.data.id}/commit`).send({})).body.errors[0].code).toBe('NOTHING_READY');
    await policy('TISPH-PC-DS-0001', ins.a.id);
    const d = await validate('maker', csv([['TISPH-PC-DS-0001', 'IMPA', '', '', '', '']]), 'discard.csv');
    const stale = await people.maker('post', `/remittance/imports/${d.body.data.id}/commit`).send({ version: 7 });
    expect(stale.body.errors[0].code).toBe('STALE');
    const x = await people.maker('post', `/remittance/imports/${d.body.data.id}/discard`);
    expect(x.body.data).toMatchObject({ status: 'discarded', canCommit: false });
    expect((await people.maker('post', `/remittance/imports/${d.body.data.id}/commit`).send({})).body.errors[0].code).toBe('DISCARDED');
    const e = await validate('maker', csv([['TISPH-PC-DS-0001', 'IMPA', '', '', '', '']]), 'expired.csv');
    await q("UPDATE remittance_imports SET uploaded_at = now() - interval '8 days' WHERE id = $1", [e.body.data.id]);
    expect((await people.maker('get', `/remittance/imports/${e.body.data.id}`)).body.data).toMatchObject({ status: 'discarded', expired: true });
    expect((await people.maker('post', `/remittance/imports/${e.body.data.id}/commit`).send({})).body.errors[0].code).toBe('DISCARDED');
    expect((await people.gm('post', `/remittance/imports/${e.body.data.id}/discard`)).status).toBe(403);
  });
});
