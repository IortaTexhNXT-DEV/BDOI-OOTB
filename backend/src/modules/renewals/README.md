# Renewals

The renewal cycle of a policy: the pipeline of policies coming up for expiry, the renewal notices, the renewal quote
and its negotiation, the approval of the renewal terms, the renewed policy, and lapse, not for renewal and
reinstatement (TIS-BRD-RENEW-01 to 08). Routes are under `/renewals` (Operations > Renewals: Renewal Policy, Renewal
Batch, Renewal Queue, At-Risk Policies, Lock-in Accounts, Negotiations, Lapse Management, Retention Analytics,
Performance). Access: `read:renewals`, `write:renewals`; `approve:renewals` decides renewal terms (never the submitter);
`assign:renewals` reassigns a renewal or marks it not for renewal. Records follow the record scope of the user.

## Files

| File | What it does |
|---|---|
| `router.js` | The `/renewals` router: pipeline, renewal record, quote, submit, decide, complete, lapse, reinstate, notices. |
| `service.js` | The renewal record and its lifecycle. Renewal terms are frozen while pending approval (409); the approved premium is the premium booked on the renewed policy (a different premium at completion is refused); an expired renewal quote cannot be submitted or completed (422); the new term starts the day after the expiring term ends (`renewals.term_continuity`); the approver's limit is checked on the Authority Matrix (`renewal_terms`) when `renewals.require_authority_limit` is on. Reinstatement window counts calendar or working days (`renewals.reinstatement_day_basis`). The lock-in of the expiring policy is carried to the renewed policy. |
| `workspace.js` | Renewal Queue, At-Risk Policies, Negotiations and Lapse Management lists, and the routes `GET /renewals/lock-ins` (`format=excel`), `PUT /renewals/lock-ins/:policyId/loan-status`, `GET /renewals/assignees`, `POST /renewals/:id/reassign` and `POST /renewals/:id/not-for-renewal` (both `assign:renewals`, reason codes `renewal_reassign` and `non_renewal`). |
| `analytics.js` | At-risk scoring, negotiations, approvals, lapsed and not-for-renewal lists, retention analytics; timelines show users by display name. |
| `noticeGate.js` | Whether a renewal's notices may go out: `send`, `lock-in` (promotion or Scheme 1 ARA lock-in still running), `scheme2` (`lockin.suppress_scheme2_motor`) or `held` (TFS loan status in `lockin.blocking_loan_statuses`). Every notice path (manual, batch, scheduled, SMS) asks it. |
| `notices.js` | The scheduled notice run (job `renewal-notice-run`): the stage due per `renewals.notice_schedule` (days before expiry per line, `default` otherwise), only on working days (`calendar.working_weekdays` and the Holiday master) when `renewals.notice_working_days` is on, catching up a stage missed on a holiday; withheld notices are recorded once; lock-in review tasks in My Work `lockin.review_days_before` days before expiry. Also the Lock-in Accounts list and the loan status change (a blocking status needs a note; queued batch lines of the policy are skipped). |
| `batches.js` | Renewal batches and batch notices; a line whose notices are withheld is `Skipped` with the reason. |
| `queue.js` | The PostgreSQL job queue that sends batch notices. |
| `jobs.js` | The job handlers `renewalNoticeRun` (scheduled notices) and `renewalNotices` (batch notices). |

## Data

`renewals` (status `pipeline`, `notice-1` .. `final-notice`, `quoted`, `pending-approval`, `approved`, `grace`,
`renewed`, `lapsed`, `not-renewed`; `disposition`, `notice_treatment`), `renewal_quotes`, `renewal_notices`,
`renewal_activities`, `policy_lock_ins` (one per policy: source `promotion`, `scheme1-ara` or `scheme2`, start, years,
end, TFS loan account and status). `src/lib/workingCalendar.js` gives working days from the Holiday master.

The capture of lock-ins at issuance and the Talkbot filter on Generate Renewal Quotes belong to the sales screens; the
filter plugs into the batch selection and reads the same notice gate.
