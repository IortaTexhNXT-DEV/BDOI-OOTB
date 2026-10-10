/**
 * BIR Electronic Invoicing System (EIS) connector (RR 8-2022 and the EIS technical specifications for taxpayers).
 *
 *   payload     buildPayload(): the e-invoice JSON in the structure of the EIS invoice data (seller, buyer, items, VAT
 *               breakdown, withholding, totals) built from the issued sales invoice; field names follow the EIS
 *               specification as published to taxpayers and are confirmed at the broker's EIS certification
 *   signing     signPayload(): placeholder. With the key in the environment variable named by eis.signing_key_env the
 *               canonical payload is signed with HMAC-SHA256 (alg "HS256-PLACEHOLDER"); the BIR issues the real signing
 *               method and certificate at certification, which replaces this function only
 *   adapter     PROVIDERS: "fake" (eis.mode = test: validates and acknowledges inside the system, nothing leaves it) and
 *               "http" (eis.mode = live: token from eis.token_endpoint with the client id / secret read from the
 *               environment variables named in the settings, then POST to eis.endpoint)
 *   outbox      eis_submissions: one row per invoice and per cancellation, status queued / sending / accepted /
 *               rejected / failed / manual, attempts, next attempt (eis.retry_minutes doubled per attempt, at most
 *               eis.max_attempts), response and EIS reference; the eis-outbox job (or "Send now") processes it. A row
 *               left in sending longer than eis.sending_stale_minutes (server stopped during the call) is retried
 *   fallback    exportPayloads(): the queued payloads as a JSON file for a manual upload, then markManual() records the
 *               reference the BIR gave, so invoicing never waits for the connector
 *
 * Switched off by default (eis.enabled = false). What remains with the BIR: the broker's EIS enrolment and
 * certification (sandbox tests, the final field list and the signing certificate), the production endpoint and
 * credentials, and the BIR's acceptance of the system as an EIS-capable CAS.
 */
import crypto from 'node:crypto';
import { getSetting } from '../../lib/settings.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { pool } from '../../db/pool.js';
import { iso } from '../period-end/fiscal.js';
import { round2 } from './common.js';

const setting = async (k, d) => (await getSetting(`eis.${k}`, d)) ?? d;
export async function eisConfig() {
  return {
    enabled: (await setting('enabled', false)) === true, mode: (await setting('mode', 'test')) === 'live' ? 'live' : 'test', endpoint: await setting('endpoint', ''),
    tokenEndpoint: await setting('token_endpoint', ''), clientIdEnv: await setting('client_id_env', 'BIR_EIS_CLIENT_ID'), clientSecretEnv: await setting('client_secret_env', 'BIR_EIS_CLIENT_SECRET'),
    signingKeyEnv: await setting('signing_key_env', 'BIR_EIS_SIGNING_KEY'), accreditationId: await setting('accreditation_id', ''), submitOnIssue: (await setting('submit_on_issue', true)) !== false,
    maxAttempts: Number(await setting('max_attempts', 5)) || 5, retryMinutes: Number(await setting('retry_minutes', 15)) || 15, timeoutMs: Number(await setting('timeout_ms', 20000)) || 20000,
    sendingStaleMinutes: Number(await setting('sending_stale_minutes', 15)) || 15,
  };
}

/** Canonical JSON (keys sorted) so the hash and the signature do not depend on key order. */
export function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
export const payloadHash = (p) => crypto.createHash('sha256').update(canonical(p)).digest('hex');

const digits = (v) => String(v || '').replace(/\D/g, '');
const amt = (v) => round2(Number(v) || 0);

/** E-invoice payload of an invoice row (sales_invoices with its lines) for an issue or a cancellation. */
export function buildPayload(inv, lines, kind = 'invoice', { accreditationId = '' } = {}) {
  const s = inv.seller || {};
  const buyerTin = digits(inv.buyer_tin);
  const base = {
    EisCertId: accreditationId || null,
    CompInvoiceId: inv.invoice_number,
    DocType: 'SI',
    IssueDtm: `${iso(inv.invoice_date)}T00:00:00+08:00`,
    Seller: { Tin: digits(s.tin).slice(0, 9), BranchCd: String(s.branchCode || '00000'), RegNm: s.registeredName || '', BusinessNm: s.tradeName || s.registeredName || '',
      Addr: s.address || '', VatReg: s.vatRegistered ? 'Y' : 'N' },
    Buyer: { Tin: buyerTin.slice(0, 9) || null, BranchCd: inv.buyer_branch_code || (buyerTin.length > 9 ? buyerTin.slice(9) : null), RegNm: inv.buyer_name, BusinessNm: inv.buyer_business_style || null,
      Addr: inv.buyer_address || null },
  };
  if (kind === 'cancellation') {
    return { ...base, DocType: 'SI-CANCEL', CancelDtm: inv.cancelled_at ? new Date(inv.cancelled_at).toISOString() : new Date().toISOString(), CancelReason: inv.cancel_reason || '' };
  }
  return {
    ...base,
    Currency: inv.currency || 'PHP',
    ItemList: lines.map((l) => ({ Seq: l.line_no, Nm: l.description, Qty: Number(l.quantity), Unit: 'SVC', UnitCost: amt(l.unit_price), SalesAmt: amt(l.amount),
      RegularDiscountAmt: 0, SpecialDiscountAmt: 0, NetSales: amt(l.amount), VatType: { vatable: 'V', exempt: 'E', zero_rated: 'Z' }[l.vat_class] || 'V', VatAmt: amt(l.vat_amount) })),
    TotNetSalesAftDisct: amt(inv.total_sales), VATableSales: amt(inv.vatable_sales), VATExemptSales: amt(inv.vat_exempt_sales), ZeroRatedSales: amt(inv.zero_rated_sales),
    VATAmt: amt(inv.vat_amount), TotAmt: amt(inv.total_amount), WithholdingIncomeTax: amt(inv.withholding_tax), WithholdingBusVatTax: 0, WithholdingBusPT: 0,
    NetAmountDue: amt(Number(inv.total_amount) - Number(inv.withholding_tax)), Remarks: inv.remarks || null,
    AtpOrPtu: s.casPermitNumber || s.atpNumber || null,
  };
}

/** Signing placeholder (see the module notes). Returns { signature, alg }. */
export function signPayload(payload, keyEnvName, env = process.env) {
  const key = keyEnvName ? env[keyEnvName] : null;
  if (!key) return { signature: null, alg: 'none' };
  return { signature: crypto.createHmac('sha256', key).update(canonical(payload)).digest('base64'), alg: 'HS256-PLACEHOLDER' };
}

// ---------------------------------------------------------------- providers

class TransientError extends Error {}

/** Test-mode provider: checks what the EIS checks first and answers like it, without any network call. */
export const fakeProvider = {
  name: 'fake',
  async submit(sub) {
    const p = sub.payload;
    if (String(p.Remarks || '').includes('EIS-TEST-UNAVAILABLE')) throw new TransientError('Test provider: service unavailable (simulated)');
    const errors = [];
    if (!/^\d{9}$/.test(String(p.Seller?.Tin || ''))) errors.push('Seller TIN must have 9 digits');
    if (!p.Buyer?.RegNm) errors.push('Buyer name is required');
    if (sub.kind === 'invoice') {
      const sales = round2((p.VATableSales || 0) + (p.VATExemptSales || 0) + (p.ZeroRatedSales || 0));
      if (p.Seller?.VatReg === 'Y' && Math.abs(sales - round2(p.TotNetSalesAftDisct)) > 0.01) errors.push('VATable, exempt and zero-rated sales do not add up to the net sales');
      if (Math.abs(round2(p.TotNetSalesAftDisct + p.VATAmt) - round2(p.TotAmt)) > 0.01) errors.push('Net sales plus VAT do not equal the total amount');
      if (!Array.isArray(p.ItemList) || !p.ItemList.length) errors.push('At least one item is required');
    }
    if (errors.length) return { status: 'rejected', response: { result: 'REJECTED', errors } };
    return { status: 'accepted', reference: `TEST-${sub.payload_hash.slice(0, 16).toUpperCase()}`, response: { result: 'ACCEPTED', test: true, receivedAt: new Date().toISOString() } };
  },
};

/** Live provider: OAuth client credentials from the environment, then the JSON POST to the configured endpoint. */
export const httpProvider = {
  name: 'http',
  async submit(sub, cfg, env = process.env, fetchImpl = globalThis.fetch) {
    if (!/^https:\/\//.test(cfg.endpoint)) throw new Error('eis.endpoint is not set (https://...)');
    const id = env[cfg.clientIdEnv]; const secret = env[cfg.clientSecretEnv];
    if (!id || !secret) throw new Error(`EIS credentials missing: set the environment variables ${cfg.clientIdEnv} and ${cfg.clientSecretEnv}`);
    const signal = AbortSignal.timeout(cfg.timeoutMs);
    let token = null;
    if (cfg.tokenEndpoint) {
      const t = await fetchImpl(cfg.tokenEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: id, clientSecret: secret }), signal });
      if (!t.ok) throw new TransientError(`EIS authentication failed (${t.status})`);
      token = (await t.json()).access_token || null;
    }
    const r = await fetchImpl(cfg.endpoint, { method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(sub.signature ? { 'X-Signature': sub.signature, 'X-Signature-Alg': sub.signature_alg } : {}) },
      body: JSON.stringify(sub.payload) });
    const body = await r.json().catch(() => ({}));
    if (r.status >= 500 || r.status === 429) throw new TransientError(`EIS answered ${r.status}`);
    if (!r.ok) return { status: 'rejected', response: body };
    return { status: 'accepted', reference: body.reference || body.eisReference || body.id || null, response: body };
  },
};
export const PROVIDERS = { fake: fakeProvider, http: httpProvider };
const providerFor = (mode) => (mode === 'live' ? httpProvider : fakeProvider);

// ---------------------------------------------------------------- outbox

export const submissionRow = (s) => s && ({ id: s.id, invoiceId: s.invoice_id, invoiceNumber: s.invoice_number, kind: s.kind, mode: s.mode, provider: s.provider, status: s.status,
  attempts: s.attempts, nextAttemptAt: s.next_attempt_at, lastError: s.last_error, eisReference: s.eis_reference, payloadHash: s.payload_hash, signatureAlg: s.signature_alg,
  submittedAt: s.submitted_at, acceptedAt: s.accepted_at, createdAt: s.created_at, updatedAt: s.updated_at, response: s.response, payload: s.payload });

/** Queue an invoice (or its cancellation) when the connector is on; returns the submission or null. */
export async function enqueueInvoice(db, invoiceId, kind = 'invoice', user = null, { force = false } = {}) {
  const cfg = await eisConfig();
  if (!force && (!cfg.enabled || !cfg.submitOnIssue)) return null;
  const inv = (await db.query('SELECT * FROM sales_invoices WHERE id = $1', [invoiceId])).rows[0];
  if (!inv) throw notFound('Sales invoice not found');
  if (kind === 'cancellation') {
    // a cancellation is sent only for an invoice the EIS has (or may have) received
    const sent = (await db.query('SELECT 1 FROM eis_submissions WHERE invoice_id = $1 AND kind = \'invoice\'', [invoiceId])).rows[0];
    if (!sent) return null;
  }
  const lines = (await db.query('SELECT * FROM sales_invoice_lines WHERE invoice_id = $1 ORDER BY line_no', [invoiceId])).rows;
  const payload = buildPayload(inv, lines, kind, { accreditationId: cfg.accreditationId });
  const sig = signPayload(payload, cfg.signingKeyEnv);
  const row = (await db.query(`INSERT INTO eis_submissions(invoice_id, invoice_number, kind, payload, payload_hash, signature, signature_alg, mode, provider, created_by)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (invoice_id, kind) DO NOTHING RETURNING *`,
  [invoiceId, inv.invoice_number, kind, JSON.stringify(payload), payloadHash(payload), sig.signature, sig.alg, cfg.mode, providerFor(cfg.mode).name, user?.id ?? null])).rows[0];
  return submissionRow(row || null);
}

/** Queue the issued invoices of a date range that are not in the outbox yet (after the connector is switched on). */
export async function queueBacklog(db, { from, to }, user) {
  const ids = (await db.query(`SELECT id FROM sales_invoices s WHERE s.status = 'issued' AND s.invoice_date BETWEEN $1 AND $2
    AND NOT EXISTS (SELECT 1 FROM eis_submissions e WHERE e.invoice_id = s.id AND e.kind = 'invoice') ORDER BY invoice_number`, [from, to])).rows.map((r) => r.id);
  let queued = 0;
  for (const id of ids) if (await enqueueInvoice(db, id, 'invoice', user, { force: true })) queued += 1;
  return { queued };
}

/**
 * A submission left in "sending" longer than eis.sending_stale_minutes (the server stopped during the call) counts as a
 * failed attempt and is due again at once; the attempt was already counted when the row was claimed, so eis.max_attempts
 * still bounds it. Returns the number of submissions released.
 */
export async function releaseStaleSending(cfg, db = pool) {
  const r = await db.query(`UPDATE eis_submissions SET status = 'failed', last_error = COALESCE(last_error, 'Sending was interrupted (server stopped during the call); queued again'),
    next_attempt_at = now(), updated_at = now() WHERE status = 'sending' AND updated_at < now() - make_interval(mins => $1)`, [cfg.sendingStaleMinutes]);
  return r.rowCount;
}

/**
 * Send what is due: queued submissions and failed ones whose next attempt has come, up to `limit`. Each is sent
 * on its own; a transient error schedules a retry, a rejection is final (fix the invoice: cancel and reissue).
 */
export async function processOutbox({ limit = 50, ids = null, providers = PROVIDERS } = {}) {
  const cfg = await eisConfig();
  if (!cfg.enabled) return { skipped: 'the e-invoicing connection is switched off' };
  const released = await releaseStaleSending(cfg);
  const due = (await pool.query(`SELECT * FROM eis_submissions WHERE status IN ('queued', 'failed') AND attempts < $1 AND next_attempt_at <= now()
    AND ($3::text[] IS NULL OR id = ANY($3)) ORDER BY created_at LIMIT $2`, [cfg.maxAttempts, limit, ids])).rows;
  const out = { sent: 0, accepted: 0, rejected: 0, failed: 0, ...(released ? { released } : {}) };
  for (const s of due) {
    const claimed = (await pool.query('UPDATE eis_submissions SET status = \'sending\', attempts = attempts + 1, updated_at = now() WHERE id = $1 AND status IN (\'queued\', \'failed\') RETURNING *', [s.id])).rows[0];
    if (!claimed) continue;
    out.sent += 1;
    const provider = cfg.mode === 'live' ? providers.http : providers.fake;
    try {
      const r = await provider.submit(claimed, cfg);
      if (r.status === 'accepted') {
        await pool.query(`UPDATE eis_submissions SET status = 'accepted', eis_reference = $2, response = $3, last_error = NULL, submitted_at = now(), accepted_at = now(), mode = $4, provider = $5,
          updated_at = now() WHERE id = $1`, [s.id, r.reference || null, JSON.stringify(r.response || {}), cfg.mode, provider.name]);
        out.accepted += 1;
      } else {
        await pool.query(`UPDATE eis_submissions SET status = 'rejected', response = $2, last_error = $3, submitted_at = now(), mode = $4, provider = $5, updated_at = now() WHERE id = $1`,
          [s.id, JSON.stringify(r.response || {}), (r.response?.errors || []).join('; ') || 'Rejected by the EIS', cfg.mode, provider.name]);
        out.rejected += 1;
      }
    } catch (e) {
      const minutes = cfg.retryMinutes * 2 ** Math.max(0, claimed.attempts - 1);
      await pool.query(`UPDATE eis_submissions SET status = 'failed', last_error = $2, next_attempt_at = now() + ($3::text || ' minutes')::interval, mode = $4, provider = $5, updated_at = now() WHERE id = $1`,
        [s.id, String(e.message || e).slice(0, 500), String(minutes), cfg.mode, provider.name]);
      out.failed += 1;
    }
  }
  return out;
}

export async function listSubmissions(db, q = {}) {
  const rows = (await db.query(`SELECT * FROM eis_submissions WHERE ($1::text IS NULL OR status = $1) AND ($2::text IS NULL OR invoice_number ILIKE '%' || $2 || '%')
    ORDER BY created_at DESC LIMIT 500`, [q.status || null, q.search || null])).rows;
  return rows.map((r) => ({ ...submissionRow(r), payload: undefined }));
}
export async function getSubmission(db, id) {
  const r = (await db.query('SELECT * FROM eis_submissions WHERE id = $1', [id])).rows[0];
  if (!r) throw notFound('EIS submission not found');
  return submissionRow(r);
}

/** Put a failed (or rejected, after the cause was fixed) submission back in the queue with fresh attempts. */
export async function retrySubmission(db, id) {
  const r = (await db.query(`UPDATE eis_submissions SET status = 'queued', attempts = 0, next_attempt_at = now(), updated_at = now() WHERE id = $1 AND status IN ('failed', 'rejected') RETURNING *`, [id])).rows[0];
  if (!r) throw conflict('Only a failed or rejected submission can be retried');
  return submissionRow(r);
}

/** Manual fallback: the payload was uploaded outside the system; record the reference the BIR gave. */
export async function markManual(db, id, reference) {
  if (!reference) throw badRequest('The EIS reference of the manual upload is required');
  const r = (await db.query(`UPDATE eis_submissions SET status = 'manual', mode = 'manual', eis_reference = $2, submitted_at = now(), accepted_at = now(), last_error = NULL, updated_at = now()
    WHERE id = $1 AND status IN ('queued', 'failed', 'rejected') RETURNING *`, [id, reference])).rows[0];
  if (!r) throw conflict('Only a queued, failed or rejected submission can be marked as uploaded manually');
  return submissionRow(r);
}

/** Manual fallback: the payloads of the queued / failed submissions (or the given ones) as one JSON document. */
export async function exportPayloads(db, { ids = null } = {}) {
  const rows = (await db.query(`SELECT * FROM eis_submissions WHERE ($1::text[] IS NULL AND status IN ('queued', 'failed')) OR id = ANY($1) ORDER BY created_at`, [ids])).rows;
  return { generatedAt: new Date().toISOString(), count: rows.length, invoices: rows.map((r) => ({ submissionId: r.id, kind: r.kind, payloadHash: r.payload_hash, signature: r.signature, payload: r.payload })) };
}

/**
 * What the connection still needs, as codes for the screen: accreditationId (always), and in live mode endpoint (an
 * https address), credentials (the client id and secret variables set) and signingKey. State: off when the connection
 * is switched off, incomplete when something is missing, otherwise ready.
 */
export function connectionSetup(cfg, { credentialsPresent, signingKeyPresent }) {
  const missing = [];
  if (!cfg.accreditationId) missing.push('accreditationId');
  if (cfg.mode === 'live') {
    if (!/^https:\/\//.test(cfg.endpoint || '')) missing.push('endpoint');
    if (!credentialsPresent) missing.push('credentials');
    if (!signingKeyPresent) missing.push('signingKey');
  }
  return { state: !cfg.enabled ? 'off' : missing.length ? 'incomplete' : 'ready', missing };
}

/** Connector status for the screen: settings (never the secret values), whether the variables are set, setup, counts. */
export async function eisStatus(db, env = process.env) {
  const cfg = await eisConfig();
  const counts = Object.fromEntries((await db.query('SELECT status, count(*)::int AS n FROM eis_submissions GROUP BY status')).rows.map((r) => [r.status, r.n]));
  const lastSentAt = (await db.query('SELECT max(submitted_at) AS at FROM eis_submissions')).rows[0].at;
  const present = { credentialsPresent: !!(env[cfg.clientIdEnv] && env[cfg.clientSecretEnv]), signingKeyPresent: !!env[cfg.signingKeyEnv] };
  return { ...cfg, ...present, counts, lastSentAt, setup: connectionSetup(cfg, present) };
}
