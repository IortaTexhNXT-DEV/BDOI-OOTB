/**
 * Bank reconciliation (Accounts > Bank Reconciliation; masters under Master > Finance): bank account set-up, statement
 * formats, bank transaction types, match rules, statement import / manual entry, the matching workspace (auto / manual
 * match, unmatch, adjustments, bank errors), stale cheques and reconciliation runs with the printable statement.
 * Permissions: read:bank-reconciliation to view; write:bank-reconciliation to import, match, adjust and prepare;
 * approve:bank-reconciliation (finance manager) to approve and reopen (maker-checker: not the preparer).
 */
import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { getSetting } from '../../lib/settings.js';
import { today } from '../../lib/dates.js';
import { uploadFile } from '../documents/tabular.js';
import { buildPdf, sendPdf } from '../documents/pdf.js';
import { approve as approveJournal } from '../journal-vouchers/service.js';
import { APPROVE, accountRow, getBankAccount, iso, isPeriod, linkedAccount, periodEnd, periodStart, round2, userNames } from './common.js';
import * as st from './statements.js';
import * as mt from './matching.js';
import { cancelStaleCheque, postBankAdjustment, staleCheques, typeRow } from './adjustments.js';
import * as rc from './reconcile.js';

const { router, define } = moduleRouter('Bank Reconciliation', '/bank-reconciliation');
const read = [requireAuth, requirePermission('read:bank-reconciliation')];
const write = [requireAuth, requirePermission('write:bank-reconciliation')];
const approve = [requireAuth, requirePermission(APPROVE)];
const readMaster = [requireAuth, requirePermission('read:bank-reconciliation', 'read:masters')];
const writeMaster = [requireAuth, requirePermission('write:bank-reconciliation', 'write:masters')];
const S = 'Accounts > Bank Reconciliation';
const tx = (fn) => withTransaction(fn);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

// ---------- bank accounts ----------
define({
  method: 'GET', path: '/bank-accounts', summary: 'Bank accounts of the bank account master with their GL cash account, default statement format, last statement and last approved reconciliation',
  screen: S, middleware: read,
  response: { success: true, data: [{ code: 'ACC-BDO-001', name: 'BrokerVerse - Operating Account', glAccountCode: '1102001', statementFormat: 'BDO-SAMPLE', lastStatement: { statementNumber: 'BST-2026-00001', periodTo: '2026-09-28' }, lastApproved: { period: '2026-08' } }] },
  handler: async (_req, res) => {
    const rows = (await pool.query(`SELECT b.*, g.name AS gl_account_name,
        (SELECT row_to_json(s) FROM (SELECT statement_number AS "statementNumber", period_to::text AS "periodTo", closing_balance AS "closingBalance" FROM bank_statements
          WHERE bank_account_id = b.bank_account_id AND status = 'active' ORDER BY period_to DESC, created_at DESC LIMIT 1) s) AS last_statement,
        (SELECT row_to_json(r) FROM (SELECT rec_number AS "recNumber", period FROM bank_reconciliations WHERE bank_account_id = b.bank_account_id AND status = 'approved'
          ORDER BY as_of_date DESC LIMIT 1) r) AS last_approved,
        (SELECT count(*)::int FROM bank_statement_lines l WHERE l.bank_account_id = b.bank_account_id AND l.status = 'active'
          AND NOT EXISTS (SELECT 1 FROM bank_rec_match_items mi WHERE mi.bank_line_id = l.id AND mi.active)) AS unmatched
      FROM bank_account_links b LEFT JOIN gl_accounts g ON g.code = b.gl_account_code ORDER BY b.bank_account_code`)).rows;
    ok(res, rows.map((r) => ({ ...accountRow(r), lastStatement: r.last_statement, lastApproved: r.last_approved, unmatchedBankLines: r.unmatched })));
  },
});
define({
  method: 'PUT', path: '/bank-accounts/:code', summary: 'Link a bank account to its GL cash account, default statement format and reconciliation start date (book entries before it are covered by the first statement\'s opening balance; default: the first statement\'s start)',
  screen: `${S} > Bank account setup`, middleware: [...write, validate(z.object({ glAccountCode: z.string().max(20).nullable().optional(), statementFormat: z.string().max(30).nullable().optional(),
    reconcileFrom: date.nullable().optional() }))],
  request: { glAccountCode: '1102001', statementFormat: 'BDO-SAMPLE', reconcileFrom: '2026-08-01' }, response: { success: true, data: { code: 'ACC-BDO-001', glAccountCode: '1102001', reconcileFrom: '2026-08-01' } },
  handler: async (req, res) => {
    const out = await tx(async (db) => {
      const a = await getBankAccount(db, req.params.code);
      const b = req.body;
      const gl = b.glAccountCode === undefined ? a.gl_account_code : (b.glAccountCode || null);
      if (gl) {
        const g = (await db.query('SELECT * FROM gl_accounts WHERE code = $1', [gl])).rows[0];
        if (!g || g.status !== 'active') throw badRequest(`GL account ${gl} not found or inactive`);
        if (g.account_type !== 'asset') throw badRequest(`GL account ${gl} is not an asset (cash in bank) account`);
        const other = (await db.query('SELECT bank_account_code FROM bank_account_links WHERE gl_account_code = $1 AND bank_account_id <> $2', [gl, a.bank_account_id])).rows[0];
        if (other) throw conflict(`GL account ${gl} is already linked to bank account ${other.bank_account_code}`);
      }
      if (gl !== a.gl_account_code) {
        const used = (await db.query('SELECT count(*)::int AS n FROM bank_rec_matches WHERE bank_account_id = $1 AND status = \'active\'', [a.bank_account_id])).rows[0].n;
        if (used) throw conflict(`Bank account ${a.bank_account_code} has ${used} active match(es); its GL account cannot change`);
      }
      if (b.statementFormat) await st.getFormat(db, b.statementFormat);
      if (b.reconcileFrom !== undefined && (b.reconcileFrom || null) !== (a.reconcile_from ? iso(a.reconcile_from) : null)) {
        const rec = (await db.query('SELECT rec_number FROM bank_reconciliations WHERE bank_account_id = $1 AND status = \'approved\' LIMIT 1', [a.bank_account_id])).rows[0];
        if (rec) throw conflict(`Bank account ${a.bank_account_code} has approved reconciliations (${rec.rec_number}); its reconciliation start cannot change`);
      }
      const patch = { glAccountCode: gl || '', ...(b.statementFormat !== undefined ? { statementFormat: b.statementFormat || '' } : {}),
        ...(b.reconcileFrom !== undefined ? { reconcileFrom: b.reconcileFrom || '' } : {}) };
      await db.query('UPDATE master_records SET data = data || $2::jsonb, updated_by = $3, updated_at = now() WHERE id = $1', [a.bank_account_id, JSON.stringify(patch), req.user.id]);
      return { before: accountRow(a), after: accountRow(await getBankAccount(db, a.bank_account_id)) };
    });
    await audit(req, { entity: 'bank_account', entityId: out.after.code, action: 'link-gl', before: out.before, after: out.after });
    ok(res, out.after);
  },
});

// ---------- statement formats (Master > Finance > Bank Statement Formats) ----------
const formatSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_-]{2,30}$/).optional(), name: z.string().min(2).max(200).optional(), bankCode: z.string().max(20).nullable().optional(),
  description: z.string().max(1000).nullable().optional(), fileType: z.enum(['any', 'csv', 'xlsx']).optional(), skipRows: z.coerce.number().int().min(0).max(100).optional(),
  hasHeader: z.boolean().optional(), columns: z.record(z.enum(st.COLUMN_KEYS), z.union([z.string().max(300), z.number().int().min(1).max(200)]).nullable()).optional(),
  dateFormat: z.string().min(4).max(20).optional(), amountSign: z.enum(['credit-positive', 'debit-positive']).optional(), skipPattern: z.string().max(300).nullable().optional(),
  active: z.boolean().optional(),
});
const checkPattern = (p) => { if (p) { try { new RegExp(p, 'i'); } catch { throw badRequest(`Invalid regular expression ${p}`); } } };
define({
  method: 'GET', path: '/formats', summary: 'Bank statement formats (column mapping per bank export) and the supported date formats', screen: 'Master > Finance > Bank Statement Formats', middleware: readMaster,
  response: { success: true, data: { items: [{ code: 'GENERIC', name: 'Generic', dateFormat: 'YYYY-MM-DD', columns: { date: 'date' } }], dateFormats: ['YYYY-MM-DD'], columnKeys: ['date'] } },
  handler: async (_req, res) => ok(res, { items: (await pool.query('SELECT * FROM bank_statement_formats ORDER BY is_example, code')).rows.map(st.formatRow), dateFormats: st.DATE_FORMATS, columnKeys: st.COLUMN_KEYS }),
});
define({
  method: 'POST', path: '/formats', summary: 'Add a bank statement format', screen: 'Master > Finance > Bank Statement Formats', middleware: [...writeMaster, validate(formatSchema.required({ code: true, name: true }))],
  request: { code: 'UB-CSV', name: 'UnionBank CSV', bankCode: 'UBP', dateFormat: 'MM/DD/YYYY', columns: { date: 'Date', description: 'Description', reference: 'Reference', debit: 'Debit', credit: 'Credit', balance: 'Balance' } },
  response: { success: true, data: { code: 'UB-CSV' } },
  handler: async (req, res) => {
    const b = req.body;
    checkPattern(b.skipPattern);
    if (!b.columns?.date) throw badRequest('Map the date column');
    if (!b.columns.amount && !b.columns.debit && !b.columns.credit) throw badRequest('Map the debit / credit columns or the amount column');
    const r = (await pool.query(`INSERT INTO bank_statement_formats(code, name, bank_code, description, file_type, skip_rows, has_header, columns, date_format, amount_sign, skip_pattern, active, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (code) DO NOTHING RETURNING *`,
    [b.code, b.name, b.bankCode || null, b.description || null, b.fileType || 'any', b.skipRows ?? 0, b.hasHeader !== false, JSON.stringify(b.columns), b.dateFormat || 'YYYY-MM-DD',
      b.amountSign || 'credit-positive', b.skipPattern || null, b.active !== false, req.user.id])).rows[0];
    if (!r) throw conflict(`Statement format ${b.code} already exists`);
    await audit(req, { entity: 'bank_statement_format', entityId: r.code, action: 'create', after: r });
    created(res, st.formatRow(r));
  },
});
define({
  method: 'PUT', path: '/formats/:code', summary: 'Change a bank statement format', screen: 'Master > Finance > Bank Statement Formats', middleware: [...writeMaster, validate(formatSchema)],
  request: { skipRows: 2, dateFormat: 'DD/MM/YYYY' }, response: { success: true, data: { code: 'BPI-SAMPLE', skipRows: 2 } },
  handler: async (req, res) => {
    const before = (await pool.query('SELECT * FROM bank_statement_formats WHERE code = $1', [req.params.code])).rows[0];
    if (!before) throw notFound('Statement format not found');
    const b = req.body;
    checkPattern(b.skipPattern);
    const r = (await pool.query(`UPDATE bank_statement_formats SET name = COALESCE($2, name), bank_code = CASE WHEN $3::boolean THEN $4 ELSE bank_code END, description = COALESCE($5, description),
      file_type = COALESCE($6, file_type), skip_rows = COALESCE($7, skip_rows), has_header = COALESCE($8, has_header), columns = COALESCE($9, columns), date_format = COALESCE($10, date_format),
      amount_sign = COALESCE($11, amount_sign), skip_pattern = CASE WHEN $12::boolean THEN $13 ELSE skip_pattern END, active = COALESCE($14, active), updated_by = $15, updated_at = now()
      WHERE code = $1 RETURNING *`,
    [req.params.code, b.name, b.bankCode !== undefined, b.bankCode || null, b.description, b.fileType, b.skipRows, b.hasHeader, b.columns ? JSON.stringify(b.columns) : null, b.dateFormat,
      b.amountSign, b.skipPattern !== undefined, b.skipPattern || null, b.active, req.user.id])).rows[0];
    await audit(req, { entity: 'bank_statement_format', entityId: r.code, action: 'update', before, after: r });
    ok(res, st.formatRow(r));
  },
});
define({
  method: 'DELETE', path: '/formats/:code', summary: 'Delete a statement format not used by any statement (deactivate it otherwise)', screen: 'Master > Finance > Bank Statement Formats', middleware: writeMaster,
  response: { success: true, data: { code: 'UB-CSV' } },
  handler: async (req, res) => {
    const used = (await pool.query('SELECT 1 FROM bank_statements WHERE format_code = $1 LIMIT 1', [req.params.code])).rows[0];
    if (used || req.params.code === 'GENERIC') throw conflict('The format is in use (or is the generic format); deactivate it instead');
    const r = (await pool.query('DELETE FROM bank_statement_formats WHERE code = $1 RETURNING *', [req.params.code])).rows[0];
    if (!r) throw notFound('Statement format not found');
    await audit(req, { entity: 'bank_statement_format', entityId: r.code, action: 'delete', before: r });
    ok(res, { code: r.code });
  },
});
define({
  method: 'POST', path: '/formats/:code/test', summary: 'Parse an uploaded file with a format (no bank account needed): the lines it reads and the rows it rejects',
  screen: 'Master > Finance > Bank Statement Formats', middleware: [...readMaster, uploadFile], request: { file: '(multipart) statement.csv' },
  response: { success: true, data: { lines: [{ date: '2026-09-02', description: 'DEPOSIT', credit: 1000 }], errors: [], skippedRows: 1 } },
  handler: async (req, res) => {
    const f = await st.getFormat(pool, req.params.code);
    const p = st.parseRows(st.readTable(req.file), f);
    ok(res, { lines: p.lines.slice(0, 200), lineCount: p.lines.length, errors: p.errors, skippedRows: p.skipped });
  },
});

// ---------- bank transaction types (Master > Finance > Bank Transaction Types) ----------
const typeSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_-]{2,20}$/).optional(), name: z.string().min(2).max(200).optional(), description: z.string().max(1000).nullable().optional(),
  direction: z.enum(['debit', 'credit']).optional(), action: z.enum(['journal', 'returned-cheque']).optional(), accountRole: z.string().regex(/^[a-z0-9_]{2,60}$/).nullable().optional(),
  glAccountCode: z.string().max(20).nullable().optional(), allowAccountOverride: z.boolean().optional(), requiresApproval: z.boolean().optional(),
  matchPattern: z.string().max(300).nullable().optional(), active: z.boolean().optional(), sortOrder: z.coerce.number().int().optional(),
});
async function checkType(b) {
  checkPattern(b.matchPattern);
  if (b.glAccountCode) {
    const g = (await pool.query('SELECT status FROM gl_accounts WHERE code = $1', [b.glAccountCode])).rows[0];
    if (!g || g.status !== 'active') throw badRequest(`GL account ${b.glAccountCode} not found or inactive`);
  }
  if (b.accountRole && !(await getSetting(`accounting.account.${b.accountRole}`, null))) throw badRequest(`Account role ${b.accountRole} is not configured (accounting.account.${b.accountRole})`);
}
define({
  method: 'GET', path: '/transaction-types', summary: 'Bank transaction types: unrecorded bank items and the account their adjustment posts to', screen: 'Master > Finance > Bank Transaction Types', middleware: readMaster,
  response: { success: true, data: { items: [{ code: 'BCHG', name: 'Bank charges', direction: 'debit', action: 'journal', accountRole: 'bank_charges', requiresApproval: false }], accountRoles: [{ role: 'bank_charges', accountCode: '4401004' }] } },
  handler: async (_req, res) => {
    const roles = (await pool.query('SELECT substring(key from 20) AS role, value #>> \'{}\' AS code FROM app_settings WHERE key LIKE \'accounting.account.%\' ORDER BY key')).rows;
    ok(res, { items: (await pool.query('SELECT * FROM bank_transaction_types ORDER BY sort_order, code')).rows.map(typeRow), accountRoles: roles.map((r) => ({ role: r.role, accountCode: r.code })) });
  },
});
define({
  method: 'POST', path: '/transaction-types', summary: 'Add a bank transaction type', screen: 'Master > Finance > Bank Transaction Types',
  middleware: [...writeMaster, validate(typeSchema.required({ code: true, name: true, direction: true }))],
  request: { code: 'PESO-FEE', name: 'PESONet fee', direction: 'debit', accountRole: 'bank_charges', matchPattern: 'pesonet fee' }, response: { success: true, data: { code: 'PESO-FEE' } },
  handler: async (req, res) => {
    const b = req.body;
    await checkType(b);
    if ((b.action || 'journal') === 'journal' && !b.accountRole && !b.glAccountCode) throw badRequest('Choose the account role or GL account the adjustment posts to');
    const r = (await pool.query(`INSERT INTO bank_transaction_types(code, name, description, direction, action, account_role, gl_account_code, allow_account_override, requires_approval, match_pattern, active, sort_order, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (code) DO NOTHING RETURNING *`,
    [b.code, b.name, b.description || null, b.direction, b.action || 'journal', b.accountRole || null, b.glAccountCode || null, !!b.allowAccountOverride, !!b.requiresApproval,
      b.matchPattern || null, b.active !== false, b.sortOrder ?? 100, req.user.id])).rows[0];
    if (!r) throw conflict(`Bank transaction type ${b.code} already exists`);
    await audit(req, { entity: 'bank_transaction_type', entityId: r.code, action: 'create', after: r });
    created(res, typeRow(r));
  },
});
define({
  method: 'PUT', path: '/transaction-types/:code', summary: 'Change a bank transaction type (accounts, approval, pattern, active)', screen: 'Master > Finance > Bank Transaction Types',
  middleware: [...writeMaster, validate(typeSchema)], request: { requiresApproval: true }, response: { success: true, data: { code: 'BCHG', requiresApproval: true } },
  handler: async (req, res) => {
    const before = (await pool.query('SELECT * FROM bank_transaction_types WHERE code = $1', [req.params.code])).rows[0];
    if (!before) throw notFound('Bank transaction type not found');
    const b = req.body;
    await checkType(b);
    const r = (await pool.query(`UPDATE bank_transaction_types SET name = COALESCE($2, name), description = COALESCE($3, description), direction = COALESCE($4, direction), action = COALESCE($5, action),
      account_role = CASE WHEN $6::boolean THEN $7 ELSE account_role END, gl_account_code = CASE WHEN $8::boolean THEN $9 ELSE gl_account_code END,
      allow_account_override = COALESCE($10, allow_account_override), requires_approval = COALESCE($11, requires_approval), match_pattern = CASE WHEN $12::boolean THEN $13 ELSE match_pattern END,
      active = COALESCE($14, active), sort_order = COALESCE($15, sort_order), updated_by = $16, updated_at = now() WHERE code = $1 RETURNING *`,
    [req.params.code, b.name, b.description, b.direction, b.action, b.accountRole !== undefined, b.accountRole || null, b.glAccountCode !== undefined, b.glAccountCode || null,
      b.allowAccountOverride, b.requiresApproval, b.matchPattern !== undefined, b.matchPattern || null, b.active, b.sortOrder, req.user.id]).catch((e) => {
      if (e.code === '23514') throw badRequest('A journal type needs an account role or a GL account');
      throw e;
    })).rows[0];
    await audit(req, { entity: 'bank_transaction_type', entityId: r.code, action: 'update', before, after: r });
    ok(res, typeRow(r));
  },
});
define({
  method: 'DELETE', path: '/transaction-types/:code', summary: 'Delete a bank transaction type added by users and never used (deactivate it otherwise)', screen: 'Master > Finance > Bank Transaction Types', middleware: writeMaster,
  response: { success: true, data: { code: 'PESO-FEE' } },
  handler: async (req, res) => {
    const used = (await pool.query('SELECT 1 FROM bank_statement_lines WHERE type_code = $1 AND adjustment_jv_id IS NOT NULL LIMIT 1', [req.params.code])).rows[0];
    const r = used ? null : (await pool.query('DELETE FROM bank_transaction_types WHERE code = $1 AND NOT is_system RETURNING *', [req.params.code])).rows[0];
    if (!r) throw conflict('The type is built in or already used; deactivate it instead');
    await audit(req, { entity: 'bank_transaction_type', entityId: r.code, action: 'delete', before: r });
    ok(res, { code: r.code });
  },
});

// ---------- match rules ----------
const ruleRow = (r) => ({ code: r.code, name: r.name, description: r.description, ruleType: r.rule_type, sortOrder: r.sort_order, confidence: r.confidence, params: r.params, active: r.active });
define({
  method: 'GET', path: '/match-rules', summary: 'Automatic matching rules in the order they run', screen: `${S} > Match rules`, middleware: read,
  response: { success: true, data: [{ code: 'REFERENCE', ruleType: 'reference', sortOrder: 10, confidence: 100, active: true }] },
  handler: async (_req, res) => ok(res, (await pool.query('SELECT * FROM bank_match_rules ORDER BY sort_order, code')).rows.map(ruleRow)),
});
define({
  method: 'PUT', path: '/match-rules/:code', summary: 'Change a matching rule: order, active, confidence, date window / most lines', screen: `${S} > Match rules`,
  middleware: [...writeMaster, validate(z.object({ sortOrder: z.coerce.number().int().optional(), active: z.boolean().optional(), confidence: z.coerce.number().int().min(1).max(100).optional(),
    params: z.object({ dateWindowDays: z.coerce.number().int().min(0).max(90).optional(), maxLines: z.coerce.number().int().min(2).max(12).optional() }).optional() }))],
  request: { sortOrder: 15, params: { dateWindowDays: 3 } }, response: { success: true, data: { code: 'AMOUNT_DATE', sortOrder: 15 } },
  handler: async (req, res) => {
    const before = (await pool.query('SELECT * FROM bank_match_rules WHERE code = $1', [req.params.code])).rows[0];
    if (!before) throw notFound('Match rule not found');
    const b = req.body;
    const r = (await pool.query(`UPDATE bank_match_rules SET sort_order = COALESCE($2, sort_order), active = COALESCE($3, active), confidence = COALESCE($4, confidence),
      params = COALESCE($5, params), updated_by = $6, updated_at = now() WHERE code = $1 RETURNING *`, [req.params.code, b.sortOrder, b.active, b.confidence, b.params ? JSON.stringify(b.params) : null, req.user.id])).rows[0];
    await audit(req, { entity: 'bank_match_rule', entityId: r.code, action: 'update', before, after: r });
    ok(res, ruleRow(r));
  },
});

// ---------- statements ----------
const statementFields = (b) => ({ bankAccount: b.bankAccount, format: b.format || null, statementRef: b.statementRef || null, openingBalance: b.openingBalance, closingBalance: b.closingBalance,
  periodFrom: b.periodFrom || null, periodTo: b.periodTo || null });
const previewOut = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => !['_lines', 'account'].includes(k)));
define({
  method: 'POST', path: '/statements/preview', summary: 'Parse a bank statement file with a statement format and show the lines, totals, balance check and duplicates before saving',
  screen: `${S} > Import statement`, middleware: [...write, uploadFile],
  request: { bankAccount: 'ACC-BDO-001', format: 'BDO-SAMPLE', statementRef: 'SOA 2026-09', openingBalance: '150000.00', closingBalance: '162500.00', file: '(multipart) statement.csv' },
  response: { success: true, data: { lineCount: 12, totalDebits: 10000, totalCredits: 22500, balanced: true, duplicates: 0, lines: [{ date: '2026-09-02', description: 'DEPOSIT', credit: 5000, duplicate: false, suggestedType: null }], errors: [] } },
  handler: async (req, res) => ok(res, previewOut(await st.previewFile(pool, req.file, statementFields(req.body || {})))),
});
define({
  method: 'POST', path: '/statements/import', summary: 'Import a bank statement file (validated: balance, duplicates, rows that cannot be read); auto-matches when bank_reconciliation.auto_match_on_import',
  screen: `${S} > Import statement`, middleware: [...write, uploadFile],
  request: { bankAccount: 'ACC-BDO-001', format: 'BDO-SAMPLE', statementRef: 'SOA 2026-09', skipDuplicates: 'false', file: '(multipart) statement.csv' },
  response: { success: true, data: { statement: { statementNumber: 'BST-2026-00001', lineCount: 12 }, autoMatch: { matched: 9 } } },
  handler: async (req, res) => {
    const b = req.body || {};
    const out = await tx(async (db) => {
      const p = await st.previewFile(db, req.file, statementFields(b));
      if (!p.lineCount && !p.errors?.length) throw badRequest('The file has no transaction lines for this format');
      const s = await st.saveStatement(db, p, { account: p.account, source: 'import', format: p.format, fileName: p.fileName, fileHash: p.fileHash, remarks: b.remarks || null,
        skipDuplicates: ['true', '1', 'yes', 'on', true].includes(b.skipDuplicates) }, req.user);
      const am = (await getSetting('bank_reconciliation.auto_match_on_import', true)) ? await mt.autoMatch(db, p.account, req.user) : null;
      return { statement: st.statementRow(s), autoMatch: am };
    });
    await audit(req, { entity: 'bank_statement', entityId: out.statement.statementNumber, action: 'import', after: { ...out.statement, autoMatched: out.autoMatch?.matched ?? null } });
    created(res, out, `Statement ${out.statement.statementNumber} imported (${out.statement.lineCount} lines${out.autoMatch ? `, ${out.autoMatch.matched} auto-matched` : ''})`);
  },
});
const manualSchema = z.object({
  bankAccount: z.string().min(1), statementRef: z.string().max(100).nullable().optional(), periodFrom: date.optional(), periodTo: date.optional(),
  openingBalance: z.coerce.number().optional(), closingBalance: z.coerce.number().optional(), remarks: z.string().max(1000).nullable().optional(), skipDuplicates: z.boolean().optional(),
  lines: z.array(z.object({ date, valueDate: date.nullable().optional(), description: z.string().max(500), reference: z.string().max(100).nullable().optional(),
    debit: z.coerce.number().min(0).optional(), credit: z.coerce.number().min(0).optional() })).min(1).max(2000),
});
define({
  method: 'POST', path: '/statements', summary: 'Enter a bank statement by hand (same checks as an import)', screen: `${S} > Manual statement`, middleware: [...write, validate(manualSchema)],
  request: { bankAccount: 'ACC-BDO-001', statementRef: 'SOA 2026-09', openingBalance: 150000, closingBalance: 149750, lines: [{ date: '2026-09-30', description: 'SERVICE CHARGE', debit: 250 }] },
  response: { success: true, data: { statement: { statementNumber: 'BST-2026-00002' } } },
  handler: async (req, res) => {
    const out = await tx(async (db) => {
      const s = await st.manualStatement(db, req.body, req.user);
      const account = await linkedAccount(db, req.body.bankAccount);
      const am = (await getSetting('bank_reconciliation.auto_match_on_import', true)) ? await mt.autoMatch(db, account, req.user) : null;
      return { statement: st.statementRow(s), autoMatch: am };
    });
    await audit(req, { entity: 'bank_statement', entityId: out.statement.statementNumber, action: 'create', after: out.statement });
    created(res, out, `Statement ${out.statement.statementNumber} saved`);
  },
});
define({
  method: 'GET', path: '/statements', summary: 'Bank statements (optionally of one bank account) with their matched line count', screen: `${S} > Statements`, middleware: read, query: { bankAccount: 'ACC-BDO-001' },
  response: { success: true, data: [{ statementNumber: 'BST-2026-00001', bankAccount: 'ACC-BDO-001', periodFrom: '2026-09-01', periodTo: '2026-09-28', lineCount: 12, matchedLines: 9 }] },
  handler: async (req, res) => ok(res, await st.listStatements(pool, req.query)),
});
define({
  method: 'GET', path: '/statements/:id', summary: 'A bank statement with its lines', screen: `${S} > Statements`, middleware: read,
  response: { success: true, data: { statementNumber: 'BST-2026-00001', lines: [{ lineNo: 1, date: '2026-09-02', description: 'DEPOSIT', credit: 5000 }] } },
  handler: async (req, res) => ok(res, await st.getStatement(pool, req.params.id)),
});
define({
  method: 'DELETE', path: '/statements/:id', summary: 'Delete a statement none of whose lines is matched or adjusted', screen: `${S} > Statements`, middleware: write,
  response: { success: true, data: { statementNumber: 'BST-2026-00001' } },
  handler: async (req, res) => {
    const s = await tx((db) => st.deleteStatement(db, req.params.id, req.user));
    await audit(req, { entity: 'bank_statement', entityId: s.statementNumber, action: 'delete', before: s });
    ok(res, s, `Statement ${s.statementNumber} deleted`);
  },
});

// ---------- workspace ----------
define({
  method: 'GET', path: '/workspace', summary: 'Matching workspace of a bank account and period: summary tiles, bank lines and book entries of the period plus older unmatched ones, the period\'s reconciliation',
  screen: S, middleware: read, query: { bankAccount: 'ACC-BDO-001', period: '2026-09' },
  response: { success: true, data: { summary: { statementBalance: 162500, bookBalance: 150000, unmatchedBank: 3, unmatchedBook: 2, difference: 0 }, bankLines: [], bookLines: [], reconciliation: null } },
  handler: async (req, res) => {
    const account = await linkedAccount(pool, req.query.bankAccount);
    const p = isPeriod(req.query.period) ? req.query.period : (await today()).slice(0, 7);
    const from = periodStart(p); const to = periodEnd(p);
    const [bankAll, bookAll, statement, recRow] = await Promise.all([
      mt.bankLines(pool, account.bank_account_id, { to }), mt.bookLines(pool, account.bank_account_id, { to }), rc.computeStatement(pool, account, to),
      pool.query('SELECT * FROM bank_reconciliations WHERE bank_account_id = $1 AND period = $2 AND status <> \'cancelled\'', [account.bank_account_id, p]).then((r) => r.rows[0] || null),
    ]);
    const inView = (d, cleared) => iso(d) >= from || !cleared || iso(cleared) >= from;
    const bank = bankAll.filter((l) => inView(l.txn_date, l.cleared_date)).map(mt.bankLineRow);
    const book = bookAll.filter((v) => inView(v.txn_date, v.cleared_date)).map(mt.bookLineRow);
    const um = (list) => list.filter((x) => !x.matchId);
    const users = await userNames(pool, [recRow?.prepared_by, recRow?.approved_by]);
    ok(res, {
      bankAccount: accountRow(account), period: p, from, to,
      summary: { statementBalance: statement.noStatement ? null : statement.bankBalance, bookBalance: statement.bookBalance, adjustedBankBalance: statement.adjustedBankBalance,
        adjustedBookBalance: statement.adjustedBookBalance, difference: statement.difference, unmatchedBank: um(bank).length, unmatchedBankAmount: round2(um(bank).reduce((s, x) => s + x.amount, 0)),
        unmatchedBook: um(book).length, unmatchedBookAmount: round2(um(book).reduce((s, x) => s + x.amount, 0)), statement: statement.statement },
      bankLines: bank, bookLines: book, reconciliation: recRow ? rc.recRow(recRow, users) : null,
    });
  },
});
define({
  method: 'POST', path: '/auto-match', summary: 'Run the automatic matching rules for a bank account (exact amounts: reference, date window, 1:many, many:1, contra, adjustments)',
  screen: S, middleware: [...write, validate(z.object({ bankAccount: z.string().min(1) }))], request: { bankAccount: 'ACC-BDO-001' },
  response: { success: true, data: { matched: 9, byRule: { REFERENCE: 4, AMOUNT_DATE: 3, ONE_TO_MANY: 1, CONTRA: 1 } } },
  handler: async (req, res) => {
    const r = await tx(async (db) => mt.autoMatch(db, await linkedAccount(db, req.body.bankAccount), req.user));
    await audit(req, { entity: 'bank_reconciliation', entityId: r.bankAccount, action: 'auto-match', after: { matched: r.matched, byRule: r.byRule } });
    ok(res, r, `${r.matched} match(es) found`);
  },
});
const matchSchema = z.object({
  bankAccount: z.string().min(1), bankLineIds: z.array(z.string()).max(200).default([]), bookLineIds: z.array(z.coerce.number().int()).max(200).default([]), remarks: z.string().max(1000).nullable().optional(),
  difference: z.object({ treatment: z.enum(['adjustment', 'bank-error', 'book-error']), typeCode: z.string().optional(), accountCode: z.string().optional(), remarks: z.string().max(1000).optional() }).optional(),
});
define({
  method: 'POST', path: '/matches', summary: 'Match bank lines with book entries by hand; amounts must agree, or the difference is explained (adjustment journal of a bank transaction type, bank error or book error)',
  screen: `${S} > Manual match`, middleware: [...write, validate(matchSchema)],
  request: { bankAccount: 'ACC-BDO-001', bankLineIds: ['bsl_1'], bookLineIds: [101, 102], difference: { treatment: 'adjustment', typeCode: 'BCHG' } },
  response: { success: true, data: { id: 'brm_1', bankTotal: 9950, bookTotal: 9950, difference: 0 } },
  handler: async (req, res) => {
    const b = req.body;
    const m = await tx(async (db) => {
      const account = await linkedAccount(db, b.bankAccount);
      const bookIds = [...b.bookLineIds];
      let treatment = null;
      if (b.difference?.treatment === 'adjustment') {
        if (!b.difference.typeCode) throw badRequest('Choose the bank transaction type of the adjustment');
        const bank = (await db.query('SELECT COALESCE(sum(amount), 0) AS t, max(txn_date) AS d FROM bank_statement_lines WHERE id = ANY($1)', [b.bankLineIds])).rows[0];
        const book = (await db.query('SELECT COALESCE(sum(debit - credit), 0) AS t FROM journal_lines WHERE id = ANY($1::bigint[])', [bookIds])).rows[0];
        const diff = round2(Number(bank.t) - Number(book.t));
        if (!diff) throw badRequest('The amounts agree; no adjustment is needed');
        const adj = await postBankAdjustment(db, account, null, { typeCode: b.difference.typeCode, amount: diff, date: bank.d ? iso(bank.d) : null, accountCode: b.difference.accountCode, remarks: b.difference.remarks || b.remarks }, req.user);
        if (adj.status !== 'posted') throw conflict(`The adjustment type ${b.difference.typeCode} needs approval; post the adjustment from the bank line instead`);
        bookIds.push(adj.cashLineId);
      } else if (b.difference) treatment = b.difference.treatment;
      const x = await mt.manualMatch(db, account, { bankLineIds: b.bankLineIds, bookLineIds: bookIds, treatment, remarks: [b.remarks, b.difference?.remarks].filter(Boolean).join('; ') || null }, req.user);
      return mt.matchRow({ ...x, items: (await mt.getMatch(db, x.id)).items });
    });
    await audit(req, { entity: 'bank_rec_match', entityId: m.id, action: 'match', after: m });
    created(res, m, 'Matched');
  },
});
define({
  method: 'GET', path: '/matches', summary: 'Matches of a bank account (active, unmatched or all) with who matched / unmatched them', screen: `${S} > Matches`, middleware: read,
  query: { bankAccount: 'ACC-BDO-001', status: 'all' }, response: { success: true, data: [{ id: 'brm_1', matchType: 'auto', rule: 'REFERENCE', status: 'active', matchedBy: 'Finance User' }] },
  handler: async (req, res) => {
    const account = await linkedAccount(pool, req.query.bankAccount);
    const rows = await mt.listMatches(pool, account.bank_account_id, { from: req.query.from || null, to: req.query.to || null, status: req.query.status || 'active' });
    const users = await userNames(pool, rows.flatMap((r) => [r.matched_by, r.unmatched_by]));
    ok(res, rows.map((r) => mt.matchRow(r, users)));
  },
});
define({
  method: 'POST', path: '/matches/:id/unmatch', summary: 'Undo a match (audited; refused when an approved reconciliation locks it)', screen: `${S} > Matches`,
  middleware: [...write, validate(z.object({ reason: z.string().max(1000).optional() }))], request: { reason: 'Wrong OR' }, response: { success: true, data: { id: 'brm_1', status: 'unmatched' } },
  handler: async (req, res) => {
    const r = await tx((db) => mt.unmatch(db, req.params.id, req.user, req.body.reason || null));
    const users = await userNames(pool, [r.after.matched_by, r.after.unmatched_by]);
    await audit(req, { entity: 'bank_rec_match', entityId: r.after.id, action: 'unmatch', before: mt.matchRow(r.before, users), after: mt.matchRow(r.after, users) });
    ok(res, mt.matchRow(r.after, users), 'Unmatched');
  },
});

// ---------- bank line actions ----------
async function lineOf(db, id) {
  const l = (await db.query('SELECT * FROM bank_statement_lines WHERE id = $1 AND status = \'active\' FOR UPDATE', [String(id)])).rows[0];
  if (!l) throw notFound('Bank line not found');
  if (!l.bank_account_id) throw badRequest('The line has no bank account (remittance line)');
  return l;
}
define({
  method: 'POST', path: '/bank-lines/:id/adjustment', summary: 'Create the adjustment for an unrecorded bank item from a bank line (postBankAdjustment: bank charges, interest, final tax, direct credits, returned cheque)',
  screen: `${S} > Create adjustment`,
  middleware: [...write, validate(z.object({ typeCode: z.string().min(1), date: date.optional(), accountCode: z.string().max(20).optional(), receiptId: z.string().optional(), remarks: z.string().max(500).optional() }))],
  request: { typeCode: 'BCHG', remarks: 'September service charge' }, response: { success: true, data: { status: 'posted', journal: { jv_number: 'JV-2026-00120' }, matchId: 'brm_9' } },
  handler: async (req, res) => {
    const r = await tx(async (db) => {
      const l = await lineOf(db, req.params.id);
      const account = await linkedAccount(db, l.bank_account_id);
      return postBankAdjustment(db, account, l, req.body, req.user);
    });
    await audit(req, { entity: 'bank_statement_line', entityId: req.params.id, action: `adjustment:${req.body.typeCode}`, after: r });
    created(res, r, r.message || `Adjustment ${r.journal?.jv_number || ''} posted`.trim());
  },
});
define({
  method: 'POST', path: '/bank-lines/:id/adjustment/approve', summary: 'Approve (post) the adjustment journal of a bank line awaiting approval (a different user than its maker) and match it',
  screen: `${S} > Create adjustment`, middleware: [...write, requirePermission('write:journal-vouchers')],
  response: { success: true, data: { journal: { jvNumber: 'JV-2026-00121', status: 'posted' }, matched: 1 } },
  handler: async (req, res) => {
    const r = await tx(async (db) => {
      const l = await lineOf(db, req.params.id);
      if (!l.adjustment_jv_id) throw conflict('The line has no adjustment journal');
      const jv = await approveJournal(db, l.adjustment_jv_id, req.user);
      const account = await linkedAccount(db, l.bank_account_id);
      const am = await mt.autoMatch(db, account, req.user);
      return { journal: { jvNumber: jv.jv_number, status: jv.status }, matched: am.byRule.ADJUSTMENT || 0 };
    });
    await audit(req, { entity: 'bank_statement_line', entityId: req.params.id, action: 'adjustment-approve', after: r });
    ok(res, r, `Journal ${r.journal.jvNumber} posted`);
  },
});
define({
  method: 'POST', path: '/bank-lines/:id/flag', summary: 'Mark a bank line as a bank error (reconciling item on the bank side, no journal), or clear the flag', screen: S,
  middleware: [...write, validate(z.object({ flag: z.enum(['bank-error']).nullable(), remarks: z.string().max(500).optional() }))],
  request: { flag: 'bank-error', remarks: 'Credit belongs to another depositor; bank to reverse' }, response: { success: true, data: { id: 'bsl_1', flag: 'bank-error' } },
  handler: async (req, res) => {
    const l = await tx((db) => mt.flagLine(db, req.params.id, req.body, req.user));
    await audit(req, { entity: 'bank_statement_line', entityId: l.id, action: req.body.flag ? 'flag' : 'unflag', after: { flag: l.flag, remarks: l.flag_remarks } });
    ok(res, mt.bankLineRow(l));
  },
});

// ---------- stale cheques ----------
define({
  method: 'GET', path: '/stale-cheques', summary: 'Outstanding payments of a bank account older than bank_reconciliation.stale_cheque_days as of a date', screen: `${S} > Stale cheques`, middleware: read,
  query: { bankAccount: 'ACC-BDO-001', asOf: '2026-09-30' }, response: { success: true, data: { staleDays: 180, rows: [{ journalNumber: 'JV-2026-00012', chequeNumber: '000045', amount: -12500, ageDays: 212 }] } },
  handler: async (req, res) => {
    const account = await linkedAccount(pool, req.query.bankAccount);
    const r = await staleCheques(pool, account, req.query.asOf && /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf) ? req.query.asOf : await today());
    ok(res, { staleDays: r.staleDays, asOf: r.asOf, rows: r.rows.map((v) => ({ ...mt.bookLineRow(v), ageDays: v.age })) });
  },
});
define({
  method: 'POST', path: '/stale-cheques/:lineId/cancel', summary: 'Cancel a stale cheque: the payment journal is reversed and the payable re-opened (disbursement cancellation)', screen: `${S} > Stale cheques`,
  middleware: [...write, validate(z.object({ bankAccount: z.string().min(1), reason: z.string().max(500).optional() }))], request: { bankAccount: 'ACC-BDO-001', reason: 'Not presented within 180 days' },
  response: { success: true, data: { chequeNumber: '000045', reversal: { jvNumber: 'JV-2026-00130' } } },
  handler: async (req, res) => {
    const r = await tx(async (db) => cancelStaleCheque(db, await linkedAccount(db, req.body.bankAccount), req.params.lineId, req.body.reason, req.user));
    await audit(req, { entity: 'checkbook', entityId: r.checkbookId, action: 'stale-cancel', after: r });
    ok(res, r, `Cheque ${r.chequeNumber} cancelled`);
  },
});

// ---------- reconciliation runs ----------
define({
  method: 'GET', path: '/reconciliations', summary: 'Bank reconciliation runs (by bank account, period, status)', screen: `${S} > Reconciliations`, middleware: read, query: { bankAccount: 'ACC-BDO-001', period: '2026-09' },
  response: { success: true, data: [{ recNumber: 'BRC-2026-00001', bankAccount: 'ACC-BDO-001', period: '2026-09', status: 'approved', difference: 0 }] },
  handler: async (req, res) => ok(res, await rc.listRecs(pool, req.query)),
});
define({
  method: 'POST', path: '/reconciliations', summary: 'Start the reconciliation of a bank account for a period (as of the period end)', screen: `${S} > Reconciliations`,
  middleware: [...write, validate(z.object({ bankAccount: z.string().min(1), period, remarks: z.string().max(1000).optional() }))], request: { bankAccount: 'ACC-BDO-001', period: '2026-09' },
  response: { success: true, data: { recNumber: 'BRC-2026-00001', status: 'draft' } },
  handler: async (req, res) => {
    const r = await tx(async (db) => rc.getRec(db, (await rc.createRec(db, req.body, req.user)).id));
    await audit(req, { entity: 'bank_reconciliation', entityId: r.recNumber, action: 'create', after: { recNumber: r.recNumber, bankAccount: r.bankAccount, period: r.period } });
    created(res, r);
  },
});
define({
  method: 'GET', path: '/reconciliations/:id', summary: 'A reconciliation with its Bank Reconciliation Statement (live while draft, frozen once prepared) and history', screen: `${S} > Reconciliation statement`, middleware: read,
  response: { success: true, data: { recNumber: 'BRC-2026-00001', statement: { bankBalance: 162500, depositsInTransit: 5000, outstandingCheques: 17500, adjustedBankBalance: 150000, bookBalance: 150250, unbookedDebits: 250, adjustedBookBalance: 150000, difference: 0 } } },
  handler: async (req, res) => ok(res, await tx((db) => rc.getRec(db, req.params.id))),
});
const transition = (action, fn, perms) => ({
  method: 'POST', path: `/reconciliations/:id/${action}`, screen: `${S} > Reconciliation statement`,
  middleware: [...perms, validate(z.object({ remarks: z.string().max(1000).optional() }))],
  handler: async (req, res) => {
    const out = await tx((db) => fn(db, req.params.id, req.user, req.body));
    const r = out.after || out;
    await audit(req, { entity: 'bank_reconciliation', entityId: r.recNumber, action, before: out.before ? rc.recRow(out.before) : null, after: { status: r.status, remarks: req.body.remarks || null, difference: r.difference } });
    ok(res, r, `Reconciliation ${r.recNumber} ${r.status}`);
  },
});
define({ ...transition('prepare', rc.prepareRec, write), summary: 'Prepare: freeze the statement (adjusted balances must agree); maker of the maker-checker', request: { remarks: 'All items explained' },
  response: { success: true, data: { status: 'prepared' } } });
define({ ...transition('approve', rc.approveRec, approve), summary: 'Approve a prepared reconciliation (approve:bank-reconciliation, not the preparer); locks the matches cleared up to the period end',
  request: { remarks: 'Reviewed' }, response: { success: true, data: { status: 'approved' } } });
define({ ...transition('reopen', rc.reopenRec, approve), summary: 'Reopen a prepared or approved reconciliation (approver, remarks required): back to draft, matches unlocked',
  request: { remarks: 'Late bank debit memo' }, response: { success: true, data: { status: 'draft' } } });
define({ ...transition('cancel', rc.cancelRec, write), summary: 'Cancel a draft reconciliation', request: { remarks: 'Created for the wrong account' }, response: { success: true, data: { status: 'cancelled' } } });
define({
  method: 'GET', path: '/reconciliations/:id/pdf', summary: 'Printable Bank Reconciliation Statement (PDF)', screen: `${S} > Reconciliation statement`, middleware: read,
  response: '(application/pdf)',
  handler: async (req, res) => {
    const rec = await tx((db) => rc.getRec(db, req.params.id));
    const company = { name: (await getSetting('general.company_name')) ?? '', system: (await getSetting('general.system_name')) ?? '' };
    sendPdf(res, buildPdf(await rc.statementPdfSpec(rec, company)), `bank-reconciliation-${rec.recNumber}.pdf`, req.query.download ? 'attachment' : 'inline');
  },
});
define({
  method: 'GET', path: '/statement-preview', summary: 'Bank Reconciliation Statement of a bank account as of any date (no run needed)', screen: S, middleware: read,
  query: { bankAccount: 'ACC-BDO-001', asOf: '2026-09-30' }, response: { success: true, data: { difference: 0 } },
  handler: async (req, res) => {
    const account = await linkedAccount(pool, req.query.bankAccount);
    const asOf = /^\d{4}-\d{2}-\d{2}$/.test(req.query.asOf || '') ? req.query.asOf : await today();
    ok(res, await rc.computeStatement(pool, account, asOf));
  },
});
export default router;
export const mount = '/bank-reconciliation';
