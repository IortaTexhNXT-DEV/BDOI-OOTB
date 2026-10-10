/**
 * CAS registration documents as controlled documents: the system description and controls and the backup and restore
 * procedure. Each document is a list of sections (heading and plain text); the text may hold {{field}} placeholders
 * (FIELDS) that print the values of the day from the Company master, the CAS settings and the database, so the taxpayer
 * name, TIN, permit or custodian are never typed copies.
 *
 *   draft -> submitted -> approved -> superseded     a draft starts from the approved version (or the standard text
 *   submitted -> draft (rejected); draft -> cancelled  below while none is approved); submitting needs a reason of the
 *                                                       Reason Codes master (cas_document_change) and a change note;
 *                                                       approving needs approve:period-end and a different user than
 *                                                       the one who prepared, last edited or submitted the version
 *
 * The PDF prints the approved version; a draft, a submitted version or the standard text (nothing approved yet) prints
 * with a DRAFT mark, a superseded version with a SUPERSEDED mark.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { getSetting } from '../../lib/settings.js';
import { hasPermission } from '../../lib/auth.js';
import { assertChecker } from '../../lib/makerChecker.js';
import { renderTemplate } from '../../lib/template.js';
import { activityEntries } from '../../lib/auditEvents.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { renderPdf, printFormat, formatDate } from '../../lib/pdf/index.js';
import { requiredReason } from '../ops-masters/records.js';
import { APPROVE } from '../period-end/posting.js';
import { birIdentity } from './common.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(here, '../../../package.json'), 'utf8'));

/** The documents: code (database), slug (URL), title (screen and PDF heading), file name of the PDF. */
export const DOCUMENTS = {
  system_description: { slug: 'system-description', title: 'System Description and Controls', pdfTitle: 'Computerized Accounting System: System Description and Controls', fileName: 'CAS-system-description' },
  backup_procedure: { slug: 'backup-procedure', title: 'Backup and Restore Procedure', pdfTitle: 'Backup and Restore Procedure', fileName: 'CAS-backup-procedure' },
};
export const DOCUMENT_SLUGS = Object.values(DOCUMENTS).map((d) => d.slug);
export const docType = (slug) => {
  const code = Object.keys(DOCUMENTS).find((k) => DOCUMENTS[k].slug === slug || k === slug);
  if (!code) throw notFound(`Unknown document ${slug}`);
  return code;
};
export const STATUS_LABELS = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', superseded: 'Superseded', cancelled: 'Cancelled' };

/** Fields a section text may print with {{key}}. */
export const FIELDS = [
  { key: 'taxpayerName', label: 'Taxpayer name' }, { key: 'tin', label: 'TIN' }, { key: 'address', label: 'Registered address' }, { key: 'rdoCode', label: 'RDO code' },
  { key: 'casPermitNumber', label: 'CAS permit number' }, { key: 'casPermitDate', label: 'CAS permit date' }, { key: 'custodian', label: 'Backup custodian' },
  { key: 'contact', label: 'System contact person' }, { key: 'software', label: 'System name' }, { key: 'softwareVersion', label: 'System version' },
  { key: 'booksForm', label: 'Form of books' }, { key: 'backupFrequency', label: 'Backup frequency' }, { key: 'backupRetention', label: 'Backup retention' },
  { key: 'backupLocation', label: 'Backup location' }, { key: 'roles', label: 'User roles' }, { key: 'numberingSeries', label: 'Document number series' },
  { key: 'activeAccounts', label: 'Active accounts in the chart of accounts' },
];
const FIELD_KEYS = new Set(FIELDS.map((f) => f.key));
const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const MISSING = '-';

/** Values of the fields today: { key: value } (empty text when not set). */
export async function fieldValues(db) {
  const id = await birIdentity();
  const s = async (key, fallback = '') => String((await getSetting(key, fallback)) || fallback || '');
  const fmt = await printFormat();
  const permitDate = await s('cas.permit_date');
  const series = (await db.query('SELECT name, prefix FROM document_numbering WHERE active ORDER BY name')).rows;
  const roles = (await db.query('SELECT name FROM roles ORDER BY name')).rows;
  const accounts = (await db.query('SELECT count(*)::int AS n FROM gl_accounts WHERE status = \'active\'')).rows[0].n;
  return {
    taxpayerName: id.name, tin: id.tinFormatted, address: id.address, rdoCode: id.rdoCode, casPermitNumber: await s('cas.permit_number'),
    casPermitDate: permitDate ? formatDate(permitDate, fmt) : '', custodian: await s('cas.backup_custodian'), contact: await s('cas.system_contact'),
    software: await s('cas.software_name', 'iNXT BrokerVerse'), softwareVersion: `${pkg.version}${process.env.GIT_REF ? ` (${process.env.GIT_REF})` : ''}`,
    booksForm: await s('cas.books_form', 'loose-leaf'), backupFrequency: await s('cas.backup_frequency'), backupRetention: await s('cas.backup_retention'),
    backupLocation: await s('cas.backup_location'), roles: roles.map((r) => r.name).join(', '), numberingSeries: series.map((x) => `${x.name} (${x.prefix})`).join(', '),
    activeAccounts: String(accounts),
  };
}
/** The fields with label and today's value, for the editor. */
export const fieldList = (values) => FIELDS.map((f) => ({ ...f, value: values[f.key] || '' }));

/** Section text with the placeholders replaced by today's values ("-" for a value not set). */
export const resolveText = (text, values) => renderTemplate(String(text || '').replace(PLACEHOLDER, (m, k) => (FIELD_KEYS.has(k) && !values[k] ? MISSING : m)), values, { html: false });

// ---------------------------------------------------------------- standard text

const SYSTEM_DESCRIPTION = [
  ['Purpose and scope', '{{software}} is the insurance broking and accounting system of {{taxpayerName}}. It records the broking operations (quotations, policies, endorsements, claims, renewals), the billing and collection of premium, the remittance of premium to insurers, commission (direct-bill debit notes, broker-billed commission, overriding commission from insurers, commission to agents and referrers) and the general ledger. Every operational event posts a balanced journal through a posting rule; the books of accounts and the BIR reports are produced from these journals.'],
  ['Modules', ['Sales and placement: prospects, quotations, requests for quotation, placement slips.', 'Policy administration: policies, endorsements, renewals, claims.',
    'Receivables and receipts: bills, receipts (collection receipts), collections, credit control.', 'Remittance: premium remittance to insurers, direct-bill commission debit notes, insurer statement reconciliation.',
    'Commission: commission to agents and referrers, overriding / contingent commission from insurers.', 'General ledger: chart of accounts, posting rules, journal vouchers, period-end close, financial statements.',
    'Tax: sales invoices (EOPT), BIR Form 2307, 0619-E, 1601-EQ, 1604-E, 2551Q, VAT summary, SAWT, QAP, SLSP, DAT files, e-invoicing outbox.',
    'Administration: users, roles, document numbering, configuration, audit trail, scheduled jobs.'].join('\n')],
  ['Books of accounts', 'Generated per month as {{booksForm}} books: General Journal, General Ledger, Cash Receipts Book, Cash Disbursements Book, Sales Book and Purchase Book. Page numbers run on through the taxable year; every print is recorded (book, period, pages, entries, file hash) and a reprint keeps its page numbers and is marked REPRINT. The chart of accounts has {{activeAccounts}} active accounts.'],
  ['Controls', ['Access: sign-in with personal user accounts, password policy, optional two-factor authentication, session time-out. Roles: {{roles}}. Every API endpoint checks the user\'s permissions.',
    'Segregation of duties: maker-checker on journal vouchers, payment vouchers (cheque approval), posting rule and account changes, month-end and year-end close, commission and overriding commission computations, and these CAS documents.',
    'Data integrity: journals cannot be posted unbalanced, on inactive accounts or into closed periods; posted journals are never edited or deleted, only reversed; documents are cancelled with a reason, never deleted.',
    'Numbering: system-generated, sequential numbers per series: {{numberingSeries}}. The sales invoice series never resets and stays within the registered serial range.',
    'Period control: accounting periods open, soft-closed, closed and locked; month-end checklist and approval; year-end close with closing entries.',
    'Audit trail: every change records the user, date and time, screen or API, and the values before and after; the audit trail cannot be changed from the application and is extracted for any date range.',
    'Backup: {{backupFrequency}}. Retention: {{backupRetention}}. Location: {{backupLocation}}.'].join('\n')],
  ['Outputs', 'Financial statements (income statement, balance sheet, trial balance), general ledger detail, journal register, receivables and payables ageing, BIR forms and alphalists with their DAT files, sales invoices and payment acknowledgements, official / collection receipts, payment vouchers.'],
  ['Hardware and software environment', 'Web application (Node.js API, PostgreSQL database, React front end) hosted on a managed cloud platform; users connect with a current web browser over HTTPS. No data is kept on the users\' computers.'],
];
const BACKUP_PROCEDURE = [
  ['What is backed up', 'The whole database (every transaction, master, configuration record, audit trail entry and the record of the books printed) and the stored documents (uploaded files and generated documents).'],
  ['Frequency and retention', 'Frequency: {{backupFrequency}}\nRetention: {{backupRetention}}\nLocation: {{backupLocation}}\nCustodian: {{custodian}}'],
  ['Procedure', ['1. The hosting platform takes the automated backups at the frequency above and archives the transaction log for point-in-time recovery.', '2. The custodian checks every week that the latest backup completed.',
    '3. At every month-end close, after the books of the month are printed, a monthly backup is kept for the retention period.', '4. Backups are encrypted at rest and in transit; access is limited to the custodian and the system administrator.'].join('\n')],
  ['Restore and test', ['1. Restore into a separate environment (never over the live database) from the backup or to a point in time.', '2. Check the restored trial balance and the last journal numbers against the last printed books.',
    '3. Record the test (date, backup used, result, who performed it). A restore test is performed at least twice a year and after any change of the hosting platform.'].join('\n')],
  ['Books on storage media', 'When the books are kept in computerized form, the general journal, general ledger and the subsidiary books are exported per period (PDF and Excel) and kept on storage media with the backups, for submission to the BIR within the period the regulations set.'],
];
const STANDARD = { system_description: SYSTEM_DESCRIPTION, backup_procedure: BACKUP_PROCEDURE };
/** The standard text of a document (the text printed before any version is approved). */
export const standardSections = (type) => STANDARD[type].map(([heading, text], i) => ({ key: `s${i + 1}`, heading, text }));

// ---------------------------------------------------------------- versions

const newKey = () => `s_${crypto.randomBytes(4).toString('hex')}`;

async function userInfo(db, ids) {
  const list = [...new Set(ids.filter(Boolean))];
  if (!list.length) return new Map();
  return new Map((await db.query('SELECT id, username, COALESCE(display_name, username) AS name FROM users WHERE id = ANY($1)', [list])).rows.map((u) => [u.id, u]));
}

const versionRow = (r, users, { full = false } = {}) => (!r ? null : {
  id: r.id, type: r.doc_type, slug: DOCUMENTS[r.doc_type].slug, title: DOCUMENTS[r.doc_type].title, version: r.version, status: r.status, statusLabel: STATUS_LABELS[r.status],
  changeNote: r.change_note, reasonCode: r.reason_code, reason: r.reason,
  createdBy: r.created_by, createdByName: users.get(r.created_by)?.name || null, createdAt: r.created_at,
  updatedBy: r.updated_by, updatedByName: users.get(r.updated_by)?.name || null, updatedAt: r.updated_at,
  submittedBy: r.submitted_by, submittedByName: users.get(r.submitted_by)?.name || null, submittedAt: r.submitted_at,
  approvedBy: r.approved_by, approvedByName: users.get(r.approved_by)?.name || null, approvedAt: r.approved_at, approvalRemarks: r.approval_remarks,
  rejectedBy: r.rejected_by, rejectedByName: users.get(r.rejected_by)?.name || null, rejectedAt: r.rejected_at, rejectionRemarks: r.rejection_remarks,
  supersededAt: r.superseded_at,
  // the users who may not approve it (maker-checker)
  makers: [...new Set([r.created_by, r.updated_by, r.submitted_by].filter(Boolean))],
  ...(full ? { sections: r.sections || [] } : { sectionCount: (r.sections || []).length }),
});
const usersOf = (rows) => rows.flatMap((r) => [r.created_by, r.updated_by, r.submitted_by, r.approved_by, r.rejected_by]);

async function rowsOf(db, type) {
  return (await db.query('SELECT * FROM cas_documents WHERE doc_type = $1 ORDER BY version DESC', [type])).rows;
}

/** Summary of both documents: the approved version and the open (draft or submitted) one. */
export async function listDocuments(db) {
  const rows = (await db.query('SELECT * FROM cas_documents WHERE status IN (\'draft\', \'submitted\', \'approved\') ORDER BY doc_type, version')).rows;
  const users = await userInfo(db, usersOf(rows));
  return Object.entries(DOCUMENTS).map(([type, d]) => ({
    type, slug: d.slug, title: d.title,
    approved: versionRow(rows.find((r) => r.doc_type === type && r.status === 'approved'), users),
    open: versionRow(rows.find((r) => r.doc_type === type && ['draft', 'submitted'].includes(r.status)), users),
  }));
}

/** A document: every version (newest first), the open and the approved version in full, the fields and the activity. */
export async function documentDetail(db, slug, { viewer = null } = {}) {
  const type = docType(slug);
  const rows = await rowsOf(db, type);
  const users = await userInfo(db, usersOf(rows));
  const open = rows.find((r) => ['draft', 'submitted'].includes(r.status));
  const approved = rows.find((r) => r.status === 'approved');
  const values = await fieldValues(db);
  return {
    type, slug: DOCUMENTS[type].slug, title: DOCUMENTS[type].title,
    open: versionRow(open, users, { full: true }), approved: versionRow(approved, users, { full: true }),
    standard: approved ? null : standardSections(type),
    versions: rows.map((r) => versionRow(r, users)), fields: fieldList(values), activity: await documentActivity(db, rows, { viewer }),
  };
}

export async function getVersion(db, slug, version) {
  const type = docType(slug);
  const r = (await db.query('SELECT * FROM cas_documents WHERE doc_type = $1 AND version = $2', [type, Number(version)])).rows[0];
  if (!r) throw notFound(`Version ${version} of the ${DOCUMENTS[type].title} not found`);
  return versionRow(r, await userInfo(db, usersOf([r])), { full: true });
}

async function documentActivity(db, rows, { viewer }) {
  if (!rows.length) return [];
  const audit = (await db.query(`SELECT a.id, a.at, a.user_id, a.username, a.entity, a.entity_id, a.action, a.before_data, a.after_data, a.source FROM audit_log a
    WHERE a.entity = 'cas_document' AND a.entity_id = ANY($1) ORDER BY a.at, a.id`, [rows.map((r) => r.id)])).rows;
  return activityEntries(audit, { viewer, statusLabels: STATUS_LABELS });
}

async function lockOpen(db, type) {
  return (await db.query('SELECT * FROM cas_documents WHERE doc_type = $1 AND status IN (\'draft\', \'submitted\') FOR UPDATE', [type])).rows[0];
}

/** Sections as sent by the editor: trimmed, each with a key; an unknown {{field}} is refused. */
export function cleanSections(sections) {
  const errors = [];
  const out = sections.map((s, i) => {
    const heading = String(s.heading || '').trim();
    const text = String(s.text || '').replace(/\r\n/g, '\n').replace(/\s+$/, '');
    if (!heading) errors.push({ path: `sections.${i}.heading`, message: 'heading is required' });
    for (const [, k] of text.matchAll(PLACEHOLDER)) {
      if (!FIELD_KEYS.has(k)) errors.push({ path: `sections.${i}.text`, message: `{{${k}}} is not a field of the document` });
    }
    return { key: /^[a-zA-Z0-9_-]{1,40}$/.test(String(s.key || '')) ? s.key : newKey(), heading, text };
  });
  const keys = out.map((s) => s.key);
  out.forEach((s, i) => { if (keys.indexOf(s.key) !== i) s.key = newKey(); });
  if (!out.length) errors.push({ path: 'sections', message: 'at least one section is required' });
  if (errors.length) throw badRequest('Validation failed', errors);
  return out;
}

/** Start a draft from the approved version (or the standard text). One open version per document. */
export async function createDraft(db, slug, user) {
  const type = docType(slug);
  if (await lockOpen(db, type)) throw conflict(`The ${DOCUMENTS[type].title} already has a version in progress`);
  const rows = await rowsOf(db, type);
  const approved = rows.find((r) => r.status === 'approved');
  const version = (rows[0]?.version || 0) + 1;
  const r = (await db.query(`INSERT INTO cas_documents(doc_type, version, sections, created_by, updated_by) VALUES ($1, $2, $3, $4, $4) RETURNING *`,
    [type, version, JSON.stringify(approved ? approved.sections : standardSections(type)), user?.id ?? null])).rows[0];
  return { before: null, after: r };
}

export async function saveDraft(db, slug, sections, user) {
  const type = docType(slug);
  const open = await lockOpen(db, type);
  if (!open || open.status !== 'draft') throw conflict(`The ${DOCUMENTS[type].title} has no draft to change`);
  const r = (await db.query('UPDATE cas_documents SET sections = $2, updated_by = $3, updated_at = now() WHERE id = $1 RETURNING *',
    [open.id, JSON.stringify(cleanSections(sections)), user?.id ?? null])).rows[0];
  return { before: open, after: r };
}

export async function submitDraft(db, slug, { reasonCode, note, changeNote }, user) {
  const type = docType(slug);
  const open = await lockOpen(db, type);
  if (!open || open.status !== 'draft') throw conflict(`The ${DOCUMENTS[type].title} has no draft to submit`);
  if (!String(changeNote || '').trim()) throw badRequest('Validation failed', [{ path: 'changeNote', message: 'changeNote is required' }]);
  const reason = await requiredReason(db, 'cas_document_change', { reasonCode, note });
  const r = (await db.query(`UPDATE cas_documents SET status = 'submitted', change_note = $2, reason_code = $3, reason = $4, submitted_by = $5, submitted_at = now(),
      rejected_by = NULL, rejected_at = NULL, rejection_remarks = NULL WHERE id = $1 RETURNING *`,
  [open.id, String(changeNote).trim(), reason.code, reason.text, user?.id ?? null])).rows[0];
  return { before: open, after: r };
}

export async function approveVersion(db, slug, { remarks = null } = {}, user) {
  if (!hasPermission(user, APPROVE)) throw forbidden(`Approving a CAS document requires permission ${APPROVE}`);
  const type = docType(slug);
  const open = await lockOpen(db, type);
  if (!open || open.status !== 'submitted') throw conflict(`The ${DOCUMENTS[type].title} has no version awaiting approval`);
  for (const maker of [open.created_by, open.updated_by, open.submitted_by]) await assertChecker(user, maker, 'document version');
  await db.query('UPDATE cas_documents SET status = \'superseded\', superseded_at = now() WHERE doc_type = $1 AND status = \'approved\'', [type]);
  const r = (await db.query('UPDATE cas_documents SET status = \'approved\', approved_by = $2, approved_at = now(), approval_remarks = $3 WHERE id = $1 RETURNING *',
    [open.id, user?.id ?? null, remarks ? String(remarks).trim() || null : null])).rows[0];
  return { before: open, after: r };
}

export async function rejectVersion(db, slug, { remarks }, user) {
  if (!hasPermission(user, APPROVE)) throw forbidden(`Rejecting a CAS document requires permission ${APPROVE}`);
  if (!String(remarks || '').trim()) throw badRequest('Validation failed', [{ path: 'remarks', message: 'remarks is required' }]);
  const type = docType(slug);
  const open = await lockOpen(db, type);
  if (!open || open.status !== 'submitted') throw conflict(`The ${DOCUMENTS[type].title} has no version awaiting approval`);
  const r = (await db.query('UPDATE cas_documents SET status = \'draft\', rejected_by = $2, rejected_at = now(), rejection_remarks = $3 WHERE id = $1 RETURNING *',
    [open.id, user?.id ?? null, String(remarks).trim()])).rows[0];
  return { before: open, after: r };
}

export async function discardDraft(db, slug) {
  const type = docType(slug);
  const open = await lockOpen(db, type);
  if (!open || open.status !== 'draft') throw conflict(`The ${DOCUMENTS[type].title} has no draft to discard`);
  const r = (await db.query('UPDATE cas_documents SET status = \'cancelled\', updated_at = now() WHERE id = $1 RETURNING *', [open.id])).rows[0];
  return { before: open, after: r };
}

/** What an audit entry keeps of a version: its status, version, the remarks of the action. */
export const auditSnapshot = (r, remarks = null) => r && ({ document: DOCUMENTS[r.doc_type].title, version: r.version, status: r.status, ...(remarks ? { remarks } : {}) });

// ---------------------------------------------------------------- compare

/** Line comparison (longest common subsequence): [{ type: same | added | removed, text }]. */
export function diffLines(before, after) {
  const a = String(before || '').split('\n');
  const b = String(after || '').split('\n');
  const n = a.length; const m = b.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) for (let j = m - 1; j >= 0; j -= 1) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = [];
  let i = 0; let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ type: 'same', text: a[i] }); i += 1; j += 1; } else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ type: 'removed', text: a[i] }); i += 1; } else { out.push({ type: 'added', text: b[j] }); j += 1; }
  }
  while (i < n) { out.push({ type: 'removed', text: a[i] }); i += 1; }
  while (j < m) { out.push({ type: 'added', text: b[j] }); j += 1; }
  return out;
}

/** Comparison of two versions, section by section (matched by key), in the order of the later version. */
export async function compareVersions(db, slug, from, to) {
  const type = docType(slug);
  const load = async (v) => {
    const r = (await db.query('SELECT version, status, sections FROM cas_documents WHERE doc_type = $1 AND version = $2', [type, Number(v)])).rows[0];
    if (!r) throw notFound(`Version ${v} of the ${DOCUMENTS[type].title} not found`);
    return r;
  };
  const [x, y] = Number(from) <= Number(to) ? [await load(from), await load(to)] : [await load(to), await load(from)];
  const old = new Map((x.sections || []).map((s) => [s.key, s]));
  const seen = new Set();
  const sections = (y.sections || []).map((s) => {
    const prev = old.get(s.key);
    seen.add(s.key);
    if (!prev) return { key: s.key, change: 'added', heading: s.heading, headingBefore: null, lines: diffLines('', s.text).filter((l) => l.text !== '' || l.type === 'same') };
    const lines = diffLines(prev.text, s.text);
    const changed = prev.heading !== s.heading || lines.some((l) => l.type !== 'same');
    return { key: s.key, change: changed ? 'changed' : 'same', heading: s.heading, headingBefore: prev.heading !== s.heading ? prev.heading : null, lines };
  });
  for (const s of x.sections || []) {
    if (!seen.has(s.key)) sections.push({ key: s.key, change: 'removed', heading: s.heading, headingBefore: null, lines: diffLines(s.text, '').filter((l) => l.text !== '' || l.type === 'same') });
  }
  return { type, slug: DOCUMENTS[type].slug, from: { version: x.version, status: x.status }, to: { version: y.version, status: y.status }, sections,
    summary: { added: sections.filter((s) => s.change === 'added').length, removed: sections.filter((s) => s.change === 'removed').length, changed: sections.filter((s) => s.change === 'changed').length } };
}

// ---------------------------------------------------------------- PDF

const MARKS = { draft: 'DRAFT', submitted: 'DRAFT', superseded: 'SUPERSEDED', cancelled: 'CANCELLED' };

/** The PDF of a document: the approved version, or `version`; the standard text with a DRAFT mark while none is approved. */
export async function documentPdf(db, slug, { version = null, user = null } = {}) {
  const type = docType(slug);
  const d = DOCUMENTS[type];
  const row = version
    ? (await db.query('SELECT * FROM cas_documents WHERE doc_type = $1 AND version = $2', [type, Number(version)])).rows[0]
    : (await db.query('SELECT * FROM cas_documents WHERE doc_type = $1 AND status = \'approved\'', [type])).rows[0];
  if (version && !row) throw notFound(`Version ${version} of the ${d.title} not found`);
  const users = row ? await userInfo(db, usersOf([row])) : new Map();
  const values = await fieldValues(db);
  const fmt = await printFormat();
  const sections = row ? row.sections : standardSections(type);
  const status = row ? row.status : 'draft';
  const name = (id) => users.get(id)?.name || '';
  const control = row
    ? [['Document version', `${row.version} (${STATUS_LABELS[row.status]})`], ...(row.approved_at ? [['Approved', `${formatDate(row.approved_at, fmt)} by ${name(row.approved_by)}`]] : []),
      ...(row.change_note ? [['Change note', row.change_note]] : [])]
    : [['Document version', 'Standard text (not approved)']];
  const meta = type === 'system_description'
    ? [['Taxpayer', values.taxpayerName], ['TIN', values.tin], ['Registered address', values.address], ['RDO', values.rdoCode || MISSING], ['System', `${values.software} version ${values.softwareVersion}`],
      ['Form of books', values.booksForm], ['CAS permit / acknowledgement', values.casPermitNumber || 'to be issued'], ['Contact person', values.contact || MISSING]]
    : [['Taxpayer', values.taxpayerName], ['TIN', values.tin], ['Custodian', values.custodian || MISSING]];
  const pdf = await renderPdf({
    title: d.pdfTitle, number: type === 'system_description' ? `${values.software} ${pkg.version}` : values.software,
    meta: [...meta, ...control],
    sections: [
      ...sections.map((s, i) => ({ heading: `${i + 1}. ${s.heading}`, text: resolveText(s.text, values) })),
      { signatures: [{ label: type === 'system_description' ? 'Prepared by' : 'Custodian', name: row ? name(row.submitted_by || row.created_by) : '' },
        { label: 'Approved by (taxpayer)', name: row?.approved_by ? name(row.approved_by) : '', date: row?.approved_at ? formatDate(row.approved_at, fmt) : undefined }] },
    ],
    ...(MARKS[status] ? { watermark: MARKS[status] } : {}),
  }, { user });
  const suffix = row ? `-v${row.version}${status === 'approved' ? '' : `-${status}`}` : '-draft';
  return { pdf, fileName: `${d.fileName}${suffix}.pdf` };
}
