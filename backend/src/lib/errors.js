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
/**
 * Express error middleware: one JSON error envelope for every failure. Client errors (4xx) keep their message; server
 * errors (5xx) answer a generic message with the request id, and the detail (message, stack, database error) is only
 * written to the server log.
 */
export function errorHandler(err, req, res, _next) {
  // body-parser / multer / express.raw errors carry a numeric status (e.g. 413 entity too large); treat 4xx as client errors
  const raw = Number(err.status || err.statusCode) || (err.name === 'ZodError' ? 400 : 500);
  const status = err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_FILE_COUNT' ? 413 : (err.name === 'MulterError' ? 400 : raw);
  const clientError = status >= 400 && status < 500;
  const body = { success: false, message: clientError ? (err.message || 'Bad request') : 'Internal server error; quote the request id when reporting it' };
  if (err.name === 'ZodError') body.errors = err.issues?.map((i) => ({ path: i.path.join('.'), message: i.message }));
  if (clientError && err.details) body.errors = err.details;
  if (req.id) body.requestId = req.id;
  if (!clientError) req.log?.error({ err, requestId: req.id }, 'unhandled error');
  if (res.headersSent) return;
  res.status(clientError ? status : 500).json(body);
}
