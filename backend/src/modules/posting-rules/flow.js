/**
 * Accounting flow (Master > Finance > Accounting Flow): for every business event, the screen or action that triggers
 * it, the approval that comes before the posting, and the debit and credit lines of the posting rule in force, with the
 * GL accounts the lines resolve to today. Built from the live rules, so it follows every approved rule change.
 */
import { ALWAYS_POSTED, EVENTS, RESOLVERS, activeRule, parksOnSave } from '../accounting/lib/posting.js';
import { today } from '../accounting/lib/http.js';
import { commissionTaxAccount } from '../accounting/lib/commissionTax.js';

/** Where each event comes from and what is approved before it posts. */
export const EVENT_FLOW = {
  'policy.issue.broker_billed': { trigger: 'Policy issued (quotation converted, placement or recorded policy), broker billed', approval: 'None: posted when the policy is issued' },
  'endorsement.additional_premium': { trigger: 'Operations > Endorsements: endorsement with additional premium completed', approval: 'None: posted when the endorsement is completed' },
  'policy.renewal.broker_billed': { trigger: 'Operations > Renewals: renewal term issued, broker billed', approval: 'Renewal terms approval, where configured' },
  'endorsement.return_premium': { trigger: 'Operations > Endorsements: endorsement with return premium completed', approval: 'None: posted when the endorsement is completed' },
  'policy.cancel': { trigger: 'Operations > Endorsements: cancellation completed', approval: 'None: posted when the cancellation is completed' },
  'receipt.apply': { trigger: 'Accounts > Receipts: official receipt applied to a bill, or a verified payment capture', approval: 'Finance only (write:receipts)' },
  'directbill.commission': { trigger: 'Direct-bill policy issued or endorsed with additional premium', approval: 'None: commission booked at issue' },
  'directbill.commission_return': { trigger: 'Direct-bill policy with return premium or cancellation', approval: 'None' },
  'commission.billing_statement': { trigger: 'Accounts > Remittance > Direct Bill Processing: commission billing statement of gross-remittance business approved (reversed when an approved statement is cancelled)', approval: 'The statement is approved by a second user' },
  'directbill.collection': { trigger: 'Accounts > Remittance > Direct Bill Processing: insurer payment recorded on a debit note', approval: 'The debit note is approved by a second user before it can be collected' },
  'commission.approve': { trigger: 'Commission: comsub of an agent or referrer approved', approval: 'Maker-checker (finance.maker_checker_enabled)' },
  'commission.payout': { trigger: 'Accounts > Disbursement: comsub payment voucher paid', approval: 'Cheque approved by a user other than the voucher maker' },
  'commission.clawback': { trigger: 'Return premium or cancellation after the comsub was paid', approval: 'None' },
  'disbursement.payment': { trigger: 'Accounts > Disbursement: cheque of a payment voucher approved (insurer remittance, refunds, suppliers)', approval: 'Cheque approved by a user other than the voucher maker' },
  'pettycash.fund': { trigger: 'Accounts > Petty Cash: fund established', approval: 'Petty cash approval' },
  'pettycash.disbursement': { trigger: 'Accounts > Petty Cash: disbursement recorded', approval: 'Petty cash request approval' },
  'pettycash.receipt': { trigger: 'Accounts > Petty Cash: unused cash returned', approval: 'None' },
  'pettycash.replenishment': { trigger: 'Accounts > Petty Cash: fund replenished', approval: 'Replenishment approval' },
  write_off: { trigger: 'Accounts > Open Entry Matching: small debit balance written off', approval: 'Within the limit of the write-off reason' },
  'write_off.credit_balance': { trigger: 'Accounts > Open Entry Matching: small credit balance written off', approval: 'Within the limit of the write-off reason' },
  'claim.settlement.paid_through_broker': { trigger: 'Claims: settlement paid through the broker', approval: 'Claim settlement approval' },
  'claim.funds_received': { trigger: 'Claims: settlement funds received from the insurer', approval: 'None' },
  'claim.paid_to_claimant': { trigger: 'Claims: settlement paid to the claimant', approval: 'Claim settlement approval' },
  'ap.invoice': { trigger: 'Accounts > Payables: supplier invoice approved', approval: 'Approval by another user with approve:payables (payables.maker_checker)' },
  'ap.payment': { trigger: 'Accounts > Payables: supplier payment posted', approval: 'None: the invoices paid are approved' },
  'fa.depreciation': { trigger: 'Accounts > Fixed Assets: depreciation run, or the depreciation step of the month-end close', approval: 'Month-end close approval, where configured' },
  'fa.disposal': { trigger: 'Accounts > Fixed Assets > Disposals: asset sold or written off (reversed when the disposal is cancelled)', approval: 'None: write:fixed-assets' },
  'remittance.settlement': { trigger: 'Accounts > Remittance > Settlement approved (credit / debit notes)', approval: 'Remittance approval queue: levels by amount, not the maker' },
  'remittance.adjustment': { trigger: 'Accounts > Remittance > Adjustments approved', approval: 'Remittance approval queue: levels by amount, not the maker' },
  'remittance.transfer': { trigger: 'Accounts > Remittance > Electronic transfer approved', approval: 'Remittance approval queue: levels by amount, not the maker' },
  'insurer.refund_due': { trigger: 'Return premium or cancellation on premium already remitted to the insurer', approval: 'None' },
  'insurer.refund_applied': { trigger: 'Insurer payment voucher raised: refunds due from the insurer netted', approval: 'None (the voucher itself is approved at cheque stage)' },
  'insurer_statement.adjustment': { trigger: 'Accounts > Insurer Reconciliation: reconciliation approved with adjustments', approval: 'Accounting Manager (approve:insurer-reconciliation), not the preparer' },
  'incentive.accrual': { trigger: 'Incentive: calculated incentives approved', approval: 'Maker-checker (not the calculating user)' },
  'incentive.payout': { trigger: 'Incentive: approved incentives paid', approval: 'None' },
  'sales_invoice.issue': { trigger: 'Accounts > Tax > Sales Invoices: manual service invoice issued (cancellation reverses it)', approval: 'None: the invoice is issued by Accounting (write:period-end)' },
  'sales_invoice.payment': { trigger: 'Accounts > Tax > Sales Invoices: payment recorded on a manual invoice (payment acknowledgement)', approval: 'None' },
  'override_commission.accrual': { trigger: 'Commission > Insurer Overrides > Computations: computation approved', approval: 'Maker-checker (commission.override_requires_approval): not the preparer' },
  'override_commission.settlement': { trigger: 'Commission > Insurer Overrides > Computations: settlement recorded against the insurer statement', approval: 'None (the computation was approved)' },
};

function describeAccount(l, roles, gl, taxGl) {
  const glOf = (code) => (code ? { glCode: code, glName: gl.get(code) || null } : { glCode: null, glName: null });
  if (l.account_type === 'role') return { kind: 'role', label: roles.get(l.account)?.label || l.account, role: l.account, ...glOf(roles.get(l.account)?.gl) };
  if (l.account_type === 'gl') return { kind: 'gl', label: gl.get(l.account) || l.account, ...glOf(l.account) };
  const fallback = l.fallback_role ? { role: l.fallback_role, ...glOf(roles.get(l.fallback_role)?.gl) } : { glCode: null, glName: null };
  // the commission tax resolvers post to the tax code's own account when it has one
  if (l.account_type === 'resolver' && taxGl[l.account]) return { kind: 'resolver', label: RESOLVERS[l.account]?.label || l.account, resolver: l.account, ...glOf(taxGl[l.account]) };
  if (l.account_type === 'resolver') return { kind: 'resolver', label: RESOLVERS[l.account]?.label || l.account, resolver: l.account, ...fallback };
  return { kind: 'context', label: `Account supplied by the operation (${l.account})`, contextKey: l.account, ...fallback };
}

/** Every event with its trigger, approval and the debit / credit lines of the rule in force today. */
export async function accountingFlow(db) {
  const date = await today();
  const roles = new Map((await db.query(`SELECT substr(key, 20) AS role, value #>> '{}' AS gl, label FROM app_settings WHERE key LIKE 'accounting.account.%'`)).rows
    .map((r) => [r.role, { gl: r.gl, label: String(r.label || '').replace(/^GL:\s*/, '') }]));
  const gl = new Map((await db.query('SELECT code, name FROM gl_accounts')).rows.map((a) => [a.code, a.name]));
  const taxGl = { commission_vat_account: await commissionTaxAccount(db, 'vat'), commission_ewt_account: await commissionTaxAccount(db, 'ewt') };
  const out = [];
  for (const [code, ev] of Object.entries(EVENTS)) {
    let current = null;
    try { current = await activeRule(db, code, date); } catch { current = null; }
    const lines = [];
    for (const l of current?.lines || []) {
      lines.push({ lineNo: l.line_no, side: l.side, amountKey: l.amount_key, perParticipant: l.per_participant, narration: l.narration, account: describeAccount(l, roles, gl, taxGl) });
    }
    const flow = EVENT_FLOW[code] || { trigger: `${ev.module} module`, approval: 'Not documented' };
    // posting: parked on save until another user approves (accounting.parked_events), or posted at once
    out.push({ eventCode: code, label: ev.label, module: ev.module, trigger: flow.trigger, approval: flow.approval, posting: (await parksOnSave(code)) ? 'parked' : 'posted',
      alwaysPosted: ALWAYS_POSTED[code] || null, ruleId: current?.rule.id || null, version: current?.rule.version || null,
      description: current?.rule.description || null, debits: lines.filter((l) => l.side === 'Dr'), credits: lines.filter((l) => l.side === 'Cr') });
  }
  return { asOf: date, events: out };
}
