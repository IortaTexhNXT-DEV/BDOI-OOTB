/**
 * Promotions API (/promotions, Operations > Sales & Marketing > Promotions) and discount caps API (/discount-caps,
 * Master > Finance > Discount Caps): TIS-BRD-PROD-15.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { pool } from '../../db/pool.js';
import * as svc from './service.js';
import * as caps from './caps.js';
import { openPromotions } from './quote.js';

const { router, define } = moduleRouter('Promotions', '/promotions');
const cap = moduleRouter('Discount caps', '/discount-caps');
const SCREEN = 'Operations > Sales & Marketing > Promotions';
const CAP_SCREEN = 'Master > Finance > Discount Caps';
const canRead = [requireAuth, requirePermission('read:promotions', 'write:promotions', 'approve:promotions')];
const canWrite = [requireAuth, requirePermission('write:promotions')];
const canApprove = [requireAuth, requirePermission('approve:promotions')];
const reason = validate(z.object({ reasonCode: z.string().min(1).max(40), note: z.string().max(2000).optional().nullable() }));

const rate = z.union([z.null(), z.coerce.number()]).optional();
const line = z.object({ variantId: z.coerce.number().int(), yearFrom: z.coerce.number().int(), yearTo: z.coerce.number().int().optional(), fmvFrom: rate, fmvTo: rate,
  insurerId: z.union([z.null(), z.coerce.number().int()]).optional(), promoOd: rate, minOd: rate, promoAon: rate, remitOd: rate, remitAon: rate, discountPct: rate });
const body = z.object({
  code: z.string().max(40).optional(), name: z.string().max(200).optional(), periodFrom: z.string().max(10).optional(), periodTo: z.string().max(10).optional(),
  benefit: z.enum(['rate', 'discount']).optional(), excess: z.record(z.union([z.null(), z.literal(''), z.coerce.number()])).optional(),
  unitQuota: z.union([z.null(), z.literal(''), z.coerce.number()]).optional(), lockInYears: z.union([z.null(), z.literal(''), z.coerce.number()]).optional(),
  productIds: z.array(z.coerce.number().int()).optional(), insurerIds: z.array(z.coerce.number().int()).optional(), channelTypes: z.array(z.string()).optional(),
  combineDealer: z.boolean().optional(), combineDiscount: z.boolean().optional(), notes: z.string().max(2000).optional().nullable(), lines: z.array(line).max(2000).optional(),
});
const lineExample = { lineNo: 1, variantId: 17, brand: 'Toyota', model: 'Fortuner', variant: '2.4 G 4x2 AT', yearFrom: 2026, yearTo: 2027, insurerId: null,
  promoOd: 1.5, minOd: 1.5, promoAon: 0.4, remitOd: 1.3, remitAon: 0.3 };
const example = { id: 'prm_1', code: 'PRM-FORTUNER26', version: 1, name: 'Fortuner launch rate', periodFrom: '2026-10-01', periodTo: '2026-12-31', benefit: 'rate',
  excess: { 2: 2000 }, unitQuota: 500, unitsUsed: 12, lockInYears: null, productIds: [2], insurerIds: [2, 3], channelTypes: ['financing_bank', 'dealer'], combineDealer: false,
  combineDiscount: false, status: 'active', statusLabel: 'Active', lineCount: 1 };
const capExample = { id: 1, productId: 2, productName: 'Motor Vehicle Insurance', channelType: 'financing_bank', channelTypeLabel: 'Financing bank', minPct: 0, maxPct: 25, lowestOd: 1.4,
  effectiveFrom: '2026-10-01', effectiveTo: null, status: 'approved', statusLabel: 'Approved' };

define({
  method: 'GET', path: '/', summary: 'Promotions (filter status, search code or name, activeOn date); superseded versions left out', screen: SCREEN, middleware: canRead,
  query: { status: 'active', search: 'FORTUNER', activeOn: '2026-11-15' }, response: { success: true, data: [example] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listPromotions(req.query) }),
});
define({
  method: 'GET', path: '/choices', summary: 'Choices of the promotion form and of the promotion on a quotation: Motor products, active vehicle variants, channel types, standard rates, rate change reasons',
  screen: SCREEN, middleware: [requireAuth, requirePermission('read:promotions', 'write:promotions', 'write:quotations')],
  response: { success: true, data: { products: [{ value: 2, label: 'Motor Vehicle Insurance' }], variants: [{ value: 17, label: 'Toyota Fortuner 2.4 G 4x2 AT' }],
    channelTypes: [{ value: 'financing_bank', label: 'Financing bank' }], standardRates: { ownDamage: 2, actsOfNature: 0.5 }, rateChangeReasons: ['Fleet account'], maxLockInYears: 3 } },
  handler: async (_req, res) => res.json({ success: true, data: await svc.promotionChoices() }),
});
define({
  method: 'POST', path: '/open', summary: 'Promotions open to a motor quotation document (brand-new vehicle, product, insurer, channel type, variant, year model, FMV, quota), lowest promo Own Damage rate first',
  screen: 'Create Quote > Coverage Details > Promotion', middleware: [requireAuth, requirePermission('read:quotations', 'write:quotations')],
  request: { doc: { productType: 'Motor', insurancePolicyType: 'COMP', vehicleCondition: 'Brand New', lossAndDamageCoverage: 1200000, channelId: 'ch_seed_tfs',
    insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Fortuner', modelVariant: '2.4 G 4x2 AT', modelYear: 2026 }] }, insuranceCompanyId: 2, leadId: 'ld_1' },
  response: { success: true, data: { reason: null, channelType: 'financing_bank', promotions: [{ code: 'PRM-FORTUNER26', version: 1, name: 'Fortuner launch rate', promoOd: 1.5, minOd: 1.5, promoAon: 0.4 }] } },
  handler: async (req, res) => {
    const b = req.body || {};
    const data = await openPromotions(pool, { doc: b.doc || {}, productId: b.productId || null, productType: b.doc?.productType || null,
      icId: b.insuranceCompanyId ? Number(b.insuranceCompanyId) : null, leadId: b.leadId || null });
    res.json({ success: true, data });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'A promotion version with its lines, the cap check of each line and every version of the code', screen: SCREEN, middleware: canRead,
  response: { success: true, data: { ...example, lines: [lineExample], capCheck: { standardRates: { ownDamage: 2, actsOfNature: 0.5 }, lines: [{ lineNo: 1, rateDiscount: 24, checks: [] }] }, versions: [example] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.getPromotion(req.params.id) }),
});
define({
  method: 'POST', path: '/', summary: 'Save a new promotion as Draft, version 1 (code unique, period, benefit, excess, quota, lock-in, applicability, vehicle lines)', screen: `${SCREEN} > Add promotion`,
  middleware: [...canWrite, validate(body)], request: { ...example, lines: [lineExample] }, response: { success: true, message: 'Promotion saved', data: example },
  handler: async (req, res) => {
    const p = await svc.createPromotion(req.body, req.user);
    await audit(req, { entity: 'promotion', entityId: p.id, action: 'create', after: p });
    res.status(201).json({ success: true, message: 'Promotion saved', data: p });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change a Draft version (an approved version is amended)', screen: `${SCREEN} > Edit promotion`,
  middleware: [...canWrite, validate(body)], request: { name: 'Fortuner launch rate', lines: [lineExample] }, response: { success: true, message: 'Promotion saved', data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updatePromotion(req.params.id, req.body, req.user);
    await audit(req, { entity: 'promotion', entityId: after.id, action: 'update', before, after });
    res.json({ success: true, message: 'Promotion saved', data: after });
  },
});
define({
  method: 'DELETE', path: '/:id', summary: 'Delete a Draft version 1 that was never submitted (its maker only)', screen: SCREEN, middleware: canWrite,
  response: { success: true, message: 'Promotion deleted' },
  handler: async (req, res) => {
    const p = await svc.deletePromotion(req.params.id, req.user);
    await audit(req, { entity: 'promotion', entityId: p.id, action: 'delete', before: p });
    res.json({ success: true, message: 'Promotion deleted' });
  },
});
const act = (action, message, fn) => async (req, res) => {
  const p = await fn(req);
  await audit(req, { entity: 'promotion', entityId: req.params.id, action, after: { code: p.code, version: p.version, status: p.status, reasonCode: req.body?.reasonCode || null, note: req.body?.note || null } });
  res.json({ success: true, message, data: p });
};
define({
  method: 'POST', path: '/:id/submit', summary: 'Submit a Draft for approval: every field, line and cap check must pass', screen: SCREEN, middleware: canWrite,
  request: {}, response: { success: true, message: 'Promotion submitted for approval', data: { ...example, status: 'pending-approval' } },
  handler: act('submit', 'Promotion submitted for approval', (req) => svc.submitPromotion(req.params.id, req.user)),
});
define({
  method: 'POST', path: '/:id/recall', summary: 'Recall an own submitted promotion to Draft before it is decided', screen: SCREEN, middleware: canWrite,
  request: {}, response: { success: true, message: 'Promotion recalled', data: { ...example, status: 'draft' } },
  handler: act('recall', 'Promotion recalled', (req) => svc.recallPromotion(req.params.id, req.user)),
});
define({
  method: 'POST', path: '/:id/approve', summary: 'Approve a submitted promotion (approve:promotions; never its maker): Scheduled or Active; the version in force is superseded', screen: `${SCREEN} > Approve`,
  middleware: [...canApprove, validate(z.object({ note: z.string().max(2000).optional().nullable() }))], request: { note: 'Rates agreed with the insurers' },
  response: { success: true, message: 'Promotion approved', data: example },
  handler: act('approve', 'Promotion approved', (req) => svc.decidePromotion(req.params.id, { decision: 'approve', note: req.body?.note }, req.user)),
});
define({
  method: 'POST', path: '/:id/return', summary: 'Return a submitted promotion to Draft with a reason code (promotion_return) (approve:promotions; never its maker)', screen: `${SCREEN} > Return`,
  middleware: [...canApprove, reason], request: { reasonCode: 'PRMR-RATES', note: 'Remitting rate of line 2 not agreed' },
  response: { success: true, message: 'Promotion returned', data: { ...example, status: 'draft' } },
  handler: act('return', 'Promotion returned', (req) => svc.decidePromotion(req.params.id, { decision: 'return', reasonCode: req.body.reasonCode, note: req.body.note }, req.user)),
});
for (const [action, message] of [['suspend', 'Promotion suspended'], ['resume', 'Promotion resumed'], ['withdraw', 'Promotion withdrawn']]) {
  define({
    method: 'POST', path: `/:id/${action}`, summary: `${message.split(' ')[1].replace(/^./, (c) => c.toUpperCase())} a promotion with a reason code (promotion_status) (approve:promotions); open quotations keep it until their validity ends`,
    screen: SCREEN, middleware: [...canApprove, reason], request: { reasonCode: 'PRMS-INSURER', note: 'Rate under renegotiation with the insurer' },
    response: { success: true, message, data: example, openQuotes: 3 },
    handler: async (req, res) => {
      const r = await svc.changePromotionStatus(req.params.id, action, req.body, req.user);
      await audit(req, { entity: 'promotion', entityId: req.params.id, action, before: { status: r.before.status }, after: { status: r.promotion.status, reasonCode: req.body.reasonCode, note: req.body.note || null } });
      res.json({ success: true, message, data: r.promotion, openQuotes: r.openQuotes });
    },
  });
}
define({
  method: 'POST', path: '/:id/amend', summary: 'Amend a promotion in force: the next version in Draft, copied from it; the current version stays in force until the new one is approved',
  screen: SCREEN, middleware: canWrite, request: {}, response: { success: true, message: 'Version 2 created in Draft', data: { ...example, version: 2, status: 'draft' } },
  handler: async (req, res) => {
    const p = await svc.amendPromotion(req.params.id, req.user);
    await audit(req, { entity: 'promotion', entityId: p.id, action: 'amend', after: { code: p.code, version: p.version, from: req.params.id } });
    res.status(201).json({ success: true, message: `Version ${p.version} created in Draft`, data: p });
  },
});
define({
  method: 'POST', path: '/:id/copy', summary: 'Copy a promotion into a new Draft with a new code and period', screen: SCREEN,
  middleware: [...canWrite, validate(z.object({ code: z.string().min(1).max(40), periodFrom: z.string().max(10), periodTo: z.string().max(10) }))],
  request: { code: 'PRM-FORTUNER27', periodFrom: '2027-01-01', periodTo: '2027-03-31' }, response: { success: true, message: 'Promotion saved', data: { ...example, code: 'PRM-FORTUNER27' } },
  handler: async (req, res) => {
    const p = await svc.copyPromotion(req.params.id, req.body, req.user);
    await audit(req, { entity: 'promotion', entityId: p.id, action: 'create', after: { ...p, copiedFrom: req.params.id } });
    res.status(201).json({ success: true, message: 'Promotion saved', data: p });
  },
});

// ---------------------------------------------------------------- discount caps
const capRead = [requireAuth, requirePermission('read:discount-caps', 'write:discount-caps', 'approve:discount-caps')];
const capWrite = [requireAuth, requirePermission('write:discount-caps')];
const capApprove = [requireAuth, requirePermission('approve:discount-caps')];
cap.define({
  method: 'GET', path: '/', summary: 'Discount caps (filter status, productId, channelType)', screen: CAP_SCREEN, middleware: capRead,
  query: { status: 'approved', channelType: 'financing_bank' }, response: { success: true, data: [capExample] },
  handler: async (req, res) => res.json({ success: true, data: await caps.listCaps(req.query) }),
});
cap.define({
  method: 'POST', path: '/', summary: 'Propose a cap (or a change replacing an approved cap: replacesId); live once a second user approves it. Lists the promotion lines it would leave outside',
  screen: `${CAP_SCREEN} > Add cap`,
  middleware: [...capWrite, validate(z.object({ productId: z.coerce.number().int(), channelType: z.string().max(30), minPct: z.coerce.number(), maxPct: z.coerce.number(), lowestOd: z.coerce.number(),
    effectiveFrom: z.string().max(10), effectiveTo: z.string().max(10).optional().nullable(), replacesId: z.coerce.number().int().optional().nullable(), remarks: z.string().max(2000).optional().nullable() }))],
  request: { productId: 2, channelType: 'financing_bank', minPct: 0, maxPct: 25, lowestOd: 1.4, effectiveFrom: '2026-10-15' },
  response: { success: true, message: 'Discount cap submitted for approval', data: { ...capExample, status: 'pending' }, impact: ['PRM-VIOS26 line 1'] },
  handler: async (req, res) => {
    const r = await caps.proposeCap(req.body, req.user);
    await audit(req, { entity: 'discount_cap', entityId: String(r.cap.id), action: 'create', after: r.cap });
    res.status(201).json({ success: true, message: 'Discount cap submitted for approval', data: r.cap, impact: r.impact });
  },
});
cap.define({
  method: 'POST', path: '/:id/approve', summary: 'Approve a pending cap (approve:discount-caps; never its maker); the cap it replaces ends the day before', screen: CAP_SCREEN,
  middleware: [...capApprove, validate(z.object({ note: z.string().max(2000).optional().nullable() }))], request: {}, response: { success: true, message: 'Discount cap approved', data: capExample },
  handler: async (req, res) => {
    const c = await caps.decideCap(Number(req.params.id), { decision: 'approve', note: req.body?.note }, req.user);
    await audit(req, { entity: 'discount_cap', entityId: String(c.id), action: 'approve', after: c });
    res.json({ success: true, message: 'Discount cap approved', data: c });
  },
});
cap.define({
  method: 'POST', path: '/:id/return', summary: 'Return a pending cap with a reason code (discount_cap_return) (approve:discount-caps; never its maker)', screen: CAP_SCREEN,
  middleware: [...capApprove, reason], request: { reasonCode: 'DCR-VALUES', note: 'Maximum not agreed with TIS Sales' }, response: { success: true, message: 'Discount cap returned', data: { ...capExample, status: 'returned' } },
  handler: async (req, res) => {
    const c = await caps.decideCap(Number(req.params.id), { decision: 'return', reasonCode: req.body.reasonCode, note: req.body.note }, req.user);
    await audit(req, { entity: 'discount_cap', entityId: String(c.id), action: 'return', after: { status: c.status, reason: c.decisionNote } });
    res.json({ success: true, message: 'Discount cap returned', data: c });
  },
});
cap.define({
  method: 'POST', path: '/:id/withdraw', summary: 'Withdraw an own pending cap', screen: CAP_SCREEN, middleware: capWrite, request: {},
  response: { success: true, message: 'Discount cap withdrawn', data: { ...capExample, status: 'withdrawn' } },
  handler: async (req, res) => {
    const c = await caps.withdrawCap(Number(req.params.id), req.user);
    await audit(req, { entity: 'discount_cap', entityId: String(c.id), action: 'withdraw', after: { status: c.status } });
    res.json({ success: true, message: 'Discount cap withdrawn', data: c });
  },
});

export default router;
export const mount = '/promotions';
export const extraMounts = [['/discount-caps', cap.router]];
