/**
 * In-memory sliding-window rate limiter (per process). Used for sign-in and forgot-password: keys are per IP and per
 * username; limits come from the setting security.login_rate_limit ({ max, windowSeconds }).
 */
import { getSetting } from './settings.js';

const buckets = new Map();
let lastSweep = 0;

function sweep(now, windowMs) {
  if (now - lastSweep < 60000 && buckets.size < 10000) return;
  lastSweep = now;
  for (const [k, hits] of buckets) if (!hits.length || hits[hits.length - 1] <= now - windowMs) buckets.delete(k);
}
const recent = (key, now, windowMs) => {
  const hits = (buckets.get(key) || []).filter((t) => t > now - windowMs);
  if (hits.length) buckets.set(key, hits); else buckets.delete(key);
  return hits;
};

/** Limits from settings (defaults: 10 attempts per 5 minutes). */
export async function loginLimits() {
  const v = (await getSetting('security.login_rate_limit', null)) || {};
  return { max: Math.max(1, Number(v.max) || 10), windowMs: Math.max(1, Number(v.windowSeconds) || 300) * 1000 };
}

/** Is any of the keys at its limit? Returns { limited, retryAfter (seconds) }. */
export function isLimited(keys, { max, windowMs }, now = Date.now()) {
  sweep(now, windowMs);
  let retryAfter = 0;
  for (const k of keys) {
    const hits = recent(k, now, windowMs);
    if (hits.length >= max) retryAfter = Math.max(retryAfter, Math.ceil((hits[0] + windowMs - now) / 1000));
  }
  return { limited: retryAfter > 0, retryAfter };
}

/** Record one attempt against every key. */
export function hit(keys, now = Date.now()) {
  for (const k of keys) buckets.set(k, [...(buckets.get(k) || []), now]);
}

export const clearKey = (key) => buckets.delete(key);
/** Tests: forget every counter. */
export const resetRateLimits = () => buckets.clear();

export const ipKey = (scope, ip) => `${scope}:ip:${ip || 'unknown'}`;
export const userKey = (scope, username) => `${scope}:user:${String(username || '').trim().toLowerCase()}`;
