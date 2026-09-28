/** Billing statements (SOA-style PDFs) for a policy, an endorsement or a renewal. */
import { getSetting } from '../../lib/settings.js';
import { notFound } from '../../lib/errors.js';
import { makePdf, padRow } from '../accounting/lib/files.js';
import { round2, today } from '../accounting/lib/http.js';
import { findPolicy } from './receivables.js';

const fmt = (n) => round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function header(policy, kind) {
  const company = await getSetting('general.company_name', 'BrokerVerse');
  const currency = await getSetting('currency.default', 'PHP');
  return { title: `${company} – ${kind} Billing Statement`, lines: [
    `Statement date : ${today()}`, `Policy number  : ${policy.policy_number}`, `Insured        : ${policy.client_name || ''} (${policy.client_code || ''})`,
    `Insurer        : ${policy.insurer_name || ''}`, `Product        : ${policy.product_name || ''}`, `Period         : ${policy.inception_date} to ${policy.expiry_date}`,
    `Currency       : ${policy.currency || currency}`, ''] };
}

async function receivableLines(db, policyId, sources) {
  const rows = (await db.query('SELECT * FROM receivables WHERE policy_id = $1 AND source = ANY($2) ORDER BY created_at', [policyId, sources])).rows;
  const w = [16, 12, 14, 14, 14, 10];
  const out = [padRow(['Bill no.', 'Due date', 'Amount', 'Paid', 'Balance', 'Status'], w), '-'.repeat(86)];
  for (const r of rows) out.push(padRow([r.bill_number, r.due_date, fmt(r.amount), fmt(Number(r.amount) - Number(r.balance)), fmt(r.balance), r.status], w));
  const bal = rows.reduce((s, r) => s + Number(r.balance), 0);
  out.push('', `Total amount due: ${fmt(bal)}`);
  return { out, rows };
}

export async function policyStatement(db, policyRef) {
  const p = await findPolicy(db, policyRef);
  if (!p) throw notFound('Policy not found');
  const h = await header(p, 'Policy');
  const { out, rows } = await receivableLines(db, p.id, ['policy', 'receipt', 'manual']);
  const body = rows.length ? out : [`Gross premium: ${fmt(p.premium_total)}`, 'No bills raised yet for this policy.'];
  return { fileName: `policy-billing-statement-${p.policy_number}.pdf`, pdf: makePdf(h.title, [...h.lines, ...body]) };
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
  const h = await header(policy, 'Endorsement');
  const { out } = await receivableLines(db, policy.id, ['endorsement']);
  const e = endorsement ? [`Endorsement    : ${endorsement.endorsement_number || endorsement.id} (${endorsement.endorsement_type})`, `Premium change : ${fmt(endorsement.premium_delta)}`, ''] : [];
  return { fileName: `endorsement-billing-statement-${endorsement?.endorsement_number || policy.policy_number}.pdf`, pdf: makePdf(h.title, [...h.lines, ...e, ...out]) };
}

export async function renewalStatement(db, policyRef) {
  const p = await findPolicy(db, policyRef);
  if (!p) throw notFound('Policy not found');
  const h = await header(p, 'Renewal');
  const rn = (await db.query('SELECT * FROM renewals WHERE policy_id = $1 ORDER BY created_at DESC LIMIT 1', [p.id])).rows[0];
  const { out, rows } = await receivableLines(db, p.id, ['renewal']);
  const r = rn ? [`Renewal due    : ${rn.due_date}`, `Current premium: ${fmt(rn.premium_old ?? p.premium_total)}`, `Renewal premium: ${fmt(rn.premium_new ?? p.premium_total)}`, ''] : [`Renewal premium: ${fmt(p.premium_total)}`, ''];
  return { fileName: `renewal-billing-statement-${p.policy_number}.pdf`, pdf: makePdf(h.title, [...h.lines, ...r, ...(rows.length ? out : [])]) };
}
