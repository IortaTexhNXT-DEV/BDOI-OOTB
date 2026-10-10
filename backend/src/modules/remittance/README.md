# Remittance

Paying premium collected from clients over to the insurers, billing insurers for commission on direct-bill
policies, and the remittance work items around them (settlements, adjustments, transfers, statements, exceptions,
approvals). Routes are under `/remittance` (Accounts > Remittance, about 16 screens, and Master > Finance >
Remittance Master). Permissions: `read:remittance`, `write:remittance` (prepare, submit) and `approve:remittance`
(decide an approval; migration 0400).

## Files

| File | What it does |
|---|---|
| `router.js` | All routes. |
| `service.js` | Remittances and bills to insurers and agencies, the approval queue (Authority Matrix limits, maker-checker), automated remittance generation and the drafts of a schedule run, the transfer gate (`assertTransfersEnabled`) and the journal of an approved work item (`postItemJournal`). |
| `items.js` | Work items stored in `remittance_items` by kind: settlement, adjustment, transfer, statement, exception, notification, bulk upload, bank transaction; the date helpers of a remittance schedule, analytics and history. |
| `directbill.js` | Direct bill: billing mode of a policy, commission booked at issue, commission debit notes (`DN-`), collections from the insurer (`DNC-`) with creditable withholding tax; the commission billing statements of gross-remittance business (`CBS-`). |
| `basis.js` | Remittance basis of broker-billed premium (net or gross) by insurer and product (`remittance.basis_rules`, `remittance.default_basis`). |
| `clientPayments.js` | Direct bill: the client's payment to the insurer (date, amount, insurer OR / reference, proof), the payment status of a policy and the check before a debit note is approved. |
| `insurerCredits.js` | Refunds due from insurers after a return premium on premium already remitted; netted against the next remittance voucher. |
| `decision.js` | Who may decide an approval and why not (`decisionFor`), the eligible approvers and the next step of a pending approval. |
| `approvals.js` | The Approvals inbox, the review panel, bulk decisions and the reminder of the approvers. |
| `activity.js` | The activity log of a remittance. |
| `register.js` | The Remittances register (segments, filters, flags, next step, actions, totals and KPI figures of the filtered set), the record's data, the submission of several drafts and the register export rows. |
| `documents.js` | The remittance schedule (XLSX, PDF), the advice letter (PDF), the register workbook and the Import policy list template. |
| `imports.js` | Import policy list: validation of a file with a result per row, commit into off-cycle drafts, error report, discard. |
| `payments.js` | Insurer payments: the read model of the insurer vouchers with their batch or cheque, the payment record, the batching state, the audited reveal of the account number; the legacy transfers (TRF-), read-only. |
| `runs.js` | Remittance schedules and their runs: the Setup > Schedules table and the automation state, MSG-RMT-007, the preview, Run now, one run per window, the run history, the job (`runDueSchedules`). |
| `summary.js` | `GET /remittance/summary`: the counts of the menu entries per user, the run strip and the landing page. |

## Main tables

`remittances`, `remittance_lines`, `remittance_items`, `remittance_approvals`, `remittance_imports`, `remittance_import_rows`, `remittance_runs`,
`remittance_allocations`, `commission_debit_notes`, `commission_debit_note_lines`, `commission_debit_note_collections`,
`direct_bill_items`, `direct_bill_client_payments`, `insurer_refund_credits`. Payment to the insurer is a payment voucher in the disbursements
module (`disbursements`, `invoice_lists`).

## Main flows

Broker-billed premium: the client pays the broker (receipts module). A settlement lists the insurer's policies with
collected premium; when it is approved, `service.js` raises the insurer payment voucher in Disbursement for the
collected premium, net of the commission and the output VAT on it, plus the EWT the insurer withholds on the
commission (`receivables.commission_vat` / `commission_ewt`, pro rata to the premium collected; the invoice list shows
them in `vat` and `wht`). The cheque approval there posts the payment journal. Settlement credit and debit notes post
through the posting rule `remittance.settlement`.

Gross remittance (`remittance/basis.js`, migration 0344; FGA.09): for an insurer and product whose basis is `gross`,
the bill is booked Dr Premium Receivable / Cr Due to Insurer for the whole premium (no commission, no commission VAT or
EWT; `receivables.remittance_basis` = gross, `commission_amount` 0), so the insurer voucher pays the whole premium
collected and the remittance lines show no commission. The commission of the bill becomes an unbilled
`direct_bill_items` row of basis `gross`, without a journal (a return premium books a negative one at the policy's
commission ratio). Finance bills it on Direct Bill Processing with "Commission of: Gross remittance": the note is a
**billing statement** numbered from the `billing_statement` series (`CBS-`), and its approval by a second user posts
`commission.billing_statement` (Dr Commission Receivable / Cr Commission Income / Cr Output VAT, dated the statement
date). Cancelling an approved statement without collections reverses that journal and makes the commission unbilled
again. The insurer's payment is recorded like a debit note collection (Dr Cash, Dr Creditable Withholding Tax / Cr
Commission Receivable). A note bills one basis only. The default basis is `net`: the build's broker-billed booking
(commission kept, premium remitted net), unchanged.

Direct bill: the client pays the insurer. At issue the broker books commission receivable from the insurer
(`directbill.commission`). Finance raises a commission debit note for a period, a second user approves it, and
collections from the insurer post `directbill.collection` (cash, creditable withholding tax). The client's payment to
the insurer is recorded on Direct Bill Processing (Client paid insurer column); it posts nothing, and with
`direct_bill.client_payment_required` = `any` or `full` a debit note is approved only when every policy on it has a
recorded payment, or is paid in full.

Approval: every work item that needs approval opens a row in `remittance_approvals`. Approval limits are the
Authority Matrix's (Master > User Management > Authority Matrix): transaction type `remittance` for remittances and
agency bills, `remittance_settlement` for settlements, adjustments and electronic transfers. One approval within the
approver's limit decides; only while the matrix has no limit for the type are the fallback levels of
`remittance.approval_levels` used. Deciding (approve, reject, delegate) needs `approve:remittance`, on the routes and
again in `decide()`: System Administrator, Accounting (so the Accounting Manager) and, for TISPH, TIS Finance and the
TIS General Manager.

Who may decide is `decision.js`: `decisionFor(approval, user)` answers `{ canDecide, blockedCode, blockedReason,
level, amount, myLimit, unlimited, limitSource, limitSourceLabel }` with the codes of the shared contract, in this
order: `ALREADY_DECIDED` ("Approved by J. Cruz at 10:32."), `NO_PERMISSION`, `SUBMITTER` (the remittance's submitter)
or `MAKER` (an item's initiator, or the remittance's creator), `EARLIER_LEVEL`, `DELEGATED_AWAY` (legacy per-item
delegation), `NO_AUTHORITY` (no limit, own, role or delegated, while `remittance.require_authority_limit` is on, TISPH;
or `access.authority_without_limit` = refuse) and, to approve, `ABOVE_LIMIT` ("PHP 1,820,000.00 is above your approval
limit of PHP 1,000,000.00."). A rejection is not bound by the amount. `decide()` refuses with the same code
(`errors[0].code`; 403, or 409 for `ALREADY_DECIDED` and `STALE`). `eligibleApprovers(amount, initiatorIds, type)`
lists the active users with the permission whose limit covers the amount, delegates included (`coveringFor`); they are
the "next step" of a pending approval ("Awaiting remittance approver: J. Cruz, A. Tan", or "No eligible approver") and
the only people told of it. My Work's remittance source applies the same rules in SQL and links to
`/finance/remittance/approvals?approval=<id>`.

Each decision on the approval history keeps `limitAtDecision` (null: no limit) and `limitSource` (`user limit`,
`role <code>`, `delegated by <name> (...)`; shown as "User limit", "Role limit: Accounting", "Delegation from A. Santos
(...)"); a rejection needs a reason of context `remittance_reject` (`reasonCode`, the note an Other needs; the legacy
`comments` are taken as the note). Every decision names the `version` it was shown (`remittance_approvals.version`,
bumped by a trigger on every decision, migration 0401): an older version is refused `STALE`. A decision is audited
under the approval and, for a remittance, under the remittance. The maker is told of the decision with a link to the
remittance record (`/finance/remittance/remittances/:id`; "returned" for a rejection). While
`remittance.item_delegation_enabled` is off (TISPH), `POST /approvals/:id/delegate` returns 409: an absent approver is
covered by a dated delegation. The `remittance_delegations` table of earlier releases is no longer read or written.

Approvals inbox (`approvals.js`): `GET /approvals?view=mine|submitted|all|decided` (`type`, `insurerId`, `q`, paging)
answers rows with the decision block, next step, SLA ("Due in 6 h" / "Overdue 2 h"), level and reminder state, server
totals, the KPI figures (awaiting my decision, past SLA, submitted by me, decided by me today) and `authority`, the
chips of the page (`permission`, `canDecide`, the remittance limit and its source, and `covering`: the people the user
covers for today through a dated delegation, with its last day). Decided covers the last 30 days. `GET
/approvals/export.xlsx` writes every row of the view and filters. Without `view` the legacy queue of the Approval Workflow screen is answered. `GET /approvals/:id` (or
`remittance:<id>`) is the review panel: header, totals, first 10 lines, the previous remittance of the insurer with
the change in %, the checks R1 can answer (content unchanged since submission, from `remittances.version` against the
version kept at submission; today's accounting period, as information), open exceptions and the latest activity.
`POST /approvals/decide {items:[{id,version}], action, reasonCode, note}` decides each item on its own and answers a
result per item ("Approved", "Already approved by J. Cruz at 10:32."). `POST /approvals/:id/remind` lets the submitter
remind the eligible approvers once per `remittance.reminder_interval_hours` (4); a second reminder too early answers
409 `REMINDED` "Reminded 10:15 · next from 14:15" (with the date when it is not today). Instants are ISO (UTC); "today" and
the SLA ages are taken in the business time zone (`general.timezone`). Agency bills are not on the inbox.

Activity log and print: `activity.js#remittanceActivity` builds the log of a remittance, oldest first, from its audit
rows and those of its lines, the decisions on its approval (with level, limit at decision and its source, and the
reason, from the approval history; a decision kept only on the history is shown too), the approval of the settlement
that settled it, the payment voucher raised for it with the audit of the voucher, its bank payment batches and its
cheques, and the e-mails sent about it. The same action by the same user within 2 seconds is one entry. Each entry
carries the action code and label, the user's display name and roles, the status move (from / to, labelled by
`remittance.status_labels`), the remarks and the other changed fields (`lib/auditEvents.js#activityEntries`); the
fields of earlier releases (`action`, `by`, `at`, `notes`) are kept. GET `/remittance/remittances/:id/activity` answers
it (`format=xlsx`: Download log), and GET `/remittance/remittances/:id` returns it as `activityLog` with the record's
`version`, `decision` and `nextStep`. GET `/remittance/remittances/:id/pdf` is the remittance advice of earlier
releases on the broker letterhead (`documents/templates.js#remittanceAdviceDoc`, signature slots of document
type `remittance-advice`); an agency bill prints with its own title.

Remittances register (`register.js`): `GET /remittances?segment=my-work|drafts|in-approval|in-payment|all` lists
direct-bill remittances only (agency bills never appear), filtered by coverage week (a Monday; the week of
`data.windowFrom`, else of the remittance date), insurer, product line, source (`data.source`: weekly-run, run-now,
import; a schedule run without one is weekly-run, anything else manual), status (segment All), a KPI card (`kpi`) and
`q` (REM, policy or OR number), paged and sorted on the server. Segments use today's statuses: My work and Drafts are
draft and rejected (labelled Returned for TISPH), In approval is for-approval, In payment approved and settled; My work
is empty for a user without `write:remittance`. Each row carries the status code and label, the flags (off-cycle with
the reason of `data.offCycleReason`, overdue: due date passed and not settled with a paid voucher, open exceptions), the
next step (a pending one: "Awaiting J. Cruz" or "Awaiting remittance approver (2)", from `decision.js`; a draft "Submit
for approval"; a returned one "Correct and resubmit" with the reason; an approved one "Include in a settlement"; a
settled one the voucher's step in Disbursement) and `actions[]`: view, submit (draft or returned, `write:remittance`;
disabled with the reason when the guards of `validateRemittances` fail), the schedule downloads (not cancelled), the
advice (settled) and open voucher (`read:disbursements`). Approve and reject are never row actions; they are the
decision block's. The answer carries `totals` of the filtered set, the four KPI figures (to submit, awaiting approval,
approved not paid with the oldest days, overdue) and the segment counts over the filters, all in SQL. Without
`segment` the route answers the list of the earlier screens. `GET /remittances/:id` adds to the details the register
row, the lines with the values of an import, the payment through the settlement voucher (voucher, method, value date,
bank reference, settlement), the downloads and `approval` (`approvals.js#recordApproval`: the pending approval, else
the latest decided one, with its level, SLA, reminder state, outcome with the limit at decision and its source, the
checks while pending and the approve / reject / remind actions; null before the first submission); its `status` stays the label of the earlier screens (`statusCode`,
`statusLabel` are the contract). `POST /remittances/submit {items:[{id,version}]}` checks each draft on its own (version,
status, guards) and submits the ready ones as one processing batch; the result per item is "Submitted" or the reason
(`ALREADY_SUBMITTED` "REM-2026-00021 was submitted by J. Cruz at 10:12.", `STALE`, `WRONG_STATUS`, `INVALID`).
`GET /remittances/export.xlsx` writes every column of the filtered set under the letterhead and the filter summary.

Documents (`documents.js`), named `<Ref>_<Document>_<yyyymmdd>.<ext>`: `GET /remittances/:id/schedule.xlsx` and
`schedule.pdf` (A4 landscape; company, "Remittance Schedule", insurer, product line, coverage date, REM no and date,
one row per policy with the columns today's lines hold, totals and the note that it is valid without signature; the per-peril premium,
remitting and commission columns of the FRS layout come with the Phase 2 line data) and `advice.pdf` (portrait letter:
insurer's name, address and TIN; REM no, coverage week, product line, basis; voucher no, method, value date and bank
reference of the settlement voucher; total premium, commission, VAT and EWT on commission from the voucher's payables,
due to insurer, refund credits netted on the voucher, amount paid). `GET /remittances/:id/pdf` of Tracking stays.

Import policy list (`imports.js`, migration 0402): the file selects policies and BrokerVerse computes every amount.
`GET /imports/template` (Data, Columns with the active insurer codes and the product lines, Instructions), `GET
/imports/limits` (IMPORT_MAX_MB, `remittance.import_max_rows`), `POST /imports/validate` (multipart file and
`purposeCode`, a `remittance_off_cycle` reason): a file above the limit or of another type is refused with "Choose an
.xlsx or .csv file of at most 10 MB.", a missing column with "Column Policy No not found."; otherwise the file, its
SHA-256 hash and one result per row are kept under IMP-yyyy-nnnn (validated) and nothing is created. Row results:
Ready, Ready · Variance (Expected Due to Insurer differs from the system amount by more than PHP 1.00), Already on REM,
Not found, Not issued, Insurer differs, Product line differs, Direct bill, Duplicate in file. `GET /imports`, `GET
/imports/:id` (counts, the remittances to create per insurer and product line with their basis, the same committed
file), `GET /imports/:id/rows?result=`, `GET /imports/:id/errors.xlsx` (the file's columns plus Result and Message, one
row per file row), `GET /imports/:id/file` (the file as uploaded, read:remittance; Import history), `POST /imports/:id/commit {version}`: one draft per insurer and product line from the ready rows, at the
system amounts (`buildLines`), with `data.source` import, `importId`, `importNo` and `offCycleReason`; each line keeps
`expected_due`, `variance` (system minus expected), `insurer_reference` and `remark`; a policy remitted since the
validation is skipped ("Skipped: already on REM-..."); the draft's activity log reads "Imported from IMP-...". A file
whose hash was committed before is refused (409 `SAME_FILE`), and a validated import not committed within 7 days counts
as discarded. `POST /imports/:id/discard`. The bulk upload of earlier releases (`/bulk/template`, `/bulk/upload`,
`/bulk/:id/process`) answers 409 `USE_IMPORT` while `remittance.bulk_upload_enabled` is off (TISPH), and creates its
drafts at the booked amounts of the policies, never at typed ones.

Schedules and runs (`runs.js`, migration 0403): a schedule (remittance-schedule master, Setup > Schedules) names its
kind, the insurers or all active ones (`allInsurers`), the frequency, the next run date and time (`runTime`), the
grouping (stored for Phase 2) and the payment window: "Previous Monday to Friday" (the week before the run date; it
needs the frequency Weekly and a Monday as next run, else 400 with `errors[0].code` MSG-RMT-007) or "Cut-off days"
(policies incepted up to `cutOffDays` before the run date). New codes come from the `remittance_schedule` series
(SCH-001, SCH-002 ...); creation, edits (before and after), pause and resume are audited. The schedules have no timer of
their own: the job `remittance-schedules` of Master > Schedules (handler `remittanceSchedules`, daily 06:15, disabled
until switched on) runs the active schedules whose next run date has come, in the business time zone, and moves the
date on by the frequency. `GET /schedules` answers `automation { jobEnabled, checkedDaily, timeZone, lastCheckAt,
lastStatus }` (the cron and the job link for administrators only) and per schedule its covers ("All active (4)"), runs
("Mondays 06:15"), next run (none while paused), `lastRun { at, result, counts, message, trigger }` and the row menu of
the caller (`actions`: View; with `write:remittance` Edit, Preview run, Run now and Pause or Resume, Run now disabled
with its reason, PAUSED or WINDOW_DONE, while the schedule is paused or its current window has a run).
`POST /schedules/:id/preview` is a dry run: per insurer the policies ready and the amount due, "Draft will be created"
or "Nothing to remit", and `windowDone` when the window was run. `POST /schedules/:id/run {reasonCode, note}` is Run now
(`write:remittance`, a `remittance_off_cycle` reason). Every run, by the job or by a user, is a row of
`remittance_runs` (window, counts, drafts, result success / nothing / failed, message MSG-RMT-008 "Weekly run done: 3
remittance(s) created, 0 policies held, 0 exceptions."); a window has one run that did not fail (a unique index), so a
second run answers 409 `WINDOW_DONE` "This week's run is done (12/10/2026 06:15). Next run Mon 19/10/2026 06:15." and
the job skips the schedule and moves its next run on. The drafts carry `data.source` (weekly-run for the job, run-now),
`runId`, the window and the off-cycle reason; their activity log reads "Created by Run now (TIS-WEEKLY)". `GET
/schedules/:id/runs` is the run history, `GET /schedules/:id/activity` the schedule's changes and runs. Held policies
and exceptions are 0 until the Phase 2 eligibility (R1 selects by inception date and groups per insurer).

Insurer payments (`payments.js`): `GET /payments?segment=to-pay|in-payment|paid|failed|all` (insurer, value date range,
method, `q` on PV, REM, batch or bank reference) lists the vouchers of source `insurer-remittance` with the remittance
of the settlement that raised them. The state comes from the voucher, its latest line on a batch that is not cancelled
and its latest cheque (a cheque written by a bank file result is the bank payment): To pay (a draft voucher too, next
step "Submit voucher (Disbursement)"), In payment, Paid, Failed (line rejected or cheque cancelled; next step "Re-batch
or pay by cheque" with the bank's reason). The payee account is masked ("···4821", chip On file / No account); a row is
`selectable` for a batch when it is To pay or Failed, the voucher can go on a batch (`bank_payments.allow_draft_vouchers`)
and the account is on file. `batching { allowed, code, reason }`: `NO_PERMISSION` without `write:disbursements`,
`NO_LAYOUT` ("No Metrobank layout configured. Pay by cheque or ask the administrator.") while no active layout exists for
the bank of `remittance.payment_bank_code`; paying by cheque stays possible. The answer has the totals of the filtered
set, the KPI figures (to pay, in payment, paid this week, failed) and the segment counts. `GET /payments/:voucherId`
is the payment record: Payee, Payment, Amounts (due to insurer, refund credits, voucher and bank amount, check Pass /
Difference), Links, Approvals, the timeline and the activity of the voucher, batch and cheques. `GET
/payments/:voucherId/account` gives the full account number (`write:disbursements`) and audits the reveal
(`payee_bank_account` / `reveal`). `GET /payments/export.xlsx` (Export XLSX) holds every payment of the segment and
filters, not one page, with the account masked. It creates no payment and posts nothing.

Electronic transfers (`remittance.transfers_enabled`, TISPH off): `POST /transfers` and `POST /transfers/:id/execute`
answer 409 `TRANSFERS_OFF` "Electronic transfers are replaced by Insurer payments.", and approving a pending transfer
approval is refused the same way (it would post `remittance.transfer`); rejecting it stays possible. `GET
/transfers?legacy=1` and `GET /transfers/:id` show the TRF- items read-only with the approval, the journal posted at
approval and its reversal ("Not reversed").

Summary (`summary.js`): `GET /summary` answers per user the counts of the menu entries (Remittances: My work;
Approvals: awaiting my decision; Insurer payments: to pay, `write:disbursements` only; Reconciliation: my draft insurer
statements and the submitted ones I may approve; Exceptions: assigned to me, `GET /exceptions?assignedTo=me`; Insurer
billing: my draft debit notes and the overdue ones, `GET /direct-bill?attention=mine`; Setup: 0), each the total of the
list it opens; the run strip (last run, next run, automation On / Off) and the landing (Approvals, Exceptions or
Remittances > My work).

Exceptions: `POST /exceptions/:id/escalate` takes a reason of the `exception_escalate` context (`{ reasonCode, note }`,
validated with the Reason Codes master; the note is required when the reason asks for one) and keeps its text in
`data.escalationReason` and its code in `data.escalationReasonCode`. Assign and resolve are unchanged.

## Key settings

`remittance.approval_levels` (fallback only), `remittance.require_authority_limit` (default false, TISPH true),
`remittance.item_delegation_enabled` (default true, TISPH false), `remittance.reminder_interval_hours` (4),
`remittance.import_max_rows` (5000), `remittance.bulk_upload_enabled` (default true, TISPH false),
`remittance.transfers_enabled` (default true, TISPH false), `remittance.payment_bank_code` (MBT: the bank whose payment
file layout batches insurer vouchers),
`remittance.priority_thresholds`, `remittance.priority_sla_hours`,
`remittance.default_due_days` (due date of a new remittance when the insurer has no `remittance_terms_days`), `remittance.transfer_methods`, `remittance.status_labels` (TISPH: rejected "Returned", settled "Settled (voucher raised)"),
`remittance.advice_title` / `remittance.agency_bill_title` (titles of the printed remittance advice and agency bill),
`remittance.default_basis`, `remittance.basis_rules` (`[{ "insurer": "MALAYAN", "product": "MOTOR", "basis": "gross" }]`; the most
specific matching rule wins), `remittance.bill_email_subject` / `_body`, `remittance.statement_email_subject` / `_body`,
`remittance.reconciliation_bank_account`, `remittance.reconciliation_tolerance`, and the `direct_bill.*` group
(default billing mode, VAT registration, insurer EWT rate, debit note due days, e-mail text, client payment required
before approval).

## Debugging

- A settlement was approved but no voucher appeared: the policies had no collected premium awaiting remittance. The
  approval result says so (`voucherNote`). Check the receipts of the policies and `remittance_allocations`.
- "Maker-checker: ... must be approved by a different user": the approver created or submitted the item. Another
  finance user approves, or `finance.maker_checker_enabled` is switched off (small offices only).
- A direct-bill policy has no premium bill: that is expected. Direct-bill policies are billed by the insurer, so the
  broker has no receivable and no collection reminders.
- Templates on the screens: Bulk Processing downloads the workbook of its configuration's field mappings
  (`GET /remittance/bulk/template?configCode=`), Reconciliation the CSV of the bank transactions import
  (`GET /remittance/reconciliation/bank-transactions/template`). The bank transactions import is checked as a whole: a
  line without a date, reference or amount refuses the file and nothing is imported.
- The Remittance > Reconciliation screen matches bank transactions for remittances only. The bank reconciliation of the
  cash accounts is the separate bank-reconciliation module.
- "... is above your approval limit": the approver's Authority Matrix limit for `remittance` or
  `remittance_settlement` is below the amount. A user with a higher limit approves, or the limit is changed (and
  approved) in Master > User Management > Authority Matrix.
- "You have no approval limit for Remittance approval": `remittance.require_authority_limit` is on and the user has
  no limit for the type, neither their own, nor a role's, nor one delegated to them today. Add (and approve) a limit in
  the Authority Matrix, or record a dated delegation from an approver in Master > User Management > Delegations.
- A user sees the approvals but no decision: they lack `approve:remittance` (preparers such as TIS CCD-Recon).
- A remittance shows "No eligible approver": nobody active holds `approve:remittance` with a limit covering the
  amount (other than its submitter and maker). Add or raise a limit in the Authority Matrix, or record a delegation.
- A decision is refused `STALE` (409): the approval was decided at another level or delegated since the screen loaded
  it. Reload and decide again.
- An import cannot be created: "This file was imported on ... as IMP-..." means the same file (same hash) was
  committed before; its drafts are listed on that import. "No row is ready to remit." means every row has an error:
  download the error report. A validated import older than 7 days is discarded: validate the file again.
- Bulk Processing answers "Bulk processing is replaced by Import policy list on Remittances." while
  `remittance.bulk_upload_enabled` is off (TISPH).
- Run now answers "This week's run is done (...)": the window already has a run that did not fail (`remittance_runs`).
  An off-cycle catch-up goes through Import policy list. A failed run (result failed, with its message) frees the window.
- Insurer payments cannot batch ("No Metrobank layout configured"): no active bank file layout exists for the bank of
  `remittance.payment_bank_code` (Master > Finance > Bank File Layouts). Pay by cheque in Disbursement meanwhile.
- A transfer answers "Electronic transfers are replaced by Insurer payments.": `remittance.transfers_enabled` is off
  (TISPH). Pay the voucher from Insurer payments.
