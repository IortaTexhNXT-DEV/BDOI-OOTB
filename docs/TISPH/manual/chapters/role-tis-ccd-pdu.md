<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-ccd-pdu.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build.
-->
# CCD-PDU (Post-Dated Cheques) {#ccd-pdu-post-dated-cheques}

## Role summary {#ccd-pdu-post-dated-cheques-summary}

{{role-summary:tis-ccd-pdu}}

CCD-PDU keeps the post-dated cheques that clients hand to Toyota Insurance Services Philippines for the instalments of
their premiums. You encode each client's cheques as a set against the instalments of the bill when you receive them,
give the client the acknowledgement receipt, forward the cheques payable to the Insurance Partner with a transmittal,
record the partner's receipt and advices, deposit the cheques payable to TISPH on their dates, and ask for the
cancellation, replacement or return of cheques. Nothing is posted when a cheque is received: a cheque is accounted for
when it is collected.

You work with CCD-PDC / CCD-ADA, who approves the cancellations you ask for, with CCD-BP / QRPh (Receipting), who
receipts the other collections, and with CCD-Recon (Reconciliation and Reversals), who matches the deposits with the
bank statement. You do not open the receipts. The TIS Operations and Sales users see the result on the policy's
payment status.

{{include:generated/roles/tis-ccd-pdu.md}}

## Daily and periodic tasks {#ccd-pdu-post-dated-cheques-tasks}

| Task | When | Screen |
|---|---|---|
| Read the morning notifications: cheques due for deposit, cheques to follow up | Every morning | [Notifications](#notifications) |
| Encode the post-dated cheques received from clients and print their acknowledgement | Daily, as cheques arrive | [Post-Dated Cheques](#post-dated-cheques) |
| Forward the cheques payable to an Insurance Partner | Daily | [Post-Dated Cheques](#post-dated-cheques) |
| Record the partners' receipts and their cleared or bounced advices | As they arrive | [Post-Dated Cheques](#post-dated-cheques) |
| Deposit the cheques payable to TISPH on their dates | Daily | [Post-Dated Cheques](#post-dated-cheques) |
| Ask for the cancellation of a cheque; replace or return cheques | As requested | [Post-Dated Cheques](#post-dated-cheques) |
| Count the cheques in the vault against the log | Month-end | [Post-Dated Cheques](#post-dated-cheques) |
| Run the PDC reports | Month-end | [All Reports](#reports-catalogue) |

## Procedures {#ccd-pdu-post-dated-cheques-procedures}

### Find a cheque in the log {#ccd-pdu-post-dated-cheques-register}

1. Choose {{menu:/accounts/post-dated-cheques}}.
2. Open the tab of the cheques you look for: **At TIS**, **With partners**, **Awaiting confirmation** (dated in the
   past, no advice from the partner yet), **Follow-up**, **Bounced**, **Deposit due** or **All open**.
3. Type a PDC number, cheque number, client, policy or set in the search box; **Export** downloads the tab.

Select a row to see the cheque, its set with every instalment and its history.

![Accounts > Post-Dated Cheques, the log with its tabs](images/role-tis-ccd-pdu/post-dated-cheques.png)

### Encode the cheques of a client {#ccd-pdu-post-dated-cheques-encode}

1. Choose {{menu:/accounts/post-dated-cheques}} and select **Encode PDCs**.
2. Enter the policy and choose the bill. One row is proposed per unpaid instalment, with its due date and amount.
3. Choose the payee: **Insurance Partner** (forwarded for warehousing) or **TISPH** (kept and deposited by TISPH).
4. For each cheque enter the bank, branch, account number, cheque number, cheque date and amount. **Copy down**
   repeats the bank details on the next rows.
5. Enter where the cheques are kept and select **Save set**. The system gives the set its number (PCS-2026-00031) and
   each cheque its PDC number, **Received at TIS**.
6. Open a cheque of the set and select **Print acknowledgement**: the client keeps the acknowledgement receipt.

| Rule | |
|---|---|
| Cheque date | Within a few days of the instalment due date |
| Amounts | Not more than the bill still owes after the cheques already encoded for it |
| Cheques | Not the same cheque number of the same bank twice |

![Encode PDCs, one row per instalment](images/role-tis-ccd-pdu/encode-pdcs.png)

### Forward cheques to the Insurance Partner {#ccd-pdu-post-dated-cheques-forward}

1. On the **At TIS** tab tick the cheques payable to one Insurance Partner and select **Forward to Insurance Partner**.
2. Choose how they are sent (courier, messenger or hand-carry) and the courier reference. The transmittal
   (PT-2026-00008) lists them; its Excel file goes with the cheques.
3. When the partner acknowledges the transmittal, select **Partner received** on the transmittal (all cheques or those
   ticked), with who received them and the partner's reference. The cheques are **Warehoused**.

### Record the partner's advice: cleared or bounced {#ccd-pdu-post-dated-cheques-clear}

- **Partner cleared**: enter the collection date and the partner's reference. The acknowledgement receipt of the
  cheque is posted against the premium payable to the partner and the instalment is paid.
- **Partner bounced**: choose the reason (DAIF, account closed, stop payment, signature differs, stale, other). The
  receipt of the cheque is cancelled, the instalment is open again and the client is told.

### Deposit a cheque payable to TISPH {#ccd-pdu-post-dated-cheques-deposit}

1. Open the **Deposit due** tab and select **Deposit** on the cheque.
2. The cheque goes to the one collection account of TISPH; enter the deposit date (not before the cheque date).
3. The official receipt is posted and the cheque is **Deposited**. Record **Cleared** or **Bounced** from the bank's
   answer.

### Cancel, replace or return a cheque {#ccd-pdu-post-dated-cheques-replace}

- **Request cancellation**: choose the reason (cash or cheque replacement, technical defect, policy cancelled, paid off,
  encoded in error). CCD-PDC / CCD-ADA approves it; you cannot approve your own request. A cheque the partner holds is
  pulled out on the next transmittal to that partner.
- **Replace**: on a bounced or cancelled cheque, enter the new cheque for the same instalment.
- **Return to client**: a cheque kept at TIS goes back to the client with the reason.

See [Post-dated cheques](#post-dated-cheques) for the whole screen and [Post-dated cheques](#process-pdc) in the
TISPH process.
