/**
 * Document and report generation sweep: signs in, produces every generated document (PDF), every catalogue report
 * (on-screen preview per criterion and file in each format) and the module exports, and checks each file is real
 * (HTTP 200, expected type, PDF / XLSX signature, CSV header, row counts agree). Writes a Markdown result table.
 *
 *   SWEEP_BASE_URL=http://localhost:8000/api SWEEP_USERNAME=BrokerVerse SWEEP_PASSWORD=... \
 *   DATABASE_URL=postgres://... node scripts/doc-report-sweep.js docs/e2e/DOCUMENT_REPORT_SWEEP.md
 *
 * Run it against a local or test system only: it generates statements, bills and report files.
 */
import fs from 'node:fs';
import pg from 'pg';

const BASE = process.env.SWEEP_BASE_URL || 'http://localhost:8000/api';
const OUT = process.argv[2];
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const q1 = async (sql, p = []) => (await db.query(sql, p)).rows[0] || {};
const results = [];
const SAVE = process.env.SWEEP_SAVE_DIR; // optional: keep every generated file here for review
const save = (name, buf) => { if (SAVE) { fs.mkdirSync(SAVE, { recursive: true }); fs.writeFileSync(`${SAVE}/${name.replace(/[^\w.-]+/g, '_')}`, buf); } };
let token;

async function call(method, path, body) {
  const url = /^https?:/.test(path) ? path : BASE + path;
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const buf = Buffer.from(await res.arrayBuffer());
  // respect the API rate limit: wait as told and try again
  if (res.status === 429) {
    const wait = Number(JSON.parse(buf.toString() || '{}').retryAfter || res.headers.get('retry-after') || 30);
    await new Promise((r) => setTimeout(r, (wait + 1) * 1000));
    return call(method, path, body);
  }
  return { status: res.status, type: res.headers.get('content-type') || '', buf, json: () => JSON.parse(buf.toString()) };
}

function kindOf(r) {
  if (r.buf.subarray(0, 5).toString() === '%PDF-') return 'pdf';
  if (r.buf[0] === 0x50 && r.buf[1] === 0x4b) return 'xlsx';
  if (/csv|text\/plain/.test(r.type)) return 'csv';
  if (/json/.test(r.type)) return 'json';
  return r.type || 'unknown';
}

function record(area, item, output, ok, detail) {
  results.push({ area, item, output, ok, detail });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${area} | ${item} | ${output} | ${detail}\n`);
}

/** A direct file response: checks status, signature and a sensible size. */
async function file(area, item, path, expect) {
  try {
    const r = await call('GET', path);
    const k = kindOf(r);
    const ok = r.status === 200 && k === expect && r.buf.length > 200;
    if (ok) save(`${area}-${item}.${expect}`, r.buf);
    record(area, item, expect.toUpperCase(), ok, ok ? `${Math.round(r.buf.length / 1024)} KB` : `HTTP ${r.status} ${k} ${r.buf.toString().slice(0, 120)}`);
  } catch (e) { record(area, item, expect.toUpperCase(), false, e.message); }
}

/** A JSON response carrying a download link: follows the link and checks the file. */
async function linked(area, item, method, path, body, expect, pick = (d) => d.url || d.downloadUrl || d.fileUrl) {
  try {
    const r = await call(method, path, body);
    if (r.status >= 300) return record(area, item, expect.toUpperCase(), false, `HTTP ${r.status} ${r.buf.toString().slice(0, 160)}`);
    const j = r.json();
    const url = pick(j.data || j);
    if (!url) return record(area, item, expect.toUpperCase(), false, `no link in ${r.buf.toString().slice(0, 160)}`);
    const f = await call('GET', url);
    const k = kindOf(f);
    const ok = f.status === 200 && k === expect && f.buf.length > 50;
    if (ok) save(`${area}-${item}.${expect}`, f.buf);
    record(area, item, expect.toUpperCase(), ok, ok ? `${Math.round(f.buf.length / 1024) || '<1'} KB` : `HTTP ${f.status} ${k}`);
  } catch (e) { record(area, item, expect.toUpperCase(), false, e.message); }
}

async function reports() {
  const cat = (await call('GET', '/reports')).json().data;
  const from = `${new Date().getFullYear()}-01-01`;
  const to = new Date().toISOString().slice(0, 10);
  for (const rep of cat) {
    const def = (await call('GET', `/reports/${rep.code}`)).json().data;
    const criteria = def.criteria?.length ? def.criteria : [null];
    const base = { FromDate: from, ToDate: to, fromDate: from, toDate: to };
    let rows = null;
    for (const c of criteria) {
      const r = await call('POST', `/reports/${rep.code}/run`, { ...base, ...(c ? { ReportCriteria: c } : {}) });
      const ok = r.status < 300;
      const j = ok ? r.json() : null;
      const n = j?.total ?? j?.data?.rows?.length;
      if (rows === null && ok) rows = n;
      record(`Report: ${rep.category}`, `${rep.name}${c ? ` (${c})` : ''}`, 'Screen preview', ok, ok ? `${n} rows` : `HTTP ${r.status} ${r.buf.toString().slice(0, 160)}`);
    }
    for (const fmt of rep.formats || []) {
      const g = await call('POST', `/reports/${rep.code}/generate`, { ...base, ...(criteria[0] ? { ReportCriteria: criteria[0] } : {}), format: fmt });
      if (g.status >= 300) { record(`Report: ${rep.category}`, rep.name, fmt.toUpperCase(), false, `HTTP ${g.status} ${g.buf.toString().slice(0, 160)}`); continue; }
      const d = g.json().data;
      const f = await call('GET', d.downloadUrl);
      const k = kindOf(f);
      let ok = f.status === 200 && k === fmt;
      if (ok) save(`report-${rep.code}.${fmt}`, f.buf);
      let detail = `${d.rowCount} rows, ${Math.round(f.buf.length / 1024) || '<1'} KB`;
      if (ok && rows !== null && d.rowCount !== rows) { ok = false; detail += ` (preview had ${rows})`; }
      if (ok && fmt === 'csv' && !f.buf.toString().split('\n')[0].includes(',')) { ok = false; detail += ' (no CSV header)'; }
      record(`Report: ${rep.category}`, rep.name, fmt.toUpperCase(), ok, ok ? detail : `${detail}; HTTP ${f.status} ${k}`);
    }
  }
  // one temporary schedule per format proves the scheduled path (generate + e-mail queue); removed afterwards
  const temp = [];
  for (const fmt of ['xlsx', 'csv', 'pdf']) {
    const c = await call('POST', '/reports/schedules', { name: `Sweep ${fmt}`, reportCode: 'production-register', cron: '0 6 * * 1-5', params: { period: 'year-to-date', ReportCriteria: 'Overall' }, format: fmt, recipients: ['sweep@broker.example'], enabled: false });
    if (c.status < 300) temp.push(c.json().data.id);
    else record('Report schedule (run now)', `Create ${fmt} schedule`, fmt.toUpperCase(), false, `HTTP ${c.status} ${c.buf.toString().slice(0, 160)}`);
  }
  const schedules = (await call('GET', '/reports/schedules')).json().data || [];
  for (const s of schedules) {
    const r = await call('POST', `/reports/schedules/${s.id}/run`);
    const d = r.status < 300 ? r.json().data : null;
    record('Report schedule (run now)', s.name, (s.format || '').toUpperCase(), r.status < 300, d ? `${d.rows} rows, e-mail queued to ${d.emailed}` : `HTTP ${r.status} ${r.buf.toString().slice(0, 160)}`);
  }
  for (const id of temp) await call('DELETE', `/reports/schedules/${id}`);
}

async function documents() {
  const motorQ = await q1(`SELECT id FROM quotes WHERE upper(lob) = 'MOTOR' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`);
  const fireQ = await q1(`SELECT id FROM quotes WHERE upper(lob) = 'FIRE' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`);
  const iarQ = await q1(`SELECT id FROM quotes WHERE upper(lob) = 'IAR' AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`);
  const motorP = await q1(`SELECT pl.id FROM policies pl JOIN products p ON p.id = pl.product_id WHERE p.line = 'motor' ORDER BY pl.created_at DESC LIMIT 1`);
  const fireP = await q1(`SELECT pl.id FROM policies pl JOIN products p ON p.id = pl.product_id WHERE p.line <> 'motor' ORDER BY pl.created_at DESC LIMIT 1`);
  const anyP = motorP.id ? motorP : await q1('SELECT id FROM policies ORDER BY created_at DESC LIMIT 1');
  const rcpt = await q1(`SELECT id FROM receipts ORDER BY created_at DESC LIMIT 1`);
  const endo = await q1(`SELECT id FROM endorsements ORDER BY created_at DESC LIMIT 1`);
  const renewed = await q1(`SELECT id FROM policies WHERE renewed_from IS NOT NULL ORDER BY created_at DESC LIMIT 1`);
  const claim = await q1(`SELECT id FROM claims ORDER BY created_at DESC LIMIT 1`);
  const dn = await q1(`SELECT id FROM commission_debit_notes ORDER BY created_at DESC LIMIT 1`);
  const batch = await q1(`SELECT id FROM renewal_batches ORDER BY created_at DESC LIMIT 1`);

  const D = 'Document';
  if (motorQ.id) await file(D, 'Quotation - motor', `/document-templates/quote-template/${motorQ.id}`, 'pdf');
  if (fireQ.id) await file(D, 'Quotation - fire', `/document-templates/quote-template-fire/${fireQ.id}`, 'pdf');
  if (iarQ.id) await file(D, 'Quotation - industrial all risks', `/document-templates/quote-template-fire/${iarQ.id}`, 'pdf');
  if (motorP.id) await file(D, 'Policy schedule - motor', `/document-templates/policy-schedule/${motorP.id}`, 'pdf');
  if (fireP.id) await file(D, 'Policy schedule - fire / non-motor', `/document-templates/policy-schedule-fire/${fireP.id}`, 'pdf');
  if (anyP.id) await file(D, 'Insurance placing slip', `/policies/${anyP.id}/documents/insurance-placing-slip-fire`, 'pdf');
  if (anyP.id) await file(D, 'Billing statement - policy', `/billing-statement/policy/${anyP.id}/generate`, 'pdf');
  if (endo.id) await file(D, 'Billing statement - endorsement', `/billing-statement/endorsement/${endo.id}/generate`, 'pdf');
  if (renewed.id) await file(D, 'Billing statement - renewal', `/billing-statement/renewal/${renewed.id}/generate`, 'pdf');
  if (rcpt.id) await file(D, 'Official receipt', `/document-templates/receipt/${rcpt.id}`, 'pdf');
  if (rcpt.id) await linked(D, 'Receipt print (single)', 'GET', `/receipts/printReceipt?receiptId=${rcpt.id}`, null, 'pdf');
  const yr = new Date().getFullYear();
  await linked(D, 'Receipts bulk print (date range)', 'GET', `/receipts/printReceipt?createdAtFrom=${yr}-01-01&createdAtTo=${yr}-12-31`, null, 'pdf');
  await linked(D, 'Disbursement vouchers bulk print', 'GET', `/disbursements/printDisbursement?createdAtFrom=${yr}-01-01&createdAtTo=${yr}-12-31`, null, 'pdf');
  if (dn.id) await file(D, 'Commission debit note (direct bill)', `/remittance/direct-bill/${dn.id}/pdf?download=1`, 'pdf');
  if (claim.id) {
    const names = Object.keys((await q1(`SELECT value FROM app_settings WHERE key = 'claims.documents'`)).value || {});
    for (const n of names) await file(D, `Claim - ${n}`, `/claims/getdocuments/${claim.id}?documentName=${encodeURIComponent(n)}`, 'pdf');
  }

  // placement journey documents and the co-insurance placing slip
  const slip = await q1('SELECT id FROM broker_slips ORDER BY created_at DESC LIMIT 1').catch(() => ({}));
  if (slip.id) {
    await file(D, 'Broker slip (to the market)', `/broker-slips/${slip.id}/documents/broker-slip`, 'pdf');
    const offerIns = await q1('SELECT insurance_company_id AS id FROM insurer_offers WHERE broker_slip_id = $1 ORDER BY id LIMIT 1', [slip.id]).catch(() => ({}));
    if (offerIns.id) await file(D, 'Broker slip (to one insurer)', `/broker-slips/${slip.id}/documents/broker-slip?insurerId=${offerIns.id}`, 'pdf');
  }
  const plc = await q1(`SELECT p.id, (SELECT insurance_company_id FROM risk_participants r WHERE r.entity_type = 'placement' AND r.entity_id = p.id AND NOT r.is_lead ORDER BY r.id LIMIT 1) AS co
    FROM placements p ORDER BY (SELECT count(*) FROM risk_participants r WHERE r.entity_type = 'placement' AND r.entity_id = p.id) DESC, p.created_at DESC LIMIT 1`).catch(() => ({}));
  if (plc.id) {
    await file(D, 'Placement slip (lead insurer)', `/placements/${plc.id}/documents/placement-slip`, 'pdf');
    await file(D, 'Placement slip (whole security)', `/placements/${plc.id}/documents/placement-slip?all=1`, 'pdf');
    if (plc.co) await file(D, 'Placement slip (co-insurer share)', `/placements/${plc.id}/documents/placement-slip?insurerId=${plc.co}`, 'pdf');
  }
  const coPol = await q1(`SELECT entity_id AS id, max(insurance_company_id) FILTER (WHERE NOT is_lead) AS co FROM risk_participants WHERE entity_type = 'policy'
    GROUP BY entity_id HAVING count(*) > 1 LIMIT 1`).catch(() => ({}));
  if (coPol.id) {
    await file(D, 'Placing slip - co-insured policy (security)', `/policies/${coPol.id}/documents/insurance-placing-slip-fire`, 'pdf');
    await file(D, 'Placing slip - one co-insurer\'s share', `/policies/${coPol.id}/documents/insurance-placing-slip-fire?insurerId=${coPol.co}`, 'pdf');
  }

  const rec = await q1('SELECT id FROM bank_reconciliations ORDER BY created_at DESC LIMIT 1').catch(() => ({}));
  if (rec.id) await file(D, 'Bank reconciliation statement', `/bank-reconciliation/reconciliations/${rec.id}/pdf`, 'pdf');

  const E = 'Module export';
  await file(E, 'Claims dashboard report', `/claims/report?startDate=${yr}-01-01&endDate=${yr}-12-31&format=excel`, 'xlsx');
  await file(E, 'Lead report', '/leads/report', 'xlsx');
  await file(E, 'Lead report (CSV)', '/leads/report?format=csv', 'csv');
  await file(E, 'Accounting entries export', `/accounting/export?startDate=${yr}-01-01&endDate=${yr}-12-31`, 'csv');
  if (batch.id) {
    await file(E, 'Renewal batch report', `/policy-renewals/batches/${batch.id}/report`, 'xlsx');
    await file(E, 'Renewal batch report (CSV)', `/policy-renewals/batches/${batch.id}/report?format=csv`, 'csv');
  }
  const period = new Date().toISOString().slice(0, 7);
  const templates = async (type) => (await db.query('SELECT code, name FROM master_records WHERE type_code = $1 AND status = \'active\' ORDER BY id', [type])).rows;
  const link = (d) => d.downloadUrl || d.fileUrl || d.url;
  await linked(E, 'Remittance statement (default layout)', 'POST', '/remittance/statements/generate', { period, statementType: 'Account Statement', selectionType: 'all' }, 'csv', link);
  for (const t of await templates('remittance-statement-template')) await linked(E, `Remittance statement - ${t.name}`, 'POST', '/remittance/statements/generate', { period, statementType: 'Account Statement', selectionType: 'all', templateCode: t.code }, 'csv', link);
  for (const t of await templates('remittance-report-template')) await linked(E, `Remittance report - ${t.name}`, 'POST', '/remittance/reports/generate', { templateCode: t.code, from: `${yr}-01-01`, to: `${yr}-12-31`, insurers: [] }, 'csv', link);
  for (const t of await templates('reinsurance-report-template')) await linked(E, `Reinsurance report - ${t.name}`, 'POST', '/reinsurance/reports/generate', { templateId: t.code }, 'csv', link);
  for (const t of await templates('incentive-report-template')) await linked(E, `Incentive report - ${t.name}`, 'POST', '/incentive/reports/generate', { templateId: t.code, parameters: { period } }, 'csv', link);
}

async function main() {
  const login = await call('POST', '/auth/login', { username: process.env.SWEEP_USERNAME, password: process.env.SWEEP_PASSWORD });
  token = login.json().accessToken || login.json().data?.accessToken;
  if (!token) throw new Error(`sign-in failed: HTTP ${login.status}`);
  await documents();
  await reports();
  await db.end();
  const pass = results.filter((r) => r.ok).length;
  if (OUT) {
    const lines = [`# Document and report generation sweep`, '', `Run ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC against ${BASE}: **${pass} of ${results.length} passed**.`, '',
      'Each file is fetched and checked: HTTP 200, the PDF (`%PDF-`) or XLSX (zip) signature, a CSV header, and that the row count of each report file matches its on-screen preview.', '',
      '| Area | Item | Output | Result | Detail |', '|---|---|---|---|---|',
      ...results.map((r) => `| ${r.area} | ${r.item} | ${r.output} | ${r.ok ? 'Pass' : '**Fail**'} | ${String(r.detail).replace(/\|/g, '/').replace(/\n/g, ' ')} |`), ''];
    fs.writeFileSync(OUT, lines.join('\n'));
  }
  console.log(`\n${pass}/${results.length} passed`);
  process.exit(pass === results.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
