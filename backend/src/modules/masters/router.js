import { moduleRouter } from '../../lib/registry.js';
import { audit } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { created, ok, paging } from '../../lib/respond.js';
import { getSetting } from '../../lib/settings.js';
import { parseUploadedRows, pick, uploadFile } from '../documents/tabular.js';
import { masterTemplate } from '../documents/uploadTemplates.js';
import { canRead, canWrite, parseStatus, sendList } from './helpers.js';
import * as svc from './service.js';

/**
 * Generic, metadata-driven masters: every Master screen (General, Finance, Remittance, Incentive, Product) reads and
 * writes its records through these endpoints, keyed by the master type code.
 */
const { router, define } = moduleRouter('Masters', '/masters');
const SCREEN = 'Master > (any master screen)';

const sample = { id: 1, CountryName: 'Philippines', ISOCode: 'PH', Description: 'Republic of the Philippines', PhoneCode: '+63', status: 'Active' };

define({
  method: 'GET', path: '/', summary: 'Catalogue of master types with their field definitions and record counts', screen: SCREEN,
  middleware: canRead('masters'), query: { category: 'finance' },
  response: { success: true, data: [{ code: 'country', label: 'Country', category: 'general', storage: 'table', fields: [{ name: 'CountryName', label: 'Country Name', type: 'string', required: true }], count: 5 }] },
  handler: async (req, res) => ok(res, await svc.listTypes({ category: req.query.category })),
});
define({
  method: 'POST', path: '/', summary: 'Define a new master type (generic store); administrators add masters without code changes', screen: 'Master > Configuration',
  middleware: canWrite('masters'),
  request: { code: 'occupation', label: 'Occupation', category: 'general', codeField: 'occupationCode', labelField: 'occupationName', fields: [{ name: 'occupationCode', label: 'Code', required: true }, { name: 'occupationName', label: 'Name', required: true }, { name: 'riskClass', type: 'select', options: ['1', '2', '3'] }] },
  response: { success: true, data: { code: 'occupation', label: 'Occupation', count: 0 } },
  handler: async (req, res) => {
    const t = await svc.createType(req.body || {}, req.user);
    await audit(req, { entity: 'master_type', entityId: t.code, action: 'create', after: t });
    created(res, t, 'Master type created');
  },
});
define({
  method: 'GET', path: '/:type/definition', summary: 'Field definition of one master type (drives the add / edit form)', screen: SCREEN,
  middleware: canRead('masters'), response: { success: true, data: { code: 'taxation', fields: [{ name: 'taxCode', required: true }] } },
  handler: async (req, res) => {
    const t = await svc.getType(req.params.type);
    ok(res, svc.typeOut(t));
  },
});
define({
  method: 'PUT', path: '/:type/definition', summary: 'Change a master type: labels, fields, required flags, options, unique keys, status', screen: 'Master > Configuration',
  middleware: canWrite('masters'), request: { label: 'Taxation', fields: [{ name: 'taxCode', label: 'Tax Code', required: true }] },
  response: { success: true, data: { code: 'taxation' } },
  handler: async (req, res) => {
    const before = svc.typeOut(await svc.getType(req.params.type));
    const after = await svc.updateType(req.params.type, req.body || {}, req.user);
    await audit(req, { entity: 'master_type', entityId: req.params.type, action: 'update', before, after });
    ok(res, after, 'Master type updated');
  },
});
define({
  method: 'GET', path: '/:type/options', summary: 'Active records as dropdown options { id, code, label, value }; filter by any field (e.g. ?Country=Philippines)', screen: SCREEN,
  middleware: canRead('masters', 'read:profile'), query: { search: 'Met', valueField: 'label' },
  response: { success: true, data: [{ id: 1, code: 'NCR', label: 'Metro Manila', value: 'Metro Manila' }] },
  handler: async (req, res) => ok(res, await svc.listOptions(await svc.getType(req.params.type), req.query)),
});
define({
  method: 'GET', path: '/:type', summary: 'List records of a master type (search, field filters, status, sort, paging)', screen: SCREEN,
  middleware: canRead('masters'), query: { search: 'phil', status: 'Active', page: 1, perPage: 10, sortBy: 'CountryName', sortOrder: 'asc' },
  response: { success: true, data: [sample], total: 1, page: 1, perPage: 10, totalPages: 1 },
  handler: async (req, res) => {
    const t = await svc.getType(req.params.type);
    const pg = paging(req.query, { page: 1, perPage: 50 });
    const { rows, total } = await svc.listRecords(t, req.query, pg);
    sendList(res, rows, total, pg, { type: svc.typeOut(t) });
  },
});
define({
  method: 'GET', path: '/:type/template', summary: 'Upload template (XLSX) of a master type: Data sheet with the column headers, Columns and Instructions sheets',
  screen: `${SCREEN} > Upload > Download template`, middleware: canRead('masters'), response: '(xlsx file)',
  handler: async (req, res) => {
    const t = await svc.getType(req.params.type);
    const why = svc.noTemplateReason(t);
    if (why) throw badRequest(why);
    const { fileName, buffer } = masterTemplate(t, { maxRows: Number(await getSetting('limits.bulk_upload_max_rows', 1000)), withSamples: req.query.samples === 'true' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  },
});
define({
  method: 'POST', path: '/:type/upload', summary: 'Bulk create records of a master type from CSV / XLSX (multipart "file"; headers = field labels or names; each row validated like Add)',
  screen: `${SCREEN} > Upload`, middleware: [...canWrite('masters'), uploadFile], request: 'multipart/form-data file',
  response: { success: true, data: { message: 'Processed 2 rows: 2 created, 0 failed', total: 2, created: 2, failed: 0, errors: [] } },
  handler: async (req, res) => {
    const t = await svc.getType(req.params.type);
    const why = svc.noTemplateReason(t);
    if (why) throw badRequest(why);
    const rows = parseUploadedRows(req.file);
    const max = Number(await getSetting('limits.bulk_upload_max_rows', 1000));
    if (rows.length > max) throw badRequest(`The file has ${rows.length} rows; the limit is ${max}`);
    const errors = [];
    let createdCount = 0;
    for (const [i, row] of rows.entries()) {
      try {
        const rec = await svc.createRecord(t, svc.bodyFromRow(t, row, pick), req.user);
        await audit(req, { entity: `master:${t.code}`, entityId: rec.id, action: 'bulk-create', after: rec });
        createdCount += 1;
      } catch (e) {
        errors.push({ row: i + 2, message: e.details?.length ? `${e.message}: ${e.details.map((d) => d.message).join('; ')}` : e.message });
      }
    }
    const data = { message: `Processed ${rows.length} rows: ${createdCount} created, ${errors.length} failed`, total: rows.length, created: createdCount, failed: errors.length, errors };
    res.json({ success: true, message: data.message, data });
  },
});
define({
  method: 'GET', path: '/:type/:id', summary: 'One master record', screen: SCREEN, middleware: canRead('masters'),
  response: { success: true, data: sample },
  handler: async (req, res) => ok(res, await svc.getRecord(await svc.getType(req.params.type), req.params.id)),
});
define({
  method: 'POST', path: '/:type', summary: 'Create a master record (fields validated against the type definition)', screen: SCREEN,
  middleware: canWrite('masters'), request: { CountryName: 'Viet Nam', ISOCode: 'VN', Description: 'Socialist Republic of Viet Nam', PhoneCode: '+84' },
  response: { success: true, data: { ...sample, id: 6, CountryName: 'Viet Nam' } },
  handler: async (req, res) => {
    const t = await svc.getType(req.params.type);
    const rec = await svc.createRecord(t, req.body || {}, req.user);
    await audit(req, { entity: `master:${t.code}`, entityId: rec.id, action: 'create', after: rec });
    created(res, rec, `${t.label} created`);
  },
});
define({
  method: 'PUT', path: '/:type/:id', summary: 'Update a master record (partial updates allowed)', screen: SCREEN,
  middleware: canWrite('masters'), request: { Description: 'Updated description' }, response: { success: true, data: sample },
  handler: async (req, res) => {
    const t = await svc.getType(req.params.type);
    const { before, after } = await svc.updateRecord(t, req.params.id, req.body || {}, req.user);
    await audit(req, { entity: `master:${t.code}`, entityId: req.params.id, action: 'update', before, after });
    ok(res, after, `${t.label} updated`);
  },
});
define({
  method: 'PATCH', path: '/:type/:id/status', summary: 'Activate / deactivate a master record', screen: SCREEN,
  middleware: canWrite('masters'), request: { status: 'Inactive' }, response: { success: true, data: { ...sample, status: 'Inactive' } },
  handler: async (req, res) => {
    const t = await svc.getType(req.params.type);
    const status = parseStatus(req.body?.status ?? req.body?.isActive);
    if (!status) throw badRequest('status must be Active or Inactive');
    const { before, after } = await svc.setRecordStatus(t, req.params.id, status, req.user);
    await audit(req, { entity: `master:${t.code}`, entityId: req.params.id, action: `status:${status}`, before, after });
    ok(res, after, `${t.label} ${status === 'active' ? 'activated' : 'deactivated'}`);
  },
});
define({
  method: 'DELETE', path: '/:type/:id', summary: 'Soft-delete a master record', screen: SCREEN,
  middleware: canWrite('masters'), response: { success: true, message: 'Country deleted' },
  handler: async (req, res) => {
    const t = await svc.getType(req.params.type);
    const { before } = await svc.setRecordStatus(t, req.params.id, 'deleted', req.user);
    await audit(req, { entity: `master:${t.code}`, entityId: req.params.id, action: 'delete', before });
    ok(res, { id: Number(req.params.id) }, `${t.label} deleted`);
  },
});

export default router;
export const mount = '/masters';
