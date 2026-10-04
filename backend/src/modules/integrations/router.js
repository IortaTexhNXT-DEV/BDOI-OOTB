import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { audit } from '../../lib/audit.js';
import { created, ok, paging } from '../../lib/respond.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { config } from '../../config.js';
import './index.js';
import { adapterOf, listAdapters, listMessageTypes, messageTypeOf } from './framework/registry.js';
import { connectorRow, credentialsOf, listConnectors, liveBlockers, updateConnector } from './framework/connectors.js';
import * as outbox from './framework/outbox.js';
import { fakeAdapter } from './adapters/fake.js';
import * as msg from './messaging.js';
import ctplRoutes from './ctplRoutes.js';
import insurerRoutes from './insurerRoutes.js';
import bankRoutes from './bankRoutes.js';

/**
 * Integration framework routes.
 *   /integrations          Master > System Configuration > Integrations: connectors (settings, connection test), the
 *                          outbox (resend, cancel, send due now) and the inbox (reprocess); read:integrations /
 *                          write:integrations (System Administrator)
 *   /messaging             Master > System Configuration > Message Templates: templates, test message; messages sent
 *                          to a client and the ad hoc send from the client, policy and claim screens
 *   /public/integrations   messages pushed by third parties (signed with the connector's webhook secret), no sign-in
 *   /ctpl, /insurer-integration, /bank-payments: ctplRoutes.js, insurerRoutes.js, bankRoutes.js
 */
const { router, define } = moduleRouter('Integrations', '/integrations');
const messaging = moduleRouter('Messaging', '/messaging');
const pub = moduleRouter('Public Integrations', '/public/integrations');
const SCREEN = 'Master > System Configuration > Integrations';
const TEMPLATES = 'Master > System Configuration > Message Templates';
const read = [requireAuth, requirePermission('read:integrations')];
const write = [requireAuth, requirePermission('write:integrations')];

const connectorExample = { code: 'SMS_SEMAPHORE', name: 'SMS gateway (Semaphore-style)', kind: 'sms', adapter: 'http_sms', enabled: true, mode: 'test', endpoint: 'https://api.semaphore.co/api/v4/messages',
  credentialEnv: { apiKey: 'SEMAPHORE_API_KEY' }, credentials: [{ key: 'apiKey', envName: 'SEMAPHORE_API_KEY', present: false, required: true }], credentialsConfigured: false,
  liveBlockers: ['environment variable SEMAPHORE_API_KEY (apiKey) is not set'], options: { preset: 'semaphore', senderName: 'BROKER' }, maxAttempts: 5, retryBaseSeconds: 60, queued: 0, failed: 0 };
const messageExample = { id: 41, connectorCode: 'SMS_SEMAPHORE', messageType: 'sms.send', entity: 'policy', entityId: 'pol_0123456789abcdef', reference: '+639171234567', status: 'retry',
  mode: 'test', attempts: 2, maxAttempts: 5, nextAttemptAt: '2026-10-04T02:04:00Z', lastError: 'HTTP 503: Service unavailable', externalRef: null };
const paged = (res, { total, rows, counts }, pg) => ok(res, rows, 'OK', { total, page: pg.page, perPage: pg.perPage, totalPages: Math.ceil(total / pg.perPage), ...(counts ? { counts } : {}) });

// ------------------------------------------------------------------ connectors
define({
  method: 'GET', path: '/connectors', summary: 'Connectors with their mode, endpoint, credential environment variable names (whether each is set; never the values), what blocks live use and the messages waiting or failed',
  screen: SCREEN, middleware: read, query: { kind: 'sms' }, response: { success: true, data: [connectorExample] },
  handler: async (req, res) => ok(res, await listConnectors({ kind: req.query.kind })),
});
define({
  method: 'GET', path: '/registry', summary: 'Installed provider adapters and message types (for the connector editor and the monitor filters)', screen: SCREEN, middleware: read,
  response: { success: true, data: { adapters: [{ code: 'http_sms', label: 'HTTP SMS API', kinds: ['sms'] }], messageTypes: [{ type: 'sms.send', kind: 'sms', label: 'SMS to a client', inbound: false }] } },
  handler: async (_req, res) => ok(res, { adapters: listAdapters(), messageTypes: listMessageTypes() }),
});
const envMap = z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,40}$/), z.string().trim().max(64).regex(/^([A-Z][A-Z0-9_]{1,63})?$/, 'capital letters, digits and _: the NAME of an environment variable'));
define({
  method: 'PUT', path: '/connectors/:code', summary: 'Connector settings: enabled, mode (test / live: live needs the endpoint and every credential variable set), endpoint, credential variable names, adapter options, timeout and retry policy',
  screen: SCREEN, middleware: [...write, validate(z.object({
    name: z.string().trim().min(1).max(120).optional(), enabled: z.boolean().optional(), mode: z.enum(['test', 'live']).optional(), adapter: z.string().trim().max(40).optional(),
    endpoint: z.string().trim().max(500).regex(/^(https?:\/\/\S+)?$/, 'an http(s) address').nullable().optional(), credentialEnv: envMap.optional(),
    options: z.record(z.any()).optional(), timeoutMs: z.coerce.number().int().min(1000).max(120000).optional(), maxAttempts: z.coerce.number().int().min(1).max(20).optional(),
    retryBaseSeconds: z.coerce.number().int().min(1).max(86400).optional(), retryMaxSeconds: z.coerce.number().int().min(1).max(604800).optional(),
    description: z.string().max(1000).nullable().optional(), sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
  }).strict())],
  request: { enabled: true, mode: 'test', credentialEnv: { apiKey: 'SEMAPHORE_API_KEY' }, options: { preset: 'semaphore', senderName: 'BROKER' } }, response: { success: true, data: connectorExample },
  handler: async (req, res) => {
    const { before, after } = await updateConnector(req.params.code, req.body, req.user);
    await audit(req, { entity: 'integration_connector', entityId: after.code, action: 'update', before, after });
    ok(res, after, `${after.name} saved`);
  },
});
define({
  method: 'POST', path: '/connectors/:code/test', summary: 'Connection test: test mode answers from the fake provider; live mode calls the provider\'s health-check path when one is configured. Sends no business message',
  screen: `${SCREEN} > Test connection`, middleware: write, response: { success: true, data: { ok: true, mode: 'test', detail: 'Test mode: messages go to the fake provider; nothing leaves the system' } },
  handler: async (req, res) => {
    const c = await connectorRow(req.params.code);
    let out;
    if (c.mode === 'test') out = await fakeAdapter.test();
    else {
      const blockers = liveBlockers(c);
      if (blockers.length) out = { ok: false, detail: blockers.join('; ') };
      else {
        try {
          const a = adapterOf(c.adapter);
          out = a.test ? await a.test(c, { credentials: credentialsOf(c).values, timeoutMs: c.timeout_ms }) : { ok: true, detail: 'This adapter has no connection test' };
        } catch (e) {
          out = { ok: false, detail: e.message };
        }
      }
    }
    await audit(req, { entity: 'integration_connector', entityId: c.code, action: 'test', after: { mode: c.mode, ...out } });
    ok(res, { ...out, mode: c.mode }, out.ok ? 'Connection test passed' : 'Connection test failed');
  },
});

// ------------------------------------------------------------------ outbox and inbox
define({
  method: 'GET', path: '/outbox', summary: 'Integration outbox (connectorCode, status (comma-separated), messageType, kind, entity, entityId, from, to, search; paging) with the count per status',
  screen: `${SCREEN} > Outbox`, middleware: read, query: { status: 'failed,retry', connectorCode: 'SMS_SEMAPHORE', page: 1, pageSize: 20 },
  response: { success: true, data: [messageExample], counts: { queued: 0, retry: 1, sent: 120, failed: 2 }, total: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    paged(res, await outbox.listMessages(req.query, pg), pg);
  },
});
define({
  method: 'GET', path: '/outbox/:id', summary: 'One integration message with its payload, the provider\'s answer and every attempt', screen: `${SCREEN} > Outbox > Detail`, middleware: read,
  response: { success: true, data: { ...messageExample, payload: { to: '+639171234567', text: 'Your policy ...' }, attemptLog: [{ attempt: 1, ok: false, httpStatus: 503, durationMs: 412, error: 'HTTP 503' }] } },
  handler: async (req, res) => ok(res, await outbox.getMessage(req.params.id)),
});
define({
  method: 'POST', path: '/outbox/:id/resend', summary: 'Queue a failed, cancelled or skipped message again with a fresh attempt count and send it at once (a waiting one is sent now)',
  screen: `${SCREEN} > Outbox > Resend`, middleware: write, response: { success: true, message: 'Sent', data: { ...messageExample, status: 'sent', attempts: 1 } },
  handler: async (req, res) => {
    const { before, after } = await outbox.resend(req.params.id, req.user);
    await audit(req, { entity: 'integration_message', entityId: after.id, action: 'resend', before: { status: before.status, attempts: before.attempts, lastError: before.lastError }, after: { status: after.status, attempts: after.attempts } });
    ok(res, after, after.status === 'sent' ? 'Sent' : after.status === 'retry' ? `Attempt failed, retry scheduled: ${after.lastError}` : `Not sent: ${after.lastError || after.status}`);
  },
});
define({
  method: 'POST', path: '/outbox/:id/cancel', summary: 'Cancel a message that has not been sent', screen: `${SCREEN} > Outbox > Cancel`,
  middleware: [...write, validate(z.object({ reason: z.string().trim().max(500).optional() }).strict())], request: { reason: 'Sent by e-mail instead' },
  response: { success: true, data: { ...messageExample, status: 'cancelled' } },
  handler: async (req, res) => {
    const { before, after } = await outbox.cancel(req.params.id, req.user, req.body?.reason);
    await audit(req, { entity: 'integration_message', entityId: after.id, action: 'cancel', before: { status: before.status }, after: { status: after.status, reason: req.body?.reason || null } });
    ok(res, after, 'Message cancelled');
  },
});
define({
  method: 'POST', path: '/outbox/process', summary: 'Send the messages that are due now (what the integration-outbox job does every 2 minutes)', screen: `${SCREEN} > Send due messages`,
  middleware: write, response: { success: true, data: { sent: 3, retry: 1, failed: 0, held: 0 } },
  handler: async (req, res) => {
    const out = await outbox.processOutbox({ connectorCode: req.body?.connectorCode || null });
    await audit(req, { entity: 'integration_outbox', entityId: null, action: 'process', after: { sent: out.sent, retry: out.retry, failed: out.failed, held: out.held } });
    ok(res, out, `${out.sent} sent, ${out.retry} to retry, ${out.failed} failed`);
  },
});
define({
  method: 'GET', path: '/inbox', summary: 'Integration inbox: messages pushed by third parties and files imported (connectorCode, status, messageType, source, search; paging)',
  screen: `${SCREEN} > Inbox`, middleware: read, query: { status: 'failed' },
  response: { success: true, data: [{ id: 7, connectorCode: 'BANK_FILES', messageType: 'bank.status_file', source: 'file', status: 'processed', result: { applied: 12, paid: 11, rejected: 1 } }], total: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    paged(res, await outbox.listInbox(req.query, pg), pg);
  },
});
define({
  method: 'POST', path: '/inbox/:id/reprocess', summary: 'Process a failed inbound message again (after the cause was fixed)', screen: `${SCREEN} > Inbox > Reprocess`, middleware: write,
  response: { success: true, data: { id: 7, status: 'processed' } },
  handler: async (req, res) => {
    const { before, after } = await outbox.reprocess(req.params.id);
    await audit(req, { entity: 'integration_inbox', entityId: after.id, action: 'reprocess', before: { status: before.status, lastError: before.lastError }, after: { status: after.status, lastError: after.lastError } });
    ok(res, after, after.status === 'processed' ? 'Processed' : `Not processed: ${after.lastError}`);
  },
});

// ------------------------------------------------------------------ inbound (public)
pub.define({
  method: 'POST', path: '/inbound/:connector', auth: false,
  summary: 'Message pushed by a third party (claim status from an insurer, CTPL authentication result): JSON with "type" (message type), signed in header x-signature = HMAC-SHA256 of the raw body with the connector\'s webhookSecret credential',
  screen: 'Third party to server', request: { type: 'insurer.claim_status', claimNumber: 'CLM-2026-00031', status: 'APPROVED', remarks: 'Approved for payment' },
  response: { success: true, data: { id: 9, status: 'processed' } },
  handler: async (req, res) => {
    if (!(await getSetting('integrations.inbound_enabled', true))) throw notFound('Inbound integration messages are switched off');
    const c = await connectorRow(req.params.connector);
    if (!c.enabled) throw notFound('Connector not found');
    const type = messageTypeOf(req.body?.type);
    if (!type?.onInbound || type.kind !== c.kind) throw badRequest(`Unknown inbound message type ${req.body?.type || ''}`);
    const text = req.rawBody ? Buffer.from(req.rawBody).toString('utf8') : JSON.stringify(req.body || {});
    const key = outbox.inboundKey(c, config);
    const valid = outbox.verifyInbound(key, text, req.get('x-signature'));
    const r = await outbox.receive({ connectorCode: c.code, messageType: type.type, source: 'webhook', externalRef: req.body.reference || req.body.claimNumber || req.body.cocNumber || null, payload: req.body, signatureValid: valid });
    if (!valid) return res.status(401).json({ success: false, message: 'Invalid signature', data: { id: r.id } });
    return ok(res, { id: r.id, status: r.status, error: r.lastError || null }, r.status === 'processed' ? 'Processed' : 'Received');
  },
});

// ------------------------------------------------------------------ message templates and messages
const readTemplates = [requireAuth, requirePermission('read:integrations', 'write:clients', 'write:policies', 'write:claims')];
const sendPerm = [requireAuth, requirePermission('write:clients', 'write:policies', 'write:claims', 'write:integrations')];
const templateExample = { code: 'RENEWAL_NOTICE', name: 'Renewal notice', channel: 'sms', event: 'renewal_notice', consentPurpose: 'processing', connectorCode: null, active: true,
  body: 'Hi {{clientName}}, your policy {{policyNumber}} with {{insurer}} expires on {{expiryDate}}. Reply or call us to renew. {{companyName}}' };
const templateBody = z.object({
  name: z.string().trim().min(1).max(120), channel: z.enum(msg.CHANNELS).optional(), event: z.enum(msg.EVENTS).optional(), body: z.string().trim().min(1).max(1000),
  consentPurpose: z.enum(msg.CONSENT_PURPOSES).optional(), connectorCode: z.string().trim().max(40).nullable().optional(), active: z.boolean().optional(), description: z.string().max(500).nullable().optional(),
});
messaging.define({
  method: 'GET', path: '/templates', summary: 'Message templates (event, active) with the placeholders a template may use', screen: TEMPLATES, middleware: readTemplates, query: { event: 'renewal_notice' },
  response: { success: true, data: [templateExample], placeholders: msg.PLACEHOLDERS },
  handler: async (req, res) => ok(res, await msg.listTemplates({ event: req.query.event, active: req.query.active === undefined ? undefined : req.query.active === 'true' }), 'OK', { placeholders: msg.PLACEHOLDERS }),
});
messaging.define({
  method: 'POST', path: '/templates', summary: 'New message template', screen: `${TEMPLATES} > New template`,
  middleware: [...write, validate(templateBody.extend({ code: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,39}$/, 'capital letters, digits and _') }).strict())],
  request: templateExample, response: { success: true, data: templateExample },
  handler: async (req, res) => {
    const t = await msg.createTemplate(req.body, req.user);
    await audit(req, { entity: 'message_template', entityId: t.code, action: 'create', after: t });
    created(res, t, `Template ${t.code} created`);
  },
});
messaging.define({
  method: 'PUT', path: '/templates/:code', summary: 'Change a message template', screen: `${TEMPLATES} > Edit`, middleware: [...write, validate(templateBody.partial().strict())],
  request: { body: 'Hi {{clientName}}, policy {{policyNumber}} expires on {{expiryDate}}.', active: true }, response: { success: true, data: templateExample },
  handler: async (req, res) => {
    const { before, after } = await msg.updateTemplate(req.params.code, req.body, req.user);
    await audit(req, { entity: 'message_template', entityId: after.code, action: 'update', before, after });
    ok(res, after, `Template ${after.code} saved`);
  },
});
messaging.define({
  method: 'POST', path: '/templates/preview', summary: 'Text of a template body with the example values of the placeholders (characters and SMS parts)', screen: `${TEMPLATES} > Edit`,
  middleware: [...readTemplates, validate(z.object({ body: z.string().max(1000) }).strict())], request: { body: 'Hi {{clientName}}' },
  response: { success: true, data: { text: 'Hi Maria Santos', length: 15, parts: 1 } },
  handler: async (req, res) => {
    const text = await msg.renderMessage(req.body.body, msg.PLACEHOLDERS);
    ok(res, { text, length: text.length, parts: Math.max(1, Math.ceil(text.length / 160)) });
  },
});
messaging.define({
  method: 'POST', path: '/templates/:code/test', summary: 'Send a template with the example values to a mobile number (no consent check), through the template\'s connector',
  screen: `${TEMPLATES} > Send test`, middleware: [...write, validate(z.object({ to: z.string().trim().min(7).max(20) }).strict())], request: { to: '09171234567' },
  response: { success: true, data: { ...messageExample, status: 'sent' } },
  handler: async (req, res) => {
    const t = await msg.templateRow(req.params.code);
    const m = await msg.queueClientMessage(null, { template: t, to: req.body.to, vars: msg.PLACEHOLDERS, skipConsent: true, allowInactive: true, entity: 'message_template', entityId: t.code }, req.user);
    const after = m.status === 'queued' ? await outbox.sendNow(m.id) : m;
    await audit(req, { entity: 'message_template', entityId: t.code, action: 'test-send', after: { to: req.body.to, messageId: after.id, status: after.status } });
    ok(res, after, after.status === 'sent' ? `Test message sent (${after.mode} mode)` : `Not sent: ${after.lastError || after.status}`);
  },
});
messaging.define({
  method: 'POST', path: '/send', summary: 'Send a message to a client from a template (or a free text) about a policy or claim: consent check, mobile number from the client record unless given',
  screen: 'Operations > Clients / Policy / Claims > Send SMS', middleware: [...sendPerm, validate(z.object({
    clientId: z.string().trim().min(1), templateCode: z.string().trim().max(40).optional(), text: z.string().trim().max(1000).optional(), to: z.string().trim().max(20).optional(),
    policyId: z.string().trim().max(60).optional(), claimId: z.string().trim().max(60).optional(), channel: z.enum(msg.CHANNELS).optional(),
  }).strict().refine((b) => b.templateCode || b.text, 'Choose a template or type the text'))],
  request: { clientId: 'cl_0123456789abcdef', templateCode: 'RENEWAL_NOTICE', policyId: 'PC-MLY-2026-000101' }, response: { success: true, data: { ...messageExample, status: 'sent' } },
  handler: async (req, res) => {
    const vars = await msg.contextVars(req.body);
    const m = await msg.queueClientMessage(null, { templateCode: req.body.templateCode, text: req.body.templateCode ? undefined : req.body.text, channel: req.body.channel, clientId: req.body.clientId,
      to: req.body.to, vars, entity: req.body.claimId ? 'claim' : req.body.policyId ? 'policy' : 'client', entityId: req.body.claimId || req.body.policyId || null }, req.user);
    const after = m.status === 'queued' ? await outbox.sendNow(m.id) : m;
    await audit(req, { entity: 'client', entityId: req.body.clientId, action: 'send-message', after: { messageId: after.id, templateCode: req.body.templateCode || null, status: after.status, to: after.reference } });
    ok(res, after, after.status === 'sent' ? 'Message sent' : after.status === 'skipped' ? `Not sent: ${after.lastError}` : after.status === 'retry' ? 'The provider did not answer; the message will be retried' : `Status: ${after.status}`);
  },
});
messaging.define({
  method: 'GET', path: '/messages', summary: 'SMS and Viber messages (clientId, status, search; paging)', screen: `${TEMPLATES} > Messages sent`,
  middleware: [requireAuth, requirePermission('read:integrations', 'read:clients')], query: { clientId: 'cl_0123456789abcdef', status: 'skipped' },
  response: { success: true, data: [{ ...messageExample, status: 'sent' }], total: 1 },
  handler: async (req, res) => {
    const pg = paging(req.query, { page: 1, perPage: 20 });
    paged(res, await outbox.listMessages({ ...req.query, messageType: 'sms.send,viber.send' }, pg), pg);
  },
});

export default router;
export const mount = '/integrations';
export const extraMounts = [['/messaging', messaging.router], ['/public/integrations', pub.router], ...ctplRoutes, ...insurerRoutes, ...bankRoutes];
