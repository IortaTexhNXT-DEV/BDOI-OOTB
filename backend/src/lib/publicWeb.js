/**
 * Public address of the web application, for links that leave the platform (quotation approval, payment links).
 *
 * general.frontend_url is the configured value. A fresh installation still holds the development default
 * (http://localhost:3000), which gives customers a link that cannot open; in that case the address comes from
 * PUBLIC_WEB_URL, else from the web application origin in CORS_ORIGINS (required in production), and the
 * configured value is used only when nothing better is known.
 */
import { getSetting } from './settings.js';
import { config } from '../config.js';

const isLocal = (u) => /^https?:\/\/(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\])(:\d+)?(\/|$)/i.test(String(u || ''));
const trim = (u) => String(u || '').trim().replace(/\/+$/, '');
const isHttp = (u) => /^https?:\/\/[^\s/]+/i.test(u);

export async function publicWebUrl({ env = process.env, cfg = config } = {}) {
  const configured = trim(await getSetting('general.frontend_url', 'http://localhost:3000'));
  if (isHttp(configured) && !isLocal(configured)) return configured;
  const fromEnv = trim(env.PUBLIC_WEB_URL);
  if (isHttp(fromEnv)) return fromEnv;
  const origin = (cfg.corsOrigins || []).map(trim).find((o) => isHttp(o) && !isLocal(o));
  if (origin) return origin;
  return configured || 'http://localhost:3000';
}
