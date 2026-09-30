/**
 * Bespoke placements, part 2: the underwriter room. Invitations, the statement of values (XLSX and CSV parsed into
 * locations and totals, versions), loss-run attachments, bid rounds (requested, quoted, countered, accepted, declined,
 * withdrawn), messages, the timeline, the external underwriter link (no sign-in) and the award to the Quotation Slip
 * and the Placement Slip.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { writeXlsx } from '../src/lib/xlsx.js';
import { parseSov } from '../src/modules/bespoke/room.js';

let ctx;
let proc;
let acct;
let ic;
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const pub = (path, body) => request(ctx.app).post(`/api${path}`).send(body);

async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}
async function brokerSlip(name, sumInsured = 850000000) {
  const r = await proc('post', '/broker-slips').send({ prospect: { companyName: name }, productType: 'Industrial All Risks', insuredName: name, riskDetails: { location: 'Laguna Technopark, Binan' },
    requestedCovers: [{ cover: 'Material damage', sumInsured }], insurers: ['MALAYAN'], inceptionDate: '2026-11-01', expiryDate: '2027-11-01' });
  expect(r.status).toBe(201);
  return r.body;
}
const SOV_COLUMNS = [{ key: 'loc', header: 'Location Name' }, { key: 'city', header: 'City' }, { key: 'occ', header: 'Occupancy' }, { key: 'bldg', header: 'Building', type: 'money' },
  { key: 'cont', header: 'Contents', type: 'money' }, { key: 'stk', header: 'Stocks', type: 'money' }, { key: 'bi', header: 'Business Interruption', type: 'money' }, { key: 'tot', header: 'Total Sum Insured', type: 'money' }];

beforeAll(async () => {
  ctx = await setup();
  proc = await persona('r.proc', ['processing']);
  acct = await persona('r.acct', ['accounting']);
  ic = Object.fromEntries((await q('SELECT code, id FROM insurance_companies')).map((r) => [r.code, r.id]));
});
afterAll(async () => { await pool.end(); });

describe('statement of values parser', () => {
  it('maps headings through the configured aliases, totals the values and warns on inconsistent totals', async () => {
    const r = await parseSov([
      { site: 'Plant 1', city: 'Binan', building: '300,000,000', contents: '100000000', stock: '50,000,000', totalSumInsured: '450000000' },
      { site: 'Warehouse', city: 'Santa Rosa', building: '50000000', contents: '', stock: '10000000', totalSumInsured: '65000000' },
      { site: '', city: '', building: '', contents: '', stock: '', totalSumInsured: '' }]);
    expect(r.locations).toHaveLength(2);
    expect(r.locations[0]).toMatchObject({ locationName: 'Plant 1', building: 300000000, stocks: 50000000, totalValue: 450000000 });
    expect(r.totals).toMatchObject({ building: 350000000, contents: 100000000, stocks: 60000000, totalValue: 515000000 });
    expect(r.warnings).toEqual(['Row 3 (Warehouse): total 65,000,000.00 differs from the sum of its values 60,000,000.00']);
    await expect(parseSov([{ site: 'A', owner: 'X' }])).rejects.toThrow(/at least one value column/);
    await expect(parseSov([{ site: 'A', building: 'lots' }])).rejects.toThrow(/Row 2: building must be a number/);
  });
});

describe('underwriter room', () => {
  let slip;
  let roomId;
  let token;
  beforeAll(async () => {
    slip = await brokerSlip('Laguna Precision Parts Inc.');
    await proc('post', '/bespoke/slips').send({ brokerSlipId: slip.id, templateId: 'PROPERTY-STD', variables: { deductible_percent: '2', deductible_amount: '250,000.00' } });
  });

  it('opens a room for the RFQ with its insurers and the composed slip, and invites more insurers', async () => {
    const r = await proc('post', '/bespoke/rooms').send({ brokerSlipId: slip.slipNumber, responseDueDate: '2026-10-20' });
    expect(r.status).toBe(201);
    roomId = r.body.data.id;
    expect(r.body.data.roomNumber).toMatch(/^UWR-\d{4}-\d{5}$/);
    expect(r.body.data.composedSlipNumber).toMatch(/^CSL-/);
    expect(r.body.data.insurers.map((i) => i.code)).toEqual(['MALAYAN']);
    const inv = await proc('post', `/bespoke/rooms/${roomId}/insurers`).send({ insurerIds: ['PIONEER', 'FPG', 'MALAYAN'] });
    expect(inv.body.message).toBe('2 insurer(s) invited');
    expect(inv.body.data.insurers).toHaveLength(3);
    expect((await proc('post', `/bespoke/rooms/${roomId}/insurers`).send({ insurerIds: ['NOWHERE'] })).status).toBe(400);
  });

  it('uploads the SOV as XLSX (new version) and a loss run', async () => {
    const xlsx = writeXlsx({ sheets: [{ name: 'SOV', columns: SOV_COLUMNS, rows: [
      { loc: 'Plant 1', city: 'Binan', occ: 'Precision machining', bldg: 400000000, cont: 150000000, stk: 50000000, bi: 100000000, tot: 700000000 },
      { loc: 'Warehouse 2', city: 'Santa Rosa', occ: 'Storage', bldg: 100000000, cont: 20000000, stk: 30000000, bi: 0, tot: 150000000 }] }] });
    const r = await proc('post', `/bespoke/rooms/${roomId}/sov`).attach('file', xlsx, 'sov.xlsx');
    expect(r.status).toBe(201);
    expect(r.body.data).toMatchObject({ version: 1, totals: { building: 500000000, contents: 170000000, stocks: 80000000, businessInterruption: 100000000, totalValue: 850000000 }, warnings: [] });
    const csv = Buffer.from('Location,City,Building,Contents,Total\nPlant 1,Binan,410000000,150000000,560000000\n');
    const v2 = await proc('post', `/bespoke/rooms/${roomId}/sov`).attach('file', csv, 'sov-v2.csv');
    expect(v2.body.data.version).toBe(2);
    const lr = await proc('post', `/bespoke/rooms/${roomId}/attachments`).field('kind', 'loss_run').field('description', 'Loss run 2021-2025').attach('file', Buffer.from('%PDF-1.4\n%loss run\n'), 'loss-run.pdf');
    expect(lr.status).toBe(201);
    const room = (await proc('get', `/bespoke/rooms/${roomId}`)).body.data;
    expect(room.sov.current).toMatchObject({ version: 2, locationCount: 1 });
    expect(room.sov.versions.map((v) => [v.version, v.isCurrent])).toEqual([[2, true], [1, false]]);
    expect(room.attachments.map((a) => a.kind)).toEqual(['sov', 'sov', 'loss_run']);
  });

  it('runs bid rounds: request, quote, counter, re-quote, decline, accept', async () => {
    const req1 = await proc('post', `/bespoke/rooms/${roomId}/bids/request`).send({ note: 'Please quote' });
    expect(req1.body.data).toMatchObject({ round: 1 });
    expect(req1.body.data.created).toHaveLength(3);
    const m = await proc('post', `/bespoke/rooms/${roomId}/bids`).send({ insuranceCompanyId: ic.MALAYAN, premium: 1275000, capacityPercent: 50, deductibles: 'Typhoon 2%',
      deviations: [{ clause: 'PH-72HR', requested: '72 hours', offered: '48 hours' }] });
    expect(m.status).toBe(201);
    expect(m.body.data).toMatchObject({ status: 'quoted', round: 1, rate: 0.15, capacityPercent: 50, capacityAmount: 425000000 });
    expect((await proc('post', `/bespoke/rooms/${roomId}/bids`).send({ insuranceCompanyId: ic.PIONEER, premium: 0 })).status).toBe(400);
    const p = await proc('post', `/bespoke/rooms/${roomId}/bids`).send({ insuranceCompanyId: ic.PIONEER, premium: 1300000, capacityPercent: 50 });
    const c = await proc('post', `/bespoke/rooms/${roomId}/bids/${p.body.data.id}/counter`).send({ premium: 1250000, terms: 'Keep the 72-hour clause' });
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ status: 'requested', round: 2, counterPremium: 1250000, parentBidId: p.body.data.id });
    const f = await proc('post', `/bespoke/rooms/${roomId}/bids`).send({ insuranceCompanyId: ic.FPG, status: 'declined', declineReason: 'Outside appetite' });
    expect(f.body.data.status).toBe('declined');
    const cmp = (await proc('get', `/bespoke/rooms/${roomId}`)).body.data.comparison;
    expect(cmp.summary).toMatchObject({ quoted: 1, declined: 1, pending: 1, bestPremium: 1275000, capacityOffered: 50 });
    expect((await proc('post', `/bespoke/rooms/${roomId}/bids/${m.body.data.id}/accept`).send({ sharePercent: 60 })).status).toBe(400);
    const a = await proc('post', `/bespoke/rooms/${roomId}/bids/${m.body.data.id}/accept`).send({});
    expect(a.body.data).toMatchObject({ status: 'accepted', acceptedShare: 50 });
    expect((await proc('post', `/bespoke/rooms/${roomId}/bids/${p.body.data.id}/accept`).send({})).status).toBe(409);
  });

  it('lets the underwriter answer through the signed link without signing in', async () => {
    const l = await proc('post', `/bespoke/rooms/${roomId}/insurers/${ic.PIONEER}/link`).send({ sendEmail: true });
    expect(l.status).toBe(200);
    expect(l.body.data.emailId).toBeTruthy();
    token = new URL(l.body.data.url, 'http://x').searchParams.get('token');
    const [mail] = await q('SELECT subject, body_html FROM email_outbox WHERE id = $1', [l.body.data.emailId]);
    expect(mail.subject).toContain('Invitation to quote');
    expect(mail.body_html).toContain('/underwriter-room?token=');
    const v = await pub('/bespoke/underwriter-link/view', { token });
    expect(v.status).toBe(200);
    expect(v.body.data.room).toMatchObject({ insuredName: 'Laguna Precision Parts Inc.' });
    expect(v.body.data.slip.clauses.map((c) => c.code)).toContain('PH-72HR');
    expect(v.body.data.sov.locations).toHaveLength(1);
    expect(v.body.data.bids.map((b) => b.status)).toEqual(['countered', 'requested']);
    expect(v.body.data.bids[1].counterPremium).toBe(1250000);
    const b = await pub('/bespoke/underwriter-link/bid', { token, premium: 1260000, capacityPercent: 50, remarks: 'Final terms' });
    expect(b.status).toBe(200);
    expect(b.body.data).toMatchObject({ status: 'quoted', round: 2, submittedVia: 'link', premium: 1260000 });
    const msg = await pub('/bespoke/underwriter-link/message', { token, body: 'Please send the 2025 survey report' });
    expect(msg.body.data.authorType).toBe('underwriter');
    await proc('post', `/bespoke/rooms/${roomId}/messages`).send({ body: 'Internal: Pioneer is keen', internal: true });
    await proc('post', `/bespoke/rooms/${roomId}/messages`).send({ insuranceCompanyId: ic.PIONEER, body: 'Survey report attached' });
    const again = await pub('/bespoke/underwriter-link/view', { token });
    expect(again.body.data.messages.map((m) => m.body)).toEqual(['Please send the 2025 survey report', 'Survey report attached']);
    // a new link replaces the old one; a bad token is refused
    await proc('post', `/bespoke/rooms/${roomId}/insurers/${ic.PIONEER}/link`).send({});
    expect((await pub('/bespoke/underwriter-link/view', { token })).body.message).toBe('This link has been replaced by a newer one');
    expect((await pub('/bespoke/underwriter-link/view', { token: 'x'.repeat(40) })).status).toBe(400);
  });

  it('keeps one timeline of everything', async () => {
    const room = (await proc('get', `/bespoke/rooms/${roomId}`)).body.data;
    const events = room.timeline.map((e) => e.event);
    for (const e of ['room-opened', 'insurer-invited', 'sov-uploaded', 'attachment-added', 'bid-requested', 'bid-quoted', 'bid-countered', 'bid-declined', 'bid-accepted', 'link-issued', 'room-viewed', 'message-posted', 'note-added']) {
      expect(events).toContain(e);
    }
    expect(room.timeline.find((e) => e.event === 'bid-quoted' && e.actorType === 'underwriter')).toBeTruthy();
    expect(room.messages.find((m) => m.internal).body).toBe('Internal: Pioneer is keen');
  });

  it('awards the accepted bids (100%) to the Placement Slip', async () => {
    const pioneer = (await proc('get', `/bespoke/rooms/${roomId}`)).body.data.bids.find((b) => b.insuranceCompanyId === ic.PIONEER && b.status === 'quoted');
    expect((await proc('post', `/bespoke/rooms/${roomId}/award`).send({ target: 'placement' })).body.message).toBe('The accepted shares total 50%: they must total exactly 100% to award the placement');
    await proc('post', `/bespoke/rooms/${roomId}/bids/${pioneer.id}/accept`).send({});
    const malayan = (await proc('get', `/bespoke/rooms/${roomId}`)).body.data.bids.find((b) => b.insuranceCompanyId === ic.MALAYAN && b.status === 'accepted');
    const r = await proc('post', `/bespoke/rooms/${roomId}/award`).send({ target: 'placement', leadBidId: malayan.id, inceptionDate: '2026-11-01' });
    expect(r.status).toBe(201);
    expect(r.body.data.placementNumber).toMatch(/^PS-/);
    expect(r.body.room.status).toBe('awarded');
    const p = await proc('get', `/placements/${r.body.data.placementId}`);
    expect(p.body.participants.map((x) => [x.insuranceCompanyId, x.sharePercent, x.isLead])).toEqual([[ic.MALAYAN, 50, true], [ic.PIONEER, 50, false]]);
    const offers = await q("SELECT o.insurance_company_id, o.premium, o.status FROM insurer_offers o WHERE o.broker_slip_id = $1 AND o.status = 'offered' ORDER BY o.premium", [slip.id]);
    expect(offers.map((o) => [o.insurance_company_id, Number(o.premium)])).toEqual([[ic.PIONEER, 1260000], [ic.MALAYAN, 1275000]]);
    expect((await proc('post', `/bespoke/rooms/${roomId}/bids/request`).send({})).status).toBe(409);
  });

  it('awards to the Quotation Slip and closes rooms; accounting reads but does not write', async () => {
    const s2 = await brokerSlip('Batangas Port Services Corp.', 100000000);
    const r = (await proc('post', '/bespoke/rooms').send({ brokerSlipId: s2.id, insurerIds: [ic.MAPFRE] })).body.data;
    const b = await proc('post', `/bespoke/rooms/${r.id}/bids`).send({ insuranceCompanyId: ic.MAPFRE, premium: 180000 });
    await proc('post', `/bespoke/rooms/${r.id}/bids/${b.body.data.id}/accept`).send({});
    const aw = await proc('post', `/bespoke/rooms/${r.id}/award`).send({ target: 'quotation' });
    expect(aw.status).toBe(201);
    expect(aw.body.room.quotationNumber).toMatch(/^QT-/);
    expect((await acct('get', `/bespoke/rooms/${r.id}`)).status).toBe(200);
    expect((await acct('post', `/bespoke/rooms/${r.id}/close`).send({})).status).toBe(403);
    const c = await proc('post', `/bespoke/rooms/${r.id}/close`).send({ reason: 'Done' });
    expect(c.body.data.status).toBe('closed');
    const list = await proc('get', '/bespoke/rooms?status=closed');
    expect(list.body.data.map((x) => x.id)).toContain(r.id);
  });
});
