/**
 * TISPH credit terms (migration 0525; TIS-BRD-COLL-01): instalment plans monthly only; a corporate client has
 * collections.corporate_credit_days (90) to pay when its insurer sets no premium warranty, an individual the default.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setup } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { getSetting } from '../src/lib/settings.js';
import { resolveCreditTerms } from '../src/modules/commission-rates/terms.js';

const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
let corporate; let individual; let insurer;

beforeAll(async () => {
  await setup();
  [corporate] = await q("INSERT INTO clients(client_code, display_name, client_type, created_by) VALUES ('CL-CT-CORP', 'Credit Terms Corp.', 'corporate', 'test') RETURNING id");
  [individual] = await q("INSERT INTO clients(client_code, display_name, first_name, last_name, client_type, created_by) VALUES ('CL-CT-IND', 'Ana Terms', 'Ana', 'Terms', 'individual', 'test') RETURNING id");
  [insurer] = await q("INSERT INTO insurance_companies(code, name, status) VALUES ('CTINS', 'Credit Terms Insurance', 'active') RETURNING id");
});
afterAll(async () => { await pool.end(); });

describe('credit terms', () => {
  it('offers monthly instalments only', async () => {
    expect(await getSetting('credit.instalment_frequencies')).toEqual({ monthly: 1 });
  });

  it('gives a corporate client 90 days and an individual the default 30; the insurer premium warranty comes first', async () => {
    expect(await resolveCreditTerms(insurer.id, { clientId: corporate.id })).toMatchObject({ premiumWarrantyDays: 90, source: { premiumWarrantyDays: 'corporate' } });
    expect(await resolveCreditTerms(insurer.id, { clientId: individual.id })).toMatchObject({ premiumWarrantyDays: 30, source: { premiumWarrantyDays: 'setting' } });
    expect((await resolveCreditTerms(insurer.id)).premiumWarrantyDays).toBe(30);
    await q('UPDATE insurance_companies SET premium_warranty_days = 45 WHERE id = $1', [insurer.id]);
    expect(await resolveCreditTerms(insurer.id, { clientId: corporate.id })).toMatchObject({ premiumWarrantyDays: 45, source: { premiumWarrantyDays: 'insurer' } });
  });
});
