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

export const logger = pino({ level: config.logLevel });
const here = path.dirname(fileURLToPath(import.meta.url));

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

export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
  app.use(express.json({ limit: '10mb' }));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/api/health' } }));

  const api = express.Router();
  app.use('/api', api);
  api.get('/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
  for (const m of await loadModules()) {
    api.use(m.mount || '/', m.default);
    for (const [prefix, r] of m.extraMounts || []) api.use(prefix, r);
  }
  api.use((req, res) => res.status(404).json({ success: false, message: `Cannot ${req.method} /api${req.url}` }));
  app.use(errorHandler);
  return app;
}
