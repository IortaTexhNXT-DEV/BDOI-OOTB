# Posting rules and Account Determination

Configuration of how business events become journals. Routes are under `/posting-rules` (Master > Finance > Posting
Rules) and `/account-determination` (Master > Finance > Account Determination). The engine that applies the rules is
`src/modules/accounting/lib/posting.js`.

## Files

| File | What it does |
|---|---|
| `router.js` | Routes of both screens, the configuration approvals and the accounting flow. |
| `flow.js` | Accounting Flow (Master > Finance > Accounting Flow), the Finance accounting reference: every event grouped by module (`AREAS`, in the order of the accounting cycle), when it posts and on which screen, the approval before posting worded from the setting in force (`EVENT_FLOW`), the journal state (posted at once, waits for approval through `accounting.parked_events`, saved as pending when `accounting.auto_post_system_entries` is off), the lines of the rule in force with the amount in business words (`AMOUNT_WORDING`), the condition a line posts under (`LINE_CONDITIONS`) and the account it resolves to today with its mapping state; pending and scheduled rule versions, pending account changes, the last posting date, the journals built without a rule (`SYSTEM_JOURNALS`), the accounts pending mapping and an edition code of the configuration. `flowExample` builds the worked example of an event. A new event needs its `EVENT_FLOW` entry and a module in `AREAS` (a test checks both, and that no wording carries a permission code or a setting key). |
| `flowExport.js` | Exports of the accounting flow: the accounting reference workbook (Entries, Events, Mapping pending, Examples, and Technical for finance administrators) and the Accounting Entries Handbook (PDF with a sign-off block). |
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
- The same table holds the changes of access (kind `role-access`, `src/modules/access-control/changes.js`): the
  changes routes of this module list, decide and withdraw only the kinds of `CHANGE_LABELS`, so a change of access is
  never approved with `approve:posting-rules`; it is decided on Role Permissions with `approve:access-control`.

## Accounting Flow

`GET /posting-rules/flow` (read permission) returns the reference; `?format=xlsx` and `?format=pdf` download it
(every download is in the audit trail, entity `accounting_flow`). `GET /posting-rules/flow/:eventCode/example` builds a
worked example with the event's sample amounts; an account the transaction supplies is replaced by the line's fallback
role, so the example shows the accounts this configuration uses (404 for an unknown event, 409 when no rule is in
force).

An account is **mapping pending** when it is listed in `accounting.provisional_accounts` (seed
`91_accounting_reference.sql`: 210245 for TISPH), does not match `sap_gl.account_pattern` (the rule the SAP GL file
already applies) or is inactive or missing. Each pending item (account role, payee type, payment mode, tax code,
write-off reason) is listed once with the events that use it and the screen where it is mapped.

The edition is the first eight characters of a SHA-256 over the rules in force, their lines and resolved accounts, the
provisional list and the chart pattern: the same configuration gives the same edition, printed on both exports so a
signed handbook can be matched to the configuration.

## Key settings

`accounting.account.*`, `accounting.payable_account_by_payee`, `accounting.cash_account_by_payment_mode`,
`accounting.split_premium_taxes`, `accounting.parked_events` (checked on save by `assertParkedEvents`: known events, none
that always posts), `accounting.broker_billed_commission_vat`, `accounting.broker_billed_commission_ewt`,
`tax.commission_vat_code`, `tax.commission_ewt_code`, `accounting.configuration_maker_checker`, `accounting.provisional_accounts`
(Accounting Flow), `accounting.auto_post_system_entries`.

## Debugging

- A version is refused with "sample journal does not balance": simulate the unsaved lines to see which amount has no
  opposite line.
- A booking posts the commission taxes to an unexpected account: the tax code (Master > Finance > Taxation) has its own
  GL account, which wins over the account role.
