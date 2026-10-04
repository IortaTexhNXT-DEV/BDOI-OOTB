/** Configuration of the UAT scenario, from the environment only (no password is ever written in the code). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig(env = process.env) {
  const missing = ['API_BASE', 'ADMIN_PASSWORD', 'PERSONA_PASSWORD'].filter((k) => !env[k]);
  if (missing.length) {
    throw new Error(`Set ${missing.join(', ')} (see the header of scripts/uat-scenario.js)`);
  }
  const scale = Number(env.UAT_SCALE || 1);
  if (!(scale > 0) || scale > 10) throw new Error('UAT_SCALE must be a number between 0 and 10');
  // The run log goes to docs/e2e of the repository when the scenario runs from a checkout; UAT_REPORT overrides it.
  const repoDocs = path.resolve(here, '../../../docs/e2e');
  const report = env.UAT_REPORT || (fs.existsSync(repoDocs) ? path.join(repoDocs, 'UAT_SCENARIO_RUN.md') : '');
  return {
    apiBase: env.API_BASE.replace(/\/+$/, ''),
    adminUser: env.ADMIN_USER || 'BrokerVerse',
    adminPassword: env.ADMIN_PASSWORD,
    personaPassword: env.PERSONA_PASSWORD,
    seed: env.UAT_SEED || 'brokerverse-uat',
    scale,
    months: Math.min(Math.max(Number(env.UAT_MONTHS || 6), 2), 12),
    report: report === 'none' ? '' : report,
    quiet: env.UAT_QUIET === '1',
  };
}
