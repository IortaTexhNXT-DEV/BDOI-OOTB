// Data privacy (RA 10173): consents per purpose, the data subject request register (numbering, due date, overdue
// reminders), the personal data export and anonymisation with its refusals (open business, retention period).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { today, addDays } from '../src/lib/dates.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { privacyRequestsDue } from '../src/jobs/handlers.js';

let ctx;
let now;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const yearsAgo = (n, extraDays = 0) => {
  const d = new Date(`${now}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - n);
  return addDays(d.toISOString().slice(0, 10), extraDays);
};

async function makeUser(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status).toBe(201);
  ids[username] = r.body.data.userId;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}

beforeAll(async () => {
  ctx = await setup();
  now = await today();
  await makeUser('pv.sales', ['sales']);
  await makeUser('pv.ops', ['operations']);
  await makeUser('pv.claims', ['claims']);
  const motor = '(SELECT id FROM products WHERE code = \'MOTOR\')';
  // a current client: policy in force with a premium balance
  await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, email, phone, tin, birth_date, city, house_no, extra, created_by)
    VALUES ('cl_pv1', 'CL-PV-0001', 'Lorna Bautista', 'Lorna', 'Bautista', 'lorna.bautista@example.ph', '09171112222', '123-456-789-000', '1980-05-05', 'Makati', '12',
      '{"notes":"Prefers calls after 5 pm"}', $1)`, [ids['pv.sales']]);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, status, inception_date, expiry_date, sum_insured, premium_total, insured_name, details)
    VALUES ('pol_pv1', 'POL-PV-0001', 'cl_pv1', ${motor}, 'active', $1::date - 100, $1::date + 265, 800000, 21000, 'Lorna Bautista',
      '{"customerInfo":{"firstName":"Lorna","lastName":"Bautista","emailId":"lorna.bautista@example.ph"}}')`, [now]);
  await query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status)
    VALUES ('INV-PV-0001', 'pol_pv1', 'cl_pv1', 21000, 6000, $1::date - 60, 'partial')`, [now]);
  await query(`INSERT INTO claims(id, claim_number, policy_id, client_id, status, loss_date, reported_date, estimate_amount)
    VALUES ('clm_pv1', 'CLM-PV-0001', 'pol_pv1', 'cl_pv1', 'registered', $1::date - 20, $1::date - 18, 45000)`, [now]);
  await query(`INSERT INTO receipts(receipt_number, policy_id, client_id, amount, received_date, payment_mode, status, customer_name)
    VALUES ('OR-PV-0001', 'pol_pv1', 'cl_pv1', 15000, $1::date - 70, 'Cash', 'active', 'Lorna Bautista')`, [now]);

  // a former client: last policy expired 12 years ago, everything settled
  await query(`INSERT INTO leads(id, lead_number, display_name, first_name, last_name, email, phone, notes, status)
    VALUES ('ld_pvold', 'LD-PV-0009', 'Ramon Aquino', 'Ramon', 'Aquino', 'ramon.aquino@example.ph', '09185556666', 'Met at the Cebu trade fair', 'Converted')`);
  await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, email, phone, tin, birth_date, city, barangay, lead_id)
    VALUES ('cl_pvold', 'CL-PV-0002', 'Ramon Aquino', 'Ramon', 'Aquino', 'ramon.aquino@example.ph', '09185556666', '987-654-321-000', '1965-01-31', 'Cebu City', 'Lahug', 'ld_pvold')`);
  await query('UPDATE leads SET client_id = \'cl_pvold\' WHERE id = \'ld_pvold\'');
  await query(`INSERT INTO policies(id, policy_number, client_id, lead_id, product_id, status, inception_date, expiry_date, sum_insured, premium_total, insured_name, details, doc)
    VALUES ('pol_pvold', 'POL-PV-0002', 'cl_pvold', 'ld_pvold', ${motor}, 'expired', $1, $2, 650000, 18500, 'Ramon Aquino',
      '{"customerInfo":{"firstName":"Ramon","lastName":"Aquino","emailId":"ramon.aquino@example.ph","contactNumber":"09185556666"},"grossPremium":18500}',
      '{"insuredName":"Ramon Aquino","plateNumber":"GAB 1234"}')`, [yearsAgo(13), yearsAgo(12)]);
  await query(`INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status)
    VALUES ('INV-PV-0002', 'pol_pvold', 'cl_pvold', 18500, 0, $1, 'paid')`, [yearsAgo(13, 30)]);
  await query(`INSERT INTO receipts(receipt_number, policy_id, client_id, amount, received_date, payment_mode, status, customer_name)
    VALUES ('OR-PV-0002', 'pol_pvold', 'cl_pvold', 18500, $1, 'Cheque', 'active', 'Ramon Aquino')`, [yearsAgo(13, 20)]);
  await query(`INSERT INTO claims(id, claim_number, policy_id, client_id, status, loss_date, reported_date, settled_amount, is_holder_driver, driver)
    VALUES ('clm_pvold', 'CLM-PV-0002', 'pol_pvold', 'cl_pvold', 'closed', $1, $1, 32000, true, '{"name":"Ramon Aquino","licenseNumber":"N01-23-456789"}')`, [yearsAgo(12, -100)]);
  await query(`INSERT INTO quotes(id, quote_number, lead_id, client_id, status, premium_total, doc)
    VALUES ('qt_pvold', 'QT-PV-0002', 'ld_pvold', 'cl_pvold', 'accepted', 18500, '{"lead":{"firstName":"Ramon","lastName":"Aquino","email":"ramon.aquino@example.ph"}}')`);

  // a client whose last policy expired three years ago (within the retention period)
  await query(`INSERT INTO clients(id, client_code, display_name, first_name, email) VALUES ('cl_pvmid', 'CL-PV-0003', 'Celia Mendoza', 'Celia', 'celia@example.ph')`);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, status, inception_date, expiry_date, premium_total)
    VALUES ('pol_pvmid', 'POL-PV-0003', 'cl_pvmid', ${motor}, 'expired', $1, $2, 9000)`, [yearsAgo(4), yearsAgo(3)]);

  // a prospect never converted, with a quotation
  await query(`INSERT INTO leads(id, lead_number, display_name, first_name, last_name, email, phone, birth_date, notes, status, owner_user_id)
    VALUES ('ld_pvfree', 'LD-PV-0001', 'Grace Villanueva', 'Grace', 'Villanueva', 'grace.v@example.ph', '09201234567', '1992-07-14', 'Interested in travel cover', 'New', $1)`, [ids['pv.sales']]);
  await query(`INSERT INTO quotes(id, quote_number, lead_id, status, premium_total, doc)
    VALUES ('qt_pvfree', 'QT-PV-0001', 'ld_pvfree', 'draft', 5200, '{"lead":{"firstName":"Grace","lastName":"Villanueva","mobileNumber":"09201234567"},"coverType":"Comprehensive"}')`);
});
afterAll(async () => { await new Promise((r) => { setTimeout(r, 50); }); await pool.end(); });

describe('consents', () => {
  let marketingId;
  it('records consent per purpose with the notice version in force, and lists the current status per purpose', async () => {
    const r = await as('pv.sales', 'post', '/privacy/consents').send({ partyType: 'client', partyId: 'cl_pv1', purpose: 'marketing', granted: true, channel: 'Form', evidence: 'Client information sheet' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ purpose: 'marketing', status: 'granted', noticeVersion: '1.0', channel: 'Form' });
    marketingId = r.body.data.id;
    const s = await as('pv.sales', 'post', '/privacy/consents').send({ partyType: 'client', partyId: 'CL-PV-0001', purpose: 'sharing', granted: false, channel: 'Phone' });
    expect(s.status).toBe(201);
    expect(s.body.data.status).toBe('refused');
    const g = await as('pv.sales', 'get', '/privacy/consents?partyType=client&partyId=cl_pv1');
    expect(g.status).toBe(200);
    const by = Object.fromEntries(g.body.data.purposes.map((p) => [p.purpose, p.status]));
    expect(by).toEqual({ processing: 'not-recorded', marketing: 'granted', sharing: 'refused' });
  });

  it('withdraws a consent; the history keeps both records and a later grant becomes current', async () => {
    const w = await as('pv.sales', 'post', `/privacy/consents/${marketingId}/withdraw`).send({ reason: 'Asked by e-mail to stop promotions' });
    expect(w.status).toBe(200);
    expect(w.body.data).toMatchObject({ status: 'withdrawn', withdrawalReason: 'Asked by e-mail to stop promotions' });
    expect((await as('pv.sales', 'post', `/privacy/consents/${marketingId}/withdraw`).send({ reason: 'again' })).status).toBe(409);
    await as('pv.sales', 'post', '/privacy/consents').send({ partyType: 'client', partyId: 'cl_pv1', purpose: 'marketing', granted: true, channel: 'Portal' });
    const g = await as('pv.sales', 'get', '/privacy/consents?partyType=client&partyId=cl_pv1');
    const marketing = g.body.data.history.filter((h) => h.purpose === 'marketing');
    expect(marketing.map((h) => h.status)).toEqual(['granted', 'withdrawn']);
    expect(g.body.data.purposes.find((p) => p.purpose === 'marketing').channel).toBe('Portal');
    expect(await one('SELECT count(*)::int AS n FROM audit_log WHERE entity = \'privacy_consent\'')).toEqual({ n: 4 });
  });

  it('a prospect\'s consent needs write:leads; a role without client write access is refused', async () => {
    const r = await as('pv.sales', 'post', '/privacy/consents').send({ partyType: 'lead', partyId: 'ld_pvfree', purpose: 'processing', granted: true, channel: 'In person' });
    expect(r.status).toBe(201);
    const c = await as('pv.claims', 'post', '/privacy/consents').send({ partyType: 'client', partyId: 'cl_pv1', purpose: 'processing', granted: true, channel: 'Form' });
    expect(c.status).toBe(403);
    expect((await as('pv.claims', 'get', '/privacy/consents?partyType=client&partyId=cl_pv1')).status).toBe(200);
  });

  it('the consent register is for read:privacy holders', async () => {
    expect((await as('pv.sales', 'get', '/privacy/consents/register')).status).toBe(403);
    const r = await as('pv.ops', 'get', '/privacy/consents/register?purpose=marketing&current=true');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0]).toMatchObject({ partyCode: 'CL-PV-0001', partyName: 'Lorna Bautista', status: 'granted', current: true });
  });
});

describe('data subject requests', () => {
  it('numbers a request from the DSR series and sets the due date privacy.request_due_days after receipt', async () => {
    const received = addDays(now, -3);
    const r = await as('pv.ops', 'post', '/privacy/requests').send({ partyType: 'client', partyId: 'cl_pv1', requesterName: 'Lorna Bautista',
      requesterContact: 'lorna.bautista@example.ph', requestType: 'access', receivedOn: received });
    expect(r.status).toBe(201);
    expect(r.body.data.requestNumber).toMatch(new RegExp(`^DSR-${received.slice(0, 4)}-00001$`));
    expect(r.body.data).toMatchObject({ dueOn: addDays(received, 15), status: 'open', overdue: false, partyName: 'Lorna Bautista' });
    const r2 = await as('pv.ops', 'post', '/privacy/requests').send({ requesterName: 'Walk-in caller', requestType: 'objection' });
    expect(r2.body.data.requestNumber).toMatch(/-00002$/);
    expect(r2.body.data.receivedOn).toBe(now);
    expect((await as('pv.ops', 'post', '/privacy/requests').send({ requesterName: 'X Y', requestType: 'access', receivedOn: addDays(now, 2) })).status).toBe(400);
  });

  it('sales cannot read or write the register; operations can update and close', async () => {
    expect((await as('pv.sales', 'get', '/privacy/requests')).status).toBe(403);
    expect((await as('pv.sales', 'post', '/privacy/requests').send({ requesterName: 'Someone', requestType: 'access' })).status).toBe(403);
    const list = await as('pv.ops', 'get', '/privacy/requests?status=open');
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(2);
    const id = list.body.data.items.find((x) => x.requestType === 'objection').id;
    const u = await as('pv.ops', 'put', `/privacy/requests/${id}`).send({ status: 'in-progress', assignedTo: ids['pv.ops'], responseNotes: 'Called back' });
    expect(u.status).toBe(200);
    expect(u.body.data).toMatchObject({ status: 'in-progress', assignedTo: ids['pv.ops'] });
    const c = await as('pv.ops', 'post', `/privacy/requests/${id}/close`).send({ status: 'rejected', outcome: 'No personal data of the caller is held' });
    expect(c.status).toBe(200);
    expect(c.body.data).toMatchObject({ status: 'rejected', closedOn: now });
    expect((await as('pv.ops', 'put', `/privacy/requests/${id}`).send({ responseNotes: 'late' })).status).toBe(409);
  });

  it('lists overdue requests and the daily job notifies read:privacy holders once a day', async () => {
    const r = await as('pv.ops', 'post', '/privacy/requests').send({ partyType: 'lead', partyId: 'ld_pvfree', requesterName: 'Grace Villanueva', requestType: 'erasure', receivedOn: addDays(now, -30) });
    expect(r.body.data.overdue).toBe(true);
    const overdue = await as('pv.ops', 'get', '/privacy/requests?overdue=true');
    expect(overdue.body.data.items.map((x) => x.requestNumber)).toEqual([r.body.data.requestNumber]);
    expect(overdue.body.data.summary.overdue).toBe(1);
    expect(await one('SELECT enabled, cron FROM scheduled_jobs WHERE code = \'privacy-requests-due\'')).toEqual({ enabled: false, cron: '0 7 * * *' });
    expect(await privacyRequestsDue()).toEqual({ overdue: 1, notified: 1 });
    expect(await privacyRequestsDue()).toEqual({ overdue: 1, notified: 0 });
    const n = await as('pv.ops', 'get', '/notifications?type=reminder');
    expect(n.body.data.notifications.some((x) => x.title === `Data subject request ${r.body.data.requestNumber} is overdue`)).toBe(true);
    const s = await as('pv.sales', 'get', '/notifications?type=reminder');
    expect(s.body.data.notifications.some((x) => x.entity === 'data_subject_request')).toBe(false);
  });
});

describe('personal data export', () => {
  it('returns the party\'s personal data, consents, policies, claims and receipts, and audits the export', async () => {
    const reqId = (await one('SELECT id FROM data_subject_requests WHERE party_id = \'cl_pv1\'')).id;
    const r = await as('pv.ops', 'get', `/privacy/parties/client/cl_pv1/export?requestId=${reqId}`);
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.personalData).toMatchObject({ firstName: 'Lorna', email: 'lorna.bautista@example.ph', tin: '123-456-789-000', birthDate: '1980-05-05' });
    expect(d.personalData.additionalDetails).toEqual({ notes: 'Prefers calls after 5 pm' });
    expect(d.policies.map((p) => p.policyNumber)).toEqual(['POL-PV-0001']);
    expect(d.policies[0].grossPremium).toBe(21000);
    expect(d.claims.map((c) => c.claimNumber)).toEqual(['CLM-PV-0001']);
    expect(d.receipts.map((c) => c.receiptNumber)).toEqual(['OR-PV-0001']);
    expect(d.consents.length).toBe(3);
    expect(d.dataSubjectRequests).toHaveLength(1);
    const a = await one('SELECT after_data FROM audit_log WHERE entity = \'client\' AND entity_id = \'cl_pv1\' AND action = \'privacy-export\'');
    expect(a.after_data).toMatchObject({ format: 'json', sections: { policies: 1, claims: 1, receipts: 1 } });
    const dsr = await one('SELECT status, actions FROM data_subject_requests WHERE id = $1', [reqId]);
    expect(dsr.status).toBe('in-progress');
    expect(dsr.actions.map((x) => x.action)).toEqual(['export']);
    expect((await as('pv.sales', 'get', '/privacy/parties/client/cl_pv1/export')).status).toBe(403);
  });

  it('downloads the export as a workbook', async () => {
    const r = await as('pv.ops', 'get', '/privacy/parties/lead/LD-PV-0001/export?format=xlsx').buffer(true).parse((res, cb) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toMatch(/spreadsheetml/);
    expect(r.headers['content-disposition']).toContain('personal-data-LD-PV-0001.xlsx');
    expect(r.body.subarray(0, 2).toString()).toBe('PK');
  });
});

describe('anonymisation', () => {
  it('refuses a client with a policy in force, a balance due and an open claim, listing the reasons', async () => {
    const dry = await as('pv.ops', 'get', '/privacy/parties/client/cl_pv1/anonymise/dry-run');
    expect(dry.status).toBe(200);
    expect(dry.body.data.allowed).toBe(false);
    expect(dry.body.data.blockers.map((b) => b.code)).toEqual(expect.arrayContaining(['in-force-policies', 'open-receivables', 'open-claims', 'retention-period']));
    expect(dry.body.data.cleared.clients.fields).toEqual(expect.arrayContaining(['email', 'phone', 'tin', 'birth_date', 'extra.notes']));
    const r = await as('pv.ops', 'post', '/privacy/parties/client/cl_pv1/anonymise').send({ reason: 'Erasure request received' });
    expect(r.status).toBe(409);
    expect(r.body.errors.map((e) => e.code)).toContain('in-force-policies');
    expect((await one('SELECT email FROM clients WHERE id = \'cl_pv1\'')).email).toBe('lorna.bautista@example.ph');
    expect((await as('pv.sales', 'post', '/privacy/parties/lead/ld_pvfree/anonymise').send({ reason: 'Erasure request' })).status).toBe(403);
  });

  it('refuses within the retention period (privacy.retention_years) and allows once it is over', async () => {
    const dry = await as('pv.ops', 'get', '/privacy/parties/client/cl_pvmid/anonymise/dry-run');
    // the AMLA records are kept 5 years (aml.record_retention_years) after the last policy expiry as well
    expect(dry.body.data.blockers.map((b) => b.code)).toEqual(['aml-retention', 'retention-period']);
    expect(dry.body.data.retention).toMatchObject({ years: 10, lastPolicyExpiry: yearsAgo(3) });
    await query('UPDATE app_settings SET value = \'2\' WHERE key IN (\'privacy.retention_years\', \'aml.record_retention_years\')');
    clearSettingsCache();
    try {
      const again = await as('pv.ops', 'get', '/privacy/parties/client/cl_pvmid/anonymise/dry-run');
      expect(again.body.data.allowed).toBe(true);
    } finally {
      await query('UPDATE app_settings SET value = \'10\' WHERE key = \'privacy.retention_years\'');
      await query('UPDATE app_settings SET value = \'5\' WHERE key = \'aml.record_retention_years\'');
      clearSettingsCache();
    }
  });

  it('anonymises a prospect never converted at once, including its quotation copy', async () => {
    const dsr = (await one('SELECT id, request_number FROM data_subject_requests WHERE party_id = \'ld_pvfree\''));
    const r = await as('pv.ops', 'post', '/privacy/parties/lead/ld_pvfree/anonymise').send({ reason: 'Erasure request of the prospect', requestId: dsr.id });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ label: 'Anonymised prospect LD-PV-0001', requestNumber: dsr.request_number });
    const l = await one('SELECT * FROM leads WHERE id = \'ld_pvfree\'');
    expect(l).toMatchObject({ display_name: 'Anonymised prospect LD-PV-0001', first_name: 'Anonymised prospect LD-PV-0001', last_name: null, email: null, phone: null, birth_date: null, notes: null, lead_number: 'LD-PV-0001' });
    expect(l.anonymised_at).not.toBeNull();
    const q = await one('SELECT doc, premium_total FROM quotes WHERE id = \'qt_pvfree\'');
    expect(q.doc).toEqual({ lead: { firstName: 'Anonymised prospect LD-PV-0001', lastName: null, mobileNumber: null }, coverType: 'Comprehensive' });
    expect(Number(q.premium_total)).toBe(5200);
    expect((await as('pv.ops', 'post', '/privacy/parties/lead/ld_pvfree/anonymise').send({ reason: 'Erasure request again' })).status).toBe(409);
  });

  it('refuses a converted prospect: the client is anonymised instead', async () => {
    const dry = await as('pv.ops', 'get', '/privacy/parties/lead/ld_pvold/anonymise/dry-run');
    expect(dry.body.data.blockers.map((b) => b.code)).toEqual(['converted']);
  });

  it('anonymises a former client beyond the retention period and keeps the financial records', async () => {
    const r = await as('pv.ops', 'post', '/privacy/parties/client/CL-PV-0002/anonymise').send({ reason: 'Erasure request; records past the retention period' });
    expect(r.status).toBe(200);
    const label = 'Anonymised client CL-PV-0002';
    const c = await one('SELECT * FROM clients WHERE id = \'cl_pvold\'');
    expect(c).toMatchObject({ display_name: label, first_name: label, last_name: null, email: null, phone: null, tin: null, birth_date: null, city: null, barangay: null, client_code: 'CL-PV-0002' });
    expect(c.anonymised_at).not.toBeNull();
    const l = await one('SELECT display_name, email, notes, anonymised_at FROM leads WHERE id = \'ld_pvold\'');
    expect(l).toMatchObject({ display_name: label, email: null, notes: null });
    const p = await one('SELECT * FROM policies WHERE id = \'pol_pvold\'');
    expect(p.insured_name).toBe(label);
    expect(p.details.customerInfo).toEqual({ firstName: label, lastName: null, emailId: null, contactNumber: null });
    expect(p.details.grossPremium).toBe(18500);
    expect(p.doc).toEqual({ insuredName: label, plateNumber: 'GAB 1234' });
    expect(Number(p.premium_total)).toBe(18500);
    expect(p.policy_number).toBe('POL-PV-0002');
    const rc = await one('SELECT amount, customer_name, receipt_number FROM receipts WHERE receipt_number = \'OR-PV-0002\'');
    expect(rc).toMatchObject({ customer_name: label, receipt_number: 'OR-PV-0002' });
    expect(Number(rc.amount)).toBe(18500);
    expect(Number((await one('SELECT amount FROM receivables WHERE bill_number = \'INV-PV-0002\'')).amount)).toBe(18500);
    const clm = await one('SELECT claim_number, settled_amount, driver FROM claims WHERE id = \'clm_pvold\'');
    expect(clm.claim_number).toBe('CLM-PV-0002');
    expect(Number(clm.settled_amount)).toBe(32000);
    expect(clm.driver).toEqual({ name: label, licenseNumber: null });
    expect((await one('SELECT doc FROM quotes WHERE id = \'qt_pvold\'')).doc.lead).toEqual({ firstName: label, lastName: null, email: null });
    // the audit trail names the fields cleared, never their values
    const a = await one('SELECT before_data, after_data FROM audit_log WHERE entity = \'client\' AND entity_id = \'cl_pvold\' AND action = \'anonymise\'');
    expect(a.before_data.cleared.clients.fields).toEqual(expect.arrayContaining(['email', 'phone', 'tin', 'birth_date']));
    expect(a.before_data.cleared.policies.fields).toEqual(expect.arrayContaining(['insured_name', 'details.emailId']));
    expect(JSON.stringify(a)).not.toContain('ramon.aquino@example.ph');
    expect(a.after_data.reason).toContain('Erasure request');
  });
});
