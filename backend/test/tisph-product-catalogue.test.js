/**
 * TISPH product catalogue (migration 0341 and the reference seeds): Motor, CTPL, Personal Accident (individual, group,
 * travel), Credit Life (compulsory, voluntary) and Parcel / Courier are sold; every other product, its templates,
 * rate tables and bundles are inactive, and Sales & Marketing is offered the active products only.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { lobOf } from '../src/modules/documents/common.js';

let ctx;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const ACTIVE = ['CL-COMP', 'CL-VOL', 'CTPL', 'GPA', 'MOTOR', 'PA', 'PARCEL', 'TRAVEL'];

beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('TISPH product catalogue', () => {
  it('keeps the TISPH products active and the others inactive, not deleted', async () => {
    const rows = await q('SELECT code, status FROM products ORDER BY code');
    expect(rows.filter((r) => r.status === 'active').map((r) => r.code)).toEqual(ACTIVE);
    expect(rows.map((r) => r.code)).toEqual(expect.arrayContaining(['FIRE', 'IAR', 'EB', 'MARINE', 'HULL', 'CGL', 'BOND', 'HOME']));
  });

  it('files Credit Life under its own line with the premium tax, Parcel / Courier under marine', async () => {
    const rows = await q("SELECT code, line, business_type, premium_tax_regime FROM products WHERE code IN ('CL-COMP', 'CL-VOL', 'PARCEL') ORDER BY code");
    expect(rows).toEqual([
      { code: 'CL-COMP', line: 'life', business_type: 'package', premium_tax_regime: 'premium_tax' },
      { code: 'CL-VOL', line: 'life', business_type: 'package', premium_tax_regime: 'premium_tax' },
      { code: 'PARCEL', line: 'marine', business_type: 'package', premium_tax_regime: 'vat' },
    ]);
    const lines = await q("SELECT code, name FROM master_records WHERE type_code = 'line-of-business' AND status = 'active' ORDER BY code");
    expect(lines).toEqual([{ code: 'ACCIDENT', name: 'Personal Accident' }, { code: 'LIFE', name: 'Credit Life' }, { code: 'MARINE', name: 'Marine' }, { code: 'MOTOR', name: 'Motor' }]);
    expect(lobOf('Credit Life - Compulsory')).toBe('LIFE');
    expect(lobOf('Parcel / Courier Insurance')).toBe('MARINE');
  });

  it('offers the motor cover types Comprehensive and TPL, and the travel policy types', async () => {
    const types = await q(`SELECT p.code AS product, t.code FROM policy_types t JOIN products p ON p.id = t.product_id
      WHERE t.status = 'active' ORDER BY p.code, t.code`);
    expect(types.filter((t) => t.product === 'MOTOR').map((t) => t.code)).toEqual(['COMP', 'TPL']);
    expect(types.filter((t) => t.product === 'TRAVEL').map((t) => t.code)).toEqual(['TRV-ANN', 'TRV-REN', 'TRV-ST']);
    expect(types.filter((t) => t.product === 'PA').map((t) => t.code)).toEqual(['PA-IND']);
  });

  it('deactivates the templates, rate tables and bundles of the inactive products', async () => {
    const templates = await q(`SELECT DISTINCT p.code FROM product_templates t JOIN products p ON p.id = t.product_id WHERE t.status = 'Active'`);
    expect(templates.map((r) => r.code).every((c) => ACTIVE.includes(c))).toBe(true);
    expect(await q("SELECT 1 FROM insurer_rate_tables r JOIN products p ON p.id = r.product_id WHERE r.active AND p.status <> 'active'")).toEqual([]);
    expect(await q("SELECT code FROM package_bundles WHERE status = 'active'")).toEqual([]);
  });

  it('has Pioneer, Maagap and AXA on the insurer master', async () => {
    const rows = await q("SELECT code FROM insurance_companies WHERE code IN ('PIONEER', 'MAAGAP', 'AXA') AND status = 'active' ORDER BY code");
    expect(rows.map((r) => r.code)).toEqual(['AXA', 'MAAGAP', 'PIONEER']);
  });

  it('offers Sales & Marketing the active products only', async () => {
    const r = await ctx.api('get', '/placements/options');
    expect(r.status).toBe(200);
    expect(r.body.data.products.map((p) => p.code).sort()).toEqual(ACTIVE);
    expect(r.body.data.products.find((p) => p.code === 'CL-VOL')).toMatchObject({ lob: 'LIFE', businessType: 'package' });
  });
});
