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

/** Readable message of one schema issue: a missing field reads "<field> is required" rather than zod's bare "Required". */
const issueMessage = (i) => {
  const field = i.path.join('.');
  if (field && i.code === 'invalid_type' && i.received === 'undefined') return `${field} is required`;
  if (field && i.code === 'too_small' && i.type === 'string' && Number(i.minimum) <= 1) return `${field} is required`;
  return i.message;
};

/** Express error middleware: one JSON error envelope for every failure. */
export function errorHandler(err, req, res, _next) {
  const status = err.status || (err.name === 'ZodError' ? 400 : 500);
  // A schema failure answers "Validation failed" with one message per field (zod's own message is a JSON dump, D105).
  const body = { success: false, message: err.name === 'ZodError' ? 'Validation failed' : (err.message || 'Internal server error') };
  if (err.name === 'ZodError') body.errors = err.issues?.map((i) => ({ path: i.path.join('.'), message: issueMessage(i) }));
  if (err.details) body.errors = err.details;
  if (req.id) body.requestId = req.id;
  if (status >= 500) req.log?.error({ err, requestId: req.id }, 'unhandled error');
  res.status(status).json(body);
}
