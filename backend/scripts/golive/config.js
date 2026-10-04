/** Configuration of the go-live rehearsal, from the environment only (no password is ever written in the code). */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function loadConfig(env = process.env) {
  const need = {
    SOURCE_API: env.SOURCE_API, TARGET_API: env.TARGET_API,
    SOURCE_ADMIN_PASSWORD: env.SOURCE_ADMIN_PASSWORD || env.ADMIN_PASSWORD, TARGET_ADMIN_PASSWORD: env.TARGET_ADMIN_PASSWORD || env.ADMIN_PASSWORD,
    PERSONA_PASSWORD: env.PERSONA_PASSWORD, SOURCE_DATABASE_URL: env.SOURCE_DATABASE_URL, TARGET_DATABASE_URL: env.TARGET_DATABASE_URL,
  };
  const missing = Object.entries(need).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) throw new Error(`Set ${missing.join(', ')} (see the header of scripts/golive-rehearsal.js)`);
  if (env.CONFIRM_RESET !== 'yes') {
    throw new Error('The rehearsal resets the transactions of TARGET (smoke test clean-up): set CONFIRM_RESET=yes to confirm TARGET_DATABASE_URL is a rehearsal or pre-go-live database');
  }
  if (env.SOURCE_DATABASE_URL === env.TARGET_DATABASE_URL || env.SOURCE_API === env.TARGET_API) throw new Error('SOURCE and TARGET must be two different environments');
  if (env.CUTOVER_DATE && !DATE.test(env.CUTOVER_DATE)) throw new Error('CUTOVER_DATE must be YYYY-MM-DD');
  const repoDocs = path.resolve(here, '../../../docs/e2e');
  const report = env.REHEARSAL_REPORT || (fs.existsSync(repoDocs) ? path.join(repoDocs, 'GOLIVE_REHEARSAL_RUN.md') : '');
  const workDir = env.REHEARSAL_WORKDIR || path.join(os.tmpdir(), `golive-rehearsal-${process.pid}`);
  fs.mkdirSync(workDir, { recursive: true });
  return {
    sourceApi: env.SOURCE_API.replace(/\/+$/, ''), targetApi: env.TARGET_API.replace(/\/+$/, ''),
    sourceAdmin: env.SOURCE_ADMIN_USER || env.ADMIN_USER || 'BrokerVerse', targetAdmin: env.TARGET_ADMIN_USER || env.ADMIN_USER || 'BrokerVerse',
    sourcePassword: need.SOURCE_ADMIN_PASSWORD, targetPassword: need.TARGET_ADMIN_PASSWORD, personaPassword: env.PERSONA_PASSWORD,
    sourceDb: env.SOURCE_DATABASE_URL, targetDb: env.TARGET_DATABASE_URL,
    cutover: env.CUTOVER_DATE || null,
    keepLock: env.REHEARSAL_KEEP_LOCK === 'yes',
    allowUnlock: env.REHEARSAL_ALLOW_UNLOCK === 'yes',
    report: report === 'none' ? '' : report,
    workDir,
    quiet: env.REHEARSAL_QUIET === '1',
    seed: env.REHEARSAL_SEED || 'brokerverse-golive',
  };
}
