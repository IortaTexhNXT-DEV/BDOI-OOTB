/**
 * Fixed asset register (Accounts > Fixed Assets): assets, their straight-line depreciation schedule and the monthly
 * depreciation run (posting rule fa.depreciation), also run by the month-end close. read:fixed-assets to view,
 * write:fixed-assets to register assets and run the depreciation (Accounting). Asset classes: /ops-masters/asset-class.
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { sendTable } from '../documents/tabular.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Fixed Assets', '/fixed-assets');
const read = [requireAuth, requirePermission('read:fixed-assets', 'write:fixed-assets')];
const write = [requireAuth, requirePermission('write:fixed-assets')];
const S = 'Accounts > Fixed Assets';
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const asset = { id: 'fas_1', assetNumber: 'FA-2026-00001', name: 'Laptop computers (5)', classCode: 'COMPUTER', cost: 360000, salvageValue: 0, usefulLifeMonths: 36, accumulatedDepreciation: 10000,
  bookValue: 350000, status: 'active' };

define({
  method: 'GET', path: '/classes', summary: 'Active asset classes (useful life, accounts)', screen: S, middleware: read,
  response: { success: true, data: [{ code: 'COMPUTER', name: 'Computer equipment', usefulLifeMonths: 36, assetAccount: '1401003', accumulatedAccount: '1402003', expenseAccount: '4406001' }] },
  handler: async (_req, res) => ok(res, await svc.classes(pool)),
});
define({
  method: 'GET', path: '/assets', summary: 'Fixed asset register (classCode, status, search; format=xlsx or csv) with cost, accumulated depreciation and book value', screen: `${S} > Asset Register`, middleware: read,
  response: { success: true, data: { summary: { assets: 1, cost: 360000, accumulatedDepreciation: 10000, bookValue: 350000 }, rows: [asset] } },
  handler: async (req, res) => {
    const r = await svc.listAssets(pool, req.query);
    if (['xlsx', 'csv'].includes(req.query.format)) {
      sendTable(res, { header: ['Asset No.', 'Name', 'Class', 'Location', 'Custodian', 'In Service', 'Cost', 'Accumulated Depreciation', 'Book Value', 'Status'],
        rows: r.rows.map((a) => [a.assetNumber, a.name, a.className || a.classCode, a.location || '', a.custodian || '', a.inServiceDate, a.cost, a.accumulatedDepreciation, a.bookValue, a.status]),
        fileBase: 'fixed-asset-register', format: req.query.format, sheetName: 'Fixed assets' });
      return;
    }
    ok(res, r);
  },
});
define({
  method: 'GET', path: '/assets/:id', summary: 'One fixed asset with its depreciation schedule (planned, posted, covered by the opening balance)', screen: `${S} > Asset Register`, middleware: read,
  response: { success: true, data: { ...asset, schedule: [{ period: '2026-10', amount: 10000, accumulated: 10000, bookValue: 350000, status: 'posted', journalNumber: 'JV-2026-00510' }] } },
  handler: async (req, res) => ok(res, await svc.getAsset(pool, req.params.id)),
});
define({
  method: 'POST', path: '/assets', summary: 'Register a fixed asset (useful life and accounts from its class; openingAccumulated and depreciateFrom for assets carried at go-live)',
  screen: `${S} > Asset Register > New`, middleware: [...write, validate(z.object({ name: z.string().min(1).max(200), description: z.string().max(1000).optional().nullable(), classCode: z.string().min(1),
    location: z.string().max(200).optional().nullable(), custodian: z.string().max(200).optional().nullable(), serialNumber: z.string().max(100).optional().nullable(),
    supplierId: z.union([z.string(), z.number()]).optional().nullable(), acquisitionDate: date, inServiceDate: date.optional(), cost: z.number().positive(), salvageValue: z.number().min(0).optional(),
    usefulLifeMonths: z.number().int().min(1).max(600).optional(), openingAccumulated: z.number().min(0).optional(), depreciateFrom: period.optional() }))],
  request: { name: 'Laptop computers (5)', classCode: 'COMPUTER', acquisitionDate: '2026-10-01', cost: 360000, location: 'Makati office', custodian: 'IT' }, response: { success: true, data: asset },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.createAsset(db, req.body, req.user));
    await audit(req, { entity: 'fixed_asset', entityId: r.id, action: 'create', after: { ...r, schedule: undefined } });
    created(res, r, `Fixed asset ${r.assetNumber} registered`);
  },
});
define({
  method: 'PUT', path: '/assets/:id', summary: 'Change the descriptive data of an asset (name, description, location, custodian, serial number)', screen: `${S} > Asset Register`,
  middleware: [...write, validate(z.object({ name: z.string().max(200).optional(), description: z.string().max(1000).optional().nullable(), location: z.string().max(200).optional().nullable(),
    custodian: z.string().max(200).optional().nullable(), serialNumber: z.string().max(100).optional().nullable() }))], request: { location: 'Cebu branch' }, response: { success: true, data: asset },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.updateAsset(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'fixed_asset', entityId: r.after.id, action: 'update', before: { ...r.before, schedule: undefined }, after: { ...r.after, schedule: undefined } });
    ok(res, r.after, `Fixed asset ${r.after.assetNumber} updated`);
  },
});
define({
  method: 'GET', path: '/depreciation/:period', summary: 'Depreciation of a period: what is due per asset and what is already posted', screen: `${S} > Depreciation Run`, middleware: read,
  response: { success: true, data: { period: '2026-10', date: '2026-10-31', due: [{ assetNumber: 'FA-2026-00001', amount: 10000 }], total: 10000, posted: null } },
  handler: async (req, res) => ok(res, await svc.previewRun(pool, req.params.period)),
});
define({
  method: 'POST', path: '/depreciation/:period/run', summary: 'Post the depreciation of a period: one fa.depreciation journal per asset class, dated the period end; assets already depreciated for the period are skipped',
  screen: `${S} > Depreciation Run`, middleware: write, response: { success: true, data: { period: '2026-10', assets: 1, amount: 10000, journals: [{ journalNumber: 'JV-2026-00510', classCode: 'COMPUTER', amount: 10000 }] } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.runDepreciation(db, req.params.period, { user: req.user }));
    await audit(req, { entity: 'fixed_asset_depreciation', entityId: req.params.period, action: 'run', after: r });
    ok(res, r, r.assets ? `Depreciation of ${r.period} posted: ${r.amount.toFixed(2)} on ${r.assets} asset(s)` : `Nothing to depreciate for ${r.period}`);
  },
});

export default router;
export const mount = '/fixed-assets';
