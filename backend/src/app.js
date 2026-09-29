import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import pino from 'pino';
import { config } from './config.js';
import { errorHandler } from './lib/errors.js';
import { verify } from './lib/auth.js';
import { apiRateLimit } from './lib/rateLimit.js';
import { signFileLinks } from './lib/fileLinks.js';

/**
 * Log redaction: bearer tokens, cookies and credentials never reach the log store. Query parameters that carry
 * tokens (signed download links, file signatures) are masked in logged URLs.
 */
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
const here = path.dirname(fileURLToPath(import.meta.url));

/** Rate-limit key: the user of a valid access token, else the client IP. */
function rateKey(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) {
    try {
      const p = verify(h.slice(7));
      if (p.type === 'access' && p.sub) return `user:${p.sub}`;
    } catch { /* invalid token: counted per IP */ }
  }
  return `ip:${req.ip || 'unknown'}`;
}

/**
 * Every folder in src/modules with a router.js is mounted under /api.
 * A module exports: default (express Router), optional `mount` (path prefix, default ''),
 * optional `extraMounts` ([[prefix, router], ...]) and optional `order` (lower mounts first).
 */
export async function loadModules() {
  const dir = path.join(here, 'modules');
  const mods = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name, 'router.js');
    if (!fs.existsSync(file)) continue;
    const m = await import(pathToFileURL(file).href);
    mods.push({ name, ...m });
  }
  return mods.sort((a, b) => (a.order ?? 50) - (b.order ?? 50));
}

/** Correlation id: the caller's x-request-id (when well-formed) or a new UUID; echoed on every response, logged, and returned in error bodies. */
export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[A-Za-z0-9._:-]{1,128}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}

export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins, exposedHeaders: ['x-request-id', 'Retry-After', 'Content-Disposition'] }));
  app.use(pinoHttp({
    logger, genReqId: (req) => req.id, autoLogging: { ignore: (req) => req.url === '/api/health' },
    serializers: { req: redactRequest },
  }));
  app.use(apiRateLimit(rateKey));
  app.use(express.json({ limit: config.jsonBodyLimit }));
  app.use(signFileLinks);

  const api = express.Router();
  app.use('/api', api);
  api.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  for (const m of await loadModules()) {
    api.use(m.mount || '/', m.default);
    for (const [prefix, r] of m.extraMounts || []) api.use(prefix, r);
  }
  api.use((req, res) => res.status(404).json({ success: false, message: `Cannot ${req.method} /api${req.url}`, requestId: req.id }));
  app.use(errorHandler);
  return app;
}
