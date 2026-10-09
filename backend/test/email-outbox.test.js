import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { queueEmail } from '../src/lib/mailer.js';

// A mail server address that refuses connections: sending is "configured" but every attempt fails.
vi.hoisted(() => { process.env.SMTP_URL = 'smtp://127.0.0.1:9'; });

let ctx;
let sales;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const setEnabled = (on) => ctx.api('put', '/settings').send({ settings: { 'notification.email_enabled': on } });

beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'eo.sales', password: 'Welcome@123', displayName: 'eo.sales', email: 'eo.sales@example.ph', roles: ['sales'] });
  const token = await loginAs(ctx.app, 'eo.sales', 'Welcome@123');
  sales = (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
});
afterAll(async () => { delete process.env.SMTP_URL; await pool.end(); });

describe('e-mail outbox', () => {
  let failedId;
  let sentId;

  it('lists messages with their status, counts and whether sending is enabled (settings permission)', async () => {
    failedId = await queueEmail({ to: 'failed@example.ph', subject: 'Outbox test failed', html: '<p>x</p>', entity: 'quotation', entityId: 'qt_test' });
    sentId = await queueEmail({ to: 'sent@example.ph', subject: 'Outbox test sent', html: '<p>x</p>' });
    await q("UPDATE email_outbox SET status = 'failed', attempts = 5, error = 'Connection timeout' WHERE id = $1", [failedId]);
    await q("UPDATE email_outbox SET status = 'sent', attempts = 1, sent_at = now() WHERE id = $1", [sentId]);

    const r = await ctx.api('get', '/email/outbox?status=failed&search=Outbox test');
    expect(r.status).toBe(200);
    expect(r.body.data).toHaveLength(1);
    expect(r.body.data[0]).toMatchObject({ id: failedId, status: 'failed', to: 'failed@example.ph', attempts: 5, lastError: 'Connection timeout', entity: 'quotation' });
    expect(r.body.counts.failed).toBeGreaterThanOrEqual(1);
    expect(r.body.sending).toEqual({ enabled: false, smtpConfigured: true, active: false });
    expect((await sales('get', '/email/outbox')).status).toBe(403);
    expect((await sales('post', `/email/outbox/${failedId}/retry`)).status).toBe(403);
    expect((await sales('get', '/email/sending-status')).body.data.active).toBe(false);
    // the IT AppSupport role (read:settings / write:settings) opens Master > E-mail Outbox
    await ctx.api('post', '/users').send({ username: 'eo.it', password: 'Welcome@123', displayName: 'eo.it', email: 'eo.it@example.ph', roles: ['tis-it-admin'] });
    const itToken = await loginAs(ctx.app, 'eo.it', 'Welcome@123');
    expect((await request(ctx.app).get('/api/email/outbox').set('Authorization', `Bearer ${itToken}`)).status).toBe(200);
  });

  it('retry while sending is off queues the message again and says so', async () => {
    const r = await ctx.api('post', `/email/outbox/${failedId}/retry`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'queued', attempts: 0, lastError: null });
    expect(r.body.message).toMatch(/not configured/);
    const audit = await q("SELECT 1 FROM audit_log WHERE entity = 'email' AND entity_id = $1 AND action = 'retry'", [String(failedId)]);
    expect(audit).toHaveLength(1);
  });

  it('retry while sending is on tries the message at once and keeps the error of a failed attempt', async () => {
    await setEnabled(true);
    try {
      await q("UPDATE email_outbox SET status = 'failed', attempts = 5 WHERE id = $1", [failedId]);
      const r = await ctx.api('post', `/email/outbox/${failedId}/retry`);
      expect(r.status).toBe(200);
      expect(r.body.sending.active).toBe(true);
      expect(r.body.data.attempts).toBe(1);
      expect(r.body.data.lastError).toBeTruthy();
      expect(r.body.message).toMatch(/failed again/);
    } finally {
      await setEnabled(false);
    }
  });

  it('refuses to retry a sent message or an unknown one', async () => {
    expect((await ctx.api('post', `/email/outbox/${sentId}/retry`)).status).toBe(400);
    expect((await ctx.api('post', '/email/outbox/999999/retry')).status).toBe(404);
  });
});
