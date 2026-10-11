# Policies

The policies the insurers issued, booked through the placement slip (`../placement`), with their payments, documents
and the guarded changes of their core data. Routes are under `/policies` (Operations > Policy). Access:
`read:policies`, `write:policies`, `approve:policies` (corrections, placement checks); finance verifies payments
(`write:receipts`).

## Files

| File | What it does |
|---|---|
| `router.js` | The `/policies` routes. |
| `service.js` | List, read, issue (`issuePolicy`, used by the placement booking and the quotation conversion), bulk upload, receivables. |
| `corrections.js` | Guarded core data (TIS-BRD-ISSUE-04, SEC-03): the edit guard of `PUT /:id` and the corrections approved by a second user. |
| `payments.js` | Payment capture on a policy and its verification by finance. |
| `kyc.js` | KYC and vehicle identifiers required before issuance (`policy.kyc_required_fields`). |

## Guarded core data

- `PUT /:id` never changes the status (it follows endorsement, cancellation, renewal and expiry) and, past Draft,
  refuses a change of the fields of `policies.correction_fields` (policy number, insured name, inception, expiry,
  insurer); values equal to the policy's pass, so a screen may send the whole record.
- `POST /:id/corrections` requests a correction: the changed values, a reason code of the context
  `policy_correction` and, for the fields of `policies.correction_insurer_fields`, the insurer's reference. One pending
  correction per policy (`policy_corrections`). The approvers (`approve:policies`) are notified.
- `POST /:id/corrections/:cid/approve` applies it (refused when the policy changed since the request), `/reject` takes a
  reason code of `policy_correction_reject`; neither by the requester. `/withdraw` by the requester. Every step is
  audited on the policy (`correction-request`, `correction-approve` with before and after, `correction-reject`,
  `correction-withdraw`).

## Bulk upload

`policies.bulk_upload_issue` off (TISPH, seed `95_tisph_quote_policy.sql`): `POST /bulk-upload` issues no policy (a
TISPH policy is issued through its placement slip); `mode=go-live` loads the in-force policies of the old system without
bill, journal or commission and needs `write:data-load`.
