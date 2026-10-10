import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs, withDirectSend } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { quoteExpiry, quoteExpiryReminders, endOfBusinessDay } from '../src/modules/quotations/validity.js';

let ctx;
let associate;
let officer;
let officerId;
let associateId;
let leadId;
let now;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}
const motor = (extra = {}) => ({
  leadRefId: leadId, productType: 'Motor', insurancePolicyType: 'PC', lossAndDamageCoverage: '900000', lossAndDamageCoverageRate: '1.5',
  participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }], insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelYear: '2025', vehicleType: 'private_cars', seatingCapacity: '5' }],
  ...extra,
});
const newQuote = async (extra) => (await associate('post', '/quotations').send(motor(extra))).body;
const setValidity = (id, validUntil, issuedOn = null) => q('UPDATE quotes SET valid_until = $2, issued_on = COALESCE($3, issued_on) WHERE id = $1', [id, validUntil, issuedOn]);

beforeAll(async () => {
  ctx = await setup();
  await withDirectSend();
  const a = await persona('v.associate', ['tis-sales-associate']);
  const o = await persona('v.officer', ['tis-sales-officer']);
  associate = a.api; associateId = a.id; officer = o.api; officerId = o.id;
  const lead = await associate('post', '/leads').send({ firstName: 'Rhea', lastName: 'Villanueva', emailId: 'rhea.villanueva@example.ph', contactNumber: '09170000101', leadCategory: 'Retail' });
  leadId = lead.body.leadId;
  now = await today();
});
afterAll(async () => { await pool.end(); });

describe('quotation validity (QUOT-04, PROD-03)', () => {
  it('a new quotation is valid for the product validity, else the standard 30 days, from the business date', async () => {
    const qt = await newQuote();
    expect(qt.issuedOn).toBe(now);
    expect(qt.validUntil).toBe(addDays(now, 30));
    expect(qt.version).toBe(1);
    await q("UPDATE products SET quote_validity_days = 45 WHERE code = 'MOTOR'");
    const own = await newQuote({ productId: (await q("SELECT id FROM products WHERE code = 'MOTOR'"))[0].id });
    expect(own.validUntil).toBe(addDays(now, 45));
    await q("UPDATE products SET quote_validity_days = NULL WHERE code = 'MOTOR'");
    // the Product Master edits the validity; outside 1-366 days the database refuses it
    await expect(q("UPDATE products SET quote_validity_days = 0 WHERE code = 'MOTOR'")).rejects.toThrow();
    const type = await ctx.api('get', '/masters/product/definition');
    expect((type.body.data?.fields || type.body.fields || []).some((f) => f.name === 'quoteValidityDays')).toBe(true);
  });

  it('the detail carries the validity facts: last day, longest validity and whether Extend is offered', async () => {
    const qt = await newQuote();
    const r = await associate('get', `/quotations/${qt.quotationId}`);
    expect(r.body.validity).toMatchObject({ validUntil: addDays(now, 30), issuedOn: now, latestValidUntil: addDays(now, 60), daysLeft: 30, expired: false,
      extensionCount: 0, maxExtensions: 1, extensionDays: 30, extendable: true });
  });
});

describe('one-time extension with the 60-day hard stop (MC-11, PA-07, CR-03)', () => {
  let id;
  it('a Sales Associate cannot extend (extend:quotations)', async () => {
    id = (await newQuote()).quotationId;
    const r = await associate('post', `/quotations/${id}/extend`).send({});
    expect(r.status).toBe(403);
  });

  it('a Sales Officer extends a valid quotation once by 30 days, recorded with user, time and audit entry', async () => {
    const r = await officer('post', `/quotations/${id}/extend`).send({ remarks: 'Customer waiting for the loan release' });
    expect(r.status).toBe(200);
    expect(r.body.validUntil).toBe(addDays(now, 60));
    expect(r.body.extensionCount).toBe(1);
    expect(r.body.extendedBy).toBe('v.officer');
    expect(r.body.extensionRemarks).toBe('Customer waiting for the loan release');
    expect(r.body.validity.extendable).toBe(false);
    expect(r.body.message).toBe(`Quotation valid until ${addDays(now, 60).split('-').reverse().join('/')}`);
    const [a] = await q("SELECT * FROM audit_log WHERE entity = 'quotation' AND entity_id = $1 AND action = 'extend'", [id]);
    expect(a.after_data).toMatchObject({ validUntil: addDays(now, 60), extensionCount: 1 });
    const n = await q('SELECT title FROM notifications WHERE user_id = $1 AND entity_id = $2', [associateId, id]);
    expect(n.map((x) => x.title)).toContain('Quotation validity extended');
  });

  it('refuses a second extension', async () => {
    const r = await officer('post', `/quotations/${id}/extend`).send({});
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('was already extended');
  });

  it('never beyond 60 days from issue, even when more extensions are allowed', async () => {
    await q("UPDATE app_settings SET value = '2' WHERE key = 'quotations.max_extensions'");
    clearSettingsCache();
    const r = await officer('post', `/quotations/${id}/extend`).send({});
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('its longest validity');
    // a quotation with a shorter validity is extended up to the hard stop only
    const short = (await newQuote()).quotationId;
    await setValidity(short, addDays(now, 40));
    const capped = await officer('post', `/quotations/${short}/extend`).send({});
    expect(capped.body.validUntil).toBe(addDays(now, 60));
    await q("UPDATE app_settings SET value = '1' WHERE key = 'quotations.max_extensions'");
    clearSettingsCache();
  });

  it('refuses an expired, a spoiled, a rejected or a converted quotation', async () => {
    const past = (await newQuote()).quotationId;
    await setValidity(past, addDays(now, -1), addDays(now, -31));
    expect((await officer('post', `/quotations/${past}/extend`).send({})).body.message).toContain('expired on');
    await q("UPDATE quotes SET status = 'expired' WHERE id = $1", [past]);
    expect((await officer('post', `/quotations/${past}/extend`).send({})).body.message).toContain('has expired');
    const rejected = (await newQuote()).quotationId;
    await q("UPDATE quotes SET status = 'rejected' WHERE id = $1", [rejected]);
    const r = await officer('post', `/quotations/${rejected}/extend`).send({});
    expect(r.status).toBe(400);
    expect(r.body.message).toBe('A Rejected quotation cannot be extended');
    await q("UPDATE quotes SET status = 'converted' WHERE id = $1", [rejected]);
    expect((await officer('post', `/quotations/${rejected}/extend`).send({})).body.message).toBe('A ConvertedToPolicy quotation cannot be extended');
  });
});

describe('expiry reminder 5 days before the end of validity (MC-10, PA-06)', () => {
  it('reminds the owner once per validity date and e-mails the customer of a quotation waiting for the customer', async () => {
    const five = (await newQuote()).quotationId;
    const six = (await newQuote()).quotationId;
    const done = (await newQuote()).quotationId;
    await setValidity(five, addDays(now, 5));
    await setValidity(six, addDays(now, 6));
    await setValidity(done, addDays(now, 5));
    await q("UPDATE quotes SET status = 'converted' WHERE id = $1", [done]);
    await associate('post', `/quotations/${five}/send-for-approval`).send({});
    const r = await quoteExpiryReminders();
    expect(r.reminders).toBeGreaterThanOrEqual(1);
    const titled = async (id) => (await q("SELECT title FROM notifications WHERE entity = 'quotation' AND entity_id = $1 AND type = 'reminder'", [id])).map((x) => x.title);
    expect(await titled(five)).toEqual([expect.stringMatching(/expires on \d{2}\/\d{2}\/\d{4}$/)]);
    expect(await titled(six)).toEqual([]);
    expect(await titled(done)).toEqual([]);
    const mail = await q("SELECT to_address, subject FROM email_outbox WHERE template = 'quote_expiry_reminder' AND entity_id = $1", [five]);
    expect(mail).toHaveLength(1);
    expect(mail[0].to_address).toBe('rhea.villanueva@example.ph');
    await quoteExpiryReminders();
    expect(await titled(five)).toHaveLength(1);
  });

  it('is switched off with 0 days', async () => {
    await q("UPDATE app_settings SET value = '0' WHERE key = 'quotations.expiry_reminder_days'");
    clearSettingsCache();
    expect((await quoteExpiryReminders()).skipped).toBeTruthy();
    await q("UPDATE app_settings SET value = '5' WHERE key = 'quotations.expiry_reminder_days'");
    clearSettingsCache();
  });
});

describe('automatic spoil the day after validity (MC-12, PA-08)', () => {
  it('expires open quotations past validity, keeps the last valid day, converted ones and those with the insurer', async () => {
    const yesterday = (await newQuote()).quotationId;
    const lastDay = (await newQuote()).quotationId;
    const accepted = (await newQuote()).quotationId;
    const converted = (await newQuote()).quotationId;
    const placed = (await newQuote()).quotationId;
    for (const id of [yesterday, accepted, converted, placed]) await setValidity(id, addDays(now, -1));
    await setValidity(lastDay, now);
    await q("UPDATE quotes SET status = 'accepted' WHERE id = ANY($1)", [[accepted, placed]]);
    await q("UPDATE quotes SET status = 'converted' WHERE id = $1", [converted]);
    await q(`INSERT INTO placements(placement_number, source, quote_id, lead_id, status, product_type, lob)
      SELECT 'PS-TEST-0001', 'quote', id, lead_id, 'sent', product_type, lob FROM quotes WHERE id = $1`, [placed]);
    const r = await quoteExpiry();
    expect(r.expired).toBeGreaterThanOrEqual(2);
    const status = async (id) => (await q('SELECT status FROM quotes WHERE id = $1', [id]))[0].status;
    expect(await status(yesterday)).toBe('expired');
    expect(await status(accepted)).toBe('expired');
    expect(await status(lastDay)).toBe('draft');
    expect(await status(converted)).toBe('converted');
    expect(await status(placed)).toBe('accepted');
    const [a] = await q("SELECT * FROM audit_log WHERE entity = 'quotation' AND entity_id = $1 AND action = 'expire'", [accepted]);
    expect(a.before_data.quotationStatus).toBe('CustomerAccepted');
    expect(a.source).toMatchObject({ channel: 'job', name: 'quote-expiry' });
    expect((await quoteExpiry()).expired).toBe(0);
  });

  it('a spoiled quotation is not reopened and cannot be changed', async () => {
    const id = (await newQuote()).quotationId;
    await q("UPDATE quotes SET status = 'expired' WHERE id = $1", [id]);
    const reopen = await associate('put', `/quotations/${id}/status`).send({ status: 'Draft' });
    expect(reopen.status).toBe(400);
    expect(reopen.body.message).toBe('Cannot change a Expired quotation to Draft');
    expect((await associate('put', `/quotations/${id}`).send({ discount: '100' })).body.message).toContain('has expired');
  });

  it('refuses sending, accepting and converting once the validity has passed, before the job runs', async () => {
    const id = (await newQuote()).quotationId;
    const sent = await associate('post', `/quotations/${id}/send-for-approval`).send({});
    const token = new URL(sent.body.approvalUrl).searchParams.get('token');
    await setValidity(id, addDays(now, -1), addDays(now, -31));
    const accept = await request(ctx.app).post('/api/quotations/approve-by-customer').send({ token });
    expect(accept.status).toBe(400);
    expect(accept.body.message).toBe('This quotation has expired and can no longer be approved');
    const resp = await associate('post', `/quotations/${id}/customer-response`).send({ outcome: 'accepted', channel: 'Phone', responseDate: now, reference: 'Call' });
    expect(resp.status).toBe(400);
    expect(resp.body.message).toContain('expired on');
    await q("UPDATE quotes SET status = 'accepted' WHERE id = $1", [id]);
    const conv = await associate('post', `/quotations/${id}/convert-to-policy`).send({});
    expect(conv.status).toBe(400);
    expect(conv.body.message).toContain('converting it to a policy is not possible');
  });

  it('the approval link expires with the quotation (Asia/Manila end of the last valid day)', async () => {
    const id = (await newQuote()).quotationId;
    await setValidity(id, addDays(now, 2));
    await associate('post', `/quotations/${id}/send-for-approval`).send({});
    const link = await associate('get', `/quotations/${id}/approval-link`);
    expect(Date.parse(link.body.data.expiresAt)).toBeLessThanOrEqual(await endOfBusinessDay(addDays(now, 2)));
    // 1 October in Manila (UTC+8) ends at 2026-10-01T16:00Z
    expect(new Date(await endOfBusinessDay('2026-10-01')).toISOString()).toBe('2026-10-01T16:00:00.000Z');
  });
});

describe('a change creates a new version of the same quotation number (QUOT-04)', () => {
  let id;
  let number;
  let token;
  it('a Draft never sent is changed in place', async () => {
    const qt = await newQuote();
    id = qt.quotationId; number = qt.quotationNumber;
    const r = await associate('put', `/quotations/${id}`).send({ discount: '500' });
    expect(r.body.version).toBe(1);
    expect((await associate('get', `/quotations/${id}/versions`)).body.data.versions).toHaveLength(1);
  });

  it('a change after sending keeps v1 read-only and continues as v2 in Draft; the old link stops working', async () => {
    const sent = await associate('post', `/quotations/${id}/send-for-approval`).send({});
    token = new URL(sent.body.approvalUrl).searchParams.get('token');
    const v1 = (await associate('get', `/quotations/${id}`)).body;
    const r = await associate('put', `/quotations/${id}`).send({ discount: '1500', changeReason: 'Customer asked for a higher discount', version: 1 });
    expect(r.status).toBe(200);
    expect(r.body.message).toBe('Quotation updated as version 2');
    expect(r.body.quotationNumber).toBe(number);
    expect(r.body.version).toBe(2);
    expect(r.body.quotationStatus).toBe('Draft');
    expect(r.body.grossPremium).toBeCloseTo(v1.grossPremium - 1000, 2);
    const link = await request(ctx.app).post('/api/quotations/approve-by-customer').send({ token });
    expect(link.status).toBe(400);
    expect(link.body.message).toBe('This approval link has been replaced by a newer one');
    const list = (await associate('get', `/quotations/${id}/versions`)).body.data;
    expect(list.currentVersion).toBe(2);
    expect(list.versions.map((v) => [v.version, v.status, v.current])).toEqual([[2, 'Draft', true], [1, 'PendingCustomer', false]]);
    expect(list.versions[1].grossPremium).toBeCloseTo(v1.grossPremium, 2);
    expect(list.versions[1].supersededBy).toBe('v.associate');
    expect(list.versions[1].changeReason).toBe('Customer asked for a higher discount');
    const old = (await associate('get', `/quotations/${id}/versions/1`)).body;
    expect(old.readOnly).toBe(true);
    expect(old.grossPremium).toBeCloseTo(v1.grossPremium, 2);
    expect(old.discount).toBe(500);
    const [a] = await q("SELECT action FROM audit_log WHERE entity = 'quotation' AND entity_id = $1 AND action = 'new-version'", [id]);
    expect(a).toBeTruthy();
  });

  it('a superseded version cannot be changed; a third change after sending again is v3', async () => {
    const stale = await associate('put', `/quotations/${id}`).send({ discount: '10', version: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body.message).toContain('has been superseded by version 2');
    await associate('post', `/quotations/${id}/send-for-approval`).send({});
    const v3 = await associate('put', `/quotations/${id}`).send({ discount: '2000' });
    expect(v3.body.version).toBe(3);
    expect((await associate('get', `/quotations/${id}/versions`)).body.data.versions.map((v) => v.version)).toEqual([3, 2, 1]);
    expect((await q('SELECT count(*)::int AS n FROM quotes WHERE quote_number = $1', [number]))[0].n).toBe(1);
    expect((await associate('get', `/quotations/${id}/versions/9`)).status).toBe(404);
  });

  it('a change is refused while a placement slip is open for the quotation', async () => {
    await associate('post', `/quotations/${id}/send-for-approval`).send({});
    await q(`INSERT INTO placements(placement_number, source, quote_id, lead_id, status, product_type, lob)
      SELECT 'PS-TEST-0002', 'quote', id, lead_id, 'draft', product_type, lob FROM quotes WHERE id = $1`, [id]);
    const r = await associate('put', `/quotations/${id}`).send({ discount: '2500' });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('has placement slip PS-TEST-0002');
    expect(officerId).toBeTruthy();
  });
});
