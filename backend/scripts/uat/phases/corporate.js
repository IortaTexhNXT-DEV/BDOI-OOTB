/**
 * Corporate non-package business through the placement journey: Request for Quotation (broker slip) to two to four
 * insurers, their offers or declines, the Quotation Slip (co-insurance when the lines are shared), the customer's answer,
 * the Placement Slip sent to the insurers, each insurer's binding and the policy issued from the bound placement.
 */
import { dataOf } from '../http.js';
import { addDays, addMonths, minDate } from '../dates.js';
import { company, COMPANIES, createLead, customerAnswer, businessDay, insurerCodeOf } from './common.js';

const MARKET = ['UAT-PCIC', 'UAT-LUZ', 'UAT-VIS', 'UAT-MIN', 'UAT-ARC', 'UAT-TALA', 'UAT-HAR'];

/** Risk of each non-package product: covers, sum insured and the premium the market quotes. */
const RISKS = {
  FIRE: (rnd, c) => {
    const bldg = rnd.amount(20000000, 180000000, 500000);
    const stock = rnd.amount(5000000, 80000000, 500000);
    return { productType: 'Fire and Allied Perils', sumInsured: bldg + stock, rate: rnd.pick([0.0012, 0.0018, 0.0022, 0.0028, 0.0035]),
      riskDetails: { location: `${c.houseNo}, ${c.barangay}, ${c.city}`, occupancy: c.industry, construction: rnd.pick(['Class A (concrete)', 'Class B (steel frame, concrete walls)']), earthquakeZone: rnd.pick(['Zone 1', 'Zone 2']) },
      requestedCovers: [{ cover: 'Fire and lightning (building)', sumInsured: bldg }, { cover: 'Fire and lightning (stocks and contents)', sumInsured: stock },
        { cover: 'Typhoon, flood and earthquake', sumInsured: bldg + stock, deductible: '2% of the loss, minimum PHP 250,000' }] };
  },
  IAR: (rnd, c) => {
    const pd = rnd.amount(250000000, 1200000000, 5000000);
    const bi = rnd.amount(50000000, 200000000, 5000000);
    return { productType: 'Industrial All Risks', sumInsured: pd + bi, rate: rnd.pick([0.0008, 0.001, 0.0012, 0.0015]),
      riskDetails: { location: `${c.houseNo}, ${c.city}`, occupancy: c.industry, construction: 'Steel frame, concrete', natureOfBusiness: c.industry },
      requestedCovers: [{ cover: 'Material damage (all risks)', sumInsured: pd }, { cover: 'Business interruption (12 months indemnity)', sumInsured: bi }] };
  },
  CAR: (rnd, c) => {
    const works = rnd.amount(60000000, 450000000, 1000000);
    return { productType: "Contractor's All Risks", sumInsured: works + 10000000, rate: rnd.pick([0.0015, 0.002, 0.0025, 0.003]),
      riskDetails: { project: `${rnd.pick(['Mid-rise office building', 'Warehouse complex', 'Residential tower', 'Commercial strip mall'])} at ${c.city}`, contractPeriodMonths: rnd.int(12, 30), principal: c.companyName },
      requestedCovers: [{ cover: 'Contract works', sumInsured: works }, { cover: 'Third party liability', sumInsured: 10000000 }] };
  },
  EAR: (rnd, c) => {
    const plant = rnd.amount(80000000, 380000000, 1000000);
    return { productType: 'Erection All Risks', sumInsured: plant, rate: rnd.pick([0.0022, 0.0028, 0.0035]),
      riskDetails: { project: `${rnd.pick(['Installation of a 5 MW generator set', 'Cold storage refrigeration plant', 'Bottling line', 'Solar panel array and inverters'])} at ${c.city}`, testingPeriodWeeks: 4 },
      requestedCovers: [{ cover: 'Plant and machinery under erection', sumInsured: plant }, { cover: 'Testing and commissioning (4 weeks)', sumInsured: plant }] };
  },
  MARINE: (rnd, c) => {
    const annual = rnd.amount(20000000, 120000000, 1000000);
    return { productType: 'Marine Cargo', sumInsured: annual, rate: rnd.pick([0.001, 0.0015, 0.002, 0.0025]),
      riskDetails: { voyage: rnd.pick(['Manila to Cebu and Davao (inter-island)', 'Ningbo, China to Manila (import)', 'Cebu to Busan, Korea (export)']), cargo: c.industry, basis: 'Annual open cover, declarations monthly', conveyance: 'Container vessel' },
      requestedCovers: [{ cover: 'Institute Cargo Clauses (A)', sumInsured: annual }, { cover: 'War and strikes clauses', sumInsured: annual }] };
  },
  CGL: (rnd) => {
    const limit = rnd.pick([5000000, 10000000, 20000000, 50000000]);
    return { productType: 'Comprehensive General Liability', sumInsured: limit, flat: Math.round(limit * rnd.pick([0.004, 0.006, 0.008])),
      riskDetails: { limitBasis: 'Any one occurrence and in the aggregate', premises: 'Head office and branches', products: 'Included' },
      requestedCovers: [{ cover: 'Bodily injury and property damage to third parties', sumInsured: limit }, { cover: 'Products and completed operations', sumInsured: limit }] };
  },
  MONEY: (rnd) => {
    const onPremises = rnd.pick([1000000, 2000000, 5000000]);
    const transit = rnd.pick([500000, 1000000, 3000000]);
    return { productType: 'Money and Securities', sumInsured: onPremises + transit, rate: rnd.pick([0.009, 0.011, 0.013]),
      riskDetails: { cashHandling: rnd.pick(['Daily store collections', 'Payroll cash', 'Branch vault']), armouredCar: rnd.chance(0.5) ? 'Yes' : 'No' },
      requestedCovers: [{ cover: 'Money and securities on premises (in safe)', sumInsured: onPremises }, { cover: 'Money and securities in transit', sumInsured: transit }] };
  },
  EB: (rnd) => {
    const heads = rnd.int(60, 450);
    return { productType: 'Group Employee Benefits', sumInsured: heads * 500000, flat: heads * rnd.pick([6800, 8200, 9500, 11800]),
      riskDetails: { headcount: heads, plan: 'Group life 500,000 per employee; HMO in-patient and out-patient', dependents: rnd.chance(0.5) ? 'Spouse and two children' : 'Principal only' },
      requestedCovers: [{ cover: 'Group term life', sumInsured: heads * 500000 }, { cover: 'Hospitalisation and out-patient (HMO)', sumInsured: heads * 150000 }] };
  },
};

/** Corporate book: the product of each company, co-insurance, billing and what the market and client do. */
function corporatePlan(ctx) {
  const n = Math.round(20 * ctx.cfg.scale);
  const products = ['FIRE', 'IAR', 'CAR', 'MARINE', 'CGL', 'MONEY', 'EB', 'FIRE', 'EAR', 'MARINE', 'FIRE', 'CGL', 'IAR', 'MONEY', 'FIRE', 'EB', 'CAR', 'MARINE', 'FIRE', 'EAR'];
  const plan = [];
  for (let i = 0; i < n; i += 1) {
    const product = products[i % products.length];
    plan.push({
      i, product, company: COMPANIES[i % COMPANIES.length], month: ctx.months[(i + 2) % ctx.months.length],
      coInsurance: ['IAR', 'EAR'].includes(product) || (product === 'FIRE' && i % 2 === 0) || (product === 'CAR' && i % 3 === 0),
      outcome: i === 6 ? 'not-taken-up' : i === 13 ? 'declined' : 'accepted',
      billing: [4, 9, 15].includes(i) ? 'direct' : 'broker', sales: i % 2 ? 'sales1' : 'sales2', processing: i % 2 ? 'processing1' : 'processing2',
    });
  }
  // a second risk for some companies (e.g. the fire client also insures its money on premises)
  for (let i = 0; i < Math.round(4 * ctx.cfg.scale); i += 1) {
    const base = plan[i * 3];
    if (!base) break;
    plan.push({ ...base, i: n + i, second: true, product: ['MONEY', 'CGL', 'MARINE', 'FIRE'][i % 4], coInsurance: false, outcome: 'accepted', billing: 'broker',
      month: ctx.months[(i * 2 + 1) % ctx.months.length] });
  }
  return plan;
}

async function placeRisk(ctx, item, lead, prospect) {
  const { rnd, as, log } = ctx;
  const processing = as[item.processing];
  const sales = as[item.sales];
  const spec = RISKS[item.product](rnd, prospect);
  const issueDate = businessDay(rnd, item.month);
  const slipDate = addDays(issueDate, -rnd.int(10, 20));
  const inception = addDays(issueDate, rnd.int(-5, 7));
  const expiry = addMonths(inception, item.product === 'CAR' || item.product === 'EAR' ? rnd.int(12, 18) : 12);
  const market = rnd.sample(MARKET, item.coInsurance ? rnd.int(3, 4) : rnd.int(2, 3));
  const product = ctx.products[item.product];
  const slip = await processing.post('/broker-slips', { leadRefId: lead.id, productId: product.id, productType: spec.productType, riskDetails: spec.riskDetails,
    requestedCovers: spec.requestedCovers, sumInsured: spec.sumInsured, insurers: market, inceptionDate: inception, expiryDate: expiry, responseDueDate: addDays(slipDate, 7),
    remarks: `Request for quotation prepared on ${slipDate}` });
  const slipId = slip.id || dataOf(slip).id;
  log.count(`Requests for quotation (corporate ${item.product})`);
  await processing.post(`/broker-slips/${slipId}/submit`, {});
  const offers = (await processing.get(`/broker-slips/${slipId}`)).offers;
  const base = spec.flat || Math.round(spec.sumInsured * spec.rate);
  // the insurers answer: one declines when three or more were approached; lines are shared on co-insured risks
  const shares = item.coInsurance ? (offers.length >= 4 ? [50, 30, 20] : [60, 40]) : [100];
  const decliner = offers.length >= 3 ? offers.length - 1 : -1;
  const offered = [];
  for (const [k, o] of offers.entries()) {
    if (k === decliner) {
      await processing.put(`/broker-slips/${slipId}/offers/${o.id}`, { status: 'declined', declineReason: rnd.pick(['Outside underwriting appetite', 'Treaty capacity used for the zone', 'Occupancy excluded']) });
      log.count('Insurer declines recorded');
      continue;
    }
    const premium = Math.round(base * (1 + (k * 0.07) + rnd.float() * 0.05));
    const share = shares[offered.length] ?? 0;
    await processing.put(`/broker-slips/${slipId}/offers/${o.id}`, { status: 'offered', premium, offeredShare: item.coInsurance ? share || 20 : 100,
      insurerReference: `${ctx.insurers[insurerCodeOf(ctx, o.insuranceCompanyId)].short.split(' ')[0].toUpperCase()}-OFR-${rnd.digits(5)}`, deductibles: rnd.pick(['PHP 50,000 each and every loss', '1% of the sum insured, minimum PHP 100,000', 'PHP 250,000 each and every loss']),
      terms: rnd.pick(['Standard policy wording; warranties as per survey', 'Subject to a risk survey within 30 days', 'Sprinkler and hydrant system warranted']), validityDate: addDays(issueDate, 30) });
    offered.push(o);
    log.count('Insurer offers recorded');
  }
  if (item.outcome === 'not-taken-up') {
    await processing.post(`/broker-slips/${slipId}/close`, { reason: 'Client renewed with its existing broker' });
    log.count('Requests for quotation closed (not taken up)');
    return null;
  }
  const selected = item.coInsurance ? offered.slice(0, shares.length) : [offered[0]];
  const shareBy = item.coInsurance ? Object.fromEntries(selected.map((o, k) => [o.id, shares[k]])) : {};
  const prepared = await processing.post(`/broker-slips/${slipId}/prepare-quotation`, { offerIds: selected.map((o) => o.id), shares: shareBy, leadOfferId: selected[0].id });
  const quoteId = prepared.quotationId || dataOf(prepared).quotationId;
  log.count(`Quotation slips (${item.product}${item.coInsurance ? ', co-insurance' : ''})`);
  const answerDate = minDate(addDays(issueDate, -rnd.int(3, 8)), ctx.today);
  if (item.outcome === 'declined') {
    await customerAnswer(ctx, sales, quoteId, { outcome: 'declined', date: answerDate, channel: 'Meeting', remarks: 'Board approved a lower budget; cover deferred to next year' });
    return null;
  }
  await customerAnswer(ctx, sales, quoteId, { outcome: 'accepted', date: answerDate, channel: rnd.pick(['E-mail', 'Signed form', 'Meeting']), evidence: true,
    reference: `Letter of authority ${rnd.digits(4)}` });
  const placement = await processing.post('/placements', { quoteId, inceptionDate: inception, expiryDate: expiry, billingMode: item.billing === 'direct' ? 'direct' : undefined,
    remarks: 'Firm order per the accepted quotation slip' });
  const placementId = placement.id || dataOf(placement).id;
  log.count('Placement slips');
  await processing.post(`/placements/${placementId}/send`, {});
  const parts = (await processing.get(`/placements/${placementId}`)).participants;
  for (const x of parts) {
    const ins = Object.values(ctx.insurers).find((z) => z.id === Number(x.insuranceCompanyId));
    await processing.post(`/placements/${placementId}/confirm`, { confirmations: [{ insuranceCompanyId: x.insuranceCompanyId, insurerReference: `${ins.short.split(' ')[0].toUpperCase()}-${item.product}-${issueDate.slice(0, 4)}-${rnd.digits(6)}` }] });
    log.count('Insurer bindings recorded');
  }
  const issued = await processing.post(`/placements/${placementId}/issue-policy`, { additionalPolicyData: { insuredName: prospect.companyName, issuedDate: issueDate, inception, expiry } });
  const pol = issued.data?.policy || issued.policy || (await processing.get(`/policies/${issued.policyId || issued.data?.policyId}`));
  log.count(`Policies issued (corporate ${item.product})`);
  const record = {
    id: pol.policyId || pol.id, policyNumber: pol.policyNumber, clientId: pol.clientId, leadId: lead.id, segment: 'corporate', product: item.product, lob: pol.lob,
    insurerCode: insurerCodeOf(ctx, pol.insuranceCompanyId), coInsured: selected.length > 1, gross: Number(pol.grossPremium), net: Number(pol.netPremium),
    issueDate, inception: pol.inception || inception, expiry: pol.expiry || expiry, billing: pol.billingMode || item.billing, sales: item.sales, month: item.month.period, quoteId,
  };
  ctx.policies.push(record);
  return record;
}

export async function corporate(ctx) {
  const { log, rnd, as } = ctx;
  log.setPhase('Corporate non-package business');
  const leads = new Map();
  for (const item of corporatePlan(ctx)) {
    let entry = leads.get(item.company.name);
    if (!entry) {
      const prospect = company(rnd, item.company);
      const lead = await log.step(`Lead ${prospect.companyName}`, () => createLead(ctx, as[item.sales], {
        ...prospect, leadCategory: 'Corporate', lob: item.product, productType: item.product, source: rnd.pick(['Referral', 'Industry association', 'Existing client referral', 'Bank tie-up']),
        notes: `Contact person ${prospect.contactPerson}; ${prospect.industry}`,
      }), { who: as[item.sales].username });
      if (!lead) continue;
      entry = { lead, prospect };
      leads.set(item.company.name, entry);
      ctx.clients.push({ leadId: lead.id, segment: 'corporate', name: prospect.companyName, prospect });
    }
    await log.step(`${item.product} for ${entry.prospect.companyName} (${item.month.period}${item.coInsurance ? ', co-insurance' : ''}${item.billing === 'direct' ? ', direct bill' : ''}, ${item.outcome})`,
      () => placeRisk(ctx, item, entry.lead, entry.prospect), { who: as[item.processing].username });
  }
  await log.step('Record Issued Policy: surety bond the insurer already issued', () => recordIssued(ctx));
}

/** Direct policy entry: a performance bond the insurer issued before the broker was engaged. */
async function recordIssued(ctx) {
  const { rnd, as } = ctx;
  // an existing corporate client (its first policy was placed through the journey)
  const known = ctx.policies.filter((p) => p.segment === 'corporate' && p.clientId);
  const client = known.find((p) => /Builders|Construction/.test(ctx.clients.find((x) => x.leadId === p.leadId)?.name || '')) || known[0];
  const month = ctx.months[3];
  const issueDate = businessDay(rnd, month);
  const number = `TALA-PB-${issueDate.slice(0, 4)}-${rnd.digits(5)}`;
  const r = await as.processing1.post('/placements/record-issued-policy', {
    clientId: client.clientId, productId: ctx.products.BOND.id, productType: 'Surety Bond', policyNumber: number, issuedDate: issueDate, inceptionDate: issueDate, expiryDate: addMonths(issueDate, 12),
    sumInsured: 15000000, netPremium: 67500, riskDetails: { obligee: 'Department of Public Works and Highways', contract: 'Road widening, package 3' },
    participants: [{ insuranceCompanyId: ctx.insurers['UAT-TALA'].id, sharePercent: 100, isLead: true, insurerReference: number }],
  });
  const pol = r.data?.policy || r.policy;
  ctx.policies.push({ id: pol.id || pol.policyId, policyNumber: pol.policyNumber, clientId: pol.clientId, leadId: client.leadId, segment: 'corporate', product: 'BOND', lob: pol.lob, insurerCode: 'UAT-TALA',
    gross: Number(pol.grossPremium), net: Number(pol.netPremium), issueDate, inception: pol.inception, expiry: pol.expiry, billing: pol.billingMode || 'broker', sales: 'sales1', month: month.period });
  ctx.log.count('Policies recorded as already issued (direct policy entry)');
}
