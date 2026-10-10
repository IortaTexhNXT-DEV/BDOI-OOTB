<!--
Owner: see WRITER_GUIDE.md. Screen reference: one section per screen of the Accounts menu, in menu order.
-->
# Screen reference: Accounts {#screens-accounts}

The screens of the Accounts menu, in menu order: receipts and collections, Cash Control, disbursements and payables, remittance to insurers, journal vouchers, reconciliations, tax, period end and incentives.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role. Every amount is in pesos; every posting goes to the general ledger through the posting rules of [Posting configuration](#posting-configuration-configuration-approvals-posting-rules-account-determination), and each document can be traced to its journal on [Accounting Query](#accounting-query-and-all-clients-accounting).

## Verify payments and post official receipts {#verify-payments-and-post-official-receipts}

When Operations or Sales record a client payment on the policy, the system issues the acknowledgement receipt (AR), the policy payment status becomes **Reviewing** and Cash Control receives the notification to verify it. Open the notification, check the payment against the bank statement and confirm it (the official receipt is posted, with the transaction code **PAYMENT**) or reject it with a reason.

{{screen:/accounts/receipts}}

The list (**Receipts history**) shows **Receipt Number** (OR-YYYY-NNNNN), **Transaction Code**, **Transaction Number** (RT-YYYY-NNNNN), **Policy Number**, **Name**, **Customer Code**, **Date**, **Amount**, **Paid**, **UnPaid**, **Status**, **Payments** and **Action**. **Status** is **Converted** when every line of the receipt is paid and posted (the usual status of an issued receipt), **Draft** while a line is not yet paid, and **Cancelled** after a cancellation. **Transaction Code** is **OR** for a receipt issued on Add Receipts or by Bulk Upload, **PAYMENT** for a receipt issued on the confirmation of a payment recorded on the policy, and **CM** for a credit memo. **Search by** chooses the column searched. The buttons are **Bulk Print** (receipts of a period as one PDF), **Bulk Upload** (bills payment and QRPh settlement files: each row pays a policy; the file is validated before anything is posted) and **Receipt**.

![Accounts > Receipts](images/screens-accounts/receipts-list.png)

To issue an official receipt, select **Receipt**:

| Field | Required | What to enter | Rule |
|---|---|---|---|
| **Receipt Date** | Yes | Today's date is proposed | Must fall in an open period |
| **Receipt Number** | | Issued by the system on save | From the official receipt series |
| **Receipt Type** | Yes | **Payment** | |
| **Branch Code**, **Department Code** | No | The branch (**Head Office**) and the department (**Cash Control**) of the receipt | |
| **Customer Code** | Yes | The client | **Customer Name** is filled in |
| **Policy Number** | Yes | The policy paid | Only the client's policies with an open bill |
| **Currency Code** | Yes | **PHP** | |
| **Transaction Code** | Yes | **OR – Official Receipt** | **CM – Credit Memo** only when TIS Finance & General Accounting asks for it |
| **Receipt Mode** | Yes | **Dollar/Peso** (cash), **Cheque**, **Managers Check/Demand Draft**, **Direct Credit/Transfer to Account**, **Telegraphic Transfer**, **Authority to Debit**, **Online Banking** or **Credit Ticket-Inter Office** | A cheque asks for the cheque details; the mode gives the bank account debited |
| **Remarks** | No | | |

Select **Record payment**. The system issues the receipt number, posts the payment (cash in the bank account of the receipt mode against the premium receivable) and reduces the bill. When the bill is fully paid the policy's payment becomes **Completed**. Print the receipt or e-mail it to the client. A payment above what the policy owes is not billed again: the excess is held On Account on [Unapplied Collections](#unapplied-collections). See [Collection by Cash Control](#process-collection).

A payment recorded on the policy carries its proof of payment (deposit slip, cheque image or transfer confirmation): the payment cannot be saved without it. The receipt page shows the proof under **Proof of payment**, where a receipting user attaches or replaces it, and **Paid to**: **TISPH**, or **Insurance company** for a payment made to the insurer.

### Reverse a receipt {#reverse-a-receipt}

A receipt issued in error, or paid by a cheque that bounced, is reversed from the receipt page, section **Reversal**. CCD-Recon selects **Reverse receipt**, chooses the reason (cheque returned DAIF, duplicate receipt, wrong amount, applied to the wrong policy or client, payment not received in the bank, other with a note) and sends it for approval. The receipt stays posted until another user approves: {{roles:approve:receipt-reversal}}, never the user who asked. On approval the receipt is cancelled, its journals are reversed, the bills it paid are open again and an amount it held On Account is taken back. The approver can instead **Return** the request with a reason; the receipt is unchanged. The request is on My Work of the approvers.

![The Reversal section of a receipt, approved](images/screens-accounts/receipt-reversal.png)

### Bulk upload and receipt batches {#receipt-batches}

**Bulk Upload** takes three files, each with its template:

- **Official receipts**: each row pays a policy. On the receipt voucher file of TISPH a row can combine premium and commission: **Commission Amount** is the commission part of the **Amount**. The premium is receipted; the commission is kept apart on the batch for Finance & General Accounting to reconcile with the insurer.
- **Bank payments (matched by reference)**: the bank's report of payments credited to TISPH (**Date**, **Reference**, **Amount**, **Bank Account**, **Payer**). Each line is matched by its reference (the 10-digit payment reference of the policy, its policy number or the bill number) to what the policy owes. Within one peso it is receipted in full; above it the receipt pays the bills and the excess is held On Account; below it the receipt pays part and the line is an insufficient payment; a reference that finds no policy is held as a floating payment.
- **Payments made to the insurer**: payments the clients made directly to the insurance company (**Policy Number**, **Amount**, **Date Paid**, **Insurer Reference**). Each settles the policy's bills with a receipt marked paid to the insurance company: the premium payable to the insurer is reduced instead of the cash.

Every upload is a receipt batch (RVB-YYYY-NNNNN). **Receipt batches** lists them with the file, the rows receipted, the premium and the commission kept apart. **Export commission** downloads the commission lines of a batch; **Export lines** downloads how each line of a bank payment file was matched.

Each policy has a 10-digit payment reference, the number the client quotes at the bank. Search the open bills on Add Receipts by it, by the plate or chassis number of the vehicle, or by the client, policy or bill number; the bills show the vehicle.

## Unapplied collections {#unapplied-collections}

Accounts > Unapplied Collections lists the money received that no bill takes yet:

- **Excess payment**: paid above what the policy owes, held On Account;
- **Floating payment**: a bank credit whose client or bill is not yet known;
- **Advance payment**: paid by a client before the bill exists.

{{screen:/accounts/unapplied-collections}}

![Accounts > Unapplied Collections](images/screens-accounts/unapplied-collections.png)

Each is posted to the clients' deposits and unapplied collections account and must be allocated within two working days (**Allocate by**; past it, the row shows **Overdue** and the item is on My Work of Cash Control). The cards show the open items, the open amount and the items past their date. Filter by status and kind, or search by client, policy, receipt or reference.

**Record payment** records a floating payment (amount, date received, reference, the payer if known) or an advance payment (with the client code). The actions of a row are:

- **Allocate**: choose the open bills (the client's bills, or for a floating payment those found by client, policy or bill number) and the amount for each; the amounts cannot exceed what a bill owes nor what is left to allocate. The bills are paid as by a receipt; a floating payment takes the client of the bill.
- **Refund**: with a reason (overpayment, paid twice, policy cancelled or not taken up, other with a note), the amount becomes a refund payable to the client, paid by disbursement.
- **Reverse**: a floating or advance payment recorded in error, nothing allocated yet, is reversed with a reason.

**View** shows the item with its allocations and its activity.


![Accounts > Receipts > Add Receipts](images/screens-accounts/add-receipts.png)

## Collections {#collections}

Accounts > Collections lists every open premium with **Client Name**, **Policy No.**, **Outstanding** spread over the ageing buckets (**Current**, **1-30 Days**, **31-60 Days**, **61-90 Days**, **Over 90 Days**), **Due Date**, **Status** (Pending, Committed, Overdue), **Days Overdue** and **View**. Filter by status and overdue level.

{{screen:/agent/collections}}

The cards show the **Outstanding** and **Overdue** amounts, the items **Committed** (the client gave a payment date) and **Escalated**, and the amount **Collected this month**. **Send Payment Reminders Now** e-mails the reminders of the overdue items at once; **Import open items** loads open premiums from a file.

Select **View** to open an item. **Collection Details** shows the client and policy, the overdue level, the financial breakdown of the bill (gross premium, net premium, VAT, DST, LGT, paid, outstanding), the ageing, the **Follow-Up History** and the **Payment History**. The **Collection Actions** are **Send Email**, **E-mail invoice**, **Add Note** and **Set Commitment Date**; **Record receipt** opens the receipt for this bill.

![Accounts > Collections, the open premiums by ageing bucket](images/screens-accounts/collections.png)

## Credit control {#credit-control}

{{screen:/accounts/credit-control/instalments}}

{{screen:/accounts/credit-control/warranty}}

{{screen:/accounts/credit-control/limits}}

{{screen:/accounts/credit-control/remittance-ageing}}

Changes on the Credit Control screens that need approval (a credit limit, a warranty extension) are approved by {{roles:approve:credit-control}}, a user other than the one who requested them.

- **Instalment Plans** lists the open instalments of policies paid by instalment, with **Policy no.**, **Client**, the instalment number, **Due date**, **Outstanding**, **Days past due** and **Ageing**, and the totals per ageing bucket. **Overdue only** narrows the list. Instalments are monthly. A corporate client has 90 days to pay unless the insurer's premium warranty says otherwise; an individual client has 30.
- **Premium Warranty Monitor** follows the premium payment warranty: the premium must be paid by the warranty deadline after inception, or the cover is at risk. The cards count the policies **Warranty breached** and **At risk** and the **Extensions to approve**. Each row shows the policy, client, insurer, **Inception**, **Warranty deadline**, **Days past deadline**, **Premium due** and **Status**. Request an extension from the row; the extension is approved by another user.
- **Client Credit Limits** shows each client's **Credit limit** (or **No limit**), **Open premium**, **Available** and **Last changed**. Set or change a client's limit from the row. **Issued over the limit** lists the policies booked over a client's limit.
- **Remittance Ageing** ages the premium collected and not yet remitted to each insurer, by the insurer's remittance terms (**Not yet due**, **1-30**, **31-60**, **61-90**, **Over 90**), with the detail by policy and receipt. **Excel** downloads it.

![Accounts > Credit Control > Premium Warranty Monitor](images/screens-accounts/premium-warranty-monitor.png)

## Post-dated cheques {#post-dated-cheques}

Accounts > Post-Dated Cheques follows the cheques of clients paying by instalment, from receipt to collection.

{{screen:/accounts/post-dated-cheques}}

The tabs list the cheques **All open**, **At TIS**, **With partners**, **Awaiting confirmation** (the cheque date is past and the Insurance Partner has not advised), **Follow-up**, **Bounced**, **Cancellation pending**, **Deposit due**, **Closed** and the **Transmittals**. Each row shows the PDC number and its set, the client and policy, the bank and cheque number, the cheque date, the amount, the instalment ("1 of 4"), the custody, the status and the ageing of a cheque not yet confirmed. **Export** downloads the tab.

To encode the cheques of a client, select **Encode PDCs**, enter the policy and the bill, and the payee: **Insurance Partner** (the cheques are forwarded for warehousing) or **TISPH** (kept and deposited by TISPH). One row is proposed per unpaid instalment; enter the bank, branch, account number, cheque number, cheque date and amount of each. The dates must fall near the instalment due dates and the amounts cannot exceed what the bill owes. **Save set** saves the set (PCS-YYYY-NNNNN) with its cheques **Received at TIS**; nothing is posted. **Print acknowledgement** on the set prints the acknowledgement receipt the client keeps.

Cheques payable to the Insurance Partner:

- **Forward to Insurance Partner**: choose the cheques of one partner and send them with a transmittal (PT-YYYY-NNNNN): courier, messenger or hand-carry, with the courier reference. They are **Forwarded**.
- **Partner received**: the partner's acknowledgement of the transmittal; the cheques are **Warehoused**.
- **Partner cleared**: the partner's advice that the cheque was paid, with the collection date and the partner's reference. The acknowledgement receipt is posted against the premium payable to the partner and the instalment is paid.
- **Partner bounced**: with the reason (DAIF, account closed, stop payment, signature differs, stale, other); the receipt of the cheque is cancelled and the instalment is open again for a replacement.

Cheques payable to TISPH are **Deposit**ed to the one collection account of TISPH (an official receipt is posted), then **Cleared** or **Bounced**.

**Request cancellation** asks for the cancellation of a cheque with a reason (cash or cheque replacement, technical defect, policy cancelled, account paid off, encoded in error). Another user approves it: {{roles:approve:pdc}}, never the one who asked. A cheque the partner holds is pulled out on the next transmittal to that partner. **Replace** registers the cheque that replaces a bounced or cancelled one for the same instalment; **Return to client** gives back a cheque kept at TIS. The history of each cheque shows every step with its user.

## Claims settlements paid through the broker {#claims-settlements-paid-through-the-broker}

{{screen:/accounts/claims-settlements}}

When an insurer pays a claim settlement to TISPH for the claimant, the money is received and paid out here. The cards show the amounts **To receive from insurers**, **Held for claimants** and **Payable to claimants**. Each row shows **Claim**, **Policy**, **Claimant**, **Insurer**, **Settlement**, **Received**, **Paid**, **Payable to claimants** and **Status**; the filter shows the **Outstanding** settlements or all.

1. When the claim settlement is approved (see [Approve a settlement (checker)](#approve-a-settlement-checker)), it appears here as to be received.
2. When the insurer pays, open the claim and record the funds received and the bank account they were paid into. The money is held for the claimant.
3. Print the release and quitclaim for the claimant to sign.
4. Pay the settlement to the claimant. A claim payment voucher number is assigned and the voucher can be printed. The claim's **Payment** step is completed.

Each movement is posted to the ledger. Open a claim to see its cash position: the amounts from each insurer, to the claimant and the bank accounts used.

## Accounts payable {#accounts-payable}

Suppliers are kept on Accounts > Payables > Suppliers: TIN, address, VAT registration, the EWT tax code withheld (Master > Finance > Taxation, for example WC158 goods, WC160 services, WC100 rentals), payment terms and the default expense account.

{{screen:/accounts/payables/invoices}}

{{screen:/accounts/payables/payments}}

{{screen:/accounts/payables/ageing}}

{{screen:/accounts/payables/suppliers}}

**Suppliers**: **Add** opens the supplier form: **Code** and **Supplier** (required), **TIN**, **Registered Address**, **VAT Registered**, **EWT Tax Code**, **Payment Terms (days)**, **Default Expense Account**, **Contact Person**, **E-mail**, **Phone**, **Bank** and **Bank Account No.**

**Supplier Invoices** lists **AP voucher**, **Supplier**, **Supplier invoice no.**, **Invoice date**, **Due date**, **Gross**, **EWT**, **Balance** and **Status**. To record an invoice:

1. Select **New supplier invoice**.
2. Enter **Supplier**, **Supplier invoice no.** and **Invoice date** (required), the **Description** and the **EWT tax code** (the supplier's is proposed).
3. Add a line per expense: **Description**, **Account**, **Asset class** (for a fixed asset), **Vatable** and **Amount**. The total net of VAT is shown.
4. Select **Save draft**, or **Save and submit**.

The invoice is approved by {{roles:approve:payables}}, a user other than the one who submitted it, and is posted on approval: expense (or asset), input VAT, EWT payable and the payable to the supplier. A line with an asset class creates the asset on the [Asset Register](#fixed-assets-and-depreciation).

![New supplier invoice](images/screens-accounts/supplier-invoice-new.png)

**Supplier Payments** pays approved invoices: select **New supplier payment**, choose the **Supplier**, the **Date**, the **Payment mode** (for example **Cheque**), the **Bank account** (required), the **Cheque no.** and **Reference**, tick the invoices to pay and select **Pay**. The payment is posted and the invoices' balance reduced.

**AP Ageing** ages the open supplier invoices on their due dates (**Not due**, **1-30**, **31-60**, **61-90**, **Over 90**), by supplier and by invoice. **Export to Excel** downloads it.

## BIR Form 2307 for suppliers {#bir-form-2307-for-suppliers}

The expanded withholding tax withheld from a supplier on an approved supplier invoice (the supplier's EWT tax code, on the amount net of VAT) is creditable tax of the supplier: the broker issues BIR Form 2307 for it each quarter.

{{screen:/accounts/payables/2307}}

Choose the year and the quarter. The cards show the number of **Payees**, the **Income payments subject to expanded withholding tax** and the **Tax withheld for the quarter**. Each row is one supplier: **Payee's name**, **Taxpayer Identification Number (TIN)**, **ATC**, **Transactions**, the income payments, the tax withheld and the **Certificate no.** Print the certificate of a supplier from its row. The same figures are in the QAP of [Tax: BIR forms and returns](#tax-bir-forms-and-returns).

## Fixed assets and depreciation {#fixed-assets-and-depreciation}

{{screen:/accounts/fixed-assets/register}}

{{screen:/accounts/fixed-assets/depreciation}}

**Asset Register** lists the fixed assets with **Asset no.**, **Asset**, **Class**, **Location**, **In service**, **Cost**, **Accumulated depreciation**, **Book value** and **Status**, and the totals in the cards. Assets come from supplier invoice lines with an asset class, or are registered here with **Register asset**:

| Field | Required | What to enter |
|---|---|---|
| **Asset** | Yes | The description |
| **Class** | Yes | The asset class (for example **Computer equipment**), which gives the accounts and the default useful life |
| **Acquired** | Yes | The acquisition date |
| **In service** | No | The date depreciation starts |
| **Cost** | Yes | |
| **Salvage value**, **Useful life (months)** | No | Defaults from the class |
| **Serial no.**, **Location**, **Custodian** | No | |
| Accumulated depreciation brought forward, **First period depreciated here** | No | For an asset already partly depreciated before it was registered |

**Depreciation Run** computes the straight-line depreciation of the period and posts one journal per asset class. Check the assets due and the **Journal date**, then select **Post depreciation**. The run is also a step of the month-end close.

![Accounts > Fixed Assets > Depreciation Run](images/screens-accounts/depreciation-run.png)

## Asset disposal {#asset-disposal}

An asset sold or written off (lost, stolen, damaged beyond repair, obsolete) leaves the register through a disposal.

{{screen:/accounts/fixed-assets/disposals}}

The cards show the number of **Disposals**, the **Cost**, the **Book value**, the **Selling price (net of VAT)** with the output VAT, and the **Gain on disposal** and **Loss on disposal**. Each row shows **Disposal no.**, **Disposal date**, the kind of disposal, **Asset**, **Buyer**, **Book value**, **Selling price (net of VAT)**, **Output VAT**, **Gain / (loss)**, **Sales invoice**, **Journal** and **Status**.

A disposal is started from the asset on the Asset Register: choose sale or write-off and the reason, the date, and for a sale the buyer and the selling price. On posting, the cost and accumulated depreciation are removed, the proceeds and output VAT are recorded (a sale issues a sales invoice) and the gain or loss is booked.

## Disbursement: payment vouchers and cheques {#disbursement-payment-vouchers-and-cheques}

A payment voucher (PV-YYYY-NNNNN, with the disbursement transaction DT-YYYY-NNNNN) pays an insurer, an agent or referrer, a client or a supplier.

{{screen:/accounts/paymentvoucher}}

The list (**Disbursement history**) shows **Disbursement Number**, **Transaction Number**, **Customer Code**, **Disbursement Date**, **Amount**, **Status** (**Draft**, **Approved**, **Paid**) and **Action**. The buttons are **Bulk Print**, **Bulk Upload**, **Bulk Disburse** (one voucher per referrer with approved commission) and **Create**.

![Accounts > Disbursement](images/screens-accounts/disbursement-list.png)

To create a payment voucher, select **Create**:

1. Enter the **Disbursement Date**, **Department Code** and **Branch Code**.
2. Choose the **Payee Type** (insurer, agent or referrer, client, supplier) and the **Criteria**, then the payee (**Customer Code**, **Customer Name**) and, if the payment is for one policy, the **Policy Number**.
3. Choose the **Transaction Type**, enter the **Payment Description**, the **Payment Currency** and any **Payment Notes**. Select **Next**.
4. Enter the amounts and the accounts debited, and the withholding tax where it applies.
5. Choose the bank account and the payment method (cheque, bank transfer or bank payment file) and save.

The voucher is approved by a user other than the one who prepared it, within his or her limit of the [Authority Matrix](#authority-matrix). An approved voucher is paid by cheque (the cheque number and release are recorded) or by a [bank payment file](#bank-payment-files); on payment the journal is posted and the voucher becomes **Paid**.

![Create Disbursement](images/screens-accounts/create-disbursement.png)

## Bank payment files {#bank-payment-files}

{{screen:/accounts/bank-payment-files}}

Bank Payment Files pays approved payment vouchers through the bank's upload file. The list shows **Batch**, **Layout**, **Value date**, **Payments**, **Amount**, **Status** and **Created**.

1. Select **New batch**.
2. Choose the **Layout** of the bank (see [Bank file layouts and payee bank accounts](#bank-file-layouts-and-payee-bank-accounts)), the account to **Pay from**, the **Channel** (for example **PESONet**) and the **Value date**.
3. Tick the payment vouchers waiting for payment and enter **Remarks**.
4. Select **Create batch**.

The batch is approved by another user, the file is downloaded for the bank portal, and the bank's result file is loaded back: each payment it confirms is posted and its voucher becomes **Paid**; a rejected payment returns to the vouchers waiting for payment.

**Approve** and **Return to draft** are shown only to a user who may decide the batch. The user who prepared or submitted the batch, or prepared one of its payment vouchers, reads why instead, and a user whose payment voucher limit is below the batch total sees the limit. The vouchers of insurer remittances are batched from [Insurer payments](#insurer-payments) with the same batch dialog.


## Remittance to insurers {#remittance-to-insurers}

For broker-billed policies TISPH remits the collected premium, net of the broker's commission, to each insurer by its
share. Remittances are prepared and submitted by {{roles:write:remittance}}; they are approved by
{{roles:approve:remittance}}, never by the user who prepared or submitted them.

The Remittance menu has eight entries. Each role sees the entries of its work; a role that only reads an entry sees
**View only** at the top of the page and no tick boxes or action buttons.

| Entry | What it is for |
|---|---|
| [Remittances](#remittances-worklist) | The remittances from draft to payment; **Import policy list** for an off-cycle remittance |
| [Approvals](#remittance-approvals) | The remittances, settlements and adjustments waiting for a decision |
| [Insurer payments](#insurer-payments) | The payment vouchers of the approved remittances, with their bank payment batch or cheque |
| **Reconciliation** | The insurers' statements: see [Insurer statement reconciliation](#insurer-statement-reconciliation) |
| [Exceptions](#remittance-exceptions) | Differences and problems found on remittances, to follow up |
| **Insurer billing** | Commission debit notes of direct-bill policies: see [Direct bill: commission debit notes](#direct-bill-commission-debit-notes) |
| [Setup](#remittance-schedules) | The schedules of the weekly remittance runs |
| [Settlement](#remittance-settlement) | The settlement of approved remittances, which raises the insurer's payment voucher |

A remittance (REM-YYYY-NNNNN) covers one insurer and product line for a coverage week. Its status is **Draft** until
submitted, **Pending approval** until an approver decides, then **Approved**, or **Returned** to its maker when
rejected. **Settled (voucher raised)** means the insurer's payment voucher exists; the step **Paid** of the remittance
shows when the voucher is paid.

### Remittances {#remittances-worklist}

{{screen:/finance/remittance/remittances}}

The chips at the top show the next weekly run and whether **Automation** (the daily remittance job) is **On** or
**Off**. The cards **To submit**, **Awaiting approval**, **Approved, not paid** and **Overdue to insurer** count the
remittances of the list as filtered; select a card to list them. The tabs are **My work** (the drafts and returned
remittances to submit), **Drafts**, **In approval**, **In payment** and **All**. Filter by coverage week, insurer,
product line and source (**Weekly run**, **Run now**, **Import**), or search a REM, policy or OR number.

Each row shows **Remittance no** with the coverage week, **Insurer** and product line, **Policies**, **Due to insurer**
with the due date (red with **Overdue** when past), **Status** and **Next step**: for a remittance pending approval,
the approvers it waits on. **Columns** adds Source, Voucher no, Paid on, Bank ref, Submitted by and Created on. The
total of the list is under **Due to insurer**.

To submit remittances for approval:

1. Choose {{menu:/finance/remittance/remittances}}. Open **My work** or **Drafts**.
2. Tick the drafts and select **Submit for approval (n)**, or choose **Submit for approval** in the row menu.
3. Check the total in the confirmation and select **Submit n remittances**. Each row then says **Submitted**, or why
   it was not submitted (for example, another user submitted it a moment before).

The row menu also offers **View**, the remittance schedule (XLSX and PDF), the remittance advice once the voucher is
raised, and **Open voucher**. The menu at the top right holds **Run now**, **Run history**, **Import history** and
**Export XLSX**.

### Import policy list {#remittance-import-policy-list}

An off-cycle remittance (opening remittances at go-live, a catch-up, an insurer's list, a correction) is created from
a list of policies. The file names the policies and the insurer; the system computes every amount from the
collections. **Import policy list** replaces the bulk upload of remittances with typed amounts.

1. On {{menu:/finance/remittance/remittances}}, select **Import policy list**.
2. Select **Download template** and fill in the **Data** sheet: **Policy No** and **Insurer Code** are required;
   **Product Line**, **Expected Due to Insurer**, **Insurer Reference** and **Remark** are optional.
3. Choose the **Purpose** from the list, type a **Note** if needed, and choose the file (.xlsx or .csv, at most
   10 MB and 5,000 rows).
4. Select **Validate**. Nothing is created yet. The preview shows each row with its result (**Ready**, **Ready ·
   Variance**, **Already on REM**, **Not found**, **Not issued**, **Insurer differs**, **Product line differs**,
   **Direct bill**, **Duplicate in file**) and the remittances to create per insurer and product line.
   **Download error report** lists every row with its result and message.
5. Select **Create n draft remittances** and confirm. One draft is created per insurer and product line from the
   ready rows, marked **Off-cycle** with the purpose. Submit the drafts for approval as above.

**Expected Due to Insurer** is only compared with the amount computed: a difference above PHP 1.00 is shown as a
variance. The same file cannot be imported twice, and a validated file not created within 7 days is discarded.
**Import history** (menu at the top right) lists the imports with their results.

![Import policy list with Download template, Purpose, Note and File](images/screens-accounts/import-policy-list.png)

### The remittance page {#remittance-record}

Select a remittance number to open its page. The header shows the number, status, insurer, product line, basis,
coverage week, due date and source, and the steps **Created**, **Submitted**, **Approved** (or **Returned**),
**Voucher raised** and **Paid**, each with its date and user. Under the header one line says what comes next, or why
you cannot act and who can.

The buttons follow the status and your role: **Submit for approval** for a draft or returned remittance, **Approve**
and **Reject** for an approver who may decide it, **Remind approver** for the user who submitted it. The tabs are
**Lines** (the policies with their totals), **Payment** (the voucher, its payment and value date), **Documents** (the
remittance schedule in XLSX and PDF and, once the voucher is raised, the remittance advice) and **Activity** (the
decisions and the activity log, with **Download log (XLSX)**).

![A remittance pending approval, seen by the user who submitted it: the steps, Remind approver and the users who can decide](images/screens-accounts/remittance-record.png)

### Approvals {#remittance-approvals}

{{screen:/finance/remittance/approvals}}

The chips at the top say what you may decide, for example **Remittance up to PHP 1,000,000.00**, or **View only**.
As delivered, TIS Finance & General Accounting approves remittances up to PHP 1,000,000.00 and the TIS General
Manager without limit (see the [Authority Matrix](#authority-matrix)). A user without a remittance limit cannot
approve or reject. An absent approver is covered by a [Delegation](#delegations).

The cards count **Awaiting my decision**, **Past SLA**, **Submitted by me** and **Decided by me today**. The tabs are
**Awaiting my decision**, **Submitted by me** (with the approvers each item waits on, and **Remind approver** in the row
menu), **All pending** (with **Can I decide?**) and **Decided** (the last 30 days).

To decide a remittance:

1. Choose {{menu:/finance/remittance/approvals}}, or open the approval from **My Work** or its notification.
2. Select the reference. The review panel shows the remittance and its totals, the previous remittance of the insurer
   with the change in per cent, the checks at submission, the lines, the open exceptions and the activity.
3. Select **Approve** and confirm, or **Reject**, choose the reason from the list and confirm. A rejected remittance
   returns to its maker as **Returned**.

Several items can be approved together: tick them and select **Approve selected (n)**; each is decided on its own and
its result is listed. There is no rejection of several items at once. When you may not decide an item, the panel
says why (you submitted it, it is above your limit, or another user decided it) and shows no buttons.

![Review approval of a remittance with the approver's limit, Reject and Approve](images/screens-accounts/remittance-approval-review.png)

### Insurer payments {#insurer-payments}

{{screen:/finance/remittance/payments}}

**Insurer payments** lists the payment vouchers of the approved remittances with their bank payment batch or cheque
and the bank's result. It posts nothing itself: batches are approved and released on
[Bank payment files](#bank-payment-files), cheques on [Disbursement](#disbursement-payment-vouchers-and-cheques).

The cards and tabs are **To pay**, **In payment**, **Paid** (this week on the card), **Failed** and **All**. Each row
shows the voucher, the insurer with its bank account masked, the amount, method, batch, paid on and the **Next step**
(for example **Submit voucher (Disbursement)**). The row menu starts with **View payment**, then **Open remittance**,
**Open batch**, **Pay by cheque**, **Re-batch** (a failed payment) and **Download advice (PDF)** (a paid one).

To pay insurers by bank file, tick the vouchers to pay (an approved voucher with the insurer's bank account on file)
and select **Create Metrobank batch (n)**. The batch dialog of Bank Payment Files opens with those vouchers and the
Metrobank layout; check the value date and select **Create batch with n payments**, then submit the batch on
[Bank payment files](#bank-payment-files). A voucher still in draft shows **Submit voucher (Disbursement)** as its next
step and cannot be ticked.

![Accounts > Remittance > Insurer payments with the vouchers to pay](images/screens-accounts/insurer-payments.png)

### Exceptions {#remittance-exceptions}

{{screen:/finance/remittance/exceptions}}

**Exceptions** lists the differences found on remittances (for example **Amount Mismatch**, **Duplicate Entry**,
**Missing Document**, **Date Discrepancy**) with their severity, amount, age, the user assigned and the status. The
cards **Unresolved**, **In progress**, **Escalated** and **Resolved today** filter the list. The row menu offers
**View**, **Start** (you take it on), **Escalate** (with a reason from the list) and **Resolve** (with the resolution,
the amount if any and a note).

### Setup: remittance schedules {#remittance-schedules}

{{screen:/finance/remittance/setup/schedules}}

The weekly schedule **TIS-WEEKLY** runs every Monday at 06:15 for every active insurer and creates one draft per
insurer and product line for the policies paid in full from the Monday to the Friday before (**Eligibility**: Fully
paid in the window). With **Proof of payment required** a policy is remitted only when every receipt that paid it
carries its proof; a policy without it is listed on Exceptions as **No proof of payment**. A schedule on **Inception
date** remits by inception date instead. The **Automation** chip shows whether the
daily remittance job is on; it is **Off** until TISPH switches it on.

The row menu offers **View** (the schedule, its latest runs and its activity log) and, to TIS Finance & General
Accounting: **Edit**, **Preview run** (what a run would create, without creating anything),
**Run now** and **Pause** or **Resume**. **Run now** asks for the off-cycle reason and shows per insurer what will be
created; nothing is created until you select **Create n draft remittances**. A week that has been run cannot be run
again: a later catch-up goes through [Import policy list](#remittance-import-policy-list).

![Accounts > Remittance > Setup with the weekly schedule and Automation Off](images/screens-accounts/remittance-schedules.png)

### Held policies {#remittance-held-policies}

{{screen:/finance/remittance/held}}

A part-paid policy on an instalment plan is not remitted until it is paid in full. **Held** lists these policies with the
insurer, product line, plan, total premium, paid to date, balance, next due date and the cheques that bounced;
**Released** lists those paid in full since, which go on the next weekly run with their full premium. The list is
refreshed every morning and after each payment.

### Settlement {#remittance-settlement}

{{screen:/finance/remittance/settlement/process}}

An approved remittance is settled with the insurer, and the approved settlement raises the insurer's payment voucher.

1. Choose {{menu:/finance/remittance/settlement/process}}.
2. Choose the **Insurer code** and the period, then select **Add policies** (or **Import**).
3. Select **Calculate**: total premium less commission and tax, plus or minus adjustments, gives the
   **Net Settlement**.
4. Select **Submit for approval**, or **Save draft**.

Another user approves the settlement on [Approvals](#remittance-approvals). The system then raises the payment voucher
for the net amount on [Disbursement](#disbursement-payment-vouchers-and-cheques), and the remittance shows **Settled
(voucher raised)**. The voucher is paid through [Insurer payments](#insurer-payments).

For a co-insured policy each insurer is remitted its own share. A refund due from an insurer (return premium on premium
already remitted) is netted against its next remittance.

See [Remittance to the insurers](#process-remittance) for the order of the steps at TISPH.

## Direct bill: commission debit notes {#direct-bill-commission-debit-notes}

{{screen:/finance/remittance/billing}}

For a direct-bill policy the client pays the insurer, and TISPH bills the insurer for its commission with a debit note. For the premium TISPH remits, the commission is billed to the insurer with a billing statement on the 15th and the 26th of the month. The cards show the **Unbilled commission**, **Billed, outstanding**, **Overdue** and **Receivable from insurers**. The screen has four tabs:

1. **Raise debit note**: choose the **Insurer** (required), the issue dates (**Issued from**, **Issued to**), **Commission of** and the **Line of business**, and select **Load policies**. Tick the policies to bill: each shows the gross premium, rate, commission, VAT, **Total Due** and EWT. Raise the debit note.
2. **Debit notes**: the debit notes and billing statements issued, with their balance, the line of business of a statement and **Overdue** past its due date; record the insurer's payment against them. A billing statement exports with its schedule to Excel or CSV.
3. **Billing run**: the next billing dates and the runs made. On the 15th and the 26th (the working day before when that day is a Saturday, Sunday or holiday) the system drafts one billing statement per insurer and line of business from the remittances approved before the billing date and not yet billed: the commission, VAT on the commission (Gross Amount), the withholding tax and the Net Amount Payable, due 15 days after the billing date. **Run billing** drafts them now for a billing date and, if chosen, one insurer.
4. **Billing mode**: whether each insurer's policies are broker-billed or direct-billed.

A debit note or billing statement is approved by another user than the one who raised or submitted it; that user reads why instead of **Approve** and **Reject**. A billing statement is approved by {{roles:approve:insurer-billing}}, and only when the insurer's TIN is on Master > Insurance Company. A statement on commission kept from the remittance is then **Settled by retention**. **Reject** and **Cancel debit note** ask for the reason from the list; a cancelled statement's lines are billed again on the next run.

![Accounts > Remittance > Insurer billing on the tab Raise debit note](images/screens-accounts/insurer-billing.png)

## Journal vouchers {#journal-vouchers}

{{screen:/accounts/journalvoucher}}

{{screen:/accounts/correctionsjv/correctionsjvdetails}}

{{screen:/accounts/reversaljv/reversaljvdetails}}

**Journal Voucher** lists the manual journals (**Journal Voucher history**) and the **System journals parked for approval**, with **Transaction Code**, **Transaction Number** (JV-YYYY-NNNNN), **Date**, **Description** and **Status** (**Awaiting approval**, **Posted**). **Upload** loads a journal from a file.

To enter a journal, select **Voucher**:

1. Choose the **Transaction Code** (the kind of journal) and enter the **Date** and **Remarks**.
2. Select **Add Data** for each line: **Main A/c**, **Sub A/c**, **Foreign Amount**, **Currency**, **Local Amount**, **Entry** (debit or credit) and **Cost Centre**.
3. Check that **Total Debit** equals **Total credit** (**Net** zero).
4. Select **Submit for approval**.

The journal is approved by {{roles:write:journal-vouchers}} other than the user who submitted it, and is posted on approval. A journal cannot be posted into a closed period.

![Add Journal Voucher](images/screens-accounts/add-journal-voucher.png)

**Correction JV** corrects a posted transaction: choose the **Transaction Code** and **Transaction Number** of the original, the **Corrections JV Transaction Code** and the **Correction Description**, select **Next** and enter the corrected lines. **Reversal JV** reverses a posted transaction in full the same way, with the **Reversal JV Transaction Code** and **Reversal Description**. Both are approved like any journal voucher.

## SAP GL export {#sap-gl-export}

{{screen:/accounts/sap-gl-export}}

Every day at the cut-off, the journals posted since the previous cut-off are written as the SAP GL header and line files to the SAP pick-up folder. The list shows each **Day**, the period **Posted between**, **Status**, **Journals / lines**, **Debit**, **Credit**, **Started by**, **Warnings** and **Files**. **Run now / re-generate** writes the file of a day again, for example after a correction. Download the files from their row.

## Open entry matching and write-offs {#open-entry-matching-and-write-offs}

Open entry matching settles open debit and credit entries of the same account against each other, for example a receipt against a bill posted without a reference.

{{screen:/accounts/open-entry-matching}}

{{screen:/accounts/open-entry-unmatching}}

1. Choose {{menu:/accounts/open-entry-matching}}.
2. Enter the **Sub Account Code** (and, if needed, **Division**, **Department**, the analysis codes and **Currency Code**) and select **Pull**, or **Pull By Criteria**.
3. The **Debit Entries** and **Credit Entries** of the account are listed with **Document No**, **Doc Dt**, **Due Dt**, the foreign and local amounts and balances. Tick the entries to match and enter the **Adjustment Amt** of each.
4. If a small difference remains, enter the **Write off Code**, **Write off reason** and **Write off Amount**.
5. Select **Match**.

**Open Entry Unmatching** undoes a match the same way, with **Unmatch**.

## Accounting Query and All Clients Accounting {#accounting-query-and-all-clients-accounting}

**Accounting Query** searches the accounting entries by **Policy ID / Number**, **Client ID**, **Client Name**, **Entry Type**, **Reference Type**, **Status**, **Start Date**, **End Date** and **GL Code**; **Export** downloads the result. **All Clients Accounting** shows, for every client, the number of transactions, total debits, total credits and balance; **Export CSV** downloads it.

{{screen:/agent/accounting/query}}

{{screen:/agent/accounting/all-clients-details}}

Both screens are read-only. Use them to trace a bill, receipt, remittance or commission line to its journal entries.

## Petty cash {#petty-cash}

A fund is opened on Initiate, which issues its code (PCF-) when left empty and holds the fund size, the available cash, the maximum limit and the minimum cash box. Requests are maker-checker. After a save the screen returns to its list.

{{screen:/accounts/pettycash/pettycashcodeinitiate}}

{{screen:/accounts/pettycash/pettycashrequest}}

{{screen:/accounts/pettycash/disbursement}}

{{screen:/accounts/pettycash/receipts}}

{{screen:/accounts/pettycash/replenish}}

| Screen | What it does |
|---|---|
| **Initiate** | Opens a fund: **Petty Cash code**, **Petty Cash Description**, **Petty Cash Size** (required), the bank, main and sub-account, currency, **Branch Code**, **Department Code**, **Available Cash**, **Max Limit** (the largest single payment) and **Minimum Cash box**. The list shows each fund (for example PCF-MKT, PCF-CEB) with its size, limit, branch and department. |
| **Request** | A request for cash from a fund: **Request Date**, **Requester Name**, **Petty Cash code**, whether it is a **Cash in advance**, then the lines. The request is approved by another user. |
| **Disbursement** | The payment of an approved request from the fund (PCD). |
| **Receipts** | Cash returned to the fund, for example the unused part of a cash advance. |
| **Replenish** | Restores the fund to its size from the bank: the amount spent since the last replenishment, with the bank account. |

![Accounts > Petty Cash > Initiate, the funds and their limits](images/screens-accounts/petty-cash-initiate.png)

## Bank reconciliation {#bank-reconciliation}

{{screen:/accounts/bank-reconciliation}}

{{screen:/accounts/bank-reconciliation/reconciliations}}

{{screen:/accounts/bank-reconciliation/reports/bank-reconciliation-statement}}

{{screen:/accounts/bank-reconciliation/reports/bank-outstanding-cheques}}

{{screen:/accounts/bank-reconciliation/reports/bank-deposits-in-transit}}

{{screen:/accounts/bank-reconciliation/reports/bank-unmatched-lines}}

{{screen:/accounts/bank-reconciliation/reports/bank-book}}

The **Reconciliation Workspace** reconciles one bank account for one period:

1. Choose the **Bank account** and the **Period**.
2. Select **Import statement** and load the bank statement file (in the format of the bank, see [Accounting masters](#finance-masters-kept-by-accounting)).
3. Select **Auto-match**: statement lines and book entries with the same amount and reference are matched.
4. Match the remaining lines by hand: tick a bank line and the book entries it settles. A bank line with no book entry (bank charges, interest) is flagged and booked with a journal.
5. Select **Stale cheques** to list cheques outstanding too long.
6. When the **Difference** is zero (**Adjusted balances agree**), select **Start reconciliation** and submit it.

The cards show the **Balance per bank**, **Balance per books**, **Unmatched bank lines**, **Unmatched book entries**, **Difference** and the status of the **Reconciliation**. The reconciliation is prepared by {{roles:write:bank-reconciliation}} and approved by {{roles:approve:bank-reconciliation}}, a user other than the preparer.

![Accounts > Bank Reconciliation > Reconciliation Workspace](images/screens-accounts/reconciliation-workspace.png)

**Reconciliations** lists the reconciliations with **Reconciliation No.**, **Bank account**, **Period**, **Status**, the adjusted bank and book balances, **Difference**, **Prepared by** and **Approved by**. **New reconciliation** starts one.

The five reports (**Reconciliation Statement Report**, **Outstanding Cheques**, **Deposits in Transit**, **Unmatched Bank Lines**, **Bank Book**) are run like any report: choose the criteria (**Overall** or by bank account), **From Date** and **To Date**, the **Bank Account** and the **File format** (**CSV**, **Excel (XLSX)** or **PDF**), then **Preview** or **Generate**. See [Reports](#reports).

## Insurer statement reconciliation {#insurer-statement-reconciliation}

{{screen:/finance/remittance/reconciliation/insurer-statements}}

An insurer's statement (for example a premium remittance confirmation) is matched with what TISPH recorded. The list shows **Number**, **Insurer**, **Statement type**, **Insurer reference**, **Period**, **Lines**, **Matched**, **Gross premium**, **Commission** and **Status**.

1. Select **Import statement**.
2. Choose the **Insurer** and the **Statement type** (required), the **Period from** and **Period to** (required), the **Insurer reference**, the **Tolerance (PHP)** and the **Statement format** (the insurer's own format, else the standard one).
3. Choose the **File (CSV or XLSX)**. **Download template** gives the standard layout.
4. Select **Preview** to check the lines read, then **Import and match**.

Each statement line is matched with the policy, premium and commission recorded; differences within the tolerance match. Open the statement to resolve the lines that differ. The statement is approved by {{roles:approve:insurer-reconciliation}}.

![Import an insurer statement](images/screens-accounts/insurer-statement-import.png)

## Tax: BIR forms and returns {#tax-bir-forms-and-returns}

{{screen:/accounts/tax/2307}}

{{screen:/accounts/tax/reports/bir-vat-summary}}

{{screen:/accounts/tax/reports/bir-sawt}}

{{screen:/accounts/tax/reports/bir-qap}}

{{screen:/accounts/tax/reports/bir-slsp-sales}}

{{screen:/accounts/tax/reports/bir-slsp-purchases}}

**BIR Form 2307** has two tabs: **Issued by us** (the certificates TISPH issues for the tax it withheld from payees: referrers, suppliers) and **Received** (the certificates received from insurers and clients for the tax they withheld from TISPH). Choose the year and the quarter; each row is a payee with its TIN, ATC, income payments and tax withheld. Print a certificate from its row.

The BIR reports are run like any report (criteria, **From Date**, **To Date**, file format, **Preview** or **Generate**):

| Report | Contents |
|---|---|
| **VAT Summary** | Output VAT on the broker's sales and input VAT on purchases, by month |
| **SAWT** | Summary alphalist of the tax withheld from TISPH by its customers (for the income tax return) |
| **QAP** | Quarterly alphalist of payees: the tax TISPH withheld (with the 1601-EQ) |
| **SLSP Sales** | Summary list of sales, by customer (filter by principal insurer) |
| **SLSP Purchases** | Summary list of purchases, by supplier |

## Withholding returns: 0619-E, 1601-EQ and their filing records {#withholding-returns-0619-e-1601-eq-and-their-filing-records}

{{screen:/accounts/tax/withholding-returns}}

The screen lists the withholding returns of the year: BIR Form 0619-E for the first and second month of each quarter, 1601-EQ for each quarter and the annual 1604-E, with **Form**, **Period**, **Due date**, **Status** (**Not filed**, **Filed**), **Date filed**, **Filing reference** and **Amount paid**. The cards count the returns, those filed and the amount paid.

1. Select **Open** on the return. The form is shown as the BIR form, computed from the tax withheld in the period (payment vouchers, supplier invoices, commission).
2. Check it; **Print** or **Excel** gives the working paper.
3. File and pay the return with the BIR (eFPS or eBIRForms).
4. Select **Record filing** and enter the date filed, the filing reference and the amount paid. The return becomes **Filed**.

![Accounts > Tax > Withholding Returns](images/screens-accounts/withholding-returns.png)

## Annual information return 1604-E and alphalist of payees {#annual-information-return-1604-e-and-alphalist-of-payees}

{{screen:/accounts/tax/alphalist-1604e}}

Choose the year. The screen shows the BIR Form 1604-E: the background information of TISPH (TIN, registered name and address), the remittances of each month from the filing records, and the alphalist of payees with the income payments and tax withheld. The cards show the **Payees**, the **Income payments** and the **Tax withheld**. **Print** and **Excel** give the form; **DAT file** opens [BIR DAT files](#bir-dat-files); **Record filing** records the filing as for the other returns.

## Percentage tax 2551Q (non-VAT broker or agent) {#percentage-tax-2551q-non-vat-broker-or-agent}

{{screen:/accounts/tax/percentage-tax}}

BIR Form 2551Q is the quarterly percentage tax return of a broker or agent that is not VAT-registered. Toyota Insurance Services Philippines is VAT-registered, so the screen warns that the return does not apply; it is kept for the working paper only. Choose the year and quarter: the screen shows the gross sales of each month from the revenue accounts, the rate and the tax due, with **Print**, **Excel** and **Record filing**.

## BIR DAT files {#bir-dat-files}

{{screen:/accounts/tax/dat-files}}

The DAT files are the validation files submitted to the BIR with the QAP (1601-EQ), the SAWT, the SLSP and the 1604-E alphalist.

1. Choose the **File**, the **Year** and the **Quarter** (or month).
2. Select **Generate file**. The file is generated from the report of the same period and checked against it; the result shows under **Validation**.
3. Download the file and validate it with the current BIR validation module before submission.

**Generated files** lists the files of the year with **Period**, **File name**, **Detail records**, **Total**, **Result**, **Generated by** and **Generated on**.

## Sales invoices (EOPT Act) {#sales-invoices-eopt-act}

{{screen:/accounts/tax/sales-invoices}}

Under the Ease of Paying Taxes Act (RA 11976, RR 7-2024) the sales invoice is the primary document of the broker's sale of services: commission billed to insurers and fees. The header shows the seller (Toyota Insurance Services Philippines Corporation), its TIN, VAT status, the serial range and whether the **Invoicing setup** is complete; invoices cannot be issued until the ATP or CAS permit number is set up.

The list shows **Invoice no.**, **Invoice date**, **Buyer**, **Invoice for**, **Reference**, **Total sales**, **VAT**, **Total amount due**, **Balance**, **Status** and **EIS**. To issue an invoice by hand, select **New invoice**: **Invoice for** (for example **Fees and other services (manual)**), **Invoice date**, **Buyer type** and **Buyer** (required), **Buyer TIN (with branch code)**, **Buyer business style**, **Buyer address**, the lines (**Description**, **Qty**, **Unit price**, **VAT class**), **Expected withholding** and **Remarks**, then **Issue invoice**. Commission debit notes issue their invoice themselves.

Invoices are numbered in sequence; an invoice is cancelled with a reason and keeps its number, it is never deleted.

![New invoice](images/screens-accounts/sales-invoice-new.png)

## E-invoicing (EIS) {#e-invoicing-eis}

{{screen:/accounts/tax/eis}}

E-invoicing sends the sales invoices to the BIR Electronic Invoicing System. The header shows whether the **E-invoicing connection** is on or off, the **Mode** (test or production) and when the last invoice was sent. The **Outbox** lists the e-invoices by status: **Queued**, **Failed**, **Rejected**, **Accepted** and **Uploaded manually**, with **Attempts**, **Next attempt**, **EIS reference** and **Last error**. A failed invoice is retried automatically; **Export payloads** downloads the e-invoices for a manual upload on the EIS portal. While e-invoicing is off, invoices are not sent until an administrator turns it on.

## CAS books and documents {#cas-books-and-documents}

Choose Accounts > Tax > CAS Books and Documents.

{{screen:/accounts/tax/cas}}

The screen holds the registration pack of the computerized accounting system (CAS). **Readiness** lists the items the BIR registration needs, each **Complete** or **Missing** with its action: taxpayer name, TIN and registered address; RDO code; CAS permit or acknowledgement number and date (**Enter permit**); invoice ATP (**Enter ATP**); backup custodian; system contact person; the approved system description and backup procedure (**Open document**); and the books printed at least once (**Go to books**).

**Documents** holds the system description and controls and the backup and restore procedure, with their approved version; **Open** and **Print**. The books (general journal, general ledger, cash receipts and disbursements books, sales and purchase books) print per month with page numbers that run on through the year.

![Accounts > Tax > CAS Books and Documents](images/screens-accounts/cas-readiness.png)

## Period end {#period-end}

A fiscal year (FY2026) has twelve monthly periods and an adjustment period 13 used by the year-end close. The cards count the periods Open, Soft-closed, Closed and Locked.

{{screen:/accounts/period-end/periods}}

{{screen:/accounts/period-end/close}}

{{screen:/accounts/period-end/statements}}

The fiscal year of TISPH runs from April to March. **Period Management** lists the periods of the year chosen with **No.**, **Period**, **Start**, **End**, **Status**, **Close run** and **Last change**, and the actions **Soft-close** and **Close**:

| Status | Postings allowed |
|---|---|
| **Open** | All |
| **Soft-closed** | Only by {{roles:approve:period-end}} |
| **Closed** | None; reopened only by {{roles:approve:period-end}} |
| **Locked** | None |

**Next fiscal year** creates the next year; **Import opening balances** loads the opening balances (validated first, then imported all or nothing).

Operations close on the 26th: a premium booking dated from the 26th of a month is posted in the next period. Finance closes on the 29th, and the month-end close reminder counts down to it. Finance can still post its month-end adjustments into the period until the 6th working day of the next month (holidays of Master > Holiday excluded); the automatic soft-close, when it is switched on, waits until that day has passed.

**Month-End Close** runs the close of a period:

1. Select **New close run**, choose the **Period** and enter **Remarks**. Select **Start**. The run (MEC-) executes its steps: the accrual journals of the period (reversed on day 1 of the next period), the recurring journals due, the deferral of unearned commission, the foreign exchange revaluation and the checklist.
2. Check the checklist: the automatic checks (for example the sub-ledgers of premium receivable, commission receivable and due to insurers against their control accounts) and sign the manual items. A failed blocking check stops the close; correct it and run the steps again.
3. Submit the run to soft-close or close the period.
4. The run is approved by {{roles:approve:period-end}}, a user other than the preparer. The period takes the new status.

![New close run](images/screens-accounts/month-end-close-new.png)

**Financial Statements** shows the **Income Statement**, **Balance Sheet** and **Trial Balance** from the posted journals, for a fiscal period or a date range, with the period, year to date and the same columns of the previous year. Select an account to see its postings. **Export** (Excel) and **Print** (PDF).

![Accounts > Period End > Financial Statements](images/screens-accounts/financial-statements.png)

## Year-end close (preparer) {#year-end-close-preparer}

Accounts > Period End > Year-End Close leads through five steps, one card per step; the stepper above the card shows the status of each step. Choose the fiscal year and select **Start year-end close**: the prerequisites are checked at once.

{{screen:/accounts/period-end/year-end}}

1. **Prerequisites**: periods 1 to 12 closed, no unposted journals in the year, the suspense account nil, the trial balance balanced at the year end, the closing accounts set up (current year profit and loss, retained earnings) and the previous fiscal year closed. Each shows **Passed**, **Failed** (with a link to correct it) or **Not Applicable**.
2. **Adjustments**: the year-end adjustments are posted in period 13.
3. **Closing entries**: the income and expense accounts are closed to current earnings and retained earnings; the entries are previewed first.
4. **Close**: the close is submitted and approved by {{roles:approve:period-end}}, a user other than the preparer.
5. **Opening balances**: the balance sheet accounts open the next fiscal year.

A closed year can be reversed only on a request with a reason, approved by another user.

## Recurring journals {#recurring-journals}

{{screen:/accounts/period-end/recurring}}

A template posts the same journal on a schedule (for example rent or an accrual). The list shows **Code**, **Name**, **Kind**, **Frequency**, **Next run**, **End date**, **Amount**, **Auto-post**, **Auto-reverse** and **Status**.

1. Select **New template**.
2. Enter **Name**, **Kind** (**Recurring**, or accrual), **Frequency**, the next run and end date, and the lines (accounts, amounts, cost centre).
3. Choose **Auto-post** (posted without approval) and **Auto-reverse** (reversed on day 1 of the next period, for an accrual).
4. Save.

The due journals are posted by the month-end close, or at once with **Post due journals now**.

## Incentives {#incentives}

{{screen:/incentive/my-programs}}

{{screen:/incentive/calculations}}

{{screen:/incentive/approvals}}

{{screen:/incentive/statement}}

{{screen:/incentive/reports}}

The incentive screens pay the account executives' incentives earned under the programmes set for them (for example a quarterly motor premium target).

| Screen | What it shows |
|---|---|
| **My Programs** | Your progress in each running programme for its current period: **Target**, **Achieved**, **Achievement**, **Estimated payout** and **Status** (**Running**, **Ended**). |
| **Calculations** | The calculation batches (CALC-YYYY-NNNNN) by period. **New Calculation** runs the calculation of a month for the active programmes; adjust the agent lines and submit the batch for approval. |
| **Approvals** | The batches submitted for approval. A batch is approved or rejected by {{roles:approve:incentive}}, a user other than the one who ran or submitted it. |
| **Statement** | The earnings of an account executive for a month: the programmes, totals, the trend of the last 13 months and the payments. **Print** and **Export CSV**. |
| **Reports** | The incentive reports (monthly payout summary, agent payout details, target achievement, top performers, programme effectiveness): **Generate report**. |

An approved batch is paid through [Disbursement](#disbursement-payment-vouchers-and-cheques); its status becomes **Paid**.
