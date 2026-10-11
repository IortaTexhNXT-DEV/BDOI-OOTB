# Lock-in

The lock-in of scheme and promotion policies after issue (TIS-BRD-SCHM-03, FRS SCHM-03 FR-LCK-002 to 041) and the
Lock-in / Scheme 2 expiry report (TIS-BRD-RPT-SLS-05). Route: `/lock-in` (Operations > Renewals > Lock-in Review and
the Lock-in & loan panel of Policy detail). Access: `read:lock-in`, `write:lock-in` (review decisions, change requests),
`approve:lock-in` (release, not for renewal, changes), `write:loan-status` (TFS loan status upload and manual status).
Migration 0602 (on `policy_lock_ins` of 0501); reason contexts `lockin_renew`, `lockin_hold`, `lockin_release`,
`lockin_not_renewed`, `lockin_end` (seed 97_dealer_schemes.sql). The notice gate itself is `renewals/noticeGate.js`.

## Files

| File | What it does |
|---|---|
| `router.js` | The `/lock-in` routes: reviews (tabs, export, one review, decision, approve, return), uploads (list, template, failed rows, upload), the policy panel, loan status, change requests and their decision. |
| `service.js` | `applyLoanStatus` (a newer status date wins, a manual status is kept against the file; a blocking status holds the notices: queued batch lines skipped, queued e-mails cancelled, renewal treatment and activity, owner task), `setLoanStatus`, `policyPanel`, `termOf`, `reviewDateOf`. |
| `upload.js` | The TFS account status file (`LOAN_STATUS_COLUMNS`, `lockin.tfs_status_map`): row by row, failed rows kept for download. |
| `review.js` | Lock-in Review tabs and the report rows; the job `lockInReview`; the decision and its approval. |
| `changes.js` | Change lock-in with approval: add, correct or end a lock-in. |

## Rules

- **Review.** Job `lock-in-review` (05:15): ends the lock-ins of cancelled policies and of terms past the lock-in end,
  raises a review item on the working day before expiry - `lockin.review_days_before` (60) for every active lock-in and
  Scheme 2 account (Lock-in ends when the next term is outside the lock-in), a task for the policy owner (else
  `lockin.review_roles`), brings back the holds due and generates the Lock-in / Scheme 2 expiry report.
- **Decision.** Renew under lock-in (refused while the TFS loan blocks, MSG-LCK-031), Hold to a re-review date within
  `lockin.hold_max_days` and before expiry, Release to standard renewal, Not for renewal. A reason of the decision's
  context and a remark of 10 characters at least. Release and Not for renewal wait for another user with
  `approve:lock-in` (`lockin.release_maker_checker`); on approval the lock-in is released (notices resume) or the open
  renewal lapses.
- **Loan status.** Blocking statuses (`lockin.blocking_loan_statuses`, now with early-terminated) hold the
  renewal notices; `lockin.loan_status_stale_days` gives the stale warning; `lockin.upload_max_rows`.
- **Report.** `report_definitions` `lock-in-expiry` (query `lockInExpiry` of reports/salesQueries.js), the window at
  most `lockin.report_max_days`.

## Settings

`lockin.hold_max_days` (30), `lockin.loan_status_stale_days` (45), `lockin.upload_max_rows` (5000),
`lockin.release_maker_checker` (true), `lockin.review_roles` (["processing"]), `lockin.tfs_status_map`,
`lockin.report_max_days` (365).
