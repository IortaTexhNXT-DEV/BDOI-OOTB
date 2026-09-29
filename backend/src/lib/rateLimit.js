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

// ------------------------------------------------------------------ global API limit
// Fixed-window counters (one number per key, so a flood cannot grow memory per request).
const windows = new Map();

/** Limits of the global API rate limit (setting security.api_rate_limit; max 0 turns it off). */
export async function apiLimits() {
  const v = (await getSetting('security.api_rate_limit', null)) || {};
  const max = v.max === undefined ? 600 : Math.max(0, Number(v.max) || 0);
  return { max, windowMs: Math.max(1, Number(v.windowSeconds) || 60) * 1000 };
}

/** Count one request against the key; returns { limited, retryAfter, remaining }. */
export function takeApi(key, { max, windowMs }, now = Date.now()) {
  if (!max) return { limited: false, retryAfter: 0, remaining: Infinity };
  if (windows.size > 50000) for (const [k, w] of windows) if (w.start + windowMs <= now) windows.delete(k);
  let w = windows.get(key);
  if (!w || w.start + windowMs <= now) {
    w = { start: now, count: 0 };
    windows.set(key, w);
  }
  w.count += 1;
  const limited = w.count > max;
  return { limited, retryAfter: limited ? Math.max(1, Math.ceil((w.start + windowMs - now) / 1000)) : 0, remaining: Math.max(0, max - w.count) };
}

/**
 * Express middleware: per signed-in user (sub of a valid-looking bearer token) or per client IP, at most `max`
 * requests in each window. Answers 429 with Retry-After. The health check is not counted.
 * `keyOf(req)` returns the key; the default uses the IP.
 */
export function apiRateLimit(keyOf = (req) => `ip:${req.ip || 'unknown'}`) {
  return async (req, res, next) => {
    try {
      if (req.path === '/api/health' || req.path === '/api/health/live' || req.method === 'OPTIONS') return next();
      const limits = await apiLimits();
      const r = takeApi(`api:${keyOf(req)}`, limits);
      if (!r.limited) return next();
      res.set('Retry-After', String(r.retryAfter));
      return res.status(429).json({ success: false, message: `Too many requests. Try again in ${r.retryAfter} seconds`, retryAfter: r.retryAfter, requestId: req.id });
    } catch (e) {
      return next(e);
    }
  };
}

/** Tests: forget every counter. */
export const resetRateLimits = () => { buckets.clear(); windows.clear(); };

export const ipKey = (scope, ip) => `${scope}:ip:${ip || 'unknown'}`;
export const userKey = (scope, username) => `${scope}:user:${String(username || '').trim().toLowerCase()}`;
