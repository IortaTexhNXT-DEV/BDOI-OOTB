/**
 * Signed file links in API responses.
 *
 * Stored documents are served by GET /api/s3/object/<key> only to a signed-in caller (bearer header) or through a
 * short-lived HMAC-signed link (?exp=&sig=). Records keep the canonical, unsigned URL; this middleware signs every
 * object URL found in a JSON response on the way out, so screens that put the URL in an img tag or open it in a new
 * tab keep working, and a link copied out of the application stops working after FILE_URL_TTL_SECONDS.
 * An old signature (for example a signed URL that a screen saved back into a record) is replaced by a fresh one.
 */
import { linkExpiry, signFileQuery } from './secrets.js';

const OBJECT_URL = /(\/api\/(?:s3\/object|upload\/file)\/)([A-Za-z0-9._\-/]+)(\?[^"'\s\\<>]*)?/g;
const safeSegment = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 120);
const safeKey = (k) => String(k || '').split('/').map(safeSegment).filter(Boolean).join('/');

/** Replace every object URL in a text with a signed one (one expiry for the whole response). */
export function signUrlsInText(text, exp = linkExpiry()) {
  if (typeof text !== 'string' || (!text.includes('/api/s3/object/') && !text.includes('/api/upload/file/'))) return text;
  // /api/upload/file/<key> (older generated-file links) is served by the same handler; it is rewritten to the canonical path.
  return text.replace(OBJECT_URL, (_m, _prefix, rawKey, qs) => {
    const key = safeKey(rawKey);
    const params = new URLSearchParams(qs ? qs.slice(1) : '');
    params.delete('exp');
    params.delete('sig');
    const rest = params.toString();
    return `/api/s3/object/${key}?${signFileQuery(key, exp)}${rest ? `&${rest}` : ''}`;
  });
}

/** Express middleware: sign object URLs in res.json bodies. */
export function signFileLinks(_req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    let text;
    try {
      text = JSON.stringify(body);
    } catch {
      return json(body);
    }
    if (text === undefined || (!text.includes('/api/s3/object/') && !text.includes('/api/upload/file/'))) return json(body);
    if (!res.get('Content-Type')) res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(signUrlsInText(text));
  };
  next();
}
