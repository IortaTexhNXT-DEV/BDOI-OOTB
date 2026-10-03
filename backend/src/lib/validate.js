import { z } from 'zod';
export { z };
/** Validate req[part] with a zod schema; the parsed value replaces the original. */
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[part]);
  if (!r.success) return next(r.error);
  req[part] = r.data;
  return next();
};
