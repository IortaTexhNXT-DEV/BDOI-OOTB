import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { ok, created, paging } from '../../lib/respond.js';
import { memoryUpload } from '../../lib/uploadLimits.js';
import { sendEntity, actor } from '../documents/common.js';
import { ownRecord, withScope, scopeOf } from '../../lib/scope.js';
import * as svc from './service.js';
import * as kyc from './kyc.js';

const { router, define } = moduleRouter('Clients', '/clients');
const customers = moduleRouter('Clients', '/customers');
const SCREEN = 'Operations > Clients';
const canRead = [requireAuth, requirePermission('read:clients')];
const canWrite = [requireAuth, requirePermission('write:clients')];
// the customer codes of the bulk print of Receipts and Disbursement: Cash Control receipts without the client register
const canListCodes = [requireAuth, requirePermission('read:clients', 'read:receipts', 'read:disbursements')];
const docUpload = memoryUpload({ files: 1 }).single('file');

const clientBody = z.object({
  firstName: z.string().max(100).optional().nullable(), lastName: z.string().max(100).optional().nullable(),
  companyName: z.string().max(200).optional().nullable(), emailId: z.string().email().optional().nullable().or(z.literal('')),
  contactNumber: z.string().max(40).optional().nullable(), DOB: z.string().optional().nullable(), leadCategory: z.string().max(40).optional().nullable(),
  status: z.enum(['active', 'inactive', 'deleted']).optional(),
}).passthrough();
const example = { clientId: 'cl_1', generatedClientId: 'CL-2026-00001', firstName: 'Juan', lastName: 'Dela Cruz', emailId: 'juan@example.com', contactNumber: '09171234567', leadCategory: 'Retail', policies: [{ policyId: 'pol_1', policyNumber: 'POL-2026-00001', status: 'Active' }] };

define({
  method: 'GET', path: '/', summary: 'List clients (search, leadCategory, clientType individual / corporate, status; paging)', screen: SCREEN, middleware: canRead,
  query: { page: 1, pageSize: 10, search: 'juan' },
  response: { success: true, data: { clients: [example], pagination: { page: 1, pageSize: 10, totalCount: 1, totalPages: 1 } } },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows } = await svc.listClients(await withScope(req), pg);
    const pagination = { page: pg.page, pageSize: pg.perPage, totalCount: total, totalPages: Math.ceil(total / pg.perPage) };
    res.json({ success: true, data: { clients: rows.map((r) => svc.toClient(r)), pagination }, total, page: pg.page, pageSize: pg.perPage });
  },
});
define({
  method: 'GET', path: '/:id', summary: 'Get one client with its policies (by id or client code)', screen: `${SCREEN} > Client view / Payment options`, middleware: [...canRead, ownRecord('client')],
  response: { ...example, success: true, data: example },
  handler: async (req, res) => sendEntity(res, svc.toClient(await svc.getClient(req.params.id))),
});
define({
  method: 'POST', path: '/', summary: 'Create a client', screen: SCREEN, middleware: [...canWrite, validate(clientBody.refine((b) => b.firstName || b.companyName, { message: 'firstName or companyName is required', path: ['firstName'] }))],
  request: { firstName: 'Juan', lastName: 'Dela Cruz', emailId: 'juan@example.com', leadCategory: 'Retail' }, response: { ...example, success: true },
  handler: async (req, res) => {
    const client = svc.toClient(await svc.createClient(req.body, actor(req)));
    await audit(req, { entity: 'client', entityId: client.id, action: 'create', after: client });
    sendEntity(res, client, { status: 201, message: 'Client created' });
  },
});
define({
  method: 'PUT', path: '/:id', summary: 'Update a client', screen: `${SCREEN} > Edit`, middleware: [...canWrite, ownRecord('client'), validate(clientBody)],
  request: { contactNumber: '09179998888' }, response: { ...example, success: true },
  handler: async (req, res) => {
    const { before, after } = await svc.updateClient(req.params.id, req.body, actor(req));
    const client = svc.toClient(after);
    await audit(req, { entity: 'client', entityId: client.id, action: 'update', before: svc.toClient(before), after: client });
    sendEntity(res, client, { message: 'Client updated' });
  },
});
define({
  method: 'POST', path: '/from-lead/:leadId', summary: 'Convert a lead into a client (returns the existing client when already converted)', screen: 'Operations > Quotation > Convert to policy',
  middleware: [...canWrite, ownRecord('lead', 'leadId')], request: { contactNumber: '09171234567' }, response: { ...example, success: true },
  handler: async (req, res) => {
    const client = svc.toClient(await svc.convertLead(req.params.leadId, req.body || {}, actor(req)));
    await audit(req, { entity: 'client', entityId: client.id, action: 'convert-lead', after: { leadId: req.params.leadId, clientId: client.id } });
    sendEntity(res, client, { status: 201, message: 'Lead converted to client' });
  },
});

// ---------------------------------------------------------------- onboarding before the first policy (customer due diligence)
const PH_MOBILE = /^(\+639|09)\d{9}$/;
const PH_TIN = /^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const optText = (n) => z.string().trim().max(n).optional().nullable();
const kycFields = {
  firstName: optText(100), middleName: optText(100), lastName: optText(100), suffix: optText(20), companyName: optText(200), tradeName: optText(200),
  clientType: z.enum(['individual', 'corporate']), customerType: optText(40), emailId: z.string().email().optional().nullable().or(z.literal('')),
  contactNumber: z.string().trim().transform((v) => v.replace(/[\s-]/g, '')).refine((v) => PH_MOBILE.test(v), 'Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX'),
  taxNumber: z.string().trim().refine((v) => PH_TIN.test(v), 'TIN: 000-000-000 or 000-000-000-00000').optional().nullable().or(z.literal('')),
  DOB: day.optional().nullable().or(z.literal('')), placeOfBirth: optText(150), gender: optText(20), civilStatus: optText(40), nationality: optText(80),
  occupation: optText(150), employerName: optText(200), sourceOfFunds: optText(300), idType: optText(80), idNumber: optText(60), idExpiry: day.optional().nullable().or(z.literal('')),
  registrationAuthority: z.enum(['SEC', 'DTI', 'CDA', 'Other']).optional().nullable(), registrationNumber: optText(60), registrationDate: day.optional().nullable().or(z.literal('')),
  businessNature: optText(200), incorporationCountry: optText(80), isPep: z.boolean().optional(), pepDetails: optText(500),
  expectedLines: z.array(z.string().max(40)).max(20).optional(), expectedPaymentMode: optText(40), expectedAnnualPremium: z.number().min(0).nullable().optional(),
  houseNo: optText(120), street: optText(200), barangay: optText(120), city: optText(120), province: optText(120), region: optText(120), zipCode: optText(10), country: optText(80),
  leadCategory: optText(40),
};
const signatory = z.object({ fullName: z.string().trim().min(2).max(200), position: optText(120), nationality: optText(80), birthDate: day.optional().nullable().or(z.literal('')),
  idType: optText(80), idNumber: optText(60), authorityDocument: z.enum(['board-resolution', 'secretary-certificate', 'partnership-resolution', 'special-power-of-attorney', 'other']).optional(),
  authorityReference: optText(120), authorityDate: day.optional().nullable().or(z.literal('')), authorityValidUntil: day.optional().nullable().or(z.literal('')), signingLimit: z.number().min(0).nullable().optional() });
const owner = z.object({ fullName: z.string().trim().min(2).max(200), nationality: optText(80), birthDate: day.optional().nullable().or(z.literal('')),
  ownershipPercent: z.number().min(0).max(100).nullable().optional(), controlType: z.enum(['ownership', 'control', 'senior-management']).optional(), idType: optText(80), idNumber: optText(60),
  address: optText(500), isPep: z.boolean().optional(), pepDetails: optText(500) });
const requireIdentity = (b, ctx) => {
  const need = (cond, path, message) => { if (cond) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message }); };
  if (b.clientType === 'corporate') {
    need(!b.companyName, 'companyName', 'Registered name is required');
    need(!b.registrationAuthority, 'registrationAuthority', 'Registration with the SEC, DTI or CDA is required');
    need(!b.registrationNumber, 'registrationNumber', 'Registration number is required');
    need(!b.taxNumber, 'taxNumber', 'TIN is required for a juridical client');
  } else {
    need(!b.firstName, 'firstName', 'First name is required');
    need(!b.lastName, 'lastName', 'Last name is required');
    need(!b.DOB, 'DOB', 'Date of birth is required');
    need(!b.nationality, 'nationality', 'Nationality is required');
    need(!b.idType, 'idType', 'ID type is required');
    need(!b.idNumber, 'idNumber', 'ID number is required');
  }
  need(!b.city && !b.province, 'city', 'Address (city or municipality) is required');
};
const onboardBody = z.object({ ...kycFields, signatories: z.array(signatory).max(20).optional(), beneficialOwners: z.array(owner).max(50).optional() }).superRefine(requireIdentity);
const onboardExample = { clientType: 'individual', firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz', DOB: '1985-04-12', nationality: 'Filipino', contactNumber: '09171234567',
  taxNumber: '123-456-789-000', idType: 'PhilSys National ID (PhilID / ePhilID)', idNumber: '1234-5678-9012-3456', province: 'Metro Manila', city: 'Makati City', barangay: 'Poblacion',
  occupation: 'Engineer', sourceOfFunds: 'Salary', expectedLines: ['MOTOR'], expectedPaymentMode: 'bank-transfer', expectedAnnualPremium: 45000 };

define({
  method: 'POST', path: '/onboard', summary: 'Onboard a client before its first policy (individual or juridical with signatories and beneficial owners)',
  screen: `${SCREEN} > Onboard client`, middleware: [...canWrite, validate(onboardBody)], request: onboardExample,
  response: { success: true, data: { client: { ...example, kycStatus: 'complete' } } },
  handler: async (req, res) => {
    const client = svc.toClient(await svc.onboardClient(req.body, actor(req)));
    await audit(req, { entity: 'client', entityId: client.id, action: 'onboard', after: client });
    res.status(201).json({ success: true, message: 'Client onboarded', data: { client } });
  },
});
define({
  method: 'PUT', path: '/:id/kyc', summary: 'Update the identification of a client (onboarding screen); its KYC status follows',
  screen: `${SCREEN} > Onboard client`, middleware: [...canWrite, ownRecord('client'), validate(z.object(kycFields).partial().extend({ clientType: z.enum(['individual', 'corporate']).optional() }))],
  request: { occupation: 'Business owner', expectedAnnualPremium: 250000 }, response: { success: true, data: { client: example } },
  handler: async (req, res) => {
    const r = await svc.updateKyc(req.params.id, req.body, actor(req));
    const client = svc.toClient(r.after);
    await audit(req, { entity: 'client', entityId: client.id, action: 'update-kyc', before: svc.toClient(r.before), after: client });
    ok(res, { client }, 'Client identification saved');
  },
});
define({
  method: 'GET', path: '/:id/profile', summary: 'KYC profile of a client: identification still missing, signatories, beneficial owners with their warnings, documents',
  screen: `${SCREEN} > Onboard client`, middleware: [...canRead, ownRecord('client')],
  response: { success: true, data: { client: { kycStatus: 'complete' }, missing: [], signatories: [], beneficialOwners: [], ownerWarnings: [], beneficialOwnerThreshold: 25, documents: [] } },
  handler: async (req, res) => ok(res, await kyc.profile(req.params.id)),
});

const partyStatus = { signatory: z.enum(['active', 'revoked']), owner: z.enum(['active', 'removed']) };
for (const [kind, path, body, save, entity, status] of [
  ['signatory', 'signatories', signatory, kyc.saveSignatory, 'client_signatory', partyStatus.signatory],
  ['beneficial owner', 'beneficial-owners', owner, kyc.saveOwner, 'client_beneficial_owner', partyStatus.owner],
]) {
  const label = `${kind[0].toUpperCase()}${kind.slice(1)}`;
  define({
    method: 'POST', path: `/:id/${path}`, summary: `Add a ${kind} of a juridical client`, screen: `${SCREEN} > Onboard client (juridical)`,
    middleware: [...canWrite, ownRecord('client'), validate(body.extend({ status: status.optional() }))],
    request: kind === 'signatory' ? { fullName: 'Maria Reyes', position: 'Treasurer', authorityDocument: 'secretary-certificate', authorityDate: '2026-09-01' }
      : { fullName: 'Jose Tan', ownershipPercent: 40, controlType: 'ownership', nationality: 'Filipino' }, response: { success: true },
    handler: async (req, res) => {
      const r = await save(req.params.id, null, req.body, actor(req));
      await audit(req, { entity, entityId: r.after.id, action: 'create', after: r.after });
      await kyc.refreshKycStatus(r.clientId);
      created(res, r.after, `${label} added`);
    },
  });
  define({
    method: 'PUT', path: `/:id/${path}/:rowId`, summary: `Change or ${kind === 'signatory' ? 'revoke' : 'remove'} a ${kind}`, screen: `${SCREEN} > Onboard client (juridical)`,
    middleware: [...canWrite, ownRecord('client'), validate(body.extend({ status: status.optional() }).partial())],
    request: { status: kind === 'signatory' ? 'revoked' : 'removed' }, response: { success: true },
    handler: async (req, res) => {
      const r = await save(req.params.id, req.params.rowId, req.body, actor(req));
      await audit(req, { entity, entityId: req.params.rowId, action: 'update', before: r.before, after: r.after });
      await kyc.refreshKycStatus(r.clientId);
      ok(res, r.after, `${label} saved`);
    },
  });
}

define({
  method: 'POST', path: '/:id/documents', summary: 'Upload a KYC document (multipart: file, docType, relatedType client | signatory | beneficial-owner, relatedId, description, expiryDate)',
  screen: `${SCREEN} > Onboard client`, middleware: [...canWrite, ownRecord('client'), docUpload],
  request: { file: '<binary>', docType: 'board-resolution', relatedType: 'signatory', relatedId: 'sig_1' }, response: { success: true, data: { id: 1, docType: 'board-resolution', fileName: 'resolution.pdf' } },
  handler: async (req, res) => {
    const d = await kyc.addDocument(req.params.id, req.file, req.body || {}, req.user);
    await audit(req, { entity: 'client_kyc_document', entityId: d.id, action: 'upload', after: { ...d, url: undefined } });
    created(res, d, 'Document uploaded');
  },
});

customers.define({
  method: 'GET', path: '/codes', summary: 'Customer codes for dropdowns (read:clients, read:receipts or read:disbursements)', screen: 'Accounts > Disbursement / Receipts', middleware: canListCodes,
  response: { success: true, data: [{ clientId: 'cl_1', customerCode: 'CL-2026-00001', name: 'Juan Dela Cruz' }] },
  handler: async (req, res) => ok(res, await svc.customerCodes(await scopeOf(req))),
});

export default router;
export const mount = '/clients';
export const extraMounts = [['/customers', customers.router]];
