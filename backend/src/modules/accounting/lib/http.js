/** Response and request helpers shared by the finance modules (receipts, disbursements, journal vouchers, payments). */
import { paging } from '../../../lib/respond.js';

export { num, round2 } from '../../../lib/money.js';
export { isoDate, today } from '../../../lib/dates.js';
export { assertChecker } from '../../../lib/makerChecker.js';
export const str = (v) => (v === null || v === undefined || v === '' ? null : String(v));

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
