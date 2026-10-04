/**
 * Billing and collection. Broker-billed premium is paid in full, in part, by instalments or not at all (the premium
 * warranty monitor then reminds, extends with an approval, or asks Operations to cancel for non-payment). Direct-bill
 * premium is paid by the client to the insurer; the broker bills its commission with a debit note (maker-checker) and
 * collects it net of the insurer's withholding tax.
 */
import { dataOf, listOf } from '../http.js';
import { addDays, addMonths, minDate, maxDate, daysBetween } from '../dates.js';
import { payPremium, openBills, uploadFile } from './common.js';

/** How each broker-billed policy is paid, decided from its age and size so every month has a mix. */
function paymentBehaviour(ctx, p, index) {
  const age = daysBetween(p.issueDate, ctx.today);
  if (age < 12) return index % 3 === 0 ? 'full' : 'open';
  if (p.segment === 'corporate' && p.gross > 500000 && index % 2 === 0) return 'instalments';
  if (age > 35 && [4, 11, 17, 23].includes(index % 25)) return 'unpaid';
  if (index % 7 === 3) return 'partial';
  return 'full';
}

async function collectPremium(ctx, p, behaviour) {
  const { rnd, as } = ctx;
  const capture = p.segment === 'retail' && rnd.chance(0.5) ? as[p.sales] : null;
  const payDay = minDate(addDays(p.issueDate, rnd.int(2, 25)), ctx.today);
  if (behaviour === 'full') {
    await payPremium(ctx, { policy: p, amount: p.gross, date: payDay, captureBy: capture });
    p.paid = p.gross;
  } else if (behaviour === 'partial') {
    const first = Math.round(p.gross * rnd.pick([0.4, 0.5, 0.6]) * 100) / 100;
    await payPremium(ctx, { policy: p, amount: first, date: payDay, captureBy: capture });
    p.paid = first;
    // the balance follows a month later when that is already past
    const second = addDays(payDay, rnd.int(25, 40));
    if (second <= ctx.today) {
      await payPremium(ctx, { policy: p, amount: Math.round((p.gross - first) * 100) / 100, date: second });
      p.paid = p.gross;
    }
  }
}

/** Quarterly instalments from the inception; instalments already due are paid on their due date. */
async function instalmentPlan(ctx, p) {
  const acc = ctx.as.accounting1;
  const view = dataOf(await acc.get(`/credit-control/policies/${p.id}/instalment-plans`));
  const bill = (view.bills || view.receivables || [])[0];
  const preview = dataOf(await acc.post(`/credit-control/policies/${p.id}/instalment-plans/preview`, { frequency: 'quarterly', count: 4, firstDueDate: p.inception }));
  if (!(preview.instalments || preview).length) throw new Error('No instalment schedule generated');
  const plan = dataOf(await acc.post(`/credit-control/policies/${p.id}/instalment-plans`, { ...(bill?.id ? { receivableId: bill.id } : {}), frequency: 'quarterly', count: 4, firstDueDate: p.inception }));
  ctx.log.count('Instalment plans');
  p.paid = 0;
  for (const [k, inst] of (plan.instalments || []).entries()) {
    const due = inst.dueDate;
    // the client pays each instalment a few days after it falls due; the last one due is left overdue on one plan
    const payOn = addDays(due, ctx.rnd.int(0, 6));
    if (payOn > ctx.today) break;
    if (k > 0 && p.lateInstalment) break;
    await payPremium(ctx, { policy: p, amount: inst.amount, date: payOn, mode: 'check' });
    p.paid += inst.amount;
    ctx.log.count('Instalments paid');
  }
}

/** Premium warranty monitor: reminders, one approved extension, one cancellation request for non-payment. */
async function creditControl(ctx, unpaid) {
  const { log, as } = ctx;
  const acc = as.accounting1;
  const monitor = dataOf(await acc.get('/credit-control/warranty', { status: 'breached', perPage: 200 }));
  const breached = (monitor.rows || []).map((r) => r.policyId || r.id);
  log.info(`warranty monitor: ${breached.length} breached polic${breached.length === 1 ? 'y' : 'ies'}`);
  const targets = unpaid.filter((p) => breached.includes(p.id));
  if (unpaid.length && !targets.length) throw new Error(`None of the ${unpaid.length} unpaid policies past their warranty shows on the warranty monitor`);
  for (const p of targets) {
    await log.step(`Premium reminder ${p.policyNumber}`, async () => {
      await acc.post(`/credit-control/warranty/${p.id}/remind`, { notes: 'Premium past the warranty date: please settle to keep the cover in force' });
      log.count('Premium warranty reminders');
    });
  }
  // an extension can move the deadline at most credit.max_warranty_extension_days after the inception: the most recent
  // breached policy gets it, the oldest one is cancelled for non-payment
  const maxDays = Number(ctx.settings['credit.max_warranty_extension_days'] ?? 90);
  const byInception = [...targets].sort((a, b) => (a.inception < b.inception ? 1 : -1));
  const extend = byInception.find((p) => addDays(p.inception, maxDays) > addDays(ctx.today, 5));
  const cancel = byInception.filter((p) => p !== extend).at(-1);
  const rest = targets.filter((p) => p !== extend && p !== cancel);
  if (extend) {
    await log.step(`Warranty extension for ${extend.policyNumber} (requested by accounting, approved by the manager)`, async () => {
      const deadline = minDate(addDays(extend.inception, maxDays), addDays(ctx.today, 20));
      const x = dataOf(await acc.post(`/credit-control/warranty/${extend.id}/extensions`, { requestedDeadline: deadline, reason: 'Corporate cheque in process; client committed to pay within the month' }));
      await as.manager1.post(`/credit-control/warranty/extensions/${x.id}/approve`, { remarks: 'Client has a good payment record' });
      log.count('Warranty extensions approved');
    });
  }
  if (cancel) {
    await log.step(`Cancellation for non-payment ${cancel.policyNumber} (requested by accounting, processed by operations)`, async () => {
      const r = dataOf(await acc.post(`/credit-control/warranty/${cancel.id}/cancellation-request`, { notes: 'Two reminders unanswered; premium warranty breached' }));
      const ops = as.operations;
      await ops.post(`/endorsements/initiate-cancel-policy/${r.endorsementId}`, { sentBy: 'operations' });
      const done = await ops.post('/endorsements/complete-endorsement', { endorsementId: r.endorsementId, issuedDate: ctx.today, notes: 'Cancelled for non-payment of premium (warranty breached)' });
      if ((done.status || dataOf(done).status) !== 'Cancelled') throw new Error(`Endorsement status after completion: ${done.status}`);
      cancel.cancelled = true;
      log.count('Policies cancelled for non-payment');
    });
  }
  ctx.state.overdue = rest.map((p) => p.policyNumber);
}

/** Direct bill: client payment to the insurer, commission debit note (maker-checker) and its collection. */
async function directBill(ctx, policies) {
  const { log, as, rnd } = ctx;
  const acc = as.accounting1;
  for (const p of policies) {
    await log.step(`Client payment to the insurer recorded on ${p.policyNumber}`, async () => {
      const proofKey = await uploadFile(acc, 'direct-bill-payments', `insurer-or-${p.policyNumber}.pdf`, 'pdf');
      await acc.post(`/remittance/direct-bill/policies/${p.id}/client-payments`, { paymentDate: minDate(addDays(p.issueDate, rnd.int(5, 20)), ctx.today), amount: p.gross,
        insurerReference: `${ctx.insurers[p.insurerCode].short.split(' ')[0].toUpperCase()}-OR-${rnd.digits(7)}`, paymentMode: 'bank-transfer', proofKey, proofFileName: 'insurer-official-receipt.pdf' });
      log.count('Direct bill: client payments to insurers');
    });
  }
  // one debit note per insurer for the commission of its direct-bill policies
  const byInsurer = new Map();
  for (const p of policies) byInsurer.set(p.insurerCode, [...(byInsurer.get(p.insurerCode) || []), p]);
  for (const [code, list] of byInsurer) {
    await log.step(`Commission debit note to ${code} (${list.length} polic${list.length === 1 ? 'y' : 'ies'})`, async () => {
      const items = listOf(await acc.get('/remittance/direct-bill/policies', { insurerCode: code, perPage: 200 })).filter((x) => list.some((p) => p.id === x.policyId));
      if (items.length !== list.length) throw new Error(`Expected ${list.length} unbilled direct-bill item(s) for ${code}, found ${items.length}`);
      const lastIssue = list.map((p) => p.issueDate).sort().at(-1);
      const dnDate = minDate(maxDate(addDays(lastIssue, 5), lastIssue), ctx.today);
      const dn = dataOf(await acc.post('/remittance/direct-bill', { insurerCode: code, itemIds: items.map((x) => x.id), dnDate, periodFrom: ctx.months[0].start, periodTo: dnDate }));
      await acc.post(`/remittance/direct-bill/${dn.id}/submit`, {});
      const approved = dataOf(await as.accounting2.post(`/remittance/direct-bill/${dn.id}/approve`, { remarks: 'Commission rates checked against the matrix' }));
      log.count('Commission debit notes approved');
      // the insurer pays the commission and VAT less its withholding tax, a few weeks later when that is already past
      const paidOn = addDays(dnDate, rnd.int(10, 30));
      if (paidOn <= ctx.today) {
        await acc.post(`/remittance/direct-bill/${dn.id}/collections`, { receivedDate: paidOn, cashAmount: approved.netPayable, ewtAmount: approved.expectedEwt, paymentMode: 'bank-transfer',
          referenceNo: `${code}-CM-${rnd.digits(6)}`, form2307No: `2307-${rnd.digits(6)}` });
        log.count('Commission debit notes collected');
      }
    });
  }
}

export async function billing(ctx) {
  const { log } = ctx;
  log.setPhase('Billing and collection');
  const broker = ctx.policies.filter((p) => p.billing !== 'direct');
  const unpaid = [];
  for (const [index, p] of broker.entries()) {
    const behaviour = paymentBehaviour(ctx, p, index);
    p.behaviour = behaviour;
    if (behaviour === 'unpaid') { unpaid.push(p); continue; }
    if (behaviour === 'open') continue;
    if (behaviour === 'instalments') {
      p.lateInstalment = index % 4 === 0;
      await log.step(`Instalment plan ${p.policyNumber} (${p.product}, ${p.gross.toFixed(2)})`, () => instalmentPlan(ctx, p));
      continue;
    }
    await log.step(`Premium ${behaviour} ${p.policyNumber} (${p.product})`, () => collectPremium(ctx, p, behaviour));
  }
  await log.step('Premium warranty monitor', () => creditControl(ctx, unpaid));
  await directBill(ctx, ctx.policies.filter((p) => p.billing === 'direct'));
  await log.step('Client credit limits (set by the accounting manager)', async () => {
    const corporateClients = [...new Set(ctx.policies.filter((p) => p.segment === 'corporate' && p.billing !== 'direct').map((p) => p.clientId))].slice(0, 5);
    for (const id of corporateClients) {
      await ctx.as.manager2.put(`/credit-control/clients/${id}/credit-limit`, { creditLimit: ctx.rnd.pick([1000000, 2000000, 3000000]) });
      log.count('Client credit limits');
    }
  });
  // what is still open, for the later phases
  for (const p of broker) p.open = (await openBills(ctx.as.accounting1, p.id)).reduce((s, b) => s + Number(b.balance), 0);
  log.info(`broker-billed: ${broker.length}, paid in full ${broker.filter((p) => p.open === 0).length}, with a balance ${broker.filter((p) => p.open > 0).length}`);
  ctx.state.firstInstalmentMonth = addMonths(ctx.today, -6);
}
