/**
 * Loads the integration framework with every adapter and message type registered. Import this (not the parts) from
 * outside the module, so a job or a script sees the complete registry.
 */
import './adapters/http.js';
import './messaging.js';
import './ctpl.js';
import './insurer.js';
import './bankfiles/batches.js';

export { processOutbox, enqueue, receive } from './framework/outbox.js';
export { smsRenewalNotices, smsPaymentReminders } from './messaging.js';
