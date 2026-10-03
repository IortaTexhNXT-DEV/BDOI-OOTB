# Credit control

Premium on credit for broker-billed policies: instalment plans, the premium warranty monitor, client credit limits and
the ageing of premium collected but not yet remitted to insurers. Routes are under `/credit-control` (Accounts > Credit
Control). Permissions: `read:collections` to view, `write:collections` to save plans, send reminders and request
extensions or cancellations, `approve:credit-control` (Accounting Manager) to approve warranty extensions and to set
client credit limits. The remittance ageing also opens with `read:remittance`.

## Files

| File | What it does |
|---|---|
| `router.js` | All routes. |
| `instalments.js` | Schedule generation, saving and cancelling plans, allocation of payments to instalments, the bill's due date, instalment ageing. |
| `warranty.js` | Premium warranty monitor, reminders, extension requests and approvals, cancellation requests for non-payment. |
| `limits.js` | Client credit limits, exposure, the check made when a policy is issued and the exceptions list. |
| `remittanceAgeing.js` | Collected premium not yet on an approved insurer voucher, aged on the insurer's remittance terms. |

## Main tables

`premium_instalment_plans`, `premium_instalments`, `premium_warranty_extensions`, `premium_warranty_actions`,
`clients.credit_limit`, `client_credit_exceptions`.

## Main flows

- Instalment plan: one premium bill (receivable) split into instalments. The ledger still has one receivable; payments
  on the bill are allocated to the instalments in order. After a plan is saved and after every payment on the bill
  (`receipts/receivables.js`), the bill's due date becomes the due date of its first unpaid instalment, so collections,
  reminders and the receivable ageing follow the plan.
- Premium warranty: deadline = policy inception + the insurer's `premium_warranty_days` (else
  `collections.default_credit_days`), moved by an approved extension. Premium due = the open premium, or on a plan the
  instalments already due. A cancellation request is a draft cancellation endorsement for Operations; the monitor never
  cancels a policy.
- Credit limit: checked in `policies/service.js issuePolicy` after the bill is created. Going over the limit does not
  stop the issue; it records a `client_credit_exceptions` row and notifies users with `write:collections`.
- Remittance terms: a remittance created for an insurer is due `remittance_terms_days` after its date (else
  `remittance.default_due_days`), and the remittance ageing uses the same terms from the collection date.

## Key settings

`credit.instalment_frequencies`, `credit.default_instalment_count`, `credit.max_instalment_count`,
`credit.warranty_warning_days`, `credit.max_warranty_extension_days`, `credit.check_credit_limit`,
`limits.receivable_ageing_buckets` (ageing columns), `collections.default_credit_days`, `remittance.default_due_days`.

## Debugging

- A plan is refused with "The instalments add up to ...": the edited amounts must equal the whole bill, including what
  was already paid.
- A policy does not show on the warranty monitor: it is direct billed, not issued / active, has no open bill, or is
  still within its warranty (choose status "all").
- The remittance ageing still shows a collection after the voucher was raised: the voucher's cheque is not approved yet.
