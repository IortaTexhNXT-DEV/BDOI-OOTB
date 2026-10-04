import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { campaignDispatch } from '../src/modules/campaigns/service.js';

let ctx;
let sales;
let claims;
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('cp.sales', ['sales']);
  claims = await persona('cp.claims', ['claims']);
  // marketing consents: cl_sls_01, 02, 05, 08 granted; a refusal and a withdrawn consent too
  await pool.query(`INSERT INTO privacy_consents(party_type, party_id, purpose, granted, channel, notice_version)
    SELECT 'client', id, 'marketing', true, 'Form', '1.0' FROM clients WHERE id IN ('cl_sls_01', 'cl_sls_02', 'cl_sls_05', 'cl_sls_08')`);
  await pool.query(`INSERT INTO privacy_consents(party_type, party_id, purpose, granted, channel, notice_version) VALUES ('client', 'cl_sls_03', 'marketing', false, 'Form', '1.0')`);
  await pool.query(`INSERT INTO privacy_consents(party_type, party_id, purpose, granted, channel, notice_version, withdrawn_at) VALUES ('client', 'cl_sls_07', 'marketing', true, 'Form', '1.0', now())`);
});
afterAll(async () => { await pool.end(); });

describe('marketing campaigns to consenting clients', () => {
  let segmentId;
  let templateId;
  let campaignId;
  it('previews a segment: only clients whose marketing consent is in force are reachable', async () => {
    expect((await claims('get', '/campaigns/segments')).status).toBe(403);
    const p = await sales('post', '/campaigns/segments/preview').send({ criteria: { partyType: 'client' } });
    expect(p.status).toBe(200);
    expect(p.body.data.eligible).toBe(4);
    expect(p.body.data.excluded['Marketing consent refused or withdrawn']).toBe(2);
    expect(p.body.data.excluded['No marketing consent recorded']).toBeGreaterThan(0);
    const s = await sales('post', '/campaigns/segments').send({ name: 'All clients', criteria: { partyType: 'client' } });
    expect(s.status).toBe(201);
    segmentId = s.body.data.id;
  });

  it('templates are filled in per recipient; the opt-out paragraph is added when the template has no link', async () => {
    const t = await sales('post', '/campaigns/templates').send({ code: 'TEST', name: 'Test', subject: 'Hello {{firstName}}', bodyHtml: '<p>Dear {{fullName}}, our offer.</p>' });
    expect(t.status).toBe(201);
    templateId = t.body.data.id;
    const prev = await sales('post', `/campaigns/templates/${templateId}/preview`);
    expect(prev.body.data.subject).toBe('Hello Maria');
    expect(prev.body.data.html).toMatch(/Dear Maria Santos/);
    expect(prev.body.data.html).toMatch(/#opt-out-link/);
    expect((await sales('post', '/campaigns/templates').send({ code: 'test', name: 'Dup', subject: 's', bodyHtml: 'b' })).status).toBe(400);
  });

  it('sending queues the e-mails of consenting recipients to the outbox and records the excluded', async () => {
    const c = await sales('post', '/campaigns').send({ name: 'October offer', segmentId, templateId });
    expect(c.status).toBe(201);
    campaignId = c.body.data.id;
    const s = await sales('post', `/campaigns/${campaignId}/send`);
    expect(s.status).toBe(200);
    expect(s.body.data.queued).toBe(4);
    const mails = (await pool.query("SELECT to_address, body_html, subject FROM email_outbox WHERE entity = 'campaign' AND entity_id = $1 ORDER BY to_address", [campaignId])).rows;
    expect(mails.map((m) => m.to_address)).toEqual(['angela.ramos@example.ph', 'bianca.lorenzo@example.ph', 'kristine.soriano@example.ph', 'miguel.aquino@example.ph']);
    expect(mails[0].subject).toBe('Hello Angela');
    expect(mails[0].body_html).toMatch(/\/api\/campaigns\/opt-out\//);
    expect((await sales('post', `/campaigns/${campaignId}/send`)).status).toBe(409);
  });

  it('the opt-out link records a refusal in the consent register; the next campaign skips the person', async () => {
    const mail = (await pool.query("SELECT body_html FROM email_outbox WHERE entity = 'campaign' AND to_address = 'miguel.aquino@example.ph'")).rows[0];
    const token = mail.body_html.match(/opt-out\/([^"'<\s]+)/)[1];
    const page = await request(ctx.app).get(`/api/campaigns/opt-out/${token}`);
    expect(page.status).toBe(200);
    expect(page.text).toMatch(/Unsubscribe/);
    // nothing changes until confirmed
    expect((await pool.query("SELECT count(*)::int AS n FROM privacy_consents WHERE party_id = 'cl_sls_01' AND NOT granted")).rows[0].n).toBe(0);
    const done = await request(ctx.app).post(`/api/campaigns/opt-out/${token}`).type('form').send({});
    expect(done.status).toBe(200);
    expect(done.text).toMatch(/unsubscribed/);
    const consents = (await pool.query("SELECT granted, channel, withdrawn_at FROM privacy_consents WHERE party_id = 'cl_sls_01' AND purpose = 'marketing' ORDER BY id")).rows;
    expect(consents[0].withdrawn_at).not.toBeNull();
    expect(consents[1]).toMatchObject({ granted: false, channel: 'E-mail' });
    const bad = await request(ctx.app).post('/api/campaigns/opt-out/not-a-token').type('form').send({});
    expect(bad.status).toBe(400);
    const p = await sales('post', '/campaigns/segments/preview').send({ criteria: { partyType: 'client' } });
    expect(p.body.data.eligible).toBe(3);
  });

  it('results: delivery from the outbox, exclusions by reason, opt-outs and conversions', async () => {
    await pool.query("UPDATE email_outbox SET status = 'sent', sent_at = now() WHERE entity = 'campaign' AND to_address <> 'bianca.lorenzo@example.ph'");
    await pool.query("UPDATE email_outbox SET status = 'failed', error = 'Mailbox unavailable' WHERE entity = 'campaign' AND to_address = 'bianca.lorenzo@example.ph'");
    const r = await sales('get', `/campaigns/${campaignId}/results`);
    expect(r.status).toBe(200);
    expect(r.body.data.totals).toMatchObject({ recipients: 4, sent: 3, failed: 1, optedOut: 1 });
    expect(r.body.data.excludedByReason['Marketing consent refused or withdrawn']).toBe(2);
  });

  it('a scheduled campaign is sent by the campaign-dispatch job', async () => {
    const c = await sales('post', '/campaigns').send({ name: 'Scheduled', segmentId, templateId });
    const at = new Date(Date.now() + 3600000).toISOString();
    expect((await sales('post', `/campaigns/${c.body.data.id}/schedule`).send({ scheduledAt: at })).body.data.status).toBe('scheduled');
    await pool.query("UPDATE campaigns SET scheduled_at = now() - interval '1 minute' WHERE id = $1", [c.body.data.id]);
    const out = await campaignDispatch();
    expect(out).toMatchObject({ due: 1, sent: 1 });
    expect((await pool.query('SELECT status, recipients FROM campaigns WHERE id = $1', [c.body.data.id])).rows[0]).toEqual({ status: 'sent', recipients: 3 });
  });
});
