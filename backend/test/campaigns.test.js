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
    // in the e-mail layout of the theme, with a sample opt-out link that is a link
    expect(prev.body.data.html).toMatch(/data-bv-layout/);
    expect(prev.body.data.html).toMatch(/<a href="[^"]+\/api\/campaigns\/opt-out\/sample">/);
    expect(prev.body.data.hasOptOutLink).toBe(false);
    expect((await sales('post', '/campaigns/templates').send({ code: 'test', name: 'Dup', subject: 's', bodyHtml: 'b' })).status).toBe(400);
  });

  it('previews a template being written, before it is saved', async () => {
    const prev = await sales('post', '/campaigns/templates/preview').send({ subject: 'Offer for {{firstName}}', bodyHtml: '<p>Hi {{firstName}}</p><p><a href="{{optOutLink}}">Unsubscribe</a></p>' });
    expect(prev.status).toBe(200);
    expect(prev.body.data).toMatchObject({ subject: 'Offer for Maria', hasOptOutLink: true });
    expect(prev.body.data.html).toMatch(/Hi Maria/);
    expect((await sales('post', '/campaigns/templates/preview').send({ subject: '', bodyHtml: '<p>x</p>' })).status).toBe(400);
    expect((await claims('post', '/campaigns/templates/preview').send({ subject: 's', bodyHtml: 'b' })).status).toBe(403);
  });

  it('a segment by product reaches the clients insured for that product and the prospects interested in it', async () => {
    const product = (await pool.query("SELECT id FROM products WHERE code = 'MOTOR'")).rows[0].id;
    const clients = (await pool.query("SELECT count(DISTINCT client_id)::int AS n FROM policies WHERE product_id = $1 AND client_id IN (SELECT id FROM clients WHERE anonymised_at IS NULL)", [product])).rows[0].n;
    const leads = (await pool.query('SELECT count(*)::int AS n FROM leads WHERE product_id = $1 AND deleted_at IS NULL AND anonymised_at IS NULL AND client_id IS NULL', [product])).rows[0].n;
    const p = await sales('post', '/campaigns/segments/preview').send({ criteria: { partyType: 'both', productId: product } });
    expect(p.status).toBe(200);
    expect(p.body.data.total).toBe(clients + leads);
    const s = await sales('post', '/campaigns/segments').send({ name: 'Motor product', criteria: { partyType: 'both', lob: 'MOTOR', productId: product } });
    expect(s.body.data.criteria).toMatchObject({ lob: 'MOTOR', productId: product });
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

  it('records the marketing consent of a client from the campaigns screen; the segment then reaches the client', async () => {
    const before = (await sales('post', '/campaigns/segments/preview').send({ criteria: { partyType: 'client' } })).body.data.eligible;
    const list = await sales('get', '/campaigns/consents?partyType=client&status=not-recorded');
    expect(list.status).toBe(200);
    const party = list.body.data.find((x) => /@/.test(x.email || ''));
    expect(party).toMatchObject({ partyType: 'client', status: 'not-recorded' });
    expect((await claims('post', '/campaigns/consents').send({ partyType: 'client', partyId: party.partyId, granted: true, channel: 'Form' })).status).toBe(403);
    expect((await sales('post', '/campaigns/consents').send({ partyType: 'client', partyId: party.partyId, granted: true, channel: 'Fax' })).status).toBe(400);
    const r = await sales('post', '/campaigns/consents').send({ partyType: 'client', partyId: party.partyId, granted: true, channel: 'Form', evidence: 'Signed application form' });
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ partyId: party.partyId, status: 'granted', channel: 'Form', evidence: 'Signed application form' });
    expect((await sales('post', '/campaigns/segments/preview').send({ criteria: { partyType: 'client' } })).body.data.eligible).toBe(before + 1);
    // a later refusal ends the consent in force
    expect((await sales('post', '/campaigns/consents').send({ partyType: 'client', partyId: party.partyId, granted: false, channel: 'Phone' })).body.data.status).toBe('refused');
    const rows = (await pool.query("SELECT granted, withdrawn_at FROM privacy_consents WHERE party_id = $1 AND purpose = 'marketing' ORDER BY id", [party.partyId])).rows;
    expect(rows[0].withdrawn_at).not.toBeNull();
    expect((await sales('post', '/campaigns/segments/preview').send({ criteria: { partyType: 'client' } })).body.data.eligible).toBe(before);
    expect((await sales('post', '/campaigns/consents').send({ partyType: 'lead', partyId: 'nobody', granted: true, channel: 'Form' })).status).toBe(400);
  });
});
