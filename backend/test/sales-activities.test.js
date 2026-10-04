/**
 * Sales activities (migration 0320): account executives log calls, meetings, e-mails and visits on a prospect, a
 * quotation or a client (activity type and outcome masters, next step with its date); the timeline of each record;
 * the next step becomes a follow-up task in My Work (work_tasks, source sales-activity) through the My Work task
 * service; the activity report by account executive and period.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { one, pool, query } from '../src/db/pool.js';
import { addDays, today } from '../src/lib/dates.js';

let ctx; let ae; let ae2; let proc; let claims; let asOf; let aeId; let leadId; let quoteId; let clientId;
const year = new Date().getFullYear();
const binary = (r) => r.buffer(true).parse((res, cb) => { const d = []; res.on('data', (x) => d.push(x)); res.on('end', () => cb(null, Buffer.concat(d))); });

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}
const at = (day, time = '10:30') => `${day}T${time}:00+08:00`;

beforeAll(async () => {
  ctx = await setup();
  const a = await persona('sa.ae', ['sales']);
  ae = a.api; aeId = a.id;
  ae2 = (await persona('sa.ae2', ['sales'])).api;
  proc = (await persona('sa.proc', ['processing'])).api;
  claims = (await persona('sa.claims', ['claims'])).api;
  asOf = await today();
  leadId = (await ae('post', '/leads').send({ firstName: 'Carmela', lastName: 'Reyes', emailId: 'carmela.r@example.ph', contactNumber: '09170001234', leadCategory: 'Retail' })).body.leadId;
  const q = await ae('post', '/quotations').send({ leadRefId: leadId, productType: 'Motor', insurancePolicyType: 'PC', lossAndDamageCoverage: '800000', lossAndDamageCoverageRate: '1.5',
    participantDetails: [{ insuranceCompanyName: 'Pioneer Insurance & Surety Corp.' }],
    insuranceVehicleDetails: [{ vehicleBrand: 'Toyota', vehicleModel: 'Vios', modelYear: String(year - 2), vehicleType: 'private_cars', seatingCapacity: '5' }], vehicleType: 'private_cars' });
  quoteId = q.body.quotationId;
  clientId = (await one('SELECT id FROM clients ORDER BY created_at LIMIT 1')).id;
});
afterAll(async () => { await pool.end(); });

describe('activity types and outcomes', () => {
  it('offers the active masters to the log form', async () => {
    const r = await ae('get', '/sales-activities/options');
    expect(r.status).toBe(200);
    expect(r.body.data.types.map((t) => t.code)).toEqual(expect.arrayContaining(['CALL', 'MEETING', 'VISIT', 'EMAIL']));
    expect(r.body.data.types.find((t) => t.code === 'VISIT')).toMatchObject({ channel: 'visit', followUpDays: 5 });
    expect(r.body.data.outcomes.find((o) => o.code === 'INTERESTED')).toMatchObject({ result: 'positive' });
    // the masters are maintained on Master > Organization (write:masters), read by the sales team
    expect((await ae('get', '/ops-masters/sales-activity-type')).status).toBe(200);
    expect((await ae('post', '/ops-masters/sales-activity-type').send({ code: 'X', name: 'X', channel: 'call' })).status).toBe(403);
    const m = await ctx.api('post', '/ops-masters/sales-activity-type').send({ code: 'WEBINAR', name: 'Webinar', channel: 'meeting', followUpDays: 2 });
    expect(m.status).toBe(201);
  });
});

describe('logging activities and the My Work follow-up', () => {
  let first; let second;
  it('logs a call on a prospect; its next step becomes a follow-up task in the account executive\'s My Work', async () => {
    const r = await ae('post', '/sales-activities').send({ entity: 'lead', entityId: leadId, activityType: 'CALL', subject: 'Introductory call', activityAt: at(asOf, '09:15'),
      durationMinutes: 12, contactPerson: 'Carmela Reyes', outcome: 'INTERESTED', nextStep: 'Send the motor quotation', nextStepDate: addDays(asOf, 2) });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    first = r.body.data;
    expect(first).toMatchObject({ entity: 'lead', channel: 'call', activityTypeName: 'Phone call', outcomeName: 'Interested, wants a quotation', accountExecutive: aeId,
      taskStatus: 'open', taskDueDate: addDays(asOf, 2), recordNumber: expect.any(String), partyName: 'Carmela Reyes' });
    expect(r.body.message).toContain('My Work');
    const tasks = (await ae('get', `/my-work/tasks?entity=lead&entityId=${leadId}`)).body.data;
    expect(tasks).toEqual([expect.objectContaining({ id: first.taskId, source: 'sales-activity', sourceLabel: 'Sales activity next step', dueDate: addDays(asOf, 2), assignedTo: aeId,
      link: `/agent/leaddetail/${leadId}` })]);
    expect(tasks[0].title).toContain('Send the motor quotation');
    // a prospect with a quotation keeps its status; a new prospect becomes Contacted with its first activity
    expect((await one('SELECT status FROM leads WHERE id = $1', [leadId])).status).toBe('QuoteGenerated');
    const fresh = (await ae('post', '/leads').send({ firstName: 'Paolo', lastName: 'Cruz', emailId: 'paolo.c@example.ph', contactNumber: '09170001235', leadCategory: 'Retail' })).body.leadId;
    expect((await ae('post', '/sales-activities').send({ entity: 'lead', entityId: fresh, activityType: 'MESSAGE', activityAt: at(asOf, '08:00'), outcome: 'NO_ANSWER' })).status).toBe(201);
    expect((await one('SELECT status FROM leads WHERE id = $1', [fresh])).status).toBe('Contacted');
  });

  it('validates the type, the date, the outcome and the next step', async () => {
    const base = { entity: 'lead', entityId: leadId, activityType: 'CALL', activityAt: at(asOf) };
    const bad = async (b) => (await ae('post', '/sales-activities').send({ ...base, ...b })).body.errors?.map((e) => e.path);
    expect(await bad({ activityType: 'NOPE' })).toContain('activityType');
    expect(await bad({ outcome: 'NOPE' })).toContain('outcome');
    expect(await bad({ activityAt: at(addDays(asOf, 3)) })).toContain('activityAt');
    expect(await bad({ activityAt: at(addDays(asOf, -90)) })).toContain('activityAt');
    expect(await bad({ nextStep: 'Call again', nextStepDate: addDays(asOf, -1) })).toContain('nextStepDate');
    expect(await bad({ nextStepDate: addDays(asOf, 1) })).toContain('nextStep');
    expect((await ae('post', '/sales-activities').send({ ...base, entity: 'lead', entityId: 'nope' })).status).toBe(404);
  });

  it('a later activity on the quotation completes the earlier follow-up and shows on the prospect\'s timeline', async () => {
    const r = await ae('post', '/sales-activities').send({ entity: 'quote', entityId: quoteId, activityType: 'VISIT', subject: 'Presented the quotation', activityAt: at(asOf, '15:00'),
      location: 'Client office, Makati', outcome: 'QUOTE_PRESENTED', nextStep: 'Collect the signed acceptance', nextStepDate: addDays(asOf, 5) });
    expect(r.status).toBe(201);
    second = r.body.data;
    expect(second).toMatchObject({ entity: 'quote', leadId, channel: 'visit' });
    // the follow-up of the call was on the prospect, not on the quotation: it stays open until the prospect is followed up
    expect((await one('SELECT status FROM work_tasks WHERE id = $1', [first.taskId])).status).toBe('open');
    const meeting = await ae('post', '/sales-activities').send({ entity: 'lead', entityId: leadId, activityType: 'EMAIL', subject: 'Sent the quotation', activityAt: at(asOf, '16:00'),
      outcome: 'DOCS_REQUESTED' });
    expect(meeting.status).toBe(201);
    expect((await one('SELECT status, completion_note FROM work_tasks WHERE id = $1', [first.taskId]))).toEqual({ status: 'done', completion_note: 'Followed up by a later sales activity' });
    const lead = (await ae('get', `/sales-activities/timeline/lead/${leadId}`)).body.data;
    expect(lead.record).toMatchObject({ entity: 'lead', id: leadId, name: 'Carmela Reyes' });
    expect(lead.activities.map((a) => a.subject)).toEqual(['Sent the quotation', 'Presented the quotation', 'Introductory call']);
    expect(lead.nextStep).toMatchObject({ activityId: second.id, nextStep: 'Collect the signed acceptance', dueDate: addDays(asOf, 5) });
    const quote = (await ae('get', `/sales-activities/timeline/quote/${quoteId}`)).body.data;
    expect(quote.activities.map((a) => a.subject)).toEqual(['Presented the quotation']);
  });

  it('changing the next step moves its follow-up task; cancelling the activity cancels it', async () => {
    const u = await ae('put', `/sales-activities/${second.id}`).send({ nextStepDate: addDays(asOf, 7), outcome: 'ACCEPTED' });
    expect(u.status).toBe(200);
    expect(u.body.data).toMatchObject({ nextStepDate: addDays(asOf, 7), outcomeName: 'Client accepted the quotation' });
    expect((await one('SELECT due_date::text AS d FROM work_tasks WHERE id = $1', [second.taskId])).d).toBe(addDays(asOf, 7));
    // only the account executive (or their manager) changes an activity
    expect((await ae2('put', `/sales-activities/${second.id}`).send({ notes: 'x' })).status).toBe(403);
    const c = await ae('post', `/sales-activities/${second.id}/cancel`).send({ reason: 'Logged on the wrong quotation' });
    expect(c.status).toBe(200);
    expect((await one('SELECT status FROM work_tasks WHERE id = $1', [second.taskId])).status).toBe('cancelled');
    expect((await ae('get', `/sales-activities/timeline/quote/${quoteId}`)).body.data.activities).toHaveLength(0);
    expect((await ae('get', `/sales-activities/timeline/quote/${quoteId}?includeCancelled=true`)).body.data.activities[0].status).toBe('cancelled');
    const audit = await query("SELECT action FROM audit_log WHERE entity = 'sales_activity' AND entity_id = $1", [second.id]);
    expect(audit.rows.map((x) => x.action).sort()).toEqual(['cancel', 'create', 'update']);
  });

  it('logs on a client and shows it on the client timeline; logging for someone outside one\'s team is refused', async () => {
    const r = await ae2('post', '/sales-activities').send({ entity: 'client', entityId: clientId, activityType: 'MEETING', subject: 'Renewal review', activityAt: at(asOf, '11:00'),
      outcome: 'CALL_BACK', nextStep: 'Call back with the fire renewal terms', nextStepDate: addDays(asOf, 3) });
    expect(r.status).toBe(201);
    expect((await ae2('get', `/sales-activities/timeline/client/${clientId}`)).body.data.activities.some((a) => a.id === r.body.data.id)).toBe(true);
    expect((await ae2('post', '/sales-activities').send({ entity: 'client', entityId: clientId, activityType: 'CALL', activityAt: at(asOf), accountExecutive: aeId })).status).toBe(403);
  });
});

describe('activity report and access', () => {
  it('sums the activities of the period by account executive, channel and outcome, with the follow-ups', async () => {
    const r = await ae('get', `/sales-activities/report?from=${asOf.slice(0, 7)}-01&to=${asOf}`);
    expect(r.status).toBe(200);
    const mine = r.body.data.rows.find((x) => x.accountExecutive === aeId);
    expect(mine).toMatchObject({ total: 3, call: 1, email: 1, other: 1, prospects: 2, nextSteps: 1, followUpsDone: 1, followUpsOpen: 0, positive: 2 });
    expect(r.body.data.totals).toMatchObject({ activities: 4, accountExecutives: 2 });
    expect(r.body.data.byType.map((t) => t.activityType)).toEqual(expect.arrayContaining(['CALL', 'EMAIL', 'MEETING']));
    const x = await binary(ae('get', `/sales-activities/report?from=${asOf.slice(0, 7)}-01&to=${asOf}&format=xlsx`));
    expect(x.status).toBe(200);
    expect(x.body.subarray(0, 2).toString()).toBe('PK');
    const list = (await ae('get', `/sales-activities?accountExecutive=${aeId}&channel=call`)).body.data;
    expect(list.map((a) => a.subject)).toEqual(['Introductory call']);
  });

  it('the Processing Team reads the timelines; Claims has no access', async () => {
    expect((await proc('get', `/sales-activities/timeline/lead/${leadId}`)).status).toBe(200);
    expect((await proc('post', '/sales-activities').send({ entity: 'lead', entityId: leadId, activityType: 'CALL', activityAt: at(asOf) })).status).toBe(403);
    expect((await claims('get', '/sales-activities/report')).status).toBe(403);
  });
});
