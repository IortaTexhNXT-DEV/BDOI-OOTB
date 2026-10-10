import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { migrate } from '../src/db/migrate.js';
import { seed, seedTisphTestUsers } from '../src/db/seed.js';
import { pool, query } from '../src/db/pool.js';

const PASSWORD = 'Tisph#Uat2026!';
const EXPECTED = {
  'carla.mendoza': 'tis-sales-associate',
  'paolo.villanueva': 'tis-sales-officer',
  'teresa.lim': 'tis-sales-unit-head',
  'jenny.bautista': 'tis-ops-associate',
  'mark.castillo': 'tis-ops-officer',
  'liza.fernandez': 'tis-ops-unit-head',
  'rowena.cruz': 'tis-ccd-pdu',
  'allan.domingo': 'tis-ccd-pdc',
  'grace.navarro': 'tis-ccd-bp',
  'edwin.ramos': 'tis-ccd-recon',
  'cecilia.tan': 'tis-finance',
  'kevin.santiago': 'tis-it-admin',
  'antonio.delrosario': 'tis-general-manager',
};
const NAMES = Object.keys(EXPECTED);

const testUsers = () => query(`SELECT u.username, u.display_name, u.status, u.must_change_password, u.created_by, u.password_hash,
    array_agg(r.code ORDER BY r.code) AS roles
  FROM users u LEFT JOIN user_roles ur ON ur.user_id = u.id LEFT JOIN roles r ON r.id = ur.role_id
  WHERE u.username = ANY($1) GROUP BY u.id ORDER BY u.username`, [NAMES]).then((r) => r.rows);

describe('TISPH test users', () => {
  beforeAll(async () => {
    await migrate({ reset: true, log: () => {} });
    await seed({ log: () => {}, sampleData: false });
  });
  afterAll(() => pool.end());

  it('creates nobody without TISPH_TEST_USERS_PASSWORD', async () => {
    const lines = [];
    expect(await seedTisphTestUsers({ log: (l) => lines.push(l), source: {} })).toEqual([]);
    expect(lines).toEqual([]);
    expect(await testUsers()).toEqual([]);
  });

  it('refuses to run in production', async () => {
    const warnings = [];
    const created = await seedTisphTestUsers({ log: () => {}, warn: (l) => warnings.push(l), source: { TISPH_TEST_USERS_PASSWORD: PASSWORD, NODE_ENV: 'production' } });
    expect(created).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^WARNING: TISPH_TEST_USERS_PASSWORD is set in production/);
    expect(await testUsers()).toEqual([]);
  });

  it('creates one user per TISPH role with the password of the environment, to be changed at the first sign-in', async () => {
    const lines = [];
    const created = await seedTisphTestUsers({ log: (l) => lines.push(l), source: { TISPH_TEST_USERS_PASSWORD: PASSWORD } });
    expect(created.sort()).toEqual([...NAMES].sort());
    expect(lines).toEqual(['TISPH test users: 13 created, 0 already present']);
    const rows = await testUsers();
    expect(rows).toHaveLength(13);
    for (const u of rows) {
      expect(u.roles).toEqual([EXPECTED[u.username]]);
      expect(u.must_change_password).toBe(true);
      expect(u.status).toBe('active');
      expect(u.created_by).toBe('seed');
      expect(await bcrypt.compare(PASSWORD, u.password_hash)).toBe(true);
    }
    expect(rows.find((u) => u.username === 'carla.mendoza').display_name).toBe('Carla Mendoza');
    expect(rows.find((u) => u.username === 'antonio.delrosario').display_name).toBe('Antonio Delrosario');
  });

  it('keeps the password and roles of an existing user at the next seed', async () => {
    const changed = await bcrypt.hash('Changed#Pass2026!', 10);
    await query(`UPDATE users SET password_hash = $1, must_change_password = false WHERE username = 'teresa.lim'`, [changed]);
    await query(`DELETE FROM user_roles WHERE user_id = (SELECT id FROM users WHERE username = 'rowena.cruz')`);
    const lines = [];
    const created = await seedTisphTestUsers({ log: (l) => lines.push(l), source: { TISPH_TEST_USERS_PASSWORD: 'Another#Pass2026!' } });
    expect(created).toEqual([]);
    expect(lines).toEqual(['TISPH test users: 0 created, 13 already present']);
    const rows = await testUsers();
    expect(rows).toHaveLength(13);
    const teresa = rows.find((u) => u.username === 'teresa.lim');
    expect(teresa.password_hash).toBe(changed);
    expect(teresa.must_change_password).toBe(false);
    expect(rows.find((u) => u.username === 'rowena.cruz').roles).toEqual([null]);
    expect((await query(`SELECT count(*)::int AS n FROM users WHERE username = ANY($1)`, [NAMES])).rows[0].n).toBe(13);
  });

  it('runs from the seed with the variable set and rejects a password outside the policy', async () => {
    process.env.TISPH_TEST_USERS_PASSWORD = PASSWORD;
    try {
      await seed({ log: () => {}, sampleData: false });
    } finally {
      delete process.env.TISPH_TEST_USERS_PASSWORD;
    }
    expect(await testUsers()).toHaveLength(13);
    await expect(seedTisphTestUsers({ log: () => {}, source: { TISPH_TEST_USERS_PASSWORD: 'short' } })).rejects.toThrow(/Password must/);
  });
});
