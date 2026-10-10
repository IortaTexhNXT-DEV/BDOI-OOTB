<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-ops-unit-head.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.ops-unit-head.
Screens to refresh (redesign in another stream, described as on this build): tis-operations-unit-head-epolicy-check
(Check against slip dialog), tis-operations-unit-head-cancellations (endorsement dialog), tis-operations-unit-head-renewals
(renewal side panel).
-->
# TIS Operations Unit Head {#tis-operations-unit-head}

## Role summary {#tis-operations-unit-head-summary}

{{role-summary:tis-ops-unit-head}}

The TIS Operations Unit Head runs the operations team and is its checker. You check the insurers' e-policies against
the placement slips, make the claim decisions (taking a claim into processing, submitting the settlement, rejecting it) and
approve the claim settlements, approve the renewal terms and the quotations of other users, decide the underwriting
referrals of the acceptance rules, complete the cancellations and return premiums raised by your team, and approve
supplier invoices.

You can do the operations work of your team yourself, but you never approve your own work: a settlement, renewal,
quotation or e-policy check you entered goes to another approver, usually the TIS General Manager. You work with the
TIS Operations Associate and Officer, whose work you check, with the TIS Sales Unit Head, who shares the approval of
quotations and renewals, and with the TIS General Manager.

{{include:generated/roles/tis-ops-unit-head.md}}

## Daily and periodic tasks {#tis-operations-unit-head-tasks}

| Task | When | Screen |
|---|---|---|
| Decide the claim settlements and renewal terms waiting for you | Every morning and through the day | [My Work](#my-work) (**Approvals**) |
| Check the e-policies received against the placement slips | Daily, as the team uploads them | [Placement Slips](#placement-slips) |
| Take registered claims into processing; reject claims the insurer repudiates | Daily | [Claims](#the-claims-list) |
| Submit the settlements agreed by the insurers | Daily | [Assessment and settlement](#assessment-and-settlement-maker) |
| Approve the claim settlements of other users | Daily | [Approve a settlement](#approve-a-settlement-checker) |
| Complete the cancellations and return premiums raised by the team | Daily | [Policy](#policies), [Cancel a policy](#cancel-a-policy-computed-return-premium) |
| Approve or return renewal terms | Daily | [Negotiations](#negotiations) |
| Approve quotations and decide underwriting referrals | As referred | [Quotations](#quotations) |
| Approve supplier invoices | As submitted | [Accounts payable](#accounts-payable) |
| Review the renewals at risk and the escalations from the team | Weekly | [At-Risk Policies](#renewal-queue-and-at-risk-policies) |
| Review the team's workload, open claims and claims ageing | Weekly | [Processing Dashboard](#processing-dashboard), [Claims Dashboard](#claims-dashboard) |
| Review the claims, renewal and production reports | Month-end | [All Reports](#reports-catalogue) |

## Procedures {#tis-operations-unit-head-procedures}

For the operations work you do yourself, follow the procedures of the
[TIS Operations Associate](#tis-operations-associate-procedures).

### Work through your approvals {#tis-operations-unit-head-my-work}

1. Choose **My Work** and select **Approvals**. The list shows the claim settlements and renewal terms waiting for
   your decision, with the amount and the due date. Records you submitted yourself are not listed.
2. Select the arrow at the end of a row to open the record where you decide it.
3. For the e-policies to check, the cancellations to complete and the claims to take into processing, select
   **Everyone**, then **Placement slips**, **Endorsements** or **Claims**.

![My Work of the TIS Operations Unit Head: a renewal premium and a claim settlement to approve](images/role-tis-ops-unit-head/my-work-approvals.png)

### Check an e-policy against the slip {#tis-operations-unit-head-epolicy-check}

1. Choose {{menu:/placement/placement-slips}} and open a placement slip with the status **e-Policy received**.
2. Select **Check against slip**. The dialog shows the **Insurer policy number**, who recorded the e-policy, and each
   item on the placement slip and on the e-policy with the **Difference** and the result **Matches** or **Differs**.
   Amounts within PHP 1.00 of the slip match.
3. Decide:
   - **Confirm check** when every item matches.
   - **Accept differences** when the e-policy differs but is right. Type the **Reason**.
   - **Return to insurer** when the e-policy is wrong. Type the **Reason**. The lead insurer receives the discrepancy
     by e-mail and the team uploads the corrected e-policy when it arrives.

After **Confirm check** or **Accept differences**, the status is **Checked against slip** and the policy can be booked.
You cannot check an e-policy you uploaded yourself. See [Check the e-policy against the slip](#process-epolicy-check).

![Check against slip: every item of the e-policy matches the placement slip](images/role-tis-ops-unit-head/check-against-slip.png)

### Take a claim into processing or reject it {#tis-operations-unit-head-claim-decisions}

1. Choose {{menu:/agent/claim}} and open a **Pending** claim.
2. Select **Continue: Review** at the foot of the claim (or **Continue claim** in the row menu of the list). The
   claim is at **Review** once its file has gone to the insurer.
3. Check what was reported and select **Proceed to adjuster report**. The claim becomes **Processing** and the team
   records the adjuster's report.
4. On **Assessment**, check the key facts and the **Assessment basis** (date reported, adjuster and adjuster status).
5. Select **Proceed to settlement** to enter the settlement, or **Reject claim** when the insurer repudiates it: pick
   the **Repudiation reason** or type the **Reason for rejection**. A rejected claim is **Rejected**.

### Submit a settlement {#tis-operations-unit-head-submit-settlement}

1. On **Settlement**, select the **Settlement type**, type the settlement amount agreed by the insurer and the **Issue
   date** and **Settlement date**, and attach the settlement documents. For co-insurance the screen shows each
   insurer's share of the amount.
2. Select **Submit settlement**. The claim becomes **Pending Approval**.

The amount cannot exceed the policy's sum insured. A settlement you submit is approved by another holder of the claim
decision right: the TIS General Manager, or another TIS Operations Unit Head user.

### Approve a claim settlement {#tis-operations-unit-head-approve-settlement}

1. In **My Work**, open the **Claim settlement** item, or open the claim on {{menu:/agent/claim}} and select
   **Continue: Approval**.
2. On **Settlement approval**, check the **Settlement to approve**: date reported, adjuster, adjuster status,
   **Settlement type** and **Settlement amount**.
3. Select **Approve settlement**, or **Return for correction** to send it back to **Processing**.

On approval the claim is settled at once and the user who submitted it is notified. You cannot approve a settlement
you submitted. When the Authority Matrix sets you a limit for claim settlements, the amount must be within it. When the
settlement is paid through TIS, the funds from the insurer and the payment to the claimant are recorded by Cash
Control and Finance on [Claims settlements paid through the broker](#claims-settlements-paid-through-the-broker).

![Settlement approval of a motor claim with Return for correction and Approve settlement](images/role-tis-ops-unit-head/settlement-approval.png)

### Complete a cancellation or a return premium {#tis-operations-unit-head-cancellations}

When a user of your team sends a cancellation, or an endorsement that returns premium, you receive a notification.

1. Open the notification, or choose **My Work**, select **Everyone** and **Endorsements**, and open the item with the
   next action "Complete the cancellation".
2. Check the return premium, the reason and the insurer's endorsement.
3. Complete the endorsement. The system applies the cancellation or the return premium to the policy and the
   commission already paid on it is clawed back.

You cannot complete a cancellation or return premium you raised yourself. When the Authority Matrix sets you a limit
for return premiums, the amount must be within it. See
[Cancel a policy: computed return premium](#cancel-a-policy-computed-return-premium).

### Approve or reject renewal terms {#tis-operations-unit-head-renewals}

1. In **My Work**, open the **Renewal premium** item, or choose {{menu:/renewal/negotiations}} and select **Pending
   approval**.
2. Select the renewal. The side panel shows the **Renewal terms** (product, insurer, expiry, current and proposed
   premium, the premium change) and the timeline of notices and negotiations.
3. Select **Approve**, or **Reject** with a note.

An approved renewal is completed by the team on the Renewal Queue. You cannot approve terms you submitted yourself.
A renewal escalated from {{menu:/renewal/at-risk}} is notified to the manager of the renewal's owner or, when the
owner reports to no one, to the unit heads.

### Approve a quotation or an underwriting referral {#tis-operations-unit-head-quotations}

Quotations created by other users are approved on [Quotations](#quotations). You cannot approve a quotation you
created.

When an acceptance rule of the product refers a quotation, the quotation shows the panel **Underwriting referral**
with the status "Referred: awaiting approval", the **Referral reasons** and the loadings added by the rules. The
quotation cannot be sent to the client, approved, placed or issued until the referral is decided.

1. Choose {{menu:/agent/Quotation}} and open the quotation.
2. In **Underwriting referral**, check the reasons and the sum insured, type the **Insurer underwriter reference**
   and the **Remarks**.
3. Select **Approve referral**, or **Decline referral**. A declined referral rejects the quotation.

The referral is decided by the role named as the authority of the acceptance rule; when the Authority Matrix sets you
a limit for underwriting referrals, the referral must be within it.

### Approve a supplier invoice {#tis-operations-unit-head-supplier-invoices}

1. Choose {{menu:/accounts/payables/invoices}} and select the status **For approval**.
2. Open the invoice. Check the supplier, the lines, the input VAT and the expanded withholding tax.
3. Select **Approve and post**, or **Reject invoice** with the reason. An approved invoice posts the AP journal and
   becomes payable; a rejected one returns to its preparer.

You cannot approve an invoice you prepared or submitted. See [Accounts payable](#accounts-payable).
