<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-sales-associate.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.sales-associate.
Screens to refresh (redesign in another stream, described as on this build): tis-sales-associate-placement
(Check against slip dialog, e-policy dialog), tis-sales-associate-endorsement (endorsement dialog).
-->
# TIS Sales Associate {#tis-sales-associate}

## Role summary {#tis-sales-associate-summary}

{{role-summary:tis-sales-associate}}

The TIS Sales Associate is the account executive who turns a lead into a policy. You work the prospects referred by
Toyota Financial Services (TFS), the Toyota dealers and walk-in clients, quote them, follow the client's answer, and
see the business through placement with the panel insurer up to the booked policy. You keep your clients' records,
raise the endorsements they ask for and follow up their renewals.

You work with the TIS Sales Officer and the TIS Sales Unit Head, who assign the prospects, check the insurer's
e-policy against the placement slip and approve your renewal terms, and with the TIS Operations roles, who share the
placement and policy work and handle the claims. Cash Control collects the premiums of the policies you book. You
approve nothing: every decision on your work is made by another user.

{{include:generated/roles/tis-sales-associate.md}}

## Daily and periodic tasks {#tis-sales-associate-tasks}

| Task | When | Screen |
|---|---|---|
| Work through your prospects, quotations, placement slips and renewals | Every morning and through the day | [My Work](#my-work) |
| Contact the new prospects assigned to you and log each call, meeting, e-mail or visit | Daily | [Prospects](#prospects), [Sales activities](#sales-activities) |
| Record walk-in clients and referrals as prospects | As they come in | [Prospects](#prospects) |
| Prepare motor and package quotations and send them to the client | Daily | [Quotations](#quotations), [Quick Quote](#quick-quote) |
| Record the client's answer to a quotation | As the client answers | [Quotations](#quotations) |
| Ask the panel insurers for terms on fleet and corporate risks | As needed | [Requests for Quotation](#requests-for-quotation-broker-slips), [Comparison Reports](#comparison-reports) |
| Send the placement slips, record the acknowledgements and upload the e-policies | Daily | [Placement Slips](#placement-slips) |
| Book the policies checked against the slip | Daily | [Placement Slips](#placement-slips) |
| Issue cover notes and CTPL certificates while the insurer's policy is pending | As needed | [Cover notes (binders)](#cover-notes-binders), [CTPL authentication](#ctpl-authentication) |
| Raise the endorsements and cancellations your clients ask for | As requested | [Policies](#policies), [Policy Cancellation](#cancel-a-policy-computed-return-premium) |
| Send the renewal notices and prepare the renewal terms | Weekly, for policies expiring in the next 90 days | [Renewal Queue](#renewal-queue-and-at-risk-policies), [Negotiations](#negotiations) |
| Follow up policies in their grace period and lapsed policies | Weekly | [Lapse Management](#renewal-batch-lapse-management-and-the-analytics) |
| Check your pipeline and your incentive progress | Weekly and at month-end | [Sales Dashboard](#sales-dashboard), [Incentives](#incentives) |

## Procedures {#tis-sales-associate-procedures}

### Start the day from My Work {#tis-sales-associate-my-work}

1. Choose **My Work**. **Mine** lists the records you own.
2. Select a category on the left (**Quotations**, **Requests for quotation**, **Placement slips**, **Renewals**,
   **Endorsements**) to narrow the list. The **Next action** column says what each record waits for, for example
   "Obtain and upload the e-policy" or "Follow up the client".
3. Select the arrow at the end of a row to open the record on its screen.

See [My Work](#my-work) for the filters, tasks and calendar.

### Work a new prospect {#tis-sales-associate-prospect}

A prospect from TFS or a dealer reaches you through the assignment rules of [Lead Assignment](#lead-assignment): it
appears in My Work and you receive a notification. When no rule matches a prospect, it stays with the user who
created it. A walk-in client or a referral you record yourself is yours.

1. Choose {{menu:/agent/leadlisting}}. To record a new prospect, select **Create Prospect** and follow
   [Create a prospect](#create-a-prospect).
2. Contact the prospect. Choose {{menu:/sales/activities}} and log the call, meeting, e-mail or visit with its
   outcome and, where there is one, the next step and its follow-up date. Logging the first activity marks a
   **New** prospect **Contacted**.
3. When the prospect wants cover, prepare the quotation (next procedure). The prospect becomes **Quote Generated**.
4. If the prospect does not go ahead, set it to **Lost**.

![Operations > Sales & Marketing > Sales Activities, with the activities of the sales team and their open follow-ups](images/role-tis-sales-associate/sales-activities.png)

Open follow-ups are counted on the Sales Activities screen; follow them up on the date you set.

### Quote and close the sale {#tis-sales-associate-quotation}

1. Choose {{menu:/agent/Quotation}} and select **Create Quote**, or use {{menu:/sales/quick-quote}} for a package
   product priced from its rates in one screen. See [Create a motor quotation](#create-a-motor-quotation) for the
   fields of a motor quotation.
2. Save the quotation. It is **Draft**.
3. Open the quotation (eye icon) and select **Send for Customer Approval**. The status becomes **Pending Customer**
   and the client receives the quotation by e-mail with its approval link.
4. When the client answers by phone, e-mail or in person, open the quotation and select **Record customer response**.
   On acceptance the status becomes **Customer Accepted** and the system raises the placement slip at once
   (**Placement raised**).

![Operations > Sales & Marketing > Quotations, with the quotations of the sales team and their status](images/role-tis-sales-associate/quotations-list.png)

> A quotation referred by an acceptance rule of the product shows **Referred: awaiting approval**. It cannot be sent
> to the client, placed or issued until the TIS Operations Unit Head approves the referral.

For a risk that needs the insurers' own terms, send a request for quotation to the panel insurers first: see
[Request for quotation to the panel insurers](#process-rfq).

### Place the business and book the policy {#tis-sales-associate-placement}

<!-- Screens to refresh: the Check against slip and e-policy dialogs are being redesigned in another stream. -->

1. Choose {{menu:/placement/placement-slips}} and open the placement slip of the quotation (**Placement raised**).
2. Select **Send to insurer(s)**. The status becomes **Sent to insurer**.
3. When the insurer confirms the order, select **Record acknowledgement** and enter the insurer's reference
   (**Acknowledged**).
4. When the e-policy arrives, select **Upload e-policy**, attach the file and enter what it says. For a motor policy
   the chassis, engine and plate (or MV file) numbers must be those of the e-policy. The status becomes
   **e-Policy received**.
5. Wait for the check: a TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General Manager, other
   than you, compares the e-policy with the slip and confirms it (**Checked against slip**) or returns it to the
   insurer. You can open **Check against slip** to see the differences, but the decision is not yours.
6. Open the checked placement slip and select **Book (Insurer issued)**. Complete the client's ID details if the
   client file lacks them and confirm.

Booking creates the policy and its bill, and e-mails the policy schedule with the e-policy to the client. The
placement becomes **Insurer issued (Booked)** and the quotation **Converted to Policy**. See
[Placement Slips](#placement-slips) and [Book the policy](#process-booking).

### Raise an endorsement for your client {#tis-sales-associate-endorsement}

<!-- Screens to refresh: the endorsement dialog is being redesigned in another stream. -->

1. Choose {{menu:/agent/policy}}.
2. In the row of the policy, select **More actions** (the three dots), then **Endorsement**. The action is not offered
   while the policy's payment is **Pending** or **Reviewing**, or once the policy has expired, lapsed, was cancelled or
   renewed.
3. Enter the change, upload the endorsement document and complete the endorsement.

An endorsement that adds premium is billed to the client at once. An endorsement that returns premium, and a
cancellation, is completed by a TIS Sales Officer, TIS Sales Unit Head, TIS Operations Unit Head or TIS General
Manager. See [Raise an endorsement request](#raise-an-endorsement-request) and
[Endorsements and cancellations](#process-endorsement).

### Renew your clients' policies {#tis-sales-associate-renewal}

Policies enter the renewal pipeline 90 days before they expire.

1. Choose {{menu:/renewal/queue}}. Filter on your name in **All account executives**.
2. In the row of a policy, select **More actions** and send the next notice: **Send First Notice**, then
   **Send Second Notice**, then the final notice. The notices go in this order. Use **Record reminder** for a
   reminder given by phone or in person.
3. Prepare the renewal terms on [Renewal Policy](#renew-a-policy). The renewal quotation is valid for 30 days and is
   sent to the client (**Quote Sent**).
4. Choose {{menu:/renewal/negotiations}}, select **View** on the renewal and record the discussions with
   **Log communication** or **Add update**.
5. When the terms are agreed, select **Submit for approval**. The renewal is **Pending Approval** until another user
   approves or returns the terms; returned terms come back to **Quote Sent** for you to revise.
6. Once the terms are approved and the client accepts, the renewal goes through placement like a new policy.

A policy not renewed by its expiry stays **In Grace Period** for 30 days and is then **Lapsed**. See
[Renewals](#process-renewals).
