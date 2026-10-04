/**
 * Document Numbering master (formats, reset rules, forward-only next number, concurrency), Commission Rate Matrix
 * (resolution precedence, overlap rule) and insurer credit terms.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginAs, setup } from './helpers.js';
import { many, one, pool, query } from '../src/db/pool.js';
import { nextDocumentNumber } from '../src/lib/numbering.js';
import { clearSettingsCache, setSetting } from '../src/lib/settings.js';
import { today } from '../src/lib/dates.js';
import { resolveCommissionRate } from '../src/modules/commission-rates/resolve.js';
import { resolveCreditTerms } from '../src/modules/commission-rates/terms.js';
import { findPolicy, createReceivable } from '../src/modules/receipts/receivables.js';

let ctx;
let claimsToken;
const num = (code, date, branch = null, lob = null) => one('SELECT next_document_number($1, $2, $3, $4::date) AS n', [code, branch, lob, date]).then((r) => r.n);

beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'dn.claims', password: 'Welcome@123', displayName: 'DN Claims', roles: ['claims'] });
  claimsToken = await loginAs(ctx.app, 'dn.claims', 'Welcome@123');
});
afterAll(async () => { await pool.end(); });

describe('document numbering: series and formats', () => {
  it('seeds a series for every code the application uses, with unique active prefixes and the default pattern', async () => {
    const src = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
    const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []));
    const used = new Set(walk(src).flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(/nextDocumentNumber\('([a-z_0-9]+)'/g)].map((m) => m[1])));
    expect(used.size).toBeGreaterThan(40);
    const rows = await many('SELECT code, prefix, pattern, seq_width, reset_rule, active FROM document_numbering');
    const codes = new Set(rows.map((r) => r.code));
    expect([...used].filter((c) => !codes.has(c))).toEqual([]);
    for (const c of ['broker_slip', 'placement', 'insurer_offer', 'period_close', 'year_end_close', 'recurring_journal', 'bir_2307']) expect(codes.has(c), c).toBe(true);
    const prefixes = rows.filter((r) => r.active).map((r) => r.prefix.toUpperCase());
    expect(new Set(prefixes).size).toBe(prefixes.length);
    expect(rows.find((r) => r.code === 'policy')).toMatchObject({ prefix: 'POL', pattern: '{PREFIX}-{YYYY}-{SEQ}', seq_width: 5, reset_rule: 'yearly' });
    expect(rows.find((r) => r.code === 'broker_slip').prefix).toBe('BS');
    // the old prefix settings are a read-only mirror
    const mirror = await one("SELECT value, editable FROM app_settings WHERE key = 'numbering.policy.prefix'");
    expect(mirror).toEqual({ value: 'POL', editable: false });
  });

  it('keeps the existing number format and routes the legacy next_number() and hyphenated names to the series', async () => {
    const year = (await today()).slice(0, 4);
    const a = await nextDocumentNumber('petty_cash_receipt');
    expect(a).toMatch(new RegExp(`^PCRC-${year}-\\d{5}$`));
    const b = (await one("SELECT next_number('petty-cash-receipt', 'IGNORED') AS n")).n;
    expect(Number(b.slice(-5))).toBe(Number(a.slice(-5)) + 1);
    expect((await one("SELECT next_number('not_a_series', 'NX') AS n")).n).toMatch(new RegExp(`^NX-${year}-00001$`));
  });

  it('the migration carries the hyphenated legacy counters over to the series (no number is issued twice)', async () => {
    await query("INSERT INTO sequences(name, period, value) VALUES ('invoice-list', '2099', 77), ('receipt-txn', '2099', 5), ('receipt_txn', '2099', 9)");
    const file = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'db', 'migrations', '0121_document_numbering.sql');
    const sql = fs.readFileSync(file, 'utf8');
    await query(sql.slice(sql.indexOf('-- Counters carry over')));
    expect(await num('invoice_list', '2099-03-01')).toBe('IL-2099-00078');
    expect(await num('receipt_txn', '2099-03-01')).toBe('RT-2099-00010');
    expect((await one("SELECT count(*)::int AS n FROM sequences WHERE name LIKE '%-%' AND period = '2099'")).n).toBe(0);
  });

  it('formats every token; optional {BRANCH} / {LOB} drop with their separator', async () => {
    const f = (pattern, seq, date, branch = null, lob = null, width = 5) => one('SELECT format_document_number($1, $2, $3, $4, $5::date, $6, $7) AS n', [pattern, 'POL', width, seq, date, branch, lob]).then((r) => r.n);
    expect(await f('{PREFIX}-{YYYY}-{SEQ}', 42, '2026-09-29')).toBe('POL-2026-00042');
    expect(await f('{PREFIX}/{YY}{MM}/{SEQ}', 7, '2026-01-05', null, null, 4)).toBe('POL/2601/0007');
    expect(await f('{PREFIX}-{BRANCH}-{LOB}-{YYYY}-{SEQ}', 1, '2026-09-29', 'mkt', 'motor')).toBe('POL-MKT-MOTOR-2026-00001');
    expect(await f('{PREFIX}-{BRANCH}-{LOB}-{YYYY}-{SEQ}', 1, '2026-09-29')).toBe('POL-2026-00001');
    expect(await f('{BRANCH}-{PREFIX}-{SEQ}', 3, '2026-09-29')).toBe('POL-00003');
    expect(await f('{PREFIX}-{SEQ}', 1234567, '2026-09-29')).toBe('POL-1234567');
    // fiscal year named by the year it ends: start month 7, September 2026 is FY2027
    await setSetting('accounting.fiscal_year_start_month', 7);
    expect(await f('{PREFIX}-FY{FY}-{SEQ}', 1, '2026-09-29')).toBe('POL-FY2027-00001');
    expect(await f('{PREFIX}-FY{FY}-{SEQ}', 1, '2026-06-30')).toBe('POL-FY2026-00001');
    await setSetting('accounting.fiscal_year_start_month', 1);
    expect(await f('{PREFIX}-FY{FY}-{SEQ}', 1, '2026-09-29')).toBe('POL-FY2026-00001');
  });
});

describe('document numbering: reset rules', () => {
  it('yearly, monthly, fiscal-year and never reset the counter at the right boundary', async () => {
    const set = (code, pattern, reset) => query('UPDATE document_numbering SET pattern = $2, reset_rule = $3 WHERE code = $1', [code, pattern, reset]);
    await set('broker_slip', '{PREFIX}-{YYYY}-{SEQ}', 'yearly');
    expect(await num('broker_slip', '2030-12-31')).toBe('BS-2030-00001');
    expect(await num('broker_slip', '2030-06-01')).toBe('BS-2030-00002');
    expect(await num('broker_slip', '2031-01-01')).toBe('BS-2031-00001');

    await set('placement', '{PREFIX}{YY}{MM}-{SEQ}', 'monthly');
    expect(await num('placement', '2030-01-31')).toBe('PS3001-00001');
    expect(await num('placement', '2030-01-02')).toBe('PS3001-00002');
    expect(await num('placement', '2030-02-01')).toBe('PS3002-00001');

    await setSetting('accounting.fiscal_year_start_month', 4);
    await set('insurer_offer', '{PREFIX}-FY{FY}-{SEQ}', 'fiscal_yearly');
    expect(await num('insurer_offer', '2030-03-31')).toBe('OFR-FY2030-00001');
    expect(await num('insurer_offer', '2030-04-01')).toBe('OFR-FY2031-00001');
    expect(await num('insurer_offer', '2031-03-31')).toBe('OFR-FY2031-00002');
    await setSetting('accounting.fiscal_year_start_month', 1);

    await set('bir_2307', '{PREFIX}-{SEQ}', 'never');
    expect(await num('bir_2307', '2030-01-01')).toBe('CWT-00001');
    expect(await num('bir_2307', '2035-07-01')).toBe('CWT-00002');
  });

  it('an inactive or unknown series refuses to issue numbers', async () => {
    await query('UPDATE document_numbering SET active = false WHERE code = $1', ['year_end_close']);
    await expect(nextDocumentNumber('year_end_close')).rejects.toMatchObject({ status: 400 });
    await query('UPDATE document_numbering SET active = true WHERE code = $1', ['year_end_close']);
    await expect(nextDocumentNumber('no_such_series')).rejects.toMatchObject({ status: 400 });
  });
});

describe('document numbering: concurrency and uniqueness', () => {
  it('parallel callers (pool and transactions) never receive the same number', async () => {
    const onPool = Array.from({ length: 25 }, () => nextDocumentNumber('recurring_journal'));
    const inTx = Array.from({ length: 15 }, async () => {
      const c = await pool.connect();
      try {
        await c.query('BEGIN');
        const n = await nextDocumentNumber('recurring_journal', { db: c });
        await c.query('COMMIT');
        return n;
      } finally { c.release(); }
    });
    const all = await Promise.all([...onPool, ...inTx]);
    expect(new Set(all).size).toBe(40);
  });

  it('a rolled-back transaction gives its number back; a number already in the target table is skipped', async () => {
    const c = await pool.connect();
    let rolledBack;
    try {
      await c.query('BEGIN');
      rolledBack = await nextDocumentNumber('period_close', { db: c });
      await c.query('ROLLBACK');
    } finally { c.release(); }
    expect(await nextDocumentNumber('period_close')).toBe(rolledBack);

    const year = (await today()).slice(0, 4);
    const next = (await ctx.api('get', '/document-numbering/recurring_journal')).body.data.nextNumber;
    const taken = `RJV-${year}-${String(next).padStart(5, '0')}`;
    await query('CREATE TABLE numbering_test_taken (ref text UNIQUE)');
    await query('INSERT INTO numbering_test_taken(ref) VALUES ($1)', [taken]);
    const got = await nextDocumentNumber('recurring_journal', { unique: { table: 'numbering_test_taken', column: 'ref' } });
    await query('DROP TABLE numbering_test_taken');
    expect(got).not.toBe(taken);
    expect(Number(got.slice(-5))).toBe(next + 1);
  });
});

describe('document numbering: API', () => {
  it('lists series with the current counter and next-number preview', async () => {
    const r = await ctx.api('get', '/document-numbering?module=finance');
    expect(r.status).toBe(200);
    expect(r.body.tokens).toContain('{FY}');
    const receipt = r.body.data.find((s) => s.code === 'receipt');
    expect(receipt).toMatchObject({ name: 'Official Receipt', prefix: 'OR', resetRule: 'yearly' });
    expect(receipt.nextPreview).toBe(`OR-${receipt.periodKey}-${String(receipt.nextNumber).padStart(5, '0')}`);
    expect(r.body.data.every((s) => s.module === 'finance')).toBe(true);
    expect((await ctx.api('get', '/document-numbering/nope')).status).toBe(404);
  });

  it('previews unsaved changes and reports pattern errors', async () => {
    const p = await ctx.api('get', '/document-numbering/journal/preview').query({ pattern: '{PREFIX}-{BRANCH}-{YY}{MM}-{SEQ}', resetRule: 'monthly', seqWidth: 6, branch: 'ceb', date: '2031-05-10' });
    expect(p.status).toBe(200);
    expect(p.body.data).toMatchObject({ valid: true, preview: 'JV-CEB-3105-000001', periodKey: '2031-05' });
    const bad = await ctx.api('get', '/document-numbering/journal/preview').query({ pattern: '{PREFIX}-{SEQ}', resetRule: 'monthly' });
    expect(bad.body.data.valid).toBe(false);
    expect(bad.body.data.errors[0].message).toMatch(/monthly reset needs \{MM\}/);
  });

  it('updates a series with validation, unique prefixes and an audit entry', async () => {
    const bad = await ctx.api('put', '/document-numbering/placement').send({ pattern: '{PREFIX}-{DAY}-{SEQ}' });
    expect(bad.status).toBe(400);
    const noYear = await ctx.api('put', '/document-numbering/placement').send({ pattern: '{PREFIX}-{SEQ}', resetRule: 'yearly' });
    expect(noYear.status).toBe(400);
    const clash = await ctx.api('put', '/document-numbering/placement').send({ prefix: 'POL' });
    expect(clash.status).toBe(409);
    const okRes = await ctx.api('put', '/document-numbering/placement').send({ prefix: 'PLS', pattern: '{PREFIX}-{LOB}-{YYYY}-{SEQ}', resetRule: 'yearly', seqWidth: 6, description: 'Placement slip' });
    expect(okRes.status).toBe(200);
    expect(okRes.body.data).toMatchObject({ prefix: 'PLS', seqWidth: 6 });
    expect(await nextDocumentNumber('placement', { lob: 'fire' })).toMatch(/^PLS-FIRE-\d{4}-\d{6}$/);
    expect((await one("SELECT value FROM app_settings WHERE key = 'numbering.placement.prefix'")).value).toBe('PLS');
    const log = await one("SELECT action, before_data, after_data FROM audit_log WHERE entity = 'document_numbering' AND entity_id = 'placement' ORDER BY id DESC LIMIT 1");
    expect(log.action).toBe('update');
    expect(log.before_data.prefix).toBe('PS');
    expect(log.after_data.prefix).toBe('PLS');
    // an inactive series frees its prefix
    await ctx.api('put', '/document-numbering/insurer_offer').send({ active: false });
    expect((await ctx.api('put', '/document-numbering/placement').send({ prefix: 'OFR' })).status).toBe(200);
    expect((await ctx.api('put', '/document-numbering/insurer_offer').send({ active: true })).status).toBe(409);
  });

  it('sets the next number forward only', async () => {
    await nextDocumentNumber('year_end_close');
    await nextDocumentNumber('year_end_close');
    const s = (await ctx.api('get', '/document-numbering/year_end_close')).body.data;
    expect(s.currentValue).toBeGreaterThanOrEqual(2);
    const back = await ctx.api('put', '/document-numbering/year_end_close/next-number').send({ nextNumber: s.currentValue });
    expect(back.status).toBe(409);
    const same = await ctx.api('put', '/document-numbering/year_end_close/next-number').send({ nextNumber: s.nextNumber });
    expect(same.status).toBe(200);
    const fwd = await ctx.api('put', '/document-numbering/year_end_close/next-number').send({ nextNumber: 500 });
    expect(fwd.status).toBe(200);
    expect(fwd.body.data).toMatchObject({ nextNumber: 500, currentValue: 499 });
    expect(await nextDocumentNumber('year_end_close')).toMatch(/-00500$/);
    expect((await ctx.api('put', '/document-numbering/year_end_close/next-number').send({ nextNumber: 400 })).status).toBe(409);
    const log = await one("SELECT before_data, after_data FROM audit_log WHERE entity = 'document_numbering' AND action = 'set-next-number' ORDER BY id DESC LIMIT 1");
    expect(log.after_data.nextNumber).toBe(500);
  });

  it('is restricted to system configuration', async () => {
    const r = await ctx.api('get', '/document-numbering').set('Authorization', `Bearer ${claimsToken}`);
    expect(r.status).toBe(403);
    const w = await ctx.api('put', '/document-numbering/policy').set('Authorization', `Bearer ${claimsToken}`).send({ prefix: 'PX' });
    expect(w.status).toBe(403);
  });

  it('endorsements take their number inside the transaction', async () => {
    const src = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'modules', 'endorsements', 'service.js'), 'utf8');
    expect(src).toMatch(/withTransaction\(async \(db\) => \{\s*const number = await nextDocumentNumber\('endorsement', \{ db/);
  });
});

describe('commission rate matrix', () => {
  let ins;
  let other;
  let motor;
  beforeAll(async () => {
    [ins, other] = await many("SELECT id, commission_rate FROM insurance_companies WHERE status = 'active' ORDER BY id LIMIT 2");
    motor = await one("SELECT id FROM products WHERE code = 'MOTOR'");
    await query('UPDATE insurance_companies SET commission_rate = 0.2 WHERE id = $1', [other.id]);
  });
  const add = (body) => ctx.api('post', '/commission-rates').send(body);

  it('falls back to the insurer rate, then commission.default_rate', async () => {
    await query('UPDATE insurance_companies SET commission_rate = NULL WHERE id = $1', [ins.id]);
    clearSettingsCache();
    expect(await resolveCommissionRate({ insurerId: ins.id, date: '2030-01-01' })).toMatchObject({ rate: 0.15, source: 'default' });
    expect(await resolveCommissionRate({ insurerId: other.id, date: '2030-01-01' })).toMatchObject({ rate: 0.2, source: 'insurer' });
  });

  it('picks the most specific active row effective on the date', async () => {
    expect((await add({ lineOfBusiness: 'MOTOR', rate: 0.1, effectiveFrom: '2030-01-01' })).status).toBe(201);
    expect((await add({ productId: motor.id, rate: 0.11, effectiveFrom: '2030-01-01' })).status).toBe(201);
    expect((await add({ insuranceCompanyId: ins.id, rate: 0.12, effectiveFrom: '2030-01-01' })).status).toBe(201);
    expect((await add({ insuranceCompanyId: ins.id, lineOfBusiness: 'motor', rate: 0.13, effectiveFrom: '2030-01-01' })).status).toBe(201);
    expect((await add({ insuranceCompanyId: ins.id, productId: motor.id, rate: 0.14, effectiveFrom: '2030-01-01', effectiveTo: '2030-12-31' })).status).toBe(201);
    expect((await add({ insuranceCompanyId: ins.id, productId: motor.id, policyType: 'renewal', rate: 0.125, effectiveFrom: '2030-01-01', effectiveTo: '2030-12-31' })).status).toBe(201);
    const r = (q) => resolveCommissionRate({ date: '2030-06-01', ...q });
    expect(await r({ insurerId: ins.id, productId: motor.id, lob: 'motor' })).toMatchObject({ rate: 0.14, source: 'matrix', level: 'insurer + product' });
    expect((await r({ insurerId: ins.id, productId: motor.id, lob: 'motor', policyType: 'renewal' })).rate).toBe(0.125);
    expect((await r({ insurerId: ins.id, lob: 'motor' })).rate).toBe(0.13);
    expect((await r({ insurerId: ins.id, lob: 'fire' })).rate).toBe(0.12);
    expect((await r({ insurerId: other.id, productId: motor.id, lob: 'motor' })).rate).toBe(0.11);
    expect((await r({ insurerId: other.id, lob: 'Motor' })).rate).toBe(0.1);
    expect(await r({ insurerId: other.id, lob: 'fire' })).toMatchObject({ rate: 0.2, source: 'insurer' });
    // after the insurer + product row expires, insurer + LOB applies; before any row, the fallbacks
    expect((await resolveCommissionRate({ insurerId: ins.id, productId: motor.id, lob: 'motor', date: '2031-02-01' })).rate).toBe(0.13);
    expect((await resolveCommissionRate({ insurerId: ins.id, productId: motor.id, lob: 'motor', date: '2029-12-31' })).source).toBe('default');
    const test = await ctx.api('get', '/commission-rates/resolve').query({ insurerId: ins.id, productId: motor.id, lob: 'motor', date: '2030-06-01' });
    expect(test.body.data).toMatchObject({ rate: 0.14, source: 'matrix' });
  });

  it('accepts only a line of business of the Line of Business master (400 otherwise), on add and on change', async () => {
    const bad = await add({ insuranceCompanyId: ins.id, lineOfBusiness: 'MOTR', rate: 0.1, effectiveFrom: '2033-01-01' });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/Line of business MOTR is not in the Line of Business master/);
    expect(bad.body.errors).toEqual([expect.objectContaining({ path: 'lineOfBusiness' })]);
    // the master code in any case, as the screen sends it (lower case from the master options)
    const good = await add({ insuranceCompanyId: ins.id, lineOfBusiness: 'Fire', rate: 0.1, effectiveFrom: '2033-01-01' });
    expect(good.status).toBe(201);
    expect(good.body.data.lineOfBusiness).toBe('fire');
    const change = await ctx.api('put', `/commission-rates/${good.body.data.id}`).send({ lineOfBusiness: 'no-such-line' });
    expect(change.status).toBe(400);
    expect(change.body.message).toMatch(/no-such-line is not in the Line of Business master/);
    // a change that keeps the line of business (the screen sends every field) is not checked again
    expect((await ctx.api('put', `/commission-rates/${good.body.data.id}`).send({ lineOfBusiness: 'fire', rate: 0.11 })).status).toBe(200);
    expect((await ctx.api('delete', `/commission-rates/${good.body.data.id}`)).status).toBe(200);
  });

  it('rejects overlapping active rows with the same keys; inactive rows do not count', async () => {
    const dup = await add({ insuranceCompanyId: ins.id, productId: motor.id, rate: 0.16, effectiveFrom: '2030-12-01' });
    expect(dup.status).toBe(409);
    expect((await add({ insuranceCompanyId: ins.id, productId: motor.id, rate: 0.16, effectiveFrom: '2031-01-01' })).status).toBe(201);
    const inactive = await add({ insuranceCompanyId: ins.id, productId: motor.id, rate: 0.5, effectiveFrom: '2030-03-01', active: false });
    expect(inactive.status).toBe(201);
    expect((await ctx.api('put', `/commission-rates/${inactive.body.data.id}`).send({ active: true })).status).toBe(409);
    expect((await add({ rate: 0.1, effectiveFrom: '2030-01-01' })).status).toBe(400);
    expect((await add({ insuranceCompanyId: ins.id, rate: 1.5, effectiveFrom: '2030-01-01' })).status).toBe(400);
    expect((await add({ insuranceCompanyId: ins.id, rate: 0.1, effectiveFrom: '2032-01-01', effectiveTo: '2031-01-01' })).status).toBe(400);
    const list = await ctx.api('get', '/commission-rates').query({ insuranceCompanyId: ins.id });
    expect(list.body.data.length).toBeGreaterThanOrEqual(5);
    const del = await ctx.api('delete', `/commission-rates/${inactive.body.data.id}`);
    expect(del.status).toBe(200);
    expect(await one("SELECT action FROM audit_log WHERE entity = 'commission_rate' ORDER BY id DESC LIMIT 1")).toEqual({ action: 'delete' });
    expect((await ctx.api('post', '/commission-rates').set('Authorization', `Bearer ${claimsToken}`).send({ insuranceCompanyId: ins.id, rate: 0.1, effectiveFrom: '2040-01-01' })).status).toBe(403);
  });
});

describe('insurer credit terms', () => {
  it('are edited on the insurer master and fall back to the settings', async () => {
    const ic = await one("SELECT id FROM insurance_companies WHERE status = 'active' ORDER BY id DESC LIMIT 1");
    expect(await resolveCreditTerms(ic.id)).toMatchObject({ premiumWarrantyDays: 30, remittanceTermsDays: 30, billingMode: 'broker', source: { premiumWarrantyDays: 'setting' } });
    const def = await ctx.api('get', '/masters/insurance-company/definition');
    expect(def.body.data.fields.map((f) => f.name)).toEqual(expect.arrayContaining(['premiumWarrantyDays', 'remittanceTermsDays', 'defaultBillingMode']));
    const bad = await ctx.api('put', `/masters/insurance-company/${ic.id}`).send({ premiumWarrantyDays: -1 });
    expect(bad.status).toBe(400);
    const put = await ctx.api('put', `/masters/insurance-company/${ic.id}`).send({ premiumWarrantyDays: 45, remittanceTermsDays: 10, defaultBillingMode: 'direct' });
    expect(put.status).toBe(200);
    expect(put.body.data).toMatchObject({ premiumWarrantyDays: 45, remittanceTermsDays: 10, defaultBillingMode: 'direct' });
    expect(await resolveCreditTerms(ic.id)).toMatchObject({ premiumWarrantyDays: 45, remittanceTermsDays: 10, billingMode: 'direct', source: { billingMode: 'insurer' } });
    expect((await ctx.api('get', `/commission-rates/credit-terms/${ic.id}`)).body.data.premiumWarrantyDays).toBe(45);
  });

  it('sets the receivable due date from the insurer premium warranty days', async () => {
    const p = await one("SELECT id, insurance_company_id FROM policies WHERE billing_mode = 'broker' AND insurance_company_id IS NOT NULL ORDER BY created_at LIMIT 1");
    await query('UPDATE insurance_companies SET premium_warranty_days = 7 WHERE id = $1', [p.insurance_company_id]);
    const c = await pool.connect();
    try {
      await c.query('BEGIN');
      const policy = await findPolicy(c, p.id);
      await c.query('UPDATE policies SET inception_date = $2 WHERE id = $1', [p.id, '2099-01-01']);
      const r = await createReceivable(c, { policy: { ...policy, inception_date: '2099-01-01' }, amount: 1000 });
      expect(r.due_date).toBe('2099-01-08');
      expect(r.bill_number).toMatch(/^INV-\d{4}-\d{5}$/);
    } finally {
      await c.query('ROLLBACK');
      c.release();
    }
  });
});
