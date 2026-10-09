import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { created, ok, paging } from '../../lib/respond.js';
import { scopeOf, withScope } from '../../lib/scope.js';
import { sendPdf } from '../../lib/pdf/index.js';
import * as rt from './rateTables.js';
import * as bundles from './bundles.js';
import * as quotes from './bundleQuotes.js';
import * as issue from './issue.js';

/**
 * Packaged products (high-velocity retail and SME): bundle products and insurer rate tables (Master > Packaged
 * Products) and package quotations and policies (Sales & Marketing > Package Bundles). Masters are maintained by the
 * Processing Team (write:products); quoting follows the quotation permissions and issuing needs write:policies.
 */
const { router, define } = moduleRouter('Packaged Products', '/packages');
const MASTER_BUNDLES = 'Master > Packaged Products > Bundle Products';
const MASTER_RATES = 'Master > Packaged Products > Insurer Rate Tables';
const BUNDLES = 'Operations > Sales & Marketing > Package Bundles';
const readMasters = [requireAuth, requirePermission('read:quotations', 'read:products', 'read:masters', 'read:policies')];
const writeMasters = [requireAuth, requirePermission('write:products')];
const canQuote = [requireAuth, requirePermission('read:quotations')];
const writeQuote = [requireAuth, requirePermission('write:quotations')];
const canIssue = [requireAuth, requirePermission('write:policies')];
const readPolicies = [requireAuth, requirePermission('read:policies')];
const canEndorse = [requireAuth, requirePermission('write:endorsements', 'write:policies')];
const canRenew = [requireAuth, requirePermission('write:renewals', 'write:quotations')];

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const id = z.coerce.number().int().positive();
const money = z.coerce.number().min(0).max(1e13);
const benefits = z.array(z.string().trim().min(1).max(200)).max(30);

// ------------------------------------------------------------------ insurer rate tables
const rtFields = {
  insuranceCompanyId: id, productId: id, rateBasis: z.enum(rt.RATE_BASES).optional(), rate: z.coerce.number().min(0).max(1e9), minimumPremium: money.optional(),
  deductible: z.string().trim().max(300).nullable().optional(), deductibleAmount: money.nullable().optional(), keyBenefits: benefits.optional(),
  commissionRate: z.coerce.number().min(0).max(1).nullable().optional(), effectiveFrom: date, effectiveTo: date.nullable().optional(), active: z.boolean().optional(),
  remarks: z.string().trim().max(500).nullable().optional(),
};
const rtCreate = z.object(rtFields).strict();
const rtUpdate = z.object({ ...rtFields, insuranceCompanyId: id.optional(), productId: id.optional(), rate: rtFields.rate.optional(), effectiveFrom: date.optional() }).strict();
const rtExample = { id: 1, insuranceCompanyId: 2, insurerName: 'Malayan Insurance Co., Inc.', productId: 11, productName: 'Householder Insurance', rateBasis: 'percent', rate: 0.25,
  minimumPremium: 1500, deductible: 'PHP 2,500 each and every loss', keyBenefits: ['Fire and lightning', 'Typhoon and flood'], commissionRate: 0.2, effectiveFrom: '2026-01-01', effectiveTo: null, active: true };

define({
  method: 'GET', path: '/rate-tables', summary: 'Insurer rate tables (insuranceCompanyId, productId, active, search)', screen: MASTER_RATES, middleware: readMasters,
  query: { productId: 11, active: 'true' }, response: { success: true, data: [rtExample] },
  handler: async (req, res) => ok(res, await rt.listRateTables(req.query)),
});
define({
  method: 'POST', path: '/rate-tables', summary: 'Add an insurer rate table row (no overlap with an active row of the same insurer and product)', screen: MASTER_RATES,
  middleware: [...writeMasters, validate(rtCreate)], request: { insuranceCompanyId: 2, productId: 11, rateBasis: 'percent', rate: 0.25, minimumPremium: 1500, effectiveFrom: '2026-01-01' },
  response: { success: true, data: rtExample },
  handler: async (req, res) => {
    const row = await rt.createRateTable(req.body, req.user);
    await audit(req, { entity: 'insurer_rate_table', entityId: row.id, action: 'create', after: row });
    created(res, row, 'Rate table added');
  },
});
define({
  method: 'PUT', path: '/rate-tables/:id', summary: 'Update an insurer rate table row', screen: MASTER_RATES, middleware: [...writeMasters, validate(rtUpdate)],
  request: { rate: 0.3 }, response: { success: true, data: rtExample },
  handler: async (req, res) => {
    const { before, after } = await rt.updateRateTable(id.parse(req.params.id), req.body, req.user);
    await audit(req, { entity: 'insurer_rate_table', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'Rate table saved');
  },
});
define({
  method: 'DELETE', path: '/rate-tables/:id', summary: 'Delete a rate table row (deactivated instead when a package section used it)', screen: MASTER_RATES, middleware: writeMasters,
  response: { success: true, data: { ...rtExample, deactivated: false } },
  handler: async (req, res) => {
    const before = await rt.deleteRateTable(id.parse(req.params.id), req.user);
    await audit(req, { entity: 'insurer_rate_table', entityId: before.id, action: before.deactivated ? 'deactivate' : 'delete', before });
    ok(res, before, before.deactivated ? 'Rate table deactivated (used by a package)' : 'Rate table deleted');
  },
});

// ------------------------------------------------------------------ bundle products
const sectionSchema = z.object({
  sectionNo: z.coerce.number().int().positive().max(99).optional(), name: z.string().trim().min(1).max(120), productId: id, defaultSumInsured: money.optional(),
  ratePercent: z.coerce.number().min(0).max(100).optional(), minimumPremium: money.optional(), property: z.boolean().nullable().optional(), optional: z.boolean().optional(),
  insurerIds: z.array(id).min(1, 'Each section needs at least one insurer').max(20), benefits: benefits.optional(),
}).strict();
const bundleFields = {
  code: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,19}$/, 'letters, digits, _ or -, up to 20'), name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(), customerSegment: z.enum(['retail', 'sme', 'corporate', 'both']).optional(),
  discountPercent: z.coerce.number().min(0).max(99.99).optional(), termMonths: z.coerce.number().int().min(1).max(60).optional(), autoIssue: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(), sections: z.array(sectionSchema).min(1).max(20),
};
const bundleCreate = z.object(bundleFields).strict();
const bundleUpdate = z.object({ ...bundleFields, code: bundleFields.code.optional(), name: bundleFields.name.optional(), sections: bundleFields.sections.optional() }).strict();
const bundleExample = { id: 1, code: 'SME-SHIELD', name: 'SME Shield', customerSegment: 'sme', discountPercent: 10, termMonths: 12, autoIssue: true, status: 'active',
  sections: [{ sectionNo: 1, name: 'Fire', productId: 4, productName: 'Fire and Allied Perils', defaultSumInsured: 2000000, ratePercent: 0.2, minimumPremium: 2000, property: true,
    optional: false, insurerIds: [2, 3], insurers: [{ id: 2, name: 'Malayan Insurance Co., Inc.' }], benefits: ['Fire and lightning'] }] };

define({
  method: 'GET', path: '/bundles', summary: 'Bundle products with their sections (status, search)', screen: MASTER_BUNDLES, middleware: readMasters,
  query: { status: 'active' }, response: { success: true, data: [bundleExample] },
  handler: async (req, res) => ok(res, await bundles.listBundles(req.query)),
});
define({
  method: 'GET', path: '/bundles/:id', summary: 'One bundle product (id or code)', screen: MASTER_BUNDLES, middleware: readMasters, response: { success: true, data: bundleExample },
  handler: async (req, res) => ok(res, await bundles.getBundle(req.params.id)),
});
define({
  method: 'POST', path: '/bundles', summary: 'Add a bundle product: sections (product, default sum insured, rate, minimum premium, insurers), discount %, term', screen: MASTER_BUNDLES,
  middleware: [...writeMasters, validate(bundleCreate)], request: { code: 'SME-SHIELD', name: 'SME Shield', discountPercent: 10, sections: [{ name: 'Fire', productId: 4, defaultSumInsured: 2000000, ratePercent: 0.2, insurerIds: [2, 3] }] },
  response: { success: true, data: bundleExample },
  handler: async (req, res) => {
    const row = await bundles.createBundle(req.body, req.user);
    await audit(req, { entity: 'package_bundle', entityId: row.id, action: 'create', after: row });
    created(res, row, 'Bundle added');
  },
});
define({
  method: 'PUT', path: '/bundles/:id', summary: 'Update a bundle product (sections are replaced when given)', screen: MASTER_BUNDLES, middleware: [...writeMasters, validate(bundleUpdate)],
  request: { discountPercent: 12.5 }, response: { success: true, data: bundleExample },
  handler: async (req, res) => {
    const { before, after } = await bundles.updateBundle(req.params.id, req.body, req.user);
    await audit(req, { entity: 'package_bundle', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'Bundle saved');
  },
});
define({
  method: 'DELETE', path: '/bundles/:id', summary: 'Delete a bundle product (deactivated instead once quoted)', screen: MASTER_BUNDLES, middleware: writeMasters,
  response: { success: true, data: { ...bundleExample, deactivated: true } },
  handler: async (req, res) => {
    const before = await bundles.deleteBundle(req.params.id, req.user);
    await audit(req, { entity: 'package_bundle', entityId: before.id, action: before.deactivated ? 'deactivate' : 'delete', before });
    ok(res, before, before.deactivated ? 'Bundle deactivated (already quoted)' : 'Bundle deleted');
  },
});

// ------------------------------------------------------------------ package quotations
const sectionInput = z.object({ sectionNo: z.coerce.number().int().positive(), included: z.boolean().optional(), insuranceCompanyId: id.optional(), sumInsured: money.optional() }).strict();
const quoteFields = {
  bundleId: z.union([id, z.string().trim().min(1).max(20)]), clientId: z.string().max(60).optional().nullable(), leadRefId: z.string().max(60).optional().nullable(),
  insuredName: z.string().trim().max(200).optional().nullable(), location: z.string().trim().max(300).optional().nullable(), lguCode: z.string().trim().max(20).optional().nullable(),
  city: z.string().trim().max(120).optional().nullable(), inceptionDate: date.optional().nullable(), sections: z.array(sectionInput).max(20).optional(), remarks: z.string().max(1000).optional().nullable(),
};
const quoteCreate = z.object(quoteFields).strict();
const quoteUpdate = z.object({ ...quoteFields, bundleId: quoteFields.bundleId.optional() }).strict();
const quoteExample = { id: 'pq_0123456789abcdef', quoteNumber: 'PQ-2026-00001', bundleId: 1, bundleName: 'SME Shield', clientId: 'cl_0123456789abcdef', insuredName: 'Rosario Bakeshop',
  lguCode: 'MKT', inceptionDate: '2026-10-01', status: 'draft', discountPercent: 10, sumInsured: 3200000, basePremium: 9000, discountAmount: 900, netPremium: 8100,
  vat: 972, premiumTax: 0, dst: 1012.5, fst: 90, lgt: 16.2, otherCharges: 0, totalCharges: 2090.7, totalAmount: 10190.7, commissionAmount: 1377, currency: 'PHP',
  sections: [{ sectionNo: 1, name: 'Fire', insuranceCompanyId: 2, insurerName: 'Malayan Insurance Co., Inc.', sumInsured: 2000000, basePremium: 5000, discountAmount: 500, netPremium: 4500,
    vat: 540, dst: 562.5, fst: 90, lgt: 9, totalCharges: 1201.5, totalAmount: 5701.5, commissionRate: 0.2, commissionAmount: 900 }] };

define({
  method: 'POST', path: '/quotes/preview', summary: 'Price a bundle without saving: sections with their insurer, premium, discount, taxes and commission, and totals',
  screen: `${BUNDLES} > New`, middleware: [...canQuote, validate(quoteUpdate)], request: { bundleId: 1, lguCode: 'MKT', sections: [{ sectionNo: 3, included: true }] },
  response: { success: true, data: { bundle: { id: 1, name: 'SME Shield' }, date: '2026-10-01', discountPercent: 10, lgu: { code: 'MKT' }, sections: quoteExample.sections, totals: {} } },
  handler: async (req, res) => ok(res, await quotes.previewPackage(req.body)),
});
define({
  method: 'GET', path: '/quotes', summary: 'Package quotations (status (comma-separated), clientId, bundleId, search; paging)', screen: BUNDLES, middleware: canQuote,
  query: { status: 'draft,accepted', search: 'PQ-2026' }, response: { success: true, data: [quoteExample], total: 1, page: 1, perPage: 10, totalPages: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows } = await quotes.listPackageQuotes(await withScope(req), pg);
    ok(res, rows, 'OK', { total, page: pg.page, perPage: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'GET', path: '/quotes/:id', summary: 'One package quotation with its sections', screen: BUNDLES, middleware: canQuote, response: { success: true, data: quoteExample },
  handler: async (req, res) => ok(res, await quotes.getPackageQuote(req.params.id, { scope: await scopeOf(req) })),
});
define({
  method: 'POST', path: '/quotes', summary: 'Create a package quotation for a client or prospect (priced on the server)', screen: `${BUNDLES} > New`,
  middleware: [...writeQuote, validate(quoteCreate)], request: { bundleId: 1, clientId: 'cl_0123456789abcdef', lguCode: 'MKT', inceptionDate: '2026-10-01' },
  response: { success: true, data: quoteExample },
  handler: async (req, res) => {
    const row = await quotes.createPackageQuote(req.body, req.user);
    await audit(req, { entity: 'package_quote', entityId: row.id, action: 'create', after: row });
    created(res, row, `Package quotation ${row.quoteNumber} created`);
  },
});
define({
  method: 'PUT', path: '/quotes/:id', summary: 'Change and re-price a draft package quotation', screen: BUNDLES, middleware: [...writeQuote, validate(quoteUpdate)],
  request: { sections: [{ sectionNo: 1, sumInsured: 2500000 }] }, response: { success: true, data: quoteExample },
  handler: async (req, res) => {
    const { before, after } = await quotes.updatePackageQuote(req.params.id, req.body, req.user, await scopeOf(req));
    await audit(req, { entity: 'package_quote', entityId: after.id, action: 'update', before, after });
    ok(res, after, 'Package quotation saved');
  },
});
for (const [action, target, summary] of [['accept', 'accepted', 'The client accepted the package quotation'], ['cancel', 'cancelled', 'Cancel a package quotation'],
  ['reopen', 'draft', 'Reopen an accepted package quotation for changes']]) {
  define({
    method: 'POST', path: `/quotes/:id/${action}`, summary, screen: BUNDLES, middleware: writeQuote, response: { success: true, data: { ...quoteExample, status: target } },
    handler: async (req, res) => {
      const { before, after } = await quotes.setQuoteStatus(req.params.id, target, req.user, await scopeOf(req));
      await audit(req, { entity: 'package_quote', entityId: after.id, action, before, after });
      ok(res, after, `Package quotation ${after.quoteNumber} ${target}`);
    },
  });
}
define({
  method: 'POST', path: '/quotes/:id/issue', summary: 'Issue the package: one policy number (package_policy series), section records per insurer, one bill and one booking journal with lines per insurer',
  screen: `${BUNDLES} > Issue policy`, middleware: [...canIssue, validate(z.object({ inceptionDate: date.optional(), insuredName: z.string().trim().max(200).optional() }).strict())],
  request: { inceptionDate: '2026-10-01' }, response: { success: true, data: { policyId: 'pol_0123456789abcdef', policyNumber: 'PKG-2026-00001', billNumber: 'INV-2026-00077', quote: quoteExample } },
  handler: async (req, res) => {
    const r = await issue.issuePackageQuote(req.params.id, req.body, req.user, { scope: await scopeOf(req) });
    await audit(req, { entity: 'policy', entityId: r.policyId, action: 'issue-package', after: { policyNumber: r.policyNumber, packageQuote: r.quote.quoteNumber } });
    created(res, r, `Policy ${r.policyNumber} issued`);
  },
});
define({
  method: 'GET', path: '/quotes/:id/pdf', summary: 'Package quotation for the client (letterhead, sections, premium and charges; no commission)', screen: `${BUNDLES} > Print`, middleware: canQuote,
  response: '(application/pdf)',
  handler: async (req, res) => {
    const q = await quotes.getPackageQuote(req.params.id, { scope: await scopeOf(req) });
    sendPdf(res, await issue.packageQuotePdf(q.id), `${q.quoteNumber}.pdf`, req.query.download ? 'attachment' : 'inline');
  },
});

// ------------------------------------------------------------------ package policies
const policyExample = { policyId: 'pol_0123456789abcdef', policyNumber: 'PKG-2026-00001', status: 'active', bundleName: 'SME Shield', inceptionDate: '2026-10-01', expiryDate: '2027-10-01',
  sumInsured: 3200000, netPremium: 8100, grossPremium: 10190.7, billNumber: 'INV-2026-00077', sections: quoteExample.sections, endorsements: [] };

define({
  method: 'GET', path: '/policies', summary: 'Package policies (status, clientId, search; paging)', screen: BUNDLES, middleware: readPolicies,
  query: { search: 'PKG-2026' }, response: { success: true, data: [policyExample], total: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows } = await issue.listPackagePolicies(await withScope(req), pg);
    ok(res, rows, 'OK', { total, page: pg.page, perPage: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'GET', path: '/policies/:policyId', summary: 'A package policy with its sections (insurer, premium, taxes, commission per section) and section endorsements', screen: BUNDLES,
  middleware: readPolicies, response: { success: true, data: policyExample },
  handler: async (req, res) => ok(res, await issue.getPackagePolicy(req.params.policyId, { scope: await scopeOf(req) })),
});
define({
  method: 'GET', path: '/policies/:policyId/schedule', summary: 'Package policy schedule PDF: one policy number, sections with their insurers, premium and charges', screen: `${BUNDLES} > Policy schedule`,
  middleware: readPolicies, response: '(application/pdf)',
  handler: async (req, res) => {
    const p = await issue.getPackagePolicy(req.params.policyId, { scope: await scopeOf(req) });
    sendPdf(res, await issue.packageSchedulePdf(p.policyId), `${p.policyNumber}.pdf`, req.query.download ? 'attachment' : 'inline');
  },
});
define({
  method: 'POST', path: '/policies/:policyId/sections/:sectionNo/endorse', summary: 'Endorse one section: new sum insured from a date; the additional premium (pro rata, less the package discount) is billed and due to that section\'s insurer only',
  screen: `${BUNDLES} > Endorse section`, middleware: [...canEndorse, validate(z.object({ sumInsured: z.coerce.number().positive().max(1e13), effectiveDate: date.optional(), remarks: z.string().max(1000).optional() }).strict())],
  request: { sumInsured: 2500000, effectiveDate: '2027-01-01', remarks: 'Additional stock' },
  response: { success: true, data: { endorsement: { endorsementNumber: 'END-2026-00012', sectionNo: 1, netPremium: 1125, totalAmount: 1425.6, billNumber: 'INV-2026-00090' }, policy: policyExample } },
  handler: async (req, res) => {
    const r = await issue.endorseSection(req.params.policyId, req.params.sectionNo, req.body, req.user, { scope: await scopeOf(req) });
    await audit(req, { entity: 'policy', entityId: r.policy.policyId, action: 'endorse-package-section', after: r.endorsement });
    created(res, r, `Endorsement ${r.endorsement.endorsementNumber} recorded`);
  },
});
define({
  method: 'POST', path: '/policies/:policyId/renew', summary: 'Renew the whole package: a package quotation for the next term with the same sections, sums insured and insurers at the rates in force',
  screen: `${BUNDLES} > Renew`, middleware: [...canRenew, validate(z.object({ lguCode: z.string().trim().max(20).optional(), remarks: z.string().max(1000).optional() }).strict())],
  request: {}, response: { success: true, data: { ...quoteExample, renewalOf: 'pol_0123456789abcdef' } },
  handler: async (req, res) => {
    const q = await issue.renewPackage(req.params.policyId, req.body, req.user, { scope: await scopeOf(req) });
    await audit(req, { entity: 'package_quote', entityId: q.id, action: 'renewal', after: q });
    created(res, q, `Renewal quotation ${q.quoteNumber} created`);
  },
});

export default router;
export const mount = '/packages';
