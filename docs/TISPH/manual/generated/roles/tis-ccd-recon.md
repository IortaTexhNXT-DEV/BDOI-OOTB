## Menus available {#ccd-recon-reconciliation-and-reversals-menus}

The menus of this role as delivered. Access: View (open and read), Create and edit (enter and change records), Approve (decide the records of other users).

| Menu | Screen | Access |
|---|---|---|
| My Work | My Work | View |
| Operations | Payments | View |
| Accounts | Receipts | Create and edit |
| Accounts | Collections | Create and edit |
| Accounts | Post-Dated Cheques | Create and edit |
| Accounts | Claims Settlements | Create and edit |
| Accounts | Disbursement | View |
| Accounts | Open Entry Matching | View |
| Accounts | Open Entry Unmatching | View |
| Accounts > Bank Reconciliation | Reconciliation Workspace | Create and edit |
| Accounts > Bank Reconciliation | Reconciliations | Create and edit |
| Accounts > Bank Reconciliation | Reconciliation Statement Report | Create and edit |
| Accounts > Bank Reconciliation | Outstanding Cheques | Create and edit |
| Accounts > Bank Reconciliation | Deposits in Transit | Create and edit |
| Accounts > Bank Reconciliation | Unmatched Bank Lines | Create and edit |
| Accounts > Bank Reconciliation | Bank Book | Create and edit |
| Accounts > Insurer Reconciliation | Insurer Statements | Approve |
| Reports | All Reports | View |
| Reports > Financial Reports | SOA/Premium Receivable | View |
| Reports > Financial Reports | Collection Report | View |

## What you can view, change and approve {#ccd-recon-reconciliation-and-reversals-access}

| Area | Module | Access | What it allows |
|---|---|---|---|
| Accounts | Receipts | View | See receipts and post-dated cheques |
| Accounts | Receipts | Create and edit | Issue official receipts, post cash, verify payments, handle post-dated cheques |
| Accounts | Collections and credit control | View | See collections, instalment plans and credit limits |
| Accounts | Collections and credit control | Create and edit | Record collections and adjustments |
| Accounts | Disbursements and petty cash | View | See payment vouchers, petty cash and bank payment files |
| Accounts | Remittance and insurer reconciliation | View | See remittances to insurers and insurer statements |
| Accounts | Remittance and insurer reconciliation | Create and edit | Prepare remittances and insurer statement reconciliations |
| Accounts | Remittance and insurer reconciliation | Approve | Approve insurer statement reconciliations and post their adjustments (not the preparer) |
| Accounts | Bank reconciliation | View | See bank reconciliations |
| Accounts | Bank reconciliation | Create and edit | Prepare bank reconciliations |
| Reports | Reports | View | Run and download reports |
| Master data and configuration | Reference masters | View | See reference masters |
| Basic and special access | Basic access | View | Own profile and the look-up lists of every form |

## Approvals {#ccd-recon-reconciliation-and-reversals-approvals}

This role approves the work of other users:

- Approve insurer statement reconciliations and post their adjustments (not the preparer)

Approval limits of this role on the Authority Matrix:

| Transaction | Approval step | Limit of the role |
|---|---|---|
| Remittance approval | Accounts > Remittance > Approval | Not set: no amount limit applies |
| Remittance settlement, adjustment and transfer | Accounts > Remittance > Approval (settlement, adjustment, transfer) | Not set: no amount limit applies |

Who approves the work of this role:

| Work | Approval | Approved by |
|---|---|---|
| Bank reconciliation | Approve and reopen bank reconciliations (not the preparer) | TIS Finance & General Accounting |
| Collections and credit control | Approve premium warranty extensions and client credit limits (not the requester) | TIS Finance & General Accounting |
| Remittance and insurer reconciliation | Approve insurer statement reconciliations and post their adjustments (not the preparer) | CCD-Recon (Reconciliation and Reversals) |
| Accounts > Remittance > Approval | Remittance approval within the approver's limit | CCD-Recon (Reconciliation and Reversals) or TIS Finance & General Accounting |
| Accounts > Remittance > Approval (settlement, adjustment, transfer) | Remittance settlement, adjustment and transfer within the approver's limit | CCD-Recon (Reconciliation and Reversals) or TIS Finance & General Accounting |

The user who enters a record never approves it: the approval is always another user's.

## Segregation of duties {#ccd-recon-reconciliation-and-reversals-sod}

| Rule | Conflict | When given together | Reason |
|---|---|---|---|
| Administration and transactions | Receipts (create and edit), Collections and credit control (create and edit), Remittance and insurer reconciliation (create and edit) with Users (create and edit), Roles (create and edit), Access control (create and edit) held by the same person | Warning | The person who administers users and access should not enter business or accounting transactions |
| Placing and paying insurers | Remittance and insurer reconciliation (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who places business with an insurer should not also prepare the payments to insurers |
| Receipting and selling | Receipts (create and edit) with Quotations and placement (create and edit), Policies (create and edit) held by the same person | Warning | The person who issues receipts and posts cash should not also sell or issue the policies paid for |
| Receipting and reversals | CCD-Recon (Reconciliation and Reversals) and CCD-BP / QRPh (Receipting) held by the same person | Warning | RBAC v4: CCD-BP issues the receipts and has no reversal rights; reversals and adjustments sit with CCD-Recon |

These are the delivered rules. The rules in force are on Master > Users and Access > Segregation of Duties.
