import express from 'express';
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { created, ok, paging } from '../../lib/respond.js';
import { notFound } from '../../lib/errors.js';
import { withScope } from '../../lib/scope.js';
import { sendPdf, buildPdf } from '../../lib/pdf/index.js';
import { getPolicyRow, toPolicy } from '../policies/service.js';
import { printablePolicy, policyScheduleDoc } from '../documents/templates.js';
import { packageSchedulePdf } from '../packages/issue.js';
import { METHODS } from './providers.js';
import * as svc from './service.js';
import { applyPayment, handleNotification, simulateSandbox } from './confirm.js';

/**
 * Online premium payments.
 *   /payment-gateways   Master > Packaged Products > Payment Gateways (settings: System Administrator, write:settings;
 *                       read and the payments log: Accounting and anyone who reads settings)
 *   /payment-links      Sales & Marketing > Payment Links: create for a package quotation, quotation or policy
 *                       (write:quotations, write:policies or write:receipts), list, cancel, apply a paid link
 *   /public/payments    the client's checkout page (by the link's random token), the sandbox simulation and the
 *                       gateways' webhooks / postbacks (signature verified per provider). No sign-in.
 */
const { router, define } = moduleRouter('Payment Gateways', '/payment-gateways');
const links = moduleRouter('Payment Links', '/payment-links');
const pub = moduleRouter('Public Payments', '/public/payments');
const GATEWAYS = 'Master > Packaged Products > Payment Gateways';
const LOG = `${GATEWAYS} > Payments log`;
const LINKS = 'Operations > Sales & Marketing > Payment Links';
const readGateways = [requireAuth, requirePermission('read:settings', 'read:receipts', 'write:quotations', 'write:policies')];
const writeGateways = [requireAuth, requirePermission('write:settings')];
const readLinks = [requireAuth, requirePermission('read:quotations', 'read:policies', 'read:receipts')];
const writeLinks = [requireAuth, requirePermission('write:quotations', 'write:policies', 'write:receipts')];
const applyLinks = [requireAuth, requirePermission('write:receipts', 'write:policies')];

const gatewayExample = { code: 'PAYMONGO', name: 'PayMongo (GCash, Maya, GrabPay, cards)', provider: 'paymongo', enabled: true, mode: 'sandbox', methods: ['gcash', 'maya', 'grabpay', 'card'],
  feeHandling: 'absorb', feePercent: 2.5, feeFixed: 0, credentialsPrefix: 'PAYMONGO', credentialsConfigured: true,
  credentials: [{ name: 'PAYMONGO_SECRET_KEY', present: true }, { name: 'PAYMONGO_WEBHOOK_SECRET', present: true }], linkValidityHours: null, autoIssue: true, bankAccountCode: null };
const linkExample = { id: 'pl_0123456789abcdef', linkNumber: 'PL-2026-00001', targetType: 'package_quote', targetId: 'pq_0123456789abcdef', targetNumber: 'PQ-2026-00001',
  payerName: 'Rosario Dizon', description: 'SME Shield package PQ-2026-00001', amount: 7367.2, fee: 0, total: 7367.2, currency: 'PHP', gatewayCode: 'SANDBOX', status: 'pending',
  checkoutUrl: 'http://localhost:3000/pay/Zx9...', payUrl: 'http://localhost:3000/pay/Zx9...', expiresAt: '2026-10-03T09:00:00Z', applyStatus: 'not_applied' };

// ------------------------------------------------------------------ gateways
define({
  method: 'GET', path: '/', summary: 'Payment gateways with their settings and whether their credentials are present in the environment (the values are never returned)',
  screen: GATEWAYS, middleware: readGateways, query: { enabled: 'true' }, response: { success: true, data: [gatewayExample] },
  handler: async (req, res) => ok(res, await svc.listGateways(req.query)),
});
define({
  method: 'GET', path: '/events', summary: 'Payments log: every gateway notification received or simulated (gatewayCode, linkId, status, valid=false; paging)', screen: LOG,
  middleware: [requireAuth, requirePermission('read:settings', 'read:receipts')], query: { gatewayCode: 'PAYMONGO', valid: 'false' },
  response: { success: true, data: [{ id: 1, linkNumber: 'PL-2026-00001', gatewayCode: 'SANDBOX', eventType: 'payment.paid', signatureValid: true, status: 'paid', amount: 7367.2 }], total: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    const { total, rows } = await svc.listEvents(req.query, pg);
    ok(res, rows, 'OK', { total, page: pg.page, perPage: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
define({
  method: 'PUT', path: '/:code', summary: 'Gateway settings: enabled, mode (sandbox / live; live needs the credentials in the environment), methods, fee handling, link validity, automatic issuance, settlement bank account',
  screen: GATEWAYS, middleware: [...writeGateways, validate(z.object({
    name: z.string().trim().min(1).max(120).optional(), enabled: z.boolean().optional(), mode: z.enum(['sandbox', 'live']).optional(), methods: z.array(z.enum(METHODS)).max(10).optional(),
    feeHandling: z.enum(['absorb', 'pass_on']).optional(), feePercent: z.coerce.number().min(0).max(99).optional(), feeFixed: z.coerce.number().min(0).max(1e6).optional(),
    credentialsPrefix: z.string().regex(/^[A-Z][A-Z0-9_]{1,40}$/, 'capital letters, digits and _').optional(), linkValidityHours: z.coerce.number().int().min(1).max(2160).nullable().optional(),
    autoIssue: z.boolean().optional(), bankAccountCode: z.string().trim().max(40).nullable().optional(), sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
    remarks: z.string().max(500).nullable().optional(),
  }).strict())],
  request: { enabled: true, feeHandling: 'pass_on', feePercent: 2.5 }, response: { success: true, data: gatewayExample },
  handler: async (req, res) => {
    const { before, after } = await svc.updateGateway(req.params.code, req.body, req.user);
    await audit(req, { entity: 'payment_gateway', entityId: after.code, action: 'update', before, after });
    ok(res, after, `${after.name} saved`);
  },
});

// ------------------------------------------------------------------ links
links.define({
  method: 'GET', path: '/', summary: 'Payment links (status (comma-separated), applyStatus, gatewayCode, targetType, targetId, search; paging)', screen: LINKS, middleware: readLinks,
  query: { status: 'pending,paid' }, response: { success: true, data: [linkExample], total: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query);
    const { total, rows } = await svc.listLinks(await withScope(req), pg);
    ok(res, rows, 'OK', { total, page: pg.page, perPage: pg.perPage, totalPages: Math.ceil(total / pg.perPage) });
  },
});
links.define({
  method: 'GET', path: '/:id', summary: 'One payment link with its gateway events', screen: LINKS, middleware: readLinks, response: { success: true, data: { ...linkExample, events: [] } },
  handler: async (req, res) => {
    const link = await svc.linkOut(await svc.linkRow(req.params.id));
    const { rows } = await svc.listEvents({ linkId: link.id }, { limit: 100, offset: 0 });
    ok(res, { ...link, events: rows });
  },
});
links.define({
  method: 'POST', path: '/', summary: 'Create a payment link for a package quotation, quotation or policy premium; the gateway checkout is opened and the client address (payUrl) returned',
  screen: LINKS, middleware: [...writeLinks, validate(z.object({
    targetType: z.enum(['package_quote', 'quote', 'policy']), targetId: z.string().trim().min(1).max(60), gatewayCode: z.string().trim().min(1).max(40),
    method: z.enum(METHODS).optional(), payerEmail: z.string().email().max(200).optional(), payerName: z.string().trim().max(200).optional(),
  }).strict())],
  request: { targetType: 'package_quote', targetId: 'PQ-2026-00001', gatewayCode: 'SANDBOX', method: 'gcash' }, response: { success: true, data: linkExample },
  handler: async (req, res) => {
    const link = await svc.createLink(req.body, req.user);
    await audit(req, { entity: 'payment_link', entityId: link.id, action: 'create', after: link });
    created(res, link, `Payment link ${link.linkNumber} created`);
  },
});
links.define({
  method: 'POST', path: '/:id/cancel', summary: 'Cancel a pending (or failed) payment link', screen: LINKS, middleware: writeLinks, response: { success: true, data: { ...linkExample, status: 'cancelled' } },
  handler: async (req, res) => {
    const { before, after } = await svc.cancelLink(req.params.id, req.user);
    await audit(req, { entity: 'payment_link', entityId: after.id, action: 'cancel', before, after });
    ok(res, after, `Payment link ${after.linkNumber} cancelled`);
  },
});
links.define({
  method: 'POST', path: '/:id/apply', summary: 'Apply a paid link that is awaiting its policy or failed to apply: issue the package policy when allowed, then the official receipt',
  screen: LINKS, middleware: applyLinks, response: { success: true, data: { ...linkExample, status: 'paid', applyStatus: 'applied', receiptNumber: 'OR-2026-00031', policyNumber: 'PKG-2026-00001' } },
  handler: async (req, res) => {
    const before = await svc.linkRow(req.params.id);
    const after = await svc.linkOut(await applyPayment(before.id, { user: req.user }));
    await audit(req, { entity: 'payment_link', entityId: after.id, action: 'apply', after });
    ok(res, after, after.applyStatus === 'applied' ? 'Payment applied' : (after.applyError || 'Payment not applied'));
  },
});

// ------------------------------------------------------------------ public (no sign-in)
/** What the client's checkout page shows (no internal ids, no commission). */
async function publicView(row) {
  const l = await svc.linkOut(row);
  const pdfReady = l.status === 'paid' && Boolean(l.policyId);
  return { linkNumber: l.linkNumber, description: l.description, payerName: l.payerName, amount: l.amount, fee: l.fee, total: l.total, currency: l.currency, status: l.status,
    gateway: { code: l.gatewayCode, name: l.gatewayName, provider: l.provider, mode: l.mode }, method: l.method, checkoutUrl: l.provider === 'sandbox' ? null : l.checkoutUrl,
    expiresAt: l.expiresAt, paidAt: l.paidAt, policyNumber: pdfReady ? l.policyNumber : null, receiptNumber: l.status === 'paid' ? l.receiptNumber : null, policyPdf: pdfReady };
}

// webhooks first: /webhooks/<gateway> must not be read as /<token>/<action>
const notification = async (req, res) => {
  const r = await handleNotification(req.params.gateway, { rawBody: req.rawBody, headers: req.headers, body: req.body, query: req.query });
  if (String(req.params.gateway).toUpperCase() === 'DRAGONPAY') return res.type('text/plain').send('result=OK');
  return ok(res, { status: r.status, linkNumber: r.link?.link_number || null });
};
pub.define({
  method: 'POST', path: '/webhooks/:gateway', auth: false, summary: 'Gateway webhook / postback: signature verified per provider (PayMongo Paymongo-Signature, Dragonpay digest, sandbox HMAC); a paid notification applies the payment; 401 when the signature is invalid',
  screen: 'Gateway to server', middleware: [express.urlencoded({ extended: false, limit: '100kb' })], request: { data: { attributes: { type: 'checkout_session.payment.paid' } } },
  response: { success: true, data: { status: 'paid', linkNumber: 'PL-2026-00001' } }, handler: notification,
});
pub.define({
  method: 'GET', path: '/webhooks/:gateway', auth: false, summary: 'Gateway postback sent as a GET (Dragonpay): same verification and processing', screen: 'Gateway to server',
  query: { txnid: 'PL-2026-00001', refno: 'ABC123', status: 'S', message: 'Paid', digest: '...' }, response: '(text/plain) result=OK', handler: notification,
});

pub.define({
  method: 'GET', path: '/:token', auth: false, summary: 'Client checkout page data: amount, gateway, status; once paid and issued, the policy number and PDF availability', screen: 'Public > Pay (/pay/:token)',
  response: { success: true, data: { linkNumber: 'PL-2026-00001', description: 'SME Shield package PQ-2026-00001', total: 7367.2, currency: 'PHP', status: 'pending', gateway: { name: 'Sandbox', provider: 'sandbox' } } },
  handler: async (req, res) => {
    await svc.expireLinks();
    ok(res, await publicView(await svc.linkByToken(req.params.token)));
  },
});
pub.define({
  method: 'POST', path: '/:token/sandbox', auth: false, summary: 'Sandbox gateway only: simulate the client paying (outcome paid) or the payment failing (failed); processed as a signed notification',
  screen: 'Public > Pay (/pay/:token) > Sandbox', middleware: [validate(z.object({ outcome: z.enum(['paid', 'failed']) }).strict())], request: { outcome: 'paid' },
  response: { success: true, data: { status: 'paid' } },
  handler: async (req, res) => {
    const r = await simulateSandbox(req.params.token, req.body.outcome);
    ok(res, await publicView(await svc.linkByToken(req.params.token)), r.status === 'paid' ? 'Payment received' : 'Payment failed');
  },
});
pub.define({
  method: 'GET', path: '/:token/policy.pdf', auth: false, summary: 'The digital policy of a paid link once issued (package schedule, or the policy schedule)', screen: 'Public > Pay (/pay/:token) > Policy',
  response: '(application/pdf)',
  handler: async (req, res) => {
    const row = await svc.linkByToken(req.params.token);
    if (row.status !== 'paid' || !row.policy_id) throw notFound('The policy is not available yet');
    const policy = await getPolicyRow(row.policy_id);
    if (policy.details?.package) return sendPdf(res, await packageSchedulePdf(policy.id, {}, { user: null }), `${policy.policy_number}.pdf`, 'attachment');
    const p = await printablePolicy(toPolicy(policy), policy);
    return sendPdf(res, buildPdf(await policyScheduleDoc(p)), `${policy.policy_number}.pdf`, 'attachment');
  },
});
export default router;
export const mount = '/payment-gateways';
export const extraMounts = [['/payment-links', links.router], ['/public/payments', pub.router]];
