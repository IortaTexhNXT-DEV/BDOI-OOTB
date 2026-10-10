import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { config } from './config.js';
import { errorHandler } from './lib/errors.js';
import { verify } from './lib/auth.js';
import { apiRateLimit } from './lib/rateLimit.js';
import { signFileLinks } from './lib/fileLinks.js';
import { requestContext } from './lib/requestContext.js';
import { healthHandler, livenessHandler } from './lib/health.js';
import { logger, redactRequest } from './lib/logger.js';
import { piiMiddleware } from './lib/piiPolicy.js';
import { featureGate } from './modules/features/gate.js';

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
  app.set('trust proxy', config.trustProxy);
  app.use(requestId);
  app.use(requestContext);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins, exposedHeaders: ['x-request-id', 'Retry-After', 'Content-Disposition'] }));
  app.use(pinoHttp({
    logger, genReqId: (req) => req.id, autoLogging: { ignore: (req) => req.url === '/api/health' || req.url === '/api/health/live' },
    serializers: { req: redactRequest },
  }));
  app.use(apiRateLimit(rateKey));
  // the raw bytes are kept for webhook signatures computed over the exact body (payment gateways)
  app.use(express.json({ limit: config.jsonBodyLimit, verify: (req, _res, buf) => { req.rawBody = buf; } }));
  app.use(signFileLinks);
  // personal identifiers: decrypted on the way out and masked for users without view:pii (lib/piiPolicy.js)
  app.use(piiMiddleware);

  const api = express.Router();
  app.use('/api', api);
  // Load-balancer readiness (database + migrations, 503 when not ready) and liveness (process only): src/lib/health.js
  api.get('/health', healthHandler);
  api.get('/health/live', livenessHandler);
  // functions of releases this environment does not run answer 403 FEATURE_NOT_ENABLED (modules/features)
  api.use(featureGate);
  for (const m of await loadModules()) {
    api.use(m.mount || '/', m.default);
    for (const [prefix, r] of m.extraMounts || []) api.use(prefix, r);
  }
  api.use((req, res) => res.status(404).json({ success: false, message: `Cannot ${req.method} /api${req.url}`, requestId: req.id }));
  app.use(errorHandler);
  return app;
}
