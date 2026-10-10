# Claims

A client's claim from the first notice of loss to its settlement (TIS-BRD-CLAIM-01 to 08): registration with the
acceptance checks, the insurer's advice, documents, review, adjuster, assessment, settlement (partial or final) with
maker-checker approval, payment through the broker, rejection and cancellation. Routes are under `/claims`
(Operations > Claims). Access: `read:claims`, `write:claims`; `process:claims` moves a claim to review and submits its
settlement for approval (TISPH Operations roles); `approve:claims` decides: rejects, cancels, closes, approves and releases
a settlement (never the user who submitted it); `write:claim-funds` records funds received from the insurer; `reverse:claim-cash` reverses a cash
movement recorded in error (never the user who recorded it). Records follow the record scope of the user.

## Files

| File | What it does |
|---|---|
| `router.js` | The `/claims` router, including `GET /registration-check`, `PUT /cancel/:id` (reason `claim_cancel`), `PUT /:id/insurer-advice`, `POST /:id/verify-death`, `GET`/`POST /:id/communications`, `POST /:id/communications/:commId/done`, `POST /:id/insurer-follow-up` and the claims reports. |
| `service.js` | The claim record and its lifecycle (`registered`, `in-review`, `pending-approval`, `approved`, `partially-settled`, `settled`, `closed`, `rejected`, `cancelled`). Registration: future loss date refused, duplicate of the same policy and loss date refused unless confirmed (`claims.duplicate_check`), late intimation recorded and alerted, handler picked among `claims.assignment_roles` by fewest open claims. Settlement rows in `claim_settlements`; approval of an amount up to the amount requested, within the approver's `claim_settlement` limit when `claims.require_authority_limit` is on. Requested and approved by are display names (ids in `*ById`). Rejection e-mails the client (`email.template.claim_rejection`). |
| `intake.js` | Estimate parsing, follow-up days by line, line and loss extent, or product (`claims.followup_days`), late intimation (`claims.late_intimation_days`), duplicates, death benefit products (`claims.death_benefit_products`), claims ratio of the client. |
| `insurer.js` | Insurer advice (`claims.insurer_advice_statuses`), death verification, communication log, follow-up e-mail to the insurer, and the daily job `claim-service-levels` (alerts for overdue follow-ups, claims past due and authorisations not received within `claims.authorisation_days`). |
| `cash.js` | Settlement funds and payments to the claimant through the broker; reversed movements do not count; payment from funds received when `claims.pay_claimant_from_funds` is on; reversal with a reversing journal. |
| `util.js` | Dates shown dd/mm/yyyy, the Authority Matrix check, communication parties and methods. |

## Data

`claims` (FNOL source, loss extent, late intimation, insurer handler, advice, offer, authorisation code, death
verification, cancellation), `claim_settlements` (seq, partial or final, amount, approved amount, status `pending`,
`approved`, `returned`, requested and decided by), `claim_communications` (party, direction, method, message, follow-up
date and completion), `claim_settlement_movements` (reversal columns), `claim_history`.

The Claims Position report (Reports > Operational Reports > Claims) has the criteria All, Open, Partial, Settled,
Rejected, Cancelled, Aging and Claim Type.
