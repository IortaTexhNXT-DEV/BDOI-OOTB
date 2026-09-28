import fs from 'node:fs';
import { config } from './config.js';
import { createApp, logger } from './app.js';
import { migrate } from './db/migrate.js';
import { seed } from './db/seed.js';
import { startScheduler } from './jobs/scheduler.js';

fs.mkdirSync(config.uploadDir, { recursive: true });
await migrate({ log: (m) => logger.info(m) });
await seed({ log: (m) => logger.info(m) });
const app = await createApp();
app.listen(config.port, () => logger.info(`BrokerVerse API listening on :${config.port}`));
await startScheduler(logger);
