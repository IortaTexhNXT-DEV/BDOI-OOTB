# Promotions

Promotional rates and gross premium discounts on brand-new vehicles, and the discount caps they are checked against
(TIS-BRD-PROD-15). Routes: `/promotions` (Operations > Sales & Marketing > Promotions) and `/discount-caps`
(Master > Finance > Discount Caps). Access: `read:promotions`, `write:promotions`, `approve:promotions`,
`read:discount-caps`, `write:discount-caps`, `approve:discount-caps`, `write:promotion-rates` (lower a promotion's Own
Damage rate on a quotation). Migration 0485. TISPH decision of 11 Oct 2026 (GAP-SALES-17, migration 0687): the TIS Sales
Unit Head, the General Manager and IT AppSupport make and approve the promotions (never their own); the Operations
Officer and Unit Head set up the discount caps and read the promotions.

## Files

| File | What it does |
|---|---|
| `router.js` | The `/promotions` and `/discount-caps` routes. |
| `service.js` | Promotion versions: create, change a draft, submit, recall, approve or return (maker-checker, reason context `promotion_return`), suspend / resume / withdraw (reason context `promotion_status`), amend as the next version, copy; the cap check of each line; the job `promotionStatus`. |
| `caps.js` | Discount caps: propose, replace, approve or return (maker-checker, reason context `discount_cap_return`), withdraw; `capFor` (the approved cap in force); channel types. |
| `rates.js` | Standard rates (`promotions.standard_rates`) and the rate discount of a line. |
| `quote.js` | The promotion on a motor quotation: promotions open to a vehicle, `applyPromotion` (rates, promotion discount against the standard rates, cap, maker's Quotation discount authority), the referral rule `PROMO_DISCOUNT`, the unit counted at conversion and given back on a cancellation from inception. |

## Rules

- **Versions.** `promotions` holds one row per version (`code`, `version`); one version of a code is in Draft or Pending
  approval at a time. An approved version is never changed: Amend copies it as the next Draft; on approval the version in
  force becomes `superseded`. Code and benefit cannot change; the start date only while Scheduled.
- **Set-up checks.** Code `^[A-Z0-9-]{3,20}$`, unique; period at most `promotions.max_period_months`; lock-in 1 to
  `promotions.max_lockin_years`; Motor products only; lines: rates in (0, 100] with 4 decimals, remit <= promo, min OD
  <= promo OD and >= remit OD, no overlapping lines. Submission and approval need products, insurers, channel types,
  active variants and every line within the approved cap of each product and channel type (rate discount =
  (standard OD + AON - (min OD + promo AON)) / (standard OD + AON)).
- **Life cycle.** Approve: Scheduled (period starts later) or Active; job `promotion-status` (00:05) activates and
  expires; a used-up quota expires the promotion.
- **Quotation.** The request `promotion: { code, odRate, rateReason }` (PUT/POST `/quotations`): Motor, Comprehensive,
  Vehicle condition Brand New, model year >= policy year - `promotions.new_vehicle_year_tolerance`, product, insurer,
  channel type (distribution channel of the quotation or prospect, else agent / referrer, else direct), dealer
  programme combinability, quota, the line of the variant, year model, insurer and FMV. The quotation is priced at the
  standard rates and with the promotion; `doc.promotion` keeps the terms (code, version, line, rates, remitting rates,
  promotion discount, total discount %, cap, excess, lock-in years). The total discount must stay within the cap; above
  the maker's `quotation_discount` authority the underwriting referral gets `PROMO_DISCOUNT` for the roles whose limit
  covers it, and the decider's limit is checked. An open quotation keeps its promotion
  (`promotions.keep_on_open_quotes`); a new version is used when the quotation is changed (`promotionNotice`).
- **Policy.** Conversion counts a unit (`promotion_units`), refuses a chassis already on an earlier policy, and carries
  `doc.promotion` to the policy. A promotion with lock-in years puts the policy in lock-in from its inception
  (`policy_lock_ins`, source `promotion`, written on issuance from a quotation or a placement slip by `issuePolicy`
  through `recordLockIn` of the renewals module). A cancellation from inception returns the unit.
- **Caps.** One approved cap per product and channel type on a day; not backdated; a replacement ends the replaced cap
  the day before it starts.

## Lock-in end date

`recordLockIn` ends a promotion lock-in at start + years (the day the next term starts). The scheme lock-ins written by
Scheme Issuance end at start + years - 1 day (FRS SCHM-03 FR-LCK-001); aligning the promotion rule is left to TISPH.
