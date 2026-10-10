/**
 * Quotation validity cycle and versions (TIS-BRD-QUOT-04, PROD-03, CR-03): validity days per product, the one-time
 * extension within the longest validity, the expiry reminder, the spoil of quotations past their validity and the
 * read-only versions a change leaves behind (v1, v2, v3 under one quotation number). Settings in migration 0480.
 */
import { many, one, query, withTransaction } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { audit } from '../../lib/audit.js';
import { queueEmail } from '../../lib/mailer.js';
import { addDays, businessTimeZone, today } from '../../lib/dates.js';
import { formatDate } from '../../lib/pdf/format.js';
import { companyName } from '../../lib/letterhead.js';
import { notify } from '../notifications/service.js';
import { renderTemplate, emailTemplate, amountText } from '../documents/common.js';
import { quoteStatusIn, quoteStatusOut } from '../documents/statuses.js';
import { QUOTE_SELECT, toQuote } from './shape.js';

/** Placement statuses in which the insurer holds the order: the placement, not the quotation clock, decides the case. */
const WITH_INSURER = ['sent', 'acknowledged', 'epolicy_received', 'checked', 'issued'];
/** Audit context of the scheduled jobs. */
const jobActor = (job) => ({ ip: null, user: { id: null, username: 'system' }, auditSource: { channel: 'job', name: job } });

const quoteRow = async (id, db = { query }) => {
  const r = (await db.query(`${QUOTE_SELECT} WHERE (q.id = $1 OR q.quote_number = $1) AND q.deleted_at IS NULL`, [id])).rows[0];
  if (!r) throw notFound('Quotation not found');
  return r;
};

/** Stored status codes of a setting that lists API labels (Draft, PendingCustomer ...). */
async function statusesOf(key, fallback) {
  const v = await getSetting(key, fallback);
  return (Array.isArray(v) ? v : fallback).map(quoteStatusIn).filter(Boolean);
}

/** Days a new quotation of the product stays valid: the product's own validity, else limits.quote_validity_days. */
export async function validityDays(db, productId) {
  const own = productId ? (await db.query('SELECT quote_validity_days FROM products WHERE id = $1', [productId])).rows[0]?.quote_validity_days : null;
  return Number(own) > 0 ? Number(own) : Number(await getSetting('limits.quote_validity_days', 30)) || 30;
}

/** Whether the quotation's validity has passed (valid through valid_until, business date). */
export const pastValidity = (q, on) => Boolean(q.valid_until) && q.valid_until < on;

/** Refuses a step on a quotation that has expired or whose validity has passed (the expiry job may not have run yet). */
export async function assertCurrent(q, step) {
  if (q.status === 'expired') throw badRequest(`Quotation ${q.quote_number} has expired: ${step} is not possible. Prepare a new quotation`);
  if (pastValidity(q, await today())) throw badRequest(`Quotation ${q.quote_number} expired on ${formatDate(q.valid_until)}: ${step} is not possible. Prepare a new quotation`);
}

/** Epoch milliseconds of the end of a business day (midnight after it in the business time zone). */
export async function endOfBusinessDay(iso) {
  const tz = await businessTimeZone();
  const utcMidnight = Date.parse(`${addDays(iso, 1)}T00:00:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(utcMidnight)).map((p) => [p.type, p.value]));
  const localAsUtc = Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`);
  return utcMidnight - (localAsUtc - utcMidnight);
}

/** The validity facts the quotation detail shows and the extension rules (whether Extend is offered). */
export async function validityOf(q) {
  const [extensionDays, maxExtensions, maxDays, extendable, now] = await Promise.all([
    getSetting('quotations.extension_days', 30), getSetting('quotations.max_extensions', 1), getSetting('quotations.max_validity_days', 60),
    statusesOf('quotations.extendable_statuses', ['Draft', 'PendingCustomer', 'CustomerAccepted', 'Approved', 'SubmittedToInsurer']), today()]);
  const latest = q.issued_on ? addDays(q.issued_on, Number(maxDays)) : null;
  const expired = q.status === 'expired' || pastValidity(q, now);
  const daysLeft = q.valid_until && !expired ? Math.round((Date.parse(`${q.valid_until}T00:00:00Z`) - Date.parse(`${now}T00:00:00Z`)) / 86400000) : 0;
  return {
    validUntil: q.valid_until, issuedOn: q.issued_on, latestValidUntil: latest, daysLeft, expired, extensionCount: q.extension_count || 0,
    maxExtensions: Number(maxExtensions), extensionDays: Number(extensionDays), extendedAt: q.extended_at || null, extendedBy: q.extended_by_name || q.extended_by || null,
    extensionRemarks: q.extension_remarks || null,
    extendable: !expired && extendable.includes(q.status) && (q.extension_count || 0) < Number(maxExtensions) && Boolean(latest) && q.valid_until < latest,
  };
}

/**
 * Extend the validity of a quotation by quotations.extension_days (extend:quotations, checked by the route): only a
 * current quotation in quotations.extendable_statuses, at most quotations.max_extensions times, and never beyond
 * issued_on + quotations.max_validity_days (the hard stop).
 */
export async function extendQuote(id, { remarks = null } = {}, user) {
  const before = await quoteRow(id);
  const v = await validityOf(before);
  const label = quoteStatusOut(before.status);
  await assertCurrent(before, 'extending it');
  const extendable = await statusesOf('quotations.extendable_statuses', ['Draft', 'PendingCustomer', 'CustomerAccepted', 'Approved', 'SubmittedToInsurer']);
  if (!extendable.includes(before.status)) throw badRequest(`A ${label} quotation cannot be extended`);
  if (v.extensionCount >= v.maxExtensions) {
    throw badRequest(`Quotation ${before.quote_number} was already extended${before.extended_at ? ` on ${formatDate(before.extended_at)}` : ''}: a quotation can be extended ${v.maxExtensions === 1 ? 'once' : `${v.maxExtensions} times`}`);
  }
  if (!v.latestValidUntil || before.valid_until >= v.latestValidUntil) {
    throw badRequest(`Quotation ${before.quote_number} is already valid until ${formatDate(before.valid_until)}, its longest validity`);
  }
  const proposed = addDays(before.valid_until, v.extensionDays);
  const validUntil = proposed > v.latestValidUntil ? v.latestValidUntil : proposed;
  const r = await query(`UPDATE quotes SET valid_until = $2, extension_count = extension_count + 1, extended_at = now(), extended_by = $3, extension_remarks = $4,
      updated_by = $3, updated_at = now() WHERE id = $1 AND extension_count = $5 AND valid_until = $6`,
  [before.id, validUntil, user.id, remarks ? String(remarks).trim() || null : null, v.extensionCount, before.valid_until]);
  if (!r.rowCount) throw conflict(`Quotation ${before.quote_number} was changed by another user: reload it`);
  const owner = before.agent_user_id || before.created_by;
  if (owner && owner !== user.id) {
    await notify({ userId: owner, type: 'info', title: 'Quotation validity extended', message: `Quotation ${before.quote_number} is now valid until ${formatDate(validUntil)} (extended by ${user.username})`,
      link: `/agent/quotedetailview/${before.id}`, entity: 'quotation', entityId: before.id });
  }
  return { before, after: await quoteRow(before.id), validUntil };
}

/** Value of the e-mail template fields for a quotation. */
async function templateValues(q) {
  const lead = q.lead_row || {};
  const customer = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || lead.company_name || q.client_row?.name || 'Customer';
  return { companyName: await companyName(), quotationNumber: q.quote_number, customerName: customer, productType: q.product_type || q.lob,
    grossPremium: amountText(q.premium_total), currency: q.currency, validUntil: formatDate(q.valid_until) };
}

/**
 * Job quote-expiry-reminder: quotations still open whose validity ends within quotations.expiry_reminder_days are
 * reminded to their owner (My Work notification) and, when quotations.expiry_reminder_customer is on, e-mailed to the
 * customer of a quotation waiting for the customer. Each validity date is reminded once (expiry_reminder_for).
 */
export async function quoteExpiryReminders() {
  const days = Number(await getSetting('quotations.expiry_reminder_days', 5));
  if (!(days > 0)) return { skipped: 'expiry reminders are switched off (quotations.expiry_reminder_days)' };
  const open = await statusesOf('quotations.extendable_statuses', ['Draft', 'PendingCustomer', 'CustomerAccepted', 'Approved', 'SubmittedToInsurer']);
  const now = await today();
  const due = await many(`${QUOTE_SELECT} WHERE q.deleted_at IS NULL AND q.status = ANY($1) AND q.valid_until BETWEEN $2::date AND $2::date + $3::int
      AND q.expiry_reminder_for IS DISTINCT FROM q.valid_until ORDER BY q.valid_until, q.quote_number`, [open, now, days]);
  const toCustomer = await getSetting('quotations.expiry_reminder_customer', true);
  let reminders = 0;
  let emails = 0;
  for (const q of due) {
    const v = await templateValues(q);
    await notify({ userId: q.agent_user_id || q.created_by || null, type: 'reminder', priority: 'high', title: `Quotation ${q.quote_number} expires on ${v.validUntil}`,
      message: `Quotation ${q.quote_number} for ${v.customerName} (${quoteStatusOut(q.status)}) is valid until ${v.validUntil}`,
      link: `/agent/quotedetailview/${q.id}`, entity: 'quotation', entityId: q.id, audience: q.agent_user_id || q.created_by ? null : 'write:quotations' });
    reminders += 1;
    const to = q.status === 'sent' ? q.approval_sent_to || q.lead_row?.email || q.client_row?.email : null;
    if (toCustomer && to) {
      const t = await emailTemplate('quote_expiry_reminder');
      await queueEmail({ to, subject: renderTemplate(t.subject, v, { html: false }), html: renderTemplate(t.html, v), template: 'quote_expiry_reminder', entity: 'quotation', entityId: q.id });
      emails += 1;
    }
    await query('UPDATE quotes SET expiry_reminder_for = valid_until WHERE id = $1', [q.id]);
  }
  return { reminders, emails };
}

/**
 * Job quote-expiry: every quotation in quotations.expiry_statuses whose validity ended before today (business date)
 * becomes Expired, with an audit entry. A quotation whose placement slip is with the insurer is left to the placement.
 */
export async function quoteExpiry() {
  const statuses = await statusesOf('quotations.expiry_statuses', ['Draft', 'PendingCustomer', 'CustomerAccepted', 'Approved', 'SubmittedToInsurer']);
  const rows = await withTransaction(async (db) => (await db.query(`WITH due AS (
      SELECT q.id, q.status FROM quotes q WHERE q.deleted_at IS NULL AND q.status = ANY($1) AND q.valid_until < $2::date
         AND NOT EXISTS (SELECT 1 FROM placements p WHERE p.quote_id = q.id AND p.status = ANY($3)) FOR UPDATE)
    UPDATE quotes q SET status = 'expired', updated_at = now() FROM due WHERE q.id = due.id
    RETURNING q.id, q.quote_number, q.valid_until, due.status AS was`, [statuses, await today(), WITH_INSURER])).rows);
  for (const r of rows) {
    await audit(jobActor('quote-expiry'), { entity: 'quotation', entityId: r.id, action: 'expire', before: { quotationStatus: quoteStatusOut(r.was) },
      after: { quotationStatus: 'Expired', validUntil: r.valid_until } });
  }
  return { expired: rows.length };
}

/** Statuses in which a change of the quotation is a new version (the customer has seen these terms). */
export async function isIssued(q) {
  if (q.status === 'draft') return Boolean(q.approval_sent_at);
  return (await statusesOf('quotations.versioned_statuses', ['PendingCustomer', 'CustomerAccepted', 'Approved', 'SubmittedToInsurer'])).includes(q.status);
}

/** A placement slip still open for the quotation, which a change of the quotation would contradict. */
export const openPlacement = (db, quoteId) => db.query(`SELECT placement_number, status FROM placements WHERE quote_id = $1 AND status NOT IN ('cancelled', 'declined')
  ORDER BY created_at DESC LIMIT 1`, [quoteId]).then((r) => r.rows[0] || null);

/** Keep the current terms of the quotation as a read-only version (before a change makes the next version). */
export async function keepVersion(db, q, userId, reason = null) {
  await db.query(`INSERT INTO quote_versions(quote_id, version, status, doc, sum_insured, premium_base, premium_total, commission_rate, commission_amount, currency,
      insurance_company_id, valid_until, approval_sent_to, approval_sent_at, customer_accepted_at, approved_by, approved_at, version_started_at, superseded_by, change_reason)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)`,
  [q.id, q.version, q.status, JSON.stringify(q.doc || {}), q.sum_insured, q.premium_base, q.premium_total, q.commission_rate, q.commission_amount, q.currency,
    q.insurance_company_id, q.valid_until, q.approval_sent_to, q.approval_sent_at, q.customer_accepted_at, q.approved_by, q.approved_at, q.version_started_at || q.created_at,
    userId, reason ? String(reason).trim() || null : null]);
}

/** Columns of the next version: back to Draft, the customer's and the approver's stamps and the approval link cleared. */
export const nextVersionCols = (q) => ({
  version: (q.version || 1) + 1, status: 'draft', version_started_at: new Date(), approval_token: null, approval_token_hash: null, approval_sent_to: null,
  approval_sent_at: null, customer_accepted_at: null, approved_by: null, approved_at: null, submitted_to_insurer_at: null, submitted_by: null,
});

const versionOut = (v, current = false) => ({
  version: v.version, current, status: quoteStatusOut(v.status), sumInsured: Number(v.sum_insured), netPremium: Number(v.premium_base), grossPremium: Number(v.premium_total),
  commissionAmount: Number(v.commission_amount), currency: v.currency, insuranceCompanyName: v.insurer_name || null, validUntil: v.valid_until,
  startedAt: v.version_started_at || v.created_at || null, supersededAt: current ? null : v.superseded_at, supersededBy: current ? null : v.superseded_by_name || v.superseded_by,
  changeReason: current ? null : v.change_reason, approvalSentAt: v.approval_sent_at, customerAcceptedAt: v.customer_accepted_at,
});

/** Versions of a quotation, newest first: the current one and the read-only versions it superseded. */
export async function listVersions(id) {
  const q = await quoteRow(id);
  const old = await many(`SELECT v.*, ic.name AS insurer_name, u.display_name AS superseded_by_name FROM quote_versions v
      LEFT JOIN insurance_companies ic ON ic.id = v.insurance_company_id LEFT JOIN users u ON u.id = v.superseded_by
     WHERE v.quote_id = $1 ORDER BY v.version DESC`, [q.id]);
  return { quotationNumber: q.quote_number, currentVersion: q.version, versions: [versionOut(q, true), ...old.map((v) => versionOut(v))] };
}

/** One version of a quotation as the detail screen reads it; a superseded version is read-only. */
export async function versionOf(id, version) {
  const q = await quoteRow(id);
  const n = Number(version);
  if (!Number.isInteger(n) || n < 1) throw badRequest('version must be a whole number');
  if (n === q.version) return { ...toQuote(q), version: q.version, readOnly: false };
  const v = await one('SELECT * FROM quote_versions WHERE quote_id = $1 AND version = $2', [q.id, n]);
  if (!v) throw notFound(`Quotation ${q.quote_number} has no version ${n}`);
  const row = { ...q, ...v, id: q.id, doc: v.doc, status: v.status, vat: null, dst: null, lgt: null, fst: null, others: null, discount: null, ncd: null };
  const b = v.doc?.premiumBreakdown || {};
  const out = toQuote(row);
  return { ...out, valueAddedTax: Number(b.valueAddedTax || 0), documentaryStampTax: Number(b.documentaryStampTax || 0), localGovernmentTax: Number(b.localGovernmentTax || 0),
    fireServiceTax: Number(b.fireServiceTax || 0), accountPremiumOthers: Number(b.accountPremiumOthers || 0), discount: Number(b.discount || 0), NCD: Number(b.NCD || 0),
    version: n, readOnly: true, supersededAt: v.superseded_at, changeReason: v.change_reason };
}
