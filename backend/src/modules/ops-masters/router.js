/**
 * Operational masters maintained by the teams that use them, on the generic master store (master_types /
 * master_records, the same records as /masters/:type, its upload template and the go-live configuration kit):
 *   short-period-rate, cancellation-reason      Master > Insurance Management (rating masters: write:masters only;
 *                                                read with read:endorsements for the cancellation screen)
 *   claim-document-requirement, repair-shop      Master > Insurance Management / Operations (write:masters or write:claims)
 *   supplier                                     Accounts > Payables > Suppliers (write:masters or write:payables)
 *   asset-class                                  Master > Finance > Asset Classes (write:masters or write:fixed-assets)
 *   cost-centre                                  Master > Finance > Cost Centres (write:masters or write:journal-vouchers)
 *   sales-activity-type, sales-activity-outcome  Master > Organization (write:masters only; read with read:sales-activities)
 *   lead-source                                  Master > Insurance Management (write:masters only; read with read:leads)
 *   reason-code                                  Master > Insurance Management (write:masters only; read with the read
 *                                                permission of a module that records a coded reason: quotations,
 *                                                claims, renewals, period-end (period close, year-end, CAS books),
 *                                                incentive (batch rejection))
 * Reading needs the read permission of an owning module (or read:masters).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, hasPermission } from '../../lib/auth.js';
import { audit } from '../../lib/audit.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { created, ok, paging, pageMeta } from '../../lib/respond.js';
import * as masters from '../masters/service.js';
import { parseStatus } from '../masters/helpers.js';

const { router, define } = moduleRouter('Operational Masters', '/ops-masters');

/** Type -> the module(s) whose permissions read and write it (besides read:masters / write:masters); write: false = masters only. */
export const OWNERS = {
  'short-period-rate': { module: 'endorsements', write: false }, 'cancellation-reason': { module: 'endorsements', write: false },
  'claim-document-requirement': { module: 'claims' }, 'repair-shop': { module: 'claims' }, supplier: { module: 'payables' }, 'asset-class': { module: 'fixed-assets' },
  'cost-centre': { module: 'journal-vouchers' },
  'sales-activity-type': { module: 'sales-activities', write: false }, 'sales-activity-outcome': { module: 'sales-activities', write: false },
  'lead-source': { module: 'leads', write: false }, 'reason-code': { module: ['quotations', 'claims', 'renewals', 'period-end', 'incentive'], write: false },
};
const SCREEN = 'Master > Insurance Management / Accounts > Payables / Master > Finance (operational masters)';

const typeOf = async (req) => {
  const code = req.params.type;
  if (!OWNERS[code]) throw notFound(`Unknown operational master ${code}`);
  return masters.getType(code);
};
const may = (kind) => (req, _res, next) => {
  const owner = OWNERS[req.params.type];
  if (!owner) return next(notFound(`Unknown operational master ${req.params.type}`));
  const mods = [].concat(owner.module);
  const perms = kind === 'read' ? [...mods.flatMap((m) => [`read:${m}`, `write:${m}`]), 'read:masters', 'write:masters']
    : [...(owner.write === false ? [] : mods.map((m) => `write:${m}`)), 'write:masters'];
  return perms.some((p) => hasPermission(req.user, p)) ? next() : next(forbidden(`Requires permission: ${perms.join(' or ')}`));
};
const readMw = [requireAuth, may('read')];
const writeMw = [requireAuth, may('write')];
const sample = { id: 12, code: 'SP06', maxDays: 183, retainedPercent: 70, description: 'Not exceeding 6 months', status: 'Active' };

define({
  method: 'GET', path: '/:type', summary: 'Records of an operational master with its field definition (search, status, paging)', screen: SCREEN, middleware: readMw,
  query: { search: 'SP', perPage: 100 }, response: { success: true, data: [sample], type: { code: 'short-period-rate', fields: [] }, total: 1 },
  handler: async (req, res) => {
    const t = await typeOf(req);
    const pg = paging(req.query, { page: 1, perPage: 200 });
    const { rows, total } = await masters.listRecords(t, req.query, pg);
    ok(res, rows, 'OK', { ...pageMeta(total, pg), type: masters.typeOut(t) });
  },
});
define({
  method: 'POST', path: '/:type', summary: 'Create a record of an operational master (validated against the type definition)', screen: SCREEN, middleware: writeMw,
  request: { code: 'SP06', maxDays: 183, retainedPercent: 70, description: 'Not exceeding 6 months' }, response: { success: true, data: sample },
  handler: async (req, res) => {
    const t = await typeOf(req);
    const rec = await masters.createRecord(t, req.body || {}, req.user);
    await audit(req, { entity: `master:${t.code}`, entityId: rec.id, action: 'create', after: rec });
    created(res, rec, `${t.label} created`);
  },
});
define({
  method: 'PUT', path: '/:type/:id', summary: 'Update a record of an operational master (partial update)', screen: SCREEN, middleware: writeMw,
  request: { retainedPercent: 72.5 }, response: { success: true, data: sample },
  handler: async (req, res) => {
    const t = await typeOf(req);
    const { before, after } = await masters.updateRecord(t, req.params.id, req.body || {}, req.user);
    await audit(req, { entity: `master:${t.code}`, entityId: req.params.id, action: 'update', before, after });
    ok(res, after, `${t.label} updated`);
  },
});
define({
  method: 'PATCH', path: '/:type/:id/status', summary: 'Activate or deactivate a record of an operational master', screen: SCREEN, middleware: writeMw,
  request: { status: 'Inactive' }, response: { success: true, data: { ...sample, status: 'Inactive' } },
  handler: async (req, res) => {
    const t = await typeOf(req);
    const status = parseStatus(req.body?.status ?? req.body?.isActive);
    if (!status) throw badRequest('status must be Active or Inactive');
    const { before, after } = await masters.setRecordStatus(t, req.params.id, status, req.user);
    await audit(req, { entity: `master:${t.code}`, entityId: req.params.id, action: `status:${status}`, before, after });
    ok(res, after, `${t.label} ${status === 'active' ? 'activated' : 'deactivated'}`);
  },
});

export default router;
export const mount = '/ops-masters';
