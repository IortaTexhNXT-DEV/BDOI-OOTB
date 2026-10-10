<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-ccd-pdu.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.ccd-pdu.
Screens to refresh (pop-up redesign in another stream, described as on this build): ccd-pdu-post-dated-cheques-register
(Register cheque dialog), ccd-pdu-post-dated-cheques-deposit (Deposit dialog), ccd-pdu-post-dated-cheques-bounce
(Bounced cheque dialog).
-->
# CCD-PDU (Post-Dated Cheques) {#ccd-pdu-post-dated-cheques}

## Role summary {#ccd-pdu-post-dated-cheques-summary}

{{role-summary:tis-ccd-pdu}}

CCD-PDU keeps the register of post-dated cheques that clients hand to Toyota Insurance Services Philippines for their
premiums. You register each cheque against the client's bill or policy when you receive it, record where it is
kept, deposit it on or after its date, record whether the bank cleared or returned it, and replace, return or cancel
cheques when the client asks. The cheque is acknowledged by its registration: the **On Hand** status and the PDC
number on the register are the record that Cash Control holds the cheque.
Depositing a cheque is what issues the official receipt: nothing is posted while a cheque is on hand.

You work with CCD-PDC / CCD-ADA, who handles post-dated cheques and auto-debit arrangements on the same register, with
CCD-BP / QRPh (Receipting), who receipts the other collections, and with CCD-Recon (Reconciliation and Reversals), who
matches your deposits with the bank statement. The TIS Operations and Sales users see the result on the policy's
payment status.

{{include:generated/roles/tis-ccd-pdu.md}}

## Daily and periodic tasks {#ccd-pdu-post-dated-cheques-tasks}

| Task | When | Screen |
|---|---|---|
| Read the morning notification of the cheques due for deposit | Every morning | [Notifications](#notifications) |
| Register the post-dated cheques received from clients | Daily, as cheques arrive | [Post-Dated Cheques](#post-dated-cheques) |
| Deposit the cheques dated today or earlier | Daily | [Post-Dated Cheques](#post-dated-cheques) |
| Record the cheques cleared by the bank | Daily, from the bank's advice | [Post-Dated Cheques](#post-dated-cheques) |
| Record bounced cheques and ask the client for a replacement | As the bank returns them | [Post-Dated Cheques](#post-dated-cheques) |
| Return or cancel cheques no longer needed | As requested | [Post-Dated Cheques](#post-dated-cheques) |
| Check the payment status of a policy before answering a client | As needed | [Payments](#payments), [Receipts](#verify-payments-and-post-official-receipts) |
| Count the cheques in the vault against the register | Month-end | [Post-Dated Cheques](#post-dated-cheques) |
| Run the collection report and the statement of account | Month-end | [All Reports](#reports-catalogue) |

## Procedures {#ccd-pdu-post-dated-cheques-procedures}

### Find a cheque in the register {#ccd-pdu-post-dated-cheques-register}

1. Choose {{menu:/accounts/post-dated-cheques}}. The cards show the cheques **On hand**, the cheques **Due for
   deposit** and the number **Bounced**.
2. On the **Cheques** tab, select the status in
   the first list (**On hand** is shown first; **All** shows every cheque) and type a PDC number, cheque number,
   client, policy or bill in the search box.
3. Select **Export to Excel** to download the register with the status selected.

The **Deposit due** tab lists the cheques on hand dated within the next three days, with their total. Each morning
the system sends a notification of these cheques to the Cash Control users.

![Accounts > Post-Dated Cheques, the register with the cheques on hand and their actions](images/role-tis-ccd-pdu/post-dated-cheques.png)

### Register a post-dated cheque {#ccd-pdu-post-dated-cheques-encode}

1. Choose {{menu:/accounts/post-dated-cheques}} and select **Register cheque**.
2. In **Against**, keep **Bill number** to apply the cheque to one bill, or select **Policy number**.
3. In **Reference**, type the bill number (for example INV-2026-95007) or the policy number.
4. In **Drawee bank**, select the client's bank. If the bank is not in the list, type it in **Drawee bank (if not in
   the list)**.
5. Type the **Cheque no.**, the **Cheque date** (DD/MM/YYYY, or pick it from the calendar of the field) and the
   **Amount**.
6. In **Kept in**, type where the cheque is filed, for example "Finance vault, drawer 2". Add **Remarks** if needed.
7. Select **Register cheque**. The system gives the cheque its PDC number (PDC-2026-00004) with the status **On Hand**.

| Field | Required | What to enter | Rule |
|---|---|---|---|
| **Against** | Yes | Bill number or Policy number | A policy billed directly by the insurer is refused: the client pays the insurer |
| **Reference** | Yes | The bill or policy number | The bill must have an open balance |
| **Drawee bank** | Yes, one of the two | The client's bank | Type it in **Drawee bank (if not in the list)** when it is not listed |
| **Cheque no.** | Yes | The number printed on the cheque | |
| **Cheque date** | Yes | The date on the cheque | The cheque cannot be deposited before this date |
| **Amount** | Yes | The amount of the cheque | Not more than the bill balance left after the cheques already on hand for it |
| **Kept in** | No | Vault, drawer or folder | Printed on the register and the export |

![Register cheque, with the bill, drawee bank, cheque number, date, amount and vault entered](images/role-tis-ccd-pdu/register-cheque.png)

### Deposit a cheque on its date {#ccd-pdu-post-dated-cheques-deposit}

1. Choose {{menu:/accounts/post-dated-cheques}} and open the **Deposit due** tab.
2. Select **Deposit** in the row of the cheque.
3. Check the cheque details shown, then select the **Bank account** the cheque is deposited to and the **Deposit
   date** (today by default).
4. Select **Deposit cheque**.

The system issues the official receipt for the cheque, posts it to the bank account selected and reduces the bill.
The cheque becomes **Deposited** and its receipt number is shown in the **Receipt** column. A deposit dated before the
cheque date is refused. Print or e-mail the receipt from [Receipts](#verify-payments-and-post-official-receipts).

![Deposit dialog of a post-dated cheque, with the bank account and the deposit date](images/role-tis-ccd-pdu/deposit-cheque.png)

### Record the bank's answer: cleared or bounced {#ccd-pdu-post-dated-cheques-clear}

When the bank has honoured the cheque:

1. Select **All** (or **Deposited**) in the status list and find the cheque.
2. Select **Cleared**, check the cheque and its receipt, and select **Mark as cleared**. The cheque becomes
   **Cleared**.

When the bank returns the cheque unpaid:

1. Find the deposited or cleared cheque and select **Bounced**.
2. In **Reason given by the bank**, type the reason, for example "DAIF (drawn against insufficient funds)". Type the
   **Bank charge** if the bank charged one.
3. Select **Mark as bounced**.

The system cancels the official receipt of the cheque: its journals are reversed and the bill is open again. The
cheque becomes **Bounced**, the Cash Control users receive a high-priority notification and the client, when an
e-mail address is on file, receives an e-mail about the returned cheque.

![Bounced cheque dialog, with the reason given by the bank and the bank charge](images/role-tis-ccd-pdu/bounced-cheque.png)

### Replace, return or cancel a cheque {#ccd-pdu-post-dated-cheques-replace}

- **Replace** (on a cheque **On Hand** or **Bounced**): enter the new cheque as in
  [Register a post-dated cheque](#ccd-pdu-post-dated-cheques-encode) and select **Register replacement**. The old cheque becomes
  **Replaced** and the new one is linked to it, against the same bill (or the policy when the bill is closed).
- **Return** (on a cheque **On Hand**): type why the cheque goes back to the client and select **Return cheque**. The
  cheque becomes **Returned**; the bill stays open.
- **Cancel** (on a cheque **On Hand** registered in error): type the reason and select **Cancel registration**. The
  cheque becomes **Cancelled**.

A cheque already deposited cannot be returned or cancelled: when it bounces, record it as bounced and replace it.

See [Post-dated cheques](#post-dated-cheques) for the whole screen and [Post-dated cheques](#process-pdc) in the
TISPH process.
