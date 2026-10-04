/**
 * Fake provider: every connector in test mode sends through it, whatever its adapter. No network call; the answer is
 * built from the message so the whole process (outbox, retry, answer applied to the record) runs as in live mode.
 *
 * Connector options that steer it (for user acceptance tests and the automated tests):
 *   fakeFailFirst: n        the first n attempts of each message fail with a retryable error (provider outage)
 *   fakeReject: true        every attempt fails with a non-retryable error (request refused)
 *   fakeClaimStatus: text   status returned for insurer.claim_status (default UNDER EVALUATION)
 */
import crypto from 'node:crypto';
import { IntegrationError } from '../framework/registry.js';

const code = (text, len = 10) => crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, len).toUpperCase();

export const fakeAdapter = {
  code: 'fake',
  label: 'Fake provider (test mode)',
  kinds: [],
  credentialKeys: [],
  needsEndpoint: false,
  send: async (message, connector) => {
    const o = connector.options || {};
    if (o.fakeReject) throw new IntegrationError('Test mode: the provider refused the request (fakeReject)', { retryable: false, httpStatus: 422 });
    if (Number(o.fakeFailFirst) >= message.attempt) throw new IntegrationError(`Test mode: provider unavailable on attempt ${message.attempt} (fakeFailFirst)`, { retryable: true, httpStatus: 503 });
    const p = message.payload || {};
    const ref = `FAKE-${connector.code}-${message.id}`;
    switch (message.type) {
      case 'sms.send':
      case 'viber.send':
        return { externalRef: ref, httpStatus: 200, response: { status: 'Queued', to: p.to, parts: Math.max(1, Math.ceil(String(p.text || '').length / 160)) } };
      case 'ctpl.authenticate': {
        const authCode = `${code(`${p.cocNumber}|${p.policyNumber}|${p.chassisNumber}`, 12)}`;
        return { externalRef: `FAKE-CTPL-${code(p.cocNumber, 8)}`, httpStatus: 200, response: { authenticationCode: authCode, cocNumber: p.cocNumber }, data: { authCode, providerReference: `FAKE-CTPL-${code(p.cocNumber, 8)}` } };
      }
      case 'ctpl.lto_feed':
        return { externalRef: `FAKE-LTO-${code(p.cocNumber, 8)}`, httpStatus: 200, response: { accepted: true }, data: { reference: `FAKE-LTO-${code(p.cocNumber, 8)}` } };
      case 'insurer.policy_issue': {
        const policyNumber = `FAKE-${code(`${p.policyNumber}|${p.insurerCode}`, 8)}`;
        return { externalRef: policyNumber, httpStatus: 200, response: { policyNumber, status: 'ISSUED' }, data: { policyNumber, status: 'ISSUED' } };
      }
      case 'insurer.policy_data':
        return { externalRef: ref, httpStatus: 200, response: { policyNumber: p.insurerPolicyNumber || p.policyNumber, premium: p.expectedPremium, status: 'IN FORCE' },
          data: { policyNumber: p.insurerPolicyNumber || p.policyNumber, premium: p.expectedPremium ?? null, status: 'IN FORCE' } };
      case 'insurer.claim_status': {
        const status = o.fakeClaimStatus || 'UNDER EVALUATION';
        return { externalRef: ref, httpStatus: 200, response: { claimNumber: p.claimNumber, status }, data: { status, remarks: 'Test mode answer' } };
      }
      default:
        return { externalRef: ref, httpStatus: 200, response: { accepted: true } };
    }
  },
  test: async () => ({ ok: true, detail: 'Test mode: messages go to the fake provider; nothing leaves the system' }),
};
