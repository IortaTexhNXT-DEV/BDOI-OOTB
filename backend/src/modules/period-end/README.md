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
| `posting.js` | `assertPostingAllowed`: which journals may post into a period (open, soft_closed, closed, locked). Called by the ledger for every journal. |
| `close.js` | Month-end close runs (`MEC-` numbers): create, execute, sign checklist items, submit, approve, reject, cancel. |
| `steps.js` | The valuation steps of a run: unearned commission deferral and FX revaluation. |
| `journals.js` | Recurring and accrual journal templates, the automatic reversal on day 1 of the next period, and the undo of a run's own journals before a rerun. |
| `checks.js` | The automatic checklist items (one function per checklist code of type auto). |
| `tieout.js` | Checklist item `subledger_tieout`: premium receivable, commission receivable and due to insurers sub-ledgers against their GL control accounts, with the manual journals on an account that does not tie out. |
| `yearend.js` | Year-end close (`YEC-` numbers): closing entries in period 13, opening balances, locking the year, reversal. |
| `tax.js` | Tax codes master and BIR Form 2307 (issued and received). |
| `jobs.js` | Scheduled jobs: month-end reminder, recurring journals, accrual reversal, period auto soft-close. All four are disabled by default. |

## Main tables

`fiscal_years`, `accounting_periods` (status per period), `period_status_history`, `period_close_checklist`,
`period_close_runs`, `period_close_run_checks`, `period_close_entries` (journals a run created), `recurring_journals`,
`recurring_journal_runs`, `year_end_runs`, `opening_balances`, `tax_codes`, `bir_2307_certificates`.

## Main flows

Period status (Period Management): the side panel first calls `GET /periods/:period/status-preview?status=` (read
only): whether the user may make the move (`reason`: `permission`, `locked`, `year-closed`, `year-end-closed`,
`adjustment-disabled`, `checks`) and the results of the blocking auto items of the Close Checklist. The change itself,
`POST /periods/:period/status { status, reasonCode, note }`, needs a reason of the Reason Codes master: context
`period_close` to soft-close or close, `period_reopen` to reopen (the note when the reason asks for one). The code is
kept in `period_status_history.reason_code`, the reason's name and the note in `remarks`, both in the audit entry.
Reopening needs `approve:period-end`; the server runs the blocking checks again before a close. A period is locked only
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

Year-end close: needs all twelve periods closed and period 13 open. It posts the closing entries in period 13 (income
and expense to Current Year P/L, then to Retained Earnings), writes the balance-sheet balances of the year end to
`opening_balances` (no opening journal is posted), locks the year and creates the next one.

## Key settings

`accounting.fiscal_year_start_month`, `accounting.period_close_requires_approval`, `period_end.tieout_tolerance`,
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
