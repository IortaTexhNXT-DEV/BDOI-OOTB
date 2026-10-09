/**
 * Parked system journals (migration 0345, TIS-BRD-GL-03): the journal of an event listed in accounting.parked_events is
 * saved for approval and posted when a different user approves it (Journal Voucher, My Work > Approvals); it is not
 * rejected on its own, and cancelling its source document cancels it. Events that move a sub-ledger always post.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance } from './accounting.fixtures.js';
import { pool, query, withTransaction } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { today } from '../src/lib/dates.js';
import { ALWAYS_POSTED, EVENTS, parksOnSave, postEvent } from '../src/modules/accounting/lib/posting.js';
import { reverseJournal } from '../src/modules/accounting/lib/ledger.js';
import { withoutConfigurationApproval } from './helpers.js';

let ctx;
beforeAll(async () => { ctx = await setupFinance(); await withoutConfigurationApproval(); });
afterAll(async () => { await pool.end(); });

const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
/** A manual service invoice journal (sales_invoice.issue) created by the maker. */
const invoiceJournal = async () => withTransaction(async (db) => postEvent('sales_invoice.issue', { ...EVENTS['sales_invoice.issue'].sample, date: await today(), referenceType: 'SalesInvoice',
  transactionCode: 'SI-PARK' }, { db, user: { id: ctx.userIds.maker } }));
const jvRow = async (id) => (await query('SELECT * FROM journal_vouchers WHERE id = $1', [id])).rows[0];

describe('parked system journals', () => {
  it('TISPH parks the FGA.09 documents without an approval of their own; sub-ledger events always post', async () => {
    expect((await query("SELECT value FROM app_settings WHERE key = 'accounting.parked_events'")).rows[0].value)
      .toEqual(['directbill.collection', 'sales_invoice.issue', 'sales_invoice.payment', 'ap.payment']);
    expect(await parksOnSave('sales_invoice.issue')).toBe(true);
    expect(await parksOnSave('receipt.apply')).toBe(false);
    expect(Object.keys(ALWAYS_POSTED)).toEqual(expect.arrayContaining(['policy.issue.broker_billed', 'receipt.apply', 'directbill.commission', 'insurer.refund_applied']));
    const flow = (await ctx.as('maker')('get', '/posting-rules/flow')).body.data.events;
    expect(flow.find((e) => e.eventCode === 'sales_invoice.issue')).toMatchObject({ posting: 'parked', alwaysPosted: null });
    expect(flow.find((e) => e.eventCode === 'receipt.apply')).toMatchObject({ posting: 'posted', alwaysPosted: expect.stringContaining('sub-ledger') });
  });

  it('refuses a list with unknown events or events that always post', async () => {
    const bad = await ctx.api('put', '/system-settings/configuration').send({ settings: { 'accounting.parked_events': ['receipt.apply'] } });
    expect(bad.status).toBe(400);
    expect(bad.body.message).toMatch(/receipt\.apply always post/);
    expect((await ctx.api('put', '/settings').send({ settings: { 'accounting.parked_events': ['no.such.event'] } })).status).toBe(400);
    expect((await ctx.api('put', '/settings').send({ settings: { 'accounting.parked_events': 'ap.payment' } })).status).toBe(400);
  });

  it('a parked journal is approved by another user, listed in My Work > Approvals and never rejected on its own', async () => {
    const jv = await invoiceJournal();
    expect(jv.status).toBe('for-approval');
    expect(await jvRow(jv.id)).toMatchObject({ requires_approval: true, created_by: ctx.userIds.maker, posted_at: null });
    const queue = async (who) => (await ctx.as(who)('get', '/my-work/items?category=approvals')).body.data.map((x) => x.ref);
    expect(await queue('checker')).toContain(jv.jv_number);
    expect(await queue('maker')).not.toContain(jv.jv_number);
    const parked = await ctx.as('checker')('get', '/journal-vouchers/history?parked=true');
    expect(parked.body.data.map((x) => x.transactionNumber)).toContain(jv.jv_number);
    expect((await ctx.as('checker')('post', `/journal-vouchers/${jv.id}/reject`).send({ reason: 'Wrong account' })).status).toBe(409);
    expect((await ctx.as('maker')('post', `/journal-vouchers/${jv.id}/approve`)).status).toBe(403);
    const ok = await ctx.as('checker')('post', `/journal-vouchers/${jv.id}/approve`);
    expect(ok.status).toBe(200);
    expect(await jvRow(jv.id)).toMatchObject({ status: 'posted', approved_by: ctx.userIds.checker });
  });

  it('cancelling the source document cancels a parked journal; a posted one is reversed', async () => {
    const parked = await invoiceJournal();
    const out = await withTransaction((db) => reverseJournal(db, parked.id, { id: ctx.userIds.maker }));
    expect(out).toMatchObject({ id: parked.id, status: 'cancelled', cancelledUnposted: true });
    // the Reversal JV screen and the accounting query reverse posted journals only
    const other = await invoiceJournal();
    expect((await ctx.as('maker')('put', `/accounting/transactions/${other.id}/reverse`)).status).toBe(409);
    expect((await ctx.as('maker')('post', '/journal-vouchers/reversal').send({ transactionNumber: other.jv_number })).status).toBe(409);
    expect((await jvRow(other.id)).status).toBe('for-approval');
  });

  it('an event that is not listed posts at once; the ledger-wide switch still saves it pending', async () => {
    await setSetting('accounting.parked_events', []);
    expect((await invoiceJournal()).status).toBe('posted');
    await setSetting('accounting.auto_post_system_entries', false);
    expect((await invoiceJournal()).status).toBe('pending');
    await setSetting('accounting.auto_post_system_entries', true);
    await setSetting('accounting.parked_events', ['directbill.collection', 'sales_invoice.issue', 'sales_invoice.payment', 'ap.payment']);
  });
});
