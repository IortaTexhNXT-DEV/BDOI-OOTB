/**
 * Step 4: migration on TARGET. The migration workbook is the blank template of TARGET filled with SOURCE's open book at
 * the close of cutover - 1 (SOURCE plays the old system): clients, in-force policies with their numbers kept as legacy
 * numbers, open items, open claims and the trial balance of SOURCE at cutover - 1 as opening balances. Three errors are
 * injected, reported, fixed in the errors workbook and loaded; the reconciliation is compared with SOURCE and the same
 * workbook loaded again duplicates nothing.
 */
import fs from 'node:fs';
import path from 'node:path';
import { dataOf } from '../uat/http.js';
import { addDays } from '../uat/dates.js';
import { expect, fmt } from './log.js';
import * as wb from './workbench.js';
import { sourceSnapshot } from './database.js';

const save = (ctx, name, book) => fs.writeFileSync(path.join(ctx.cfg.workDir, name), book.toBuffer());
const r2 = (n) => Math.round(Number(n || 0) * 100) / 100;
const sum = (rows, k) => r2(rows.reduce((s, r) => s + Number(r[k] || 0), 0));
const errorText = (e) => `${e.sheetName} row ${e.row} ${e.column || '(row)'}: ${e.message}`;
// the real errors before the "not loaded" rows of an all-or-nothing sheet
const firstErrors = (errors, n = 5) => [...errors].sort((a, b) => /^Not loaded/.test(a.message) - /^Not loaded/.test(b.message)).slice(0, n).map(errorText).join('; ');

/** Fill the blank migration template with the SOURCE snapshot and the SOURCE trial balance at cutover - 1. */
function fill(book, snap, tb) {
  for (const s of ['Clients', 'Policies', 'Open Items', 'Open Claims', 'Opening Balances']) book.clear(s);
  for (const r of snap.rows.clients) book.append('Clients', r);
  for (const r of snap.rows.policies) book.append('Policies', r);
  for (const r of snap.rows.openItems) book.append('Open Items', r);
  for (const r of snap.rows.claims) book.append('Open Claims', r);
  // accounts whose movements net to zero carry no opening balance (the import refuses a row without an amount)
  for (const a of tb.rows.filter((x) => x.debit || x.credit)) book.append('Opening Balances', { 'Account Code': a.accountCode, 'Account Name': a.accountName, Debit: a.debit ? String(a.debit) : '', Credit: a.credit ? String(a.credit) : '' });
  return book;
}

/** The three migration errors (and how to fix them in the errors workbook). */
function inject(ctx, book, snap) {
  const busy = new Set([...snap.rows.openItems.map((o) => o['Policy Number']), ...snap.rows.claims.map((c) => c['Policy Number'])]);
  const policies = book.rows('Policies');
  const byClient = (code) => policies.filter((p) => p.values['Client Code'] === code);
  // a policy dated after the cutover (issue date cutover + 1)
  const late = policies.find((p) => !busy.has(p.values['Policy Number']));
  expect(late, 'no policy without open items or claims to date after the cutover');
  const lateDate = addDays(ctx.cutover, 1);
  const originalIssue = late.values['Issue Date'];
  book.set('Policies', late.row, 'Issue Date', lateDate);
  // a client missing: the client row of a policy (one client, one policy, nothing open) is removed
  const lone = policies.find((p) => p.row !== late.row && !busy.has(p.values['Policy Number']) && byClient(p.values['Client Code']).length === 1);
  expect(lone, 'no client with a single policy without open items to remove');
  const clientRow = book.find('Clients', 'Client Code', lone.values['Client Code']);
  const clientValues = { ...clientRow.values };
  book.remove('Clients', clientRow.row);
  // opening balances that do not balance: the first debit is increased by 100.00
  const ob = book.rows('Opening Balances').find((r) => Number(r.values.Debit) > 0);
  const originalDebit = ob.values.Debit;
  book.set('Opening Balances', ob.row, 'Debit', String(r2(Number(originalDebit) + 100)));
  return {
    late: { policy: late.values['Policy Number'], row: late.row, lateDate, originalIssue },
    lone: { policy: lone.values['Policy Number'], row: lone.row, client: lone.values['Client Code'], clientValues },
    ob: { account: ob.values['Account Code'], row: ob.row, originalDebit },
  };
}

export async function step4(ctx) {
  const { log } = ctx;
  log.setPhase('Step 4. Migration of the open book into TARGET');
  const admin = ctx.tgt.admin;
  const asAt = addDays(ctx.cutover, -1);
  let snap;
  let tb;
  let book;

  await log.check('Numbering raised above the legacy numbers: configuration workbook loaded again after the reset', async () => {
    const r = await wb.upload(admin, 'configuration', ctx.configBook, 'SOURCE_configuration_after_reset.xlsx');
    expect(r.batch.rowsError === 0, `${r.batch.rowsError} error(s): ${r.errors.slice(0, 3).map(errorText).join('; ')}`);
    const changed = wb.sheetLines(r.batch, { only: ['created', 'updated'] });
    expect(changed.every((l) => l.startsWith('Numbering:')), `rows other than Numbering changed: ${changed.join('; ')}`);
    const l = await wb.load(admin, r.batch.id);
    const policy = (dataOf(await admin.get('/document-numbering/policy')) || {});
    return `the reset restarted the counters, so the Numbering sheet is loaded again: ${wb.sheetLines(l.batch, { only: ['updated'] }).join('; ') || 'nothing to change'}; policy series next ${policy.nextNumber}`;
  }, { critical: true });

  await log.check(`SOURCE open book at the close of ${asAt} (SOURCE database, read only) and SOURCE trial balance (API)`, async () => {
    snap = await sourceSnapshot(ctx.cfg.sourceDb, { cutover: ctx.cutover, receivableAccount: ctx.receivableAccount });
    tb = dataOf(await ctx.src.admin.get('/accounting/trial-balance', { asOf: asAt }));
    expect(tb.totals.balanced, `SOURCE trial balance at ${asAt} does not balance`);
    expect(snap.rows.policies.length > 0, 'SOURCE has no policy in force at the cutover');
    ctx.sourceTotals = {
      clients: snap.rows.clients.length, policies: snap.rows.policies.length, gross: sum(snap.rows.policies, 'Gross Premium'), net: sum(snap.rows.policies, 'Net Premium'),
      openItems: snap.rows.openItems.length, openBalance: sum(snap.rows.openItems, 'Open Balance'), claims: snap.rows.claims.length, reserve: sum(snap.rows.claims, 'Outstanding Estimate'),
      tbAccounts: tb.rows.filter((a) => a.debit || a.credit).length, tbZero: tb.rows.filter((a) => !a.debit && !a.credit).length, tbDebit: tb.totals.debit, tbCredit: tb.totals.credit,
      control: r2((tb.rows.find((a) => a.accountCode === ctx.receivableAccount) || {}).balance),
    };
    ctx.snapshot = snap;
    const t = ctx.sourceTotals;
    return `${t.clients} clients, ${t.policies} in-force policies (gross ${fmt(t.gross)}), ${t.openItems} open items (${fmt(t.openBalance)}), ${t.claims} open claims (reserve ${fmt(t.reserve)}), `
      + `trial balance ${t.tbAccounts} accounts with a balance (${t.tbZero} netting to zero left out), debits ${fmt(t.tbDebit)} = credits ${fmt(t.tbCredit)}; not migrated: ${snap.notMigrated.length} policies (expired, cancelled, lapsed or issued on or after the cutover)`;
  }, { critical: true });

  await log.check('Blank migration template downloaded from TARGET and filled from SOURCE', async () => {
    book = fill(await wb.template(admin, 'migration'), snap, tb);
    save(ctx, '4_migration_workbook.xlsx', book);
    ctx.migrationBook = book;
    return ['Clients', 'Policies', 'Open Items', 'Open Claims', 'Opening Balances'].map((s) => `${s} ${book.rows(s).length}`).join(', ');
  }, { critical: true });

  const bad = book.copy();
  const planted = inject(ctx, bad, snap);
  save(ctx, '4_migration_with_errors.xlsx', bad);
  let first;
  await log.check('Injected errors (policy dated after the cutover, client missing, opening balances not balancing) reported as expected', async () => {
    first = await wb.upload(admin, 'migration', bad, 'migration_with_errors.xlsx');
    const e = first.errors;
    const at = (sheet, row) => e.filter((x) => x.sheetName === sheet && x.row === row);
    const late = at('Policies', planted.late.row);
    const lone = at('Policies', planted.lone.row);
    const ob = e.filter((x) => x.sheetName === 'Opening Balances');
    const obRows = bad.rows('Opening Balances').length;
    expect(late.length === 1 && late[0].column === 'Issue Date' && /cutover/.test(late[0].message), `policy ${planted.late.policy}: ${late.map(errorText).join('; ') || 'no error'}`);
    expect(lone.length === 1 && lone[0].column === 'Client Code' && lone[0].message.includes(planted.lone.client), `policy ${planted.lone.policy}: ${lone.map(errorText).join('; ') || 'no error'}`);
    expect(new Set(ob.map((x) => x.row)).size === obRows && ob.some((x) => /do not balance/.test(x.message)), `opening balances: ${ob.length} error(s) on ${new Set(ob.map((x) => x.row)).size} of ${obRows} rows: ${ob.slice(0, 2).map(errorText).join('; ')}`);
    const others = e.filter((x) => !(x.sheetName === 'Opening Balances' || (x.sheetName === 'Policies' && [planted.late.row, planted.lone.row].includes(x.row))));
    expect(!others.length, `other errors: ${firstErrors(others)}`);
    expect(first.batch.status === 'failed', `batch status ${first.batch.status}`);
    const obMsg = ob.find((x) => /do not balance/.test(x.message))?.message;
    return `batch ${first.batch.id}: ${errorText(late[0])} / ${errorText(lone[0])} / Opening Balances: all ${obRows} rows refused (all or nothing): ${obMsg}`;
  }, { critical: true });

  await log.check('Reconciliation of the failed validation is available (dry run totals)', async () => {
    const rec = first.batch.reconciliation;
    expect(rec?.sheets?.length === 5, 'no reconciliation on the validated batch');
    return rec.sheets.map((s) => `${s.sheet}: ${s.workbookRows} valid rows`).join(', ');
  });

  let fixedBook;
  await log.check('Errors workbook downloaded, rows fixed in it (client row added, issue date corrected, debit corrected) and merged into the workbook', async () => {
    const eb = await wb.errorsBook(admin, first.batch.id);
    save(ctx, '4_errors_workbook.xlsx', eb);
    const pol = eb.rows('Policies');
    const obRows = eb.rows('Opening Balances');
    expect(pol.length === 2 && obRows.length === bad.rows('Opening Balances').length, `errors workbook: ${pol.length} policy rows, ${obRows.length} opening balance rows`);
    for (const p of pol) if (p.values['Policy Number'] === planted.late.policy) eb.set('Policies', p.row, 'Issue Date', planted.late.originalIssue);
    eb.append('Clients', planted.lone.clientValues);
    const obFix = obRows.find((r) => r.values['Account Code'] === planted.ob.account);
    eb.set('Opening Balances', obFix.row, 'Debit', planted.ob.originalDebit);
    save(ctx, '4_errors_workbook_fixed.xlsx', eb);
    // the fixed rows go back into the full workbook (by natural key): the corrected workbook is uploaded as a whole
    fixedBook = bad.copy();
    for (const p of eb.rows('Policies')) {
      const at = fixedBook.find('Policies', 'Policy Number', p.values['Policy Number']);
      for (const [h, v] of Object.entries(p.values)) if (h !== 'Errors') fixedBook.set('Policies', at.row, h, v);
    }
    for (const c of eb.rows('Clients')) fixedBook.append('Clients', Object.fromEntries(Object.entries(c.values).filter(([h]) => h !== 'Errors')));
    for (const o of eb.rows('Opening Balances')) {
      const at = fixedBook.find('Opening Balances', 'Account Code', o.values['Account Code']);
      fixedBook.set('Opening Balances', at.row, 'Debit', o.values.Debit);
      fixedBook.set('Opening Balances', at.row, 'Credit', o.values.Credit);
    }
    save(ctx, '4_migration_workbook_corrected.xlsx', fixedBook);
    return `errors workbook: ${pol.length} policy rows and ${obRows.length} opening balance rows with their Errors column; fixed and merged`;
  }, { critical: true });

  let good;
  await log.check('Corrected workbook validated: no error', async () => {
    good = await wb.upload(admin, 'migration', fixedBook, 'migration_corrected.xlsx');
    expect(good.batch.rowsError === 0, `${good.batch.rowsError} error(s): ${firstErrors(good.errors)}`);
    return wb.summaryText(good.batch);
  }, { critical: true });

  let loaded;
  await log.check('Load the migration (one transaction)', async () => {
    loaded = await wb.load(admin, good.batch.id);
    expect(loaded.batch.status === 'loaded', `status ${loaded.batch.status}`);
    const t = wb.totals(loaded.batch);
    ctx.state.migrationBatch = loaded.batch;
    return `${t.created} created (${wb.sheetLines(loaded.batch, { only: ['created'] }).join(', ')})`;
  }, { critical: true });

  await log.check('Reconciliation workbook and control totals compared with SOURCE', async () => {
    const rb = await wb.reconciliationBook(admin, loaded.batch.id);
    save(ctx, '4_reconciliation.xlsx', rb);
    const rec = loaded.reconciliation || loaded.batch.reconciliation;
    const sh = Object.fromEntries(rec.sheets.map((s) => [s.sheet, s]));
    const s = ctx.sourceTotals;
    const rows = [
      ['Clients', s.clients, sh.Clients.inBrokerVerse],
      ['In-force policies', s.policies, sh.Policies.inBrokerVerse],
      ['Gross premium', s.gross, sh.Policies.detail.grossPremium],
      ['Net premium', s.net, sh.Policies.detail.netPremium],
      ['Open items', s.openItems, sh['Open Items'].inBrokerVerse],
      ['Open items balance', s.openBalance, sh['Open Items'].detail.openBalance],
      ['Open claims', s.claims, sh['Open Claims'].inBrokerVerse],
      ['Claims reserve (outstanding estimate)', s.reserve, sh['Open Claims'].detail.estimateAmount],
      ['Trial balance accounts', s.tbAccounts, sh['Opening Balances'].inBrokerVerse],
      ['Trial balance debits', s.tbDebit, sh['Opening Balances'].detail.debit],
      ['Trial balance credits', s.tbCredit, sh['Opening Balances'].detail.credit],
    ];
    const bad = rows.filter(([, a, b]) => Math.abs(Number(a) - Number(b)) > 0.004);
    // the control account check: GL receivables of policies that are not migrated explain a difference
    const control = rec.checks.find((c) => /receivable/i.test(c.check));
    const explained = explainControl(ctx);
    ctx.state.controlExplained = explained;
    ctx.sections.push({ title: 'Step 4: reconciliation of the migration, SOURCE vs TARGET', body: [
      '| Control total | SOURCE at cutover - 1 | TARGET after the load | Result |', '|---|---|---|---|',
      ...rows.map(([k, a, b]) => `| ${k} | ${typeof a === 'number' && !Number.isInteger(a) ? fmt(a) : a} | ${typeof b === 'number' && !Number.isInteger(b) ? fmt(b) : b} | ${Math.abs(Number(a) - Number(b)) > 0.004 ? 'DIFFERENCE' : 'agrees'} |`),
      ...rec.checks.map((c) => `| ${c.check} | ${fmt(c.left)} | ${fmt(c.right)} | ${c.ok ? 'agrees' : `difference ${fmt(c.difference)}`} |`),
      '', explained.lines.length ? `Premiums receivable control account vs open items: difference ${fmt(explained.total)} explained by GL balances on policies that are not migrated:\n\n${explained.lines.map((l) => `- ${l}`).join('\n')}` : 'No GL receivable balance on a policy that is not migrated.',
    ].join('\n') });
    expect(!bad.length, `differences: ${bad.map(([k, a, b]) => `${k} ${a} vs ${b}`).join(', ')}`);
    expect(rec.checks.find((c) => /debits = total credits/.test(c.check))?.ok, 'trial balance check failed');
    expect(Math.abs(Number(control.difference) - explained.total) < 0.005, `receivables control account difference ${fmt(control.difference)} not explained (${fmt(explained.total)} on policies not migrated)`);
    return `${rows.length} control totals agree with SOURCE (policies ${s.policies}, gross ${fmt(s.gross)}, open items ${fmt(s.openBalance)}, claims reserve ${fmt(s.reserve)}, trial balance ${fmt(s.tbDebit)}); `
      + `control account ${ctx.receivableAccount} ${fmt(control.left)} vs open items ${fmt(control.right)}: ${control.ok ? 'agrees' : `difference ${fmt(control.difference)} = GL balances of policies not migrated (${explained.lines.length})`}`;
  });

  await log.check('Same corrected workbook uploaded again: nothing duplicated (every row unchanged)', async () => {
    const again = await wb.upload(admin, 'migration', fixedBook, 'migration_corrected_again.xlsx');
    const t = wb.totals(again.batch);
    expect(again.batch.rowsError === 0, `${again.batch.rowsError} error(s): ${firstErrors(again.errors)}`);
    expect(t.created === 0 && t.updated === 0 && t.unchanged === t.read, `${t.created} new, ${t.updated} changed, ${t.unchanged} unchanged of ${t.read}`);
    const r = await wb.load(admin, again.batch.id);
    const rec = r.reconciliation || r.batch.reconciliation;
    const pol = rec.sheets.find((s) => s.sheet === 'Policies');
    expect(pol.inBrokerVerse === ctx.sourceTotals.policies, `${pol.inBrokerVerse} migrated policies after loading again`);
    return `${t.read} rows unchanged; loaded again: still ${pol.inBrokerVerse} policies, ${rec.sheets.find((s) => s.sheet === 'Clients').inBrokerVerse} clients`;
  });
}

/** GL receivable control balances on policies that are not migrated (they explain the control account check). */
function explainControl(ctx) {
  const migrated = new Set(ctx.snapshot.rows.policies.map((p) => p['Policy Number']));
  const open = new Map();
  for (const o of ctx.snapshot.rows.openItems) open.set(o['Policy Number'], r2((open.get(o['Policy Number']) || 0) + Number(o['Open Balance'])));
  const lines = [];
  let total = 0;
  for (const g of ctx.snapshot.glByPolicy) {
    const diff = r2(Number(g.balance) - (migrated.has(g.policy_number) ? open.get(g.policy_number) || 0 : 0));
    if (Math.abs(diff) < 0.005) continue;
    total = r2(total + diff);
    lines.push(`${g.policy_number || '(no policy)'}: ${fmt(diff)} (${migrated.has(g.policy_number) ? 'migrated, GL differs from its open items' : `not migrated: status ${g.status}, issued ${g.issued_date}`})`);
  }
  return { total, lines };
}
