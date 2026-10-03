/**
 * Servicing: endorsements (additional premium, return premium, cancellation), renewals of the migrated book (renewed
 * through a renewal quotation, lapsed, and the upcoming ones in the pipeline with their notices) and claims (notified with
 * documents, reviewed, settled with maker-checker, some closed without payment).
 */
import { dataOf, listOf } from '../http.js';
import { addDays, daysBetween, minDate, maxDate } from '../dates.js';
import { businessDay, customerAnswer, payPremium, uploadFile, createLead } from './common.js';

const PDF = (title) => Buffer.from(`%PDF-1.4\n% ${title}\ntrailer << >>\n%%EOF\n`);

async function completeEndorsement(ctx, e, { date, cancel = false }) {
  const ops = ctx.as.operations;
  if (cancel) await ops.post(`/endorsements/initiate-cancel-policy/${e.endorsementId}`, { sentBy: 'operations' });
  else await ops.post(`/endorsements/send-endorsement-to-customer/${e.endorsementId}`, { sentBy: 'operations' });
  const up = await ops.upload('POST', '/endorsements/upload-document', { endorsementId: e.endorsementId }, [{ field: 'file', name: `endorsement-${e.endorsementNumber}.pdf`, type: 'application/pdf', data: PDF(e.endorsementNumber) }]);
  const key = up.data?.documentKey || up.documentKey;
  return ops.post('/endorsements/complete-endorsement', { endorsementId: e.endorsementId, endorsementNumber: `INS-END-${ctx.rnd.digits(6)}`, issuedDate: date, documentKey: key });
}

/** The refund payable raised by a return premium is paid to the client by voucher and cheque (maker-checker). */
async function payRefund(ctx, p, date) {
  const acc = ctx.as.accounting1;
  const client = dataOf(await acc.get(`/clients/${p.clientId}`));
  const code = client.clientCode || client.generatedClientId;
  const inv = listOf(await acc.get('/disbursements/invoice-list', { customerCode: code, status: 'open', pageSize: 50 })).find((x) => x.policyNumber === p.policyNumber || x.policyId === p.id);
  if (!inv) throw new Error(`No refund payable found for ${p.policyNumber}`);
  const amount = Number(inv.totalAmount || inv.lcAmount || inv.payables);
  const pv = dataOf(await acc.post('/disbursements', { voucherDate: date, departmentCode: 'FI', branchCode: 'HO', payeeType: 'Customer', criteria: 'Specific', customerCode: code,
    policyNumber: p.policyNumber, transactionCode: 'REFUND', transactionDescription: `Return premium refund ${p.policyNumber}`, instrumentCurrency: 'PHP', amount: String(amount) }));
  const cb = dataOf(await acc.post('/disbursements/checkbook', { customerCode: code, customerName: client.fullName || client.displayName, mainAccount: '1102001', instrumentBookId: 'BDO-CB-2026',
    instrumentNo: ctx.rnd.digits(7), instrumentDate: date, totaleAmount: String(amount), status: 'Pending', invoiceListRefId: inv.invoiceListId || inv.id, disbursementId: pv.disbursementId }));
  await ctx.as.accounting2.put(`/disbursements/checkbook/${cb.checkbookId}`, { status: 'Approved', totaleAmount: String(amount) });
  await ctx.as.accounting2.put(`/disbursements/checkbook/${cb.checkbookId}`, { status: 'Printed' });
  ctx.log.count('Client refunds paid by cheque');
}

async function endorsements(ctx) {
  const { rnd, log, as } = ctx;
  const ops = as.operations;
  const motor = ctx.policies.filter((p) => p.product === 'MOTOR' && p.billing === 'broker' && !p.cancelled && p.issueDate < ctx.months[3].start);
  // additional premium: accessories added mid-term (own damage sum insured increased), billed and paid
  for (const p of motor.slice(0, Math.round(3 * ctx.cfg.scale))) {
    await log.step(`Additional premium endorsement on ${p.policyNumber}`, async () => {
      const pol = await ops.get(`/policies/${p.id}`);
      const od = Number(pol.lossAndDamageCoverage || 0);
      if (!od) throw new Error(`Policy ${p.policyNumber} has no own damage sum insured to endorse`);
      const date = businessDay(rnd, ctx.months.find((m) => m.period > p.month) || ctx.months.at(-1));
      const e = await ops.post('/endorsements/create-endorsement', { policyId: p.id, endorsementTypeIds: [3], effectiveDate: date, remarks: 'Accessories added: mags, dashcam and tint',
        coverageChanges: { LossandDamagecoverage: String(od + rnd.pick([60000, 85000, 120000])), LossandDamagecoverageRate: String(pol.lossAndDamageCoverageRate || 1.5) } });
      if (!(e.premiumDelta > 0)) throw new Error(`Additional premium expected, got ${e.premiumDelta}`);
      const done = await completeEndorsement(ctx, e, { date });
      log.count('Endorsements: additional premium');
      const billId = done.receivableId || dataOf(done).receivableId;
      if (!billId) throw new Error('The additional premium was not billed');
      await payPremium(ctx, { policy: p, amount: Number(e.premiumDelta), date: minDate(addDays(date, rnd.int(3, 12)), ctx.today), bill: billId, captureBy: as[p.sales] });
    });
  }
  // return premium: the insured vehicle's value was overstated; the policy was paid, so the client gets a refund
  const paid = motor.filter((p) => p.behaviour === 'full').slice(3, 3 + Math.round(2 * ctx.cfg.scale));
  for (const p of paid) {
    await log.step(`Return premium endorsement on ${p.policyNumber} with refund to the client`, async () => {
      const pol = await ops.get(`/policies/${p.id}`);
      const od = Number(pol.lossAndDamageCoverage || 0);
      const date = businessDay(rnd, ctx.months.find((m) => m.period > p.month) || ctx.months.at(-1));
      const e = await ops.post('/endorsements/create-endorsement', { policyId: p.id, endorsementTypeIds: [3], effectiveDate: date, remarks: 'Sum insured corrected to the appraised market value',
        coverageChanges: { LossandDamagecoverage: String(Math.round(od * 0.85 / 1000) * 1000), LossandDamagecoverageRate: String(pol.lossAndDamageCoverageRate || 1.5) } });
      if (!(e.premiumDelta < 0)) throw new Error(`Return premium expected, got ${e.premiumDelta}`);
      const done = await completeEndorsement(ctx, e, { date });
      const credit = done.completionDetails?.returnPremium || dataOf(done).completionDetails?.returnPremium;
      if (!credit?.refund) throw new Error('The return premium on a paid policy raised no refund payable');
      log.count('Endorsements: return premium');
      await payRefund(ctx, p, minDate(addDays(date, rnd.int(5, 12)), ctx.today));
    });
  }
  // cancellation at the client's request: personal accident cover no longer needed, pro-rata return
  const pa = ctx.policies.filter((p) => p.product === 'PA' && p.billing === 'broker' && p.behaviour === 'full' && !p.cancelled).slice(0, 1);
  for (const p of pa) {
    await log.step(`Cancellation at the client's request ${p.policyNumber}`, async () => {
      const date = businessDay(rnd, ctx.months.find((m) => m.period > p.month) || ctx.months.at(-1));
      const e = await ops.post('/endorsements/create-endorsement', { policyId: p.id, endorsementTypeIds: [5], isCancelPolicy: true, cancellationType: 'FULL', effectiveDate: date,
        premiumDelta: -Math.round(p.gross * 0.5 * 100) / 100, remarks: 'Client moved abroad; cover cancelled with a pro-rata return' });
      const done = await completeEndorsement(ctx, e, { date, cancel: true });
      if ((done.status || dataOf(done).status) !== 'Cancelled') throw new Error(`Cancellation not completed: ${done.status}`);
      p.cancelled = true;
      log.count('Endorsements: cancellation');
      await payRefund(ctx, p, minDate(addDays(date, rnd.int(5, 12)), ctx.today));
    });
  }
  // corporate: sum insured of a fire policy increased for new stocks (additional premium agreed with the insurer)
  const fire = ctx.policies.filter((p) => p.product === 'FIRE' && p.billing === 'broker' && !p.coInsured && p.issueDate < ctx.months[4].start).slice(0, 1);
  for (const p of fire) {
    await log.step(`Sum insured increase on ${p.policyNumber}`, async () => {
      const date = businessDay(rnd, ctx.months.at(-2));
      const delta = Math.round(p.gross * 0.12 * 100) / 100;
      const e = await ops.post('/endorsements/create-endorsement', { policyId: p.id, endorsementTypeIds: ['fire_details'], effectiveDate: date, premiumDelta: delta,
        remarks: 'Additional stocks for the peak season: sum insured increased', coverageChanges: { TotalSumInsured: String(Math.round(p.gross / 0.002)) } });
      const done = await completeEndorsement(ctx, e, { date });
      log.count('Endorsements: additional premium');
      const billId = done.receivableId || dataOf(done).receivableId;
      if (!billId) throw new Error('The additional premium was not billed');
      await payPremium(ctx, { policy: p, amount: delta, date: minDate(addDays(date, rnd.int(5, 15)), ctx.today), bill: billId, mode: 'check' });
    });
  }
}

/** Renewals of the migrated book: expired ones renewed or lapsed, upcoming ones in the pipeline with notices. */
async function renewals(ctx) {
  const { rnd, log, as } = ctx;
  const proc = as.processing1;
  const opts = dataOf(await proc.get('/policy-renewals/options'));
  const window = Number(opts.graceDays || 0) + Number(opts.lapsedRenewalDays || 0);
  const expired = (ctx.migrated || []).filter((m) => m.expiry <= ctx.today);
  // past the grace and lapsed-renewal period a policy is quoted as new business: the renewal must be refused
  for (const m of expired.filter((x) => daysBetween(x.expiry, ctx.today) > window)) {
    await log.step(`Renewal of ${m.policyNumber} refused (expired ${daysBetween(m.expiry, ctx.today)} days ago, window ${window} days)`, async () => {
      const r = await proc.post(`/renewals/policies/${m.id}`, {}).then(() => null, (e) => e);
      if (!r || r.status !== 422) throw new Error(`expected 422, got ${r ? r.status : 'success'}`);
      log.count('Renewals refused after the window');
    });
  }
  const due = expired.filter((m) => daysBetween(m.expiry, ctx.today) <= window);
  const upcoming = (ctx.migrated || []).filter((m) => m.expiry > ctx.today);
  for (const [k, m] of due.entries()) {
    const lapse = k % 4 === 3;
    await log.step(`Renewal of ${m.policyNumber} (expires ${m.expiry}, ${lapse ? 'lapsed' : 'renewed'})`, async () => {
      const rn = dataOf(await proc.post(`/renewals/policies/${m.id}`, {}));
      await proc.post(`/renewals/${rn.id}/notices`, { stage: 1 });
      log.count('Renewal notices sent');
      if (lapse) {
        await proc.post(`/renewals/${rn.id}/lapse`, { reason: rnd.pick(['Client sold the vehicle', 'Client moved to the dealer insurer', 'No response after three notices']) });
        log.count('Renewals lapsed');
        return;
      }
      // renewal quotation re-rated from the current cover, accepted by the client, issued as the next term
      const coverage = m.product === 'FIRE'
        ? { totalSumInsured: String(m.sumInsured), netPremium: String(Math.round(m.net * 1.03)) }
        : { lossAndDamageCoverage: String(Math.round(m.sumInsured * 0.9 / 1000) * 1000), lossAndDamageCoverageRate: '1.65', bodilyInjury: '200000', propertyDamage: '200000' };
      const q = dataOf(await proc.post(`/policy-renewals/policies/${m.id}/quotation`, { coverageDetails: coverage, remarks: `Renewal of ${m.policyNumber}` }));
      const quoteId = q.quotationId || q.quote?.quotationId || q.id;
      const answer = minDate(addDays(m.expiry, -rnd.int(7, 14)), ctx.today);
      await customerAnswer(ctx, as.sales1, quoteId, { outcome: 'accepted', date: answer, channel: 'Phone', reference: 'Renewal confirmed by phone' });
      const issued = minDate(addDays(m.expiry, -rnd.int(1, 5)), ctx.today);
      const extra = { issuedDate: issued, customerInfo: { idType: "Driver's License", idCardNumber: `N${rnd.digits(2)}-${rnd.digits(2)}-${rnd.digits(6)}` } };
      if (m.product === 'MOTOR') {
        extra.idCardImage = await uploadFile(proc, 'id-cards', `id-${m.policyNumber}.png`);
        Object.assign(extra, { chassisNumber: `${rnd.letters(3)}${rnd.digits(2)}${rnd.letters(1)}${rnd.digits(9)}`, motorNumber: `${rnd.digits(1)}${rnd.letters(2)}${rnd.digits(7)}`, plateNumber: m.plate });
      }
      const conv = await as.processing2.post(`/quotations/${quoteId}/convert-to-policy`, { additionalPolicyData: extra });
      const pol = conv.data?.policy || conv.policy;
      log.count('Renewals completed (new term issued)');
      ctx.policies.push({ id: pol.policyId || pol.id, policyNumber: pol.policyNumber, clientId: pol.clientId, segment: 'retail', product: m.product, lob: pol.lob, insurerCode: m.insurerCode,
        gross: Number(pol.grossPremium), net: Number(pol.netPremium), issueDate: issued, inception: pol.inception, expiry: pol.expiry, billing: pol.billingMode || 'broker', sales: 'sales1',
        month: issued.slice(0, 7), renewal: true });
      // renewal premium collected at renewal
      await payPremium(ctx, { policy: ctx.policies.at(-1), amount: Number(pol.grossPremium), date: minDate(addDays(issued, rnd.int(1, 10)), ctx.today) });
    });
  }
  await log.step('Renewal pipeline refresh (policies expiring within the pipeline window)', async () => {
    const r = dataOf(await proc.post('/renewals/pipeline/refresh', {}));
    log.info(`renewal pipeline: ${JSON.stringify(r).slice(0, 160)}`);
  });
  for (const [k, m] of upcoming.entries()) {
    await log.step(`Upcoming renewal ${m.policyNumber} (expires ${m.expiry})`, async () => {
      const rn = dataOf(await proc.post(`/renewals/policies/${m.id}`, {}));
      await proc.post(`/renewals/${rn.id}/notices`, { stage: 1 });
      log.count('Renewal notices sent');
      await proc.post(`/renewals/${rn.id}/reminders`, { method: rnd.pick(['SMS', 'Phone', 'Email']), note: 'Client reminded of the expiry' });
      if (k === 0) {
        // renewal terms re-rated in the renewal workspace, approved by a second processor and completed
        await proc.post(`/renewals/${rn.id}/quote`, {});
        await proc.post(`/renewals/${rn.id}/submit`, { note: 'Same terms; loyalty discount applied' });
        await as.processing2.post(`/renewals/${rn.id}/approve`, { decision: 'approve', note: 'Terms checked' });
        const done = dataOf(await proc.post(`/renewals/${rn.id}/complete`, {}));
        const np = done.newPolicy;
        const pol = await proc.get(`/policies/${np.id}`);
        // the new term must carry what the registers and the ledger read: issue date, product, line, insured, net premium
        const missing = ['issuedDate', 'lob', 'insuredName', 'netPremium'].filter((f) => !pol[f]);
        if (missing.length) throw new Error(`Renewed policy ${np.policyNumber} has no ${missing.join(', ')}`);
        log.count('Renewals completed (new term issued)');
        ctx.policies.push({ id: np.id, policyNumber: np.policyNumber, clientId: pol.clientId, segment: 'retail', product: m.product, lob: pol.lob, insurerCode: m.insurerCode,
          gross: Number(pol.grossPremium), net: Number(pol.netPremium), issueDate: pol.issuedDate, inception: pol.inception, expiry: pol.expiry, billing: pol.billingMode || 'broker', sales: 'sales1',
          month: String(pol.issuedDate).slice(0, 7), renewal: true, behaviour: 'open' });
      }
    });
  }
}

/** Claims: registration with documents, review, adjuster, settlement with maker-checker, closure; some without payment. */
async function claims(ctx) {
  const { rnd, log, as } = ctx;
  const c1 = as.claims1;
  const c2 = as.claims2;
  const paid = ctx.policies.filter((p) => p.behaviour === 'full' && !p.cancelled && p.billing === 'broker' && p.issueDate < ctx.months.at(-2).start);
  const byProduct = (code) => paid.filter((p) => p.product === code);
  const cases = [
    { p: byProduct('MOTOR')[0], type: 'Collision', estimate: 85000, settle: 72500, how: 'Repair Shop' },
    { p: byProduct('MOTOR')[1], type: 'Windshield breakage', estimate: 18000, settle: 16500, how: 'Bank Transfer' },
    { p: byProduct('FIRE')[0], type: 'Fire (electrical short circuit) in the warehouse', estimate: 1250000, settle: 980000, how: 'Paid through broker' },
    { p: byProduct('PA')[0], type: 'Accident: fractured wrist (medical reimbursement)', estimate: 35000, settle: 28750, how: 'Bank Transfer' },
    { p: byProduct('HOME')[0], type: 'Typhoon damage to the roof', estimate: 120000, reject: 'Loss below the deductible (2% of the sum insured)' },
    { p: byProduct('MARINE')[0] || byProduct('CGL')[0] || byProduct('MONEY')[0], type: 'Cargo wetted during discharge / third-party property damage', estimate: 340000, open: true },
    { p: byProduct('MOTOR')[3], type: 'Flood damage (engine hydrolock)', estimate: 150000, open: true },
    { p: byProduct('MOTOR')[2], type: 'Theft of side mirrors', estimate: 12000, withdraw: 'Client withdrew the claim (below the deductible)' },
  ].filter((x) => x.p);
  for (const x of cases) {
    const p = x.p;
    await log.step(`Claim on ${p.policyNumber}: ${x.type}`, async () => {
      const loss = minDate(maxDate(addDays(p.inception, rnd.int(20, 60)), addDays(p.issueDate, 10)), addDays(ctx.today, -3));
      const pol = await c1.get(`/policies/${p.id}`);
      const fields = {
        policyNumber: p.policyNumber, policyRefId: p.id, lob: p.lob, claimStatus: 'Pending', claimType: p.product === 'MOTOR' ? 'Motor' : p.product === 'FIRE' ? 'Property' : p.product === 'MARINE' ? 'Marine' : 'Accident',
        claimPriority: x.estimate > 500000 ? 'High' : 'Medium', dateOfIncident: loss, reportedDate: minDate(addDays(loss, rnd.int(0, 3)), ctx.today), timeOfIncident: `${String(rnd.int(6, 21)).padStart(2, '0')}:${rnd.pick(['00', '15', '30', '45'])}`,
        addressOfIncident: pol.client?.houseNo || 'Client premises', cityOfIncident: pol.client?.city || 'Makati', provinceOfIncident: pol.client?.province || 'Metro Manila',
        typeOfIncident: x.type, estimatedClaimAmount: x.estimate, description: x.type, policyInfo: { policyHolderName: pol.insuredName },
        ...(p.product === 'MOTOR' ? { driverDetails: { driverName: pol.insuredName }, thirdPartyDetails: { thirdPartyName: rnd.pick(['Pedro Cruz', 'Lorna Diaz', 'none']) } } : {}),
        emailData: { mailSubject: `Claim notification ${p.policyNumber}`, write: 'Please see the attached notice of loss.' },
      };
      const created = dataOf(await c1.upload('POST', '/claims', fields, [{ field: 'claimDocument', name: 'notice-of-loss.pdf', type: 'application/pdf', data: PDF('notice of loss') }]));
      const id = created.id || created.claimId;
      log.count('Claims notified');
      if (x.withdraw) {
        await c1.put(`/claims/rejectclaim/${id}`, { reason: x.withdraw });
        await c1.put(`/claims/close/${id}`, { remarks: 'Closed without payment' });
        log.count('Claims closed without payment');
        return;
      }
      await c1.put(`/claims/updatestatus/${id}`, { claimStatus: 'Processing' });
      await c1.upload('PUT', `/claims/${id}`, { insuranceCompanyClaimNumber: `${p.insurerCode}-CL-${rnd.digits(6)}`, adjusterName: rnd.pick(['Cordillera Adjusters Inc.', 'Visayan Loss Adjusters', 'Metro Survey and Adjusting Corp.']),
        adjusterStatus: 'Report received' }, [{ field: 'file', name: 'adjuster-report.pdf', type: 'application/pdf', data: PDF('adjuster report') }]);
      if (x.open) { log.count('Claims open (under review)'); return; }
      if (x.reject) {
        await c1.put(`/claims/rejectclaim/${id}`, { reason: x.reject });
        await c1.put(`/claims/close/${id}`, { remarks: 'Closed without payment' });
        log.count('Claims closed without payment');
        return;
      }
      const settleOn = minDate(addDays(loss, rnd.int(20, 45)), ctx.today);
      await c1.upload('PUT', `/claims/settle/${id}`, { settlementType: x.how, settlementAmount: String(x.settle), settlementIssueDate: settleOn, settlementDate: settleOn },
        [{ field: 'settlementDocument', name: 'release-and-quitclaim.pdf', type: 'application/pdf', data: PDF('release and quitclaim') }]);
      const ap = dataOf(await c2.put(`/claims/approve-settlement/${id}`, { decision: 'approve', approvedAmount: x.settle }));
      if (ap.lifecycleStatus !== 'settled') throw new Error(`Claim not settled after approval (${ap.lifecycleStatus})`);
      log.count('Claims settled');
      if (/broker/i.test(x.how)) {
        // the insurer pays the broker, the broker pays the insured by cheque
        const pos = dataOf(await c1.get(`/claims/${id}/settlement-cash`));
        for (const ins of pos.insurers) {
          await as.accounting1.post(`/claims/${id}/settlement-cash/funds-received`, { insurerId: ins.insurerId, amount: ins.recoverable, bankAccount: 'BDO-OPS', date: settleOn, reference: `RA-${rnd.digits(6)}` });
        }
        await as.accounting1.post(`/claims/${id}/settlement-cash/paid-to-claimant`, { amount: x.settle, bankAccount: 'BDO-OPS', paymentMode: 'check', reference: `CHK ${rnd.digits(7)}`,
          payee: pol.insuredName, date: minDate(addDays(settleOn, 3), ctx.today) });
        log.count('Claim settlements paid through the broker');
      }
      await c1.put(`/claims/updatestatus/${id}`, { claimStatus: 'Closed' });
      log.count('Claims closed after settlement');
    });
  }
}

export async function servicing(ctx) {
  ctx.log.setPhase('Servicing: endorsements, renewals, claims');
  await endorsements(ctx);
  await renewals(ctx);
  await claims(ctx);
  // a prospect that did not go further than the lead (still to be contacted)
  await ctx.log.step('Lead still being worked (no quotation yet)', () => createLead(ctx, ctx.as.sales2, { firstName: 'Gregorio', lastName: 'Evangelista', emailId: 'greg.evangelista@yahoo.example',
    contactNumber: '09171234599', leadCategory: 'Retail', lob: 'MOTOR', city: 'Cebu City', province: 'Cebu', country: 'Philippines', source: 'Facebook page', status: 'Contacted',
    notes: 'Asked for a quotation for a 2026 Toyota Raize; call back next week' }));
}
