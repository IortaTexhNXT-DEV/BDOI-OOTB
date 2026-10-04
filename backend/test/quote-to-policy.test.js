import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { publicWebUrl } from '../src/lib/publicWeb.js';
import { kycPrefill } from '../src/modules/policies/kyc.js';

let ctx;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const binary = (res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); };

beforeAll(async () => { ctx = await setup(); });
afterAll(async () => { await pool.end(); });

describe('authorised signatory of the order summary', () => {
  it('a fresh installation has an active signatory and the configured default comes first', async () => {
    const r = await ctx.api('get', '/master/signatory/get-all-signatory');
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThan(0);
    expect(r.body.data[0].isDefault).toBe(true);
    expect(r.body.data.filter((s) => s.isDefault)).toHaveLength(1);
    await q("INSERT INTO signatories(name, designation) VALUES ('Zeta Test Officer', 'Treasurer')");
    await q("UPDATE app_settings SET value = '\"Zeta Test Officer\"' WHERE key = 'documents.default_signatory'");
    clearSettingsCache();
    const again = await ctx.api('get', '/master/signatory/get-all-signatory');
    expect(again.body.data[0]).toMatchObject({ name: 'Zeta Test Officer', designation: 'Treasurer', isDefault: true });
  });

  it('the quotation PDF prints the chosen signatory with the designation', async () => {
    const lead = await ctx.api('post', '/leads').send({ firstName: 'Sig', lastName: 'Nature', emailId: 'sig.nature@example.ph', contactNumber: '09170000011', leadCategory: 'Retail' });
    const quote = await ctx.api('post', '/quotations').send({ leadRefId: lead.body.leadId, productType: 'Fire and Allied Perils', totalSumInsured: 1000000, netPremium: 4000, authorizedSignature: 'Zeta Test Officer' });
    expect(quote.status).toBe(201);
    const pdf = await ctx.api('get', `/document-templates/quote-template/${quote.body.quotationId}`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    const text = pdf.body.toString('latin1');
    expect(text).toContain('(Zeta Test Officer)');
    expect(text).toContain('(Treasurer)');
  });
});

describe('quotations for an existing client (no prospect)', () => {
  let quoteId;
  let clientId;
  it('the quotation names its insured from the client', async () => {
    const client = await ctx.api('post', '/clients').send({ firstName: 'Carla', lastName: 'Existing', emailId: 'carla.existing@example.ph', contactNumber: '09170000022' });
    expect(client.status).toBe(201);
    clientId = client.body.data?.clientId || client.body.clientId || client.body.data?.id;
    const quote = await ctx.api('post', '/quotations').send({ clientId, productType: 'Fire and Allied Perils', totalSumInsured: 1000000, netPremium: 4000 });
    expect(quote.status).toBe(201);
    quoteId = quote.body.quotationId;
    const r = await ctx.api('get', `/quotations/${quoteId}`);
    expect(r.body.lead).toBeNull();
    expect(r.body.insured).toMatchObject({ type: 'client', id: clientId, emailId: 'carla.existing@example.ph' });
    expect(r.body.insured.name).toMatch(/Carla/);
  });

  it('the ID captured on an earlier policy of the client is proposed for the new policy', async () => {
    await q(`INSERT INTO policies(policy_number, client_id, status, expiry_date, details) VALUES ('POL-KYC-1', $1, 'active', current_date + 300, $2)`,
      [clientId, JSON.stringify({ idType: 'UMID', idCardNumber: '0111-2222333-4', chassisNumber: 'OTHER-VEHICLE' })]);
    const r = await ctx.api('get', `/quotations/${quoteId}/kyc-prefill`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ idType: 'UMID', idCardNumber: '0111-2222333-4', chassisNumber: '' });
    // what the quotation itself holds wins over the history
    await q(`UPDATE quotes SET doc = doc || '{"idType":"Passport","insuranceVehicleDetails":[{"chassisNumber":"CH-123","plateNumber":"NAB 1234"}]}'::jsonb WHERE id = $1`, [quoteId]);
    const mine = await kycPrefill({ clientId, quoteId });
    expect(mine).toMatchObject({ idType: 'Passport', idCardNumber: '0111-2222333-4', chassisNumber: 'CH-123', plateNumber: 'NAB 1234', motorNumber: '' });
  });
});

describe('public web address of shared links', () => {
  it('a development default is replaced by PUBLIC_WEB_URL or the web origin in CORS_ORIGINS', async () => {
    await q("UPDATE app_settings SET value = '\"http://localhost:3000\"' WHERE key = 'general.frontend_url'");
    clearSettingsCache();
    expect(await publicWebUrl({ env: {}, cfg: { corsOrigins: ['*'] } })).toBe('http://localhost:3000');
    expect(await publicWebUrl({ env: {}, cfg: { corsOrigins: ['http://localhost:3000', 'https://web.broker.ph/'] } })).toBe('https://web.broker.ph');
    expect(await publicWebUrl({ env: { PUBLIC_WEB_URL: 'https://portal.broker.ph/' }, cfg: { corsOrigins: ['https://web.broker.ph'] } })).toBe('https://portal.broker.ph');
    await q("UPDATE app_settings SET value = '\"https://brokerverse.example.ph/\"' WHERE key = 'general.frontend_url'");
    clearSettingsCache();
    expect(await publicWebUrl({ env: { PUBLIC_WEB_URL: 'https://portal.broker.ph' }, cfg: { corsOrigins: [] } })).toBe('https://brokerverse.example.ph');
  });
});
