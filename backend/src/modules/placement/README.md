# Placement

The broking journey from a client's risk to a policy the insurer issued: Broker Slip (ask several insurers for terms),
Quotation Slip (the quotations module), Placement Slip (firm order to the chosen insurers) and the broker-mediated
issuance chain (TIS-BRD-ISSUE-01 to 03). The broker never issues cover: a policy exists only once the insurer's
e-policy has been received, checked against the slip and booked. Routes are under `/broker-slips` and `/placements`
(Operations > Sales & Marketing > Request for Quotation (Broker Slip), Placement Slips, Record e-Policy). Access follows
the quotation permissions (`read:quotations`, `write:quotations`); booking the policy, and accepting an e-policy that
differs from the slip, also need `write:policies`.

## Files

| File | What it does |
|---|---|
| `router.js` | Both routers: `/broker-slips` (declared as `bs`) and `/placements`. |
| `brokerSlips.js` | Broker slips (`BS-`), the insurers they go to, their offers (`OFR-`), offer comparison, and turning the chosen offers into a quotation or a placement. |
| `placements.js` | Placement slips (`PS-`): raised (automatically on acceptance), slip PDF stored, sent with the slip attached, acknowledged, e-policy recorded, compared with the slip, checked (maker-checker), booked; decline and cancel. |
| `participants.js` | Co-insurance participants shared by broker slips, quotations, placements and policies: one lead, shares total 100%, amounts split by share with the rounding remainder on the lead. |
| `productLines.js` | The active products grouped by line of business (`GET /placements/product-lines`, read by the product picker of every screen where a product is chosen for a prospect, a quotation or a placement: line of business first, then its products), and the check that a product chosen for a line belongs to it (prospects, quotations, broker slips). |
| `journey.js` | Which steps a product or line of business requires: the default of its business type (package / non-package, Product master; setting `placement.journey_by_business_type`), overridden by `placement.journey` (an entry for the product type, product code or name, or the line). |

Statuses: broker slip `draft`, `submitted`, `responses-in`, `closed`, `cancelled`; placement:

| Status | Label (`placementStatus`) | Reached by |
|---|---|---|
| `draft` | Placement raised (PlacementRaised) | `POST /placements`, `prepare-placement`, or the client accepting the quotation (`autoRaisePlacement`) |
| `sent` | Sent to insurer (SentToInsurer) | `POST /:id/send` (one e-mail per participant, its placement slip PDF attached) |
| `acknowledged` | Acknowledged | `POST /:id/acknowledge`, or a check returned to the insurer |
| `epolicy_received` | e-Policy received (EPolicyReceived) | `POST /:id/epolicy` (uploaded file and the ISSUE-02 figures; compared with the slip at once) |
| `checked` | Checked against slip (CheckedAgainstSlip) | `POST /:id/check` with `confirm` (matches) or `accept` (differences, with a reason, `write:policies`) by another user holding `approve:policies` |
| `issued` | Insurer issued (InsurerIssued) | `POST /:id/book`: the only way the policy is created |
| `declined`, `cancelled` | Declined, Cancelled | `POST /:id/decline`, `POST /:id/cancel` |

Source `direct-policy` (and the `bound` status, migrated to `acknowledged` by `0342_tisph_placement_chain.sql`) belong
to placements recorded before the chain; Record Issued Policy no longer exists.

## Main tables

`broker_slips`, `insurer_offers`, `placements` (with the acknowledgement, the `epolicy` figures and file, the
`check_result` of the comparison and the check decision), `risk_participants` (participants of any entity), and on
booking the policy tables (`policies`, `receivables` through the policies and receipts modules). The placement file and
the e-policy are `documents` rows (entity `placement`).

## Main flows

1. A broker slip is created from a lead or client and submitted to several insurers. Each insurer's answer is saved as
   an offer (premium, rate, taxes, deductibles, validity, the share it writes) or a decline.
2. The offers are compared and the chosen ones become a quotation (`prepare-quotation`) or, when the journey allows,
   a placement (`prepare-placement`).
3. When the client accepts a quotation (approval link, customer response or status change to a status in
   `placement.auto_raise_statuses`), the placement slip is raised automatically if its journey requires one; the slip
   PDF is stored (`storeSlipDocument`). One open placement per quotation; a failure is notified to the quotation's owner.
4. The placement is sent to the lead insurer and co-insurers, each with its own slip (`emailDocuments.js`
   `placement-slip`) and, for a direct CTPL, the LTO document. The insurer acknowledges it.
5. The e-policy is recorded with both policy numbers, participant name, sum insured, premium, commission and the
   issue / issuance / effective / production dates; motor registration (plate or MV file) is required even where the
   quotation said TBA. Only a motor or CTPL placement (lob MOTOR) keeps vehicle identifiers and a vehicle photo; on
   another line they are dropped and the check has no vehicle items. `compareWithSlip` lists the differences beyond
   the tolerance.
6. Another user confirms the check, an approver accepts the differences with a reason, or the e-policy goes back to the
   lead insurer (`email.template.placement_discrepancy`) and the placement waits for a corrected one.
7. `book` issues the policy through `policies/service.js#issuePolicy` (participants, bill or direct-bill commission,
   journal, commission accrual, renewal link for a renewal quotation), ends the cover notes and queues the policy
   schedule with the e-policy to the client's e-mail (`email.template.policy_schedule`).

## Key settings

`placement.journey_by_business_type` and `placement.journey` (steps per business type, product or line: required,
optional or skip; every TISPH line requires the placement slip, Motor the quotation), `placement.journey_applies_to_renewals`,
`placement.auto_raise`, `placement.auto_raise_statuses`, `placement.check_fields`, `placement.check_tolerance_amount`,
`placement.check_tolerance_pct`, `placement.check_maker_checker`, `placement.schedule_email_on_booking`,
`placement.direct_document_products`, `placement.lob_keywords`, `placement.offer_validity_days`,
`placement.editable_statuses`, `placement.quote_statuses`, and the e-mail templates `email.template.broker_slip_request`,
`email.template.placement_order`, `email.template.placement_discrepancy` and `email.template.policy_schedule`.

## Debugging

- A step is refused with an error of code `PLACEMENT_JOURNEY`: the journey of the product requires or skips that step.
  `GET /placements/journey?productType=...` shows the journey that applies and its `source` (an entry for the product type or
  line, else the business type of the product, else default).
- An accepted quotation has no placement: `placement.auto_raise` is off, its status is not in
  `placement.auto_raise_statuses`, its journey does not require a placement slip, or the raise failed (the owner has a
  "Placement slip not raised" notification with the reason).
- Shares do not add up to 100% or two leads: `participants.js` refuses the save with the field that is wrong.
- The check cannot be confirmed: the same user recorded the e-policy (maker-checker), or `GET /placements/:id/check`
  lists a difference beyond the tolerance.
- The policy cannot be booked: the placement is not `checked`, the KYC items of `policy.kyc_required_fields` are
  missing, or the user lacks `write:policies`.
- The e-mail to an insurer or the schedule to the client did not arrive: see Master > E-mail Outbox (`email_outbox`,
  entity `placement` or `policy`), which also says whether e-mail sending is configured.
