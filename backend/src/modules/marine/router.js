/**
 * Open covers API (/marine): Operations > Marine Open Covers (TIS-BRD-PJRN-09, FRS PJRN-09). Contracts of type Parcel /
 * Courier or Marine Cargo, parcel and cargo certificates with their uploads, daily and monthly declarations, the
 * declaration file to the insurer, endorsements of the open policy and reversals of declared certificates.
 * Access: read:marine; write:marine (set-up, endorsement requests, cargo shipments, declarations); write:parcel-certificates
 * (upload, add, cancel, reversal request, print of the day); approve:marine (endorsements and reversals, never one's own).
 */
import { moduleRouter } from '../../lib/registry.js';
import { hasPermission, requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { badRequest, conflict, forbidden } from '../../lib/errors.js';
import { renderPdf, sendPdf, printContext } from '../documents/pdf.js';
import { formatters } from '../documents/templates.js';
import { normKey, uploadFile } from '../documents/tabular.js';
import { readXlsx } from '../documents/xlsx.js';
import { sendTemplate } from '../documents/uploadTemplates.js';
import * as svc from './service.js';
import * as parcel from './parcel.js';
import * as files from './files.js';
import * as endorse from './endorsements.js';
import { certificatePdf, certificatesPdf } from './documents.js';
import { closeDailyDeclarations } from './daily.js';

const { router, define } = moduleRouter('Marine open covers', '/marine');
const SCREEN = 'Policy Servicing > Marine Open Covers';
const canRead = [requireAuth, requirePermission('read:marine', 'write:marine', 'write:parcel-certificates', 'approve:marine')];
const canWrite = [requireAuth, requirePermission('write:marine')];
const canParcel = [requireAuth, requirePermission('write:parcel-certificates')];
const canApprove = [requireAuth, requirePermission('approve:marine')];

const text = (n) => z.string().max(n).optional().nullable();
const amount = z.coerce.number().min(0);
const rate = z.object({ conveyance: z.string().min(1).max(20), ratePercent: z.coerce.number().positive(), limit: z.coerce.number().positive() });
const coverLine = z.object({ name: z.string().max(80), line: z.string().max(20), insurerPolicyNo: text(60), sumInsured: z.coerce.number(), premium: z.coerce.number(),
  commissionPercent: z.coerce.number().optional().nullable(), coverDays: z.union([z.null(), z.literal(''), z.coerce.number()]).optional() });
const deliveryType = z.object({ code: text(20), label: text(60), charge: z.coerce.number().min(0).optional().nullable() });
const terms = {
  insurerReference: text(60), goodsDescription: z.string().trim().min(1).max(1000), voyageScope: text(1000), clauses: text(2000), rates: z.array(rate).optional(),
  markupPercent: z.coerce.number().min(0).max(100).optional(), minimumPremium: amount.optional(), estimatedAnnualValue: amount.optional().nullable(),
  declarationFrequency: z.enum(['monthly', 'quarterly']).optional(), commissionRate: z.coerce.number().min(0).max(1).optional().nullable(),
  covers: z.array(coverLine).max(20).optional(), chargePerCertificate: z.coerce.number().min(0).optional().nullable(), deliveryTypes: z.array(deliveryType).max(10).optional(),
  remittanceBasis: z.enum(['net', 'gross']).optional(), dailyDeclaration: z.boolean().optional(), fileFrequency: z.enum(['monthly', 'daily']).optional().nullable(),
  fileLayout: text(40), declarationEmail: text(200),
};
const coverBody = z.object({
  coverType: z.enum(['cargo', 'parcel']).optional().nullable(), clientId: z.string().min(1), insuranceCompanyId: z.coerce.number().int(), productId: z.coerce.number().int().optional().nullable(),
  periodFrom: z.string().min(8).max(10), periodTo: z.string().min(8).max(10), currency: z.string().length(3).optional(), ...terms,
});
const shipment = z.object({
  shipmentDate: z.string().min(8).max(10), conveyance: z.string().min(1).max(20), vesselName: text(120), voyageFrom: z.string().trim().min(1).max(200), voyageTo: z.string().trim().min(1).max(200),
  billOfLading: text(60), goodsDescription: text(500), packing: text(200), consignee: text(200), invoiceValue: z.coerce.number().positive(), markupPercent: z.coerce.number().min(0).max(100).optional().nullable(),
});
const parcelBody = z.object({
  parcelDate: text(10), customerName: text(120), loanAccount: text(30), addressLine: text(300), barangay: text(120), city: text(120), province: text(120), zipCode: text(10),
  mobile: text(20), email: text(200), documentsSent: text(300), courier: text(80), waybillNo: text(30), deliveryType: text(40),
});
const reasonBody = z.object({ reason: z.string().trim().max(500).optional().nullable() });
const decisionBody = z.object({ decision: z.enum(['approve', 'return']), remark: text(1000) });
const cover = { id: 'ocv_1', coverNumber: 'MOC-2026-00001', coverType: 'parcel', clientName: 'Toyota Financial Services Philippines Corporation', insurerName: 'AXA Philippines',
  policyNumber: 'POL-2026-00151', insurerReference: 'MN-HO-26-000631-00', periodFrom: '2026-08-01', periodTo: '2027-08-01', rates: [],
  covers: [{ name: 'Marine (parcel)', line: 'MARINE', insurerPolicyNo: 'MN-HO-26-000631-00', sumInsured: 10000, premium: 12, commissionPercent: 3, coverDays: null },
    { name: 'Personal Accident', line: 'PA', insurerPolicyNo: '', sumInsured: 50000, premium: 50, commissionPercent: 3, coverDays: 365 }],
  premiumPerCertificate: 62, chargePerCertificate: 500, serviceFeePerCertificate: 438, remittanceBasis: 'gross', dailyDeclaration: true, fileFrequency: 'monthly', fileLayout: 'axa-parcel',
  declarationEmail: 'declarations@axa.example.ph', status: 'active', certificates: 1240, billedPremium: 76880 };
const certificate = { id: 'occ_1', certificateNumber: 'PCC-2026-002062', kind: 'parcel', shipmentDate: '2026-10-09', customerName: 'Maria Clara Reyes', loanAccount: '0701-2026-118842',
  city: 'Makati City', province: 'Metro Manila', waybillNo: '143298765012', deliveryType: 'Rush', insuredValue: 60000, premium: 62, charge: 500, late: false, possibleDuplicate: false,
  dailyDeclarationNumber: 'MDD-2026-000070', status: 'issued' };
const declaration = { id: 'ocd_1', declarationNumber: 'MDC-2026-00002', period: '2026-09', shipments: 1240, reversals: 0, totalInsured: 74400000, premium: 76880, vat: 7365.75, dst: 7672.66,
  lgt: 460.35, grossPremium: 76880, taxesInside: true, chargeTotal: 620000, serviceFee: 543120, commission: 2306.4, fileStatus: 'generated', status: 'submitted' };
const binaryXlsx = (res, out) => {
  res.setHeader('Content-Type', out.contentType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${out.fileName}"`);
  res.send(out.content);
};
/** Rows of an uploaded .xlsx (headers normalised); MSG-PCL-020 for any other file. */
const xlsxRows = (req) => {
  const name = req.file?.originalname || '';
  if (!req.file?.buffer?.length || !name.toLowerCase().endsWith('.xlsx')) throw badRequest('Upload an Excel (.xlsx) file', [{ path: 'file', message: 'Upload an Excel (.xlsx) file', code: 'MSG-PCL-020' }]);
  let table;
  try { table = readXlsx(req.file.buffer); } catch (e) { throw badRequest(`Could not read the file: ${e.message}`); }
  const headers = (table[0] || []).map(normKey);
  const rows = table.slice(1).filter((r) => r.some((c) => String(c ?? '').trim() !== '')).map((r) => Object.fromEntries(headers.map((h, i) => [h, String(r[i] ?? '').trim()])));
  return { rows, headers, fileName: name };
};

// ------------------------------------------------------------------ open covers
define({
  method: 'GET', path: '/open-covers', summary: 'Open covers (filter status draft / active / expired / cancelled, type parcel / cargo, search on number, client or policy)', screen: SCREEN, middleware: canRead,
  query: { status: 'active', type: 'parcel' }, response: { success: true, data: [cover] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listCovers(req.query) }),
});
define({
  method: 'GET', path: '/choices', summary: 'Choices of the open cover panels: types, covers and charge proposed, delivery types, lines, declaration file layouts, documents, reasons', screen: `${SCREEN} > New Open Cover`,
  middleware: canRead, response: { success: true, data: { types: [{ value: 'parcel', label: 'Parcel / Courier' }], defaultCharge: 500, layouts: [{ value: 'axa-parcel', label: 'AXA parcel layout' }] } },
  handler: async (_req, res) => res.json({ success: true, data: await svc.coverChoices() }),
});
define({
  method: 'GET', path: '/open-covers/:id', summary: 'One open cover with its certificates, daily and monthly declarations and endorsements', screen: `${SCREEN} > Open Cover`, middleware: canRead,
  response: { success: true, data: { ...cover, certificateList: [certificate], declarations: [declaration], dailyDeclarations: [], endorsements: [] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.getCover(req.params.id) }),
});
define({
  method: 'POST', path: '/open-covers', summary: 'Set up an open cover: type Parcel / Courier (covers on each certificate, charge per certificate) or Marine Cargo (rate and limit per conveyance), remittance basis, daily declaration and declaration file',
  screen: `${SCREEN} > New Open Cover`, middleware: [...canWrite, validate(coverBody)],
  request: { coverType: 'parcel', clientId: 'cl_1', insuranceCompanyId: 3, insurerReference: 'MN-HO-26-000631-00', periodFrom: '2026-08-01', periodTo: '2027-08-01',
    goodsDescription: 'Loan collateral documents sent by LBC Express', covers: cover.covers, chargePerCertificate: 500, remittanceBasis: 'gross', fileFrequency: 'monthly', fileLayout: 'axa-parcel',
    declarationEmail: 'declarations@axa.example.ph' },
  response: { success: true, data: cover },
  handler: async (req, res) => {
    const c = await svc.createCover(req.body, req.user.id);
    await audit(req, { entity: 'open_cover', entityId: c.id, action: 'create', after: { ...c, certificateList: undefined, declarations: undefined, dailyDeclarations: undefined, endorsements: undefined } });
    res.status(201).json({ success: true, message: `Open cover ${c.coverNumber} created`, data: c });
  },
});
define({
  method: 'PUT', path: '/open-covers/:id', summary: 'Change a draft open cover (an active one is changed by an endorsement unless marine.endorse_active_covers is off)', screen: `${SCREEN} > Open Cover > Edit`,
  middleware: [...canWrite, validate(coverBody.partial())], request: { chargePerCertificate: 500 }, response: { success: true, data: cover },
  handler: async (req, res) => {
    const { before, after } = await svc.updateCover(req.params.id, req.body, req.user.id);
    await audit(req, { entity: 'open_cover', entityId: after.id, action: 'update', before, after: { ...after, certificateList: undefined, declarations: undefined, dailyDeclarations: undefined, endorsements: undefined } });
    res.json({ success: true, message: 'Open cover saved', data: after });
  },
});
define({
  method: 'POST', path: '/open-covers/:id/activate', summary: 'Activate the open cover: its open policy is issued without a bill (premium is billed on the declarations)', screen: `${SCREEN} > Open Cover > Activate`,
  middleware: canWrite, response: { success: true, data: { policyId: 'pol_1' } },
  handler: async (req, res) => {
    const out = await svc.activateCover(req.params.id, req.user);
    await audit(req, { entity: 'open_cover', entityId: req.params.id, action: 'activate', after: out });
    res.json({ success: true, message: 'Open cover activated', data: out });
  },
});
define({
  method: 'POST', path: '/open-covers/:id/cancel', summary: 'Cancel an open cover (no open declaration may remain)', screen: `${SCREEN} > Open Cover > Cancel`, middleware: [...canWrite, validate(z.object({ reason: z.string().trim().min(1).max(500) }))],
  request: { reason: 'Client moved its cargo account' }, response: { success: true, data: cover },
  handler: async (req, res) => {
    const { before, after } = await svc.cancelCover(req.params.id, req.body.reason, req.user.id);
    await audit(req, { entity: 'open_cover', entityId: after.id, action: 'cancel', before, after: { status: after.status, reason: req.body.reason } });
    res.json({ success: true, message: 'Open cover cancelled', data: after });
  },
});

// ------------------------------------------------------------------ endorsements of the open policy
define({
  method: 'POST', path: '/open-covers/:id/endorsements', summary: 'Endorse the open policy: changed terms, Effective from and reason, submitted for approval (approve:marine, never the maker)',
  screen: `${SCREEN} > Open Cover > Endorse Open Policy`, middleware: [...canWrite, validate(z.object({ effectiveFrom: z.string().max(10), reason: z.string().max(1000).optional().nullable(),
    changes: z.object(terms).partial() }))],
  request: { effectiveFrom: '2026-11-01', reason: 'AXA premium review', changes: { covers: [cover.covers[0], { ...cover.covers[1], premium: 55 }], chargePerCertificate: 500 } },
  response: { success: true, data: { id: 'oce_1', status: 'pending', effectiveFrom: '2026-11-01', changedFields: ['covers'] } },
  handler: async (req, res) => {
    const e = await endorse.submitEndorsement(req.params.id, req.body, req.user);
    await audit(req, { entity: 'open_cover_endorsement', entityId: e.id, action: 'submit', after: e });
    res.status(201).json({ success: true, message: 'Endorsement submitted for approval', data: e });
  },
});
define({
  method: 'GET', path: '/endorsements/:id', summary: 'One endorsement of an open policy with the terms before and after', screen: `${SCREEN} > Open Cover > Endorsements`, middleware: canRead,
  response: { success: true, data: { id: 'oce_1', endorsementNumber: 'MOE-2026-00001', status: 'approved' } },
  handler: async (req, res) => res.json({ success: true, data: await endorse.getEndorsement(req.params.id) }),
});
define({
  method: 'POST', path: '/endorsements/:id/decision', summary: 'Approve (number MOE-, terms applied from the effective date) or return (remark) an endorsement; never the maker', screen: 'My Work > Approvals',
  middleware: [...canApprove, validate(decisionBody)], request: { decision: 'approve' }, response: { success: true, data: { id: 'oce_1', endorsementNumber: 'MOE-2026-00001', status: 'approved' } },
  handler: async (req, res) => {
    const out = await endorse.decideEndorsement(req.params.id, req.body, req.user);
    await audit(req, { entity: 'open_cover_endorsement', entityId: out.endorsement.id, action: req.body.decision === 'return' ? 'return' : 'approve', after: out.endorsement, remark: req.body.remark || undefined });
    res.json({ success: true, message: out.message, data: out.endorsement });
  },
});
define({
  method: 'POST', path: '/endorsements/:id/recall', summary: 'Recall a pending endorsement (its maker)', screen: `${SCREEN} > Open Cover > Endorsements`, middleware: canWrite,
  response: { success: true, data: { id: 'oce_1', status: 'recalled' } },
  handler: async (req, res) => {
    const e = await endorse.recallEndorsement(req.params.id, req.user);
    await audit(req, { entity: 'open_cover_endorsement', entityId: e.id, action: 'recall', after: { status: e.status } });
    res.json({ success: true, message: 'Endorsement recalled', data: e });
  },
});

// ------------------------------------------------------------------ certificates
define({
  method: 'GET', path: '/open-covers/:id/certificates', summary: 'Certificates of an open cover (from, to: parcel or shipment date; search name, loan account, waybill or number; status)', screen: `${SCREEN} > Open Cover > Certificates`,
  middleware: canRead, query: { from: '2026-10-01', to: '2026-10-09', search: 'Reyes' }, response: { success: true, data: [certificate] },
  handler: async (req, res) => res.json({ success: true, data: await svc.listCertificates((await svc.getCoverRow(req.params.id)).id, req.query) }),
});
define({
  method: 'GET', path: '/open-covers/:id/certificates/register', summary: 'Parcel certificate register of the certificates of a date range (Excel)', screen: `${SCREEN} > Open Cover > Certificates > Export`,
  middleware: canRead, query: { from: '2026-10-01', to: '2026-10-09' }, response: 'binary file',
  handler: async (req, res) => {
    const c = await svc.getCoverRow(req.params.id);
    binaryXlsx(res, await files.certificateRegister({ coverId: c.id, from: req.query.from, to: req.query.to }));
  },
});
define({
  method: 'POST', path: '/open-covers/:id/certificates', summary: 'Issue a marine cargo certificate for a shipment (within the period and the limit of its conveyance; premium = insured value x rate, at least the minimum)',
  screen: `${SCREEN} > Open Cover > Issue Certificate`, middleware: [...canWrite, validate(shipment)],
  request: { shipmentDate: '2026-10-08', conveyance: 'Land', voyageFrom: 'Manila', voyageTo: 'Batangas City', billOfLading: 'DR-0051234', invoiceValue: 850000 },
  response: { success: true, data: { ...certificate, kind: 'certificate' } },
  handler: async (req, res) => {
    const x = await svc.issueCertificate(req.params.id, req.body, req.user.id, 'certificate');
    await audit(req, { entity: 'marine_certificate', entityId: x.id, action: 'issue', after: x });
    res.status(201).json({ success: true, message: `Certificate ${x.certificateNumber} issued`, data: x });
  },
});
define({
  method: 'POST', path: '/open-covers/:id/declared-items', summary: 'Enter a cargo shipment sent without a certificate, to be declared and billed with its period', screen: `${SCREEN} > Open Cover > Declarations > Add Shipment`,
  middleware: [...canWrite, validate(shipment)], request: { shipmentDate: '2026-10-21', conveyance: 'Land', voyageFrom: 'Manila', voyageTo: 'Laguna', invoiceValue: 650000 },
  response: { success: true, data: { ...certificate, kind: 'declared' } },
  handler: async (req, res) => {
    const x = await svc.issueCertificate(req.params.id, req.body, req.user.id, 'declared');
    await audit(req, { entity: 'marine_certificate', entityId: x.id, action: 'declare', after: x });
    res.status(201).json({ success: true, message: `Shipment ${x.certificateNumber} entered`, data: x });
  },
});
define({
  method: 'POST', path: '/open-covers/:id/parcels', summary: 'Add one parcel: the checks of FR-PCL-012, one certificate with the covers and premium of the open cover, the daily declaration of its date (late when closed)',
  screen: `${SCREEN} > Open Cover > Certificates > Add Parcel`, middleware: [...canParcel, validate(parcelBody)],
  request: { parcelDate: '2026-10-09', customerName: 'Maria Clara Reyes', loanAccount: '0701-2026-118842', addressLine: '18 Sampaguita St.', city: 'Makati City', province: 'Metro Manila',
    email: 'maria.reyes@example.ph', documentsSent: 'Certificate of registration; Deed of sale', waybillNo: '143298765012', deliveryType: 'Rush' },
  response: { success: true, data: { ...certificate, warnings: [] } },
  handler: async (req, res) => {
    const x = await parcel.issueParcel(req.params.id, req.body, req.user);
    await audit(req, { entity: 'marine_certificate', entityId: x.id, action: 'issue', after: { ...x, warnings: undefined } });
    res.status(201).json({ success: true, message: `Certificate ${x.certificateNumber} issued`, warnings: x.warnings, data: x });
  },
});
define({
  method: 'GET', path: '/parcels/template', summary: 'TFS parcel list template (XLSX: Data, Columns, Instructions)', screen: `${SCREEN} > Open Cover > Certificates > Upload Parcels > Template`, middleware: canRead,
  response: 'binary file', handler: async (_req, res) => sendTemplate(res, 'parcel-list'),
});
define({
  method: 'POST', path: '/open-covers/:id/parcels/upload', summary: 'Upload the TFS daily parcel list (.xlsx, multipart "file", field parcelDate for rows without one): one certificate per valid row; failed rows and warnings listed',
  screen: `${SCREEN} > Open Cover > Certificates > Upload Parcels`, middleware: [...canParcel, uploadFile], request: 'multipart/form-data file, parcelDate',
  response: { success: true, message: 'Processed 43 rows: 42 created, 1 failed', data: { total: 43, created: 42, failed: 1, errors: [{ row: 17, text: 'Row 17: Waybill 143298765012 is already on certificate PCC-2026-002062' }] } },
  handler: async (req, res) => {
    const c = await svc.getCoverRow(req.params.id);
    if (c.status !== 'active' || c.cover_type !== 'parcel') throw conflict('Parcels can only be uploaded on an active Parcel / Courier open cover');
    const out = await parcel.uploadParcels({ coverId: c.id, ...xlsxRows(req), itemDate: req.body?.parcelDate || null }, req.user);
    await audit(req, { entity: 'open_cover', entityId: c.id, action: 'upload-parcels', after: { fileName: req.file.originalname, rows: out.total, created: out.created, failed: out.failed, messages: out.messages.slice(0, 50) } });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'GET', path: '/shipments/template', summary: 'Cargo shipment list template (XLSX: Data, Columns, Instructions)', screen: `${SCREEN} > Open Cover > Certificates > Upload Shipments > Template`, middleware: canRead,
  response: 'binary file', handler: async (_req, res) => sendTemplate(res, 'cargo-shipments'),
});
define({
  method: 'POST', path: '/open-covers/:id/shipments/upload', summary: 'Upload the client\'s daily shipments on a Marine Cargo open cover (.xlsx, multipart "file"): each row priced as Issue certificate; failed rows listed',
  screen: `${SCREEN} > Open Cover > Certificates > Upload Shipments`, middleware: [...canWrite, uploadFile], request: 'multipart/form-data file',
  response: { success: true, message: 'Processed 4 rows: 3 created, 1 failed', data: { total: 4, created: 3, failed: 1 } },
  handler: async (req, res) => {
    const c = await svc.getCoverRow(req.params.id);
    const out = await parcel.uploadShipments({ coverId: c.id, ...xlsxRows(req) }, req.user);
    await audit(req, { entity: 'open_cover', entityId: c.id, action: 'upload-shipments', after: { fileName: req.file.originalname, rows: out.total, created: out.created, failed: out.failed, messages: out.messages.slice(0, 50) } });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'GET', path: '/open-covers/:id/uploads', summary: 'Parcel and shipment uploads of an open cover with their counts and failed rows', screen: `${SCREEN} > Open Cover > Certificates`, middleware: canRead,
  response: { success: true, data: [{ id: 'ocu_1', kind: 'parcels', fileName: 'tfs-parcels-1009.xlsx', rowsTotal: 43, rowsCreated: 42, rowsFailed: 1 }] },
  handler: async (req, res) => res.json({ success: true, data: await parcel.listUploads((await svc.getCoverRow(req.params.id)).id) }),
});
define({
  method: 'GET', path: '/open-covers/:id/certificates/day-print', summary: 'Print certificates of the day: one PDF with the parcel certificates of a parcel date that were not e-mailed', screen: `${SCREEN} > Open Cover > Certificates > Print Certificates of the Day`,
  middleware: canParcel, query: { date: '2026-10-09' }, response: 'application/pdf',
  handler: async (req, res) => {
    const c = await svc.getCoverRow(req.params.id);
    const { date, rows } = await parcel.certificatesOfDay(c.id, req.query.date);
    const pdf = await certificatesPdf(rows);
    await audit(req, { entity: 'open_cover', entityId: c.id, action: 'print-day', after: { date, certificates: rows.map((x) => x.certificate_number) } });
    sendPdf(res, pdf, `parcel-certificates-${date}.pdf`);
  },
});
define({
  method: 'POST', path: '/certificates/:id/cancel', summary: 'Cancel a certificate not yet on a submitted declaration (reason; a parcel certificate: one of parcel.cancel_reasons)', screen: `${SCREEN} > Open Cover > Certificates > Cancel`,
  middleware: [requireAuth, requirePermission('write:marine', 'write:parcel-certificates'), validate(reasonBody)], request: { reason: 'Parcel not sent' }, response: { success: true, data: { ...certificate, status: 'cancelled' } },
  handler: async (req, res) => {
    const x0 = await svc.getCertificateRow(req.params.id);
    // a parcel certificate is cancelled with write:parcel-certificates, a cargo certificate with write:marine
    if (!hasPermission(req.user, x0.kind === 'parcel' ? 'write:parcel-certificates' : 'write:marine')) throw forbidden('You do not have permission to cancel this certificate');
    const x = await svc.cancelCertificate(req.params.id, req.body.reason, req.user);
    await audit(req, { entity: 'marine_certificate', entityId: x.id, action: 'cancel', after: { status: x.status, reason: req.body.reason } });
    res.json({ success: true, message: `Certificate ${x.certificateNumber} cancelled`, data: x });
  },
});
define({
  method: 'POST', path: '/certificates/:id/reversal', summary: 'Request the reversal of a declared parcel certificate (reason; within parcel.reversal_max_days), approved by a second user', screen: `${SCREEN} > Open Cover > Certificates > Reverse Certificate`,
  middleware: [...canParcel, validate(reasonBody)], request: { reason: 'Parcel not sent' }, response: { success: true, data: { ...certificate, status: 'declared', reversalStatus: 'pending' } },
  handler: async (req, res) => {
    const x = await parcel.requestReversal(req.params.id, req.body.reason, req.user);
    await audit(req, { entity: 'marine_certificate', entityId: x.id, action: 'request-reversal', after: { reversalStatus: x.reversalStatus, reason: req.body.reason } });
    res.json({ success: true, message: `Reversal of certificate ${x.certificateNumber} submitted for approval`, data: x });
  },
});
define({
  method: 'POST', path: '/certificates/:id/reversal/decision', summary: 'Approve (Reversed: negative line on the next monthly declaration) or return the reversal of a certificate; never the requester', screen: 'My Work > Approvals',
  middleware: [...canApprove, validate(decisionBody)], request: { decision: 'approve' }, response: { success: true, data: { ...certificate, status: 'reversed', reversalStatus: 'approved' } },
  handler: async (req, res) => {
    const out = await parcel.decideReversal(req.params.id, req.body, req.user);
    await audit(req, { entity: 'marine_certificate', entityId: out.certificate.id, action: req.body.decision === 'return' ? 'return-reversal' : 'reverse',
      after: { status: out.certificate.status, reversalStatus: out.certificate.reversalStatus, declaration: out.certificate.reversalDeclarationNumber, requestedBy: out.certificate.reversalRequestedBy }, remark: req.body.remark || undefined });
    res.json({ success: true, message: out.message, data: out.certificate });
  },
});
define({
  method: 'GET', path: '/certificates/:id/print', summary: 'Certificate of insurance (PDF): parcel certificate or marine cargo certificate; CANCELLED watermark when cancelled', screen: `${SCREEN} > Open Cover > Certificates > Print`, middleware: canRead, response: 'application/pdf',
  handler: async (req, res) => {
    const { pdf, row } = await certificatePdf(req.params.id);
    await audit(req, { entity: 'marine_certificate', entityId: row.id, action: 'print' });
    sendPdf(res, pdf, `${row.kind === 'parcel' ? 'parcel' : 'marine'}-certificate-${row.certificate_number}.pdf`);
  },
});

// ------------------------------------------------------------------ daily and monthly declarations
define({
  method: 'POST', path: '/open-covers/:id/daily/close', summary: 'Close the daily declarations of the days already ended (as the job Daily declaration close; never today before its cut-off)', screen: `${SCREEN} > Open Cover > Daily Declarations`,
  middleware: canWrite, response: { success: true, data: { closed: 1, nil: 2 } },
  handler: async (req, res) => {
    const c = await svc.getCoverRow(req.params.id);
    const out = await closeDailyDeclarations({ coverId: c.id });
    await audit(req, { entity: 'open_cover', entityId: c.id, action: 'daily-close', after: out });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'POST', path: '/open-covers/:id/declarations', summary: 'Open the declaration of a period (YYYY-MM): the items of the period (daily declarations, late items, reversals) are attached and priced', screen: `${SCREEN} > Open Cover > Declarations > New`,
  middleware: [...canWrite, validate(z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) }))], request: { period: '2026-09' }, response: { success: true, data: { ...declaration, status: 'draft' } },
  handler: async (req, res) => {
    const d = await svc.createDeclaration(req.params.id, req.body.period, req.user.id);
    await audit(req, { entity: 'marine_declaration', entityId: d.id, action: 'create', after: { ...d, items: undefined, reversalItems: undefined, dailyDeclarations: undefined } });
    res.status(201).json({ success: true, message: `Declaration ${d.declarationNumber} opened`, data: d });
  },
});
define({
  method: 'GET', path: '/declarations/:id', summary: 'One declaration with its items, reversals, daily declarations, lines per cover and files', screen: `${SCREEN} > Open Cover > Declarations`, middleware: canRead,
  response: { success: true, data: { ...declaration, items: [certificate], reversalItems: [], dailyDeclarations: [], files: [] } },
  handler: async (req, res) => res.json({ success: true, data: await svc.getDeclaration(req.params.id) }),
});
define({
  method: 'POST', path: '/declarations/:id/refresh', summary: 'Recompute a draft declaration (items added since)', screen: `${SCREEN} > Open Cover > Declarations > Refresh`, middleware: canWrite,
  response: { success: true, data: declaration },
  handler: async (req, res) => res.json({ success: true, message: 'Declaration recomputed', data: await svc.refreshDeclaration(req.params.id) }),
});
define({
  method: 'POST', path: '/declarations/:id/submit', summary: 'Submit the declaration (no items: nil return); refused while a daily declaration of the period is open; writes the declaration file', screen: `${SCREEN} > Open Cover > Declarations > Submit`,
  middleware: [...canWrite, validate(z.object({ notes: text(1000) }))], request: { notes: 'Confirmed by the client on 3 November' }, response: { success: true, data: { ...declaration, status: 'submitted' } },
  handler: async (req, res) => {
    const d = await svc.submitDeclaration(req.params.id, req.body, req.user);
    await audit(req, { entity: 'marine_declaration', entityId: d.id, action: 'submit', after: { status: d.status, premium: d.premium, grossPremium: d.grossPremium, chargeTotal: d.chargeTotal, fileStatus: d.fileStatus } });
    res.json({ success: true, message: d.status === 'nil' ? 'Nil declaration recorded' : `Declaration ${d.declarationNumber} submitted`, data: d });
  },
});
define({
  method: 'POST', path: '/declarations/:id/bill', summary: 'Bill a submitted declaration on the open policy on the cover\'s remittance basis (parcel: charge per certificate, service fee, commission to Direct Bill Processing on gross)', screen: `${SCREEN} > Open Cover > Declarations > Bill`,
  middleware: canWrite, response: { success: true, data: { receivableId: 'rcv_1', billNumber: 'INV-2026-00230', amount: 620000, premium: 76880, serviceFee: 543120, remittanceBasis: 'gross' } },
  handler: async (req, res) => {
    const out = await svc.billDeclaration(req.params.id, req.user);
    await audit(req, { entity: 'marine_declaration', entityId: req.params.id, action: 'bill', after: out });
    res.json({ success: true, message: `Bill ${out.billNumber} raised`, data: out });
  },
});
define({
  method: 'DELETE', path: '/declarations/:id', summary: 'Delete a draft declaration (its items become undeclared again)', screen: `${SCREEN} > Open Cover > Declarations > Delete`, middleware: canWrite,
  response: { success: true, data: { declarationNumber: 'MDC-2026-00003' } },
  handler: async (req, res) => {
    const d = await svc.deleteDeclaration(req.params.id);
    await audit(req, { entity: 'marine_declaration', entityId: d.id, action: 'delete', before: d });
    res.json({ success: true, message: 'Declaration deleted', data: d });
  },
});
define({
  method: 'POST', path: '/declarations/:id/file', summary: 'Write the declaration file again (a new version; refused when the totals differ or the insurer accepted)', screen: `${SCREEN} > Open Cover > Declarations > Declaration File`,
  middleware: canWrite, response: { success: true, data: { version: 2, fileName: 'AXA_MN-HO-26-000631-00_202609_MDC-2026-00002.xlsx', rows: 2480, totalPremium: 76880 } },
  handler: async (req, res) => {
    const out = await files.generateFile(req.params.id, req.user);
    await audit(req, { entity: 'marine_declaration', entityId: req.params.id, action: 'generate-file', after: out });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'GET', path: '/declarations/:id/file', summary: 'Download the declaration file (latest version, or ?version=)', screen: `${SCREEN} > Open Cover > Declarations > Declaration File`, middleware: canRead,
  query: { version: '1' }, response: 'binary file',
  handler: async (req, res) => binaryXlsx(res, await files.latestFile(req.params.id, req.query.version ? Number(req.query.version) : null)),
});
define({
  method: 'POST', path: '/declarations/:id/send', summary: 'Send the declaration to the insurer: e-mail to the cover\'s declaration e-mail with the file, the summary and the certificate register', screen: `${SCREEN} > Open Cover > Declarations > Send to Insurer`,
  middleware: canWrite, response: { success: true, data: { emailId: 12, to: 'declarations@axa.example.ph', attachments: 3 } },
  handler: async (req, res) => {
    const out = await files.sendDeclaration(req.params.id, req.user);
    await audit(req, { entity: 'marine_declaration', entityId: req.params.id, action: 'send', after: out });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'POST', path: '/declarations/:id/acceptance', summary: 'Record the insurer\'s acceptance: date, reference, Accepted or Accepted with differences (rows, premium, remark)', screen: `${SCREEN} > Open Cover > Declarations > Record Acceptance`,
  middleware: [...canWrite, validate(z.object({ date: text(10), reference: text(60), result: z.enum(['accepted', 'accepted-with-differences']), rows: z.coerce.number().int().min(0).optional().nullable(),
    premium: z.coerce.number().optional().nullable(), remark: text(1000) }))],
  request: { date: '2026-10-08', reference: 'AXA-DCL-2026-0912', result: 'accepted-with-differences', rows: 1239, premium: 76818, remark: 'PCC-2026-001102 not received' },
  response: { success: true, data: { acceptance: { result: 'accepted-with-differences' } } },
  handler: async (req, res) => {
    const out = await files.recordAcceptance(req.params.id, req.body, req.user);
    await audit(req, { entity: 'marine_declaration', entityId: req.params.id, action: 'acceptance', after: out.acceptance });
    res.json({ success: true, message: out.message, data: out });
  },
});
define({
  method: 'GET', path: '/declarations/:id/register', summary: 'Parcel certificate register of a declaration (Excel)', screen: `${SCREEN} > Open Cover > Declarations > Certificate Register`, middleware: canRead,
  response: 'binary file', handler: async (req, res) => binaryXlsx(res, await files.certificateRegister({ declarationId: req.params.id })),
});
define({
  method: 'GET', path: '/declarations/:id/print', summary: 'Declaration summary (parcel: covers with the taxes inside, daily declarations, reversals, totals) or Declaration of Shipments (cargo), PDF',
  screen: `${SCREEN} > Open Cover > Declarations > Print`, middleware: canRead, response: 'application/pdf',
  handler: async (req, res) => {
    const spec = await files.declarationSummarySpec(req.params.id, formatters(await printContext()));
    sendPdf(res, await renderPdf(spec), `declaration-${spec.number}.pdf`);
  },
});

export default router;
export const mount = '/marine';
