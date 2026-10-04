/**
 * Who sees full personal identifiers: the response serialiser and request guard of lib/pii.js, applied to every API
 * response (app.js) and to every export built during a request (xlsx.js, csv.js, report PDFs).
 *
 *   privacy.masking_enabled       false: nobody gets masked values (encrypted values are still decrypted)
 *   privacy.pii_reveal_mode       'always': holders of view:pii get full values;
 *                                 'on-request': holders get masked values unless the request carries the header
 *                                 X-Unmask-PII: 1 (the "Show full identifiers" switch of the top bar); each such request
 *                                 is recorded in the audit trail (entity personal_data, action unmask)
 *   privacy.masking_exempt_paths  API path prefixes answered unmasked (the user's own profile, sign-in, configuration,
 *                                 the go-live workbench, the personal data export to a data subject)
 * Only list and view endpoints (GET) and the exports they produce are masked: the answer to a create or update echoes
 * what the user sent. A request without a signed-in user (public pages such as a customer's quotation response) is not
 * masked: those endpoints expose only what the customer needs.
 */
import { getSetting } from './settings.js';
import { hasPermission } from './auth.js';
import { currentRequest } from './requestContext.js';
import { audit } from './audit.js';
import { holdsCipher, protectPayload, protectRows, stripMasked } from './pii.js';
import { logger } from './logger.js';

export const VIEW_PII = 'view:pii';
export const UNMASK_HEADER = 'x-unmask-pii';
export const DEFAULT_EXEMPT_PATHS = ['/api/auth', '/api/s3', '/api/settings', '/api/system-settings', '/api/data-load', '/api/privacy/parties', '/api/health'];

async function loadPolicySettings() {
  const enabled = (await getSetting('privacy.masking_enabled', true)) !== false;
  const mode = (await getSetting('privacy.pii_reveal_mode', 'always')) === 'on-request' ? 'on-request' : 'always';
  const exempt = await getSetting('privacy.masking_exempt_paths', DEFAULT_EXEMPT_PATHS);
  return { enabled, mode, exempt: Array.isArray(exempt) ? exempt.map(String) : DEFAULT_EXEMPT_PATHS };
}

/** The decision for a request: { mask, unmasked } (unmasked: a holder asked for full values in on-request mode). */
export function piiDecision(req) {
  const s = req?.piiSettings;
  if (!req || !s) return { mask: false, unmasked: false };
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  if (!s.enabled || s.exempt.some((p) => p && path.startsWith(p))) return { mask: false, unmasked: false };
  const user = req.user;
  if (!user) return { mask: false, unmasked: false };
  // list and view endpoints (and the exports they produce) are masked; the answer to a change echoes what was sent
  if (req.method !== 'GET' && req.method !== 'HEAD') return { mask: false, unmasked: false };
  if (!hasPermission(user, VIEW_PII)) return { mask: true, unmasked: false };
  if (s.mode === 'always') return { mask: false, unmasked: false };
  const asked = String(req.get?.(UNMASK_HEADER) || req.headers?.[UNMASK_HEADER] || '') === '1';
  return { mask: !asked, unmasked: asked };
}

/** Record once per request that a holder of view:pii asked for full identifiers (on-request mode). */
function recordUnmask(req, what) {
  if (req.piiUnmaskRecorded) return;
  req.piiUnmaskRecorded = true;
  const path = String(req.originalUrl || req.url || '').split('?')[0];
  audit(req, { entity: 'personal_data', entityId: path.slice(0, 200), action: 'unmask', after: { path, method: req.method, what } })
    .catch((e) => logger.warn({ err: e }, 'unmask audit failed'));
}

/**
 * Express middleware (app level, after body parsing): loads the masking settings, drops masked values sent back by
 * forms, and wraps res.json so every JSON answer is decrypted and, when the policy says so, masked.
 */
export function piiMiddleware(req, res, next) {
  loadPolicySettings().then((settings) => {
    req.piiSettings = settings;
    const path = String(req.originalUrl || req.url || '').split('?')[0];
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && typeof req.body === 'object' && !settings.exempt.some((p) => path.startsWith(p))) {
      const dropped = stripMasked(req.body);
      if (dropped.length) req.piiDropped = dropped;
    }
    const json = res.json.bind(res);
    res.json = (body) => {
      const { mask, unmasked } = piiDecision(req);
      if (unmasked) recordUnmask(req, 'response');
      if (!mask && !holdsCipher(JSON.stringify(body ?? null))) return json(body);
      return json(protectPayload(body, { mask }));
    };
    next();
  }).catch(next);
}

/** Masking decision for code running inside a request (exports); outside a request nothing is masked. */
export function currentPiiDecision() {
  const req = currentRequest();
  const d = piiDecision(req);
  if (d.unmasked) recordUnmask(req, 'export');
  return d;
}

/** Decrypt and, for the current request, mask the rows of an export. */
export const protectExportRows = (columns, rows) => protectRows(columns, rows, { mask: currentPiiDecision().mask });
