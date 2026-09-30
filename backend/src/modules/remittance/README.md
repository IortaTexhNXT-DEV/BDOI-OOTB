# Remittance

Paying premium collected from clients over to the insurers, billing insurers for commission on direct-bill
policies, and the remittance work items around them (settlements, adjustments, transfers, statements, exceptions,
approvals). Routes are under `/remittance` (Accounts > Remittance, about 16 screens, and Master > Finance >
Remittance Master). Permissions: `read:remittance`, `write:remittance`.

## Files

| File | What it does |
|---|---|
| `router.js` | All routes. |
| `service.js` | Remittances and bills to insurers and agencies, the approval queue (levels by amount, maker-checker, delegations), automated remittance generation, and the journal of an approved work item (`postItemJournal`). |
| `items.js` | Work items stored in `remittance_items` by kind: settlement, adjustment, transfer, statement, exception, notification, schedule, bulk upload, bank transaction; analytics, reports and history. |
| `directbill.js` | Direct bill: billing mode of a policy, commission booked at issue, commission debit notes (`DN-`), collections from the insurer (`DNC-`) with creditable withholding tax. |
| `clientPayments.js` | Direct bill: the client's payment to the insurer (date, amount, insurer OR / reference, proof), the payment status of a policy and the check before a debit note is approved. |
| `insurerCredits.js` | Refunds due from insurers after a return premium on premium already remitted; netted against the next remittance voucher. |

## Main tables

`remittances`, `remittance_lines`, `remittance_items`, `remittance_approvals`, `remittance_delegations`,
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

Direct bill: the client pays the insurer. At issue the broker books commission receivable from the insurer
(`directbill.commission`). Finance raises a commission debit note for a period, a second user approves it, and
collections from the insurer post `directbill.collection` (cash, creditable withholding tax). The client's payment to
the insurer is recorded on Direct Bill Processing (Client paid insurer column); it posts nothing, and with
`direct_bill.client_payment_required` = `any` or `full` a debit note is approved only when every policy on it has a
recorded payment, or is paid in full.

Approval: every work item that needs approval opens a row in `remittance_approvals`; the levels come from
`remittance.approval_levels` by amount. The approver must differ from the maker.

## Key settings

`remittance.approval_levels`, `remittance.priority_thresholds`, `remittance.priority_sla_hours`,
`remittance.default_due_days`, `remittance.transfer_methods`, `remittance.status_labels`,
`remittance.bill_email_subject` / `_body`, `remittance.statement_email_subject` / `_body`,
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
- The Remittance > Reconciliation screen matches bank transactions for remittances only. The bank reconciliation of the
  cash accounts is the separate bank-reconciliation module.
