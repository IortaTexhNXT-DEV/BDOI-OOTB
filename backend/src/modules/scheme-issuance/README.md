# Scheme Issuance

Scheme applications on TFS loan documents, from the application to the policy (TIS-BRD-SCHM-01, FRS SCHM-01 FR-SIS-001
to 030; CR-05 loan bookings upload). Route: `/scheme-issuance` (Operations > Sales & Marketing > Scheme Issuance).
Access: `read:scheme-issuance`, `write:scheme-issuance`, `approve:scheme-issuance` (waivers, cancelling a sent
application); issuing the policy also needs `write:policies`. Migration 0601; master type `scheme-document-checklist`
and reason context `scheme_application_cancel` (seed 97_dealer_schemes.sql).

## Files

| File | What it does |
|---|---|
| `router.js` | The `/scheme-issuance` routes. |
| `service.js` | `saveApplication`: the checks that refuse a value (400) and the missing values that keep a Draft, the scheme checks (brand-new vehicle, chassis, scheme in force, dealer, insurer, model range, sum insured range) and the pricing of every policy year from the Scheme Master; list, counts, choices. |
| `checklist.js` | The document checklist built from the master by scheme type, KYC source and condition; upload (PDF, JPEG, PNG by content), received with a remark (never a KYC item), reopen, add a document, waiver request and decision (maker-checker); the gate. |
| `issue.js` | Send to the insurer (Placement Slip of source `scheme`, e-mailed with the checklist files), decline, change insurer, issue the policy (client, policy, billing of year 1, commission, files, `policy_schemes`, the lock-in record), cancel. |
| `upload.js` | The loan bookings upload (`LOAN_BOOKING_COLUMNS`): one application per good row, a failed row creates nothing. |

## Rules

- **Statuses.** draft (something missing or a scheme check failed) -> documents-pending (required documents missing)
  -> ready -> sent -> issued; declined (the insurer declined: change the insurer to go back to the gate); cancelled.
  A sent application is read-only; an issued one is corrected by endorsement.
- **Checks.** TFS loan account 10 digits, one open application per loan; financing bank TFSPH or one of its branches
  (`schemes.financing_banks`); loan term `schemes.loan_term_months`; booking and release dates not in the future,
  release at most `schemes.max_backdating_days` back; ARA of Scheme 1 signed between 30 days before the booking and the
  release, payment mode of `schemes.ara_payment_modes`; ID types of `schemes.kyc_primary_ids` / `kyc_secondary_ids`;
  Full KYC needs one primary ID or two different secondary IDs.
- **KYC source.** TFSPH KYC confirmation for a bank of `schemes.kyc_confirmation_banks`, else Full KYC; the checklist
  follows it.
- **Placement and policy.** Sent only when Ready and the base KYC check passes. Payment verification is skipped for
  scheme slips (`schemes.skip_payment_verification`). The policy is issued once the insurer has confirmed
  (`schemes.placement_confirmation`: acknowledgement with a reference, or a checked e-policy); inception on the release
  date (`schemes.inception_basis`). Year 1 is billed to the dealer (Scheme 1) or TFSPH (Scheme 2) through its billing
  client (`schemes.require_billing_client`, MSG-SIS-047). The lock-in record (Scheme 1 ARA or Scheme 2, with the TFS loan
  account) is written in the same transaction: start = inception, end = start + years - 1 day.
- **Cancel.** With a reason; once sent only `approve:scheme-issuance`, and the placement slip is cancelled with it.

## Settings

`schemes.financing_banks`, `schemes.kyc_confirmation_banks`, `schemes.inception_basis` (release_date),
`schemes.max_backdating_days` (30), `schemes.max_document_mb` (10), `schemes.attach_documents_to_placement` (true),
`schemes.kyc_primary_ids`, `schemes.kyc_secondary_ids`, `schemes.ara_payment_modes`, `schemes.placement_confirmation`
(acknowledgement), `schemes.skip_payment_verification` (true), `schemes.application_schedule_ctpl` (false),
`schemes.loan_term_months` ({min: 12, max: 84}), `schemes.require_billing_client` (true).
