# Remittance

Paying premium collected from clients over to the insurers, billing insurers for commission on direct-bill
policies, and the remittance work items around them (settlements, adjustments, transfers, statements, exceptions,
approvals). Routes are under `/remittance` (Accounts > Remittance, about 16 screens, and Master > Finance >
Remittance Master). Permissions: `read:remittance`, `write:remittance`.

## Files

| File | What it does |
|---|---|
| `router.js` | All routes. |
| `service.js` | Remittances and bills to insurers and agencies, the approval queue (Authority Matrix limits, maker-checker), automated remittance generation and schedule runs, and the journal of an approved work item (`postItemJournal`). |
| `items.js` | Work items stored in `remittance_items` by kind: settlement, adjustment, transfer, statement, exception, notification, bulk upload, bank transaction; remittance schedules (`runSchedule`, `runDueSchedules`), analytics and history. |
| `directbill.js` | Direct bill: billing mode of a policy, commission booked at issue, commission debit notes (`DN-`), collections from the insurer (`DNC-`) with creditable withholding tax; the commission billing statements of gross-remittance business (`CBS-`). |
| `basis.js` | Remittance basis of broker-billed premium (net or gross) by insurer and product (`remittance.basis_rules`, `remittance.default_basis`). |
| `clientPayments.js` | Direct bill: the client's payment to the insurer (date, amount, insurer OR / reference, proof), the payment status of a policy and the check before a debit note is approved. |
| `insurerCredits.js` | Refunds due from insurers after a return premium on premium already remitted; netted against the next remittance voucher. |

## Main tables

`remittances`, `remittance_lines`, `remittance_items`, `remittance_approvals`,
`remittance_allocations`, `commission_debit_notes`, `commission_debit_note_lines`, `commission_debit_note_collections`,
`direct_bill_items`, `direct_bill_client_payments`, `insurer_refund_credits`. Payment to the insurer is a payment voucher in the disbursements
module (`disbursements`, `invoice_lists`).

## Main flows

Broker-billed premium: the client pays the broker (receipts module). A settlement lists the insurer's policies with
collected premium; when it is approved, `service.js` raises the insurer payment voucher in Disbursement for the
collected premium, net of the commission and the output VAT on it, plus the EWT the insurer withholds on the
commission (`receivables.commission_vat` / `commission_ewt`, pro rata to the premium collected; the invoice list shows
them in `vat` and `wht`). The remittance and settlement lines show the same net as that voucher: the Tax column of a
broker-billed policy line is its commission VAT less the commission EWT as booked on its bills, the automated
processing estimate deducts them too, and the commission rate of a line is shown on the net premium, as booked. The
cheque approval there posts the payment journal. Settlement credit and debit notes post through the posting rule
`remittance.settlement`.

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
agency bills, `remittance_settlement` for settlements, adjustments and electronic transfers. Approving checks the
approver's limit (`assertAuthority`, delegations of Master > User Management > Delegations included); one approval
within the limit decides. Only while the matrix has no limit for the type are the fallback levels of
`remittance.approval_levels` used. The approver must differ from the maker. The `remittance_delegations` table of
earlier releases is no longer read or written.

Activity log and print: GET `/remittance/remittances/:id` returns `activityLog` oldest first, built by
`remittanceActivity` from the remittance's audit rows, the decisions taken on its approval (audited as
`remittance_approval` by approval id) and the approval of the settlement that settled it. Each entry carries the action
code and label, the user's display name and roles, the status move (from / to, labelled by `remittance.status_labels`),
the remarks and the other changed fields (`lib/auditEvents.js#activityEntries`); the fields of earlier releases
(`action`, `by`, `at`, `notes`) are kept. The print icon of Tracking prints GET `/remittance/remittances/:id/pdf`, the
remittance advice on the broker letterhead (`documents/templates.js#remittanceAdviceDoc`, signature slots of document
type `remittance-advice`); an agency bill prints with its own title.

Schedules: Accounts > Remittance > Scheduling (remittance-schedule master) says what to remit: insurers, cut-off days
before the run date, frequency and next run date. The schedules have no timer of their own: the job
`remittance-schedules` of Master > Schedules (handler `remittanceSchedules`, daily, disabled until switched on) runs the
active schedules whose next run date has come, in the business time zone, and moves the date on by the frequency.

## Key settings

`remittance.approval_levels` (fallback only), `remittance.priority_thresholds`, `remittance.priority_sla_hours`,
`remittance.default_due_days` (due date of a new remittance when the insurer has no `remittance_terms_days`), `remittance.transfer_methods`, `remittance.status_labels`,
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
- "... is above your approval authority": the approver's Authority Matrix limit for `remittance` or
  `remittance_settlement` is below the amount. A user with a higher limit approves, or the limit is changed (and
  approved) in Master > User Management > Authority Matrix.
