/**
 * API gate of the feature entitlements, mounted on /api before every module (app.js). A request to an API path of a
 * feature that is off answers 403 { code: FEATURE_NOT_ENABLED }; a change (anything but GET and HEAD) to a read-only
 * feature answers 403 { code: FEATURE_READ_ONLY }. Hiding a menu is not the control: this is.
 */
import { featureOfApiPath, featureStatus, OFF, READ_ONLY } from './service.js';
import { featureOf } from './catalogue.js';

const READS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function featureGate(req, res, next) {
  const key = featureOfApiPath(req.path);
  if (!key) return next();
  try {
    const status = await featureStatus(key);
    if (status === OFF || (status === READ_ONLY && !READS.has(req.method))) {
      const name = featureOf(key).name;
      return res.status(403).json({
        success: false,
        code: status === OFF ? 'FEATURE_NOT_ENABLED' : 'FEATURE_READ_ONLY',
        message: status === OFF ? `${name} is not available in this edition` : `${name} is read-only in this edition: records can be viewed and exported`,
        feature: key,
        requestId: req.id,
      });
    }
    return next();
  } catch (e) {
    return next(e);
  }
}
