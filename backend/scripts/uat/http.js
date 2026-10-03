/**
 * HTTP client of the UAT scenario. Every call goes through the public API with the bearer token of a persona, so the
 * scenario can be pointed at any environment. Sessions renew their access token with the refresh token, and a 429
 * answer is retried after the Retry-After delay.
 */

export class ApiError extends Error {
  constructor(method, path, status, body) {
    const message = body?.message || body?.error?.message || (typeof body === 'string' ? body.slice(0, 200) : `HTTP ${status}`);
    super(`${method} ${path} -> ${status}: ${message}`);
    this.method = method;
    this.path = path;
    this.status = status;
    this.body = body;
    this.apiMessage = message;
    this.details = Array.isArray(body?.errors) ? body.errors : null;
  }
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/** Build a query string from an object, leaving out empty values. */
export function qs(params = {}) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (!entries.length) return '';
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')}`;
}

export class Api {
  constructor(baseUrl, { timeoutMs = 120000 } = {}) {
    this.base = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.calls = 0;
  }

  /** One HTTP request. body: object (JSON) or FormData. Returns the parsed body (JSON, text, or Buffer for files). */
  async raw(method, path, { body, token, headers = {}, binary = false } = {}) {
    const init = { method, headers: { ...headers } };
    if (token) init.headers.authorization = `Bearer ${token}`;
    if (body instanceof FormData) init.body = body;
    else if (body !== undefined) {
      init.headers['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    for (let attempt = 0; ; attempt += 1) {
      this.calls += 1;
      const res = await fetch(this.base + path, { ...init, signal: AbortSignal.timeout(this.timeoutMs) });
      if (res.status === 429 && attempt < 5) {
        const wait = Number(res.headers.get('retry-after') || 5);
        await sleep(Math.min(Math.max(wait, 1), 120) * 1000);
        continue;
      }
      const type = res.headers.get('content-type') || '';
      let parsed;
      if (binary && res.ok) parsed = Buffer.from(await res.arrayBuffer());
      else if (type.includes('json')) parsed = await res.json().catch(() => null);
      else parsed = await res.text();
      return { status: res.status, body: parsed, headers: res.headers };
    }
  }
}

/**
 * A signed-in user. Sign-in handles the first-login password change: a temporary password is exchanged for the
 * persona password on the first sign-in.
 */
export class Session {
  constructor(api, username, displayName = username) {
    this.api = api;
    this.username = username;
    this.displayName = displayName;
    this.token = null;
    this.refreshToken = null;
    this.user = null;
  }

  async login(password, { newPassword = null } = {}) {
    const r = await this.api.raw('POST', '/auth/login', { body: { username: this.username, password } });
    if (r.status !== 200) throw new ApiError('POST', '/auth/login', r.status, r.body);
    if (r.body.twoFactorRequired || r.body.twoFactorSetupRequired) {
      throw new ApiError('POST', '/auth/login', 409, { message: `${this.username} needs two-factor authentication, which the scenario cannot complete` });
    }
    if (r.body.passwordChangeRequired) {
      if (!newPassword) throw new ApiError('POST', '/auth/login', 409, { message: `${this.username} must change the password first` });
      const c = await this.api.raw('POST', '/auth/change-password', { token: r.body.accessToken, body: { currentPassword: password, newPassword } });
      if (c.status !== 200) throw new ApiError('POST', '/auth/change-password', c.status, c.body);
      this.adopt(c.body);
      return { changedPassword: true };
    }
    this.adopt(r.body);
    return { changedPassword: false };
  }

  adopt(payload) {
    this.token = payload.accessToken;
    this.refreshToken = payload.refreshToken || null;
    this.user = payload.user || this.user;
  }

  async refresh() {
    if (!this.refreshToken) return false;
    const r = await this.api.raw('POST', '/auth/refresh', { body: { refreshToken: this.refreshToken } });
    if (r.status !== 200) return false;
    this.adopt(r.body);
    return true;
  }

  /** Call the API as this user; throws ApiError on any answer of 400 or more. */
  async call(method, path, body, opts = {}) {
    let r = await this.api.raw(method, path, { ...opts, body, token: this.token });
    if (r.status === 401 && (await this.refresh())) r = await this.api.raw(method, path, { ...opts, body, token: this.token });
    if (r.status >= 400) throw new ApiError(method, path, r.status, r.body);
    return r.body;
  }

  get(path, params) { return this.call('GET', path + qs(params)); }
  post(path, body = {}) { return this.call('POST', path, body); }
  put(path, body = {}) { return this.call('PUT', path, body); }
  patch(path, body = {}) { return this.call('PATCH', path, body); }
  del(path) { return this.call('DELETE', path); }
  file(path, params) { return this.call('GET', path + qs(params), undefined, { binary: true }); }

  /** multipart/form-data upload: fields (strings or objects, sent as JSON) and files [{ field, name, type, data }]. */
  upload(method, path, fields = {}, files = []) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
    for (const f of files) form.append(f.field, new Blob([f.data], { type: f.type || 'application/octet-stream' }), f.name);
    return this.call(method, path, form);
  }
}

/** The data part of the usual { success, data } envelope (lists may be under data, data.items or items). */
export const dataOf = (b) => (b && typeof b === 'object' && 'data' in b ? b.data : b);
export function listOf(b) {
  const d = dataOf(b);
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  if (b && Array.isArray(b.items)) return b.items;
  for (const k of ['rows', 'records', 'clients', 'claims', 'policies', 'referrers']) if (d && Array.isArray(d[k])) return d[k];
  return [];
}
