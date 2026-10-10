<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-ops-associate.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.ops-associate.
Screens to refresh (redesign in another stream, described as on this build): tis-operations-associate-motor-repair
(repair file pop-up), tis-operations-associate-placement (e-policy dialog), tis-operations-associate-endorsement
(endorsement dialog).
-->
# TIS Operations Associate {#tis-operations-associate}

## Role summary {#tis-operations-associate-summary}

{{role-summary:tis-ops-associate}}

The TIS Operations Associate does the day-to-day operations work after the sale. You send the placement slips to the
insurers, record their acknowledgements, upload the insurers' e-policies and book the policies once they have been
checked. You issue cover notes and CTPL certificates, raise endorsements and cancellations, prepare renewals, and
register and follow up claims, their documents and motor repairs up to the insurer's settlement.

You work with the TIS Sales Associate and TIS Sales Officer, who quote and close the business, and with the TIS
Operations Unit Head, who checks the e-policies, decides the claims and approves your renewal terms, cancellations and
return premiums. Cash Control (the CCD roles) collects the premiums that your bookings bill to the client.

{{include:generated/roles/tis-ops-associate.md}}

## Daily and periodic tasks {#tis-operations-associate-tasks}

| Task | When | Screen |
|---|---|---|
| Work through the placement slips, renewals, endorsements and claims assigned to you | Every morning and through the day | [My Work](#my-work) |
| Send new placement slips to the insurers and record their acknowledgements | Daily | [Placement Slips](#placement-slips) |
| Upload the e-policies received from the insurers | Daily, as they arrive | [Placement Slips](#placement-slips), [Record e-Policy](#record-e-policy) |
| Book the policies checked against the slip | Daily | [Placement Slips](#placement-slips) |
| Issue cover notes while the insurer's policy is pending; follow up those expiring | Daily | [Cover Notes](#cover-notes-binders) |
| Authenticate the CTPL certificates of cover | Daily | [CTPL Authentication](#ctpl-authentication) |
| Register new claims and advise the insurers | Daily, as clients report losses | [Policy](#policies), [Claims](#the-claims-list) |
| Collect claim documents and remind claimants | Daily | [Claims Awaiting Documents](#claims-awaiting-documents) |
| Record repair estimates, adjuster decisions, letters of authority and vehicle releases | Daily | [Motor Claim Repairs](#motor-claim-repairs-and-letters-of-authority) |
| Raise endorsements and cancellations requested by clients | As requested | [Policy](#policies), [Policy Cancellation](#cancel-a-policy-computed-return-premium) |
| Check the payment status of policies before an endorsement or a claim | As needed | [Payments](#payments) |
| Send renewal notices and prepare the renewal quotations | Weekly, for policies expiring in the next 90 days | [Renewal Queue](#renewal-queue-and-at-risk-policies), [Renewal Batch](#renewal-batch-lapse-management-and-the-analytics) |
| Follow up lapsed policies and the policies in their grace period | Weekly | [Lapse Management](#renewal-batch-lapse-management-and-the-analytics) |
| Maintain fleet schedules and marine open covers of corporate clients | As requested | [Fleet Schedules](#fleet-schedules), [Marine Open Covers](#marine-open-covers) |
| Run the claims and renewal reports | Month-end | [All Reports](#reports-catalogue) |

## Procedures {#tis-operations-associate-procedures}

### Start the day from My Work {#tis-operations-associate-my-work}

1. Choose **My Work**. **Mine** lists the records you own; **Everyone** lists the open work of all users.
2. Select a category on the left (**Placement slips**, **Renewals**, **Endorsements**, **Claims**, **Missing
   documents**) to narrow the list. The **Next action** column says what the record waits for, for example "Obtain
   and upload the e-policy" or "Check the e-policy against the slip".
3. Select the arrow at the end of a row to open the record on its screen.

See [My Work](#my-work) for the filters, tasks and calendar.

### Place the business with the insurer {#tis-operations-associate-placement}

The quotation accepted by the client raises a placement slip with the status **Placement raised**. See
[Placement Slips](#placement-slips) for the whole screen.

1. Choose {{menu:/placement/placement-slips}} and open the placement slip.
2. Check the insurer, its share, the sum insured and the premium under **Security (participating insurers)**.
3. Select **Send to insurer(s)**. Each participating insurer receives the slip of its share by e-mail. The status
   becomes **Sent to insurer**.
4. When the insurer confirms the order, select **Record acknowledgement**, type the **Insurer acknowledgement
   reference** and select **Record acknowledgement** in the dialog. The status becomes **Acknowledged**.
5. When the e-policy arrives, select **Upload e-policy**. Attach the **e-Policy file**, type the **Insurer policy
   number**, check the **Participant name (insured on the policy)**, the **Sum insured**, **Net premium**, **Gross
   premium**, **Commission** and the dates against the e-policy, and correct the **Chassis number**, **Engine / motor
   number** and **Plate number** or **MV file number** to those on the e-policy. The plate number or the MV file
   number is required, even where the quotation said TBA.
6. Select **Save e-policy**. The status becomes **e-Policy received**.

> The e-policy you uploaded is checked against the slip by another user: the TIS Operations Unit Head, the TIS Sales
> Officer, the TIS Sales Unit Head or the TIS General Manager. You cannot check your own upload.

If the insurer declines, select **Record decline** in the insurer's row. To stop a placement, select **Cancel slip**.

### Book the policy {#tis-operations-associate-booking}

Once the placement slip is **Checked against slip**:

1. Open the placement slip and select **Book (Insurer issued)**.
2. Check the client's ID details shown in the dialog: for a motor policy the ID type, the ID number and the ID card
   image are required, with the chassis number, engine number and plate or MV file number.
3. Select **Book (Insurer issued)** in the dialog.

The system creates the policy, the bill (or, for a direct-bill insurer, the commission receivable from the insurer),
the journal and the commission lines, ends the cover notes of the risk and e-mails the policy schedule with the
e-policy to the client. The placement slip becomes **Insurer issued (Booked)**. See
[Book the policy](#process-booking).

### Issue a cover note or authenticate a CTPL certificate {#tis-operations-associate-cover-notes}

1. Choose {{menu:/operations/cover-notes}} and select **Issue cover note**.
2. Select the quotation or the placement slip in the list. The list offers the accepted and approved quotations and
   the placement slips already with the insurer.
3. Enter **Cover from** and **Cover period (days)**, and the **Insurer binder reference** and **Special conditions**
   where the insurer gave them.
4. Select **Issue cover note**. The cover note is **Active** until the insurer's policy is booked, which ends it, or
   until its end date.

For a CTPL cover, choose {{menu:/operations/ctpl-authentication}}: the list shows each certificate of cover with its
status (**Pending**, **Requested**, **Authenticated**, **Failed**). A certificate is released to the client only
when it is **Authenticated**. See [CTPL authentication](#ctpl-authentication).

### Raise an endorsement or a cancellation {#tis-operations-associate-endorsement}

1. Choose {{menu:/agent/policy}} and find the policy by number or client.
2. Select **More actions** (the three dots) in the row of the policy, then **Endorsement**. The action is not offered
   while the policy's payment is **Pending** or **Reviewing**, or after the policy has expired, lapsed, been
   cancelled or renewed.
3. Enter the change and send the endorsement to the client and the insurer. The insurer receives the endorsement
   request with the endorsement PDF by e-mail.
4. When the insurer has issued its endorsement, upload it and complete the endorsement. The system applies the change
   to the policy and bills an additional premium to the client.

![Operations > Policy with More actions open on a policy: Claim and Endorsement](images/role-tis-ops-associate/policy-actions.png)

To cancel a policy, choose {{menu:/operations/policy-cancellation}}, type the **Policy number**, the **Cancellation
date** and the **Reason**, select **Compute return premium**, check the result and select **Create cancellation
endorsement**.

> A cancellation, and an endorsement that returns premium, is completed by the TIS Operations Unit Head or the TIS
> General Manager, never by you. They are notified when you send it. See
> [Cancel a policy: computed return premium](#cancel-a-policy-computed-return-premium).

### Register a claim {#tis-operations-associate-register-claim}

1. Choose {{menu:/agent/policy}}, select **More actions** in the row of the policy, then **Claim**. The action is not
   offered while the policy's payment is **Pending** or **Reviewing**.
2. On **Claim notification**, check the insurer, the policy and the insured's address.
3. Under **Incident Details**, enter the **Date of loss**, the **Time of loss**, the **Cause of loss**, the **Place of
   loss** and the **Estimated Claim Amount**.
4. For a motor claim, complete **Driver at the time of loss** (or tick **Same as Policy Holder**) and the **Third
   party** where there is one.
5. Select **Next**. On **Advice to the insurer**, check the message and attach the proof of loss if you have it.
6. Select **Register claim and send**. The claim is registered with the status **Pending** and the Preliminary Loss
   Advice is e-mailed to the insurer.

The system refuses the claim when the premium is unpaid or the date of loss is outside the period of cover.

![New claim from a motor policy: Claim notification, the first of the nine claim steps](images/role-tis-ops-associate/claim-notification.png)

### Collect the claim documents {#tis-operations-associate-claim-documents}

1. Choose {{menu:/operations/claim-documents}}. **Claims missing documents** and **Ready to submit** count the open
   claims whose file has not gone to the insurer.
2. Select the folder icon of a claim. The checklist lists the documents of the line of business and cause of loss.
3. For each document received, select **Upload a copy** or **Mark received**. A document the claim does not need is
   waived with **Waive** and the reason.
4. While required documents are missing, select **Remind the claimant**. The claimant receives the list of missing
   documents by e-mail.
5. When the required documents are in, select **Submit to insurer**, type the **Reference (e-mail, transmittal)** and
   confirm. The claim file is recorded as submitted to the insurer.

![Operations > Claims Awaiting Documents with two motor claims missing documents](images/role-tis-ops-associate/claims-awaiting-documents.png)

> The next step, **Proceed to adjuster report** on **Review**, moves the claim to **Processing**. It is a claim
> decision made by the TIS Operations Unit Head or the TIS General Manager. Ask your unit head to take the claim on.

Once the claim is **Processing**, you record the adjuster's name and report on the claim's **Adjuster** step. See
[Adjuster report](#adjuster-report).

### Follow a motor repair {#tis-operations-associate-motor-repair}

1. Choose {{menu:/operations/motor-claim-repairs}}. The list shows each motor claim with the stage of its repair:
   **No Estimate Yet**, **Awaiting approval**, **Approved**, **In repair**, **Released**.
2. Select the claim. Its repair file opens with the estimates and the letters of authority.
3. Select **Record estimate**: the accredited repair shop, the **Shop estimate no.**, the date and the amounts.
4. When the insurer's adjuster decides, select **Record adjuster decision** on the estimate: approve with the
   **Approved amount**, or reject with the reason.
5. Select **Issue letter of authority**. The letter goes to the shop with the participation of the insured and the
   amount payable by the insurer; print it from its row.
6. When the shop has finished, select **Release vehicle**, enter the release date and the person the vehicle is
   released to, and print the release form for the insured's signature.

![Repair file of a motor claim with Record estimate, Issue letter of authority and Release vehicle](images/role-tis-ops-associate/motor-claim-repair-file.png)

See [Motor claim repairs and letters of authority](#motor-claim-repairs-and-letters-of-authority).

### Prepare a renewal {#tis-operations-associate-renewal}

1. Choose {{menu:/renewal/queue}}. The queue lists the policies due for renewal with their stage and risk.
2. In the row of a policy, open the menu and select the next notice to send it (first, second, final notice). For
   many policies at once, use [Renewal Batch](#renewal-batch-lapse-management-and-the-analytics).
3. Record each call or e-mail with the client with **Record reminder**.
4. Select **Prepare renewal quote**. Go through **Policy Review**, **Premium Calculation**, **Retention Offers** and
   **Quote Summary**, then select **Generate Quote**.
5. Select **Send Quote**, then **Send**. The renewal terms go for approval with the status **Pending Approval**; the
   unit heads are notified.
6. When the terms are **Approved**, select **Complete renewal** in the queue. The system creates the new policy term,
   marks the expiring policy renewed and raises the premium to collect.

If the terms are rejected, the renewal comes back to you to prepare again. Price discussions with the client are
logged on [Negotiations](#negotiations).

## When the system refuses an action {#tis-operations-associate-refusals}

| Message or situation | Reason | What to do |
|---|---|---|
| In **Check against slip**, **Confirm check** and **Return to insurer** are greyed out | The check is made by another user than the one who uploaded the e-policy, holding the right to decide it | Ask the TIS Operations Unit Head |
| Error on **Proceed to adjuster report**, **Proceed to settlement** or **Reject claim** | Claim decisions are made by the TIS Operations Unit Head or the TIS General Manager | Hand the claim to your unit head |
| A cancellation or return premium cannot be completed | Money going back is completed by another user | The TIS Operations Unit Head completes it |
| **Endorsement** or **Claim** is not offered on a policy | The policy's payment is **Pending** or **Reviewing**, or the policy is no longer in force | Check the policy on [Payments](#payments) |
