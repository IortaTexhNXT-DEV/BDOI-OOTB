/**
 * Live adapters over HTTP, all configured from the connector (endpoint, options, credentials by environment variable):
 *
 *   http_sms        generic HTTP SMS API: method, path, JSON or form body template, headers, number format and the path of
 *                   the message id in the answer. Presets (options.preset): semaphore (Semaphore-style form POST with an
 *                   API key) and globe_labs (Globe Labs-style outbound request with an access token and short code).
 *   viber_business  Viber business messages through an aggregator's JSON API (same options as http_sms)
 *   ctpl_http       IC-accredited CTPL authentication provider: request with the COC and vehicle data, answer with the
 *                   authentication code (options.authCodePath) and the provider's reference
 *   lto_http        LTO feed of authenticated COCs
 *   insurer_rest    insurer API: policy issuance request, policy / premium data, claim status; one path per operation
 *                   (options.paths), the answer read through the insurer's response map
 *   file_drop       bank payment files: the file is made available for upload on the bank's portal (no network call)
 *
 * Templates: every string of options.body, options.headers and the paths may hold {{placeholders}} read from the
 * message payload, the connector options (senderName, shortCode ...) and {{credentials.<key>}}.
 */
import { IntegrationError, registerAdapter } from '../framework/registry.js';
import { fillTemplate, getPath, httpRequest, mapObject } from '../framework/http.js';

export const SMS_PRESETS = {
  semaphore: {
    method: 'POST', path: '', bodyFormat: 'form', numberFormat: 'local',
    body: { apikey: '{{credentials.apiKey}}', number: '{{to}}', message: '{{text}}', sendername: '{{senderName}}' },
    idPath: '0.message_id', statusPath: '0.status',
  },
  globe_labs: {
    method: 'POST', path: '/smsmessaging/v1/outbound/{{shortCode}}/requests?access_token={{credentials.accessToken}}', bodyFormat: 'json', numberFormat: 'e164',
    body: { outboundSMSMessageRequest: { senderAddress: '{{shortCode}}', clientCorrelator: '{{messageId}}', address: 'tel:{{to}}', outboundSMSTextMessage: { message: '{{text}}' } } },
    idPath: 'outboundSMSMessageRequest.resourceURL',
  },
  generic: {
    method: 'POST', path: '/messages', bodyFormat: 'json', numberFormat: 'e164', headers: { Authorization: 'Bearer {{credentials.apiKey}}' },
    body: { to: '{{to}}', message: '{{text}}', sender: '{{senderName}}', reference: '{{messageId}}' }, idPath: 'id',
  },
};

/** Mobile number in the provider's format: e164 (+639...), intl (639...) or local (09...). */
export function formatNumber(raw, format = 'e164', countryCode = '63') {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `${countryCode}${d.slice(1)}`;
  else if (!d.startsWith(countryCode) && d.length === 10) d = `${countryCode}${d}`;
  if (format === 'local') return d.startsWith(countryCode) ? `0${d.slice(countryCode.length)}` : d;
  if (format === 'intl') return d;
  return `+${d}`;
}

/** Recursively fill the {{placeholders}} of a body / headers template. */
export function renderBody(tpl, vars) {
  if (typeof tpl === 'string') return fillTemplate(tpl, vars);
  if (Array.isArray(tpl)) return tpl.map((x) => renderBody(x, vars));
  if (tpl && typeof tpl === 'object') return Object.fromEntries(Object.entries(tpl).map(([k, v]) => [k, renderBody(v, vars)]));
  return tpl;
}

const join = (base, path) => {
  if (!path) return base;
  if (/^https?:\/\//i.test(path)) return path;
  return `${String(base || '').replace(/\/+$/, '')}/${String(path).replace(/^\/+/, '')}`;
};

const varsOf = (message, connector, ctx, extra = {}) => ({ ...(connector.options || {}), ...(message.payload || {}), ...extra, messageId: message.id, reference: message.reference, credentials: ctx.credentials || {} });

async function call(connector, ctx, op, vars) {
  const url = fillTemplate(join(connector.endpoint, op.path || ''), vars, { url: true });
  return httpRequest({ url, method: op.method || 'POST', headers: renderBody(op.headers || {}, vars), body: op.method === 'GET' ? undefined : renderBody(op.body ?? vars.body ?? {}, vars),
    bodyFormat: op.bodyFormat || 'json', timeoutMs: ctx.timeoutMs, fetchImpl: ctx.fetchImpl });
}

async function healthCheck(connector, ctx) {
  const o = connector.options || {};
  if (!o.healthPath) return { ok: true, detail: 'Configuration complete. No health-check path is configured, so no call was made.' };
  const r = await call(connector, ctx, { method: 'GET', path: o.healthPath, headers: o.headers }, varsOf({ payload: {} }, connector, ctx));
  return { ok: true, detail: `The provider answered HTTP ${r.status}` };
}

// ------------------------------------------------------------------ SMS and Viber

const smsOptions = (connector) => {
  const o = connector.options || {};
  return { ...(SMS_PRESETS[o.preset] || SMS_PRESETS.generic), ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')) };
};

async function sendText(message, connector, ctx) {
  const o = smsOptions(connector);
  const to = formatNumber(message.payload.to, o.numberFormat, o.countryCode || '63');
  const vars = varsOf(message, connector, ctx, { to, text: message.payload.text });
  const r = await call(connector, ctx, o, vars);
  const body = r.json ?? r.text;
  const externalRef = getPath(r.json, o.idPath);
  if (o.failurePath && getPath(r.json, o.failurePath)) throw new IntegrationError(`Provider refused the message: ${JSON.stringify(getPath(r.json, o.failurePath)).slice(0, 300)}`, { retryable: false, response: body });
  return { externalRef: externalRef ? String(externalRef) : null, httpStatus: r.status, response: body };
}

registerAdapter({ code: 'http_sms', label: 'HTTP SMS API (Semaphore-style, Globe Labs-style or generic)', kinds: ['sms'], credentialKeys: [], send: sendText, test: healthCheck });
registerAdapter({ code: 'viber_business', label: 'Viber business messages (aggregator JSON API)', kinds: ['messaging'], credentialKeys: ['apiKey'], send: sendText, test: healthCheck });

// ------------------------------------------------------------------ CTPL authentication and LTO feed

const CTPL_DEFAULT = {
  method: 'POST', path: '/authenticate', bodyFormat: 'json', headers: { Authorization: 'Bearer {{credentials.apiKey}}' },
  body: { cocNumber: '{{cocNumber}}', insurerCode: '{{insurerCode}}', policyNumber: '{{policyNumber}}', plateNumber: '{{plateNumber}}', mvFileNumber: '{{mvFileNumber}}',
    chassisNumber: '{{chassisNumber}}', engineNumber: '{{engineNumber}}', vehicleType: '{{vehicleType}}', periodFrom: '{{periodFrom}}', periodTo: '{{periodTo}}',
    assuredName: '{{insuredName}}', premium: '{{premium}}' },
  authCodePath: 'authenticationCode', referencePath: 'transactionId',
};
registerAdapter({
  code: 'ctpl_http', label: 'CTPL authentication provider (HTTP JSON)', kinds: ['ctpl_auth'], credentialKeys: ['apiKey'], test: healthCheck,
  send: async (message, connector, ctx) => {
    const o = { ...CTPL_DEFAULT, ...(connector.options || {}) };
    const r = await call(connector, ctx, o, varsOf(message, connector, ctx));
    const authCode = getPath(r.json, o.authCodePath);
    if (!authCode) throw new IntegrationError(`The provider answered without an authentication code (${o.authCodePath}): ${JSON.stringify(r.json ?? r.text).slice(0, 300)}`, { retryable: false, response: r.json ?? r.text });
    const providerReference = getPath(r.json, o.referencePath);
    return { externalRef: providerReference ? String(providerReference) : String(authCode), httpStatus: r.status, response: r.json, data: { authCode: String(authCode), providerReference: providerReference ? String(providerReference) : null } };
  },
});
registerAdapter({
  code: 'lto_http', label: 'LTO feed (HTTP JSON)', kinds: ['lto_feed'], credentialKeys: ['apiKey'], test: healthCheck,
  send: async (message, connector, ctx) => {
    const o = { ...CTPL_DEFAULT, path: '/coc', referencePath: 'reference', ...(connector.options || {}) };
    const r = await call(connector, ctx, o, varsOf(message, connector, ctx));
    const reference = getPath(r.json, o.referencePath);
    return { externalRef: reference ? String(reference) : null, httpStatus: r.status, response: r.json, data: { reference: reference ? String(reference) : null } };
  },
});

// ------------------------------------------------------------------ insurer APIs

const INSURER_PATHS = {
  'insurer.policy_issue': { method: 'POST', path: '/policies' },
  'insurer.policy_data': { method: 'GET', path: '/policies/{{insurerPolicyNumber}}' },
  'insurer.claim_status': { method: 'GET', path: '/claims/{{insurerClaimNumber}}' },
};
const OPERATION = { 'insurer.policy_issue': 'policyIssue', 'insurer.policy_data': 'policyData', 'insurer.claim_status': 'claimStatus' };
const DEFAULT_RESPONSE_MAP = { policyNumber: 'policyNumber', status: 'status', premium: 'premium', remarks: 'remarks' };

registerAdapter({
  code: 'insurer_rest', label: 'Insurer REST API (mapping per insurer)', kinds: ['insurer_api'], credentialKeys: ['apiKey'], test: healthCheck,
  send: async (message, connector, ctx) => {
    const o = connector.options || {};
    const op = { headers: { Authorization: 'Bearer {{credentials.apiKey}}' }, ...(o.headers ? { headers: o.headers } : {}), ...INSURER_PATHS[message.type], ...((o.paths || {})[OPERATION[message.type]] || {}) };
    if (!op.path) throw new IntegrationError(`No path is configured for ${message.type}`, { retryable: false });
    const vars = varsOf(message, connector, ctx);
    const r = await call(connector, ctx, { ...op, body: message.payload.request || {} }, vars);
    const data = mapObject({ ...DEFAULT_RESPONSE_MAP, ...(message.payload.responseMap || {}) }, r.json || {});
    return { externalRef: data.policyNumber ? String(data.policyNumber) : null, httpStatus: r.status, response: r.json ?? r.text, data };
  },
});

// ------------------------------------------------------------------ bank files

registerAdapter({
  code: 'file_drop', label: 'Bank payment file for upload on the bank portal', kinds: ['bank_file'], credentialKeys: [], needsEndpoint: false,
  send: async (message) => ({ externalRef: message.payload.fileName || null, httpStatus: null, response: { available: true, fileName: message.payload.fileName, lines: message.payload.lines } }),
  test: async () => ({ ok: true, detail: 'Files are downloaded from Accounts > Bank Payment Files and uploaded on the bank portal' }),
});
