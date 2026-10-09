/** SAP GL text files (/sap-gl): Accounts > SAP GL Export (TIS-BRD-INTG-04): runs of the daily file, run now / re-generate, download. */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok } from '../../lib/respond.js';
import { pageParams, sendList } from '../accounting/lib/http.js';
import { getSetting } from '../../lib/settings.js';
import { config } from '../../config.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('SAP GL Export', '/sap-gl');
const SCREEN = 'Accounts > SAP GL Export';
const read = [requireAuth, requirePermission('read:journal-vouchers')];
const write = [requireAuth, requirePermission('write:journal-vouchers')];
const run = { id: 12, exportDate: '2026-10-08', runNo: 1, windowFrom: '2026-10-07T15:59:00Z', windowTo: '2026-10-08T15:59:00Z', trigger: 'schedule', status: 'done', folder: 'sap-outbound',
  journalCount: 42, lineCount: 131, documentCount: 1, totalDebit: 1250400.5, totalCredit: 1250400.5, warnings: [],
  files: [{ kind: 'header', fileName: 'ARHDTISPH20261008.txt', records: 1, bytes: 120 }, { kind: 'line', fileName: 'ARLITISPH20261008.txt', records: 131, bytes: 23800 }] };

define({
  method: 'GET', path: '/runs', summary: 'Runs of the SAP GL file, newest first (from / to on the export date, status)', screen: SCREEN, middleware: read,
  query: { from: '2026-10-01', to: '2026-10-31', page: 1, pageSize: 20 }, response: { success: true, data: [run], pagination: { currentPage: 1, pageSize: 20, totalRecords: 1, totalPages: 1 } },
  handler: async (req, res) => { const pg = pageParams(req.query, 20); const r = await svc.listRuns(req.query, pg); sendList(res, r.rows, r.total, pg); },
});
define({
  method: 'GET', path: '/settings', summary: 'Folder, cut-off and record layout of the SAP GL file (changed on Master > Configuration, group integrations)', screen: SCREEN, middleware: read,
  response: { success: true, data: { folder: 'sap-outbound', exportDir: null, cutOff: '23:59', accountPattern: '^[0-9]{6}$', layout: { format: 'delimited' } } },
  handler: async (_req, res) => ok(res, { folder: await getSetting('sap_gl.folder', 'sap-outbound'), exportDir: config.sapGlExportDir || null,
    cutOff: await getSetting('sap_gl.cut_off', '23:59'), accountPattern: await getSetting('sap_gl.account_pattern', '^[0-9]{6}$'), layout: await getSetting('sap_gl.layout', null) }),
});
define({
  method: 'POST', path: '/runs', summary: 'Run now / re-generate the files of a day (default today): the entries posted after the previous day\'s cut-off up to the day\'s cut-off; the folder\'s files of that day are written again',
  screen: `${SCREEN} > Run now`, middleware: [...write, validate(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))],
  request: { date: '2026-10-08' }, response: { success: true, data: run },
  handler: async (req, res) => {
    const out = await svc.exportDay({ date: req.body.date, trigger: 'manual', userId: req.user.id });
    await audit(req, { entity: 'sap_gl_export', entityId: String(out.id), action: 'run', after: { exportDate: out.exportDate, runNo: out.runNo, status: out.status, lines: out.lineCount } });
    ok(res, out, out.status === 'empty' ? `Nothing was posted in the window of ${out.exportDate}; no file written` : `SAP GL files of ${out.exportDate} written (run ${out.runNo})`);
  },
});
define({
  method: 'GET', path: '/runs/:id', summary: 'One run with its files', screen: SCREEN, middleware: read, response: { success: true, data: run },
  handler: async (req, res) => ok(res, await svc.getRun(req.params.id)),
});
define({
  method: 'GET', path: '/runs/:id/files/:kind', summary: 'Download the header or line file of a run (kind header | line) as written', screen: `${SCREEN} > Download`, middleware: read,
  response: '(text/plain attachment)',
  handler: async (req, res) => {
    const f = await svc.runFile(req.params.id, req.params.kind);
    await audit(req, { entity: 'sap_gl_export', entityId: String(req.params.id), action: 'download', after: { file: f.fileName } });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${f.fileName.replace(/"/g, '')}"`);
    res.send(Buffer.from(f.content, f.encoding));
  },
});
export default router;
export const mount = '/sap-gl';
