# Receipts

Official receipts and the application of payments to premium bills, with what the Cash Control of TISPH needs around
them: bulk and matched uploads, unapplied collections, reversals with a checker and the billing statements of bills.
Routes are under `/receipts` and `/billing-statement` (Accounts > Receipts, Accounts > Unapplied Collections). Permissions:
`read:receipts`, `write:receipts` (issue, upload, allocate, refund an unapplied amount), `reverse:receipts` (ask for a
reversal), `approve:receipt-reversal` (decide a reversal another user asked for).

## Files

| File | What it does |
|---|---|
| `router.js` | All routes. |
| `service.js` | Receipts: create, update, add payment, list, search, open bills to collect (by client, policy, bill, 10-digit payment reference, plate or chassis number), proof of payment, cancellation (`cancelReceipt`). |
| `receivables.js` | Bills and their booking journal, applying a payment (`receipt.apply`, `pdc.partner_collected`, `receipt.insurer_direct`, `unapplied.allocate`), the excess of a payment (held On Account or billed), reversal of applications, payment status of a policy. |
| `reversal.js` | Receipt reversal: asked with a reason, approved or returned by a second user, then the receipt is cancelled. |
| `unapplied.js` | Unapplied collections: excess, floating and advance payments held in the clients' deposits account, allocated to bills or refunded, with the date to allocate them by. |
| `batches.js` | Receipt voucher batches (`RVB-`): each bulk upload, with the commission part of combined rows kept apart. |
| `bankPayments.js` | A bank's report of payments matched by reference within the tolerance; payments made directly to the insurer. |
| `billing.js` | Billing statements and invoices of policies, endorsements, renewals and bills (PDF). |
| `email.js` | E-mail of receipts and bills. |
| `opening.js` | Go-live open items. |

## Main tables

`receipts`, `receipt_lines`, `receipt_applications`, `receivables`, `unapplied_collections`, `unapplied_allocations`,
`receipt_batches`, `bank_payment_lines`; `policies.payment_reference` (migrations 0524 and 0528 to 0531).

## Main flows

- A payment above what the policy owes is held On Account (`receipts.excess_handling` on-account): Dr cash / Cr
  clients' deposits and unapplied collections (`receipt.unapplied`), to allocate within `collections.unapplied_sla_days`
  working days (My Work lists it) or to refund with a reason of `unapplied_refund` (`unapplied.refund`).
- Reversal: `POST /receipts/:id/reversal` with a reason of `receipt_reversal`; with `receipts.reversal_requires_approval`
  another holder of `approve:receipt-reversal` approves (`/reversal/decision`) or returns it with a reason of
  `receipt_reversal_reject`. Approval cancels the receipt, reverses its journals and its unapplied holds.
- Bank payments: each line is matched by its reference; within `bank_matching.tolerance` it is receipted in full, above
  it the excess is held On Account, below it the line is an insufficient payment, with no policy it is a floating
  payment. Insurer-direct payments are receipted with `payment_channel` insurer-direct.
- Receipt voucher batches: `receipts.batch_commission_handling` separate keeps the Commission Amount of a row apart on
  the batch (exported for Accounting) and receipts the premium; refuse refuses the row.

## Key settings

`receipts.excess_handling`, `collections.unapplied_sla_days`, `accounting.account.unapplied_collections`,
`receipts.reversal_requires_approval`, `receipts.batch_commission_handling`, `bank_matching.tolerance`,
`policy.payment_capture_proof_required`, `payments.verification_notify_roles`, `limits.bulk_upload_max_rows`.
