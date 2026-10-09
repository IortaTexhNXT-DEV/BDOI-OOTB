import fs from 'node:fs';
import { assertProductionConfig, config } from './config.js';
import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';
import { pool } from './db/pool.js';
import { startScheduler, stopScheduler, watchSchedules } from './jobs/scheduler.js';
import { setReady } from './lib/health.js';

try {
  assertProductionConfig();
} catch (e) {
  logger.fatal(e.message);
  process.exit(1);
}
fs.mkdirSync(config.uploadDir, { recursive: true });
setReady(false); // GET /api/health answers 503 until migrations and seed are applied
await migrate({ log: (m) => logger.info(m) });
await seed({ log: (m) => logger.info(m) });
const app = await createApp();
const server = app.listen(config.port, () => logger.info(`BrokerVerse API listening on :${config.port}`));
// Idle keep-alive connections stay open longer than the proxy in front keeps its own (load balancers and the Container
// Apps ingress reuse them), so the proxy never sends a request on a connection the API is closing (an occasional 502).
server.keepAliveTimeout = (Number(process.env.HTTP_KEEP_ALIVE_SECONDS) > 0 ? Number(process.env.HTTP_KEEP_ALIVE_SECONDS) : 65) * 1000;
server.headersTimeout = server.keepAliveTimeout + 5000;
await startScheduler(logger);
watchSchedules(logger); // other instances' schedule / time-zone edits are picked up within SCHEDULER_RELOAD_SECONDS
setReady(true);

/** Graceful shutdown: stop the scheduler, stop accepting connections and drain in-flight requests, then close the pool. */
let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'shutting down');
  setReady(false); // load balancers stop routing new requests here while in-flight ones drain
  const force = setTimeout(() => { logger.error('shutdown timed out; exiting'); process.exit(1); }, Number(process.env.SHUTDOWN_TIMEOUT_MS || 25000));
  force.unref();
  try {
    stopScheduler();
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeIdleConnections?.();
    });
    await pool.end();
    logger.info('shutdown complete');
    process.exit(0);
  } catch (e) {
    logger.error({ err: e }, 'shutdown failed');
    process.exit(1);
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
