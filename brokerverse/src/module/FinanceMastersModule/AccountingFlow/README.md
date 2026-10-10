# Accounting Flow

Master > Finance > Accounting Flow (`/master/finance/accounting-flow`): the Finance accounting reference. It is not a
user guide (the steps of each screen are in the in-app Help): it shows, for every business event, the journal the
system posts, read from the posting rules and accounts in force today, so it changes as soon as an approved rule or
account change takes effect. Read only: rules change in Posting Rules, accounts in Account Determination, both through
the approval of a second user (Configuration Approvals).

## What the page shows

- **Status row**: the date of the rules in force,
  the Account mapping status (Ready or Incomplete, with the accounts still to be mapped and, for users who may change
  them, a Configure link to Account Determination) and the changes waiting for approval (a link to Configuration
  Approvals for approvers).
- **Contents** (left, sticky): the modules in the order of the accounting cycle with their events; the event in view is
  highlighted and a dot marks an event that needs attention (mapping pending or a change waiting for approval). Below
  960 px the contents become the "Jump to an event" list of the toolbar.
- **Toolbar**: search (event, when, where, approval, account code and name, amount wording; the event code matches
  too), Module, Account ("what posts to this account?"), Mapping pending only, and the count of events shown. The
  filters are in the address (`?q=&module=premium,collections&account=210245&pending=1&event=receipt.apply`), so a
  view can be shared and other screens can link to an event.
- **Event card**: name and summary; chips for the journal (Posted at once, Waits for approval, Saved as pending), a
  change pending approval, a new rule from a later date, Mapping pending, No rule in force or Fixed entry; the facts
  When, Where (a link when the user's menu reaches the screen), Approval before posting, Approval limit (Authority
  Matrix) and Last posted; the entries (debits first, then credits) with the account, where it comes from, the amount
  in business words (formula behind the info icon, "For each insurer" for co-insurance lines) and the notes (condition,
  Mapping pending with Map the account, Account inactive, Account change pending). **Example** shows the journal of
  the event for sample amounts (single insurer or two insurers 60 / 40); nothing is posted.
- **Other system journals**: bank reconciliation adjustments, unearned commission deferral, FX revaluation and
  year-end closing, built by the system without a posting rule; their accounts come from the account roles.

## Permissions

| Action | Rule |
|---|---|
| Open the page, examples, Excel and PDF | the menu (accounting master items) and the API read permission (`read:journal-vouchers`, `read:masters` or `read:settings`) |
| Technical details (rule code, version, lines, settings) and the Technical sheet of the workbook | `write:posting-rules` or an administrator (`mayViewTechnical`) |
| Open the rule | the menu reaches Posting Rules and one of `write:posting-rules`, `write:masters`, `write:settings`; opens `/master/finance/posting-rules?event=<code>` |
| Map the account, Configure | the menu reaches the screen where the account is set |
| Pending change link | `approve:posting-rules` and the menu reaches Configuration Approvals |

## Files

| File | Content |
|---|---|
| `index.js` | page: header (Export, Print), status row, contents, toolbar, module sections; filters in the address; `useStableLoad` keeps the page on screen while it reloads |
| `EventCard.jsx` | one event: chips, facts, entries, example, technical details |
| `EntriesTable.jsx`, `AccountCell.jsx` | the entries table, the account cell with its source, fallback and map accounts, the mapping chips |
| `ExamplePanel.jsx` | the worked example, loaded on demand and once per choice |
| `flowView.js` | pure rules: filters, grouping by module, account options |
| `index.scss` | styles (theme tokens), print layout: header actions, contents, toolbar and buttons hidden, cards kept whole |

## Data

`GET /posting-rules/flow` (`backend/src/modules/posting-rules/flow.js`); `GET /posting-rules/flow/:eventCode/example`;
`GET /posting-rules/flow?format=xlsx|pdf` for the accounting reference workbook and the Accounting Entries Handbook.
To add an event: its `EVENT_FLOW` entry and its module in `AREAS` (server), and the wording of any new amount in
`AMOUNT_WORDING`; the page needs no change.
