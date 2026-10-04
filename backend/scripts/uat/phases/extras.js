/**
 * Reinsurance, incentives and the accounting extensions, so their registers carry the scenario's business: a property
 * quota share treaty (maker-checker) with cessions of large corporate risks, a facultative cession, the Account
 * Executives' monthly incentive (program, calculation, approval by a second user, payment), a supplier invoice with
 * expanded withholding tax paid by cheque and its BIR Form 2307, and a fixed asset registered and sold (disposal with
 * output VAT and a sales invoice).
 */
import { dataOf, listOf } from '../http.js';

async function reinsurance(ctx) {
  const { as, log } = ctx;
  const p1 = as.processing1;
  const p2 = as.processing2;
  const reinsurers = listOf(await p1.get('/reinsurance/reinsurers'));
  let re = reinsurers.find((r) => r.name === 'Maharlika Reinsurance Corp.');
  if (!re) {
    re = dataOf(await p1.post('/reinsurance/reinsurers', { name: 'Maharlika Reinsurance Corp.', type: 'Local', rating: 'A', country: 'Philippines', contactPerson: 'Treaty Department', email: 'treaty@maharlikare.example.ph' }));
    log.count('Reinsurers');
  }
  const year = ctx.today.slice(0, 4);
  const number = `QS-PROP-${year}`;
  let treaty = listOf(await p1.get('/reinsurance/treaties')).find((t) => t.treatyNumber === number);
  if (!treaty) {
    treaty = dataOf(await p1.post('/reinsurance/treaties', { treatyNumber: number, name: `Property Quota Share ${year}`, type: 'Quota Share', lineOfBusiness: 'Fire', reinsurers: [re.id || re.reinsurerId],
      effectiveDate: `${year}-01-01`, expiryDate: `${year}-12-31`, capacity: 3000000000, cession: { percentage: 30, maxLimit: 600000000 }, commission: { type: 'Flat', rate: 25 } }));
    await p2.post(`/reinsurance/treaties/${treaty.id}/approve`, { remarks: 'Terms per the signed treaty wording' });
    log.count('Reinsurance treaties approved');
  }
  const big = ctx.policies.filter((p) => ['FIRE', 'IAR'].includes(p.product) && p.segment === 'corporate').sort((a, b) => b.gross - a.gross);
  for (const [k, p] of big.slice(0, 3).entries()) {
    const pol = await p1.get(`/policies/${p.id}`);
    const body = k < 2
      ? { treatyId: treaty.id, policyNumber: p.policyNumber, insured: pol.insuredName, sumInsured: Number(pol.sumInsured), grossPremium: p.gross, cessionDate: p.issueDate }
      : { type: 'Facultative', facultativeReinsurer: re.id || re.reinsurerId, policyNumber: p.policyNumber, insured: pol.insuredName, sumInsured: Number(pol.sumInsured), grossPremium: p.gross, cessionPercentage: 20, cessionDate: p.issueDate };
    const c = dataOf(await p1.post('/reinsurance/cessions', body));
    await p2.post(`/reinsurance/cessions/${c.id}/confirm`, { remarks: 'Cession slip signed' });
    log.count('Reinsurance cessions confirmed');
  }
}

async function incentives(ctx) {
  const { as, log } = ctx;
  const code = 'INC-NB';
  const programs = listOf(await as.sysadmin.get('/incentive/programs'));
  if (!programs.some((p) => p.programCode === code)) {
    await as.sysadmin.post('/incentive/programs', { programCode: code, programName: 'New Business Premium (Account Executives)', programType: 'Target Based', applicableTo: ['Individual Agent'],
      startDate: ctx.months[0].start, endDate: `${ctx.today.slice(0, 4)}-12-31`, targetMetric: 'Premium Volume', calculationFrequency: 'Monthly', baseTarget: 150000,
      structure: [{ level: '100%+', type: 'Percentage', value: 1, maxPayout: 15000 }] });
    log.count('Incentive programs');
  }
  const period = ctx.today.slice(0, 7);
  const batch = dataOf(await as.accounting1.post('/incentive/calculations', { period, selectedPrograms: [code], description: `Incentives ${period}` }));
  const id = batch.batchId || batch.id;
  await as.accounting1.post(`/incentive/calculations/${id}/submit`, {});
  await as.accounting2.post(`/incentive/calculations/${id}/approve`, {});
  await as.accounting1.post(`/incentive/calculations/${id}/pay`, { paymentDate: ctx.today, paymentReference: `PAYROLL-${period}` });
  log.count('Incentive batches paid');
}

/** Accounts payable: an office supplier's invoice with EWT, approved, paid by cheque; the supplier's BIR 2307 for the quarter. */
async function supplierInvoice(ctx) {
  const { as, log, rnd } = ctx;
  const acc = as.accounting1;
  const code = 'SUP-OFFICE';
  const suppliers = listOf(await acc.get('/ops-masters/supplier', { search: code, perPage: 20 }));
  if (!suppliers.some((x) => x.code === code)) {
    await acc.post('/ops-masters/supplier', { code, name: 'Makati Office Services Inc.', tin: '201-555-777-00000', address: '12 Ayala Ave., Makati City', vatRegistered: true, ewtCode: 'WC160', expenseAccount: '4401008' });
    log.count('Suppliers');
  }
  let invoice = dataOf(await acc.post('/payables/invoices', { supplierId: code, supplierInvoiceNo: `SI-${rnd.digits(5)}`, invoiceDate: ctx.today, submit: true,
    lines: [{ description: `Janitorial services ${ctx.today.slice(0, 7)}`, amount: 48000 }] }));
  // maker-checker (payables.maker_checker): the Accounting Manager approves the invoice Accounting sent for approval
  if (invoice.status === 'for-approval') invoice = dataOf(await as.manager1.post(`/payables/invoices/${invoice.id}/approve`, { remarks: 'Service contract and billing checked' }));
  if (invoice.status !== 'approved' || !(Number(invoice.ewtAmount) > 0)) throw new Error(`Supplier invoice ${invoice.voucherNumber || invoice.id}: status ${invoice.status}, EWT ${invoice.ewtAmount}`);
  const bank = Object.keys(ctx.bankAccounts)[0];
  await acc.post('/payables/payments', { supplierId: code, payFromAccount: bank, chequeNumber: `0${rnd.digits(5)}`, allocations: [{ invoiceId: invoice.id }] });
  log.count('Supplier invoices paid');
  const year = Number(ctx.today.slice(0, 4));
  const quarter = Math.floor((Number(ctx.today.slice(5, 7)) - 1) / 3) + 1;
  const issued = dataOf(await acc.post('/period-end/bir/2307/issue-all', { year, quarter, payeeType: 'Supplier' }));
  const n = Array.isArray(issued.issued) ? issued.issued.length : 0;
  const certificates = listOf(await acc.get('/period-end/bir/2307/certificates', { year, quarter, direction: 'issued' }));
  if (!n && !certificates.some((c) => /Makati Office Services/i.test(c.payeeName || ''))) throw new Error('No BIR 2307 certificate issued to the supplier');
  log.count('BIR 2307 certificates issued to suppliers', Math.max(n, 1));
}

/** Fixed assets: a laptop batch registered this month and sold to a trader: disposal journal with the loss and output VAT, sales invoice. */
async function fixedAssetDisposal(ctx) {
  const { as, log, rnd } = ctx;
  const acc = as.accounting1;
  const month = ctx.today.slice(0, 7);
  const asset = dataOf(await acc.post('/fixed-assets/assets', { classCode: 'COMPUTER', name: `Laptops of the sales team (${month})`, acquisitionDate: `${month}-01`, depreciateFrom: month, cost: 180000, openingAccumulated: 90000 }));
  log.count('Fixed assets registered');
  const preview = dataOf(await acc.get(`/fixed-assets/assets/${asset.id}/disposal-preview`, { disposalType: 'sale', disposalDate: ctx.today, proceeds: 75000 }));
  if (!(Number(preview.bookValue) > 0)) throw new Error('The disposal preview shows no book value');
  const bank = Object.keys(ctx.bankAccounts)[0];
  const sold = dataOf(await acc.post(`/fixed-assets/assets/${asset.id}/dispose`, { disposalType: 'sale', disposalDate: ctx.today, proceeds: 75000, buyerName: 'Mabuhay Computer Traders Inc.',
    buyerTin: `${rnd.digits(3)}-${rnd.digits(3)}-${rnd.digits(3)}-00000`, buyerAddress: '88 Gil Puyat Ave., Makati City', bankAccount: bank }));
  if (sold.status !== 'posted' || !sold.journalId) throw new Error(`Disposal ${sold.disposalNumber}: status ${sold.status}`);
  const after = dataOf(await acc.get(`/fixed-assets/assets/${asset.id}`));
  if (after.status !== 'disposed') throw new Error(`Asset status after the sale: ${after.status}`);
  log.count('Fixed assets sold (disposal posted)');
}

export async function extras(ctx) {
  ctx.log.setPhase('Reinsurance, incentives, payables and fixed assets');
  await ctx.log.step('Reinsurance: treaty and cessions of large property risks', () => reinsurance(ctx));
  await ctx.log.step('Account Executive incentives for the month', () => incentives(ctx));
  await ctx.log.step('Supplier invoice with EWT approved, paid by cheque; BIR 2307 issued to the supplier', () => supplierInvoice(ctx), { who: ctx.as.accounting1.username });
  await ctx.log.step('Fixed asset registered and sold: disposal journal with output VAT and the sales invoice', () => fixedAssetDisposal(ctx), { who: ctx.as.accounting1.username });
}
