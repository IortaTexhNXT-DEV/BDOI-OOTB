# Post-dated cheques

The post-dated cheques of TISPH's clients (TIS-BRD-COLL-05, FRS COLL-05): encoded in sets against the instalments of a
bill, forwarded to the Insurance Partner for warehousing or kept by TISPH and deposited, followed up until each is
collected, bounced, cancelled, replaced or returned. Routes are under `/pdc` (Accounts > Post-Dated Cheques).
Permissions: `read:pdc`, `write:pdc` (encode, forward, record partner advices, deposit, request cancellations,
replace, return; the deposit and the partner's clearing raise the cheque's receipt), `approve:pdc` (decide a
cancellation another user asked for).

## Files

| File | What it does |
|---|---|
| `router.js` | All routes, the transmittal export and the acknowledgement receipt of a set (PDF). |
| `service.js` | The log (tabs, filters, ageing, summary), a cheque, the single-cheque register, deposit, clear, bounce and replace of cheques payable to TISPH, the deposit-due job. |
| `lifecycle.js` | Sets (`PCS-`) against the instalments of a bill, transmittals (`PT-`) to the Insurance Partner, partner received / cleared / bounced / returned, cancellation with a reason and a second user's approval (pull-out when the partner holds the cheque), replacement within the set, return to the client, the follow-up job. |
| `jobs.js` | Job handlers `pdcDepositDue` and `pdcFollowUp`. |

## Main tables

`post_dated_cheques`, `pdc_sets`, `pdc_transmittals` (migration 0520).

## Main flows

- Payee Insurance Partner: on-hand -> forwarded (transmittal) -> warehoused (partner received) -> cleared (an
  acknowledgement receipt is raised and posted `pdc.partner_collected`: Dr premium payable / Cr premium receivable) or
  bounced (the receipt is cancelled, the instalment opens again).
- Payee TISPH: on-hand -> deposited (to `pdc.default_deposit_account`, the one collection account) -> cleared or bounced.
- Cancellation: requested with a reason of the context `pdc_cancel`; approved by another holder of `approve:pdc`.
  Bounce reasons: context `pdc_bounce` (seed `92_cash_control.sql`).
- Nothing is posted when a cheque is received; a set prints its acknowledgement receipt for the client.

## Key settings

`pdc.default_payee`, `pdc.default_deposit_account`, `pdc.max_cheques_per_set`, `pdc.date_tolerance_days`,
`pdc.brstn_required`, `pdc.forward_ack_days`, `pdc.confirmation_grace_days`, `documents.pdc_acknowledgement_note`.

## Debugging

- Deposit refused: `pdc.default_deposit_account` is empty, or the cheque is payable to the Insurance Partner.
- A cancellation cannot be approved by its requester (maker-checker); a cheque the partner holds stays pending until
  it comes back on a transmittal.
