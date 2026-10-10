<!--
Owner: see WRITER_GUIDE.md. One section per step of the TISPH business process, in order. Each names who does the
step ({{roles:...}} placeholders, never typed role names) and links to the screen sections.
Screens to refresh (redesign in another stream, described as on this build): process-placement (Check against slip
dialog), process-policy (endorsement dialog).
-->
# The TISPH process end to end {#the-business-process-end-to-end}

The work of Toyota Insurance Services Philippines follows one chain: a lead becomes a quotation, the quotation is
placed with a panel insurer, the insurer's policy is booked and billed, Cash Control collects the premium, the premium
is remitted to the insurer, the commission is earned and paid, claims are followed up with the insurer, the policy is
renewed, and Finance closes the month and files the BIR returns. Each section below names the roles that do the
step, as delivered, and the screens where it is done.

The chapter follows two policies through the chain:

- **A motor policy financed by Toyota Financial Services (TFS).** TFS refers the buyer of a financed Toyota. The
  account executive quotes the car, the client accepts, the placement slip goes to the panel insurer, the insurer's
  e-policy is checked and booked with TFS as mortgagee, and the client pays TISPH.
- **A dealer programme policy.** A Toyota dealer sells brand-new cars under a programme agreed with TISPH (and, for
  financed cars, with TFS). The dealer's sales file creates the prospects and quotations, or issues the policies at
  once, with the free or subsidised first-year premium billed to the dealer or the bank.

From the booking onwards both policies follow the same steps.

## The chain at a glance {#process-at-a-glance}

| Step | Who does it | Screen | Result |
|---|---|---|---|
| Prospect | {{roles:write:leads}} | [Prospects](#prospects) | Prospect **New**, assigned to an account executive |
| Dealer sales | {{roles:write:motor-programmes}} | [Dealer Programmes](#dealer-programmes) | Prospects and quotations, or booked policies |
| Quotation | {{roles:write:quotations}} | [Quotations](#quotations), [Quick Quote](#quick-quote) | Quotation **Pending Customer**, then **Customer Accepted** |
| Request for quotation | {{roles:write:quotations}} | [Requests for Quotation](#requests-for-quotation-broker-slips) | Insurers' offers compared |
| Placement | {{roles:write:quotations}} | [Placement Slips](#placement-slips) | **Sent to insurer**, **Acknowledged**, **e-Policy received** |
| Check of the e-policy | {{roles:approve:policies}} | [Placement Slips](#placement-slips) | **Checked against slip** |
| Booking | {{roles:write:policies}} | [Placement Slips](#placement-slips) | Policy, bill, journal and commission; **Insurer issued (Booked)** |
| Collection | {{roles:write:receipts}} | [Receipts](#verify-payments-and-post-official-receipts), [Post-Dated Cheques](#post-dated-cheques) | Official receipt; policy payment **Completed** |
| Remittance | {{roles:write:remittance}} | [Remittance to insurers](#remittance-to-insurers) | Remittance approved, settled and paid to the insurer |
| Commission | {{roles:write:commission}} | [Commission to agents and referrers](#commission-to-agents-and-referrers) | Commission lines **Approved**, then **Paid** |
| Endorsement | {{roles:write:endorsements}} | [Policies](#policies) | Policy changed; additional premium billed |
| Claim | {{roles:write:claims}} | [The claims list](#the-claims-list) | Claim **Pending** to **Closed** |
| Renewal | {{roles:write:renewals}} | [Renewal Queue](#renewal-queue-and-at-risk-policies) | Renewal quotation, then a new placement |
| Month-end and tax | {{roles:write:period-end}} | [Period end](#period-end), [Tax: BIR forms and returns](#tax-bir-forms-and-returns) | Period **Closed**; returns filed |

Work that waits for you appears in [My Work](#my-work). Each approval in the chain is made by another user than the
one who entered the record (see [Approvals and maker-checker](#statuses-approvals-and-maker-checker)).

## Leads from TFS, dealers and walk-in clients {#process-leads}

Prospects are entered by {{roles:write:leads}}, on [Prospects](#prospects). Leads are assigned to the sales team on
[Lead Assignment](#lead-assignment) by {{roles:write:lead-assignment}}.

TISPH receives its leads from four sources:

- **Toyota Financial Services.** TFS refers the buyers of the Toyota cars it finances. The prospect carries the TFS
  office as its channel (TFS Head Office or a TFS branch) and the lead source of the referral (for example
  **Bundling**, **Promo**, **Used-Cars - SCR** or **Used-Cars - UCFP**).
- **Toyota dealers.** A dealer sale under a dealer programme creates the prospect itself, with the dealer branch as
  its channel (see [Dealer programme policies](#process-dealer-programme)).
- **Walk-in clients and referrals.** A client who walks in at a Toyota showroom or is referred by an agent, with the
  lead source **Walk-In**, **Referral** or **Agent**.
- **Renewals.** An expiring policy comes back through the [Renewals](#process-renewals) step, not as a new prospect.

The lead sources are those of {{menu:/master/insurance/lead-sources}}.

![Operations > Sales & Marketing > Prospects, with the prospects by status and product line](images/process/prospects-list.png)

To record a TFS referral:

1. Choose {{menu:/agent/leadlisting}}.
2. Select **Create Prospect**.
3. Enter the buyer's name, mobile number and e-mail, the category (**Retail** or **Corporate**) and the product line
   (Motor for a financed car).
4. Select the TFS office as the channel and the lead source of the referral.
5. Save the prospect. It is created with the status **New**.

The assignment rules of [Lead Assignment](#lead-assignment) give the prospect to an account executive of the sales
team; a prospect that no rule can assign waits in the **Reassignment Queue** for {{roles:write:lead-assignment}}. The
account executive follows the prospect up from [My Work](#my-work) and logs the calls and visits on
[Sales activities](#sales-activities). Logging the first activity marks the prospect **Contacted**. The prospect
becomes **Quote Generated** with its first quotation, **Converted** when the policy is booked, or **Lost**.

## Dealer programme policies {#process-dealer-programme}

A dealer programme holds the terms agreed with a Toyota dealer and, for financed cars, the financing bank: the
insurer, the own damage and acts of nature rates, the excess liability limits, the CTPL term, whether the first year
is free or subsidised and who pays it, and what the dealer's sales upload creates.

![Operations > Sales & Marketing > Dealer Programmes, with the programmes of three Toyota dealers](images/process/dealer-programmes.png)

As delivered, the programmes are set up, and the dealers' sales files uploaded, by {{roles:write:motor-programmes}}.
Every sales and operations role can open the programmes and print the bank endorsement letters.

To upload a dealer's sales:

1. Choose {{menu:/sales/dealer-programmes}}.
2. Open the **Dealer Sales Upload** tab.
3. Select the programme of the dealer. The programme must be **Active**.
4. Upload the dealer's file of vehicle sales (sale date, invoice number, buyer, vehicle, chassis and engine numbers,
   invoice price and, for a financed car, the loan amount).
5. Check the result: each row is processed on its own. A row with an error (for example a missing chassis number) is
   kept with its error and creates nothing.

For each sale the system creates the prospect, with the dealer branch as its channel, and the motor quotation priced
on the programme's rates, with CTPL at the tariff of the vehicle class. A financed car carries the bank as mortgagee
with its mortgagee clause. What follows depends on the programme's **Upload creates** column:

- **Quotation to follow up**: the quotation stays in **Draft** and the account executive follows it up with the buyer
  like any other quotation, from [Quotation and request for quotation](#process-quotation) onwards.
- **Policy issued**: the buyer becomes a client and the policy is booked at once, starting on the sale date. The
  premium is billed to who pays it: the buyer, the dealer or the bank. With a free first year the dealer (or the bank)
  receives the whole bill; with a subsidy, the dealer's share and the buyer's share are billed separately.

From the bill onwards the policy follows [Collection by Cash Control](#process-collection).

## Quotation and request for quotation {#process-quotation}

Quotations and requests for quotation to the panel insurers are prepared by {{roles:write:quotations}}. A quotation is
approved by another user: {{roles:approve:quotations}}.

Which steps a product needs is set per product: every TISPH line of business needs a placement slip; a motor policy
and the package products (for example Compulsory Credit Life, Personal Accident and Parcel / Courier Insurance) need a
quotation; a request for quotation to several insurers is optional.

### Motor quotation for a TFS-financed car {#process-motor-quotation}

1. Choose {{menu:/agent/Quotation}}.
2. Select **Create Quote** and choose the motor product.
3. Select the prospect, the Toyota model, variant and year of the vehicle master, the vehicle type and the insurer.
4. Enter the sum insured (the invoice price) and the covers. The premium is computed on the motor tariff: own damage
   and acts of nature at the rate of the vehicle class, the excess bodily injury and property damage limits, auto
   passenger personal accident per seat, and CTPL at the tariff amount for 1 or 3 years. DST, VAT and LGT are added
   to give the gross premium.
5. Save the quotation. It is created as **Draft**.
6. Open the quotation (**View Details**, the eye icon) and select **Send for Customer Approval**. The status becomes
   **Pending Customer**.

For a package product, [Quick Quote](#quick-quote) prices the quotation from the product's rates in one screen.

![Quotation of a financed Fortuner waiting for the client, with Copy approval link and Record customer response](images/process/quotation-pending-customer.png)

### The client's answer {#process-client-acceptance}

The client accepts the quotation through the approval link, or you record the answer:

1. Open the quotation from {{menu:/agent/Quotation}} (**View Details**, the eye icon).
2. Select **Copy approval link** to send the link to the client again, or **Record customer response** when the client
   answered by phone, e-mail or in person.
3. Record the acceptance. The status becomes **Customer Accepted**.

When the quotation is accepted, the system raises the placement slip at once (status **Placement raised**) and
stores the slip PDF. If the slip cannot be raised, the quotation's owner receives the notification
"Placement slip not raised" with the reason. A quotation that the client turns down is set to **Rejected** or
**Dropped** with a reason.

The status **Approved** is set only by {{roles:approve:quotations}}, and never by the user who created the
quotation.

### Request for quotation to the panel insurers {#process-rfq}

For a risk that needs the insurers' own terms (for example a fleet or a group personal accident), ask several
insurers first:

1. Choose {{menu:/placement/broker-slips}}.
2. Select **New Request for Quotation**, enter the risk and choose the insurers to approach.
3. Select **Save and submit to market**. The request is **Submitted** and each insurer receives it by e-mail.
4. As each insurer answers, select **Record response** (premium, rate, taxes, deductibles, validity and the share it
   writes) or **Record decline**. With the answers in, the request is **Responses in**.
5. Compare the offers and select **Prepare Quotation Slip** for the offer the client takes, or
   **Prepare Placement Slip** where the product needs no quotation.

![Operations > Sales & Marketing > Requests for Quotation, with the offers received per request](images/process/requests-for-quotation.png)

## Placement with the insurer {#process-placement}

The placement slip goes to the insurer, which returns the e-policy. The check of the e-policy against the slip is
decided by {{roles:approve:policies}}, never by the user who recorded the e-policy. See
[Placement Slips](#placement-slips).

<!-- Screens to refresh: the Check against slip dialog is being redesigned in another stream. -->

The placement slip is a firm order to the insurer. TISPH never issues the cover itself: a policy exists only once the
insurer's e-policy has been received, checked against the slip and booked.

![Operations > Sales & Marketing > Placement Slips, with the count of placements at each step](images/process/placement-slips-list.png)

Placement is done by {{roles:write:quotations}}:

1. Choose {{menu:/placement/placement-slips}} and open the placement slip (status **Placement raised**).
2. Check the insurer, the participants and the premium. For co-insurance, select **Edit participants**: one lead
   insurer, and the shares must total 100%.
3. Select **Send to insurer(s)**. Each insurer receives the slip of its share by e-mail (a direct CTPL also with the
   LTO document). The status becomes **Sent to insurer**.
4. When the insurer confirms the order, select **Record acknowledgement** and enter the insurer's reference. The
   status becomes **Acknowledged**.
5. When the e-policy arrives, select **Upload e-policy**, attach the e-policy file and enter what it says: the insurer
   policy number, the participant name, the sum insured, the net and gross premium, the commission, and the issue,
   issuance, effective and production dates. For a motor policy, correct the chassis, engine and plate numbers to
   those of the e-policy: the plate number or the MV file number is required, even where the quotation said TBA.
   The status becomes **e-Policy received**.

The system compares the e-policy with the slip at once. Amounts within PHP 1.00 of the slip match.

If the insurer declines the placement, select **Record decline**; to stop a placement, select **Cancel slip**.

### Check the e-policy against the slip {#process-epolicy-check}

The check is made by {{roles:approve:policies}}, a user other than the one who uploaded the e-policy:

1. Open the placement slip (status **e-Policy received**).
2. Select **Check against slip**. The dialog lists each item (premiums, sum insured, commission, dates, insured,
   vehicle identifiers) on the slip and on the e-policy, with the difference and the result **Matches** or **Differs**.
3. Decide:
   - **Confirm check** when every item matches.
   - **Accept differences** when the e-policy differs but is right. A reason is required; accepting differences also
     needs the right to record policies.
   - **Return to insurer** when the e-policy is wrong. A reason is required. The lead insurer receives the
     discrepancy by e-mail and the placement waits for the corrected e-policy, which is uploaded again.

After **Confirm check** or **Accept differences** the status is **Checked against slip**.

![Check against slip: every item of the e-policy matches the placement slip](images/process/placement-check-dialog.png)

## Policy, billing and endorsements {#process-policy}

Policies, cover notes and CTPL certificates are recorded by {{roles:write:policies}}; endorsements and cancellations by
{{roles:write:endorsements}}. See [Policies](#policies).

<!-- Screens to refresh: the endorsement dialog is being redesigned in another stream. -->

### Book the policy {#process-booking}

1. Open the placement slip (status **Checked against slip**).
2. Select **Book (Insurer issued)**.
3. For a motor policy, complete the client's ID details the client file lacks: ID type, ID number and the ID card
   image. The chassis number, engine number and plate or MV file number are also required.
4. Confirm the booking.

Booking creates the policy, the bill (or, for a direct-bill insurer, the commission receivable from the insurer), the
journal and the commission lines, ends the cover notes of the risk and e-mails the policy schedule with the e-policy
to the client. The placement becomes **Insurer issued (Booked)** and the quotation **Converted to Policy**. For the
TFS-financed car, the policy shows TFS in **Mortgage**.

When the client needs proof of cover before the e-policy arrives, issue a cover note on
[Cover Notes](#cover-notes-binders); a CTPL certificate is authenticated on
[CTPL Authentication](#ctpl-authentication).

### Billing statement {#process-billing}

The booked policy appears on {{menu:/agent/policy}} with its payment status in the **Payment** column (**Pending**,
**Reviewing**, **Partial** or **Completed**). The billing statement of the policy is printed or
e-mailed to the client from the policy, and the bill is collected by Cash Control.

### Endorsements and cancellations {#process-endorsement}

A change to a policy in force (insured details, vehicle, cover, an extension) is an endorsement:

1. Choose {{menu:/agent/policy}}.
2. In the row of the policy, select **More actions** (the three dots), then **Endorsement**. The action is not
   available while the policy's payment is **Pending** or **Reviewing**, or once the policy has expired, lapsed, was
   cancelled or renewed.
3. Enter the change and upload the endorsement document.
4. Complete the endorsement. The system applies the change and the premium difference to the policy, bills an
   additional premium to the client and notifies the policy owner.

An endorsement that returns premium, and a cancellation, is completed by {{roles:approve:policies}}, a user other than
the one who entered it. The return premium of a cancellation is computed on
[Cancel a policy: computed return premium](#cancel-a-policy-computed-return-premium). Commission already paid on the
returned premium is clawed back from the referrer.

![Operations > Policy, with the actions Claim and Endorsement of a paid policy](images/process/policy-actions.png)

## Collection by Cash Control {#process-collection}

Cash Control (CCD) collects the premium of every bill. The work is split between the four Cash Control roles; each
role works only on its own part:

| Collection | Role | Screen |
|---|---|---|
| Over-the-counter payments, bank transfers, bills payment and QRPh | [CCD-BP / QRPh (Receipting)](#ccd-bp-qrph-receipting) | [Receipts](#verify-payments-and-post-official-receipts) |
| Post-dated cheques | [CCD-PDU (Post-Dated Cheques)](#ccd-pdu-post-dated-cheques), [CCD-PDC / CCD-ADA](#ccd-pdc-ccd-ada) | [Post-dated cheques](#post-dated-cheques) |
| Auto-debit arrangements | [CCD-PDC / CCD-ADA](#ccd-pdc-ccd-ada) | [Receipts](#verify-payments-and-post-official-receipts) |
| Daily reconciliation, reversals and adjustments | [CCD-Recon (Reconciliation and Reversals)](#ccd-recon-reconciliation-and-reversals) | [Bank reconciliation](#bank-reconciliation), [Receipts](#verify-payments-and-post-official-receipts) |

The roles that issue receipts do not cancel or reverse them: see [Reconciliation and reversals](#process-reversals).

### Official receipt for a payment {#process-official-receipt}

1. Choose {{menu:/accounts/receipts}}.
2. Select **Receipt**. The **Add Receipts** screen opens with today's date as **Receipt Date**.
3. In **Customer Code**, select the client. **Customer Name** is filled in.
4. In **Policy Number**, select the policy paid.
5. Keep **Transaction Code** at **OR – Official Receipt**.
6. In **Receipt Mode**, select how the client paid: **Dollar/Peso** (cash), **Cheque**, **Managers Check/Demand
   Draft**, **Direct Credit/Transfer to Account**, **Telegraphic Transfer**, **Authority to Debit** (auto-debit),
   **Online Banking** or **Credit Ticket-Inter Office**. A cheque asks for the cheque details.
7. Select **Record payment**.

The system issues the official receipt number, posts the payment (cash in the bank account of the receipt mode
against the premium receivable) and reduces the bill. When the bill is fully paid the policy's payment becomes
**Completed**. Print the receipt or e-mail it to the client from the confirmation.

![Accounts > Receipts > Add Receipts, the official receipt form of CCD-BP / QRPh (Receipting)](images/process/receipt-record-payment.png)

Collections received in a file (bills payment and QRPh settlement reports) are receipted together with
**Bulk Upload** on Receipts: each row pays a policy.

### Post-dated cheques {#process-pdc}

A client who pays by post-dated cheques hands them to Cash Control. Nothing is posted until a cheque is deposited.

1. Choose {{menu:/accounts/post-dated-cheques}}.
2. Select **Register cheque** and enter the bill or policy, the drawee bank, the cheque number, the cheque date
   (picked from the calendar), the amount and where the cheque is kept. The cheque is **On Hand**.
3. Cheques due within three days appear under **Deposit due**. On or after the cheque date, select **Deposit** and
   the bank account. The system creates and posts the official receipt.
4. When the bank clears the cheque, record it as cleared.
5. If the cheque bounces, record the bounce with the reason. The system cancels its receipt (the journal is reversed
   and the bill is open again) and informs Accounting and the client. Select **Replace** to register the new cheque.

**Return** gives a cheque back to the client; **Cancel** removes a cheque registered in error.

![Accounts > Post-Dated Cheques, with the cheques on hand and their actions](images/process/post-dated-cheques.png)

### Reconciliation and reversals {#process-reversals}

Each day the bank statements are matched by {{roles:write:bank-reconciliation}} with the receipts on
[Bank reconciliation](#bank-reconciliation), and the reconciliation is approved by {{roles:approve:bank-reconciliation}}.

Receipts are never cancelled on the Receipts screen, which has no cancel action. The receipt of a cheque that the
bank returns is cancelled by CCD-Recon (Reconciliation and Reversals): on the Reconciliation Workspace (adjustment
**RCHQ – Returned cheque**) or, for a post-dated cheque, by recording the bounce on Post-Dated Cheques. The payment
journals are reversed and the bill is open again. Any other receipt issued in error is reported to CCD-Recon, who
corrects it with TIS Finance & General Accounting. The user who issued a receipt never reverses it; the
segregation-of-duties rule **Receipting and reversals** warns when one person holds both roles.

Premium warranty extensions, instalment plans and client credit limits are handled on
[Credit control](#credit-control) and approved by {{roles:approve:credit-control}}.

## Remittance to the insurers {#process-remittance}

Remittances to the insurers are prepared and submitted by {{roles:write:remittance}}, and approved by
{{roles:approve:remittance}} within their approval limit, never by the user who prepared or submitted them. See
[Remittance to insurers](#remittance-to-insurers).

TISPH collects the premium from the client and remits it to the insurer net of its commission: the remittance pays
the premium collected, less the commission and the output VAT on it, plus the withholding tax the insurer deducts
from the commission. For an insurer and product remitted gross, the whole premium is remitted and the commission is
billed to the insurer separately on [Insurer billing](#direct-bill-commission-debit-notes).

1. Every Monday at 06:15 the weekly run creates the draft remittances of the policies paid in the Monday to Friday
   before, one per insurer and product line ([Setup: remittance schedules](#remittance-schedules)). An off-cycle
   remittance is created from a list of policies with
   [Import policy list](#remittance-import-policy-list).
2. Choose {{menu:/finance/remittance/remittances}}. On **My work**, check each draft (policies and amounts), tick it and
   select **Submit for approval (n)**.
3. The approver decides on {{menu:/finance/remittance/approvals}}: **Approve**, or **Reject** with a reason, which
   returns the remittance to its maker as **Returned**.
4. The approved remittance is settled on {{menu:/finance/remittance/settlement/process}}. The approved settlement
   raises the insurer's payment voucher on [Disbursement](#disbursement-payment-vouchers-and-cheques) and the
   remittance shows **Settled (voucher raised)**.
5. The voucher is paid from [Insurer payments](#insurer-payments): by a bank payment batch on
   [Bank payment files](#bank-payment-files) or by cheque on Disbursement. The payment posts the journal and the
   remittance reaches the step **Paid**.
6. The remittance schedule (XLSX and PDF) and, once the voucher is raised, the remittance advice are downloaded from
   the remittance and sent to the insurer.

![Accounts > Remittance > Remittances of TIS Finance & General Accounting: the drafts to submit, the next run and Automation Off](images/process/remittances.png)

Each month the insurers' statements are matched with TISPH's records on
[Insurer statement reconciliation](#insurer-statement-reconciliation); the reconciliation and its adjustments are
approved by {{roles:approve:insurer-reconciliation}}.

## Commission and incentives {#process-commission}

Commission is processed by {{roles:write:commission}}. The telesales incentive is calculated by a
{{roles:write:incentive}} user and approved by another user of that role: the user who runs a calculation never
approves it. See [Commission to agents and referrers](#commission-to-agents-and-referrers) and
[Incentives](#incentives).

TISPH earns its brokerage commission from the insurer: it is kept when the premium is remitted net, or billed to the
insurer for gross and direct-bill business. Overriding, profit and contingent commission agreed with an insurer is
computed on [Overriding, profit and contingent commission from insurers](#overriding-profit-and-contingent-commission-from-insurers).

TISPH shares part of the commission with the agents, sub-agents and dealers who referred the business: the referrer
commission (shown as **Comsub** on the screens). The referrer commission lines of each policy move through four
statuses:

| Status | When |
|---|---|
| **Accrued** | At the booking of the policy |
| **Eligible** | When the client's premium is collected |
| **Approved** | When a user of Finance, other than the maker, approves the eligible lines (the accrual journal is posted) |
| **Paid** | When the approved lines are paid on a payment voucher, net of withholding tax |

To pay a referrer:

1. Choose {{menu:/commission/referrer-accounts}} and open the referrer.
2. Approve the **Eligible** lines.
3. Generate the payout: the approved lines go to a payment voucher on
   [Disbursement](#disbursement-payment-vouchers-and-cheques), with the withholding tax of the referrer (5% for an
   individual, 10% for a company in the delivered setup).

When premium is returned (an endorsement or a cancellation), the referrer commission of a paid line is clawed back
from the referrer.

![Commission > Agents/Referrer Accounts, with the net payable of each referrer](images/process/referrer-accounts.png)

## Claims {#process-claims}

Claims are registered and followed up by {{roles:write:claims}}. Claim decisions and settlement approvals are made by
{{roles:approve:claims}}. See [Claims](#the-claims-list).

TISPH registers the client's claim, advises the insurer and follows the claim up to the settlement; the insurer decides
and pays.

1. Choose {{menu:/agent/policy}}, select **More actions** on the policy, then **Claim**. The action is not available
   while the policy's payment is **Pending** or **Reviewing**.
2. Enter the date, time and place of the loss and the cause of loss (for a motor claim: own damage, theft, third
   party property damage and the other causes of the line), with the driver and vehicle for a motor claim.
3. Save the claim. The claim is **Pending**. The system refuses a claim on a policy whose premium is unpaid or whose
   loss date is outside the policy period, and sends the Preliminary Loss Advice to the insurer by e-mail.
4. Collect the claim documents of the checklist of the line; claims still missing documents are listed on
   [Claims awaiting documents](#claims-awaiting-documents). The claim goes **Processing** while the insurer reviews
   it.
5. Record the adjuster's report when it arrives.
6. For a motor claim, follow the repair on
   [Motor claim repairs and letters of authority](#motor-claim-repairs-and-letters-of-authority): the shop's estimate,
   the insurer adjuster's decision, the letter of authority to the shop and the release of the vehicle.
7. Enter the settlement agreed by the insurer and submit it. The claim is **Pending Approval**.
8. The approver ({{roles:approve:claims}}) approves or returns the settlement; the approver must be another user than
   the one who submitted it. As delivered, the approval also releases the settlement: the claim is **Settled** at once.
9. Close the claim when the claimant has been paid. A claim the insurer repudiates is **Rejected**, with a reason, and
   then closed.

When the settlement is paid through TISPH, the funds received from the insurer and the payment to the claimant are
recorded on [Claims settlements paid through the broker](#claims-settlements-paid-through-the-broker).

![Operations > Claims, with the open claims, the settlement to approve and the settled claims](images/process/claims-list.png)

## Renewals {#process-renewals}

Renewals are prepared by {{roles:write:renewals}}; renewal terms are approved by {{roles:approve:renewals}}. See
[Renewal Queue](#renewal-queue-and-at-risk-policies).

Policies come into the renewal pipeline 90 days before their expiry.

1. Choose {{menu:/renewal/queue}}. The queue lists the policies due for renewal with their stage, their risk of not
   renewing and the account executive.
2. Send the renewal notices in order (**First Notice Sent**, **Second Notice Sent**, **Final Notice Sent**), one by one
   or for many policies at once with [Renewal Batch](#renewal-batch-lapse-management-and-the-analytics).
3. Prepare the renewal terms: open the policy on [Renewal Policy](#renewal-policy) and complete the renewal (cover,
   dates, premium). The renewal quotation is linked to the expiring policy, is valid for 30 days and is sent to the
   client: the renewal is **Quote Sent**. Price and cover discussions with the client or the insurer are followed on
   [Negotiations](#negotiations).
4. When the terms are agreed, select **Submit for approval** on Negotiations. The renewal is **Pending Approval**.
5. The approver ({{roles:approve:renewals}}) approves the terms (**Approved**) or returns them (back to
   **Quote Sent**, to revise); the approver must be another user than the one who submitted them.
6. With the terms approved and accepted by the client, the renewal is completed like a new policy: placement slip,
   insurer's e-policy, check against the slip and booking. The booked policy is **Renewed** and its bill is collected
   by Cash Control.

A policy not renewed by its expiry stays **In Grace Period** for 30 days and is then **Lapsed**; a lapsed policy can
still be renewed within 90 days on [Lapse Management](#renewal-batch-lapse-management-and-the-analytics).

![Operations > Renewals > Renewal Batch, with a batch of renewal notices in preparation](images/process/renewal-batch.png)

## Month-end and tax {#process-month-end}

The month-end and year-end steps and the BIR returns are run by {{roles:write:period-end}}; the close is approved by
{{roles:approve:period-end}}. See [Period end](#period-end) and [Tax: BIR forms and returns](#tax-bir-forms-and-returns).

The TISPH fiscal year runs from April to March (FY2027: 01/04/2026 to 31/03/2027), with twelve monthly periods and an
adjustment period 13.

### Every day {#process-daily}

- The day's journals are sent to SAP in the [SAP GL export](#sap-gl-export) file.
- Cash Control reconciles the bank accounts (see [Reconciliation and reversals](#process-reversals)).

### Month-end {#process-month-end-close}

1. Make sure the month's work is posted: receipts, remittances, payment vouchers, commission, journal vouchers.
2. Finish the bank reconciliations of the month and have them approved.
3. Choose {{menu:/accounts/period-end/close}} and select **New close run** for the period.
4. Execute the run: the accruals, the recurring journals, the commission deferral, the revaluation and the close
   checklist. Executing again first reverses the run's own journals, so the result is the same.
5. Sign off the manual items of the checklist and submit the run.
6. A second user of {{roles:approve:period-end}} approves the run. The period is **Closed**.

A period can first be **Soft-closed** on {{menu:/accounts/period-end/periods}}: only {{roles:approve:period-end}} can
then still post into it. Closing and reopening a period need a reason. A period becomes **Locked** only with the
year-end close.

![Accounts > Period End > Period Management, the twelve periods of the fiscal year with their status](images/process/period-management.png)

### BIR returns {#process-bir}

The BIR forms and returns are prepared on Accounts > Tax from the payment vouchers and the ledger:

| Return | When | Screen |
|---|---|---|
| BIR Form 0619-E (expanded withholding tax) | First and second month of each quarter | [Withholding returns](#withholding-returns-0619-e-1601-eq-and-their-filing-records) |
| BIR Form 1601-EQ with the QAP | Each quarter | [Withholding returns](#withholding-returns-0619-e-1601-eq-and-their-filing-records) |
| BIR Form 2307 to suppliers | With each payment subject to withholding | [BIR Form 2307 for suppliers](#bir-form-2307-for-suppliers) |
| VAT Summary, SAWT, SLSP Sales and Purchases | Each quarter | [Tax: BIR forms and returns](#tax-bir-forms-and-returns) |
| BIR Form 1604-E and the alphalist of payees | Each year | [Annual information return 1604-E](#annual-information-return-1604-e-and-alphalist-of-payees) |

1. Choose {{menu:/accounts/tax/withholding-returns}} and select the year. Each return shows its form, period, due date
   and status.
2. Open the return, check the amounts and print or export the form and its validation file
   ([BIR DAT files](#bir-dat-files)).
3. After filing with the BIR, record the date filed, the filing reference and the amount paid. The return is
   **Filed**.

![Accounts > Tax > Withholding Returns, the 0619-E and 1601-EQ returns of the year with their due dates](images/process/withholding-returns.png)

### Year-end {#process-year-end}

After the twelve periods are closed, a user of {{roles:write:period-end}} starts the year-end close on
[Year-end close](#year-end-close-preparer). The pre-checks must pass (periods closed, no unposted journal in the year,
suspense account nil, trial balance balanced, closing accounts set up, previous year closed); the adjustments of
period 13 are posted and approved. A user of {{roles:approve:period-end}} other than the one who started the run then
closes the year: the system posts the closing entries, carries the balances forward as the opening balances of the
next year, locks the year and creates the next one.
