/**
 * Sample data on a database in use: a sample file that fails is rolled back and left out with a warning, a reference
 * file that fails stops the seed.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { seed } from '../src/db/seed.js';
import { pool } from '../src/db/pool.js';

const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

beforeAll(async () => { await setup(); });
afterAll(async () => { await pool.end(); });

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
