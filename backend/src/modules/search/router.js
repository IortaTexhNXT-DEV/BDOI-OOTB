/**
 * Global search (header search box): one query across leads, clients, quotations, policies, claims and endorsements by
 * number, name, e-mail, phone and vehicle plate / chassis. Respects record scoping (a scoped role only finds its own book)
 * and read permissions (a type the user cannot read is skipped). `link` is the front-end route of the detail screen.
 */
import { moduleRouter } from '../../lib/registry.js';
import { isAdmin, requireAuth } from '../../lib/auth.js';
import { badRequest } from '../../lib/errors.js';
import { many } from '../../db/pool.js';
import { scopeOf, scopeSql } from '../../lib/scope.js';
import { quoteStatusOut, policyStatusOut, endorsementStatusOut } from '../documents/statuses.js';

const { router, define } = moduleRouter('Search', '');
const canRead = (user, module) => isAdmin(user) || (user.permissions || []).includes(`read:${module}`);

// $1 = '%q%' pattern, $2 = exact q, $3 = limit; scope parameters follow.
const TYPES = [
  {
    type: 'lead', module: 'leads', alias: 'l',
    sql: (own) => `SELECT l.id, l.lead_number AS number, l.display_name AS name, l.email, l.phone, l.status, l.lob AS extra, l.created_at
      FROM leads l WHERE l.deleted_at IS NULL AND ${own} AND (l.lead_number ILIKE $1 OR l.display_name ILIKE $1 OR l.company_name ILIKE $1 OR l.email ILIKE $1 OR l.phone ILIKE $1)
      ORDER BY (l.lead_number = $2) DESC, l.created_at DESC LIMIT $3`,
    shape: (r) => ({ title: r.name, subtitle: [r.number, r.email || r.phone, r.extra].filter(Boolean).join(' · '), status: r.status, link: `/agent/leaddetail/${r.id}` }),
  },
  {
    type: 'client', module: 'clients', alias: 'c',
    sql: (own) => `SELECT c.id, c.client_code AS number, c.display_name AS name, c.email, c.phone, c.status, c.created_at
      FROM clients c WHERE c.status <> 'deleted' AND ${own} AND (c.client_code ILIKE $1 OR c.display_name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1 OR c.tin ILIKE $1)
      ORDER BY (c.client_code = $2) DESC, c.created_at DESC LIMIT $3`,
    shape: (r) => ({ title: r.name, subtitle: [r.number, r.email || r.phone].filter(Boolean).join(' · '), status: r.status, link: `/agent/clientview/${r.id}` }),
  },
  {
    type: 'quotation', module: 'quotations', alias: 'q',
    sql: (own) => `SELECT q.id, q.quote_number AS number, COALESCE(l.display_name, c.display_name) AS name, q.status, COALESCE(q.product_type, q.lob) AS extra,
        COALESCE(q.vehicle->>'plateNo', q.doc->>'plateNumber') AS plate, q.created_at
      FROM quotes q LEFT JOIN leads l ON l.id = q.lead_id LEFT JOIN clients c ON c.id = q.client_id
      WHERE q.deleted_at IS NULL AND ${own} AND (q.quote_number ILIKE $1 OR l.display_name ILIKE $1 OR c.display_name ILIKE $1 OR l.email ILIKE $1 OR l.phone ILIKE $1
        OR q.vehicle->>'plateNo' ILIKE $1 OR q.vehicle->>'chassisNo' ILIKE $1 OR q.doc->>'plateNumber' ILIKE $1 OR q.doc->>'chassisNumber' ILIKE $1)
      ORDER BY (q.quote_number = $2) DESC, q.created_at DESC LIMIT $3`,
    shape: (r) => ({ title: r.number, subtitle: [r.name, r.extra, r.plate].filter(Boolean).join(' · '), status: quoteStatusOut(r.status), link: `/agent/quotedetailview/${r.id}` }),
  },
  {
    type: 'policy', module: 'policies', alias: 'p',
    sql: (own) => `SELECT p.id, p.policy_number AS number, COALESCE(p.insured_name, c.display_name) AS name, p.status, p.product_type AS extra, p.doc->>'plateNumber' AS plate, p.created_at
      FROM policies p LEFT JOIN clients c ON c.id = p.client_id
      WHERE ${own} AND (p.policy_number ILIKE $1 OR p.bill_number ILIKE $1 OR p.insured_name ILIKE $1 OR c.display_name ILIKE $1 OR c.email ILIKE $1 OR c.phone ILIKE $1
        OR p.doc->>'plateNumber' ILIKE $1 OR p.doc->>'chassisNumber' ILIKE $1 OR p.doc->>'motorNumber' ILIKE $1)
      ORDER BY (p.policy_number = $2) DESC, p.created_at DESC LIMIT $3`,
    shape: (r) => ({ title: r.number, subtitle: [r.name, r.extra, r.plate].filter(Boolean).join(' · '), status: policyStatusOut(r.status), link: `/agent/policydetail/${r.id}` }),
  },
  {
    type: 'claim', module: 'claims', alias: 'cm',
    sql: (own) => `SELECT cm.id, cm.claim_number AS number, c.display_name AS name, cm.status, p.policy_number AS extra, cm.created_at
      FROM claims cm JOIN policies p ON p.id = cm.policy_id LEFT JOIN clients c ON c.id = COALESCE(cm.client_id, p.client_id)
      WHERE ${own} AND (cm.claim_number ILIKE $1 OR cm.insurer_claim_number ILIKE $1 OR p.policy_number ILIKE $1 OR c.display_name ILIKE $1 OR p.doc->>'plateNumber' ILIKE $1)
      ORDER BY (cm.claim_number = $2) DESC, cm.created_at DESC LIMIT $3`,
    shape: (r) => ({ title: r.number, subtitle: [r.name, r.extra].filter(Boolean).join(' · '), status: r.status, link: `/agent/claimdetail/${r.id}` }),
  },
  {
    type: 'endorsement', module: 'endorsements', alias: 'e',
    sql: (own) => `SELECT e.id, e.endorsement_number AS number, c.display_name AS name, e.status, p.policy_number AS extra, e.created_at
      FROM endorsements e JOIN policies p ON p.id = e.policy_id LEFT JOIN clients c ON c.id = COALESCE(e.client_id, p.client_id)
      WHERE ${own} AND (e.endorsement_number ILIKE $1 OR p.policy_number ILIKE $1 OR c.display_name ILIKE $1)
      ORDER BY (e.endorsement_number = $2) DESC, e.created_at DESC LIMIT $3`,
    shape: (r) => ({ title: r.number || 'Endorsement', subtitle: [r.name, r.extra].filter(Boolean).join(' · '), status: endorsementStatusOut(r.status), link: `/agent/endorsementdetailedviewonly/${r.id}` }),
  },
];
const ENTITY = { lead: 'lead', client: 'client', quotation: 'quote', policy: 'policy', claim: 'claim', endorsement: 'endorsement' };

define({
  method: 'GET', path: '/search', summary: 'Global search across leads, clients, quotations, policies, claims and endorsements (number, name, e-mail, phone, plate / chassis); scoped users only find their own book',
  screen: 'Header > Global search', middleware: [requireAuth], query: { q: 'NQQ 2025', limit: 20, types: 'policy,claim' },
  response: { success: true, data: [{ type: 'policy', id: 'pol_1', title: 'POL-2026-00001', subtitle: 'Juan Dela Cruz · Motor · NQQ 2025', status: 'Active', link: '/agent/policydetail/pol_1' }], total: 1, query: 'NQQ 2025' },
  handler: async (req, res) => {
    const q = String(req.query.q ?? req.query.query ?? '').trim();
    if (q.length < 2) throw badRequest('q must be at least 2 characters');
    if (q.length > 100) throw badRequest('q is too long');
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const wanted = req.query.types ? String(req.query.types).split(',').map((t) => t.trim()) : null;
    const scope = await scopeOf(req);
    const pattern = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const lower = q.toLowerCase();
    const results = [];
    for (const t of TYPES) {
      if (wanted && !wanted.includes(t.type)) continue;
      if (!canRead(req.user, t.module)) continue;
      const params = [pattern, q, limit];
      const own = scopeSql(scope, ENTITY[t.type], t.alias, params);
      for (const r of await many(t.sql(own), params)) {
        const exact = String(r.number || '').toLowerCase() === lower ? 0 : String(r.number || r.name || '').toLowerCase().startsWith(lower) ? 1 : 2;
        results.push({ rank: exact, at: r.created_at, item: { type: t.type, id: r.id, number: r.number || null, ...t.shape(r) } });
      }
    }
    results.sort((a, b) => a.rank - b.rank || new Date(b.at) - new Date(a.at));
    const data = results.slice(0, limit).map((r) => r.item);
    res.json({ success: true, data, total: data.length, query: q });
  },
});

export default router;
