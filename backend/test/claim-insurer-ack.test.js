/**
 * Insurer acknowledgement service level of a claim (TIS-BRD-CLAIM-08, CR-06, migration 0648): the end-of-day job alerts
 * the handler once when a claim submitted to the insurer has no insurer advice by the end of claims.insurer_ack_days
 * working days (0: the submission day); an answered claim and a switched-off alert raise nothing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup } from './helpers.js';
import { pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { today } from '../src/lib/dates.js';
import { workingCalendar } from '../src/lib/workingCalendar.js';
import { serviceLevels } from '../src/modules/claims/insurer.js';

let handler;
const claim = async (no, { advised = false } = {}) => (await query(`INSERT INTO claims(claim_number, policy_id, status, loss_date, reported_date, handler_user_id, submitted_to_insurer_at,
    fnol_alerted_at, insurer_advice, insurer_advice_at) VALUES ($1, (SELECT id FROM policies ORDER BY id LIMIT 1), 'registered', CURRENT_DATE - 1, CURRENT_DATE - 1, $2, now(), now(), $3, $4)
  RETURNING id`, [no, handler, advised ? 'under-evaluation' : null, advised ? new Date() : null])).rows[0].id;
const alerts = async (no) => (await query("SELECT title FROM notifications WHERE title = $1", [`Insurer has not responded: claim ${no}`])).rows.length;

beforeAll(async () => {
  await setup();
  handler = (await query("SELECT id FROM users WHERE status = 'active' ORDER BY created_at LIMIT 1")).rows[0].id;
});
afterAll(async () => { await pool.end(); });

describe('insurer acknowledgement at the end of the day', () => {
  it('alerts once for a claim without insurer advice, never for an advised one, and not while switched off', async () => {
    const now = await today();
    const working = (await workingCalendar(now, now)).isWorking(now);
    const waiting = await claim('CLM-ACK-1');
    await claim('CLM-ACK-2', { advised: true });
    await query("UPDATE app_settings SET value = 'false' WHERE key = 'claims.insurer_ack_alert'");
    clearSettingsCache();
    await serviceLevels();
    expect(await alerts('CLM-ACK-1')).toBe(0);
    await query("UPDATE app_settings SET value = 'true' WHERE key = 'claims.insurer_ack_alert'");
    clearSettingsCache();
    const r = await serviceLevels();
    if (!working) {
      expect(r.skipped).toBeTruthy();
      return;
    }
    expect(r.insurerAck).toBe(1);
    expect(await alerts('CLM-ACK-1')).toBeGreaterThan(0);
    expect(await alerts('CLM-ACK-2')).toBe(0);
    expect((await query('SELECT insurer_ack_alerted_at FROM claims WHERE id = $1', [waiting])).rows[0].insurer_ack_alerted_at).not.toBeNull();
    expect((await serviceLevels()).insurerAck).toBe(0);
  });

  it('waits the working days of claims.insurer_ack_days', async () => {
    const now = await today();
    if (!(await workingCalendar(now, now)).isWorking(now)) return;
    await query("UPDATE app_settings SET value = '2' WHERE key = 'claims.insurer_ack_days'");
    clearSettingsCache();
    await claim('CLM-ACK-3');
    expect((await serviceLevels()).insurerAck).toBe(0);
    await query("UPDATE app_settings SET value = '0' WHERE key = 'claims.insurer_ack_days'");
    clearSettingsCache();
  });
});
