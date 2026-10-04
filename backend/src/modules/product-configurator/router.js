import { moduleRouter } from '../../lib/registry.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { created, ok, paging } from '../../lib/respond.js';
import { canRead, canWrite, sendList } from '../masters/helpers.js';
import * as svc from './service.js';
import { many } from '../../db/pool.js';
import { notFound } from '../../lib/errors.js';
import { evaluate, marketFor, RISK_FIELDS, OPERATORS, RULE_ACTIONS, RULE_TYPES } from './underwriting.js';
import { MERGE_FIELDS, BLOCKS, DEFAULT_LAYOUTS, PRINT_AS, LAYOUT_EXTENSIONS, LAYOUT_MAX, previewDoc } from '../documents/productDocuments.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';

/** Product Configurator: templates, configuration components, risk mapping, analytics and dashboard. */
const { router, define } = moduleRouter('Product Configurator', '/product-configurator');
const read = canRead('products');
const write = canWrite('products');
const tpl = {
  id: 3, templateCode: 'MOT-003-2025', name: 'Motor Insurance Basic Plan', category: 'Motor', lineOfBusiness: 'Motor Vehicle', status: 'Active', version: 'v3.2',
  effectiveDate: '2025-01-01', baseRate: 2.5, minPremium: 10000, commissionRate: 12, configuration: { premiumRates: { private_cars: '2' } }, features: {}, insurers: [], tags: [],
  _count: { coverages: 7, ratingFactors: 8, underwritingRules: 7 },
};

// ---------- templates ----------
define({
  method: 'GET', path: '/products', summary: 'Product templates (search, status, category; page / pageSize)', screen: 'Product Configurator > Product Templates; Dashboard',
  middleware: read, query: { search: 'motor', status: 'Active', page: 1, pageSize: 10 },
  response: { success: true, data: [tpl], page: 1, pageSize: 10, total: 1 },
  handler: async (req, res) => {
    const pg = paging({ ...req.query, perPage: req.query.pageSize ?? req.query.perPage }, { page: 1, perPage: 100 });
    const { rows, total } = await svc.listTemplates(req.query, pg);
    res.json({ success: true, data: rows, page: pg.page, pageSize: pg.perPage, total, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'GET', path: '/products/configurator', summary: 'Template with every component (by id or templateCode); fields are also returned at the top level for the quote screens', screen: 'Quotation wizard (coverage details, order summary); Product Configurator',
  middleware: canRead('products', 'read:quotations'), query: { templateCode: 'MOT-003-2025' },
  response: { success: true, data: { ...tpl, coverages: [], ratingFactors: [], underwritingRules: [] }, ...tpl },
  handler: async (req, res) => {
    if (!req.query.id && !req.query.templateCode) throw badRequest('id or templateCode is required');
    const t = await svc.getConfigurator({ id: req.query.id, templateCode: req.query.templateCode });
    res.json({ ...t, success: true, data: t });
  },
});
define({
  method: 'GET', path: '/products/:id', summary: 'One product template', screen: 'Product Configurator > Template', middleware: read,
  response: { success: true, data: tpl },
  handler: async (req, res) => ok(res, svc.templateOut(await svc.getTemplateRow({ id: req.params.id }))),
});
define({
  method: 'POST', path: '/products', summary: 'Create a product template', screen: 'Product Configurator > Product Templates > Create Template',
  middleware: write, request: { templateCode: 'FIRE-RES-2026', name: 'Home Fire Protect', category: 'Fire', lineOfBusiness: 'Fire', effectiveDate: '2026-01-01', status: 'Draft', description: 'Residential fire cover' },
  response: { success: true, data: tpl },
  handler: async (req, res) => {
    const t = await svc.createTemplate(req.body || {}, req.user);
    await audit(req, { entity: 'product_template', entityId: t.id, action: 'create', after: t });
    created(res, t, 'Template created');
  },
});
define({
  method: 'PUT', path: '/products/:id', summary: 'Update a product template (any subset of fields, including configuration)', screen: 'Product Configurator > Product Templates > Edit',
  middleware: write, request: { name: 'Motor Insurance Basic Plan', status: 'Active', baseRate: 2.5, configuration: { taxes: { vat: 12 } } }, response: { success: true, data: tpl },
  handler: async (req, res) => {
    const { before, after } = await svc.updateTemplate(req.params.id, req.body || {}, req.user);
    await audit(req, { entity: 'product_template', entityId: req.params.id, action: 'update', before, after });
    ok(res, after, 'Template updated');
  },
});
for (const action of ['retire', 'reactivate']) {
  define({
    method: 'POST', path: `/products/:id/${action}`, summary: `${action === 'retire' ? 'Retire' : 'Reactivate'} a product template`, screen: 'Product Configurator > Product Templates',
    middleware: write, request: action === 'retire' ? { reason: 'Replaced by 2027 plan' } : {}, response: { success: true, data: { ...tpl, status: action === 'retire' ? 'Retired' : 'Active' } },
    handler: async (req, res) => {
      const { before, after } = await svc.setTemplateLifecycle(req.params.id, action, req.body?.reason, req.user);
      await audit(req, { entity: 'product_template', entityId: req.params.id, action, before, after });
      ok(res, after, `Template ${action === 'retire' ? 'retired' : 'reactivated'}`);
    },
  });
}
define({
  method: 'GET', path: '/products/:id/versions', summary: 'All versions of a template code', screen: 'Product Configurator > Template > Versions', middleware: read,
  response: { success: true, data: [{ ...tpl, isCurrent: true }] },
  handler: async (req, res) => ok(res, await svc.listVersions(req.params.id)),
});
define({
  method: 'POST', path: '/products/:id/versions', summary: 'Create the next draft version (clones configuration and components)', screen: 'Product Configurator > Template > New Version',
  middleware: write, request: { version: 'v4', effectiveDate: '2027-01-01' }, response: { success: true, data: { ...tpl, status: 'Draft', version: 'v4' } },
  handler: async (req, res) => {
    const t = await svc.newVersion(req.params.id, req.body || {}, req.user);
    await audit(req, { entity: 'product_template', entityId: t.id, action: 'new-version', after: t });
    created(res, t, 'New version created');
  },
});
define({
  method: 'GET', path: '/products/:id/history', summary: 'Change history of a product template (audit trail)', screen: 'Product Configurator > Product Templates > History', middleware: read,
  response: { success: true, data: [{ id: 1, action: 'update', at: '2026-01-01T00:00:00Z', user: 'admin', changes: [{ field: 'status', from: 'Draft', to: 'Active' }] }] },
  handler: async (req, res) => ok(res, await svc.templateHistory(req.params.id)),
});
define({
  method: 'GET', path: '/products/:id/insurers', summary: 'Insurer panel of a template with market-mapping terms', screen: 'Product Configurator > Market Mapping', middleware: read,
  response: { success: true, data: [{ insurerName: 'Malayan Insurance Co., Inc.', insurerId: 2, onPanel: true, defaultCommissionRate: 15, mapping: null }] },
  handler: async (req, res) => ok(res, await svc.insurerPanel(req.params.id)),
});
define({
  method: 'PUT', path: '/products/:id/insurers', summary: 'Set the insurer panel (insurer names or codes; must be active insurance companies)', screen: 'Product Configurator > Market Mapping',
  middleware: write, request: { insurers: ['MALAYAN', 'Pioneer Insurance & Surety Corp.'] }, response: { success: true, data: { ...tpl, insurers: ['Malayan Insurance Co., Inc.'] } },
  handler: async (req, res) => {
    const { before, after } = await svc.setInsurerPanel(req.params.id, req.body?.insurers, req.user);
    await audit(req, { entity: 'product_template', entityId: req.params.id, action: 'insurer-panel', before: before.insurers, after: after.insurers });
    ok(res, after, 'Insurer panel updated');
  },
});
define({
  method: 'POST', path: '/products/:id/calculate-premium', summary: 'Premium illustration from the template (base rate, factors, minimum, statutory taxes, commission)', screen: 'Product Configurator > Rating Engine',
  middleware: canRead('products', 'read:quotations'), request: { sumInsured: 1200000, factors: { VEH_AGE: 1.1, NCB: 0.9 } },
  response: { success: true, data: { basePremium: 30000, adjustedPremium: 29700, totalTax: 3935.25, grossPremium: 33635.25, commission: 3564, netPremium: 26136 } },
  handler: async (req, res) => ok(res, await svc.calculatePremium(req.params.id, req.body || {})),
});

// ---------- components ----------
for (const [kind, def] of Object.entries(svc.KINDS)) {
  const screen = `Product Configurator > ${def.label}s`;
  define({
    method: 'GET', path: `/${kind}`, summary: `${def.label}s (filter productId / templateCode / status / search)`, screen, middleware: read, query: { productId: 3 },
    response: { success: true, data: [{ id: 1, productId: 3, [def.code]: 'CODE', [def.name]: 'Name', status: 'Active' }], total: 1 },
    handler: async (req, res) => {
      const pg = paging(req.query, { page: 1, perPage: 200 });
      const { rows, total } = await svc.listComponents(kind, req.query, pg);
      sendList(res, rows, total, pg);
    },
  });
  define({
    method: 'GET', path: `/${kind}/:id`, summary: `One ${def.label.toLowerCase()}`, screen, middleware: read, response: { success: true, data: { id: 1 } },
    handler: async (req, res) => ok(res, await svc.getComponent(kind, req.params.id)),
  });
  define({
    method: 'POST', path: `/${kind}`, summary: `Create a ${def.label.toLowerCase()} (required: ${def.required.join(', ')})`, screen, middleware: write,
    request: { productId: 3, ...Object.fromEntries(def.required.map((f) => [f, def.numbers.includes(f) ? 1 : 'value'])) }, response: { success: true, data: { id: 1 } },
    handler: async (req, res) => {
      const c = await svc.createComponent(kind, req.body || {}, req.user);
      await audit(req, { entity: `product_${kind}`, entityId: c.id, action: 'create', after: c });
      created(res, c, `${def.label} created`);
    },
  });
  define({
    method: 'PUT', path: `/${kind}/:id`, summary: `Update a ${def.label.toLowerCase()}`, screen, middleware: write, request: { status: 'Inactive' }, response: { success: true, data: { id: 1 } },
    handler: async (req, res) => {
      const { before, after } = await svc.updateComponent(kind, req.params.id, req.body || {}, req.user);
      await audit(req, { entity: `product_${kind}`, entityId: req.params.id, action: 'update', before, after });
      ok(res, after, `${def.label} updated`);
    },
  });
  define({
    method: 'GET', path: `/${kind}/:id/history`, summary: `Change history of a ${def.label.toLowerCase()} (audit trail)`, screen, middleware: read,
    response: { success: true, data: [{ id: 1, action: 'update', at: '2026-01-01T00:00:00Z', user: 'admin', changes: [{ field: 'status', from: 'Active', to: 'Inactive' }] }] },
    handler: async (req, res) => ok(res, await svc.componentHistory(kind, req.params.id)),
  });
  define({
    method: 'DELETE', path: `/${kind}/:id`, summary: `Delete a ${def.label.toLowerCase()} (soft)`, screen, middleware: write, response: { success: true },
    handler: async (req, res) => {
      const before = await svc.deleteComponent(kind, req.params.id, req.user);
      await audit(req, { entity: `product_${kind}`, entityId: req.params.id, action: 'delete', before });
      ok(res, { id: Number(req.params.id) }, `${def.label} deleted`);
    },
  });
}

// ---------- rules in the business flow ----------
define({
  method: 'GET', path: '/underwriting/options', summary: 'What an acceptance rule can test and do: risk fields, operators, actions, rule types, authority roles, quote cover fields',
  screen: 'Product Configurator > Acceptance Rules > Add / edit rule', middleware: read,
  response: { success: true, data: { fields: [{ value: 'vehicleAge', label: 'Vehicle age (years)', type: 'number' }], operators: ['<='], actions: ['Refer'], types: ['Acceptance'], roles: [{ value: 'processing', label: 'Processing Team' }] } },
  handler: async (_req, res) => ok(res, {
    fields: Object.entries(RISK_FIELDS).map(([value, f]) => ({ value, label: f.label, type: f.type, options: f.options || null })),
    operators: OPERATORS, actions: RULE_ACTIONS, types: RULE_TYPES, quoteFields: svc.QUOTE_FIELDS,
    roles: (await many('SELECT code, name FROM roles ORDER BY name')).map((r) => ({ value: r.code, label: r.name })),
  }),
});
define({
  method: 'POST', path: '/underwriting/evaluate', summary: 'Test a risk against the acceptance rules and rating factors of a template (or of the template governing a product / line)',
  screen: 'Product Configurator > Acceptance Rules > Test a risk', middleware: canRead('products', 'read:quotations'),
  request: { templateCode: 'MOT-003-2025', insurerId: 2, risk: { modelYear: 2008, vehicleType: 'private_cars', totalSumInsured: 800000 } },
  response: { success: true, data: { templateCode: 'MOT-003-2025', decision: 'referred', results: [{ ruleCode: 'VEH_AGE_LIMIT', outcome: 'referred' }], loadingPercent: 0, factors: [] } },
  handler: async (req, res) => {
    const b = req.body || {};
    const r = await evaluate(b.risk || {}, { insurerId: b.insurerId || null, productId: b.productId || null, lob: b.lob || null, templateCode: b.templateCode || null });
    if (!r) throw notFound('No active product template governs this product / line of business');
    ok(res, r);
  },
});
define({
  method: 'GET', path: '/market', summary: 'Insurer market of a product (insurer panel of its templates in force plus active market mappings); restricted=false when no template names an insurer',
  screen: 'Request for Quotation > Insurers to approach; Quick Quote > Compare Insurers', middleware: canRead('products', 'read:quotations'), query: { productId: 2 },
  response: { success: true, data: { restricted: true, insurerIds: [2], insurers: [{ id: 2, name: 'Malayan Insurance Co., Inc.' }], templateCodes: ['MOT-003-2025'] } },
  handler: async (req, res) => ok(res, await marketFor({ productId: req.query.productId || null, lob: req.query.lob || null })),
});
define({
  method: 'GET', path: '/document-merge-fields', summary: 'Layout format of document templates: merge fields, blocks, accepted files and the default layout of each document type',
  screen: 'Product Configurator > Document Manager > Merge fields', middleware: read,
  response: { success: true, data: { fields: [{ name: 'PolicyNumber', label: 'Policy number' }], blocks: [{ name: 'Premium', label: 'Premium breakdown' }], printAs: ['policy-schedule'], extensions: ['.txt', '.md'], maxLength: 20000, defaults: { 'policy-schedule': '= Policy Schedule' } } },
  handler: async (_req, res) => ok(res, {
    fields: Object.entries(MERGE_FIELDS).map(([name, f]) => ({ name, label: f.label })), blocks: Object.entries(BLOCKS).map(([name, b]) => ({ name, label: b.label })),
    printAs: PRINT_AS, extensions: LAYOUT_EXTENSIONS, maxLength: LAYOUT_MAX, defaults: DEFAULT_LAYOUTS,
  }),
});
define({
  method: 'GET', path: '/documents/:id/layout', summary: 'Download the layout of a document template (the uploaded one, else the default layout of its document type) as a text file',
  screen: 'Product Configurator > Document Manager > Download', middleware: read, response: 'text/plain',
  handler: async (req, res) => {
    const d = await svc.getComponent('documents', req.params.id);
    const text = d.layout || DEFAULT_LAYOUTS[d.printAs] || DEFAULT_LAYOUTS['policy-schedule'];
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${d.layoutFileName || `${d.documentCode}-layout.txt`}"`);
    res.send(text);
  },
});
define({
  method: 'GET', path: '/documents/:id/preview', summary: 'Preview a document template on sample data (PDF)', screen: 'Product Configurator > Document Manager > Preview',
  middleware: read, response: 'application/pdf',
  handler: async (req, res) => {
    const d = await svc.getComponent('documents', req.params.id);
    sendPdf(res, buildPdf(await previewDoc(d)), `${d.documentCode}-preview.pdf`);
  },
});

// ---------- analytics / dashboard ----------
define({
  method: 'GET', path: '/analytics', summary: 'Product analytics from issued policies and claims: top products, performance trend, category breakdown', screen: 'Product Configurator > Product Analytics; Dashboard',
  middleware: read, response: { success: true, data: { topProducts: [{ productId: 1, productName: 'Motor Vehicle Insurance', totalPolicies: 12, totalPremium: 360000, lossRatio: 35.2, growth: 12.3 }], performanceTrend: [{ month: 'Sep', premium: 60000, policies: 2, lossRatio: 0 }], categoryBreakdown: { Motor: { percentage: 60, premium: 360000, count: 12 } } } },
  handler: async (_req, res) => ok(res, await svc.analytics()),
});
define({
  method: 'GET', path: '/dashboard', summary: 'Product configurator dashboard: template counts, categories, components, recent / expiring templates, analytics', screen: 'Product Configurator > Dashboard',
  middleware: read, response: { success: true, data: { summary: { totalTemplates: 12, active: 8, draft: 2, retired: 1, components: { coverages: 10 } }, recentTemplates: [tpl] } },
  handler: async (_req, res) => ok(res, await svc.dashboard()),
});

// ---------- risk mapping ----------
const rm = { id: 'prm_iar', productCode: 'PRD-IAR', lobCode: 'IAR', productName: 'Industrial All Risks (IAR)', definitionType: 'RISK_SECTIONS', status: 'Active', configuration: { type: 'IAR', defaultVatPercent: 12 }, sectionCount: 1, sections: [{ id: 'prs_iar_fire', sectionCode: 'FIRE', sectionLabel: 'Fire Material Damage', defaultRatePercent: 0.15, isActive: true }] };
define({
  method: 'GET', path: '/risk-mappings', summary: 'Risk mappings (search, status, definitionType)', screen: 'Product Configurator > Risk Mapping',
  middleware: read, query: { search: 'fire', status: 'Active', definitionType: 'RISK_SECTIONS' }, response: { success: true, data: [rm], total: 1 },
  handler: async (req, res) => {
    const rows = await svc.listRiskMappings(req.query);
    res.json({ success: true, data: rows, total: rows.length });
  },
});
define({
  method: 'POST', path: '/risk-mappings', summary: 'Add a product line to risk mapping', screen: 'Product Configurator > Risk Mapping', middleware: write,
  request: { productCode: 'PRD-MAR', lobCode: 'MARINE', productName: 'Marine Cargo', lineOfBusiness: 'Non-life · Marine', definitionType: 'PROPERTY_RISK_FIELDS', definitionLabel: 'Property risk fields', status: 'Draft' },
  response: { success: true, data: rm },
  handler: async (req, res) => {
    const m = await svc.createRiskMapping(req.body || {}, req.user);
    await audit(req, { entity: 'risk_mapping', entityId: m.id, action: 'create', after: m });
    created(res, m, 'Risk mapping created');
  },
});
define({
  method: 'GET', path: '/risk-mappings/:id', summary: 'One risk mapping with its sections (includeInactive=true for deactivated ones)', screen: 'Product Configurator > Risk Mapping > Detail',
  middleware: read, query: { includeInactive: true }, response: { success: true, data: rm },
  handler: async (req, res) => ok(res, await svc.getRiskMapping(req.params.id, String(req.query.includeInactive) === 'true')),
});
define({
  method: 'PUT', path: '/risk-mappings/:id', summary: 'Update a risk mapping (configuration JSON, status, labels)', screen: 'Product Configurator > Risk Mapping > Save configuration',
  middleware: write, request: { configuration: { type: 'CTPL', fields: ['plateNo'] }, status: 'Active' }, response: { success: true, data: rm },
  handler: async (req, res) => {
    const { before, after } = await svc.updateRiskMapping(req.params.id, req.body || {}, req.user);
    await audit(req, { entity: 'risk_mapping', entityId: req.params.id, action: 'update', before, after });
    ok(res, after, 'Risk mapping updated');
  },
});
define({
  method: 'GET', path: '/risk-mappings/:id/history', summary: 'Change history of a risk mapping (audit trail)', screen: 'Product Configurator > Risk Mapping > History', middleware: read,
  response: { success: true, data: [{ id: 1, action: 'update', at: '2026-01-01T00:00:00Z', user: 'admin', changes: [{ field: 'status', from: 'Draft', to: 'Active' }] }] },
  handler: async (req, res) => ok(res, await svc.riskMappingHistory(req.params.id)),
});
define({
  method: 'GET', path: '/risk-mappings/:id/section-options', summary: 'Risk sections that can still be added (from the risk-section master)', screen: 'Product Configurator > Risk Mapping > IAR sections',
  middleware: read, response: { success: true, data: [{ sectionCode: 'MB', sectionLabel: 'Machinery Breakdown', defaultRatePercent: 0.2 }] },
  handler: async (req, res) => ok(res, await svc.sectionOptions(req.params.id)),
});
define({
  method: 'POST', path: '/risk-mappings/:id/sections', summary: 'Add (or re-activate) a risk section', screen: 'Product Configurator > Risk Mapping > IAR sections',
  middleware: write, request: { sectionCode: 'MB', remarks: 'Plant machinery', defaultRatePercent: 0.2 }, response: { success: true, data: rm },
  handler: async (req, res) => {
    const m = await svc.addSection(req.params.id, req.body || {}, req.user);
    await audit(req, { entity: 'risk_mapping', entityId: req.params.id, action: 'add-section', after: req.body });
    created(res, m, 'Section added');
  },
});
define({
  method: 'PUT', path: '/risk-mappings/:id/sections/:sectionId', summary: 'Update a risk section (remarks, default rate, sort order)', screen: 'Product Configurator > Risk Mapping > IAR sections',
  middleware: write, request: { remarks: 'Updated', defaultRatePercent: 0.25 }, response: { success: true, data: rm },
  handler: async (req, res) => {
    const { before, after } = await svc.updateSection(req.params.id, req.params.sectionId, req.body || {}, req.user);
    await audit(req, { entity: 'risk_mapping', entityId: req.params.id, action: 'update-section', before, after: req.body });
    ok(res, after, 'Section updated');
  },
});
define({
  method: 'POST', path: '/risk-mappings/:id/sections/:sectionId/deactivate', summary: 'Deactivate a risk section', screen: 'Product Configurator > Risk Mapping > IAR sections',
  middleware: write, response: { success: true, data: rm },
  handler: async (req, res) => {
    const { before, after } = await svc.deactivateSection(req.params.id, req.params.sectionId, req.user);
    await audit(req, { entity: 'risk_mapping', entityId: req.params.id, action: 'deactivate-section', before });
    ok(res, after, 'Section deactivated');
  },
});

export default router;
export const mount = '/product-configurator';
