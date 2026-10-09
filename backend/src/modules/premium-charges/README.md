# Premium taxes and charges

The Philippine taxes and charges added to an insurance premium, kept as configuration, and the one calculator every
premium is taxed with: Package Bundles, quotations (and so endorsements and placement
slips), insurer offers on broker slips, the renewal queue quote, the renewal quotation, the product configurator
illustration and payment links. Routes are under `/premium-charges` (Master > Packaged Products > LGU Tax Rates, with the Taxes & Charges
tab). Anyone who quotes, issues or collects can read them (`read:quotations`, `read:policies`, `read:masters`,
`read:products`, `read:receipts`); Accounting maintains them (`write:premium-charges`, migration 0190, granted to
`accounting` and `system-admin` by `seeds/65_packaged_products.sql`).

## Files

| File | What it does |
|---|---|
| `calculator.js` | Pure formulas: `calculateCharges(rules, options)`, `chargeAmount(rule, base)`, `sumCharges(results)`. No database access. |
| `service.js` | Rule and LGU masters, `lguFor()`, `rulesInForce()` (with `fallbackRules()`), `chargesFor()` (product line and tax regime, LGU rate, date) and `quotationCharges()` for `quotations/premium.js` and the renewal quote. |
| `router.js` | Masters CRUD and `POST /premium-charges/calculate`. |

## Rules (`premium_charge_rules`)

| Kind | Default | How it is computed |
|---|---|---|
| `vat` | 12% | percent of the premium, products whose tax regime is `vat` (Product master, `premium_tax_regime`) |
| `premium_tax` | 2% | percent of the premium, products whose regime is `premium_tax` (instead of VAT) |
| `dst` | 12.5% | percent of the premium (migration 0236; the rate quotations always charged). `per_unit` (P0.50 per P4.00) is available: `round_up` counts a fractional unit as a whole one (the NIRC "or fractional part thereof"), `prorate` charges it proportionally |
| `fst` | 2% | percent, only on the lines listed in the rule (`fire`: fire, IAR, householder) or on a package section flagged as property |
| `lgt` | 0.75% | the rate of the city or municipality in `lgu_tax_rates` (Metro Manila rows 0.2%); the rule rate when the location has none (migration 0236; was 0.2%) |
| `other` | off | any other charge (notarial fee, stamps): percent, per unit or `flat` (once per document) |

Each rule has lines and tax regimes it applies to (empty: all), a minimum amount, effective dates and a sort order.
Statutory taxes cannot be deleted, only switched off.

## Rounding

Every charge is rounded to 2 decimals (half away from zero, `lib/money.js#round2`) on its own; totals add the rounded
amounts, so printed breakdowns always add up. A negative premium (return premium) gives negative charges.

## Where it is used

- `packages` module: comparison matrix (per insurer), bundle sections (per section: FST only on property sections),
  flat charges once per bundle on the first section.
- Quotations (`quotations/premium.js`), always: VAT, DST, LGT and FST go to their columns, the premium tax and other
  charges to `others`, and the full list to `premiumBreakdown.charges`. Endorsements and placement slips are priced
  with the same routine. Saved quotations and policies keep the amounts they were saved with until they are re-quoted.
- Renewals: the renewal queue quote (`renewals/service.js#rate`) taxes the re-rated net premium with
  `quotationCharges()`, and the renewal quotation is priced by `quotations/premium.js`: the same premium for the same
  input (test/money-single-source.test.js).
- Broker slips: an insurer offer recorded without taxes gets the engine's taxes.
- Product configurator: the premium illustration's taxes (the template's own tax components are descriptive only).

## Settings

`tax.charge_engine.default_lgu` (LGU code used when a quotation names none). The switch
`tax.charge_engine.quotations` and the per-line list `premium.taxes_by_lob` were removed by migration 0236: the rules'
lines and tax regimes decide which taxes apply. The flat `tax.vat_rate`, `tax.dst_rate`, `tax.lgt_rate` and
`tax.fst_rate` are only the fallback of a tax kind that has no rule at all in the table (`fallbackRules()`); a rule
switched off means the tax is not charged.
