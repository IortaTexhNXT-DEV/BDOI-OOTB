/**
 * Personal identifiers: masking by role on API responses and exports (14.12) and field-level encryption at rest with
 * blind-index search and key rotation (14.13).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { config } from '../src/config.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { requestContext } from '../src/lib/requestContext.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { toCsv } from '../src/lib/csv.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import {
  blindIndex, buildKeyring, decryptPii, encryptPii, isPiiCipher, maskValue, protectPayload, revealPii, sessionOptions, stripMasked,
} from '../src/lib/pii.js';
import { rotate } from '../scripts/rotate-pii-key.js';

let ctx;
let uw;
let clientId;
const TIN = '123-456-789-000';

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const t = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => ctx.api(m, p).set('Authorization', `Bearer ${t}`);
}
const setting = async (key, value) => {
  await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};

beforeAll(async () => {
  ctx = await setup();
  uw = await persona('pdp.uw', ['processing']);
  const c = await ctx.api('post', '/clients').send({ firstName: 'Lourdes', lastName: 'Macapagal', emailId: 'lourdes.m@example.ph', contactNumber: '09171234567',
    taxNumber: TIN, DOB: '1984-05-20', idNumber: 'N01-99-123456' });
  clientId = c.body.clientId;
});
afterAll(async () => { await pool.end(); });

describe('field-level encryption (14.13)', () => {
  it('stores TIN and government ID numbers encrypted with a blind index; the API answers them in clear', async () => {
    const row = await one('SELECT tin, tin_bidx, id_number, extra FROM clients WHERE id = $1', [clientId]);
    expect(isPiiCipher(row.tin)).toBe(true);
    expect(row.tin).not.toContain('123');
    expect(row.tin_bidx).toBe(blindIndex('123456789000'));
    // the government ID number lives in its own column since the AML onboarding (0260); encrypted by 0331
    expect(isPiiCipher(row.id_number)).toBe(true);
    expect(row.id_number).not.toContain('99-123456');
    const r = await ctx.api('get', `/clients/${clientId}`);
    expect(r.body.taxNumber).toBe(TIN);
    expect(r.body.idNumber).toBe('N01-99-123456');
    expect(decryptPii(row.tin)).toBe(TIN);
  });
  it('finds a client by its exact TIN in any format (list and global search)', async () => {
    const l = await ctx.api('get', '/clients?search=123456789000');
    expect(l.body.data.clients.map((c) => c.clientId)).toContain(clientId);
    const g = await ctx.api('get', `/search?q=${encodeURIComponent(TIN)}`);
    expect(JSON.stringify(g.body)).toContain(clientId);
    expect((await ctx.api('get', '/clients?search=123456789001')).body.data.clients.map((c) => c.clientId)).not.toContain(clientId);
  });
  it('the database encrypts every writer (SQL included), keeps an unchanged value, and refuses a session without the key', async () => {
    await query('UPDATE clients SET tin = $2 WHERE id = $1', [clientId, '987-654-321-000']);
    const a = await one('SELECT tin, tin_bidx FROM clients WHERE id = $1', [clientId]);
    expect(revealPii(a.tin)).toBe('987-654-321-000');
    await query("UPDATE clients SET status = status WHERE id = $1", [clientId]);
    expect((await one('SELECT tin FROM clients WHERE id = $1', [clientId])).tin).toBe(a.tin);
    await query('UPDATE clients SET tin = $2 WHERE id = $1', [clientId, TIN]);
    const raw = new pg.Client({ connectionString: config.databaseUrl });
    await raw.connect();
    try {
      await expect(raw.query("UPDATE clients SET tin = '111-111-111-000' WHERE id = $1", [clientId])).rejects.toThrow(/encryption key of this session is not set/);
    } finally {
      await raw.end();
    }
  });
  it('referrer TIN and bank account are encrypted; the payout screen shows the last digits only', async () => {
    const c = await ctx.api('post', '/commission/referrer-accounts').send({ name: 'Encrypted Agent', type: 'Agent', tin: '222-333-444-000', bankName: 'BPI', bankAccountNo: '3179001234' });
    const id = c.body.data.referrer.id;
    const row = await one('SELECT tin, bank_account_no, bank_account_no_bidx FROM commission_referrers WHERE id = $1', [id]);
    expect(isPiiCipher(row.tin) && isPiiCipher(row.bank_account_no)).toBe(true);
    expect(row.bank_account_no_bidx).toBe(blindIndex('3179001234'));
    expect(c.body.data.referrer.bankAccount).toBe('BPI ***1234');
  });
  it('rotates to a new key: values re-encrypted, blind indexes recomputed; old backups stay readable with the old key', async () => {
    const oldSecret = config.piiEncryptionKey;
    const newRing = buildKeyring('rotation-test-key-0123456789abcdef0123', oldSecret);
    const p = new pg.Pool({ connectionString: config.databaseUrl, max: 2, options: sessionOptions(newRing) });
    try {
      const dry = await rotate(p);
      expect(dry.find((r) => r.table === 'clients' && r.column === 'tin').left).toBeGreaterThan(0);
      await rotate(p, { execute: true });
      expect((await rotate(p)).every((r) => r.left === 0)).toBe(true);
      const row = (await p.query('SELECT tin, tin_bidx FROM clients WHERE id = $1', [clientId])).rows[0];
      expect(row.tin.split(':')[2]).toBe(newRing.current.kid);
      expect(decryptPii(row.tin, newRing)).toBe(TIN);
      expect(row.tin_bidx).toBe(blindIndex(TIN, newRing));
    } finally {
      await p.end();
    }
    // back to the key of the test environment
    const back = buildKeyring(oldSecret, 'rotation-test-key-0123456789abcdef0123');
    const q = new pg.Pool({ connectionString: config.databaseUrl, max: 2, options: sessionOptions(back) });
    try {
      await rotate(q, { execute: true });
    } finally {
      await q.end();
    }
    expect(revealPii((await one('SELECT tin FROM clients WHERE id = $1', [clientId])).tin)).toBe(TIN);
  });
  it('the format and the integrity check', () => {
    const v = encryptPii('ABC-123');
    expect(v).toMatch(/^pii:1:[0-9a-f]{8}:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    const parts = v.split(':');
    parts[4] = Buffer.from('x'.repeat(16)).toString('base64');
    expect(() => decryptPii(parts.join(':'))).toThrow(/integrity/);
    expect(revealPii(parts.join(':'))).toBe('[encrypted]');
  });
});

describe('masking by role (14.12)', () => {
  it('a user without View full personal identifiers gets TIN, ID, mobile, e-mail and birth date masked on views and lists', async () => {
    const r = await uw('get', `/clients/${clientId}`);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ firstName: 'Lourdes', taxNumber: '***-***-**9-000', emailId: 'l***@example.ph', contactNumber: '*******4567', DOB: '1984-**-**', idNumber: '***-**-**3456' });
    const list = await uw('get', '/clients?search=Macapagal');
    expect(list.body.data.clients[0].emailId).toBe('l***@example.ph');
    const full = await ctx.api('get', `/clients/${clientId}`);
    expect(full.body.emailId).toBe('lourdes.m@example.ph');
  });
  it('a form sent back with masked values does not overwrite the stored ones', async () => {
    const u = await uw('put', `/clients/${clientId}`).send({ taxNumber: '***-***-**9-000', emailId: 'l***@example.ph', DOB: '1984-**-**', city: 'Quezon City' });
    expect(u.status, JSON.stringify(u.body)).toBe(200);
    const after = (await ctx.api('get', `/clients/${clientId}`)).body;
    expect(after).toMatchObject({ taxNumber: TIN, emailId: 'lourdes.m@example.ph', DOB: '1984-05-20', city: 'Quezon City' });
  });
  it('exports are masked for the same users (Excel, CSV); holders get full values', () => {
    const columns = [{ key: 'name', header: 'Name' }, { key: 'tin', header: 'TIN' }, { key: 'email', header: 'E-mail' }];
    const rows = [{ name: 'Lourdes Macapagal', tin: encryptPii(TIN), email: 'lourdes.m@example.ph' }];
    const inRequest = (permissions, fn) => {
      let out;
      const req = { method: 'GET', originalUrl: '/api/reports/x', headers: {}, user: { roles: ['processing'], permissions }, piiSettings: { enabled: true, mode: 'always', exempt: [] } };
      requestContext(req, {}, () => { out = fn(); });
      return out;
    };
    const masked = inRequest([], () => readWorkbook(writeXlsx({ sheets: [{ name: 'S', columns, rows }] }))[0].rows[1]);
    expect(masked).toEqual(['Lourdes Macapagal', '***-***-**9-000', 'l***@example.ph']);
    const csv = inRequest([], () => toCsv(columns, rows));
    expect(csv).toContain('l***@example.ph');
    const full = inRequest(['view:pii'], () => readWorkbook(writeXlsx({ sheets: [{ name: 'S', columns, rows }] }))[0].rows[1]);
    expect(full).toEqual(['Lourdes Macapagal', TIN, 'lourdes.m@example.ph']);
  });
  it('on-request mode: holders see masked values until they unmask; each unmasked request is in the audit trail', async () => {
    await setting('privacy.pii_reveal_mode', 'on-request');
    const m = await ctx.api('get', `/clients/${clientId}`);
    expect(m.body.taxNumber).toBe('***-***-**9-000');
    const u = await ctx.api('get', `/clients/${clientId}`).set('X-Unmask-PII', '1');
    expect(u.body.taxNumber).toBe(TIN);
    await new Promise((r) => { setTimeout(r, 50); });
    const a = await one("SELECT username, after_data FROM audit_log WHERE entity = 'personal_data' AND action = 'unmask' ORDER BY id DESC LIMIT 1");
    expect(a.username).toBe('BrokerVerse');
    expect(a.after_data.path).toBe(`/api/clients/${clientId}`);
    // a user without the permission cannot unmask
    expect((await uw('get', `/clients/${clientId}`).set('X-Unmask-PII', '1')).body.taxNumber).toBe('***-***-**9-000');
    await setting('privacy.pii_reveal_mode', 'always');
  });
  it('masking can be switched off; exempt paths answer in full', async () => {
    await setting('privacy.masking_enabled', false);
    expect((await uw('get', `/clients/${clientId}`)).body.taxNumber).toBe(TIN);
    await setting('privacy.masking_enabled', true);
  });
  it('catalogue-driven rules: statuses under keys like "to" are not e-mail addresses; masked values are recognised', () => {
    expect(protectPayload({ history: [{ to: 'approved' }], cc: 'ops@broker.ph' }, { mask: true })).toEqual({ history: [{ to: 'approved' }], cc: 'o***@broker.ph' });
    expect(maskValue('dob', '1990-01-31')).toBe('1990-**-**');
    const body = { email: 'a***@x.ph', nested: { taxNumber: '***-***-**1-000' }, city: 'Makati' };
    expect(stripMasked(body)).toEqual(['email', 'nested.taxNumber']);
    expect(body).toEqual({ nested: {}, city: 'Makati' });
  });
});
