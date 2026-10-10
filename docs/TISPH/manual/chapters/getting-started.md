<!--
Owner: see WRITER_GUIDE.md. Screens of this chapter: the sign-in page, the side bar and header, My Work, My Profile,
notifications, a list with filters, a form, an approval, the audit trail, the Help panel.
-->
# Getting started {#getting-started}

## Signing in {#signing-in}

Every person has his or her own account. Never share an account: every action is recorded against the user in the
audit trail.

1. Open the address of the system given by IT AppSupport in Chrome or Edge.
2. Choose **Sign in with Microsoft**.
3. Sign in with your Microsoft 365 account of Toyota Insurance Services Philippines, and complete the verification
   that Microsoft asks for.
4. The system opens My Work.

**Sign in with a user ID and password** is for the accounts that IT AppSupport creates without a Microsoft 365
account.

::: draft
Password rules, two-step verification, forgotten password and locked accounts, as configured for TISPH.
:::

## The screen layout {#the-screen-layout}

::: draft
The header (logo, menu search, notifications, profile menu), the side bar with the menus of your role, the page title
and actions, and how to return to My Work.
:::

## My Work {#my-work}

{{screen:/my-work}}

::: draft
The first screen after sign-in: the figures in the header, the work items of your role, follow-up tasks and how to
open a record from them.
:::

## My Profile {#my-profile}

::: draft
Your name, roles, e-mail and the account security settings of My Profile (profile menu > My Profile).
:::

## Notifications {#notifications}

::: draft
The bell in the header, the notifications list and what each kind of notification asks you to do.
:::

## Working with lists {#working-with-lists}

::: draft
Search, filters, status cards and tabs, sorting, paging, row actions and export.
:::

## Working with forms {#working-with-forms}

::: draft
Required fields, look-up lists, error messages, saving and cancelling, the record number given on save, uploads and
templates.
:::

## Approvals and maker-checker {#statuses-approvals-and-maker-checker}

The user who enters a record never approves it: a different user, holding the approval of that record, approves it.
The system refuses the approval of your own record and tells the users who may approve. Your role chapter lists
what your role approves and who approves your work.

| Record | Approved by |
|---|---|
| Quotation | {{roles:approve:quotations}} |
| Check of a placement against the slip | {{roles:approve:policies}} |
| Renewal terms | {{roles:approve:renewals}} |
| Claim decisions and settlement | {{roles:approve:claims}} |
| Supplier invoice | {{roles:approve:payables}} |
| Bank reconciliation | {{roles:approve:bank-reconciliation}} |
| Insurer statement reconciliation | {{roles:approve:insurer-reconciliation}} |
| Month-end and year-end close | {{roles:approve:period-end}} |
| Posting rules and account determination | {{roles:approve:posting-rules}} |
| Role access changes and authority limits | {{roles:approve:access-control}} |

On top of maker-checker, the Authority Matrix (Master > Users and Access) sets the largest amount each role may
approve per transaction, and the Segregation of Duties rules warn or block when one person is given roles that should
stay apart.

::: draft
The statuses of a record and where the approval is made on each screen (approval buttons, My Work items).
:::

## Where the audit trail is {#where-the-audit-trail-is}

The system records every creation, change, approval and sign-in with the user, the time and the values before and
after.

| Where | Who |
|---|---|
| {{menu:/master/configuration/audit-trail}} | The roles listed in [Audit Trail](#audit-trail) of the screen reference |
| The **Audit Trail** or **History** tab of a record | Users who may open the record |

::: draft
How to search the audit trail and read an entry.
:::

## The Help panel {#the-help-panel}

Press F1, or **?** outside a text field, or choose Help in the profile menu. The panel shows the section of this manual
for the screen you are on (**Open this section**), the chapter of your role (**Open my role chapter**), the manual as
PDF and Word, the support contacts and the keyboard shortcuts.
