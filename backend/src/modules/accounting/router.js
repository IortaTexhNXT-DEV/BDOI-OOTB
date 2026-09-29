import { moduleRouter } from '../../lib/registry.js';
import { requireAuth, requirePermission } from '../../lib/auth.js';
import { validate, z } from '../../lib/validate.js';
import { pool, withTransaction } from '../../db/pool.js';
import { audit } from '../../lib/audit.js';
import { ok, created } from '../../lib/respond.js';
import { badRequest } from '../../lib/errors.js';
import { pageParams, sendList } from './lib/http.js';
import { toCsv } from './lib/files.js';
import { cancelJournal, postJournal, resolveJournalId, reverseJournal } from './lib/ledger.js';
import * as svc from './service.js';
import { today } from '../../lib/dates.js';

const { router, define } = moduleRouter('Accounting', '/accounting');
const read = [requireAuth, requirePermission('read:journal-vouchers', 'read:receipts', 'read:disbursements')];
const readPolicy = [requireAuth, requirePermission('read:journal-vouchers', 'read:receipts', 'read:policies')];
const write = [requireAuth, requirePermission('write:journal-vouchers')];
const Q = 'Accounts > Accounting Query';
const entry = { id: '101', transactionId: 'jv_1', transactionCode: 'JV-2026-00001', entryType: 'PAYMENT_RECEIPT', debitCredit: 'DEBIT', amount: 11862.5, accountCode: '1102001', accountName: 'Cash in Bank – BDO Current', account: { accountCode: '1102001', accountName: 'Cash in Bank – BDO Current' }, glCode: '1102001', documentDate: '2026-09-28', status: 'Posted', motherPolicyId: 'pol_1', motherPolicyNumber: 'POL-2026-00001', clientId: 'cl_1', client: { clientId: 'CL-2026-00001', firstName: 'Maria', lastName: 'Santos' }, referenceType: 'Receipt', referenceId: 'or_1' };
const pagination = { page: 1, pageSize: 10, total: 1, totalPages: 1 };

define({
  method: 'GET', path: '/all-clients-accounting', summary: 'Entries grouped by client with per-client and grand totals (filter entryType, startDate, endDate, clientId, policyId)', screen: 'Accounts > All Clients Accounting',
  middleware: read, query: { entryType: 'PAYMENT_RECEIPT', startDate: '2026-09-01', endDate: '2026-09-30', page: 1, pageSize: 10 },
  response: { success: true, data: [{ clientId: 'cl_1', clientNumber: 'CL-2026-00001', clientName: 'Maria Santos', totalTransactions: 5, summary: { totalDebits: 23725, totalCredits: 23725, balance: 0 }, transactions: [entry] }], pagination, totals: { totalClients: 1, totalTransactions: 5, grandTotalDebits: 23725, grandTotalCredits: 23725, grandTotalBalance: 0 } },
  handler: async (req, res) => {
    const pg = pageParams(req.query);
    const r = await svc.allClientsAccounting(pool, req.query, pg);
    sendList(res, r.data, r.total, pg, { totals: r.totals });
  },
});
define({
  method: 'GET', path: '/clients/:id/ledger-view', summary: 'Client ledger (all entries tagged to the client, running balance)', screen: 'Accounts > All Clients Accounting > Client', middleware: read,
  response: { success: true, data: [{ ...entry, runningBalance: 11862.5 }], totals: { totalDebits: 11862.5, totalCredits: 0, balance: 11862.5 } },
  handler: async (req, res) => {
    const r = await svc.ledger(pool, { ...req.query, clientId: req.params.id });
    res.json({ success: true, message: 'Client ledger view retrieved', data: r.data, totals: r.totals, pagination: { page: 1, pageSize: r.data.length, total: r.data.length, totalPages: 1 } });
  },
});
for (const [path, summary] of [['/policies/:id/ledger-view', 'Policy ledger (running balance)'], ['/policies/:id/entries', 'Premium accounting entries of a policy (filter startDate, endDate, entryType, status; paging)']]) {
  define({
    method: 'GET', path, summary, screen: 'Agent > Policy detail > Premium accounting entries', middleware: readPolicy, query: { entryType: 'NEW_BUSINESS', page: 1, pageSize: 50 },
    response: { success: true, data: [entry], totals: { totalDebits: 11862.5, totalCredits: 11862.5, balance: 0 }, isCoInsurance: false },
    handler: async (req, res) => {
      const r = await svc.ledger(pool, { ...req.query, policyId: req.params.id });
      const pg = pageParams(req.query, 500);
      const data = r.data.slice(pg.offset, pg.offset + pg.limit);
      sendList(res, data, r.data.length, pg, { totals: r.totals, isCoInsurance: false });
    },
  });
}
define({
  method: 'GET', path: '/entries/search', summary: 'Search accounting entries (policyId, clientId, clientName, entryType, referenceType, status, glCode, startDate, endDate; paging)', screen: Q, middleware: read,
  query: { clientId: 'CL-2026-00001', status: 'Posted', page: 1, pageSize: 20 }, response: { success: true, data: [entry], pagination },
  handler: async (req, res) => {
    const pg = pageParams(req.query, 20);
    const r = await svc.searchEntries(pool, req.query, pg);
    sendList(res, r.rows, r.total, pg, { totals: r.totals }, 'Accounting entries retrieved successfully');
  },
});
define({
  method: 'GET', path: '/entries/unmatched', summary: 'Posted open-item entries with an unmatched balance (filter debitCredit, currency, clientId, accountCode)', screen: 'Accounts > Open Entry Matching', middleware: read,
  query: { debitCredit: 'DEBIT' }, response: { success: true, data: [{ ...entry, originalAmount: 11862.5, amount: 11862.5 }] },
  handler: async (req, res) => { const rows = await svc.unmatchedEntries(pool, req.query); res.json({ success: true, message: 'Unmatched entries retrieved successfully', data: rows, pagination: { page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 } }); },
});
define({
  method: 'GET', path: '/entries/matched', summary: 'Active matches with their debit and credit entries', screen: 'Accounts > Open Entry Un-Matching', middleware: read,
  response: { success: true, data: [{ id: 'mt_1', matchedAmount: 11862.5, matchedDate: '2026-09-28T08:00:00Z', debitTransaction: entry, creditTransaction: { ...entry, id: '102', debitCredit: 'CREDIT' } }] },
  handler: async (req, res) => { const rows = await svc.matchedEntries(pool, req.query); res.json({ success: true, message: 'Matched entries retrieved successfully', data: rows, pagination: { page: 1, pageSize: rows.length, total: rows.length, totalPages: 1 } }); },
});
define({
  method: 'POST', path: '/entries/match', summary: 'Match debit and credit open entries on the same account (partial amounts allowed)', screen: 'Accounts > Open Entry Matching',
  middleware: [...write, validate(z.object({ matchPairs: z.array(z.object({ debitTransactionId: z.union([z.string(), z.number()]), creditTransactionId: z.union([z.string(), z.number()]), matchedAmount: z.number().optional(), adjustmentAmount: z.number().nullable().optional() })).min(1), metadata: z.object({}).passthrough().optional() }))],
  request: { matchPairs: [{ debitTransactionId: '101', creditTransactionId: '205', matchedAmount: 11862.5, adjustmentAmount: null }], metadata: { documentRef: 'MATCH-001', narration: 'Premium settled' } },
  response: { success: true, data: [{ id: 'mt_1', debitTransactionId: '101', creditTransactionId: '205', matchedAmount: 11862.5 }] },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.matchEntries(db, req.body.matchPairs, req.body.metadata || {}, req.user));
    await audit(req, { entity: 'entry_match', entityId: r.map((m) => m.id).join(','), action: 'match', after: req.body });
    ok(res, r, 'Entries matched successfully');
  },
});
const unmatchHandler = async (req, res) => {
  const raw = req.body?.matchingIds ?? req.query.matchingIds;
  const ids = (Array.isArray(raw) ? raw : String(raw || '').split(',')).map((s) => String(s).trim()).filter(Boolean);
  if (!ids.length) throw badRequest('matchingIds is required');
  const r = await withTransaction((db) => svc.unmatch(db, ids, req.user));
  await audit(req, { entity: 'entry_match', entityId: r.join(','), action: 'unmatch' });
  ok(res, r, 'Entries unmatched successfully');
};
define({ method: 'POST', path: '/entries/unmatch', summary: 'Undo matches (body matchingIds[])', screen: 'Accounts > Open Entry Un-Matching', middleware: write, request: { matchingIds: ['mt_1'] }, response: { success: true, data: ['mt_1'] }, handler: unmatchHandler });
define({ method: 'GET', path: '/entries/unmatch', summary: 'Undo matches (query matchingIds=a,b) – kept for the current front-end service', screen: 'Accounts > Open Entry Un-Matching', middleware: write, query: { matchingIds: 'mt_1,mt_2' }, response: { success: true, data: ['mt_1'] }, handler: unmatchHandler });

define({
  method: 'PUT', path: '/transactions/bulk-post', summary: 'Post several pending journals (ids may be entry ids, journal ids or numbers)', screen: Q,
  middleware: [...write, validate(z.object({ transactionIds: z.array(z.union([z.string(), z.number()])).min(1) }))], request: { transactionIds: ['101', 'jv_2'] },
  response: { success: true, data: { posted: ['jv_1'], errors: [] } },
  handler: async (req, res) => {
    const posted = []; const errors = [];
    for (const t of req.body.transactionIds) {
      try {
        const jv = await withTransaction(async (db) => postJournal(db, await resolveJournalId(db, t), req.user));
        posted.push(jv.id);
        await audit(req, { entity: 'journal', entityId: jv.id, action: 'post' });
      } catch (e) { errors.push({ transactionId: String(t), error: e.message }); }
    }
    ok(res, { posted, errors }, `${posted.length} transaction(s) posted`);
  },
});
const TX = { post: ['Post a pending journal (maker-checker for vouchers that require approval)', postJournal, 'Posted'],
  reverse: ['Reverse a posted journal with a mirror journal', (db, id, user) => reverseJournal(db, id, user), 'Reversed'],
  cancel: ['Cancel an unposted journal', cancelJournal, 'Cancelled'] };
for (const [action, [summary, fn, label]] of Object.entries(TX)) {
  define({
    method: 'PUT', path: `/transactions/:id/${action}`, summary: `${summary} (id = entry id, journal id or number)`, screen: Q, middleware: write,
    response: { success: true, data: { transactionId: 'jv_1', status: label } },
    handler: async (req, res) => {
      const r = await withTransaction(async (db) => {
        const id = await resolveJournalId(db, req.params.id);
        const out = await fn(db, id, req.user);
        return { id, out };
      });
      await audit(req, { entity: 'journal', entityId: r.id, action, after: { result: r.out.id, status: r.out.status } });
      ok(res, { transactionId: r.id, journalId: r.id, status: label, ...(action === 'reverse' ? { reversalJournalId: r.out.id, reversalNumber: r.out.jv_number } : {}) }, `Transaction ${label.toLowerCase()} successfully`);
    },
  });
}
define({
  method: 'GET', path: '/export', summary: 'Export entries matching the search filters as CSV (attachment)', screen: `${Q} > Export`, middleware: read, query: { startDate: '2026-09-01', endDate: '2026-09-30' },
  response: '(text/csv attachment)',
  handler: async (req, res) => {
    const r = await svc.searchEntries(pool, req.query, null);
    if (!r.rows.length) { res.status(404).json({ success: false, message: 'No accounting entries found matching the filters' }); return; }
    const cols = [['documentDate', 'Date'], ['transactionCode', 'Transaction'], ['entryType', 'Entry type'], ['accountCode', 'GL code'], ['accountName', 'Account'], ['debit', 'Debit'], ['credit', 'Credit'],
      ['motherPolicyNumber', 'Policy'], ['clientCode', 'Client code'], ['clientName', 'Client'], ['description', 'Description'], ['status', 'Status'], ['referenceType', 'Reference type'], ['referenceId', 'Reference']]
      .map(([key, label]) => ({ key, label }));
    const csv = toCsv(cols, r.rows.map((e) => ({ ...e, clientCode: e.client?.clientId, clientName: e.client?.displayName })));
    await audit(req, { entity: 'journal', entityId: null, action: 'export', after: { filters: req.query, rows: r.rows.length } });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="accounting-entries-${await today()}.csv"`);
    res.send(csv);
  },
});
define({
  method: 'POST', path: '/payment-entries', summary: 'Finance (write:receipts): record a premium payment for a policy directly: bills the policy if needed, applies the outstanding part (Dr Cash / Cr Premium Receivable); direct-billed books commission receivable. Agents / sales / underwriters record payments with POST /policies/:id/payments for finance to verify',
  screen: 'Accounts > Receipts', middleware: [requireAuth, requirePermission('write:receipts'),
    validate(z.object({ amount: z.coerce.number().positive(), clientId: z.string(), referenceType: z.string(), referenceId: z.string(), policyId: z.string().optional(), policyNumber: z.string().optional() }).passthrough())],
  request: { amount: 11862.5, grossPremium: 11862.5, netPremium: 10000, valueAddedTax: 1200, documentaryStampTax: 1250, localGovernmentTax: 75, accountPremiumOthers: 0, discount: 662.5, paymentDate: '2026-09-28T02:00:00Z', description: 'Quote payment for policy POL-2026-00001', referenceType: 'Policy', referenceId: 'pol_1', clientId: 'cl_1', policyId: 'pol_1', policyNumber: 'POL-2026-00001', isDirectBilled: false },
  response: { success: true, message: 'Payment accounting entries created', data: { journals: ['jv_1', 'jv_2'], applied: 11862.5, alreadyApplied: false } },
  handler: async (req, res) => {
    const r = await withTransaction((db) => svc.paymentEntries(db, req.body, req.user));
    await audit(req, { entity: 'journal', entityId: req.body.policyId || req.body.referenceId, action: 'payment-entries', after: { ...r, amount: req.body.amount } });
    created(res, r, r.alreadyApplied ? 'Payment already recorded' : 'Payment accounting entries created');
  },
});
define({
  method: 'GET', path: '/trial-balance', summary: 'Trial balance from posted journals (asOf date or period YYYY-MM; optional from)', screen: 'Reports > Financial Reports > Trial Balance', middleware: [requireAuth, requirePermission('read:journal-vouchers', 'read:reports')],
  query: { asOf: '2026-09-30' }, response: { success: true, data: { asOf: '2026-09-30', rows: [{ accountCode: '1102001', accountName: 'Cash in Bank – BDO Current', debit: 11862.5, credit: 0 }], totals: { debit: 11862.5, credit: 11862.5, balanced: true } } },
  handler: async (req, res) => ok(res, await svc.trialBalance(pool, req.query)),
});
define({
  method: 'GET', path: '/periods', summary: 'Accounting periods (last 12 months plus any stored) with open / closed status', screen: 'Accounts > Journal Voucher > Periods', middleware: read,
  response: { success: true, data: [{ period: '2026-09', status: 'open' }] }, handler: async (_req, res) => ok(res, await svc.listPeriods(pool)),
});
for (const [action, status] of [['close', 'closed'], ['reopen', 'open']]) {
  define({
    method: 'POST', path: `/periods/:period/${action}`, summary: `${action === 'close' ? 'Close' : 'Reopen'} an accounting period (YYYY-MM); postings into a closed period are rejected`, screen: 'Accounts > Journal Voucher > Periods',
    middleware: [...write, validate(z.object({ remarks: z.string().optional() }))], request: { remarks: 'August books closed' }, response: { success: true, data: { period: '2026-08', status } },
    handler: async (req, res) => {
      const r = await withTransaction((db) => svc.setPeriodStatus(db, req.params.period, status, req.body.remarks, req.user));
      await audit(req, { entity: 'accounting_period', entityId: req.params.period, action, after: r });
      ok(res, r, `Period ${req.params.period} ${status}`);
    },
  });
}
const accountExample = { code: '1203001', name: 'Commission Receivable – Insurers (Direct Bill)', accountType: 'asset', fsGroup: 'Current Assets', category: 'Receivables',
  normalBalance: 'debit', isOpenItem: true, allowManual: true, status: 'active', systemRoles: ['commission_receivable'], isSystem: true };
define({
  method: 'GET', path: '/accounts', summary: 'Chart of accounts in statement order (filter type, status, fsGroup, level=main|sub, search) with the system roles mapped to each account',
  screen: 'Master > Finance > Chart of Accounts (Main / Sub Account); Journal Voucher account pickers', middleware: [requireAuth, requirePermission('read:journal-vouchers', 'read:masters')],
  query: { type: 'asset', search: 'receivable' }, response: { success: true, data: [accountExample] },
  handler: async (req, res) => ok(res, await svc.listAccounts(pool, req.query)),
});
define({
  method: 'GET', path: '/account-groups', summary: 'Account types and financial-statement groups of the chart (for the chart of accounts form and reports)', screen: 'Master > Finance > Chart of Accounts',
  middleware: [requireAuth, requirePermission('read:journal-vouchers', 'read:masters')],
  response: { success: true, data: { types: ['asset', 'liability', 'equity', 'income', 'expense'], groups: [{ group: 'Current Assets', accountType: 'asset' }] } },
  handler: async (_req, res) => ok(res, { types: ['asset', 'liability', 'equity', 'income', 'expense'], groups: svc.FS_GROUPS.map(([group, accountType]) => ({ group, accountType })) }),
});
const accountSchema = z.object({ code: z.string().regex(/^[0-9A-Za-z-]{3,20}$/).optional(), name: z.string().min(2).optional(), accountType: z.enum(['asset', 'liability', 'equity', 'income', 'expense']).optional(),
  parentCode: z.string().optional(), category: z.string().optional(), isOpenItem: z.boolean().optional(), allowManual: z.boolean().optional(), status: z.enum(['active', 'inactive']).optional(),
  fsGroup: z.string().optional(), normalBalance: z.enum(['debit', 'credit']).optional(), description: z.string().max(500).optional() });
const withRoles = async (a) => svc.accountRow(a, await svc.accountRoles(pool));
define({
  method: 'POST', path: '/accounts', summary: 'Add a GL account (also listed in the Main / Sub Account masters)', screen: 'Master > Finance > Chart of Accounts', middleware: [...write, validate(accountSchema.required({ code: true, name: true, accountType: true }))],
  request: { code: '4409002', name: 'Donations and Contributions', accountType: 'expense', fsGroup: 'Operating Expenses', category: 'Operating Expenses' },
  response: { success: true, data: { code: '4409002', name: 'Donations and Contributions', accountType: 'expense', fsGroup: 'Operating Expenses' } },
  handler: async (req, res) => {
    const exists = (await pool.query('SELECT 1 FROM gl_accounts WHERE code = $1', [req.body.code])).rows[0];
    if (exists) throw badRequest(`Account ${req.body.code} already exists`);
    const a = await withTransaction((db) => svc.upsertAccount(db, req.body.code, req.body));
    await audit(req, { entity: 'gl_account', entityId: a.code, action: 'create', after: a });
    created(res, await withRoles(a));
  },
});
define({
  method: 'PUT', path: '/accounts/:code', summary: 'Update a GL account (deactivation only with zero balance and no system role; type fixed once used)', screen: 'Master > Finance > Chart of Accounts', middleware: [...write, validate(accountSchema)],
  request: { name: 'Office Supplies Expense' }, response: { success: true, data: { code: '4401008', name: 'Office Supplies Expense' } },
  handler: async (req, res) => {
    const before = (await pool.query('SELECT * FROM gl_accounts WHERE code = $1', [req.params.code])).rows[0];
    if (!before) { res.status(404).json({ success: false, message: 'Account not found' }); return; }
    const a = await withTransaction((db) => svc.upsertAccount(db, req.params.code, req.body));
    await audit(req, { entity: 'gl_account', entityId: a.code, action: 'update', before, after: a });
    ok(res, await withRoles(a));
  },
});
export default router;
export const mount = '/accounting';
