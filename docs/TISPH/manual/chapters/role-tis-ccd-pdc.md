<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-ccd-pdc.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.ccd-pdc.
Screens to refresh (pop-up redesign in another stream, described as on this build): ccd-pdc-ccd-ada-cheques (the
dialogs of Post-Dated Cheques), ccd-pdc-ccd-ada-auto-debit (Record payment confirmation).
-->
# CCD-PDC / CCD-ADA {#ccd-pdc-ccd-ada}

## Role summary {#ccd-pdc-ccd-ada-summary}

{{role-summary:tis-ccd-pdc}}

CCD-PDC / CCD-ADA collects the premiums paid by post-dated cheque and by auto-debit arrangement. On the post-dated
cheque register you work like CCD-PDU (Post-Dated Cheques): you register, deposit, clear, replace and return cheques.
For a client who pays by authority to debit, you record each debit made by the bank as an official receipt with the
receipt mode **Authority to Debit**. You also read the collections, the bank reconciliation and the insurer statements
to answer clients and follow the cheques and debits you posted until the bank statement shows them.

You work with CCD-PDU (Post-Dated Cheques) on the cheque register, with CCD-BP / QRPh (Receipting) for the other
collections and with CCD-Recon (Reconciliation and Reversals), who matches your receipts with the bank statement and
handles returned debits.

{{include:generated/roles/tis-ccd-pdc.md}}

## Daily and periodic tasks {#ccd-pdc-ccd-ada-tasks}

| Task | When | Screen |
|---|---|---|
| Read the morning notification of the cheques due for deposit | Every morning | [Notifications](#notifications) |
| Register post-dated cheques and deposit those due | Daily | [Post-dated cheques](#post-dated-cheques) |
| Record the cleared and bounced cheques | Daily, from the bank's advice | [Post-dated cheques](#post-dated-cheques) |
| Receipt the auto-debits made by the bank | On each debit date, from the bank's debit advice | [Receipts](#verify-payments-and-post-official-receipts) |
| Check the premiums still open and their ageing | Daily | [Collections](#collections) |
| Check that your deposits and debits appear on the bank statement | Daily | [Bank reconciliation](#bank-reconciliation) |
| Look up an insurer statement when the insurer asks about a payment | As needed | [Insurer statement reconciliation](#insurer-statement-reconciliation) |
| Run the collection report, the statement of account and the deposits in transit | Month-end | [All Reports](#reports-catalogue), [Bank reconciliation](#bank-reconciliation) |

## Procedures {#ccd-pdc-ccd-ada-procedures}

### Post-dated cheques {#ccd-pdc-ccd-ada-cheques}

You register, deposit and follow the post-dated cheques on {{menu:/accounts/post-dated-cheques}} exactly as
CCD-PDU (Post-Dated Cheques) does:

- [Register a post-dated cheque](#ccd-pdu-post-dated-cheques-encode)
- [Deposit a cheque on its date](#ccd-pdu-post-dated-cheques-deposit): the deposit issues the official receipt
- [Record the bank's answer: cleared or bounced](#ccd-pdu-post-dated-cheques-clear): a bounced cheque cancels its
  receipt and opens the bill again
- [Replace, return or cancel a cheque](#ccd-pdu-post-dated-cheques-replace)

### Receipt an auto-debit {#ccd-pdc-ccd-ada-auto-debit}

When the bank has debited the client's account under the client's authority to debit:

1. Choose {{menu:/accounts/receipts}} and select **Receipt**. **Add Receipts** opens with today's date as **Receipt
   Date**; change it to the debit date if needed.
2. Keep **Receipt Type** at **Payment**. Select the **Branch Code** and the **Department Code**.
3. In **Customer Code**, select the client. The list shows the clients with an open premium and the amount open.
   **Customer Name** is filled in.
4. In **Policy Number**, select the policy debited. Keep **Currency Code** at **PHP** and **Transaction Code** at
   **OR – Official Receipt**.
5. In **Receipt Mode**, select **Authority to Debit**. In **Reference No. (Optional)**, type the bank's debit
   reference.
6. Under **Open bills for policy**, select the bill debited. In **Amount received**, type the amount debited, or
   select **Pay full balance**.
7. Select **Record payment**, check the client, the bill, the amount and the **Balance after payment**, and select
   **Record** with the amount.

The system issues the official receipt number, posts the payment to the bank account and reduces the bill. The
amount cannot be more than the bill balance; a partial debit leaves the rest open. Back on **Receipts**, print the
receipt or e-mail it to the client from the confirmation.

![Accounts > Receipts > Add Receipts with the receipt mode Authority to Debit and the bank's debit reference](images/role-tis-ccd-pdc/authority-to-debit-receipt.png)

If the bank reports that a debit failed after you receipted it, tell CCD-Recon (Reconciliation and Reversals), who
handles the reversals of Cash Control: you do not reverse the receipt yourself. See
[Reverse a returned cheque](#ccd-recon-reconciliation-and-reversals-returned-cheque).

### Follow the open premiums {#ccd-pdc-ccd-ada-collections}

1. Choose {{menu:/agent/collections}}. The cards show the premium **Outstanding**, **Overdue**, **Committed**,
   **Escalated** and **Collected this month**.
2. Filter by status (**All Status**) and overdue level (**All Levels**), or search by policy or client name.
3. Select **View** in a row to see the bill, its ageing, the follow-up history and the payments.

Your role reads this screen; the follow-up of overdue premiums is done by CCD-BP / QRPh (Receipting) and CCD-Recon
(Reconciliation and Reversals). See [Collections](#collections).

![Accounts > Collections, the open premiums with their ageing](images/role-tis-ccd-pdc/collections.png)

### Check that a deposit or a debit reached the bank {#ccd-pdc-ccd-ada-bank}

1. Choose {{menu:/accounts/bank-reconciliation}}. Select the **Bank account** and the **Period**.
2. Search the **Book entries** for your receipt and the **Bank statement lines** for the deposit or the debit. A
   receipt matched with the bank shows **Matched**; an **Unmatched** receipt is not yet on the statement.
3. For a list, choose Accounts > Bank Reconciliation > Deposits in Transit, type the dates and select **Generate**.

Your role reads the bank reconciliation; the matching and adjustments are the work of CCD-Recon (Reconciliation and
Reversals). See [Bank reconciliation](#bank-reconciliation).
