/**
 * API documentation export (npm run export:api [-- --out <dir>]).
 * Loads every module so the route registry is filled, then writes to docs/api/:
 *   openapi.json, BrokerVerse.postman_collection.json, BrokerVerse.postman_environment.json,
 *   BrokerVerse_API_Touchpoints.xlsx (API List, By Screen, Modules) and BrokerVerse_API_Touchpoints.csv.
 * Modules that fail to load (e.g. work in progress) are skipped and listed in the output.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from '../config.js';
import { ROUTES } from '../lib/registry.js';
import { writeXlsx } from './xlsx.js';
import { toCsv } from './csv.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '..', '..');
const TITLE = 'BrokerVerse Platform API';
const METHOD_ORDER = { GET: 1, POST: 2, PUT: 3, PATCH: 4, DELETE: 5 };

/** Import every module router (recording which routes each registers), then loadModules() from src/app.js. */
export async function collectRoutes(modulesDir = path.join(ROOT, 'src', 'modules')) {
  const routes = [];
  const skipped = [];
  for (const folder of fs.readdirSync(modulesDir).sort()) {
    const file = path.join(modulesDir, folder, 'router.js');
    if (!fs.existsSync(file)) continue;
    const start = ROUTES.length;
    try {
      const m = await import(pathToFileURL(file).href);
      const mount = m.mount && m.mount !== '/' ? m.mount : '';
      for (const r of ROUTES.slice(start)) {
        const p = mount && !r.path.startsWith(mount) ? mount + r.path : r.path;
        routes.push({ ...r, folder, path: (p.length > 1 ? p.replace(/\/$/, '') : p) || '/' });
      }
    } catch (e) {
      skipped.push({ module: folder, error: e.message.split('\n')[0] });
    }
  }
  try {
    const { loadModules } = await import('../app.js');
    await loadModules();
  } catch (e) {
    if (!skipped.length) skipped.push({ module: '(loadModules)', error: e.message.split('\n')[0] });
  }
  const seen = new Set();
  const unique = routes.filter((r) => {
    const k = `${r.method} ${r.path}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  unique.sort((a, b) => a.module.localeCompare(b.module) || a.path.localeCompare(b.path) || (METHOD_ORDER[a.method] || 9) - (METHOD_ORDER[b.method] || 9));
  return { routes: unique, skipped };
}

/* ---------- helpers ---------- */
const pathParams = (p) => [...p.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]);
const accessText = (r) => {
  if (!r.auth) return 'Public';
  const parts = [...(r.roles || []).map((x) => `role:${x}`), ...(r.permissions || [])];
  return parts.length ? parts.join(', ') : 'Any authenticated user';
};
const hasBody = (r) => r.request !== undefined && r.request !== null && !['GET', 'HEAD'].includes(r.method);
const pretty = (v) => (v === undefined || v === null ? '' : typeof v === 'string' ? v : JSON.stringify(v, null, 2));
const queryString = (q) => (q && typeof q === 'object' ? Object.entries(q).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('&') : '');
const stableId = (s) => {
  const h = crypto.createHash('sha1').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

function inferSchema(v) {
  if (v === null || v === undefined) return {};
  if (Array.isArray(v)) return { type: 'array', items: v.length ? inferSchema(v[0]) : {} };
  if (typeof v === 'object') return { type: 'object', properties: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, inferSchema(x)])) };
  if (typeof v === 'number') return { type: Number.isInteger(v) ? 'integer' : 'number' };
  if (typeof v === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

/* ---------- OpenAPI 3.1 ---------- */
export function buildOpenApi(routes, { baseUrl, version }) {
  const paths = {};
  const opIds = new Set();
  for (const r of routes) {
    const oaPath = r.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
    let opId = `${r.method.toLowerCase()}${oaPath.replace(/[{}]/g, '').split(/[/-]/).filter(Boolean).map((s) => s[0].toUpperCase() + s.slice(1)).join('')}`;
    while (opIds.has(opId)) opId += '_';
    opIds.add(opId);
    const parameters = [
      ...pathParams(r.path).map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
      ...Object.entries(r.query && typeof r.query === 'object' ? r.query : {}).map(([name, ex]) => ({ name, in: 'query', required: false, schema: inferSchema(ex), example: ex })),
    ];
    const file = typeof r.response === 'string';
    const op = {
      operationId: opId, summary: r.summary || `${r.method} ${r.path}`, tags: [r.module],
      description: [r.screen && `Front-end touchpoint: ${r.screen}`, `Access: ${accessText(r)}`].filter(Boolean).join('\n\n'),
      parameters,
      responses: {
        200: file ? { description: r.response, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }
          : { description: 'Success', content: { 'application/json': { schema: inferSchema(r.response), ...(r.response !== undefined ? { example: r.response } : {}) } } },
        ...(hasBody(r) || parameters.length ? { 400: { $ref: '#/components/responses/BadRequest' } } : {}),
        ...(r.auth ? { 401: { $ref: '#/components/responses/Unauthorized' }, 403: { $ref: '#/components/responses/Forbidden' } } : {}),
      },
      'x-screen': r.screen || undefined,
      'x-permissions': r.permissions?.length ? r.permissions : undefined,
    };
    if (!r.auth) op.security = [];
    if (hasBody(r)) op.requestBody = { required: true, content: { 'application/json': { schema: inferSchema(r.request), example: r.request } } };
    paths[oaPath] = paths[oaPath] || {};
    paths[oaPath][r.method.toLowerCase()] = op;
  }
  const err = (description) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } });
  return {
    openapi: '3.1.0',
    info: { title: TITLE, version, description: 'BrokerVerse insurance-broking platform API. Generated from the route registry (src/lib/registry.js) by src/tools/export-api.js. Obtain a token with POST /auth/login and send it as "Authorization: Bearer <token>".' },
    servers: [{ url: baseUrl, description: 'PUBLIC_BASE_URL' }],
    security: [{ bearerAuth: [] }],
    tags: [...new Set(routes.map((r) => r.module))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: { Error: { type: 'object', properties: { success: { type: 'boolean', const: false }, message: { type: 'string' }, errors: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, message: { type: 'string' } } } } }, required: ['success', 'message'] } },
      responses: { BadRequest: err('Validation error'), Unauthorized: err('Missing or invalid bearer token'), Forbidden: err('Missing role or permission') },
    },
  };
}

/* ---------- Postman v2.1 ---------- */
const LOGIN_TEST = [
  'const body = pm.response.json();',
  'const token = body.accessToken || body.token || (body.data && (body.data.accessToken || body.data.token));',
  "pm.test('login succeeded', () => pm.expect(token, 'access token').to.be.a('string'));",
  "if (token) { pm.collectionVariables.set('token', token); if (pm.environment) pm.environment.set('token', token); }",
];

function postmanRequest(r, overrides = {}) {
  const params = pathParams(r.path);
  const query = r.query && typeof r.query === 'object' ? Object.entries(r.query).map(([key, v]) => ({ key, value: typeof v === 'object' ? JSON.stringify(v) : String(v ?? '') })) : [];
  const segs = r.path.split('/').filter(Boolean);
  const qs = query.map((q) => `${q.key}=${q.value}`).join('&');
  const req = {
    method: r.method,
    header: hasBody(r) || overrides.body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    url: { raw: `{{baseUrl}}/${segs.join('/')}${qs ? `?${qs}` : ''}`, host: ['{{baseUrl}}'], path: segs, ...(query.length ? { query } : {}), ...(params.length ? { variable: params.map((key) => ({ key, value: '', description: `${key} (path parameter)` })) } : {}) },
    description: [r.summary, r.screen && `Front-end touchpoint: ${r.screen}`, `Access: ${accessText(r)}`].filter(Boolean).join('\n\n'),
  };
  if (!r.auth) req.auth = { type: 'noauth' };
  const body = overrides.body ?? (hasBody(r) ? r.request : undefined);
  if (body !== undefined) req.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } };
  return req;
}

function postmanItem(r, overrides = {}) {
  const request = postmanRequest(r, overrides);
  const item = { name: overrides.name || r.summary || `${r.method} ${r.path}`, request, response: [] };
  if (r.response !== undefined) {
    const file = typeof r.response === 'string';
    item.response.push({
      name: 'Example response', originalRequest: request, status: 'OK', code: 200, _postman_previewlanguage: file ? 'text' : 'json',
      header: [{ key: 'Content-Type', value: file ? 'application/octet-stream' : 'application/json; charset=utf-8' }], cookie: [],
      body: file ? r.response : JSON.stringify(r.response, null, 2),
    });
  }
  if (overrides.test) item.event = [{ listen: 'test', script: { type: 'text/javascript', exec: overrides.test } }];
  return item;
}

export function buildPostman(routes, { baseUrl, version }) {
  const login = routes.find((r) => r.method === 'POST' && /\/auth\/login$/.test(r.path))
    || { method: 'POST', path: '/auth/login', module: 'Auth', auth: false, summary: 'Login', request: {}, response: { accessToken: '...' } };
  const credentials = { ...(login.request && typeof login.request === 'object' ? login.request : {}), username: '{{username}}', password: '{{password}}' };
  const loginItem = postmanItem(login, { name: 'Login (run first: stores {{token}})', body: credentials, test: LOGIN_TEST });
  const folders = new Map();
  for (const r of routes) {
    if (!folders.has(r.module)) folders.set(r.module, []);
    const isLogin = r === login;
    folders.get(r.module).push(postmanItem(r, isLogin ? { body: credentials, test: LOGIN_TEST } : {}));
  }
  return {
    info: {
      _postman_id: stableId(`${TITLE} collection`), name: TITLE, version,
      description: `${TITLE} (${routes.length} requests). Select the "BrokerVerse" environment, fill username and password, run "Login" first: its test script stores the access token in {{token}}, which every request sends as a bearer token.`,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    auth: { type: 'bearer', bearer: [{ key: 'token', value: '{{token}}', type: 'string' }] },
    variable: [{ key: 'baseUrl', value: baseUrl, type: 'string' }, { key: 'token', value: '', type: 'string' }],
    item: [loginItem, ...[...folders].map(([name, item]) => ({ name, item }))],
  };
}

export const buildEnvironment = (baseUrl) => ({
  id: stableId(`${TITLE} environment`), name: 'BrokerVerse',
  values: [
    { key: 'baseUrl', value: baseUrl, type: 'default', enabled: true },
    { key: 'username', value: '', type: 'default', enabled: true },
    { key: 'password', value: '', type: 'secret', enabled: true },
    { key: 'token', value: '', type: 'secret', enabled: true },
  ],
  _postman_variable_scope: 'environment',
});

/* ---------- Excel / CSV touchpoints ---------- */
const API_COLUMNS = [
  { key: 'n', header: '#', type: 'integer', width: 6 }, { key: 'module', header: 'Module', width: 18 }, { key: 'method', header: 'Method', width: 9 },
  { key: 'endpoint', header: 'Endpoint', width: 45 }, { key: 'summary', header: 'Summary', width: 50, type: 'wrap' },
  { key: 'screen', header: 'Front-end screen (touchpoint)', width: 42, type: 'wrap' }, { key: 'auth', header: 'Auth', width: 12 },
  { key: 'access', header: 'Roles/Permissions', width: 28, type: 'wrap' }, { key: 'request', header: 'Request example', width: 60, type: 'wrap' },
  { key: 'response', header: 'Response example', width: 70, type: 'wrap' },
];

export function apiRows(routes) {
  return routes.map((r, i) => {
    const qs = queryString(r.query);
    const req = [qs && `Query: ?${qs}`, hasBody(r) && pretty(r.request)].filter(Boolean).join('\n');
    return {
      n: i + 1, module: r.module, method: r.method, endpoint: `/api${r.path}`, summary: r.summary, screen: r.screen,
      auth: r.auth ? 'Bearer JWT' : 'Public', access: accessText(r), request: req, response: pretty(r.response),
    };
  });
}

export function buildWorkbook(routes, skipped = []) {
  const rows = apiRows(routes);
  const byScreen = [];
  for (const r of rows) {
    const screens = String(r.screen || '(no screen: API only)').split(/;\s*/).map((s) => s.trim()).filter(Boolean);
    for (const s of screens) byScreen.push({ screen: s, method: r.method, endpoint: r.endpoint, module: r.module, summary: r.summary, n: r.n });
  }
  byScreen.sort((a, b) => a.screen.localeCompare(b.screen) || a.endpoint.localeCompare(b.endpoint));
  const perScreen = byScreen.reduce((m, x) => m.set(x.screen, (m.get(x.screen) || 0) + 1), new Map());
  const modules = [...new Set(routes.map((r) => r.module))].map((m) => {
    const rs = routes.filter((r) => r.module === m);
    const count = (meth) => rs.filter((r) => r.method === meth).length;
    return { module: m, total: rs.length, get: count('GET'), post: count('POST'), put: count('PUT'), patch: count('PATCH'), del: count('DELETE'), pub: rs.filter((r) => !r.auth).length, screens: new Set(rs.map((r) => r.screen).filter(Boolean)).size };
  });
  const totals = modules.reduce((t, m) => Object.fromEntries(Object.keys(m).map((k) => [k, k === 'module' ? 'TOTAL' : (t[k] || 0) + m[k]])), {});
  const sheets = [
    { name: 'API List', columns: API_COLUMNS, rows },
    {
      name: 'By Screen',
      columns: [{ key: 'screen', header: 'Front-end screen (touchpoint)', width: 48, type: 'wrap' }, { key: 'count', header: 'Endpoints on screen', type: 'integer', width: 12 }, { key: 'method', header: 'Method', width: 9 }, { key: 'endpoint', header: 'Endpoint', width: 45 }, { key: 'module', header: 'Module', width: 18 }, { key: 'summary', header: 'Summary', width: 60, type: 'wrap' }, { key: 'n', header: 'API #', type: 'integer', width: 8 }],
      rows: byScreen.map((x) => ({ ...x, count: perScreen.get(x.screen) })),
    },
    {
      name: 'Modules',
      columns: [{ key: 'module', header: 'Module', width: 22 }, { key: 'total', header: 'Endpoints', type: 'integer', width: 11 }, { key: 'get', header: 'GET', type: 'integer', width: 8 }, { key: 'post', header: 'POST', type: 'integer', width: 8 }, { key: 'put', header: 'PUT', type: 'integer', width: 8 }, { key: 'patch', header: 'PATCH', type: 'integer', width: 8 }, { key: 'del', header: 'DELETE', type: 'integer', width: 9 }, { key: 'pub', header: 'Public (no auth)', type: 'integer', width: 14 }, { key: 'screens', header: 'Distinct screens', type: 'integer', width: 14 }],
      rows: modules.length ? [...modules, totals] : [],
    },
  ];
  if (skipped.length) sheets.push({ name: 'Skipped modules', columns: [{ key: 'module', header: 'Module folder', width: 24 }, { key: 'error', header: 'Load error', width: 100, type: 'wrap' }], rows: skipped });
  return { buffer: writeXlsx({ sheets, title: `${TITLE} touchpoints` }), csv: toCsv(API_COLUMNS.map((c) => ({ key: c.key, label: c.header })), rows) };
}

/** Write every artefact into outDir and return a summary. */
export async function exportApi({ outDir = path.join(ROOT, 'docs', 'api'), baseUrl = `${config.publicBaseUrl.replace(/\/$/, '')}/api` } = {}) {
  const { routes, skipped } = await collectRoutes();
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
  fs.mkdirSync(outDir, { recursive: true });
  const files = {
    openapi: path.join(outDir, 'openapi.json'),
    postman: path.join(outDir, 'BrokerVerse.postman_collection.json'),
    environment: path.join(outDir, 'BrokerVerse.postman_environment.json'),
    xlsx: path.join(outDir, 'BrokerVerse_API_Touchpoints.xlsx'),
    csv: path.join(outDir, 'BrokerVerse_API_Touchpoints.csv'),
  };
  fs.writeFileSync(files.openapi, `${JSON.stringify(buildOpenApi(routes, { baseUrl, version }), null, 2)}\n`);
  fs.writeFileSync(files.postman, `${JSON.stringify(buildPostman(routes, { baseUrl, version }), null, 2)}\n`);
  fs.writeFileSync(files.environment, `${JSON.stringify(buildEnvironment(baseUrl), null, 2)}\n`);
  const wb = buildWorkbook(routes, skipped);
  fs.writeFileSync(files.xlsx, wb.buffer);
  fs.writeFileSync(files.csv, wb.csv);
  return { routes: routes.length, modules: new Set(routes.map((r) => r.module)).size, skipped, files };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf('--out');
  const outDir = i > 0 ? path.resolve(process.argv[i + 1]) : undefined;
  exportApi({ outDir })
    .then(async (r) => {
      process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
      const { pool } = await import('../db/pool.js');
      await pool.end();
      process.exit(0);
    })
    .catch((e) => { process.stderr.write(`${e.stack}\n`); process.exit(1); });
}
