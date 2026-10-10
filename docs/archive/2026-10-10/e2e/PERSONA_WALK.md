# BrokerVerse OOTB persona walks

The persona walks were the first screen-by-screen checks of every menu per user. They ran on 29 September 2026
with the role model of that time (Business Administrator, IT Administrator, User Access Administrator, Sales, Agent,
Underwriter, Customer Services, Claims, Finance). That model has since been replaced by the seven broker roles, and
the persona walks by the role walk. This page records what the persona walks found and where the current results
are.

## Current result

The role walk of 29 September 2026 signed in one user per broker role and opened every screen its menu offers:
7 roles, 429 screens, no screen problems, 2,823 API calls all successful. See [ROLE_WALK.md](../../../e2e/ROLE_WALK.md) and the
summary in [E2E_REPORT.md](E2E_REPORT.md).

## What the persona walks found

| Run | Screens opened | Failed | What followed |
|---|---|---|---|
| First walk (11 personas) | 469 | 280 | Fixes D100 to D129: crashing screens, menus that led to screens the API refused, report filters that needed a permission the role lacked, forms that saved without validation, raw translation keys, dates not in DD/MM/YYYY, content past the right edge |
| Second walk (same personas, every write request blocked) | 465 | 13 real failures (24 flagged, 11 of them test artefacts) | Fixes D139 to D146: the last ISO dates, "Create Policy" offered to Claims, unformatted amounts in notifications, "+91" and "Pin Code" on master forms, required-field wording, "Add" buttons that were clickable divs, report and configuration wording, calendar periods on the Executive Dashboard |

Every item is in [DEFECTS.md](DEFECTS.md) with its fix and re-test. The persona access check of the same day (menu per
persona, a forbidden address blocked, a forbidden API call answered 403) is in [persona_access.md](persona_access.md);
its roles are the old ones.

## Old role names

| Persona walk role | Broker role now |
|---|---|
| it-admin, ba, user-access-admin | System Administrator (Super Admin Access), `system-admin` |
| sales, agent | Sales & Marketing (Account Executive), `sales`; there is no agent sign-in |
| underwriting | Processing Team (Placement & Policy Processing), `processing` |
| customer-services | Operations (Client Servicing), `operations` |
| claims | Claims, `claims` |
| finance | Accounting, `accounting`; the approvers of month-end, year-end and bank reconciliations hold Accounting Manager, `accounting-manager` |
