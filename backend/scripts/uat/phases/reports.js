/**
 * Reports and dashboards: every report of the catalogue is read (definition), run for the scenario's months with each of
 * its report criteria, and generated as an Excel file; the default run must return rows. The dashboards of each role are
 * read and must show the scenario's business.
 */
import { dataOf, listOf } from '../http.js';

/** Parameters of a run: the scenario's months, the criterion, and the bank account for the bank reports. */
function paramsFor(ctx, def, criterion) {
  const p = { FromDate: ctx.months[0].start, ToDate: ctx.today, ReportCriteria: criterion, perPage: 500 };
  const props = def.parameters?.properties || {};
  if (props.BankAccount) p.BankAccount = 'UAT-BDO-OPS';
  return p;
}

const rowsOf = (r) => (Array.isArray(r?.rows) ? r.rows : Array.isArray(r?.data?.rows) ? r.data.rows : []);

async function runReports(ctx) {
  const { log } = ctx;
  const s = ctx.as.sysadmin;
  const catalogue = listOf(await s.get('/reports'));
  const summary = [];
  for (const entry of catalogue) {
    await log.step(`Report ${entry.code}`, async () => {
      const def = dataOf(await s.get(`/reports/${entry.code}`));
      const criteria = def.criteria?.length ? def.criteria : [def.parameters?.properties?.ReportCriteria?.default || 'Overall'];
      const byCriterion = [];
      for (const c of criteria) {
        const r = dataOf(await s.post(`/reports/${entry.code}/run`, paramsFor(ctx, def, c)));
        byCriterion.push([c, r.total ?? rowsOf(r).length]);
      }
      const gen = dataOf(await s.post(`/reports/${entry.code}/generate`, { ...paramsFor(ctx, def, criteria[0]), format: 'xlsx' }));
      if (!gen?.id && !gen?.url && !gen?.downloadUrl) throw new Error('No generated file returned');
      summary.push({ code: entry.code, name: entry.name, category: entry.category, rows: byCriterion });
      const [first, n] = byCriterion[0];
      if (!n) throw new Error(`${entry.name} returned no rows (criterion ${first})`);
      log.count('Reports run with rows');
    });
  }
  ctx.reportSections = ctx.reportSections || [];
  ctx.reportSections.push({
    title: 'Reports',
    body: ['| Report | Category | Rows per criterion |', '|---|---|---|',
      ...summary.map((x) => `| ${x.name} (\`${x.code}\`) | ${x.category} | ${x.rows.map(([c, n]) => `${c}: ${n}`).join(', ')} |`)].join('\n'),
  });
}

/** Dashboards per role; each must show figures of the scenario. */
async function dashboards(ctx) {
  const { log, as } = ctx;
  const checks = [
    ['Executive dashboard', as.manager1, '/dashboard/executive', (d) => JSON.stringify(d).length > 200],
    ['Sales funnel dashboard', as.sales1, '/dashboard/sales', (d) => JSON.stringify(d).length > 100],
    ['Account executive home', as.sales1, '/agent/get-dashboard-details', (d) => JSON.stringify(d).length > 100],
    ['Processing workbench', as.processing1, '/dashboard/processing', (d) => JSON.stringify(d).length > 100],
    ['Claims dashboard', as.claims1, '/dashboard/claims', (d) => JSON.stringify(d).length > 100],
    ['Claims report', as.claims1, `/claims/report?startDate=${ctx.months[0].start}&endDate=${ctx.today}&includeData=true`, (d) => (d.detailedClaims || []).length > 0],
    ['Commission dashboard', as.accounting1, '/commission/dashboard', (d) => JSON.stringify(d).length > 100],
    ['Collections dashboard', as.accounting1, '/collections/dashboard-stats', (d) => Number(d.totalOutstanding) > 0],
    ['Remittance analytics', as.accounting1, `/remittance/analytics?from=${ctx.months[0].start}&to=${ctx.today}`, (d) => (d.kpiData || []).length > 0],
    ['Renewal performance', as.processing1, '/renewals/performance', (d) => Boolean(d.overall)],
    ['Renewal queue', as.processing1, '/renewals/queue?page=1&pageSize=50', (d) => JSON.stringify(d).length > 50],
    ['Lead statistics', as.sales1, '/leads/stats', (d) => JSON.stringify(d).length > 50],
    ['Quotation statistics', as.sales1, '/quotations/stats', (d) => Number(d.totalQuotations) > 0],
    ['Product analytics', as.sysadmin, '/product-configurator/analytics', (d) => JSON.stringify(d).length > 50],
    ['Premium warranty monitor', as.accounting1, '/credit-control/warranty?status=all', (d) => (d.rows || []).length > 0],
    ['Remittance ageing', as.accounting1, '/credit-control/remittance-ageing', (d) => Boolean(d.summary)],
    ['Instalment ageing', as.accounting1, '/credit-control/instalments/ageing', (d) => Boolean(d)],
    ['Trial balance', as.accounting1, '/accounting/trial-balance', (d) => d.totals?.balanced === true],
    ['Sub-ledger tie-out (month-end checklist)', as.accounting1, `/period-end/periods/${ctx.today.slice(0, 7)}/checks`, (d) => d.find((c) => c.code === 'subledger_tieout')?.status === 'passed'],
  ];
  for (const [name, who, path, ok] of checks) {
    await log.step(`Dashboard: ${name}`, async () => {
      const d = dataOf(await who.get(path));
      if (!ok(d)) throw new Error(`${name} does not show the scenario's data: ${JSON.stringify(d).slice(0, 300)}`);
      log.count('Dashboards checked');
    }, { who: who.username });
  }
}

export async function reports(ctx) {
  ctx.log.setPhase('Reports and dashboards');
  await runReports(ctx);
  await dashboards(ctx);
}
