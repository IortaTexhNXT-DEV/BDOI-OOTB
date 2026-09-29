/**
 * Per-request context (AsyncLocalStorage): code deep in a request, such as a document generator, can read the
 * signed-in user without it being passed down (req.user is set later by requireAuth on the same request object).
 */
import { AsyncLocalStorage } from 'node:async_hooks';

const storage = new AsyncLocalStorage();

/** Express middleware: run the rest of the request inside a context that holds the request. */
export function requestContext(req, _res, next) {
  storage.run({ req }, next);
}

/** The user of the current request ({ id, username, ... }) or null outside a request / when not signed in. */
export const currentUser = () => storage.getStore()?.req?.user || null;
