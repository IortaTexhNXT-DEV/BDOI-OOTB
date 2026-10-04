/**
 * Client data masking tool (scripts/mask-data.js, docs/onboarding/DATA_MASKING.md): the personal data catalogue covers
 * every personal column, the guards refuse production and missing secrets, and a masked copy keeps no original personal
 * value anywhere while joins, searches, figures and the trial balance stay as they were; staff accounts, sessions and
 * e-mail are handled as documented.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { sendQueuedEmails, queueEmail } from '../src/lib/mailer.js';
import {
  ALLOW_LIST, CATALOGUE, PERSONAL_NAME_RE, RULES, TABLE_ACTIONS, allowReason, catalogueEntry, jsonKeyRule,
} from '../scripts/lib/pii-catalogue.js';
import { Masker, isMaskedMobile } from '../scripts/lib/pseudonyms.js';
import {
  MaskRefused, databaseIdentity, main, maskData, maskStorage, parseArgs, registerProduction, verifyMasked,
} from '../scripts/mask-data.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PII_PY = path.resolve(here, '..', '..', 'docs', 'package', 'tools', 'data-dictionary', 'pii.py');
const SALT = 'test-salt-0123456789-abcdef';
const ADMIN_PASSWORD = 'Masked-Admin#2026';
const STAFF_PASSWORD = 'Masked-Staff#2026';
const KEY = 'id-cards/1700000000000-0123456789abcdef0123456789abcdef-Xandrelle_Quizonwerth_ID.jpg';

const TEXT_UDT = new Set(['text', 'varchar', 'bpchar', 'json', 'jsonb', '_text', '_varchar', 'date']);
const withClient = async (fn) => {
  const c = await pool.connect();
  try { return await fn(c); } finally { c.release(); }
};
const tables = async () => (await query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.tablename);
async function columnsOf() {
  const r = await query(`SELECT c.table_name, c.column_name, c.udt_name FROM information_schema.columns c
    JOIN pg_tables t ON t.tablename = c.table_name AND t.schemaname = 'public' WHERE c.table_schema = 'public'`);
  const out = new Map();
  for (const x of r.rows) {
    if (!out.has(x.table_name)) out.set(x.table_name, []);
    out.get(x.table_name).push({ name: x.column_name, udt: x.udt_name });
  }
  return out;
}

/** Personal columns of the data dictionary (pii.py): [table, column]. */
function dataDictionaryPersonal() {
  const text = fs.readFileSync(PII_PY, 'utf8');
  const out = [];
  const party = text.slice(text.indexOf('_party = {'), text.indexOf('}', text.indexOf('_party = {')));
  for (const m of party.matchAll(/'([a-z_]+)':/g)) for (const t of ['clients', 'leads']) out.push([t, m[1]]);
  const usersBlock = text.slice(text.indexOf("for c, k in {'username'"), text.indexOf("PII[('users', c)]"));
  for (const m of usersBlock.matchAll(/'([a-z_]+)':/g)) out.push(['users', m[1]]);
  for (const m of text.matchAll(/\('([a-z_0-9]+)', '([a-z_0-9]+)'\)/g)) out.push([m[1], m[2]]);
  return out;
}

/** Every text and JSON value of the database as one string per row, per table. */
async function allText() {
  const cols = await columnsOf();
  const out = [];
  for (const [t, cs] of cols) {
    const text = cs.filter((c) => ['text', 'varchar', 'bpchar', 'json', 'jsonb', '_text', 'date'].includes(c.udt));
    if (!text.length) continue;
    const rows = (await query(`SELECT concat_ws(' | ', ${text.map((c) => `"${c.name}"::text`).join(', ')}) AS s FROM "${t}"`)).rows;
    for (const r of rows) out.push({ table: t, s: r.s || '' });
  }
  return out;
}

/** Checksum of every numeric column per table (figures must not change). */
async function numericChecksums() {
  const r = await query(`SELECT c.table_name, array_agg(c.column_name::text ORDER BY c.ordinal_position) AS cols FROM information_schema.columns c
    JOIN pg_tables t ON t.tablename = c.table_name AND t.schemaname = 'public'
    WHERE c.table_schema = 'public' AND c.udt_name IN ('numeric', 'int2', 'int4', 'int8', 'float4', 'float8', 'money') GROUP BY 1`);
  const out = {};
  for (const { table_name: t, cols } of r.rows) {
    const x = (await query(`SELECT count(*)::int AS n, md5(COALESCE(string_agg(v, '|' ORDER BY v), '')) AS h
      FROM (SELECT concat_ws(',', ${cols.map((c) => `"${c}"`).join(', ')}) AS v FROM "${t}") s`)).rows[0];
    out[t] = `${x.n}:${x.h}`;
  }
  return out;
}

const trialBalance = async () => (await query(`SELECT account_code, sum(debit)::numeric(18,2)::text AS d, sum(credit)::numeric(18,2)::text AS c
  FROM journal_lines GROUP BY 1 ORDER BY 1`)).rows;

let ctx;
let originals;
let ids;
beforeAll(async () => {
  ctx = await setup();
  const policy = (await query(`SELECT p.id, p.client_id FROM policies p JOIN clients c ON c.id = p.client_id
    WHERE c.client_type = 'individual' ORDER BY p.id LIMIT 1`)).rows[0];
  const claim = (await query('SELECT id FROM claims ORDER BY id LIMIT 1')).rows[0];
  const lead = (await query('SELECT id FROM leads ORDER BY id LIMIT 1')).rows[0];
  const corporate = (await query("SELECT id FROM clients WHERE client_type = 'corporate' ORDER BY id LIMIT 1")).rows[0];
  const jv = (await query('SELECT id FROM journal_vouchers ORDER BY id LIMIT 1')).rows[0];
  ids = { policy: policy.id, client: policy.client_id, claim: claim.id, lead: lead.id, corporate: corporate.id, jv: jv.id };

  // A client and the same person as a prospect (duplicate check), with every kind of personal data.
  const person = {
    first_name: 'Xandrelle', last_name: 'Quizonwerth', display_name: 'Xandrelle Quizonwerth', email: 'xandrelle.q@realmail.ph',
    phone: '+639171234567', birth_date: '1985-06-15', address: '12 Totoong Kalye Street', barangay: 'Brgy. Totoong Lugar', city: 'Makati',
  };
  await query(`UPDATE clients SET first_name = $2, last_name = $3, display_name = $4, email = $5, phone = $6, tin = '123-456-789-000',
    birth_date = $7, address = $8, barangay = $9, city = $10, extra = '{"notes": "Prefers calls about the Zuhaybar account", "mobileNumber": "09171234567"}' WHERE id = $1`,
  [ids.client, person.first_name, person.last_name, person.display_name, person.email, person.phone, person.birth_date, person.address, person.barangay, person.city]);
  await query(`UPDATE leads SET first_name = $2, last_name = $3, display_name = $4, email = $5, phone = '0917 123 4567', birth_date = $6,
    notes = 'Met at the Zuhaybar reunion', extra = '{"passportNumber": "P7654321Q"}' WHERE id = $1`,
  [ids.lead, person.first_name, person.last_name, person.display_name, person.email, person.birth_date]);
  await query("UPDATE clients SET company_name = 'Zentrovia Trading Corp.', display_name = 'Zentrovia Trading Corp.', email = 'ops@zentrovia.ph', phone = '0918 765 4321' WHERE id = $1", [ids.corporate]);
  await query(`UPDATE policies SET insured_name = 'Xandrelle Quizonwerth', doc = COALESCE(doc, '{}'::jsonb) || $2::jsonb WHERE id = $1`, [ids.policy, JSON.stringify({
    insuredName: 'Xandrelle Quizonwerth', plateNumber: 'ZXA 9123', chassisNumber: 'MHFZZ1234567B9012', engineNumber: '2NRX987654',
    customerInfo: { firstName: 'Xandrelle', lastName: 'Quizonwerth', emailId: 'xandrelle.q@realmail.ph', contactNumber: '+63 917 123 4567', dateOfBirth: '1985-06-15' },
    idCardUrl: `/api/s3/object/${KEY}`, remarks: 'Referred by Zuhaybar',
  })]);
  await query(`UPDATE claims SET driver = $2, third_party = $3, description = 'Hit by Brontavia Yllescas at the Zuhaybar gate', loss_address = '99 Tunay na Daan, Makati' WHERE id = $1`, [ids.claim,
    JSON.stringify({ driverName: 'Xandrelle Quizonwerth', licenseNumber: 'N01-23-456789' }),
    JSON.stringify({ thirdPartyName: 'Brontavia Yllescas', thirdPartyContactNumber: '+639189876543' })]);
  await query("UPDATE journal_vouchers SET description = 'Premium of Xandrelle Quizonwerth, Zentrovia Trading Corp. (TIN 123-456-789-000)' WHERE id = $1", [ids.jv]);
  await query("INSERT INTO notifications(title, message) VALUES ('Policy issued', 'Policy issued to Xandrelle Quizonwerth (xandrelle.q@realmail.ph)')");
  await queueEmail({ to: 'xandrelle.q@realmail.ph', subject: 'Your policy', html: '<p>Dear Xandrelle Quizonwerth</p>' });
  await query(`INSERT INTO audit_log(username, entity, entity_id, action, after_data, ip) VALUES ('BrokerVerse', 'client', $1, 'update', $2, '203.0.113.7')`,
    [ids.client, JSON.stringify({ displayName: 'Xandrelle Quizonwerth', email: 'xandrelle.q@realmail.ph', phone: '+639171234567', tin: '123-456-789-000' })]);
  await query('INSERT INTO documents(storage_key, file_name, category, entity, entity_id, status) VALUES ($1, $2, \'id-cards\', \'client\', $3, \'uploaded\')',
    [KEY, 'Xandrelle Quizonwerth ID.jpg', ids.client]);
  const batch = (await query("INSERT INTO data_load_batches(kit, status, file_name) VALUES ('migration', 'loaded', 'go-live.xlsx') RETURNING id")).rows[0].id;
  await query('INSERT INTO data_load_rows(batch_id, sheet, row_number, data) VALUES ($1, \'clients\', 3, $2)', [batch, JSON.stringify({
    firstName: 'Xandrelle', lastName: 'Quizonwerth', email: 'xandrelle.q@realmail.ph', tin: '123-456-789-000', birthDate: '1985-06-15' })]);

  // A staff member with two-factor authentication, a session and a password reset code.
  const staff = await ctx.api('post', '/users').send({ username: 'staffina.d', password: 'Staffina#2026a', displayName: 'Staffina Delarosaville',
    firstName: 'Staffina', lastName: 'Delarosaville', email: 'staffina@realbroker.ph', roles: ['sales'] });
  expect(staff.status, JSON.stringify(staff.body)).toBe(201);
  await request(ctx.app).post('/api/auth/login').send({ username: 'staffina.d', password: 'Staffina#2026a' });
  await query("UPDATE users SET totp_secret = 'enc:abc', totp_enabled = true, phone = '+639175550000', date_of_birth = '1990-01-20' WHERE username = 'staffina.d'");
  await query("INSERT INTO password_resets(user_id, code_hash, expires_at) SELECT id, 'x', now() + interval '1 hour' FROM users WHERE username = 'staffina.d'");

  originals = ['Xandrelle', 'Quizonwerth', 'xandrelle.q@realmail.ph', '9171234567', '917 123 4567', '123-456-789', 'Zentrovia', 'ops@zentrovia.ph',
    '765 4321', 'Brontavia', 'Yllescas', '9189876543', 'Totoong', 'ZXA 9123', 'MHFZZ1234567B9012', '2NRX987654', 'N01-23-456789', 'P7654321Q',
    '203.0.113.7', '1985-06-15', 'Zuhaybar', 'Tunay na Daan', 'Xandrelle_Quizonwerth', '9175550000', '1990-01-20'];
});
afterAll(async () => {
  await pool.end();
});

describe('personal data catalogue', () => {
  it('names existing columns with known rules', async () => {
    const cols = await columnsOf();
    const missing = Object.keys(CATALOGUE).filter((k) => { const [t, c] = k.split('.'); return !cols.get(t)?.some((x) => x.name === c); });
    expect(missing, 'catalogue entries for columns that no migration creates').toEqual([]);
    for (const k of Object.keys(CATALOGUE)) {
      const [t, c] = k.split('.');
      expect(RULES, k).toContain(catalogueEntry(t, c).rule);
      expect(allowReason(t, c) && ALLOW_LIST[k], `${k} is both catalogued and allow-listed`).toBeFalsy();
    }
    for (const t of Object.keys(TABLE_ACTIONS)) expect(cols.has(t), t).toBe(true);
  });

  it('covers every column the data dictionary classifies as personal (or keeps it with a reason)', async () => {
    const cols = await columnsOf();
    const dd = dataDictionaryPersonal();
    expect(dd.length).toBeGreaterThan(100);
    const gaps = dd.filter(([t, c]) => cols.get(t)?.some((x) => x.name === c))
      .filter(([t, c]) => !catalogueEntry(t, c) && !allowReason(t, c)).map(([t, c]) => `${t}.${c}`);
    expect(gaps, 'personal per docs/package/tools/data-dictionary/pii.py: add to CATALOGUE or ALLOW_LIST of scripts/lib/pii-catalogue.js').toEqual([]);
  });

  it('covers every column whose name looks personal (a new migration must classify its personal columns)', async () => {
    const cols = await columnsOf();
    const gaps = [];
    for (const [t, cs] of cols) {
      for (const c of cs) {
        if (!TEXT_UDT.has(c.udt)) continue; // numbers, flags and time stamps (sum_insured, must_change_password, last_login_at)
        if (PERSONAL_NAME_RE.test(c.name) && !catalogueEntry(t, c.name) && !allowReason(t, c.name)) gaps.push(`${t}.${c.name}`);
      }
    }
    expect(gaps, 'add to CATALOGUE or ALLOW_LIST of scripts/lib/pii-catalogue.js').toEqual([]);
  });

  it('reads JSON keys by their name', () => {
    expect(jsonKeyRule('firstName')).toBe('firstName');
    expect(jsonKeyRule('LastName')).toBe('lastName');
    expect(jsonKeyRule('insuredName')).toBe('partyName');
    expect(jsonKeyRule('emailId')).toBe('emailList');
    expect(jsonKeyRule('thirdPartyContactNumber')).toBe('phone');
    expect(jsonKeyRule('PlateNumber')).toBe('plate');
    expect(jsonKeyRule('chassisNumber')).toBe('chassis');
    expect(jsonKeyRule('engineNumber')).toBe('engine');
    expect(jsonKeyRule('licenseNumber')).toBe('idNumber');
    expect(jsonKeyRule('dateOfBirth')).toBe('dob');
    expect(jsonKeyRule('locationAddress')).toBe('address');
    expect(jsonKeyRule('accountNumber')).toBe('bankAccount');
    expect(jsonKeyRule('remarks')).toBe('freeText');
    expect(jsonKeyRule('name')).toBe(null);
    expect(jsonKeyRule('name', { parentWords: ['driver'] })).toBe('partyName');
    expect(jsonKeyRule('createdBy')).toBe('keep');
    expect(jsonKeyRule('grossPremium')).toBe(null);
  });
});

describe('pseudonyms', () => {
  const m = new Masker({ salt: SALT, referenceDate: new Date('2026-10-04T00:00:00Z'), fileFolders: ['id-cards'] });
  it('are deterministic, keyed by the salt and recognisable', () => {
    expect(m.email('Juan@Real.ph')).toBe(m.email('juan@real.ph'));
    expect(m.email('juan@real.ph')).toMatch(/^user[0-9a-f]{12}@example\.test$/);
    expect(new Masker({ salt: `${SALT}x` }).email('juan@real.ph')).not.toBe(m.email('juan@real.ph'));
    expect(m.phone('+639171234567')).toMatch(/^\+63900\d{7}$/);
    expect(m.phone('0917 123 4567')).toMatch(/^0900 \d{3} \d{4}$/);
    expect(m.phone('0917 123 4567').replace(/\D/g, '').slice(1)).toBe(m.phone('+639171234567').replace(/\D/g, '').slice(2));
    expect(isMaskedMobile(m.phone('09171234567'))).toBe(true);
    expect(m.tin('123-456-789-000')).toMatch(/^999-\d{3}-\d{3}-000$/);
    expect(m.tin('123456789')).toBe(m.tin('123-456-789-000'));
    expect(m.personName('Juan Dela Cruz')).not.toMatch(/Juan|Cruz/);
    expect(m.personName('Juan Dela Cruz')).toContain('Dela');
    expect(m.personName('JUAN')).toBe(m.personName('Juan').toUpperCase());
    expect(m.companyName('Zentrovia Trading Corp.')).toMatch(/ Trading Corp\.$/);
    expect(m.companyName('Zentrovia Trading Corp.')).not.toContain('Zentrovia');
  });
  it('keep formats, ages and the last digits of bank accounts', () => {
    expect(m.plate('ZXA 9123')).toMatch(/^[A-Z]{3} \d{4}$/);
    expect(m.chassis('MHFZZ1234567B9012')).toMatch(/^[A-Z]{5}\d{7}[A-Z]\d{4}$/);
    expect(m.bankAccount('0012-3456-78')).toMatch(/^\d{4}-\d{2}56-78$/);
    for (const d of ['1985-06-15', '2000-10-04', '1999-10-05', '1970-02-28']) {
      const out = m.dob(d);
      expect(out).not.toBe(d);
      const age = (x) => { const a = new Date(`${x}T00:00:00Z`); const r = new Date('2026-10-04T00:00:00Z'); let n = r.getUTCFullYear() - a.getUTCFullYear(); if (r.getUTCMonth() < a.getUTCMonth() || (r.getUTCMonth() === a.getUTCMonth() && r.getUTCDate() < a.getUTCDate())) n -= 1; return n; };
      expect(age(out), d).toBe(age(d));
    }
    expect(m.address('77 Lacson St., Bacolod, Negros Occidental')).toMatch(/^\d+ .+, Bacolod, Negros Occidental$/);
    expect(m.storageKey(KEY)).toMatch(/^id-cards\/1700000000000-0123456789abcdef0123456789abcdef-masked-[0-9a-f]{8}\.jpg$/);
  });
  it('need a salt', () => {
    expect(() => new Masker({ salt: '' })).toThrow('MASK_SALT');
  });
});

describe('guards', () => {
  it('reads the options and refuses without confirmation or salt (before connecting)', async () => {
    expect(parseArgs(['--environment=UAT', '--execute', '--mask-staff', '--admin=root'])).toMatchObject({ environment: 'uat', execute: true, maskStaff: true, adminUsername: 'root' });
    expect(() => parseArgs(['--force'])).toThrow('unknown option');
    expect(() => parseArgs(['--purge-files'])).toThrow('--storage');
    const err = [];
    expect(await main(['--environment=uat'], {}, { out: () => {}, err: (x) => err.push(x) })).toBe(2);
    expect(err.join(' ')).toMatch(/CONFIRM_MASK=yes/);
    expect(await main(['--environment=uat'], { CONFIRM_MASK: 'yes' }, { out: () => {}, err: (x) => err.push(x) })).toBe(3);
    expect(err.join(' ')).toMatch(/MASK_SALT/);
  });

  it('refuses a missing salt, a production target, a missing administrator password or an unknown administrator', async () => {
    await withClient(async (c) => {
      await expect(maskData(c, { environment: 'uat', salt: '' })).rejects.toMatchObject({ code: 'MISSING_SALT' });
      await expect(maskData(c, { environment: 'production', salt: SALT })).rejects.toMatchObject({ code: 'BAD_ENVIRONMENT' });
      await expect(maskData(c, { environment: 'qa', salt: SALT })).rejects.toMatchObject({ code: 'BAD_ENVIRONMENT' });
      await expect(maskData(c, { environment: 'uat', salt: SALT, execute: true })).rejects.toMatchObject({ code: 'MISSING_ADMIN_PASSWORD' });
      await expect(maskData(c, { environment: 'uat', salt: SALT, execute: true, adminPassword: ADMIN_PASSWORD, adminUsername: 'nobody' })).rejects.toMatchObject({ code: 'UNKNOWN_ADMIN' });
      await expect(maskData(c, { environment: 'uat', salt: SALT, execute: true, adminPassword: 'short' })).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    });
    expect((await query("SELECT email FROM clients WHERE id = $1", [ids.client])).rows[0].email).toBe('xandrelle.q@realmail.ph');
  });

  it('refuses a database marked production, and a locked database without the marker', async () => {
    expect((await query("SELECT value FROM app_settings WHERE key = 'system.environment'")).rows[0].value).toBe('dev');
    await query("UPDATE app_settings SET value = '\"production\"' WHERE key = 'system.environment'");
    await withClient(async (c) => {
      const e = await maskData(c, { environment: 'uat', salt: SALT, execute: true, adminPassword: ADMIN_PASSWORD }).catch((x) => x);
      expect(e).toBeInstanceOf(MaskRefused);
      expect(e.code).toBe('PRODUCTION');
    });
    await query("DELETE FROM app_settings WHERE key = 'system.environment'");
    await query("UPDATE app_settings SET value = 'true' WHERE key = 'golive.locked'");
    await withClient(async (c) => {
      await expect(maskData(c, { environment: 'uat', salt: SALT })).rejects.toMatchObject({ code: 'PRODUCTION' });
    });
    // the DBA marks the restored copy (refresh procedure step 2): the lock stays on, the marker says what the copy is
    await query("INSERT INTO app_settings(key, value, \"group\", label, type) VALUES ('system.environment', '\"uat\"', 'system', 'Environment', 'string')");
    expect((await query("SELECT email FROM clients WHERE id = $1", [ids.client])).rows[0].email).toBe('xandrelle.q@realmail.ph');
  });
});

describe('masking a copy', () => {
  let before;
  let tb;
  let result;
  it('dry run: reports per table and column, changes nothing', async () => {
    before = await numericChecksums();
    tb = await trialBalance();
    const r = await withClient((c) => maskData(c, { environment: 'uat', salt: SALT }));
    expect(r.executed).toBe(false);
    const col = (t, c) => r.columns.find((x) => x.table === t && x.column === c);
    expect(col('clients', 'email').changed).toBeGreaterThan(0);
    expect(col('policies', 'doc').rule).toBe('json');
    expect(r.tables.find((t) => t.table === 'email_outbox').rows).toBeGreaterThan(0);
    expect((await query('SELECT count(*)::int AS n FROM email_outbox')).rows[0].n).toBeGreaterThan(0);
    expect((await query("SELECT email FROM clients WHERE id = $1", [ids.client])).rows[0].email).toBe('xandrelle.q@realmail.ph');
  });

  it('masks every personal value, everywhere', async () => {
    const lines = [];
    result = await withClient((c) => maskData(c, { environment: 'uat', salt: SALT, execute: true, adminPassword: ADMIN_PASSWORD, actor: 'dpo', now: new Date('2026-10-04T08:00:00Z') }));
    expect(result.executed).toBe(true);
    expect(result.verification.findings, JSON.stringify(result.verification.findings)).toEqual([]);
    const text = await allText();
    for (const o of originals) {
      const hits = text.filter((x) => x.s.toLowerCase().includes(o.toLowerCase()));
      if (hits.length) lines.push(`${o}: ${hits.map((h) => h.table).join(', ')}`);
    }
    expect(lines, 'original personal values left').toEqual([]);
    // sessions, reset codes, password history, sign-in history and the e-mail outbox are emptied
    for (const t of Object.keys(TABLE_ACTIONS)) expect((await query(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n, t).toBe(0);
  });

  it('is deterministic: the same original gives the same masked value in every table', async () => {
    const client = (await query('SELECT * FROM clients WHERE id = $1', [ids.client])).rows[0];
    const lead = (await query('SELECT * FROM leads WHERE id = $1', [ids.lead])).rows[0];
    const policy = (await query('SELECT * FROM policies WHERE id = $1', [ids.policy])).rows[0];
    const claim = (await query('SELECT * FROM claims WHERE id = $1', [ids.claim])).rows[0];
    const row = (await query('SELECT data FROM data_load_rows ORDER BY id DESC LIMIT 1')).rows[0].data;
    expect(client.display_name).toBe(`${client.first_name} ${client.last_name}`);
    expect([lead.first_name, lead.last_name, lead.email, lead.birth_date]).toEqual([client.first_name, client.last_name, client.email, client.birth_date]);
    expect(lead.phone.replace(/\D/g, '').slice(1)).toBe(client.phone.replace(/\D/g, '').slice(2));
    expect(policy.insured_name).toBe(client.display_name);
    expect(policy.doc.insuredName).toBe(client.display_name);
    expect(policy.doc.customerInfo).toMatchObject({ firstName: client.first_name, lastName: client.last_name, emailId: client.email, dateOfBirth: client.birth_date });
    expect(claim.driver.driverName).toBe(client.display_name);
    expect(row).toMatchObject({ firstName: client.first_name, email: client.email, tin: client.tin, birthDate: client.birth_date });
    expect(client.tin).toMatch(/^999-\d{3}-\d{3}-000$/);
    expect(client.email).toMatch(/@example\.test$/);
    expect(client.city).toBe('Makati');
    expect(client.address).not.toContain('Totoong');
    expect(policy.doc.plateNumber).toMatch(/^[A-Z]{3} \d{4}$/);
    expect(policy.doc.remarks).toBe('[masked]');
    expect(claim.description).toBe('[masked]');
    const jv = (await query('SELECT description FROM journal_vouchers WHERE id = $1', [ids.jv])).rows[0].description;
    const corporate = (await query('SELECT display_name, company_name FROM clients WHERE id = $1', [ids.corporate])).rows[0];
    expect(corporate.display_name).toBe(corporate.company_name);
    expect(corporate.company_name).toMatch(/ Trading Corp\.$/);
    expect(jv).toBe(`Premium of ${client.display_name}, ${corporate.company_name} (TIN ${client.tin})`);
    // file references follow the renamed storage key
    const doc = (await query("SELECT storage_key, file_name FROM documents WHERE entity_id = $1 AND category = 'id-cards'", [ids.client])).rows[0];
    expect(doc.storage_key).toMatch(/^id-cards\/1700000000000-0123456789abcdef0123456789abcdef-masked-[0-9a-f]{8}\.jpg$/);
    expect(doc.file_name).toMatch(/^masked-[0-9a-f]{8}\.jpg$/);
    expect(policy.doc.idCardUrl).toBe(`/api/s3/object/${doc.storage_key}`);
  });

  it('keeps figures, balances and the trial balance', async () => {
    const after = await numericChecksums();
    const skip = new Set(['users', 'audit_log', ...Object.keys(TABLE_ACTIONS)]);
    const changed = Object.keys(before).filter((t) => !skip.has(t) && before[t] !== after[t]);
    expect(changed, 'numeric columns changed').toEqual([]);
    expect(await trialBalance()).toEqual(tb);
  });

  it('keeps joins and search working on the masked names', async () => {
    const login = await request(ctx.app).post('/api/auth/login').send({ username: 'BrokerVerse', password: ADMIN_PASSWORD });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    const api = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${login.body.accessToken}`);
    const client = (await query('SELECT * FROM clients WHERE id = $1', [ids.client])).rows[0];
    const found = await api('get', `/clients?search=${encodeURIComponent(client.last_name)}`);
    expect(found.status).toBe(200);
    expect(JSON.stringify(found.body)).toContain(ids.client);
    const joined = (await query('SELECT c.display_name FROM policies p JOIN clients c ON c.id = p.client_id WHERE p.id = $1', [ids.policy])).rows[0];
    expect(joined.display_name).toBe(client.display_name);
    // the old session (token issued before the masking) no longer works
    expect((await ctx.api('get', '/clients')).status).toBe(401);
  });

  it('handles staff accounts: usernames and roles kept, sign-in reset, two-factor and sessions cleared', async () => {
    const staff = (await query("SELECT * FROM users WHERE username = 'staffina.d'")).rows[0];
    expect(staff.display_name).toBe('Staffina Delarosaville'); // names kept without --mask-staff
    expect(staff.email).toBe('staffina@realbroker.ph');
    expect(staff.phone).toMatch(/^\+63900/); // other personal data of staff always masked
    expect(staff.date_of_birth).not.toBe('1990-01-20');
    expect(staff.status).toBe('inactive');
    expect([staff.totp_secret, staff.totp_enabled]).toEqual([null, false]);
    expect((await query("SELECT count(*)::int AS n FROM user_roles ur JOIN users u ON u.id = ur.user_id WHERE u.username = 'staffina.d'")).rows[0].n).toBe(1);
    expect(result.verification.kept.some((k) => k.table === 'users' && k.column === 'email')).toBe(true);
    expect((await request(ctx.app).post('/api/auth/login').send({ username: 'staffina.d', password: 'Staffina#2026a' })).status).toBe(401);
  });

  it('switches e-mail sending off, marks the environment and records the run', async () => {
    clearSettingsCache();
    const s = Object.fromEntries((await query("SELECT key, value FROM app_settings WHERE key IN ('notification.email_enabled', 'system.environment', 'system.masked_at')")).rows.map((r) => [r.key, r.value]));
    expect(s).toEqual({ 'notification.email_enabled': false, 'system.environment': 'uat', 'system.masked_at': '2026-10-04T08:00:00.000Z' });
    await queueEmail({ to: 'someone@example.test', subject: 'x', html: 'x' });
    expect(await sendQueuedEmails()).toMatchObject({ sent: 0, reason: 'notification.email_enabled is false' });
    const audit = (await query("SELECT username, after_data FROM audit_log WHERE entity = 'database' AND action = 'mask'")).rows;
    expect(audit).toHaveLength(1);
    expect(audit[0].username).toBe('dpo');
    expect(audit[0].after_data).toMatchObject({ environment: 'uat', maskStaff: false });
    expect(JSON.stringify(audit[0].after_data)).not.toContain(SALT);
  });

  it('with --mask-staff and a shared staff password: staff names masked, staff sign in and must change the password', async () => {
    await query("UPDATE users SET status = 'active' WHERE username = 'staffina.d'");
    const r = await withClient((c) => maskData(c, { environment: 'training', salt: SALT, execute: true, adminPassword: ADMIN_PASSWORD, staffPassword: STAFF_PASSWORD, maskStaff: true }));
    expect(r.verification.findings).toEqual([]);
    expect(r.verification.kept).toEqual([]);
    const staff = (await query("SELECT * FROM users WHERE username = 'staffina.d'")).rows[0];
    expect(staff.display_name).not.toContain('Staffina');
    expect(staff.email).toMatch(/@example\.test$/);
    expect(staff.must_change_password).toBe(true);
    const login = await request(ctx.app).post('/api/auth/login').send({ username: 'staffina.d', password: STAFF_PASSWORD });
    expect(login.status, JSON.stringify(login.body)).toBe(200);
    const text = (await allText()).map((x) => x.s).join('\n');
    expect(text).not.toContain('Staffina');
    expect(text).not.toContain('staffina@realbroker.ph');
  });

  it('verification finds personal data left, and the files of the copy are replaced or purged', async () => {
    await query("UPDATE leads SET notes = 'call juan.real@gmail.com or 0917 765 1234, TIN 222-333-444' WHERE id = $1", [ids.lead]);
    const v = await withClient((c) => verifyMasked(c));
    expect(v.clean).toBe(false);
    expect(v.findings.filter((f) => f.table === 'leads' && f.column === 'notes').map((f) => f.kind).sort()).toEqual(['email', 'mobile', 'tin']);
    expect(JSON.stringify(v.findings)).not.toContain('juan.real@gmail.com');
    await query("UPDATE leads SET notes = '[masked]' WHERE id = $1", [ids.lead]);

    const storage = fs.mkdtempSync(path.join(os.tmpdir(), 'bv-mask-'));
    try {
      fs.mkdirSync(path.join(storage, 'id-cards'), { recursive: true });
      fs.mkdirSync(path.join(storage, 'logo'), { recursive: true });
      fs.writeFileSync(path.join(storage, KEY), 'scanned identity card');
      fs.writeFileSync(path.join(storage, 'logo', 'brand.png'), 'logo');
      const files = maskStorage(storage, result.masker, { execute: true });
      expect(files).toEqual([{ folder: 'id-cards', files: 1, action: 'replaced by a placeholder' }]);
      const doc = (await query("SELECT storage_key FROM documents WHERE category = 'id-cards' AND entity_id = $1", [ids.client])).rows[0];
      expect(fs.existsSync(path.join(storage, KEY))).toBe(false);
      expect(fs.readFileSync(path.join(storage, doc.storage_key)).subarray(1, 4).toString()).toBe('PNG');
      expect(fs.readFileSync(path.join(storage, 'logo', 'brand.png'), 'utf8')).toBe('logo');
      maskStorage(storage, result.masker, { execute: true, purge: true });
      expect(fs.existsSync(path.join(storage, 'id-cards'))).toBe(false);
      expect(fs.existsSync(path.join(storage, 'logo', 'brand.png'))).toBe(true);
    } finally {
      fs.rmSync(storage, { recursive: true, force: true });
    }
    expect(await tables()).toContain('documents');
  });
});

describe('re-marking a restored copy (--remark-copy)', () => {
  const setEnv = (v) => query("UPDATE app_settings SET value = $1::jsonb WHERE key = 'system.environment'", [JSON.stringify(v)]);
  const clientEmail = async () => (await query('SELECT email FROM clients WHERE id = $1', [ids.client])).rows[0].email;

  beforeAll(async () => {
    // the suite above masked this database: put back one original value to follow
    await query("UPDATE clients SET email = 'xandrelle.q@realmail.ph' WHERE id = $1", [ids.client]);
  });

  it('reads the options: database name and restore source are required', () => {
    expect(parseArgs(['--environment=uat', '--remark-copy', '--confirm-database=bv_uat', '--restore-source=prod-2026-10-01.dump']))
      .toMatchObject({ remarkCopy: true, confirmDatabase: 'bv_uat', restoreSource: 'prod-2026-10-01.dump' });
    expect(() => parseArgs(['--environment=uat', '--remark-copy'])).toThrow('--confirm-database');
    expect(parseArgs(['--register-production'])).toMatchObject({ registerProduction: true });
  });

  it('registers only a database marked production', async () => {
    await setEnv('uat');
    await withClient(async (c) => {
      await expect(registerProduction(c)).rejects.toMatchObject({ code: 'NOT_PRODUCTION' });
    });
  });

  it('refuses without the typed database name, without a registered production, and on production itself', async () => {
    await setEnv('production');
    await query("DELETE FROM app_settings WHERE key = 'system.production_identity'");
    await withClient(async (c) => {
      const db = (await databaseIdentity(c)).database;
      const opts = { environment: 'uat', salt: SALT, remarkCopy: true, restoreSource: 'prod.dump' };
      await expect(maskData(c, { ...opts, confirmDatabase: 'wrong_db' })).rejects.toMatchObject({ code: 'CONFIRM_DATABASE' });
      await expect(maskData(c, { ...opts, confirmDatabase: db, restoreSource: '' })).rejects.toMatchObject({ code: 'MISSING_RESTORE_SOURCE' });
      await expect(maskData(c, { ...opts, confirmDatabase: db })).rejects.toMatchObject({ code: 'NO_PRODUCTION_IDENTITY' });
      // registered here: this connection is production, so it is never re-marked
      await registerProduction(c, { actor: 'dba' });
      await expect(maskData(c, { ...opts, confirmDatabase: db })).rejects.toMatchObject({ code: 'PRODUCTION' });
    });
    expect((await query("SELECT value FROM app_settings WHERE key = 'system.environment'")).rows[0].value).toBe('production');
    expect(await clientEmail()).toBe('xandrelle.q@realmail.ph');
  });

  it('a dry run re-marks nothing; --execute re-marks the copy, records the restore and masks in the same step', async () => {
    // a copy restored elsewhere: the production record it carries names another server
    await query(`UPDATE app_settings SET value = jsonb_set(value, '{host}', '"10.20.0.5"') WHERE key = 'system.production_identity'`);
    await withClient(async (c) => {
      const db = (await databaseIdentity(c)).database;
      const opts = { environment: 'uat', salt: SALT, remarkCopy: true, confirmDatabase: db, restoreSource: 'prod-2026-10-01.dump', actor: 'dba' };
      const dry = await maskData(c, opts);
      expect(dry).toMatchObject({ executed: false, previousEnvironment: 'production', remark: { from: 'production', to: 'uat' } });
      expect((await query("SELECT value FROM app_settings WHERE key = 'system.environment'")).rows[0].value).toBe('production');
      const r = await maskData(c, { ...opts, execute: true, adminPassword: ADMIN_PASSWORD });
      expect(r.executed).toBe(true);
      expect(r.verification.clean).toBe(true);
    });
    expect((await query("SELECT value FROM app_settings WHERE key = 'system.environment'")).rows[0].value).toBe('uat');
    expect((await query("SELECT value FROM app_settings WHERE key = 'system.restored_from'")).rows[0].value)
      .toMatchObject({ from: 'production', to: 'uat', restoreSource: 'prod-2026-10-01.dump', by: 'dba', productionHost: '10.20.0.5' });
    const audit = (await query("SELECT action, username FROM audit_log WHERE entity = 'database' AND action IN ('remark', 'register-production', 'mask') ORDER BY id")).rows;
    expect(audit.map((a) => a.action).slice(-3)).toEqual(['register-production', 'remark', 'mask']);
    expect(await clientEmail()).not.toBe('xandrelle.q@realmail.ph');
  });
});

