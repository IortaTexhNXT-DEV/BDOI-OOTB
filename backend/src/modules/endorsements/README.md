# Endorsements

Mid-term changes and cancellations of a policy (Operations > Policy > Endorsement), routes under `/endorsements`.
Access: `read:endorsements`, `write:endorsements`; approving, and booking money going back, need `approve:policies`.

## Files

| File | What it does |
|---|---|
| `router.js` | The `/endorsements` routes. |
| `service.js` | Create (coverage changes priced on the server), send to the client and the insurer, book (`completeEndorsement`: policy updated, bill or return premium, commission). |
| `workflow.js` | The broker-mediated flow (TIS-BRD-ENDT-02), endorsement types (M12, ENDT-01), the pro-rata term (ENDT-03), policy versions. |

## Flow (migration 0482)

Draft -> `POST /:id/submit-for-approval` (PendingApproval; needs the endorsement types, `endorsements.types_required`)
-> `POST /:id/approve` or `/reject` with a reason code of `endorsement_reject` (`approve:policies`, never the raiser; a
return premium within the `return_premium` authority limit) -> send to the client and the insurer
(`/send-endorsement-to-customer/:id`, `/initiate-cancel-policy/:id`; only once approved when
`endorsements.approval_before_send`) -> `POST /complete-endorsement` (only once sent, with the insurer's endorsement
number, `endorsements.complete_needs_insurer`; never by the raiser, `endorsements.complete_maker_checker`). The booking
keeps the policy before and after on the endorsement (`completion.policyBefore`, `policyAfter`;
`GET /policies/:id/versions`) and e-mails the client the endorsement (`endorsements.notify_client_on_booking`,
`email.template.endorsement_booked`). `GET /:id` returns the steps open to the user (`workflow`). Flows that raise and
book their own endorsement (fleet schedules) call the service without an approver and are not held by these steps.

## Endorsement types

Master `endorsement-type` (seed `95_tisph_quote_policy.sql`, the TISPH M12 list): financial flag, premium impact, lines
(`*` = all) and section. `GET /types?policyId=` lists those of the policy's line; a line of
`endorsements.non_financial_lines` (Credit Life) gets no financial type. `PUT /:id/types` sets them on a draft; a premium
change needs a type with premium impact. Several types on one endorsement are one grouped endorsement (ENDT-04), printed
by section.

## Pro-rata and cancellation

With `endorsements.prorata` a coverage change is the annual difference times unexpired days / days of the period from
the effective date; `premiumChange.prorata` keeps the days, the factor and the annual change. A cancellation needs a
note (`endorsements.cancellation_note_required`); TISPH returns pro-rata whoever cancels
(`endorsements.short_period_for_insured` off) and takes back no commission
(`endorsements.cancellation_reverses_commission` off, CANC-03).

## Insurer commission (TIS-BRD-COMM-07, migration 0649)

The commission / service fee the insurer calculated on an endorsement is recorded before booking, on one endorsement
(`PUT /endorsements/:id/insurer-commission`) or by a bulk CSV / XLSX file with the columns Endorsement No and Commission
(`POST /endorsements/insurer-commission/upload`, a result per row). Booking takes it as the commission of the premium
change instead of the policy commission ratio; with `endorsements.insurer_commission_required` (off) a financial
endorsement is not booked without it.
