/**
 * The go-live workbooks: template (blank or with the current data, the whole kit or some of its objects), reading an
 * uploaded workbook, the errors workbook (the rows with errors and the unresolved duplicates, plus an Errors column, in
 * the same layout so it is fixed and uploaded again) and the reconciliation workbook of a migration load.
 *
 * Layout of every object sheet: row 1 the headers (navy; required columns end with " *"), row 2 a sample row (amber,
 * italic, first cell starting with SAMPLE: never loaded), data from row 3. Lists: the allowed values that the
 * drop-downs of the object sheets point to. Instructions: load order, rules, the cutover date rule, the results of a
 * validation, the duplicate checks, the sync of new and migrated data, the document file naming convention, what is
 * entered on screen, and the columns of every sheet. Control (hidden, protected): the kit, the objects, the layout
 * version (a hash of the column keys), the environment, the content and who generated it when; a file of another kit
 * or of another layout is refused. The Control sheet identifies the file, it grants nothing.
 */
import crypto from 'node:crypto';
import { many } from '../../db/pool.js';
import { badRequest } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { colLetter, writeXlsx } from '../../lib/xlsx.js';
import { FS_GROUPS } from '../accounting/service.js';
import { POLICY_TYPES } from '../commission-rates/resolve.js';
import { RULE_KINDS, RULE_METHODS } from '../premium-charges/calculator.js';
import { RESET_RULES } from '../document-numbering/service.js';
import { CONFIGURATION_ON_SCREEN } from './configuration.js';
import { CONTROL_MEASURES, MIGRATION_ON_SCREEN } from './migration.js';
import { BUSINESS_TYPES, COMMON_COLUMNS, POLICY_KINDS, TRAVEL_PLANS, productListName, productsOfKind } from './products.js';
import { DUPLICATE_RULES, RULE_LABELS } from './duplicates.js';
import { EXTENSIONS, NAMING_EXAMPLE, NAMING_PATTERN, RECORD_TYPES, documentTypes } from './naming.js';
import { SAMPLE_PREFIX } from './common.js';
import { readSheets } from './compare.js';

export const KITS = {
  configuration: { title: 'Go-live configuration workbook', file: 'GoLive_Configuration_Workbook.xlsx' },
  migration: { title: 'Go-live migration workbook', file: 'GoLive_Migration_Workbook.xlsx' },
};
const VALIDATION_ROWS = 5000;

const codes = async (sql) => (await many(sql)).map((r) => r.code);

/** Lists of the policy sheets: the products of each sheet, branches, channels, vehicle types, plans, currencies, banks. */
async function migrationLists(sheets) {
  const kinds = sheets.filter((s) => s.policyKind).map((s) => s.policyKind);
  const lists = {
    Branches: { values: await codes("SELECT code FROM branches WHERE status = 'active' AND code IS NOT NULL ORDER BY code"), strict: false },
    'Distribution Channels': { values: await codes("SELECT code FROM distribution_channels WHERE status = 'active' ORDER BY code"), strict: false },
    'Business Type': { values: BUSINESS_TYPES },
    'Vehicle Brands': { values: await codes("SELECT name AS code FROM vehicle_brands WHERE status = 'active' ORDER BY name"), strict: false },
    'Vehicle Types': { values: await codes(`SELECT DISTINCT btrim(doc->>'vehicleType') AS code FROM policies WHERE btrim(COALESCE(doc->>'vehicleType', '')) <> ''
      UNION SELECT target_code FROM migration_value_maps WHERE object = 'vehicle-type' ORDER BY 1`), strict: false },
    'CTPL Classes': { values: await codes(`SELECT DISTINCT btrim(vehicle_type) AS code FROM ctpl_authentications WHERE btrim(COALESCE(vehicle_type, '')) <> '' ORDER BY 1`), strict: false },
    Plans: { values: (await many(`SELECT DISTINCT t.name AS code FROM policy_types t JOIN products p ON p.id = t.product_id
      WHERE p.status = 'active' AND p.line = 'accident' AND p.code !~* 'travel' AND t.status <> 'inactive' ORDER BY 1`)).map((r) => r.code), strict: false },
    'Travel Plans': { values: TRAVEL_PLANS },
    Currencies: { values: await codes("SELECT code FROM currencies WHERE status <> 'inactive' ORDER BY code"), strict: false },
    Banks: { values: await codes('SELECT code FROM banks WHERE code IS NOT NULL ORDER BY code'), strict: false },
    'Control Objects': { values: Object.keys(CONTROL_MEASURES) },
    'Control Measures': { values: [...new Set(Object.values(CONTROL_MEASURES).flat())] },
    'Document Types': { values: await documentTypes() },
  };
  for (const k of POLICY_KINDS.filter((x) => kinds.includes(x.kind))) lists[productListName(k.kind)] = { values: await productsOfKind(k.kind, kinds), strict: false };
  return lists;
}

/** Allowed values of the Lists sheet: { name: { values, strict } }. Lists read from the database are not strict (the workbook may add values). */
export async function buildLists(sheets, { kit = null } = {}) {
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
  if (kit === 'migration') Object.assign(lists, await migrationLists(sheets));
  for (const s of sheets) for (const c of s.columns) if (c.list && c.allowed && !lists[c.list]) lists[c.list] = { values: c.allowed };
  // only the lists some column uses (and the document types of the file naming convention)
  const used = new Set([...sheets.flatMap((s) => s.columns.map((c) => c.list).filter(Boolean)), ...(kit === 'migration' ? ['Document Types'] : [])]);
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
async function instructions(kit, sheets, { prefill, cutover, environment, day }) {
  const rows = [];
  const styles = [];
  const head = (t) => { rows.push([t, '']); styles[rows.length - 1] = 'bold'; };
  const line = (a, b = '') => rows.push([a, b]);
  const names = new Map(sheets.map((s) => [s.key, s.name]));
  head(KITS[kit].title);
  line('Content', prefill ? `Current data of this environment${environment ? ` (${environment})` : ''}, exported ${day || ''}. Load it into the next environment to promote the ${kit}.` : 'Blank template: fill in the object sheets.');
  line('Upload', 'Master > System Configuration > Data Migration & Go-Live > Loads: upload, review the result of each row, then submit the load for approval.');
  line('Cutover date', cutover || 'Not set yet: set it on Data Migration & Go-Live > Go-Live before the migration workbook is validated.');
  head('How to fill in');
  line('Headers', 'Row 1 of each sheet holds the column headers. Columns ending with * are required. Keep the headers; the column order does not matter and a column you do not use may be left empty or removed.');
  line('Sample row', `Row 2 (amber, italic) is a sample. A row whose first cell starts with ${SAMPLE_PREFIX} is never loaded; enter your data from row 3, or overwrite the sample row.`);
  line('Drop-downs', 'Columns with fixed values offer a drop-down (Lists sheet). Lists of insurers, products and roles show what this environment has; a value added in the same workbook is accepted too.');
  line('Formats', 'Dates as YYYY-MM-DD; amounts as plain numbers (no currency sign) with at most two decimals; rates as fractions where the column says so (0.20 for 20%). The sheets are formatted as text so Excel keeps codes and dates as typed.');
  line('Keys', 'Every row is matched on its natural key (code, username, setting key, legacy number ...): a row whose key exists updates that record, a new key creates one. Loading the same or a corrected workbook again never duplicates; unchanged rows are skipped.');
  line('Hidden values', 'A cell shown masked (with **) keeps the value stored in BrokerVerse; a masked TIN, birth date or key is refused: enter the full value.');
  line('Control sheet', 'The hidden Control sheet identifies this file (kit, sheets, layout). Do not remove it; a file of another kit or of an older layout is refused: download the template again.');
  head('Load order');
  sheets.forEach((s, i) => {
    const after = (s.dependsOn || []).map((d) => names.get(d)).filter(Boolean);
    line(`${i + 1}. ${s.name}`, `${s.menu}. Key: ${s.keyColumns.map((k) => s.columns.find((c) => c.key === k)?.header || k).join(' + ')}${after.length ? `. After: ${after.join(', ')}` : ''}`);
  });
  head('Validate, review and load');
  line('1. Upload and validate', 'The upload validates without saving: every sheet runs through its importer in the load order above inside one database transaction that is rolled back, so a row may refer to a record of an earlier sheet of the same workbook (e.g. a policy to a client and an insurer).');
  line('2. Result of each row', 'New: the key is not in BrokerVerse, the row creates a record. Changed: the key is stored with other values; the review shows each changed column, old -> new. Unchanged: equal to the stored record, nothing to load. Duplicate: the row would create a record that matches another record (below); it loads only once resolved. Error: a check failed (column and message).');
  line('3. Fix', 'Download errors: a workbook in this layout with the rows in error and the unresolved duplicates and an Errors column. Correct those rows and upload that file (or the whole corrected workbook) again.');
  line('4. Duplicates', 'Resolve each duplicate on the review: Load as new (a reason is kept), Use existing (the row creates nothing and the legacy value is mapped to the existing record for every later load), or, for a policy number of another insurer, Load with insurer suffix (number/INSURER CODE). Or fix the file.');
  line('5. Load', 'Load runs when the latest validation has no error and no unresolved duplicate. Everything is loaded in one transaction, recorded in the load history and in the history of each record.');
  if (kit === 'configuration') {
    head('Rules');
    line('Users', 'Passwords are never in the workbook. A new user gets a temporary password shown once to the administrator after the load (must be changed at the first sign-in). A load cannot change your own account.');
    line('Authority limits', 'Loaded limits wait for the approval of another administrator (maker-checker) on Master > Generals > User Management > Authority Matrix.');
    line('Numbering', 'Next Number is the next sequence number of the current period (last number of the old system + 1); it cannot go below a number already issued. It is kept on the series as the start of the period, so the transaction reset after the smoke test restarts the series there (no need to load the sheet again). It must be above every migrated number of the same format (checked by both workbooks).');
    line('Settings', 'Only settings of Master > Configuration are loaded; settings of another screen (the brand pack, Company, Premium Taxes, Account Determination, the go-live lock) are changed there.');
    line('Same name', 'A new master record whose name equals another record of the same master once punctuation and words such as Inc, Corp or Company are set aside is a Duplicate.');
    line('Promotion', 'Download with current data from the source environment (Dev, SIT, UAT, Pre-Prod), upload into the next one. Rows equal to the target are skipped; differences update the target.');
    head('Entered on screen (not in this workbook)');
    for (const [what, where] of CONFIGURATION_ON_SCREEN) line(what, where);
  } else {
    head('Cutover date rule');
    line('Cutover date', 'The cutover date is the first day of live transactions in BrokerVerse. It must be set before the migration workbook is validated.');
    line('Dated before cutover', 'Policy issue dates, claim loss and reported dates, cheque received dates and client birth dates must be before the cutover date; a row dated on or after it is refused (enter it in BrokerVerse as new business).');
    line('In force', 'Policies must still be in force at cutover (expiry on or after the cutover date). Open claims are registered or in review. Post-dated cheques are on hand, dated on or after the cutover date.');
    line('Opening balances', 'The trial balance of the old system at the close of the day before the cutover date. Debits must equal credits; the sheet loads all or nothing: when a row is in error, that row shows its error and the other rows are held (not loaded) until it is fixed; upload the whole sheet again. A row with no debit and no credit (zero balance) is accepted and ignored. Loading again replaces the earlier load. The fiscal year must have no journal posted before the cutover.');
    line('Go-live lock', 'Once go-live is locked, the migration workbook is refused; the configuration workbook stays available for new masters.');
    head('Policy sheets per product');
    for (const s of sheets.filter((x) => x.policyKind)) {
      line(s.name, `Products: ${(await productsOfKind(s.policyKind, sheets.filter((x) => x.policyKind).map((x) => x.policyKind))).join(', ') || 'none active'}. Columns: ${s.columns.slice(COMMON_COLUMNS.length).map((c) => c.header).join(', ') || 'common columns only'}`);
    }
    line('One policy number', 'A policy number is on one sheet only. The single Policies sheet of the earlier layout is still read, for any product.');
    line('Amounts and currency', 'Amounts are pesos as booked in the legacy ledger, at most two decimals (never rounded on loading, so the workbook and BrokerVerse totals agree to the centavo). A foreign-currency policy keeps its Original Currency, Original Sum Insured and Exchange Rate as reference. Open items are in PHP only.');
    line('CTPL certificates', 'A migrated CTPL policy records its COC as authenticated (manual, not sent to the LTO): the same COC can never be issued again.');
    head('Duplicate checks');
    for (const r of DUPLICATE_RULES) line(RULE_LABELS[r], DUPLICATE_HELP[r]);
    head('New and migrated data');
    line('Origin', 'Every migrated record is marked Migrated with the legacy system, its legacy number, when and by whom it was migrated and the load (MIG-000012); records entered after go-live are Issued in BrokerVerse. Older flags stay for the reports that read them: source go-live-migration on clients, policies and claims, source opening on open items.');
    line('No postings', 'Migration posts no journal, bill booking or commission accrual: the opening balances carry the money. Open items age and are collected with normal official receipts; a post-dated cheque deposited after go-live creates its receipt.');
    line('Legacy numbers', 'Migrated records keep the numbers of the old system (client code, policy number, claim number, and the bill number of an open item). New business takes the insurer\'s policy number or the next number of its Document Numbering series; a legacy number in the range a series has still to issue is refused. An open item whose bill number another bill already carries (one debit note over several policies) gets the next invoice number and keeps the old number as its reference, shown next to the bill number and searchable.');
    line('Transactions', 'Opening balances are dated the day before cutover; every new transaction is dated on or after the cutover date.');
    line('Renewals', 'Migrated in-force policies are ordinary active policies: the renewal queue picks them up as they approach expiry, and the renewal carries the vehicle, loan and plan details of the migrated term. The renewal is business issued in BrokerVerse.');
    line('Reconciliation', 'Enter the legacy figures on the Control Totals sheet (object, measure, group, value): they are compared with the workbook and with BrokerVerse after the load.');
    head('Document file names');
    line('Convention', NAMING_PATTERN);
    line('Record types', Object.entries(RECORD_TYPES).map(([k, v]) => `${k} ${v.toLowerCase()}`).join(', '));
    line('Record number', 'The legacy number as loaded (client code, policy number, claim number, bill reference), with / and spaces written as -');
    line('Document types', (await documentTypes()).join(', '));
    line('Date and sequence', 'YYYYMMDD: the document date; _<n> when several files share the rest of the name');
    line('Extensions', EXTENSIONS.join(', '));
    line('Example', NAMING_EXAMPLE);
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

/** What each duplicate check compares (Instructions sheet). */
const DUPLICATE_HELP = {
  tin: 'Clients: a TIN already held by another client, in the file or in BrokerVerse',
  'name-birth-date': 'Individual clients: the same first and last name (Jr, Sr, II, III set aside) and the same birth date',
  'company-name': 'Corporate clients: the same company name once punctuation and Inc, Corp, Co, Ltd, OPC, Phils are set aside, when one of them has no TIN',
  vehicle: 'Motor and CTPL: the same plate, conduction sticker or chassis number on another policy of the same sheet in force over the same period',
  coc: 'CTPL: the same COC number of the same insurer',
  'policy-number': 'A policy number that a policy of another insurer carries (the same insurer is an error)',
  'insurer-variant': 'An insurer written another way (Malayan Ins. Co., Inc.): use the existing insurer, the spelling is then mapped for later loads',
  'master-name': 'Configuration masters: a new record with the same name as an existing one',
};

/** Layout version of a workbook: hash of its sheets and their column keys. */
export const layoutVersion = (sheets) => crypto.createHash('sha256').update(JSON.stringify(sheets.map((s) => [s.key, s.columns.map((c) => c.key)]))).digest('hex').slice(0, 16);

const CONTROL_SHEET = 'Control';
/** Hidden, protected Control sheet: what the file is (kit, objects, layout), from where and when. */
function controlSheet(kit, sheets, { prefill, environment, user }) {
  return {
    name: CONTROL_SHEET, hidden: true, protect: true, headerStyle: 'navy', autoFilter: false, freeze: false,
    columns: [{ header: 'Item', width: 20 }, { header: 'Value', width: 80 }],
    rows: [['Kit', kit], ['Objects', sheets.map((s) => s.key).join(',')], ['Layout version', layoutVersion(sheets)], ['Environment', environment || ''],
      ['Content', prefill ? 'current data' : 'blank'], ['Generated at', new Date().toISOString()], ['Generated by', user?.username || '']],
  };
}

/**
 * The workbook of a kit. data: { [sheet key]: rows by column key } (current data, or the rows in error with
 * errors: { [sheet key]: messages by row }). sheets: the objects it carries (the kit or some of its objects).
 */
export async function kitWorkbook(kit, sheets, { data = {}, errors = null, prefill = false, cutover = null, day = null, user = null } = {}) {
  const shown = sheets.filter((s) => !s.legacyLayout);
  const lists = await buildLists(shown, { kit });
  const { sheet: listSheet, refs } = listsSheet(lists);
  const environment = process.env.APP_ENVIRONMENT || process.env.NODE_ENV || '';
  const objects = shown.map((s) => objectSheet(s, data[s.key] || [], refs, { errors: errors ? errors[s.key] || [] : null }));
  return writeXlsx({ title: KITS[kit].title, creator: 'BrokerVerse',
    sheets: [await instructions(kit, shown, { prefill, cutover, environment, day }), listSheet, ...objects, controlSheet(kit, shown, { prefill, environment, user })] });
}

/**
 * Read an uploaded workbook: { [sheet key]: [{ rowNumber, values }] } for the kit's sheets found (by sheet name).
 * Empty rows and sample rows are skipped; unknown sheets (Instructions, Lists) and columns (Errors) are ignored. A file
 * with a Control sheet must be of this kit and of the current layout of the objects it names; a file without one (made
 * by hand, or downloaded before the Control sheet existed) is read by its headers.
 */
export function readKitWorkbook(buffer, sheets, kit = null) {
  const control = readSheets(buffer, [{ key: 'control', name: CONTROL_SHEET, columns: [{ key: 'item', header: 'Item' }, { key: 'value', header: 'Value' }] }, ...sheets],
    { label: 'The workbook' });
  const info = Object.fromEntries((control.control?.rows || []).map((r) => [String(r.values.item || '').toLowerCase(), String(r.values.value || '')]));
  if (control.control) {
    if (kit && info.kit && info.kit !== kit) throw badRequest(`This file is the ${KITS[info.kit]?.title || info.kit}: upload it as that kit`);
    const keys = String(info.objects || '').split(',').filter(Boolean);
    const named = keys.map((k) => sheets.find((s) => s.key === k));
    if (named.some((s) => !s) || layoutVersion(named) !== info['layout version']) {
      throw badRequest('The layout of this file is not the current layout of the template: download the template again and copy the rows into it');
    }
  }
  delete control.control;
  if (!Object.keys(control).length) throw badRequest(`The workbook has none of the sheets of this kit (${sheets.filter((s) => !s.legacyLayout).map((s) => s.name).join(', ')})`);
  return Object.fromEntries(Object.entries(control).map(([key, s]) => [key, s.rows]));
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

const OBJECT_LABELS = { client: 'Client', policy: 'Policy', receivable: 'Open item', post_dated_cheque: 'Post-dated cheque', claim: 'Claim', opening_balances: 'Opening balances' };
/** The records that stop the undo of a load (undo.js dependents), one row each. */
export function dependentsWorkbook(batch, deps) {
  return writeXlsx({
    title: `Undo of ${batch.loadNumber}`, creator: 'BrokerVerse',
    sheets: [{ name: 'Dependents', headerStyle: 'navy',
      columns: [{ header: 'Record', width: 20 }, { header: 'Number', width: 28 }, { header: 'Depends on it', width: 48, type: 'wrap' }, { header: 'Count', width: 10, type: 'integer' }],
      rows: deps.length ? deps.map((d) => [OBJECT_LABELS[d.object] || d.object, d.key, d.dependent, d.count]) : [['', '', 'Nothing depends on the records of this load', 0]] }],
  });
}
