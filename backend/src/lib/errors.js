export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
export const badRequest = (m = 'Bad request', d) => new HttpError(400, m, d);
export const unauthorized = (m = 'Unauthorized') => new HttpError(401, m);
export const forbidden = (m = 'Forbidden') => new HttpError(403, m);
export const notFound = (m = 'Not found') => new HttpError(404, m);
export const conflict = (m = 'Conflict') => new HttpError(409, m);

/** Express error middleware: one JSON error envelope for every failure. */
export function errorHandler(err, req, res, _next) {
  const status = err.status || (err.name === 'ZodError' ? 400 : 500);
  const body = { success: false, message: err.message || 'Internal server error' };
  if (err.name === 'ZodError') body.errors = err.issues?.map((i) => ({ path: i.path.join('.'), message: i.message }));
  if (err.details) body.errors = err.details;
  if (status >= 500) req.log?.error({ err }, 'unhandled error');
  res.status(status).json(body);
}
