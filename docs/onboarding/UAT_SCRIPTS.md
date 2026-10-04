# User acceptance test scripts

Short scripts a business user runs in the first week to confirm BrokerVerse works for their role with the company's
own data. Run them in the test environment first, then once in production with a test client that is cancelled
afterwards. For each scenario write Pass or Fail, the date, your name and, for a failure, the record number and the
request ID from the error message (see `SUPPORT_AND_ESCALATION.md`).

Before you start: the System Administrator has finished `GO_LIVE_DATA_SETUP.md` steps 1 to 10 and each tester has a
user with one role.

## System Administrator (Super Admin)

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| A1 | New user | Master > Generals > User Management > User > Add; role Claims; save. Sign in as that user in a private window. | A temporary password is shown once; the new user must change it and sees only the Claims menus. |
| A2 | Lock and unlock | Sign in as a test user with a wrong password 5 times. Unlock the user on the User screen. | The 6th attempt says the user is locked; after unlocking the user signs in. |
| A3 | Two-step verification | Add the role to `security.require_2fa_roles` in Master > Configuration > Security; sign in as a user of that role. | The user must set up the authenticator app before reaching any screen. |
| A4 | Letterhead | Master > Generals > Organization > Company: check your company is primary. Print a billing statement. | The PDF shows your company name, address and TIN. |
| A5 | Master upload | Master > Generals > Location > City / Municipality > Upload > Download template; replace the sample row with a new city of another country (Philippine cities and municipalities are delivered); upload. | "1 created, 0 failed"; the city appears in the list (filter by its province) and in address drop-downs. |
| A6 | Document numbering | Master > Configuration > Document Numbering: set the next official receipt number. Have Accounting issue a receipt. | The receipt carries the number you set. |
| A7 | Audit trail | Master > Audit Trail: filter on your user and today. | Your changes of A1 to A6 are listed with before and after values. |

## Sales & Marketing

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| S1 | New lead | Operations > Leads/Prospects > Create Lead (Motor): name, mobile, e-mail, address. | The lead gets an LD- number and appears in the list as New. |
| S2 | Lead upload | Leads/Prospects > Bulk Upload with `Leads_Upload_Template.xlsx` holding 3 of your prospects. | "3 created, 0 failed"; the 3 leads are listed. |
| S3 | Motor quotation | Open the lead of S1 > Create Quote: private car, sum insured, insurer; save. | The premium shows net premium, VAT, DST and LGT; the quotation has a number. |
| S4 | Customer approval | Send the quotation for customer approval to your own e-mail and open the link. | The e-mail arrives; accepting in the link changes the quotation to accepted. |
| S5 | Renewals follow-up | Operations > Renewals: open a policy expiring within 60 days. | The renewal notice and the expiring policy details are shown. |
| S6 | Own production | Reports > Operational Reports: run the production report for this month as XLSX. | The file opens and lists your quotations and policies only. |

## Processing Team

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| P1 | Broker slip | Operations > Broker Slips: create a slip for a fire risk and send it to two insurers. | The slip has a number; both insurers are listed as pending. |
| P2 | Compare offers | Record both insurers' offers and compare. | The comparison shows both premiums and the recommended offer. |
| P3 | Placement and policy | Create the placement slip from the chosen offer, record the insurer confirmation and issue the policy. | The policy has a number, the insurer at 100% and a billing statement. |
| P4 | Policy upload (new business) | Operations > Policy > Bulk Upload with 2 rows of `Policies_Upload_Template.xlsx`, go-live box not ticked. | "2 created"; each policy has a bill in Collections. |
| P5 | Endorsement | Open a policy > Endorsement: change the sum insured; upload the endorsement document. | An endorsement number is given and an additional or return premium bill is created. |
| P6 | Product template | Product Configurator > Product Templates: open the motor template and read the CTPL amounts. | The amounts match the tariff agreed with the insurers. |

## Operations (Client Servicing)

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| O1 | Find a client | Operations > Clients: search by surname. | The client, policies and open bills are shown. |
| O2 | Endorsement request | Record a change of address requested by the client. | The request is saved and visible to the Processing Team. |
| O3 | Open items | Operations > Open Items: open the list of expiring policies and pending quotations. | The lists match the policies expiring in the period shown. |
| O4 | Payment capture | Operations > Payments: record a client's bank transfer with reference and proof. | The payment waits for Accounting verification; Accounting is notified. |
| O5 | Documents | Open a policy > Documents: download the policy schedule and billing statement. | Both PDFs open with the company letterhead. |

## Claims

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| C1 | Register a claim | Operations > Claims: new claim on an active motor policy with date and cause of loss. | The claim has a number and status Notified. |
| C2 | Documents | Upload the police report and photos; print the acknowledgement letter. | Files are listed on the claim; the letter shows the claim number. |
| C3 | Insurer follow-up | Record the insurer's reference and the adjuster; add a follow-up note. | The claim history shows each step with user and time. |
| C4 | Settlement | Record the settlement amount and the discharge voucher. | The claim is settled; the settlement appears in the claims register. |
| C5 | Claims dashboard | Dashboard > Claims Dashboard. | The claims of C1 to C4 are counted in the right status. |

## Accounting

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| F1 | Official receipt | Accounts > Receipts > Add receipt: pay the bill of a policy from P3 by bank transfer. | The receipt has the next OR number; the bill is paid; the journal debits cash and credits premiums receivable. |
| F2 | Verify a captured payment | Open the payment of O4 from the notification and confirm it. | An official receipt is issued and the bill is paid. |
| F3 | Remittance | Accounts > Remittance: remit the collected premium of F1 to the insurer, net of commission. | A remittance and payment voucher are created for approval with the right net amount. |
| F4 | Payment voucher | Accounts > Disbursement: create a supplier voucher; have the Accounting Manager approve it. | The voucher cannot be approved by its maker; after approval it can be paid and printed. |
| F5 | Bank statement | Accounts > Bank Reconciliation > Import statement for the operating account; Preview; Import; Auto match. | The preview balances; the receipt of F1 is matched to the deposit line. |
| F6 | Open items check | Accounts > Collections: compare the ageing with the old system's ageing at go-live. | Totals agree per bucket. |
| F7 | Opening balances check | Accounts > Period End > Financial Statements: trial balance as at the go-live date. | Every balance agrees with the old system's trial balance. |
| F8 | BIR report | Accounts > Tax > VAT Summary for the first week. | VAT on commission matches the receipts and vouchers of the week. |

## Accounting Manager

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| M1 | Approve a voucher | Approve the voucher of F4. | Status approved; your name is recorded as approver. |
| M2 | Approve a bank reconciliation | Approve the reconciliation prepared after F5. | The reconciliation is approved and locked; the maker cannot approve it. |
| M3 | Month-end close | Accounts > Period End > Month-End Close: review the run prepared by Accounting and approve it. | The period becomes closed; a posting dated in it is refused. |
| M4 | Reopen a period | Period Management: reopen the period with a remark, then close it again. | Reopening needs a remark; the history lists both changes with your name. |
| M5 | Soft-closed posting | Soft-close the current period; have Accounting post a journal dated in it, then post one yourself. | The Accounting user is refused; your posting is accepted. |
