/**
 * The application logger (pino, JSON lines on stdout). Request logs carry the request id (see requestId in app.js);
 * scheduled jobs log their job code and run id.
 *
 * Log redaction: bearer tokens, cookies and credentials never reach the log store. Query parameters that carry
 * tokens (signed download links, file signatures) are masked in logged URLs.
 */
import pino from 'pino';
import { config } from '../config.js';

export const REDACT_PATHS = [
  'req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]', 'res.headers["set-cookie"]',
  'req.query.token', 'req.query.sig', 'req.query.code',
  'req.body.password', 'req.body.newPassword', 'req.body.currentPassword', 'req.body.refreshToken', 'req.body.code',
];
const SECRET_PARAMS = /([?&](?:token|sig|access_token|refresh_token|refreshToken|code|password)=)[^&#]*/gi;
export const redactUrl = (url) => (typeof url === 'string' ? url.replace(SECRET_PARAMS, '$1[redacted]') : url);

/** pino-http request serializer (receives the standard serialized request): mask token query parameters. */
export function redactRequest(req) {
  if (!req || typeof req !== 'object') return req;
  req.url = redactUrl(req.url);
  if (req.query && typeof req.query === 'object') {
    const q = { ...req.query };
    for (const k of Object.keys(q)) if (/^(token|sig|access_token|refresh_token|refreshToken|code|password)$/i.test(k)) q[k] = '[redacted]';
    req.query = q;
  }
  return req;
}

export const logger = pino({ level: config.logLevel, redact: { paths: REDACT_PATHS, censor: '[redacted]' } });
