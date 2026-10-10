# Period end

Fiscal calendar, period status, the month-end close, recurring and accrual journals, the year-end close, financial
statements and BIR tax (tax codes, Form 2307). Routes are under `/period-end` (Accounts > Period End, Master >
Finance > Tax Codes). Permissions: `read:period-end` to view, `write:period-end` to prepare, `approve:period-end`
(Accounting Manager) to approve a close, reopen a period, post into a soft-closed period and reverse a year-end close.

## Files

| File | What it does |
|---|---|
| `router.js` | All routes of the module. |
| `fiscal.js` | Fiscal years (`FY2026`), their twelve periods (`2026-01` ...) and the adjustment period 13 (`2026-13`). Years are created on demand. Manual status changes (`changePeriodStatus`, `transitionProblem`). |
| `opening.js` | Go-live opening balances: `validateOpeningBalances` (Validate step, writes nothing) and `importOpeningBalances` (all or nothing). |
| `posting.js` | `assertPostingAllowed`: which journals may post into a period (open, soft_closed, closed, locked), read on the journal's own period; `cutoffPeriod`: the period of a system posting after the operations cut-off day (TIS-BRD-GL-04). Called by the ledger for every journal. |
| `close.js` | Month-end close runs (`MEC-` numbers): create, execute, sign checklist items, submit, approve, reject, cancel. |
| `steps.js` | The valuation steps of a run: unearned commission deferral and FX revaluation. |
| `journals.js` | Recurring and accrual journal templates, the automatic reversal on day 1 of the next period, and the undo of a run's own journals before a rerun. |
| `checks.js` | The automatic checklist items (one function per checklist code of type auto). |
| `tieout.js` | Checklist item `subledger_tieout`: premium receivable, commission receivable and due to insurers sub-ledgers against their GL control accounts, with the manual journals on an account that does not tie out. |
| `yearend.js` | Year-end close (`YEC-` numbers) in five steps: prerequisites, adjustments in period 13, closing entries, the close (maker-checker), opening balances of the next year; the screen overview (previews before the close, history, the user's actions); the reversal (request with a reason, approval by another user). |
| `statements.js` | Financial statements screen: the income statement, balance sheet and trial balance of the report catalogue laid out in sections, statement groups, lines and totals (all-zero lines left out), the date range of each column, the card figures, the period choice (fiscal years and periods) and the Excel sheet / PDF of a statement. |
| `tax.js` | Tax codes master and BIR Form 2307 (issued and received). |
| `jobs.js` | Scheduled jobs: month-end reminder, recurring journals, accrual reversal, period auto soft-close. All four are disabled by default. |

## Main tables

`fiscal_years`, `accounting_periods` (status per period), `period_status_history`, `period_close_checklist`,
`period_close_runs`, `period_close_run_checks`, `period_close_entries` (journals a run created), `recurring_journals`,
`recurring_journal_runs`, `year_end_runs`, `year_end_run_history` (every action on a run, with the user's roles), `opening_balances`,
`tax_codes`, `bir_2307_certificates`.

## Main flows

Period status (Period Management): the side panel first calls `GET /periods/:period/status-preview?status=` (read
only): whether the user may make the move (`reason`: `permission`, `approval`, `locked`, `year-closed`, `year-end-closed`,
`adjustment-disabled`, `checks`) and the results of the blocking auto items of the Close Checklist; for a close also the
blocking manual items, signed off on the latest month-end close run of the period or still `pending`. The change itself,
`POST /periods/:period/status { status, reasonCode, note }`, needs a reason of the Reason Codes master: context
`period_close` to soft-close or close, `period_reopen` to reopen (the note when the reason asks for one). The code is
kept in `period_status_history.reason_code`, the reason's name and the note in `remarks`, both in the audit entry.
Closing and reopening need `approve:period-end` (the maker submits the month-end close for approval instead); the
server runs the blocking checks again before a soft-close or close, and refuses a close while a blocking manual item is
not signed off. A period is locked only
by the year-end close. `GET /fiscal-years/:code` gives each period its latest change (`lastChange`: who, when, reason)
and the moves the user may make (`actions`).

Go-live opening balances: `POST /opening-balances/validate` checks the file (rows, accounts, totals, difference, every
error with its row and column, the earlier load of the year) without loading it; `POST /opening-balances/import` loads
it (all or nothing; the same go-live date replaces the earlier load). No journal is posted: reports read
`opening_balances` through `pe_balance_before`.

Month-end close: create a run for the period, execute it (steps a to e: accruals, recurring journals, commission
deferral, FX revaluation, checklist), sign the manual checklist items, submit. When
`accounting.period_close_requires_approval` is on, a second user with `approve:period-end` approves and the period
becomes closed; otherwise the submit closes it. Executing again first reverses the run's own previous journals, so a
rerun gives the same ledger as one run.

Financial statements (`GET /period-end/statements/periods`, `/statements/:type`, `/statements/:type/export`): the
screen picks a fiscal year, a period and a view (month, quarter to the period, year to date, custom range; the balance
sheet is as of the period end or a date). The numbers come from the catalogue reports `income-statement`,
`balance-sheet` and `trial-balance-ocm` (`reports/periodEndQueries.js`), so Reports > Financial Reports shows the same
figures. Amounts keep their natural sign: an expense credited in the period (a clawback, the reversal of an earlier
month's journal) is negative and printed in parentheses. The balance sheet starts from the opening balances of the
fiscal year (year-end carry-forward or go-live load) like the trial balance. An account line opens its general ledger
(`/statements/gl-detail?Account=`). Export (Excel, PDF) and print are audited (`financial_statement`, `export`).

Year-end close (Accounts > Period End > Year-End Close, `GET /period-end/year-end/overview` feeds the screen): start a
run for the fiscal year (the pre-checks run at once), resolve the failed checks, post the adjustments of period 13
(created `for-approval` and approved on the journal voucher by a second user), then a user with `approve:period-end` other than the one who started the run closes the
year (`finance.maker_checker_enabled`). Pre-checks: the twelve periods closed (or soft-closed when
`accounting.year_end_accepts_soft_closed` is on), no unposted journal dated in the year outside period 13, the suspense
account nil, the trial balance balanced, the closing accounts configured, the previous year closed; then period 13 open
with every adjustment posted. The close posts the closing entries in period 13 (income and expense to Current Year P/L,
then to Retained Earnings), writes the balance-sheet balances of the year end to `opening_balances` (no opening journal
is posted), locks the year and creates the next one. The overview previews the closing entries and the opening
balances before the close from the same balances. A reversal is requested (`write:period-end`) with a reason of the
Reason Codes master (context `year_end_reverse`) and approved by another user with `approve:period-end`, or withdrawn;
a run that has not closed the year is cancelled with a reason of the context `year_end_cancel`;
it is possible until the first period of the next year is closed. Every action is kept in `year_end_run_history`.

## Key settings

`accounting.operations_cutoff_day` (26: premium bookings from that day go to the next period),
`accounting.finance_close_day` (29: the month-end reminder counts down to it), `accounting.adjustment_window_working_days`
(6: the auto soft-close waits for that working day of the next month, Holiday master; 0 uses the job's grace days),
`accounting.fiscal_year_start_month`, `accounting.period_close_requires_approval`, `accounting.year_end_accepts_soft_closed`,
`finance.maker_checker_enabled`, `accounting.account.suspense`, `period_end.tieout_tolerance`,
`accounting.fx_revaluation_account_types`, `accounting.account.current_year_pl`,
`accounting.account.retained_earnings`, `bir.atc_by_payee`, `bir.sawt_default_atc`. The broker's name, TIN, registered
address, zip code and RDO code on BIR forms come from the primary company of Master > Company; `bir.withholding_agent_tin`,
`bir.registered_name`, `bir.registered_address` and `bir.zip_code` are used only when no company exists. Job parameters (days before period end, grace days)
are on Master > Schedules.

## Debugging

- A posting is refused with "Accounting period 2026-08 is soft-closed": only `approve:period-end` may post into it. Either post
  with a manager, date the journal in the open period, or reopen the period (`POST /period-end/periods/:period/status`,
  kept in `period_status_history`).
- A run stays `blocked` after execute: `GET /period-end/close-runs/:id` lists each check with the first
  rows that failed it. Warnings do not block the close; failures do.
- Recurring journals did not post: the `recurring-journals` job is disabled by default. Check Master > Schedules and
  `job_runs` for the job, then `recurring_journal_runs` for the template.
- Year-end reversal refused: the first period of the next year is already closed. Reopen it first.
- A negative expense line on the income statement is a credit in the range (commission clawback, a reversal dated in
  this period of an earlier journal). Open the line: the general ledger shows the journal.
- Balance sheet out of balance: compare with `GET /period-end/statements/trial-balance` for the same date (closing
  debits = credits); a fiscal year whose opening balances do not balance (`/opening-balances`) is the usual cause.
- "Close fiscal year" disabled: `GET /period-end/year-end/overview` returns `actions.close.reason` (`permission`,
  `maker-checker` for the user who started the run, `checks` while a check of steps 1 or 2 fails).
