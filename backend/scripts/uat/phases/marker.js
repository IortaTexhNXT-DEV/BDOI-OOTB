/**
 * Whether the data was loaded before. The records are entered the way staff would enter them, so nothing marks them as
 * generated: a database that already holds policies entered by the persona users counts as loaded, and a second run then
 * skips the business steps (the data is never loaded twice). Load it on a database without business records.
 */
import { listOf } from '../http.js';

export async function findMarker(ctx) {
  const policies = listOf(await ctx.as.sysadmin.get('/policies', { page: 1, pageSize: 1 }));
  return policies.length ? { state: 'complete', completedAt: 'an earlier run', seed: ctx.cfg.seed } : null;
}

export async function startMarker() {}

export async function finishMarker() {}
