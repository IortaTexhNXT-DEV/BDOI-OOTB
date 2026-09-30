# Placement

The broking journey from a client's risk to an issued policy: Broker Slip (ask several insurers for terms), Quotation
Slip (the quotations module), Placement Slip (firm order to the chosen insurers) and policy issuance. Routes are under
`/broker-slips` and `/placements` (Operations > Broker Slips, Placement Slips, Record Issued Policy). Access follows the
quotation permissions (`read:quotations`, `write:quotations`); issuing a policy also needs `write:policies`.

## Files

| File | What it does |
|---|---|
| `router.js` | Both routers: `/broker-slips` (declared as `bs`) and `/placements`. |
| `brokerSlips.js` | Broker slips (`BS-`), the insurers they go to, their offers (`OFR-`), offer comparison, and turning the chosen offers into a quotation or a placement. |
| `placements.js` | Placement slips (`PS-`): send, confirm (bind) per participant, decline, cancel, issue the policy; "Record Issued Policy" for a policy the insurer already issued. |
| `participants.js` | Co-insurance participants shared by broker slips, quotations, placements and policies: one lead, shares total 100%, amounts split by share with the rounding remainder on the lead. |
| `journey.js` | Which steps a product or line of business requires: the default of its business type (package / non-package, Product master; setting `placement.journey_by_business_type`), overridden by `placement.journey`. |

Statuses: broker slip `draft`, `submitted`, `responses-in`, `closed`, `cancelled`; placement `draft`, `sent`, `bound`,
`declined`, `cancelled`, `issued`.

## Main tables

`broker_slips`, `insurer_offers`, `placements`, `risk_participants` (participants of any entity), and on issue the
policy tables (`policies`, `receivables` through the policies and receipts modules).

## Main flows

1. A broker slip is created from a lead or client and submitted to several insurers. Each insurer's answer is saved as
   an offer (premium, rate, taxes, deductibles, validity, the share it writes) or a decline.
2. The offers are compared and the chosen ones become a quotation (`prepare-quotation`) or, when the journey allows,
   a placement (`prepare-placement`).
3. The placement is sent to the lead insurer and co-insurers. Each confirms with its policy or certificate number.
4. When every participant has bound, `issue-policy` issues the policy through `policies/service.js#issuePolicy`, which
   copies the participants and raises the premium bill.

## Key settings

`placement.journey_by_business_type` (steps per business type: package, non_package), `placement.journey` (steps per product
type or line, overriding the business type: required, optional or skip), `placement.journey_applies_to_renewals`,
`placement.lob_keywords` (how a product name maps to a line), `placement.offer_validity_days`,
`placement.editable_statuses`, `placement.quote_statuses`, and the e-mail templates `email.template.broker_slip_request`
and `email.template.placement_order`.

## Debugging

- A step is refused with an error of code `PLACEMENT_JOURNEY`: the journey of the product requires or skips that step.
  `GET /placements/journey?productType=...` shows the journey that applies and its `source` (an entry for the product type or
  line, else the business type of the product, else default).
- Shares do not add up to 100% or two leads: `participants.js` refuses the save with the field that is wrong.
- The policy cannot be issued: a participant has not bound yet, or the user lacks `write:policies`.
- The e-mail to an insurer did not arrive: see Master > E-mail Outbox (`email_outbox`, entity `broker_slip` or `placement`),
  which also says whether e-mail sending is configured.
