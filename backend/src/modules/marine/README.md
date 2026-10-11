# Marine Open Covers

Open policies with declarations (TIS-BRD-PJRN-09, FRS PJRN-09 FR-PCL-001 to 061): the Parcel / Courier business of TFS
insured with AXA, and Marine Cargo inland on the same mechanism. Route: `/marine` (Operations > Marine Open Covers,
`/operations/open-covers`). Migrations 0304 and 0675.

Access: `read:marine`; `write:marine` (set-up, activation, endorsement requests, cargo certificates and shipment
uploads, declarations, sending and billing); `write:parcel-certificates` (Upload parcels, Add parcel, cancel a
certificate not yet declared, request a reversal, Print certificates of the day); `approve:marine` (endorsements and
reversals, never one's own request).

## Files

| File | What it does |
|---|---|
| `router.js` | The `/marine` routes. |
| `service.js` | Covers (type, set-up checks, overlap, activation, cancel), cargo certificates and pricing, cancellation, monthly declarations (recompute, submit, bill), the shapes of the API. |
| `terms.js` | The terms an endorsement can change, their checks (covers, charge, remittance basis, file settings), the terms in force on a date and the taxes inside a flat premium. |
| `parcel.js` | Parcel certificates: Add parcel and the TFS parcel upload (`PARCEL_COLUMNS`), the checks of FR-PCL-012, the certificate e-mail, Print certificates of the day, reversals; the cargo shipment upload (`SHIPMENT_COLUMNS`). |
| `daily.js` | Daily declarations, late items, the jobs `marine-daily-declaration-close` and `marine-monthly-declaration-open`. |
| `files.js` | The declaration file of the cover's layout, its versions, sending to the insurer, the insurer's acceptance, the Declaration summary and the certificate register. |
| `endorsements.js` | Endorsements of the open policy with maker-checker. |
| `documents.js` | The parcel and cargo certificates on the document engine (letterhead, CANCELLED watermark, password-protected copy). |

## Rules

- **Type.** Parcel / Courier (flat covers on each certificate, premium inclusive of taxes) or Marine Cargo (rate and
  limit per conveyance). Chosen on the first save and never changed. One active parcel cover per client and insurer
  on a date.
- **Charge.** The charge per certificate is billed to the client; it is at least the premium per certificate and the
  difference is the broker's service fee (posting rule `parcel.service_fee`, VAT per `parcel.service_fee_vat`).
- **Remittance basis.** Per cover: gross (the whole premium is due to the insurer, the commission of the covers becomes
  an unbilled item of Direct Bill Processing) or net (as any bill). Parcel default gross, cargo net.
- **Daily declaration.** Every item joins the daily declaration of its date; a closed day (or a submitted month) sends
  it to today's as a late item. The job closes the ended days, records the days without items as Nil and the monthly
  job opens the month just ended. Submitting a month is refused while one of its days is open.
- **Monthly declaration.** Parcel: lines per cover with the taxes inside the premium (net = premium / (1 + VAT + DST +
  LGT) on the total of the cover), the charge billed, the service fee and the commission. Cargo: the taxes are added on
  top. Reversals approved up to the end of the period are negative lines.
- **Declaration file.** Written on Submit in the layout of `marine.declaration_file_layouts`; never when its total
  differs from the declaration premium; each version kept; sent by e-mail with the summary and the register; the
  insurer's acceptance recorded with its reference.
- **Endorsement.** An active cover changes only by an endorsement (`marine.endorse_active_covers`): effective from the
  day after the last submitted month, one pending at a time, approved by another user; certificates follow the terms in
  force on their date.
- **Certificates.** Never changed: cancelled with a reason of `parcel.cancel_reasons` before the month is submitted,
  afterwards reversed within `parcel.reversal_max_days` with approval.

## Settings

`parcel.default_charge` (500), `parcel.delivery_types` (Rush 2,500, Regular 2,000), `parcel.default_covers`,
`parcel.cover_lines` (MARINE, PA), `parcel.max_covers` (5), `parcel.max_upload_rows` (2,000), `parcel.max_backdate_days`
(30), `parcel.duplicate_days` (7), `parcel.reversal_max_days` (60), `parcel.daily_cutoff_time` (23:59),
`parcel.default_courier` (LBC Express), `parcel.documents_sent`, `parcel.cancel_reasons`, `parcel.certificate_wording`,
`parcel.email_certificate` (true), `parcel.certificate_password` (loan_last6), `parcel.certificate_email_subject` /
`_body`, `parcel.commission_base` (gross), `parcel.service_fee_vat` (inclusive), `marine.default_daily_declaration`
(true), `marine.endorse_active_covers` (true), `marine.declaration_file_layouts` (AXA parcel layout, Cargo layout),
`marine.declaration_email_subject` / `_body`, `accounting.account.parcel_service_fee_income`; earlier:
`marine.conveyances`, `marine.default_markup_percent`, `marine.certificate_wording`, `marine.declaration_due_days`.
