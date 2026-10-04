/**
 * Instalment payment plans of broker-billed premium.
 *
 * A plan splits one premium bill (receivable) into instalments with their own due dates. The bill stays a single
 * receivable in the ledger (its booking journal and remittance are untouched); what the client paid on it is allocated
 * to the instalments in order, which gives each instalment its paid, outstanding and days past due. The bill's due date
 * follows the plan: it is the due date of the first instalment not fully paid, so collections, reminders and the
 * receivable ageing work on the instalment that is due.
 *
 * A schedule is generated from the terms (count, frequency in months from credit.instalment_frequencies, first due
 * date, optional down payment) and can then be edited line by line; the instalments must add up to the bill.
 */
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { isoDate, today } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';

const EPS = 0.005;

/** date + n months, kept on the same day of the month or the month's last day. */
export function addMonths(date, n) {
  const [y, m, d] = date.split('-').map(Number);
  const last = new Date(Date.UTC(y, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + n, Math.min(d, last))).toISOString().slice(0, 10);
}

/**
 * Schedule of a plan: count instalments every `months` months from firstDueDate. A down payment is the first
 * instalment; the rest is split evenly and the rounding difference goes to the first instalment after the down payment.
 */
export function generateSchedule({ amount, count, months, firstDueDate, downPayment = 0 }) {
  const total = round2(amount);
  const down = round2(downPayment || 0);
  if (!(total > 0)) throw badRequest('Validation failed', [{ path: 'amount', message: 'The bill has no amount to schedule' }]);
  if (!Number.isInteger(count) || count < 1) throw badRequest('Validation failed', [{ path: 'count', message: 'Number of instalments must be at least 1' }]);
  if (down < 0 || down >= total || (down > 0 && count < 2)) throw badRequest('Validation failed', [{ path: 'downPayment', message: 'The down payment must be less than the bill and leave at least one instalment' }]);
  const rest = down > 0 ? count - 1 : count;
  const base = round2(Math.floor(((total - down) / rest) * 100) / 100);
  const amounts = Array.from({ length: rest }, () => base);
  amounts[0] = round2(total - down - base * (rest - 1));
  const all = down > 0 ? [down, ...amounts] : amounts;
  return all.map((a, i) => ({ seq: i + 1, dueDate: addMonths(firstDueDate, i * months), amount: a }));
}

async function frequencies() {
  const f = (await getSetting('credit.instalment_frequencies', { monthly: 1, quarterly: 3, 'semi-annual': 6 })) || {};
  return Object.fromEntries(Object.entries(f).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Number(v)]));
}

/** Allocate what was paid on the bill to the instalments in order: paid, outstanding, status, days past due. */
export function allocatePaid(instalments, paid, asOf) {
  let left = round2(paid);
  return instalments.map((i) => {
    const amount = Number(i.amount);
    const p = round2(Math.min(amount, Math.max(0, left)));
    left = round2(left - p);
    const outstanding = round2(amount - p);
    const due = isoDate(i.due_date ?? i.dueDate);
    const dpd = outstanding > EPS && due < asOf ? Math.round((Date.parse(asOf) - Date.parse(due)) / 86400000) : 0;
    let status = 'paid';
    if (outstanding > EPS) status = dpd > 0 ? 'overdue' : (p > 0 ? 'partial' : 'due');
    return { id: i.id ? Number(i.id) : undefined, seq: i.seq, dueDate: due, amount, paid: p, outstanding, status, daysPastDue: dpd, remarks: i.remarks || null };
  });
}

async function policyAndBill(db, policyRef, receivableId = null) {
  const p = (await db.query('SELECT p.*, c.display_name AS client_name FROM policies p LEFT JOIN clients c ON c.id = p.client_id WHERE p.id = $1 OR p.policy_number = $1', [String(policyRef)])).rows[0];
  if (!p) throw notFound(`Policy ${policyRef} not found`);
  if (p.billing_mode === 'direct') throw conflict(`Policy ${p.policy_number} is direct billed: the client pays the insurer, so the broker has no bill to schedule`);
  const bills = (await db.query(`SELECT * FROM receivables WHERE policy_id = $1 AND status NOT IN ('cancelled', 'written-off', 'credited') ORDER BY created_at`, [p.id])).rows;
  const bill = receivableId ? bills.find((b) => b.id === receivableId || b.bill_number === receivableId) : bills.filter((b) => Number(b.balance) > EPS).at(-1) || bills.at(-1);
  if (!bill) throw conflict(`Policy ${p.policy_number} has no premium bill to schedule`);
  return { policy: p, bill, bills };
}

/**
 * Instalments of an invoiced plan: each instalment is its own bill, so what is paid and due comes from that bill.
 * children: Map receivable id -> receivable row.
 */
function invoicedInstalments(lines, children, asOf) {
  return lines.map((l) => {
    const b = children.get(l.receivable_id);
    const one = allocatePaid([{ ...l, due_date: b ? b.due_date : l.due_date }], b ? round2(Number(b.amount) - Number(b.balance)) : 0, asOf)[0];
    return { ...one, receivableId: l.receivable_id, billNumber: b?.bill_number || null, billStatus: b?.status || null };
  });
}

const planOut = (plan, lines, bill, asOf, children = new Map()) => {
  const invoiced = !!plan.invoiced_at && lines.some((l) => l.receivable_id);
  return {
    id: plan.id, policyId: plan.policy_id, receivableId: plan.receivable_id, billNumber: bill?.bill_number || null, frequency: plan.frequency, instalmentCount: plan.instalment_count,
    firstDueDate: isoDate(plan.first_due_date), downPayment: Number(plan.down_payment), status: plan.status, remarks: plan.remarks, createdAt: plan.created_at, updatedAt: plan.updated_at,
    billAmount: bill ? Number(bill.amount) : null, billBalance: bill ? Number(bill.balance) : null, invoiced, invoicedAt: plan.invoiced_at || null,
    instalments: invoiced ? invoicedInstalments(lines, children, asOf) : allocatePaid(lines, bill ? round2(Number(bill.amount) - Number(bill.balance)) : 0, asOf),
  };
};

/** The instalment bills of plan lines (Map id -> receivable). */
async function childBills(db, lines) {
  const ids = lines.map((l) => l.receivable_id).filter(Boolean);
  if (!ids.length) return new Map();
  return new Map((await db.query('SELECT * FROM receivables WHERE id = ANY($1)', [ids])).rows.map((r) => [r.id, r]));
}

/** The policy's bills and their plans (active and cancelled), with the proposal for a new plan. */
export async function policyPlans(db, policyRef) {
  const { policy, bill, bills } = await policyAndBill(db, policyRef);
  const asOf = await today();
  const plans = (await db.query('SELECT * FROM premium_instalment_plans WHERE policy_id = $1 ORDER BY created_at DESC', [policy.id])).rows;
  const lines = plans.length ? (await db.query('SELECT * FROM premium_instalments WHERE plan_id = ANY($1) ORDER BY plan_id, seq', [plans.map((x) => x.id)])).rows : [];
  const children = await childBills(db, lines);
  const parents = new Map((await db.query('SELECT * FROM receivables WHERE id = ANY($1)', [plans.map((x) => x.receivable_id)])).rows.map((r) => [r.id, r]));
  const freq = await frequencies();
  const count = Math.max(1, Number(await getSetting('credit.default_instalment_count', 4)) || 4);
  return {
    policyId: policy.id, policyNumber: policy.policy_number, clientName: policy.client_name, inceptionDate: isoDate(policy.inception_date),
    bills: bills.map((b) => ({ id: b.id, billNumber: b.bill_number, amount: Number(b.amount), balance: Number(b.balance), dueDate: isoDate(b.due_date), status: b.status, source: b.source })),
    plans: plans.map((pl) => planOut(pl, lines.filter((l) => l.plan_id === pl.id), bills.find((b) => b.id === pl.receivable_id) || parents.get(pl.receivable_id), asOf, children)),
    frequencies: freq, maxInstalments: Number(await getSetting('credit.max_instalment_count', 12)) || 12,
    proposal: { receivableId: bill.id, frequency: Object.keys(freq)[0] || 'monthly', count, firstDueDate: isoDate(bill.due_date),
      instalments: generateSchedule({ amount: Number(bill.amount), count, months: Object.values(freq)[0] || 1, firstDueDate: isoDate(bill.due_date) }) },
  };
}

/** Preview a generated schedule for a bill (nothing is saved). */
export async function previewSchedule(db, policyRef, b) {
  const { bill } = await policyAndBill(db, policyRef, b.receivableId);
  const freq = await frequencies();
  const months = freq[b.frequency];
  if (!months) throw badRequest('Validation failed', [{ path: 'frequency', message: `Frequency must be one of ${Object.keys(freq).join(', ')}` }]);
  return generateSchedule({ amount: Number(bill.amount), count: Number(b.count), months, firstDueDate: isoDate(b.firstDueDate) || isoDate(bill.due_date), downPayment: Number(b.downPayment) || 0 });
}

function checkInstalments(list, amount, max) {
  const errors = [];
  if (!Array.isArray(list) || !list.length) errors.push({ path: 'instalments', message: 'At least one instalment is required' });
  else {
    if (list.length > max) errors.push({ path: 'instalments', message: `At most ${max} instalments (credit.max_instalment_count)` });
    list.forEach((x, i) => {
      if (!isoDate(x.dueDate)) errors.push({ path: `instalments[${i}].dueDate`, message: 'Due date is required' });
      if (!(round2(x.amount) > 0)) errors.push({ path: `instalments[${i}].amount`, message: 'Amount must be greater than zero' });
      if (i > 0 && isoDate(x.dueDate) && isoDate(list[i - 1].dueDate) && isoDate(x.dueDate) <= isoDate(list[i - 1].dueDate)) errors.push({ path: `instalments[${i}].dueDate`, message: 'Due dates must be in increasing order' });
    });
    const sum = round2(list.reduce((s, x) => s + round2(x.amount), 0));
    if (Math.abs(sum - round2(amount)) > EPS) errors.push({ path: 'instalments', message: `The instalments add up to ${sum.toFixed(2)}; the bill is ${round2(amount).toFixed(2)}` });
  }
  if (errors.length) throw badRequest('Validation failed', errors);
}

/**
 * Save the plan of a bill: instalments given (edited schedule) or generated from { frequency, count, firstDueDate,
 * downPayment }. An active plan of the bill is replaced. Returns { before, after }.
 */
export async function savePlan(db, policyRef, b, user) {
  const { policy, bill } = await policyAndBill(db, policyRef, b.receivableId);
  if (Number(bill.balance) <= EPS) throw conflict(`Bill ${bill.bill_number} is fully paid; there is nothing left to schedule`);
  const freq = await frequencies();
  const generated = !Array.isArray(b.instalments);
  const list = generated ? await previewSchedule(db, policy.id, { ...b, receivableId: bill.id }) : b.instalments.map((x) => ({ dueDate: isoDate(x.dueDate), amount: round2(x.amount), remarks: x.remarks || null }));
  checkInstalments(list, Number(bill.amount), Number(await getSetting('credit.max_instalment_count', 12)) || 12);
  const frequency = generated ? b.frequency : (freq[b.frequency] ? b.frequency : 'custom');
  const existing = (await db.query('SELECT * FROM premium_instalment_plans WHERE receivable_id = $1 AND status = \'active\' FOR UPDATE', [bill.id])).rows[0];
  const before = existing ? await getPlan(db, existing.id) : null;
  let planId = existing?.id;
  if (existing) {
    await db.query(`UPDATE premium_instalment_plans SET frequency = $2, instalment_count = $3, first_due_date = $4, down_payment = $5, remarks = COALESCE($6, remarks), updated_by = $7, updated_at = now()
      WHERE id = $1`, [existing.id, frequency, list.length, list[0].dueDate, round2(b.downPayment || 0), b.remarks || null, user?.id ?? null]);
    await db.query('DELETE FROM premium_instalments WHERE plan_id = $1', [existing.id]);
  } else {
    planId = (await db.query(`INSERT INTO premium_instalment_plans(policy_id, receivable_id, frequency, instalment_count, first_due_date, down_payment, remarks, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8) RETURNING id`, [policy.id, bill.id, frequency, list.length, list[0].dueDate, round2(b.downPayment || 0), b.remarks || null, user?.id ?? null])).rows[0].id;
  }
  for (const [i, x] of list.entries()) {
    await db.query('INSERT INTO premium_instalments(plan_id, seq, due_date, amount, remarks) VALUES ($1,$2,$3,$4,$5)', [planId, i + 1, x.dueDate, round2(x.amount), x.remarks || null]);
  }
  await syncDueDate(db, bill.id);
  // credit.instalment_invoices_on_save: a separate bill per instalment straight away (only before any payment on the bill)
  if ((await getSetting('credit.instalment_invoices_on_save', false)) === true && Math.abs(Number(bill.balance) - Number(bill.amount)) <= EPS && bill.source !== 'opening') {
    await invoicePlan(db, planId, user);
  }
  return { before, after: await getPlan(db, planId) };
}

export async function getPlan(db, planId) {
  const plan = (await db.query('SELECT * FROM premium_instalment_plans WHERE id = $1', [planId])).rows[0];
  if (!plan) throw notFound('Instalment plan not found');
  const bill = (await db.query('SELECT * FROM receivables WHERE id = $1', [plan.receivable_id])).rows[0];
  const lines = (await db.query('SELECT * FROM premium_instalments WHERE plan_id = $1 ORDER BY seq', [plan.id])).rows;
  return planOut(plan, lines, bill, await today(), await childBills(db, lines));
}

/**
 * Separate instalment invoices: the plan's bill is replaced by one bill per instalment. The bill's booking journal is
 * reversed and the bill cancelled; each instalment gets its own bill (invoice number, due date of the instalment, net
 * premium, taxes and commission in proportion, its own booking journal and collection item), so the ledger, the
 * collections, the receivable ageing and the premium warranty monitor work per instalment. Only before any payment is
 * applied to the bill; not for go-live open items (carried by the opening balance).
 */
export async function invoicePlan(db, planId, user) {
  const plan = (await db.query('SELECT * FROM premium_instalment_plans WHERE id = $1 FOR UPDATE', [planId])).rows[0];
  if (!plan) throw notFound('Instalment plan not found');
  if (plan.status !== 'active') throw conflict('Only an active plan is invoiced');
  if (plan.invoiced_at) throw conflict('The instalments of this plan are already invoiced');
  const bill = (await db.query('SELECT * FROM receivables WHERE id = $1 FOR UPDATE', [plan.receivable_id])).rows[0];
  if (!bill || ['cancelled', 'written-off', 'credited'].includes(bill.status)) throw conflict('The bill of this plan is no longer open');
  if (bill.source === 'opening') throw conflict(`Bill ${bill.bill_number} is a go-live open item; its instalments are followed on the plan`);
  if (Math.abs(Number(bill.balance) - Number(bill.amount)) > EPS) {
    throw conflict(`Bill ${bill.bill_number} already has payments applied; separate instalment invoices are issued before the first payment`);
  }
  const lines = (await db.query('SELECT * FROM premium_instalments WHERE plan_id = $1 ORDER BY seq', [plan.id])).rows;
  const { createReceivable, ensureBooked, findPolicy } = await import('../receipts/receivables.js');
  const { reverseJournal } = await import('../accounting/lib/ledger.js');
  const { allocate } = await import('../accounting/lib/coinsurance.js');
  const policy = await findPolicy(db, bill.policy_id);
  const booked = await ensureBooked(db, bill, policy, user);
  if (booked.booking_jv_id) {
    await reverseJournal(db, booked.booking_jv_id, user, { description: `Bill ${bill.bill_number} replaced by ${lines.length} instalment invoices` });
  }
  await db.query('UPDATE receivables SET status = \'cancelled\', balance = 0, updated_at = now() WHERE id = $1', [bill.id]);
  await db.query('UPDATE collection_items SET closed_at = COALESCE(closed_at, now()), updated_at = now() WHERE receivable_id = $1', [bill.id]);
  const weights = lines.map((l) => Number(l.amount));
  const split = (v) => allocate(Number(v) || 0, weights);
  const parts = { net: split(bill.net_premium), vat: split(bill.vat), dst: split(bill.dst), lgt: split(bill.lgt), other: split(bill.other_charges), discount: split(bill.discount),
    commission: split(bill.commission_amount) };
  const created = [];
  for (const [i, l] of lines.entries()) {
    const rcv = await createReceivable(db, { policy, amount: Number(l.amount), source: bill.source, reference: bill.reference || bill.bill_number, dueDate: isoDate(l.due_date), user,
      breakdown: { netPremium: parts.net[i], vat: parts.vat[i], dst: parts.dst[i], lgt: parts.lgt[i], other: parts.other[i], discount: parts.discount[i], commissionAmount: parts.commission[i] } });
    await db.query('UPDATE receivables SET parent_receivable_id = $2, instalment_seq = $3 WHERE id = $1', [rcv.id, bill.id, l.seq]);
    await db.query('UPDATE premium_instalments SET receivable_id = $2 WHERE id = $1', [l.id, rcv.id]);
    created.push({ seq: l.seq, receivableId: rcv.id, billNumber: rcv.bill_number, dueDate: isoDate(l.due_date), amount: Number(l.amount) });
  }
  await db.query('UPDATE premium_instalment_plans SET invoiced_at = now(), invoiced_by = $2, updated_by = $2, updated_at = now() WHERE id = $1', [plan.id, user?.id ?? null]);
  return { plan: await getPlan(db, plan.id), replacedBill: bill.bill_number, invoices: created };
}

/** Cancel a plan: the bill keeps the due date of its first unpaid instalment. */
export async function cancelPlan(db, planId, reason, user) {
  const plan = (await db.query('SELECT * FROM premium_instalment_plans WHERE id = $1 FOR UPDATE', [planId])).rows[0];
  if (!plan) throw notFound('Instalment plan not found');
  if (plan.status !== 'active') throw conflict('The plan is already cancelled');
  if (plan.invoiced_at) throw conflict('The instalments of this plan are invoiced: each instalment is its own bill and is followed on its own');
  const before = await getPlan(db, plan.id);
  await db.query('UPDATE premium_instalment_plans SET status = \'cancelled\', cancelled_by = $2, cancelled_at = now(), cancel_reason = $3 WHERE id = $1', [plan.id, user?.id ?? null, reason || null]);
  return { before, after: await getPlan(db, plan.id) };
}

/**
 * Due date of a bill on an active plan: the first instalment not fully paid (the last one once all are paid). Called
 * after a plan is saved and after a payment is applied to the bill. No-op without an active plan.
 */
export async function syncDueDate(db, receivableId) {
  const plan = (await db.query('SELECT id FROM premium_instalment_plans WHERE receivable_id = $1 AND status = \'active\'', [receivableId])).rows[0];
  if (!plan) return null;
  const bill = (await db.query('SELECT amount, balance FROM receivables WHERE id = $1', [receivableId])).rows[0];
  const lines = allocatePaid((await db.query('SELECT * FROM premium_instalments WHERE plan_id = $1 ORDER BY seq', [plan.id])).rows, round2(Number(bill.amount) - Number(bill.balance)), await today());
  const next = lines.find((l) => l.outstanding > EPS) || lines.at(-1);
  await db.query('UPDATE receivables SET due_date = $2, updated_at = now() WHERE id = $1 AND due_date IS DISTINCT FROM $2::date', [receivableId, next.dueDate]);
  return next.dueDate;
}

/**
 * Instalments of active plans with an outstanding amount, aged on their own due dates (limits.receivable_ageing_buckets).
 * Filters: clientId, policyId, insurerId, overdueOnly. Returns { summary, rows }.
 */
export async function instalmentAgeing(db, qs = {}) {
  const asOf = await today();
  const buckets = ((await getSetting('limits.receivable_ageing_buckets', [30, 60, 90, 120])) || [30, 60, 90, 120]).map(Number);
  const plans = (await db.query(`SELECT pl.*, r.amount AS bill_amount, r.balance AS bill_balance, r.bill_number, p.policy_number, p.client_id, c.display_name AS client_name, ic.name AS insurer_name
    FROM premium_instalment_plans pl JOIN receivables r ON r.id = pl.receivable_id JOIN policies p ON p.id = pl.policy_id LEFT JOIN clients c ON c.id = p.client_id
    LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE pl.status = 'active' AND r.balance > 0 AND ($1::text IS NULL OR p.client_id = $1 OR c.client_code = $1) AND ($2::text IS NULL OR p.id = $2 OR p.policy_number = $2)
      AND ($3::text IS NULL OR ic.id::text = $3 OR ic.code = $3) ORDER BY p.policy_number`, [qs.clientId || null, qs.policyId || null, qs.insurerId ? String(qs.insurerId) : null])).rows;
  const lines = plans.length ? (await db.query('SELECT * FROM premium_instalments WHERE plan_id = ANY($1) ORDER BY plan_id, seq', [plans.map((x) => x.id)])).rows : [];
  const bucketOf = (dpd) => {
    if (dpd <= 0) return 'current';
    if (dpd <= buckets[0]) return 'b1';
    if (dpd <= buckets[1]) return 'b2';
    if (dpd <= buckets[2]) return 'b3';
    return 'b4';
  };
  const rows = [];
  for (const pl of plans) {
    const alloc = allocatePaid(lines.filter((l) => l.plan_id === pl.id), round2(Number(pl.bill_amount) - Number(pl.bill_balance)), asOf);
    for (const a of alloc.filter((x) => x.outstanding > EPS)) {
      if (qs.overdueOnly === 'true' && !(a.daysPastDue > 0)) continue;
      rows.push({ planId: pl.id, policyId: pl.policy_id, policyNumber: pl.policy_number, clientId: pl.client_id, clientName: pl.client_name, insurerName: pl.insurer_name,
        billNumber: pl.bill_number, ...a, instalmentCount: pl.instalment_count, bucket: bucketOf(a.daysPastDue) });
    }
  }
  // invoiced plans: each open instalment bill is aged on its own due date
  const invoiced = (await db.query(`SELECT r.*, i.seq, i.plan_id, pl.instalment_count, p.policy_number, c.display_name AS client_name, ic.name AS insurer_name
    FROM receivables r JOIN premium_instalments i ON i.receivable_id = r.id JOIN premium_instalment_plans pl ON pl.id = i.plan_id JOIN policies p ON p.id = r.policy_id
    LEFT JOIN clients c ON c.id = p.client_id LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
    WHERE r.status IN ('open', 'partial') AND r.balance > 0 AND ($1::text IS NULL OR p.client_id = $1 OR c.client_code = $1) AND ($2::text IS NULL OR p.id = $2 OR p.policy_number = $2)
      AND ($3::text IS NULL OR ic.id::text = $3 OR ic.code = $3) ORDER BY p.policy_number, i.seq`, [qs.clientId || null, qs.policyId || null, qs.insurerId ? String(qs.insurerId) : null])).rows;
  for (const r of invoiced) {
    const a = allocatePaid([{ seq: r.seq, due_date: r.due_date, amount: r.amount }], round2(Number(r.amount) - Number(r.balance)), asOf)[0];
    if (qs.overdueOnly === 'true' && !(a.daysPastDue > 0)) continue;
    rows.push({ planId: r.plan_id, policyId: r.policy_id, policyNumber: r.policy_number, clientId: r.client_id, clientName: r.client_name, insurerName: r.insurer_name,
      billNumber: r.bill_number, receivableId: r.id, ...a, instalmentCount: r.instalment_count, bucket: bucketOf(a.daysPastDue) });
  }
  const sum =(f) => round2(rows.filter(f).reduce((s, r) => s + r.outstanding, 0));
  return { asOf, bucketDays: buckets.slice(0, 3), summary: { count: rows.length, outstanding: sum(() => true), current: sum((r) => r.bucket === 'current'), b1: sum((r) => r.bucket === 'b1'),
    b2: sum((r) => r.bucket === 'b2'), b3: sum((r) => r.bucket === 'b3'), b4: sum((r) => r.bucket === 'b4') }, rows };
}
