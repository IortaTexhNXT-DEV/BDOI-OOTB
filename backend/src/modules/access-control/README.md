# Access control

Master > Users and Access: User Access Matrix, Role Permissions, Authority Matrix, Delegations, Segregation of
Duties and Access Reviews, and ending a user's sessions. Routes are under `/access-control`; users and roles
themselves are in `src/modules/users/router.js`.

## Files

| File | What it does |
|---|---|
| `router.js` | Routes of the screens, with the audit entries and the approval notifications. |
| `service.js` | Authority matrix and the check used by the approval steps (`assertAuthority`), delegations, segregation-of-duties rules (`sodConflicts`, `assertSod` used by the user form), the user and role matrices, access reviews, dormant accounts. |
| `catalogue.js` | The access catalogue: every permission code in business words (area of the menu, module, level, what it allows). |
| `roles.js` | Role directory: department, summary and order of each role, the base platform roles, full-access roles. |
| `roleAccess.js` | Role Permissions: the overview, the check of a change of a role's access, the request, applying it, the export for audit. |
| `changes.js` | Changes of access waiting for approval (maker-checker) on the configuration approval table. |

## Main tables

`roles`, `permissions`, `role_permissions` (users module), `sod_rules`, `authority_transaction_types`,
`authority_limits`, `user_delegations`, `access_reviews`, `access_review_items`, and `accounting_config_changes`
(kind `role-access`) for the changes of a role's access.

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

## Segregation of duties

Two kinds of rule (migration 0393): `roles` (two roles one person may not hold together) and `access` (two sets of
permissions a role or a person should not combine: `access_a`, `access_b`). An access rule is broken by a set of
permissions holding a code of each set, worked out on the permissions of the active roles held, the full-access roles
left out. Rules are checked when roles are given to a user (`assertSod`), on the User Access Matrix and when the
access of a role changes. The default access rules (seed `91_role_access.sql`) warn.

## Changes of access (maker-checker)

`changes.js` keeps the changes in `accounting_config_changes`; a kind registers its handler with
`registerAccessKind(kind, { label, link, describe, assertDecider, apply })` (`role-access` in `roleAccess.js`). The
kinds `delegation`, `sod-rule`, `sod-exception` and `access-review` are allowed by the table (migration 0392) for the
other screens of this menu. `posting-rules/service.js` only lists and decides its own kinds.

## Key settings

`access.change_approval`, `access.sod_enforced`, `access.role_groups`, `access.platform_roles`,
`access.authority_enforced`, `access.authority_without_limit`, `access.dormant_days`.

## Debugging

- A role shows a level as "Through Accounting": the level comes from an included role; change that role.
- A change cannot be submitted: the bar shows a segregation-of-duties rule set to Block; switch it to Warn or change
  the selection. `POST /access-control/role-access/check` gives the same answer.
- Users of a changed role are asked to sign in again: their access token carries the permissions; the change renewed
  their sessions.
