/**
 * Notifications of the maker-checker flows: the request to the people who can approve (everyone holding the permission
 * of the approve endpoint), and the decision to the maker.
 *
 * notification.approval_requests (Master > Configuration, notification) is the one switch: when it is false neither
 * the approvers nor the makers are notified. notify() applies it to every notification of type 'approval'.
 *
 * Call these after the business transaction has committed. A notification that cannot be created is logged and never
 * fails the transaction that asked for it.
 */
import { logger } from '../../lib/logger.js';
import { approvalNotificationsOn, notify } from './service.js';

export { approvalNotificationsOn };

async function safely(title, fn) {
  try {
    if (!(await approvalNotificationsOn())) return null;
    return await fn();
  } catch (e) {
    logger.warn({ err: e, title }, 'approval notification not created');
    return null;
  }
}

/**
 * "<document> <number> awaiting approval" to everyone holding `audience`. The maker usually holds it too and sees the
 * same notification; they are never sent a personal one as an approver. Where the approvers are named by a role rather
 * than a permission, `users` lists them (one personal notification each; leave the maker out).
 */
export function notifyApprovers({ audience = null, users = null, document, number, by, detail = null, title = null, message = null, link = null, entity = null, entityId = null }) {
  const t = title || `${document} ${number} awaiting approval`;
  const n = { type: 'approval', title: t, message: message || `${by} submitted ${number}${detail ? ` (${detail})` : ''}`, link, entity, entityId };
  return safely(t, async () => {
    if (!users) return notify({ ...n, audience });
    for (const userId of users) await notify({ ...n, userId });
    return null;
  });
}

/**
 * "<document> <number> approved" (or rejected, returned...) to the maker, with the reason on a rejection. Nothing when
 * there is no maker or the maker decided it themselves (maker-checker switched off).
 */
export function notifyDecision({ userId, decidedBy = null, document, number, approved, status = null, by, reason = null, title = null, message = null, type = null, link = null, entity = null, entityId = null }) {
  if (!userId || (decidedBy && userId === decidedBy)) return Promise.resolve(null);
  const word = status || (approved ? 'approved' : 'rejected');
  const t = title || `${document} ${number} ${word}`;
  const m = message || `${word.charAt(0).toUpperCase()}${word.slice(1)} by ${by}${reason ? `: ${reason}` : ''}`;
  return safely(t, () => notify({ userId, type: type || (approved ? 'info' : 'alert'), title: t, message: m, link, entity, entityId }));
}
