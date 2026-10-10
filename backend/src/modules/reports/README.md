# Reports

One engine behind every report screen: the catalogue, on-screen runs with paging and totals, file generation (CSV,
XLSX, PDF), the history of generated files with signed download links, and scheduled delivery by e-mail. Routes are
under `/reports` (Reports menu). Permissions: `read:reports` to run, `write:reports` for schedules; each report also has
its own permission and optional role list in `report_definitions`.

## Files

| File | What it does |
|---|---|
| `router.js` | Catalogue, run, generate, generated files, schedules, agent filter options. |
| `service.js` | Access check (`canAccess`), catalogue, runs, file generation, download tokens, schedules, `scheduledReport` job handler. |
| `engine.js` | Reads the screen parameters (`FromDate`, `ReportCriteria`, `Agent` ... and their aliases), builds the SQL around the base query, applies filters, paging, totals and groups. |
| `queries.js` | The base queries, keyed by `query_name`. Also merges `periodEndQueries.js` (ledger statements and BIR working papers; the balance sheet and the year-to-date columns of the income statement read the fiscal year's opening balances, as the trial balance does) and `bankRecQueries.js`. |

## Main tables

`report_definitions` (the catalogue: code, name, screen, parameters as JSON schema, default columns, roles,
permission, `query_name`), `report_schedules`, `generated_reports` (files produced, kept for `reports.retention_days`),
`scheduled_jobs` (one job per schedule, code `report-<id>`).

## How a report runs

1. The screen calls `POST /reports/:code/run` with its form values.
2. `engine.normalizeParams` reads the dates and filters (missing From Date: `reports.default_range_days` back).
3. `engine.buildSql` wraps the base query: `SELECT * FROM (<base>) t WHERE <filters>`. The base query receives
   `$1` from date, `$2` to date, then the `extras` (settings or today's business date) as `$3`, `$4` ...
4. Columns whose name starts with `_` are only for filtering and never returned. Numeric columns in
   `default_columns` are totalled.

## Key settings

`reports.default_format`, `reports.max_rows`, `reports.default_page_size`, `reports.default_range_days`,
`reports.download_link_ttl_hours`, `reports.pdf_page_size`, `reports.retention_days`, `reports.email_subject` /
`reports.email_body`, and the status lists and buckets used by individual queries (`reports.claim_*`,
`reports.placement_*`, `reports.renewal_*`, `reports.lead_funnel_stages`, `reports.trial_balance_statuses`).

## Adding a report

1. Write the base query in `queries.js` (or the period-end / bank-reconciliation file) under a new key. Use `$1` and
   `$2` for the period, expose the standard dimension columns (`_agent_id`, `agent`, `_insurer_id`, `insurer` ...) if
   the report can be filtered by them, and list the filters and criteria it supports.
2. Add a `report_definitions` row in a new seed or migration (`ON CONFLICT (code) DO NOTHING`): code, name, category,
   screen, `query_name`, parameters (the form), default columns with types, roles.
3. Add a test in `test/reports.test.js`. The catalogue check fails when a definition names a query that does not exist.

## Debugging

- "Report X has no query named Y": the definition and `queries.js` disagree. Fix the `query_name`.
- A user does not see a report: `canAccess` needs the definition's permission and, when the definition lists roles,
  one of them.
- A scheduled report did not arrive: look at `job_runs` for the job `report-<schedule id>`, then `email_outbox`.
- A download link says expired: links last `reports.download_link_ttl_hours`; the file itself is in the history until
  `reports.retention_days`.
