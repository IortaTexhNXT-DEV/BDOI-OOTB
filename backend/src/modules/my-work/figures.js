/**
 * Home figures of My Work (GET /my-work/figures): the role preset of the signed-in user, their role, branch and
 * company for the page subtitle, and two or three figures of the role's work next to the My Work header figures.
 *
 * The preset is the first of PRESETS the user holds (a user with several roles lands on the most specific one); the
 * screen chooses from the same code which categories come first, the default scope and the primary action. Each
 * figure is one query over the user's own book for Sales, over the whole book (within the user's record scope,
 * lib/scope.js) for the other roles.
 */
import { pool } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { scopeSql } from '../../lib/scope.js';
import { today as businessToday } from '../../lib/dates.js';

/** Presets in order of precedence. */
export const PRESETS = ['system-admin', 'accounting-manager', 'accounting', 'claims', 'processing', 'operations', 'sales'];

/** The preset of a user: the first preset role they hold, else "general" (the plain My Work). */
export const presetOf = (user) => PRESETS.find((p) => (user?.roles || []).includes(p)) || 'general';

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

/** Query helpers bound to one request: the business date, the time zone and the record scope. */
async function context(user, { recordScope, db }) {
  const today = await businessToday();
  const tz = String(await getSetting('general.timezone', 'Asia/Manila'));
  const ownBook = { userId: user.id, ids: [user.id, user.username].filter(Boolean) };
  const figure = async (sql, params = []) => {
    const { rows } = await db.query(sql, params);
    return rows[0] || {};
  };
  return { today, tz, recordScope, ownBook, figure };
}

const FIGURES = {
  async sales(c) {
    const own = (entity, alias, params) => scopeSql(c.ownBook, entity, alias, params);
    const qp = [c.today, c.tz];
    const quotes = await c.figure(`SELECT count(*)::int AS n FROM quotes q WHERE q.deleted_at IS NULL AND ${own('quote', 'q', qp)}
      AND (q.created_at AT TIME ZONE $2)::date >= date_trunc('month', $1::date)::date`, qp);
    const cp = [c.today];
    const conv = await c.figure(`SELECT count(*)::int AS total, count(*) FILTER (WHERE q.status = 'converted')::int AS won
      FROM quotes q WHERE q.deleted_at IS NULL AND ${own('quote', 'q', cp)} AND q.created_at >= $1::date - 90`, cp);
    const rp = [c.today];
    const renewals = await c.figure(`SELECT count(*)::int AS n FROM policies p WHERE ${own('policy', 'p', rp)} AND p.status IN ('active', 'issued') AND p.renewed_to IS NULL
      AND p.expiry_date BETWEEN $1::date AND $1::date + 30`, rp);
    return [
      { key: 'quotesMonth', label: 'Quotes this month', value: num(quotes.n), format: 'count' },
      { key: 'conversion', label: 'Conversion (90 days)', value: conv.total ? Math.round((num(conv.won) * 100) / num(conv.total)) : 0, format: 'percent' },
      { key: 'renewals30', label: 'Renewals due in 30 days', value: num(renewals.n), format: 'count' },
    ];
  },
  async processing(c) {
    const p = [c.today, c.tz];
    const policy = scopeSql(c.recordScope, 'policy', 'p', p);
    const issued = await c.figure(`SELECT count(*)::int AS n FROM policies p WHERE ${policy} AND p.status IN ('active', 'issued')
      AND COALESCE(p.issued_date, (p.created_at AT TIME ZONE $2)::date) >= date_trunc('month', $1::date)::date`, p);
    const pending = await c.figure(`SELECT (SELECT count(*)::int FROM placements pl WHERE pl.status = 'bound')
      + (SELECT count(*)::int FROM quotes q WHERE q.deleted_at IS NULL AND q.status = 'approved') AS n`);
    const rfq = await c.figure("SELECT count(*)::int AS n FROM broker_slips b WHERE b.status = 'submitted'");
    return [
      { key: 'issuedMonth', label: 'Policies issued this month', value: num(issued.n), format: 'count' },
      { key: 'pendingIssuance', label: 'Pending issuance', value: num(pending.n), format: 'count' },
      { key: 'rfqOpen', label: 'RFQs with the insurers', value: num(rfq.n), format: 'count' },
    ];
  },
  async operations(c) {
    const p = [c.today];
    const policy = scopeSql(c.recordScope, 'policy', 'p', p);
    const endorsements = await c.figure("SELECT count(*)::int AS n FROM endorsements e WHERE e.status IN ('draft', 'submitted', 'cancel-initiated', 'approved')");
    const renewals = await c.figure(`SELECT count(*)::int AS n FROM policies p WHERE ${policy} AND p.status IN ('active', 'issued') AND p.renewed_to IS NULL
      AND p.expiry_date BETWEEN $1::date AND $1::date + 30`, p);
    return [
      { key: 'endorsementsOpen', label: 'Endorsements in progress', value: num(endorsements.n), format: 'count' },
      { key: 'renewals30', label: 'Renewals due in 30 days', value: num(renewals.n), format: 'count' },
    ];
  },
  async claims(c) {
    const p = [c.today];
    const claim = scopeSql(c.recordScope, 'claim', 'cl', p);
    const open = await c.figure(`SELECT count(*)::int AS n, COALESCE(avg($1::date - cl.reported_date), 0) AS days FROM claims cl
      WHERE ${claim} AND cl.status IN ('registered', 'in-review', 'approved', 'pending-approval')`, p);
    const month = await c.figure(`SELECT count(*)::int AS n FROM claims cl WHERE ${claim} AND cl.reported_date >= date_trunc('month', $1::date)::date`, p);
    return [
      { key: 'claimsOpen', label: 'Open claims', value: num(open.n), format: 'count' },
      { key: 'daysOpen', label: 'Average days open', value: Math.round(num(open.days)), format: 'days' },
      { key: 'claimsMonth', label: 'Registered this month', value: num(month.n), format: 'count' },
    ];
  },
  async accounting(c) {
    const overdue = await c.figure("SELECT COALESCE(sum(rv.balance), 0) AS amount FROM receivables rv WHERE rv.status IN ('open', 'partial') AND rv.due_date < $1::date", [c.today]);
    const collected = await c.figure("SELECT COALESCE(sum(r.amount), 0) AS amount FROM receipts r WHERE r.status = 'posted' AND r.received_date >= date_trunc('month', $1::date)::date", [c.today]);
    return [
      { key: 'overdueReceivables', label: 'Overdue receivables', value: num(overdue.amount), format: 'amount' },
      { key: 'collectedMonth', label: 'Collections this month', value: num(collected.amount), format: 'amount' },
    ];
  },
  async 'accounting-manager'(c) {
    const vouchers = await c.figure(`SELECT (SELECT count(*)::int FROM journal_vouchers j WHERE j.status = 'for-approval')
      + (SELECT count(*)::int FROM disbursements d WHERE d.status = 'for-approval') AS n`);
    return [...(await FIGURES.accounting(c)), { key: 'vouchersForApproval', label: 'Vouchers awaiting approval', value: num(vouchers.n), format: 'count' }];
  },
  async 'system-admin'(c) {
    const users = await c.figure("SELECT count(*)::int AS active, count(*) FILTER (WHERE last_login_at IS NULL AND COALESCE(created_by, '') <> 'seed')::int AS waiting FROM users WHERE status = 'active'");
    const jobs = await c.figure("SELECT count(*)::int AS n FROM job_runs WHERE status = 'failed' AND started_at >= now() - interval '24 hours'");
    return [
      { key: 'activeUsers', label: 'Active users', value: num(users.active), format: 'count' },
      { key: 'failedJobs24h', label: 'Failed jobs (24 h)', value: num(jobs.n), format: 'count' },
      { key: 'awaitingSignIn', label: 'Awaiting first sign-in', value: num(users.waiting), format: 'count' },
    ];
  },
};

/** GET /my-work/figures: preset, role, branch, company and the role figures of the signed-in user. */
export async function figures(user, { recordScope = null, db = pool } = {}) {
  const c = await context(user, { recordScope, db });
  const preset = presetOf(user);
  const me = (await db.query('SELECT first_name, display_name, branch_code FROM users WHERE id = $1', [user.id])).rows[0] || {};
  const roleCode = preset === 'general' ? (user.roles || [])[0] || null : preset;
  const role = roleCode ? (await db.query('SELECT name FROM roles WHERE code = $1', [roleCode])).rows[0] : null;
  const branch = me.branch_code ? (await db.query('SELECT name FROM branches WHERE code = $1', [me.branch_code])).rows[0] : null;
  return {
    asOf: c.today, preset, roleCode, roleName: role?.name || roleCode, firstName: me.first_name || String(me.display_name || user.username || '').split(' ')[0],
    branch: branch?.name || me.branch_code || null, company: (await getSetting('general.company_name', null)) || null,
    figures: FIGURES[preset] ? await FIGURES[preset](c) : [],
  };
}
