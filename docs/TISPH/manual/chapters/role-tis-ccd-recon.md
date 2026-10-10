<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-ccd-recon.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.ccd-recon.
Screens to refresh (redesign in another stream, described as on this build): ccd-recon-reconciliation-and-reversals-returned-cheque
and ccd-recon-reconciliation-and-reversals-bank-adjustments (Create adjustment dialog).
-->
# CCD-Recon (Reconciliation and Reversals) {#ccd-recon-reconciliation-and-reversals}

## Role summary {#ccd-recon-reconciliation-and-reversals-summary}

{{role-summary:tis-ccd-recon}}

CCD-Recon (Reconciliation and Reversals) checks every day that the collections posted by Cash Control agree with the
bank. You import the bank statements, match them with the receipts and payments in the books, post the bank items not
yet booked, reverse the receipts of cheques returned by the bank and prepare the monthly bank reconciliation. You also
reconcile the insurers' statements of account with the remittances and approve the insurer statement reconciliations
prepared by another user. With TIS Finance & General Accounting you prepare the remittances to the insurers and
submit them for approval; TIS Finance & General Accounting and the TIS General Manager approve them.

You work with CCD-BP / QRPh (Receipting), CCD-PDU (Post-Dated Cheques) and CCD-PDC / CCD-ADA, whose receipts you
match and reverse; the receipting roles do not reverse their own receipts. TIS Finance & General Accounting approves
your bank reconciliations and the bank adjustments that need approval.

{{include:generated/roles/tis-ccd-recon.md}}

## Daily and periodic tasks {#ccd-recon-reconciliation-and-reversals-tasks}

| Task | When | Screen |
|---|---|---|
| Work through the follow-ups and approvals waiting for you | Every morning | [My Work](#my-work) |
| Import the bank statement of each bank account | Daily | [Bank Reconciliation](#bank-reconciliation) |
| Match the statement lines with the receipts and payments | Daily | [Bank Reconciliation](#bank-reconciliation) |
| Post bank charges, interest and direct credits not yet booked | Daily | [Bank Reconciliation](#bank-reconciliation) |
| Reverse the receipts of cheques returned by the bank | As the bank returns them | [Bank Reconciliation](#bank-reconciliation), [Post-Dated Cheques](#post-dated-cheques) |
| Follow up overdue premiums and promises to pay | Daily | [Collections](#collections) |
| Record claim settlement funds received from insurers | As insurers pay | [Claims Settlements](#claims-settlements-paid-through-the-broker) |
| Cancel stale cheques not presented within the stale period | Month-end | [Bank Reconciliation](#bank-reconciliation) |
| Prepare the bank reconciliation of each account for TIS Finance & General Accounting | Month-end | [Bank Reconciliation](#bank-reconciliation) |
| Import and reconcile the insurers' statements of account | Monthly, as statements arrive | [Insurer Statements](#insurer-statement-reconciliation) |
| Approve the insurer statement reconciliations prepared by another user | As submitted | [Insurer Statements](#insurer-statement-reconciliation) |
| Check and submit the weekly draft remittances to the insurers | Every Monday, after the weekly run | [Remittances](#remittances-worklist) |
| Follow the remittances you submitted until they are approved | Daily | [Approvals](#remittance-approvals) |
| Follow up the remittance exceptions assigned to you | Daily | [Exceptions](#remittance-exceptions) |
| Run the bank book, deposits in transit, outstanding cheques and reconciliation statement | Month-end | [Bank Reconciliation](#bank-reconciliation), [All Reports](#reports-catalogue) |

## Procedures {#ccd-recon-reconciliation-and-reversals-procedures}

### Start the day from My Work {#ccd-recon-reconciliation-and-reversals-my-work}

1. Choose **My Work**. The categories on the left are **Collection follow-ups**, **Approvals**, **Bank
   reconciliations** and **Tasks**.
2. Under **Collection follow-ups**, each overdue bill shows "Follow up the overdue premium" and each promise to pay
   "Confirm the payment promised". Work them as in
   [Follow up an overdue premium](#ccd-bp-qrph-receipting-follow-up).
3. Under **Approvals**, select the arrow of an insurer statement reconciliation to open it and decide it.
4. The remittances you submitted are followed on {{menu:/finance/remittance/approvals}}, under **Submitted by me**:
   see [Follow a remittance you submitted](#ccd-recon-reconciliation-and-reversals-remittance-approve).

![My Work of CCD-Recon (Reconciliation and Reversals): collection follow-ups and approvals](images/role-tis-ccd-recon/my-work.png)

### Import a bank statement {#ccd-recon-reconciliation-and-reversals-import}

1. Choose {{menu:/accounts/bank-reconciliation}}. Select the **Bank account** and the **Period**.
2. Select **Import statement**. The **Statement format** of the bank is proposed; select **Download template** for
   the standard layout if the bank's export cannot be read.
3. Attach the **Statement file (CSV / XLSX)**. Type the **Bank statement no.**, and the **Opening balance** and
   **Closing balance** if they are not in the file. Keep **Leave out lines already on file** ticked.
4. Select **Preview**. Check the lines, the credits and debits, and that opening balance plus credits less debits
   equals the closing balance. The preview warns of lines already on file and of an opening balance that does not
   continue from the previous statement.
5. Select **Import**. The statement is saved and its lines are matched automatically where they can be.

The cards show the **Balance per bank**, the **Balance per books**, the **Unmatched bank lines**, the **Unmatched
book entries** and the **Difference**.

![Accounts > Bank Reconciliation > Reconciliation Workspace, with the balances, the bank statement lines and the book entries](images/role-tis-ccd-recon/reconciliation-workspace.png)

### Match the bank lines with the books {#ccd-recon-reconciliation-and-reversals-match}

1. Select **Auto-match**. The matching rules pair bank lines and book entries of the same amount (by reference, by
   date, one to many and many to one); the number of matches found is shown.
2. For the lines left, tick the bank line(s) under **Bank statement lines** and the receipt(s) or payment(s) under
   **Book entries**. The selection shows **Bank** and **Books** with the number ticked.
3. Select **Match selected**. When the amounts differ, **Match with a difference** asks for the **Treatment of the
   difference**: **Adjustment journal** (with the **Bank transaction type**), **Bank error** or **Book error**, and
   **Remarks**.
4. For a bank line that is the bank's mistake, select the flag icon (**Mark as bank error**): the line becomes a
   reconciling item on the bank side and no journal is posted.

To undo a match, select **All** on either side, find the matched line and select **Unmatch** with the reason. The
undone match stays in the audit trail. A match in an approved reconciliation cannot be undone.

### Post a bank item not yet in the books {#ccd-recon-reconciliation-and-reversals-bank-adjustments}

1. In the row of the bank line, select **Create adjustment**.
2. In **Bank transaction type**, select the item: **Bank charges**, **Interest income**, **Final tax on interest**,
   **Direct credit from client**, **Direct credit from insurer** or **Other bank debit**.
3. Check the **Posting date**, type the **Remarks** and select **Post**.

The adjustment journal is posted and matched with the bank line. **Direct credit from insurer** and **Other bank
debit** require approval: the journal is sent to TIS Finance & General Accounting, who approves and posts it; it is
matched when approved.

### Reverse a returned cheque {#ccd-recon-reconciliation-and-reversals-returned-cheque}

A cheque deposited by Cash Control that the bank returns unpaid (DAIF, DAUD, account closed) appears as a bank debit
on the statement.

For a post-dated cheque of the register, record the return on {{menu:/accounts/post-dated-cheques}}: see
[Record the bank's answer: cleared or bounced](#ccd-pdu-post-dated-cheques-clear). The receipt is cancelled there.

For any other cheque receipted on Receipts:

1. On the Reconciliation Workspace, select **Create adjustment** in the row of the returned cheque.
2. In **Bank transaction type**, select **RCHQ – Returned cheque**.
3. In **Official receipt of the returned cheque**, type the receipt number (for example OR-2026-00018).
4. Type the **Remarks**, for example the bank's reason, and select **Post**.

The system cancels the official receipt: its journals are reversed, the bill is open again and the reversal is
matched to the bank line. The receipt shows **Cancelled** on Receipts. Ask the client for a new payment; it is
receipted again by CCD-BP / QRPh (Receipting).

![Create adjustment with the bank transaction type Returned cheque and the official receipt to cancel](images/role-tis-ccd-recon/returned-cheque-adjustment.png)

### Cancel a stale cheque {#ccd-recon-reconciliation-and-reversals-stale}

1. Select **Stale cheques**. The list shows the payments in the books that have not cleared the bank within the
   stale period.
2. Select **Cancel cheque** in the row, type the reason (for example "Not presented within the stale period") and
   confirm. The payment journal is reversed and the payable is open again.

### Prepare the monthly bank reconciliation {#ccd-recon-reconciliation-and-reversals-prepare}

1. On the Reconciliation Workspace, select the bank account and the period and select **Start reconciliation** (or
   **New reconciliation** on Reconciliations). The reconciliation (BRC-2026-00001) opens as **Draft** with live
   figures.
2. Check the statement: balance per bank, deposits in transit, outstanding cheques and bank errors against the
   balance per books, bank credits and charges not yet booked and book errors.
3. When every line is matched or explained and the adjusted balances agree (**Difference** **₱0.00**), select
   **Prepare** and confirm. The statement of the period must have been imported. The figures are frozen and the
   reconciliation goes to TIS Finance & General Accounting for approval.

The approver cannot be you. When approved, every match cleared up to the period end is locked. An approver can
**Reopen** a reconciliation with remarks: it returns to **Draft** and you receive a notification. **Print PDF** gives
the Bank Reconciliation Statement. **Cancel** cancels a draft started in error; the matches are kept.

All reconciliations are listed on Accounts > Bank Reconciliation > Reconciliations, with the preparer and the
approver.

### Reconcile an insurer's statement of account {#ccd-recon-reconciliation-and-reversals-insurer}

1. Choose {{menu:/finance/remittance/reconciliation/insurer-statements}} and select **Import statement**.
2. Select the **Insurer** and the **Statement type**: **Premium remittance confirmation** (the premium the insurer
   received from the broker) or **Commission statement** (the commission the insurer recognises on direct-bill
   business).
3. Type **Period from** and **Period to**, the **Insurer reference** and, if needed, the **Tolerance (PHP)**. Keep
   **Statement format** at the insurer's own format.
4. Attach the **File (CSV or XLSX)**, select **Preview** to check the lines read, then **Import and match**.
5. Open the statement. The tabs **Amount differences**, **Not found at the broker**, **Missing on the insurer
   statement** and **All lines** show what does not agree.
6. For each line not matched, select **Match by hand** and pick the broker record, or **Resolve** the difference
   with **Explain with a note** or **Adjustment journal (posted on approval)**, giving the premium and commission
   adjustment.
7. Select **Submit for approval**. The reconciliation is **Pending approval** and the other CCD-Recon (Reconciliation
   and Reversals) users are notified.

![Insurer Statements > Import statement, with the insurer, statement type, period and file](images/role-tis-ccd-recon/insurer-statement-import.png)

### Approve an insurer statement reconciliation {#ccd-recon-reconciliation-and-reversals-insurer-approve}

1. Open the statement **Pending approval** from **Approvals** in My Work or from Remittance > Reconciliation.
2. Check the matched lines, the differences and their resolutions.
3. Select **Approve** (with optional remarks) and confirm with **Approve reconciliation**: the adjustment journals
   are posted and the reconciliation is locked. Or select **Reject**, type the reason and confirm with **Reject
   reconciliation**: the statement returns to **Draft** for the preparer.

You cannot approve a reconciliation you submitted yourself: another CCD-Recon (Reconciliation and Reversals) user
approves it. See [Insurer statement reconciliation](#insurer-statement-reconciliation).

### Prepare a remittance to an insurer {#ccd-recon-reconciliation-and-reversals-remittance}

1. Choose {{menu:/finance/remittance/remittances}}. **My work** lists the drafts to submit: those of the weekly run
   and those created from a list of policies with
   [Import policy list](#remittance-import-policy-list).
2. Select the remittance number to open it. On **Lines**, check its policies, the total premium, the commission, the
   tax and the amount due to the insurer against the collections.
3. Select **Submit for approval** and confirm. To submit several drafts at once, tick them on **My work** and select
   **Submit for approval (n)**.

The remittance is **Pending approval**. The users who can approve its amount are notified; you cannot approve a
remittance yourself.

### Follow a remittance you submitted {#ccd-recon-reconciliation-and-reversals-remittance-approve}

1. Choose {{menu:/finance/remittance/approvals}}. The chip **View only** shows that you do not decide remittances.
   **Submitted by me** lists what you submitted, with the approvers each one waits on and its **SLA**.
2. If an approval is late, select **Remind approver** in the row menu (or on the remittance page). A reminder can be
   sent again after a few hours; the menu shows when.
3. A rejected remittance returns to **My work** as **Returned**. Read the reason on its **Activity** tab before you
   submit it again.

![Accounts > Remittance > Approvals of CCD-Recon (Reconciliation and Reversals): a remittance submitted, waiting for its approvers](images/role-tis-ccd-recon/remittance-approvals.png)

### Collections, receipts and claim settlement funds {#ccd-recon-reconciliation-and-reversals-other}

You also hold the receipting work of Cash Control when needed:

- [Issue an official receipt](#ccd-bp-qrph-receipting-official-receipt) and
  [Receipt bills payment and QRPh collections](#ccd-bp-qrph-receipting-bills-payment)
- [Follow up an overdue premium](#ccd-bp-qrph-receipting-follow-up)
- [Record claim settlement funds received from an insurer](#ccd-bp-qrph-receipting-claim-funds)

Disbursement, Open Entry Matching and Open Entry Unmatching are open to you to look up payment vouchers and matched
entries; the changes there are made by TIS Finance & General Accounting.
