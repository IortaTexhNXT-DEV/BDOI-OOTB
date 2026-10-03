/**
 * Client document e-mails: the official receipt and the premium invoice go out with their PDF attached, the commission
 * debit note e-mail carries the debit note, and the outbox keeps only a reference that the mailer turns into the PDF
 * when the message is sent (transport mocked: what nodemailer would send is captured).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { buildMessage, documentAttachment, queueEmail, sendQueuedEmails } from '../src/lib/mailer.js';
import { createReceivable } from '../src/modules/receipts/receivables.js';
import { issuePolicy } from '../src/modules/policies/service.js';
import { generateDocument } from '../src/modules/documents/emailDocuments.js';

const sent = vi.hoisted(() => { process.env.SMTP_URL = 'smtp://mail.test.local:25'; return []; });
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: async (m) => { sent.push(m); return { messageId: `m${sent.length}` }; } }) } }));

let ctx;
beforeAll(async () => { ctx = await setupFinance(); });
afterAll(async () => { delete process.env.SMTP_URL; await pool.end(); });

const setting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const outbox = async (id) => (await query('SELECT * FROM email_outbox WHERE id = $1', [id])).rows[0];
const isPdf = (buf) => Buffer.isBuffer(buf) && buf.toString('latin1', 0, 5) === '%PDF-';

async function paidReceipt(net = 10000) {
  const x = await makePolicy({ net });
  const r = await ctx.as('maker')('post', '/receipts').send({ policyId: x.policy.id, amount: 5000, paymentMode: 'gcash', referenceNo: 'GC-7781' });
  expect(r.status).toBe(201);
  return { ...x, receipt: r.body.data };
}

describe('e-mail attachments in the outbox', () => {
  it('queues a document reference and the mailer builds the PDF when sending', async () => {
    const { receipt } = await paidReceipt();
    const id = await queueEmail({ to: 'someone@example.ph', subject: 'Test', html: '<p>x</p>', attachments: [documentAttachment('official-receipt', { receiptId: receipt.receiptId }, 'or.pdf'), { fileName: 'bad.pdf' }] });
    const row = await outbox(id);
    expect(row.attachments).toEqual([{ fileName: 'or.pdf', contentType: 'application/pdf', kind: 'document', document: 'official-receipt', params: { receiptId: receipt.receiptId } }]);
    const msg = await buildMessage(row);
    expect(msg.attachments).toHaveLength(1);
    expect(msg.attachments[0]).toMatchObject({ filename: 'or.pdf', contentType: 'application/pdf' });
    expect(isPdf(msg.attachments[0].content)).toBe(true);

    const list = await ctx.api('get', '/email/outbox?search=someone@example.ph');
    expect(list.body.data[0].attachments).toEqual([{ fileName: 'or.pdf', contentType: 'application/pdf', kind: 'document', document: 'official-receipt' }]);
  });

  it('sends the attachment through the transport, and fails a message over email.max_attachment_mb at once', async () => {
    const { receipt } = await paidReceipt();
    const att = [documentAttachment('official-receipt', { receiptId: receipt.receiptId }, `receipt-${receipt.receiptNumber}.pdf`)];
    const ok = await queueEmail({ to: 'ok@example.ph', subject: 'Receipt', html: '<p>x</p>', attachments: att });
    const big = await queueEmail({ to: 'big@example.ph', subject: 'Receipt', html: '<p>x</p>', attachments: att });
    await setting('notification.email_enabled', true);
    try {
      sent.length = 0;
      expect((await sendQueuedEmails({ ids: [ok] })).sent).toBe(1);
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ to: 'ok@example.ph', subject: 'Receipt' });
      expect(sent[0].attachments[0].filename).toBe(`receipt-${receipt.receiptNumber}.pdf`);
      expect(isPdf(sent[0].attachments[0].content)).toBe(true);
      expect((await outbox(ok)).status).toBe('sent');

      await setting('email.max_attachment_mb', 0.0001);
      expect((await sendQueuedEmails({ ids: [big] })).sent).toBe(0);
      const row = await outbox(big);
      expect(row).toMatchObject({ status: 'failed', attempts: 1 });
      expect(row.error).toMatch(/email\.max_attachment_mb/);
    } finally {
      await setting('notification.email_enabled', false);
      await setting('email.max_attachment_mb', 10);
    }
  });
});

describe('official receipt e-mail', () => {
  it('queues the receipt e-mail to the client with the PDF and the placeholders filled', async () => {
    const { client, policy, receipt } = await paidReceipt();
    const r = await ctx.as('maker')('post', `/receipts/${receipt.receiptId}/email`).send({ cc: 'accounts@example.ph, broker@example.ph', note: 'Thank you for settling early.' });
    expect(r.status).toBe(200);
    expect(r.body.message).toMatch(/queued/);
    expect(r.body.data).toMatchObject({ to: client.email, cc: 'accounts@example.ph, broker@example.ph' });
    const row = await outbox(r.body.data.emailId);
    expect(row).toMatchObject({ to_address: client.email, entity: 'receipt', entity_id: receipt.receiptId, template: 'official-receipt' });
    expect(row.subject).toBe(`Official receipt ${receipt.receiptNumber} for policy ${policy.policy_number}`);
    expect(row.body_html).toContain(client.display_name);
    expect(row.body_html).toContain('5,000.00');
    expect(row.body_html).toContain('GCash');
    expect(row.body_html).toContain('GC-7781');
    expect(row.body_html).toContain('Thank you for settling early.');
    expect(row.body_html).not.toMatch(/\{\{/);
    expect(row.attachments).toEqual([{ fileName: `receipt-${receipt.receiptNumber}.pdf`, contentType: 'application/pdf', kind: 'document', document: 'official-receipt', params: { receiptId: receipt.receiptId } }]);
    const audit = await query("SELECT 1 FROM audit_log WHERE entity = 'receipt' AND entity_id = $1 AND action = 'email'", [receipt.receiptId]);
    expect(audit.rows).toHaveLength(1);
  });

  it('is refused without an address (client without e-mail and none given), and goes to the address typed', async () => {
    const { client, receipt } = await paidReceipt();
    await query('UPDATE clients SET email = NULL WHERE id = $1', [client.id]);
    const r = await ctx.as('maker')('post', `/receipts/${receipt.receiptId}/email`).send({});
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toMatch(/no e-mail address/);
    expect((await ctx.as('maker')('post', `/receipts/${receipt.receiptId}/email`).send({ to: 'not-an-address' })).status).toBe(400);
    const typed = await ctx.as('maker')('post', `/receipts/${receipt.receiptId}/email`).send({ to: 'payer@example.ph' });
    expect(typed.status).toBe(200);
    expect((await outbox(typed.body.data.emailId)).to_address).toBe('payer@example.ph');
    expect((await ctx.as('agent')('post', `/receipts/${receipt.receiptId}/email`).send({ to: 'payer@example.ph' })).status).toBe(403);
  });
});

describe('premium invoice e-mail', () => {
  it('queues the invoice of a bill with gross premium, due date and payment instructions, and the invoice PDF prints', async () => {
    const { client, policy, gross } = await makePolicy({ net: 20000 });
    const bill = await withTransaction((db) => createReceivable(db, { policy: { ...policy, client_name: client.display_name }, amount: gross, breakdown: { netPremium: 20000, vat: 2400, dst: 2500, lgt: 150 }, source: 'policy', user: { id: ctx.userIds.maker } }));
    const r = await ctx.as('maker')('post', `/billing-statement/bills/${bill.bill_number}/email`).send({ note: 'First instalment is due soon.' });
    expect(r.status).toBe(200);
    const row = await outbox(r.body.data.emailId);
    expect(row.subject).toBe(`Premium invoice ${bill.bill_number} for policy ${policy.policy_number}`);
    expect(row).toMatchObject({ to_address: client.email, entity: 'receivable', entity_id: bill.id, template: 'premium-invoice' });
    expect(row.body_html).toContain(gross.toLocaleString('en-US', { minimumFractionDigits: 2 }));
    expect(row.body_html).toContain(`quote bill number ${bill.bill_number}`);
    expect(row.body_html).toContain('First instalment is due soon.');
    expect(row.body_html).not.toMatch(/\{\{/);
    expect(row.attachments[0]).toMatchObject({ fileName: `invoice-${bill.bill_number}.pdf`, document: 'premium-invoice', params: { receivableId: bill.id } });
    expect(isPdf((await buildMessage(row)).attachments[0].content)).toBe(true);
    expect((await query("SELECT 1 FROM audit_log WHERE entity = 'receivable' AND entity_id = $1 AND action = 'email'", [bill.id])).rows).toHaveLength(1);
    const logged = (await query(`SELECT a.* FROM collection_actions a JOIN collection_items ci ON ci.id = a.collection_id WHERE ci.receivable_id = $1`, [bill.id])).rows;
    expect(logged).toEqual([expect.objectContaining({ action_type: 'Email', action_by: 'fin.maker', email_id: r.body.data.emailId })]);

    const pdf = await ctx.as('maker')('get', `/billing-statement/bills/${bill.id}/generate`);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);

    await query('UPDATE clients SET email = NULL WHERE id = $1', [client.id]);
    expect((await ctx.as('maker')('post', `/billing-statement/bills/${bill.id}/email`).send({})).status).toBe(400);
    expect((await ctx.as('maker')('post', '/billing-statement/bills/INV-NONE/email').send({ to: 'x@example.ph' })).status).toBe(404);
  });
});

describe('automatic e-mails', () => {
  const count = async (entity, entityId, template) => (await query('SELECT count(*)::int AS n FROM email_outbox WHERE entity = $1 AND entity_id = $2 AND template = $3', [entity, entityId, template])).rows[0].n;

  it('receipts.email_on_record and billing.email_on_issue are off by default', async () => {
    const { receipt } = await paidReceipt();
    expect(await count('receipt', receipt.receiptId, 'official-receipt-auto')).toBe(0);
    const bills = (await query('SELECT id FROM receivables WHERE policy_id = $1', [receipt.policyRefId])).rows;
    expect(bills.length).toBeGreaterThan(0);
    for (const b of bills) expect(await count('receivable', b.id, 'premium-invoice-auto')).toBe(0);
  });

  it('sends the receipt when recorded and the invoice when a bill is issued once the switches are on', async () => {
    await setting('receipts.email_on_record', true);
    await setting('billing.email_on_issue', true);
    try {
      const { receipt } = await paidReceipt();
      expect(await count('receipt', receipt.receiptId, 'official-receipt-auto')).toBe(1);
      const more = await ctx.as('maker')('post', `/receipts/${receipt.receiptId}/add-payment`).send({ amount: 100 });
      expect(more.status).toBe(200);
      expect(await count('receipt', receipt.receiptId, 'official-receipt-auto')).toBe(1);

      const { policy, client, gross } = await makePolicy({ net: 12000 });
      const bill = await withTransaction((db) => createReceivable(db, { policy, amount: gross, source: 'policy', user: { id: ctx.userIds.maker } }));
      expect(await count('receivable', bill.id, 'premium-invoice-auto')).toBe(1);
      const row = (await query('SELECT * FROM email_outbox WHERE entity = \'receivable\' AND entity_id = $1', [bill.id])).rows[0];
      expect(row.to_address).toBe(client.email);
      expect(row.attachments[0].document).toBe('premium-invoice');
    } finally {
      await setting('receipts.email_on_record', false);
      await setting('billing.email_on_issue', false);
    }
  });
});

describe('commission debit note and policy schedule attachments', () => {
  it('the debit note e-mail to the insurer now carries the debit note PDF', async () => {
    const client = (await query(`INSERT INTO clients(client_code, display_name, first_name, last_name, created_by) VALUES ($1,'DN Mail Client','DN','Mail','test') RETURNING *`, [`CL-DNM-${Date.now().toString(36)}`])).rows[0];
    const ic = (await query('SELECT id FROM insurance_companies WHERE code = \'FPG\'')).rows[0];
    const product = (await query('SELECT id FROM products WHERE code = \'MOTOR\'')).rows[0];
    const issued = await withTransaction((db) => issuePolicy(db, {
      clientId: client.id, insuranceCompanyId: ic.id, productId: product.id, sumInsured: 1000000, netPremium: 100000, grossPremium: 125250, commissionAmount: 15000,
      commissionRate: 0.15, currency: 'PHP', insuredName: client.display_name, productType: 'Private Car Comprehensive', lob: 'MOTOR', agentUserId: ctx.userIds.sales, ownerUserId: ctx.userIds.sales,
    }, { billingMode: 'direct' }, ctx.userIds.maker));
    const pn = (await query('SELECT policy_number FROM policies WHERE id = $1', [issued.policyId])).rows[0].policy_number;
    const item = (await ctx.as('maker')('get', `/remittance/direct-bill/policies?insurerCode=FPG&search=${pn}`)).body.data.find((x) => x.policyId === issued.policyId);
    const raised = await ctx.as('maker')('post', '/remittance/direct-bill').send({ insurerCode: 'FPG', itemIds: [item.id], submit: true });
    expect(raised.status).toBe(201);
    expect((await ctx.as('checker')('post', `/remittance/direct-bill/${raised.body.data.id}/approve`).send({ remarks: 'ok' })).status).toBe(200);
    const send = await ctx.as('maker')('post', `/remittance/direct-bill/${raised.body.data.id}/send`).send({});
    expect(send.status).toBe(200);
    const row = (await query('SELECT * FROM email_outbox WHERE entity = \'commission_debit_note\' AND entity_id = $1', [raised.body.data.id])).rows[0];
    expect(row.attachments).toEqual([{ fileName: `debit-note-${raised.body.data.dnNumber}.pdf`, contentType: 'application/pdf', kind: 'document', document: 'commission-debit-note', params: { debitNoteId: raised.body.data.id } }]);
    expect(isPdf((await buildMessage(row)).attachments[0].content)).toBe(true);
  });

  it('builds the policy schedule attached to the policy issued e-mail', async () => {
    const { policy } = await makePolicy();
    const doc = await generateDocument('policy-schedule', { policyId: policy.id });
    expect(doc.fileName).toBe(`policy-schedule-${policy.policy_number}.pdf`);
    expect(isPdf(doc.content)).toBe(true);
    await expect(generateDocument('no-such-document', {})).rejects.toThrow(/Unknown document/);
  });
});
