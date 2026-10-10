import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool, query, one, many } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { today, addDays } from '../src/lib/dates.js';
import { claimServiceLevels } from '../src/jobs/handlers.js';
import { docVars, loadRow } from '../src/modules/claims/service.js';

let ctx;
let todayStr;
const tok = {};
const ids = {};
const as = (who, m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${tok[who]}`);
const setSetting = async (key, value) => { await query('UPDATE app_settings SET value = $2 WHERE key = $1', [key, JSON.stringify(value)]); clearSettingsCache(); };
const binary = (res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); };

async function makeUser(username, roles, displayName = username) {
  expect((await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName, email: `${username}@example.ph`, roles })).status).toBe(201);
  ids[username] = (await one('SELECT id FROM users WHERE username = $1', [username])).id;
  tok[username] = await loginAs(ctx.app, username, 'Welcome@123');
}
async function policy(id, { product = 'MOTOR', unpaid = 0, si = 1000000, premium = 30000 } = {}) {
  await query('INSERT INTO clients(id, client_code, display_name, email, phone) VALUES ($1, $2, $3, $4, $5)', [`cl_${id}`, `CL-${id}`, `Client ${id}`, `${id}@example.ph`, '+639170000000']);
  await query(`INSERT INTO policies(id, policy_number, client_id, product_id, insurance_company_id, owner_user_id, status, inception_date, expiry_date, sum_insured, premium_total)
    SELECT $1, $2, $3, (SELECT id FROM products WHERE code = $4), (SELECT id FROM insurance_companies WHERE code = 'MAPFRE'), $5, 'active', $6::date - 100, $6::date + 265, $7, $8`,
  [id, `POL-${id}`, `cl_${id}`, product, ids['cc.sales'], todayStr, si, premium]);
  if (unpaid) await query("INSERT INTO receivables(bill_number, policy_id, client_id, amount, balance, due_date, status) VALUES ($1, $2, $3, $4, $4, $5::date - 10, 'open')", [`INV-${id}`, id, `cl_${id}`, unpaid, todayStr]);
}
const fnol = (who, f) => {
  let r = as(who, 'post', '/claims');
  const body = { lob: 'MOTOR', claimType: 'Motor', typeOfIncident: 'Own Damage - Collision / Accident', dateOfIncident: addDays(todayStr, -3), estimatedClaimAmount: 50000,
    addressOfIncident: 'EDSA', cityOfIncident: 'Makati', provinceOfIncident: 'Metro Manila', driverDetails: { driverName: 'Juan Driver' }, ...f };
  for (const [k, v] of Object.entries(body)) r = r.field(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  return r;
};
async function claimInReview(id, f = {}) {
  await policy(id);
  const c = await fnol('cc.ops', { policyRefId: id, ...f });
  expect(c.status, JSON.stringify(c.body)).toBe(201);
  expect((await as('cc.unithead', 'put', `/claims/updatestatus/${c.body.data.id}`).send({ claimStatus: 'Processing' })).status).toBe(200);
  return c.body.data;
}
const settle = (who, id, f) => {
  let r = as(who, 'put', `/claims/settle/${id}`);
  for (const [k, v] of Object.entries({ settlementType: 'Cheque', settlementIssueDate: todayStr, settlementDate: todayStr, ...f })) r = r.field(k, String(v));
  return r;
};

beforeAll(async () => {
  ctx = await setup();
  todayStr = await today();
  await setSetting('calendar.working_weekdays', [1, 2, 3, 4, 5, 6, 7]);
  await makeUser('cc.sales', ['tis-sales-associate'], 'Sofia Sales');
  await makeUser('cc.ops', ['tis-ops-associate'], 'Oliver Ops');
  await makeUser('cc.officer', ['tis-ops-officer'], 'Olivia Officer');
  await makeUser('cc.unithead', ['tis-ops-unit-head'], 'Ursula Head');
  await makeUser('cc.gm', ['tis-general-manager'], 'Gerry Manager');
  await makeUser('cc.pdu', ['tis-ccd-pdu']);
  await makeUser('cc.bp', ['tis-ccd-bp'], 'Bea Receipting');
  await makeUser('cc.recon', ['tis-ccd-recon'], 'Rico Recon');
  await makeUser('cc.finance', ['tis-finance'], 'Fiona Finance');
});
afterAll(async () => { await new Promise((r) => { setTimeout(r, 100); }); await pool.end(); });

describe('first notice of loss', () => {
  it('validates the estimate and the source, refuses a duplicate unless confirmed and flags a late intimation', async () => {
    await policy('f1');
    const neg = await fnol('cc.ops', { policyRefId: 'f1', estimatedClaimAmount: -1 });
    expect(neg.status).toBe(400);
    expect(neg.body.errors[0]).toMatchObject({ path: 'estimatedClaimAmount', message: 'The estimate cannot be negative' });
    expect((await fnol('cc.ops', { policyRefId: 'f1', estimatedClaimAmount: 'abc' })).body.errors[0].message).toBe('The estimate must be an amount');
    expect((await fnol('cc.ops', { policyRefId: 'f1', fnolSource: 'Pigeon' })).body.errors[0].path).toBe('fnolSource');
    const first = await fnol('cc.ops', { policyRefId: 'f1', fnolSource: 'TFS', lossExtent: 'total', dateOfIncident: addDays(todayStr, -40) });
    expect(first.status).toBe(201);
    const c = first.body.data;
    expect(c).toMatchObject({ fnolSource: 'TFS', lossExtent: 'total', lateIntimation: true });
    // Pre-BSM M15: a motor total loss is followed up 60 days after the report
    expect(c.claimDueDate).toBe(addDays(todayStr, 60));
    expect(c.history.map((h) => h.note)).toContain('Late intimation: reported 40 days after the loss (more than 30)');
    expect(c.handlerName).toMatch(/Oliver Ops|Olivia Officer/);
    const alert = await one("SELECT title FROM notifications WHERE entity = 'claim' AND entity_id = $1 AND type = 'alert'", [c.id]);
    expect(alert.title).toBe(`Late intimation: claim ${c.claimNumber}`);
    const dup = await fnol('cc.ops', { policyRefId: 'f1', dateOfIncident: addDays(todayStr, -40) });
    expect(dup.status).toBe(409);
    expect(dup.body.message).toMatch(new RegExp(`Claim ${c.claimNumber} is already registered on policy POL-f1 for a loss on \\d{2}/\\d{2}/\\d{4}`));
    const confirmed = await fnol('cc.ops', { policyRefId: 'f1', dateOfIncident: addDays(todayStr, -40), confirmDuplicate: true });
    expect(confirmed.status).toBe(201);
    expect(confirmed.body.data.history.some((h) => h.note === `Registered although claim ${c.claimNumber} has the same date of loss`)).toBe(true);
  });

  it('assigns new claims to the Operations users with the fewest open claims', async () => {
    await policy('f2');
    const handlers = [];
    for (let i = 0; i < 3; i += 1) handlers.push((await fnol('cc.ops', { policyRefId: 'f2', dateOfIncident: addDays(todayStr, -i - 1) })).body.data.handlerUserId);
    const counts = await many("SELECT handler_user_id, count(*)::int AS n FROM claims WHERE handler_user_id = ANY($1) AND status NOT IN ('settled', 'closed', 'rejected', 'cancelled') GROUP BY 1", [[ids['cc.ops'], ids['cc.officer']]]);
    expect(Math.abs(counts[0].n - (counts[1]?.n || 0))).toBeLessThanOrEqual(1);
    expect(handlers.every((h) => [ids['cc.ops'], ids['cc.officer']].includes(h))).toBe(true);
  });

  it('shows the outstanding premium, the claims ratio and same-day claims before registering; the TISPH rule registers on unpaid premium', async () => {
    await policy('f3', { unpaid: 12500, premium: 20000 });
    await query("INSERT INTO claims(claim_number, policy_id, client_id, status, loss_date, estimate_amount, settled_amount) VALUES ('CLM-F3-OLD', 'f3', 'cl_f3', 'settled', $1::date - 200, 9000, 8000)", [todayStr]);
    const r = await as('cc.ops', 'get', `/claims/registration-check?policyId=f3&lossDate=${addDays(todayStr, -200)}&reportedDate=${todayStr}`);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ outstandingPremium: 12500, blockUnpaidPremium: false, claimsRatio: { claims: 1, claimsAmount: 8000, premium: 20000, ratio: 40 } });
    expect(r.body.data.intimation).toMatchObject({ days: 200, late: true });
    expect(r.body.data.duplicates).toEqual([{ claimNumber: 'CLM-F3-OLD', status: 'settled', lossCause: null }]);
    expect((await as('cc.sales', 'get', '/claims/registration-check?policyId=f3')).status).toBe(403);
    expect((await fnol('cc.ops', { policyRefId: 'f3' })).status).toBe(201);
  });

  it('refuses a loss date in the future on update', async () => {
    await policy('f4');
    const c = (await fnol('cc.ops', { policyRefId: 'f4' })).body.data;
    const u = await as('cc.ops', 'put', `/claims/${c.id}`).field('dateOfIncident', addDays(todayStr, 1));
    expect(u.status).toBe(422);
    expect(u.body.message).toBe('Date of loss cannot be in the future');
    expect((await as('cc.ops', 'put', `/claims/${c.id}`).field('estimatedClaimAmount', '-5')).status).toBe(400);
  });
});

describe('Credit Life death claims', () => {
  it('accepts death benefit claims only, acknowledges them with the empathy letter and follows up from the death verification', async () => {
    await policy('cl1', { product: 'CL-VOL', si: 1000000, premium: 3680 });
    const notDeath = await fnol('cc.ops', { policyRefId: 'cl1', lob: 'LIFE', claimType: 'Life', typeOfIncident: 'Disability' });
    expect(notDeath.status).toBe(422);
    expect(notDeath.body.message).toMatch(/death benefit claims only/);
    const c = (await fnol('cc.ops', { policyRefId: 'cl1', lob: 'LIFE', claimType: 'Life', typeOfIncident: 'Death - Natural Causes / Illness' })).body.data;
    expect(c.isDeathClaim).toBe(true);
    expect(c.claimDueDate).toBe(addDays(todayStr, 60));
    const pdf = await as('cc.ops', 'get', `/claims/getdocuments/${c.id}?documentName=${encodeURIComponent('Claims Acknowledgement Letter')}`).buffer(true).parse(binary);
    expect(pdf.headers['content-disposition']).toContain('Claims Empathy Letter.pdf');
    const v = await as('cc.ops', 'post', `/claims/${c.id}/verify-death`).send({ verifiedOn: addDays(todayStr, -1), note: 'PSA certificate' });
    expect(v.status).toBe(200);
    expect(v.body.data).toMatchObject({ deathVerifiedOn: addDays(todayStr, -1), claimDueDate: addDays(todayStr, 59) });
    expect((await as('cc.ops', 'post', `/claims/${c.id}/verify-death`).send({ verifiedOn: addDays(todayStr, 2) })).status).toBe(400);
  });

  it('lists the documents still to send on the acknowledgement letter', async () => {
    await policy('ak1');
    const c = (await fnol('cc.ops', { policyRefId: 'ak1' })).body.data;
    const vars = await docVars(await loadRow(c.id));
    expect(vars.documentChecklist).not.toBe('');
    expect(vars.documentChecklist).not.toBe('-');
  });
});

describe('rejection with its reason, and cancellation of a claim registered in error', () => {
  it('needs the reason of a rejection and e-mails it to the client', async () => {
    const c = await claimInReview('rj1');
    const none = await as('cc.unithead', 'put', `/claims/rejectclaim/${c.id}`).send({});
    expect(none.status).toBe(400);
    expect(none.body.errors[0].path).toBe('reason');
    const r = await as('cc.unithead', 'put', `/claims/rejectclaim/${c.id}`).send({ reasonCode: 'REP-NOTCOVERED', reason: 'Flood is excluded' });
    expect(r.status).toBe(200);
    expect(r.body.data.rejectedReason).toBe('Cause of Loss Not Covered: Flood is excluded');
    const mail = await one("SELECT * FROM email_outbox WHERE entity = 'claim' AND entity_id = $1 AND template = 'claim_rejection'", [c.id]);
    expect(mail.to_address).toBe('rj1@example.ph');
    expect(mail.body_html).toContain('Cause of Loss Not Covered: Flood is excluded');
  });

  it('cancels a claim registered in error with a coded reason; never once a settlement is submitted', async () => {
    await policy('cn1');
    const c = (await fnol('cc.ops', { policyRefId: 'cn1' })).body.data;
    expect((await as('cc.ops', 'put', `/claims/cancel/${c.id}`).send({ reasonCode: 'CCN-DUPLICATE', note: 'x' })).status).toBe(403);
    expect((await as('cc.unithead', 'put', `/claims/cancel/${c.id}`).send({ reasonCode: 'REP-LATE', note: 'x' })).status).toBe(400);
    const r = await as('cc.unithead', 'put', `/claims/cancel/${c.id}`).send({ reasonCode: 'CCN-DUPLICATE', note: 'Same loss as the claim of yesterday' });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ lifecycleStatus: 'cancelled', status: 'Cancelled', cancelledReasonCode: 'CCN-DUPLICATE' });
    expect((await as('cc.unithead', 'put', `/claims/updatestatus/${c.id}`).send({ claimStatus: 'Processing' })).status).toBe(409);
    const s = await claimInReview('cn2');
    await settle('cc.unithead', s.id, { settlementAmount: 1000 });
    expect((await as('cc.unithead', 'put', `/claims/cancel/${s.id}`).send({ reasonCode: 'CCN-ERROR', note: 'x' })).status).toBe(409);
  });
});

describe('partial and final settlements within the Authority Matrix', () => {
  let c;
  it('approves no more than requested, releases a partial settlement and keeps the claim open', async () => {
    c = await claimInReview('st1');
    const p = await settle('cc.ops', c.id, { settlementKind: 'partial', settlementAmount: 40000 });
    expect(p.status).toBe(403);
    const sub = await settle('cc.unithead', c.id, { settlementKind: 'partial', settlementAmount: 40000 });
    expect(sub.status).toBe(200);
    expect(sub.body.data.lifecycleStatus).toBe('pending-approval');
    const over = await as('cc.gm', 'put', `/claims/approve-settlement/${c.id}`).send({ decision: 'approve', approvedAmount: 45000 });
    expect(over.status).toBe(422);
    expect(over.body.message).toMatch(/cannot exceed the settlement requested/);
    const ap = await as('cc.gm', 'put', `/claims/approve-settlement/${c.id}`).send({ decision: 'approve', approvedAmount: 30000 });
    expect(ap.status).toBe(200);
    expect(ap.body.data).toMatchObject({ lifecycleStatus: 'partially-settled', status: 'Partially Settled', approvedAmount: 30000, settledAmount: 30000, isOpen: true });
    expect(ap.body.data.settlementRequestedBy).toBe('Ursula Head');
    expect(ap.body.data.settlementApprovedBy).toBe('Gerry Manager');
    expect(ap.body.data.settlements).toEqual([expect.objectContaining({ seq: 1, kind: 'partial', amount: 40000, approvedAmount: 30000, status: 'approved', requestedBy: 'Ursula Head', decidedBy: 'Gerry Manager' })]);
  });

  it('completes the claim with the final settlement; the approver stays within the limit', async () => {
    const fin = await settle('cc.gm', c.id, { settlementAmount: 600000 });
    expect(fin.status).toBe(200);
    const over = await as('cc.unithead', 'put', `/claims/approve-settlement/${c.id}`).send({ decision: 'approve' });
    expect(over.status).toBe(403);
    expect(over.body.message).toMatch(/above your approval authority of PHP 500,000\.00/);
    const back = await as('cc.unithead', 'put', `/claims/approve-settlement/${c.id}`).send({ decision: 'return', note: 'Too high' });
    expect(back.body.data.lifecycleStatus).toBe('partially-settled');
    await settle('cc.gm', c.id, { settlementAmount: 50000 });
    const ok = await as('cc.unithead', 'put', `/claims/approve-settlement/${c.id}`).send({ decision: 'approve' });
    expect(ok.status).toBe(200);
    expect(ok.body.data).toMatchObject({ lifecycleStatus: 'settled', settledAmount: 80000, approvedAmount: 80000 });
    expect(ok.body.data.settlements.map((s) => [s.kind, s.status, s.approvedAmount])).toEqual([['partial', 'approved', 30000], ['final', 'returned', null], ['final', 'approved', 50000]]);
  });

  it('refuses the release of an approved settlement by its requester', async () => {
    await setSetting('claims.auto_settle_on_approval', false);
    const x = await claimInReview('st2');
    await settle('cc.unithead', x.id, { settlementAmount: 20000 });
    expect((await as('cc.gm', 'put', `/claims/approve-settlement/${x.id}`).send({ decision: 'approve' })).body.data.lifecycleStatus).toBe('approved');
    expect((await settle('cc.unithead', x.id, {})).status).toBe(403);
    const rel = await settle('cc.gm', x.id, {});
    expect(rel.body.data.lifecycleStatus).toBe('settled');
    await setSetting('claims.auto_settle_on_approval', true);
  });

  it('refuses an approver without a claim settlement limit when a limit is required', async () => {
    await setSetting('claims.require_authority_limit', true);
    await makeUser('cc.claimsrole', ['claims']);
    const x = await claimInReview('st3');
    await settle('cc.unithead', x.id, { settlementAmount: 1000 });
    await query("UPDATE authority_limits SET status = 'retired' WHERE transaction_type = 'claim_settlement' AND role_code = 'claims'");
    const r = await as('cc.claimsrole', 'put', `/claims/approve-settlement/${x.id}`).send({ decision: 'approve' });
    expect(r.status).toBe(403);
    expect(r.body.message).toMatch(/no approval authority for Claim settlement approval/);
    await setSetting('claims.require_authority_limit', false);
  });
});

describe('insurer advice, communications and the end-of-day service levels', () => {
  it('records the insurer advice with the authorisation code and the offered amount', async () => {
    const c = await claimInReview('in1');
    expect((await as('cc.ops', 'put', `/claims/${c.id}/insurer-advice`).send({ adviceStatus: 'maybe' })).status).toBe(400);
    const r = await as('cc.ops', 'put', `/claims/${c.id}/insurer-advice`).send({ insurerClaimNumber: 'MAP-77', insurerHandler: 'Rosa Lim', insurerHandlerContact: 'rosa@mapfre.example',
      adviceStatus: 'loa-issued', authorisationCode: 'AUTH-1', offerAmount: 42000 });
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ insuranceCompanyClaimNumber: 'MAP-77', insurerHandler: 'Rosa Lim', insurerAdvice: 'loa-issued', insurerAdviceLabel: 'LOA issued', authorisationCode: 'AUTH-1', insurerOfferAmount: 42000 });
    const trail = (await as('cc.ops', 'get', `/claims/audit-trail/${c.id}`)).body.data;
    expect(trail.some((t) => t.action === 'Insurer Advice Recorded' && t.fieldName === 'authorisationCode' && t.newValue === 'AUTH-1')).toBe(true);
    expect((await as('cc.sales', 'put', `/claims/${c.id}/insurer-advice`).send({ adviceStatus: 'approved' })).status).toBe(403);
  });

  it('logs communications with follow-up dates and e-mails a follow-up to the insurer', async () => {
    const c = await claimInReview('in2');
    expect((await as('cc.ops', 'post', `/claims/${c.id}/communications`).send({ party: 'insurer', method: 'Phone', message: 'x', followUpDate: addDays(todayStr, -1) })).status).toBe(400);
    const log = await as('cc.ops', 'post', `/claims/${c.id}/communications`).send({ party: 'client', direction: 'in', method: 'Phone', message: 'Client asked for the status', followUpDate: addDays(todayStr, 2) });
    expect(log.status).toBe(201);
    expect(log.body.data).toMatchObject({ partyLabel: 'Client', followUpDate: addDays(todayStr, 2), overdue: false, by: 'Oliver Ops' });
    const f = await as('cc.ops', 'post', `/claims/${c.id}/insurer-follow-up`).send({ message: 'May we have the LOA?', followUpDate: addDays(todayStr, 1) });
    expect(f.status).toBe(200);
    const mail = await one("SELECT * FROM email_outbox WHERE entity = 'claim' AND entity_id = $1 AND template = 'claim_insurer_followup'", [c.id]);
    expect(mail.body_html).toContain('May we have the LOA?');
    const list = (await as('cc.ops', 'get', `/claims/${c.id}/communications`)).body.data;
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ party: 'insurer', method: 'Email', emailed: true });
    const done = await as('cc.ops', 'post', `/claims/${c.id}/communications/${log.body.data.id}/done`);
    expect(done.body.data.followUpDone).toBe(true);
    expect((await as('cc.ops', 'post', `/claims/${c.id}/communications/${log.body.data.id}/done`)).status).toBe(409);
  });

  it('e-mails the claim file with the documents submitted to the insurer', async () => {
    await setSetting('claims.require_documents_before_submission', false);
    const c = await claimInReview('in3');
    const list = (await as('cc.ops', 'get', `/claim-documents/claims/${c.id}`)).body.data;
    await as('cc.ops', 'patch', `/claim-documents/claims/${c.id}/items/${list.items[0].id}`).send({ status: 'received', receivedOn: todayStr });
    const s = await as('cc.ops', 'post', `/claim-documents/claims/${c.id}/submit-to-insurer`).send({ note: 'Original copies to follow' });
    expect(s.status).toBe(200);
    expect(s.body.data.insurerEmail.documents).toEqual([list.items[0].documentName]);
    const mail = await one("SELECT * FROM email_outbox WHERE entity = 'claim' AND entity_id = $1 AND template = 'claim_insurer_submission'", [c.id]);
    expect(mail.body_html).toContain(list.items[0].documentName);
    await setSetting('claims.require_documents_before_submission', true);
  });

  it('alerts the handler once of a FNOL not submitted, an authorisation code overdue and a follow-up past its date', async () => {
    const c = await claimInReview('sl1');
    const d = await claimInReview('sl2');
    await query("UPDATE claims SET submitted_to_insurer_at = now() - interval '5 days' WHERE id = $1", [d.id]);
    await query("INSERT INTO claim_communications(claim_id, party, method, message, follow_up_date, created_by) VALUES ($1, 'insurer', 'Phone', 'Call back', $2::date - 1, 'cc.ops')", [d.id, todayStr]);
    const r = await claimServiceLevels();
    expect(r.fnol).toBeGreaterThanOrEqual(1);
    expect(r.authorisation).toBeGreaterThanOrEqual(1);
    expect(r.followUps).toBe(1);
    const titles = async (id) => (await many("SELECT title FROM notifications WHERE entity = 'claim' AND entity_id = $1 AND type = 'alert'", [id])).map((n) => n.title);
    expect(await titles(c.id)).toContain(`FNOL not submitted: claim ${c.claimNumber}`);
    expect(await titles(d.id)).toEqual(expect.arrayContaining([`Authorisation code overdue: claim ${d.claimNumber}`, `Claim follow-up overdue: ${d.claimNumber}`]));
    const again = await claimServiceLevels();
    expect(again).toMatchObject({ followUps: 0 });
    expect((await titles(c.id)).filter((t) => t.startsWith('FNOL'))).toHaveLength(1);
  });
});

describe('Insurance Claims Report', () => {
  it('reports partial and settled claims by settlement date with the TISPH columns; Cash Control cannot read it', async () => {
    const all = await as('cc.unithead', 'get', `/claims/reports/criteria?reportType=json&criteria=Partial&startDate=${addDays(todayStr, -30)}&endDate=${todayStr}`);
    expect(all.status).toBe(200);
    expect(all.body.data.rows.every((r) => r.claimStatus === 'Partially Settled')).toBe(true);
    const settled = await as('cc.unithead', 'get', `/claims/reports/criteria?reportType=json&criteria=Settled&dateBasis=settlement&startDate=${todayStr}&endDate=${todayStr}`);
    const row = settled.body.data.rows.find((r) => r.policyNumber === 'POL-st1');
    expect(row).toMatchObject({ settledAmount: 80000, settledOn: todayStr, handlerName: expect.any(String) });
    expect(row).toHaveProperty('requirements');
    expect(row).toHaveProperty('insurerAdvice');
    const typed = await as('cc.unithead', 'get', `/claims/reports/criteria?reportType=json&criteria=All&claimType=Life&startDate=${addDays(todayStr, -30)}&endDate=${todayStr}`);
    expect(typed.body.data.rows.every((r) => r.claimType === 'Life')).toBe(true);
    expect((await as('cc.pdu', 'get', '/claims/reports/criteria?reportType=json')).status).toBe(403);
    expect((await as('cc.pdu', 'get', '/claims/report?includeData=true')).status).toBe(403);
  });
});

describe('claim settlement cash', () => {
  let c;
  it('records funds from the insurer with Receipting and pays the claimant only from the funds received', async () => {
    c = await claimInReview('ca1');
    await settle('cc.unithead', c.id, { settlementType: 'Through Broker', settlementAmount: 70000, payee: 'Client ca1' });
    expect((await as('cc.gm', 'put', `/claims/approve-settlement/${c.id}`).send({ decision: 'approve' })).body.data.lifecycleStatus).toBe('settled');
    const pos = (await as('cc.bp', 'get', `/claim-payments/claims/${c.id}`)).body.data;
    expect(pos).toMatchObject({ canRecord: true, payFromFunds: true, payableNow: 0 });
    expect((await as('cc.pdu', 'post', `/claim-payments/claims/${c.id}/funds-received`).send({ amount: 70000, bankAccount: 'ACC-MBT-001' })).status).toBe(403);
    const early = await as('cc.finance', 'post', `/claim-payments/claims/${c.id}/pay`).send({ amount: 70000, bankAccount: 'ACC-MBT-001', paymentMode: 'check', payee: 'Client ca1' });
    expect(early.status).toBe(409);
    expect(early.body.message).toMatch(/paid from the funds received/);
    const f = await as('cc.bp', 'post', `/claim-payments/claims/${c.id}/funds-received`).send({ amount: 70000, bankAccount: 'ACC-MBT-001', reference: 'RA-1' });
    expect(f.status).toBe(200);
    const pay = await as('cc.finance', 'post', `/claim-payments/claims/${c.id}/pay`).send({ amount: 30000, bankAccount: 'ACC-MBT-001', paymentMode: 'check', payee: 'Client ca1' });
    expect(pay.status).toBe(200);
  });

  it('reverses a movement recorded in error with a reason, by another user, through a reversing journal', async () => {
    const pos = (await as('cc.recon', 'get', `/claim-payments/claims/${c.id}`)).body.data;
    const funds = pos.movements.find((m) => m.kind === 'funds-received');
    const pay = pos.movements.find((m) => m.kind === 'paid-to-claimant');
    expect((await as('cc.bp', 'post', `/claim-payments/claims/${c.id}/movements/${funds.id}/reverse`).send({ reasonCode: 'CRV-AMOUNT', note: 'x' })).status).toBe(403);
    const paidFrom = await as('cc.recon', 'post', `/claim-payments/claims/${c.id}/movements/${funds.id}/reverse`).send({ reasonCode: 'CRV-AMOUNT', note: 'Wrong amount' });
    expect(paidFrom.status).toBe(409);
    expect((await as('cc.recon', 'post', `/claim-payments/claims/${c.id}/movements/${pay.id}/reverse`).send({ reasonCode: 'CRV-RETURNED' })).status).toBe(400);
    const rp = await as('cc.recon', 'post', `/claim-payments/claims/${c.id}/movements/${pay.id}/reverse`).send({ reasonCode: 'CRV-RETURNED', note: 'Cheque 77 returned' });
    expect(rp.status).toBe(200);
    expect(rp.body.data.journalNumber).toMatch(/^JV-/);
    expect(rp.body.data.position.paidToClaimant).toBe(0);
    const rf = await as('cc.recon', 'post', `/claim-payments/claims/${c.id}/movements/${funds.id}/reverse`).send({ reasonCode: 'CRV-AMOUNT', note: 'Wrong amount' });
    expect(rf.status).toBe(200);
    expect(rf.body.data.position).toMatchObject({ totalReceived: 0, paidToClaimant: 0 });
    expect(rf.body.data.position.movements.every((m) => m.reversed && m.reversedBy === 'Rico Recon')).toBe(true);
    expect((await as('cc.recon', 'post', `/claim-payments/claims/${c.id}/movements/${funds.id}/reverse`).send({ reasonCode: 'CRV-AMOUNT', note: 'again' })).status).toBe(409);
  });
});

describe('repair estimates', () => {
  it('tells the client of every estimate recorded and decided', async () => {
    const c = await claimInReview('re1');
    await ctx.api('post', '/ops-masters/repair-shop').send({ code: 'RS-CC1', name: 'Makati Auto Body', accredited: true });
    const e = await as('cc.ops', 'post', `/motor-claims/claims/${c.id}/estimates`).send({ repairShopCode: 'RS-CC1', parts: 30000, labour: 10000 });
    expect(e.status).toBe(201);
    await as('cc.ops', 'post', `/motor-claims/claims/${c.id}/estimates/${e.body.data.id}/decision`).send({ decision: 'approve', approvedAmount: 35000, adjusterName: 'R. Dizon' });
    const mails = await many("SELECT body_html AS html FROM email_outbox WHERE entity = 'claim' AND entity_id = $1 AND template = 'claim_estimate_update' ORDER BY id", [c.id]);
    expect(mails).toHaveLength(2);
    expect(mails[1].html).toContain('approved PHP 35,000.00 of estimate 1');
  });
});
