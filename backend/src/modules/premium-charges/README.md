# Premium taxes and charges

The Philippine taxes and charges added to an insurance premium, kept as configuration, and the one calculator every
screen that prices a premium uses: Quick Quote > Compare Insurers, Package Bundles, payment links and, when asked,
quotations. Routes are under `/premium-charges` (Master > Packaged Products > LGU Tax Rates, with the Taxes & Charges
tab). Anyone who quotes, issues or collects can read them (`read:quotations`, `read:policies`, `read:masters`,
`read:products`, `read:receipts`); Accounting maintains them (`write:premium-charges`, migration 0190, granted to
`accounting` and `system-admin` by `seeds/65_packaged_products.sql`).

## Files

| File | What it does |
|---|---|
| `calculator.js` | Pure formulas: `calculateCharges(rules, options)`, `chargeAmount(rule, base)`, `sumCharges(results)`. No database access. |
| `service.js` | Rule and LGU masters, `lguFor()`, `rulesInForce()`, `chargesFor()` (product line and tax regime, LGU rate, date) and `quotationCharges()` for `quotations/premium.js`. |
| `router.js` | Masters CRUD and `POST /premium-charges/calculate`. |

## Rules (`premium_charge_rules`)

| Kind | Default | How it is computed |
|---|---|---|
| `vat` | 12% | percent of the premium, products whose tax regime is `vat` (Product master, `premium_tax_regime`) |
| `premium_tax` | 2% | percent of the premium, products whose regime is `premium_tax` (instead of VAT) |
| `dst` | P0.50 per P4.00 | `per_unit`: unit amount for every unit of premium; `round_up` counts a fractional unit as a whole one (the NIRC "or fractional part thereof"), `prorate` charges it proportionally (exactly 12.5%) |
| `fst` | 2% | percent, only on the lines listed in the rule (`fire`: fire, IAR, householder) or on a package section flagged as property |
| `lgt` | 0.2% | the rate of the city or municipality in `lgu_tax_rates`; the rule rate when the location has none |
| `other` | off | any other charge (notarial fee, stamps): percent, per unit or `flat` (once per document) |

Each rule has lines and tax regimes it applies to (empty: all), a minimum amount, effective dates and a sort order.
Statutory taxes cannot be deleted, only switched off.

## Rounding

Every charge is rounded to 2 decimals (half away from zero, `lib/money.js#round2`) on its own; totals add the rounded
amounts, so printed breakdowns always add up. A negative premium (return premium) gives negative charges.

## Where it is used

- `packages` module: comparison matrix (per insurer), bundle sections (per section: FST only on property sections),
  flat charges once per bundle on the first section.
- Quotations (`quotations/premium.js`): only when `tax.charge_engine.quotations` is on or the quotation document has
  `chargeEngine: true` (quotations created from a comparison). VAT, DST, LGT and FST go to their columns, the premium
  tax and other charges to `others`, and the full list to `premiumBreakdown.charges`. Saved quotations and policies
  keep the amounts they were saved with until they are re-quoted.

## Settings

`tax.charge_engine.quotations` (off), `tax.charge_engine.default_lgu` (LGU code used when a quotation names none).
The old `tax.*_rate` settings keep driving quotations that do not use the engine.
