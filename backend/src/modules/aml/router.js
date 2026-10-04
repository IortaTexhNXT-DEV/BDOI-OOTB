/**
 * AML/CFT API (/aml): client due diligence (signatories, beneficial owners, KYC documents, risk rating, EDD, KYC
 * refresh), sanctions / PEP / negative list screening (lists, versions, hits, provider outbox), covered and suspicious
 * transaction monitoring (rules, alerts), AML cases, AMLC report files, the AML dashboard and settings.
 * Screens: Compliance menu (read:aml, write:aml, approve:aml) and Operations > Clients > Onboard client (write:clients).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { ok, created } from '../../lib/respond.js';
import { getSetting, setSetting } from '../../lib/settings.js';
import { query } from '../../db/pool.js';
import { memoryUpload, importUpload } from '../../lib/uploadLimits.js';
import { today } from '../../lib/dates.js';
import { AML_DEFAULTS, AML_SETTING_KEYS } from './common.js';
import * as risk from './risk.js';
import * as kyc from './kyc.js';
import * as scr from './screening.js';
import * as mon from './monitoring.js';
import * as cases from './cases.js';
import * as rep from './reports.js';
import { listRequests, providerConfig, retryRequest, callProvider } from './providers.js';

const { router, define } = moduleRouter('AML Compliance', '/aml');
const SCREEN = 'Compliance';
const read = [requirePermission('read:aml')];
const write = [requirePermission('write:aml')];
const approve = [requirePermission('approve:aml')];
const clientRead = [requirePermission('read:aml', 'read:clients')];
const clientWrite = [requirePermission('write:aml', 'write:clients')];
const docUpload = memoryUpload({ files: 1 }).single('file');
const listUpload = importUpload().single('file');

const reason = z.string().trim().min(5).max(2000);
const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optDate = dayString.optional().nullable().or(z.literal(''));

// ---------------------------------------------------------------- dashboard and settings

define({
  method: 'GET', path: '/dashboard', summary: 'AML dashboard counts: clients by risk rating and KYC status, open hits, EDD reviews, KYC refreshes due, alerts, cases due, reports', screen: `${SCREEN} > AML Dashboard`, middleware: read,
  response: { success: true, data: { ratings: { low: 10, normal: 4, high: 1, unrated: 3 }, openHits: 2, eddOpen: 1, eddSubmitted: 0, refreshDue: 3, alertsOpen: 5, casesOpen: 1, casesOverdue: 0 } },
  handler: async (_req, res) => {
    const n = async (sql, p = []) => Number((await query(sql, p)).rows[0].n);
    const now = await today();
    const ratings = Object.fromEntries((await query(`SELECT COALESCE(risk_rating, 'unrated') AS r, count(*) AS n FROM clients WHERE status <> 'deleted' AND anonymised_at IS NULL GROUP BY 1`)).rows.map((r) => [r.r, Number(r.n)]));
    const kycStatus = Object.fromEntries((await query(`SELECT kyc_status AS s, count(*) AS n FROM clients WHERE status <> 'deleted' AND anonymised_at IS NULL GROUP BY 1`)).rows.map((r) => [r.s, Number(r.n)]));
    const alerts = Object.fromEntries((await query("SELECT kind, count(*) AS n FROM aml_alerts WHERE status = 'open' GROUP BY 1")).rows.map((r) => [r.kind, Number(r.n)]));
    ok(res, {
      ratings: { low: 0, normal: 0, high: 0, unrated: 0, ...ratings }, kycStatus,
      openHits: await n("SELECT count(*) AS n FROM aml_screening_hits WHERE status = 'open'"),
      escalatedHits: await n("SELECT count(*) AS n FROM aml_screening_hits WHERE status = 'escalated'"),
      confirmedHits: await n("SELECT count(*) AS n FROM aml_screening_hits WHERE status = 'confirmed'"),
      eddOpen: await n("SELECT count(*) AS n FROM aml_edd_reviews WHERE status IN ('open', 'rejected')"),
      eddSubmitted: await n("SELECT count(*) AS n FROM aml_edd_reviews WHERE status = 'submitted'"),
      refreshDue: (await risk.refreshDue()).length,
      refreshOverdue: await n("SELECT count(*) AS n FROM clients WHERE kyc_next_review_on <= $1::date AND status <> 'deleted' AND anonymised_at IS NULL", [now]),
      alertsOpen: (alerts.covered || 0) + (alerts.suspicious || 0), coveredOpen: alerts.covered || 0, suspiciousOpen: alerts.suspicious || 0,
      casesOpen: await n("SELECT count(*) AS n FROM aml_cases WHERE status IN ('open', 'for-filing')"),
      casesOverdue: await n("SELECT count(*) AS n FROM aml_cases WHERE status IN ('open', 'for-filing') AND due_on < $1::date", [now]),
      reportsToSubmit: await n("SELECT count(*) AS n FROM aml_reports WHERE status = 'generated'"),
      providerFailures: await n("SELECT count(*) AS n FROM aml_provider_requests WHERE status IN ('failed', 'abandoned')"),
      listsWithoutVersion: await n('SELECT count(*) AS n FROM aml_screening_lists WHERE active AND current_version_id IS NULL'),
    });
  },
});

define({
  method: 'GET', path: '/settings', summary: 'AML settings (aml.*) with labels and current values', screen: `${SCREEN} > AML Settings`, middleware: read,
  response: { success: true, data: [{ key: 'aml.covered_threshold', value: 500000, label: 'Covered transaction ...', type: 'number' }] },
  handler: async (_req, res) => {
    const rows = (await query(`SELECT key, value, label, type, updated_at AS "updatedAt" FROM app_settings WHERE "group" = 'aml' ORDER BY key`)).rows;
    ok(res, AML_SETTING_KEYS.map((k) => rows.find((r) => r.key === k) || { key: k, value: AML_DEFAULTS[k], label: k, type: typeof AML_DEFAULTS[k] }));
  },
});

const settingValue = {
  'aml.covered_threshold': z.number().positive(), 'aml.covered_aggregation': z.enum(['banking-day', 'single']), 'aml.covered_payment_modes': z.array(z.string().min(1)).min(1),
  'aml.ctr_due_working_days': z.number().int().min(1).max(30), 'aml.str_due_working_days': z.number().int().min(1).max(30), 'aml.match_threshold': z.number().min(0.5).max(1),
  'aml.risk_low_max_score': z.number().int().min(0), 'aml.risk_high_min_score': z.number().int().min(1), 'aml.pep_always_high': z.boolean(),
  'aml.kyc_refresh_months': z.object({ low: z.number().int().min(1).max(120), normal: z.number().int().min(1).max(120), high: z.number().int().min(1).max(120) }),
  'aml.kyc_refresh_notice_days': z.number().int().min(0).max(365), 'aml.beneficial_owner_threshold': z.number().min(1).max(100), 'aml.record_retention_years': z.number().int().min(5).max(30),
  'aml.screening_block_events': z.array(z.enum(['policy-issue', 'payout', 'onboarding'])), 'aml.block_issue_pending_edd': z.boolean(),
  'aml.screening_provider': z.object({ provider: z.enum(['lists', 'fake', 'http']), endpoint: z.string().max(500).optional().default(''), apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'An environment variable name (A-Z, 0-9, _)').optional().or(z.literal('')),
    mode: z.enum(['sandbox', 'live']).default('sandbox'), timeoutMs: z.number().int().min(1000).max(60000).default(10000), maxAttempts: z.number().int().min(1).max(20).default(5) }).strict(),
  'aml.amlc_institution_code': z.string().max(40), 'aml.amlc_transaction_codes': z.record(z.string().max(20)),
};

define({
  method: 'PUT', path: '/settings', summary: 'Change AML settings (thresholds, risk rating limits, refresh months, retention, screening provider by environment variable name)', screen: `${SCREEN} > AML Settings`,
  middleware: [...write, validate(z.object({ settings: z.record(z.any()) }))], request: { settings: { 'aml.covered_threshold': 500000 } }, response: { success: true },
  handler: async (req, res) => {
    const changes = [];
    for (const [key, value] of Object.entries(req.body.settings)) {
      const schema = settingValue[key];
      if (!schema) throw badRequest(`${key} is not an AML setting`);
      const parsed = schema.safeParse(value);
      if (!parsed.success) throw badRequest(`${key}: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`.trim()).join('; ')}`);
      changes.push([key, parsed.data, await getSetting(key, AML_DEFAULTS[key])]);
    }
    const next = Object.fromEntries(changes.map(([k, v]) => [k, v]));
    const low = next['aml.risk_low_max_score'] ?? await getSetting('aml.risk_low_max_score', 2);
    const high = next['aml.risk_high_min_score'] ?? await getSetting('aml.risk_high_min_score', 8);
    if (Number(low) >= Number(high)) throw badRequest('The Low limit must be below the High limit');
    for (const [key, value, before] of changes) {
      await setSetting(key, value, req.user.id);
      await audit(req, { entity: 'setting', entityId: key, action: 'update', before: { value: before }, after: { value } });
    }
    ok(res, { changed: changes.map(([k]) => k) }, 'AML settings saved');
  },
});

// ---------------------------------------------------------------- risk factors and rules

const factorBody = z.object({ factor: z.enum(risk.FACTORS), matchValue: z.string().trim().max(100).optional(), minAmount: z.number().min(0).nullable().optional(),
  maxAmount: z.number().positive().nullable().optional(), score: z.number().int().min(0).max(100), description: z.string().max(300).optional().nullable(), active: z.boolean().optional() });
define({ method: 'GET', path: '/risk-factors', summary: 'Risk factors of the customer risk rating', screen: `${SCREEN} > AML Settings > Risk factors`, middleware: read,
  response: { success: true, data: [{ id: 1, factor: 'payment-mode', matchValue: 'cash', score: 3 }] }, handler: async (_req, res) => ok(res, await risk.listFactors()) });
define({ method: 'POST', path: '/risk-factors', summary: 'Add a risk factor value and its score', screen: `${SCREEN} > AML Settings > Risk factors`, middleware: [...write, validate(factorBody)],
  request: { factor: 'geography', matchValue: 'Sulu', score: 3, description: 'Province rated higher by the AML programme' }, response: { success: true },
  handler: async (req, res) => { const r = await risk.saveFactor(null, req.body, req.user.id); await audit(req, { entity: 'aml_risk_factor', entityId: r.after.id, action: 'create', after: r.after }); created(res, r.after, 'Risk factor added'); } });
define({ method: 'PUT', path: '/risk-factors/:id', summary: 'Change a risk factor', screen: `${SCREEN} > AML Settings > Risk factors`, middleware: [...write, validate(factorBody)],
  request: { factor: 'payment-mode', matchValue: 'cash', score: 4 }, response: { success: true },
  handler: async (req, res) => { const r = await risk.saveFactor(Number(req.params.id), req.body, req.user.id); await audit(req, { entity: 'aml_risk_factor', entityId: req.params.id, action: 'update', before: r.before, after: r.after }); ok(res, r.after, 'Risk factor saved'); } });
define({ method: 'DELETE', path: '/risk-factors/:id', summary: 'Remove a risk factor', screen: `${SCREEN} > AML Settings > Risk factors`, middleware: write, response: { success: true },
  handler: async (req, res) => { const r = await risk.deleteFactor(Number(req.params.id)); await audit(req, { entity: 'aml_risk_factor', entityId: req.params.id, action: 'delete', before: r }); ok(res, r, 'Risk factor removed'); } });

define({ method: 'GET', path: '/rules', summary: 'Covered and suspicious transaction rules', screen: `${SCREEN} > AML Settings > Monitoring rules`, middleware: read,
  response: { success: true, data: [{ code: 'CT_CASH', kind: 'covered', enabled: true, params: {} }] }, handler: async (_req, res) => ok(res, await mon.listRules()) });
define({ method: 'PUT', path: '/rules/:code', summary: 'Switch a monitoring rule on or off, change its parameters or severity', screen: `${SCREEN} > AML Settings > Monitoring rules`,
  middleware: [...write, validate(z.object({ enabled: z.boolean().optional(), severity: z.enum(['low', 'medium', 'high']).optional(), params: z.record(z.number()).optional() }))],
  request: { enabled: true, params: { days: 7, minCount: 3, minTotal: 400000 } }, response: { success: true },
  handler: async (req, res) => { const r = await mon.updateRule(req.params.code, req.body, req.user.id); await audit(req, { entity: 'aml_rule', entityId: req.params.code, action: 'update', before: r.before, after: r.after }); ok(res, r.after, 'Rule saved'); } });

// ---------------------------------------------------------------- client due diligence

define({ method: 'GET', path: '/clients', summary: 'Clients with their risk rating, KYC status and next KYC refresh (filter rating, kycStatus, search)', screen: `${SCREEN} > Client Due Diligence`, middleware: read,
  query: { rating: 'high', kycStatus: 'edd-required', search: 'cruz' }, response: { success: true, data: [{ clientId: 'cl_1', clientCode: 'CL-2026-00001', riskRating: 'high', kycStatus: 'edd-required' }] },
  handler: async (req, res) => {
    const params = [];
    const where = ["c.status <> 'deleted'", 'c.anonymised_at IS NULL'];
    const add = (sql, v) => { params.push(v); where.push(sql.replaceAll('?', `$${params.length}`)); };
    if (req.query.rating === 'unrated') where.push('c.risk_rating IS NULL'); else if (req.query.rating) add('c.risk_rating = ?', String(req.query.rating));
    if (req.query.kycStatus) add('c.kyc_status = ANY(?)', String(req.query.kycStatus).split(','));
    if (req.query.clientType) add('c.client_type = ?', String(req.query.clientType));
    if (req.query.search) add("(c.display_name ILIKE '%' || ? || '%' OR c.client_code ILIKE '%' || ? || '%' OR c.tin ILIKE '%' || ? || '%')", String(req.query.search));
    const rows = (await query(`SELECT c.id, c.client_code, c.display_name, c.client_type, c.customer_type, c.risk_rating, c.risk_score, c.kyc_status, c.kyc_next_review_on, c.risk_assessed_at, c.is_pep, c.onboarded_via,
      (SELECT count(*) FROM aml_screening_hits h WHERE h.client_id = c.id AND h.status IN ('open', 'escalated', 'confirmed')) AS open_hits
      FROM clients c WHERE ${where.join(' AND ')} ORDER BY (c.risk_rating = 'high') DESC NULLS LAST, c.kyc_next_review_on NULLS LAST, c.client_code LIMIT 1000`, params)).rows;
    ok(res, rows.map((r) => ({ clientId: r.id, clientCode: r.client_code, clientName: r.display_name, clientType: r.client_type, customerType: r.customer_type, riskRating: r.risk_rating,
      riskScore: r.risk_score, kycStatus: r.kyc_status, nextReviewOn: r.kyc_next_review_on, assessedAt: r.risk_assessed_at, isPep: r.is_pep, onboardedVia: r.onboarded_via, openHits: Number(r.open_hits) })));
  },
});
define({ method: 'GET', path: '/clients/:id/profile', summary: 'AML profile of a client: identification gaps, signatories, beneficial owners, documents, rating history, screenings, hits, EDD reviews',
  screen: 'Operations > Clients > Onboard client; Compliance > Client Due Diligence', middleware: clientRead, response: { success: true, data: { client: { kycStatus: 'complete', riskRating: 'normal' }, signatories: [], beneficialOwners: [] } },
  handler: async (req, res) => ok(res, await kyc.profile(req.params.id)) });

const signatoryBody = z.object({ fullName: z.string().trim().min(2).max(200), position: z.string().max(120).optional().nullable(), nationality: z.string().max(80).optional().nullable(),
  birthDate: optDate, idType: z.string().max(80).optional().nullable(), idNumber: z.string().max(60).optional().nullable(),
  authorityDocument: z.enum(['board-resolution', 'secretary-certificate', 'partnership-resolution', 'special-power-of-attorney', 'other']).optional(),
  authorityReference: z.string().max(120).optional().nullable(), authorityDate: optDate, authorityValidUntil: optDate, signingLimit: z.number().min(0).nullable().optional(),
  status: z.enum(['active', 'revoked']).optional() });
const ownerBody = z.object({ fullName: z.string().trim().min(2).max(200), nationality: z.string().max(80).optional().nullable(), birthDate: optDate,
  ownershipPercent: z.number().min(0).max(100).nullable().optional(), controlType: z.enum(['ownership', 'control', 'senior-management']).optional(),
  idType: z.string().max(80).optional().nullable(), idNumber: z.string().max(60).optional().nullable(), address: z.string().max(500).optional().nullable(),
  isPep: z.boolean().optional(), pepDetails: z.string().max(500).optional().nullable(), status: z.enum(['active', 'removed']).optional() });

const after = async (req, clientId) => {
  // a change of owners or signatories: rescreen them and recompute the rating and status
  await scr.screenClient(clientId, { event: 'onboarding', referenceType: 'client', referenceId: clientId, userId: req.user.id, quiet: true });
  await risk.assessClient({ query }, clientId, { trigger: 'manual', userId: req.user.id, reference: 'Signatories or beneficial owners changed' });
};
for (const [kind, path, body, save, entity] of [['signatory', 'signatories', signatoryBody, kyc.saveSignatory, 'client_signatory'], ['beneficial owner', 'beneficial-owners', ownerBody, kyc.saveOwner, 'client_beneficial_owner']]) {
  define({ method: 'POST', path: `/clients/:id/${path}`, summary: `Add a ${kind} of a juridical client (screened at once)`, screen: 'Operations > Clients > Onboard client (juridical)',
    middleware: [...clientWrite, validate(body)], request: kind === 'signatory' ? { fullName: 'Maria Reyes', position: 'Treasurer', authorityDocument: 'secretary-certificate', authorityDate: '2026-09-01' }
      : { fullName: 'Jose Tan', ownershipPercent: 40, controlType: 'ownership', nationality: 'Filipino' }, response: { success: true },
    handler: async (req, res) => {
      const r = await save(req.params.id, null, req.body, req.user.id);
      await audit(req, { entity, entityId: r.after.id, action: 'create', after: r.after });
      await after(req, r.clientId);
      created(res, r.after, `${kind[0].toUpperCase()}${kind.slice(1)} added`);
    } });
  define({ method: 'PUT', path: `/clients/:id/${path}/:rowId`, summary: `Change or ${kind === 'signatory' ? 'revoke' : 'remove'} a ${kind}`, screen: 'Operations > Clients > Onboard client (juridical)',
    middleware: [...clientWrite, validate(body.partial())], request: { status: kind === 'signatory' ? 'revoked' : 'removed' }, response: { success: true },
    handler: async (req, res) => {
      const r = await save(req.params.id, req.params.rowId, req.body, req.user.id);
      await audit(req, { entity, entityId: req.params.rowId, action: 'update', before: r.before, after: r.after });
      await after(req, r.clientId);
      ok(res, r.after, `${kind[0].toUpperCase()}${kind.slice(1)} saved`);
    } });
}

define({ method: 'POST', path: '/clients/:id/documents', summary: 'Upload a KYC document (multipart: file, docType, relatedType client | signatory | beneficial-owner | edd, relatedId, description, expiryDate)',
  screen: 'Operations > Clients > Onboard client; Compliance > EDD Reviews', middleware: [...clientWrite, docUpload],
  request: { file: '<binary>', docType: 'board-resolution', relatedType: 'signatory', relatedId: 'sig_1' }, response: { success: true, data: { id: 1, docType: 'board-resolution', fileName: 'resolution.pdf' } },
  handler: async (req, res) => {
    const d = await kyc.addDocument(req.params.id, req.file, req.body || {}, req.user);
    await audit(req, { entity: 'client_kyc_document', entityId: d.id, action: 'upload', after: { ...d, url: undefined } });
    created(res, d, 'Document uploaded');
  } });

define({ method: 'POST', path: '/clients/:id/assess', summary: 'Rate the client again from its current record and policies', screen: `${SCREEN} > Client Due Diligence`, middleware: clientWrite,
  response: { success: true, data: { rating: 'normal', score: 4, factors: [] } },
  handler: async (req, res) => {
    const c = await kyc.clientRow(req.params.id);
    const a = await risk.assessClient({ query }, c.id, { trigger: 'manual', userId: req.user.id });
    await audit(req, { entity: 'client', entityId: c.id, action: 'aml-assess', after: { rating: a.rating, score: a.score } });
    ok(res, a, `Rated ${a.rating}`);
  } });
define({ method: 'POST', path: '/clients/:id/override', summary: 'Compliance officer sets the risk rating (holds until the next KYC refresh)', screen: `${SCREEN} > Client Due Diligence`,
  middleware: [...approve, validate(z.object({ rating: z.enum(['low', 'normal', 'high']), reason }))], request: { rating: 'high', reason: 'Adverse media on the beneficial owner' }, response: { success: true },
  handler: async (req, res) => {
    const c = await kyc.clientRow(req.params.id);
    const a = await risk.assessClient({ query }, c.id, { override: req.body, userId: req.user.id });
    await audit(req, { entity: 'client', entityId: c.id, action: 'aml-override', before: { rating: c.risk_rating }, after: { rating: a.rating, reason: req.body.reason } });
    ok(res, a, `Rating set to ${a.rating}`);
  } });
define({ method: 'POST', path: '/clients/:id/screen', summary: 'Screen the client, its beneficial owners and signatories now', screen: `${SCREEN} > Client Due Diligence`, middleware: clientWrite,
  response: { success: true, data: { screenings: 2, hits: 0, openHits: 0 } },
  handler: async (req, res) => {
    const c = await kyc.clientRow(req.params.id);
    const r = await scr.screenClient(c.id, { event: 'manual', referenceType: 'client', referenceId: c.id, userId: req.user.id });
    await risk.refreshKycStatus({ query }, c.id);
    await audit(req, { entity: 'client', entityId: c.id, action: 'aml-screen', after: r });
    ok(res, r, r.openHits ? `${r.openHits} potential match(es) queued for the compliance officer` : 'No match');
  } });

// ---------------------------------------------------------------- KYC refresh and EDD

define({ method: 'GET', path: '/kyc-refresh', summary: 'Clients due for KYC refresh (within aml.kyc_refresh_notice_days, or overdue); filter rating, overdue', screen: `${SCREEN} > KYC Refresh`, middleware: read,
  response: { success: true, data: [{ clientId: 'cl_1', riskRating: 'high', nextReviewOn: '2026-10-15', overdue: false }] }, handler: async (req, res) => ok(res, await risk.refreshDue(req.query)) });
define({ method: 'POST', path: '/clients/:id/kyc-refresh', summary: 'Record a completed KYC refresh: the client is rated again and the next refresh date set', screen: `${SCREEN} > KYC Refresh`,
  middleware: [...write, validate(z.object({ notes: z.string().max(1000).optional() }))], request: { notes: 'ID and address confirmed by e-mail' }, response: { success: true },
  handler: async (req, res) => {
    const a = await risk.completeRefresh(req.params.id, req.body.notes, req.user.id);
    await audit(req, { entity: 'client', entityId: a.clientId, action: 'kyc-refresh', after: { rating: a.rating, nextReviewOn: a.nextReviewOn, notes: req.body.notes || null } });
    ok(res, a, `KYC refreshed; next refresh ${a.nextReviewOn}`);
  } });

define({ method: 'GET', path: '/edd-reviews', summary: 'EDD reviews (filter status, clientId, search)', screen: `${SCREEN} > EDD Reviews`, middleware: clientRead,
  response: { success: true, data: [{ id: 'edd_1', reviewNumber: 'EDD-2026-00001', status: 'submitted' }] }, handler: async (req, res) => ok(res, await risk.listEdd(req.query)) });
define({ method: 'GET', path: '/edd-reviews/:id', summary: 'One EDD review with its documents', screen: `${SCREEN} > EDD Reviews`, middleware: clientRead,
  response: { success: true, data: { id: 'edd_1', documents: [] } }, handler: async (req, res) => ok(res, await risk.getEdd(req.params.id)) });
define({ method: 'POST', path: '/edd-reviews', summary: 'Open an EDD review for a client (opened automatically when a client is rated High)', screen: `${SCREEN} > EDD Reviews`,
  middleware: [...write, validate(z.object({ clientId: z.string().min(1), reason }))], request: { clientId: 'cl_1', reason: 'Large single premium paid in cash' }, response: { success: true },
  handler: async (req, res) => {
    const c = await kyc.clientRow(req.body.clientId);
    const e = await risk.openEdd({ query }, c.id, req.body.reason, req.user.id);
    await audit(req, { entity: 'aml_edd_review', entityId: e.id, action: 'create', after: e });
    created(res, await risk.getEdd(e.id), 'EDD review opened');
  } });
define({ method: 'PUT', path: '/edd-reviews/:id', summary: 'Record the EDD findings (source of wealth and funds, purpose, findings, senior management approval)', screen: `${SCREEN} > EDD Reviews`,
  middleware: [...clientWrite, validate(z.object({ sourceOfWealth: z.string().max(2000).optional(), sourceOfFunds: z.string().max(2000).optional(), purpose: z.string().max(2000).optional(),
    findings: z.string().max(5000).optional(), seniorManagementApproval: z.boolean().optional() }))],
  request: { sourceOfWealth: 'Family business (rice trading)', sourceOfFunds: 'Business income', purpose: 'Fleet insurance', findings: 'Documents seen' }, response: { success: true },
  handler: async (req, res) => {
    const r = await risk.updateEdd(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'aml_edd_review', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'EDD review saved');
  } });
define({ method: 'POST', path: '/edd-reviews/:id/submit', summary: 'Submit the EDD review to the compliance officer', screen: `${SCREEN} > EDD Reviews`, middleware: clientWrite, response: { success: true },
  handler: async (req, res) => {
    const e = await risk.submitEdd(req.params.id, req.user.id);
    await audit(req, { entity: 'aml_edd_review', entityId: e.id, action: 'submit', after: { status: e.status } });
    ok(res, e, 'EDD review submitted for approval');
  } });
define({ method: 'POST', path: '/edd-reviews/:id/decide', summary: 'Approve or reject an EDD review (compliance officer, not the preparer)', screen: `${SCREEN} > EDD Reviews`,
  middleware: [...approve, validate(z.object({ decision: z.enum(['approve', 'reject']), notes: z.string().max(2000).optional() }))], request: { decision: 'approve', notes: 'Source of funds documented' }, response: { success: true },
  handler: async (req, res) => {
    const e = await risk.decideEdd(req.params.id, req.body, req.user);
    await audit(req, { entity: 'aml_edd_review', entityId: e.id, action: req.body.decision, after: { status: e.status, notes: e.decisionNotes } });
    ok(res, e, `EDD review ${e.status}`);
  } });

// ---------------------------------------------------------------- screening lists and hits

define({ method: 'GET', path: '/lists', summary: 'Screening lists with their current version', screen: `${SCREEN} > Screening Lists`, middleware: read,
  response: { success: true, data: [{ id: 1, code: 'UNSC', name: 'UN Security Council Consolidated List', versionNo: 3, entries: 1000 }] }, handler: async (_req, res) => ok(res, await scr.listLists()) });
define({ method: 'POST', path: '/lists', summary: 'Add a screening list', screen: `${SCREEN} > Screening Lists`,
  middleware: [...write, validate(z.object({ code: z.string().regex(/^[A-Za-z0-9_-]{2,30}$/), name: z.string().trim().min(3).max(200), listType: z.enum(['sanctions', 'designation', 'pep', 'negative', 'other']),
    source: z.string().max(200).optional(), description: z.string().max(1000).optional() }))], request: { code: 'OFAC', name: 'OFAC SDN list', listType: 'sanctions', source: 'US Treasury' }, response: { success: true },
  handler: async (req, res) => { const r = await scr.saveList(null, req.body, req.user.id); await audit(req, { entity: 'aml_screening_list', entityId: r.after.id, action: 'create', after: r.after }); created(res, r.after, 'List added'); } });
define({ method: 'PUT', path: '/lists/:id', summary: 'Rename a list or switch it on or off', screen: `${SCREEN} > Screening Lists`,
  middleware: [...write, validate(z.object({ name: z.string().trim().min(3).max(200).optional(), description: z.string().max(1000).optional(), source: z.string().max(200).optional(), active: z.boolean().optional() }))],
  request: { active: false }, response: { success: true },
  handler: async (req, res) => { const r = await scr.saveList(req.params.id, req.body, req.user.id); await audit(req, { entity: 'aml_screening_list', entityId: req.params.id, action: 'update', before: r.before, after: r.after }); ok(res, r.after, 'List saved'); } });
define({ method: 'GET', path: '/lists/:id/versions', summary: 'Versions of a list with the rescreen result of each', screen: `${SCREEN} > Screening Lists`, middleware: read,
  response: { success: true, data: [{ id: 1, versionNo: 1, entries: 1000, current: true }] }, handler: async (req, res) => ok(res, await scr.listVersions(req.params.id)) });
define({ method: 'GET', path: '/lists/:id/entries', summary: 'Entries of the current (or a given) version of a list; search by name', screen: `${SCREEN} > Screening Lists`, middleware: read,
  query: { search: 'kim', versionId: 1 }, response: { success: true, data: [{ id: 1, fullName: 'Name', aliases: [] }] },
  handler: async (req, res) => ok(res, await scr.listEntries(req.params.id, { search: req.query.search, versionId: req.query.versionId ? Number(req.query.versionId) : null, limit: req.query.limit })) });
define({ method: 'POST', path: '/lists/:id/versions', summary: 'Upload a new version of a list (multipart: file XML / CSV / XLSX, publicationDate, notes, rescreen true | false); rescreens every party', screen: `${SCREEN} > Screening Lists`,
  middleware: [...write, listUpload], request: { file: '<binary>', publicationDate: '2026-10-01' }, response: { success: true, data: { version: { versionNo: 2, entries: 1000 }, rescreen: { clients: 120, newOpenHits: 1 } } },
  handler: async (req, res) => {
    const r = await scr.uploadVersion(req.params.id, req.file, { publicationDate: req.body?.publicationDate, notes: req.body?.notes, rescreen: req.body?.rescreen !== 'false', userId: req.user.id });
    await audit(req, { entity: 'aml_screening_list', entityId: req.params.id, action: 'upload-version', after: { versionNo: r.version.versionNo, entries: r.version.entries, checksum: r.version.checksum, rescreen: r.rescreen } });
    created(res, r, `Version ${r.version.versionNo} loaded with ${r.version.entries} entries`);
  } });
define({ method: 'POST', path: '/lists/:id/entries', summary: 'Add an entry on screen (internal negative list): a new version, then a rescreen', screen: `${SCREEN} > Screening Lists`,
  middleware: [...write, validate(z.object({ fullName: z.string().trim().min(2).max(300), aliases: z.array(z.string().max(300)).optional(), entityType: z.enum(['individual', 'entity']).optional(),
    birthDate: z.string().max(20).optional().nullable(), nationality: z.string().max(80).optional().nullable(), entryRef: z.string().max(60).optional().nullable(), remarks: z.string().max(500).optional().nullable(), reason: z.string().max(500).optional() }))],
  request: { fullName: 'Juan Example', reason: 'Fraudulent claim 2025' }, response: { success: true },
  handler: async (req, res) => {
    const r = await scr.addEntry(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'aml_screening_list', entityId: req.params.id, action: 'add-entry', after: { fullName: req.body.fullName, versionNo: r.version.versionNo, rescreen: r.rescreen } });
    created(res, r, 'Entry added');
  } });
define({ method: 'DELETE', path: '/lists/:id/entries/:entryId', summary: 'Remove an entry on screen (a new version without it); reason required', screen: `${SCREEN} > Screening Lists`,
  middleware: [...write, validate(z.object({ reason }), 'query')], query: { reason: 'Entered in error' }, response: { success: true },
  handler: async (req, res) => {
    const r = await scr.removeEntry(req.params.id, req.params.entryId, req.query.reason, req.user.id);
    await audit(req, { entity: 'aml_screening_list', entityId: req.params.id, action: 'remove-entry', before: r.removed, after: { versionNo: r.version.versionNo, reason: req.query.reason } });
    ok(res, r, 'Entry removed');
  } });
define({ method: 'POST', path: '/rescreen', summary: 'Rescreen every client, beneficial owner and signatory against the current lists', screen: `${SCREEN} > Screening Lists`, middleware: write,
  response: { success: true, data: { clients: 120, parties: 140, hits: 2, newOpenHits: 1 } },
  handler: async (req, res) => { const r = await scr.rescreenAll({ userId: req.user.id }); await audit(req, { entity: 'aml_screening', entityId: null, action: 'rescreen-all', after: r }); ok(res, r, 'Rescreen complete'); } });
define({ method: 'POST', path: '/screen', summary: 'Screen a name that is not a client yet (prospect, payee); recorded as a manual screening', screen: `${SCREEN} > Screening Hits`,
  middleware: [...write, validate(z.object({ name: z.string().trim().min(2).max(300), birthDate: z.string().max(20).optional(), entityType: z.enum(['individual', 'entity']).optional() }))],
  request: { name: 'Juan Dela Cruz' }, response: { success: true, data: { status: 'clear', hits: 0 } },
  handler: async (req, res) => {
    const r = await scr.screenParty({ partyType: 'payee', name: req.body.name, birthDate: req.body.birthDate, entityType: req.body.entityType }, { event: 'manual', userId: req.user.id });
    await audit(req, { entity: 'aml_screening', entityId: r?.id, action: 'screen-name', after: { name: req.body.name, ...r } });
    ok(res, r, r?.hits ? `${r.hits} potential match(es)` : 'No match');
  } });
define({ method: 'GET', path: '/hits', summary: 'Screening hits queue (filter status open | escalated | cleared | confirmed, clientId, listCode, search)', screen: `${SCREEN} > Screening Hits`, middleware: read,
  query: { status: 'open' }, response: { success: true, data: [{ id: 1, partyName: 'Juan Dela Cruz', matchedName: 'JUAN DELA CRUZ', listCode: 'PEP', score: 1, status: 'open' }] },
  handler: async (req, res) => ok(res, await scr.listHits(req.query)) });
define({ method: 'POST', path: '/hits/:id/decide', summary: 'Decide a hit: clear (false positive), escalate (to a case) or confirm (true match: client blocked and rated High); reason required', screen: `${SCREEN} > Screening Hits`,
  middleware: [...approve, validate(z.object({ decision: z.enum(['clear', 'escalate', 'confirm']), reason, caseId: z.string().optional().nullable() }))],
  request: { decision: 'clear', reason: 'Different date of birth and nationality' }, response: { success: true },
  handler: async (req, res) => {
    const before = await scr.getHit(req.params.id);
    const h = await cases.decideHit(req.params.id, req.body, req.user);
    await audit(req, { entity: 'aml_screening_hit', entityId: h.id, action: req.body.decision, before: { status: before.status }, after: { status: h.status, reason: req.body.reason, caseId: h.caseId } });
    ok(res, h, `Hit ${h.status}`);
  } });

// ---------------------------------------------------------------- screening provider

define({ method: 'GET', path: '/provider', summary: 'Screening provider configuration (no secret: the API key stays in the environment) and outbox counts', screen: `${SCREEN} > Screening Lists > Provider`, middleware: read,
  response: { success: true, data: { provider: 'lists', mode: 'sandbox', apiKeyEnv: 'AML_SCREENING_API_KEY', apiKeySet: false, outbox: { failed: 0 } } },
  handler: async (_req, res) => {
    const cfg = await providerConfig();
    const outbox = Object.fromEntries((await query('SELECT status, count(*) AS n FROM aml_provider_requests GROUP BY 1')).rows.map((r) => [r.status, Number(r.n)]));
    ok(res, { ...cfg, apiKeySet: !!(cfg.apiKeyEnv && process.env[cfg.apiKeyEnv]), outbox });
  } });
define({ method: 'GET', path: '/provider/requests', summary: 'Outbox of the requests to the screening provider (filter status)', screen: `${SCREEN} > Screening Lists > Provider`, middleware: read,
  response: { success: true, data: [{ id: 1, provider: 'http', status: 'failed', attempts: 2 }] }, handler: async (req, res) => ok(res, await listRequests(req.query)) });
define({ method: 'POST', path: '/provider/requests/:id/retry', summary: 'Send a failed or abandoned provider request again', screen: `${SCREEN} > Screening Lists > Provider`, middleware: write, response: { success: true },
  handler: async (req, res) => {
    const r = await retryRequest(Number(req.params.id), { force: true });
    if (!r) throw badRequest('Request not found');
    if (r.ok) await scr.applyProviderMatches(Number(req.params.id));
    await audit(req, { entity: 'aml_provider_request', entityId: req.params.id, action: 'retry', after: { ok: r.ok, error: r.error || null } });
    ok(res, r, r.ok ? 'Provider answered' : `Provider not reached: ${r.error}`);
  } });
define({ method: 'POST', path: '/provider/test', summary: 'Send a test name to the configured provider (sandbox check of the connection)', screen: `${SCREEN} > Screening Lists > Provider`,
  middleware: [...write, validate(z.object({ name: z.string().trim().min(2).max(200).default('TEST NAME') }))], request: { name: 'TEST NAME' }, response: { success: true, data: { ok: true, matches: [] } },
  handler: async (req, res) => {
    const r = await callProvider({ name: req.body.name });
    if (!r) throw badRequest('No screening provider is configured (aml.screening_provider.provider is lists)');
    await audit(req, { entity: 'aml_provider_request', entityId: r.requestId, action: 'test', after: { ok: r.ok, error: r.error || null } });
    ok(res, r, r.ok ? `Provider answered with ${r.matches.length} match(es)` : `Provider not reached: ${r.error}`);
  } });

// ---------------------------------------------------------------- monitoring, alerts, cases, reports

define({ method: 'POST', path: '/monitoring/run', summary: 'Run the covered and suspicious transaction rules over a date range (default the last 3 days)', screen: `${SCREEN} > Transaction Alerts`,
  middleware: [...write, validate(z.object({ from: optDate, to: optDate, days: z.number().int().min(1).max(366).optional() }))], request: { from: '2026-09-01', to: '2026-09-30' },
  response: { success: true, data: { from: '2026-09-01', to: '2026-09-30', added: { CT_CASH: 1 }, total: 1 } },
  handler: async (req, res) => {
    const r = await mon.runMonitoring({ from: req.body.from || null, to: req.body.to || null, days: req.body.days || 3 });
    await audit(req, { entity: 'aml_alert', entityId: null, action: 'run-monitoring', after: r });
    ok(res, r, `${r.total} new alert(s)`);
  } });
define({ method: 'GET', path: '/alerts', summary: 'Transaction alerts (filter status, kind covered | suspicious, ruleCode, clientId, caseId, from, to, search)', screen: `${SCREEN} > Transaction Alerts`, middleware: read,
  query: { status: 'open', kind: 'covered' }, response: { success: true, data: [{ alertNumber: 'AMA-2026-000001', ruleCode: 'CT_CASH', amount: 600000, status: 'open' }] },
  handler: async (req, res) => ok(res, await mon.listAlerts(req.query)) });
define({ method: 'POST', path: '/alerts/:id/close', summary: 'Close a suspicious transaction alert after review (no report); reason required', screen: `${SCREEN} > Transaction Alerts`,
  middleware: [...write, validate(z.object({ reason }))], request: { reason: 'Refund to the parent of the insured student, documented' }, response: { success: true },
  handler: async (req, res) => {
    const r = await mon.closeAlert(req.params.id, req.body.reason, req.user.id);
    await audit(req, { entity: 'aml_alert', entityId: r.after.id, action: 'close', before: { status: r.before.status }, after: { status: r.after.status, reason: req.body.reason } });
    ok(res, r.after, 'Alert closed');
  } });

const caseBody = z.object({ caseType: z.enum(['CTR', 'STR', 'review']), clientId: z.string().optional().nullable(), title: z.string().trim().min(3).max(300).optional(), narrative: z.string().max(20000).optional(),
  suspicionReasons: z.array(z.enum(cases.SUSPICION_REASONS)).optional(), suspicionOn: optDate, assignedTo: z.string().optional().nullable(), alertIds: z.array(z.string()).optional(), hitIds: z.array(z.number().int()).optional() });
define({ method: 'GET', path: '/cases', summary: 'AML cases (filter status, caseType, clientId, search)', screen: `${SCREEN} > AML Cases`, middleware: read,
  response: { success: true, data: [{ caseNumber: 'AMC-2026-00001', caseType: 'STR', status: 'open', dueOn: '2026-10-05' }] }, handler: async (req, res) => ok(res, await cases.listCases(req.query)) });
define({ method: 'GET', path: '/cases/:id', summary: 'One case with its alerts, hits and report files', screen: `${SCREEN} > AML Cases`, middleware: read,
  response: { success: true, data: { caseNumber: 'AMC-2026-00001', alertList: [], hitList: [], reports: [] } }, handler: async (req, res) => ok(res, await cases.getCase(req.params.id)) });
define({ method: 'POST', path: '/cases', summary: 'Open a case (CTR, STR or review), optionally from alerts and hits', screen: `${SCREEN} > AML Cases`, middleware: [...write, validate(caseBody)],
  request: { caseType: 'STR', alertIds: ['aal_1'], title: 'Refund to third party after early cancellation', suspicionReasons: ['no-underlying-legal-or-trade-obligation'] }, response: { success: true },
  handler: async (req, res) => { const c = await cases.createCase(req.body, req.user.id); await audit(req, { entity: 'aml_case', entityId: c.id, action: 'create', after: { caseNumber: c.caseNumber, caseType: c.caseType, alerts: req.body.alertIds || [] } }); created(res, c, `Case ${c.caseNumber} opened`); } });
define({ method: 'PUT', path: '/cases/:id', summary: 'Change a case: title, narrative, grounds of suspicion, date suspicion was established, assignee', screen: `${SCREEN} > AML Cases`,
  middleware: [...write, validate(caseBody.omit({ caseType: true, alertIds: true, hitIds: true, clientId: true }))], request: { narrative: 'On 2 October 2026 ...' }, response: { success: true },
  handler: async (req, res) => { const r = await cases.updateCase(req.params.id, req.body, req.user.id); await audit(req, { entity: 'aml_case', entityId: r.after.id, action: 'update', before: { narrative: r.before.narrative, status: r.before.status }, after: { narrative: r.after.narrative, status: r.after.status } }); ok(res, r.after, 'Case saved'); } });
define({ method: 'POST', path: '/cases/:id/alerts', summary: 'Add open alerts to a case', screen: `${SCREEN} > AML Cases`, middleware: [...write, validate(z.object({ alertIds: z.array(z.string()).min(1) }))],
  request: { alertIds: ['aal_2'] }, response: { success: true },
  handler: async (req, res) => { const c = await cases.addAlerts(req.params.id, req.body.alertIds, req.user.id); await audit(req, { entity: 'aml_case', entityId: c.id, action: 'add-alerts', after: { alertIds: req.body.alertIds } }); ok(res, c, 'Alerts added'); } });
define({ method: 'POST', path: '/cases/:id/approve', summary: 'Approve the case for filing with the AMLC (compliance officer)', screen: `${SCREEN} > AML Cases`, middleware: approve, response: { success: true },
  handler: async (req, res) => { const c = await cases.approveCase(req.params.id, req.user); await audit(req, { entity: 'aml_case', entityId: c.id, action: 'approve', after: { status: c.status } }); ok(res, c, 'Case approved for filing'); } });
define({ method: 'POST', path: '/cases/:id/close', summary: 'Close a case without a report; reason required', screen: `${SCREEN} > AML Cases`, middleware: [...approve, validate(z.object({ reason }))],
  request: { reason: 'Transactions explained by documents on file' }, response: { success: true },
  handler: async (req, res) => { const c = await cases.closeCase(req.params.id, req.body.reason, req.user.id); await audit(req, { entity: 'aml_case', entityId: c.id, action: 'close', after: { status: c.status, reason: req.body.reason } }); ok(res, c, 'Case closed'); } });
define({ method: 'POST', path: '/cases/:id/report', summary: 'Generate the STR (or CTR) file of an approved case', screen: `${SCREEN} > AML Cases`, middleware: write, response: { success: true, data: { reportNumber: 'AMR-2026-00001', reportType: 'STR' } },
  handler: async (req, res) => { const r = await rep.generateForCase(req.params.id, req.user.id); await audit(req, { entity: 'aml_report', entityId: r.id, action: 'generate', after: { reportNumber: r.reportNumber, caseId: r.caseId } }); created(res, r, `Report ${r.reportNumber} generated`); } });

define({ method: 'GET', path: '/reports', summary: 'AMLC report files (filter reportType CTR | STR, status)', screen: `${SCREEN} > AMLC Reports`, middleware: read,
  response: { success: true, data: [{ reportNumber: 'AMR-2026-00001', reportType: 'CTR', transactions: 3, status: 'generated' }] }, handler: async (req, res) => ok(res, await rep.listReports(req.query)) });
define({ method: 'POST', path: '/reports/ctr', summary: 'Generate the CTR file of the covered transactions of a period not yet reported', screen: `${SCREEN} > AMLC Reports`,
  middleware: [...write, validate(z.object({ from: dayString, to: dayString }))], request: { from: '2026-09-01', to: '2026-09-30' }, response: { success: true },
  handler: async (req, res) => { const r = await rep.generateCtr(req.body, req.user.id); await audit(req, { entity: 'aml_report', entityId: r.id, action: 'generate', after: { reportNumber: r.reportNumber, from: r.periodFrom, to: r.periodTo, transactions: r.transactions } }); created(res, r, `CTR file ${r.reportNumber} generated with ${r.transactions} transaction(s)`); } });
define({ method: 'GET', path: '/reports/:id/download', summary: 'Download the report file (text, AMLC reporting layout, format version in the header)', screen: `${SCREEN} > AMLC Reports`, middleware: read,
  response: 'H|...|CTR|AMR-2026-00001|...',
  handler: async (req, res) => {
    const r = await rep.getReport(req.params.id, { withContent: true });
    await audit(req, { entity: 'aml_report', entityId: r.id, action: 'download' });
    res.set('Content-Type', 'text/plain; charset=utf-8').set('Content-Disposition', `attachment; filename="${r.fileName}"`).send(r.content);
  } });
define({ method: 'POST', path: '/reports/:id/submit', summary: 'Record the filing in the AMLC portal: date, AMLC reference, status submitted | acknowledged | rejected', screen: `${SCREEN} > AMLC Reports`,
  middleware: [...approve, validate(z.object({ submittedOn: optDate, amlcReference: z.string().max(120).optional(), notes: z.string().max(2000).optional(), status: z.enum(['submitted', 'acknowledged', 'rejected']).optional() }))],
  request: { submittedOn: '2026-10-05', amlcReference: 'ACK-123456' }, response: { success: true },
  handler: async (req, res) => { const r = await rep.markSubmitted(req.params.id, req.body, req.user.id); await audit(req, { entity: 'aml_report', entityId: r.id, action: `mark-${r.status}`, after: { status: r.status, amlcReference: r.amlcReference, submittedOn: r.submittedOn } }); ok(res, r, `Report ${r.status}`); } });

export default router;
export const mount = '/aml';
