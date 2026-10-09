/**
 * The go-live workbooks: template (blank or with the current data), reading an uploaded workbook, the errors workbook
 * (only the rows with errors, plus an Errors column, in the same layout so it is fixed and uploaded again) and the
 * reconciliation workbook of a migration load.
 *
 * Layout of every object sheet: row 1 the headers (navy; required columns end with " *"), row 2 a sample row (amber,
 * italic, first cell starting with SAMPLE: never loaded), data from row 3. Lists: the allowed values that the
 * drop-downs of the object sheets point to. Instructions: load order, rules, the cutover date rule, the sync of new
 * and migrated data, what is entered on screen, and the columns of every sheet.
 */
import { many } from '../../db/pool.js';
import { getSetting } from '../../lib/settings.js';
import { colLetter, writeXlsx } from '../../lib/xlsx.js';
import { FS_GROUPS } from '../accounting/service.js';
import { POLICY_TYPES } from '../commission-rates/resolve.js';
import { RULE_KINDS, RULE_METHODS } from '../premium-charges/calculator.js';
import { RESET_RULES } from '../document-numbering/service.js';
import { CONFIGURATION_ON_SCREEN } from './configuration.js';
import { MIGRATION_ON_SCREEN } from './migration.js';
import { SAMPLE_PREFIX } from './common.js';
import { readSheets } from './compare.js';

export const KITS = {
  configuration: { title: 'Go-live configuration workbook', file: 'GoLive_Configuration_Workbook.xlsx' },
  migration: { title: 'Go-live migration workbook', file: 'GoLive_Migration_Workbook.xlsx' },
};
const VALIDATION_ROWS = 5000;

/** Allowed values of the Lists sheet: { name: { values, strict } }. Lists read from the database are not strict (the workbook may add values). */
export async function buildLists(sheets) {
  const lists = {
    'Yes No': { values: ['Yes', 'No'] },
    Status: { values: ['Active', 'Inactive'] },
    'Account Type': { values: ['asset', 'liability', 'equity', 'income', 'expense'] },
    'Statement Group': { values: FS_GROUPS.map(([g]) => g) },
    'Normal Balance': { values: ['debit', 'credit'] },
    'Account Status': { values: ['active', 'inactive'] },
    'User Status': { values: ['active', 'inactive'] },
    'Commission Policy Type': { values: POLICY_TYPES },
    'Charge Kind': { values: RULE_KINDS },
    'Charge Method': { values: RULE_METHODS },
    'Fraction Rule': { values: ['round_up', 'prorate'] },
    'Reset Rule': { values: RESET_RULES },
    'Client Type': { values: ['individual', 'corporate'] },
    'Billing Mode': { values: ['broker', 'direct'] },
    'Payment Status': { values: await getSetting('policies.payment_statuses', ['Pending', 'Reviewing', 'Partial', 'Completed', 'Refunded']) },
    'Claim Status': { values: ['registered', 'in-review'] },
    Roles: { values: (await many("SELECT code FROM roles WHERE status = 'active' ORDER BY id")).map((r) => r.code), strict: false },
    Insurers: { values: (await many("SELECT code FROM insurance_companies WHERE status = 'active' AND code IS NOT NULL ORDER BY code")).map((r) => r.code), strict: false },
    Products: { values: (await many("SELECT code FROM products WHERE status = 'active' AND code IS NOT NULL ORDER BY code")).map((r) => r.code), strict: false },
    'Transaction Types': { values: (await many('SELECT code FROM authority_transaction_types ORDER BY sort_order, code')).map((r) => r.code) },
  };
  for (const s of sheets) for (const c of s.columns) if (c.list && c.allowed && !lists[c.list]) lists[c.list] = { values: c.allowed };
  // only the lists some column uses
  const used = new Set(sheets.flatMap((s) => s.columns.map((c) => c.list).filter(Boolean)));
  return Object.fromEntries(Object.entries(lists).filter(([name]) => used.has(name)));
}

const headerOf = (c) => `${c.header}${c.required ? ' *' : ''}`;

function sampleRow(sheet) {
  const row = sheet.columns.map((c) => (sheet.sample?.[c.key] === undefined ? '' : String(sheet.sample[c.key])));
  row[0] = row[0] ? `${SAMPLE_PREFIX} ${row[0]}` : SAMPLE_PREFIX;
  return row;
}

/** Worksheet of one object sheet: header, sample row, data rows (by column key), drop-downs. */
function objectSheet(sheet, rows, listColumns, { errors = null } = {}) {
  const columns = sheet.columns.map((c) => ({ header: headerOf(c), width: Math.max(14, Math.min(40, c.header.length + 6)) }));
  if (errors) columns.push({ header: 'Errors', width: 70 });
  const data = rows.map((r, i) => {
    const out = sheet.columns.map((c) => r[c.key] ?? '');
    if (errors) out.push(errors[i] || '');
    return out;
  });
  const validations = sheet.columns.map((c, i) => (c.list && listColumns[c.list] ? {
    sqref: `${colLetter(i)}2:${colLetter(i)}${VALIDATION_ROWS}`, formula: listColumns[c.list].ref, strict: listColumns[c.list].strict,
  } : null)).filter(Boolean);
  const sample = sampleRow(sheet);
  if (errors) sample.push('');
  return { name: sheet.name, columns, rows: [sample, ...data], rowStyles: ['sample'], headerStyle: 'navy', textColumns: true, autoFilter: false, validations };
}

function listsSheet(lists) {
  const names = Object.keys(lists);
  const height = Math.max(0, ...names.map((n) => lists[n].values.length));
  const rows = [];
  for (let i = 0; i < height; i += 1) rows.push(names.map((n) => lists[n].values[i] ?? ''));
  const refs = Object.fromEntries(names.map((n, i) => [n, { ref: `Lists!$${colLetter(i)}$2:$${colLetter(i)}$${Math.max(2, lists[n].values.length + 1)}`, strict: lists[n].strict !== false }]));
  return { sheet: { name: 'Lists', columns: names.map((n) => ({ header: n, width: Math.max(14, n.length + 4) })), rows, headerStyle: 'navy', textColumns: true, autoFilter: false }, refs };
}

/** Instructions sheet rows ([item, detail]; rowStyles 'bold' for section headings). */
function instructions(kit, sheets, { prefill, cutover, environment, day }) {
  const rows = [];
  const styles = [];
  const head = (t) => { rows.push([t, '']); styles[rows.length - 1] = 'bold'; };
  const line = (a, b = '') => rows.push([a, b]);
  head(KITS[kit].title);
  line('Content', prefill ? `Current data of this environment${environment ? ` (${environment})` : ''}, exported ${day || ''}. Load it into the next environment to promote the ${kit}.` : 'Blank template: fill in the object sheets.');
  line('Upload with', 'API: POST /api/data-load/batches (multipart field "file", field kit), System Administrator; the go-live scripts (npm run rehearsal:golive) use it.');
  line('Cutover date', cutover ? `${cutover} (setting golive.cutover_date)` : 'Not set yet: golive.cutover_date (Settings sheet of the configuration workbook, or Master > Configuration)');
  head('How to fill in');
  line('Headers', 'Row 1 of each sheet holds the column headers. Columns ending with * are required. Keep the headers; the column order does not matter and a column you do not use may be left empty or removed.');
  line('Sample row', `Row 2 (amber, italic) is a sample. A row whose first cell starts with ${SAMPLE_PREFIX} is never loaded; enter your data from row 3, or overwrite the sample row.`);
  line('Drop-downs', 'Columns with fixed values offer a drop-down (Lists sheet). Lists of insurers, products and roles show what this environment has; a value added in the same workbook is accepted too.');
  line('Formats', 'Dates as YYYY-MM-DD; amounts as plain numbers (no currency sign); rates as fractions where the column says so (0.20 for 20%). The sheets are formatted as text so Excel keeps codes and dates as typed.');
  line('Keys', 'Every row is matched on its natural key (code, username, setting key, legacy number ...): a row whose key exists updates that record, a new key creates one. Loading the same or a corrected workbook again never duplicates; unchanged rows are skipped.');
  head('Load order');
  sheets.forEach((s, i) => line(`${i + 1}. ${s.name}`, `${s.menu}. Key: ${s.keyColumns.map((k) => s.columns.find((c) => c.key === k)?.header || k).join(' + ')}`));
  head('Validate, fix and load');
  line('1. Upload and validate', 'The upload validates without saving: every sheet runs through its importer in the load order above inside one database transaction that is rolled back, so a row may refer to a record of an earlier sheet of the same workbook (e.g. a policy to a client and an insurer).');
  line('2. Result', 'Rows read, valid and with errors per sheet; each error with its sheet, row number, column and message.');
  line('3. Fix', 'Download errors: a workbook in this layout with only the rows in error and an Errors column. Correct those rows and upload that file (or the whole corrected workbook) again.');
  line('4. Load', 'Load runs when the latest validation has no error (or with "load valid rows only"). Everything is loaded in one transaction, recorded in the history and the audit trail.');
  if (kit === 'configuration') {
    head('Rules');
    line('Users', 'Passwords are never in the workbook. A new user gets a temporary password shown once to the administrator after the load (must be changed at the first sign-in). A load cannot change your own account.');
    line('Authority limits', 'Loaded limits wait for the approval of another administrator (maker-checker) on Master > Generals > User Management > Authority Matrix.');
    line('Numbering', 'Next Number is the next sequence number of the current period (last number of the old system + 1); it cannot go below a number already issued. It is kept on the series as the start of the period, so the transaction reset after the smoke test restarts the series there (no need to load the sheet again). It must be above every migrated number of the same format (checked by both workbooks).');
    line('Settings', 'Only settings of Master > Configuration are loaded; settings of another screen (the brand pack, Company, Premium Taxes, Account Determination) are changed there. golive.locked is switched on in Master > Configuration, not by a workbook.');
    line('Promotion', 'Download with current data from the source environment (Dev, SIT, UAT, Pre-Prod), upload into the next one. Rows equal to the target are skipped; differences update the target.');
    head('Entered on screen (not in this workbook)');
    for (const [what, where] of CONFIGURATION_ON_SCREEN) line(what, where);
  } else {
    head('Cutover date rule');
    line('Cutover date', 'golive.cutover_date is the first day of live transactions in BrokerVerse. It must be set before the migration workbook is validated.');
    line('Dated before cutover', 'Policy issue dates, claim loss and reported dates and client birth dates must be before the cutover date; a row dated on or after it is refused (enter it in BrokerVerse as new business).');
    line('In force', 'Policies must still be in force at cutover (expiry on or after the cutover date). Open claims are registered or in review.');
    line('Opening balances', 'The trial balance of the old system at the close of the day before the cutover date. Debits must equal credits; the sheet loads all or nothing: when a row is in error, that row shows its error and the other rows are held (not loaded) until it is fixed; upload the whole sheet again. A row with no debit and no credit (zero balance) is accepted and ignored. Loading again replaces the earlier load. The fiscal year must have no journal posted before the cutover.');
    line('Go-live lock', 'Once golive.locked is on (Master > Configuration), the migration workbook is refused; the configuration workbook stays available for new masters.');
    head('New and migrated data');
    line('Flags', 'Migrated clients and policies carry source go-live-migration (policy: doc.source) and the load batch id; open items are bills with source opening and the cutover date; open claims carry details.source go-live-migration.');
    line('No postings', 'Migration posts no journal, bill booking or commission accrual: the opening balances carry the money. Open items age and are collected with normal official receipts.');
    line('Legacy numbers', 'Migrated records keep the numbers of the old system (client code, policy number, claim number, and the bill number of an open item). New business takes the next number of its Document Numbering series (Numbering sheet of the configuration workbook); a legacy number in the range a series has still to issue is refused. An open item whose bill number another bill already carries (one debit note over several policies) gets the next invoice number and keeps the old number as its reference, shown next to the bill number and searchable.');
    line('Transactions', 'Opening balances are dated the day before cutover; every new transaction is dated on or after the cutover date.');
    line('Renewals', 'Migrated in-force policies are ordinary active policies: the renewal queue picks them up as they approach expiry. Policies expiring soon need no separate sheet.');
    line('Reports', 'Policy lists and the API show the source (go-live-migration) and can be filtered on it (GET /api/policies?source=go-live-migration).');
    line('Reconciliation', 'Every validation and load gives control totals per sheet (counts, gross premium, open balances, claim estimates, trial balance debits and credits) and the check premiums receivable control account = open items, to compare with the control totals of the old system. Download it from the history.');
    head('Not in this workbook');
    for (const [what, where] of MIGRATION_ON_SCREEN) line(what, where);
  }
  head('Columns');
  for (const s of sheets) {
    for (const c of s.columns) {
      const parts = [c.required ? 'Required' : 'Optional', c.format, c.list ? `Values: Lists sheet, ${c.list}` : null].filter(Boolean);
      line(`${s.name}: ${c.header}`, parts.join('. '));
    }
  }
  return { name: 'Instructions', columns: [{ header: 'Item', width: 42 }, { header: 'Detail', width: 120, type: 'wrap' }], rows, rowStyles: styles, headerStyle: 'navy', autoFilter: false, freeze: false };
}

/**
 * The workbook of a kit. data: { [sheet key]: rows by column key } (current data, or the rows in error with
 * errors: { [sheet key]: messages by row }).
 */
export async function kitWorkbook(kit, sheets, { data = {}, errors = null, prefill = false, cutover = null, day = null } = {}) {
  const lists = await buildLists(sheets);
  const { sheet: listSheet, refs } = listsSheet(lists);
  const environment = process.env.APP_ENVIRONMENT || process.env.NODE_ENV || '';
  const objects = sheets.map((s) => objectSheet(s, data[s.key] || [], refs, { errors: errors ? errors[s.key] || [] : null }));
  return writeXlsx({ title: KITS[kit].title, creator: 'BrokerVerse', sheets: [instructions(kit, sheets, { prefill, cutover, environment, day }), listSheet, ...objects] });
}

/**
 * Read an uploaded workbook: { [sheet key]: [{ rowNumber, values }] } for the kit's sheets found (by sheet name).
 * Empty rows and sample rows are skipped; unknown sheets (Instructions, Lists) and columns (Errors) are ignored.
 */
export function readKitWorkbook(buffer, sheets) {
  return Object.fromEntries(Object.entries(readSheets(buffer, sheets)).map(([key, s]) => [key, s.rows]));
}

/** Reconciliation workbook of a migration batch. */
export function reconciliationWorkbook(batch) {
  const r = batch.reconciliation || {};
  const fmt = (o) => Object.entries(o || {}).map(([k, v]) => `${k}: ${v}`).join('; ');
  return writeXlsx({
    title: `Reconciliation of load batch ${batch.id}`, creator: 'BrokerVerse',
    sheets: [
      { name: 'Summary', headerStyle: 'navy', autoFilter: false,
        columns: [{ header: 'Sheet', width: 22 }, { header: 'Rows in workbook', width: 18, type: 'integer' }, { header: 'Workbook totals', width: 60, type: 'wrap' },
          { header: 'Records in BrokerVerse', width: 22, type: 'integer' }, { header: 'BrokerVerse totals', width: 70, type: 'wrap' }],
        rows: [...(r.sheets || []).map((s) => [s.sheet, s.workbookRows, fmt(s.workbook), s.inBrokerVerse, fmt(s.detail)]),
          [], ['Batch', batch.id], ['Cutover date', r.cutoverDate || ''], ['Opening balances as at', r.openingBalanceDate || ''], ['Status', batch.status]] },
      { name: 'Checks', headerStyle: 'navy', autoFilter: false,
        columns: [{ header: 'Check', width: 70, type: 'wrap' }, { header: 'BrokerVerse', width: 18, type: 'money' }, { header: 'Compared with', width: 18, type: 'money' },
          { header: 'Difference', width: 16, type: 'money' }, { header: 'Result', width: 12 }],
        rows: (r.checks || []).map((c) => [c.check, c.left, c.right, c.difference, c.ok ? 'Agrees' : 'Difference']) },
    ],
  });
}
