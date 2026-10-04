/**
 * Route registry: every endpoint is declared through define() so the API list, the OpenAPI document,
 * the Postman collection and the Excel touchpoint list are generated from the same source of truth.
 *
 * define() also enforces sign-in: unless a route is declared `auth: false`, requireAuth is placed first in its
 * middleware chain (before body parsing, uploads and validation), so a route cannot be left open by forgetting it.
 * The roles and permissions required by requireRole / requirePermission middleware are recorded for the documentation.
 */
import { Router } from 'express';
import { wrap } from './respond.js';
import { requireAuth } from './auth.js';

export const ROUTES = [];

const unique = (list) => [...new Set(list.filter(Boolean))];

/**
 * Create a router for a module. Each route: { method, path, summary, auth (default true), roles, permissions,
 * screen (front-end touchpoint), request (example body), query (example), response (example), middleware, handler }.
 */
export function moduleRouter(module, prefix = '') {
  const router = Router();
  const define = (r) => {
    const method = r.method.toLowerCase();
    const auth = r.auth !== false;
    const given = (r.middleware || []).flat();
    const mws = auth ? [requireAuth, ...given.filter((m) => m !== requireAuth)] : given;
    // The route's screen and path travel on the request, so the audit trail can say where a change came from.
    const routeInfo = { screen: r.screen || '', method: r.method.toUpperCase(), path: prefix + r.path };
    const tag = (req, _res, next) => { req.routeInfo = routeInfo; next(); };
    router[method](r.path, tag, ...mws, wrap(r.handler));
    const entry = { module, method: r.method.toUpperCase(), path: prefix + r.path, summary: r.summary || '',
      auth, roles: unique([...(r.roles || []), ...given.flatMap((m) => m.roles || [])]),
      permissions: unique([...(r.permissions || []), ...given.flatMap((m) => m.permissions || [])]),
      screen: r.screen || '', request: r.request, query: r.query, response: r.response };
    // The router and its prefix, for tools that rebuild the full path (not part of the exported documentation).
    Object.defineProperties(entry, { router: { value: router }, prefix: { value: prefix } });
    ROUTES.push(entry);
  };
  return { router, define, prefix };
}
