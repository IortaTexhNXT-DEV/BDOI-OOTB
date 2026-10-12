/**
 * TISPH Phase 1 gaps of the signed BRD:
 *   PROD-05   minimum policy term (quotation, placement, policy) and the cover times on the policy schedule
 *   RPT-02    sales target master (maker-checker, upload) and commission vs target = variance in the reports
 *   NFR-17.1  privacy notice acknowledgement, marketing consent and e-mail opt-out on the client record; marketing
 *             e-mail respects the opt-out, transactional e-mail does not
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { one, pool, query } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { assertMinimumTerm, coverTimes, termError, timeLabel } from '../src/lib/policyTerm.js';
import { isNonTransactional, optedOut, queueEmail } from '../src/lib/mailer.js';
import { standardPolicyScheduleDoc } from '../src/modules/documents/templates.js';
import { staticUploads, templateWorkbook } from '../src/modules/documents/uploadTemplates.js';
import { writeXlsx } from '../src/lib/xlsx.js';

let ctx;
let checkerTok;
const PASSWORD = 'Welcome@123';
const as = (tok, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok}`);

beforeAll(async () => {
  ctx = await setup();
  expect((await ctx.api('post', '/users').send({ username: 'st.checker', password: PASSWORD, displayName: 'Target Checker', email: 'st.checker@example.ph', roles: ['system-admin'] })).status).toBe(201);
  checkerTok = await loginAs(ctx.app, 'st.checker', PASSWORD);
});
afterAll(async () => { await pool.end(); });

// ------------------------------------------------------------------------------------------------ PROD-05
describe('PROD-05 policy term and date rules', () => {
  it('seeds the minimum term of 6 months and cover from 12:00 noon to 11:59 PM', async () => {
    const rows = await query("SELECT key, value FROM app_settings WHERE key IN ('policies.min_term_months', 'policies.cover_start_time', 'policies.cover_end_time', 'policies.min_term_exempt_lobs')");
    expect(Object.fromEntries(rows.rows.map((r) => [r.key, r.value]))).toEqual({
      'policies.min_term_months': 6, 'policies.cover_start_time': '12:00', 'policies.cover_end_time': '23:59', 'policies.min_term_exempt_lobs': [] });
    expect(await coverTimes()).toEqual({ start: '12:00', end: '23:59', startLabel: '12:00 noon', endLabel: '11:59 PM' });
  });

  it('labels the times of day', () => {
    expect(['12:00', '23:59', '00:00', '09:30', '13:05', 'x'].map(timeLabel)).toEqual(['12:00 noon', '11:59 PM', '12:00 midnight', '9:30 AM', '1:05 PM', '']);
  });

  it('refuses a period shorter than the minimum, accepts six months or more, and skips exempt lines', async () => {
    expect((await termError({ inception: '2026-11-15', expiry: '2027-05-14' })).message).toMatch(/at least 6 months.*2027-05-15 or later/);
    expect(await termError({ inception: '2026-11-15', expiry: '2027-05-15' })).toBeNull();
    expect(await termError({ inception: '2026-08-31', expiry: '2027-02-28' })).toBeNull();
    expect(await termError({ inception: '2026-11-15', expiry: null })).toBeNull();
    expect((await termError({ inception: '2026-11-15', expiry: '2026-11-01' })).message).toMatch(/before the inception/);
    await query("UPDATE app_settings SET value = '[\"MOTOR\"]' WHERE key = 'policies.min_term_exempt_lobs'");
    clearSettingsCache();
    expect(await termError({ inception: '2026-11-15', expiry: '2026-12-15', lob: 'motor' })).toBeNull();
    expect(await termError({ inception: '2026-11-15', expiry: '2026-12-15', lob: 'FIRE' })).not.toBeNull();
    await query("UPDATE app_settings SET value = '[]' WHERE key = 'policies.min_term_exempt_lobs'");
    clearSettingsCache();
    await expect(assertMinimumTerm({ inception: '2026-11-15', expiry: '2027-01-15' })).rejects.toMatchObject({ status: 400 });
  });

  it('refuses a policy changed to a period shorter than 6 months and shows the cover times on the policy', async () => {
    const p = await one("SELECT id, inception_date::text AS inception FROM policies WHERE inception_date IS NOT NULL AND status NOT IN ('cancelled', 'Cancelled') ORDER BY id LIMIT 1");
    const short = new Date(Date.parse(`${p.inception}T00:00:00Z`) + 90 * 86400000).toISOString().slice(0, 10);
    // the service the policy screens and the corrections save through (the route first asks for a correction)
    const { updatePolicy } = await import('../src/modules/policies/service.js');
    await expect(updatePolicy(p.id, { expiry: short }, null)).rejects.toMatchObject({ status: 400, details: [expect.objectContaining({ code: 'MIN_POLICY_TERM' })] });
    const g = await ctx.api('get', `/policies/${p.id}`);
    expect(g.status).toBe(200);
    expect(g.body.data || g.body).toMatchObject({ coverStartTime: '12:00', coverEndTime: '23:59', coverStartLabel: '12:00 noon', coverEndLabel: '11:59 PM' });
  });

  it('refuses a quotation whose period is shorter than 6 months', async () => {
    const q = await one("SELECT id FROM quotes WHERE status = 'draft' AND deleted_at IS NULL ORDER BY created_at LIMIT 1");
    const r = await ctx.api('put', `/quotations/${q.id}`).send({ inceptionDate: '2026-11-15', expiryDate: '2027-02-15' });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toMatch(/at least 6 months/);
  });

  it('prints the period of insurance with the cover times on the policy schedule', async () => {
    const spec = await standardPolicyScheduleDoc({ policyNumber: 'P-1', insuredName: 'Juan', inception: '2026-11-15', expiry: '2027-11-15', currency: 'PHP' });
    const meta = JSON.stringify(spec.meta);
    expect(meta).toMatch(/12:00 noon/);
    expect(meta).toMatch(/11:59 PM/);
  });
});

// ------------------------------------------------------------------------------------------------ RPT-02
describe('RPT-02 sales targets and the variance', () => {
  let line;
  beforeAll(async () => {
    line = await one(`SELECT cm.referrer_id AS agent, to_char(cm.cycle_date, 'YYYY-MM') AS month, sum(cm.amount)::float AS commission
      FROM commissions cm WHERE cm.referrer_id IS NOT NULL AND cm.status <> 'Reversed' AND cm.cycle_date IS NOT NULL GROUP BY 1, 2 ORDER BY 2 DESC, 1 LIMIT 1`);
    expect(line).toBeTruthy();
  });

  it('keeps a target in draft, sends it for approval and refuses the maker as approver', async () => {
    const c = await ctx.api('post', '/incentive/sales-targets').send({ scope: 'agent', agentId: line.agent, period: line.month, targetAmount: 1000, remarks: 'Test' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ scope: 'agent', agentId: line.agent, period: line.month, targetAmount: 1000, status: 'draft' });
    const dup = await ctx.api('post', '/incentive/sales-targets').send({ scope: 'agent', agentId: line.agent, period: line.month, targetAmount: 5 });
    expect(dup.status).toBe(409);
    const bad = await ctx.api('post', '/incentive/sales-targets').send({ scope: 'agent', agentId: line.agent, period: '2026-13', targetAmount: 5 });
    expect(bad.status).toBe(400);
    expect((await ctx.api('post', '/incentive/sales-targets/submit').send({ ids: [c.body.data.id] })).status).toBe(200);
    const self = await ctx.api('post', '/incentive/sales-targets/decide').send({ ids: [c.body.data.id], decision: 'approve' });
    expect(self.status).toBe(403);
    expect((await as(checkerTok, 'post', '/incentive/sales-targets/decide').send({ ids: [c.body.data.id], decision: 'return' })).status).toBe(400);
    const ok = await as(checkerTok, 'post', '/incentive/sales-targets/decide').send({ ids: [c.body.data.id], decision: 'approve' });
    expect(ok.status).toBe(200);
    expect(ok.body.data[0]).toMatchObject({ status: 'approved', decidedBy: 'Target Checker' });
  });

  it('adds Target and Variance (total commission less total target) to Agent Policy Conversion', async () => {
    const [y, m] = line.month.split('-').map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const r = await ctx.api('post', '/reports/tisph-agent-conversion/run').send({ ReportCriteria: 'Agent', FromDate: `${line.month}-01`, ToDate: to, Agent: line.agent });
    expect(r.status).toBe(200);
    const data = r.body.data || r.body;
    const row = data.rows.find((x) => x.month === line.month);
    expect(Number(row.target)).toBe(1000);
    expect(Number(row.variance)).toBeCloseTo(line.commission - 1000, 2);
    expect(data.columns.map((c) => c.key)).toEqual(expect.arrayContaining(['target', 'variance']));
  });

  it('a new target replaces the approved one once approved', async () => {
    const c = await ctx.api('post', '/incentive/sales-targets').send({ scope: 'agent', agentId: line.agent, period: line.month, targetAmount: 2500 });
    expect(c.status).toBe(201);
    expect(c.body.data.replacesId).toBeTruthy();
    await ctx.api('post', '/incentive/sales-targets/submit').send({ ids: [c.body.data.id] });
    expect((await as(checkerTok, 'post', '/incentive/sales-targets/decide').send({ ids: [c.body.data.id], decision: 'approve' })).status).toBe(200);
    const all = (await ctx.api('get', `/incentive/sales-targets?period=${line.month}&all=true`)).body.data.filter((t) => t.agentId === line.agent);
    expect(all.map((t) => t.status).sort()).toEqual(['approved', 'superseded']);
  });

  it('shows the commission of a sales unit against its target (Sales Target Variance)', async () => {
    const branch = await one("SELECT id, code, name FROM branches WHERE status = 'active' ORDER BY id LIMIT 1");
    const user = await one("SELECT id FROM users WHERE username = 'st.checker'");
    await query('UPDATE users SET branch_code = $1 WHERE id = $2', [branch.code, user.id]);
    await query('UPDATE commission_referrers SET user_id = $1 WHERE id = $2', [user.id, line.agent]);
    const c = await ctx.api('post', '/incentive/sales-targets').send({ scope: 'Sales unit', salesUnitId: branch.code, period: line.month, targetAmount: 100 });
    expect(c.status).toBe(201);
    await ctx.api('post', '/incentive/sales-targets/submit').send({ ids: [c.body.data.id] });
    await as(checkerTok, 'post', '/incentive/sales-targets/decide').send({ ids: [c.body.data.id], decision: 'approve' });
    const [y, m] = line.month.split('-').map(Number);
    const to = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const r = await ctx.api('post', '/reports/tisph-sales-target-variance/run').send({ ReportCriteria: 'Sales Unit', FromDate: `${line.month}-01`, ToDate: to, Branch: branch.code });
    expect(r.status).toBe(200);
    const row = (r.body.data || r.body).rows.find((x) => x.branch === branch.name && x.month === line.month);
    expect(Number(row.target)).toBe(100);
    expect(Number(row.variance)).toBeCloseTo(Number(row.commission) - 100, 2);
  });

  it('uploads targets from the template as drafts and lists the failed rows', async () => {
    const def = staticUploads().find((d) => d.id === 'sales-targets');
    expect(def.columns.map((c) => c.header)).toEqual(['TARGET_FOR', 'AGENT', 'SALES_UNIT', 'PERIOD', 'TARGET_AMOUNT', 'REMARKS']);
    expect(templateWorkbook(def)).toBeTruthy();
    const t = await ctx.api('get', '/incentive/sales-targets/upload/template');
    expect(t.status).toBe(200);
    const file = writeXlsx({ title: 'Data', sheets: [{ name: 'Data', columns: def.columns.map((c) => ({ key: c.key, header: c.header })), rows: [
      { scope: 'Agent', agent: line.agent, period: '2030-01', targetAmount: '5000.50' },
      { scope: 'Agent', agent: 'no-such-agent', period: '2030-01', targetAmount: '10' },
    ] }] });
    const r = await ctx.api('post', '/incentive/sales-targets/upload').attach('file', file, 'targets.xlsx');
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ loaded: 1, failed: 1 });
    expect(r.body.data.errors[0].message).toMatch(/Row 3: no-such-agent is not an active payee/);
    const drafts = (await ctx.api('get', '/incentive/sales-targets?period=2030-01&status=draft')).body.data;
    expect(drafts).toHaveLength(1);
    expect(drafts[0].targetAmount).toBe(5000.5);
  });
});

// ------------------------------------------------------------------------------------------------ NFR-17.1
describe('NFR-17.1 privacy notice and opt-out', () => {
  let client;
  beforeAll(async () => {
    const r = await ctx.api('post', '/clients').send({ firstName: 'Opta', lastName: 'Outa', emailId: 'opta.outa@example.ph', contactNumber: '09170001234', allowDuplicate: true });
    expect(r.status).toBe(201);
    client = r.body.data;
  });

  it('records the privacy notice acknowledgement with its version, the marketing consent and the e-mail opt-out', async () => {
    expect(client).toMatchObject({ privacyNoticeAcknowledged: false, marketingConsent: null, emailOptOut: false });
    const r = await ctx.api('put', `/clients/${client.id}`).send({ privacyNoticeAcknowledged: true, marketingConsent: true });
    expect(r.status).toBe(200);
    const c = r.body.data;
    expect(c).toMatchObject({ privacyNoticeAcknowledged: true, privacyNoticeVersion: '1.0', marketingConsent: true, emailOptOut: false });
    expect(c.privacyNoticeAcknowledgedAt).toBeTruthy();
    // the consent register the campaigns read follows the client record
    const reg = await one("SELECT granted FROM privacy_consents WHERE party_type = 'client' AND party_id = $1 AND purpose = 'marketing' ORDER BY id DESC LIMIT 1", [client.id]);
    expect(reg.granted).toBe(true);
    const { extra } = await one('SELECT extra FROM clients WHERE id = $1', [client.id]);
    expect(Object.keys(extra)).not.toEqual(expect.arrayContaining(['privacyNoticeAcknowledged']));
    expect(Object.keys(extra)).not.toEqual(expect.arrayContaining(['marketingConsent']));
  });

  it('treats campaign e-mail as non-transactional and the policy e-mails as transactional', async () => {
    expect(await isNonTransactional('campaign:NOV-PROMO')).toBe(true);
    expect(await isNonTransactional('policy_issued')).toBe(false);
    expect(await isNonTransactional('renewal-reminder')).toBe(false);
    expect(await isNonTransactional(null)).toBe(false);
  });

  it('does not queue marketing e-mail to a client who opted out; transactional e-mail still goes', async () => {
    expect(await optedOut('opta.outa@example.ph')).toBe(false);
    const r = await ctx.api('put', `/clients/${client.id}`).send({ emailOptOut: true });
    expect(r.body.data).toMatchObject({ emailOptOut: true });
    expect(r.body.data.emailOptOutAt).toBeTruthy();
    expect(await optedOut('Opta.Outa@example.ph')).toBe(true);
    expect(await optedOut('opta.outa@example.ph, someone.else@example.ph')).toBe(false);
    const marketing = await queueEmail({ to: 'opta.outa@example.ph', subject: 'Offer', html: '<p>Offer</p>', template: 'campaign:NOV-PROMO', entity: 'campaign', entityId: '1' });
    expect(marketing).toBeNull();
    const transactional = await queueEmail({ to: 'opta.outa@example.ph', subject: 'Your policy', html: '<p>Policy</p>', template: 'policy_issued', entity: 'policy', entityId: '1' });
    expect(transactional).toBeGreaterThan(0);
  });

  it('excludes an opted-out client from a campaign with the reason', async () => {
    const { segmentParties } = await import('../src/modules/campaigns/service.js');
    const parties = await segmentParties({ partyType: 'client' });
    const me = parties.find((p) => p.id === client.id);
    expect(me.opt_out).toBe(true);
    const preview = await ctx.api('post', '/campaigns/segments/preview').send({ criteria: { partyType: 'client' } });
    if (preview.status === 200) expect(Object.keys(preview.body.data.excluded)).toContain('Opted out of marketing e-mail');
  });
});
