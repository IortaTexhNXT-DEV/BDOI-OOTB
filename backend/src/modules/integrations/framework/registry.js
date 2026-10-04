/**
 * Registry of the integration framework: provider adapters and message types.
 *
 * Adapter (one per provider protocol; a connector names its adapter):
 *   {
 *     code, label, kinds: ['sms'],                  connector kinds it can serve
 *     credentialKeys: ['apiKey'],                   keys of connector.credential_env it needs in live mode
 *     needsEndpoint: true,                          live mode refuses an empty endpoint
 *     send(message, connector, ctx)                 -> { externalRef, response, httpStatus } or throws IntegrationError
 *     test(connector, ctx)                          -> { ok, detail } (connection check; optional)
 *   }
 *   ctx = { credentials: { apiKey: '...' }, fetchImpl, timeoutMs, mode }
 *
 * Message type (one per business message; modules register theirs):
 *   {
 *     type: 'sms.send', kind: 'sms', label,
 *     onSent(db, message, result, ctx)              apply the answer (store the authentication code, the insurer's
 *                                                   policy number ...) in the same transaction as the status
 *     onFailed(db, message, error)                  the message failed for good (attempts exhausted or not retryable)
 *     onInbound(db, inboxRow)                       a message of this type pushed by the third party or read from a file
 *   }
 *
 * In test mode every connector sends through the fake provider of its kind (adapters/fake.js): no network call.
 */

const adapters = new Map();
const messageTypes = new Map();

export class IntegrationError extends Error {
  /** retryable: false for an answer that will not change on a new attempt (rejected request, invalid data). */
  constructor(message, { retryable = true, httpStatus = null, response = null } = {}) {
    super(message);
    this.retryable = retryable;
    this.httpStatus = httpStatus;
    this.response = response;
  }
}

export function registerAdapter(a) {
  if (!a?.code || typeof a.send !== 'function') throw new Error('An adapter needs a code and a send function');
  adapters.set(a.code, { credentialKeys: [], needsEndpoint: true, kinds: [], ...a });
}
export const adapterOf = (code) => adapters.get(code) || null;
export const listAdapters = () => [...adapters.values()].map((a) => ({ code: a.code, label: a.label, kinds: a.kinds, credentialKeys: a.credentialKeys, needsEndpoint: a.needsEndpoint }));

export function registerMessageType(t) {
  if (!t?.type || !t.kind) throw new Error('A message type needs a type and a kind');
  messageTypes.set(t.type, t);
}
export const messageTypeOf = (type) => messageTypes.get(type) || null;
export const listMessageTypes = () => [...messageTypes.values()].map((t) => ({ type: t.type, kind: t.kind, label: t.label || t.type, inbound: typeof t.onInbound === 'function' }));
