/** Fleet schedules API (/fleet): Operations > Fleet Schedules. */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { uploadFile, parseUploadedRows, sendTable } from '../documents/tabular.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import { renderPdf, sendPdf } from '../documents/pdf.js';
import { formatters, kv } from '../documents/templates.js';
import { printContext } from '../../lib/pdf/index.js';
import * as svc from './service.js';

const { router, define } = moduleRouter('Fleet schedules', '/fleet');
const SCREEN = 'Operations > Fleet Schedules';
const canRead = [requireAuth, requirePermission('read:fleet', 'write:fleet')];
const canWrite = [requireAuth, requirePermission('write:fleet')];

const text = (n) => z.string().max(n).optional().nullable();
const scheduleBody = z.object({
  clientId: z.string().min(1), insuranceCompanyId: z.coerce.number().int().optional().nullable(), productId: z.coerce.number().int().optional().nullable(),
  channelId: text(40), inceptionDate: z.string().min(8).max(10), expiryDate: text(10), description: text(1000),
});
const money = z.union([z.number(), z.string()]).optional().nullable();
const vehicleBody = z.object({
  plateNumber: text(20), conductionSticker: text(20), chassisNumber: text(40), engineNumber: text(40), make: text(60), model: text(80), yearModel: z.coerce.number().int().optional().nullable(),
  color: text(40), vehicleType: text(60), usage: text(40), mortgagee: text(200), sumInsured: money, ownDamageRate: money, actsOfNatureRate: money,
  bodilyInjury: money, propertyDamage: money, includeCtpl: z.union([z.boolean(), z.string()]).optional(),
});
const endorseAdd = vehicleBody.extend({ effectiveDate: text(10) });
const endorseDelete = z.object({ effectiveDate: text(10), reason: text(500) });
const example = { id: 'flt_1', fleetNumber: 'FLT-2026-00004', clientName: 'Luzon Logistics Corp.', insurerName: 'Malayan Insurance Co., Inc.', inceptionDate: '2026-10-01', expiryDate: '2027-10-01',
  status: 'issued', policyNumber: 'POL-2026-00133', vehicles: 12, activeVehicles: 11, sumInsured: 15800000, grossPremium: 268400.55 };
const vehicle = { id: 7, itemNo: 3, plateNumber: 'NBC 1234', make: 'Isuzu', model: 'D-Max 3.0 LS-A', vehicleType: 'light_medium_trucks', sumInsured: 1450000, ownDamageRate: 1.25, netPremium: 21750, taxes: 3534.38, ctplPremium: 1720, grossPremium: 27004.38, status: 'active' };

define({
  method: 'GET', path: '/', summary: 'Fleet schedules (filter status draft / issued, clientId, search on number, client or policy)', screen: SCREEN, middleware: canRead,
  query: { status: 'issued', search: 'luzon' }, response: { success: true, data: [example] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listSchedules(req.query) }),
});
define({
  method: 'GET', path: '/upload-template', summary: 'Fleet Vehicles upload template (XLSX)', screen: `${SCREEN} > Upload Vehicles > Template`, middleware: canRead, response: 'binary file',
  handler: async (_req, res) => sendTemplate(res, 'fleet-vehicles'),
});
define({
  method: 'GET', path: '/:id', summary: 'One fleet schedule (id, fleet number or policy number) with its vehicles and endorsements', screen: `${SCREEN} > Schedule`, middleware: canRead,
  response: { success: true, data: { ...example, vehicleList: [vehicle], endorsements: [{ endorsementNumber: 'END-2026-00031', type: 'Fleet: add vehicle', premiumDelta: 13502.19 }] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.getSchedule(req.params.id) }),
});
define({
  method: 'POST', path: '/', summary: 'Start a fleet schedule for a client (insurer, period)', screen: `${SCREEN} > New Schedule`, middleware: [...canWrite, validate(scheduleBody)],
  request: { clientId: 'cl_1', insuranceCompanyId: 3, inceptionDate: '2026-10-01', expiryDate: '2027-10-01', description: 'Delivery trucks and service vehicles' },
  response: { success: true, data: example },
  handler: async (req, res) => {
    const s = await svc.createSchedule(req.body, req.user.id);
    await audit(req, { entity: 'fleet_schedule', entityId: s.id, action: 'create', after: s });
    res.status(201).json({ success: true, message: `Fleet schedule ${s.fleetNumber} started`, data: s });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Change a draft fleet schedule (insurer, period, description)', screen: `${SCREEN} > Schedule > Edit`, middleware: [...canWrite, validate(scheduleBody.partial())],
  request: { expiryDate: '2027-09-30' }, response: { success: true, data: example },
  handler: async (req, res) => {
    const { before, after } = await svc.updateSchedule(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'fleet_schedule', entityId: after.id, action: 'update', before, after: { ...after, vehicleList: undefined } });
    res.json({ success: true, message: 'Fleet schedule saved', data: after });
  },
});
define({
  method: 'POST', path: '/:id/vehicles', summary: 'Add a vehicle to a draft schedule (priced at once: own damage, acts of nature, excess liability, CTPL, taxes)', screen: `${SCREEN} > Schedule > Add Vehicle`,
  middleware: [...canWrite, validate(vehicleBody)], request: { plateNumber: 'NBC 1234', make: 'Isuzu', model: 'D-Max 3.0 LS-A', vehicleType: 'light_medium_trucks', sumInsured: 1450000, ownDamageRate: 1.25, includeCtpl: true },
  response: { success: true, data: vehicle },
  handler: async (req, res) => {
    const v = await svc.addDraftVehicle(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'fleet_schedule', entityId: req.params.id, action: 'add-vehicle', after: v });
    res.status(201).json({ success: true, message: `Vehicle added as item ${v.itemNo}`, data: v });
  },
});
define({
  method: 'PUT', path: '/:id/vehicles/:vehicleId', summary: 'Change a vehicle of a draft schedule (re-priced)', screen: `${SCREEN} > Schedule > Edit Vehicle`, middleware: [...canWrite, validate(vehicleBody)],
  request: { sumInsured: 1500000 }, response: { success: true, data: vehicle },
  handler: async (req, res) => {
    const v = await svc.updateDraftVehicle(req.params.id, req.params.vehicleId, req.body, req.user.id);
    await audit(req, { entity: 'fleet_schedule', entityId: req.params.id, action: 'update-vehicle', after: v });
    res.json({ success: true, message: 'Vehicle saved', data: v });
  },
});
define({
  method: 'DELETE', path: '/:id/vehicles/:vehicleId', summary: 'Remove a vehicle from a draft schedule', screen: `${SCREEN} > Schedule > Remove Vehicle`, middleware: canWrite,
  response: { success: true, data: { removed: true } },
  handler: async (req, res) => {
    const out = await svc.removeDraftVehicle(req.params.id, req.params.vehicleId);
    await audit(req, { entity: 'fleet_schedule', entityId: req.params.id, action: 'remove-vehicle', before: { vehicleId: req.params.vehicleId } });
    res.json({ success: true, message: 'Vehicle removed', data: out });
  },
});
define({
  method: 'POST', path: '/:id/vehicles/upload', summary: 'Upload vehicles to a draft schedule (multipart field "file", Fleet Vehicles template)', screen: `${SCREEN} > Schedule > Upload Vehicles`,
  middleware: [...canWrite, uploadFile], request: 'multipart/form-data file', response: { success: true, data: { total: 12, created: 11, failed: 1, errors: [{ row: 5, message: 'Make is required' }] } },
  handler: async (req, res) => {
    const out = await svc.uploadVehicles(req.params.id, parseUploadedRows(req.file), req.user.id);
    await audit(req, { entity: 'fleet_schedule', entityId: req.params.id, action: 'upload-vehicles', after: { ...out, errors: out.errors.slice(0, 50) } });
    res.json({ success: true, message: `Processed ${out.total} vehicles: ${out.created} added, ${out.failed} failed`, data: out });
  },
});
define({
  method: 'POST', path: '/:id/issue', summary: 'Issue the fleet schedule: one policy for the total premium of its vehicles (bill, booking journal, commission)', screen: `${SCREEN} > Schedule > Issue`,
  middleware: canWrite, response: { success: true, data: { policyId: 'pol_1', billNumber: 'INV-2026-00210', grossPremium: 268400.55, vehicles: 12 } },
  handler: async (req, res) => {
    const out = await svc.issueSchedule(req.params.id, req.user);
    await audit(req, { entity: 'fleet_schedule', entityId: req.params.id, action: 'issue', after: out });
    res.json({ success: true, message: `Policy issued for ${out.vehicles} vehicles`, data: out });
  },
});
define({
  method: 'POST', path: '/:id/endorse/add-vehicle', summary: 'Add a vehicle to an issued fleet by endorsement (pro-rata additional premium billed)', screen: `${SCREEN} > Schedule > Endorse: Add Vehicle`,
  middleware: [...canWrite, validate(endorseAdd)], request: { effectiveDate: '2027-04-01', plateNumber: 'NDE 7788', make: 'Toyota', model: 'Hiace Commuter', vehicleType: 'light_medium_trucks', sumInsured: 1800000, ownDamageRate: 1.25 },
  response: { success: true, data: { endorsementNumber: 'END-2026-00031', premium: 13502.19, daysLeft: 183, factor: 0.5014 } },
  handler: async (req, res) => {
    const { effectiveDate, ...v } = req.body;
    const out = await svc.endorseAddVehicle(req.params.id, v, { effectiveDate, userId: req.user.id });
    await audit(req, { entity: 'fleet_schedule', entityId: req.params.id, action: 'endorse-add-vehicle', after: out });
    res.json({ success: true, message: `Endorsement ${out.endorsementNumber}: vehicle added, additional premium ${out.premium.toFixed(2)}`, data: out });
  },
});
define({
  method: 'POST', path: '/:id/endorse/delete-vehicle/:vehicleId', summary: 'Delete a vehicle from an issued fleet by endorsement (pro-rata return premium credited)', screen: `${SCREEN} > Schedule > Endorse: Delete Vehicle`,
  middleware: [...canWrite, validate(endorseDelete)], request: { effectiveDate: '2027-04-01', reason: 'Vehicle sold' },
  response: { success: true, data: { endorsementNumber: 'END-2026-00032', premium: -13540.88, daysLeft: 183, factor: 0.5014 } },
  handler: async (req, res) => {
    const out = await svc.endorseDeleteVehicle(req.params.id, req.params.vehicleId, { ...req.body, userId: req.user.id });
    await audit(req, { entity: 'fleet_schedule', entityId: req.params.id, action: 'endorse-delete-vehicle', after: out });
    res.json({ success: true, message: `Endorsement ${out.endorsementNumber}: vehicle deleted, return premium ${Math.abs(out.premium).toFixed(2)}`, data: out });
  },
});

const COLUMNS = [
  { key: 'itemNo', label: 'Item' }, { key: 'plate', label: 'Plate / CS' }, { key: 'vehicle', label: 'Vehicle' }, { key: 'chassisNumber', label: 'Chassis' },
  { key: 'engineNumber', label: 'Engine' }, { key: 'vehicleType', label: 'Class' }, { key: 'sumInsured', label: 'Sum insured', type: 'money' },
  { key: 'netPremium', label: 'Premium', type: 'money' }, { key: 'taxes', label: 'Taxes', type: 'money' }, { key: 'ctplPremium', label: 'CTPL', type: 'money' },
  { key: 'grossPremium', label: 'Total', type: 'money' }, { key: 'cover', label: 'On cover' },
];
const scheduleTableRows = (vehicles, f) => vehicles.map((v) => ({
  itemNo: v.itemNo, plate: v.plateNumber || v.conductionSticker || '', vehicle: [v.yearModel, v.make, v.model].filter(Boolean).join(' '), chassisNumber: v.chassisNumber || '',
  engineNumber: v.engineNumber || '', vehicleType: v.vehicleType || '', sumInsured: v.sumInsured, netPremium: v.netPremium, taxes: v.taxes, ctplPremium: v.ctplPremium,
  grossPremium: v.grossPremium, cover: v.status === 'deleted' ? `${f.date(v.coverFrom)} to ${f.date(v.coverTo)} (deleted)` : `${f.date(v.coverFrom)} to ${f.date(v.coverTo)}`,
}));

define({
  method: 'GET', path: '/:id/schedule.pdf', summary: 'Schedule of vehicles (PDF): every vehicle with its premium, CTPL and dates on cover', screen: `${SCREEN} > Schedule > Print`, middleware: canRead,
  response: 'application/pdf',
  handler: async (req, res) => {
    const { schedule: s, vehicles } = await svc.scheduleRows(req.params.id);
    const f = formatters(await printContext());
    const active = vehicles.filter((v) => v.status === 'active');
    const tot = (k) => active.reduce((t, v) => t + v[k], 0);
    const pdf = await renderPdf({
      title: 'Fleet Schedule of Vehicles', number: s.policy_number || s.fleet_number, orientation: 'landscape',
      meta: kv([['Insured', s.client_name], ['Insurer', s.insurer_name], ['Policy number', s.policy_number || 'Not yet issued'], ['Fleet schedule', s.fleet_number],
        ['Period', `${f.date(s.inception_date)} to ${f.date(s.expiry_date)}`], ['Vehicles on cover', String(active.length)]]),
      sections: [
        { heading: 'Vehicles', table: { columns: COLUMNS, rows: scheduleTableRows(vehicles, f),
          totals: { itemNo: 'Total on cover', sumInsured: tot('sumInsured'), netPremium: tot('netPremium'), taxes: tot('taxes'), ctplPremium: tot('ctplPremium'), grossPremium: tot('grossPremium') } } },
        { note: 'Premiums are annual premiums per vehicle. Vehicles added or deleted during the period are endorsed at the pro-rata premium shown on their endorsement.' },
      ],
    });
    await audit(req, { entity: 'fleet_schedule', entityId: s.id, action: 'print' });
    sendPdf(res, pdf, `fleet-schedule-${s.policy_number || s.fleet_number}.pdf`);
  },
});
define({
  method: 'GET', path: '/:id/schedule.xlsx', summary: 'Schedule of vehicles (XLSX, or CSV with format=csv)', screen: `${SCREEN} > Schedule > Export`, middleware: canRead, query: { format: 'xlsx' },
  response: 'binary file',
  handler: async (req, res) => {
    const { schedule: s, vehicles } = await svc.scheduleRows(req.params.id);
    const f = { date: (d) => (d ? String(d).slice(0, 10) : '') };
    const rows = scheduleTableRows(vehicles, f);
    await sendTable(res, { header: COLUMNS.map((c) => c.label), rows: rows.map((r) => COLUMNS.map((c) => r[c.key])), fileBase: `fleet-schedule-${s.policy_number || s.fleet_number}`,
      format: req.query.format === 'csv' ? 'csv' : 'xlsx', sheetName: 'Vehicles' });
  },
});

export default router;
export const mount = '/fleet';
