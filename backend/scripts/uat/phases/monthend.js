/**
 * Month-end: the close of every past month of the scenario in order. Accounting runs the close (accruals, recurring
 * journals, commission deferral, FX revaluation, the automatic checklist), signs the manual checklist items and submits;
 * the Accounting Manager approves. The last past month is soft-closed (open to late adjustments by the manager), the
 * earlier ones closed, and the current month stays open with its checklist previewed.
 */
import { dataOf } from '../http.js';

async function closeMonth(ctx, period, target) {
  const { as, log } = ctx;
  const acc = as.accounting1;
  const existing = (dataOf(await acc.get('/period-end/close-runs', { period })) || []).find((r) => !['cancelled', 'closed', 'soft_closed'].includes(r.status));
  const run = existing || dataOf(await acc.post('/period-end/close-runs', { period, remarks: `Month-end close ${period}` }));
  const executed = dataOf(await acc.post(`/period-end/close-runs/${run.id}/execute`, {}));
  const checks = executed.checks || [];
  const failed = checks.filter((c) => c.status === 'failed' && c.severity === 'blocking');
  if (failed.length) throw new Error(`Blocking checks failed for ${period}: ${failed.map((c) => `${c.code} (${c.message})`).join('; ')}`);
  const warnings = checks.filter((c) => c.status === 'warning');
  if (warnings.length) log.note(`${period}: checklist warnings ${warnings.map((c) => `${c.code}: ${c.message}`).join('; ')}`);
  for (const c of checks.filter((x) => x.itemType === 'manual')) {
    const remarks = {
      bank_reconciliation_signoff: 'BDO operating account reconciled and approved for the month',
      prepayments_depreciation: 'No prepayments or fixed asset additions this month',
      payroll_statutory: 'SSS, PhilHealth and Pag-IBIG remittances filed',
    }[c.code] || 'Reviewed';
    await acc.post(`/period-end/close-runs/${run.id}/checks/${c.code}/sign`, { remarks });
  }
  const submitted = dataOf(await acc.post(`/period-end/close-runs/${run.id}/submit`, { target, remarks: `Books of ${period} ready for review` }));
  let result = submitted;
  if (submitted.status === 'pending-approval') result = dataOf(await as.manager1.post(`/period-end/close-runs/${run.id}/approve`, { remarks: 'Reviewed: trial balance, sub-ledger tie-out and reconciliations' }));
  const status = result.periodInfo?.status || result.status;
  if (status !== target) throw new Error(`Period ${period} is ${status} after the approval (expected ${target})`);
  log.count(target === 'closed' ? 'Months closed' : 'Months soft-closed');
  return result;
}

export async function monthEnd(ctx) {
  const { log, as } = ctx;
  log.setPhase('Month-end close');
  const past = ctx.months.filter((m) => !m.current);
  for (const [i, m] of past.entries()) {
    const target = i === past.length - 1 ? 'soft_closed' : 'closed';
    const ok = await log.step(`Month-end close ${m.period} (${target})`, async () => { await closeMonth(ctx, m.period, target); return true; });
    if (!ok) break; // a month is closed only after the one before it
  }
  const current = ctx.months.find((m) => m.current);
  await log.step(`Month-end checklist preview ${current.period} (period stays open)`, async () => {
    const checks = dataOf(await as.accounting1.get(`/period-end/periods/${current.period}/checks`));
    const failed = checks.filter((c) => c.status === 'failed');
    log.info(`checklist ${current.period}: ${checks.length} items, ${failed.length} failing (${failed.map((c) => c.code).join(', ') || 'none'})`);
  });
}
