/** Billing statements (PDF on the shared document engine) for a policy, an endorsement or a renewal. */
import { notFound } from '../../lib/errors.js';
import { buildPdf } from '../../lib/pdf/index.js';
import { round2 } from '../accounting/lib/http.js';
import { findPolicy } from './receivables.js';
import { billingStatementDoc } from '../documents/finance.js';
import { humanize } from '../../lib/pdf/format.js';

const bills = async (db, policyId, sources) => (await db.query('SELECT * FROM receivables WHERE policy_id = $1 AND source = ANY($2) ORDER BY created_at', [policyId, sources])).rows;
const client = async (db, id) => (id ? (await db.query('SELECT * FROM clients WHERE id = $1', [id])).rows[0] || null : null);

export async function policyStatement(db, policyRef) {
  const p = await findPolicy(db, policyRef);
  if (!p) throw notFound('Policy not found');
  const spec = await billingStatementDoc('Policy', { policy: p, bills: await bills(db, p.id, ['policy', 'receipt', 'manual']), client: await client(db, p.client_id) });
  return { fileName: `policy-billing-statement-${p.policy_number}.pdf`, pdf: buildPdf(spec) };
}

async function resolveEndorsement(db, id) {
  const e = (await db.query('SELECT * FROM endorsements WHERE id = $1 OR endorsement_number = $1', [id])).rows[0];
  if (e) return { endorsement: e, policy: await findPolicy(db, e.policy_id) };
  const policy = await findPolicy(db, id);
  if (!policy) throw notFound('Endorsement or policy not found');
  const latest = (await db.query('SELECT * FROM endorsements WHERE policy_id = $1 ORDER BY created_at DESC LIMIT 1', [policy.id])).rows[0] || null;
  return { endorsement: latest, policy };
}

export async function endorsementPreview(db, id) {
  const { endorsement, policy } = await resolveEndorsement(db, id);
  const bills = (await db.query('SELECT bill_number, amount, balance, due_date, status FROM receivables WHERE policy_id = $1 AND source = \'endorsement\' ORDER BY created_at', [policy.id])).rows;
  return {
    policyId: policy.id, policyNumber: policy.policy_number, clientName: policy.client_name, insurer: policy.insurer_name,
    endorsement: endorsement ? { id: endorsement.id, endorsementNumber: endorsement.endorsement_number, type: endorsement.endorsement_type, status: endorsement.status,
      premiumDelta: Number(endorsement.premium_delta), effectiveDate: endorsement.effective_date } : null,
    bills: bills.map((b) => ({ billNumber: b.bill_number, amount: Number(b.amount), balance: Number(b.balance), dueDate: b.due_date, status: b.status })),
    totalDue: round2(bills.reduce((s, b) => s + Number(b.balance), 0)),
  };
}

export async function endorsementStatement(db, id) {
  const { endorsement, policy } = await resolveEndorsement(db, id);
  const extra = (f) => (endorsement ? [['Endorsement no.', endorsement.endorsement_number || endorsement.id], ['Type', humanize(endorsement.endorsement_type)], ['Effective date', f.date(endorsement.effective_date)],
    ['Premium change', f.ccy(endorsement.premium_delta, policy.currency)], ['Status', humanize(endorsement.status)]] : []);
  const spec = await billingStatementDoc('Endorsement', { policy, bills: await bills(db, policy.id, ['endorsement']), extra, number: endorsement?.endorsement_number, client: await client(db, policy.client_id),
    unbilled: { label: 'Premium change', amount: Number(endorsement?.premium_delta || 0) } });
  return { fileName: `endorsement-billing-statement-${endorsement?.endorsement_number || policy.policy_number}.pdf`, pdf: buildPdf(spec) };
}

/** A bill (receivable) by id or bill number with its policy; 404 when unknown. */
export async function findBill(db, ref) {
  const bill = (await db.query('SELECT * FROM receivables WHERE id = $1 OR bill_number = $1', [String(ref)])).rows[0];
  if (!bill) throw notFound('Bill not found');
  const policy = await findPolicy(db, bill.policy_id);
  if (!policy) throw notFound('Policy of the bill not found');
  return { bill, policy };
}

const SOURCE_KIND = { endorsement: 'Endorsement', renewal: 'Renewal' };

/** Premium invoice / statement of account of one bill: its premium, taxes and charges, the gross amount and the due date. */
export async function billStatement(db, ref) {
  const { bill: b, policy } = await findBill(db, ref);
  const n = (v) => Number(v || 0);
  const extra = (f) => [['Bill no.', b.bill_number], ['Bill date', f.date(b.created_at)], ['Due date', f.date(b.due_date)], ['Net premium', f.ccy(n(b.net_premium), b.currency)],
    ['VAT', f.ccy(n(b.vat), b.currency)], ['Documentary stamp tax', f.ccy(n(b.dst), b.currency)], ['Local government tax', f.ccy(n(b.lgt), b.currency)],
    ...(n(b.other_charges) ? [['Other charges', f.ccy(n(b.other_charges), b.currency)]] : []), ...(n(b.discount) ? [['Discount', f.ccy(-n(b.discount), b.currency)]] : []),
    ['Gross premium (with taxes)', f.ccy(n(b.amount), b.currency), { bold: true }]];
  const spec = await billingStatementDoc(SOURCE_KIND[b.source] || 'Premium', { policy, bills: [b], extra, number: b.bill_number, client: await client(db, b.client_id || policy.client_id) });
  return { fileName: `invoice-${b.bill_number}.pdf`, pdf: buildPdf(spec) };
}

export async function renewalStatement(db, policyRef) {
  const p = await findPolicy(db, policyRef);
  if (!p) throw notFound('Policy not found');
  const rn = (await db.query('SELECT * FROM renewals WHERE policy_id = $1 ORDER BY created_at DESC LIMIT 1', [p.id])).rows[0];
  const extra = (f) => (rn ? [['Renewal due', f.date(rn.due_date)], ['Current premium', f.ccy(rn.premium_old ?? p.premium_total, p.currency)], ['Renewal premium', f.ccy(rn.premium_new ?? p.premium_total, p.currency)]]
    : [['Renewal premium', f.ccy(p.premium_total, p.currency)]]);
  const spec = await billingStatementDoc('Renewal', { policy: p, bills: await bills(db, p.id, ['renewal']), extra, client: await client(db, p.client_id),
    unbilled: { label: 'Renewal premium', amount: Number(rn?.premium_new ?? p.premium_total) } });
  return { fileName: `renewal-billing-statement-${p.policy_number}.pdf`, pdf: buildPdf(spec) };
}
