/**
 * Money out: premium collected is remitted to each insurer monthly (remittance, approval, settlement, approval, payment
 * voucher, cheque approved by a second user), sub-agent commission is approved and paid out, and the office petty cash
 * fund is set up, used and replenished.
 */
import { dataOf, listOf } from '../http.js';
import { addDays, minDate, monthEnd } from '../dates.js';

/**
 * Pending remittance / settlement approval of an entity. The number of levels follows the amount
 * (remittance.approval_levels) and each level is approved by a different user: a second accountant, then the managers.
 */
async function approveItem(ctx, entityId, remarks) {
  const approvers = [ctx.as.accounting2, ctx.as.manager1, ctx.as.manager2];
  for (const approver of approvers) {
    const queue = listOf(await approver.get('/remittance/approvals', { status: 'Pending', perPage: 500 }));
    const a = queue.find((x) => x.entityId === entityId);
    if (!a) return;
    await approver.post(`/remittance/approvals/${a.id}/approve`, { comments: remarks });
    ctx.log.count('Remittance approvals (per level)');
  }
  const left = listOf(await ctx.as.accounting2.get('/remittance/approvals', { status: 'Pending', perPage: 500 })).find((x) => x.entityId === entityId);
  if (left) throw new Error(`Approval of ${entityId} still pending after ${approvers.length} levels`);
}

/** Premium collected in one month, remitted to one insurer early the next month. */
async function remitToInsurer(ctx, insurerCode, rows, remitDate, { payNow = true } = {}) {
  const { rnd, as, log } = ctx;
  const acc = as.accounting1;
  const policyIds = [...new Set(rows.map((r) => ctx.policyByNumber.get(r.policyNumber)?.id).filter(Boolean))];
  const period = rows[0].collectedOn.slice(0, 7);
  const rem = dataOf(await acc.post('/remittance/remittances', { insurerCode, period, remittanceDate: remitDate, lines: policyIds.map((policyId) => ({ policyId })),
    remarks: `Premium collected in ${period}` }));
  await acc.post('/remittance/remittances/process', { ids: [rem.id] });
  await approveItem(ctx, rem.id, 'Collections agreed to the official receipts');
  const available = listOf(await acc.get('/remittance/settlements/available-policies', { insurerCode, perPage: 500 })).filter((l) => l.remittanceId === rem.id);
  const settlement = dataOf(await acc.post('/remittance/settlements', { insurerCode, settlementPeriod: [`${period}-01`, monthEnd(`${period}-01`)], lineIds: available.map((l) => l.id),
    remarks: `Settlement of remittance ${rem.remittanceNumber || rem.code || rem.id}` }));
  await acc.post(`/remittance/settlements/${settlement.id}/submit`, { paymentMethod: 'check', bankAccount: 'UAT-BDO-OPS' });
  await approveItem(ctx, settlement.id, 'Settlement checked; release the cheque');
  const s = dataOf(await acc.get(`/remittance/settlements/${settlement.id}`));
  const pvId = s.disbursementId || s.data?.disbursementId;
  if (!pvId) throw new Error(`Settlement ${settlement.id} raised no payment voucher (${s.voucherNote || 'no reason given'})`);
  // the voucher is dated with the cheque; the cheque is approved (posted) by a different finance user
  const pv = dataOf(await acc.put(`/disbursements/${pvId}`, { voucherDate: remitDate, remarks: `Premium remittance ${period}` }));
  if (!payNow) {
    // settled and approved, cheque not yet released: an open payable to the insurer at the cut-off
    log.count('Insurer settlements approved, cheque not yet released');
    return null;
  }
  const cheque = dataOf(await acc.post('/disbursements/checkbook', { disbursementId: pvId, customerName: ctx.insurers[insurerCode].name, mainAccount: '1102001', instrumentBookId: 'BDO-CB-2026',
    instrumentNo: `00${rnd.digits(5)}`, instrumentDate: remitDate, totaleAmount: String(pv.amount), status: 'Pending' }));
  await as.accounting2.put(`/disbursements/checkbook/${cheque.checkbookId}`, { status: 'Approved', totaleAmount: String(pv.amount) });
  await as.accounting2.put(`/disbursements/checkbook/${cheque.checkbookId}`, { status: 'Printed' });
  log.count('Insurer remittances settled and paid by cheque');
  return { remittanceId: rem.id, settlementId: settlement.id, voucherId: pvId, amount: pv.amount, date: remitDate, insurerCode, period };
}

async function remittances(ctx) {
  const { log, as } = ctx;
  ctx.policyByNumber = new Map(ctx.policies.map((p) => [p.policyNumber, p]));
  ctx.remitted = [];
  const ageing = dataOf(await as.accounting1.get('/credit-control/remittance-ageing', { asOf: ctx.today }));
  const rows = ageing.rows || [];
  log.info(`collected premium awaiting remittance: ${rows.length} collection(s), ${ageing.summary?.total}`);
  // one remittance per insurer and month of collection, paid about ten days after the month end; the last weeks'
  // collections stay unremitted (they are within the insurers' remittance terms)
  const groups = new Map();
  for (const r of rows) {
    if (!ctx.insurers[r.insurerCode]) continue;
    const remitDate = addDays(monthEnd(r.collectedOn), 10);
    if (remitDate > ctx.today) continue;
    const key = `${r.insurerCode}|${r.collectedOn.slice(0, 7)}`;
    groups.set(key, [...(groups.get(key) || []), r]);
  }
  // the latest month's settlements are approved but their cheques are still to be released, so the books carry open
  // payables to insurers (Aged Payables to Insurers) as they would at any month end
  const latestPeriod = [...groups.keys()].map((k) => k.split('|')[1]).sort().at(-1);
  for (const [key, list] of [...groups.entries()].sort()) {
    const [code, period] = key.split('|');
    const remitDate = minDate(addDays(monthEnd(`${period}-01`), ctx.rnd.int(7, 14)), ctx.today);
    const payNow = period !== latestPeriod;
    const r = await log.step(`Remit ${period} collections to ${code} (${list.length} collection(s))`, () => remitToInsurer(ctx, code, list, remitDate, { payNow }));
    if (r) ctx.remitted.push(r);
  }
  const after = dataOf(await as.accounting1.get('/credit-control/remittance-ageing', { asOf: ctx.today }));
  log.info(`still to remit: ${after.rows?.length || 0} collection(s), ${after.summary?.total || 0}`);
}

/** Sub-agent commission: referrer lines approved by a second user and paid out on one voucher per referrer. */
async function commission(ctx) {
  const { log, as } = ctx;
  for (const ref of ctx.referrers || []) {
    await log.step(`Commission of ${ref.name}`, async () => {
      const account = dataOf(await as.accounting1.get(`/commission/referrer-accounts/${ref.id}`));
      // lines become eligible when the premium is fully collected (automatically on the last payment); any left over
      // are marked by hand, which the platform refuses while premium is still open
      if (account.actions?.markEligibleCount) {
        await as.accounting1.post(`/commission/referrer-accounts/${ref.id}/mark-eligible`, {}).catch((e) => { if (e.status !== 409) throw e; });
      }
      const again = dataOf(await as.accounting1.get(`/commission/referrer-accounts/${ref.id}`));
      if (!again.actions?.approveCount) { log.note(`${ref.name}: no eligible commission line to approve`); return; }
      await as.accounting2.post(`/commission/referrer-accounts/${ref.id}/approve`, {});
      log.count('Sub-agent commission lines approved', again.actions.approveCount);
      const pv = dataOf(await as.accounting1.post('/disbursements/bulk-agent-disburse', { referrerIds: [ref.id], transactionCode: 'COMSUB', instrumentCurrency: 'PHP' }));
      const voucher = (pv.vouchers || pv.created || [pv])[0];
      const vid = voucher.disbursementId || voucher.id;
      const lines = (dataOf(await as.accounting1.get(`/disbursements/${vid}`)).commissionLines || []).map((l) => l.id);
      if (!lines.length) throw new Error(`Payout voucher ${vid} carries no commission line`);
      const paid = dataOf(await as.accounting2.post(`/disbursements/${vid}/approve-agent-payout`, { lineIds: lines }));
      if (paid.status !== 'paid') throw new Error(`Payout voucher status ${paid.status}`);
      log.count('Sub-agent commission payouts');
    });
  }
}

/** Petty cash: fund, a request approved by a second user, the disbursement and the replenishment. */
async function pettyCash(ctx) {
  const { as, log } = ctx;
  const acc = as.accounting1;
  const code = 'UAT-PCF-MKT';
  const existing = listOf(await acc.get('/petty-cash/funds', { search: code })).find((f) => (f.pettyCashCode || f.code) === code);
  const first = ctx.months[0].start;
  if (!existing) {
    await acc.post('/petty-cash/funds', { code, description: 'Makati head office petty cash', fundSize: 20000, maxLimit: 5000, minimumCashbox: 3000, bankAccountCode: 'UAT-BDO-OPS',
      branchCode: 'HO', departmentCode: 'FI', transactionDate: addDays(first, 2) });
    log.count('Petty cash funds');
  }
  const months = ctx.months.slice(-3);
  for (const m of months) {
    await log.step(`Petty cash expenses and replenishment ${m.period}`, async () => {
      const req = dataOf(await acc.post('/petty-cash/requests', { pettyCashCode: code, requesterName: ctx.as.operations.displayName, requestDate: addDays(m.start, 3), purpose: 'Courier, notarial fees and supplies',
        lines: [{ narration: 'LBC courier of policy documents', amount: 850, expenseAccount: '4401001' }, { narration: 'Notarial fees (affidavits of loss)', amount: 600, expenseAccount: '4401001' }] }));
      const reqId = req.id || req.requestId;
      await acc.post(`/petty-cash/requests/${reqId}/submit`, {});
      await as.accounting2.post(`/petty-cash/requests/${reqId}/approve`, {});
      // the courier's official receipt carries 12% VAT (input tax); notarial fees carry none
      await acc.post('/petty-cash/disbursements', { pettyCashCode: code, requestId: req.number || req.requestNumber || reqId, expenseAccount: '4401001', amount: 1450, vat: 91.07,
        remarks: 'Courier (VAT-registered) and notarial fees', date: addDays(m.start, 4) });
      await acc.post('/petty-cash/replenishments', { pettyCashCode: code, remarks: `Replenishment ${m.period}`, date: minDate(addDays(m.start, 20), ctx.today) });
      log.count('Petty cash requests approved and paid');
    });
  }
}

export async function money(ctx) {
  ctx.log.setPhase('Money: remittances, commission, petty cash');
  await remittances(ctx);
  await commission(ctx);
  await pettyCash(ctx);
}
