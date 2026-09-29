/** Response and request helpers shared by the finance modules. */
import { getSetting } from '../../../lib/settings.js';
import { forbidden } from '../../../lib/errors.js';
import { paging } from '../../../lib/respond.js';

export { round2 } from '../../../lib/money.js';
export { today } from '../../../lib/dates.js';
export const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};
export const str = (v) => (v === null || v === undefined || v === '' ? null : String(v));
/** ISO date (YYYY-MM-DD) from a Date, ISO string or null. */
export const isoDate = (v) => {
  if (!v) return null;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export const pageParams = (q, perPage = 10) => paging(q, { page: 1, perPage });

/** List envelope understood by every finance screen: data + pagination (both key styles) + flat meta. */
export function sendList(res, rows, total, pg, extra = {}, message = 'OK') {
  const totalPages = Math.ceil(total / pg.perPage);
  res.json({
    success: true, message, data: rows,
    pagination: { page: pg.page, pageSize: pg.perPage, total, totalPages, currentPage: pg.page, totalRecords: total },
    total, page: pg.page, perPage: pg.perPage, totalPages, ...extra,
  });
}

/** 404 with the NO_DATA_FOUND code the print / export screens look for. */
export const sendNoData = (res, message) => res.status(404).json({ success: false, message, error: { code: 'NO_DATA_FOUND', message } });

/** Maker-checker: the approver must differ from the maker unless disabled in settings. */
export async function assertChecker(user, makerId, what = 'record') {
  if (!makerId || makerId !== user.id) return;
  if (!(await getSetting('finance.maker_checker_enabled', true))) return;
  throw forbidden(`Maker-checker: the ${what} must be approved by a different user than the one who created it`);
}

export const userId = (req) => req.user?.id ?? null;
