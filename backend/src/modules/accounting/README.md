# Accounting (general ledger)

The general ledger behind every finance screen. It holds the chart of accounts, the journal engine that every
posting goes through, the client ledger, entry matching and the trial balance. The routes live under `/accounting`
(Accounts > All Clients Accounting, Trial Balance, Master > Finance > Chart of Accounts).

## Files

| File | What it does |
|---|---|
| `router.js` | Routes of the ledger screens. |
| `service.js` | Ledger queries: entry search, client ledger, matching, trial balance, periods, chart of accounts. |
| `lib/ledger.js` | `createJournal`, `postJournal`, `reverseJournal`, `cancelJournal`. Checks that debits equal credits, that accounts are active and that the period is open. |
| `lib/posting.js` | `postEvent(eventCode, context)`: turns a business event (policy issued, receipt applied, ...) into journal lines using the posting rule of the event. The list of events is `EVENTS`. |
| `lib/commissionTax.js` | Output VAT and EWT on broker-billed commission: rates and GL accounts from the tax codes master (`tax.commission_vat_code`, `tax.commission_ewt_code`). |
| `lib/coinsurance.js` | Splits amounts between co-insurers by share (the rounding remainder goes to the lead). |
| `lib/http.js` | Small request and response helpers used by the finance modules (list envelope, `NO_DATA_FOUND`). |
| `lib/files.js` | Stores generated finance files (CSV) in the uploads area. |

## Main tables

`gl_accounts` (chart of accounts), `journal_vouchers` and `journal_lines` (journals), `accounting_periods`,
`entry_matches` (matched receivable and payment lines), `posting_rules` and `posting_rule_lines` (maintained by the
posting-rules module), `opening_balances` (written by the year-end close).

A database trigger on `journal_vouchers` checks the balance and the period again when a journal becomes `posted`, so a
wrong journal is refused even if it bypasses `createJournal`.

## Main flows

1. A business operation (issue a policy, apply a receipt, pay a voucher) calls `postEvent` with the amounts it knows.
2. `postEvent` loads the posting rule version in force on the posting date, resolves every line to a GL account
   (account role setting, fixed code, resolver or an account passed by the caller) and calls `createJournal`.
3. `createJournal` numbers the journal (`journal` series), validates it and posts it, or leaves it for approval
   when the source requires approval (manual journal vouchers).
4. Reversals go through `reverseJournal`, which creates the mirror journal and marks the original `reversed`.

## Key settings

- `accounting.account.<role>`: the GL account of each account role (cash in bank, premium receivable, due to
  insurer, commission income ...). Edited on Master > Finance > Account Determination.
- `accounting.payable_account_by_payee`, `accounting.cash_account_by_payment_mode`: account maps.
- `accounting.auto_post_system_entries`, `accounting.split_premium_taxes`.
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
