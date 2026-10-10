/**
 * Hypercare tab of Data Migration & Go-Live: the figures of the weeks after the go-live lock (migration.hypercare_days,
 * default 28). Before the lock it answers { started: false }. Business issued in BrokerVerse and migrated business are
 * told apart by origin (lib/origin.js); "since go-live" means on or after the cutover date.
 *   issued            policies issued in BrokerVerse (count, gross premium), endorsements, receipts and claims registered
 *   migratedItems     open items migrated at go-live: count, opening balance, collected since (receipt applications not
 *                     reversed), share collected, open balance now by ageing bucket
 *   renewals          migrated policies expiring in the next 60 days and those already renewed
 *   migratedPolicies  endorsements and claims registered on migrated policies, cancellations of migrated policies with
 *                     the premium they returned
 *   edits             changes to migrated clients, policies, claims, open items and journals since the lock (audit
 *                     entries other than the migration's own), per entity and day
 *   checks            today: trial balance balanced, sub-ledgers against their control accounts, yesterday's SAP GL
 *                     file, numbering above the legacy numbers, lock on
 *   lock              imports refused while locked; unlocks with their scope and when they relocked
 *   defects           defects of the production run still open, by severity
 */
import { many, one, pool } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { round2 } from '../../lib/money.js';
import { addDays, today } from '../../lib/dates.js';
import { lockState } from '../../lib/goLiveLock.js';
import { AUTO_CHECKS as PERIOD_CHECKS } from '../period-end/checks.js';
import { tieOutCheck } from '../period-end/tieout.js';
import { AUTO_CHECKS as GO_LIVE_CHECKS } from './decisions.js';
import { isDate } from './common.js';

const n2 = (v) => round2(Number(v || 0));
/** Audit entities of the records that carry an origin, and their tables. */
const ORIGIN_ENTITIES = { client: 'clients', policy: 'policies', claim: 'claims', receivable: 'receivables', journal_voucher: 'journal_vouchers' };
const DAY_MS = 86400000;

export async function hypercare() {
  const state = await lockState(pool);
  const days = Math.max(1, Number(await getSetting('migration.hypercare_days', 28)) || 28);
  const cutoverSetting = String((await getSetting('golive.cutover_date', '')) || '').trim();
  if (!state.locked || !state.lockedAt) return { started: false, hypercareDays: days, cutoverDate: isDate(cutoverSetting) ? cutoverSetting : null };
  const day = await today();
  const cutover = isDate(cutoverSetting) ? cutoverSetting : new Date(state.lockedAt).toISOString().slice(0, 10);
  const lockedAt = new Date(state.lockedAt);
  const since = Math.floor((Date.now() - lockedAt.getTime()) / DAY_MS);

  const policies = await one(`SELECT count(*)::int AS n, COALESCE(sum(premium_total), 0) AS premium FROM policies
    WHERE origin = 'issued' AND COALESCE(issued_date, created_at::date) >= $1`, [cutover]);
  const endorsements = await one(`SELECT count(*) FILTER (WHERE p.origin = 'issued')::int AS issued, count(*) FILTER (WHERE p.origin = 'migrated')::int AS migrated,
      count(*) FILTER (WHERE p.origin = 'migrated' AND e.is_cancel)::int AS cancellations,
      COALESCE(sum(e.premium_delta) FILTER (WHERE p.origin = 'migrated' AND e.is_cancel), 0) AS cancelled_premium
    FROM endorsements e JOIN policies p ON p.id = e.policy_id WHERE e.created_at::date >= $1 AND COALESCE(e.status, '') <> 'cancelled'`, [cutover]);
  const receipts = await one(`SELECT count(*)::int AS n, COALESCE(sum(amount), 0) AS amount FROM receipts
    WHERE received_date >= $1 AND status <> 'cancelled' AND COALESCE(receipt_status, '') <> 'Cancelled'`, [cutover]);
  const claims = await one(`SELECT count(*) FILTER (WHERE COALESCE(p.origin, 'issued') = 'issued')::int AS issued, count(*) FILTER (WHERE p.origin = 'migrated')::int AS on_migrated
    FROM claims c LEFT JOIN policies p ON p.id = c.policy_id WHERE c.origin = 'issued' AND c.created_at::date >= $1`, [cutover]);

  const items = await one(`SELECT count(*)::int AS n, COALESCE(sum(rv.balance), 0) AS open,
      COALESCE(sum((SELECT COALESCE(sum(a.amount), 0) FROM receipt_applications a WHERE a.receivable_id = rv.id AND a.reversed_at IS NULL)), 0) AS collected,
      count(*) FILTER (WHERE rv.balance <= 0.004)::int AS cleared
    FROM receivables rv WHERE rv.origin = 'migrated'`);
  const buckets = await getSetting('limits.receivable_ageing_buckets', [30, 60, 90, 120]);
  const ageing = await many(`SELECT rpt_age_bucket($1::date - rv.due_date, $2::int[]) AS bucket, count(*)::int AS n, COALESCE(sum(rv.balance), 0) AS balance
    FROM receivables rv WHERE rv.origin = 'migrated' AND rv.balance > 0.004 GROUP BY 1 ORDER BY 1`, [day, Array.isArray(buckets) ? buckets.map(Number) : [30, 60, 90, 120]]);
  const opening = n2(Number(items.open) + Number(items.collected));

  const renewals = await one(`SELECT count(*)::int AS due, count(*) FILTER (WHERE renewed_to IS NOT NULL OR status = 'renewed')::int AS renewed FROM policies
    WHERE origin = 'migrated' AND expiry_date BETWEEN $1::date AND $1::date + 60`, [day]);

  const editRows = [];
  for (const [entity, table] of Object.entries(ORIGIN_ENTITIES)) {
    editRows.push(...await many(`SELECT a.entity, a.at::date AS day, count(*)::int AS n FROM audit_log a
      WHERE a.entity = $1 AND a.at >= $2 AND a.action NOT LIKE 'migrate-%'
        AND EXISTS (SELECT 1 FROM ${table} r WHERE r.id::text = a.entity_id AND r.origin = 'migrated')
      GROUP BY 1, 2 ORDER BY 2, 1`, [entity, lockedAt]));
  }

  const checkPeriod = { period: day.slice(0, 7), start_date: day, end_date: day };
  const tb = await PERIOD_CHECKS.trial_balance(pool, checkPeriod);
  const tieout = await tieOutCheck(pool);
  const sap = await one(`SELECT status, journal_count FROM sap_gl_exports WHERE export_date = $1 AND trigger <> 'opening' ORDER BY id DESC LIMIT 1`, [addDays(day, -1)]);
  const numbering = await GO_LIVE_CHECKS.numbering();

  const refused = await many(`SELECT at, username, entity_id AS import, after_data FROM audit_log WHERE entity = 'go_live_lock' AND action = 'refused-locked' AND at >= $1
    ORDER BY at DESC LIMIT 20`, [lockedAt]);
  const refusedCount = (await one(`SELECT count(*)::int AS n FROM audit_log WHERE entity = 'go_live_lock' AND action = 'refused-locked' AND at >= $1`, [lockedAt])).n;
  const unlocks = await many(`SELECT id, scope, hours, reason, decided_at, expires_at, relocked_at FROM go_live_lock_requests
    WHERE action = 'unlock' AND status = 'approved' ORDER BY id DESC`);
  const production = await one('SELECT id FROM migration_runs WHERE kind = \'production\' AND status <> \'cancelled\' ORDER BY id DESC LIMIT 1');
  const defects = production ? await many(`SELECT severity, count(*)::int AS n FROM migration_run_defects WHERE run_id = $1 AND status IN ('open', 'fixed', 'retest')
    GROUP BY severity ORDER BY severity`, [production.id]) : [];

  return {
    started: true, cutoverDate: cutover, lockedAt: state.lockedAt, daysSinceGoLive: since, hypercareDays: days, ended: since >= days,
    issued: { policies: policies.n, grossPremium: n2(policies.premium), endorsements: endorsements.issued, receipts: receipts.n, receiptAmount: n2(receipts.amount), claims: claims.issued },
    migratedItems: { count: items.n, cleared: items.cleared, openingBalance: opening, collected: n2(items.collected), openBalance: n2(items.open),
      collectedPercent: opening ? round2((Number(items.collected) * 100) / opening) : 0, ageing: ageing.map((a) => ({ bucket: a.bucket, count: a.n, balance: n2(a.balance) })) },
    renewals: { due: renewals.due, renewed: renewals.renewed },
    migratedPolicies: { endorsements: endorsements.migrated, claims: claims.on_migrated, cancellations: endorsements.cancellations, cancelledPremium: n2(endorsements.cancelled_premium) },
    edits: { total: editRows.reduce((s, r) => s + r.n, 0), byEntity: Object.keys(ORIGIN_ENTITIES).map((e) => ({ entity: e, count: editRows.filter((r) => r.entity === e).reduce((s, r) => s + r.n, 0) })),
      byDay: editRows.map((r) => ({ entity: r.entity, day: r.day, count: r.n })) },
    checks: [
      { code: 'trial-balance', label: 'Trial balance balanced', ok: tb.status === 'passed', detail: tb.status === 'passed' ? null : tb.message },
      { code: 'subledger-tieout', label: 'Sub-ledgers agree with their control accounts', ok: tieout.status === 'passed', detail: tieout.status === 'passed' ? null : tieout.message,
        lines: tieout.detail.map((t) => ({ ledger: t.ledger, account: t.glAccount, subledger: t.subledger, gl: t.gl, difference: t.difference })) },
      { code: 'sap-gl-file', label: 'SAP GL file of yesterday', ok: !!sap && ['done', 'empty'].includes(sap.status), detail: sap ? sap.status : 'No run' },
      { code: 'numbering', label: 'Numbering above the legacy numbers', ok: numbering.met, detail: numbering.met ? null : numbering.detail },
      { code: 'lock', label: 'Go-live lock on', ok: state.locked && !state.unlock, detail: state.unlock ? `Unlocked until ${new Date(state.unlock.expiresAt).toISOString()}` : null },
    ],
    lock: { refused: refusedCount, latestRefused: refused.map((r) => ({ at: r.at, username: r.username, import: r.import, detail: r.after_data })),
      unlocks: unlocks.map((u) => ({ id: Number(u.id), scope: u.scope, hours: u.hours, reason: u.reason, approvedAt: u.decided_at, expiresAt: u.expires_at, relockedAt: u.relocked_at })) },
    defects: [1, 2, 3, 4].map((s) => ({ severity: s, open: defects.find((d) => d.severity === s)?.n || 0 })),
  };
}
