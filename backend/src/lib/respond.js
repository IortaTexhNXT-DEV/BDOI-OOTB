/** Success envelope used by every endpoint: { success, message, data, ...extra } */
export const ok = (res, data, message = 'OK', extra = {}) => res.json({ success: true, message, data, ...extra });
export const created = (res, data, message = 'Created') => res.status(201).json({ success: true, message, data });

/** Parse page/perPage (also pageNo/pageSize/limit/offset) from the query string. */
export function paging(q, defaults = { page: 1, perPage: 10 }) {
  const page = Math.max(1, Number(q.page ?? q.pageNo ?? q.pageNumber ?? defaults.page) || 1);
  const perPage = Math.min(500, Math.max(1, Number(q.perPage ?? q.pageSize ?? q.limit ?? defaults.perPage) || defaults.perPage));
  return { page, perPage, offset: (page - 1) * perPage, limit: perPage };
}

export const pageMeta = (total, { page, perPage }) => ({ total, page, perPage, totalPages: Math.ceil(total / perPage) });

/** Wrap an async handler so rejections reach the error middleware. */
export const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
