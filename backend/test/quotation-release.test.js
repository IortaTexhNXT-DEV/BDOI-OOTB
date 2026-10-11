import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let associate;
let associateId;
let officer;
let officerId;
let lead;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}
const motor = () => ({
  leadRefId: lead, productType: 'Motor', insurancePolicyType: 'COMP', lossAndDamageCoverage: '950000', lossAndDamageCoverageRate: '2',
  participantDetails: [{ insuranceCompanyName: 'Malayan Insurance Co., Inc.' }], insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelYear: '2025', vehicleType: 'private_cars', seatingCapacity: '5' }],
});

beforeAll(async () => {
  ctx = await setup();
  const a = await persona('r.associate', ['tis-sales-associate']);
  associate = a.api; associateId = a.id;
  const o = await persona('r.officer', ['tis-sales-officer']);
  officer = o.api; officerId = o.id;
  lead = (await associate('post', '/leads').send({ firstName: 'Teresa', lastName: 'Lacson', emailId: 'teresa.lacson@example.ph', contactNumber: '09175550142', leadCategory: 'Retail' })).body.leadId;
});
afterAll(async () => { await pool.end(); });

describe('a quotation reaches the client through a second user (QUOT-03, MC-08)', () => {
  let id;
  it('the raiser cannot send it, nor approve it', async () => {
    const r = await associate('post', '/quotations').send(motor());
    id = r.body.quotationId;
    const mine = (await associate('get', `/quotations/${id}`)).body;
    expect(mine.approveBeforeSend).toBe(true);
    expect(mine.sendDecision).toMatchObject({ canDecide: false, blockedCode: 'RAISER' });
    expect((await officer('get', `/quotations/${id}`)).body.sendDecision).toMatchObject({ canDecide: true, blockedReason: null });
    const own = await associate('post', `/quotations/${id}/send-for-approval`).send({});
    expect(own.status).toBe(403);
    expect(own.body.message).toBe(mine.sendDecision.blockedReason);
    expect((await q('SELECT status FROM quotes WHERE id = $1', [id]))[0].status).toBe('draft');
  });

  it('another user with the approval approves it, which e-mails it to the client with the quotation slip', async () => {
    const r = await officer('post', `/quotations/${id}/send-for-approval`).send({});
    expect(r.status).toBe(200);
    expect(r.body.data.quotationStatus).toBe('PendingCustomer');
    const [row] = await q('SELECT status, approved_by, approved_at FROM quotes WHERE id = $1', [id]);
    expect(row).toMatchObject({ status: 'sent', approved_by: officerId });
    expect(row.approved_at).not.toBeNull();
    const [mail] = await q("SELECT to_address, attachments FROM email_outbox WHERE template = 'quote_approval' AND entity_id = $1", [id]);
    expect(mail.to_address).toBe('teresa.lacson@example.ph');
    expect(mail.attachments[0]).toMatchObject({ document: 'quotation-slip', params: { quoteId: id } });
    const { generateDocument } = await import('../src/modules/documents/emailDocuments.js');
    const pdf = await generateDocument('quotation-slip', { quoteId: id });
    expect(pdf.content.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('a new version needs the approval again', async () => {
    const changed = await associate('put', `/quotations/${id}`).send({ lossAndDamageCoverage: '980000', changeReason: 'Accessories added' });
    expect(changed.body.version).toBe(2);
    expect((await q('SELECT approved_by FROM quotes WHERE id = $1', [id]))[0].approved_by).toBeNull();
    expect((await associate('post', `/quotations/${id}/send-for-approval`).send({})).status).toBe(403);
    expect(associateId).not.toBe(officerId);
  });
});
