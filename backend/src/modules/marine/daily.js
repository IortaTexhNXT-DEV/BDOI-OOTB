/**
 * Daily declarations (FR-PCL-020, 021): one per open cover and calendar day (MDD series) on a cover with Daily
 * declaration on. The first certificate or shipment of a day opens it; the job "Daily declaration close" closes the
 * days already ended (parcel.daily_cutoff_time), Nil when empty, and records the days without any item as Nil so every
 * day of the period is declared. An item dated on a closed day joins today's open declaration as a late item; so does an
 * item of a month whose monthly declaration is submitted. Submitting the monthly declaration marks its days Declared.
 * The job "Monthly declaration open" opens the previous month's declaration of each active cover (FR-PCL-022).
 */
import { many, one, query } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { nextDocumentNumber } from '../../lib/numbering.js';
import { addDays, businessTimeZone, today } from '../../lib/dates.js';

export const dailyOut = (d) => ({
  id: d.id, declarationNumber: d.declaration_number, openCoverId: d.open_cover_id, date: String(d.declaration_date).slice(0, 10), status: d.status,
  monthlyDeclarationId: d.monthly_declaration_id, monthlyDeclarationNumber: d.monthly_number ?? null, items: d.items ?? 0, lateItems: d.late_items ?? 0,
  totalInsured: Number(d.total_insured || 0), premium: Number(d.premium || 0), closedAt: d.closed_at,
});

/** The daily declaration of a cover and day, created Open when missing. */
export async function ensureDaily(db, coverId, date) {
  const found = (await db.query('SELECT * FROM open_cover_daily_declarations WHERE open_cover_id = $1 AND declaration_date = $2', [coverId, date])).rows[0];
  if (found) return found;
  const number = await nextDocumentNumber('daily_declaration', { db, date, unique: { table: 'open_cover_daily_declarations', column: 'declaration_number' } });
  return (await db.query(`INSERT INTO open_cover_daily_declarations(declaration_number, open_cover_id, declaration_date) VALUES ($1,$2,$3)
    ON CONFLICT (open_cover_id, declaration_date) DO UPDATE SET updated_at = now() RETURNING *`, [number, coverId, date])).rows[0];
}

/** Whether the month of a date already has a monthly declaration that is no longer a draft. */
async function monthDeclared(db, coverId, date) {
  return (await db.query("SELECT declaration_number FROM open_cover_declarations WHERE open_cover_id = $1 AND status <> 'draft' AND $2::date BETWEEN period_from AND period_to LIMIT 1",
    [coverId, date])).rows[0] || null;
}

/**
 * The daily declaration an item dated `date` joins: its own day while open; otherwise (day closed, or its month already
 * declared) today's, as a late item. Returns { daily, late, message }.
 */
export async function assignDaily(db, cover, date) {
  const own = (await db.query('SELECT * FROM open_cover_daily_declarations WHERE open_cover_id = $1 AND declaration_date = $2', [cover.id, date])).rows[0];
  const closed = (own && own.status !== 'open') || (await monthDeclared(db, cover.id, date));
  if (!closed) return { daily: own || await ensureDaily(db, cover.id, date), late: false, message: null };
  const now = await today();
  return { daily: await ensureDaily(db, cover.id, now), late: true, message: `Parcel date ${date} is already closed: the certificate is declared today as a late item` };
}

/** Last day already ended at the cut-off (parcel.daily_cutoff_time, business time zone): yesterday, or today once its cut-off has passed. */
export async function lastEndedDay(now = new Date()) {
  const cutoff = String((await getSetting('parcel.daily_cutoff_time', '23:59')) || '23:59');
  const t = await today();
  const hhmm = new Intl.DateTimeFormat('en-GB', { timeZone: await businessTimeZone(), hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
  return /^\d{2}:\d{2}$/.test(cutoff) && cutoff < '23:59' && hhmm >= cutoff ? t : addDays(t, -1);
}

/**
 * Job "Daily declaration close": the open days already ended become Closed (with items) or Nil (without), and the days
 * of the period without any declaration are recorded as Nil (not in a month already declared). Never closes today
 * before its cut-off. Returns { closed, nil, message }.
 */
export async function closeDailyDeclarations({ coverId = null } = {}) {
  const until = await lastEndedDay();
  const covers = await many(`SELECT id, period_from, period_to FROM open_covers WHERE daily_declaration AND status IN ('active', 'expired') AND ($1::text IS NULL OR id = $1)`, [coverId]);
  let closed = 0;
  let nil = 0;
  for (const c of covers) {
    const from = String(c.period_from).slice(0, 10);
    const to = [String(c.period_to).slice(0, 10), until].sort()[0];
    // days of the period without a declaration (outside the months already declared): Nil
    if (from <= to) {
      const missing = await many(`SELECT d::date AS day FROM generate_series($2::date, $3::date, interval '1 day') d
        WHERE NOT EXISTS (SELECT 1 FROM open_cover_daily_declarations x WHERE x.open_cover_id = $1 AND x.declaration_date = d::date)
          AND NOT EXISTS (SELECT 1 FROM open_cover_declarations m WHERE m.open_cover_id = $1 AND m.status <> 'draft' AND d::date BETWEEN m.period_from AND m.period_to)`, [c.id, from, to]);
      for (const m of missing) {
        const day = String(m.day).slice(0, 10);
        const number = await nextDocumentNumber('daily_declaration', { date: day, unique: { table: 'open_cover_daily_declarations', column: 'declaration_number' } });
        const r = await one(`INSERT INTO open_cover_daily_declarations(declaration_number, open_cover_id, declaration_date, status, closed_at) VALUES ($1,$2,$3,'nil',now())
          ON CONFLICT (open_cover_id, declaration_date) DO NOTHING RETURNING id`, [number, c.id, day]);
        if (r) nil += 1;
      }
    }
    const open = await many(`SELECT d.id, (SELECT count(*)::int FROM open_cover_certificates x WHERE x.daily_declaration_id = d.id AND x.status <> 'cancelled') AS items
      FROM open_cover_daily_declarations d WHERE d.open_cover_id = $1 AND d.status = 'open' AND d.declaration_date <= $2`, [c.id, until]);
    for (const d of open) {
      await query('UPDATE open_cover_daily_declarations SET status = $2, closed_at = now(), updated_at = now() WHERE id = $1', [d.id, d.items ? 'closed' : 'nil']);
      if (d.items) closed += 1; else nil += 1;
    }
  }
  return { closed, nil, until, message: `Daily declarations closed: ${closed} closed, ${nil} nil` };
}

/** Period (YYYY-MM) of the declaration that holds the month before `date`: the month, or the first month of its quarter. */
export function previousPeriod(date, frequency) {
  const [y, m] = String(date).slice(0, 7).split('-').map(Number);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  if (frequency !== 'quarterly') return `${py}-${String(pm).padStart(2, '0')}`;
  if (pm % 3 !== 0) return null; // the quarter is not over yet
  return `${py}-${String(pm - 2).padStart(2, '0')}`;
}

/**
 * Job "Monthly declaration open": for every active or expired cover with a daily declaration, the declaration of the
 * month just ended (a quarter for a quarterly cargo cover, once it is over) is opened as a Draft with its daily
 * declarations, late items and reversals. Returns { opened, declarations }.
 */
export async function openMonthlyDeclarations({ userId = 'system' } = {}) {
  const { createDeclaration } = await import('./service.js');
  const now = await today();
  const covers = await many("SELECT id, cover_number, declaration_frequency, period_from, period_to, cover_type FROM open_covers WHERE daily_declaration AND status IN ('active', 'expired')");
  const out = [];
  for (const c of covers) {
    const period = previousPeriod(now, c.cover_type === 'parcel' ? 'monthly' : c.declaration_frequency);
    if (!period) continue;
    if (await one('SELECT 1 FROM open_cover_declarations WHERE open_cover_id = $1 AND period = $2', [c.id, period])) continue;
    try {
      const d = await createDeclaration(c.id, period, userId, { byJob: true });
      out.push(d.declarationNumber);
    } catch {
      // a period outside the cover is skipped
    }
  }
  return { opened: out.length, declarations: out };
}
