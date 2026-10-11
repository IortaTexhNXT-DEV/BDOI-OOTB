# Quotations

The quotation (Quotation Slip) given to the client: the insurer, the covers and the premium priced server-side, sent to
the client for approval, approved on maker-checker and converted to a policy through the placement slip
(`../placement`). Routes are under `/quotations` (Operations > Sales & Marketing > Quick Quote, Quotations). Access:
`read:quotations`, `write:quotations`, `approve:quotations` (another user's quotation) and `extend:quotations`
(validity extension).

## Files

| File | What it does |
|---|---|
| `router.js` | The `/quotations` routes. |
| `service.js` | Create, change, status changes along `quotations.transitions`, send for approval (signed link), the public approval link, submission to the insurer, conversion to a policy, underwriting referral decisions. |
| `validity.js` | The validity cycle and the versions (TIS-BRD-QUOT-04): validity days per product, extension, expiry reminder and spoil jobs, read-only versions. |
| `premium.js`, `motorTariff.js` | Premium breakdown (covers, taxes, commission) and the motor tariff of the Product Configurator. |
| `creditLife.js` | Credit Life quotation rules (TIS-BRD-QUOT-06, PJRN-03): eligibility, the fixed rate, the reduced sum insured referral. |
| `../promotions/quote.js` | The promotion of a motor quotation (TIS-BRD-PROD-15): see `../promotions/README.md`. |
| `customerResponses.js` | The client's answer received outside the approval link. |
| `shape.js` | Row to API object (`toQuote`) and the fields never stored in the quotation document. |

## Validity, extension and versions

- **Validity.** `valid_until` = the business date the quotation is issued (`issued_on`, Asia/Manila) + the product's
  `products.quote_validity_days` (Product Master), else `limits.quote_validity_days`. A quotation is valid through
  `valid_until`. Sending, accepting (link or recorded response), approving, submitting and converting are refused once it
  has passed, even before the job has run; the approval link expires at the end of `valid_until` at the latest.
- **Extension.** `POST /:id/extend` (`extend:quotations`): `quotations.extension_days` added at most
  `quotations.max_extensions` times, never beyond `issued_on` + `quotations.max_validity_days`, only in
  `quotations.extendable_statuses`. Stamped on the quotation (`extension_count`, `extended_at`, `extended_by`,
  `extension_remarks`) and audited (`extend`).
- **Reminder.** Job `quote-expiry-reminder` (`quoteExpiryReminders`): quotations whose validity ends within
  `quotations.expiry_reminder_days` remind their owner; with `quotations.expiry_reminder_customer`, the customer of a
  PendingCustomer quotation is e-mailed (`email.template.quote_expiry_reminder`). `expiry_reminder_for` holds the date
  reminded, so a date is reminded once and again after an extension.
- **Spoil.** Job `quote-expiry` (`quoteExpiry`): quotations in `quotations.expiry_statuses` past `valid_until` become
  Expired (audit `expire`, source job), except those whose placement slip is with the insurer. TISPH removes the
  Expired to Draft transition (seed `95_tisph_quote_policy.sql`).
- **Versions.** `PUT /:id` on a quotation the client has seen (`quotations.versioned_statuses`, or a Draft sent before)
  copies the current terms to `quote_versions` and continues as `version + 1` in Draft with the approval link and the
  client's and approver's stamps cleared (audit `new-version`). `body.version` older than the current version is
  refused (409); a quotation with an open placement slip cannot be changed. `GET /:id/versions`, `GET /:id/versions/:n`.

## Credit Life

Setting `credit_life.rules` (migration 0484). A quotation of one of `products` (CL-VOL) carries `doc.creditLife`
(`loanAccountNo`, `borrowerBirthDate` or the party's birth date, `accountCount`, `pendingBalance`, `loanTermYears`,
`sumInsured`). Refused: a corporate party, an agent or referrer code, age at or above `maxAge`, more than `maxAccounts`,
a pending balance, a term outside `termYears`, a rate other than `ratePerThousand`, another open quotation of the loan
account. Priced at `ratePerThousand` per 1,000 of the sum insured (default `defaultSumInsured`). A lower sum insured adds
the rule `CL_SI_REDUCTION` to the underwriting referral for `siReductionRoles`, so sending, approval and conversion wait
for its approval (maker-checker). CL-COMP (new business) skips the quotation step of its placement journey: a quotation
for it is refused and the screens open the direct placement.

## Promotion

`createQuote` and `updateQuote` apply `body.promotion` (or, on a change without it, the promotion the quotation was
priced with) through `applyPromotion` before pricing; the discount authority referral is merged into
`doc.underwritingReferral` (`withDiscountReferral`). `convertToPolicy` counts the promotion unit (`countPromotionUnit`).
