<!--
Owner: see WRITER_GUIDE.md. Generated facts come from generated/roles/tis-ops-officer.md (npm run manual:role-facts in backend/);
never edit them here. Written from the local TISPH build as manual.ops-officer.
Screens to refresh: none of this chapter's own; the procedures shared with the TIS Operations Associate point to that
chapter (motor repair pop-up, e-policy and endorsement dialogs).
-->
# TIS Operations Officer {#tis-operations-officer}

## Role summary {#tis-operations-officer-summary}

{{role-summary:tis-ops-officer}}

The TIS Operations Officer does the same operations work as the TIS Operations Associate: placement with the insurers,
e-policies and policy booking, cover notes and CTPL certificates, endorsements and cancellations, renewals, claims,
claim documents and motor repairs. In addition, you can open the journal vouchers and the fixed asset register, so you
can answer questions on the accounting of a booking or a claim without asking Finance.

Like the associate, you approve nothing: the e-policies you upload, the claim decisions, your renewal terms and the
cancellations you raise are decided by the TIS Operations Unit Head (or the other approvers named below). You work with
the TIS Sales roles, who close the business, with Cash Control, who collects the premiums, and with TIS Finance &
General Accounting, who owns the journals.

{{include:generated/roles/tis-ops-officer.md}}

## Daily and periodic tasks {#tis-operations-officer-tasks}

| Task | When | Screen |
|---|---|---|
| Work through the placement slips, renewals, endorsements and claims waiting for you | Every morning and through the day | [My Work](#my-work) |
| Send placement slips, record acknowledgements, upload e-policies, book checked policies | Daily | [Placement Slips](#placement-slips) |
| Issue cover notes and authenticate CTPL certificates | Daily | [Cover Notes](#cover-notes-binders), [CTPL Authentication](#ctpl-authentication) |
| Register claims, collect their documents, follow motor repairs | Daily | [Claims](#the-claims-list), [Claims Awaiting Documents](#claims-awaiting-documents), [Motor Claim Repairs](#motor-claim-repairs-and-letters-of-authority) |
| Raise endorsements and cancellations | As requested | [Policy](#policies), [Policy Cancellation](#cancel-a-policy-computed-return-premium) |
| Send renewal notices and prepare renewal quotations | Weekly | [Renewal Queue](#renewal-queue-and-at-risk-policies) |
| Look up the journal of a booking, an endorsement or a claim settlement | When a client, an insurer or Finance asks | [Journal Voucher](#journal-vouchers) |
| Look up an office asset (cost, location, book value) | As needed | [Fixed Assets](#fixed-assets-and-depreciation) |
| Follow the work in flight and the claims position | Weekly | [Processing Dashboard](#processing-dashboard), [Claims Dashboard](#claims-dashboard) |
| Run the production, claims and renewal reports | Month-end | [All Reports](#reports-catalogue) |

## Procedures {#tis-operations-officer-procedures}

The operations procedures of this role are those of the TIS Operations Associate:

- [Start the day from My Work](#tis-operations-associate-my-work)
- [Place the business with the insurer](#tis-operations-associate-placement)
- [Book the policy](#tis-operations-associate-booking)
- [Issue a cover note or authenticate a CTPL certificate](#tis-operations-associate-cover-notes)
- [Raise an endorsement or a cancellation](#tis-operations-associate-endorsement)
- [Register a claim](#tis-operations-associate-register-claim)
- [Collect the claim documents](#tis-operations-associate-claim-documents)
- [Follow a motor repair](#tis-operations-associate-motor-repair)
- [Prepare a renewal](#tis-operations-associate-renewal)

The same rules apply: the e-policy you upload is checked by another user, claim decisions (moving a claim to
processing, submitting the settlement, rejecting) are made by the TIS Operations Unit Head or the TIS General Manager, and a
cancellation or return premium you raise is completed by another user.

### Look up the journal of a transaction {#tis-operations-officer-journal}

1. Choose {{menu:/accounts/journalvoucher}}.
2. In **Search Transactions**, type the journal number or a word of the description; use **Search by** to search on
   another column.
3. Select the eye icon in **View** to open the journal with its lines (accounts, cost centre, debit and credit).
4. To see the journals the system has parked for approval, tick **System journals parked for approval**.

The status column shows **Posted** for a journal in the books and **Awaiting approval** for one waiting for the
TIS Finance & General Accounting approver.

![Accounts > Journal Voucher as the TIS Operations Officer: the journal history with its status](images/role-tis-ops-officer/journal-vouchers.png)

> Your access to journal vouchers is View only. The **Voucher** and **Upload** buttons are for TIS Finance & General
> Accounting: the system refuses a voucher entered or uploaded by your role. See [Journal vouchers](#journal-vouchers).

### Look up a fixed asset {#tis-operations-officer-fixed-assets}

1. Choose {{menu:/accounts/fixed-assets/register}}.
2. Filter by class or status, or search the asset. The list shows the **Asset no.**, the class, the location, the date
   in service, the cost, the accumulated depreciation and the book value.
3. Select **Export to Excel** to take the list away.

Depreciation runs and disposals ({{menu:/accounts/fixed-assets/depreciation}}, {{menu:/accounts/fixed-assets/disposals}})
are open to you for reading only; they are run by TIS Finance & General Accounting. See
[Fixed assets and depreciation](#fixed-assets-and-depreciation).
