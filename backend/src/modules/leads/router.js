import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { paging } from '../../lib/respond.js';
import { withTransaction } from '../../db/pool.js';
import { sendEntity, actor } from '../documents/common.js';
import { uploadFile, parseUploadedRows, sendTable, columnMessage, uploadResult } from '../documents/tabular.js';
import { sendTemplate, sendWorkbook, staticUploads } from '../documents/uploadTemplates.js';
import { ownRecord, withScope, scopeOf } from '../../lib/scope.js';
import * as svc from './service.js';
import { today } from '../../lib/dates.js';
import assignmentRouter from './assignmentRoutes.js';
import * as tfs from './tfsImport.js';

const { router, define } = moduleRouter('Leads', '/leads');
const legacy = moduleRouter('Leads', '/lead');
const SCREEN = 'Operations > Sales & Marketing > Prospects';
const canRead = [requireAuth, requirePermission('read:leads')];
const canWrite = [requireAuth, requirePermission('write:leads')];
const canDelete = [requireAuth, requirePermission('delete:leads')];

const optionalEmail = z.string().email('emailId must be a valid e-mail').optional().nullable().or(z.literal(''));
const leadBody = z.object({
  firstName: z.string().max(100).optional().nullable(), lastName: z.string().max(100).optional().nullable(),
  preferredName: z.string().max(100).optional().nullable(), companyName: z.string().max(200).optional().nullable(),
  DOB: z.string().optional().nullable(), gender: z.string().max(20).optional().nullable(), emailId: optionalEmail,
  contactNumber: z.string().max(40).optional().nullable(), leadCategory: z.string().max(40).optional().nullable(),
  lob: z.string().max(60).optional().nullable(), status: z.string().max(40).optional().nullable(),
  productId: z.union([z.number().int(), z.string().max(60)]).optional().nullable(),
}).passthrough();
const tagBody = z.object({
  lob: z.string().trim().min(1, 'Choose the line of business').max(60),
  productId: z.union([z.number().int(), z.string().trim().min(1, 'Choose the product').max(60)]),
});
const createBody = leadBody.refine((b) => b.firstName || b.companyName, { message: 'firstName or companyName is required', path: ['firstName'] });

const example = { leadId: 'ld_1', generatedLeadId: 'LD-2026-00001', firstName: 'Juan', lastName: 'Dela Cruz', leadCategory: 'Retail', lob: 'MOTOR', productId: 1,
  productName: 'Motor Vehicle Insurance', productTagged: true, emailId: 'juan@example.com', contactNumber: '09171234567', city: 'Makati', province: 'Metro Manila', country: 'Philippines', status: 'New', quotationsCount: 0 };

async function listHandler(req, res) {
  const pg = paging(req.query);
  const { total, rows } = await svc.listLeads(await withScope(req), pg);
  res.json({ success: true, data: rows.map(svc.toLead), page: pg.page, pageSize: pg.perPage, perPage: pg.perPage, total, totalPages: Math.ceil(total / pg.perPage) });
}

define({
  method: 'GET', path: '/', summary: 'List leads (filters leadCategory, country, province, city, lob (none: product not yet tagged), status; search query; paging)', screen: SCREEN,
  middleware: canRead, query: { page: 1, pageSize: 10, leadCategory: 'Retail', lob: 'FIRE', query: 'juan' },
  response: { success: true, data: [example], page: 1, pageSize: 10, total: 1 }, handler: listHandler,
});
define({
  method: 'GET', path: '/search', summary: 'Search leads (same filters as the list)', screen: SCREEN, middleware: canRead,
  query: { query: 'juan' }, response: { success: true, data: [example], total: 1 }, handler: listHandler,
});
define({
  method: 'GET', path: '/stats', summary: 'Lead KPIs for the stats cards', screen: `${SCREEN} (stats cards)`, middleware: canRead,
  query: { leadCategory: 'Retail' },
  response: { totalLeads: 16, recentLeads: 3, last30DaysLeads: 9, convertedLeads: 8, leadsWithQuotations: 12, conversionRate: 50, quotationRate: 75, growthRate: 12.5, leadsByStatus: [{ status: 'New', count: 4 }] },
  handler: async (req, res) => { const s = await svc.leadStats(await withScope(req)); res.json({ success: true, ...s, data: s }); },
});
define({
  method: 'GET', path: '/report', summary: 'Download the lead report (XLSX, or CSV with format=csv) for a status / quotation-status category', screen: `${SCREEN} > Generate Report`,
  middleware: canRead, query: { category: 'Converted', format: 'xlsx' }, response: 'binary file',
  handler: async (req, res) => {
    const category = req.query.category || 'All';
    const { header, rows } = await svc.leadReport(category, await scopeOf(req));
    await audit(req, { entity: 'lead', entityId: null, action: 'report', after: { category, rows: rows.length } });
    await sendTable(res, { header, rows, fileBase: `lead-report-${String(category).replace(/[^a-zA-Z0-9]/g, '')}-${await today()}`, format: req.query.format === 'csv' ? 'csv' : 'xlsx', sheetName: 'Leads' });
  },
});
define({
  method: 'GET', path: '/bulk-upload/template', summary: 'Leads upload template (XLSX: Data, Columns and Instructions sheets)', screen: `${SCREEN} > Bulk Upload > Download template`,
  middleware: canRead, response: '(xlsx file)', handler: async (_req, res) => sendTemplate(res, 'leads'),
});
define({
  method: 'POST', path: '/bulk-upload', summary: 'Bulk upload leads from CSV or XLSX (multipart field "file"; header row with First Name, Last Name, Email, Contact Number ...; LOB and Product optional: empty, the product is tagged later)',
  screen: `${SCREEN} > Bulk Upload`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file',
  response: { success: true, data: { message: 'Processed 3 rows: 3 created, 0 failed', total: 3, created: 3, failed: 0, errors: [] } },
  handler: async (req, res) => {
    const rows = parseUploadedRows(req.file);
    const batch = await tfs.newBatch('prospects', req.file?.originalname || null, rows.length, actor(req));
    const errors = [];
    let created = 0;
    let updated = 0;
    for (const [i, row] of rows.entries()) {
      const body = svc.leadFromRow(row);
      try {
        // a row naming a prospect already loaded (Lead Number, Loan ID) updates its status and disposition
        const existing = await svc.leadOfRow(body);
        if (existing) {
          const lead = await svc.updateStatusFromRow(existing, body, actor(req), batch.id);
          await audit(req, { entity: 'lead', entityId: lead.id, action: 'bulk-update', before: { status: existing.status, disposition: existing.disposition },
            after: { status: lead.status, disposition: lead.disposition, batch: batch.number } });
          updated += 1;
          continue;
        }
        const parsed = createBody.safeParse(body);
        if (!parsed.success) { errors.push({ row: i + 2, message: columnMessage(parsed.error.issues.map((x) => x.message).join('; '), svc.LEAD_UPLOAD_COLUMNS) }); continue; }
        const lead = await withTransaction(async (c) => {
          const l = await svc.createLead(parsed.data, actor(req), c);
          await c.query('UPDATE leads SET import_batch_id = $2 WHERE id = $1', [l.id, batch.id]);
          return l;
        });
        await audit(req, { entity: 'lead', entityId: lead.id, action: 'bulk-create', after: { ...svc.toLead(lead), batch: batch.number } });
        created += 1;
      } catch (e) { errors.push({ row: i + 2, message: columnMessage(e.details?.length ? e.details.map((d) => d.message).join('; ') : e.message, svc.LEAD_UPLOAD_COLUMNS) }); }
    }
    await tfs.closeBatch(batch.id, { created, updated, errors });
    const data = { ...uploadResult(rows.length, created, errors), updated, batchNumber: batch.number };
    if (updated) data.message = `Processed ${rows.length} rows: ${created} created, ${updated} updated, ${errors.length} failed`;
    res.json({ success: true, message: data.message, data });
  },
});
define({
  method: 'GET', path: '/tfs-import/template', summary: 'TFS account file template (XLSX: Data, Columns and Instructions sheets) with the column headers in force (leads.tfs_column_map)', screen: `${SCREEN} > Bulk Upload > TFS accounts > Download template`,
  middleware: canRead, response: '(xlsx file)',
  handler: async (_req, res) => sendWorkbook(res, { ...staticUploads().find((d) => d.id === 'tfs-accounts'), columns: await tfs.tfsColumns() }),
});
define({
  method: 'POST', path: '/tfs-import', summary: 'Load the TFS account file (multipart field "file", XLSX or CSV): one prospect per Loan ID with the TFS detail set, source TFS, Customer Type TFS; a Loan ID already loaded updates its prospect; an account without a policy expiry date or with an unknown insurer is refused; the upload is stamped LIB-yyyy-nnnnn',
  screen: `${SCREEN} > Bulk Upload > TFS accounts`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file',
  response: { success: true, data: { message: 'Processed 250 rows: 246 created, 2 updated, 2 failed (batch LIB-2026-00004)', total: 250, created: 246, updated: 2, failed: 2,
    errors: [{ row: 17, message: 'Row 17: No policy expiry date: no prospect is created for this account' }] } },
  handler: async (req, res) => {
    const rows = parseUploadedRows(req.file);
    const data = await tfs.importTfs(rows, { fileName: req.file?.originalname || null, userId: actor(req),
      onLead: (lead, action, before) => audit(req, { entity: 'lead', entityId: lead.id, action, before: before || null, after: lead }) });
    res.json({ success: true, message: data.message, data });
  },
});
define({
  method: 'GET', path: '/options', summary: 'Lists of the prospect form: lead categories, customer types, statuses, dispositions and the insurers (insurance provider)', screen: `${SCREEN} > Create / Edit`,
  middleware: canRead, response: { success: true, data: { categories: ['Retail', 'Corporate'], customerTypes: ['TFS', 'Non-TFS', 'Direct Customer'], dispositions: ['Interested'], insurers: [{ id: 2, name: 'Malayan Insurance Co., Inc.' }] } },
  handler: async (_req, res) => res.json({ success: true, data: await svc.leadOptions() }),
});
define({
  method: 'GET', path: '/duplicates', summary: 'Possible duplicates of a new prospect: clients and open prospects with the same e-mail, mobile number, or name and date of birth; with leads.duplicate_rule four-key the same first name, last name, mobile and date of birth together, or the same Loan ID (clientId: the open prospects of that client); off with leads.duplicate_check',
  screen: `${SCREEN} > Create Prospect`, middleware: canRead, query: { firstName: 'Juan', lastName: 'Dela Cruz', DOB: '1990-05-01', emailId: 'juan@example.com', contactNumber: '09171234567' },
  response: { success: true, data: [{ kind: 'client', id: 'cli_1', number: 'CL-2026-00004', name: 'Juan Dela Cruz', ownerName: 'Ana Garcia', matchedOn: ['email', 'name', 'birthDate'] }] },
  handler: async (req, res) => res.json({ success: true, data: await svc.possibleDuplicates(req.query) }),
});
define({
  method: 'GET', path: '/:id', summary: 'Get one lead (by id or lead number)', screen: `${SCREEN} > View`, middleware: [...canRead, ownRecord('lead')],
  response: { ...example, success: true, data: example },
  handler: async (req, res) => sendEntity(res, svc.toLead(await svc.getLead(req.params.id))),
});
define({
  method: 'POST', path: '/', summary: 'Create a lead (Motor / Fire / IAR lead forms); lob and productId optional (the product is tagged later) unless leads.product_required', screen: `${SCREEN} > Create Lead`, middleware: [...canWrite, validate(createBody)],
  request: { firstName: 'Juan', lastName: 'Dela Cruz', preferredName: 'Juan', DOB: '1990-05-01', gender: 'Male', emailId: 'juan@example.com', contactNumber: '09171234567', houseNo: '12 Rizal St', barangay: 'Poblacion', city: 'Makati', province: 'Metro Manila', country: 'Philippines', zipCode: '1210', leadCategory: 'Retail', lob: 'FIRE' },
  response: { ...example, success: true, data: example },
  handler: async (req, res) => {
    const lead = svc.toLead(await svc.createLead(req.body, actor(req)));
    await audit(req, { entity: 'lead', entityId: lead.id, action: 'create', after: lead });
    sendEntity(res, lead, { status: 201, message: 'Lead created' });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Update a lead', screen: `${SCREEN} > Edit`, middleware: [...canWrite, ownRecord('lead'), validate(leadBody)],
  request: { firstName: 'Juan', contactNumber: '09179998888' }, response: { ...example, success: true, data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updateLead(req.params.id, req.body, actor(req));
    const lead = svc.toLead(after);
    await audit(req, { entity: 'lead', entityId: lead.id, action: 'update', before: svc.toLead(before), after: lead });
    sendEntity(res, lead, { message: 'Lead updated' });
  },
});
define({
  method: 'PUT', path: '/:id/product', summary: 'Tag or change the line of business and product of a lead; the product must be an active product of the line (audit action tag-product)',
  screen: `${SCREEN} > Tag product`, middleware: [...canWrite, ownRecord('lead'), validate(tagBody)],
  request: { lob: 'MOTOR', productId: 1 }, response: { ...example, success: true, data: example, message: 'Product tagged' },
  handler: async (req, res) => {
    const { before, after } = await svc.tagProduct(req.params.id, req.body, actor(req));
    const lead = svc.toLead(after);
    await audit(req, { entity: 'lead', entityId: lead.id, action: 'tag-product', before: svc.productTagOf(before), after: svc.productTagOf(after) });
    sendEntity(res, lead, { message: before.lob ? 'Product changed' : 'Product tagged' });
  },
});
define({
  method: 'DELETE', path: '/:id', summary: 'Delete a lead (soft delete; blocked once a policy exists; delete:leads)', screen: `${SCREEN} > Delete`, middleware: [...canDelete, ownRecord('lead')],
  response: { success: true, message: 'Lead deleted', data: { leadId: 'ld_1' } },
  handler: async (req, res) => {
    const lead = await svc.deleteLead(req.params.id, actor(req));
    await audit(req, { entity: 'lead', entityId: lead.id, action: 'delete', before: svc.toLead(lead) });
    res.json({ success: true, message: 'Lead deleted', leadId: lead.id, data: { leadId: lead.id } });
  },
});

// Legacy paths from routes/apiRoutes.js (APIROUTES.LEAD) kept for older screens
legacy.define({
  method: 'GET', path: '/get-all-lead', summary: 'Legacy: list leads (same as GET /leads)', screen: SCREEN, middleware: canRead,
  response: { success: true, data: [example], total: 1 }, handler: listHandler,
});
legacy.define({
  method: 'GET', path: '/search-lead', summary: 'Legacy: search leads by name (same as GET /leads/search)', screen: SCREEN, middleware: canRead,
  query: { name: 'juan' }, response: { success: true, data: [example], total: 1 }, handler: listHandler,
});

export default router;
export const mount = '/leads';
export const extraMounts = [['/lead', legacy.router], ['/lead-assignment', assignmentRouter]];
