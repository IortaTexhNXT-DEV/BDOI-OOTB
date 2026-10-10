/**
 * Accounting flow (Master > Finance > Accounting Flow): the Finance accounting reference. For every business event,
 * grouped by module in the order of the accounting cycle: what triggers it and on which screen, the approval before it
 * posts (worded from the settings in force), whether its journal posts at once, and the debit / credit lines of the
 * posting rule in force with the GL accounts they resolve to today. Built from the live rules and accounts, so it
 * follows every approved change; pending and scheduled changes are shown as such.
 *
 * An account a line posts to is "mapping pending" when it is provisional (accounting.provisional_accounts), outside the
 * chart the SAP GL file accepts (sap_gl.account_pattern) or inactive / missing. The journals the system builds without a
 * posting rule (bank reconciliation adjustments, month-end deferral and FX revaluation, year-end closing) are listed as
 * fixed entries with their account roles.
 */
import { createHash } from 'node:crypto';
import { ALWAYS_POSTED, EVENTS, RESOLVERS, simulate } from '../accounting/lib/posting.js';
import { today } from '../accounting/lib/http.js';
import { commissionTaxSetup } from '../accounting/lib/commissionTax.js';
import { getSetting } from '../../lib/settings.js';
import { conflict, notFound } from '../../lib/errors.js';
import { round2 } from '../../lib/money.js';
import { CHANGE_LABELS, ROLE_SECTIONS, configurationReview } from './service.js';

/** Modules of the reference, in the order of the accounting cycle (one source for grouping and order). */
export const AREAS = [
  { code: 'premium', name: 'Premium billing', events: ['policy.issue.broker_billed', 'policy.renewal.broker_billed', 'endorsement.additional_premium', 'endorsement.return_premium', 'policy.cancel'] },
  { code: 'collections', name: 'Collections', events: ['receipt.apply'] },
  { code: 'remittance', name: 'Remittance to insurers', events: ['remittance.settlement', 'remittance.adjustment', 'remittance.transfer', 'insurer_statement.adjustment', 'insurer.refund_due', 'insurer.refund_applied'] },
  { code: 'direct-bill', name: 'Direct-bill commission', events: ['directbill.commission', 'directbill.commission_return', 'commission.billing_statement', 'directbill.collection'] },
  { code: 'overrides', name: 'Overriding commission', events: ['override_commission.accrual', 'override_commission.settlement'] },
  { code: 'comsub', name: 'Agent and referrer commission', events: ['commission.approve', 'commission.payout', 'commission.clawback'] },
  { code: 'incentives', name: 'Incentives', events: ['incentive.accrual', 'incentive.payout'] },
  { code: 'claims', name: 'Claims', events: ['claim.settlement.paid_through_broker', 'claim.funds_received', 'claim.paid_to_claimant'] },
  { code: 'payments', name: 'Payments and payables', events: ['disbursement.payment', 'ap.invoice', 'ap.payment'] },
  { code: 'petty-cash', name: 'Petty cash', events: ['pettycash.fund', 'pettycash.disbursement', 'pettycash.receipt', 'pettycash.replenishment'] },
  { code: 'sales-invoices', name: 'Sales invoices', events: ['sales_invoice.issue', 'sales_invoice.payment'] },
  { code: 'write-offs', name: 'Write-offs', events: ['write_off', 'write_off.credit_balance'] },
  { code: 'fixed-assets', name: 'Fixed assets', events: ['fa.depreciation', 'fa.disposal'] },
  { code: 'system', name: 'Other system journals', events: ['bank.adjustment', 'period_close.commission_deferral', 'period_close.fx_revaluation', 'year_end.closing'] },
];

/** Amounts in business words; EVENT_FLOW[event].amounts overrides a wording for one event. */
export const AMOUNT_WORDING = {
  gross: 'Gross premium billed to the client', due_to_insurer: 'Premium due to the insurer', net_premium: 'Net premium',
  vat: 'VAT on the premium', dst: 'Documentary stamp tax on the premium', lgt: 'Local government tax on the premium',
  commission: 'Brokerage commission', commission_vat: 'Output VAT on the brokerage commission',
  commission_ewt: 'Withholding tax the insurer deducts from the commission (BIR 2307)',
  receivable_credit: 'Part of the return premium credited to the unpaid bill', refund: 'Part of the return premium refunded to the client',
  amount: 'Amount', cash: 'Amount received', ewt: 'Withholding tax deducted (BIR 2307)', applied: 'Amount settled', gross_premium: 'Gross premium',
  adjustments: 'Net credit and debit notes of the settlement', net: 'Net amount', wht: 'Withholding tax deducted', payable: 'Payable settled',
  premium: 'Premium difference with the insurer statement', receivable: 'Receivable', income: 'Income net of VAT', difference: 'Difference with the statement',
  net_of_vat: 'Expense net of VAT', cost: 'Cost of the asset removed', accumulated: 'Accumulated depreciation removed', gain: 'Gain on disposal', loss: 'Loss on disposal',
};

const DUE_FORMULA = 'Gross premium − brokerage commission − premium taxes booked separately − output VAT on the commission + withholding tax on the commission';
const PREMIUM = { amounts: {}, formulas: { due_to_insurer: DUE_FORMULA } };
const RETURN = {
  amounts: { due_to_insurer: 'Return premium no longer due to the insurer', vat: 'VAT on the return premium', dst: 'Documentary stamp tax on the return premium',
    lgt: 'Local government tax on the return premium', commission: 'Brokerage commission returned', commission_vat: 'Output VAT on the commission returned',
    commission_ewt: 'Withholding tax on the commission returned' },
};
const INSURER = ['Insurer'];
const FINANCE_CHECK = { setting: 'finance.maker_checker_enabled', name: 'Maker-checker on finance documents' };
const VOUCHER = { text: 'Cheque approved by a user other than the voucher maker' };
const REMITTANCE = { text: 'Remittance approval by amount level, never by the maker' };

/**
 * Where each event comes from and what is approved before it posts.
 * when: the business trigger; screen / where: the screen that triggers it (route and menu trail); approval: { text } or
 * a control { setting, name, on, off } worded from the setting in force; authority: the authority matrix transaction
 * type the approval step checks; payeeTypes: the payee types of the payable map the event uses; amounts / formulas:
 * the wording of its amounts where it differs from AMOUNT_WORDING.
 */
export const EVENT_FLOW = {
  'policy.issue.broker_billed': { when: 'A broker-billed policy is issued: quotation converted, placement confirmed or policy recorded', screen: '/agent/policy', where: 'Operations › Policy',
    approval: { text: 'None: posted when the policy is issued' }, ...PREMIUM },
  'policy.renewal.broker_billed': { when: 'The renewal term of a broker-billed policy is issued', screen: '/renewal/queue', where: 'Operations › Renewals › Renewal Queue',
    approval: { setting: 'renewals.maker_checker', name: 'Approval of renewal terms', on: 'Renewal terms approved by a second user', off: 'None: renewal terms are issued without a second approval' }, ...PREMIUM },
  'endorsement.additional_premium': { when: 'An endorsement with additional premium is completed', screen: '/agent/policy', where: 'Operations › Policy',
    approval: { text: 'None: posted when the endorsement is completed' }, ...PREMIUM },
  'endorsement.return_premium': { when: 'An endorsement with return premium is completed', screen: '/agent/policy', where: 'Operations › Policy',
    approval: { text: 'None: posted when the endorsement is completed' }, ...RETURN },
  'policy.cancel': { when: 'A policy cancellation is completed', screen: '/operations/policy-cancellation', where: 'Operations › Policy Cancellation',
    approval: { text: 'None: posted when the cancellation is completed' }, ...RETURN },
  'receipt.apply': { when: 'An official receipt is applied to a bill, or a verified payment is captured', screen: '/accounts/receipts', where: 'Accounts › Receipts',
    approval: { text: 'None: posted when the receipt is applied' }, amounts: { amount: 'Amount of the receipt applied to the bill' } },
  'remittance.settlement': { when: 'A remittance settlement with credit or debit notes is approved', screen: '/finance/remittance/settlement/process', where: 'Accounts › Remittance › Settlement',
    approval: REMITTANCE, authority: 'remittance_settlement', payeeTypes: INSURER, amounts: { net: 'Net amount of the settlement' } },
  'remittance.adjustment': { when: 'A remittance adjustment is approved', screen: '/finance/remittance/adjustments', where: 'Accounts › Remittance › Adjustments',
    approval: REMITTANCE, authority: 'remittance_settlement', payeeTypes: INSURER, amounts: { amount: 'Adjustment amount (a negative amount reverses the sides)' } },
  'remittance.transfer': { when: 'An electronic transfer to the insurer is approved', screen: '/finance/remittance/electronictransfer', where: 'Accounts › Remittance › Electronic Transfer',
    approval: REMITTANCE, authority: 'remittance_settlement', payeeTypes: INSURER, amounts: { amount: 'Amount transferred to the insurer' } },
  'insurer_statement.adjustment': { when: 'An insurer statement reconciliation is approved with adjustments', screen: '/accounts/insurer-reconciliation/statements',
    where: 'Accounts › Insurer Reconciliation › Insurer Statements', approval: { text: 'Approved by a user with reconciliation approval, not the preparer' }, payeeTypes: INSURER,
    amounts: { premium: 'Premium difference with the insurer statement (signed)', commission: 'Commission difference with the insurer statement (signed)' } },
  'insurer.refund_due': { when: 'A return premium or cancellation concerns premium already remitted to the insurer', screen: '/agent/policy', where: 'Operations › Policy',
    approval: { text: 'None: posted with the return premium' },
    amounts: { amount: 'Refund due from the insurer', due_to_insurer: 'Premium already remitted', vat: 'VAT on the premium already remitted', dst: 'Documentary stamp tax already remitted',
      lgt: 'Local government tax already remitted' } },
  'insurer.refund_applied': { when: 'A payment voucher to the insurer nets the refunds it owes', screen: '/accounts/paymentvoucher', where: 'Accounts › Disbursement',
    approval: { text: 'None: the voucher is approved at cheque release' },
    amounts: { amount: 'Refund netted with the insurer', due_to_insurer: 'Premium payable netted', vat: 'VAT on the premium netted', dst: 'Documentary stamp tax netted', lgt: 'Local government tax netted' } },
  'directbill.commission': { when: 'A direct-bill policy is issued or endorsed with additional premium', screen: '/agent/policy', where: 'Operations › Policy',
    approval: { text: 'None: commission booked at issue' }, amounts: { amount: 'Commission and VAT billed to the insurer', vat: 'Output VAT on the commission' } },
  'directbill.commission_return': { when: 'A direct-bill policy has a return premium or is cancelled', screen: '/agent/policy', where: 'Operations › Policy',
    approval: { text: 'None: posted with the return premium' }, amounts: { amount: 'Commission and VAT returned to the insurer', commission: 'Brokerage commission returned', vat: 'Output VAT on the commission returned' } },
  'commission.billing_statement': { when: 'A commission billing statement of gross-remittance business is approved; cancelling it reverses the journal', screen: '/finance/remittance/directbill',
    where: 'Accounts › Remittance › Direct Bill Processing', approval: { text: 'Statement approved by a second user' }, amounts: { amount: 'Statement total', vat: 'Output VAT on the commission' } },
  'directbill.collection': { when: 'The insurer\'s payment is recorded against a debit note', screen: '/finance/remittance/directbill', where: 'Accounts › Remittance › Direct Bill Processing',
    approval: { text: 'Debit note approved by a second user before collection' },
    amounts: { cash: 'Amount received from the insurer', ewt: 'Withholding tax deducted by the insurer (BIR 2307)', applied: 'Debit note amount settled' } },
  'override_commission.accrual': { when: 'An overriding commission computation is approved', screen: '/commission/insurer-overrides/computations', where: 'Commission › Insurer Overrides › Computations',
    approval: { setting: 'commission.override_requires_approval', name: 'Approval of overriding commission computations', on: 'Approved by a user other than the preparer', off: 'None: the computation posts when it is saved' },
    amounts: { receivable: 'Receivable with VAT', commission: 'Overriding commission', vat: 'Output VAT on the overriding commission' } },
  'override_commission.settlement': { when: 'The insurer\'s settlement is recorded against the computation', screen: '/commission/insurer-overrides/computations', where: 'Commission › Insurer Overrides › Computations',
    approval: { text: 'None: the computation was approved' }, amounts: { applied: 'Computation settled', ewt: 'Withholding tax deducted by the insurer (BIR 2307)' } },
  'commission.approve': { when: 'The commission of an agent or referrer is approved', screen: '/commission/referrer-accounts', where: 'Commission › Agents/Referrer Accounts',
    approval: { ...FINANCE_CHECK, on: 'Approved by a user other than the maker', off: 'None: the maker may approve' }, amounts: { amount: 'Comsub approved' } },
  'commission.payout': { when: 'The cheque of the comsub payment voucher is approved', screen: '/accounts/paymentvoucher', where: 'Accounts › Disbursement',
    approval: VOUCHER, authority: 'payment_voucher', amounts: { gross: 'Comsub payable settled', net: 'Amount paid', wht: 'Withholding tax deducted' } },
  'commission.clawback': { when: 'A return premium or cancellation arrives after the comsub was paid', screen: '/agent/policy', where: 'Operations › Policy',
    approval: { text: 'None: posted with the return premium' }, amounts: { amount: 'Comsub recovered from the agent or referrer' } },
  'incentive.accrual': { when: 'Calculated incentives are approved', screen: '/incentive/approvals', where: 'Accounts › Incentive › Approvals',
    approval: { text: 'Approved by a user other than the one who calculated them' }, amounts: { amount: 'Incentives approved' } },
  'incentive.payout': { when: 'Approved incentives are paid', screen: '/incentive/approvals', where: 'Accounts › Incentive › Approvals',
    approval: { text: 'None: the incentives were approved' }, amounts: { amount: 'Incentives paid' } },
  'claim.settlement.paid_through_broker': { when: 'A claim settlement paid through the broker is approved', screen: '/agent/claim', where: 'Operations › Claims',
    approval: { setting: 'claims.settlement_maker_checker', name: 'Approval of claim settlements', on: 'Settlement approved by a second user', off: 'None: the settlement posts when it is saved' },
    authority: 'claim_settlement', amounts: { amount: 'Settlement amount (each insurer\'s share)' } },
  'claim.funds_received': { when: 'The settlement funds are received from the insurer', screen: '/accounts/claims-settlements', where: 'Accounts › Claims Settlements',
    approval: { text: 'None: the settlement was approved' }, amounts: { amount: 'Funds received from the insurer' } },
  'claim.paid_to_claimant': { when: 'The settlement is paid to the claimant', screen: '/accounts/claims-settlements', where: 'Accounts › Claims Settlements',
    approval: { text: 'None: the settlement was approved' }, amounts: { amount: 'Amount paid to the claimant' } },
  'disbursement.payment': { when: 'The cheque of a payment voucher is approved (insurer remittance, client refunds, suppliers)', screen: '/accounts/paymentvoucher', where: 'Accounts › Disbursement',
    approval: VOUCHER, authority: 'payment_voucher',
    amounts: { payable: 'Payable settled', vat: 'VAT on the premium remitted', dst: 'Documentary stamp tax remitted', lgt: 'Local government tax remitted', amount: 'Amount paid' } },
  'ap.invoice': { when: 'A supplier invoice is approved', screen: '/accounts/payables/invoices', where: 'Accounts › Payables › Supplier Invoices',
    approval: { setting: 'payables.maker_checker', name: 'Approval of supplier invoices', on: 'Approved by a second user', off: 'None: the invoice posts when it is saved' },
    amounts: { net: 'Invoice amount net of VAT (split over the invoice\'s expense accounts)', vat: 'Input VAT', ewt: 'Withholding tax deducted', payable: 'Amount payable to the supplier' } },
  'ap.payment': { when: 'A supplier payment is posted', screen: '/accounts/payables/payments', where: 'Accounts › Payables › Supplier Payments',
    approval: { text: 'None: the invoices paid were approved' }, amounts: { amount: 'Amount paid to the supplier' } },
  'pettycash.fund': { when: 'A petty cash fund is established', screen: '/accounts/pettycash/pettycashcodeinitiate', where: 'Accounts › Petty Cash › Initiate',
    approval: { text: 'Approved by a user other than the maker' }, amounts: { amount: 'Fund amount' } },
  'pettycash.disbursement': { when: 'A petty cash disbursement is recorded', screen: '/accounts/pettycash/disbursement', where: 'Accounts › Petty Cash › Disbursement',
    approval: { text: 'Petty cash request approved by a user other than the maker; within the fund limit' },
    amounts: { vat: 'Input VAT', net: 'Cash paid out of the fund', wht: 'Withholding tax deducted' } },
  'pettycash.receipt': { when: 'Unused cash is returned to the fund', screen: '/accounts/pettycash/receipts', where: 'Accounts › Petty Cash › Receipts',
    approval: { text: 'None' }, amounts: { amount: 'Unused cash returned' } },
  'pettycash.replenishment': { when: 'The fund is replenished', screen: '/accounts/pettycash/replenish', where: 'Accounts › Petty Cash › Replenish',
    approval: { text: 'Replenishment approved' }, amounts: { amount: 'Replenishment' } },
  'sales_invoice.issue': { when: 'A manual service invoice is issued; cancelling it reverses the journal', screen: '/accounts/tax/sales-invoices', where: 'Accounts › Tax › Sales Invoices',
    approval: { text: 'None: issued by Accounting' }, amounts: { receivable: 'Invoice total', income: 'Service fee net of VAT', vat: 'Output VAT' } },
  'sales_invoice.payment': { when: 'A payment is recorded on a manual invoice (payment acknowledgement)', screen: '/accounts/tax/sales-invoices', where: 'Accounts › Tax › Sales Invoices',
    approval: { text: 'None' }, amounts: { ewt: 'Withholding tax deducted by the buyer (BIR 2307)', applied: 'Invoice amount settled' } },
  write_off: { when: 'A small debit balance is written off when open items are matched', screen: '/accounts/open-entry-matching', where: 'Accounts › Open Entry Matching',
    approval: { text: 'None: within the limit of the write-off reason' }, amounts: { amount: 'Balance written off' } },
  'write_off.credit_balance': { when: 'A small credit balance is written off when open items are matched', screen: '/accounts/open-entry-matching', where: 'Accounts › Open Entry Matching',
    approval: { text: 'None: within the limit of the write-off reason' }, amounts: { amount: 'Balance written off' } },
  'fa.depreciation': { when: 'The depreciation is run from Fixed Assets or as a step of the month-end close', screen: '/accounts/fixed-assets/depreciation', where: 'Accounts › Fixed Assets › Depreciation Run',
    approval: { setting: 'accounting.period_close_requires_approval', name: 'Approval of the month-end close', on: 'None from the run; approved with the month-end close when run as a close step',
      off: 'None' }, amounts: { amount: 'Depreciation of the month' } },
  'fa.disposal': { when: 'A fixed asset is sold or written off; cancelling the disposal reverses it', screen: '/accounts/fixed-assets/disposals', where: 'Accounts › Fixed Assets › Disposals',
    approval: { text: 'None: posted when the disposal is saved' }, amounts: { receivable: 'Sale proceeds receivable', vat: 'Output VAT on the sale' } },
};

/** Where a transaction-supplied account (context line) comes from, in business words; per event where it differs. */
const CONTEXT_SOURCES = {
  expense: 'Expense account of the transaction', vat: 'VAT account of the transaction', ewt: 'Withholding tax account of the transaction', wht: 'Withholding tax account of the transaction',
  fund: 'GL account of the petty cash fund', credit: 'Account credited on the return', open_item: 'Account of the open item written off', income: 'Income account of the invoice line',
  commission_offset: 'Commission account of the statement line', asset: 'Asset account of the asset class', accumulated: 'Accumulated depreciation account of the asset class',
  proceeds: 'Receivable account of the sale',
};
const CONTEXT_BY_EVENT = {
  'ap.invoice': { expense: 'Expense accounts of the supplier invoice', vat: 'Input VAT account of the invoice', ewt: 'Withholding tax account of the invoice' },
  'pettycash.disbursement': { expense: 'Expense account of the petty cash voucher', vat: 'Input VAT account of the voucher', wht: 'Withholding tax account of the voucher' },
  'fa.depreciation': { expense: 'Depreciation expense account of the asset class' },
};

const PREMIUM_TAX_EVENTS = ['policy.issue.broker_billed', 'policy.renewal.broker_billed', 'endorsement.additional_premium', 'endorsement.return_premium', 'policy.cancel',
  'insurer.refund_due', 'insurer.refund_applied', 'disbursement.payment'];
/** Lines that post only while a setting is on: premium taxes booked separately and the taxes on broker-billed commission. */
export const LINE_CONDITIONS = {
  premiumTaxes: { setting: 'accounting.split_premium_taxes', name: 'Premium taxes booked separately', keys: ['vat', 'dst', 'lgt'], events: PREMIUM_TAX_EVENTS },
  commissionVat: { setting: 'accounting.broker_billed_commission_vat', name: 'Output VAT on brokerage commission', keys: ['commission_vat'] },
  commissionEwt: { setting: 'accounting.broker_billed_commission_ewt', name: 'Withholding tax on brokerage commission', keys: ['commission_ewt'] },
};
const conditionOf = (eventCode, key) => Object.values(LINE_CONDITIONS).find((c) => c.keys.includes(key) && (!c.events || c.events.includes(eventCode))) || null;

/** Journals the system builds without a posting rule: fixed entries whose accounts come from account roles. */
export const SYSTEM_JOURNALS = [
  { eventCode: 'bank.adjustment', label: 'Bank reconciliation adjustment', summary: 'Bank charges, interest, final tax and other items found on the bank statement and booked from it.',
    when: 'A bank charge, interest or other adjustment is posted from the bank statement', screen: '/accounts/bank-reconciliation', where: 'Accounts › Bank Reconciliation › Reconciliation Workspace',
    approval: { text: 'Approved by a second user when the bank transaction type requires it' }, lines: [
      { side: 'Dr', source: 'Account of the bank transaction type', options: ['bank_charges', 'final_tax_interest'], amount: 'Bank charge or final tax (money out of the bank)' },
      { side: 'Cr', source: 'GL cash account of the bank account', fallback: 'cash_in_bank', amount: 'Bank charge or final tax (money out of the bank)' },
      { side: 'Dr', source: 'GL cash account of the bank account', fallback: 'cash_in_bank', amount: 'Interest or other credit (money into the bank)' },
      { side: 'Cr', source: 'Account of the bank transaction type', options: ['interest_income'], amount: 'Interest or other credit (money into the bank)' }] },
  { eventCode: 'period_close.commission_deferral', label: 'Unearned commission deferral', summary: 'Commission earned on cover that runs past the month end is deferred pro rata by days and reversed on the first day of the next month.',
    when: 'The month-end close runs, for policies whose cover runs past the month end; reversed on the first day of the next month', screen: '/accounts/period-end/close',
    where: 'Accounts › Period End › Month-End Close', approval: { setting: 'accounting.period_close_requires_approval', name: 'Approval of the month-end close', on: 'Approved with the month-end close', off: 'None' },
    condition: { setting: 'accounting.defer_commission', name: 'Deferral of unearned commission', default: false }, lines: [
      { side: 'Dr', role: 'commission_income', amount: 'Commission relating to the days after the month end' },
      { side: 'Cr', role: 'unearned_commission', amount: 'Commission relating to the days after the month end' }] },
  { eventCode: 'period_close.fx_revaluation', label: 'Unrealised FX revaluation', summary: 'Foreign-currency balances restated at the month-end rate of the Exchange Rate master; reversed on the next day.',
    when: 'The month-end close runs and foreign-currency balances exist; reversed on the next day', screen: '/accounts/period-end/close', where: 'Accounts › Period End › Month-End Close',
    approval: { setting: 'accounting.period_close_requires_approval', name: 'Approval of the month-end close', on: 'Approved with the month-end close', off: 'None' }, lines: [
      { side: 'Dr', source: 'Foreign-currency asset or liability account', amount: 'Increase of the balance at the month-end rate' },
      { side: 'Cr', role: 'fx_unrealised_gain', amount: 'Increase of the balance at the month-end rate' },
      { side: 'Dr', role: 'fx_unrealised_loss', amount: 'Decrease of the balance at the month-end rate' },
      { side: 'Cr', source: 'Foreign-currency asset or liability account', amount: 'Decrease of the balance at the month-end rate' }] },
  { eventCode: 'year_end.closing', label: 'Year-end closing', summary: 'Income and expense accounts are closed to current year profit or loss, which is then transferred to retained earnings.',
    when: 'The year-end close of the fiscal year is run', screen: '/accounts/period-end/year-end', where: 'Accounts › Period End › Year-End Close',
    approval: { text: 'Year-end close run by Finance after its checks pass' }, lines: [
      { side: 'Dr', source: 'Each income account', amount: 'Income of the year' },
      { side: 'Cr', role: 'current_year_pl', amount: 'Net income of the year' },
      { side: 'Dr', role: 'current_year_pl', amount: 'Net income of the year' },
      { side: 'Cr', role: 'retained_earnings', amount: 'Net income of the year' },
      { side: 'Cr', source: 'Each expense account', amount: 'Expenses of the year' }] },
];

const SECTION_NAMES = { premium: 'Premium', customer: 'Customer', miscellaneous: 'Miscellaneous', claims: 'Claims' };
const SECTION_ROUTES = { premium: '/master/finance/premium-account-setup', customer: '/master/finance/customer-account-setup',
  miscellaneous: '/master/finance/miscellaneous-account-setup', claims: '/master/finance/ri-claim-account-setup' };
export const DETERMINATION = '/master/finance/account-determination';
const TAXATION = '/master/finance/taxation';
const PAYMENT_MODES = { cash: 'Cash', check: 'Cheque', 'bank-transfer': 'Bank transfer', card: 'Card', gcash: 'GCash', online: 'Online payment' };
const POSTING_TEXT = { posted: 'Posted at once', parked: 'Waits for approval', pending: 'Saved as pending' };
export const MAPPING_TEXT = { provisional: 'Provisional account', 'outside-chart': 'Outside the chart', inactive: 'Inactive or missing account' };
const sectionOf = (role) => Object.entries(ROLE_SECTIONS).find(([, roles]) => roles.includes(role))?.[0] || 'other';
const sentence = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : d || null);
/** "GL: Cash in bank (default collection / disbursement account)" -> "Cash in bank". */
const roleLabel = (label, role) => sentence(String(label || '').replace(/^GL( account)?:\s*/i, '').replace(/\s*\([^)]*\)\s*$/, '').trim()) || role;
const wordingOf = (eventCode, key) => EVENT_FLOW[eventCode]?.amounts?.[key] || AMOUNT_WORDING[key] || sentence(String(key).replace(/_/g, ' '));

/** Everything the reference reads, one query per table. */
async function loadSources(db, date) {
  const roles = new Map((await db.query(`SELECT substr(key, 20) AS role, value #>> '{}' AS gl, label FROM app_settings WHERE key LIKE 'accounting.account.%'`)).rows
    .map((r) => [r.role, { gl: r.gl, label: roleLabel(r.label, r.role) }]));
  const gl = new Map((await db.query('SELECT code, name, status FROM gl_accounts')).rows.map((a) => [a.code, a]));
  const rules = (await db.query(`SELECT DISTINCT ON (event_code) * FROM posting_rules WHERE active AND approval_status = 'approved' AND effective_from <= $1::date
    ORDER BY event_code, effective_from DESC, version DESC`, [date])).rows;
  const lines = rules.length ? (await db.query('SELECT * FROM posting_rule_lines WHERE rule_id = ANY($1) ORDER BY rule_id, line_no', [rules.map((r) => r.id)])).rows : [];
  const scheduled = (await db.query(`SELECT DISTINCT ON (event_code) event_code, version, effective_from FROM posting_rules WHERE active AND approval_status = 'approved' AND effective_from > $1::date
    ORDER BY event_code, effective_from, version DESC`, [date])).rows;
  const changes = (await db.query(`SELECT c.id, c.kind, c.target, c.payload, c.requested_at, r.event_code, r.version, r.effective_from,
      (SELECT display_name FROM users u WHERE u.id = c.requested_by) AS requested_by
    FROM accounting_config_changes c LEFT JOIN posting_rules r ON r.id = c.rule_id WHERE c.status = 'pending' AND c.kind = ANY($1) ORDER BY c.requested_at`, [Object.keys(CHANGE_LABELS)])).rows;
  const reasons = (await db.query('SELECT code, name, gl_account FROM write_off_reasons WHERE status = \'active\' ORDER BY code')).rows;
  const authority = new Map((await db.query('SELECT code, name FROM authority_transaction_types')).rows.map((t) => [t.code, t.name]));
  const lastPosted = new Map((await db.query(`SELECT r.event_code, max(j.jv_date) AS last FROM journal_vouchers j JOIN posting_rules r ON r.id = j.posting_rule_id
    WHERE j.status IN ('posted', 'reversed') GROUP BY r.event_code`)).rows.map((r) => [r.event_code, iso(r.last)]));
  return { roles, gl, rules, lines, scheduled, changes, reasons, authority, lastPosted };
}

/**
 * The accounting reference: { asOf, edition, areas, controls, mapping, pendingChanges, events, systemJournals }.
 * Each event carries its business wording, approval, journal state, pending / scheduled rule changes, last posting
 * date and its lines with the account they resolve to and its mapping state (see the README of this module).
 */
export async function accountingFlow(db) {
  const date = await today();
  const src = await loadSources(db, date);
  const provisional = ((await getSetting('accounting.provisional_accounts', [])) || []).map(String);
  const patternText = (await getSetting('sap_gl.account_pattern', '^[0-9]{6}$')) || '';
  let pattern = null;
  try { pattern = patternText ? new RegExp(patternText) : null; } catch { pattern = null; }
  const parked = (await getSetting('accounting.parked_events', [])) || [];
  const controls = {
    autoPost: (await getSetting('accounting.auto_post_system_entries', true)) !== false,
    configurationReview: await configurationReview(),
    splitPremiumTaxes: (await getSetting(LINE_CONDITIONS.premiumTaxes.setting, true)) !== false,
    commissionVat: (await getSetting(LINE_CONDITIONS.commissionVat.setting, true)) !== false,
    commissionEwt: (await getSetting(LINE_CONDITIONS.commissionEwt.setting, true)) !== false,
  };
  const conditionOn = { [LINE_CONDITIONS.premiumTaxes.setting]: controls.splitPremiumTaxes, [LINE_CONDITIONS.commissionVat.setting]: controls.commissionVat,
    [LINE_CONDITIONS.commissionEwt.setting]: controls.commissionEwt };
  const tax = await commissionTaxSetup(db);
  const payable = (await getSetting('accounting.payable_account_by_payee', {})) || {};
  const cash = (await getSetting('accounting.cash_account_by_payment_mode', {})) || {};

  const mappingOf = (code) => {
    if (!code) return null;
    const a = src.gl.get(String(code));
    if (!a || a.status !== 'active') return 'inactive';
    if (provisional.includes(String(code))) return 'provisional';
    if (pattern && !pattern.test(String(code))) return 'outside-chart';
    return null;
  };
  const glOf = (code) => (code ? { glCode: String(code), glName: src.gl.get(String(code))?.name || null, mapping: mappingOf(code) } : { glCode: null, glName: null, mapping: null });

  // what a pending configuration change touches: an event's rule, an account role, a map, the commission taxes
  const pendingRole = new Map(); const pendingMap = new Map(); let pendingTaxes = null;
  const pendingRule = new Map();
  for (const c of src.changes) {
    const base = { changeId: Number(c.id), requestedBy: c.requested_by || null, requestedAt: c.requested_at };
    if (c.kind === 'account-role') pendingRole.set(c.target, { ...base, ...glOf(c.payload?.glCode) });
    else if (c.kind === 'account-map') pendingMap.set(c.target, base);
    else if (c.kind === 'commission-taxes') pendingTaxes = base;
    else if (c.event_code && !pendingRule.has(c.event_code)) pendingRule.set(c.event_code, { ...base, kind: c.kind, version: c.version, effectiveFrom: iso(c.effective_from) });
  }

  // the items to map, each listed once with the events that use it
  const pendingItems = new Map();
  const notePending = (key, item, eventCode) => {
    if (!item.mapping) return;
    const k = `${key}|${item.glCode}`;
    if (!pendingItems.has(k)) pendingItems.set(k, { item: item.itemName, kind: item.itemKind, glCode: item.glCode, glName: item.glName, reason: item.mapping, events: [], configure: item.configure });
    const p = pendingItems.get(k);
    if (eventCode && !p.events.includes(eventCode)) p.events.push(eventCode);
  };
  const roleAccount = (role, eventCode) => {
    const r = src.roles.get(role);
    const section = sectionOf(role);
    const a = { ...glOf(r?.gl), role, label: r?.label || role, configure: SECTION_ROUTES[section] || DETERMINATION, pendingChange: pendingRole.get(role) || null,
      section: SECTION_NAMES[section] || null };
    notePending(`role:${role}`, { ...a, itemName: a.label, itemKind: 'role' }, eventCode);
    return a;
  };
  /** One entry of a map (payment mode, payee type, write-off reason): its name on the line and its name in the list to map. */
  const option = (kind, name, item, code, configure, eventCode) => {
    const o = { name, ...glOf(code) };
    notePending(`${kind}:${name}`, { ...o, itemName: item, itemKind: kind, configure }, eventCode);
    return o;
  };
  const paymentModeOptions = (eventCode) => {
    const other = roleAccount('cash_in_bank', eventCode);
    return [...Object.entries(cash).map(([mode, code]) => {
      const name = PAYMENT_MODES[mode] || sentence(mode);
      return option('payment-mode', name, `Payment mode ${name}`, code, DETERMINATION, eventCode);
    }), { name: 'Other payment modes', glCode: other.glCode, glName: other.glName, mapping: other.mapping }];
  };

  /** The account of a rule line: where it comes from in business words, the GL it resolves to today and its mapping state. */
  const describe = (l, eventCode) => {
    const fallback = l.fallback_role ? roleAccount(l.fallback_role, eventCode) : null;
    const fb = fallback ? { glCode: fallback.glCode, glName: fallback.glName, mapping: fallback.mapping, role: fallback.role, label: fallback.label } : null;
    if (l.account_type === 'role') {
      const a = roleAccount(l.account, eventCode);
      return { kind: 'role', label: a.label, role: a.role, source: a.section ? `${a.label} (Account Determination › ${a.section})` : a.label, glCode: a.glCode, glName: a.glName,
        glActive: a.mapping !== 'inactive', mapping: a.mapping, configure: a.configure, fallback: null, options: null, pendingChange: a.pendingChange };
    }
    if (l.account_type === 'gl') {
      const a = glOf(l.account);
      notePending(`gl:${l.account}`, { ...a, itemName: `Fixed account ${l.account}`, itemKind: 'fixed', configure: '/master/finance/posting-rules' }, eventCode);
      return { kind: 'gl', label: a.glName || l.account, source: 'Fixed account of the rule', ...a, glActive: a.mapping !== 'inactive', configure: null, fallback: null, options: null, pendingChange: null };
    }
    if (l.account_type === 'context') {
      const source = CONTEXT_BY_EVENT[eventCode]?.[l.account] || CONTEXT_SOURCES[l.account] || `Account supplied by the transaction (${sentence(l.account.replace(/_/g, ' '))})`;
      return { kind: 'context', label: source, contextKey: l.account, role: l.fallback_role || undefined, source, glCode: null, glName: null, glActive: true, mapping: null,
        configure: null, fallback: fb, options: null, pendingChange: fallback?.pendingChange || null };
    }
    const resolver = { kind: 'resolver', label: RESOLVERS[l.account]?.label || l.account, resolver: l.account, role: l.fallback_role || undefined, fallback: fb, options: null, pendingChange: null };
    if (l.account === 'bank_account' || l.account === 'cash_by_payment_mode') {
      return { ...resolver, source: l.account === 'bank_account' ? 'Bank account of the receipt or payment; else the cash account of the payment mode' : 'Cash account of the payment mode',
        glCode: null, glName: null, glActive: true, mapping: null, configure: DETERMINATION, options: paymentModeOptions(eventCode), pendingChange: pendingMap.get('cash-by-payment-mode') || null };
    }
    if (l.account === 'payable_by_payee') {
      const types = EVENT_FLOW[eventCode]?.payeeTypes || Object.keys(payable);
      const options = types.map((t) => option('payee', t, `Payee type ${t}`, payable[t] || src.roles.get('due_to_insurer')?.gl, DETERMINATION, eventCode));
      const single = options.length === 1 ? options[0] : null;
      return { ...resolver, source: 'Payable account of the payee type', glCode: single?.glCode || null, glName: single?.glName || null, glActive: single?.mapping !== 'inactive',
        mapping: single?.mapping || null, configure: DETERMINATION, options, pendingChange: pendingMap.get('payable-by-payee') || null };
    }
    if (l.account === 'commission_vat_account' || l.account === 'commission_ewt_account') {
      const t = tax[l.account === 'commission_vat_account' ? 'vat' : 'ewt'];
      const own = t.enabled && t.glAccount ? glOf(t.glAccount) : null;
      if (own) notePending(`tax:${t.code}`, { ...own, itemName: `Tax code ${t.code}`, itemKind: 'tax-code', configure: TAXATION }, eventCode);
      const a = own || fb || glOf(null);
      return { ...resolver, source: own ? `GL account of the tax code ${t.code}${fallback ? `, else ${fallback.label}` : ''}` : (fallback?.label || resolver.label),
        glCode: a.glCode, glName: a.glName, glActive: a.mapping !== 'inactive', mapping: a.mapping, configure: own ? TAXATION : fallback?.configure || DETERMINATION, fallback: own ? fb : null,
        pendingChange: pendingTaxes };
    }
    if (l.account === 'write_off_reason') {
      const options = src.reasons.map((r) => option('write-off-reason', r.name, `Write-off reason ${r.name}`, r.gl_account, DETERMINATION, eventCode));
      return { ...resolver, source: 'GL account of the write-off reason', glCode: null, glName: null, glActive: true, mapping: null, configure: DETERMINATION, options };
    }
    return { ...resolver, source: resolver.label, glCode: fb?.glCode || null, glName: fb?.glName || null, glActive: true, mapping: fb?.mapping || null, configure: DETERMINATION };
  };

  const approvalOf = async (a) => {
    if (!a?.setting) return { text: a?.text || 'None', control: null };
    const on = (await getSetting(a.setting, true)) !== false;
    return { text: on ? a.on : a.off, control: { name: a.name, on } };
  };
  const authorityOf = (type) => (type ? { type, name: src.authority.get(type) || type } : null);
  const linesByRule = new Map();
  for (const l of src.lines) {
    if (!linesByRule.has(l.rule_id)) linesByRule.set(l.rule_id, []);
    linesByRule.get(l.rule_id).push(l);
  }
  const ruleByEvent = new Map(src.rules.map((r) => [r.event_code, r]));
  const scheduledByEvent = new Map(src.scheduled.map((r) => [r.event_code, { version: r.version, effectiveFrom: iso(r.effective_from) }]));

  const events = [];
  for (const area of AREAS) {
    for (const code of area.events) {
      const ev = EVENTS[code];
      if (!ev) continue;
      const flow = EVENT_FLOW[code];
      const rule = ruleByEvent.get(code) || null;
      const lines = (rule ? linesByRule.get(rule.id) || [] : []).map((l) => {
        const cond = conditionOf(code, l.amount_key);
        return { lineNo: l.line_no, side: l.side, amountKey: l.amount_key, amount: wordingOf(code, l.amount_key), formula: flow.formulas?.[l.amount_key] || null,
          perParticipant: l.per_participant, narration: l.narration, fallbackRole: l.fallback_role, accountType: l.account_type, accountRef: l.account,
          condition: cond ? { name: cond.name, on: conditionOn[cond.setting] } : null, account: describe(l, code) };
      });
      // debits first, then credits, in rule order within a side
      lines.sort((a, b) => (a.side === b.side ? a.lineNo - b.lineNo : a.side === 'Dr' ? -1 : 1));
      const isParked = !ALWAYS_POSTED[code] && Array.isArray(parked) && parked.includes(code);
      const posting = isParked ? 'parked' : controls.autoPost || ALWAYS_POSTED[code] ? 'posted' : 'pending';
      const approval = await approvalOf(flow.approval);
      events.push({
        eventCode: code, label: ev.label, module: ev.module, area: area.code, summary: rule?.description || null, when: flow.when, screen: flow.screen, where: flow.where,
        trigger: flow.when, approval: approval.text, approvalControl: approval.control, authority: authorityOf(isParked ? 'journal_voucher' : flow.authority),
        posting, postingText: POSTING_TEXT[posting], alwaysPosted: ALWAYS_POSTED[code] || null,
        ruleId: rule?.id || null, version: rule?.version || null, effectiveFrom: iso(rule?.effective_from), approvedAt: rule?.approved_at || null, description: rule?.description || null,
        scheduled: scheduledByEvent.get(code) || null, pending: pendingRule.get(code) || null, lastPosted: src.lastPosted.get(code) || null,
        mappingPending: lines.some((l) => l.condition?.on !== false && (l.account.mapping || l.account.options?.some((o) => o.mapping) || l.account.fallback?.mapping)),
        lines, debits: lines.filter((l) => l.side === 'Dr'), credits: lines.filter((l) => l.side === 'Cr'),
      });
    }
  }

  const systemJournals = [];
  for (const s of SYSTEM_JOURNALS) {
    const approval = await approvalOf(s.approval);
    const condition = s.condition ? { name: s.condition.name, on: (await getSetting(s.condition.setting, s.condition.default)) === true } : null;
    const lines = s.lines.map((l, i) => {
      let account;
      if (l.role) {
        const a = roleAccount(l.role, s.eventCode);
        account = { kind: 'role', label: a.label, role: a.role, source: a.section ? `${a.label} (Account Determination › ${a.section})` : a.label, glCode: a.glCode, glName: a.glName,
          glActive: a.mapping !== 'inactive', mapping: a.mapping, configure: a.configure, fallback: null, options: null, pendingChange: a.pendingChange };
      } else {
        const fb = l.fallback ? roleAccount(l.fallback, s.eventCode) : null;
        account = { kind: 'context', label: l.source, source: l.source, glCode: null, glName: null, glActive: true, mapping: null, configure: null,
          fallback: fb ? { glCode: fb.glCode, glName: fb.glName, mapping: fb.mapping, role: fb.role, label: fb.label } : null,
          options: l.options ? l.options.map((r) => { const a = roleAccount(r, s.eventCode); return { name: a.label, glCode: a.glCode, glName: a.glName, mapping: a.mapping }; }) : null,
          pendingChange: null };
      }
      return { lineNo: i + 1, side: l.side, amountKey: null, amount: l.amount, formula: null, perParticipant: false, narration: null, condition, account };
    });
    systemJournals.push({ eventCode: s.eventCode, label: s.label, module: 'system', area: 'system', summary: s.summary, when: s.when, screen: s.screen, where: s.where, trigger: s.when,
      approval: approval.text, approvalControl: approval.control, authority: null, posting: 'posted', postingText: POSTING_TEXT.posted, alwaysPosted: null, fixed: true,
      ruleId: null, version: null, effectiveFrom: null, approvedAt: null, description: s.summary, scheduled: null, pending: null, lastPosted: null,
      mappingPending: lines.some((l) => l.account.mapping || l.account.options?.some((o) => o.mapping) || l.account.fallback?.mapping),
      lines, debits: lines.filter((l) => l.side === 'Dr'), credits: lines.filter((l) => l.side === 'Cr') });
  }

  const labelOf = (code) => EVENTS[code]?.label || code;
  const pendingChanges = src.changes.map((c) => ({ changeId: Number(c.id), kind: c.kind, kindLabel: CHANGE_LABELS[c.kind],
    target: c.event_code ? labelOf(c.event_code) : c.kind === 'account-role' ? src.roles.get(c.target)?.label || c.target
      : c.kind === 'account-map' ? (c.target === 'payable-by-payee' ? 'Payable account per payee type' : 'Cash account per payment mode') : 'Commission taxes',
    eventCode: c.event_code || null, requestedBy: c.requested_by || null, requestedAt: c.requested_at }));

  const fingerprint = JSON.stringify([provisional, patternText, events.map((e) => [e.eventCode, e.ruleId, e.version, e.lines.map((l) => [l.side, l.amountKey, l.perParticipant,
    l.account.glCode, l.account.fallback?.glCode || null, (l.account.options || []).map((o) => o.glCode)])])]);
  const edition = createHash('sha256').update(fingerprint).digest('hex').slice(0, 8).toUpperCase();
  const all = [...events, ...systemJournals];
  const pending = [...pendingItems.values()].map((p) => ({ ...p, events: p.events.map((code) => ({ eventCode: code, label: all.find((e) => e.eventCode === code)?.label || code })) }));
  return {
    asOf: date, edition, controls, provisionalAccounts: provisional,
    areas: AREAS.map((a) => ({ code: a.code, name: a.name, count: all.filter((e) => e.area === a.code).length })),
    mapping: { state: pending.length ? 'incomplete' : 'ready', pending },
    pendingChanges, events, systemJournals,
  };
}

/**
 * Worked example of an event (nothing is posted): the event's sample amounts in business words and the journal they
 * build. Accounts the transaction would supply are replaced by the line's fallback role where the rule names one, so
 * the example shows the accounts this configuration uses; the others keep the sample account and are marked example.
 */
export async function flowExample(db, eventCode, { coInsurance = false } = {}) {
  const ev = EVENTS[eventCode];
  if (!ev) throw notFound(`Unknown event ${eventCode}`);
  const date = await today();
  const rule = (await db.query(`SELECT * FROM posting_rules WHERE event_code = $1 AND active AND approval_status = 'approved' AND effective_from <= $2::date
    ORDER BY effective_from DESC, version DESC LIMIT 1`, [eventCode, date])).rows[0];
  if (!rule) throw conflict(`No rule in force for ${ev.label}: transactions of this event cannot post`);
  const ruleLines = (await db.query('SELECT * FROM posting_rule_lines WHERE rule_id = $1 ORDER BY line_no', [rule.id])).rows;
  const base = (coInsurance && ev.sampleCoInsurance) || ev.sample;
  const accounts = { ...(base.accounts || {}) };
  const supplied = new Set();
  for (const l of ruleLines.filter((x) => x.account_type === 'context')) {
    const role = l.fallback_role ? await getSetting(`accounting.account.${l.fallback_role}`, null) : null;
    if (role) accounts[l.account] = String(role);
    else supplied.add(l.line_no);
  }
  const sim = await simulate(db, eventCode, { context: { ...base, accounts }, rule: { rule, lines: ruleLines } });
  const used = new Set(sim.lines.map((l) => l.ruleLine));
  const omitted = [...new Set(ruleLines.filter((l) => !used.has(l.line_no)).map((l) => wordingOf(eventCode, l.amount_key)))];
  const sample = Object.entries(ev.sample.amounts || {}).filter(([k, v]) => v && ruleLines.some((l) => l.amount_key === k)).map(([k, v]) => ({ amount: wordingOf(eventCode, k), value: round2(v) }));
  return {
    eventCode, coInsurance: coInsurance && !!ev.sampleCoInsurance, coInsurable: !!ev.sampleCoInsurance, sample,
    lines: sim.lines.map((l) => ({ accountCode: l.accountCode, accountName: l.accountName, debit: l.debit, credit: l.credit, memo: l.memo, example: supplied.has(l.ruleLine) })),
    totalDebit: sim.totalDebit, totalCredit: sim.totalCredit, balanced: sim.balanced, omitted,
  };
}
