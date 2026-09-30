/**
 * Run marker: an inactive client named UAT-MARKER whose extra data records the scenario runs. A completed marker makes
 * a second run skip the business steps, so the data is never loaded twice.
 */
import { dataOf, listOf } from '../http.js';

export const MARKER_NAME = 'UAT-MARKER';

export async function findMarker(ctx) {
  const rows = listOf(await ctx.as.sysadmin.get('/clients', { search: MARKER_NAME, pageSize: 10 }));
  const row = rows.find((c) => c.companyName === MARKER_NAME);
  if (!row) return null;
  ctx.markerId = row.clientId || row.id;
  return row.uatRun || { state: 'unknown' };
}

export async function startMarker(ctx, existing) {
  const run = { state: 'running', seed: ctx.cfg.seed, scale: ctx.cfg.scale, startedAt: new Date().toISOString(), months: ctx.months.map((m) => m.period) };
  if (existing && ctx.markerId) {
    await ctx.as.sysadmin.put(`/clients/${ctx.markerId}`, { uatRun: run });
    return;
  }
  const c = dataOf(await ctx.as.sysadmin.post('/clients', { companyName: MARKER_NAME, leadCategory: 'Corporate', status: 'inactive', notes: 'Marker of the UAT data scenario (not a client)', uatRun: run }));
  ctx.markerId = c.clientId || c.id;
}

export async function finishMarker(ctx) {
  const counts = Object.fromEntries(ctx.log.counts);
  await ctx.as.sysadmin.put(`/clients/${ctx.markerId}`, {
    status: 'inactive',
    uatRun: { state: 'complete', seed: ctx.cfg.seed, scale: ctx.cfg.scale, completedAt: new Date().toISOString(), failedSteps: ctx.log.failures.length, counts },
  });
}
