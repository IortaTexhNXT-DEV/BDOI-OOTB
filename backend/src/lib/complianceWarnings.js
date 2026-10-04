/**
 * Compliance warnings: a control set to "warn" instead of "block" (an insurer without a certificate of authority in
 * force, a referrer without a licence) lets the action through, records the warning in the audit trail and returns it
 * with the answer as `complianceWarnings: [text]`, which the screens show as a warning message.
 */
import { currentRequest } from './requestContext.js';
import { audit } from './audit.js';
import { logger } from './logger.js';

/** Record a warning for the request being served (outside a request it is only logged). */
export async function addComplianceWarning(message, { kind = 'compliance', entity = 'compliance', entityId = null } = {}) {
  const req = currentRequest();
  if (!req) {
    logger.warn({ kind, entity, entityId }, message);
    return;
  }
  req.complianceWarnings = req.complianceWarnings || [];
  if (req.complianceWarnings.includes(message)) return;
  req.complianceWarnings.push(message);
  await audit(req, { entity, entityId, action: 'compliance-warning', after: { kind, message } });
}

/** Express middleware (app level): add the request's warnings to its JSON answer. */
export function complianceWarningsMiddleware(req, res, next) {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (req.complianceWarnings?.length && body && typeof body === 'object' && !Array.isArray(body)) {
      return json({ ...body, complianceWarnings: [...req.complianceWarnings] });
    }
    return json(body);
  };
  next();
}
