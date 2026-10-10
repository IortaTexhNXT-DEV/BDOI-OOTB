/**
 * Who may decide a remittance approval, and why not (Accounts > Remittance > Approvals, the remittance record).
 *
 * decisionFor() applies the rules decide() enforces, in the order a person meets them, and answers with a code and the
 * sentence the screens show (blockedCode / blockedReason), so a blocked decision is explained before anyone clicks:
 * the approval is still pending, the user holds approve:remittance, did not submit or prepare it, did not approve an
 * earlier level, is not bypassed by a legacy per-item delegation, has an Authority Matrix limit when
 * remittance.require_authority_limit asks for one, and (to approve) a remittance unchanged since its submission and a
 * limit that covers its amount as it is now (not as it was submitted). These are the
 * rules of the remittance source of My Work (my-work/sources.js: notMine, not approved by me, withinAuthority).
 *
 * eligibleApprovers() names the people who can decide an amount: active users holding approve:remittance whose
 * limit (own, role or through a dated delegation, effectiveAuthority) covers it. Delegates covering an approver are
 * in the list with the name of the person they cover.
 */
import { ADMIN_ROLES, hasPermission, isAdmin } from '../../lib/auth.js';
import { pool } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { today as businessToday } from '../../lib/dates.js';
import { formatAmount, printFormat } from '../../lib/pdf/index.js';
import { instant } from '../../lib/auditEvents.js';
import { effectiveAuthority } from '../access-control/service.js';

/**
 * Authority Matrix transaction type of a remittance approval (Master > User Management > Authority Matrix):
 * remittances and agency bills are 'remittance'; settlements, adjustments and electronic transfers 'remittance_settlement'.
 */
export const authorityTypeOf = (entity) => (entity === 'remittance' ? 'remittance' : 'remittance_settlement');

/** The sentences of the blocked codes (shared contract of the decision screens). */
export const BLOCKED = {
  MAKER: () => 'You prepared this. Another user must approve it.',
  SUBMITTER: () => 'You submitted this remittance. Another user with remittance authority must approve it.',
  EARLIER_LEVEL: ({ level }) => `You approved level ${level}. Level ${level + 1} needs a different approver.`,
  ABOVE_LIMIT: ({ amount, limit }) => `${amount} is above your approval limit of ${limit}.`,
  NO_AUTHORITY: ({ type }) => `You have no approval limit for ${type}. Ask an administrator to set one in the Authority Matrix.`,
  NO_PERMISSION: () => 'You can view approvals but not decide them.',
  TRANSFERS_OFF: () => 'Electronic transfers are replaced by Insurer payments.',
  CONTENT_CHANGED: () => 'This remittance changed after it was submitted. Reject it so the preparer can submit it again.',
  DELEGATED_AWAY: ({ name }) => `Delegated to ${name}.`,
  ALREADY_DECIDED: ({ decision, name, when }) => `${decision} by ${name} ${when}.`,
};

/**
 * Settings and lookups of one request, read once: the business date, the date and money format, the authority rules,
 * the user's own authority per type and the approver lists per type. `now` is for tests.
 */
export async function decisionContext(user, { db = pool, now = new Date() } = {}) {
  return {
    user, db, now, onDate: await businessToday(now), fmt: await printFormat(),
    requireLimit: !!(await getSetting('remittance.require_authority_limit')),
    enforced: (await getSetting('access.authority_enforced', true)) !== false,
    refuseWithoutLimit: String(await getSetting('access.authority_without_limit', 'allow')) === 'refuse',
    transfersEnabled: (await getSetting('remittance.transfers_enabled')) !== false,
    mine: new Map(), pools: new Map(), typeNames: null, roleNames: null,
  };
}

async function typeName(ctx, type) {
  if (!ctx.typeNames) {
    const { rows } = await ctx.db.query('SELECT code, name FROM authority_transaction_types');
    ctx.typeNames = Object.fromEntries(rows.map((r) => [r.code, r.name]));
  }
  return ctx.typeNames[type] || type;
}

/** Role names by code (limit sources name the role by its code). */
export async function roleNames(ctx) {
  if (!ctx.roleNames) {
    const { rows } = await ctx.db.query('SELECT code, name FROM roles');
    ctx.roleNames = Object.fromEntries(rows.map((r) => [r.code, r.name]));
  }
  return ctx.roleNames;
}

/**
 * The limit source of effectiveAuthority as people read it: "User limit", "Role limit: Accounting",
 * "Delegation from A. Santos (Role limit: Accounting)". null when there is no source.
 */
export function limitSourceLabel(source, names = {}) {
  if (!source) return null;
  const delegated = /^delegated by (.+) \((.+)\)$/.exec(source);
  if (delegated) return `Delegation from ${delegated[1]} (${limitSourceLabel(delegated[2], names)})`;
  if (source === 'user limit') return 'User limit';
  const role = /^role (.+)$/.exec(source);
  return role ? `Role limit: ${names[role[1]] || role[1]}` : source;
}

/** "PHP 1,000,000.00": the code of the configured currency and its decimals, as the remittance screens write amounts. */
export const codeMoney = (v, fmt) => `${String(fmt?.currency || 'PHP').toUpperCase()} ${formatAmount(v, fmt?.decimals ?? 2)}`;
export const amountText = (ctx, v) => codeMoney(v, ctx.fmt);

/** "at 10:32" for an instant of today (business time zone), else "on 12/10/2026 10:32". */
export function whenText(ctx, at) {
  const i = at ? instant(at, ctx.fmt) : null;
  if (!i) return '';
  return i.day === ctx.onDate ? `at ${i.time}` : `on ${i.text}`;
}

/** "10:32" for an instant of today (business time zone), else "12/10/2026 10:32". */
export function clockText(ctx, at) {
  const i = at ? instant(at, ctx.fmt) : null;
  if (!i) return '';
  return i.day === ctx.onDate ? i.time : i.text;
}

/** The user's own authority of an Authority Matrix type on the business date (effectiveAuthority, read once per request). */
export async function myAuthority(ctx, type) {
  if (!ctx.mine.has(type)) ctx.mine.set(type, await effectiveAuthority(ctx.db, ctx.user.id, type, ctx.onDate));
  return ctx.mine.get(type);
}

/** True when a user without an Authority Matrix limit is refused (remittance.require_authority_limit, or the access rule). */
export const limitRequired = (ctx) => ctx.requireLimit || (ctx.enforced && ctx.refuseWithoutLimit);

/** The level an earlier approval of the user was given at; null when the user approved no level. */
const myEarlierLevel = (a, userId) => (a.history || []).find((h) => h.action === 'Approved' && h.by === userId)?.level ?? null;

/**
 * Can `user` decide approval `a` (a remittance_approvals row; `maker_id` the remittance's creator when it is one)?
 * Returns { canDecide, blockedCode, blockedReason, level: { current, required }, amount, myLimit (null: none or no
 * limit), unlimited, limitSource, limitSourceLabel }. `action` 'reject' is not bound by the amount (a rejection never
 * exceeds an authority).
 */
export async function decisionFor(a, user, ctx = null, { action = 'approve' } = {}) {
  ctx = ctx || await decisionContext(user);
  const type = authorityTypeOf(a.entity);
  // a remittance is approved at its amount now: anything that moved it after the submission is caught below
  const current = a.entity === 'remittance' && a.status === 'Pending' && a.record_amount !== null && a.record_amount !== undefined ? Number(a.record_amount) : Number(a.amount);
  const base = { canDecide: false, blockedCode: null, blockedReason: null, level: { current: a.current_level, required: a.required_levels },
    amount: current, myLimit: null, unlimited: false, limitSource: null, limitSourceLabel: null };
  const blocked = (code, vars = {}, extra = {}) => ({ ...base, ...extra, blockedCode: code, blockedReason: BLOCKED[code](vars) });
  if (a.status !== 'Pending') {
    return blocked('ALREADY_DECIDED', { decision: a.status, name: a.action_by_name || 'another user', when: whenText(ctx, a.action_at) });
  }
  if (!hasPermission(user, 'approve:remittance')) return blocked('NO_PERMISSION');
  if (a.initiator_id === user.id) return blocked(a.entity === 'remittance' ? 'SUBMITTER' : 'MAKER');
  if (a.maker_id && a.maker_id === user.id) return blocked('MAKER');
  const earlier = myEarlierLevel(a, user.id);
  if (earlier !== null) return blocked('EARLIER_LEVEL', { level: Number(earlier) });
  if (a.delegated_to && a.delegated_to !== user.id && !isAdmin(user)) return blocked('DELEGATED_AWAY', { name: a.delegated_to_name || 'another user' });
  if (action === 'approve' && a.item_kind === 'transfer' && ctx.transfersEnabled === false) return blocked('TRANSFERS_OFF');
  if (action === 'approve' && a.entity === 'remittance' && a.entity_version !== null && a.entity_version !== undefined
    && a.record_version !== null && a.record_version !== undefined && Number(a.record_version) !== Number(a.entity_version)) return blocked('CONTENT_CHANGED');
  const auth = await myAuthority(ctx, type);
  const limits = { myLimit: auth.found && !auth.unlimited ? auth.limit : null, unlimited: !!auth.unlimited, limitSource: auth.source,
    limitSourceLabel: limitSourceLabel(auth.source, await roleNames(ctx)) };
  if (!auth.found && limitRequired(ctx)) return blocked('NO_AUTHORITY', { type: await typeName(ctx, type) }, limits);
  if (action === 'approve' && ctx.enforced && auth.found && !auth.unlimited && base.amount > auth.limit) {
    return blocked('ABOVE_LIMIT', { amount: amountText(ctx, base.amount), limit: amountText(ctx, auth.limit) }, limits);
  }
  return { ...base, ...limits, canDecide: true };
}

/**
 * Everyone who could decide an approval of the type, with their authority: active users holding approve:remittance
 * (through a role, or an administrator role) and a limit, or no limit where the rules allow one.
 */
async function approverPool(ctx, type) {
  if (ctx.pools.has(type)) return ctx.pools.get(type);
  const { rows } = await ctx.db.query(`SELECT u.id, COALESCE(u.display_name, u.username) AS name,
      (SELECT r.name FROM user_effective_roles(u.id) er JOIN roles r ON r.id = er.role_id
        WHERE r.code = ANY($1) OR EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                                          WHERE rp.role_id = r.id AND p.code = 'approve:remittance')
        ORDER BY r.name LIMIT 1) AS role
    FROM users u WHERE u.status = 'active' ORDER BY lower(COALESCE(u.display_name, u.username))`, [ADMIN_ROLES]);
  const names = await roleNames(ctx);
  const out = [];
  for (const u of rows.filter((x) => x.role)) {
    const a = await effectiveAuthority(ctx.db, u.id, type, ctx.onDate);
    if (!a.found && limitRequired(ctx)) continue;
    const covering = a.source ? /^delegated by (.+) \(/.exec(a.source)?.[1] || null : null;
    out.push({ id: u.id, name: u.name, role: u.role, limit: a.found && !a.unlimited ? a.limit : null, unlimited: !a.found || !!a.unlimited || !ctx.enforced,
      limitSource: a.source, limitSourceLabel: limitSourceLabel(a.source, names), coveringFor: covering });
  }
  ctx.pools.set(type, out);
  return out;
}

/**
 * The people who can decide `amount` of an Authority Matrix type, leaving out `initiatorIds` (the submitter, the
 * maker, earlier-level approvers): [{ id, name, role, limit (null: no limit), limitSource, limitSourceLabel,
 * coveringFor }].
 */
export async function eligibleApprovers(amount, initiatorIds = [], type = 'remittance', ctx = null) {
  ctx = ctx || await decisionContext({ id: null });
  const skip = new Set((initiatorIds || []).filter(Boolean));
  return (await approverPool(ctx, type)).filter((u) => !skip.has(u.id) && (u.unlimited || Number(amount) <= u.limit))
    .map(({ unlimited: _u, ...u }) => u);
}

/** The users that must not decide an approval: its initiator, the remittance's maker and earlier-level approvers. */
export const excludedFor = (a) => [a.initiator_id, a.maker_id, ...(a.history || []).filter((h) => h.action === 'Approved').map((h) => h.by)];

/** The approvers who can decide the pending approval `a` now (the delegate alone for a legacy per-item delegation). */
export async function approversFor(a, ctx) {
  const amount = a.entity === 'remittance' && a.record_amount !== null && a.record_amount !== undefined ? a.record_amount : a.amount;
  const list = await eligibleApprovers(amount, excludedFor(a), authorityTypeOf(a.entity), ctx);
  return a.delegated_to ? list.filter((u) => u.id === a.delegated_to) : list;
}

/** The decision block of a record or row: decisionFor() and, while pending, the eligible approvers. */
export async function decisionBlock(a, user, ctx) {
  const d = await decisionFor(a, user, ctx);
  const eligible = a.status === 'Pending' ? await approversFor(a, ctx) : [];
  return { ...d, eligibleApprovers: eligible.map((u) => ({ id: u.id, name: u.name, role: u.role, limit: u.limit, limitSourceLabel: u.limitSourceLabel, coveringFor: u.coveringFor })) };
}

/**
 * The next step of a pending approval: who it waits on ("Awaiting remittance approver: J. Cruz, A. Tan", or "No
 * eligible approver") and when it is due (submission + SLA hours). null once decided. `compact` (a register row):
 * "Awaiting J. Cruz" for one approver, "Awaiting remittance approver (2)" for several.
 */
export function nextStepFor(a, eligible, { compact = false } = {}) {
  if (a.status !== 'Pending') return null;
  const dueAt = new Date(new Date(a.created_at).getTime() + Number(a.sla_hours || 0) * 3600000).toISOString();
  if (!eligible.length) return { code: 'approve', label: 'No eligible approver', actor: null, dueAt };
  const names = eligible.map((u) => u.name).join(', ');
  const several = compact && eligible.length > 1 && !a.delegated_to;
  return { code: 'approve', label: a.delegated_to || (compact && !several) ? `Awaiting ${names}` : several ? `Awaiting remittance approver (${eligible.length})` : `Awaiting remittance approver: ${names}`,
    actor: eligible.length === 1 ? { type: 'user', id: eligible[0].id, name: eligible[0].name } : { type: 'users', ids: eligible.map((u) => u.id), name: names }, dueAt };
}
