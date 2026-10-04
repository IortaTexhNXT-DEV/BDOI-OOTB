/**
 * Step 3: smoke test on TARGET (client, quotation, policy, receipt through the API; numbers issued and journals posted),
 * then the transaction reset (dry run, then execute) and the checks that it removed the transactions only: masters and
 * configuration identical to after step 2 (checksums and configuration export), counters restarted at the next numbers
 * the configuration workbook set, trial balance empty.
 */
import { dataOf, listOf } from '../uat/http.js';
import { expect, fmt } from './log.js';
import * as wb from './workbench.js';
import { newMotorPolicy, journalsOf } from './business.js';
import { reset, masterChecksums, checksumDiff, countRows } from './database.js';
import { signInAdmins, dropPersonaSessions } from './sessions.js';
import { diffTable } from './steps-config.js';

const BUSINESS_TABLES = ['leads', 'clients', 'quotes', 'policies', 'receivables', 'receipts', 'journal_vouchers', 'journal_lines', 'commissions'];

export async function step3(ctx) {
  const { log } = ctx;
  log.setPhase('Step 3. Smoke test on TARGET and transaction reset');
  const admin = ctx.tgt.admin;
  let smoke;
  await log.check('Smoke test: lead, client, motor quotation, acceptance, policy and official receipt by the persona users', async () => {
    smoke = await newMotorPolicy(ctx, { label: 'SMOKE TEST', insurerCode: ctx.smokeInsurer });
    ctx.state.smoke = smoke;
    expect(smoke.policyNumber && smoke.receiptNumber, `policy ${smoke.policyNumber}, receipt ${smoke.receiptNumber}`);
    return `lead ${smoke.leadNumber}, client ${smoke.clientCode}, quotation ${smoke.quotationNumber}, policy ${smoke.policyNumber} (gross ${fmt(smoke.gross)}), bill ${smoke.billNumber}, receipt ${smoke.receiptNumber}`;
  }, { critical: true });

  await log.check('Document numbers come from the numbering series configured in step 2', async () => {
    const series = listOf(await admin.get('/document-numbering'));
    const policy = series.find((s) => s.code === 'policy');
    const receipt = series.find((s) => s.code === 'receipt');
    const prev = (code) => ctx.configBook.rows('Numbering').find((r) => r.values['Series Code'] === code)?.values['Next Number'];
    expect(policy.currentValue === Number(prev('policy')), `policy series counter ${policy.currentValue}, expected ${prev('policy')} (the workbook's next number)`);
    expect(receipt.currentValue === Number(prev('receipt')), `receipt series counter ${receipt.currentValue}, expected ${prev('receipt')}`);
    return `policy series issued ${smoke.policyNumber} = next number ${prev('policy')} of the workbook; receipt ${smoke.receiptNumber} = next number ${prev('receipt')}`;
  });

  await log.check('Journals posted for the smoke test (premium booking and receipt) and the trial balance balances', async () => {
    const entries = await journalsOf(ctx, smoke.policyId);
    expect(entries.length >= 2, `${entries.length} journal entries for ${smoke.policyNumber}`);
    const tb = dataOf(await admin.get('/accounting/trial-balance', { asOf: ctx.today }));
    expect(tb.rows.length && tb.totals.balanced, `trial balance ${tb.rows.length} rows, balanced ${tb.totals.balanced}`);
    ctx.state.smokeTb = tb.totals;
    return `${entries.length} journal entries on the policy; trial balance ${tb.rows.length} accounts, debits ${fmt(tb.totals.debit)} = credits ${fmt(tb.totals.credit)}`;
  });

  let plan;
  await log.check('Transaction reset, dry run (counts only, nothing changed)', async () => {
    const before = await countRows(ctx.cfg.targetDb, BUSINESS_TABLES);
    plan = await reset(ctx.cfg.targetDb, { execute: false });
    const after = await countRows(ctx.cfg.targetDb, BUSINESS_TABLES);
    expect(JSON.stringify(before) === JSON.stringify(after), 'the dry run changed the database');
    expect(plan.total > 0, 'the dry run found nothing to remove');
    const restart = plan.series.restart.filter((x) => ['policy', 'receipt', 'invoice', 'client'].includes(x.series)).map((x) => `${x.series} at ${x.preview || x.restartAt}`);
    return `would remove ${plan.total} rows in ${plan.tables.filter((t) => t.rows).length} tables (${plan.tables.filter((t) => t.rows && BUSINESS_TABLES.includes(t.table)).map((t) => `${t.table} ${t.rows}`).join(', ')}); keeps ${plan.kept.tables} master tables (${plan.kept.rows} rows); ${plan.series.reset.length} series restart (${plan.series.restart.filter((x) => x.configured).length} at the next number configured, e.g. ${restart.join(', ')})`;
  }, { critical: true });

  await log.check('Transaction reset, execute (CONFIRM_RESET=yes)', async () => {
    const r = await reset(ctx.cfg.targetDb, { execute: true });
    expect(r.executed && r.total === plan.total, `removed ${r.total}, the dry run counted ${plan.total}`);
    dropPersonaSessions(ctx);
    await signInAdmins(ctx);
    return `removed ${r.total} rows; series restarted: ${r.series.reset.join(', ')}`;
  }, { critical: true });

  await log.check('Transactions gone (API lists and table counts)', async () => {
    const counts = await countRows(ctx.cfg.targetDb, BUSINESS_TABLES);
    const left = Object.entries(counts).filter(([, n]) => n);
    const policies = await admin.get('/policies', { page: 1, pageSize: 1 });
    const receipts = await admin.get('/receipts', { page: 1, perPage: 1 });
    expect(!left.length, `rows left: ${left.map(([t, n]) => `${t} ${n}`).join(', ')}`);
    expect(Number(policies.total) === 0 && listOf(receipts).length === 0, `API: ${policies.total} policies, ${listOf(receipts).length} receipts`);
    return `${BUSINESS_TABLES.join(', ')}: 0 rows; GET /policies total 0, GET /receipts empty`;
  });

  await log.check('Masters and configuration identical to after step 2 (checksums of every master table)', async () => {
    const now = await masterChecksums(ctx.cfg.targetDb);
    const diff = checksumDiff(ctx.state.checksums, now);
    expect(!diff.length, `changed: ${diff.map((d) => `${d.table} (${d.before} -> ${d.after} rows)`).join(', ')}`);
    return `${Object.keys(now).length} tables, ${Object.values(now).reduce((s, x) => s + x.rows, 0)} rows: all checksums equal`;
  });

  await log.check('Configuration export after the reset equals the export after step 2 (Numbering included: the series restart at the next numbers of step 2)', async () => {
    const after = await wb.template(admin, 'configuration', { prefill: true });
    const diffs = wb.compareBooks(ctx.kitInfo.configuration, ctx.state.targetConfigAfter2, after);
    ctx.sections.push({ title: 'Step 3: configuration export after the reset vs after step 2', body: diffTable(diffs) });
    expect(!diffs.length, `differences in ${diffs.map((d) => `${d.sheet} (${[...d.onlyA, ...d.onlyB, ...d.changed.map((c) => c.key)].slice(0, 5).join(', ')})`).join('; ')}`);
    return 'identical, Numbering > Next Number included';
  });

  await log.check('Number counters restarted at the next number configured for the period (transaction series), master series kept', async () => {
    const series = listOf(await admin.get('/document-numbering'));
    const tx = ['policy', 'receipt', 'client', 'quote', 'lead', 'journal', 'invoice'].map((c) => series.find((s) => s.code === c)).filter(Boolean);
    const prev = (code) => Number(ctx.configBook.rows('Numbering').find((r) => r.values['Series Code'] === code)?.values['Next Number'] || 0);
    const wrong = tx.filter((s) => s.currentValue !== 0 || s.nextNumber !== (s.periodStartNumber ?? s.startNumber) || (prev(s.code) > s.startNumber && s.nextNumber !== prev(s.code)));
    expect(!wrong.length, `not restarted at the configured number: ${wrong.map((s) => `${s.code} next ${s.nextNumber} (workbook ${prev(s.code)})`).join(', ')}`);
    return tx.map((s) => `${s.code} next ${s.nextPreview || s.nextNumber}`).join(', ');
  });

  await log.check('Trial balance empty after the reset', async () => {
    const tb = dataOf(await admin.get('/accounting/trial-balance', { asOf: ctx.today }));
    const st = dataOf(await admin.get('/period-end/statements/trial-balance', { FromDate: ctx.today, ToDate: ctx.today }));
    expect(!tb.rows.length && tb.totals.debit === 0, `${tb.rows.length} accounts, debits ${tb.totals.debit}`);
    expect(!(st.rows || []).some((r) => Number(r.closingDebit) || Number(r.closingCredit)), 'the trial balance report still has balances');
    return 'GET /accounting/trial-balance: 0 accounts; trial balance report: no balance';
  });
}
