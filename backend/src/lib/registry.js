/**
 * Route registry: every endpoint is declared through define() so the API list, the OpenAPI document,
 * the Postman collection and the Excel touchpoint list are generated from the same source of truth.
 */
import { Router } from 'express';
import { wrap } from './respond.js';

export const ROUTES = [];

/**
 * Create a router for a module. Each route: { method, path, summary, auth (default true), roles, permissions,
 * screen (front-end touchpoint), request (example body), query (example), response (example), middleware, handler }.
 */
export function moduleRouter(module, prefix = '') {
  const router = Router();
  const define = (r) => {
    const method = r.method.toLowerCase();
    const mws = [...(r.middleware || [])];
    router[method](r.path, ...mws, wrap(r.handler));
    ROUTES.push({ module, method: r.method.toUpperCase(), path: prefix + r.path, summary: r.summary || '',
      auth: r.auth !== false, roles: r.roles || [], permissions: r.permissions || [], screen: r.screen || '',
      request: r.request, query: r.query, response: r.response });
  };
  return { router, define, prefix };
}
