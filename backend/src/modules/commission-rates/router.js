import { moduleRouter } from '../../lib/registry.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { created, ok } from '../../lib/respond.js';
import { canRead, canWrite } from '../masters/helpers.js';
import { POLICY_TYPES, resolveCommissionRate } from './resolve.js';
import { resolveCreditTerms } from './terms.js';
import * as svc from './service.js';

/**
 * Master > Finance > Commission Rate Matrix (commission rates by insurer / product / line of business / policy type
 * and date range) and the insurer credit terms lookup. Maintained by master administrators (write:masters).
 */
const { router, define } = moduleRouter('Commission Rate Matrix', '/commission-rates');
const SCREEN = 'Master > Finance > Commission Rate Matrix';
const example = {
  id: 1, insuranceCompanyId: 3, insurerName: 'Malayan Insurance Co., Inc.', productId: 1, productName: 'Motor Car', lineOfBusiness: null, policyType: 'new',
  rate: 0.175, ratePercent: 17.5, effectiveFrom: '2026-01-01', effectiveTo: null, active: true, level: 'insurer + product',
};

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const id = z.coerce.number().int().positive();
const fields = {
  insuranceCompanyId: id.nullable().optional(),
  productId: id.nullable().optional(),
  lineOfBusiness: z.string().trim().max(40).nullable().optional(),
  policyType: z.enum(POLICY_TYPES).optional(),
  rate: z.coerce.number().min(0).max(1),
  effectiveFrom: date,
  effectiveTo: date.nullable().optional(),
  active: z.boolean().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
};
const createSchema = z.object(fields).strict();
const updateSchema = z.object({ ...fields, rate: fields.rate.optional(), effectiveFrom: date.optional() }).strict();

define({
  method: 'GET', path: '/', summary: 'Commission rate matrix rows (filters: insuranceCompanyId, productId, lineOfBusiness, policyType, active, search)', screen: SCREEN,
  middleware: canRead('masters', 'read:commission'), query: { insuranceCompanyId: 3, active: 'true' }, response: { success: true, data: [example] },
  handler: async (req, res) => ok(res, await svc.listRates(req.query)),
});
define({
  method: 'GET', path: '/resolve', summary: 'Test rate: the commission rate that applies to an insurer / product / line of business / policy type on a date, and where it comes from', screen: `${SCREEN} > Test rate`,
  middleware: canRead('masters', 'read:commission'), query: { insurerId: 3, productId: 1, lob: 'motor', policyType: 'new', date: '2026-09-29' },
  response: { success: true, data: { rate: 0.175, source: 'matrix', ruleId: 1, level: 'insurer + product' } },
  handler: async (req, res) => {
    const q = z.object({ insurerId: id.optional(), productId: id.optional(), lob: z.string().max(40).optional(), policyType: z.enum(['new', 'renewal']).optional(), date: date.optional() }).parse(req.query);
    ok(res, await resolveCommissionRate(q));
  },
});
define({
  method: 'GET', path: '/credit-terms/:insurerId', summary: 'Insurer credit terms with fallbacks: premium payment warranty days, remittance terms days, default billing mode', screen: 'Master > Generals > Insurance Company',
  middleware: canRead('masters', 'read:commission'),
  response: { success: true, data: { premiumWarrantyDays: 30, remittanceTermsDays: 30, billingMode: 'broker', source: { premiumWarrantyDays: 'setting', remittanceTermsDays: 'setting', billingMode: 'setting' } } },
  handler: async (req, res) => ok(res, await resolveCreditTerms(req.params.insurerId)),
});
define({
  method: 'GET', path: '/:id', summary: 'One commission rate row', screen: SCREEN, middleware: canRead('masters', 'read:commission'),
  response: { success: true, data: example },
  handler: async (req, res) => ok(res, await svc.getRate(id.parse(req.params.id))),
});
define({
  method: 'POST', path: '/', summary: 'Add a commission rate (insurer, product and / or line of business; no overlap with an active row of the same keys)', screen: SCREEN,
  middleware: [...canWrite('masters'), validate(createSchema)],
  request: { insuranceCompanyId: 3, productId: 1, policyType: 'new', rate: 0.175, effectiveFrom: '2026-01-01' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const row = await svc.createRate(req.body, req.user);
    await audit(req, { entity: 'commission_rate', entityId: row.id, action: 'create', after: row });
    created(res, row, 'Commission rate added');
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Update a commission rate (same overlap rule)', screen: SCREEN,
  middleware: [...canWrite('masters'), validate(updateSchema)], request: { rate: 0.18, effectiveTo: '2026-12-31' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updateRate(id.parse(req.params.id), req.body, req.user);
    await audit(req, { entity: 'commission_rate', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'Commission rate saved');
  },
});
define({
  method: 'DELETE', path: '/:id', summary: 'Delete a commission rate row', screen: SCREEN, middleware: canWrite('masters'),
  response: { success: true, data: example },
  handler: async (req, res) => {
    const before = await svc.deleteRate(id.parse(req.params.id));
    await audit(req, { entity: 'commission_rate', entityId: before.id, action: 'delete', before });
    ok(res, before, 'Commission rate deleted');
  },
});

export default router;
export const mount = '/commission-rates';
