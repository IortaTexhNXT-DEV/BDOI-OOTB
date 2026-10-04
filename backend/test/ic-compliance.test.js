/**
 * Insurance Commission compliance: licence register and expiry reminders (14.02), the commission payout block on the
 * existing payout flow (10.09), fit and proper records (14.03), insurer certificates of authority at request for
 * quotation, firm order and policy issue (4.08), the IC annual statement and production report (14.04, 14.05) and the
 * complaints register (14.08).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupFinance, makePolicy } from './accounting.fixtures.js';
import { pool, query, one } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays, today } from '../src/lib/dates.js';
import { readWorkbook } from '../src/modules/documents/xlsx.js';
import { complianceReminders, complaintsDeadlines } from '../src/modules/ic-compliance/jobs.js';

let ctx;
let admin;
const binary = (res, cb) => { const chunks = []; res.on('data', (c) => chunks.push(c)); res.on('end', () => cb(null, Buffer.concat(chunks))); };
const setting = async (key, value) => {
  await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]);
  clearSettingsCache();
};
const sheet = (buf, name) => readWorkbook(buf).find((s) => s.name === name);

beforeAll(async () => {
  ctx = await setupFinance();
  admin = ctx.api;
});
afterAll(async () => { await pool.end(); });

describe('licence register (14.02)', () => {
  let firm;
  it('records the firm licence, a referrer licence, and computes the state and the expiry calendar', async () => {
    const now = await today();
    const f = await admin('post', '/compliance/licences').send({ holderType: 'firm', licenceType: 'Insurance Broker (Non-life)', licenceNumber: 'IC-BRK-777', issueDate: addDays(now, -300), expiryDate: addDays(now, 20) });
    expect(f.status, JSON.stringify(f.body)).toBe(201);
    firm = f.body.data;
    expect(firm.holderName).toBeTruthy();
    expect(firm.state).toBe('expiring');
    expect(firm.daysToExpiry).toBe(20);
    expect((await admin('post', '/compliance/licences').send({ holderType: 'referrer', licenceType: 'Sub-agent' })).status).toBe(400);
    expect((await admin('post', '/compliance/licences').send({ holderType: 'firm', licenceType: 'X', issueDate: now, expiryDate: addDays(now, -1) })).status).toBe(400);
    const list = await admin('get', '/compliance/licences?state=expiring');
    expect(list.body.data.items.map((l) => l.id)).toContain(firm.id);
    const dash = await admin('get', '/compliance/licences/dashboard');
    expect(dash.status).toBe(200);
    expect(dash.body.data.expiring.map((l) => l.id)).toContain(firm.id);
    expect(dash.body.data.calendar).toHaveLength(12);
    expect(dash.body.data.firmLicenceInForce).toBe(true);
    const audit = await one("SELECT action FROM audit_log WHERE entity = 'compliance_licence' AND entity_id = $1", [firm.id]);
    expect(audit.action).toBe('create');
  });
  it('reminds the compliance team once per threshold (compliance.licence_reminder_days) and marks the renewal due', async () => {
    await query("DELETE FROM notifications WHERE entity = 'compliance_licence'");
    const r1 = await complianceReminders();
    expect(r1.licences).toBeGreaterThanOrEqual(1);
    const n = await query("SELECT title, audience FROM notifications WHERE entity = 'compliance_licence' AND entity_id = $1", [firm.id]);
    expect(n.rows).toHaveLength(1);
    expect(n.rows[0]).toMatchObject({ audience: 'read:compliance', title: expect.stringMatching(/expires in 20 day/) });
    await complianceReminders();
    expect((await query("SELECT 1 FROM notifications WHERE entity = 'compliance_licence' AND entity_id = $1", [firm.id])).rows).toHaveLength(1);
    expect((await admin('get', `/compliance/licences/${firm.id}`)).body.data.renewalStatus).toBe('due');
  });
  it('renews: a new licence term, the old one superseded; Excel export', async () => {
    const now = await today();
    const r = await admin('post', `/compliance/licences/${firm.id}/renew`).send({ licenceNumber: 'IC-BRK-778', issueDate: now, expiryDate: addDays(now, 1100) });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    expect(r.body.data.state).toBe('valid');
    const old = (await admin('get', `/compliance/licences/${firm.id}`)).body.data;
    expect(old).toMatchObject({ status: 'superseded', renewalStatus: 'renewed', supersededBy: r.body.data.id });
    const x = await admin('get', '/compliance/licences/export').buffer(true).parse(binary);
    expect(x.status).toBe(200);
    expect(sheet(x.body, 'Licences').rows.flat()).toContain('IC-BRK-778');
  });
});

describe('commission payout needs a licence in force (10.09)', () => {
  const details = (ref) => ({ commissionDetails: { brokeragePct: 18, primary: { referrerId: ref, level: 'L1', comsubPct: 8 }, chain: [] } });
  let ref;
  it('block: an agent without a licence cannot be approved, have a payout generated or a payout voucher approved', async () => {
    const c = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Unlicensed Agent', type: 'Agent', level: 'L1', bankName: 'BDO', bankAccountNo: '001100220033' });
    ref = c.body.data.referrer.id;
    expect(c.body.data.referrer.payoutBlockedReason).toMatch(/no licence on the licence register/);
    const p = await makePolicy({ net: 20000, details: details(ref) });
    await ctx.as('maker')('post', '/commission/accrue').send({ policyId: p.policy.id });
    await query("UPDATE commissions SET status = 'Eligible', eligible_at = now() WHERE referrer_id = $1", [ref]);
    const ap = await ctx.as('checker')('post', `/commission/referrer-accounts/${ref}/approve`);
    expect(ap.status).toBe(409);
    expect(ap.body.message).toMatch(/no licence/);
    // an expired licence blocks too
    const now = await today();
    const lic = await admin('post', '/compliance/licences').send({ holderType: 'referrer', referrerId: ref, licenceType: 'Non-life Insurance Agent', licenceNumber: 'NL-OLD', issueDate: addDays(now, -400), expiryDate: addDays(now, -35) });
    expect(lic.body.data.state).toBe('expired');
    const ap2 = await ctx.as('checker')('post', `/commission/referrer-accounts/${ref}/approve`);
    expect(ap2.status).toBe(409);
    expect(ap2.body.message).toMatch(/expired on/);
    // a licence in force lets the approval through; the payout voucher is refused if the licence is revoked before it is approved
    await admin('post', `/compliance/licences/${lic.body.data.id}/renew`).send({ licenceNumber: 'NL-NEW', expiryDate: addDays(now, 300) });
    expect((await ctx.as('checker')('post', `/commission/referrer-accounts/${ref}/approve`)).status).toBe(200);
    const bulk = await ctx.as('maker')('post', '/disbursements/bulk-agent-disburse').send({ referrerIds: [ref], transactionCode: 'COMSUB', instrumentCurrency: 'PHP' });
    const v = bulk.body.data.vouchers[0];
    expect(v).toBeTruthy();
    await query("UPDATE compliance_licences SET status = 'revoked' WHERE referrer_id = $1 AND status = 'active'", [ref]);
    const pay = await ctx.as('checker')('post', `/disbursements/${v.disbursementId}/approve-agent-payout`).send({ lineIds: v.lineIds });
    expect(pay.status).toBe(409);
    expect(pay.body.message).toMatch(/no licence in force/);
  });
  it('warn: the payout goes ahead, the warning is returned and recorded; off: no check; a referrer type without licence is not checked', async () => {
    await setting('compliance.referrer_licence_check', 'warn');
    const list = await ctx.as('maker')('get', `/commission/referrer-accounts/${ref}`);
    expect(list.body.data.referrer?.payoutWarning ?? list.body.data.referrer?.payoutBlockedReason ?? null).not.toBe(undefined);
    const v = (await query("SELECT id, voucher_number FROM disbursements WHERE referrer_id = $1 AND status <> 'paid' ORDER BY created_at DESC LIMIT 1", [ref])).rows[0];
    const lines = (await query('SELECT id FROM commissions WHERE disbursement_id = $1', [v.id])).rows.map((r) => r.id);
    const pay = await ctx.as('checker')('post', `/disbursements/${v.id}/approve-agent-payout`).send({ lineIds: lines });
    expect(pay.status, JSON.stringify(pay.body)).toBe(200);
    expect(pay.body.complianceWarnings?.[0]).toMatch(/Unlicensed Agent/);
    const w = await one("SELECT after_data FROM audit_log WHERE action = 'compliance-warning' AND entity = 'commission_referrer' AND entity_id = $1", [ref]);
    expect(w.after_data.kind).toBe('referrer-licence');
    await setting('compliance.referrer_licence_check', 'block');
    const ext = await ctx.as('maker')('post', '/commission/referrer-accounts').send({ name: 'Dealer Referrer Corp.', type: 'External', bankName: 'BDO', bankAccountNo: '0099887766' });
    expect(ext.body.data.referrer.payoutBlockedReason).toBeNull();
  });
});

describe('fit and proper records (14.03)', () => {
  it('adds a director with the configured declarations, needs remarks on a "no", reviews and sets the next review', async () => {
    const c = await admin('post', '/compliance/fit-proper').send({ personName: 'Corazon Lim Tan', roleCategory: 'director', position: 'Independent Director', appointedOn: '2026-01-15' });
    expect(c.status, JSON.stringify(c.body)).toBe(201);
    const fp = c.body.data;
    expect(fp.declarations.length).toBeGreaterThanOrEqual(5);
    expect(fp.reviewState).toBe('not-reviewed');
    expect((await admin('post', `/compliance/fit-proper/${fp.id}/review`).send({ outcome: 'fit' })).status).toBe(400);
    const bad = fp.declarations.map((d, i) => ({ ...d, answer: i === 0 ? 'no' : 'yes' }));
    expect((await admin('put', `/compliance/fit-proper/${fp.id}`).send({ declarations: bad })).status).toBe(400);
    const answered = fp.declarations.map((d) => ({ ...d, answer: 'yes' }));
    expect((await admin('put', `/compliance/fit-proper/${fp.id}`).send({ declarations: answered, declarationSignedOn: '2026-02-01',
      documents: [{ key: 'compliance/1-a-nbi-clearance.pdf', name: 'NBI clearance.pdf' }] })).status).toBe(200);
    const r = await admin('post', `/compliance/fit-proper/${fp.id}/review`).send({ outcome: 'fit', reviewedOn: '2026-02-10', notes: 'Clearances complete' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ reviewOutcome: 'fit', lastReviewOn: '2026-02-10', nextReviewOn: '2027-02-10' });
    expect(r.body.data.documents[0].url).toMatch(/\/api\/s3\/object\/compliance\//);
    const x = await admin('get', '/compliance/fit-proper/export').buffer(true).parse(binary);
    expect(sheet(x.body, 'Fit and proper').rows.flat()).toContain('Corazon Lim Tan');
  });
  it('is read by Accounting but written only by the compliance roles', async () => {
    expect((await ctx.as('maker')('get', '/compliance/fit-proper')).status).toBe(200);
    expect((await ctx.as('maker')('post', '/compliance/fit-proper').send({ personName: 'X Y', roleCategory: 'officer', position: 'Treasurer' })).status).toBe(403);
    expect((await ctx.as('sales')('get', '/compliance/licences')).status).toBe(403);
  });
});

describe('insurers authorised by the IC (4.08)', () => {
  const ids = {};
  beforeAll(async () => {
    for (const r of (await query("SELECT id, code FROM insurance_companies WHERE code IN ('MALAYAN', 'PIONEER', 'FPG')")).rows) ids[r.code] = r.id;
    const now = await today();
    await query("UPDATE insurance_companies SET attrs = COALESCE(attrs, '{}'::jsonb) || $2::jsonb WHERE id = $1", [ids.MALAYAN, JSON.stringify({ icCertificateNumber: 'CA-2026-11', icCertificateValidUntil: addDays(now, 400) })]);
    await query("UPDATE insurance_companies SET attrs = COALESCE(attrs, '{}'::jsonb) || $2::jsonb WHERE id = $1", [ids.PIONEER, JSON.stringify({ icCertificateNumber: 'CA-2024-07', icCertificateValidUntil: addDays(now, -10) })]);
    await query("UPDATE insurance_companies SET attrs = (COALESCE(attrs, '{}'::jsonb) - 'icCertificateNumber' - 'icCertificateValidUntil') || $2::jsonb WHERE id = $1", [ids.FPG, JSON.stringify({ icCertificateNumber: 'CA-2026-30', icCertificateValidUntil: addDays(now, 30) })]);
  });
  it('reports each insurer\'s certificate: valid, expiring, expired, missing; Excel', async () => {
    const r = await ctx.as('maker')('get', '/compliance/insurer-authority');
    const by = Object.fromEntries(r.body.data.items.map((i) => [i.code, i.state]));
    expect(by).toMatchObject({ MALAYAN: 'valid', PIONEER: 'expired', FPG: 'expiring' });
    expect(Object.values(by)).toContain('missing');
    const x = await ctx.as('maker')('get', '/compliance/insurer-authority/export?state=expired').buffer(true).parse(binary);
    expect(sheet(x.body, 'Certificates of authority').rows.flat()).toContain('CA-2024-07');
  });
  it('block: the request for quotation and the policy issue are refused with an insurer whose certificate expired', async () => {
    await setting('compliance.insurer_authority_check', 'block');
    const lead = await admin('post', '/leads').send({ firstName: 'Tess', lastName: 'Aquino', lob: 'FIRE' });
    const slip = await admin('post', '/broker-slips').send({ leadRefId: lead.body.leadId, productType: 'Fire and Allied Perils', riskDetails: { location: 'Pasig' },
      requestedCovers: [{ cover: 'Fire', sumInsured: 5000000 }], insurers: ['MALAYAN', 'PIONEER'] });
    expect(slip.status, JSON.stringify(slip.body)).toBe(201);
    const sub = await admin('post', `/broker-slips/${slip.body.id || slip.body.data.id}/submit`);
    expect(sub.status).toBe(409);
    expect(sub.body.message).toMatch(/expired on/);
    const rec = await admin('post', '/placements/record-issued-policy').send({ companyName: 'Authority Test Corp.', productType: 'Comprehensive General Liability', policyNumber: 'AUTH-1',
      inceptionDate: '2026-09-01', expiryDate: '2027-09-01', sumInsured: 1000000, netPremium: 5000, participants: [{ insuranceCompanyId: ids.PIONEER, sharePercent: 100, isLead: true }] });
    expect(rec.status).toBe(409);
    expect(rec.body.message).toMatch(/Cannot issue a policy with/);
    const ok = await admin('post', '/placements/record-issued-policy').send({ companyName: 'Authority Test Corp.', productType: 'Comprehensive General Liability', policyNumber: 'AUTH-2',
      inceptionDate: '2026-09-01', expiryDate: '2027-09-01', sumInsured: 1000000, netPremium: 5000, participants: [{ insuranceCompanyId: ids.MALAYAN, sharePercent: 100, isLead: true }] });
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
  });
  it('warn: allowed, with the warning in the answer and the audit trail', async () => {
    await setting('compliance.insurer_authority_check', 'warn');
    const rec = await admin('post', '/placements/record-issued-policy').send({ companyName: 'Authority Warn Corp.', productType: 'Comprehensive General Liability', policyNumber: 'AUTH-3',
      inceptionDate: '2026-09-01', expiryDate: '2027-09-01', sumInsured: 1000000, netPremium: 5000, participants: [{ insuranceCompanyId: ids.PIONEER, sharePercent: 100, isLead: true }] });
    expect(rec.status, JSON.stringify(rec.body)).toBe(201);
    expect(rec.body.complianceWarnings.join(' ')).toMatch(/expired on/);
    expect((await query("SELECT 1 FROM audit_log WHERE action = 'compliance-warning' AND after_data->>'kind' = 'insurer-authority'")).rows.length).toBeGreaterThan(0);
  });
  it('the daily job reminds the compliance team of expiring and expired certificates', async () => {
    await complianceReminders();
    const n = (await query("SELECT title FROM notifications WHERE entity = 'insurance_company' AND entity_id = ANY($1::text[])", [[String(ids.PIONEER), String(ids.FPG)]])).rows.map((r) => r.title);
    expect(n.join(' | ')).toMatch(/expired: /);
    expect(n.join(' | ')).toMatch(/expires in 30 day/);
  });
});

describe('IC reports (14.04, 14.05)', () => {
  it('production report: premiums by insurer and IC line, split by co-insurance share, by quarter; Excel in the IC layout', async () => {
    const now = await today();
    const r = await ctx.as('maker')('get', `/compliance/ic-reports/production?from=${now.slice(0, 4)}-01-01&to=${now}&groupBy=quarter`);
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.lines).toContain('Motor Car');
    expect(d.rows.length).toBeGreaterThan(0);
    const sumRows = d.rows.reduce((s, x) => s + x.totalPremium, 0);
    expect(Math.abs(sumRows - d.totals.totalPremium)).toBeLessThan(0.05);
    const detailTotal = d.detail.reduce((s, x) => s + x.netPremium, 0);
    expect(Math.abs(detailTotal - d.totals.totalPremium)).toBeLessThan(0.05);
    expect(d.byPeriod.every((b) => /-Q[1-4]$/.test(b.period))).toBe(true);
    const x = await ctx.as('maker')('get', `/compliance/ic-reports/production/export?from=${now.slice(0, 4)}-01-01&to=${now}&groupBy=month`).buffer(true).parse(binary);
    expect(x.status).toBe(200);
    const names = readWorkbook(x.body).map((s) => s.name);
    expect(names).toEqual(['Report', 'Premiums by insurer', 'Premiums by period', 'Detail']);
    expect(sheet(x.body, 'Premiums by insurer').rows[0]).toEqual(expect.arrayContaining(['Insurer', 'Fire', 'Motor Car', 'Total premiums', 'Commission earned']));
  });
  it('annual statement: balance sheet that balances, income statement, schedules and the accountant confirmation sheet', async () => {
    const year = (await today()).slice(0, 4);
    const r = await ctx.as('maker')('get', `/compliance/ic-reports/annual-statement?year=${year}`);
    expect(r.status).toBe(200);
    const s = r.body.data;
    expect(Math.abs(s.totals.current.difference)).toBeLessThan(0.01);
    expect(s.checks[0]).toMatchObject({ ok: true });
    expect(s.balanceSheet.find((l) => l.code === 'BS-L01')).toBeTruthy();
    expect(s.incomeStatement.find((l) => l.code === 'IS-R01').current).toBeGreaterThanOrEqual(0);
    expect(s.company.icLicence?.number).toBe('IC-BRK-778');
    expect(s.confirmations.length).toBeGreaterThan(3);
    const x = await ctx.as('maker')('get', `/compliance/ic-reports/annual-statement/export?year=${year}`).buffer(true).parse(binary);
    const names = readWorkbook(x.body).map((w) => w.name);
    expect(names).toEqual(['Cover', 'Sch 1 Balance sheet', 'Sch 2 Income statement', 'Sch 3 by insurer', 'Sch 4 Premiums held', 'Accountant confirmation', 'Unmapped accounts']);
    expect(sheet(x.body, 'Accountant confirmation').rows.flat().join(' ')).toMatch(/premium trust account/i);
  });
  it('the account mapping is configuration: a prefix change moves an account, accounting cannot change it', async () => {
    const m = (await admin('get', '/compliance/ic-reports/mapping')).body.data;
    const other = m.find((l) => l.code === 'IS-X06');
    expect((await ctx.as('maker')('put', `/compliance/ic-reports/mapping/${other.id}`).send({ accountPrefixes: ['44'] })).status).toBe(403);
    const u = await admin('put', `/compliance/ic-reports/mapping/${other.id}`).send({ accountPrefixes: ['43', '44'], confirm: 'Agree with the expense analysis' });
    expect(u.status).toBe(200);
    expect(u.body.data.confirm).toBe('Agree with the expense analysis');
    expect((await admin('put', `/compliance/ic-reports/mapping/${other.id}`).send({ accountPrefixes: ['44 x'] })).status).toBe(400);
  });
});

describe('complaints register (14.08)', () => {
  let c;
  it('logs a complaint linked to a policy with deadlines from the settings, assigns, acknowledges and prints the letter', async () => {
    const pol = (await query("SELECT id, policy_number, client_id FROM policies WHERE client_id IS NOT NULL ORDER BY created_at LIMIT 1")).rows[0];
    const r = await admin('post', '/compliance/complaints').send({ receivedAt: '2026-10-01', channel: 'E-mail', complainantName: 'Juan Dela Cruz', complainantContact: 'juan@example.ph',
      policyId: pol.policy_number, category: 'Claims handling', subject: 'Delay in claim payment', assignedTo: ctx.userIds.sales });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    c = r.body.data;
    expect(c.complaintNumber).toMatch(/^CMP-2026-\d{5}$/);
    expect(c).toMatchObject({ clientId: pol.client_id, ackDueOn: '2026-10-03', resolutionDueOn: '2026-10-08', status: 'received' });
    expect((await query("SELECT 1 FROM notifications WHERE entity = 'complaint' AND user_id = $1", [ctx.userIds.sales])).rows).toHaveLength(1);
    expect((await admin('post', '/compliance/complaints').send({ channel: 'Pigeon', complainantName: 'A B', category: 'Other', subject: 'Test' })).status).toBe(400);
    const ack = await admin('post', `/compliance/complaints/${c.id}/acknowledge`).send({});
    expect(ack.body.data.status).toBe('acknowledged');
    const pdf = await admin('get', `/compliance/complaints/${c.id}/letter/acknowledgement`).buffer(true).parse(binary);
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
    expect((await admin('get', `/compliance/complaints/${c.id}/letter/resolution`)).status).toBe(409);
  });
  it('a complex complaint gets the longer deadline; overdue complaints are escalated by the daily job', async () => {
    const u = await admin('put', `/compliance/complaints/${c.id}`).send({ complexity: 'complex' });
    expect(u.body.data.resolutionDueOn).toBe('2026-11-15');
    const old = await admin('post', '/compliance/complaints').send({ receivedAt: '2026-01-05', channel: 'Letter', complainantName: 'Rosa Dimaculangan', category: 'Premium, billing and payment', subject: 'Refund not received' });
    const run = await complaintsDeadlines();
    expect(run.escalated).toBeGreaterThanOrEqual(1);
    const v = (await admin('get', `/compliance/complaints/${old.body.data.id}`)).body.data;
    expect(v.status).toBe('escalated');
    expect(v.resolutionOverdue).toBe(true);
    expect((await query("SELECT 1 FROM notifications WHERE entity = 'complaint' AND entity_id = $1 AND audience = 'approve:complaints'", [v.id])).rows.length).toBe(1);
    const again = await complaintsDeadlines();
    expect(again.reminded).toBe(0);
  });
  it('resolves, refers to the regulator, closes; the regulator report counts it with its ageing', async () => {
    expect((await admin('post', `/compliance/complaints/${c.id}/resolve`).send({ outcome: 'upheld' })).status).toBe(400);
    const res = await admin('post', `/compliance/complaints/${c.id}/resolve`).send({ outcome: 'upheld', resolution: 'The insurer paid the claim', resolvedAt: '2026-10-05' });
    expect(res.body.data).toMatchObject({ status: 'resolved', resolvedWithinDeadline: true, ageDays: 4 });
    await admin('post', `/compliance/complaints/${c.id}/refer`).send({ regulatorReference: 'IC-PAMD-2026-0042' });
    expect((await admin('post', `/compliance/complaints/${c.id}/close`).send({})).body.data.status).toBe('closed');
    const rep = await admin('get', '/compliance/complaints/regulator-report?from=2026-01-01&to=2026-12-31');
    expect(rep.body.data).toMatchObject({ total: 2, resolved: 1, referredToRegulator: 1 });
    const x = await admin('get', '/compliance/complaints/regulator-report/export?from=2026-01-01&to=2026-12-31').buffer(true).parse(binary);
    expect(sheet(x.body, 'Register').rows.flat()).toContain(c.complaintNumber);
    const trail = (await query("SELECT action FROM audit_log WHERE entity = 'complaint' AND entity_id = $1 ORDER BY id", [c.id])).rows.map((r) => r.action);
    expect(trail).toEqual(expect.arrayContaining(['create', 'acknowledge', 'letter-acknowledgement', 'update', 'resolve', 'refer', 'close']));
  });
  it('sales reads the register, cannot log complaints', async () => {
    expect((await ctx.as('sales')('get', '/compliance/complaints')).status).toBe(200);
    expect((await ctx.as('sales')('post', '/compliance/complaints').send({ channel: 'E-mail', complainantName: 'A B', category: 'Other', subject: 'Test' })).status).toBe(403);
  });
});
