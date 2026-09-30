/**
 * Reinsurance and incentives, so their registers carry the scenario's business: a property quota share treaty (maker-
 * checker) with cessions of large corporate risks, a facultative cession, and the Account Executives' monthly incentive
 * (program, calculation, approval by a second user, payment).
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
  const number = `UAT-QS-PROP-${year}`;
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
  const code = 'UAT-INC-NB';
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

export async function extras(ctx) {
  ctx.log.setPhase('Reinsurance and incentives');
  await ctx.log.step('Reinsurance: treaty and cessions of large property risks', () => reinsurance(ctx));
  await ctx.log.step('Account Executive incentives for the month', () => incentives(ctx));
}
