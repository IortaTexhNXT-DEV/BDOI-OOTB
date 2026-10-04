/**
 * Step 6: the go-live lock (golive.locked) refuses the migration workbook and the transaction reset and still accepts
 * the configuration workbook. Step 7: promotion check: TARGET's configuration exported again and compared with the
 * SOURCE workbook of step 1 (equal except the environment-specific values, listed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect } from './log.js';
import * as wb from './workbench.js';
import { reset } from './database.js';
import { explainConfigDiffs, diffTable, REHEARSAL_MASTER } from './steps-config.js';

export async function step6(ctx) {
  const { log } = ctx;
  log.setPhase('Step 6. Go-live lock');
  const admin = ctx.tgt.admin;
  await log.check('Switch on golive.locked (PUT /settings)', async () => {
    await admin.put('/settings', { settings: { 'golive.locked': true } });
    const k = await wb.kits(admin);
    expect(k.locked === true, `golive.locked reads ${k.locked}`);
    ctx.state.locked = true;
    return 'golive.locked = true';
  }, { critical: true });

  await log.check('Migration workbook refused (409)', async () => {
    const r = await wb.upload(admin, 'migration', ctx.migrationBook, 'migration_after_lock.xlsx').then(() => null, (e) => e);
    expect(r && r.status === 409, `expected 409, got ${r ? r.status : 'accepted'}`);
    return `POST /data-load/batches kit=migration -> 409: ${r.apiMessage}`;
  });

  await log.check('Transaction reset refused while locked', async () => {
    const r = await reset(ctx.cfg.targetDb, { execute: false }).then(() => null, (e) => e);
    expect(r && r.code === 'GOLIVE_LOCKED', `expected the refusal GOLIVE_LOCKED, got ${r ? r.message : 'the reset ran'}`);
    return `refused (${r.code}): ${r.message.slice(0, 120)}`;
  });

  await log.check('Configuration workbook still accepted (new master after go-live)', async () => {
    const book = ctx.configBook.copy().only(['Instructions', 'Lists', 'Write-off Reasons']);
    const { code } = REHEARSAL_MASTER;
    const existing = book.rows('Write-off Reasons')[0]?.values || {};
    book.clear('Write-off Reasons');
    book.append('Write-off Reasons', { 'Reason Code': code, Reason: 'Rounding difference after go-live (rehearsal)', 'GL Account': existing['GL Account'] || '', 'Maximum Amount': '5', Status: 'Active' });
    const r = await wb.upload(admin, 'configuration', book, 'configuration_after_lock.xlsx');
    expect(r.batch.rowsError === 0, `${r.errors.map((e) => `${e.column}: ${e.message}`).join('; ')}`);
    const l = await wb.load(admin, r.batch.id);
    const t = wb.totals(l.batch);
    ctx.state.lockMaster = code;
    return `batch ${l.batch.id} loaded: write-off reason ${code} ${t.created ? 'created' : 'unchanged (already there)'}`;
  });
}

export async function step7(ctx) {
  const { log } = ctx;
  log.setPhase('Step 7. Promotion check: TARGET configuration vs the SOURCE workbook of step 1');
  await log.check('Export TARGET configuration and compare with the step 1 workbook', async () => {
    const tb = await wb.template(ctx.tgt.admin, 'configuration', { prefill: true });
    fs.writeFileSync(path.join(ctx.cfg.workDir, '7_TARGET_configuration_final.xlsx'), tb.toBuffer());
    const diffs = wb.compareBooks(ctx.kitInfo.configuration, ctx.configBook, tb);
    const { expected, other: rest } = explainConfigDiffs(ctx, diffs);
    ctx.sections.push({ title: 'Step 7: TARGET configuration (final) vs SOURCE workbook of step 1', body: diffTable(diffs, expected) });
    expect(!rest.length, `unexpected differences: ${rest.join('; ')}`);
    return `${diffs.reduce((s, d) => s + d.changed.length + d.onlyA.length + d.onlyB.length, 0)} difference(s), all expected: ${expected.join('; ') || 'none'}`;
  });
}

/** End of the rehearsal: switch the lock off again (TARGET is a rehearsal environment) unless REHEARSAL_KEEP_LOCK=yes. */
export async function unlock(ctx) {
  if (!ctx.state.locked || ctx.cfg.keepLock) return;
  await ctx.log.check('Rehearsal clean-up: golive.locked switched off again (REHEARSAL_KEEP_LOCK=yes keeps it)', async () => {
    await ctx.tgt.admin.put('/settings', { settings: { 'golive.locked': false } });
    return 'golive.locked = false';
  });
}
