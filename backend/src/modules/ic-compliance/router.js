/**
 * Insurance Commission compliance (Compliance > Insurance Commission): licence register and expiry calendar, fit and
 * proper records, insurer certificates of authority, the IC annual statement and production report, and the
 * complaints register (RA 11765). Permissions: read:compliance / write:compliance (registers, IC reports, mapping),
 * read:complaints / write:complaints / approve:complaints (complaints). Rules: licences.js, fitProper.js,
 * insurerAuthority.js, icReports.js, complaints.js.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { many } from '../../db/pool.js';
import { renderPdf, sendPdf } from '../../lib/pdf/index.js';
import { dateStr, documentsSchema, listSetting, optDate, optText, sendXlsx, usersWithPermission } from './common.js';
import * as lic from './licences.js';
import * as fp from './fitProper.js';
import * as auth from './insurerAuthority.js';
import * as ic from './icReports.js';
import * as cmp from './complaints.js';

const { router, define } = moduleRouter('Compliance (Insurance Commission)', '/compliance');
const read = [requirePermission('read:compliance')];
const write = [requirePermission('write:compliance')];
const S = 'Compliance > Insurance Commission';

// ------------------------------------------------------------------ licence register
const licenceExample = { id: 'lic_1', holderType: 'referrer', referrerId: 'ref-jdelacruz', holderName: 'Juan Dela Cruz', licenceType: 'Non-life Insurance Agent',
  licenceNumber: 'NL-2026-012345', issuingAuthority: 'Insurance Commission', issueDate: '2026-01-15', expiryDate: '2027-01-14', renewalStatus: 'not-due', status: 'active',
  state: 'valid', daysToExpiry: 102, documents: [] };
const licenceBody = z.object({
  holderType: z.enum(lic.HOLDER_TYPES), referrerId: z.string().max(80).optional().nullable(), userId: z.string().max(80).optional().nullable(),
  holderName: optText(200), position: optText(120), licenceType: z.string().trim().min(2).max(120), licenceNumber: optText(80), issuingAuthority: optText(120),
  linesAuthorised: optText(200), issueDate: optDate, expiryDate: optDate, renewalStatus: z.enum(lic.RENEWAL_STATUSES).optional(), renewalFiledOn: optDate,
  renewalReference: optText(120), status: z.enum(lic.RECORD_STATUSES).optional(), documents: documentsSchema.optional(), remarks: optText(2000),
}).strict();

define({
  method: 'GET', path: '/licences', summary: 'Licence register (filters: holderType, state valid / expiring / expired / no-expiry, renewalStatus, referrerId, includeInactive, search) with counts',
  screen: `${S} > Licence Register`, middleware: read, query: { state: 'expiring,expired' },
  response: { success: true, data: { items: [licenceExample], summary: { total: 1, valid: 1, expiring: 0, expired: 0, noExpiry: 0 }, today: '2026-10-04', expiringDays: 90 } },
  handler: async (req, res) => ok(res, await lic.listLicences(req.query)),
});
define({
  method: 'GET', path: '/licences/dashboard', summary: 'Licence expiry calendar: counts, expired and expiring licences, licences by month of expiry (12 months), the firm\'s licence, referrers without a licence in force',
  screen: `${S} > Licence Register > Expiry calendar`, middleware: read,
  response: { success: true, data: { today: '2026-10-04', expiringDays: 90, summary: { total: 1 }, expired: [], expiring: [], calendar: [{ month: '2026-10', licences: [] }], firmLicenceInForce: true, referrersWithoutLicence: [], checkMode: 'block' } },
  handler: async (req, res) => ok(res, await lic.licenceDashboard()),
});
define({
  method: 'GET', path: '/licences/export', summary: 'Licence register as Excel (same filters as the list)', screen: `${S} > Licence Register > Export`, middleware: read, response: 'xlsx',
  handler: async (req, res) => {
    const { items } = await lic.listLicences({ ...req.query, includeInactive: req.query.includeInactive ?? 'true' });
    sendXlsx(res, 'licence-register.xlsx', [{ name: 'Licences', columns: [
      { key: 'holderType', header: 'Holder type', width: 12 }, { key: 'holderName', header: 'Holder', width: 32 }, { key: 'position', header: 'Position', width: 20 },
      { key: 'licenceType', header: 'Licence type', width: 28 }, { key: 'licenceNumber', header: 'Licence number', width: 20 }, { key: 'issuingAuthority', header: 'Issued by', width: 22 },
      { key: 'issueDate', header: 'Issued', type: 'date', width: 12 }, { key: 'expiryDate', header: 'Expires', type: 'date', width: 12 }, { key: 'state', header: 'State', width: 11 },
      { key: 'daysToExpiry', header: 'Days to expiry', type: 'integer', width: 10 }, { key: 'renewalStatus', header: 'Renewal', width: 12 }, { key: 'status', header: 'Record', width: 11 },
      { key: 'remarks', header: 'Remarks', width: 40 }], rows: items }], 'Licence register');
  },
});
define({
  method: 'GET', path: '/licences/holders', summary: 'Holders and options for the licence form: referrers (agents, sub-agents, referrers), users, licence types (compliance.licence_types) and the referrer types that need a licence', screen: `${S} > Licence Register > Add`,
  middleware: read, query: { search: 'cruz' }, response: { success: true, data: { referrers: [{ id: 'ref-jdelacruz', name: 'Juan Dela Cruz', type: 'Agent' }], users: [{ id: 'usr_1', name: 'Ana Reyes' }], licenceTypes: ['Non-life Insurance Agent'], requiredReferrerTypes: ['Agent', 'Sub-agent'] } },
  handler: async (req, res) => {
    const s = req.query.search ? String(req.query.search) : '';
    ok(res, {
      referrers: await many("SELECT id, name, referrer_type AS type, status FROM commission_referrers WHERE name ILIKE '%' || $1 || '%' ORDER BY name LIMIT 50", [s]),
      users: await many("SELECT id, COALESCE(display_name, username) AS name, username FROM users WHERE status = 'active' AND (display_name ILIKE '%' || $1 || '%' OR username ILIKE '%' || $1 || '%') ORDER BY 2 LIMIT 50", [s]),
      licenceTypes: await listSetting('compliance.licence_types', ['Insurance Broker (Non-life)', 'Non-life Insurance Agent', 'Sub-agent', 'Other']),
      requiredReferrerTypes: await lic.requiredReferrerTypes(),
    });
  },
});
define({
  method: 'GET', path: '/licences/:id', summary: 'One licence', screen: `${S} > Licence Register`, middleware: read, response: { success: true, data: licenceExample },
  handler: async (req, res) => ok(res, await lic.licenceView(req.params.id)),
});
define({
  method: 'POST', path: '/licences', summary: 'Record a licence of the firm, an officer, a licensed individual or a referrer (number, type, issue and expiry dates, documents)',
  screen: `${S} > Licence Register > Add`, middleware: [...write, validate(licenceBody)],
  request: { holderType: 'referrer', referrerId: 'ref-jdelacruz', licenceType: 'Non-life Insurance Agent', licenceNumber: 'NL-2026-012345', issueDate: '2026-01-15', expiryDate: '2027-01-14' },
  response: { success: true, data: licenceExample },
  handler: async (req, res) => {
    const r = await lic.createLicence(req.body, req.user);
    await audit(req, { entity: 'compliance_licence', entityId: r.id, action: 'create', after: r });
    created(res, r, 'Licence recorded');
  },
});
define({
  method: 'PUT', path: '/licences/:id', summary: 'Update a licence (renewal status, filing date, documents, status revoked / surrendered)', screen: `${S} > Licence Register > Edit`,
  middleware: [...write, validate(licenceBody.partial().strict())], request: { renewalStatus: 'filed', renewalFiledOn: '2026-12-01' }, response: { success: true, data: licenceExample },
  handler: async (req, res) => {
    const r = await lic.updateLicence(req.params.id, req.body, req.user);
    await audit(req, { entity: 'compliance_licence', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Licence updated');
  },
});
define({
  method: 'POST', path: '/licences/:id/renew', summary: 'Record the renewed licence: a new licence term for the same holder; the current one is marked renewed and superseded',
  screen: `${S} > Licence Register > Renew`, middleware: [...write, validate(z.object({ licenceNumber: optText(80), issueDate: optDate, expiryDate: dateStr, documents: documentsSchema.optional(), remarks: optText(2000) }).strict())],
  request: { licenceNumber: 'NL-2027-012345', issueDate: '2027-01-10', expiryDate: '2028-01-14' }, response: { success: true, data: licenceExample },
  handler: async (req, res) => {
    const r = await lic.renewLicence(req.params.id, req.body, req.user);
    await audit(req, { entity: 'compliance_licence', entityId: r.after.id, action: 'renew', before: r.before, after: r.after });
    created(res, r.after, 'Renewed licence recorded');
  },
});

// ------------------------------------------------------------------ fit and proper
const fpExample = { id: 'fp_1', personName: 'Maria Santos', roleCategory: 'director', position: 'Chairman of the Board', declarations: [{ item: 'Has not been convicted ...', answer: 'yes', remarks: null }],
  lastReviewOn: '2026-03-01', nextReviewOn: '2027-03-01', reviewOutcome: 'fit', reviewState: 'current', documents: [] };
const fpBody = z.object({
  personName: z.string().trim().min(2).max(200), userId: z.string().max(80).optional().nullable(), roleCategory: z.enum(fp.ROLE_CATEGORIES), position: z.string().trim().min(2).max(120),
  appointedOn: optDate, ceasedOn: optDate, declarationSignedOn: optDate, nextReviewOn: optDate, status: z.enum(['active', 'ceased']).optional(),
  declarations: z.array(z.object({ item: z.string().max(500), answer: z.enum(['yes', 'no']).optional().nullable(), remarks: optText(1000) })).max(40).optional(),
  documents: documentsSchema.optional(), remarks: optText(2000),
}).strict();
define({
  method: 'GET', path: '/fit-proper', summary: 'Fit and proper records of directors and officers (filters: roleCategory, outcome, reviewState overdue / due / current / not-reviewed, includeCeased, search) with counts and the declaration items',
  screen: `${S} > Fit and Proper`, middleware: read, response: { success: true, data: { items: [fpExample], summary: { active: 1, overdue: 0, due: 0, notReviewed: 0, notFit: 0 }, declarationItems: ['...'], reviewMonths: 12 } },
  handler: async (req, res) => ok(res, await fp.listFitProper(req.query)),
});
define({
  method: 'GET', path: '/fit-proper/export', summary: 'Fit and proper register as Excel', screen: `${S} > Fit and Proper > Export`, middleware: read, response: 'xlsx',
  handler: async (req, res) => {
    const { items } = await fp.listFitProper({ includeCeased: 'true' });
    sendXlsx(res, 'fit-and-proper-register.xlsx', [{ name: 'Fit and proper', columns: [
      { key: 'personName', header: 'Name', width: 30 }, { key: 'roleCategory', header: 'Category', width: 16 }, { key: 'position', header: 'Position', width: 26 },
      { key: 'appointedOn', header: 'Appointed', type: 'date', width: 12 }, { key: 'declarationSignedOn', header: 'Declaration signed', type: 'date', width: 12 },
      { key: 'adverseAnswers', header: 'Adverse answers', type: 'integer', width: 10 }, { key: 'lastReviewOn', header: 'Last review', type: 'date', width: 12 },
      { key: 'reviewOutcome', header: 'Outcome', width: 12 }, { key: 'nextReviewOn', header: 'Next review', type: 'date', width: 12 }, { key: 'reviewState', header: 'Review state', width: 14 },
      { key: 'status', header: 'Status', width: 10 }], rows: items }], 'Fit and proper register');
  },
});
define({
  method: 'GET', path: '/fit-proper/:id', summary: 'One fit and proper record', screen: `${S} > Fit and Proper`, middleware: read, response: { success: true, data: fpExample },
  handler: async (req, res) => ok(res, await fp.fitProperView(req.params.id)),
});
define({
  method: 'POST', path: '/fit-proper', summary: 'Add the fit and proper record of a director or officer (the declarations default to compliance.fit_proper_declarations)',
  screen: `${S} > Fit and Proper > Add`, middleware: [...write, validate(fpBody)], request: { personName: 'Maria Santos', roleCategory: 'director', position: 'Chairman of the Board', appointedOn: '2025-06-01' },
  response: { success: true, data: fpExample },
  handler: async (req, res) => {
    const r = await fp.createFitProper(req.body, req.user);
    await audit(req, { entity: 'compliance_fit_proper', entityId: r.id, action: 'create', after: r });
    created(res, r, 'Fit and proper record added');
  },
});
define({
  method: 'PUT', path: '/fit-proper/:id', summary: 'Update a fit and proper record: declarations answered (a "no" needs remarks), documents, ceased', screen: `${S} > Fit and Proper > Edit`,
  middleware: [...write, validate(fpBody.partial().strict())], request: { declarationSignedOn: '2026-09-30' }, response: { success: true, data: fpExample },
  handler: async (req, res) => {
    const r = await fp.updateFitProper(req.params.id, req.body, req.user);
    await audit(req, { entity: 'compliance_fit_proper', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Fit and proper record updated');
  },
});
define({
  method: 'POST', path: '/fit-proper/:id/review', summary: 'Record a fit and proper review: outcome, date, notes; the next review is due compliance.fit_proper_review_months later',
  screen: `${S} > Fit and Proper > Review`, middleware: [...write, validate(z.object({ outcome: z.enum(fp.OUTCOMES.filter((o) => o !== 'pending')), reviewedOn: optDate, nextReviewOn: optDate, notes: optText(4000) }).strict())],
  request: { outcome: 'fit', reviewedOn: '2026-10-01', notes: 'Clearances received' }, response: { success: true, data: fpExample },
  handler: async (req, res) => {
    const r = await fp.reviewFitProper(req.params.id, req.body, req.user);
    await audit(req, { entity: 'compliance_fit_proper', entityId: r.after.id, action: 'review', before: r.before, after: r.after });
    ok(res, r.after, 'Review recorded');
  },
});

// ------------------------------------------------------------------ insurer certificates of authority
const authorityExample = { id: 3, code: 'MAPFRE', name: 'MAPFRE Insular Insurance Corporation', certificateNumber: '2025/12-R', validUntil: '2027-12-31', state: 'valid', daysLeft: 453 };
define({
  method: 'GET', path: '/insurer-authority', summary: 'Insurers with the state of their IC certificate of authority (valid, expiring, expired, missing, no-validity); filters state, status=all, search',
  screen: `${S} > Insurer Authority`, middleware: read, query: { state: 'expiring,expired,missing' },
  response: { success: true, data: { items: [authorityExample], summary: { total: 1, valid: 1, expiring: 0, expired: 0, missing: 0, noValidity: 0 }, today: '2026-10-04', expiringDays: 60, mode: 'warn' } },
  handler: async (req, res) => ok(res, await auth.authorityReport(req.query)),
});
define({
  method: 'GET', path: '/insurer-authority/export', summary: 'Insurers and their certificates of authority as Excel (same filters)', screen: `${S} > Insurer Authority > Export`, middleware: read, response: 'xlsx',
  handler: async (req, res) => {
    const { items } = await auth.authorityReport(req.query);
    sendXlsx(res, 'insurer-certificates-of-authority.xlsx', [{ name: 'Certificates of authority', columns: [
      { key: 'code', header: 'Code', width: 14 }, { key: 'name', header: 'Insurer', width: 44 }, { key: 'status', header: 'Master status', width: 12 },
      { key: 'certificateNumber', header: 'Certificate of authority', width: 22 }, { key: 'validUntil', header: 'Valid until', type: 'date', width: 12 },
      { key: 'daysLeft', header: 'Days left', type: 'integer', width: 10 }, { key: 'state', header: 'State', width: 12 }], rows: items }], 'Insurer certificates of authority');
  },
});

// ------------------------------------------------------------------ IC reports
const periodQuery = { year: '2025' };
define({
  method: 'GET', path: '/ic-reports/annual-statement', summary: 'IC annual statement of the broker for a year (?year= or ?from=&to=): balance sheet and income statement on the IC lines, premiums and commissions by insurer and line, premiums held in trust, checks and lines to confirm',
  screen: `${S} > IC Annual Statement`, middleware: read, query: periodQuery,
  response: { success: true, data: { period: { from: '2025-01-01', to: '2025-12-31' }, balanceSheet: [{ code: 'BS-A01', label: 'Cash on hand and in banks (own funds)', current: 1250000, prior: 980000 }], checks: [{ check: 'The balance sheet balances', ok: true }] } },
  handler: async (req, res) => ok(res, await ic.annualStatement(req.query)),
});
define({
  method: 'GET', path: '/ic-reports/annual-statement/export', summary: 'IC annual statement workbook (Excel): cover, schedules 1 to 4, accountant confirmation, unmapped accounts', screen: `${S} > IC Annual Statement > Download`,
  middleware: read, query: periodQuery, response: 'xlsx',
  handler: async (req, res) => {
    const wb = await ic.annualStatementWorkbook(req.query);
    await audit(req, { entity: 'ic_report', entityId: `annual-statement-${wb.data.period.to}`, action: 'export', after: { period: wb.data.period, checks: wb.data.checks.map((c) => ({ check: c.check, ok: c.ok })) } });
    sendXlsx(res, `ic-annual-statement-${wb.data.period.to.slice(0, 4)}.xlsx`, wb.sheets, 'IC annual statement');
  },
});
define({
  method: 'GET', path: '/ic-reports/production', summary: 'IC production report: premiums placed by insurer and IC line of business (?from=&to=&groupBy=month|quarter|year), with the policy detail',
  screen: `${S} > IC Production Report`, middleware: read, query: { from: '2026-01-01', to: '2026-09-30', groupBy: 'quarter' },
  response: { success: true, data: { from: '2026-01-01', to: '2026-09-30', groupBy: 'quarter', lines: ['Fire', 'Motor Car'], rows: [{ insurer: 'MAPFRE Insular', premium: { Fire: 106400, 'Motor Car': 23200 }, totalPremium: 129600, commission: 20504 }] } },
  handler: async (req, res) => ok(res, await ic.production(req.query)),
});
define({
  method: 'GET', path: '/ic-reports/production/export', summary: 'IC production report workbook (Excel): by insurer and line, by period, detail', screen: `${S} > IC Production Report > Download`,
  middleware: read, query: { from: '2026-01-01', to: '2026-09-30', groupBy: 'quarter' }, response: 'xlsx',
  handler: async (req, res) => {
    const wb = await ic.productionWorkbook(req.query);
    await audit(req, { entity: 'ic_report', entityId: `production-${wb.data.from}-${wb.data.to}`, action: 'export', after: { from: wb.data.from, to: wb.data.to, groupBy: wb.data.groupBy, total: wb.data.totals.totalPremium } });
    sendXlsx(res, `ic-production-${wb.data.from}-${wb.data.to}.xlsx`, wb.sheets, 'IC production report');
  },
});
define({
  method: 'GET', path: '/ic-reports/mapping', summary: 'Lines of the IC annual statement and the ledger account prefixes mapped to each', screen: `${S} > IC Annual Statement > Account mapping`, middleware: read,
  response: { success: true, data: [{ id: 1, schedule: 'balance-sheet', code: 'BS-A01', label: 'Cash on hand and in banks (own funds)', accountPrefixes: ['1101', '1102001'] }] },
  handler: async (req, res) => ok(res, (await ic.statementLines({ all: true })).map(ic.lineApi)),
});
define({
  method: 'PUT', path: '/ic-reports/mapping/:id', summary: 'Change a line of the IC statement mapping (label, section, order, account prefixes, what the accountant must confirm, active)',
  screen: `${S} > IC Annual Statement > Account mapping`, middleware: [...write, validate(z.object({ label: z.string().trim().min(2).max(200).optional(), section: z.string().trim().min(2).max(60).optional(),
    sortOrder: z.number().int().min(0).max(100000).optional(), accountPrefixes: z.array(z.string().max(20)).max(60).optional(), confirm: optText(1000), status: z.enum(['active', 'inactive']).optional() }).strict())],
  request: { accountPrefixes: ['1101', '1102001', '1102002'] }, response: { success: true, data: { id: 1, code: 'BS-A01', accountPrefixes: ['1101', '1102001', '1102002'] } },
  handler: async (req, res) => {
    const r = await ic.updateStatementLine(Number(req.params.id), req.body, req.user);
    await audit(req, { entity: 'ic_statement_line', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Mapping updated');
  },
});

// ------------------------------------------------------------------ complaints
const C = `${S} > Complaints`;
const cRead = [requirePermission('read:complaints')];
const cWrite = [requirePermission('write:complaints')];
const complaintExample = { id: 'cmp_1', complaintNumber: 'CMP-2026-00001', receivedOn: '2026-10-01', channel: 'E-mail', complainantName: 'Juan Dela Cruz', category: 'Claims handling',
  complexity: 'simple', subject: 'Delay in claim payment', status: 'acknowledged', ackDueOn: '2026-10-03', resolutionDueOn: '2026-10-08', ageDays: 3, ackOverdue: false, resolutionOverdue: false };
const complaintBody = z.object({
  receivedAt: z.string().max(40).optional(), channel: z.string().trim().min(1).max(80), complainantName: z.string().trim().min(2).max(200), complainantContact: optText(200),
  complainantType: z.enum(cmp.COMPLAINANT_TYPES).optional(), clientId: z.string().max(80).optional().nullable(), policyId: z.string().max(80).optional().nullable(),
  claimId: z.string().max(80).optional().nullable(), insuranceCompanyId: z.union([z.number().int(), z.string().regex(/^\d+$/)]).optional().nullable(),
  category: z.string().trim().min(1).max(120), complexity: z.enum(['simple', 'complex']).optional(), subject: z.string().trim().min(3).max(300), description: optText(8000),
  amountDisputed: z.number().min(0).optional().nullable(), assignedTo: z.string().max(80).optional().nullable(), documents: documentsSchema.optional(),
}).strict();

define({
  method: 'GET', path: '/complaints', summary: 'Complaints register (filters: status, category, channel, overdue=true, assignedTo, clientId, policyId, from, to, search) with counts',
  screen: C, middleware: cRead, query: { status: 'received,acknowledged,in-progress,escalated', overdue: 'true' },
  response: { success: true, data: { items: [complaintExample], summary: { open: 1, ackOverdue: 0, resolutionOverdue: 0, escalated: 0 }, today: '2026-10-04' } },
  handler: async (req, res) => ok(res, await cmp.listComplaints(req.query)),
});
define({
  method: 'GET', path: '/complaints/options', summary: 'Channels, categories (settings), complainant types, outcomes, deadlines in days and the users complaints can be assigned to',
  screen: C, middleware: cRead,
  response: { success: true, data: { channels: ['E-mail'], categories: ['Claims handling'], outcomes: cmp.OUTCOMES, assignees: [{ id: 'usr_1', name: 'Ana Reyes' }] } },
  handler: async (req, res) => ok(res, {
    channels: await cmp.channels(), categories: await cmp.categories(), complainantTypes: cmp.COMPLAINANT_TYPES, outcomes: cmp.OUTCOMES, statuses: cmp.STATUSES,
    assignees: await usersWithPermission('write:complaints'),
  }),
});
define({
  method: 'GET', path: '/complaints/regulator-report', summary: 'Complaints report for the regulator for a period (?from=&to=): counts by category, channel, status and outcome, ageing, the register',
  screen: `${C} > Regulator report`, middleware: cRead, query: { from: '2026-01-01', to: '2026-06-30' },
  response: { success: true, data: { from: '2026-01-01', to: '2026-06-30', total: 4, resolved: 3, resolvedWithinDeadline: 3, byCategory: [{ value: 'Claims handling', count: 2 }] } },
  handler: async (req, res) => ok(res, await cmp.regulatorReport(req.query)),
});
define({
  method: 'GET', path: '/complaints/regulator-report/export', summary: 'Complaints report for the regulator as Excel', screen: `${C} > Regulator report > Download`, middleware: cRead,
  query: { from: '2026-01-01', to: '2026-06-30' }, response: 'xlsx',
  handler: async (req, res) => {
    const rep = await cmp.regulatorReport(req.query);
    await audit(req, { entity: 'complaint_report', entityId: `${rep.from}-${rep.to}`, action: 'export', after: { from: rep.from, to: rep.to, total: rep.total } });
    sendXlsx(res, `complaints-report-${rep.from}-${rep.to}.xlsx`, cmp.regulatorSheets(rep), 'Complaints report');
  },
});
define({
  method: 'GET', path: '/complaints/:id', summary: 'One complaint with its history', screen: C, middleware: cRead, response: { success: true, data: complaintExample },
  handler: async (req, res) => ok(res, await cmp.complaintView(req.params.id)),
});
define({
  method: 'POST', path: '/complaints', summary: 'Log a complaint: numbered from the CMP series; acknowledgement and resolution deadlines from the complaints.* settings; a policy or claim fills the client',
  screen: `${C} > Log complaint`, middleware: [...cWrite, validate(complaintBody)],
  request: { channel: 'E-mail', complainantName: 'Juan Dela Cruz', complainantContact: 'juan@example.ph', policyId: 'POL-2026-00012', category: 'Claims handling', subject: 'Delay in claim payment' },
  response: { success: true, data: complaintExample },
  handler: async (req, res) => {
    const r = await cmp.createComplaint(req.body, req.user);
    await audit(req, { entity: 'complaint', entityId: r.id, action: 'create', after: r });
    created(res, r, `Complaint ${r.complaintNumber} logged`);
  },
});
define({
  method: 'PUT', path: '/complaints/:id', summary: 'Edit an open complaint: details, links, complexity (the resolution deadline follows), assignment (the assignee is notified), documents',
  screen: `${C} > Edit`, middleware: [...cWrite, validate(complaintBody.partial().strict())], request: { assignedTo: 'usr_1', complexity: 'complex' }, response: { success: true, data: complaintExample },
  handler: async (req, res) => {
    const r = await cmp.updateComplaint(req.params.id, req.body, req.user);
    await audit(req, { entity: 'complaint', entityId: r.after.id, action: 'update', before: r.before, after: r.after });
    ok(res, r.after, 'Complaint updated');
  },
});
const actionBody = z.object({ reason: optText(2000), outcome: z.enum(cmp.OUTCOMES).optional(), resolution: optText(8000), redressAmount: z.number().min(0).optional().nullable(),
  resolvedAt: z.string().max(40).optional(), acknowledgedAt: z.string().max(40).optional(), regulatorReference: optText(120), referredOn: optDate, notes: optText(2000) }).strict();
const COMPLAINT_STEPS = {
  acknowledge: 'Acknowledge the complaint (the acknowledgement letter can then be printed)',
  start: 'Start work on the complaint (acknowledges it when not yet done)',
  escalate: 'Escalate the complaint (reason); the complaints officers (approve:complaints) are notified',
  resolve: 'Resolve the complaint: outcome, resolution given, redress amount',
  refer: 'Record that the complaint was elevated to the Insurance Commission (reference, date)',
  close: 'Close a resolved complaint',
  reopen: 'Reopen a resolved or closed complaint the complainant contests (reason)',
};
for (const [action, summary] of Object.entries(COMPLAINT_STEPS)) {
  define({
    method: 'POST', path: `/complaints/:id/${action}`, summary, screen: `${C} > Actions`, middleware: [...cWrite, validate(actionBody)],
    request: action === 'resolve' ? { outcome: 'upheld', resolution: 'The insurer released the claim payment on 07 October 2026' } : action === 'escalate' ? { reason: 'No answer from the insurer' } : {},
    response: { success: true, data: { ...complaintExample, status: action === 'resolve' ? 'resolved' : complaintExample.status } },
    handler: async (req, res) => {
      const r = await cmp.act(req.params.id, action, req.body, req.user);
      await audit(req, { entity: 'complaint', entityId: r.after.id, action, before: r.before, after: r.after });
      ok(res, r.after, `Complaint ${r.after.complaintNumber}: ${action} recorded`);
    },
  });
}
for (const kind of ['acknowledgement', 'resolution']) {
  define({
    method: 'GET', path: `/complaints/:id/letter/${kind}`, summary: `${kind === 'resolution' ? 'Resolution' : 'Acknowledgement'} letter of a complaint (PDF on the letterhead; text from complaints.${kind === 'resolution' ? 'resolution' : 'ack'}_letter_text)`,
    screen: `${C} > Letters`, middleware: cRead, response: 'application/pdf',
    handler: async (req, res) => {
      const { complaint, spec } = await cmp.letterSpec(req.params.id, kind);
      await audit(req, { entity: 'complaint', entityId: complaint.id, action: `letter-${kind}`, after: { complaintNumber: complaint.complaintNumber } });
      sendPdf(res, await renderPdf(spec), `${complaint.complaintNumber}-${kind}.pdf`);
    },
  });
}

export default router;
export const mount = '/compliance';
