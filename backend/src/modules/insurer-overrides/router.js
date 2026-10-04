/**
 * Overriding, profit and contingent commission from insurers (/insurer-overrides): agreements per insurer with their
 * tiers, computations per period from production and claims, approval (maker-checker) posting the receivable, and
 * settlement against the insurer's statement. Permissions: read:commission to view, write:commission to maintain,
 * compute, approve (another user) and settle.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { writeXlsx } from '../../lib/xlsx.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Insurer Overriding Commission', '/insurer-overrides');
const read = [requireAuth, requirePermission('read:commission')];
const write = [requireAuth, requirePermission('write:commission')];
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

const tier = z.object({ fromValue: z.coerce.number(), toValue: z.preprocess((v) => (v === '' || v === undefined || v === null ? null : Number(v)), z.number().nullable()).optional(),
  rate: z.coerce.number().min(0).max(100) });
const agreementSchema = z.object({
  agreementCode: z.string().regex(/^[A-Z0-9-]{2,30}$/, 'agreementCode: 2 to 30 capital letters, digits or dashes'), name: z.string().min(3).max(200), insurerId: z.coerce.number().int(),
  commissionType: z.enum(svc.TYPES).optional(), basis: z.enum(svc.BASES).optional(), periodType: z.enum(svc.PERIOD_TYPES).optional(),
  premiumMeasure: z.enum(['net_premium', 'gross_premium']).optional(), tierMethod: z.enum(['slab', 'banded']).optional(), linesOfBusiness: z.array(z.string().max(40)).max(30).optional(),
  minProduction: z.coerce.number().min(0).optional(), vatApplicable: z.boolean().optional(), ewtRate: z.coerce.number().min(0).max(50).optional(),
  effectiveFrom: dateField, effectiveTo: dateField.nullable().optional(), status: z.enum(['draft', 'active', 'inactive']).optional(), remarks: z.string().max(500).optional(),
  tiers: z.array(tier).min(1).max(20),
});
const agreementExample = { id: 'ova_1a2b', agreementCode: 'MAL-OVR-2026', name: 'Malayan production override 2026', insurerName: 'Malayan Insurance Co., Inc.', basis: 'production', periodType: 'quarterly',
  tiers: [{ tierNo: 1, fromValue: 0, toValue: 1000000, rate: 1 }, { tierNo: 2, fromValue: 1000000, toValue: null, rate: 2 }] };
const compExample = { id: 'ovc_1a2b', computationNumber: 'OVC-2026-00001', periodLabel: '2026-Q3', production: 1250000, rate: 2, commission: 25000, vat: 3000, receivable: 28000, status: 'draft' };

define({
  method: 'GET', path: '/agreements', summary: 'Overriding / profit / contingent commission agreements with insurers (filter status, insurerId)', screen: 'Commission > Insurer Overrides > Agreements',
  middleware: read, response: { success: true, data: [agreementExample] }, handler: async (req, res) => ok(res, await svc.listAgreements(pool, req.query)),
});
define({
  method: 'GET', path: '/agreements/:id', summary: 'One agreement with its tiers', screen: 'Commission > Insurer Overrides > Agreements', middleware: read,
  response: { success: true, data: agreementExample }, handler: async (req, res) => ok(res, await svc.getAgreement(pool, req.params.id)),
});
define({
  method: 'POST', path: '/agreements', summary: 'Create an agreement: insurer, type, basis (production, loss ratio, growth), period, lines of business, tiers', screen: 'Commission > Insurer Overrides > Agreements',
  middleware: [...write, validate(agreementSchema)], request: { agreementCode: 'MAL-OVR-2026', name: 'Malayan production override 2026', insurerId: 1, basis: 'production', periodType: 'quarterly', effectiveFrom: '2026-01-01',
    tiers: [{ fromValue: 0, toValue: 1000000, rate: 1 }, { fromValue: 1000000, toValue: null, rate: 2 }] },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.saveAgreement(db, null, req.body, req.user));
    await audit(req, { entity: 'override_agreement', entityId: r.after.agreementCode, action: 'create', after: r.after });
    created(res, r.after);
  },
});
define({
  method: 'PUT', path: '/agreements/:id', summary: 'Update an agreement and its tiers', screen: 'Commission > Insurer Overrides > Agreements',
  middleware: [...write, validate(agreementSchema.partial())], request: { status: 'inactive' },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.saveAgreement(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'override_agreement', entityId: r.after.agreementCode, action: 'update', before: r.before, after: r.after });
    ok(res, r.after);
  },
});
define({
  method: 'GET', path: '/agreements/:id/periods', summary: 'Periods of an agreement in a year with the computation of each (if any)', screen: 'Commission > Insurer Overrides > Computations',
  middleware: [...read, validate(z.object({ year: z.coerce.number().int().min(2000).max(2100) }), 'query')], query: { year: 2026 },
  handler: async (req, res) => {
    const ag = await svc.getAgreement(pool, req.params.id);
    const comps = await svc.listComputations(pool, { agreementId: ag.id, year: req.query.year });
    ok(res, svc.periodsOf(ag.periodType, req.query.year).map((p) => ({ ...p, computation: comps.find((c) => c.periodFrom === p.from && !['rejected', 'cancelled'].includes(c.status)) || null })));
  },
});
define({
  method: 'GET', path: '/agreements/:id/preview', summary: 'Figures of an agreement for a period without saving (production, claims, loss ratio, growth, tier, commission)', screen: 'Commission > Insurer Overrides > Computations',
  middleware: [...read, validate(z.object({ year: z.coerce.number().int(), periodLabel: z.string().max(10), claimsIncurred: z.coerce.number().min(0).optional() }), 'query')], query: { year: 2026, periodLabel: '2026-Q3' },
  handler: async (req, res) => {
    const ag = await svc.getAgreement(pool, req.params.id);
    const p = svc.periodsOf(ag.periodType, req.query.year).find((x) => x.label === req.query.periodLabel);
    if (!p) return res.status(400).json({ success: false, message: `Period ${req.query.periodLabel} is not a period of the agreement` });
    return ok(res, { period: p, ...(await svc.evaluate(pool, ag, p, { claimsOverride: req.query.claimsIncurred ?? null })) });
  },
});

define({
  method: 'GET', path: '/computations', summary: 'Computations (filter status, agreementId, insurerId, year)', screen: 'Commission > Insurer Overrides > Computations', middleware: read,
  response: { success: true, data: [compExample] }, handler: async (req, res) => ok(res, await svc.listComputations(pool, req.query)),
});
define({
  method: 'GET', path: '/computations/export', summary: 'Excel of the computations of a year', screen: 'Commission > Insurer Overrides > Computations', middleware: read, query: { year: 2026 },
  handler: async (req, res) => {
    const rows = await svc.listComputations(pool, req.query);
    const cols = [['computationNumber', 'Computation'], ['insurerName', 'Insurer'], ['agreementCode', 'Agreement'], ['commissionType', 'Type'], ['basis', 'Basis'], ['periodLabel', 'Period'],
      ['production', 'Production', 'money'], ['claimsIncurred', 'Claims incurred', 'money'], ['lossRatioPct', 'Loss ratio %', 'number'], ['growthPct', 'Growth %', 'number'], ['rate', 'Rate %', 'number'],
      ['commission', 'Commission', 'money'], ['vat', 'VAT', 'money'], ['receivable', 'Receivable', 'money'], ['settled', 'Settled', 'money'], ['balance', 'Balance', 'money'], ['status', 'Status']];
    const buf = writeXlsx({ title: 'Overriding commission', sheets: [{ name: 'Computations', columns: cols.map(([key, header, type]) => ({ key, header, type: type || 'text', width: type ? 16 : 22 })), rows }] });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="overriding-commission.xlsx"');
    res.send(buf);
  },
});
define({
  method: 'GET', path: '/computations/:id', summary: 'One computation with its settlements', screen: 'Commission > Insurer Overrides > Computations', middleware: read,
  response: { success: true, data: compExample }, handler: async (req, res) => ok(res, await svc.getComputation(pool, req.params.id)),
});
define({
  method: 'POST', path: '/agreements/:id/compute', summary: 'Compute (or recompute a draft) the commission of an agreement for a period; claimsIncurred replaces the system figure with the insurer\'s',
  screen: 'Commission > Insurer Overrides > Computations', middleware: [...write, validate(z.object({ year: z.coerce.number().int().min(2000).max(2100), periodLabel: z.string().max(10),
    claimsIncurred: z.coerce.number().min(0).nullable().optional(), claimsNote: z.string().max(300).optional(), remarks: z.string().max(500).optional() }))],
  request: { year: 2026, periodLabel: '2026-Q3' }, response: { success: true, data: compExample },
  handler: async (req, res) => {
    const c = await withTransaction((db) => svc.compute(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'override_computation', entityId: c.computationNumber, action: 'run', after: { production: c.production, commission: c.commission, receivable: c.receivable } });
    created(res, c);
  },
});
const action = (path, summary, fn, act, schema = null) => define({
  method: 'POST', path, summary, screen: 'Commission > Insurer Overrides > Computations', middleware: [...write, ...(schema ? [validate(schema)] : [])],
  handler: async (req, res) => {
    const c = await withTransaction((db) => fn(db, req.params.id, req.body || {}, req.user));
    await audit(req, { entity: 'override_computation', entityId: c.computationNumber || c.computation?.computationNumber, action: act, after: { status: c.status || c.computation?.status, ...(req.body || {}) } });
    ok(res, c);
  },
});
action('/computations/:id/submit', 'Submit a draft computation for approval', (db, id, _b, u) => svc.submit(db, id, u), 'submit');
action('/computations/:id/approve', 'Approve a computation (not its preparer): posts the receivable, commission income and output VAT (override_commission.accrual)',
  (db, id, b, u) => svc.approve(db, id, u, { postingDate: b.postingDate || null }), 'approve', z.object({ postingDate: dateField.optional() }));
action('/computations/:id/reject', 'Reject a submitted computation with a reason', (db, id, b, u) => svc.reject(db, id, b.reason, u), 'reject', z.object({ reason: z.string().min(3).max(300) }));
action('/computations/:id/cancel', 'Cancel a computation (an approved one without settlements has its journal reversed)', (db, id, b, u) => svc.cancel(db, id, b.reason, u), 'cancel',
  z.object({ reason: z.string().min(3).max(300) }));
action('/computations/:id/settlements', 'Settle against the insurer\'s statement: cash, creditable tax withheld (2307), difference left open or taken to income (override_commission.settlement)',
  (db, id, b, u) => svc.settle(db, id, b, u), 'settle', z.object({ statementReference: z.string().min(2).max(60), statementDate: dateField.optional(), statementAmount: z.coerce.number().min(0).optional(),
    cashReceived: z.coerce.number().min(0), ewtWithheld: z.coerce.number().min(0).optional(), form2307No: z.string().max(40).optional(), differenceTreatment: z.enum(['leave_open', 'adjust_income']).optional(),
    bankAccount: z.string().max(40).optional(), paymentMode: z.string().max(30).optional(), remarks: z.string().max(300).optional() }));

export default router;
export const mount = '/insurer-overrides';
