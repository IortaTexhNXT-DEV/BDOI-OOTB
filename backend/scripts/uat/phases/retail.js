/**
 * Retail package business: Motor comprehensive with CTPL (motor tariff quick quote), CTPL only, Personal Accident,
 * Travel and Householder. Motor goes through the quotation wizard; the other package products through a Request for
 * Quotation to two insurers, as the Quick Quote screen does. The customer's answer is recorded as a customer response
 * (e-mail is off), then the Processing Team issues the policy with the issue date of the month it belongs to.
 */
import { dataOf } from '../http.js';
import { VEHICLES, MOTORCYCLES, COLOURS, DESTINATIONS } from '../data.js';
import { addDays, addMonths, minDate } from '../dates.js';
import { person, createLead, customerAnswer, uploadFile, businessDay, insurerCodeOf } from './common.js';

const MOTOR_INSURERS = ['UAT-PCIC', 'UAT-LUZ', 'UAT-VIS', 'UAT-MIN', 'UAT-ARC', 'UAT-HAR'];

/** The retail book: product per prospect and what happens to the quotation. */
function retailPlan(ctx) {
  const n = Math.round(40 * ctx.cfg.scale);
  const products = ['MOTOR', 'MOTOR', 'CTPL', 'PA', 'MOTOR', 'TRAVEL', 'HOME', 'MOTOR', 'PA', 'HOME', 'CTPL', 'TRAVEL', 'MOTOR', 'HOME', 'PA', 'MOTOR', 'TRAVEL', 'CTPL', 'MOTOR', 'HOME'];
  const plan = [];
  for (let i = 0; i < n; i += 1) {
    // most quotations are accepted; a few are declined, sent back for revision or still with the customer
    const outcome = i % 13 === 5 ? 'declined' : i % 17 === 7 ? 'pending' : i % 19 === 11 ? 'revise' : 'accepted';
    plan.push({ i, product: products[i % products.length], month: ctx.months[i % ctx.months.length], outcome, sales: i % 2 ? 'sales2' : 'sales1' });
  }
  return plan;
}

function motorQuoteBody(ctx, lead, insurerCode, { ctplOnly = false, motorcycle = false, inception }) {
  const { rnd } = ctx;
  const v = motorcycle ? rnd.pick(MOTORCYCLES) : rnd.pick(VEHICLES);
  const year = rnd.int(2019, 2026);
  const brandNew = year === 2026 && !motorcycle;
  const plate = brandNew ? '' : motorcycle ? `${rnd.digits(3)} ${rnd.letters(3)}` : `${rnd.letters(3)} ${rnd.digits(4)}`;
  const body = {
    leadRefId: lead.id, productType: ctplOnly ? 'CTPL' : 'Motor', insurancePolicyType: ctplOnly ? 'CTPL' : 'COMP', vehicleType: v.type, includeCTPL: true,
    ctplTermYears: brandNew && v.type === 'private_cars' && rnd.chance(0.6) ? 3 : 1,
    participantDetails: [{ insuranceCompanyName: ctx.insurers[insurerCode].name }], inception,
    insuranceVehicleDetails: [{ vehicleBrand: v.brand, vehicleModel: v.model, variant: v.variant || '', modelYear: String(year), color: rnd.pick(COLOURS), plateNumber: plate,
      mvFileNumber: brandNew ? `13${rnd.digits(13)}` : undefined }],
    remarks: ctplOnly ? 'CTPL for LTO registration' : 'Comprehensive with CTPL and Auto Passenger PA',
  };
  if (!ctplOnly) {
    const value = rnd.amount(v.value[0], v.value[1], 10000);
    Object.assign(body, {
      lossAndDamageCoverage: value, lossAndDamageCoverageRate: rnd.pick([1.25, 1.35, 1.5, 1.65, 1.75, 2]), actsOfNatureRate: rnd.pick([0.5, 0.5, 0.75]),
      bodilyInjury: rnd.pick([100000, 200000, 300000]), propertyDamage: rnd.pick([100000, 200000, 300000]), autoPassengerPersonalAccident: rnd.pick([50000, 100000]),
      appaSeats: v.type === 'ac_and_tourist_cars' ? 8 : 5, discount: rnd.chance(0.25) ? rnd.pick([500, 1000, 1500]) : 0,
    });
  }
  return { body, vehicle: { ...v, year, plate, brandNew } };
}

/** Motor or CTPL: quick quote from the tariff, quotation, customer answer, KYC, issuance. */
async function motorSale(ctx, item, lead, prospect) {
  const { rnd, as, log } = ctx;
  const sales = as[item.sales];
  const issueDate = businessDay(rnd, item.month);
  const inception = addDays(issueDate, rnd.int(0, 5));
  const insurerCode = rnd.pick(MOTOR_INSURERS);
  const ctplOnly = item.product === 'CTPL';
  const { body, vehicle } = motorQuoteBody(ctx, lead, insurerCode, { ctplOnly, motorcycle: ctplOnly && item.i % 3 === 1, inception });
  // business referred by a sub-agent carries the commission split on the order summary (primary referrer, comsub rate)
  const referrer = !ctplOnly && ctx.referrers?.length && item.i % 4 === 0 ? ctx.referrers[(item.i / 4) % ctx.referrers.length] : null;
  if (referrer) body.commissionDetails = { brokeragePct: 20, primary: { referrerId: referrer.id, level: referrer.level, comsubPct: referrer.type === 'External' ? 7.5 : 5 }, chain: [] };
  // quick quote: the premium from the motor tariff before the quotation is saved
  const calc = dataOf(await sales.post('/quotations/calculate-premium', body));
  if (!(calc.grossPremium > 0)) throw new Error('Quick quote returned no premium');
  const quote = await sales.post('/quotations', body);
  const quoteId = quote.quotationId || dataOf(quote).quotationId;
  log.count(ctplOnly ? 'Quotations (CTPL only)' : 'Quotations (motor comprehensive with CTPL)');
  if (Math.abs(Number(quote.grossPremium ?? dataOf(quote).grossPremium) - calc.grossPremium) > 0.01) throw new Error(`Saved quotation premium ${quote.grossPremium} differs from the quick quote ${calc.grossPremium}`);
  return finishQuote(ctx, item, { quoteId, lead, prospect, issueDate, inception, insurerCode, vehicle, lob: 'MOTOR', product: ctplOnly ? 'CTPL' : 'MOTOR' });
}

const RFQ = {
  PA: (rnd) => {
    const ad = rnd.pick([300000, 500000, 750000, 1000000]);
    return { productType: 'Personal Accident', sumInsured: ad, rate: rnd.pick([0.0035, 0.004, 0.0045]),
      riskDetails: { occupation: rnd.pick(['Office employee', 'Teacher', 'Nurse', 'Engineer', 'Business owner', 'IT consultant']), beneficiary: 'Legal heirs', plan: 'Individual' },
      requestedCovers: [{ cover: 'Accidental death and disablement', sumInsured: ad }, { cover: 'Accident medical reimbursement', sumInsured: Math.round(ad / 10) }] };
  },
  TRAVEL: (rnd) => {
    const si = rnd.pick([1500000, 2800000, 5600000]);
    return { productType: 'Travel Insurance', sumInsured: si, flat: rnd.amount(900, 3800, 50), term: rnd.int(5, 21),
      riskDetails: { destination: rnd.pick(DESTINATIONS), travellers: rnd.int(1, 4), purpose: rnd.pick(['Leisure', 'Business', 'Visiting relatives']) },
      requestedCovers: [{ cover: 'Emergency medical and hospitalisation abroad', sumInsured: si }, { cover: 'Trip cancellation', sumInsured: 100000 }, { cover: 'Baggage delay and loss', sumInsured: 30000 }] };
  },
  HOME: (rnd) => {
    const dwelling = rnd.amount(1500000, 6000000, 50000);
    const contents = rnd.amount(300000, 1200000, 50000);
    return { productType: 'Householder Insurance', sumInsured: dwelling + contents, rate: rnd.pick([0.0015, 0.0018, 0.0022, 0.0025]),
      riskDetails: { construction: rnd.pick(['Concrete', 'Concrete and steel', 'Semi-concrete']), occupancy: 'Dwelling', storeys: rnd.int(1, 3), flood: rnd.chance(0.3) ? 'Flood-prone area' : 'No flood history' },
      requestedCovers: [{ cover: 'Dwelling: fire, typhoon, flood, earthquake', sumInsured: dwelling }, { cover: 'Household contents incl. burglary', sumInsured: contents }] };
  },
};

/** PA, Travel, Householder: Request for Quotation to two insurers, offers, Quotation Slip, customer answer, issuance. */
async function rfqSale(ctx, item, lead, prospect) {
  const { rnd, as, log } = ctx;
  const sales = as[item.sales];
  const issueDate = businessDay(rnd, item.month);
  const spec = RFQ[item.product](rnd);
  const inception = item.product === 'TRAVEL' ? addDays(issueDate, rnd.int(3, 20)) : addDays(issueDate, rnd.int(0, 5));
  const expiry = item.product === 'TRAVEL' ? addDays(inception, spec.term) : addMonths(inception, 12);
  const market = rnd.sample(['UAT-PCIC', 'UAT-LUZ', 'UAT-VIS', 'UAT-HAR', 'UAT-ARC'], 2);
  const product = ctx.products[item.product];
  const slip = await sales.post('/broker-slips', { leadRefId: lead.id, productId: product.id, productType: spec.productType, riskDetails: spec.riskDetails,
    requestedCovers: spec.requestedCovers, sumInsured: spec.sumInsured, insurers: market, inceptionDate: inception, expiryDate: expiry,
    remarks: `Quick quote request (${spec.productType})` });
  const slipId = slip.id || dataOf(slip).id;
  log.count(`Requests for quotation (retail ${item.product})`);
  await sales.post(`/broker-slips/${slipId}/submit`, {});
  const offers = (await sales.get(`/broker-slips/${slipId}`)).offers || [];
  for (const [k, o] of offers.entries()) {
    const premium = spec.flat ? Math.round(spec.flat * (1 + k * rnd.float() * 0.2)) : Math.round(spec.sumInsured * spec.rate * (1 + k * rnd.float() * 0.15));
    await sales.put(`/broker-slips/${slipId}/offers/${o.id}`, { status: 'offered', premium, offeredShare: 100, insurerReference: `${ctx.insurers[insurerCodeOf(ctx, o.insuranceCompanyId)].short.split(' ')[0].toUpperCase()}-Q-${rnd.digits(6)}`,
      deductibles: item.product === 'HOME' ? '2% of the loss, minimum PHP 5,000' : 'None', terms: 'Standard wording of the insurer', validityDate: addDays(issueDate, 30) });
    log.count('Insurer offers recorded');
  }
  const cmp = (await sales.get(`/broker-slips/${slipId}/comparison`)).data;
  const best = cmp.rows.find((r) => r.isBest) || cmp.rows[0];
  const prepared = await sales.post(`/broker-slips/${slipId}/prepare-quotation`, { offerIds: [best.id] });
  const quoteId = prepared.quotationId || dataOf(prepared).quotationId;
  log.count(`Quotations (${item.product})`);
  const insurerCode = insurerCodeOf(ctx, best.insuranceCompanyId);
  return finishQuote(ctx, item, { quoteId, lead, prospect, issueDate, inception, expiry, insurerCode, lob: product.line?.toUpperCase(), product: item.product });
}

/** Customer answer and, when accepted, KYC and issuance by the Processing Team. */
async function finishQuote(ctx, item, q) {
  const { rnd, as, log } = ctx;
  const sales = as[item.sales];
  const answerDate = minDate(addDays(q.issueDate, -rnd.int(1, 4)), ctx.today);
  if (item.outcome === 'pending') {
    await sales.post(`/quotations/${q.quoteId}/send-for-approval`, {});
    log.count('Quotations still with the customer');
    return null;
  }
  if (item.outcome === 'declined') {
    await customerAnswer(ctx, sales, q.quoteId, { outcome: 'declined', date: answerDate, channel: 'Phone', remarks: rnd.pick(['Premium too high; renewing with the dealer insurer', 'Postponed the purchase', 'Went with a bank-assured plan']) });
    return null;
  }
  if (item.outcome === 'revise') {
    await customerAnswer(ctx, sales, q.quoteId, { outcome: 'revise', date: addDays(answerDate, -3), channel: 'Viber/WhatsApp', reference: 'Asked for a lower deductible' });
    await sales.put(`/quotations/${q.quoteId}`, { remarks: 'Revised: discount given after the customer asked', discount: 500 });
  }
  const accepted = await customerAnswer(ctx, sales, q.quoteId, { outcome: 'accepted', date: answerDate, evidence: rnd.chance(0.4) });
  if (accepted !== 'CustomerAccepted') throw new Error(`Quotation status after acceptance: ${accepted}`);
  const processing = as[rnd.chance(0.5) ? 'processing1' : 'processing2'];
  const extra = { insuredName: q.prospect.firstName ? `${q.prospect.firstName} ${q.prospect.lastName}` : q.prospect.companyName, inception: q.inception, issuedDate: q.issueDate,
    ...(q.expiry ? { expiry: q.expiry } : {}), customerInfo: { idType: rnd.pick(['PhilSys ID', "Driver's License", 'UMID', 'Passport']), idCardNumber: `${rnd.digits(4)}-${rnd.digits(4)}-${rnd.digits(4)}` } };
  if (q.lob === 'MOTOR') {
    // KYC and vehicle identifiers saved on the quotation (convert-to-policy steps)
    const idCardImage = await uploadFile(sales, 'id-cards', `id-${q.quoteId}.png`);
    const photo = await uploadFile(sales, 'vehicle-photos', `front-${q.quoteId}.png`);
    await sales.patch(`/quotations/${q.quoteId}/vehicle-info`, { idType: extra.customerInfo.idType, idCardNumber: extra.customerInfo.idCardNumber, idCardImage,
      chassisNumber: `${rnd.letters(3)}${rnd.digits(2)}${rnd.letters(1)}${rnd.digits(9)}`, motorNumber: `${rnd.digits(1)}${rnd.letters(2)}${rnd.digits(7)}`,
      plateNumber: q.vehicle.plate || undefined, mvFileNumber: q.vehicle.plate ? undefined : `13${rnd.digits(13)}`, vehicleFrontSidePhoto: photo });
  }
  if (item.direct) extra.billingMode = 'direct';
  const conv = await processing.post(`/quotations/${q.quoteId}/convert-to-policy`, { additionalPolicyData: extra });
  const pol = conv.data?.policy || conv.policy;
  log.count(`Policies issued (retail ${q.product})`);
  const record = {
    id: pol.policyId || pol.id, policyNumber: pol.policyNumber, clientId: pol.clientId, leadId: q.lead.id, segment: 'retail', product: q.product, lob: pol.lob,
    insurerCode: insurerCodeOf(ctx, pol.insuranceCompanyId) || q.insurerCode, gross: Number(pol.grossPremium), net: Number(pol.netPremium), issueDate: q.issueDate, inception: pol.inception || q.inception,
    expiry: pol.expiry, billing: pol.billingMode || 'broker', sales: item.sales, month: item.month.period, quoteId: q.quoteId,
  };
  if (record.issueDate !== (pol.issuedDate || record.issueDate)) log.note(`Policy ${record.policyNumber} issued date ${pol.issuedDate} instead of ${record.issueDate}`);
  ctx.policies.push(record);
  return record;
}

export async function retail(ctx) {
  const { log, rnd, as } = ctx;
  log.setPhase('Retail package business');
  const plan = retailPlan(ctx);
  // a few retail policies are direct billed: the client pays the insurer
  for (const i of [3, 14, 27]) if (plan[i]) plan[i].direct = true;
  for (const item of plan) {
    const prospect = person(rnd);
    const lead = await log.step(`Lead ${prospect.firstName} ${prospect.lastName}`, () => createLead(ctx, as[item.sales], {
      ...prospect, leadCategory: 'Retail', lob: ['MOTOR', 'CTPL'].includes(item.product) ? 'MOTOR' : item.product === 'HOME' ? 'FIRE' : 'ACCIDENT',
      productType: item.product, source: rnd.pick(['Referral', 'Walk-in', 'Facebook page', 'Car dealer tie-up', 'Existing client referral']),
    }), { who: as[item.sales].username });
    if (!lead) continue;
    ctx.clients.push({ leadId: lead.id, segment: 'retail', name: `${prospect.firstName} ${prospect.lastName}`, prospect });
    const run = ['MOTOR', 'CTPL'].includes(item.product) ? motorSale : rfqSale;
    await log.step(`${item.product} for ${prospect.firstName} ${prospect.lastName} (${item.month.period}, ${item.outcome})`, () => run(ctx, item, lead, prospect), { who: as[item.sales].username });
  }
  // cross-sell: some motor clients also buy personal accident cover a month later
  const motorClients = ctx.policies.filter((p) => p.segment === 'retail' && p.product === 'MOTOR').slice(0, Math.round(4 * ctx.cfg.scale));
  for (const p of motorClients) {
    const month = ctx.months.find((m) => m.period > p.month) || ctx.months.at(-1);
    const client = ctx.clients.find((c) => c.leadId === p.leadId);
    await log.step(`Cross-sell PA to ${client.name} (${month.period})`, () => rfqSale(ctx, { i: 0, product: 'PA', month, outcome: 'accepted', sales: p.sales }, { id: p.leadId }, client.prospect));
  }
}
