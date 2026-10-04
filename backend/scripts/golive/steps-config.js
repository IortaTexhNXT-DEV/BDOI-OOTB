/**
 * Steps 1 and 2: the configuration of SOURCE (think UAT) exported with the current data and promoted into TARGET (think
 * Production, migrated and seeded with reference data only): validate, three deliberate errors, errors workbook, fix,
 * load, reload without duplicates, and the comparison of masters and configuration between the two environments.
 */
import fs from 'node:fs';
import path from 'node:path';
import { dataOf, listOf } from '../uat/http.js';
import { expect } from './log.js';
import { sheetCounts } from './book.js';
import * as wb from './workbench.js';
import { persona } from './sessions.js';
import { masterChecksums } from './database.js';

/** Write-off reason the rehearsal adds in step 6 (configuration after the lock); a master, so it stays on TARGET. */
export const REHEARSAL_MASTER = { type: 'write-off-reason', sheet: 'Write-off Reasons', code: 'GLR-ROUND' };

const save = (ctx, name, book) => fs.writeFileSync(path.join(ctx.cfg.workDir, name), book.toBuffer());

/** Step 1: download the configuration workbook with the current data of SOURCE. */
export async function step1(ctx) {
  const { log } = ctx;
  log.setPhase('Step 1. SOURCE configuration exported (Download Template > Current data)');
  await log.check('Download GET /data-load/kits/configuration/template?prefill=true from SOURCE', async () => {
    ctx.configBook = await wb.template(ctx.src.admin, 'configuration', { prefill: true });
    save(ctx, '1_SOURCE_configuration.xlsx', ctx.configBook);
    const counts = sheetCounts(ctx.configBook);
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    expect(total > 0, 'the workbook has no data row');
    ctx.figures.configRows = total;
    ctx.figures.configSheets = Object.keys(counts).length;
    return `${Object.keys(counts).length} object sheets, ${total} data rows (${Object.entries(counts).filter(([, n]) => n).map(([s, n]) => `${s} ${n}`).join(', ')})`;
  }, { critical: true });
  ctx.kitInfo = Object.fromEntries((await wb.kits(ctx.src.admin)).kits.map((k) => [k.kit, k]));
}

/** The three deliberate errors of step 2 (expected sheet, row, column). */
function corrupt(ctx, book) {
  const errors = [];
  // 1. a commission agreement of an insurer on a line of business that does not exist
  const rate = book.rows('Commission Rates').find((r) => r.values.Insurer && !r.values['Line of Business']);
  expect(rate, 'SOURCE has no insurer commission rate to corrupt');
  book.set('Commission Rates', rate.row, 'Line of Business', 'MOTR');
  errors.push({ sheet: 'Commission Rates', row: rate.row, column: 'Line of Business', what: `insurer ${rate.values.Insurer} / ${rate.values.Product || 'any product'}: line of business MOTR (no such code)`,
    fix: (b, row) => b.set('Commission Rates', row, 'Line of Business', '') });
  // 2. a branch with a required field missing (edited description, e-mail cleared)
  const branch = book.rows('Branches')[0];
  expect(branch, 'SOURCE has no branch');
  book.set('Branches', branch.row, 'Email ID', '');
  book.set('Branches', branch.row, 'Description', `${branch.values.Description || branch.values['Branch Name']} (edited)`);
  errors.push({ sheet: 'Branches', row: branch.row, column: 'Email ID', what: `branch ${branch.values['Branch Code']}: Email ID cleared`,
    fix: (b, row) => { b.set('Branches', row, 'Email ID', branch.values['Email ID']); b.set('Branches', row, 'Description', branch.values.Description); } });
  // 3. a user reporting to a user who does not exist
  const user = book.rows('Users').find((r) => r.values.Username !== ctx.cfg.targetAdmin && !/system-admin/.test(r.values.Roles));
  expect(user, 'SOURCE has no user to corrupt');
  book.set('Users', user.row, 'Reporting To', 'no.such.manager');
  errors.push({ sheet: 'Users', row: user.row, column: 'Reporting To', what: `user ${user.values.Username} reporting to no.such.manager`,
    fix: (b, row) => b.set('Users', row, 'Reporting To', user.values['Reporting To']) });
  return errors;
}

const errorText = (e) => `${e.sheetName} row ${e.row} ${e.column || '(row)'}: ${e.message}`;

function collectPasswords(ctx, r) {
  for (const u of r.temporaryPasswords || []) {
    ctx.log.hide(u.temporaryPassword);
    ctx.tgt.temporaryPasswords[u.username] = u.temporaryPassword;
  }
  return (r.temporaryPasswords || []).length;
}

/** Step 2: TARGET receives the configuration. */
export async function step2(ctx) {
  const { log, tgt } = ctx;
  log.setPhase('Step 2. Configuration promoted into TARGET');
  const admin = tgt.admin;

  await log.check(`Set golive.cutover_date = ${ctx.cutover} on TARGET (PUT /settings)`, async () => {
    await admin.put('/settings', { settings: { 'golive.cutover_date': ctx.cutover } });
    const kits = await wb.kits(admin);
    expect(kits.cutoverDate === ctx.cutover, `cutover date reads ${kits.cutoverDate}`);
    expect(kits.locked === false, 'golive.locked is on');
    return `cutover ${kits.cutoverDate}, lock off`;
  }, { critical: true });

  await log.check('Upload the SOURCE workbook to TARGET and validate (dry run)', async () => {
    const r = await wb.upload(admin, 'configuration', ctx.configBook, 'SOURCE_configuration.xlsx');
    ctx.state.cleanBatch = r.batch;
    expect(r.batch.rowsError === 0, `${r.batch.rowsError} row(s) with errors: ${r.errors.slice(0, 5).map(errorText).join('; ')}`);
    const t = wb.totals(r.batch);
    expect(t.read === ctx.figures.configRows, `${t.read} rows read, the workbook has ${ctx.figures.configRows}`);
    return `${wb.summaryText(r.batch)}; ${wb.sheetLines(r.batch).join('; ')}`;
  });

  const book = ctx.configBook.copy();
  const planted = corrupt(ctx, book);
  save(ctx, '2_configuration_with_3_errors.xlsx', book);
  let bad;
  await log.check('Copy with 3 deliberate errors: validation reports exactly them (sheet, row, column)', async () => {
    bad = await wb.upload(admin, 'configuration', book, 'configuration_with_errors.xlsx');
    const got = bad.errors.map((e) => `${e.sheetName}|${e.row}|${e.column}`).sort();
    const want = planted.map((e) => `${e.sheet}|${e.row}|${e.column}`).sort();
    expect(JSON.stringify(got) === JSON.stringify(want), `expected ${want.join(', ')}; got ${bad.errors.map(errorText).join('; ') || 'no error'}`);
    expect(bad.batch.status === 'failed' && bad.batch.rowsError === 3, `batch status ${bad.batch.status}, ${bad.batch.rowsError} rows in error`);
    return `batch ${bad.batch.id}: ${bad.errors.map(errorText).join(' / ')}`;
  }, { critical: true });

  await log.check('Load the valid rows of that batch (configuration default: load valid rows only)', async () => {
    const r = await wb.load(admin, bad.batch.id, { validRowsOnly: true });
    const n = collectPasswords(ctx, r);
    expect(r.batch.status === 'loaded', `status ${r.batch.status}`);
    const t = wb.totals(r.batch);
    expect(t.skipped === 3, `${t.skipped} rows skipped, expected the 3 rows in error`);
    return `${t.created} created, ${t.updated} updated, ${t.unchanged} unchanged, ${t.proposed} for approval, ${t.skipped} skipped; ${n} new user(s) got a one-time temporary password; ${wb.sheetLines(r.batch, { only: ['created', 'updated', 'proposed'] }).join('; ')}`;
  }, { critical: true });

  let fixed;
  await log.check('Download the errors workbook, fix the 3 rows in it and upload it: validation clean', async () => {
    const eb = await wb.errorsBook(admin, bad.batch.id);
    save(ctx, '2_errors_workbook.xlsx', eb);
    const rows = Object.fromEntries(planted.map((p) => [p.sheet, eb.rows(p.sheet)]));
    for (const p of planted) {
      expect(rows[p.sheet].length === 1, `errors workbook sheet ${p.sheet} has ${rows[p.sheet].length} row(s)`);
      expect(eb.headers(p.sheet).includes('Errors') && /:/.test(rows[p.sheet][0].values.Errors), `sheet ${p.sheet} has no Errors text`);
      p.fix(eb, rows[p.sheet][0].row);
    }
    save(ctx, '2_errors_workbook_fixed.xlsx', eb);
    fixed = await wb.upload(admin, 'configuration', eb, 'configuration_errors_fixed.xlsx');
    expect(fixed.batch.rowsError === 0, `still ${fixed.batch.rowsError} error(s): ${fixed.errors.map(errorText).join('; ')}`);
    expect(wb.totals(fixed.batch).read === 3, `${wb.totals(fixed.batch).read} rows read, expected 3`);
    return `errors workbook: 3 rows with an Errors column (${planted.map((p) => p.what).join('; ')}); fixed: ${wb.summaryText(fixed.batch)}`;
  }, { critical: true });

  await log.check('Load the fixed rows', async () => {
    const r = await wb.load(admin, fixed.batch.id);
    const n = collectPasswords(ctx, r);
    const t = wb.totals(r.batch);
    return `${t.created} created, ${t.updated} updated, ${t.unchanged} unchanged${n ? `; ${n} new user(s) with a temporary password` : ''}`;
  });

  await log.check('Upload the full original workbook again: every row unchanged, nothing duplicated', async () => {
    const r = await wb.upload(admin, 'configuration', ctx.configBook, 'SOURCE_configuration_again.xlsx');
    const t = wb.totals(r.batch);
    ctx.state.reloadBatch = r.batch;
    expect(r.batch.rowsError === 0, `${r.batch.rowsError} error(s): ${r.errors.slice(0, 5).map(errorText).join('; ')}`);
    expect(t.created === 0 && t.updated === 0, `${t.created} new and ${t.updated} changed rows: ${wb.sheetLines(r.batch, { only: ['created', 'updated'] }).join('; ')}`);
    return `${t.read} rows: ${t.unchanged} unchanged, ${t.proposed} for approval (pending authority limits), 0 new, 0 changed`;
  });

  await compareEnvironments(ctx);

  await log.check('Persona users sign in on TARGET with the temporary password of the load and set their own', async () => {
    const names = ctx.configBook.rows('Users').map((r) => r.values.Username).filter((u) => u !== ctx.cfg.targetAdmin);
    for (const u of names) await persona(ctx, u);
    return `${names.length} user(s) signed in (first sign-in password change)`;
  }, { critical: true });

  await log.check('Authority limits of the workbook approved by a second administrator (maker-checker)', async () => {
    const pending = dataOf(await admin.get('/access-control/authority-limits', { status: 'pending' })) || [];
    const approver = ctx.configBook.rows('Users').map((r) => r.values).find((u) => u.Username !== ctx.cfg.targetAdmin && /system-admin/.test(u.Roles))?.Username;
    if (!pending.length) return 'no limit waiting for approval (TARGET already had the same limits)';
    expect(approver, 'no second System Administrator in the workbook to approve the limits');
    const s = await persona(ctx, approver);
    const own = await admin.post(`/access-control/authority-limits/${pending[0].id}/decision`, { decision: 'approve' }).then(() => null, (e) => e);
    expect(own && own.status >= 400, 'the administrator who loaded the limits could approve them himself');
    for (const l of pending) await s.post(`/access-control/authority-limits/${l.id}/decision`, { decision: 'approve', note: 'Go-live rehearsal: limits of the configuration workbook' });
    const left = dataOf(await admin.get('/access-control/authority-limits', { status: 'pending' })) || [];
    expect(!left.length, `${left.length} limit(s) still pending`);
    return `${pending.length} limit(s) proposed by the load; the loader's own approval refused (${own.status}); approved by ${approver}`;
  });

  await log.check('Environment comparison (Compare environments, POST /data-load/compare on TARGET with the SOURCE export): mirrored, environment-specific differences only', async () => {
    const c = await wb.compare(admin, ctx.configBook, 'SOURCE_configuration.xlsx');
    fs.writeFileSync(path.join(ctx.cfg.workDir, `2_comparison_SOURCE_vs_TARGET_${c.id}.xlsx`), await wb.comparisonWorkbook(admin, c.id));
    const rows = c.verdict === 'mirrored' ? [] : await wb.comparisonRows(admin, c.id);
    // the write-off reason of step 6 of an earlier rehearsal is on TARGET only (configuration after go-live)
    const rehearsal = (r) => r.status === 'only-here' && r.sheetName === REHEARSAL_MASTER.sheet && r.key.toUpperCase() === REHEARSAL_MASTER.code;
    const unexpected = rows.filter((r) => !rehearsal(r));
    const env = c.environmentSpecific.map((e) => `${e.sheetName} ${e.key}${e.header ? ` ${e.header}` : ''}: "${e.file ?? '(none)'}" / "${e.here ?? '(none)'}" (${e.rule})`);
    const t = c.totals;
    ctx.sections.push({ title: 'Step 2: environment comparison SOURCE vs TARGET (Compare environments)', body: [
      `Verdict: **${c.verdictText}** (comparison ${c.id}): ${t.identical} identical, ${t.different} different, ${t.onlyInFile} only in SOURCE, ${t.onlyHere} only in TARGET, ${t.environmentSpecific} environment-specific.`,
      '', '| Sheet | Identical | Different | Only in SOURCE | Only in TARGET | Environment-specific |', '|---|---|---|---|---|---|',
      ...c.sheets.map((s) => `| ${s.name} | ${s.identical} | ${s.different} | ${s.onlyInFile} | ${s.onlyHere} | ${s.environmentSpecific} |`),
      '', 'Environment-specific (not differences):', '', ...(env.length ? env.map((e) => `- ${e}`) : ['- none']),
      ...(rows.length ? ['', 'Differences:', '', ...rows.map((r) => `- ${r.sheetName} ${r.key}: ${r.status === 'different' ? r.differences.map((d) => `${d.header} "${d.file}" / "${d.here}"`).join('; ') : r.status}${rehearsal(r) ? ' (expected: step 6 of an earlier rehearsal)' : ''}`)] : []),
    ].join('\n') });
    expect(!unexpected.length, `${c.verdictText}: ${unexpected.slice(0, 10).map((r) => `${r.sheetName} ${r.key} ${r.status}${r.differences.length ? ` (${r.differences.map((d) => d.header).join(', ')})` : ''}`).join('; ')}`);
    return `${c.verdictText}${rows.length ? ` apart from ${REHEARSAL_MASTER.code} of an earlier rehearsal` : ''}: ${t.identical} rows identical over ${c.sheets.length} sheets; ${t.environmentSpecific} environment-specific value(s): ${env.join('; ') || 'none'}`;
  });

  await log.check('Baseline of TARGET masters and configuration after step 2 (checksums, configuration export)', async () => {
    ctx.state.checksums = await masterChecksums(ctx.cfg.targetDb);
    ctx.state.targetConfigAfter2 = await wb.template(admin, 'configuration', { prefill: true });
    save(ctx, '2_TARGET_configuration_after_load.xlsx', ctx.state.targetConfigAfter2);
    const tables = Object.keys(ctx.state.checksums).length;
    return `${tables} master and configuration tables (${Object.values(ctx.state.checksums).reduce((s, x) => s + x.rows, 0)} rows) checksummed`;
  });
}

/** Counts per master type, chart of accounts, commission rate matrix, numbering series, authority limits: SOURCE vs TARGET. */
async function compareEnvironments(ctx) {
  const { log } = ctx;
  const s = ctx.src.admin;
  const t = ctx.tgt.admin;
  await log.check('Masters: record count per master type, SOURCE vs TARGET', async () => {
    const types = (dataOf(await s.get('/masters')) || []).map((x) => x.code);
    const rows = [];
    const diff = [];
    for (const type of types) {
      const count = async (sess) => {
        const r = await sess.call('GET', `/masters/${type}?perPage=1`).catch((e) => ({ total: `error ${e.status}` }));
        return r.total ?? listOf(r).length;
      };
      const [a, b] = [await count(s), await count(t)];
      rows.push([type, a, b]);
      if (a !== b) diff.push(`${type} ${a} / ${b}`);
    }
    const inKit = new Set(ctx.kitInfo.configuration.sheets.filter((x) => x.key.startsWith('master:')).map((x) => x.key.slice(7)));
    // the write-off reason of step 6 of an earlier rehearsal is on TARGET only
    const marker = listOf(await t.get(`/masters/${REHEARSAL_MASTER.type}`, { search: REHEARSAL_MASTER.code, perPage: 5 })).length ? REHEARSAL_MASTER.type : null;
    const fromEarlierRun = (d) => d.split(' ')[0] === marker && Number(d.split(' / ')[1]) - Number(d.split(' ')[1]) === 1;
    const explained = diff.filter((d) => !inKit.has(d.split(' ')[0]) || fromEarlierRun(d));
    const unexplained = diff.filter((d) => inKit.has(d.split(' ')[0]) && !fromEarlierRun(d));
    ctx.sections.push({ title: 'Step 2: master record counts, SOURCE vs TARGET', body: ['| Master type | In the workbook | SOURCE | TARGET |', '|---|---|---|---|',
      ...rows.map(([ty, a, b]) => `| ${ty} | ${inKit.has(ty) ? 'yes' : 'no (entered on screen)'} | ${a} | ${b}${a !== b ? ' (differs)' : ''} |`)].join('\n') });
    expect(!unexplained.length, `master types of the workbook differ: ${unexplained.join(', ')}`);
    return `${types.length} master types compared; ${types.length - diff.length} equal${explained.length ? `; differing as expected (not in the workbook, or ${REHEARSAL_MASTER.code} of step 6 of an earlier rehearsal): ${explained.join(', ')}` : ''}`;
  });

  await log.check('Chart of accounts, SOURCE vs TARGET', async () => {
    const codes = async (sess) => listOf(await sess.get('/accounting/accounts')).map((a) => `${a.code}|${a.name}|${a.accountType}|${a.status}`).sort();
    const [a, b] = [await codes(s), await codes(t)];
    const onlyA = a.filter((x) => !b.includes(x));
    const onlyB = b.filter((x) => !a.includes(x));
    expect(!onlyA.length && !onlyB.length, `only SOURCE: ${onlyA.slice(0, 5).join(', ')}; only TARGET: ${onlyB.slice(0, 5).join(', ')}`);
    return `${a.length} accounts on both, identical (code, name, type, status)`;
  });

  await log.check('Commission rate matrix, SOURCE vs TARGET', async () => {
    const key = (r) => [r.insurerCode || '', r.productCode || '', (r.lineOfBusiness || '').toLowerCase(), r.policyType, Number(r.rate), r.effectiveFrom?.slice(0, 10), r.effectiveTo?.slice(0, 10) || '', r.active].join('|');
    const [a, b] = [listOf(await s.get('/commission-rates')).map(key).sort(), listOf(await t.get('/commission-rates')).map(key).sort()];
    const onlyA = a.filter((x) => !b.includes(x));
    const onlyB = b.filter((x) => !a.includes(x));
    expect(!onlyA.length && !onlyB.length, `only SOURCE: ${onlyA.join(', ')}; only TARGET: ${onlyB.join(', ')}`);
    return `${a.length} rates on both, identical`;
  });

  await log.check('Document numbering series definitions and next numbers, SOURCE vs TARGET', async () => {
    const def = (x) => `${x.code}|${x.prefix}|${x.pattern}|${x.seqWidth}|${x.resetRule}|${x.active}`;
    const [a, b] = [listOf(await s.get('/document-numbering')), listOf(await t.get('/document-numbering'))];
    const defsDiffer = a.filter((x) => !b.some((y) => def(y) === def(x))).map((x) => x.code);
    const next = a.filter((x) => { const y = b.find((z) => z.code === x.code); return y && y.nextNumber !== x.nextNumber; }).map((x) => `${x.code} ${x.nextNumber}/${b.find((z) => z.code === x.code).nextNumber}`);
    expect(!defsDiffer.length, `definitions differ: ${defsDiffer.join(', ')}`);
    expect(!next.length, `next numbers differ (SOURCE/TARGET): ${next.join(', ')}`);
    return `${a.length} series: same prefix, pattern, width, reset rule, active flag and next number (e.g. policy next ${a.find((x) => x.code === 'policy')?.nextNumber})`;
  });

  await log.check('Authority limits: SOURCE active limits are pending approval on TARGET (maker-checker, as designed)', async () => {
    const lim = async (sess, status) => (dataOf(await sess.get('/access-control/authority-limits', { status })) || []).filter((l) => l.roleCode)
      .map((l) => `${l.transactionType}|${l.roleCode}|${l.maxAmount ?? 'unlimited'}`);
    const [srcActive, tgtActive, tgtPending] = [await lim(s, 'active'), await lim(t, 'active'), await lim(t, 'pending')];
    ctx.state.pendingLimits = tgtPending;
    const missing = srcActive.filter((x) => !tgtActive.includes(x) && !tgtPending.includes(x));
    expect(!missing.length, `SOURCE limits neither active nor pending on TARGET: ${missing.join(', ')}`);
    return `SOURCE ${srcActive.length} active role limits; TARGET ${srcActive.filter((x) => tgtActive.includes(x)).length} already equal (reference data), ${tgtPending.length} pending approval`;
  });

  await log.check('Whole configuration workbook: SOURCE export vs TARGET export after the load', async () => {
    const tb = await wb.template(t, 'configuration', { prefill: true });
    const diffs = wb.compareBooks(ctx.kitInfo.configuration, ctx.configBook, tb);
    const { expected, other } = explainConfigDiffs(ctx, diffs);
    ctx.sections.push({ title: 'Step 2: configuration differences SOURCE vs TARGET after the load', body: diffTable(diffs, expected) });
    expect(!other.length, `unexpected differences: ${other.join('; ')}`);
    return diffs.length ? `differences, all expected: ${expected.join('; ')}` : 'identical';
  });
}

/** Differences of two configuration exports that are expected between environments, with the reason. */
export function explainConfigDiffs(ctx, diffs) {
  const expected = [];
  const other = [];
  for (const d of diffs) {
    for (const c of d.changed) {
      const cols = c.columns.map((x) => x.column).join(', ');
      let why = null;
      if (d.sheet === 'Settings' && c.key === 'golive.cutover_date') why = 'cutover date is set on TARGET only (environment-specific)';
      else if (d.sheet === 'Settings' && /^(general\.(app_url|environment|public_url)|email\.|notification\.email)/.test(c.key)) why = 'environment-specific setting';
      else if (d.sheet === 'Numbering' && cols === 'Next Number') why = 'counters move with the business of each environment';
      else if (d.sheet === 'Authority Limits' && (ctx.state.pendingLimits || []).some((p) => p.startsWith(`${c.key.split(' | ').join('|')}|`))) {
        why = 'the SOURCE limit waits for approval on TARGET (maker-checker); the export lists the active limit';
      }
      if (why) expected.push(`${d.sheet} ${c.key}: ${cols} (${why})`);
      else other.push(`${d.sheet} ${c.key}: ${c.columns.map((x) => `${x.column} ${x.a || '(empty)'} -> ${x.b || '(empty)'}`).join(', ')}`);
    }
    for (const k of d.onlyA) {
      if (d.sheet === 'Authority Limits') expected.push(`${d.sheet} ${k}: pending approval on TARGET (export lists active limits)`);
      else other.push(`${d.sheet} ${k}: only in SOURCE`);
    }
    for (const k of d.onlyB) {
      if (d.sheet === REHEARSAL_MASTER.sheet && k === REHEARSAL_MASTER.code.toLowerCase()) expected.push(`${d.sheet} ${REHEARSAL_MASTER.code}: added on TARGET by step 6 of the rehearsal (configuration after go-live)`);
      else other.push(`${d.sheet} ${k}: only in TARGET`);
    }
  }
  return { expected, other };
}

export function diffTable(diffs, expected = []) {
  if (!diffs.length) return 'None: the two exports are identical.';
  const L = ['| Sheet | Key | Difference |', '|---|---|---|'];
  const esc = (v) => String(v ?? '').replace(/\|/g, '\\|');
  for (const d of diffs) {
    for (const c of d.changed) L.push(`| ${esc(d.sheet)} | ${esc(c.key)} | ${esc(c.columns.map((x) => `${x.column}: ${x.a || '(empty)'} -> ${x.b || '(empty)'}`).join('; '))} |`);
    for (const k of d.onlyA) L.push(`| ${esc(d.sheet)} | ${esc(k)} | only in the first export |`);
    for (const k of d.onlyB) L.push(`| ${esc(d.sheet)} | ${esc(k)} | only in the second export |`);
  }
  if (expected.length) L.push('', 'Expected (environment-specific):', '', ...expected.map((e) => `- ${e}`));
  return L.join('\n');
}
