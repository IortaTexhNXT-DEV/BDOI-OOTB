# Posting rules and Account Determination

Configuration of how business events become journals. Routes are under `/posting-rules` (Master > Finance > Posting
Rules) and `/account-determination` (Master > Finance > Account Determination). The engine that applies the rules is
`src/modules/accounting/lib/posting.js`.

## Files

| File | What it does |
|---|---|
| `router.js` | Routes of both screens. |
| `service.js` | Event catalogue, rule versions (validation, simulation, activation), account roles and maps, commission tax set-up, write-off reasons. |

## Main tables

`posting_rules` (one row per version of an event's rule), `posting_rule_lines`, `write_off_reasons`. Account roles and
maps are settings: `accounting.account.<role>`, `accounting.payable_account_by_payee`,
`accounting.cash_account_by_payment_mode`.

## Main flows

- A rule is never edited in place: saving creates a new version effective from a date. The sample journal of the event
  must balance (single insurer and, for co-insurance events, co-insured) before the version is saved.
- `POST /posting-rules/simulate` builds the journal of a saved version, unsaved lines or the version in force for the
  event's sample context, without posting anything.
- Commission taxes (broker billed): migration 0170 added version 2 of the premium booking and return rules with an
  output VAT line and a creditable withholding tax line (resolvers `commission_vat_account` and
  `commission_ewt_account`: the GL account of the tax code, else the account role). The Commission taxes tab of
  Account Determination switches each tax on or off and chooses its tax code.

## Key settings

`accounting.account.*`, `accounting.payable_account_by_payee`, `accounting.cash_account_by_payment_mode`,
`accounting.split_premium_taxes`, `accounting.broker_billed_commission_vat`, `accounting.broker_billed_commission_ewt`,
`tax.commission_vat_code`, `tax.commission_ewt_code`.

## Debugging

- A version is refused with "sample journal does not balance": simulate the unsaved lines to see which amount has no
  opposite line.
- A booking posts the commission taxes to an unexpected account: the tax code (Master > Finance > Taxation) has its own
  GL account, which wins over the account role.
