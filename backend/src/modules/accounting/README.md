# Accounting (general ledger)

The general ledger behind every finance screen. It holds the chart of accounts, the journal engine that every
posting goes through, the client ledger, entry matching and the trial balance. The routes live under `/accounting`
(Accounts > All Clients Accounting, Trial Balance, Master > Finance > Chart of Accounts).

## Files

| File | What it does |
|---|---|
| `router.js` | Routes of the ledger screens. |
| `service.js` | Ledger queries: entry search, client ledger, matching, trial balance, periods, chart of accounts. |
| `lib/ledger.js` | `createJournal`, `postJournal`, `reverseJournal`, `cancelJournal`. Checks that debits equal credits, that accounts are active and that the period is open; stamps the cost centre of each line. |
| `lib/posting.js` | `postEvent(eventCode, context)`: turns a business event (policy issued, receipt applied, ...) into journal lines using the posting rule of the event, and parks the journal for approval when the event is listed in `accounting.parked_events`. The list of events is `EVENTS`; `ALWAYS_POSTED` names the events that cannot be parked. |
| `lib/costCentre.js` | The default cost centre on a date and the check of the cost centres keyed on a manual voucher (master `cost-centre`). |
| `lib/commissionTax.js` | Output VAT and EWT on broker-billed commission: rates and GL accounts from the tax codes master (`tax.commission_vat_code`, `tax.commission_ewt_code`). |
| `lib/coinsurance.js` | Splits amounts between co-insurers by share (the rounding remainder goes to the lead). |
| `lib/http.js` | Small request and response helpers used by the finance modules (list envelope, `NO_DATA_FOUND`). |
| `lib/files.js` | Stores generated finance files (CSV) in the uploads area. |

## Main tables

`gl_accounts` (chart of accounts), `journal_vouchers` and `journal_lines` (journals; `journal_lines.cost_centre`), `accounting_periods`,
`entry_matches` (matched receivable and payment lines), `posting_rules` and `posting_rule_lines` (maintained by the
posting-rules module), `opening_balances` (written by the year-end close).

A database trigger on `journal_vouchers` checks the balance and the period again when a journal becomes `posted`, so a
wrong journal is refused even if it bypasses `createJournal`.

## Main flows

1. A business operation (issue a policy, apply a receipt, pay a voucher) calls `postEvent` with the amounts it knows.
2. `postEvent` loads the posting rule version in force on the posting date, resolves every line to a GL account
   (account role setting, fixed code, resolver or an account passed by the caller) and calls `createJournal`.
3. `createJournal` numbers the journal (`journal` series), validates it and posts it, or leaves it for approval
   when the source requires approval (manual journal vouchers) or the event is parked (below).
4. Reversals go through `reverseJournal`, which creates the mirror journal and marks the original `reversed`. A system
   journal that was never posted (parked, or pending under `accounting.auto_post_system_entries` = false) is cancelled
   instead when its source document is cancelled; the Reversal JV screen and the accounting query reverse posted
   journals only (`cancelUnposted: false`).

### Parked system journals (TIS-BRD-GL-03, FGA.09 "Saved > Parked, Approved > Posted")

The journal of an event listed in `accounting.parked_events` is saved `for-approval` with `requires_approval` and posted
when a user other than the one whose action created it approves it (Accounts > Journal Voucher with "System journals
parked for approval", My Work > Approvals; Authority Matrix `journal_voucher`). It cannot be rejected on its own: its
source document is cancelled instead, which cancels it. TISPH parks the FGA.09 documents that have no approval of their
own: `directbill.collection` (collection of commission from the insurer), `sales_invoice.issue`,
`sales_invoice.payment` (service invoice and its payment) and `ap.payment` (payment of supplier invoices).

`ALWAYS_POSTED` events post at once whatever the list says, because a sub-ledger moves with them and the next steps
read it: premium bookings (`policy.issue.broker_billed`, `endorsement.additional_premium`, `policy.renewal.broker_billed`,
`endorsement.return_premium`, `policy.cancel`), `receipt.apply` (the bill's balance and the remittance to the insurer),
`directbill.commission` / `_return` (items billed on debit notes), `insurer.refund_due` / `_applied` (netted against
remittances) and `write_off` / `write_off.credit_balance` (open-item matching). Events posted on the approval of their
own document (remittance settlement, adjustment and transfer, payment vouchers, supplier invoices, commission billing
statements, comsub approval) can be listed when Finance wants a second, accounting approval; they are not by default.
Settings and Configuration refuse a list with an unknown event or an `ALWAYS_POSTED` one. Master > Finance > Accounting
Flow shows for every event whether it is parked or posted at once.

### Cost centres (FGA.04, TIS-BRD-GL-04)

Every journal line carries a cost centre (`journal_lines.cost_centre`): the line's own (manual vouchers, the upload),
else the journal's, else the default cost centre (`lib/costCentre.js`: the active cost centre marked Default on Master >
Finance > Cost Centres, the letterhead company's first). TISPH ships 900901 Toyota Insurance Services as the default
(seed `81_tisph_finance.sql`). A cost centre keyed on a manual voucher must be active and valid on the voucher date; a
reversal keeps the cost centres of the original. The accounting query (filter `costCentre`), its export, the journal
voucher and the general ledger detail report show it, and the SAP GL file carries it (`modules/sap-gl`). Lines posted
before migration 0346 have none. The screen keeps the master through `/ops-masters/cost-centre` (read with the journal
voucher or masters permissions, maintained with `write:journal-vouchers` or `write:masters`); `/masters/cost-centre`
and the upload template serve the same records.

## Key settings

- `accounting.account.<role>`: the GL account of each account role (cash in bank, premium receivable, due to
  insurer, commission income ...). Edited on Master > Finance > Account Determination.
- `accounting.payable_account_by_payee`, `accounting.cash_account_by_payment_mode`: account maps.
- `accounting.auto_post_system_entries` (ledger-wide: system journals saved pending, posted by any user),
  `accounting.parked_events` (per event: parked for approval by another user), `accounting.split_premium_taxes`.
  A premium tax role mapped to the premium payable account (TISPH: all on 210245) is taken back with the premium on
  returns and paid with it, not as a separate tax.
- `accounting.broker_billed_commission_vat`, `accounting.broker_billed_commission_ewt`, `tax.commission_vat_code`,
  `tax.commission_ewt_code`: taxes on the commission of broker-billed business (Account Determination, Commission
  taxes tab). The booking credits output VAT and debits the creditable withholding tax the insurer withholds; the
  premium due to the insurer is net of the VAT and includes the EWT, and the insurer payment voucher pays that amount.
- `finance.maker_checker_enabled`: approver must differ from the maker (`lib/makerChecker.js`).

## Debugging

- "GL account setting accounting.account.X is not configured": the role has no account. Set it on Account
  Determination; the posting rule that needs it is named in the request log.
- "Journal does not balance": run the event through `POST /posting-rules/simulate` (Posting Rules screen, Simulate)
  with the same amounts. The simulation shows the lines the rule builds.
- "Period ... is closed / soft-closed": see `src/modules/period-end/README.md`.
- To find the journal of a document: `SELECT * FROM journal_vouchers WHERE reference_type = 'receipt' AND
  reference_id = '<id>'` (the reference columns carry the source document), then its `journal_lines`.
