<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-sales-officer.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.sales-officer.
Screens to refresh (redesign in another stream, described as on this build): tis-sales-officer-epolicy-check
(Check against slip dialog), tis-sales-officer-returns (endorsement dialog).
-->
# TIS Sales Officer {#tis-sales-officer}

## Role summary {#tis-sales-officer-summary}

{{role-summary:tis-sales-officer}}

The TIS Sales Officer leads a sales team. You do the work of the TIS Sales Associate on your own accounts and, for the
team, you keep the lead assignment rules, move prospects between account executives, prepare the e-mail campaigns to
clients and prospects, and make the checker's decisions of the sales chain: the check of the insurer's e-policy
against the placement slip, the renewal terms and the return premiums prepared by other users.

You work with the TIS Sales Associates of your team, with the TIS Sales Unit Head, who heads the unit, and with the TIS
Operations roles, who share the placement and policy work. You never decide a record you entered yourself: the
system refuses it and another approver decides it.

{{include:generated/roles/tis-sales-officer.md}}

## Daily and periodic tasks {#tis-sales-officer-tasks}

| Task | When | Screen |
|---|---|---|
| Work through your own records and the work waiting for you | Every morning and through the day | [My Work](#my-work) |
| Check the e-policies received against their placement slips | Daily | [Placement Slips](#placement-slips) |
| Approve or return the renewal terms submitted by your team | Daily | [Negotiations](#negotiations) |
| Complete the endorsements and cancellations that return premium, raised by other users | As notified | [Policies](#policies), [Policy Cancellation](#cancel-a-policy-computed-return-premium) |
| Check the team's open prospects and reassign those not worked | Daily | [Lead Assignment](#lead-assignment) |
| Assign the prospects waiting in the reassignment queue | Daily | [Lead Assignment](#lead-assignment) |
| Review the team's activities and open follow-ups | Weekly | [Sales activities](#sales-activities) |
| Keep the assignment rules in line with the team and the TFS offices | When the team or the channels change | [Lead Assignment](#lead-assignment) |
| Prepare, schedule and send campaigns; check their results | As planned | [Campaigns](#campaigns) |
| Review the team's pipeline, conversion and renewals | Weekly and at month-end | [Sales Dashboard](#sales-dashboard), [Renewal Queue](#renewal-queue-and-at-risk-policies) |

The sales work on your own accounts (prospects, quotations, placement, booking, endorsements, renewals) follows the
procedures of the [TIS Sales Associate](#tis-sales-associate-procedures).

## Procedures {#tis-sales-officer-procedures}

### Check an e-policy against the placement slip {#tis-sales-officer-epolicy-check}

<!-- Screens to refresh: the Check against slip dialog is being redesigned in another stream. -->

The placement slips waiting for the check have the status **e-Policy received**. You cannot check an e-policy that
you uploaded yourself.

1. Choose {{menu:/placement/placement-slips}} and select the count **e-Policy received** to list them.
2. Open the placement slip and select **Check against slip**. The dialog shows the insurer policy number, who recorded
   the e-policy and, for each item (premiums, sum insured, commission, dates, insured, chassis, engine and plate
   numbers), the slip, the e-policy, the difference and the result **Matches** or **Differs**.
3. Decide:
   - **Confirm check** when every item matches. Amounts within PHP 1.00 of the slip match.
   - **Accept differences** when the e-policy differs but is right. Enter the reason.
   - **Return to insurer** when the e-policy is wrong. Enter the reason. The lead insurer receives the differences by
     e-mail and the placement goes back to **Acknowledged** until the corrected e-policy is uploaded.

After **Confirm check** or **Accept differences** the placement is **Checked against slip** and can be booked. See
[Check the e-policy against the slip](#process-epolicy-check).

![Check against slip: the e-policy of a motor placement matches the placement slip on every item](images/role-tis-sales-officer/placement-check.png)

### Approve renewal terms {#tis-sales-officer-renewal-approval}

Renewal terms submitted by an account executive are **Pending Approval**. The approver must be another user than the
one who submitted them.

1. Choose {{menu:/renewal/negotiations}} and select the count **Pending approval**.
2. Select **View** on the renewal. The panel shows the product, insurer, expiry, current and proposed premium, the
   premium change and the timeline of the negotiation.
3. Check the proposed premium against the current one and the reasons in the timeline.
4. Select **Approve** to approve the terms, or **Reject** to return them to the account executive for revision.

Approved terms show **Approved**; the account executive then completes the renewal with the client. Returned terms
go back to **Quote Sent**. The account executive is notified of your decision.

> The renewal terms waiting for approval are listed in the My Work of the TIS Sales Unit Head and the TIS Operations
> Unit Head. As TIS Sales Officer you find them on Negotiations.

### Complete a return of premium {#tis-sales-officer-returns}

<!-- Screens to refresh: the endorsement dialog is being redesigned in another stream. -->

An endorsement that returns premium, and a policy cancellation, is completed by an approver other than the user who
raised it. When one is raised, every approver receives the notification **Return premium** or **Cancellation** with
the endorsement number, the policy and the amount.

1. Select the bell and open the notification. The endorsement opens.
2. Check the change, the return premium and the endorsement document.
3. Complete the endorsement. The system applies the change and the return premium to the policy. Commission
   already paid on the returned premium is clawed back from the referrer.

See [Endorsements and cancellations](#process-endorsement) and
[Cancel a policy: computed return premium](#cancel-a-policy-computed-return-premium).

### Reassign prospects {#tis-sales-officer-reassign}

1. Choose {{menu:/sales/lead-assignment}}. The **Team View** tab lists the team members with their open, new,
   converted and lost prospects.
2. In the first list, select the account executive whose team you want to see, or keep **My team**. The
   **Prospects of the team** list shows each prospect with its status, line, territory, channel, account executive and
   assignment.
3. Select the prospects to move (tick box), or select the reassign icon at the end of a row. The clock icon shows the
   assignment history of the prospect.
4. In **To account executive**, choose the new account executive. The account executives of the assignment rule of
   the prospect are listed first.
5. In **Reason**, choose the reason of the reassignment and add a note where the reason asks for one.
6. Select **Reassign**. The new account executive is notified and the move is kept in the prospect's history.

![Operations > Sales & Marketing > Lead Assignment, the Team View of an account executive with the prospects to reassign](images/role-tis-sales-officer/lead-assignment-team.png)

![Reassign a prospect: the new account executive and the reason are required](images/role-tis-sales-officer/lead-reassign.png)

The **Reassignment Queue** tab lists the prospects waiting for an account executive, with the reason they are there
(for example, no active account executive in the matching rule). Assign them the same way.

### Maintain the assignment rules {#tis-sales-officer-rules}

The first active rule, by priority, whose conditions match a new prospect gives it an account executive. A rule with
empty conditions matches every prospect. When no rule matches, the prospect stays with the user who created it.

1. Choose {{menu:/sales/lead-assignment}} and open the **Assignment Rules** tab.
2. Select **Add rule**, or the pencil icon of a rule to change it.
3. Enter the name and the conditions: branch, line of business, product, lead source, category, distribution channel
   (for example **TFS Head Office (Metro Manila loans)** or a TFS branch), province and city. Choose the method:
   **Round robin** (the next account executive in turn), the account executive with the fewest open prospects, or
   always the first account executive. Select the account executives who receive the prospects.
4. Save the rule. Use the arrows to change its priority and the **Active** switch to stop or restart it.

![Operations > Sales & Marketing > Lead Assignment, the assignment rules of the TFS referrals by TFS office](images/role-tis-sales-officer/lead-assignment-rules.png)

### Prepare and send a campaign {#tis-sales-officer-campaign}

A campaign e-mails an offer to the clients and prospects of a segment who agreed to receive marketing e-mails. Everyone
else is left out, and every e-mail carries an opt-out link.

1. Choose {{menu:/sales/campaigns}}. Check that the segment and the e-mail template exist on the **Segments** and
   **Templates** tabs; add them there if needed.
2. Select **New campaign**, enter the name, choose the segment and the template, and save. The campaign is **Draft**.
3. In the row of the campaign, select the clock icon to schedule it for a date and time (**Scheduled**), or the send
   icon to send it now. The red cross cancels a draft or scheduled campaign.
4. After sending, open the campaign to see its results: e-mails sent and failed, recipients excluded and why,
   opt-outs, and the recipients quoted and insured afterwards.

Consents received outside the system (for example on a signed form) are recorded on the **Marketing consents** tab.
See [Campaigns](#campaigns).

![Operations > Sales & Marketing > Campaigns, with a scheduled renewal campaign and a draft cross-sell campaign](images/role-tis-sales-officer/campaigns.png)
