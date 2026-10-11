<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-ccd-pdc.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build.
-->
# CCD-PDC / CCD-ADA {#ccd-pdc-ccd-ada}

## Role summary {#ccd-pdc-ccd-ada-summary}

{{role-summary:tis-ccd-pdc}}

CCD-PDC / CCD-ADA collects the premiums paid by post-dated cheque and by auto-debit arrangement. On Post-Dated Cheques
you work like CCD-PDU (Post-Dated Cheques): you encode, forward, deposit and follow cheques, and you approve the
cancellations CCD-PDU asks for. For a client who pays by authority to debit, you pass the bank's debit advice to
CCD-BP / QRPh (Receipting), who issues the official receipt; you read the receipts, the collections, the bank
reconciliation and the insurer statements to answer clients and follow the cheques and debits until the bank statement
shows them.

You work with CCD-PDU (Post-Dated Cheques) on the cheque register, with CCD-BP / QRPh (Receipting) for the other
collections and with CCD-Recon (Reconciliation and Reversals), who matches your receipts with the bank statement and
handles returned debits.

{{include:generated/roles/tis-ccd-pdc.md}}

## Daily and periodic tasks {#ccd-pdc-ccd-ada-tasks}

| Task | When | Screen |
|---|---|---|
| Read the morning notifications of the cheques due for deposit and to follow up | Every morning | [Notifications](#notifications) |
| Encode and forward post-dated cheques and deposit those due | Daily | [Post-Dated Cheques](#post-dated-cheques) |
| Record the partners' advices and the cleared and bounced cheques | Daily | [Post-Dated Cheques](#post-dated-cheques) |
| Approve or return the cancellations asked by CCD-PDU | Daily, from My Work | [Post-Dated Cheques](#post-dated-cheques) |
| Check the auto-debits receipted from the bank's debit advice | On each debit date | [Receipts](#verify-payments-and-post-official-receipts) |
| Check the premiums still open and their ageing | Daily | [Collections](#collections) |
| Check that your deposits and debits appear on the bank statement | Daily | [Bank Reconciliation](#bank-reconciliation) |
| Look up an insurer statement when the insurer asks about a payment | As needed | [Insurer Statements](#insurer-statement-reconciliation) |
| Run the collection report, the statement of account and the deposits in transit | Month-end | [All Reports](#reports-catalogue), [Bank Reconciliation](#bank-reconciliation) |

## Procedures {#ccd-pdc-ccd-ada-procedures}

### Post-dated cheques {#ccd-pdc-ccd-ada-cheques}

You encode, forward, deposit and follow the post-dated cheques on {{menu:/accounts/post-dated-cheques}} as CCD-PDU
(Post-Dated Cheques) does:

- [Encode the cheques of a client](#ccd-pdu-post-dated-cheques-encode)
- [Forward cheques to the Insurance Partner](#ccd-pdu-post-dated-cheques-forward)
- [Record the partner's advice: cleared or bounced](#ccd-pdu-post-dated-cheques-clear)
- [Deposit a cheque payable to TISPH](#ccd-pdu-post-dated-cheques-deposit)
- [Cancel, replace or return a cheque](#ccd-pdu-post-dated-cheques-replace)

You also decide the cancellations: on **Cancellation pending** (or from My Work) open the cheque and select **Approve
cancellation**, or **Return request** with a remark. You never decide a cancellation you asked for. A cheque at TIS is
then **Cancelled**; one the Insurance Partner holds is pulled out on the next transmittal.

### Auto-debits {#ccd-pdc-ccd-ada-auto-debit}

Pass the bank's debit advice to CCD-BP / QRPh (Receipting), who issues the official receipt with the receipt mode
**Authority to Debit** (see [Issue an official receipt](#ccd-bp-qrph-receipting-official-receipt)). Check the receipt on
{{menu:/accounts/receipts}}. If the bank reports that a debit failed after it was receipted, tell CCD-Recon
(Reconciliation and Reversals), who reverses the receipt (see [Reverse a receipt](#reverse-a-receipt)).

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
