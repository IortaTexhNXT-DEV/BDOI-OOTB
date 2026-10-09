import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setup, loginAs } from './helpers.js';
import { pool } from '../src/db/pool.js';

let ctx;
let sales;
async function persona(username, roles) {
  await ctx.api('post', '/users').send({ username, password: 'Welcome@123', displayName: username, roles });
  const token = await loginAs(ctx.app, username, 'Welcome@123');
  return (m, p) => request(ctx.app)[m](`/api${p}`).set('Authorization', `Bearer ${token}`);
}

beforeAll(async () => {
  ctx = await setup();
  sales = await persona('dc.sales', ['sales']);
});
afterAll(async () => { await pool.end(); });

describe('distribution channels master', () => {
  let groupId;
  let branchId;
  it('builds the hierarchy: a dealer branch sits under a dealer group, a bank branch under a financing bank', async () => {
    const g = await ctx.api('post', '/channels').send({ code: 'NSM', name: 'Northstar Motors Group', channelType: 'dealer_group', referrerId: 'ref-toyotamakati', comsubPct: 4 });
    expect(g.status).toBe(201);
    groupId = g.body.data.id;
    const orphan = await ctx.api('post', '/channels').send({ code: 'NSM-X', name: 'Branch without group', channelType: 'dealer_branch' });
    expect(orphan.status).toBe(400);
    const wrong = await ctx.api('post', '/channels').send({ code: 'NSM-Y', name: 'Branch under a bank', channelType: 'dealer_branch', parentId: 'ch_seed_tfs' });
    expect(wrong.status).toBe(400);
    const b = await ctx.api('post', '/channels').send({ code: 'NSM-QC', name: 'Northstar Quezon City', channelType: 'dealer_branch', parentId: groupId, province: 'Metro Manila', city: 'Quezon City' });
    expect(b.status).toBe(201);
    expect(b.body.data.path).toBe('Northstar Motors Group > Northstar Quezon City');
    expect(b.body.data.groupName).toBe('Northstar Motors Group');
    branchId = b.body.data.id;
    const dup = await ctx.api('post', '/channels').send({ code: 'nsm-qc', name: 'Duplicate', channelType: 'dealer_branch', parentId: groupId });
    expect(dup.status).toBe(400);
    const loop = await ctx.api('put', `/channels/${groupId}`).send({ parentId: branchId });
    expect(loop.status).toBe(400);
  });

  it('sales reads the channels for the drop-downs but cannot change them', async () => {
    const opts = await sales('get', '/channels/options?type=dealer_branch');
    expect(opts.status).toBe(200);
    expect(opts.body.data.map((o) => o.code)).toEqual(expect.arrayContaining(['TMK-MKT', 'TAL-ALB', 'NSM-QC']));
    expect(opts.body.data.every((o) => o.channelType === 'dealer_branch')).toBe(true);
    expect((await sales('post', '/channels').send({ code: 'Z', name: 'Z', channelType: 'affinity_partner' })).status).toBe(403);
  });

  it('a prospect carries its channel; its quotation and policy inherit it, and the channel referrer earns the comsub', async () => {
    const lead = await sales('post', '/leads').send({ firstName: 'Carmela', lastName: 'Dizon', lob: 'MOTOR', channelId: branchId });
    expect(lead.status).toBe(201);
    expect(lead.body.channelId).toBe(branchId);
    expect(lead.body.channelName).toBe('Northstar Quezon City');
    const bad = await sales('post', '/leads').send({ firstName: 'X', channelId: 'ch_nope' });
    expect(bad.status).toBe(400);
    const q = await sales('post', '/quotations').send({ leadRefId: lead.body.id, productType: 'Motor', lob: 'MOTOR', insuranceCompanyName: 'Malayan Insurance Co., Inc.', vehicleType: 'private_cars',
      lossAndDamageCoverage: 900000, lossAndDamageCoverageRate: 1.5, totalSumInsured: 900000 });
    expect(q.status).toBe(201);
    const quoteId = q.body.data?.id || q.body.id || q.body.quotationId;
    const qrow = (await pool.query('SELECT channel_id FROM quotes WHERE id = $1', [quoteId])).rows[0];
    expect(qrow.channel_id).toBe(branchId);
    // issue the policy straight from the quotation row (the convert flow is covered elsewhere)
    const { withTransaction } = await import('../src/db/pool.js');
    const { issuePolicy } = await import('../src/modules/policies/service.js');
    const { clientFromLead } = await import('../src/modules/clients/service.js');
    const user = (await pool.query("SELECT id FROM users WHERE username = 'BrokerVerse'")).rows[0].id;
    const issued = await withTransaction(async (db) => {
      const quote = (await db.query('SELECT * FROM quotes WHERE id = $1', [quoteId])).rows[0];
      const clientId = await clientFromLead(db, quote.lead_id, {}, user);
      return issuePolicy(db, { quoteId, clientId, leadId: quote.lead_id, insuranceCompanyId: quote.insurance_company_id, sumInsured: Number(quote.sum_insured), netPremium: Number(quote.premium_base),
        grossPremium: Number(quote.premium_total), commissionAmount: Number(quote.commission_amount), commissionRate: Number(quote.commission_rate), currency: 'PHP', productType: 'Motor', lob: 'MOTOR', doc: {} }, {}, user);
    });
    const p = (await pool.query('SELECT channel_id, details FROM policies WHERE id = $1', [issued.policyId])).rows[0];
    expect(p.channel_id).toBe(branchId);
    // the branch has no referrer of its own: no comsub line; the group has one but the comsub follows the channel of the policy
    expect(p.details.commissionDetails).toBeNull();
    const upd = await ctx.api('put', `/channels/${branchId}`).send({ referrerId: 'ref-toyotamakati', comsubPct: 4 });
    expect(upd.body).toMatchObject({ success: true });
    const ref = await (await import('../src/modules/channels/service.js')).channelReferral(pool, issued.policyId);
    expect(ref.primary).toEqual({ referrerId: 'ref-toyotamakati', comsubPct: 4 });
  });

  it('Dealer Production totals prospects, quotations and policies per channel, rolled up to the dealer group', async () => {
    const r = await ctx.api('post', '/reports/dealer-production/run').send({ ReportCriteria: 'Channel', FromDate: '2026-01-01' });
    expect(r.status).toBe(200);
    const row = r.body.data.rows.find((x) => x.channel === 'Northstar Quezon City');
    expect(row).toMatchObject({ dealerGroup: 'Northstar Motors Group', channelType: 'Dealer branch', leads: 1, quotations: 1, policies: 1 });
    expect(Number(row.premium)).toBeGreaterThan(0);
    const g = await ctx.api('post', '/reports/dealer-production/run').send({ ReportCriteria: 'Dealer Group', FromDate: '2026-01-01' });
    expect(g.body.data.rows.find((x) => x.dealerGroup === 'Northstar Motors Group')).toMatchObject({ policies: 1 });
  });

  it('a channel with business is deactivated, not deleted', async () => {
    const r = await ctx.api('delete', `/channels/${branchId}`);
    expect(r.status).toBe(200);
    expect(r.body.data.removed).toBe(false);
    const unused = await ctx.api('post', '/channels').send({ code: 'AFF-TEMP', name: 'Temporary partner', channelType: 'affinity_partner' });
    expect((await ctx.api('delete', `/channels/${unused.body.data.id}`)).body.data.removed).toBe(true);
  });
});
