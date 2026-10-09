/**
 * Cost centres (generic master cost-centre, Master > Finance > Cost Centres; migration 0346). Every journal line carries
 * one: the line's own, else the journal's, else the company's default cost centre (the active one marked Default; the
 * letterhead company's when several companies have one). A cost centre is usable on a date when it is active and the
 * date falls in its validity (Valid From / Valid To, either may be empty).
 */
import { badRequest } from '../../../lib/errors.js';

const ACTIVE = 'type_code = \'cost-centre\' AND status = \'active\'';
const VALID_ON = '(COALESCE(data->>\'validFrom\', \'\') = \'\' OR (data->>\'validFrom\')::date <= $1::date) AND (COALESCE(data->>\'validTo\', \'\') = \'\' OR (data->>\'validTo\')::date >= $1::date)';
const IS_DEFAULT = 'lower(COALESCE(data->>\'isDefault\', \'false\')) IN (\'true\', \'yes\', \'1\')';

/** Code of the default cost centre on a date (null when none is set). */
export async function defaultCostCentre(db, date) {
  const r = (await db.query(`SELECT code FROM master_records WHERE ${ACTIVE} AND ${IS_DEFAULT} AND ${VALID_ON}
    ORDER BY (data->>'companyCode') IS NOT DISTINCT FROM (SELECT code FROM master_records c WHERE c.type_code = 'company' AND c.status = 'active'
      AND lower(COALESCE(c.data->>'IsPrimary', 'false')) IN ('true', 'yes', '1') LIMIT 1) DESC, code LIMIT 1`, [date])).rows[0];
  return r ? r.code : null;
}

/** Refuse cost centres that are not active or not valid on the date; returns the codes as stored (master case). */
export async function assertCostCentres(db, codes, date) {
  const wanted = [...new Set(codes.filter(Boolean).map(String))];
  if (!wanted.length) return new Map();
  const rows = (await db.query(`SELECT code FROM master_records WHERE ${ACTIVE} AND ${VALID_ON} AND lower(code) = ANY($2)`, [date, wanted.map((c) => c.toLowerCase())])).rows;
  const found = new Map(rows.map((r) => [r.code.toLowerCase(), r.code]));
  const missing = wanted.filter((c) => !found.has(c.toLowerCase()));
  if (missing.length) throw badRequest(`Unknown, inactive or expired cost centre(s) on ${date}: ${missing.join(', ')}`);
  return new Map(wanted.map((c) => [c, found.get(c.toLowerCase())]));
}
