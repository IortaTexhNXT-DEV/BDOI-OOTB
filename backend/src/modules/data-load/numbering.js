/**
 * New business numbers versus migrated numbers. Migrated records keep the number of the old system; new records take
 * the next number of their Document Numbering series. A migrated number that has the format of a series in the current
 * period (e.g. POL-2026-00042 for the policy series POL-{YYYY}-{SEQ}) at or above the series' next number would be
 * issued again to a new record, so both kits refuse it: the configuration workbook when the next number is set too
 * low, the migration workbook when a legacy number falls in the range still to be issued.
 */
import { query } from '../../db/pool.js';

/** Series whose numbers are kept by migrated records: series code -> table and column. */
export const MIGRATED_NUMBER_TARGETS = {
  client: { table: 'clients', column: 'client_code', label: 'Client code' },
  policy: { table: 'policies', column: 'policy_number', label: 'Policy number' },
  invoice: { table: 'receivables', column: 'bill_number', label: 'Bill number' },
  claim: { table: 'claims', column: 'claim_number', label: 'Claim number' },
};

const reEscape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Shape of the numbers a series issues in the current period: { head, tail, next, regex } where a number is
 * head + digits + tail. next: the next sequence number to be issued.
 */
export async function seriesShape(code) {
  const r = (await query(`SELECT d.pattern, d.prefix, d.seq_width, d.start_number, q.value AS current,
      format_document_number(d.pattern, d.prefix, d.seq_width, 0, numbering_business_date(), NULL, NULL) AS f0,
      format_document_number(d.pattern, d.prefix, d.seq_width, 1, numbering_business_date(), NULL, NULL) AS f1
    FROM document_numbering d
    LEFT JOIN sequences q ON q.name = d.code AND q.period = numbering_period_key(d.reset_rule, numbering_business_date())
    WHERE d.code = $1`, [code])).rows[0];
  if (!r) return null;
  const { f0, f1 } = r;
  let last = -1;
  for (let i = 0; i < f0.length; i += 1) if (f0[i] !== f1[i]) last = i;
  if (last < 0) return null;
  const head = f0.slice(0, last - Number(r.seq_width) + 1);
  const tail = f0.slice(last + 1);
  const next = r.current === null || r.current === undefined ? Number(r.start_number) : Number(r.current) + 1;
  return { head, tail, next, regex: new RegExp(`^${reEscape(head)}(\\d+)${reEscape(tail)}$`) };
}

/** Sequence number of `number` in the series shape, or null when it does not have the series format. */
export function sequenceOf(shape, number) {
  const m = shape?.regex.exec(String(number || ''));
  return m ? Number(m[1]) : null;
}

/** The highest number of the target table in the series format at or above `next`, or null. */
export async function collidingNumber(code, next) {
  const target = MIGRATED_NUMBER_TARGETS[code];
  const shape = await seriesShape(code);
  if (!target || !shape) return null;
  const pattern = `^${reEscape(shape.head)}[0-9]+${reEscape(shape.tail)}$`;
  const r = (await query(`SELECT ${target.column} AS n FROM ${target.table} WHERE ${target.column} ~ $1
      AND substr(${target.column}, $2::int + 1, length(${target.column}) - $2::int - $3::int)::bigint >= $4
    ORDER BY substr(${target.column}, $2::int + 1, length(${target.column}) - $2::int - $3::int)::bigint DESC LIMIT 1`,
  [pattern, shape.head.length, shape.tail.length, next])).rows[0];
  return r ? r.n : null;
}
