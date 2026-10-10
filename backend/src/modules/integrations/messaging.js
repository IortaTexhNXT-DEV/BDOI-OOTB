/**
 * SMS and messaging: templates per event, the consent check, and the messages queued through the integration outbox.
 *
 *   queueClientMessage()   one message to a client from a template (or a free text): mobile number, consent check,
 *                          {{placeholders}}, connector of the channel; skipped messages are recorded with the reason
 *   smsRenewalNotices()    job sms-renewal-notices: policies expiring in messaging.renewal_notice_days days
 *   smsPaymentReminders()  job sms-payment-reminders: open bills due in messaging.payment_reminder_days days
 *   claimStatusChanged()   called by the claims workflow: the claim update message for the statuses of
 *                          messaging.claim_update_statuses
 *
 * One idempotency key per business event (policy and days before expiry, bill and days before due date, claim and
 * status), so a job run twice never sends the same reminder twice.
 */
import { many, one, query } from '../../db/pool.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { renderTemplate } from '../../lib/template.js';
import { addDays, today } from '../../lib/dates.js';
import { companyName } from '../../lib/letterhead.js';
import { registerMessageType } from './framework/registry.js';
import { enqueue, processOutbox } from './framework/outbox.js';
import { formatNumber } from './adapters/http.js';
import { printFormat } from '../../lib/pdf/index.js';
import { DEFAULT_FORMAT, formatDate } from '../../lib/pdf/format.js';

export const EVENTS = ['renewal_notice', 'payment_reminder', 'claim_update', 'ctpl_authenticated', 'general'];
export const CHANNELS = ['sms', 'viber'];
export const CONSENT_PURPOSES = ['none', 'processing', 'marketing'];
const TYPE_OF_CHANNEL = { sms: 'sms.send', viber: 'viber.send' };

registerMessageType({ type: 'sms.send', kind: 'sms', label: 'SMS to a client' });
registerMessageType({ type: 'viber.send', kind: 'messaging', label: 'Viber business message to a client' });

/** Placeholders a template may use, with an example (shown on the template screen). */
export const PLACEHOLDERS = {
  clientName: 'Maria Santos', companyName: 'Insurance Broker Inc.', policyNumber: 'PC-MLY-2026-000101', insurer: 'Malayan Insurance Co., Inc.', expiryDate: '2026-11-03',
  daysToExpiry: '30', billNumber: 'BILL-2026-00012', amountDue: '12,450.00', dueDate: '2026-10-10', claimNumber: 'CLM-2026-00031', claimStatus: 'In review',
  cocNumber: 'MIC-00012345', authCode: 'A1B2C3D4E5F6',
};

/**
 * The examples as a message would read them here: the company of the letterhead and the dates in the configured
 * date format, a month and a day from today.
 */
export async function placeholderExamples() {
  const fmt = await printFormat().catch(() => DEFAULT_FORMAT);
  const day = await today();
  return { ...PLACEHOLDERS, companyName: (await companyName().catch(() => null)) || PLACEHOLDERS.companyName,
    expiryDate: formatDate(addDays(day, Number(PLACEHOLDERS.daysToExpiry)), fmt), dueDate: formatDate(addDays(day, 7), fmt) };
}

export const toTemplate = (t) => ({
  code: t.code, name: t.name, channel: t.channel, event: t.event, body: t.body, consentPurpose: t.consent_purpose, connectorCode: t.connector_code, active: t.active,
  description: t.description, updatedBy: t.updated_by_name || t.updated_by, updatedAt: t.updated_at,
});

export async function listTemplates({ event, active } = {}) {
  return (await many(`SELECT t.*, (SELECT display_name FROM users u WHERE u.id = t.updated_by) AS updated_by_name FROM message_templates t
    WHERE ($1::text IS NULL OR t.event = $1) AND ($2::boolean IS NULL OR t.active = $2) ORDER BY t.event, t.code`, [event || null, active === undefined ? null : active])).map(toTemplate);
}

export async function templateRow(code) {
  const t = await one('SELECT * FROM message_templates WHERE code = upper($1)', [String(code || '')]);
  if (!t) throw notFound(`Message template ${code} not found`);
  return t;
}

async function assertConnector(code, channel) {
  if (!code) return;
  const c = await one('SELECT kind FROM integration_connectors WHERE code = $1', [code]);
  if (!c) throw badRequest('Validation failed', [{ path: 'connectorCode', message: `Connector ${code} does not exist` }]);
  if (c.kind !== (channel === 'viber' ? 'messaging' : 'sms')) throw badRequest('Validation failed', [{ path: 'connectorCode', message: `Connector ${code} cannot send ${channel} messages` }]);
}

export async function createTemplate(b, user) {
  if (await one('SELECT 1 FROM message_templates WHERE code = $1', [b.code])) throw conflict(`Template ${b.code} exists already`);
  await assertConnector(b.connectorCode, b.channel || 'sms');
  await query(`INSERT INTO message_templates(code, name, channel, event, body, consent_purpose, connector_code, active, description, created_by, updated_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10)`, [b.code, b.name, b.channel || 'sms', b.event || 'general', b.body, b.consentPurpose || 'processing', b.connectorCode || null,
    b.active !== false, b.description || null, user?.id ?? null]);
  return toTemplate(await templateRow(b.code));
}

export async function updateTemplate(code, b, user) {
  const t = await templateRow(code);
  const next = { name: b.name ?? t.name, channel: b.channel ?? t.channel, event: b.event ?? t.event, body: b.body ?? t.body, consent_purpose: b.consentPurpose ?? t.consent_purpose,
    connector_code: b.connectorCode !== undefined ? b.connectorCode || null : t.connector_code, active: b.active ?? t.active, description: b.description !== undefined ? b.description : t.description };
  await assertConnector(next.connector_code, next.channel);
  await query(`UPDATE message_templates SET name = $2, channel = $3, event = $4, body = $5, consent_purpose = $6, connector_code = $7, active = $8, description = $9, updated_by = $10, updated_at = now()
    WHERE code = $1`, [t.code, next.name, next.channel, next.event, next.body, next.consent_purpose, next.connector_code, next.active, next.description, user?.id ?? null]);
  return { before: toTemplate(t), after: toTemplate(await templateRow(t.code)) };
}

/** Text of a template with its placeholders filled, cut at messaging.max_length. */
export async function renderMessage(body, vars) {
  const max = Number(await getSetting('messaging.max_length', 480)) || 480;
  return renderTemplate(body, { companyName: await companyName(), ...vars }, { html: false }).replace(/\s+\n/g, '\n').trim().slice(0, max);
}

/** Consent of a client for a purpose: { ok, status, reason }. */
export async function consentCheck(clientId, purpose) {
  if (!purpose || purpose === 'none') return { ok: true, status: 'not-needed' };
  const c = await one('SELECT anonymised_at FROM clients WHERE id = $1', [clientId]);
  if (c?.anonymised_at) return { ok: false, status: 'anonymised', reason: 'The personal data of the client were anonymised' };
  const latest = await one(`SELECT granted, withdrawn_at FROM privacy_consents WHERE party_type = 'client' AND party_id = $1 AND purpose = $2
    ORDER BY recorded_at DESC, id DESC LIMIT 1`, [clientId, purpose]);
  const status = !latest ? 'not-recorded' : latest.granted && !latest.withdrawn_at ? 'granted' : latest.granted ? 'withdrawn' : 'refused';
  if (purpose === 'marketing') return status === 'granted' ? { ok: true, status } : { ok: false, status, reason: `No marketing consent (${status})` };
  const rule = String(await getSetting('messaging.service_consent', 'opt-out'));
  if (rule === 'opt-in') return status === 'granted' ? { ok: true, status } : { ok: false, status, reason: `No consent for processing (${status}; messaging.service_consent is opt-in)` };
  return ['refused', 'withdrawn'].includes(status) ? { ok: false, status, reason: `The client ${status} consent for processing` } : { ok: true, status };
}

/** A Philippine mobile number in E.164 (+639XXXXXXXXX), or null. */
export async function mobileOf(raw) {
  if (!raw) return null;
  const cc = String(await getSetting('messaging.default_country_code', '63'));
  const e164 = formatNumber(raw, 'e164', cc);
  return cc === '63' ? (/^\+639\d{9}$/.test(e164) ? e164 : null) : (/^\+\d{8,15}$/.test(e164) ? e164 : null);
}

async function connectorFor(template) {
  if (template.connector_code) return template.connector_code;
  return String(await getSetting(template.channel === 'viber' ? 'messaging.viber_connector' : 'messaging.sms_connector', template.channel === 'viber' ? 'VIBER_BUSINESS' : 'SMS_SEMAPHORE'));
}

/**
 * Queue a message to a client. { template (row) | templateCode | event, text (free text, with consentPurpose),
 * clientId, to, vars, entity, entityId, idempotencyKey }. Returns the outbox message, or null when no active template
 * exists for the event.
 */
export async function queueClientMessage(db, m, user = null) {
  let template = m.template || null;
  if (!template && m.templateCode) template = await templateRow(m.templateCode);
  if (!template && m.event) template = await one('SELECT * FROM message_templates WHERE event = $1 AND active ORDER BY code LIMIT 1', [m.event]);
  if (!template && m.text) template = { code: null, channel: m.channel || 'sms', body: m.text, consent_purpose: m.consentPurpose || 'processing', connector_code: m.connectorCode || null, active: true };
  if (!template) return null;
  if (template.code && !template.active && !m.allowInactive) throw badRequest(`Template ${template.code} is not active`);
  const client = m.clientId ? await one('SELECT id, client_code, display_name, phone FROM clients WHERE id = $1 OR client_code = $1', [String(m.clientId)]) : null;
  if (m.clientId && !client) throw notFound('Client not found');
  const text = await renderMessage(template.body, { clientName: client?.display_name, ...(m.vars || {}) });
  const to = await mobileOf(m.to || client?.phone);
  const consent = m.skipConsent || !client ? { ok: true, status: 'not-needed' } : await consentCheck(client.id, template.consent_purpose);
  const reason = !to ? `No valid mobile number${m.to || client?.phone ? ` (${m.to || client.phone})` : ''}` : !consent.ok ? consent.reason : null;
  return enqueue(db, {
    connectorCode: m.connectorCode || await connectorFor(template), messageType: TYPE_OF_CHANNEL[template.channel] || 'sms.send', entity: m.entity || (client ? 'client' : null),
    entityId: m.entityId || client?.id || null, reference: to || m.to || client?.phone || null, idempotencyKey: m.idempotencyKey || null,
    payload: { to, text, templateCode: template.code, clientId: client?.id || null, clientCode: client?.client_code || null, consent: consent.status },
    status: reason ? 'skipped' : 'queued', lastError: reason,
  }, user);
}

const money = (v) => Number(v || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const days = async (key, fallback) => {
  const v = await getSetting(key, fallback);
  return (Array.isArray(v) ? v : fallback).map(Number).filter((n) => Number.isInteger(n) && n >= 0);
};

/** Job sms-renewal-notices. */
export async function smsRenewalNotices() {
  const now = await today();
  const out = { queued: 0, skipped: 0 };
  if (!(await one("SELECT 1 FROM message_templates WHERE event = 'renewal_notice' AND active"))) return { skipped: 'no active renewal_notice template' };
  for (const d of await days('messaging.renewal_notice_days', [30, 7])) {
    const rows = await many(`SELECT p.id, p.policy_number, p.expiry_date::text AS expiry, p.client_id, ic.name AS insurer FROM policies p LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id
      WHERE p.status IN ('active', 'issued') AND p.expiry_date = $1::date AND p.client_id IS NOT NULL AND p.renewed_to IS NULL`, [addDays(now, d)]);
    // lock-in and Scheme 2 accounts and held loans get no renewal reminder (renewals notice gate)
    const gated = await (await import('../renewals/noticeGate.js')).gatedPolicies(rows.map((p) => p.id));
    for (const p of rows.filter((x) => !gated.has(x.id))) {
      const m = await queueClientMessage(null, { event: 'renewal_notice', clientId: p.client_id, entity: 'policy', entityId: p.id, idempotencyKey: `sms:renewal:${p.id}:${p.expiry}:${d}`,
        vars: { policyNumber: p.policy_number, expiryDate: p.expiry, daysToExpiry: String(d), insurer: p.insurer } });
      if (!m || m.duplicate) continue;
      if (m.status === 'skipped') out.skipped += 1; else out.queued += 1;
    }
  }
  return { ...out, sending: await processOutbox() };
}

/** Job sms-payment-reminders. */
export async function smsPaymentReminders() {
  const now = await today();
  const out = { queued: 0, skipped: 0 };
  if (!(await one("SELECT 1 FROM message_templates WHERE event = 'payment_reminder' AND active"))) return { skipped: 'no active payment_reminder template' };
  for (const d of await days('messaging.payment_reminder_days', [3, 0])) {
    const rows = await many(`SELECT r.id, r.bill_number, r.balance, r.due_date::text AS due, COALESCE(r.client_id, p.client_id) AS client_id, p.policy_number
      FROM receivables r LEFT JOIN policies p ON p.id = r.policy_id
      WHERE r.status IN ('open', 'partial') AND r.balance > 0 AND r.due_date = $1::date AND COALESCE(r.client_id, p.client_id) IS NOT NULL`, [addDays(now, d)]);
    for (const r of rows) {
      const m = await queueClientMessage(null, { event: 'payment_reminder', clientId: r.client_id, entity: 'receivable', entityId: r.id, idempotencyKey: `sms:payment:${r.id}:${r.due}:${d}`,
        vars: { billNumber: r.bill_number, amountDue: money(r.balance), dueDate: r.due, policyNumber: r.policy_number } });
      if (!m || m.duplicate) continue;
      if (m.status === 'skipped') out.skipped += 1; else out.queued += 1;
    }
  }
  return { ...out, sending: await processOutbox() };
}

/** Claims workflow hook: queue the claim update message (never blocks the claim workflow). */
export async function claimStatusChanged(claim, status, statusLabel) {
  const statuses = await getSetting('messaging.claim_update_statuses', []);
  if (!Array.isArray(statuses) || !statuses.includes(status)) return null;
  const c = await one(`SELECT c.id, c.claim_number, COALESCE(c.client_id, p.client_id) AS client_id, p.policy_number, COALESCE(c.rejected_reason, c.cancelled_reason) AS reason
    FROM claims c JOIN policies p ON p.id = c.policy_id WHERE c.id = $1`, [claim.id]);
  if (!c?.client_id) return null;
  return queueClientMessage(null, { event: 'claim_update', clientId: c.client_id, entity: 'claim', entityId: c.id, idempotencyKey: `sms:claim:${c.id}:${status}`,
    vars: { claimNumber: c.claim_number, claimStatus: statusLabel || status, policyNumber: c.policy_number, reason: ['rejected', 'cancelled'].includes(status) ? c.reason || '' : '' } });
}

/** Variables for an ad hoc message about a policy or a claim of the client. */
export async function contextVars({ policyId, claimId }) {
  const out = {};
  if (policyId) {
    const p = await one(`SELECT p.policy_number, p.expiry_date::text AS expiry, ic.name AS insurer, p.doc->>'cocNumber' AS coc, p.doc->>'ctplAuthenticationCode' AS auth
      FROM policies p LEFT JOIN insurance_companies ic ON ic.id = p.insurance_company_id WHERE p.id = $1 OR p.policy_number = $1`, [String(policyId)]);
    if (p) Object.assign(out, { policyNumber: p.policy_number, expiryDate: p.expiry, insurer: p.insurer, cocNumber: p.coc, authCode: p.auth });
  }
  if (claimId) {
    const c = await one('SELECT claim_number, status FROM claims WHERE id = $1 OR claim_number = $1', [String(claimId)]);
    if (c) Object.assign(out, { claimNumber: c.claim_number, claimStatus: c.status });
  }
  return out;
}
