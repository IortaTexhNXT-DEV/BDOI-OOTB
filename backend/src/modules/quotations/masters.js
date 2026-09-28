/**
 * Reference data read by the Motor quote wizard, at the paths in routes/apiRoutes.js (APIROUTES.QUOTE / QUOTEDETAIL):
 * vehicle brands / models / variants / seating, insurers, policy types, BI / PD / PA coverages, signatories, banks
 * (mortgagees) and the legacy premium calculation endpoint.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { many } from '../../db/pool.js';
import { ok } from '../../lib/respond.js';
import { premiumBreakdown } from './premium.js';

const { router, define } = moduleRouter('Quotation masters', '');
const SCREEN = 'Operations > Quotation > Create Quote (policy / coverage details)';
const canRead = [requireAuth, requirePermission('read:quotations', 'read:masters')];
const ref = (v) => (v === undefined || v === null || v === '' ? null : String(v));

define({
  method: 'GET', path: '/master/vehicle/get-brands', summary: 'Vehicle brands', screen: SCREEN, middleware: canRead,
  response: { success: true, data: [{ id: 1, name: 'Toyota', brandName: 'Toyota' }] },
  handler: async (_req, res) => ok(res, await many("SELECT id, name, name AS \"brandName\" FROM vehicle_brands WHERE status = 'active' ORDER BY name")),
});
define({
  method: 'GET', path: '/master/vehicle/get-vehicle-types', summary: 'Vehicle body types (from the variants master)', screen: SCREEN, middleware: canRead,
  response: { success: true, data: [{ id: 'SUV', name: 'SUV' }] },
  handler: async (_req, res) => ok(res, await many("SELECT DISTINCT body_type AS id, body_type AS name FROM vehicle_variants WHERE body_type IS NOT NULL AND status = 'active' ORDER BY 1")),
});
define({
  method: 'GET', path: '/master/vehicle/get-models', summary: 'Models of a brand (brand id or name)', screen: SCREEN, middleware: canRead, query: { brand: 'Toyota' },
  response: { success: true, data: [{ id: 1, name: 'Vios', modelName: 'Vios', brandId: 1 }] },
  handler: async (req, res) => ok(res, await many(`SELECT m.id, m.name, m.name AS "modelName", m.brand_id AS "brandId", b.name AS "brandName"
    FROM vehicle_models m JOIN vehicle_brands b ON b.id = m.brand_id WHERE m.status = 'active' AND ($1::text IS NULL OR b.id::text = $1 OR lower(b.name) = lower($1)) ORDER BY m.name`, [ref(req.query.brand ?? req.query.brandId)])),
});
define({
  method: 'GET', path: '/master/vehicle/get-variants', summary: 'Variants of a model (model id or name)', screen: SCREEN, middleware: canRead, query: { model: 'Vios' },
  response: { success: true, data: [{ id: 1, name: '1.3 XLE CVT', variantName: '1.3 XLE CVT', bodyType: 'Sedan', seatingCapacity: 5 }] },
  handler: async (req, res) => ok(res, await many(`SELECT v.id, v.name, v.name AS "variantName", v.body_type AS "bodyType", v.seating AS "seatingCapacity", v.model_id AS "modelId"
    FROM vehicle_variants v JOIN vehicle_models m ON m.id = v.model_id WHERE v.status = 'active' AND ($1::text IS NULL OR m.id::text = $1 OR lower(m.name) = lower($1)) ORDER BY v.name`, [ref(req.query.model ?? req.query.modelId)])),
});
define({
  method: 'GET', path: '/master/vehicle/get-seating-capacity', summary: 'Seating capacities (optionally of one variant)', screen: SCREEN, middleware: canRead, query: { variant: '1.3 XLE CVT' },
  response: { success: true, data: [{ id: 5, seatingCapacity: 5, name: '5' }] },
  handler: async (req, res) => ok(res, await many(`SELECT DISTINCT seating AS id, seating AS "seatingCapacity", seating::text AS name FROM vehicle_variants
    WHERE seating IS NOT NULL AND status = 'active' AND ($1::text IS NULL OR id::text = $1 OR lower(name) = lower($1)) ORDER BY 1`, [ref(req.query.variant ?? req.query.variantId)])),
});
define({
  method: 'GET', path: '/master/insurancecompany/get-insurance-companies', summary: 'Insurance companies', screen: SCREEN, middleware: canRead,
  response: { success: true, data: [{ id: 1, code: 'MALAYAN', name: 'Malayan Insurance Co., Inc.', commissionRate: 0.15 }] },
  handler: async (_req, res) => ok(res, await many(`SELECT id, code, name, short_name AS "shortName", commission_rate AS "commissionRate", contact_email AS "contactEmail",
    name AS label, name AS value FROM insurance_companies WHERE status = 'active' ORDER BY name`)),
});
define({
  method: 'GET', path: '/master/policyType/policy-type', summary: 'Policy types of a product (productId = id or code)', screen: SCREEN, middleware: canRead, query: { productId: 'MOTOR' },
  response: { success: true, data: [{ id: 1, code: 'COMP', name: 'Comprehensive', productId: 1 }] },
  handler: async (req, res) => ok(res, await many(`SELECT t.id, t.code, t.name, t.product_id AS "productId", p.name AS "productName" FROM policy_types t
    LEFT JOIN products p ON p.id = t.product_id WHERE t.status = 'active' AND ($1::text IS NULL OR p.id::text = $1 OR lower(p.code) = lower($1)) ORDER BY t.name`, [ref(req.query.productId)])),
});
for (const [kind, path] of [['bi', '/biCoverage/get-bi-coverage'], ['pd', '/pdCoverage/get-pd-coverages'], ['pa', '/paCoverage/get-pa-coverages']]) {
  define({
    method: 'GET', path, summary: `${kind.toUpperCase()} coverage options (amount and flat premium) for a policy type`, screen: SCREEN, middleware: canRead, query: { PolicyTypeId: 1 },
    response: { success: true, data: [{ id: 1, label: 'Bodily Injury 100,000', amount: 100000, premium: 450 }] },
    handler: async (req, res) => ok(res, await many(`SELECT c.id, c.label, c.amount, c.premium, c.kind, c.policy_type_id AS "policyTypeId" FROM coverages c
      LEFT JOIN policy_types t ON t.id = c.policy_type_id WHERE c.kind = $1 AND c.status = 'active'
      AND ($2::text IS NULL OR t.id::text = $2 OR lower(t.code) = lower($2)) ORDER BY c.amount`, [kind, ref(req.query.PolicyTypeId ?? req.query.policyTypeId)])),
  });
}
define({
  method: 'GET', path: '/master/account-codes', summary: 'Account codes for a quote: active referrers (agents, sub-agents, external) as dropdown options', screen: SCREEN, middleware: canRead,
  response: { success: true, data: [{ id: 'ref-jdelacruz', code: 'ref-jdelacruz', label: 'Juan Dela Cruz (Agent)', value: 'ref-jdelacruz', type: 'Agent' }] },
  handler: async (_req, res) => ok(res, await many(`SELECT id, id AS code, name || ' (' || referrer_type || ')' AS label, id AS value, referrer_type AS type
    FROM commission_referrers WHERE lower(status) = 'active' ORDER BY name`)),
});
define({
  method: 'GET', path: '/master/signatory/get-all-signatory', summary: 'Authorised signatories', screen: `${SCREEN} > Order summary`, middleware: canRead,
  response: { success: true, data: [{ id: 1, name: 'Maria Regina Cruz', designation: 'President & CEO' }] },
  handler: async (_req, res) => ok(res, await many("SELECT id, name, designation, signature_key AS \"signatureKey\" FROM signatories WHERE status = 'active' ORDER BY name")),
});
define({
  method: 'GET', path: '/master/banks/get-all-banks', summary: 'Banks / mortgagees', screen: 'Operations > Quotation > Convert to policy (mortgagee)', middleware: canRead,
  response: { success: true, data: [{ id: 1, code: 'BDO', name: 'Banco de Oro' }] },
  handler: async (_req, res) => ok(res, await many("SELECT id, code, name, swift_code AS \"swiftCode\", name AS label, name AS value FROM banks WHERE status = 'active' ORDER BY name")),
});
define({
  method: 'POST', path: '/quote/calculate-premium-quote', summary: 'Legacy premium calculation (same as POST /quotations/calculate-premium)', screen: SCREEN,
  middleware: canRead, request: { lossAndDamageCoverage: 1000000, lossAndDamageCoverageRate: 1.5 }, response: { success: true, data: { netPremium: 15000, grossPremium: 19856.25 } },
  handler: async (req, res) => ok(res, await premiumBreakdown(req.body || {})),
});

export default router;
