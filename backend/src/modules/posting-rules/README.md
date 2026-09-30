# Posting rules and Account Determination

Configuration of how business events become journals. Routes are under `/posting-rules` (Master > Finance > Posting
Rules) and `/account-determination` (Master > Finance > Account Determination). The engine that applies the rules is
`src/modules/accounting/lib/posting.js`.

## Files

| File | What it does |
|---|---|
| `router.js` | Routes of both screens, the configuration approvals and the accounting flow. |
| `flow.js` | Accounting flow help screen (Master > Finance > Accounting Flow): trigger and approval of every event (`EVENT_FLOW`) with the debit and credit lines of the rule in force and today's GL accounts. A new event needs its `EVENT_FLOW` entry (a test checks it). |
| `service.js` | Event catalogue, rule versions (validation, simulation, activation), account roles and maps, commission tax set-up, write-off reasons, the maker-checker on configuration changes. |

## Main tables

`posting_rules` (one row per version of an event's rule, with its `approval_status`), `posting_rule_lines`,
`accounting_config_changes` (changes waiting for approval and their decision), `write_off_reasons`. Account roles and
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
- Maker-checker (`accounting.configuration_maker_checker`, on by default): a new rule version is stored `pending` and
  inactive, and a (de)activation, an account role, an account map or a commission tax change is stored in
  `accounting_config_changes`. Nothing changes posting until a different user with `approve:posting-rules` (Accounting
  Manager, System Administrator) approves it on Master > Finance > Configuration Approvals; the rule of "not the
  requester" applies even when `finance.maker_checker_enabled` is off. The requester or an approver may withdraw a
  pending change. `activeRule` only uses approved versions. While maker-checker is on, System Settings and
  Configuration refuse to change the controlled keys (`accounting.account.*`, the two maps, the commission tax keys).
  Proposing needs `write:settings`, `write:masters` or `write:posting-rules` (Accounting Manager). Write-off reasons are
  not under maker-checker.

## Key settings

`accounting.account.*`, `accounting.payable_account_by_payee`, `accounting.cash_account_by_payment_mode`,
`accounting.split_premium_taxes`, `accounting.broker_billed_commission_vat`, `accounting.broker_billed_commission_ewt`,
`tax.commission_vat_code`, `tax.commission_ewt_code`, `accounting.configuration_maker_checker`.

## Debugging

- A version is refused with "sample journal does not balance": simulate the unsaved lines to see which amount has no
  opposite line.
- A booking posts the commission taxes to an unexpected account: the tax code (Master > Finance > Taxation) has its own
  GL account, which wins over the account role.
