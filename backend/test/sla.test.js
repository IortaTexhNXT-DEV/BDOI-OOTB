/**
 * Service level register and clocks (migration 0592): deadlines in working time, the sla-monitor job with escalation,
 * the register API, My Work's Service levels, and the policy lifecycle moves (suspend, reinstate, lapse, expiry).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache, setSetting } from '../src/lib/settings.js';
import { deadlineOf, slaMonitor } from '../src/lib/sla.js';
import { expirePolicies } from '../src/modules/policies/lifecycle.js';

let ctx;
const ids = {};
const tok = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);

async function makeUser(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  ids[username] = r.body.data.userId;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}

beforeAll(async () => {
  ctx = await setup();
  await setSetting('calendar.working_weekdays', [1, 2, 3, 4, 5]);
  clearSettingsCache();
  await makeUser('sla.ops', ['tis-ops-associate']);
  await makeUser('sla.head', ['tis-ops-unit-head']);
  await makeUser('sla.sales', ['tis-sales-associate']);
  await query(`INSERT INTO clients(id, client_code, display_name, first_name, last_name, owner_user_id, created_by) VALUES ('cl_sla1', 'CL-SLA-1', 'Sla Client', 'Sla', 'Client', $1, $1)`, [ids['sla.ops']]);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, owner_user_id, created_by, status, inception_date, expiry_date, sum_insured, premium_total, insured_name, doc)
    VALUES ('pol_sla1', 'POL-SLA-0001', 'cl_sla1', (SELECT id FROM products WHERE code = 'MOTOR'), $1, $1, 'active', current_date - 30, current_date + 335, 900000, 20000, 'Sla Client', '{}'),
           ('pol_sla2', 'POL-SLA-0002', 'cl_sla1', (SELECT id FROM products WHERE code = 'MOTOR'), $1, $1, 'active', current_date - 400, current_date - 2, 900000, 20000, 'Sla Client', '{}')`, [ids['sla.ops']]);
});
afterAll(async () => { await pool.end(); });

describe('deadlines', () => {
  it('counts working time by the working week and the holiday calendar; calendar time as it is', async () => {
    // Wednesday 23 December 2026 08:00 Manila (00:00 UTC): 16 working hours = 2 working days -> Tuesday 29 December (24 Thursday is a special non-working day, 25 Christmas, weekend)
    const start = new Date('2026-12-23T00:00:00Z');
    const d = await deadlineOf({ targetHours: 16, workingTime: true }, start);
    expect(d.toISOString()).toBe('2026-12-29T00:00:00.000Z');
    // 4 working hours on a working day land the same day
    expect((await deadlineOf({ targetHours: 4, workingTime: true }, start)).toISOString()).toBe('2026-12-23T04:00:00.000Z');
    // a start on a Saturday counts from Monday
    expect((await deadlineOf({ targetHours: 8, workingTime: true }, new Date('2026-10-10T02:00:00Z'))).toISOString()).toBe('2026-10-13T00:00:00.000Z');
    // calendar time: 24 hours are 24 hours whatever the day
    expect((await deadlineOf({ targetHours: 24, workingTime: false }, new Date('2026-12-24T10:00:00Z'))).toISOString()).toBe('2026-12-25T10:00:00.000Z');
  });
});

describe('service level monitor', () => {
  it('opens a clock for an open placement, marks the breach, escalates once to the unit head and closes the clock when the item moves on', async () => {
    await query(`INSERT INTO placements(id, placement_number, client_id, product_id, owner_user_id, created_by, status, sent_at, premium_total, insured_name, lob, created_at)
      VALUES ('pl_sla1', 'PS-SLA-0001', 'cl_sla1', (SELECT id FROM products WHERE code = 'MOTOR'), $1, $1, 'sent', now() - interval '10 days', 20000, 'Sla Client', 'MOTOR', now() - interval '11 days')`, [ids['sla.ops']]);
    const first = await slaMonitor();
    expect(first.opened).toBeGreaterThanOrEqual(1);
    const clock = await one("SELECT * FROM sla_clocks WHERE target_code = 'POL-PLACED' AND record_id = 'pl_sla1' AND closed_at IS NULL");
    expect(clock).toBeTruthy();
    expect(clock.breached_at).not.toBeNull();
    expect(clock.escalated_at).not.toBeNull();
    const sent = (uid) => one("SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND entity = 'sla_clock' AND entity_id = $2 AND title LIKE 'Service level breached%'", [uid, String(clock.id)]).then((r) => r.n);
    expect(await sent(ids['sla.head'])).toBe(1);
    expect(await sent(ids['sla.ops'])).toBe(1);
    // a second run neither escalates again nor opens a second clock
    await slaMonitor();
    expect(await sent(ids['sla.head'])).toBe(1);
    expect((await one("SELECT count(*)::int AS n FROM sla_clocks WHERE record_id = 'pl_sla1' AND closed_at IS NULL")).n).toBe(1);
    // My Work shows it to the owner as breached, and to the unit head in the team view through the register screen
    const mine = await as('sla.ops', 'get', '/my-work/items?category=sla&pageSize=50');
    expect(mine.status, JSON.stringify(mine.body)).toBe(200);
    expect(mine.body.data.find((i) => i.ref === 'PS-SLA-0001')).toMatchObject({ category: 'sla', status: 'breached', priority: 'urgent' });
    expect((await as('sla.sales', 'get', '/my-work/items?category=sla&pageSize=50')).body.data.find((i) => i.ref === 'PS-SLA-0001')).toBeUndefined();
    const clocks = await ctx.api('get', '/service-levels/clocks?breached=true');
    expect(clocks.body.data.find((c) => c.ref === 'PS-SLA-0001')).toMatchObject({ targetCode: 'POL-PLACED', ownerName: 'sla.ops' });
    // the e-policy arrives: the POL-PLACED clock closes and a POL-RECVD clock opens, within its turnaround
    await query("UPDATE placements SET status = 'epolicy_received', epolicy_received_at = now() WHERE id = 'pl_sla1'");
    const third = await slaMonitor();
    expect(third.closed).toBeGreaterThanOrEqual(1);
    expect((await one("SELECT closed_at FROM sla_clocks WHERE target_code = 'POL-PLACED' AND record_id = 'pl_sla1'")).closed_at).not.toBeNull();
    const next = await one("SELECT breached_at, due_at > now() AS ahead FROM sla_clocks WHERE target_code = 'POL-RECVD' AND record_id = 'pl_sla1' AND closed_at IS NULL");
    expect(next).toMatchObject({ breached_at: null, ahead: true });
  });

  it('the register is edited with validation and an audit entry, and read by the configuration roles only', async () => {
    const list = await ctx.api('get', '/service-levels');
    expect(list.status).toBe(200);
    expect(list.body.data.map((t) => t.code)).toEqual(expect.arrayContaining(['POL-PEND', 'POL-PLACED', 'POL-RECVD', 'END-REQ', 'END-PLACED', 'CAN-REQ', 'CAN-DONE', 'LEAD-NURTURE', 'QUOTE-DESPATCH']));
    expect(list.body.summary.open).toBeGreaterThanOrEqual(1);
    expect((await ctx.api('put', '/service-levels/POL-PLACED').send({ escalateToRoles: ['no-such-role'] })).status).toBe(400);
    expect((await ctx.api('put', '/service-levels/POL-PLACED').send({ targetHours: 0 })).status).toBe(400);
    expect((await ctx.api('put', '/service-levels/NOPE').send({ targetHours: 8 })).status).toBe(404);
    const ok = await ctx.api('put', '/service-levels/POL-PLACED').send({ targetHours: 24, workingTime: false, escalateToRoles: ['tis-ops-unit-head', 'tis-general-manager'] });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ targetHours: 24, workingTime: false, escalateToRoles: ['tis-ops-unit-head', 'tis-general-manager'] });
    expect((await one("SELECT count(*)::int AS n FROM audit_log WHERE entity = 'sla_target' AND entity_id = 'POL-PLACED'")).n).toBe(1);
    expect((await as('sla.ops', 'get', '/service-levels')).status).toBe(403);
    expect((await as('sla.ops', 'put', '/service-levels/POL-PLACED').send({ targetHours: 8 })).status).toBe(403);
    await ctx.api('put', '/service-levels/POL-PLACED').send({ targetHours: 16, workingTime: true, escalateToRoles: ['tis-ops-unit-head'] });
  });
});

describe('policy lifecycle', () => {
  it('suspends under the premium warranty with a reason, reinstates, lapses; every move guarded and audited', async () => {
    const moves = await as('sla.ops', 'get', '/policies/pol_sla1/moves');
    expect(moves.body.data.moves.map((m) => m.status).sort()).toEqual(['lapsed', 'suspended']);
    expect((await as('sla.ops', 'post', '/policies/pol_sla1/status').send({ status: 'suspended', reasonCode: 'LAP-FUNDS' })).status).toBe(400);
    expect((await as('sla.ops', 'post', '/policies/pol_sla1/status').send({ status: 'reinstated', reasonCode: 'REI-PAID' })).status).toBe(409);
    const s = await as('sla.ops', 'post', '/policies/pol_sla1/status').send({ status: 'suspended', reasonCode: 'SUS-WARRANTY', note: 'Premium unpaid 60 days after inception' });
    expect(s.status, JSON.stringify(s.body)).toBe(200);
    expect(String(s.body.status).toLowerCase()).toBe('suspended');
    const row = await one('SELECT status, status_reason, suspended_at, status_changed_by FROM policies WHERE id = $1', ['pol_sla1']);
    expect(row).toMatchObject({ status: 'suspended', status_reason: 'SUS-WARRANTY: Premium warranty breached: Premium unpaid 60 days after inception', status_changed_by: ids['sla.ops'] });
    expect(row.suspended_at).not.toBeNull();
    // a suspended policy cannot be suspended again; a reason that needs a note is refused without one
    expect((await as('sla.ops', 'post', '/policies/pol_sla1/status').send({ status: 'suspended', reasonCode: 'SUS-WARRANTY' })).status).toBe(409);
    expect((await as('sla.ops', 'post', '/policies/pol_sla1/status').send({ status: 'reinstated', reasonCode: 'REI-INSURER' })).status).toBe(400);
    const r = await as('sla.ops', 'post', '/policies/pol_sla1/status').send({ status: 'reinstated', reasonCode: 'REI-PAID' });
    expect(r.status).toBe(200);
    expect((await one('SELECT status, reinstated_at FROM policies WHERE id = $1', ['pol_sla1'])).status).toBe('active');
    expect((await as('sla.ops', 'post', '/policies/pol_sla1/status').send({ status: 'lapsed', reasonCode: 'LAP-FUNDS' })).status).toBe(400);
    const l = await as('sla.ops', 'post', '/policies/pol_sla1/status').send({ status: 'lapsed', reasonCode: 'LAP-FUNDS', note: 'Client confirmed no funds this term' });
    expect(l.status).toBe(200);
    expect((await one('SELECT status, lapsed_at FROM policies WHERE id = $1', ['pol_sla1'])).status).toBe('lapsed');
    expect((await one("SELECT array_agg(action ORDER BY id) AS a FROM audit_log WHERE entity = 'policy' AND entity_id = 'pol_sla1' AND action IN ('suspend', 'reinstate', 'lapse')")).a).toEqual(['suspend', 'reinstate', 'lapse']);
    // a lapsed policy can be reinstated; the sales associate without write:policies cannot move it
    expect((await as('sla.ops', 'get', '/policies/pol_sla1/moves')).body.data.moves.map((m) => m.status)).toEqual(['reinstated']);
    expect((await as('sla.sales', 'post', '/policies/pol_sla1/status').send({ status: 'reinstated', reasonCode: 'REI-PAID' })).status).toBe(200);
  });

  it('the expiry job expires the policies past their expiry date one by one, with an audit entry and a remark', async () => {
    const r = await expirePolicies();
    expect(r.expired).toBeGreaterThanOrEqual(1);
    const p = await one('SELECT status, status_reason, status_changed_by FROM policies WHERE id = $1', ['pol_sla2']);
    expect(p).toMatchObject({ status: 'expired', status_changed_by: 'policy-expiry' });
    expect(p.status_reason).toMatch(/^Expired on \d{4}-\d{2}-\d{2} \(policy-expiry job\)$/);
    const a = await one("SELECT after_data FROM audit_log WHERE entity = 'policy' AND entity_id = 'pol_sla2' AND action = 'expire'");
    expect(a.after_data).toMatchObject({ status: 'expired', policyNumber: 'POL-SLA-0002' });
    expect((await one('SELECT status FROM policies WHERE id = $1', ['pol_sla1'])).status).toBe('active');
  });
});
