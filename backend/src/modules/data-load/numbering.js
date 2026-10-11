/**
 * New business numbers versus migrated numbers. Migrated records keep the number of the old system; new records take
 * the next number of their Document Numbering series. A migrated number that has the format of a series (e.g.
 * POL-2026-00042 for the policy series POL-{YYYY}-{SEQ}) at or above the next number the series will issue in that
 * period would be issued again to a new record, so both kits refuse it: the configuration workbook when the next number
 * is set too low, the migration workbook when a legacy number falls in the range still to be issued.
 *
 * A series issues numbers of several forms over the go-live window: one per period (renewals issued from January of the
 * year after the cutover draw from the next year's counter) and, when the pattern holds {BRANCH} or {LOB}, one per
 * branch and line of business. Every form from the cutover date to the end of the year after it is checked, each with
 * the next number of its own period. COC numbers of migrated CTPL policies are checked against the COC series of their
 * insurer in the same way.
 */
import { many, one, query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';

/** Series whose numbers are kept by migrated records: series code -> table and column. */
export const MIGRATED_NUMBER_TARGETS = {
  client: { table: 'clients', column: 'client_code', label: 'Client code' },
  policy: { table: 'policies', column: 'policy_number', label: 'Policy number' },
  invoice: { table: 'receivables', column: 'bill_number', label: 'Bill number' },
  claim: { table: 'claims', column: 'claim_number', label: 'Claim number' },
};

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Window of dates whose number forms are checked: from the earlier of the business date and the cutover date to the
 * end of the year after the later of them.
 */
async function shapeWindow() {
  const day = (await one('SELECT numbering_business_date()::text AS d')).d;
  const cutover = String((await getSetting('golive.cutover_date', '')) || '').trim();
  const known = /^\d{4}-\d{2}-\d{2}$/.test(cutover) ? cutover : day;
  const from = known < day ? known : day;
  const last = known > day ? known : day;
  return { from, to: `${Number(last.slice(0, 4)) + 1}-12-31` };
}

/**
 * The forms of the numbers a series issues between `from` and `to` (default: the go-live window): [{ head, tail,
 * next, periods, regex }] where a number is head + digits + tail and next is the lowest next sequence number among the
 * periods that issue that form (the period's counter + 1, or where the period's counter starts: the configured next
 * number of the period, else the series' start number). One form per period, branch and line of business when the
 * pattern holds the token ({BRANCH}: every active branch code, {LOB}: every line of business of a product or policy),
 * plus the form without them.
 */
/** The first day of each month from the month of `from` to `to` (YYYY-MM-DD). */
function monthsOf(from, to) {
  const out = [];
  const d = new Date(`${from.slice(0, 7)}-01T00:00:00Z`);
  while (d.toISOString().slice(0, 10) <= to) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

export async function seriesShapes(code, { from = null, to = null } = {}) {
  const window = from && to ? { from, to } : await shapeWindow();
  // the months as a list (not generate_series): the planner then sees a few rows and does not compile the query
  const rows = await many(`WITH s AS (SELECT * FROM document_numbering WHERE code = $1),
      days AS (SELECT unnest($2::date[]) AS day),
      branch_codes AS (SELECT NULL::text AS b UNION SELECT DISTINCT upper(btrim(b.code)) FROM branches b, s
                        WHERE position('{BRANCH}' IN s.pattern) > 0 AND b.status = 'active' AND btrim(COALESCE(b.code, '')) <> ''),
      lines AS (SELECT NULL::text AS l UNION SELECT DISTINCT upper(btrim(x.l)) FROM s,
                  (SELECT line AS l FROM products WHERE status = 'active' UNION SELECT lob FROM policies WHERE lob IS NOT NULL) x
                 WHERE position('{LOB}' IN s.pattern) > 0 AND btrim(COALESCE(x.l, '')) <> '')
    SELECT DISTINCT k.period, s.seq_width, numbering_start_number(s.code, k.period) AS start_number, q.value AS current,
        format_document_number(s.pattern, s.prefix, s.seq_width, 0, d.day, bc.b, ln.l) AS f0,
        format_document_number(s.pattern, s.prefix, s.seq_width, 1, d.day, bc.b, ln.l) AS f1
      FROM s CROSS JOIN days d CROSS JOIN LATERAL (SELECT numbering_period_key(s.reset_rule, d.day) AS period) k
      CROSS JOIN branch_codes bc CROSS JOIN lines ln
      LEFT JOIN sequences q ON q.name = s.code AND q.period = k.period
     ORDER BY k.period`, [code, monthsOf(window.from, window.to)]);
  const shapes = new Map();
  for (const r of rows) {
    const { f0, f1 } = r;
    let last = -1;
    for (let i = 0; i < f0.length; i += 1) if (f0[i] !== f1[i]) last = i;
    if (last < 0) continue;
    const head = f0.slice(0, last - Number(r.seq_width) + 1);
    const tail = f0.slice(last + 1);
    const next = r.current === null || r.current === undefined ? Number(r.start_number) : Number(r.current) + 1;
    const key = `${head}\u0000${tail}`;
    const shape = shapes.get(key);
    if (!shape) shapes.set(key, { head, tail, next, periods: [r.period], regex: new RegExp(`^${reEscape(head)}(\\d+)${reEscape(tail)}$`) });
    else {
      shape.next = Math.min(shape.next, next);
      if (!shape.periods.includes(r.period)) shape.periods.push(r.period);
    }
  }
  return [...shapes.values()];
}

/** Sequence number of `number` in the series shape, or null when it does not have the series format. */
export function sequenceOf(shape, number) {
  const m = shape?.regex.exec(String(number || ''));
  return m ? Number(m[1]) : null;
}

/**
 * The form of a series that would issue `number` again ({ shape, seq }: the number has that form and its sequence is at
 * or above the form's next number), or null. shapes: the series' forms when the caller already has them.
 */
export async function seriesClash(code, number, shapes = null) {
  for (const shape of shapes || await seriesShapes(code)) {
    const seq = sequenceOf(shape, number);
    if (seq !== null && seq >= shape.next) return { shape, seq };
  }
  return null;
}

/**
 * Records of the target table whose number a series would issue again: [{ number, next, periods }] over every form of
 * the series, highest sequence first within a form (at most `limit` in all).
 */
export async function collidingNumbers(code, { limit = 200 } = {}) {
  const target = MIGRATED_NUMBER_TARGETS[code];
  if (!target) return [];
  const out = [];
  for (const shape of await seriesShapes(code)) {
    if (out.length >= limit) break;
    const pattern = `^${reEscape(shape.head)}[0-9]+${reEscape(shape.tail)}$`;
    const seq = `substr(${target.column}, $2::int + 1, length(${target.column}) - $2::int - $3::int)::bigint`;
    const rows = await many(`SELECT ${target.column} AS n FROM ${target.table} WHERE ${target.column} ~ $1 AND ${seq} >= $4 ORDER BY ${seq} DESC LIMIT $5`,
      [pattern, shape.head.length, shape.tail.length, shape.next, limit - out.length]);
    for (const r of rows) out.push({ number: r.n, next: shape.next, periods: shape.periods });
  }
  return out;
}

/** The highest number of the target table that a series would issue again (first form that has one), or null. */
export async function collidingNumber(code) {
  return (await collidingNumbers(code, { limit: 1 }))[0]?.number ?? null;
}

// ------------------------------------------------------------------ COC numbers

/** COC number of a series: its prefix and the number padded to the series width (integrations/ctpl.js allocateCoc). */
const COC_IN_SERIES = `s.insurance_company_id = m.insurance_company_id AND m.coc LIKE COALESCE(s.prefix, '') || '%'
  AND substr(m.coc, length(COALESCE(s.prefix, '')) + 1) ~ '^[0-9]+$'
  AND substr(m.coc, length(COALESCE(s.prefix, '')) + 1)::numeric BETWEEN s.series_from AND s.series_to
  AND substr(m.coc, length(COALESCE(s.prefix, '')) + 1)::numeric >= s.next_number`;

/** COC series of `insurerId` that would issue `number` again: { seriesId, next } or null. */
export async function cocClash(insurerId, number) {
  if (!insurerId || !number) return null;
  const r = await one(`SELECT s.id, s.next_number FROM coc_series s, (SELECT $1::int AS insurance_company_id, $2::text AS coc) m WHERE ${COC_IN_SERIES}
    ORDER BY s.series_from LIMIT 1`, [insurerId, String(number).trim()]);
  return r ? { seriesId: r.id, next: Number(r.next_number) } : null;
}

/**
 * Migrated COC numbers (certificate of a migrated CTPL policy, CTPL authentication of a migration load) that a COC
 * series of the same insurer would issue again: [{ number, policyNumber, seriesId, next }].
 */
export async function cocCollisions({ limit = 200 } = {}) {
  const rows = (await query(`WITH m AS (
        SELECT p.insurance_company_id, btrim(p.doc->>'certNumber') AS coc, p.policy_number FROM policies p
         WHERE p.origin = 'migrated' AND btrim(COALESCE(p.doc->>'certNumber', '')) <> ''
        UNION SELECT a.insurance_company_id, btrim(a.coc_number), a.policy_number FROM ctpl_authentications a
         WHERE a.load_batch_id IS NOT NULL AND btrim(COALESCE(a.coc_number, '')) <> '')
    SELECT DISTINCT m.coc, m.policy_number, s.id AS series_id, s.next_number FROM m JOIN coc_series s ON ${COC_IN_SERIES}
     ORDER BY m.coc LIMIT $1`, [limit])).rows;
  return rows.map((r) => ({ number: r.coc, policyNumber: r.policy_number, seriesId: r.series_id, next: Number(r.next_number) }));
}
