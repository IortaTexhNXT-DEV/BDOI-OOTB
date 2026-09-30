/** Helpers shared by the business phases: synthetic people and companies, uploads, quotation acceptance, payments. */
import { dataOf, listOf } from '../http.js';
import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES, PLACES, COMPANIES } from '../data.js';
import { addDays, dateBetween, minDate } from '../dates.js';

// a 1 x 1 PNG (ID card scans, vehicle photos) and a small PDF (signed forms, policy documents)
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const pdf = (title) => Buffer.from(`%PDF-1.4\n% ${title}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`);

export const tin = (rnd) => `${rnd.digits(3)}-${rnd.digits(3)}-${rnd.digits(3)}-000`;
export const mobile = (rnd) => `09${rnd.pick(['17', '18', '19', '20', '27', '28', '39', '47', '55', '66', '77', '95', '98'])}${rnd.digits(7)}`;
export const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

/** A retail prospect: name, birth date, address in Metro Manila, Cebu or Davao, contact details, TIN. */
export function person(rnd) {
  const female = rnd.chance(0.5);
  const firstName = rnd.pick(female ? FIRST_NAMES_F : FIRST_NAMES_M);
  const lastName = rnd.pick(LAST_NAMES);
  const place = rnd.pick(PLACES);
  const year = rnd.int(1962, 2000);
  return {
    firstName, lastName, gender: female ? 'Female' : 'Male', DOB: `${year}-${String(rnd.int(1, 12)).padStart(2, '0')}-${String(rnd.int(1, 28)).padStart(2, '0')}`,
    emailId: `${slug(firstName)}.${slug(lastName)}${rnd.int(1, 99)}@${rnd.pick(['gmail.example', 'yahoo.example', 'outlook.example'])}`,
    contactNumber: mobile(rnd), houseNo: `${rnd.int(1, 250)} ${rnd.pick(place.streets)}`, barangay: rnd.pick(place.barangays), city: place.city, province: place.province,
    country: 'Philippines', zipCode: place.zip, taxInformationNumber: tin(rnd),
  };
}

/** A corporate prospect from the fictional companies list. */
export function company(rnd, c) {
  const place = PLACES.find((p) => p.city === c.city) || rnd.pick(PLACES);
  const contactFirst = rnd.pick([...FIRST_NAMES_F, ...FIRST_NAMES_M]);
  const contactLast = rnd.pick(LAST_NAMES);
  const domain = `${slug(c.name.replace(/(Inc\.|Corp\.|Corporation)/g, '')).split('.').slice(0, 2).join('')}.example.ph`;
  return {
    companyName: c.name, emailId: `finance@${domain}`, contactNumber: `(02) 8${rnd.digits(3)}-${rnd.digits(4)}`, houseNo: `${rnd.int(2, 30)}/F ${rnd.pick(place.streets)}`,
    barangay: rnd.pick(place.barangays), city: place.city, province: place.province, country: 'Philippines', zipCode: place.zip, taxInformationNumber: tin(rnd),
    contactPerson: `${contactFirst} ${contactLast}`, industry: c.industry,
  };
}
export { COMPANIES };

/** Upload a file through /s3/upload and return its storage key. */
export async function uploadFile(session, folder, name, kind = 'png') {
  const r = await session.upload('POST', '/s3/upload', { folder }, [{ field: 'file', name, type: kind === 'png' ? 'image/png' : 'application/pdf', data: kind === 'png' ? PNG : pdf(name) }]);
  return r.key || dataOf(r).key;
}

/** Create a lead as a sales persona. */
export async function createLead(ctx, sales, fields) {
  const lead = await sales.post('/leads', fields);
  ctx.log.count(fields.leadCategory === 'Corporate' ? 'Leads (corporate)' : 'Leads (retail)');
  return { id: lead.leadId || dataOf(lead).leadId || lead.id, number: lead.generatedLeadId || dataOf(lead).generatedLeadId };
}

/**
 * The customer's answer to a quotation, received outside the approval link (e-mail sending is off): the quotation goes to
 * PendingCustomer and the answer is recorded with its channel, date and reference.
 */
export async function customerAnswer(ctx, sales, quoteId, { outcome = 'accepted', date, channel, reference, remarks, evidence = false }) {
  const sent = await sales.post(`/quotations/${quoteId}/send-for-approval`, {});
  if ((sent.data?.quotationStatus || sent.quotationStatus) !== 'PendingCustomer') throw new Error(`Quotation not pending after send-for-approval: ${sent.data?.quotationStatus}`);
  let attachmentKey = null;
  if (evidence) attachmentKey = await uploadFile(sales, 'quotation-responses', `signed-acceptance-${quoteId}.pdf`, 'pdf');
  const body = { outcome, channel: channel || ctx.rnd.pick(['Phone', 'Viber/WhatsApp', 'Meeting', 'Signed form']), responseDate: minDate(date, ctx.today),
    reference: reference || `${outcome === 'accepted' ? 'Confirmed' : 'Answered'} ${date}`, remarks: remarks || null,
    ...(attachmentKey ? { attachmentKey, attachmentName: 'signed-acceptance.pdf' } : {}) };
  const r = await sales.post(`/quotations/${quoteId}/customer-response`, body);
  ctx.log.count(`Customer responses (${outcome})`);
  return r.data?.quotationStatus;
}

/** The open bills of a policy (payment screen). */
export async function openBills(session, policyId) {
  const p = dataOf(await session.get(`/policies/${policyId}/payments`));
  return (p.receivables || []).filter((b) => Number(b.balance) > 0);
}

/**
 * Premium payment of a broker-billed policy. A sales persona captures it (finance verifies it the next day), or
 * Accounting enters the official receipt directly against the bill.
 */
export async function payPremium(ctx, { policy, amount, date, mode, captureBy = null, bill = null }) {
  const { rnd } = ctx;
  const paymentMode = mode || rnd.pick(['bank-transfer', 'bank-transfer', 'check', 'online', 'cash']);
  const ref = paymentMode === 'check' ? `${rnd.pick(['BDO', 'BPI', 'MBTC', 'SECB'])} CHK ${rnd.digits(7)}` : paymentMode === 'cash' ? `CASH ${rnd.digits(5)}` : `${rnd.pick(['BDO', 'BPI', 'PESONet', 'InstaPay', 'GCash'])}-${rnd.digits(9)}`;
  const on = minDate(date, ctx.today);
  if (captureBy) {
    const proofKey = await uploadFile(captureBy, 'payment-proofs', `deposit-slip-${policy.policyNumber}.png`);
    const c = dataOf(await captureBy.post(`/policies/${policy.id}/payments`, { option: 'payment', paymentMode, referenceNo: ref, amount, paymentDate: on, proofKey, proofFileName: 'deposit-slip.png',
      ...(bill ? { receivableId: bill } : {}) }));
    const r = dataOf(await ctx.as.accounting1.post(`/policies/${policy.id}/payments/${c.capture.id}/confirm`, {}));
    ctx.log.count('Payments captured by sales and confirmed by accounting');
    return r.receipt;
  }
  const receipt = dataOf(await ctx.as.accounting1.post('/receipts', { ...(bill ? { receivableId: bill } : { policyId: policy.id }), amount, paymentMode, referenceNo: ref, receiptDate: on,
    bankAccountCode: paymentMode === 'cash' ? undefined : 'UAT-BDO-OPS', remarks: `Premium payment ${policy.policyNumber}` }));
  ctx.log.count('Official receipts entered by accounting');
  return receipt;
}

/** Issue date for business in a month: a working day not after today. */
export function businessDay(rnd, month) {
  let d = dateBetween(rnd, month.start, month.end);
  const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
  if (dow === 0) d = addDays(d, 1);
  if (dow === 6) d = addDays(d, -1);
  if (d > month.end) d = month.end;
  if (d < month.start) d = month.start;
  return d;
}

export const pick = listOf;

/** Code of an insurer of the scenario from its id (the policy's lead insurer). */
export const insurerCodeOf = (ctx, id) => Object.values(ctx.insurers).find((i) => i.id === Number(id))?.code || null;
