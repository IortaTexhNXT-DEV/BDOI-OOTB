/**
 * New business on TARGET through the public API, the way staff enter it (helpers of the UAT scenario): a lead becomes a
 * client, a motor quotation from the tariff is accepted by the customer, the Processing Team issues the policy, and
 * Accounting enters the official receipt.
 */
import { dataOf, listOf } from '../uat/http.js';
import { VEHICLES, COLOURS } from '../uat/data.js';
import { person, createLead, customerAnswer, uploadFile } from '../uat/phases/common.js';
import { persona } from './sessions.js';

/** Persona usernames of the workbook by role (first user holding the role). */
export function personaFor(ctx, role, n = 0) {
  const users = ctx.configBook.rows('Users').map((r) => r.values).filter((u) => u.Username !== ctx.cfg.targetAdmin && u.Roles.split(/[,;]/).map((x) => x.trim()).includes(role));
  if (!users[n]) throw new Error(`The configuration workbook has no ${n + 1}. user with the role ${role}`);
  return users[n].Username;
}

/**
 * Lead -> client -> motor quotation -> customer acceptance -> policy -> official receipt. Returns the numbers issued:
 * { leadNumber, clientCode, quotationNumber, policyNumber, policyId, billNumber, receiptNumber, gross }.
 */
export async function newMotorPolicy(ctx, { label, insurerCode, pay = true }) {
  const { rnd } = ctx;
  const sales = await persona(ctx, personaFor(ctx, 'sales'));
  const processing = await persona(ctx, personaFor(ctx, 'processing'));
  const p = person(rnd);
  p.lastName = `${p.lastName} ${label}`;
  const lead = await createLead(ctx, sales, { ...p, leadCategory: 'Retail', lob: 'MOTOR', productType: 'MOTOR', source: 'Walk-in' });
  const client = dataOf(await sales.post(`/clients/from-lead/${lead.id}`, {}));
  const insurer = listOf(await sales.get('/masters/insurance-company', { search: insurerCode, perPage: 20 })).find((i) => i.insuranceCompanyCode === insurerCode);
  if (!insurer) throw new Error(`Insurer ${insurerCode} is not on TARGET`);
  const v = rnd.pick(VEHICLES.filter((x) => x.type === 'private_cars'));
  const inception = ctx.today;
  const value = rnd.amount(v.value[0], v.value[1], 10000);
  const body = {
    leadRefId: lead.id, productType: 'Motor', insurancePolicyType: 'COMP', vehicleType: v.type, includeCTPL: true, ctplTermYears: 1,
    participantDetails: [{ insuranceCompanyName: insurer.insuranceCompanyName }], inception,
    insuranceVehicleDetails: [{ vehicleBrand: v.brand, vehicleModel: v.model, variant: v.variant || '', modelYear: '2023', color: rnd.pick(COLOURS), plateNumber: `${rnd.letters(3)} ${rnd.digits(4)}` }],
    lossAndDamageCoverage: value, lossAndDamageCoverageRate: 1.5, actsOfNatureRate: 0.5, bodilyInjury: 200000, propertyDamage: 200000, autoPassengerPersonalAccident: 50000, appaSeats: 5,
    remarks: `Go-live rehearsal: ${label}`,
  };
  const quote = await sales.post('/quotations', body);
  const quoteId = quote.quotationId || dataOf(quote).quotationId;
  const quotationNumber = quote.quotationNumber || dataOf(quote).quotationNumber || dataOf(quote).quotationId;
  const status = await customerAnswer(ctx, sales, quoteId, { outcome: 'accepted', date: ctx.today, channel: 'Phone', reference: `Rehearsal ${label}` });
  if (status !== 'CustomerAccepted') throw new Error(`quotation status after acceptance: ${status}`);
  const idCardImage = await uploadFile(sales, 'id-cards', `id-${quoteId}.png`);
  await sales.patch(`/quotations/${quoteId}/vehicle-info`, { idType: "Driver's License", idCardNumber: `N${rnd.digits(2)}-${rnd.digits(2)}-${rnd.digits(6)}`, idCardImage,
    chassisNumber: `${rnd.letters(3)}${rnd.digits(2)}${rnd.letters(1)}${rnd.digits(9)}`, motorNumber: `${rnd.digits(1)}${rnd.letters(2)}${rnd.digits(7)}`, plateNumber: body.insuranceVehicleDetails[0].plateNumber });
  const conv = await processing.post(`/quotations/${quoteId}/convert-to-policy`, { additionalPolicyData: { insuredName: `${p.firstName} ${p.lastName}`, inception, issuedDate: ctx.today,
    customerInfo: { idType: "Driver's License", idCardNumber: `N${rnd.digits(2)}-${rnd.digits(2)}-${rnd.digits(6)}` } } });
  const pol = conv.data?.policy || conv.policy;
  const out = { leadNumber: lead.number, clientCode: client.clientCode || client.customerCode || client.code, quotationNumber, policyNumber: pol.policyNumber, policyId: pol.policyId || pol.id,
    gross: Number(pol.grossPremium), clientId: pol.clientId };
  const bill = listOf(await (await persona(ctx, personaFor(ctx, 'accounting'))).get('/receipts/open-receivables', { policyNumber: pol.policyNumber })).find((b) => b.policyNumber === pol.policyNumber);
  out.billNumber = bill?.billNumber || null;
  if (pay && bill) out.receiptNumber = (await receipt(ctx, { receivableId: bill.receivableId, amount: Number(bill.balance), label: pol.policyNumber })).receiptNumber;
  return out;
}

/** Official receipt by Accounting against one open bill (bank transfer into the operating account). */
export async function receipt(ctx, { receivableId, amount, label, bankAccountCode = null }) {
  const acc = await persona(ctx, personaFor(ctx, 'accounting'));
  const r = dataOf(await acc.post('/receipts', { receivableId, amount, paymentMode: 'bank-transfer', referenceNo: `PESONet-${ctx.rnd.digits(9)}`, receiptDate: ctx.today,
    bankAccountCode: bankAccountCode || ctx.bankAccountCode || undefined, remarks: `Go-live rehearsal: premium payment ${label}` }));
  return { receiptNumber: r.receiptNumber || r.receipt?.receiptNumber, receiptId: r.receiptId || r.id };
}

/** Journals posted for a policy (accounting entries search). */
export async function journalsOf(ctx, policyId) {
  const acc = await persona(ctx, personaFor(ctx, 'accounting'));
  const r = await acc.get('/accounting/entries/search', { policyId, perPage: 100 });
  return listOf(r);
}
