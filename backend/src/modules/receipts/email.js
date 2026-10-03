/**
 * Client e-mails with the document attached: the official receipt (receipts.email_subject / receipts.email_template)
 * and the premium invoice / statement of account of a bill (billing.email_subject / billing.email_template). Sent
 * from the screens (POST /receipts/:id/email, POST /billing-statement/bills/:id/email) or automatically when
 * receipts.email_on_record / billing.email_on_issue is on. The PDF is generated when the e-mail is sent.
 */
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { documentAttachment, queueEmail } from '../../lib/mailer.js';
import { renderTemplate } from '../../lib/template.js';
import { formatMoney } from '../../lib/money.js';
import { companyName } from '../../lib/letterhead.js';
import { printFormat } from '../../lib/pdf/index.js';
import { formatDate } from '../../lib/pdf/format.js';
import { paymentModeLabel } from '../documents/templates.js';

/** Bill sources that are e-mailed when issued (not the extra bills a receipt creates, nor go-live open items). */
const ISSUED_SOURCES = ['policy', 'endorsement', 'renewal', 'manual'];

const clientName = (c) => c?.display_name || [c?.first_name, c?.last_name].filter(Boolean).join(' ') || 'Valued Client';
const render = (tpl, vars) => renderTemplate(tpl, vars).replace(/<p>\s*<\/p>/g, '');
const listOf = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,;]/)).map((s) => String(s).trim()).filter(Boolean);

/** Recipients: the address typed on the screen, else the client's; 400 when there is none. */
function recipients(body, client) {
  const to = String(body?.to || '').trim() || client?.email || '';
  if (!to) throw badRequest('Validation failed', [{ path: 'to', message: 'The client has no e-mail address; enter one' }]);
  const cc = listOf(body?.cc);
  return { to, cc: cc.length ? cc.join(', ') : null };
}

async function dates() {
  const fmt = await printFormat();
  return (v) => (v ? formatDate(v, fmt) : '');
}

/** Open balance of the given policies' bills after the receipt (what the client still owes). */
async function openBalance(db, policyIds) {
  if (!policyIds.length) return 0;
  return Number((await db.query(`SELECT COALESCE(sum(balance), 0) AS b FROM receivables WHERE policy_id = ANY($1) AND status IN ('open','partial')`, [policyIds])).rows[0].b);
}

/** Queue the official receipt e-mail with its PDF. Returns { emailId, to, cc, subject }. */
export async function emailReceipt(db, ref, body = {}, { auto = false } = {}) {
  const r = (await db.query('SELECT * FROM receipts WHERE id = $1 OR receipt_number = $1', [String(ref)])).rows[0];
  if (!r) throw notFound('Receipt not found');
  if (r.receipt_status === 'Cancelled') throw conflict(`Receipt ${r.receipt_number} is cancelled; it cannot be e-mailed`);
  if (!(Number(r.amount) > 0)) throw conflict(`Receipt ${r.receipt_number} has no amount received yet`);
  const client = r.client_id ? (await db.query('SELECT * FROM clients WHERE id = $1', [r.client_id])).rows[0] : null;
  const { to, cc } = recipients(body, client);
  const lines = (await db.query('SELECT policy_id, policy_number FROM receipt_lines WHERE receipt_id = $1 ORDER BY line_no', [r.id])).rows;
  const policyIds = [...new Set([r.policy_id, ...lines.map((l) => l.policy_id)].filter(Boolean))];
  const policyNumbers = [...new Set([r.policy_number, ...lines.map((l) => l.policy_number)].filter((x) => x && x !== 'N/A'))];
  const date = await dates();
  const currency = r.currency_code || undefined;
  const vars = {
    clientName: r.customer_name || clientName(client), receiptNumber: r.receipt_number, policyNumber: policyNumbers.join(', '), amount: await formatMoney(r.amount, currency),
    receiptDate: date(r.received_date), paymentMode: paymentModeLabel(r.payment_mode), referenceNo: r.reference_no || '', balance: await formatMoney(await openBalance(db, policyIds), currency),
    customerCode: r.customer_code || '', companyName: await companyName(), note: String(body?.note || '').trim(),
  };
  const subject = renderTemplate(await getSetting('receipts.email_subject'), vars, { html: false });
  const emailId = await queueEmail({ db, to, cc, subject, html: render(await getSetting('receipts.email_template'), vars), template: auto ? 'official-receipt-auto' : 'official-receipt',
    entity: 'receipt', entityId: r.id, attachments: [documentAttachment('official-receipt', { receiptId: r.id }, `receipt-${r.receipt_number}.pdf`)] });
  return { emailId, to, cc, subject, receiptId: r.id, receiptNumber: r.receipt_number };
}

/** Queue the premium invoice / statement of account e-mail of one bill with its PDF. Returns { emailId, to, cc, subject }. */
export async function emailBill(db, ref, body = {}, { auto = false, user = null } = {}) {
  const b = (await db.query(`SELECT r.*, p.policy_number, p.client_id AS policy_client_id, ic.name AS insurer_name, pr.name AS product_name, p.product_type
    FROM receivables r JOIN policies p ON p.id = r.policy_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id LEFT JOIN products pr ON pr.id = p.product_id
    WHERE r.id = $1 OR r.bill_number = $1`, [String(ref)])).rows[0];
  if (!b) throw notFound('Bill not found');
  if (['cancelled', 'written-off'].includes(b.status)) throw conflict(`Bill ${b.bill_number} is ${b.status}; it cannot be e-mailed`);
  const clientId = b.client_id || b.policy_client_id;
  const client = clientId ? (await db.query('SELECT * FROM clients WHERE id = $1', [clientId])).rows[0] : null;
  const { to, cc } = recipients(body, client);
  const date = await dates();
  const money = (v) => formatMoney(Number(v || 0), b.currency || undefined);
  const company = await companyName();
  const instructions = renderTemplate((await getSetting('billing.payment_instructions')) || '', { companyName: company, billNumber: b.bill_number, policyNumber: b.policy_number }, { html: false });
  const vars = {
    clientName: clientName(client), billNumber: b.bill_number, policyNumber: b.policy_number, insurerName: b.insurer_name || '', productName: b.product_name || b.product_type || '',
    netPremium: await money(b.net_premium), taxes: await money(Number(b.vat || 0) + Number(b.dst || 0) + Number(b.lgt || 0) + Number(b.other_charges || 0)),
    grossPremium: await money(b.amount), amountDue: await money(b.balance), billDate: date(b.created_at), dueDate: date(b.due_date), paymentInstructions: instructions,
    companyName: company, note: String(body?.note || '').trim(),
  };
  const subject = renderTemplate(await getSetting('billing.email_subject'), vars, { html: false });
  const emailId = await queueEmail({ db, to, cc, subject, html: render(await getSetting('billing.email_template'), vars), template: auto ? 'premium-invoice-auto' : 'premium-invoice',
    entity: 'receivable', entityId: b.id, attachments: [documentAttachment('premium-invoice', { receivableId: b.id }, `invoice-${b.bill_number}.pdf`)] });
  // logged on the collection item of the bill (Accounts > Collections > Detail > Follow-up history)
  await db.query(`INSERT INTO collection_actions(collection_id, action_type, action_by, notes, email_id)
    SELECT id, 'Email', $2, $3, $4 FROM collection_items WHERE receivable_id = $1`, [b.id, user?.username || 'system', subject, emailId]);
  return { emailId, to, cc, subject, receivableId: b.id, billNumber: b.bill_number };
}

/**
 * receipts.email_on_record: e-mail a receipt once it has money received, the first time only (a Draft receipt goes
 * when it is approved). Skipped silently when the client has no e-mail address.
 */
export async function autoEmailReceipt(db, receiptId) {
  if (!(await getSetting('receipts.email_on_record', false))) return null;
  const r = (await db.query('SELECT id, amount, receipt_status, client_id FROM receipts WHERE id = $1', [receiptId])).rows[0];
  if (!r || r.receipt_status === 'Cancelled' || !(Number(r.amount) > 0)) return null;
  const done = (await db.query(`SELECT 1 FROM email_outbox WHERE entity = 'receipt' AND entity_id = $1 AND template = 'official-receipt-auto' LIMIT 1`, [r.id])).rows[0];
  if (done) return null;
  const email = r.client_id ? (await db.query('SELECT email FROM clients WHERE id = $1', [r.client_id])).rows[0]?.email : null;
  if (!email) return null;
  return emailReceipt(db, r.id, {}, { auto: true });
}

/** billing.email_on_issue: e-mail the invoice of a bill just issued (policy, endorsement, renewal); skipped without a client e-mail. */
export async function autoEmailBill(db, bill) {
  if (!ISSUED_SOURCES.includes(bill.source || 'policy')) return null;
  if (!(await getSetting('billing.email_on_issue', false))) return null;
  const email = bill.client_id ? (await db.query('SELECT email FROM clients WHERE id = $1', [bill.client_id])).rows[0]?.email : null;
  if (!email) return null;
  return emailBill(db, bill.id, {}, { auto: true });
}
