/**
 * Placement and issuance of a scheme application (TIS-BRD-SCHM-01, FRS FR-SIS-020 to 024, 030).
 *
 *   sendToInsurer      the gate and the base KYC and vehicle check (policy.kyc_required_fields; the TFSPH KYC
 *                      confirmation stands for the ID card image, the conduction sticker for the plate of a vehicle not
 *                      yet registered), then a Placement Slip of source scheme for the insurer (100%) with the year-1
 *                      premium, e-mailed with the placement order and, with schemes.attach_documents_to_placement, the
 *                      checklist files. Only a scheme slip may place Motor without a quotation.
 *   recordDecline      the insurer declines: the slip is Declined and the application Declined by insurer
 *   changeInsurer      another insurer of the scheme for a declined application: re-priced, back to the gate
 *   issueApplication   once the insurer has confirmed (schemes.placement_confirmation): the borrower becomes a client,
 *                      the policy is issued (inception on the release date, TFSPH mortgagee, scheme and loan data), the
 *                      year-1 premium is billed to the dealer (Scheme 1) or TFSPH (Scheme 2), the commission accrued
 *                      at the scheme %, the checklist files copied to the policy's Documents, and the lock-in record of
 *                      SCHM-03 written in the same transaction (Scheme 1 ARA or Scheme 2, with the TFS loan account)
 *   cancelApplication  with a reason; once sent only approve:scheme-issuance, and the slip is cancelled with it
 */
import fs from 'node:fs';
import { one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { addDays, isoDate } from '../../lib/dates.js';
import { round2 } from '../../lib/money.js';
import { fileAttachment } from '../../lib/mailer.js';
import { decisionReason } from '../ops-masters/records.js';
import { notify } from '../notifications/service.js';
import { KYC_ITEMS, kycValue, requiredKycFor } from '../policies/kyc.js';
import { reserveKey, resolveKey, writeObject } from '../uploads/storage.js';
import { mortgageeClause } from '../channels/service.js';
import { createClientInTx } from '../clients/service.js';
import { issuePolicy } from '../policies/service.js';
import { participantInputs, writeParticipants } from '../placement/participants.js';
import { recordPolicyScheme, schemeDoc, priceYear } from '../schemes/rating.js';
import { acceptedIds, applicationRow, borrowerName, inceptionOf, saveApplication } from './service.js';
import { gateOf } from './checklist.js';

const fail = (path, message, code = null) => badRequest(message, [{ path, message, ...(code ? { code } : {}) }]);
const addMonths = (d, m) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCMonth(x.getUTCMonth() + m); return x.toISOString().slice(0, 10); };
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/** The KYC and vehicle values of an application, in the field names of the base KYC check. */
async function kycSource(a) {
  const b = a.borrower || {};
  const v = a.vehicle || {};
  const items = (await query('SELECT code, status, file_key FROM scheme_checklist_items WHERE application_id = $1', [a.id])).rows;
  const file = (code) => items.find((i) => i.code === code && i.file_key)?.file_key || null;
  const { revealPii } = await import('../../lib/pii.js');
  return {
    idType: b.idType, idNumber: b.idNumber ? revealPii(b.idNumber) : null, idType2: b.idType2, idNumber2: b.idNumber2 ? revealPii(b.idNumber2) : null,
    idCardImage: a.kyc_source === 'tfs' ? file('KYC-TFS') || file('KYC-TFS-ID') : file('KYC-ID'), tfsKycConfirmationKey: file('KYC-TFS'),
    chassisNumber: v.chassisNumber, motorNumber: v.engineNumber, plateNumber: v.plateNumber || v.conductionSticker || null, conductionSticker: v.conductionSticker || null,
  };
}

/** Missing KYC and vehicle identifiers (FR-SIS-020, base convert-to-policy check) and the Full KYC ID rule (FR-SIS-012 R2). */
async function kycProblems(a) {
  const src = await kycSource(a);
  const missing = [];
  for (const item of await requiredKycFor('MOTOR')) {
    const def = KYC_ITEMS[item];
    const ok = def.anyOf ? def.anyOf.some((i) => kycValue([src], i)) : kycValue([src], item);
    if (!ok) missing.push(def.label);
  }
  const out = [];
  if (missing.length) out.push(fail('kyc', `Policy cannot be issued without the customer's KYC and vehicle identifiers. Missing: ${missing.join(', ')}`, 'MSG-SIS-042'));
  if (a.kyc_source === 'full') {
    const ids = await acceptedIds();
    const primary = [src.idType, src.idType2].some((t) => t && ids.primary.some((p) => sameText(p, t)));
    const secondaries = [src.idType, src.idType2].filter((t) => t && ids.secondary.some((p) => sameText(p, t)));
    if (!primary && !(secondaries.length >= 2 && !sameText(secondaries[0], secondaries[1]) && src.idNumber && src.idNumber2)) {
      out.push(fail('idType', 'Full KYC needs one primary ID or two different secondary IDs', 'MSG-SIS-033'));
    }
  }
  return out;
}

/** Send a Ready to issue application to its insurer as a Placement Slip of source scheme (FR-SIS-020). */
export async function sendToInsurer(id, user) {
  const a = await applicationRow(id);
  if (a.status !== 'ready') {
    if (['documents-pending', 'draft', 'declined'].includes(a.status)) {
      const items = (await query('SELECT document, required, status FROM scheme_checklist_items WHERE application_id = $1 ORDER BY sort_order', [a.id])).rows;
      const g = gateOf(items);
      if (g.missing) throw fail('checklist', `The application cannot go to the insurer: ${g.missing} required document(s) missing (${g.documents.join(', ')})`, 'MSG-SIS-040');
      if (a.status === 'draft') throw conflict(`Application ${a.application_number} is a Draft: ${(a.problems || []).map((p) => p.message).join('; ')}`);
    }
    throw conflict(`Application ${a.application_number} is ${a.status}: only an application Ready to issue is sent to the insurer`);
  }
  const problems = await kycProblems(a);
  if (problems.length) throw problems[0];
  const pricing = a.pricing;
  const y1 = pricing.year1;
  const inception = pricing.inception || await inceptionOf(a);
  const expiry = addMonths(inception, Number(await getSetting('policies.default_term_months', 12)));
  const bank = a.bank_channel_id ? await one('SELECT c.*, p.name AS parent_name, p.mortgagee_clause AS parent_clause FROM distribution_channels c LEFT JOIN distribution_channels p ON p.id = c.parent_id WHERE c.id = $1', [a.bank_channel_id]) : null;
  const mortgagee = bank ? (bank.parent_id ? { name: bank.parent_name, mortgagee_clause: bank.parent_clause } : bank) : null;
  const clause = mortgagee ? await mortgageeClause(mortgagee, bank) : null;
  const scheme = await one('SELECT * FROM schemes WHERE id = $1', [pricing.schemeId]);
  const line = pricing.lineNo ? await one('SELECT l.*, b.name AS brand_name, m.name AS model_name, v.name AS variant_name FROM scheme_vehicle_lines l JOIN vehicle_brands b ON b.id = l.brand_id LEFT JOIN vehicle_models m ON m.id = l.model_id LEFT JOIN vehicle_variants v ON v.id = l.variant_id WHERE l.scheme_id = $1 AND l.line_no = $2', [scheme.id, pricing.lineNo]) : null;
  const kyc = await kycSource(a);
  const v = a.vehicle || {};
  const doc = {
    ...schemeDoc({ scheme, line, priced: { ...y1, rates: y1.rates || { OD: null, AON: null } }, year: 1, year1SumInsured: Number(a.invoice_price), dealerChannelId: a.dealer_channel_id, dealerName: a.dealer_name }),
    insuranceVehicleDetails: [{ vehicleBrand: v.make, vehicleModel: v.model, modelVariant: v.variant || null, modelYear: v.yearModel, vehicleColor: v.color || null, vehicleType: pricing.vehicleClass,
      chassisNumber: v.chassisNumber, motorNumber: v.engineNumber, plateNumber: kyc.plateNumber, conductionSticker: v.conductionSticker || null }],
    chassisNumber: v.chassisNumber, motorNumber: v.engineNumber, plateNumber: kyc.plateNumber, conductionSticker: v.conductionSticker || null,
    idType: kyc.idType, idNumber: kyc.idNumber, idCardImage: kyc.idCardImage, tfsKycConfirmationKey: kyc.tfsKycConfirmationKey,
    mortgage: mortgagee?.name || null, mortgageeClause: clause, mortgageeChannelId: a.bank_channel_id, loanAccount: a.loan_account, brandNew: true,
    schemeApplication: { id: a.id, number: a.application_number, loanAccount: a.loan_account, bookingDate: isoDate(a.booking_date), loanTermMonths: a.loan_term_months,
      kycSource: a.kyc_source, araSignedOn: isoDate(a.ara_signed_on), araPaymentMode: a.ara_payment_mode },
    premiumBreakdown: y1, insuredName: borrowerName(a.borrower, a.client_name), productType: 'Motor',
  };
  const placementId = await withTransaction(async (db) => {
    const lock = (await db.query('SELECT status FROM scheme_applications WHERE id = $1 FOR UPDATE', [a.id])).rows[0];
    if (lock.status !== 'ready') throw conflict('The application was changed by someone else; reload it');
    const { insertPlacement } = await import('../placement/placements.js');
    const pid = await insertPlacement(db, {
      source: 'scheme', client_id: a.client_id || null, product_id: scheme.product_id, product_type: 'Motor', lob: 'MOTOR', insurance_company_id: a.insurance_company_id,
      insured_name: doc.insuredName, doc: JSON.stringify(doc), sum_insured: y1.sumInsured, premium_base: y1.netPremium, vat: y1.vat, dst: y1.dst, lgt: y1.lgt, fst: y1.fst || 0,
      others: 0, discount: 0, premium_total: y1.grossPremium, commission_rate: round2(Number(y1.commissionPct) / 100 * 10000) / 10000, commission_amount: y1.commission, currency: 'PHP',
      inception_date: inception, expiry_date: expiry, remarks: `Scheme application ${a.application_number} (${a.scheme_no})`, owner_user_id: user.id,
    }, [{ insuranceCompanyId: a.insurance_company_id, sharePercent: 100, isLead: true, commissionRate: null, insurerReference: null }], user.id, 'pending');
    await db.query("UPDATE scheme_applications SET status = 'sent', placement_id = $2, sent_by = $3, sent_at = now(), updated_at = now() WHERE id = $1", [a.id, pid, user.id]);
    return pid;
  });
  const { storeSlipDocument, sendPlacement, placementById } = await import('../placement/placements.js');
  await storeSlipDocument(placementId, user.id).catch(() => null);
  let warning = null;
  try {
    const attachments = (await getSetting('schemes.attach_documents_to_placement', true)) === false ? []
      : (await query('SELECT file_key, file_name FROM scheme_checklist_items WHERE application_id = $1 AND file_key IS NOT NULL ORDER BY sort_order', [a.id])).rows
        .map((f) => fileAttachment(f.file_key, f.file_name, /\.png$/i.test(f.file_name) ? 'image/png' : /\.jpe?g$/i.test(f.file_name) ? 'image/jpeg' : 'application/pdf'));
    await sendPlacement(placementId, user, { attachments, approvedUnder: 'scheme-issuance' });
  } catch (e) {
    // the insurer has no e-mail address: the slip stays in Draft, sent from Placement Slips once the address is added
    warning = e.message;
  }
  const p = await placementById(placementId);
  return { application: a, placement: p, warning, message: `Application ${a.application_number} sent to ${a.insurer_name} on placement slip ${p.placementNumber}` };
}

/** The insurer declines the placement (FR-SIS-021 alternate flow): reason required. */
export async function recordDecline(id, { reason }, user) {
  const a = await applicationRow(id);
  if (a.status !== 'sent' || !a.placement_id) throw conflict(`Application ${a.application_number} is not with the insurer`);
  if (!String(reason || '').trim()) throw fail('reason', 'Reason is required', 'MSG-SIS-036');
  const { declineParticipant } = await import('../placement/placements.js');
  await declineParticipant(a.placement_id, { insuranceCompanyId: a.insurance_company_id, reason: String(reason).trim() }, user);
  await query("UPDATE scheme_applications SET status = 'declined', decline_reason = $2, updated_by = $3, updated_at = now() WHERE id = $1", [a.id, String(reason).trim(), user.id]);
  return { before: { status: a.status }, message: `Application ${a.application_number} declined by ${a.insurer_name}` };
}

/** A sent application whose placement slip was declined on Placement Slips follows it (read-time sync). */
export async function syncDeclined(a) {
  if (a.status === 'sent' && a.placement_status === 'declined') {
    await query("UPDATE scheme_applications SET status = 'declined', updated_at = now() WHERE id = $1 AND status = 'sent'", [a.id]);
    return true;
  }
  return false;
}

/** Choose another insurer of the scheme for a declined application: re-priced, back to Ready to issue (FR-SIS-021). */
export async function changeInsurer(id, { insuranceCompanyId }, user) {
  const a = await applicationRow(id);
  if (a.status !== 'declined') throw conflict(`Application ${a.application_number} is ${a.status}: the insurer is changed after a decline`);
  if (Number(insuranceCompanyId) === Number(a.insurance_company_id)) throw fail('insuranceCompanyId', 'Choose another insurer of the scheme');
  await query('UPDATE scheme_applications SET placement_id = NULL WHERE id = $1', [a.id]);
  const r = await saveApplication(a.id, { insuranceCompanyId: Number(insuranceCompanyId) }, user);
  return { before: { insuranceCompanyId: a.insurance_company_id, status: a.status }, status: r.status };
}

/** Whether the insurer has confirmed the placement (schemes.placement_confirmation) and its policy number. */
async function confirmation(p) {
  const mode = await getSetting('schemes.placement_confirmation', 'acknowledgement');
  const number = p.epolicy?.insurerPolicyNumber || p.acknowledgement_reference || null;
  if (mode === 'epolicy-check') return p.status === 'checked' ? { ok: true, number } : { ok: false };
  return ['acknowledged', 'epolicy_received', 'checked'].includes(p.status) && number ? { ok: true, number } : { ok: false };
}

/** The billing client of a party (FR-SIS-022): its own channel billing account, else its dealer group's or bank's; null when none. */
async function billingClientOf(db, channelId) {
  const r = (await db.query(`SELECT COALESCE(b.client_id, pb.client_id) AS client_id, COALESCE(p.name, c.name) AS name, c.name AS own_name FROM distribution_channels c
    LEFT JOIN channel_billing_accounts b ON b.channel_id = c.id LEFT JOIN distribution_channels p ON p.id = c.parent_id
    LEFT JOIN channel_billing_accounts pb ON pb.channel_id = p.id WHERE c.id = $1`, [channelId])).rows[0];
  return r ? { clientId: r.client_id, name: r.client_id ? r.name : (r.name || r.own_name) } : { clientId: null, name: 'The party' };
}

/** Copy the checklist files of an application to the policy's Documents (FR-SIS-021, 023). */
async function copyFiles(db, applicationId, policyId, userId) {
  const files = (await db.query('SELECT file_key, file_name, document FROM scheme_checklist_items WHERE application_id = $1 AND file_key IS NOT NULL', [applicationId])).rows;
  let copied = 0;
  for (const f of files) {
    let buffer;
    try { buffer = fs.readFileSync(resolveKey(f.file_key)); } catch { continue; }
    const key = await reserveKey({ folder: 'policy-documents', fileName: f.file_name, userId, entity: 'policy', entityId: policyId });
    await writeObject(key, buffer, null);
    await db.query('UPDATE documents SET category = $2, size_bytes = $3 WHERE storage_key = $1', [key, f.document, buffer.length]);
    copied += 1;
  }
  return copied;
}

/**
 * Issue the policy of a sent application once the insurer has confirmed (FR-SIS-021, 022, 023, 030): write:policies.
 * The lock-in record is written in the same transaction as the policy.
 */
export async function issueApplication(id, user) {
  if (!hasPermission(user, 'write:policies')) throw forbidden('You do not have permission to issue the policy');
  const a = await applicationRow(id);
  if (a.status === 'issued') throw conflict(`Application ${a.application_number} has policy ${a.policy_number}: use Policy Cancellation`);
  if (a.status !== 'sent' || !a.placement_id) throw conflict('The policy can be issued only after the insurer has confirmed the placement');
  const p = await one('SELECT * FROM placements WHERE id = $1', [a.placement_id]);
  const c = await confirmation(p);
  if (!c.ok) throw conflict('The policy can be issued only after the insurer has confirmed the placement');
  const pricing = a.pricing;
  const y1 = pricing.year1;
  const scheme = await one('SELECT * FROM schemes WHERE id = $1', [pricing.schemeId]);
  const line = pricing.lineNo ? await one('SELECT l.*, b.name AS brand_name, m.name AS model_name, v.name AS variant_name FROM scheme_vehicle_lines l JOIN vehicle_brands b ON b.id = l.brand_id LEFT JOIN vehicle_models m ON m.id = l.model_id LEFT JOIN vehicle_variants v ON v.id = l.variant_id WHERE l.scheme_id = $1 AND l.line_no = $2', [scheme.id, pricing.lineNo]) : null;
  const result = await withTransaction(async (db) => {
    const lock = (await db.query('SELECT status FROM scheme_applications WHERE id = $1 FOR UPDATE', [a.id])).rows[0];
    if (lock.status !== 'sent') throw conflict('The application was changed by someone else; reload it');
    // who pays year 1 (FR-SIS-022): the dealer (Scheme 1 free first year), TFSPH (Scheme 2), or the client
    const payerChannel = pricing.payer === 'bank' ? a.bank_channel_id : pricing.payer === 'dealer' ? a.dealer_channel_id : null;
    let payerClient = null;
    if (payerChannel && p.billing_mode !== 'direct') {
      const bill = await billingClientOf(db, payerChannel);
      if (!bill.clientId) {
        if ((await getSetting('schemes.require_billing_client', true)) !== false) throw fail('billing', `${bill.name} has no billing client: add it on Distribution Channels before issuing`, 'MSG-SIS-047');
        const { billingClient } = await import('../channels/service.js');
        payerClient = await billingClient(db, payerChannel, user.id);
      } else payerClient = bill.clientId;
    }
    // the borrower becomes a client now (a new borrower stays on the application until the policy is issued)
    const b = a.borrower || {};
    const { revealPii } = await import('../../lib/pii.js');
    const clientId = a.client_id || await createClientInTx(db, { firstName: b.firstName || undefined, lastName: b.lastName || undefined, companyName: b.companyName || undefined,
      emailId: b.email || undefined, contactNumber: b.mobile || undefined, DOB: b.birthday || undefined, nationality: b.nationality || undefined, houseNo: b.address || undefined,
      city: b.city || undefined, province: b.province || undefined, idType: b.idType || undefined, idNumber: b.idNumber ? revealPii(b.idNumber) : undefined, source: 'scheme-issuance',
      leadCategory: b.companyName && !b.firstName ? 'Corporate' : 'Retail' }, user.id);
    // the dealer share goes to the referrer account of the dealer branch, else of its dealer group (FR-SCM-031)
    const ref = (await db.query(`SELECT COALESCE(c.referrer_id, pc.referrer_id) AS referrer_id FROM distribution_channels c LEFT JOIN distribution_channels pc ON pc.id = c.parent_id WHERE c.id = $1`,
      [a.dealer_channel_id])).rows[0]?.referrer_id || null;
    const doc = { ...(p.doc || {}), placementNumber: (await db.query('SELECT placement_number FROM placements WHERE id = $1', [p.id])).rows[0].placement_number, insurerPolicyNumber: c.number,
      commissionDetails: ref ? { primary: { referrerId: ref }, chain: [], source: 'scheme' } : null, source: 'scheme-issuance' };
    const issued = await issuePolicy(db, {
      quoteId: null, clientId, leadId: null, productId: scheme.product_id, insuranceCompanyId: a.insurance_company_id, ownerUserId: a.created_by || user.id, agentUserId: a.created_by || user.id,
      sumInsured: y1.sumInsured, netPremium: y1.netPremium, grossPremium: y1.grossPremium, commissionAmount: y1.commission, commissionRate: Number(y1.commissionPct) / 100, currency: 'PHP',
      insuredName: borrowerName(b, a.client_name), productType: 'Motor', lob: 'MOTOR', doc, billingMode: p.billing_mode, placementId: p.id,
      participants: await participantInputs('placement', p.id, db), taxes: round2(Number(y1.vat) + Number(y1.dst) + Number(y1.lgt) + Number(y1.fst || 0)),
      payers: payerClient ? [{ clientId: payerClient, amount: y1.grossPremium, reference: `${a.scheme_no} year 1` }] : null,
    }, { inception: p.inception_date ? isoDate(p.inception_date) : pricing.inception, expiry: p.expiry_date ? isoDate(p.expiry_date) : undefined, paymentStatus: 'Pending' }, user.id);
    await db.query('UPDATE policies SET channel_id = $2 WHERE id = $1', [issued.policyId, a.dealer_channel_id]);
    await recordPolicyScheme(db, { policyId: issued.policyId, scheme, line, priced: { ...y1, rates: y1.rates || {}, perils: y1.perils || [] }, year: 1, year1SumInsured: Number(a.invoice_price),
      seats: pricing.seats, dealerChannelId: a.dealer_channel_id, applicationId: a.id, userId: user.id });
    // the lock-in record of SCHM-03 (FR-SIS-030, FR-LCK-001): end = start + years - 1 day
    const source = a.scheme_type === 'scheme1' ? 'scheme1-ara' : 'scheme2';
    const years = Number(pricing.lockInYears || pricing.policyYears || 1);
    const lk = (await db.query(`INSERT INTO policy_lock_ins(policy_id, source, reference, start_date, years, end_date, tfs_loan_account, loan_status, created_by)
      SELECT p.id, $2, $3, p.inception_date, $4, ((p.inception_date + make_interval(years => $4))::date - 1), $5, 'current', (SELECT username FROM users WHERE id = $6)
      FROM policies p WHERE p.id = $1 ON CONFLICT (policy_id) DO UPDATE SET source = EXCLUDED.source, reference = EXCLUDED.reference, start_date = EXCLUDED.start_date,
        years = EXCLUDED.years, end_date = EXCLUDED.end_date, tfs_loan_account = EXCLUDED.tfs_loan_account RETURNING *`,
    [issued.policyId, source, a.scheme_no, years, a.loan_account, user.id])).rows[0];
    const copied = await copyFiles(db, a.id, issued.policyId, user.id);
    await db.query("UPDATE placements SET status = 'issued', policy_id = $2, client_id = $3, issued_at = now(), issued_by = $4, updated_by = $4, updated_at = now() WHERE id = $1",
      [p.id, issued.policyId, clientId, user.id]);
    await db.query("UPDATE scheme_applications SET status = 'issued', policy_id = $2, client_id = $3, issued_by = $4, issued_at = now(), updated_at = now() WHERE id = $1",
      [a.id, issued.policyId, clientId, user.id]);
    const policy = (await db.query('SELECT policy_number, bill_number FROM policies WHERE id = $1', [issued.policyId])).rows[0];
    return { ...issued, ...policy, clientId, lockIn: lk, copied };
  });
  const lockMsg = `Lock-in ${result.lockIn.source === 'scheme1-ara' ? 'Scheme 1 ARA' : 'Scheme 2'} recorded on policy ${result.policy_number} until ${String(isoDate(result.lockIn.end_date)).split('-').reverse().join('/')}`;
  if (a.created_by && a.created_by !== user.id) {
    await notify({ userId: a.created_by, type: 'info', title: 'Scheme policy issued', message: `Policy ${result.policy_number} issued for application ${a.application_number}`,
      link: `/agent/policydetail/${result.policyId}`, entity: 'policy', entityId: result.policyId });
  }
  return { application: a, policyId: result.policyId, policyNumber: result.policy_number, billNumber: result.bill_number, lockIn: result.lockIn, filesCopied: result.copied,
    message: `Policy ${result.policy_number} issued for application ${a.application_number}. ${lockMsg}` };
}

/** Book from Placement Slips (bookPlacement of a slip of source scheme): the same issuance. */
export async function issueFromPlacement(placementId, user) {
  const a = await one('SELECT id FROM scheme_applications WHERE placement_id = $1', [placementId]);
  if (!a) throw notFound('No scheme application is on this placement slip');
  const r = await issueApplication(a.id, user);
  const { placementById } = await import('../placement/placements.js');
  return { policyId: r.policyId, receivable: null, placement: await placementById(placementId), schemeIssuance: r };
}

/**
 * Cancel an application with a reason (FR-SIS-024): before sending by write:scheme-issuance; once sent only by
 * approve:scheme-issuance, and its placement slip is cancelled with it (the insurer told by the base e-mail).
 */
export async function cancelApplication(id, { reasonCode = null, reason = null }, user) {
  const a = await applicationRow(id);
  if (a.status === 'issued') throw conflict(`Application ${a.application_number} has policy ${a.policy_number}: use Policy Cancellation`);
  if (a.status === 'cancelled') throw conflict(`Application ${a.application_number} is already cancelled`);
  if (a.status === 'sent' && !hasPermission(user, 'approve:scheme-issuance')) throw forbidden('The application was sent to the insurer: only an approver can cancel it');
  if (!String(reason || '').trim() && !reasonCode) throw fail('reason', 'Reason is required', 'MSG-SIS-036');
  const why = await decisionReason({ query }, ['scheme_application_cancel'], { reasonCode, reason });
  if (!why.text) throw fail('reason', 'Reason is required', 'MSG-SIS-036');
  if (a.placement_id && ['sent'].includes(a.status)) {
    const { cancelPlacement } = await import('../placement/placements.js');
    const p = await one('SELECT status FROM placements WHERE id = $1', [a.placement_id]);
    if (p && !['issued', 'cancelled'].includes(p.status)) await cancelPlacement(a.placement_id, why.text, user, { approvedUnder: 'approve:scheme-issuance' });
  }
  await query("UPDATE scheme_applications SET status = 'cancelled', cancel_reason_code = $2, cancel_reason = $3, cancelled_by = $4, cancelled_at = now(), updated_at = now() WHERE id = $1",
    [a.id, why.code, why.text, user.id]);
  return { before: { status: a.status }, reason: why.text, message: `Application ${a.application_number} cancelled` };
}

export { addDays, priceYear, writeParticipants };
