/**
 * Seed 69_ph_practice_masters.sql: the Philippine practice reference masters (salutations, civil status, gender,
 * nationality, government ID types, customer types, payment modes, public holidays), the Philippine banks with their
 * SWIFT codes and the non-life insurers licensed by the Insurance Commission. Counts, key rows and idempotence.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { one, pool, query } from '../src/db/pool.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(here, '..', 'src', 'db', 'seeds', '69_ph_practice_masters.sql');
const TYPES = { salutation: 10, 'civil-status': 6, gender: 2, nationality: 17, 'government-id-type': 12, 'customer-type': 10, 'payment-mode': 17, holiday: 42 };
// payment modes: the 10 of seed 69 and the 7 TISPH modes (seed 80_tisph_configuration.sql); Stronghold is on the TISPH panel
const TISPH_PAYMENT_MODES = ['EFT', 'CARD', 'CHCK', 'E-WALLET', 'OTC', 'MC', 'ADA'];
// the starters MAPFRE, FPG and Mercantile are off the TISPH panel (seed 93_tisph_master_data.sql)
const PANEL_INSURERS = ['MALAYAN', 'PIONEER', 'STANDARD', 'STRONGHOLD'];

let ctx;
beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

const records = async (type) => (await query('SELECT code, name, data, status FROM master_records WHERE type_code = $1 ORDER BY (data->>\'sortOrder\')::int NULLS LAST, code', [type])).rows;
const byCode = (rows) => Object.fromEntries(rows.map((r) => [r.code, r]));

/** Counts that the seed must leave unchanged when it runs again. */
async function counts() {
  const types = (await query('SELECT type_code, count(*)::int AS n FROM master_records WHERE type_code = ANY($1) GROUP BY type_code', [Object.keys(TYPES)])).rows;
  return {
    ...Object.fromEntries(types.map((r) => [r.type_code, r.n])),
    masterTypes: (await one('SELECT count(*)::int AS n FROM master_types WHERE code = ANY($1)', [Object.keys(TYPES)])).n,
    banks: (await one('SELECT count(*)::int AS n FROM banks')).n,
    insurers: (await one('SELECT count(*)::int AS n FROM insurance_companies')).n,
    icInsurers: (await one("SELECT count(*)::int AS n FROM insurance_companies WHERE attrs ? 'icLineOfBusiness'")).n,
  };
}

describe('Philippine practice masters (seed 69)', () => {
  it('registers the eight master types as system masters with their counts', async () => {
    const types = (await query('SELECT code, label, is_system, storage FROM master_types WHERE code = ANY($1)', [Object.keys(TYPES)])).rows;
    expect(types).toHaveLength(8);
    for (const t of types) expect(t).toMatchObject({ is_system: true, storage: 'generic' });
    expect(await counts()).toMatchObject({ ...TYPES, masterTypes: 8 });
    const api = await ctx.api('get', '/masters');
    for (const [code, n] of Object.entries(TYPES)) expect(api.body.data.find((t) => t.code === code)?.count, code).toBe(n);
  });

  it('salutations, civil status and gender', async () => {
    const sal = byCode(await records('salutation'));
    expect(Object.keys(sal).sort()).toEqual(['ARCH', 'ATTY', 'DR', 'ENGR', 'HON', 'MISS', 'MR', 'MRS', 'MS', 'REV']);
    expect(sal.ATTY).toMatchObject({ name: 'Atty.', status: 'active' });
    expect(sal.ENGR.name).toBe('Engr.');
    const civil = byCode(await records('civil-status'));
    expect(Object.keys(civil).sort()).toEqual(['ANNULLED', 'DIVORCED', 'MARRIED', 'SEPARATED', 'SINGLE', 'WIDOWED']);
    expect(civil.SEPARATED.name).toBe('Legally Separated');
    expect((await records('gender')).map((r) => r.name)).toEqual(['Male', 'Female']);
  });

  it('nationalities: Filipino is the only default and names its ISO country', async () => {
    const rows = await records('nationality');
    expect(rows).toHaveLength(17);
    const defaults = rows.filter((r) => r.data.isDefault === true);
    expect(defaults.map((r) => r.code)).toEqual(['FIL']);
    expect(defaults[0]).toMatchObject({ name: 'Filipino' });
    expect(defaults[0].data.countryCode).toBe('PH');
    for (const r of rows) expect(r.data.countryCode, r.code).toMatch(/^[A-Z]{2}$/);
  });

  it('government ID types name the issuing agency; number formats are patterns, not sample numbers', async () => {
    const rows = await records('government-id-type');
    expect(rows).toHaveLength(12);
    const ids = byCode(rows);
    expect(Object.keys(ids).sort()).toEqual(['DL', 'GSIS', 'PASSPORT', 'PHILSYS', 'POSTAL', 'PRC', 'PWD', 'SENIOR', 'SSS', 'TIN', 'UMID', 'VOTER']);
    expect(ids.PHILSYS.data).toMatchObject({ issuingAgency: 'Philippine Statistics Authority (PhilSys)' });
    expect(ids.TIN.data.numberFormat).toBe('000-000-000-000');
    expect(ids.SSS.data.numberFormat).toBe('00-0000000-0');
    expect(ids.DL.data.issuingAgency).toBe('Land Transportation Office');
    for (const r of rows) {
      expect(r.data.issuingAgency, r.code).toBeTruthy();
      // a pattern uses 0 for a digit and A for a letter: no digit 1 to 9 of a real number
      expect(r.data.numberFormat || '', r.code).not.toMatch(/[1-9]/);
      expect(r.data.numberFormat || '', r.code).toMatch(/^[0A\- ]*( \(.*\))?$/);
    }
  });

  it('customer types carry the registration authority (DTI, SEC, CDA) and the client type', async () => {
    const rows = byCode(await records('customer-type'));
    expect(Object.keys(rows)).toHaveLength(10);
    expect(rows.INDIVIDUAL.data).toMatchObject({ clientType: 'individual', registrationAuthority: 'None', tinRequired: true });
    expect(rows.SOLE_PROP.data).toMatchObject({ clientType: 'corporate', registrationAuthority: 'DTI' });
    expect(rows.CORPORATION.data).toMatchObject({ clientType: 'corporate', registrationAuthority: 'SEC', registrationNumberLabel: 'SEC Company Registration No.' });
    expect(rows.OPC.data.registrationAuthority).toBe('SEC');
    expect(rows.COOPERATIVE.data).toMatchObject({ registrationAuthority: 'CDA', registrationNumberLabel: 'CDA Certificate of Registration No.' });
    for (const r of Object.values(rows)) expect(['individual', 'corporate'], r.code).toContain(r.data.clientType);
  });

  it('payment modes used in the Philippines', async () => {
    const rows = await records('payment-mode');
    expect(rows.map((r) => r.code)).toEqual(['CASH', 'CHECK', 'PDC', 'DEPOSIT', 'INSTAPAY', 'PESONET', 'GCASH', 'MAYA', 'CREDIT_CARD', 'DEBIT_CARD', ...TISPH_PAYMENT_MODES]);
    expect(byCode(rows).PDC.name).toBe('Post-dated Check');
  });

  it('public holidays of 2026 and 2027: 12 regular holidays and 9 special non-working days a year, dated', async () => {
    const rows = await records('holiday');
    expect(rows).toHaveLength(42);
    const tally = {};
    for (const r of rows) {
      expect(r.data.date, r.code).toMatch(/^202[67]-\d{2}-\d{2}$/);
      expect(r.code.startsWith(r.data.date), r.code).toBe(true);
      const k = `${r.data.date.slice(0, 4)} ${r.data.holidayType}`;
      tally[k] = (tally[k] || 0) + 1;
    }
    expect(tally).toEqual({ '2026 Regular Holiday': 12, '2026 Special Non-working Day': 9, '2027 Regular Holiday': 12, '2027 Special Non-working Day': 9 });
    const newYear = rows.filter((r) => r.data.date.endsWith('-01-01'));
    expect(newYear.map((r) => r.name)).toEqual(["New Year's Day", "New Year's Day"]);
    expect(rows.find((r) => r.data.date === '2026-06-12')).toMatchObject({ name: 'Independence Day' });
  });

  it('the 17 Philippine banks with the SWIFT code of the head office', async () => {
    const rows = (await query('SELECT code, name, swift_code, attrs FROM banks ORDER BY code')).rows;
    expect(rows).toHaveLength(17);
    const banks = byCode(rows);
    expect(banks.BDO).toMatchObject({ name: 'BDO Unibank, Inc.', swift_code: 'BNORPHMM' });
    expect(banks.BPI.swift_code).toBe('BOPIPHMM');
    expect(banks.LBP).toMatchObject({ name: 'Land Bank of the Philippines', swift_code: 'TLBPPHMM' });
    expect(banks.MBT.swift_code).toBe('MBTCPHMM');
    for (const b of rows) {
      expect(b.swift_code, b.code).toMatch(/^[A-Z]{4}PH[A-Z0-9]{2}([A-Z0-9]{3})?$/);
      expect(b.attrs.category, b.code).toBeTruthy();
    }
    expect(new Set(rows.map((b) => b.swift_code)).size).toBe(17);
  });

  it('the 51 non-life insurers licensed by the Insurance Commission: 44 inactive to activate, the starters on the TISPH panel and Stronghold active', async () => {
    const rows = (await query("SELECT code, name, short_name, status, attrs FROM insurance_companies WHERE attrs ? 'icLineOfBusiness' ORDER BY code")).rows;
    expect(rows).toHaveLength(51);
    for (const r of rows) {
      // the IC list carries the non-life companies and the composite (life and non-life) ones
      expect(['Non-life', 'Composite'], r.code).toContain(r.attrs.icLineOfBusiness);
      expect(r.name, r.code).toBeTruthy();
    }
    expect(rows.filter((r) => r.attrs.icLineOfBusiness === 'Composite').map((r) => r.code)).toEqual(['PARAMOUNT']);
    const active = rows.filter((r) => r.status === 'active').map((r) => r.code).sort();
    expect(active).toEqual(PANEL_INSURERS);
    expect(rows.filter((r) => r.status === 'inactive')).toHaveLength(47);
    const ins = byCode(rows);
    expect(ins.AIG).toMatchObject({ name: 'AIG Philippines Insurance, Inc.', short_name: 'AIG', status: 'inactive' });
    expect(ins.BPIMS.name).toBe('BPI/MS Insurance Corporation');
    expect(ins.TOKIOMARINE.name).toBe('Tokio Marine Malayan Insurance Corporation');
    expect(new Set(rows.map((r) => r.name.toLowerCase())).size).toBe(51);
  });

  it('is idempotent: running the seed again changes nothing, and administrator edits are kept', async () => {
    await query("UPDATE master_records SET name = 'Attorney' WHERE type_code = 'salutation' AND code = 'ATTY'");
    await query("UPDATE insurance_companies SET status = 'active' WHERE code = 'AIG'");
    const before = await counts();
    await pool.query(fs.readFileSync(SEED, 'utf8'));
    expect(await counts()).toEqual(before);
    expect((await one("SELECT name FROM master_records WHERE type_code = 'salutation' AND code = 'ATTY'")).name).toBe('Attorney');
    expect((await one("SELECT status FROM insurance_companies WHERE code = 'AIG'")).status).toBe('active');
    expect((await one("SELECT count(*)::int AS n FROM master_records WHERE type_code = 'nationality' AND data->>'isDefault' = 'true'")).n).toBe(1);
  });
});
