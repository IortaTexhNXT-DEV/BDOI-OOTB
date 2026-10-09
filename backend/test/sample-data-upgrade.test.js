/**
 * Sample data on a database in use: an earlier sample term kept under a fixed id of the TISPH sample (migration 0365
 * keeps what a user worked on) is billed by the seed without its premium taxes and gets the breakdown of the TISPH
 * sample from migration 0369; a sample file that fails is rolled back and left out with a warning, a reference file
 * that fails stops the seed.
 */
import fs from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { seed } from '../src/db/seed.js';
import { pool } from '../src/db/pool.js';

const MIGRATION = fs.readFileSync(new URL('../src/db/migrations/0369_tisph_sample_data_kept_policies.sql', import.meta.url), 'utf8');
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const policy = async (id) => (await q('SELECT net_premium, premium_total, lob, details FROM policies WHERE id = $1', [id]))[0];
const conversions = async () => (await q(`SELECT after_data FROM audit_log WHERE entity = 'database' AND entity_id = 'sample-data' AND action = 'convert'
  AND after_data->>'migration' = '0369_tisph_sample_data_kept_policies'`)).map((r) => r.after_data);

/** Turns a TISPH sample term back into the shape the earlier sample left: no premium breakdown on the policy or its bill. */
async function earlierSampleTerm(id) {
  await q(`UPDATE policies SET details = '{"source": "seed", "businessType": "New Business"}', net_premium = 0, lob = NULL WHERE id = $1`, [id]);
  await q('UPDATE receivables SET net_premium = 0, vat = 0, dst = 0, lgt = 0, other_charges = 0 WHERE policy_id = $1', [id]);
}

beforeAll(async () => { await setup(); });
afterAll(async () => { await pool.end(); });

describe('earlier sample terms kept on a database in use', () => {
  it('the sample seed runs on a kept term without a premium breakdown', async () => {
    await earlierSampleTerm('pol_crs_20');
    const logs = [];
    const r = await seed({ log: (m) => logs.push(m), sampleData: true });
    expect(r.sampleSkipped, logs.join('\n')).toEqual([]);
    expect(logs.at(-1)).toBe('seed complete (reference + sample data)');
  });

  it('migration 0369 gives the kept term and its bill the breakdown of the TISPH sample, once', async () => {
    const other = await policy('pol_crs_01');
    const { premium_total: gross } = await policy('pol_crs_20');
    await pool.query(MIGRATION);
    const p = await policy('pol_crs_20');
    expect(Number(p.net_premium)).toBe(Number(gross));
    expect(p.lob).toBe('ACCIDENT');
    expect(p.details).toMatchObject({ source: 'seed', businessType: 'New Business', netPremium: Number(gross), valueAddedTax: 0, documentaryStampTax: 0,
      localGovernmentTax: 0, otherCharges: 0, grossPremium: Number(gross) });
    const [bill] = await q("SELECT amount, net_premium, vat FROM receivables WHERE id = 'rcv_crs_20'");
    expect(bill.net_premium).toBe(bill.amount);
    expect(Number(bill.vat)).toBe(0);
    expect(await policy('pol_crs_01')).toEqual(other);
    expect(await conversions()).toEqual([{ migration: '0369_tisph_sample_data_kept_policies', policies: ['pol_crs_20'], bills: 1 }]);

    await pool.query(MIGRATION);
    expect(await policy('pol_crs_20')).toEqual(p);
    expect(await conversions()).toHaveLength(1);
  });
});

describe('a seed file that fails', () => {
  it('a sample file is rolled back and left out with a warning; the reference and sample files after it still run', async () => {
    await q("DELETE FROM signatories WHERE name = 'Ana Patricia Lim'");
    await q('ALTER TABLE distribution_channels ADD CONSTRAINT seed_test_refused CHECK (false) NOT VALID');
    const logs = [];
    const warnings = [];
    try {
      const r = await seed({ log: (m) => logs.push(m), warn: (m) => { warnings.push(m); logs.push(m); }, sampleData: true });
      expect(r.sampleSkipped).toEqual(['sample/10_masters.sql']);
    } finally {
      await q('ALTER TABLE distribution_channels DROP CONSTRAINT seed_test_refused');
    }
    const warning = logs.findIndex((m) => m.startsWith('WARNING: sample data file sample/10_masters.sql was rolled back and left out: '));
    expect(warning, logs.join('\n')).toBeGreaterThan(-1);
    expect(logs[warning]).toContain('seed_test_refused');
    expect(warnings).toContain(logs[warning]);
    expect(logs).not.toContain('seeded sample/10_masters.sql');
    expect(logs.indexOf('seeded 84_lead_reassignment_reasons.sql')).toBeGreaterThan(warning);
    expect(logs.indexOf('seeded sample/98_integrations.sql')).toBeGreaterThan(warning);
    expect(logs.at(-1)).toBe('seed complete (reference + sample data; 1 sample file(s) left out, see the warnings above)');
    // the statements of the file before the one that failed are rolled back with it
    expect(await q("SELECT id FROM signatories WHERE name = 'Ana Patricia Lim'")).toHaveLength(0);

    const again = await seed({ log: () => {}, sampleData: true });
    expect(again.sampleSkipped).toEqual([]);
    expect(await q("SELECT id FROM signatories WHERE name = 'Ana Patricia Lim'")).toHaveLength(1);
  });

  it('a reference file stops the seed', async () => {
    await q('ALTER TABLE countries ADD CONSTRAINT seed_test_refused CHECK (false) NOT VALID');
    const logs = [];
    try {
      await expect(seed({ log: (m) => logs.push(m), sampleData: true })).rejects.toThrow(/seed_test_refused/);
    } finally {
      await q('ALTER TABLE countries DROP CONSTRAINT seed_test_refused');
    }
    expect(logs).not.toContain('seeded 10_masters.sql');
    expect(logs.some((m) => m.startsWith('WARNING: sample data file') || m.startsWith('seed complete'))).toBe(false);
  });
});
