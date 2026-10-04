/**
 * Product document templates (Product Configurator > Document Manager) used when printing and e-mailing.
 *
 * A document template of a product template says what a document is printed as (printAs: policy-schedule,
 * ctpl-certificate, quotation-slip, member-enrollment) and may carry an uploaded layout that replaces the generated
 * layout. A layout is a text file (.txt / .md, UTF-8) in this format:
 *
 *   = Motor Policy Schedule {{PolicyNumber}}     document title (first "=" line)
 *   # Policy                                      section heading
 *   Policy number: {{PolicyNumber}}               "Label: value" lines are the rows of the section
 *   Any other line is printed as a paragraph of the section.
 *   {{#Premium}}                                  a block on its own line: a generated table (see BLOCKS)
 *
 * Merge fields ({{Field}}) and blocks ({{#Block}}) are listed in MERGE_FIELDS and BLOCKS; an unknown name is refused
 * when the layout is saved. Every generated document is a PDF on the company letterhead.
 */
import { many } from '../../db/pool.js';
import { humanize } from '../../lib/pdf/format.js';
import { num } from './common.js';
import { header, formatters, riskSection, coverageSection, premiumTable, policyPremium, lineOf } from './templates.js';
import { governingTemplate } from '../product-configurator/underwriting.js';
import { today } from '../../lib/dates.js';

export const PRINT_AS = ['policy-schedule', 'ctpl-certificate', 'quotation-slip', 'member-enrollment'];
export const LAYOUT_MAX = 20000;
export const LAYOUT_EXTENSIONS = ['.txt', '.md'];

const vehicle = (x) => (Array.isArray(x.insuranceVehicleDetails) ? x.insuranceVehicleDetails[0] : x.insuranceVehicleDetails) || {};
const present = (v) => v !== null && v !== undefined && String(v).trim() !== '';

/** Merge fields: name -> { label, get(x, f, h) }. */
export const MERGE_FIELDS = {
  CompanyName: { label: 'Broker company name (letterhead)', get: (x, f, h) => h.letterhead?.name },
  PolicyNumber: { label: 'Policy number', get: (x) => x.policyNumber },
  QuotationNumber: { label: 'Quotation number', get: (x) => x.quotationNumber || x.quotation?.quotationNumber },
  InsuredName: { label: 'Insured / customer name', get: (x) => x.insuredName || x.customerName || [x.lead?.firstName, x.lead?.lastName].filter(Boolean).join(' ') || x.lead?.companyName },
  InsurerName: { label: 'Insurer', get: (x) => x.insuranceCompanyName },
  ProductName: { label: 'Product', get: (x) => x.productName || x.productType },
  PeriodFrom: { label: 'Period from', get: (x, f) => f.date(x.inception || x.inceptionDate) },
  PeriodTo: { label: 'Period to', get: (x, f) => f.date(x.expiry || x.expiryDate) },
  IssueDate: { label: 'Date issued', get: (x, f) => f.date(x.issuedDate || x.createdAt) },
  ValidUntil: { label: 'Quotation valid until', get: (x, f) => f.date(x.validUntil) },
  SumInsured: { label: 'Sum insured', get: (x, f) => (num(x.sumInsured ?? x.totalSumInsured) ? f.ccy(x.sumInsured ?? x.totalSumInsured, x.currency) : '') },
  CoverageAmount: { label: 'Amount of cover (sum insured)', get: (x, f) => (num(x.sumInsured ?? x.totalSumInsured) ? f.ccy(x.sumInsured ?? x.totalSumInsured, x.currency) : '') },
  NetPremium: { label: 'Net premium', get: (x, f) => f.ccy(x.netPremium, x.currency) },
  GrossPremium: { label: 'Gross premium', get: (x, f) => f.ccy(x.grossPremium ?? x.premiumTotal, x.currency) },
  Premium: { label: 'Gross premium', get: (x, f) => f.ccy(x.grossPremium ?? x.premiumTotal, x.currency) },
  CtplPremium: { label: 'CTPL premium (tariff)', get: (x, f) => (num(x.ctplCoveragePremium) ? f.ccy(x.ctplCoveragePremium, x.currency) : '') },
  Currency: { label: 'Currency', get: (x, f) => x.currency || f.currency },
  PlateNumber: { label: 'Plate number', get: (x) => x.plateNumber || vehicle(x).plateNumber },
  ChassisNumber: { label: 'Chassis number', get: (x) => x.chassisNumber || vehicle(x).chassisNumber },
  MotorNumber: { label: 'Motor / engine number', get: (x) => x.motorNumber || vehicle(x).motorNumber },
  VehicleDetails: { label: 'Vehicle (year, brand, model)', get: (x) => [vehicle(x).modelYear || x.modelYear, vehicle(x).vehicleBrand || x.vehicleBrand, vehicle(x).vehicleModel || x.vehicleModel].filter(Boolean).join(' ') },
  VehicleType: { label: 'Vehicle class', get: (x) => humanize(x.vehicleType || vehicle(x).vehicleType || '') },
  ModelYear: { label: 'Model year', get: (x) => vehicle(x).modelYear || x.modelYear },
  Today: { label: 'Date printed', get: (x, f) => f.date(x.__today) },
};

/** Blocks: a generated part of the standard documents. */
export const BLOCKS = {
  RiskDetails: { label: 'Risk details (vehicle, location or the risk of the line)', build: (x, f) => [riskSection(x, f)] },
  Coverage: { label: 'Covers with sum insured and premium', build: (x, f) => [coverageSection(x, f)] },
  CoverageDetails: { label: 'Covers with sum insured and premium', build: (x, f) => [coverageSection(x, f)] },
  Premium: { label: 'Premium breakdown (net, taxes, gross)', build: (x) => [premiumTable(x, x.currency)] },
  CoverTerms: { label: 'Cover terms of the product: deductibles and exclusions', build: (x) => [x.__coverTerms] },
  MemberList: { label: 'Members (name, birth date, plan)', build: (x) => [memberTable(x)] },
  Signatures: { label: 'Signature lines (broker and insured)', build: () => [{ signatures: [{ label: 'For the broker' }, { label: 'Insured' }], perRow: 2 }] },
};

function memberTable(x) {
  const members = Array.isArray(x.members) ? x.members : Array.isArray(x.riskDetails?.members) ? x.riskDetails.members : [];
  if (!members.length) return { heading: 'Members', text: 'Member list to be attached.' };
  return { heading: 'Members', table: { columns: ['Name', 'Birth date', 'Plan'], rows: members.map((m) => [m.name || [m.firstName, m.lastName].filter(Boolean).join(' '), m.birthDate || '', m.plan || '']) } };
}

/** Placeholders used by a layout: { fields, blocks, unknown }. */
export function placeholders(text) {
  const fields = new Set();
  const blocks = new Set();
  const unknown = new Set();
  for (const m of String(text || '').matchAll(/\{\{\s*(#?)([A-Za-z][A-Za-z0-9]*)\s*\}\}/g)) {
    if (m[1]) (BLOCKS[m[2]] ? blocks : unknown).add(`#${m[2]}`.slice(BLOCKS[m[2]] ? 1 : 0));
    else (MERGE_FIELDS[m[2]] ? fields : unknown).add(m[2]);
  }
  const malformed = String(text || '').match(/\{\{[^}]*$|\{\{\s*\}\}/m);
  if (malformed) unknown.add(malformed[0].slice(0, 20));
  return { fields: [...fields], blocks: [...blocks], unknown: [...unknown] };
}

/** Checks of an uploaded layout; returns [{ path, message }]. */
export function layoutErrors(text, fileName = null) {
  const errors = [];
  if (fileName && !LAYOUT_EXTENSIONS.some((e) => String(fileName).toLowerCase().endsWith(e))) {
    errors.push({ path: 'layoutFileName', message: `A layout must be a text file (${LAYOUT_EXTENSIONS.join(', ')}); Word, Excel and PDF files cannot be merged` });
  }
  if (typeof text !== 'string' || !text.trim()) errors.push({ path: 'layout', message: 'The layout is empty' });
  else {
    if (text.length > LAYOUT_MAX) errors.push({ path: 'layout', message: `The layout is longer than ${LAYOUT_MAX} characters` });
    const p = placeholders(text);
    if (p.unknown.length) errors.push({ path: 'layout', message: `Unknown merge field(s): ${p.unknown.join(', ')}. Use the merge fields listed in Document Manager > Merge fields` });
    else if (!p.fields.length && !p.blocks.length) errors.push({ path: 'layout', message: 'The layout has no merge field: it would print the same text for every record' });
  }
  return errors;
}

const fill = (s, x, f, h) => String(s).replace(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}/g, (_, k) => {
  const v = MERGE_FIELDS[k]?.get(x, f, h);
  return present(v) ? String(v) : '-';
});

/** Document spec of a layout for a record x (policy or quotation shaped as the standard prints use it). */
export async function layoutDoc(layout, x, { title: fallbackTitle, number }) {
  const h0 = await header(fallbackTitle, number);
  x.__today = await today();
  const f = formatters(h0);
  const sections = [];
  let cur = { heading: null, rows: [], text: [] };
  let title = fallbackTitle;
  const flush = () => {
    if (cur.rows.length) sections.push({ heading: cur.heading || undefined, rows: cur.rows });
    const text = cur.text.join('\n').trim();
    if (text) sections.push({ heading: cur.rows.length ? undefined : cur.heading || undefined, text });
    else if (!cur.rows.length && cur.heading) sections.push({ heading: cur.heading, text: ' ' });
    cur = { heading: null, rows: [], text: [] };
  };
  for (const raw of String(layout).replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd();
    const block = line.trim().match(/^\{\{\s*#([A-Za-z0-9]+)\s*\}\}$/);
    if (line.startsWith('= ') && title === fallbackTitle && !sections.length && !cur.heading) { title = fill(line.slice(2).trim(), x, f, h0); continue; }
    if (line.startsWith('# ')) { flush(); cur.heading = fill(line.slice(2).trim(), x, f, h0); continue; }
    if (block) { flush(); sections.push(...(BLOCKS[block[1]]?.build(x, f) || []).filter(Boolean)); continue; }
    const row = line.match(/^([^:{}]{1,40}):\s+(.*)$/);
    if (row) { cur.rows.push([row[1].trim(), fill(row[2], x, f, h0)]); continue; }
    cur.text.push(fill(line, x, f, h0));
  }
  flush();
  return { ...h0, title, meta: [], sections };
}

/** Default layouts: what Download gives for a template without an upload, and the starting point of a new one. */
export const DEFAULT_LAYOUTS = {
  'policy-schedule': `= Policy Schedule
# Policy
Policy number: {{PolicyNumber}}
Insured: {{InsuredName}}
Insurer: {{InsurerName}}
Product: {{ProductName}}
Period from: {{PeriodFrom}}
Period to: {{PeriodTo}}
Date issued: {{IssueDate}}
Sum insured: {{SumInsured}}
{{#RiskDetails}}
{{#Coverage}}
{{#Premium}}
{{#CoverTerms}}
# Declaration
Subject to the terms, conditions, clauses and warranties of the policy wording of the insurer.
`,
  'ctpl-certificate': `= Certificate of Cover - Compulsory Third Party Liability
# Certificate
Policy number: {{PolicyNumber}}
Insured: {{InsuredName}}
Insurer: {{InsurerName}}
Period from: {{PeriodFrom}}
Period to: {{PeriodTo}}
# Vehicle
Vehicle: {{VehicleDetails}}
Vehicle class: {{VehicleType}}
Plate number: {{PlateNumber}}
Chassis number: {{ChassisNumber}}
Motor number: {{MotorNumber}}
# Cover
CTPL premium: {{CtplPremium}}
This certifies that the vehicle above is covered for Compulsory Third Party Liability as required by the Insurance Code.
{{#Signatures}}
`,
  'quotation-slip': `= Quotation Slip
# Quotation
Quotation number: {{QuotationNumber}}
Customer: {{InsuredName}}
Insurer: {{InsurerName}}
Product: {{ProductName}}
Valid until: {{ValidUntil}}
{{#RiskDetails}}
{{#Coverage}}
{{#Premium}}
{{#CoverTerms}}
# Remarks
This quotation is subject to the insurer's terms, conditions and final underwriting approval.
`,
  'member-enrollment': `= Member Enrollment Form
# Group
Company: {{InsuredName}}
Product: {{ProductName}}
Insurer: {{InsurerName}}
{{#MemberList}}
{{#CoverageDetails}}
{{#Signatures}}
`,
};

const DOC_TITLES = { 'policy-schedule': 'Policy Schedule', 'ctpl-certificate': 'CTPL Certificate of Cover', 'quotation-slip': 'Quotation Slip', 'member-enrollment': 'Member Enrollment Form' };

/** Active document templates of the governing template of a record (productId / lob / templateCode). */
export async function productDocuments(ref) {
  const t = await governingTemplate(ref);
  if (!t) return { template: null, documents: [] };
  const docs = await many(`SELECT id, data FROM product_components WHERE template_id = $1 AND kind = 'documents' AND status = 'Active' ORDER BY sort_order, id`, [t.id]);
  return { template: t, documents: docs.map((d) => ({ id: d.id, ...d.data })) };
}

/** Cover terms of the governing template: the covers on the record (or mandatory ones) with deductible and exclusions. */
export async function coverTermsSection(x) {
  const t = await governingTemplate({ productId: x.productId, lob: x.lob || (lineOf(x) === 'MOTOR' ? 'MOTOR' : null) });
  if (!t) return null;
  const covers = (await many(`SELECT data FROM product_components WHERE template_id = $1 AND kind = 'coverages' AND status = 'Active' ORDER BY sort_order, id`, [t.id])).map((r) => r.data);
  const pb = x.premiumBreakdown || {};
  const on = (c) => (c.quoteField ? num(x[c.quoteField]) > 0 || num(pb[c.quoteField]) > 0 : c.type === 'Mandatory');
  const fmt = formatters(await header('', ''));
  const rows = covers.filter(on).map((c) => [c.coverageName, c.type || '', num(c.deductible) ? fmt.amount(c.deductible) : 'None', (c.exclusions || []).join('; ') || '-']);
  if (!rows.length) return null;
  return { heading: 'Cover terms', table: { columns: [{ label: 'Cover', wrap: true }, 'Type', { label: 'Deductible', align: 'right' }, { label: 'Main exclusions', wrap: true }], rows } };
}

/** Record shaped for printing: a policy (toPolicy + printablePolicy) or a quotation (quoteById). */
const policyRecord = (p) => ({ ...(p.quotation || {}), ...p, ...policyPremium(p, p.quotation || {}) });

/**
 * The document spec of a product document template for a record, or null when the record's governing template has
 * no active document printed as `printAs` with an uploaded layout (the standard layout is then used).
 * kind: 'policy' | 'quote'. `documentId` picks one template (its layout, else the default layout of its printAs).
 */
export async function productDocumentSpec(kind, record, { printAs = null, documentId = null } = {}) {
  const x = kind === 'policy' ? policyRecord(record) : record;
  const ref = { productId: x.productId || null, lob: x.lob || (lineOf(x) === 'MOTOR' ? 'MOTOR' : null) };
  const { documents } = await productDocuments(ref);
  const d = documentId ? documents.find((doc) => Number(doc.id) === Number(documentId)) : documents.find((doc) => doc.printAs === printAs && present(doc.layout));
  if (!d) return null;
  const layout = present(d.layout) ? d.layout : DEFAULT_LAYOUTS[d.printAs];
  if (!layout) return null;
  x.__coverTerms = await coverTermsSection(x);
  const number = kind === 'policy' ? x.policyNumber : x.quotationNumber;
  return layoutDoc(layout, x, { title: d.documentName || DOC_TITLES[d.printAs] || 'Document', number });
}

/** A sample record for previews of a layout (no customer data). */
export const SAMPLE_RECORD = {
  policyNumber: 'POL-SAMPLE-0001', quotationNumber: 'QT-SAMPLE-0001', insuredName: 'Juan dela Cruz', insuranceCompanyName: 'Sample Insurance Corporation',
  productName: 'Motor Vehicle Insurance', lob: 'MOTOR', inception: '2026-01-01', expiry: '2027-01-01', issuedDate: '2026-01-01', validUntil: '2026-01-31',
  sumInsured: 1000000, totalSumInsured: 1000000, netPremium: 25000, grossPremium: 28812.5, valueAddedTax: 3000, documentaryStampTax: 812.5, ctplCoveragePremium: 560,
  currency: 'PHP', plateNumber: 'ABC 1234', chassisNumber: 'CHS0000001', motorNumber: 'ENG0000001', vehicleType: 'private_cars',
  insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelYear: '2024', seatingCapacity: 5 }],
  lossAndDamageCoverage: 1000000, lossAndDamageCoveragePremium: 25000, members: [{ name: 'Maria Santos', birthDate: '1990-05-01', plan: 'Plan A' }],
};

/** Preview of a document template (its layout or the default one) on the sample record. */
export async function previewSpec(d) {
  const layout = present(d.layout) ? d.layout : DEFAULT_LAYOUTS[d.printAs] || DEFAULT_LAYOUTS['policy-schedule'];
  const x = { ...SAMPLE_RECORD, __coverTerms: null };
  return layoutDoc(layout, x, { title: d.documentName || DOC_TITLES[d.printAs] || 'Document', number: d.printAs === 'quotation-slip' ? x.quotationNumber : x.policyNumber });
}

