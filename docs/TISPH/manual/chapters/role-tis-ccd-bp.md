<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-ccd-bp.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.ccd-bp.
Screens to refresh (pop-up redesign in another stream, described as on this build): ccd-bp-qrph-receipting-official-receipt
(Record payment confirmation), ccd-bp-qrph-receipting-bills-payment (Bulk upload receipts dialog),
ccd-bp-qrph-receipting-follow-up (follow-up dialogs of Collection Details), ccd-bp-qrph-receipting-claim-funds (Funds
received dialog).
-->
# CCD-BP / QRPh (Receipting) {#ccd-bp-qrph-receipting}

## Role summary {#ccd-bp-qrph-receipting-summary}

{{role-summary:tis-ccd-bp}}

CCD-BP / QRPh (Receipting) issues the official receipts of Toyota Insurance Services Philippines for the premiums
paid over the counter, by bank transfer, through bills payment and by QRPh. You post every collection against the
client's bill, print or e-mail the receipt, follow up the overdue premiums and record the claim settlement funds that
insurers pay to the broker. You also handle post-dated cheques on the same register as CCD-PDU (Post-Dated Cheques).

The acknowledgement receipt (AR) is not issued on your screens: the system issues it when an account executive
records a client's payment on the policy. You then confirm that payment against the bank, and the confirmation issues
the official receipt.

On Collections you record the follow-ups, the promises to pay and the receipts of the premiums. You do not cancel,
reverse or adjust receipts and collections: the Receipts screen has no cancel action, and a returned payment or a
receipt issued in error is handled by CCD-Recon (Reconciliation and Reversals).
Premium warranty extensions and client credit limits are approved by TIS Finance & General Accounting.

{{include:generated/roles/tis-ccd-bp.md}}

## Daily and periodic tasks {#ccd-bp-qrph-receipting-tasks}

| Task | When | Screen |
|---|---|---|
| Work through the overdue premiums and the promises to pay assigned to Cash Control | Every morning | [My Work](#my-work) |
| Issue official receipts for payments over the counter and bank transfers | Daily, as payments arrive | [Receipts](#verify-payments-and-post-official-receipts) |
| Receipt the bills payment and QRPh collections of the day | Daily, from the settlement report | [Receipts](#verify-payments-and-post-official-receipts) |
| Print or e-mail the receipts to the clients | Daily | [Receipts](#verify-payments-and-post-official-receipts) |
| Follow up overdue premiums, record notes and promises to pay | Daily | [Collections](#collections) |
| Send payment reminders to the clients when needed (each morning the system also e-mails the clients whose premiums fall due) | As needed | [Collections](#collections) |
| Register and deposit post-dated cheques | Daily | [Post-Dated Cheques](#post-dated-cheques) |
| Record claim settlement funds received from insurers | As insurers pay | [Claims Settlements](#claims-settlements-paid-through-the-broker) |
| Print the receipts of a client for a period | As requested | [Receipts](#verify-payments-and-post-official-receipts) |
| Run the collection report and the statement of account | Month-end | [All Reports](#reports-catalogue) |

## Procedures {#ccd-bp-qrph-receipting-procedures}

### Issue an official receipt {#ccd-bp-qrph-receipting-official-receipt}

1. Choose {{menu:/accounts/receipts}}. **Receipts history** lists the receipts issued, the latest first.
2. Select **Receipt**. **Add Receipts** opens with today's date as **Receipt Date** and the **Receipt Number**
   generated on saving.
3. Keep **Receipt Type** at **Payment**. In **Branch Code** choose your branch (**Head Office**) and in
   **Department Code** choose **Cash Control**.
4. In **Customer Code**, select the client. The list shows each client with an open premium and the amount open;
   type part of the code or name to find it. **Customer Name** is filled in.
5. In **Policy Number**, select the policy paid. Keep **Currency Code** at **PHP** and **Transaction Code** at
   **OR – Official Receipt**. The other code of the list, **CM – Credit Memo**, records a credit to the client's
   account that is not money received; use it only when TIS Finance & General Accounting asks for it.
6. In **Receipt Mode**, select how the client paid: **Dollar/Peso** (cash), **Cheque**, **Managers Check/Demand
   Draft**, **Direct Credit/Transfer to Account**, **Telegraphic Transfer**, **Online Banking** or **Credit
   Ticket-Inter Office**. A cheque asks for the cheque number and date; for the other modes type the bank or
   transfer reference in **Reference No. (Optional)**.
7. Under **Open bills for policy**, select the bill paid. Type the **Amount received**, or select **Pay full
   balance**.
8. Select **Record payment**. Check the client, the bill, the receipt mode and the **Balance after payment**, and
   select **Record** with the amount.

The system issues the official receipt number, posts the payment (cash in the bank account against the premium
receivable) and reduces the bill. When the bill is fully paid, the policy's payment becomes **Completed**. Back on
**Receipts**, the confirmation offers **Print receipt**, **E-mail receipt** and **Record another**.

| Field | Required | What to enter | Rule |
|---|---|---|---|
| **Receipt Date** | Yes | The date the payment was received | Must be in an open accounting period |
| **Branch Code**, **Department Code** | Yes | **Head Office** and **Cash Control** | |
| **Customer Code** | Yes | The client paying | Only clients with an open premium are listed |
| **Policy Number** | Yes | The policy paid | Only policies with an open bill are listed |
| **Receipt Mode** | Yes | How the client paid | A cheque or manager's check needs the cheque number |
| **Amount received** | Yes | The amount paid for the bill | Greater than zero and not more than the bill balance; a partial payment leaves the rest open |

![Add Receipts with the open bill selected and the full balance as the amount received](images/role-tis-ccd-bp/add-receipt-open-bill.png)

![Record payment confirmation: client, bill, receipt mode, amount and the balance after payment](images/role-tis-ccd-bp/record-payment.png)

### Receipt bills payment and QRPh collections {#ccd-bp-qrph-receipting-bills-payment}

Payments that clients make through bills payment or QRPh reach the bank with a reference; the day's settlement
report of the bank lists them.

For a few payments, issue one receipt per payment as in
[Issue an official receipt](#ccd-bp-qrph-receipting-official-receipt), with the receipt mode **Online Banking** and the
bills payment or QRPh reference in **Reference No. (Optional)**.

For the whole settlement report:

1. Choose {{menu:/accounts/receipts}} and select **Bulk Upload**.
2. Select **Download template**. The workbook has the **Data** sheet to fill in, and the **Columns** and
   **Instructions** sheets.
3. Copy one row per payment into the **Data** sheet: **Policy Number** and **Amount** are required; give the
   **Receipt Date**, the **Payment Mode** (for example online), the **Reference No** of the bills payment or QRPh
   transaction and, if needed, the **Customer Code** and **Remarks**.
4. Select **Choose file**, pick the completed file (XLSX or CSV) and select **Upload**.

Each row issues one official receipt against the open bill of the policy. The result gives the number of rows
processed, the receipts created and the rows that failed, with the row number and the reason (for example a policy
billed directly by the insurer, an amount above the balance or a date in a closed period). Correct the failed rows
and upload them again; the rows already receipted must not be uploaded twice.

![Accounts > Receipts > Bulk upload receipts, with the template and the file](images/role-tis-ccd-bp/bulk-upload.png)

### Print and e-mail receipts {#ccd-bp-qrph-receipting-print}

- One receipt: select the eye icon in its row on **Receipts**. **Receipt Detail View** shows the policy lines with
  the premium, taxes and amounts paid. Select **E-mail receipt**, **Print All** or **Print Selected**.
- A batch: select **Bulk Print**, select the **Customer Code From** (and **Customer Code To** for a range of
  clients), the **Date From** and the **Date To**, and select **Generate**. These three fields are required. The
  receipts are printed one per page in one PDF.

![Accounts > Receipts, the receipts history with Bulk Print, Bulk Upload and Receipt](images/role-tis-ccd-bp/receipts-list.png)

In the list, **Status** is **Converted** for a receipt whose lines are all paid and posted (the usual status of an
issued receipt), **Draft** for a receipt with a line not yet paid and **Cancelled** for a cancelled receipt.
**Transaction Code** is **OR** for a receipt issued on Add Receipts or by Bulk Upload, and **PAYMENT** for a receipt
issued when a payment recorded on the policy (with its acknowledgement receipt) was confirmed.

### Follow up an overdue premium {#ccd-bp-qrph-receipting-follow-up}

1. Choose **My Work**. Under **Collection follow-ups**, each overdue bill shows its next action, for example "Follow
   up the overdue premium (120 days)", and each promise to pay shows "Confirm the payment promised".
2. Select the arrow of a row, or choose {{menu:/agent/collections}} and select **View** in the row of the premium.
3. **Collection Details** shows the bill, the **Financial Breakdown**, the **Aging Analysis**, the **Follow-Up
   History** and the **Payment History**.
4. Under **Collection Actions**, select:
   - **Send Email** to write to the client, or **E-mail invoice** to send the premium invoice of the bill;
   - **Add Note** to record a call or a visit;
   - **Set Commitment Date** when the client promises to pay: give the **Commitment Date** and the **Reason for
     Delay**. The promise appears in My Work on that date.
5. When the client pays, select **Record receipt**: **Add Receipts** opens for the bill.

To remind every client with a premium due or overdue at once, select **Send Payment Reminders Now** on Collections,
then **Send reminders**. Each reminder is recorded in the follow-up history of its collection.

![Accounts > Collections > Collection Details of an overdue premium, with Record receipt](images/role-tis-ccd-bp/collection-detail.png)

### Post-dated cheques {#ccd-bp-qrph-receipting-cheques}

A client paying the counter with post-dated cheques: register them on {{menu:/accounts/post-dated-cheques}} as in
[Register a post-dated cheque](#ccd-pdu-post-dated-cheques-encode). The official receipt is issued when the cheque is
deposited on its date ([Deposit a cheque on its date](#ccd-pdu-post-dated-cheques-deposit)).

### Record claim settlement funds received from an insurer {#ccd-bp-qrph-receipting-claim-funds}

When a claim is settled through the broker, the insurer pays the settlement to Toyota Insurance Services Philippines,
which then pays the claimant.

1. Choose {{menu:/accounts/claims-settlements}}. The cards show the amounts **To receive from insurers**, **Held for
   claimants** and **Payable to claimants**.
2. Select the claim in the list (status **Awaiting insurer funds**).
3. Select **Funds received**. Select the **Insurer**, and type the **Amount**, the **Date**, the **Bank account** and
   the **Insurer remittance advice**.
4. Select **Save**. The system posts the funds received (bank against the claim receivable from the insurer).

The amount cannot be more than the insurer's outstanding share. Once the funds are in, the payment to the claimant
(**Pay claimant**) is made by TIS Finance & General Accounting. See
[Claims settlements paid through the broker](#claims-settlements-paid-through-the-broker).
