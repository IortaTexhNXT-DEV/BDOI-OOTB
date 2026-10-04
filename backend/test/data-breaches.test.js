/**
 * Personal data breach register (14.11): incident log, assessment against the NPC criteria, the 72-hour notification
 * tracker and its reminders, notification of the NPC and of the data subjects, closure and the annual security incident
 * report.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { breachDeadlineRun } from '../src/modules/data-breaches/service.js';

let ctx;
let sales;
const binary = (res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); };

beforeAll(async () => {
  ctx = await setup();
  await ctx.api('post', '/users').send({ username: 'br.sales', password: 'Welcome@123', displayName: 'Breach Sales', roles: ['sales'] });
  const t = await loginAs(ctx.app, 'br.sales', 'Welcome@123');
  sales = (m, p) => ctx.api(m, p).set('Authorization', `Bearer ${t}`);
});
afterAll(async () => { await pool.end(); });

describe('breach register', () => {
  let b;
  it('logs a breach with the 72-hour deadline from discovery and notifies the data privacy team', async () => {
    const discovered = new Date(Date.now() - 10 * 3600000).toISOString();
    const r = await ctx.api('post', '/privacy/breaches').send({ title: 'Policy schedules e-mailed to the wrong client', discoveredAt: discovered, nature: ['confidentiality'],
      dataCategories: ['Names and contact details', 'Government ID numbers and TIN'], subjectsAffected: 3, documents: [{ key: 'compliance/1-x-email.pdf', name: 'E-mail.pdf' }] });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    b = r.body.data;
    expect(b.breachNumber).toMatch(/^PDB-\d{4}-\d{5}$/);
    expect(new Date(b.npcDueAt).getTime() - new Date(discovered).getTime()).toBe(72 * 3600000);
    expect(b.hoursLeft).toBeGreaterThanOrEqual(61);
    expect(b.hoursLeft).toBeLessThanOrEqual(62);
    expect((await query("SELECT audience FROM notifications WHERE entity = 'personal_data_breach' AND entity_id = $1", [b.id])).rows[0].audience).toBe('read:privacy');
    expect((await ctx.api('post', '/privacy/breaches').send({ title: 'Bad', nature: ['secrecy'] })).status).toBe(400);
    expect((await ctx.api('post', '/privacy/breaches').send({ title: 'Future', discoveredAt: new Date(Date.now() + 86400000).toISOString() })).status).toBe(400);
  });
  it('assesses against the NPC criteria; a different decision needs a reason', async () => {
    expect((await ctx.api('post', `/privacy/breaches/${b.id}/notify-npc`).send({ reference: 'X' })).status).toBe(409);
    expect((await ctx.api('post', `/privacy/breaches/${b.id}/assess`).send({ sensitiveData: true, unauthorisedAcquisition: true, realRiskOfHarm: true, notifiable: false })).status).toBe(400);
    const a = await ctx.api('post', `/privacy/breaches/${b.id}/assess`).send({ sensitiveData: true, unauthorisedAcquisition: true, realRiskOfHarm: true, notes: 'TIN and ID images sent' });
    expect(a.body.data).toMatchObject({ status: 'assessed', notifiable: true, meetsNotificationCriteria: true });
    expect((await ctx.api('post', `/privacy/breaches/${b.id}/close`).send({ notes: 'Done' })).status).toBe(409);
  });
  it('the hourly job reminds as the deadline nears and once it has passed, once per mark', async () => {
    const due = new Date(b.npcDueAt).getTime();
    const r1 = await breachDeadlineRun(due - 20 * 3600000);
    expect(r1.reminded).toBe(1);
    expect((await breachDeadlineRun(due - 19 * 3600000)).reminded).toBe(0);
    expect((await breachDeadlineRun(due + 3600000)).reminded).toBe(1);
    const titles = (await query("SELECT title FROM notifications WHERE entity = 'personal_data_breach' AND entity_id = $1 AND type = 'reminder' ORDER BY created_at", [b.id])).rows.map((r) => r.title);
    expect(titles[0]).toMatch(/due in 20 hour/);
    expect(titles[1]).toMatch(/overdue/);
  });
  it('records the NPC notification (late needs a reason), the data subjects notified, and closes', async () => {
    const late = new Date(new Date(b.npcDueAt).getTime() + 3600000).toISOString();
    expect((await ctx.api('post', `/privacy/breaches/${b.id}/notify-npc`).send({ notifiedAt: late, reference: 'NPC-BN-2026-001' })).status).toBe(400);
    const n = await ctx.api('post', `/privacy/breaches/${b.id}/notify-npc`).send({ notifiedAt: new Date().toISOString(), reference: 'NPC-BN-2026-001', method: 'NPC DBNMS' });
    expect(n.body.data).toMatchObject({ status: 'notified', notifiedLate: false, hoursLeft: null });
    expect((await ctx.api('post', `/privacy/breaches/${b.id}/notify-subjects`).send({})).status).toBe(400);
    const s = await ctx.api('post', `/privacy/breaches/${b.id}/notify-subjects`).send({ count: 3, method: 'E-mail and phone call' });
    expect(s.body.data.subjectsNotifiedCount).toBe(3);
    const c = await ctx.api('post', `/privacy/breaches/${b.id}/close`).send({ notes: 'Recipient deleted the e-mail; staff retrained' });
    expect(c.body.data.status).toBe('closed');
    expect((await ctx.api('put', `/privacy/breaches/${b.id}`).send({ cause: 'x' })).status).toBe(409);
    const trail = (await query("SELECT action FROM audit_log WHERE entity = 'personal_data_breach' AND entity_id = $1 ORDER BY id", [b.id])).rows.map((r) => r.action);
    expect(trail).toEqual(['create', 'assess', 'notify-npc', 'notify-subjects', 'close']);
  });
  it('a security incident without personal data has no NPC clock; the annual report counts both (Excel)', async () => {
    const r = await ctx.api('post', '/privacy/breaches').send({ incidentType: 'security-incident', title: 'Phishing e-mail blocked', nature: ['integrity'] });
    expect(r.body.data.hoursLeft).toBeNull();
    const year = new Date().getUTCFullYear();
    const rep = await ctx.api('get', `/privacy/breaches/annual-report?year=${year}`);
    expect(rep.body.data).toMatchObject({ incidents: 2, breaches: 1, securityIncidents: 1, notifiable: 1, notifiedToNpc: 1, notifiedLate: 0, subjectsNotified: 3 });
    const x = await ctx.api('get', `/privacy/breaches/annual-report/export?year=${year}`).buffer(true).parse(binary);
    expect(readWorkbook(x.body).map((s) => s.name)).toEqual(['Summary', 'By nature', 'By data category', 'Incidents']);
    expect((await one("SELECT action FROM audit_log WHERE entity = 'privacy_report'")).action).toBe('export');
  });
  it('is reserved to the data privacy team (read:privacy / write:privacy)', async () => {
    expect((await sales('get', '/privacy/breaches')).status).toBe(403);
  });
});
