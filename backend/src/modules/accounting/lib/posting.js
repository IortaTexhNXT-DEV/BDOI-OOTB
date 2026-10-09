/**
 * Posting engine. Every system journal is produced by postEvent(eventCode, context): the active posting rule of the
 * event (posting_rules / posting_rule_lines, latest version effective on the posting date) is expanded into journal
 * lines and handed to createJournal, which validates balance, accounts and the period.
 *
 * Rule line: side Dr / Cr, account (role -> accounting.account.<role>, fixed GL code, resolver, or an account the
 * operation supplies in context.accounts), amount key (one of the amounts the event supplies), per-participant flag
 * (one line per co-insurer with its share: context.participants[].amounts), narration template ({{var}}).
 * A negative amount posts on the opposite side; zero lines are dropped.
 *
 * context = { date, description, transactionCode, referenceType, referenceId, clientId, policyId, policyNumber, dueDate,
 *   currency, entryType, entrySubType, source, status, requiresApproval, amounts: {...}, participants: [{ insurerId,
 *   insurerName, amounts: {...} }], accounts: {...}, vars: {...}, paymentMode, bankAccount, payeeType, writeOffReason,
 *   branchCode, departmentCode }
 */
import { getSetting } from '../../../lib/settings.js';
import { badRequest, notFound } from '../../../lib/errors.js';
import { round2, today } from './http.js';
import { account, cashAccountFor, createJournal, payableAccountFor } from './ledger.js';
import { commissionTaxAccount } from './commissionTax.js';

const P = (insurerName, share, amounts) => ({ insurerId: null, insurerName, share, amounts });
/** Business events: label, module, amount keys the operation supplies, template variables and a sample context. */
export const EVENTS = {
  'policy.issue.broker_billed': { label: 'Policy issued – broker billed', module: 'policies', participants: true,
    amounts: ['gross', 'due_to_insurer', 'vat', 'dst', 'lgt', 'commission', 'net_premium', 'commission_vat', 'commission_ewt'], vars: ['policyNumber', 'billNumber', 'insurer', 'participantSuffix'],
    sample: { amounts: { gross: 11200, net_premium: 10000, vat: 0, dst: 0, lgt: 0, commission: 1500, commission_vat: 180, commission_ewt: 150, due_to_insurer: 9670 }, vars: { policyNumber: 'POL-SAMPLE', billNumber: 'INV-SAMPLE', insurer: 'Sample Insurer', participantSuffix: '' } } },
  'endorsement.additional_premium': { label: 'Endorsement – additional premium', module: 'endorsements', participants: true, sameAs: 'policy.issue.broker_billed' },
  'policy.renewal.broker_billed': { label: 'Renewal – broker billed', module: 'policies', participants: true, sameAs: 'policy.issue.broker_billed' },
  'endorsement.return_premium': { label: 'Endorsement – return premium', module: 'endorsements', participants: true,
    amounts: ['gross', 'due_to_insurer', 'vat', 'dst', 'lgt', 'commission', 'receivable_credit', 'refund', 'commission_vat', 'commission_ewt'], vars: ['policyNumber', 'reference', 'billNumber', 'clientName', 'insurer', 'participantSuffix'],
    sample: { amounts: { gross: 1120, vat: 0, dst: 0, lgt: 0, commission: 150, commission_vat: 18, commission_ewt: 15, due_to_insurer: 967, receivable_credit: 620, refund: 500 },
      vars: { policyNumber: 'POL-SAMPLE', reference: 'END-SAMPLE', billNumber: 'INV-SAMPLE', clientName: 'Sample Client', insurer: 'Sample Insurer', participantSuffix: '' } } },
  'policy.cancel': { label: 'Policy cancellation', module: 'endorsements', participants: true, sameAs: 'endorsement.return_premium' },
  'receipt.apply': { label: 'Premium collection applied', module: 'receipts', amounts: ['amount'], vars: ['policyNumber', 'receiptSuffix', 'memoRef', 'billNumber'],
    sample: { amounts: { amount: 11200 }, vars: { policyNumber: 'POL-SAMPLE', receiptSuffix: ' (OR-SAMPLE)', memoRef: 'Premium collection', billNumber: 'INV-SAMPLE' }, paymentMode: 'bank-transfer' } },
  'directbill.commission': { label: 'Direct bill – commission booked', module: 'remittance', amounts: ['amount', 'commission', 'vat', 'gross_premium'], vars: ['policyNumber', 'referenceSuffix', 'insurer'],
    sample: { amounts: { amount: 1680, commission: 1500, vat: 180, gross_premium: 11200 }, vars: { policyNumber: 'POL-SAMPLE', referenceSuffix: '', insurer: 'Sample Insurer' } } },
  'directbill.commission_return': { label: 'Direct bill – commission returned', module: 'remittance', sameAs: 'directbill.commission' },
  'commission.billing_statement': { label: 'Commission billing statement approved (gross remittance)', module: 'remittance', amounts: ['amount', 'commission', 'vat'], vars: ['statementNumber', 'insurer'],
    sample: { amounts: { amount: 5097.9, commission: 4551.7, vat: 546.2 }, vars: { statementNumber: 'CBS-SAMPLE', insurer: 'Sample Insurer' } } },
  'directbill.collection': { label: 'Direct bill – commission collected', module: 'remittance', amounts: ['cash', 'ewt', 'applied'], vars: ['dnNumber', 'insurer', 'referenceSuffix', 'memoRef', 'form2307Suffix'],
    sample: { amounts: { cash: 1530, ewt: 150, applied: 1680 }, vars: { dnNumber: 'DN-SAMPLE', insurer: 'Sample Insurer', referenceSuffix: '', memoRef: 'Collection DNC-SAMPLE', form2307Suffix: '' } } },
  'commission.approve': { label: 'Comsub approved', module: 'commission', amounts: ['amount'], vars: ['referrerName', 'policyNumber'],
    sample: { amounts: { amount: 800 }, vars: { referrerName: 'Sample Referrer', policyNumber: 'POL-SAMPLE' } } },
  'commission.payout': { label: 'Comsub paid', module: 'commission', amounts: ['gross', 'net', 'wht'], vars: ['voucherNumber', 'payeeName'],
    sample: { amounts: { gross: 800, net: 760, wht: 40 }, vars: { voucherNumber: 'PV-SAMPLE', payeeName: 'Sample Referrer' } } },
  'commission.clawback': { label: 'Comsub clawback', module: 'commission', amounts: ['amount'], vars: ['referrerName', 'policyNumber'],
    sample: { amounts: { amount: 800 }, vars: { referrerName: 'Sample Referrer', policyNumber: 'POL-SAMPLE' } } },
  'disbursement.payment': { label: 'Payment voucher paid (cheque approved)', module: 'disbursements', amounts: ['amount', 'payable', 'vat', 'dst', 'lgt'], vars: ['payeeType', 'payeeName', 'instrumentNo'],
    sample: { amounts: { amount: 9700, payable: 9700, vat: 0, dst: 0, lgt: 0 }, vars: { payeeType: 'Insurer', payeeName: 'Sample Insurer', instrumentNo: '000123' }, payeeType: 'Insurer' } },
  'pettycash.fund': { label: 'Petty cash fund established', module: 'payments', amounts: ['amount'], vars: ['fundCode'], contextAccounts: ['fund'],
    sample: { amounts: { amount: 10000 }, vars: { fundCode: 'PCF-SAMPLE' } } },
  'pettycash.disbursement': { label: 'Petty cash disbursement', module: 'payments', amounts: ['amount', 'net_of_vat', 'vat', 'net', 'wht'], vars: ['fundCode', 'purpose', 'remarks'], contextAccounts: ['expense', 'vat', 'fund', 'wht'],
    sample: { amounts: { amount: 1120, net_of_vat: 1000, vat: 120, net: 1100, wht: 20 }, vars: { fundCode: 'PCF-SAMPLE', purpose: 'Courier', remarks: 'Courier' }, accounts: { expense: '4401007' } } },
  'pettycash.receipt': { label: 'Petty cash returned', module: 'payments', amounts: ['amount'], vars: ['fundCode', 'remarks'], contextAccounts: ['fund', 'credit'],
    sample: { amounts: { amount: 200 }, vars: { fundCode: 'PCF-SAMPLE', remarks: 'Unused cash' } } },
  'pettycash.replenishment': { label: 'Petty cash replenished', module: 'payments', amounts: ['amount'], vars: ['fundCode'], contextAccounts: ['fund'],
    sample: { amounts: { amount: 5000 }, vars: { fundCode: 'PCF-SAMPLE' } } },
  write_off: { label: 'Write-off of a debit balance', module: 'accounting', amounts: ['amount'], vars: ['reasonCode', 'reasonName', 'accountCode'], contextAccounts: ['open_item'],
    sample: { amounts: { amount: 50 }, vars: { reasonCode: 'SMALL_BALANCE', reasonName: 'Small balance difference', accountCode: '1202001' }, accounts: { open_item: '1202001' } } },
  'write_off.credit_balance': { label: 'Write-off of a credit balance', module: 'accounting', sameAs: 'write_off' },
  'claim.settlement.paid_through_broker': { label: 'Claim settled through the broker', module: 'claims', participants: true, amounts: ['amount'], vars: ['claimNumber', 'policyNumber', 'claimant', 'insurer'],
    sample: { amounts: { amount: 50000 }, vars: { claimNumber: 'CLM-SAMPLE', policyNumber: 'POL-SAMPLE', claimant: 'Sample Claimant', insurer: 'Sample Insurer' } } },
  'claim.funds_received': { label: 'Claim funds received from insurer', module: 'claims', amounts: ['amount'], vars: ['claimNumber', 'insurer', 'memoRef'],
    sample: { amounts: { amount: 50000 }, vars: { claimNumber: 'CLM-SAMPLE', insurer: 'Sample Insurer', memoRef: 'Claim funds' } } },
  'claim.paid_to_claimant': { label: 'Claim paid to claimant', module: 'claims', amounts: ['amount'], vars: ['claimNumber', 'claimant', 'memoRef'],
    sample: { amounts: { amount: 50000 }, vars: { claimNumber: 'CLM-SAMPLE', claimant: 'Sample Claimant', memoRef: 'Claim payment' } } },
  'remittance.settlement': { label: 'Remittance settlement adjustments', module: 'remittance', amounts: ['adjustments', 'net'], vars: ['reference', 'insurer'],
    sample: { amounts: { adjustments: 250, net: 9950 }, vars: { reference: 'STL-SAMPLE', insurer: 'Sample Insurer' }, payeeType: 'Insurer' } },
  'remittance.adjustment': { label: 'Remittance adjustment', module: 'remittance', amounts: ['amount'], vars: ['reference', 'adjustmentType', 'reason', 'insurer'],
    sample: { amounts: { amount: -300 }, vars: { reference: 'ADJ-SAMPLE', adjustmentType: 'Credit note', reason: 'Rate correction', insurer: 'Sample Insurer' }, payeeType: 'Insurer' } },
  'insurer_statement.adjustment': { label: 'Insurer statement adjustment', module: 'remittance', amounts: ['premium', 'commission'],
    vars: ['statementNumber', 'statementRef', 'insurer', 'policyNumber', 'note'], contextAccounts: ['commission_offset'],
    sample: { amounts: { premium: 250, commission: -120 }, vars: { statementNumber: 'ISR-SAMPLE', statementRef: 'SOA-SAMPLE', insurer: 'Sample Insurer', policyNumber: 'POL-SAMPLE', note: 'Rate correction' },
      payeeType: 'Insurer', accounts: { commission_offset: '1203001' } } },
  'remittance.transfer': { label: 'Remittance electronic transfer', module: 'remittance', amounts: ['amount'], vars: ['reference', 'beneficiary', 'method'],
    sample: { amounts: { amount: 9700 }, vars: { reference: 'TRF-SAMPLE', beneficiary: 'Sample Insurer', method: 'instapay' }, payeeType: 'Insurer' } },
  'insurer.refund_due': { label: 'Refund due from insurer (return premium already remitted)', module: 'remittance', participants: true,
    amounts: ['amount', 'due_to_insurer', 'vat', 'dst', 'lgt'], vars: ['policyNumber', 'reference', 'insurer'],
    sample: { amounts: { amount: 970, due_to_insurer: 970, vat: 0, dst: 0, lgt: 0 }, vars: { policyNumber: 'POL-SAMPLE', reference: 'END-SAMPLE', insurer: 'Sample Insurer' } } },
  'insurer.refund_applied': { label: 'Insurer refund netted against a remittance', module: 'remittance',
    amounts: ['amount', 'due_to_insurer', 'vat', 'dst', 'lgt'], vars: ['insurer', 'voucherNumber', 'policyNumber'],
    sample: { amounts: { amount: 970, due_to_insurer: 970, vat: 0, dst: 0, lgt: 0 }, vars: { insurer: 'Sample Insurer', voucherNumber: 'PV-SAMPLE', policyNumber: 'POL-SAMPLE' } } },
  'incentive.accrual': { label: 'Incentives approved', module: 'incentive', amounts: ['amount'], vars: ['batchId', 'period'],
    sample: { amounts: { amount: 15000 }, vars: { batchId: 'INC-SAMPLE', period: '2026-09' } } },
  'incentive.payout': { label: 'Incentives paid', module: 'incentive', amounts: ['amount'], vars: ['batchId', 'period', 'memoRef'],
    sample: { amounts: { amount: 15000 }, vars: { batchId: 'INC-SAMPLE', period: '2026-09', memoRef: 'Incentive payout' } } },
  // BIR sales invoices (EOPT Act) and overriding commission from insurers (modules/bir, modules/insurer-overrides)
  'sales_invoice.issue': { label: 'Sales invoice issued (manual service invoice)', module: 'accounting', amounts: ['receivable', 'income', 'vat'], vars: ['invoiceNumber', 'buyer'],
    contextAccounts: ['income'], sample: { amounts: { receivable: 11200, income: 10000, vat: 1200 }, vars: { invoiceNumber: 'SI-SAMPLE', buyer: 'Sample Client' } } },
  'sales_invoice.payment': { label: 'Sales invoice payment received', module: 'accounting', amounts: ['cash', 'ewt', 'applied'], vars: ['ackNumber', 'invoiceNumber', 'buyer', 'form2307'],
    sample: { amounts: { cash: 10200, ewt: 1000, applied: 11200 }, vars: { ackNumber: 'PAR-SAMPLE', invoiceNumber: 'SI-SAMPLE', buyer: 'Sample Client', form2307: '' }, paymentMode: 'bank-transfer' } },
  'override_commission.accrual': { label: 'Overriding commission receivable booked', module: 'commission', amounts: ['receivable', 'commission', 'vat'],
    vars: ['computationNumber', 'insurer', 'period', 'commissionType'],
    sample: { amounts: { receivable: 56000, commission: 50000, vat: 6000 }, vars: { computationNumber: 'OVC-SAMPLE', insurer: 'Sample Insurer', period: '2026-Q3', commissionType: 'Overriding' } } },
  'override_commission.settlement': { label: 'Overriding commission settled by the insurer', module: 'commission', amounts: ['cash', 'ewt', 'applied', 'difference'],
    vars: ['computationNumber', 'insurer', 'statementReference', 'form2307'],
    sample: { amounts: { cash: 51000, ewt: 5000, applied: 56000, difference: 0 }, vars: { computationNumber: 'OVC-SAMPLE', insurer: 'Sample Insurer', statementReference: 'SOA-SAMPLE', form2307: '' }, paymentMode: 'bank-transfer' } },
  // accounts payable and fixed assets (migration 0298): the expense line of ap.invoice is split over the invoice's accounts
  'ap.invoice': { label: 'Supplier invoice approved', module: 'payables', amounts: ['net', 'vat', 'ewt', 'payable'], vars: ['supplierName', 'invoiceNo', 'voucherNumber'],
    contextAccounts: ['expense', 'vat', 'ewt'],
    sample: { amounts: { net: 10000, vat: 1200, ewt: 100, payable: 11100 }, vars: { supplierName: 'Sample Supplier', invoiceNo: 'SI-SAMPLE', voucherNumber: 'APV-SAMPLE' },
      accounts: { expense: '4401008', vat: '1301001', ewt: '2204001' } } },
  'ap.payment': { label: 'Supplier paid', module: 'payables', amounts: ['amount'], vars: ['supplierName', 'paymentNumber', 'memoRef'],
    sample: { amounts: { amount: 11100 }, vars: { supplierName: 'Sample Supplier', paymentNumber: 'SPV-SAMPLE', memoRef: 'Cheque 000123' }, paymentMode: 'check' } },
  'fa.depreciation': { label: 'Monthly depreciation', module: 'fixed-assets', amounts: ['amount'], vars: ['period', 'assetClass'], contextAccounts: ['expense', 'accumulated'],
    sample: { amounts: { amount: 10000 }, vars: { period: '2026-09', assetClass: 'Computer equipment' }, accounts: { expense: '4406001', accumulated: '1402003' } } },
  // fixed asset sold or written off (migration 0321): a negative gain_loss is posted as loss, a positive one as gain
  'fa.disposal': { label: 'Fixed asset disposed', module: 'fixed-assets', amounts: ['cost', 'accumulated', 'receivable', 'vat', 'gain', 'loss'],
    vars: ['disposalNumber', 'assetNumber', 'assetName', 'buyer'], contextAccounts: ['asset', 'accumulated', 'proceeds', 'vat'],
    sample: { amounts: { cost: 360000, accumulated: 300000, receivable: 56000, vat: 6000, gain: 0, loss: 10000 },
      vars: { disposalNumber: 'FAD-SAMPLE', assetNumber: 'FA-SAMPLE', assetName: 'Laptop computers', buyer: 'Sample Buyer' }, accounts: { asset: '1401003', accumulated: '1402003' } } },
};
for (const e of Object.values(EVENTS)) {
  if (!e.sameAs) continue;
  const base = EVENTS[e.sameAs];
  for (const k of ['amounts', 'vars', 'sample', 'contextAccounts']) if (e[k] === undefined && base[k] !== undefined) e[k] = base[k];
}
// co-insurance sample: the participant-level events simulate a 60 / 40 split
for (const e of Object.values(EVENTS)) {
  if (!e.participants || e.sample.participants) continue;
  const lead = {}; const co = {};
  for (const [k, v] of Object.entries(e.sample.amounts)) { lead[k] = round2(v * 0.6); co[k] = round2(v - round2(v * 0.6)); }
  e.sampleCoInsurance = { ...e.sample, participants: [P('Lead Insurer', 60, lead), P('Co-Insurer', 40, co)] };
}

/**
 * Events whose journal always posts at once, whatever accounting.parked_events says: a sub-ledger moves with them and
 * later steps read it (the bill and the premium payable to the insurer, the collection applied to a bill, direct-bill
 * commission billed on debit notes, refunds netted against remittances, matched open items).
 */
const SUBLEDGER = 'Posts with its sub-ledger: the bill, collection, commission or refund it records is used at once by the next steps';
export const ALWAYS_POSTED = Object.fromEntries(['policy.issue.broker_billed', 'endorsement.additional_premium', 'policy.renewal.broker_billed', 'endorsement.return_premium',
  'policy.cancel', 'receipt.apply', 'directbill.commission', 'directbill.commission_return', 'insurer.refund_due', 'insurer.refund_applied', 'write_off',
  'write_off.credit_balance'].map((code) => [code, SUBLEDGER]));

/** Whether the journal of an event is parked on save (accounting.parked_events), to be posted on another user's approval. */
export async function parksOnSave(eventCode) {
  if (ALWAYS_POSTED[eventCode]) return false;
  const listed = (await getSetting('accounting.parked_events', [])) || [];
  return Array.isArray(listed) && listed.includes(eventCode);
}

/** Every amount key an event may supply (the whitelist offered by the rule editor). */
export const AMOUNT_KEYS = [...new Set(Object.values(EVENTS).flatMap((e) => e.amounts || []))].sort();

// ---------- account resolvers ----------

/**
 * GL account of a bank account: the GL cash account it is linked to for bank reconciliation (glAccountCode), else the
 * master's glAccount, or the code itself when it is an active cash account. The reconciliation link comes first, so
 * money received into or paid from a bank account is booked on the GL account its bank statements are matched against.
 */
export async function bankAccountGl(db, ref) {
  if (!ref) return null;
  const r = (await db.query('SELECT data FROM master_records WHERE type_code = \'bank-account\' AND status <> \'deleted\' AND (code = $1 OR data->>\'accountCode\' = $1) LIMIT 1', [String(ref)])).rows[0];
  const linked = String(r?.data?.glAccountCode || '').trim() || String(r?.data?.glAccount || '').trim();
  if (linked) return linked;
  const gl = (await db.query('SELECT code FROM gl_accounts WHERE code = $1 AND status = \'active\' AND category = \'Cash and Cash Equivalents\'', [String(ref)])).rows[0];
  return gl ? gl.code : null;
}

export const RESOLVERS = {
  bank_account: { label: 'Bank account of the receipt / payment (else the payment-mode cash account)',
    resolve: async (db, ctx) => ctx.accounts?.bank || (await bankAccountGl(db, ctx.bankAccount)) || cashAccountFor(ctx.paymentMode) },
  cash_by_payment_mode: { label: 'Cash account of the payment mode', resolve: async (db, ctx) => cashAccountFor(ctx.paymentMode) },
  payable_by_payee: { label: 'Payable account of the payee type', resolve: async (db, ctx) => payableAccountFor(ctx.payeeType || 'Insurer') },
  commission_vat_account: { label: 'GL account of the commission output VAT tax code (else the fallback role)',
    resolve: async (db, ctx, line) => (await commissionTaxAccount(db, 'vat')) || account(line.fallback_role || 'output_vat') },
  commission_ewt_account: { label: 'GL account of the commission EWT tax code (else the fallback role)',
    resolve: async (db, ctx, line) => (await commissionTaxAccount(db, 'ewt')) || account(line.fallback_role || 'creditable_wht') },
  write_off_reason: { label: 'GL account of the write-off reason',
    resolve: async (db, ctx, line) => {
      if (ctx.writeOffReason) {
        const r = (await db.query('SELECT gl_account FROM write_off_reasons WHERE (code = $1 OR id::text = $1) AND status = \'active\'', [String(ctx.writeOffReason)])).rows[0];
        if (!r) throw badRequest(`Write-off reason ${ctx.writeOffReason} is not an active reason`);
        return r.gl_account;
      }
      return account(line.fallback_role || 'write_off');
    } },
};

// ---------- rules ----------

const render = (tpl, vars) => String(tpl ?? '').replace(/\{\{(\w+)\}\}/g, (_, k) => (vars?.[k] === undefined || vars[k] === null ? '' : String(vars[k]))).trim();

const lineOut = (l) => ({ id: l.id, lineNo: l.line_no, side: l.side, accountType: l.account_type, account: l.account, fallbackRole: l.fallback_role,
  amountKey: l.amount_key, perParticipant: l.per_participant, narration: l.narration });

export const ruleOut = (r, lines) => ({
  id: r.id, eventCode: r.event_code, event: EVENTS[r.event_code]?.label || r.event_code, version: r.version, name: r.name, description: r.description, module: r.module,
  entryType: r.entry_type, source: r.source, narration: r.narration, branchSource: r.branch_source, effectiveFrom: r.effective_from instanceof Date ? r.effective_from.toISOString().slice(0, 10) : r.effective_from,
  active: r.active, approvalStatus: r.approval_status || 'approved', approvedBy: r.approved_by || null, approvedAt: r.approved_at || null, changeNote: r.change_note, createdBy: r.created_by, createdAt: r.created_at, updatedBy: r.updated_by, updatedAt: r.updated_at,
  lines: (lines || []).map(lineOut),
});

/** The rule in force for an event on a date (latest effective version that is active and approved). */
export async function activeRule(db, eventCode, date) {
  const r = (await db.query(`SELECT * FROM posting_rules WHERE event_code = $1 AND active AND approval_status = 'approved' AND effective_from <= $2::date
    ORDER BY effective_from DESC, version DESC LIMIT 1`, [eventCode, date])).rows[0];
  if (!r) throw notFound(`No active posting rule for event ${eventCode} on ${date}`);
  const lines = (await db.query('SELECT * FROM posting_rule_lines WHERE rule_id = $1 ORDER BY line_no', [r.id])).rows;
  return { rule: r, lines };
}

async function branchFor(db, rule, ctx, user) {
  if (ctx.branchCode !== undefined && ctx.branchCode !== null) return { branchCode: ctx.branchCode, departmentCode: ctx.departmentCode || null };
  const src = rule.branch_source;
  if (src === 'none' || src === 'context') return { branchCode: null, departmentCode: ctx.departmentCode || null };
  let u = null;
  if (src === 'policy_owner' && ctx.policyId) {
    u = (await db.query('SELECT u.branch_code, u.department FROM policies p JOIN users u ON u.id = p.owner_user_id WHERE p.id = $1', [ctx.policyId])).rows[0];
  }
  if (!u?.branch_code && user?.id) u = (await db.query('SELECT branch_code, department FROM users WHERE id = $1', [user.id])).rows[0];
  return { branchCode: u?.branch_code || null, departmentCode: ctx.departmentCode || u?.department || null };
}

async function resolveAccount(db, l, ctx, eventCode) {
  if (l.account_type === 'role') return account(l.account);
  if (l.account_type === 'gl') return String(l.account);
  if (l.account_type === 'context') {
    const v = ctx.accounts?.[l.account];
    if (v) return String(v);
    if (l.fallback_role) return account(l.fallback_role);
    throw badRequest(`Posting rule ${eventCode} line ${l.line_no}: the operation did not supply account "${l.account}"`);
  }
  const r = RESOLVERS[l.account];
  if (!r) throw badRequest(`Posting rule ${eventCode} line ${l.line_no}: unknown resolver ${l.account}`);
  return String(await r.resolve(db, ctx, l));
}

/**
 * Expand a rule into journal lines for a context. Returns { rule, lines, header } without writing anything.
 * lines: [{ accountCode, debit, credit, memo, insuranceCompanyId, branchCode, departmentCode }]
 */
export async function buildJournal(db, eventCode, ctx, { user = null, rule: given = null } = {}) {
  const date = ctx.date || (await today());
  const { rule, lines: ruleLines } = given || (await activeRule(db, eventCode, date));
  const vars = { ...(ctx.vars || {}) };
  const amounts = ctx.amounts || {};
  const parts = ctx.participants?.length ? ctx.participants : null;
  const { branchCode, departmentCode } = await branchFor(db, rule, ctx, user);
  const out = [];
  const push = async (l, amount, v, insurerId) => {
    let a = round2(amount);
    if (!a) return;
    let side = l.side;
    if (a < 0) { a = -a; side = side === 'Dr' ? 'Cr' : 'Dr'; }
    out.push({ accountCode: await resolveAccount(db, l, ctx, eventCode), debit: side === 'Dr' ? a : 0, credit: side === 'Cr' ? a : 0, memo: render(l.narration, v) || null,
      insuranceCompanyId: insurerId ?? null, branchCode, departmentCode, ruleLine: l.line_no });
  };
  for (const l of ruleLines) {
    if (l.per_participant && parts) {
      for (const p of parts) {
        const v = { ...vars, insurer: p.insurerName, participantSuffix: parts.length > 1 ? ` – ${p.insurerName}` : (vars.participantSuffix ?? '') };
        await push(l, p.amounts?.[l.amount_key] ?? 0, v, p.insurerId);
      }
    } else {
      await push(l, amounts[l.amount_key] ?? 0, vars, ctx.insuranceCompanyId);
    }
  }
  const header = {
    date, description: ctx.description || render(rule.narration, vars) || rule.name, source: ctx.source || rule.source || 'system', kind: ctx.kind,
    entryType: ctx.entryType || rule.entry_type, entrySubType: ctx.entrySubType ?? null, transactionCode: ctx.transactionCode, referenceType: ctx.referenceType,
    referenceId: ctx.referenceId, clientId: ctx.clientId, policyId: ctx.policyId, policyNumber: ctx.policyNumber, currency: ctx.currency, dueDate: ctx.dueDate,
    status: ctx.status, requiresApproval: ctx.requiresApproval, reversalOf: ctx.reversalOf, correctionOf: ctx.correctionOf,
  };
  return { rule, lines: out, header };
}

/**
 * Build the journal of an event from its active posting rule and post it (createJournal validates balance and accounts).
 * An event listed in accounting.parked_events is saved for approval instead (requires_approval: posted by another user).
 */
export async function postEvent(eventCode, ctx, { db, user = null }) {
  if (!EVENTS[eventCode]) throw badRequest(`Unknown posting event ${eventCode}`);
  const { rule, lines, header } = await buildJournal(db, eventCode, ctx, { user });
  const parked = !header.status && (await parksOnSave(eventCode)) ? { status: 'for-approval', requiresApproval: true } : {};
  const jv = await createJournal(db, { ...header, ...parked, lines }, user);
  await db.query('UPDATE journal_vouchers SET posting_rule_id = $2 WHERE id = $1', [jv.id, rule.id]);
  return jv;
}

/**
 * Simulate a rule (the active one, a given version or unsaved lines) against the event's sample context or a given one.
 * Returns the journal lines with account names and whether debits equal credits; nothing is written.
 */
export async function simulate(db, eventCode, { context = null, rule = null, coInsurance = false } = {}) {
  const ev = EVENTS[eventCode];
  if (!ev) throw badRequest(`Unknown posting event ${eventCode}`);
  const sample = context || (coInsurance && ev.sampleCoInsurance) || ev.sample;
  const ctx = { ...sample, date: sample.date || (await today()), branchCode: sample.branchCode ?? null };
  const built = await buildJournal(db, eventCode, ctx, { rule });
  const codes = [...new Set(built.lines.map((l) => l.accountCode))];
  const names = new Map((await db.query('SELECT code, name, status FROM gl_accounts WHERE code = ANY($1)', [codes])).rows.map((a) => [a.code, a]));
  const lines = built.lines.map((l, i) => ({ lineNo: i + 1, ruleLine: l.ruleLine, accountCode: l.accountCode, accountName: names.get(l.accountCode)?.name || null,
    accountValid: names.get(l.accountCode)?.status === 'active', debit: l.debit, credit: l.credit, memo: l.memo, insurer: l.insuranceCompanyId }));
  const totalDebit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(lines.reduce((s, l) => s + l.credit, 0));
  return { eventCode, description: built.header.description, context: ctx, lines, totalDebit, totalCredit, balanced: totalDebit === totalCredit && lines.length >= 2,
    invalidAccounts: lines.filter((l) => !l.accountValid).map((l) => l.accountCode) };
}

/** Whether premium taxes are booked in their own accounts (accounting.split_premium_taxes). */
export const splitTaxes = async () => (await getSetting('accounting.split_premium_taxes', true)) !== false;
