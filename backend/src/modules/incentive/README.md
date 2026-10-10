# Incentive

Incentive programs for the sales force (Master > Finance > Incentive Programs) and their monthly, quarterly or
semi-annual calculation, approval and payment (Accounts > Incentive: My Programs, Calculations, Approvals, Statement,
Reports). Routes are under `/incentive`.

Permissions:

| Permission | Allows |
|---|---|
| `read:incentive` | Calculations, approvals board, any agent's programs and statement, reports |
| `write:incentive` | Run a calculation, adjust its agent lines, submit it, mark an approved batch as paid |
| `approve:incentive` | Approve or reject a batch pending approval (migration 0387); never the batch's creator or submitter |
| `write:masters` | Create and change programs |
| `read:profile` | An agent's own programs and statement |

## Files

| File | What it does |
|---|---|
| `router.js` | All routes. |
| `service.js` | Programs, achievement from policies and quotes, payout from the program tiers, calculation batches (run, adjust, submit, approve / reject, pay), the activity log of a batch, My Programs, the statement and the reports (PDF, Excel). |

## Main tables

`incentive_programs` (tiers in `structure`), `incentive_calculations` (one batch: period, programs, totals, status,
who created / submitted / approved / rejected it, approval remarks, rejection reason and code, payment),
`incentive_results` (one line per agent and program of a batch). Report templates are master records of type
`incentive-report-template`; generated files are `generated_reports` rows with code `incentive:<template>`.

## Main flows

- Programs: the tiers in `structure` are `{ level, basis, value, maxPayout }`. `level` is the achievement band, as a
  % of the target ("80-90%", "110%+") or as a count of policies ("0-10", "31+"); `basis` is how the tier pays:
  `fixed` (one amount), `percentOfAchieved` (a % of the premium achieved, premium measure only) or `perUnit` (an
  amount per policy, policy count only); `type` (Fixed Amount | Percentage) follows from it. Tiers stored without a
  basis keep the rule they were made with (`tierBasis()`). The bands must be in ascending order of one kind, each
  starting where the one before ends (percentages share the edge, counts follow on by one), with an open-ended band
  only at the top; an Active program needs at least one tier.

- Calculation: `POST /calculations` with a month and the active programs running in it. Each program is calculated
  over its calculation period that ends with that month (`programPeriodOn()`: the month, quarter, half or year of its
  `calculation_frequency`), against the target of that period: a quarterly program is run in the last month of its
  quarter, and a run for an earlier month is refused. Results are keyed by that period (`incentive_results.period`:
  YYYY-MM, YYYY-Qn, YYYY-Hn or YYYY), so a program pays once per period. For each eligible agent
  (`incentive.eligible_roles`) the achievement of the program's measure (`incentive.metric_map`) is paid by the tier
  it falls in (`payout()`). A run with no agent line is refused, and a batch without agent lines cannot be submitted.
  The batch starts as Calculated; lines can be adjusted with `{ lines, reasonCode, note }` of the Reason Codes master
  (context `incentive_adjustment`, seed 88), and the adjusting user is kept in `adjusted_by`; then the batch is
  submitted (Pending Approval).
- Approval (maker-checker): `approve` / `reject` need `approve:incentive`, and the creator, the users who adjusted lines
  and the submitter of the batch are refused (`assertChecker`, `finance.maker_checker_enabled`). A rejection takes
  `{ reasonCode, note }` of the Reason Codes master (context `incentive_batch_reject`, seed 88); the code is kept in
  `rejection_reason_code` and the reason's name with the note in `rejection_reason`. An approval takes optional
  `remarks` and posts the accrual (posting rule `incentive.accrual`) on the last day of the incentive period when its
  accounting period is open, else on the day of the approval; paying posts `incentive.payout`.
- Activity: `GET /calculations/:batchId/activity` gives the batch's audit rows as activity log entries (action, user
  display name and roles, date and time, status from / to, remarks).
- Agent views: `GET /my-programs` (progress in the current calculation period, the program's tiers, the next tier and
  what it still needs, the agent's incentive events in `activity`) and `GET /statement` (earnings of a period, year
  to date, pending payment, programme breakdown, 13-month trend, payment history per batch).
- Reports: `POST /reports/generate` with a template and its parameters (`period`, `program`, `agent`, `branch` code,
  `from` / `to` incentive periods, `minAchievement`, `topN`) and a `format` the template lists (PDF or Excel) writes
  the file. A template with `layout: "summary"` (the Monthly Payout Summary, seed 89) totals the paid incentives by
  incentive period, program and branch; the others list the agent lines.
