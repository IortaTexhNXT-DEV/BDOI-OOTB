import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { created, ok } from '../../lib/respond.js';
import { RULE_KINDS, RULE_METHODS, TAX_REGIMES } from './calculator.js';
import * as svc from './service.js';

/**
 * Master > Packaged Products > Taxes & Charges and LGU Tax Rates: the Philippine premium taxes (VAT or premium tax,
 * documentary stamp tax, fire service tax, local government tax) and other charges, and the calculator the quick
 * quote, package bundles and quotations use. Read by anyone who quotes, issues or collects; maintained by Accounting
 * (write:premium-charges) and the System Administrator.
 */
const { router, define } = moduleRouter('Premium Taxes and Charges', '/premium-charges');
const RULES = 'Master > Packaged Products > LGU Tax Rates > Taxes & Charges';
const LGUS = 'Master > Packaged Products > LGU Tax Rates';
const canRead = [requireAuth, requirePermission('read:quotations', 'read:policies', 'read:masters', 'read:products', 'read:receipts', 'write:premium-charges')];
const canWrite = [requireAuth, requirePermission('write:premium-charges')];

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const money = z.coerce.number().min(0).max(1e12);
const ruleFields = {
  name: z.string().trim().min(1).max(120),
  kind: z.enum(RULE_KINDS),
  method: z.enum(RULE_METHODS).optional(),
  rate: z.coerce.number().min(0).max(100).optional(),
  unitAmount: money.optional(),
  unitSize: money.optional(),
  fractionRule: z.enum(['round_up', 'prorate']).optional(),
  lines: z.array(z.string().trim().min(1).max(40)).max(20).nullable().optional(),
  regimes: z.array(z.enum(TAX_REGIMES)).max(3).nullable().optional(),
  minimumAmount: money.optional(),
  sortOrder: z.coerce.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
  effectiveFrom: date.optional(),
  effectiveTo: date.nullable().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
};
const ruleCreate = z.object({ code: z.string().trim().regex(/^[A-Za-z][A-Za-z0-9_-]{0,19}$/, 'letters, digits, _ or -, up to 20'), ...ruleFields }).strict();
const ruleUpdate = z.object({ ...ruleFields, name: ruleFields.name.optional(), kind: ruleFields.kind.optional() }).strict();
const lguFields = {
  code: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/, 'letters, digits, _ or -, up to 20'),
  name: z.string().trim().min(1).max(120),
  province: z.string().trim().max(120).nullable().optional(),
  cityId: z.coerce.number().int().positive().nullable().optional(),
  rate: z.coerce.number().min(0).max(100),
  effectiveFrom: date.optional(),
  effectiveTo: date.nullable().optional(),
  active: z.boolean().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
};
const lguCreate = z.object(lguFields).strict();
const lguUpdate = z.object({ ...lguFields, code: lguFields.code.optional(), name: lguFields.name.optional(), rate: lguFields.rate.optional() }).strict();
const calcBody = z.object({
  premium: z.coerce.number().min(-1e12).max(1e12),
  productId: z.union([z.coerce.number().int().positive(), z.string().trim().max(40)]).optional().nullable(),
  line: z.string().trim().max(40).optional().nullable(),
  regime: z.enum(TAX_REGIMES).optional().nullable(),
  property: z.boolean().optional().nullable(),
  lguCode: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(),
  date: date.optional().nullable(),
  includeFlat: z.boolean().optional(),
}).strict();

const ruleExample = { code: 'DST', name: 'Documentary Stamp Tax', kind: 'dst', method: 'per_unit', rate: 0, unitAmount: 0.5, unitSize: 4, fractionRule: 'round_up', lines: null, regimes: null,
  minimumAmount: 0, sortOrder: 30, active: true, effectiveFrom: '2026-01-01', effectiveTo: null, remarks: 'NIRC: P0.50 on each P4.00 of premium or fractional part thereof (12.5%)' };
const lguExample = { id: 1, code: 'MKT', name: 'Makati', province: 'Metro Manila', cityId: 8, cityName: 'Makati', rate: 0.2, effectiveFrom: '2026-01-01', effectiveTo: null, active: true };
const calcExample = { premium: 10000, lines: [{ code: 'VAT', name: 'Value Added Tax', kind: 'vat', method: 'percent', rate: 12, base: 10000, amount: 1200 },
  { code: 'DST', name: 'Documentary Stamp Tax', kind: 'dst', method: 'per_unit', rate: 12.5, base: 10000, amount: 1250 },
  { code: 'FST', name: 'Fire Service Tax', kind: 'fst', method: 'percent', rate: 2, base: 10000, amount: 200 },
  { code: 'LGT', name: 'Local Government Tax', kind: 'lgt', method: 'percent', rate: 0.2, base: 10000, amount: 20 }],
vat: 1200, premiumTax: 0, dst: 1250, fst: 200, lgt: 20, other: 0, taxes: 2670, totalCharges: 2670, total: 12670, line: 'fire', regime: 'vat', date: '2026-09-30', lgu: { code: 'MKT', name: 'Makati', rate: 0.2 } };

define({
  method: 'GET', path: '/rules', summary: 'Premium tax and charge rules (active=true|false)', screen: RULES, middleware: canRead,
  query: { active: 'true' }, response: { success: true, data: [ruleExample] },
  handler: async (req, res) => ok(res, await svc.listRules(req.query)),
});
define({
  method: 'POST', path: '/rules', summary: 'Add a charge rule (percent, per unit or flat; lines and tax regimes it applies to)', screen: RULES,
  middleware: [...canWrite, validate(ruleCreate)], request: { code: 'NOTARIAL2', name: 'Notarial fee', kind: 'other', method: 'flat', unitAmount: 150 }, response: { success: true, data: ruleExample },
  handler: async (req, res) => {
    const row = await svc.createRule(req.body, req.user);
    await audit(req, { entity: 'premium_charge_rule', entityId: row.code, action: 'create', after: row });
    created(res, row, 'Charge rule added');
  },
});
define({
  method: 'PUT', path: '/rules/:code', summary: 'Update a charge rule (rate, method, lines, effective dates, active)', screen: RULES,
  middleware: [...canWrite, validate(ruleUpdate)], request: { rate: 12, active: true }, response: { success: true, data: ruleExample },
  handler: async (req, res) => {
    const { before, after } = await svc.updateRule(req.params.code, req.body, req.user);
    await audit(req, { entity: 'premium_charge_rule', entityId: after.code, action: 'update', before, after });
    ok(res, after, 'Charge rule saved');
  },
});
define({
  method: 'DELETE', path: '/rules/:code', summary: 'Delete an "other" charge (statutory taxes are switched off instead)', screen: RULES, middleware: canWrite,
  response: { success: true, data: ruleExample },
  handler: async (req, res) => {
    const before = await svc.deleteRule(req.params.code);
    await audit(req, { entity: 'premium_charge_rule', entityId: before.code, action: 'delete', before });
    ok(res, before, 'Charge rule deleted');
  },
});

define({
  method: 'GET', path: '/lgu-rates', summary: 'Local government tax rates by city / municipality (active, search)', screen: LGUS, middleware: canRead,
  query: { active: 'true', search: 'Makati' }, response: { success: true, data: [lguExample] },
  handler: async (req, res) => ok(res, await svc.listLgus(req.query)),
});
define({
  method: 'POST', path: '/lgu-rates', summary: 'Add the local government tax rate of a city or municipality', screen: LGUS,
  middleware: [...canWrite, validate(lguCreate)], request: { code: 'VAL', name: 'Valenzuela', province: 'Metro Manila', cityId: 19, rate: 0.2 }, response: { success: true, data: lguExample },
  handler: async (req, res) => {
    const row = await svc.createLgu(req.body, req.user);
    await audit(req, { entity: 'lgu_tax_rate', entityId: row.id, action: 'create', after: row });
    created(res, row, 'LGU tax rate added');
  },
});
define({
  method: 'PUT', path: '/lgu-rates/:id', summary: 'Update an LGU tax rate', screen: LGUS,
  middleware: [...canWrite, validate(lguUpdate)], request: { rate: 0.25 }, response: { success: true, data: lguExample },
  handler: async (req, res) => {
    const { before, after } = await svc.updateLgu(req.params.id, req.body, req.user);
    await audit(req, { entity: 'lgu_tax_rate', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'LGU tax rate saved');
  },
});
define({
  method: 'DELETE', path: '/lgu-rates/:id', summary: 'Delete an LGU tax rate', screen: LGUS, middleware: canWrite, response: { success: true, data: lguExample },
  handler: async (req, res) => {
    const before = await svc.deleteLgu(req.params.id);
    await audit(req, { entity: 'lgu_tax_rate', entityId: before.id, action: 'delete', before });
    ok(res, before, 'LGU tax rate deleted');
  },
});

define({
  method: 'POST', path: '/calculate', summary: 'Taxes and charges of a premium: product (line, tax regime), location (LGU) and date; the breakdown shown on screens and prints',
  screen: 'Operations > Sales & Marketing > Quick Quote / Package Bundles', middleware: [...canRead, validate(calcBody)],
  request: { premium: 10000, productId: 11, lguCode: 'MKT' }, response: { success: true, data: calcExample },
  handler: async (req, res) => {
    const b = req.body;
    ok(res, await svc.chargesFor({ premium: b.premium, productId: b.productId, line: b.line, regime: b.regime, property: b.property ?? null, lguCode: b.lguCode, city: b.city,
      date: b.date, includeFlat: b.includeFlat !== false }));
  },
});

export default router;
export const mount = '/premium-charges';
