# Packaged products

High-velocity retail and SME business: multi-line bundles sold as one package, the quick quote comparison across
insurers and package policies. Routes are under `/packages`.

| Screen | Routes | Permission |
|---|---|---|
| Master > Packaged Products > Insurer Rate Tables | `/packages/rate-tables` | read: `read:quotations` / `read:products` / `read:masters` / `read:policies`; write: `write:products` (Processing Team) |
| Master > Packaged Products > Bundle Products | `/packages/bundles` | same as rate tables |
| Sales & Marketing > Compare Insurers (from Quick Quote) | `/packages/compare`, `/compare/pdf`, `/compare/quotation` | `read:quotations`; proceed: `write:quotations` |
| Sales & Marketing > Package Bundles | `/packages/quotes`, `/packages/policies` | quotations: `read:` / `write:quotations`; issue: `write:policies`; endorse: `write:endorsements` or `write:policies`; renew: `write:renewals` or `write:quotations` |

Scoped users (`security.scoped_roles`) only see their own package quotations and policies.

## Files

| File | What it does |
|---|---|
| `rateTables.js` | Insurer rate tables (insurer, product, rate basis percent / per mille / flat, rate, minimum premium, deductible, key benefits, commission rate, effective dates; no overlapping active rows) and `premiumOnRate()`. |
| `compare.js` | The comparison matrix (every insurer with a rate table in force), the client view without commission, the PDF on the letterhead and "proceed" into a quotation priced with the tax engine. |
| `bundles.js` | Bundle products and their sections (product, default sum insured, rate, minimum premium, property flag, optional, allowed insurers, benefits). |
| `bundleQuotes.js` | `priceBundle()` and package quotations (`PQ-` numbers, series `package_quote`). |
| `issue.js` | Issuance under one policy number (`PKG-`, series `package_policy`), the booking split per insurer, section endorsements, renewal of the whole package, quotation and schedule PDFs. |

## Pricing a bundle

1. Each included section is priced with its insurer: the insurer's rate table in force for the product, else the
   section's rate and minimum premium (percent of the sum insured; per mille or flat from a rate table).
2. The bundle discount % is taken on the total premium and spread over the sections in proportion to their premium
   (largest remainder, so the discounts add up to the cent).
3. Each section gets its own taxes and charges from the premium-charges engine: VAT or premium tax by product regime,
   DST per P4.00, FST only on property sections (section flag, else the product line), LGT at the location's rate. Flat
   charges (e.g. notarial fee) are charged once, on the first section (`packages.flat_charges_on_first_section`).
4. Commission per section: the rate table's commission rate, else the Commission Rate Matrix (insurer + product,
   insurer, product, line, then the insurer master and `commission.default_rate`).

## Issuing a package

`POST /packages/quotes/:id/issue` issues a draft or accepted package quotation through `policies/service.js#issuePolicy`:

- one policy row, number from the `package_policy` series, `lob = PACKAGE`, broker billed, term = the bundle's months;
- `package_sections` rows (entity `policy`) keep each section's insurer, premium, taxes, charges and commission;
- `risk_participants`: one row per insurer with the exact sum insured, premium, taxes, gross and commission of its
  sections; the lead is the insurer with the largest gross and shares follow the gross premium (they total 100%);
- one bill for the client (`receivables`) and one booking journal from the posting rule `policy.issue.broker_billed`
  with the per-participant lines per insurer: the split (`packageSplit`) gives each insurer its own gross, commission,
  VAT / DST / LGT, commission VAT / EWT and premium due, so remittance, commission and insurer reconciliation work per
  carrier (`receivable_participants` keeps the split of the bill);
- commission accrual for the producer and the credit limit warning as for any policy.

## Endorsements and renewals

- Section endorsement (`POST /packages/policies/:id/sections/:no/endorse`): a new sum insured from an effective date.
  The additional premium is the difference of the annual premiums on the section's rate, less the package discount,
  pro rata to the days left (`packages.endorsement_prorata`); it gets its own taxes, is billed (source
  `endorsement`, posting rule `endorsement.additional_premium`) and booked as due to that section's insurer only. The
  section, the policy totals and that insurer's participant row are updated and the shares recomputed. A lower sum
  insured (return premium) is refused here.
- Renewal of the whole package (`POST /packages/policies/:id/renew`): a package quotation for the next term
  (inception = expiry + 1) with the same sections, sums insured and insurers, priced at the rates in force. Issuing it
  marks the expiring policy `renewed` and links both terms.

## Settings

`packages.quote_validity_days`, `packages.endorsement_prorata`, `packages.comparison_disclaimer`,
`packages.flat_charges_on_first_section`.
