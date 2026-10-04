/**
 * Step 5: old and new data side by side on TARGET after the migration: a new policy numbered by its series without
 * colliding with migrated numbers, a migrated policy renewed from the renewal queue, a receipt against a migrated open
 * item, the trial balance and the receivables control account in agreement, and reports that tell migrated from new.
 */
import { dataOf, listOf } from '../uat/http.js';
import { addDays } from '../uat/dates.js';
import { expect, fmt } from './log.js';
import { newMotorPolicy, receipt, personaFor } from './business.js';
import { persona } from './sessions.js';

const MIGRATED = 'go-live-migration';
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;

export async function step5(ctx) {
  const { log } = ctx;
  log.setPhase('Step 5. Old and new data side by side on TARGET');
  const admin = ctx.tgt.admin;
  const migratedNumbers = ctx.snapshot.rows.policies.map((p) => p['Policy Number']);

  let fresh;
  await log.check('New policy issued after the migration: number from the series, no collision with migrated numbers', async () => {
    fresh = await newMotorPolicy(ctx, { label: 'NEW BUSINESS', insurerCode: ctx.smokeInsurer, pay: false });
    ctx.state.newPolicy = fresh;
    expect(!migratedNumbers.includes(fresh.policyNumber), `${fresh.policyNumber} is a migrated number`);
    const seq = (n) => Number(/(\d+)$/.exec(n)?.[1] || 0);
    const sameFormat = migratedNumbers.filter((n) => n.replace(/\d+$/, '') === fresh.policyNumber.replace(/\d+$/, ''));
    const highest = Math.max(0, ...sameFormat.map(seq));
    expect(seq(fresh.policyNumber) > highest, `${fresh.policyNumber} is not above the highest migrated number of the same format (${highest})`);
    const clients = ctx.snapshot.rows.clients.map((c) => c['Client Code']);
    expect(!clients.includes(fresh.clientCode), `client code ${fresh.clientCode} is a migrated client code`);
    return `policy ${fresh.policyNumber} (migrated numbers of the format up to ${highest}: ${sameFormat.length}), client ${fresh.clientCode}, bill ${fresh.billNumber}`;
  });

  let renewable;
  await log.check('Migrated policy expiring within the renewal window appears in the renewal queue', async () => {
    const opts = dataOf(await admin.get('/policy-renewals/options'));
    const to = opts.expiryTo || addDays(ctx.today, Number(opts.windowDays || 30));
    const due = ctx.snapshot.rows.policies.filter((p) => p['Expiry Date'] >= ctx.today && p['Expiry Date'] <= to);
    if (!due.length) return `no migrated policy expires by ${to} (renewal window ${opts.windowDays} days): nothing to check`;
    const proc = await persona(ctx, personaFor(ctx, 'processing'));
    const queue = listOf(await proc.get('/policy-renewals/renewable-policies', { expiryFrom: ctx.today, expiryTo: to, page: 1, limit: 200 }));
    const inQueue = due.filter((p) => queue.some((q) => q.policyNumber === p['Policy Number']));
    expect(inQueue.length === due.length, `${due.length - inQueue.length} of ${due.length} migrated policies due by ${to} are not in the queue: ${due.filter((p) => !inQueue.includes(p)).map((p) => p['Policy Number']).join(', ')}`);
    renewable = queue.find((q) => q.policyNumber === inQueue[0]['Policy Number']);
    return `${due.length} migrated policies expire by ${to}; all ${inQueue.length} in the queue (e.g. ${renewable.policyNumber}, expires ${renewable.expiryDate}, ${renewable.renewalStateLabel || renewable.renewalState})`;
  });

  if (renewable) {
    await log.check(`Migrated policy ${renewable.policyNumber} renewed (renewal workspace: quote, submit, approval by a second processor, complete)`, async () => {
      const p1 = await persona(ctx, personaFor(ctx, 'processing', 0));
      const p2 = await persona(ctx, personaFor(ctx, 'processing', 1));
      const id = renewable.policyId;
      const rn = dataOf(await p1.post(`/renewals/policies/${id}`, {}));
      await p1.post(`/renewals/${rn.id}/notices`, { stage: 1 });
      await p1.post(`/renewals/${rn.id}/quote`, {});
      await p1.post(`/renewals/${rn.id}/submit`, { note: 'Go-live rehearsal: renewal of a migrated policy' });
      await p2.post(`/renewals/${rn.id}/approve`, { decision: 'approve', note: 'Terms checked' });
      const done = dataOf(await p1.post(`/renewals/${rn.id}/complete`, {}));
      const np = done.newPolicy;
      expect(np?.policyNumber, 'the renewal issued no policy');
      const pol = await p1.get(`/policies/${np.id}`);
      expect(!migratedNumbers.includes(np.policyNumber), `renewal number ${np.policyNumber} is a migrated number`);
      expect((pol.source || pol.doc?.source || '') !== MIGRATED, 'the renewal term is flagged as migrated');
      ctx.state.renewal = { from: renewable.policyNumber, to: np.policyNumber, gross: Number(pol.grossPremium) };
      return `renewal ${rn.renewalNumber || rn.id}: new term ${np.policyNumber} (gross ${fmt(pol.grossPremium)}, ${pol.inception} to ${pol.expiry}), not flagged as migrated`;
    });
  }

  await log.check('Receipt against a migrated open item, found by the old system\'s bill number (kept as its bill number)', async () => {
    const acc = await persona(ctx, personaFor(ctx, 'accounting'));
    const open = listOf(await acc.get('/receipts/open-receivables'));
    const legacy = ctx.snapshot.rows.openItems;
    const migrated = open.filter((o) => o.source === 'opening');
    // migrated open items keep the old system's bill number (or show it as oldBillNumber when another bill had it)
    const keeps = (o) => legacy.some((m) => m['Policy Number'] === o.policyNumber && m['Bill Reference'] === (o.oldBillNumber || o.billNumber));
    const lost = migrated.filter((o) => !keeps(o));
    expect(!lost.length, `open items without their old bill number: ${lost.slice(0, 3).map((o) => `${o.policyNumber} ${o.billNumber}`).join(', ')}`);
    const item = migrated.find((o) => !o.oldBillNumber);
    expect(item, 'no migrated open item in the open receivables');
    const found = listOf(await acc.get('/receipts/open-receivables', { search: item.billNumber }));
    expect(found.some((o) => o.receivableId === item.receivableId), `the receipt allocation search does not find ${item.billNumber}`);
    ctx.state.openItemsKeptNumbers = `${migrated.filter((o) => !o.oldBillNumber).length} of ${migrated.length}`;
    const amount = r2(Math.min(Number(item.balance), Math.max(1000, r2(Number(item.balance) / 2))));
    const r = await receipt(ctx, { receivableId: item.receivableId, amount, label: `${item.policyNumber} (migrated open item)` });
    const after = listOf(await acc.get('/receipts/open-receivables', { policyNumber: item.policyNumber })).find((o) => o.receivableId === item.receivableId);
    const left = after ? Number(after.balance) : 0;
    expect(Math.abs(left - r2(Number(item.balance) - amount)) < 0.005, `balance after the receipt ${left}, expected ${r2(Number(item.balance) - amount)}`);
    ctx.state.openItemReceipt = { policy: item.policyNumber, amount, receipt: r.receiptNumber };
    return `receipt ${r.receiptNumber}: ${fmt(amount)} on ${item.policyNumber} bill ${item.billNumber} = the old system's bill number (balance ${fmt(item.balance)} -> ${fmt(left)}); `
      + `open migrated items with the old bill number as bill number: ${ctx.state.openItemsKeptNumbers}`;
  });

  await log.check('Trial balance (opening balances + new journals) balances; receivables control account agrees with the open items', async () => {
    const st = dataOf(await admin.get('/period-end/statements/trial-balance', { FromDate: ctx.cutover, ToDate: ctx.today }));
    const rows = st.rows || [];
    const debit = r2(rows.reduce((s, r) => s + Number(r.closingDebit || 0), 0));
    const credit = r2(rows.reduce((s, r) => s + Number(r.closingCredit || 0), 0));
    const ctl = rows.find((r) => r.accountCode === ctx.receivableAccount) || {};
    const control = r2(Number(ctl.closingDebit || 0) - Number(ctl.closingCredit || 0));
    const acc = await persona(ctx, personaFor(ctx, 'accounting'));
    const open = listOf(await acc.get('/receipts/open-receivables'));
    const broker = open.filter((o) => (o.billingMode || 'broker') !== 'direct');
    const openTotal = r2(broker.reduce((s, o) => s + Number(o.balance || 0), 0));
    const explained = ctx.state.controlExplained?.total || 0;
    expect(Math.abs(debit - credit) < 0.005, `trial balance debits ${fmt(debit)} vs credits ${fmt(credit)}`);
    expect(Math.abs(control - openTotal - explained) < 0.005, `control account ${fmt(control)} vs open items ${fmt(openTotal)}: difference ${fmt(control - openTotal)}, explained by the migration ${fmt(explained)}`);
    return `trial balance ${rows.length} accounts, closing debits ${fmt(debit)} = credits ${fmt(credit)}; control account ${ctx.receivableAccount} ${fmt(control)} = open items ${fmt(openTotal)} (${open.length} bills)`
      + `${explained ? ` + ${fmt(explained)} carried from SOURCE on policies not migrated (step 4)` : ''}`;
  });

  await log.check('Reports tell migrated from new business (policy source filter)', async () => {
    const all = await admin.get('/policies', { page: 1, pageSize: 500 });
    const mig = await admin.get('/policies', { page: 1, pageSize: 500, source: MIGRATED });
    const migRows = listOf(mig);
    const nonMig = listOf(all).filter((p) => (p.source || '') !== MIGRATED);
    expect(Number(mig.total) === ctx.sourceTotals.policies, `source=${MIGRATED}: ${mig.total} policies, ${ctx.sourceTotals.policies} migrated`);
    expect(migRows.every((p) => p.source === MIGRATED), 'a policy of the filtered list is not flagged as migrated');
    expect(nonMig.some((p) => p.policyNumber === fresh?.policyNumber), `the new policy ${fresh?.policyNumber} is not listed as new business`);
    expect(!migRows.some((p) => p.policyNumber === fresh?.policyNumber), 'the new policy is listed as migrated');
    return `GET /policies: ${all.total} policies; ?source=${MIGRATED}: ${mig.total} (all flagged); new business ${nonMig.length} (${nonMig.map((p) => p.policyNumber).join(', ')})`;
  });
}
