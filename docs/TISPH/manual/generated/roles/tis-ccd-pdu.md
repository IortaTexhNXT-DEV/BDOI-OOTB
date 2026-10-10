## Menus available {#ccd-pdu-post-dated-cheques-menus}

The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Operations | Payments | View |
| Accounts | Receipts | Create and edit |
| Accounts | Post-Dated Cheques | Create and edit |
| Reports | All Reports | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |

## What you can view, change and approve {#ccd-pdu-post-dated-cheques-access}

| Area | Module | Access | What it allows |
|---|---|---|---|
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Receipts | Create and edit | Issue official receipts, post cash, verify payments, handle post-dated cheques |
| Reports | Reports | View | Run and download reports |
| Master data and configuration | Reference masters | View | See reference masters |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |

## Approvals {#ccd-pdu-post-dated-cheques-approvals}

This role approves nothing.

The user who enters a record never approves it: the approval is always another user's.

## Segregation of duties {#ccd-pdu-post-dated-cheques-sod}

| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Receipts (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Receipting and selling | Receipts (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.
