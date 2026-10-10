## Menus available {#ccd-bp-qrph-receipting-menus}

The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Operations | Payments | View |
| Accounts | Receipts | Create and edit |
| Accounts | Collections | Create and edit |
| Accounts | Post-Dated Cheques | Create and edit |
| Accounts | Claims Settlements | Create and edit |
| Accounts > Remittance | Remittances | View |
| Accounts > Remittance | Reconciliation | View |
| Accounts > Remittance | Exceptions | View |
| Accounts > Bank Reconciliation | Reconciliation Workspace | View |
| Accounts > Bank Reconciliation | Reconciliations | View |
| Accounts > Bank Reconciliation | Reconciliation Statement Report | View |
| Accounts > Bank Reconciliation | Outstanding Cheques | View |
| Accounts > Bank Reconciliation | Deposits in Transit | View |
| Accounts > Bank Reconciliation | Unmatched Bank Lines | View |
| Accounts > Bank Reconciliation | Bank Book | View |
| Reports | All Reports | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |

## What you can view, change and approve {#ccd-bp-qrph-receipting-access}

Where: the screens of your menus that show the module. A module without a screen of its own is seen inside the screens of other modules (for example the remittance status of a policy).

| Area | Module | Access | What it allows | Where |
|---|---|---|---|---|
| Operations | Claims | Special | Record claim settlement funds received from an insurer | No screen of its own |
| Accounts | Receipts | View | See receipts and post-dated cheques | Receipts, Post-Dated Cheques and Claims Settlements |
| Accounts | Receipts | Create and edit | Issue official receipts, post cash, verify payments, handle post-dated cheques |  |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits | Collections |
| Accounts | Collections and credit control | Create and edit | Record collections and adjustments |  |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements | Remittances, Reconciliation and Exceptions |
| Accounts | Bank reconciliation | View | See bank reconciliations | Reconciliation Workspace, Reconciliations, Reconciliation Statement Report, Outstanding Cheques, Deposits in Transit, Unmatched Bank Lines and Bank Book |
| Reports | Reports | View | Run and download reports | SOA/Premium Receivable and Collection Report |
| Master data and configuration | Reference masters | View | See reference masters | No screen of its own |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form | No screen of its own |

## Approvals {#ccd-bp-qrph-receipting-approvals}

This role approves nothing.

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Collections and credit control | Approve premium warranty extensions and client credit limits (not the requester) | TIS Finance & General Accounting |
| Accounts > Remittance > Approvals | Remittance approval within the approver's limit | TIS Finance & General Accounting or TIS General Manager |
| Accounts > Remittance > Approvals (settlement, adjustment, transfer) | Remittance settlement, adjustment and transfer within the approver's limit | TIS Finance & General Accounting or TIS General Manager |

The user who enters a record never approves it: the approval is always another user's.

## Segregation of duties {#ccd-bp-qrph-receipting-sod}

| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Receipts (create and edit), Collections and credit control (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Receipting and selling | Receipts (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |
| Receipting and reversals | CCD-BP / QRPh (Receipting) and CCD-Recon (Reconciliation and Reversals) held by the same person | Warning | CCD-BP issues the receipts and has no reversal rights; reversals and adjustments sit with CCD-Recon |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.
