# Access control

Master > Users and Access: User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of
Duties and Access Reviews, and ending a user's sessions. Routes are under `/access-control`; users and roles
themselves are in `src/modules/users/router.js`.

## Files

| File | What it does |
|---|---|
| `router.js` | Routes of the screens, with the audit entries and the approval notifications. |
| `service.js` | Authority limits (propose, decide, withdraw, `applyLimit` with effective dating) and the check used by the approval steps (`assertAuthority`, `effectiveAuthority`), segregation-of-duties rules (`sodConflicts`, `assertSod` used by the user form and the go-live kit), the role matrix, ending sessions, dormant accounts. |
| `delegations.js` | Delegations: the options of the New delegation panel, the checks, the request (kind `delegation`), ending one early, the effect on a date (`userAuthority`), the export. |
| `sod.js` | Segregation of Duties: conflicts by user with their state, rule changes (kind `sod-rule`), exceptions (kind `sod-exception`), the workbook. |
| `reviews.js` | Access Reviews: scope, outcomes, bulk keep, submit for sign-off (kind `access-review`), applying the removals, the workbooks. |
| `userAccess.js` | User Access Matrix: users with roles by name, included roles, department, conflicts, pending changes and last review; the access panel; the workbook. |
| `catalogue.js` | The access catalogue: every permission code in business words (area of the menu, module, level, what it allows). |
| `roles.js` | Role directory: department, summary and order of each role, the base platform roles, full-access roles. |
| `roleAccess.js` | Role Permissions: the overview, the check of a change of a role's access, the request, applying it, the export for audit. |
| `authority.js` | Authority Matrix: the registry of the approval steps (`AUTHORITY_STEPS`), the matrix by department, changes of limits through the configuration approval (kind `authority-limits`), the upload template and its check, the exports for audit. |
| `changes.js` | Changes of access waiting for approval (maker-checker) on the configuration approval table. |

## Main tables

`roles`, `permissions`, `role_permissions` (users module), `sod_rules`, `authority_transaction_types`,
`authority_limits`, `user_delegations`, `sod_exceptions`, `access_reviews`, `access_review_items`, and
`accounting_config_changes` (kinds `role-access`, `authority-limits`, `delegation`, `sod-rule`, `sod-exception`,
`access-review`) for the changes waiting for approval. Uploaded Authority Matrix files are
kept in `documents` (category `authority-matrix`, linked to their change).

## Access catalogue

Each permission code belongs to a module of the menu (Receipts, Payables...) in an area ordered like the side menu,
at one level: View (`read:`), Create and edit (`write:`), Approve (`approve:`) or Special (`view:pii`). Codes no route
checks (`write:audit`, `read:roles`, `write:profile`, `read:notifications`, `write:notifications`) are marked
`checked: false` and are not offered as levels; `read:profile` is Basic access, held by every role and never removed.
A permission added by a migration needs its entry in `catalogue.js`: until then it shows under Other with its
database description, and `test/role-permissions.test.js` fails.

## Role directory

`roleDirectory(db)` reads the settings of the user form (migration 0391): `access.role_groups` (departments in screen
order, each with its roles and a one-line summary) and `access.platform_roles` (the generic roles of the base
platform, shown only with "Include base platform roles"). A role in no department is listed under Other roles. Full
access: the System Administrator role and every role that includes it (SUPERID).

## Role Permissions

- Effective access of a role: its own grants plus the grants of the roles it includes (`roles.inherits`, recursively,
  active roles only, as `user_effective_roles()` gives them to a user). `GET /access-control/role-access` returns the
  catalogue, the departments and each role with its own and included grants (`{ code: included role }`), user counts,
  the change waiting for approval and `editBlocked` for the signed-in user (`no-permission`, `full-access`,
  `own-role`, `pending`).
- A change is a delta `{ grant, revoke }` on the role's own grants, never a replacement. `POST
  /access-control/role-access/check` (dry run) and the request check it: known codes, Basic access kept, a grant held
  only through an included role is changed on that role, and the segregation-of-duties access rules newly broken for
  the role itself or for an active user who holds it (directly or through a role that includes it). A Block rule
  refuses the change while `access.sod_enforced` is on.
- `POST /access-control/role-access/:role/changes` with `{ grant, revoke, reasonCode, note }` (reason context
  `access_change`, seed `91_role_access.sql`; `write:roles`): with `access.change_approval` (on by default) the change
  waits for approval (201, `{ change }`) and the approvers are notified; without it the change applies at once (200,
  `{ applied }`). One change per role waits at a time (409). Nobody but a System Administrator changes a full-access
  role or a role he or she holds (403).
- `POST /access-control/changes/:id/decision` (`approve:access-control`): approve or reject (remarks required). The
  approver is never the requester (`assertChecker(..., { configurable: false })`) and may not decide a change of a
  role he or she holds. Approving checks again (the rules may have changed), applies the delta and renews the sessions
  (`token_version`) of the users of the role and of every role that includes it. `POST /changes/:id/withdraw`: the
  requester or an approver. Audit: `accounting_config_change` request / approve / reject / withdraw, and `role`
  `access-change` with the permissions before and after.
- `PUT /roles/:id` with a permission list (the Role form) records the difference as a change waiting for approval
  while `access.change_approval` is on (Basic access kept), so the approval cannot be bypassed; a new role
  (`POST /roles`) has no users and gets its permissions at once.
- `GET /access-control/role-access/export?roles=a,b&base=1&format=xlsx|csv`: Access by role (role x module x level:
  granted, own / through a role / full access, pending), Matrix (modules down, roles across), Waiting for approval
  and Permission codes; CSV gives the first sheet.
- My Work lists the waiting changes to the holders of `approve:access-control` (not the requester), linked to
  `role-permissions?view=pending&change=<id>`; the posting rule approvals leave them alone.

## Authority Matrix

- Reading (`GET /access-control/authority-matrix`): the active transaction types down, with `checked` and `step` from
  `AUTHORITY_STEPS` (the approval steps that call `assertAuthority`; a test fails when a caller's type is missing);
  the active roles across with their department (role directory), `platform` and `approves` (the types whose step
  the role reaches with its permissions, included roles counted; for the underwriting referral only the authority
  roles of the active acceptance rules). Each cell: the limit in effect today (with its reference, approver and the
  change it came from), `scheduled` (a later limit, the current one then shows `endsOn`) and `pending` (the change
  waiting for approval, `CFG-n`, or an API proposal `AL-n`, with `canDecide` / `canWithdraw` for the signed-in user).
  `userLimits`: the personal limits in the same shape. `withoutLimit`: the rule for a cell without a limit.
- Changing (`POST /access-control/authority-changes`, `write:access-control`): one or more lines (role or person,
  type, limit / no limit / removal, effective date today or later, authority reference and its date while
  `access.authority_reference_required` is on, remarks). A wrong line, a line that changes nothing, a repeated cell
  or a cell with a change already waiting refuses the whole change. One line: target `<type>|role:<code>` (or
  `user:<id>`); an upload: target `upload` (one upload waits at a time). Approved or rejected (reason required) with
  `POST /changes/:id/decision` by another holder of `approve:access-control`; nobody approves a change of his or her
  own personal limit. Approving applies every line in one transaction.
- Effective dating (`applyLimit`, also for the API proposals): from the later of the effective date and today; rows
  of the same cell that would start on or after it are retired ("Superseded before taking effect"); the row in effect
  ends the day before (retired at once when that day has passed). Readers decide "in effect" by the dates.
- `DELETE /authority-limits/:id`: a proposal waiting for approval is withdrawn (proposer or approver); a limit in
  effect gets a removal proposal (the reference in the body), applied once approved.
- Upload: `GET /authority-matrix/template` (Data sheet prefilled with the matrix, drop-down lists, Instructions;
  `?base=1`, `unchecked=1`, `all=1`) and `POST /authority-matrix/uploads` (the upload target of the shared import
  dialog). The whole file is checked and nothing is saved: unknown or ambiguous names, Limit with No limit = Yes,
  percent over 100, more than 2 decimals, past effective date, missing reference, the same cell twice, an emptied
  limit (a limit is removed on the screen), a cell with a change waiting (unless the file holds the waiting value).
  Rows equal to the limit in effect or scheduled are unchanged. Without errors the file is stored and the changes
  come back for review; the screen then sends them with the file key to `POST /authority-changes`.
- Exports: `GET /authority-matrix?format=xlsx|csv` (every active role and type, base platform roles flagged) and
  `GET /authority-limits?status=all&format=xlsx|csv` (every limit row with its status in words), audited as `export`.
- My Work lists the waiting changes (`Authority matrix change`, `CFG-n`) and the API proposals (`AL-n`) to the
  approvers, linked to `authority-matrix?tab=pending`.

### "Not set" at approval time

A cell without a limit row is "Not set". When none of the approver's roles has a limit in effect for the type, there
is no personal limit and no delegation applies, `access.authority_without_limit` decides: `allow` (delivered) lets the
approval through with no amount check, `refuse` refuses it. Under `allow` a role without limits is unrestricted, and
gaining a role or a delegation with a limit lowers a user's authority to that limit. This is unchanged; the screen
states it in the cell tooltip and the toolbar chip.

## Segregation of duties

Two kinds of rule (migration 0393): `roles` (two roles one person may not hold together) and `access` (two sets of
permissions a role or a person should not combine: `access_a`, `access_b`). An access rule is broken by a set of
permissions holding a code of each set, worked out on the permissions of the active roles held, the full-access roles
left out. Rules are checked when roles are given to a user (`assertSod`), on the User Access Matrix and when the
access of a role changes. The default access rules (seed `91_role_access.sql`) warn.

## Delegations

- An approver away lends his or her limit for chosen transactions and dates to the person covering. Only the
  transactions an approval step checks (`AUTHORITY_STEPS`) can be lent; the approver away must reach their step and so
  must the person covering (`approvalsByUser` in `authority.js`). `GET /delegations/options` gives the panel everything
  at once; `POST /delegations/preview` the effect per transaction.
- `POST /delegations` (`write:access-control`, reason of context `delegation`): from today (business date), at most
  `access.delegation_max_days` days, no other delegation of the approver away for the same days and transactions
  (approved or waiting, 409), the person covering not away himself or herself (409). It waits for approval (kind
  `delegation`, target `<approver>:<cover>:<from>`); the approver is never the requester or the person covering.
  Approving checks again, writes `user_delegations` with the change and the approver, and tells both people. With
  `access.change_approval` off it is written at once, never to the requester.
- Status (business date): `scheduled`, `in-effect`, `ended`, `ended-early` (status `revoked`), and for requests
  `pending`, `rejected`, `withdrawn`. `GET /delegations?view=current|pending|ended|all`.
- `POST /delegations/:id/end` (reason of `delegation_end`): stops at once, both people are told.
- A delegation never lowers authority: under `access.authority_without_limit = allow` a person without a limit of his
  or her own is not restricted and a delegated limit is not applied (`effectiveAuthority`).

## Segregation of duties: conflicts and exceptions

- `GET /sod-conflicts`: users x rules broken with the state `open`, `accepted` (an exception in force), `pending`
  (an exception waiting) or `expired` (open again after the exception's date, without any job).
- `POST /sod-rules`, `PUT /sod-rules/:id` (also `active` to switch a rule on again), `DELETE /sod-rules/:id` (switch
  off): reason of `access_change`; kind `sod-rule`, target the rule code (`SOD-<n>` given by the server for a new
  rule). The audit entry keeps the rule before and after.
- `POST /sod-exceptions` (reason of `sod_exception`, `validUntil` after today and at most
  `access.sod_exception_max_days` days away): not for oneself; kind `sod-exception`, target `<rule id>:<user id>`; the
  person concerned does not approve it. `POST /sod-exceptions/:id/end` applies at once. An exception does not lift
  a Block rule when roles are given.

## Access reviews

- `POST /reviews` with a scope (`all`, `departments` of the role directory, `roles`) and a due date from today;
  `POST /reviews/preview` counts the users.
- `POST /reviews/:id/items/:itemId`: `keep`, `remove-roles` (`removeRoles`, all roles = deactivate) or
  `deactivate`, a reason of `access_review` for a removal, a note to keep a dormant user or one with an open
  conflict. Nobody decides his or her own line; an administrator account (full-access role or the built-in
  administrator) only a System Administrator; the built-in administrator is never deactivated. The earlier
  `{ decision: 'revoke' }` means deactivate. `POST /reviews/:id/items/keep` keeps several lines.
- `POST /reviews/:id/submit` once every line is decided: status `awaiting-signoff`, kind `access-review`, target
  `AR-<id>`. Another approver who decided none of its removals signs it off: the roles still held are removed, an
  account is deactivated (or noted as already inactive), sessions are renewed, the review closes. A rejection
  (returned) or a withdrawal opens it again. With approval off the removals apply when decided and
  `POST /reviews/:id/close` closes it.

## User Access Matrix

`GET /user-matrix` (all statuses; the screen shows Active by default) and `GET /users/:id/access` (the panel). Ages
and dormancy on the business date. Pending changes per user: role access of a role held, delegations from or to the
user, exceptions, review removals, personal limits and limits of a role held. Ending sessions
(`POST /users/:id/sign-out`) of an administrator account needs a System Administrator.

## Exports

Every screen downloads a workbook with the letterhead banner, "as at" and "exported by" on the first sheet
(`?format=xlsx`, `csv` = the first sheet; `&technical=1` adds the codes for an administrator): user matrix (Users,
Roles of users, Segregation of duties, Delegations in effect), delegations, segregation of duties (Rules, Conflicts by
user, Exceptions, Waiting for approval), the list of reviews and one review (Summary, Users).

## Changes of access (maker-checker)

`changes.js` keeps the changes in `accounting_config_changes`; a kind registers its handler with
`registerAccessKind(kind, { label, link, describe, assertDecider, apply, closed, requested, applied })`
(`role-access` in `roleAccess.js`, `authority-limits` in `authority.js`, `delegation` in `delegations.js`, `sod-rule`
and `sod-exception` in `sod.js`, `access-review` in `reviews.js`). `closed` runs on a rejection or a withdrawal (a
review returns to Open). `apply` may return `notices` (personal notifications after the commit). My Work lists every
waiting change to the approvers other than the requester and the person concerned. `posting-rules/service.js` only
lists and decides its own kinds.

## Key settings

`access.change_approval`, `access.sod_enforced`, `access.role_groups`, `access.platform_roles`, `access.delegation_max_days`,
`access.sod_exception_max_days`, `access.review_due_days`,
`access.authority_enforced`, `access.authority_without_limit`, `access.authority_reference_required`, `access.dormant_days`,
`limits.bulk_upload_max_rows` (rows of an upload).

## Debugging

- A role shows a level as "Through Accounting": the level comes from an included role; change that role.
- A change cannot be submitted: the bar shows a segregation-of-duties rule set to Block; switch it to Warn or change
  the selection. `POST /access-control/role-access/check` gives the same answer.
- Users of a changed role are asked to sign in again: their access token carries the permissions; the change renewed
  their sessions.
- A limit approved today still shows the old value: its effective date is later; the cell shows the scheduled change.
- An upload says a row "has a change waiting for approval": decide or withdraw that change first, or put its value in
  the file.
- A delegation is approved but the person covering is still "not restricted": the approver away has no limit, or the
  person covering has none and "Not set" allows; a delegation only raises a limit.
- A conflict shows Open again although an exception was approved: its Valid until date has passed.
- A review cannot be submitted: a line is still To review, or the review is already waiting for sign-off.
