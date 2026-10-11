import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';
import { clearSettingsCache } from '../src/lib/settings.js';
import { addDays } from '../src/lib/dates.js';

let ctx;
let associate;
let officer;
let head;
let officerId;
// the sample policy expires a year after its seeded inception (a date relative to the seed day): the correction moves it a day
let expiry;
let newExpiry;
const shown = (iso) => iso.split('-').reverse().join('/');
const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);

async function persona(username, roles) {
  const r = await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, email: `${username}@example.ph`, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return { id: r.body.data?.userId, api: (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`) };
}

beforeAll(async () => {
  ctx = await setup();
  expiry = (await q('SELECT expiry_date FROM policies WHERE id = $1', ['pol_sls_02']))[0].expiry_date;
  newExpiry = addDays(expiry, 1);
  associate = (await persona('c.associate', ['tis-ops-associate'])).api;
  const o = await persona('c.officer', ['tis-sales-officer']);
  officer = o.api; officerId = o.id;
  head = (await persona('c.head', ['tis-ops-unit-head'])).api;
});
afterAll(async () => { await pool.end(); });

describe('policy edits are guarded (ISSUE-04, SEC-03)', () => {
  it('the status is never set by editing', async () => {
    const r = await associate('put', '/policies/pol_sls_02').send({ status: 'Cancelled' });
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('follows its endorsements, cancellation, renewal and expiry');
    // the same status (a screen sending the whole record) passes
    expect((await associate('put', '/policies/pol_sls_02').send({ status: 'Active', plateNumber: 'NAB 1102' })).status).toBe(200);
  });

  it('insured name, period, insurer and number of an issued policy are not edited directly', async () => {
    for (const body of [{ insuredName: 'Someone Else' }, { expiry: '2027-12-31' }, { insuranceCompanyName: 'MAPFRE' }, { policyNumber: 'X-1' }]) {
      const r = await associate('put', '/policies/pol_sls_02').send(body);
      expect(r.status).toBe(400);
      expect(r.body.message).toContain('Request correction');
    }
    const p = (await q('SELECT insured_name, expiry_date, policy_number FROM policies WHERE id = $1', ['pol_sls_02']))[0];
    expect(p).toMatchObject({ insured_name: 'Kristine Soriano', policy_number: 'POL-2026-95002' });
  });
});

describe('policy corrections: request and approval by a second user', () => {
  let id;
  it('needs a reason code and, for the insurer\'s data, the insurer reference', async () => {
    const noReason = await associate('post', '/policies/pol_sls_02/corrections').send({ changes: { insuredName: 'Kristine M. Soriano' } });
    expect(noReason.status).toBe(400);
    const badCode = await associate('post', '/policies/pol_sls_02/corrections').send({ changes: { insuredName: 'Kristine M. Soriano' }, reasonCode: 'PCRR-WRONG' });
    expect(badCode.status).toBe(400);
    expect(badCode.body.errors[0].message).toContain('is not a reason for this action');
    const noRef = await associate('post', '/policies/pol_sls_02/corrections').send({ changes: { expiry: newExpiry }, reasonCode: 'PCR-PERIOD' });
    expect(noRef.status).toBe(400);
    expect(noRef.body.errors[0].message).toContain("insurer's reference");
    const same = await associate('post', '/policies/pol_sls_02/corrections').send({ changes: { insuredName: 'Kristine Soriano' }, reasonCode: 'PCR-NAME' });
    expect(same.body.message).toBe('Enter at least one value that differs from the policy');
    const backwards = await associate('post', '/policies/pol_sls_02/corrections').send({ changes: { expiry: '2026-01-01' }, reasonCode: 'PCR-PERIOD', insurerReference: 'X' });
    expect(backwards.body.message).toBe('The expiry date must be after the inception date');
  });

  it('records the request, one pending at a time, and tells the approvers', async () => {
    const r = await associate('post', '/policies/pol_sls_02/corrections').send({ changes: { insuredName: 'Kristine M. Soriano', expiry: newExpiry, insuranceCompanyName: 'MAPFRE' },
      reasonCode: 'PCR-INSURER', insurerReference: 'MAP-END-2026-0042' });
    expect(r.status).toBe(201);
    id = r.body.data.id;
    expect(r.body.data).toMatchObject({ status: 'pending', reasonCode: 'PCR-INSURER', reason: 'Corrected policy issued by the insurer', insurerReference: 'MAP-END-2026-0042' });
    expect(r.body.data.changes.map((c) => c.field).sort()).toEqual(['expiry', 'insuranceCompanyId', 'insuredName']);
    expect(r.body.data.changes.find((c) => c.field === 'expiry')).toMatchObject({ fromText: shown(expiry), toText: shown(newExpiry) });
    expect(r.body.data.changes.find((c) => c.field === 'insuranceCompanyId').toText).toContain('MAPFRE');
    const again = await associate('post', '/policies/pol_sls_02/corrections').send({ changes: { insuredName: 'K. Soriano' }, reasonCode: 'PCR-NAME' });
    expect(again.status).toBe(409);
    const n = await q("SELECT audience FROM notifications WHERE entity = 'policy' AND entity_id = 'pol_sls_02' AND type = 'approval'");
    expect(n.map((x) => x.audience)).toContain('approve:policies');
  });

  it('the maker cannot decide it; a user without approve:policies cannot either', async () => {
    expect((await associate('post', `/policies/pol_sls_02/corrections/${id}/approve`).send({})).status).toBe(403);
    expect((await associate('post', `/policies/pol_sls_02/corrections/${id}/withdraw`).send({})).status).toBe(200);
    const r = await head('post', '/policies/pol_sls_02/corrections').send({ changes: { insuredName: 'Kristine M. Soriano', expiry: newExpiry }, reasonCode: 'PCR-INSURER', insurerReference: 'MAP-END-2026-0042' });
    id = r.body.data.id;
    const self = await head('post', `/policies/pol_sls_02/corrections/${id}/approve`).send({});
    expect(self.status).toBe(403);
    expect(self.body.message).toContain('Maker-checker');
  });

  it('a second user approves: the policy is corrected, audited and the maker told', async () => {
    const r = await officer('post', `/policies/pol_sls_02/corrections/${id}/approve`).send({});
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ status: 'approved', decidedBy: 'c.officer' });
    const p = (await q('SELECT insured_name, expiry_date, updated_by FROM policies WHERE id = $1', ['pol_sls_02']))[0];
    expect(p).toMatchObject({ insured_name: 'Kristine M. Soriano', expiry_date: newExpiry, updated_by: officerId });
    const [a] = await q("SELECT before_data, after_data FROM audit_log WHERE entity = 'policy' AND entity_id = 'pol_sls_02' AND action = 'correction-approve'");
    expect(a.before_data.insuredName).toBe('Kristine Soriano');
    expect(a.after_data.insuredName).toBe('Kristine M. Soriano');
    expect((await officer('post', `/policies/pol_sls_02/corrections/${id}/approve`).send({})).body.message).toContain('already approved');
  });

  it('a rejection needs a reason code of its own context', async () => {
    const r = await associate('post', '/policies/pol_sls_03/corrections').send({ changes: { policyNumber: 'MAL-MC-2026-1003' }, reasonCode: 'PCR-OTHER', note: 'Insurer number', insurerReference: 'MAL e-mail 10/10' });
    expect(r.status).toBe(201);
    const noCode = await officer('post', `/policies/pol_sls_03/corrections/${r.body.data.id}/reject`).send({});
    expect(noCode.status).toBe(400);
    const ok = await officer('post', `/policies/pol_sls_03/corrections/${r.body.data.id}/reject`).send({ reasonCode: 'PCRR-NOPROOF' });
    expect(ok.body.data).toMatchObject({ status: 'rejected', decisionReasonCode: 'PCRR-NOPROOF' });
    expect((await q('SELECT policy_number FROM policies WHERE id = $1', ['pol_sls_03']))[0].policy_number).toBe('POL-2026-95003');
    const list = await associate('get', '/policies/pol_sls_03/corrections');
    expect(list.body.data[0].statusLabel).toBe('Rejected');
  });

  it('an approval is refused when the policy changed since the request', async () => {
    const r = await associate('post', '/policies/pol_sls_04/corrections').send({ changes: { insuredName: 'Kalayaan Foods Distribution Corporation' }, reasonCode: 'PCR-NAME' });
    await q("UPDATE policies SET insured_name = 'Kalayaan Foods' WHERE id = 'pol_sls_04'");
    const ok = await officer('post', `/policies/pol_sls_04/corrections/${r.body.data.id}/approve`).send({});
    expect(ok.status).toBe(409);
  });
});

describe('policy bulk upload (ISSUE-01, BULK-02)', () => {
  const csv = 'Policy Number,Insured Name,Email,Product,Insurance Company,Inception Date,Expiry Date,Sum Insured,Net Premium,Gross Premium\nUPL-9001,Rosa Villanueva,rosa@example.ph,Motor,MAPFRE,2026-09-01,2027-09-01,800000,12000,15030\n';
  it('TISPH issues policies through the placement slip: the upload issues none', async () => {
    const r = await associate('post', '/policies/bulk-upload').attach('file', Buffer.from(csv), 'policies.csv');
    expect(r.status).toBe(400);
    expect(r.body.message).toContain('issued through the placement slip');
    expect((await q("SELECT count(*)::int AS n FROM policies WHERE policy_number = 'UPL-9001'"))[0].n).toBe(0);
  });

  it('the go-live load of in-force policies needs the go-live data permission', async () => {
    const r = await associate('post', '/policies/bulk-upload?mode=go-live').attach('file', Buffer.from(csv), 'policies.csv');
    expect(r.status).toBe(403);
    const ok = await ctx.api('post', '/policies/bulk-upload?mode=go-live').attach('file', Buffer.from(csv), 'policies.csv');
    expect(ok.status).toBe(200);
  });

  it('a broker build with the upload switched on issues as before', async () => {
    await q("UPDATE app_settings SET value = 'true' WHERE key = 'policies.bulk_upload_issue'");
    clearSettingsCache();
    const r = await associate('post', '/policies/bulk-upload').attach('file', Buffer.from(csv.replace('UPL-9001', 'UPL-9002')), 'policies.csv');
    expect(r.body.data.created).toBe(1);
  });
});
