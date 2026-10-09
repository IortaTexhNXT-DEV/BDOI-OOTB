# User acceptance test scripts

Short scripts a business user runs in the first week to confirm BrokerVerse works for their role with the company's
own data. Run them in the test environment first, then once in production with a test client that is cancelled
afterwards. For each scenario write Pass or Fail, the date, your name and, for a failure, the record number and the
request ID from the error message (see `SUPPORT_AND_ESCALATION.md`).

Before you start: the System Administrator has finished `GO_LIVE_DATA_SETUP.md` steps 1 to 10 and each tester has a
user with one role. The scripts follow the roles of the user manual, then My Work (every role), the Compliance
Officer (AML/CFT), the compliance registers and the IT checks of the test environments. Scenarios that depend on a
module switched off for the broker are marked not applicable. The Test Plan maps each script to its module and test cases.

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
| A8 | Philippine masters | Master > Location: open Region, Province and City / Municipality; then open the master lists Salutation, Government ID Type and Holiday, and Bank and Insurance Company. Onboard a test client: choose region, province, city and barangay; type a ZIP code first on a second client. | 18 regions, 82 provinces and 1,642 cities and municipalities; the barangays of the city are listed; the ZIP code fills city, province and region; holidays of this and next year, Philippine banks and the IC-licensed insurers are listed. |
| A9 | Menu and help | Open Master and read the sections; press / and type quot; on any screen press F1; select Raise a support ticket. | Master shows its sections; the search lists the quotation screens with their path; the Help panel opens the manual section of the screen; the ticket is filled with the screen, user and version. |
| A10 | Go-live workbench | Master > Go-Live Data Load > Configuration > Blank template; fill 3 branches with one error; Upload and validate; Download errors; fix; upload again; Load; load the same file again. | The error is reported with sheet, row and column; the fixed file loads; the second load shows every row Unchanged. |
| A11 | Compare environments | In UAT download Current data of the configuration workbook; in Production (before go-live) Compare environments with that file. | Verdict Mirrored, or each difference with the column and both values; environment-specific values listed apart; nothing loaded. |
| A12 | Integrations | Master > System Configuration > Integrations: open SMS_SEMAPHORE; Test connection; Message Templates: Send a test of RENEWAL_NOTICE to your mobile number. | Test mode confirmed; the message is in the Outbox as Sent (test provider) or, in live mode, arrives on your phone. Credentials show only the variable names. |
| A13 | Insurer integration | Master > System Configuration > Insurer Integration: New mapping for one insurer; enter a policy number; Preview. | The request shows the fields as the insurer will receive them; saving the mapping is in the audit trail. |
| A14 | Branding | Sign in and out; open My Work and the Master menu; Master > System Configuration > Documents and Reports Layout: change the footer line, Save; print a receipt; restart the API. | The sign-in page, the browser tab (title and icon), the side bar and the buttons show the client's brand pack; the PDF prints the new footer and the client's logo; after the restart the brand pack and the footer are unchanged; BIR forms keep their layout. |
| A15 | E-signatures | My Profile: draw your signature with the consent box; have an approver sign; approve a payment voucher; print a draft voucher. | The signature prints only on the approved voucher; the draft carries UNSIGNED DRAFT; each event is in the audit trail. |

## Sales & Marketing

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| S1 | New lead | Operations > Leads/Prospects > Create Lead (Motor): name, mobile, e-mail, address. | The lead gets an LD- number and appears in the list as New. |
| S2 | Lead upload | Leads/Prospects > Bulk Upload with `Leads_Upload_Template.xlsx` holding 3 of your prospects. | "3 created, 0 failed"; the 3 leads are listed. |
| S3 | Motor quotation | Open the lead of S1 > Create Quote: private car, sum insured, insurer; save. | The premium shows net premium, VAT, DST and LGT; the quotation has a number. |
| S4 | Customer approval | Send the quotation for customer approval to your own e-mail and open the link. | The e-mail arrives; accepting in the link changes the quotation to accepted. |
| S5 | Renewals follow-up | Operations > Renewals: open a policy expiring within 60 days. | The renewal notice and the expiring policy details are shown. |
| S6 | Own production | Reports > Operational Reports: run the production report for this month as XLSX. | The file opens and lists your quotations and policies only. |
| S7 | Lead assignment | Operations > Sales & Marketing > Lead Assignment (manager): add a Round robin rule for two account executives; create three prospects; reassign one with a reason. | Prospects are given in turn; the reassignment is in the Assignment history; the new owner is notified. |
| S8 | Comparison report | Operations > Sales & Marketing > Comparison Reports: New report from the RFQ of P2; Prepare; Recommend an option with reasons; Client report (PDF). | Options ranked by total premium; the PDF on the letterhead shows the recommendation and no commission. |
| S9 | Campaign | Campaigns > Segments: New segment of motor clients; Who is reached; Templates: New template; Campaigns: Send now to the segment; open the opt-out link of one e-mail. | Only clients with marketing consent are reached; the others are listed with the reason; the opt-out is recorded in the Consent Register. |
| S10 | Dealer programme | Dealer Programmes: add a programme with Free first year; download the Template; upload 2 sales, one with a missing chassis number. | One row Created (prospect, quotation and policy billed to the dealer), one Failed with the reason; the bank endorsement letter prints for a financed sale. |
| S11 | Report Builder | Reports > Report Builder: dataset Policies; group by insurer; Run; Export to Excel; Save report shared with Sales. | Totals per insurer; the Excel file has a totals row; the saved report is listed for the Sales role. |

## Processing Team

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| P1 | Broker slip | Operations > Broker Slips: create a slip for a fire risk and send it to two insurers. | The slip has a number; both insurers are listed as pending. |
| P2 | Compare offers | Record both insurers' offers and compare. | The comparison shows both premiums and the recommended offer. |
| P3 | Placement and policy | Create the placement slip from the chosen offer, record the insurer confirmation and issue the policy. | The policy has a number, the insurer at 100% and a billing statement. |
| P4 | Policy upload (new business) | Operations > Policy > Bulk Upload with 2 rows of `Policies_Upload_Template.xlsx`, go-live box not ticked. | "2 created"; each policy has a bill in Collections. |
| P5 | Endorsement | Open a policy > Endorsement: change the sum insured; upload the endorsement document. | An endorsement number is given and an additional or return premium bill is created. |
| P6 | Product template | Product Configurator > Product Templates: open the motor template and read the CTPL amounts. | The amounts match the tariff agreed with the insurers. |
| P7 | Product rules | Product Configurator > Acceptance Rules: check the vehicle age referral rule; quote a vehicle above the age limit; approve the referral as the authority role. | The quotation is referred with the rule name; only the authority role, within its limit, approves it; a declined referral rejects the quotation. |
| P8 | Facultative placement | Reinsurance > Facultative Placements: New slip; add two reinsurers; record acceptances to 100% of the share; Bind; print the debit note. | Over-placement is refused; binding posts the premium due from the cedant, the net due to each reinsurer and the brokerage. |
| P9 | Fleet schedule | Operations > Fleet Schedules: New fleet schedule; upload 5 vehicles; Issue policy; add a vehicle by endorsement. | Each vehicle priced with its CTPL class; one policy and one bill; the added vehicle bills its pro-rata premium. |
| P10 | Marine open cover | Operations > Marine Open Covers: New open cover; Activate; Issue certificate; New declaration for the month; Submit; Bill. | The certificate shows the insured value with the mark-up; the declaration bills the month's premium with taxes. |

## Operations (Client Servicing)

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| O1 | Find a client | Operations > Clients: search by surname. | The client, policies and open bills are shown. |
| O2 | Endorsement request | Record a change of address requested by the client. | The request is saved and visible to the Processing Team. |
| O3 | Open items | Operations > Open Items: open the list of expiring policies and pending quotations. | The lists match the policies expiring in the period shown. |
| O4 | Payment capture | Operations > Payments: record a client's bank transfer with reference and proof. | The payment waits for Accounting verification; Accounting is notified. |
| O5 | Documents | Open a policy > Documents: download the policy schedule and billing statement. | Both PDFs open with the company letterhead. |
| O6 | Cover note | Operations > Cover Notes > Issue cover note for an accepted quotation; Print; then issue the policy. | CVN number, valid for the configured days; after issue the cover note shows Superseded with the policy number. |
| O7 | Computed cancellation | Operations > Policy Cancellation: a policy cancelled at the insured's request; Compute return premium; Create cancellation endorsement. | Short-period return computed (pro-rata for an insurer reason); the figures cannot be typed; the endorsement is created. |
| O8 | CTPL authentication | Operations > CTPL Authentication: check the COC series of an insurer; issue a motor policy with CTPL. | The next COC number is allocated and the authentication code is printed on the schedule; Used and Left counts move. |
| O9 | Onboard a client | Operations > Clients > Onboard client: a juridical client with one signatory and one beneficial owner at 30%; upload the registration certificate. | Client code given; client rated and screened; documents listed; an invalid TIN or mobile number is refused. |
| O10 | Complaint | Compliance > Insurance Commission > Complaints: Log complaint on a policy; Acknowledge; print the letter; Resolve; Close. | CMP number with acknowledgement and resolution deadlines; the letters print on the letterhead; the history lists each step. |

## Claims

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| C1 | Register a claim | Operations > Claims: new claim on an active motor policy with date and cause of loss. | The claim has a number and status Notified. |
| C2 | Documents | Upload the police report and photos; print the acknowledgement letter. | Files are listed on the claim; the letter shows the claim number. |
| C3 | Insurer follow-up | Record the insurer's reference and the adjuster; add a follow-up note. | The claim history shows each step with user and time. |
| C4 | Settlement | Record the settlement amount and the discharge voucher. | The claim is settled; the settlement appears in the claims register. |
| C5 | Claims dashboard | Dashboard > Claims Dashboard. | The claims of C1 to C4 are counted in the right status. |
| C6 | Claim document checklist | Operations > Claim Documents: open the claim of C1; Submit to insurer with a required document missing; then mark it Received and submit. | Submission is refused while a required document is missing and accepted once complete; Remind the claimant queues the e-mail. |
| C7 | Motor repair | Operations > Motor Claim Repairs: Record estimate of an accredited shop; record the adjuster approval; Issue letter of authority; Release vehicle. | LOA number with the participation of the insured; the release acknowledgement prints. |

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
| F9 | Post-dated cheque | Accounts > Post-Dated Cheques: Register cheque for an open bill; Deposit on its date; mark another one Bounced. | Deposit creates and posts the receipt; the bounced cheque cancels its receipt and reopens the bill. |
| F10 | Instalment invoices | Accounts > Credit Control > Instalment Plans: plan of 4 instalments; Issue instalment invoices. | Each instalment has its own invoice number, due date and journal; the original bill is cancelled with its reversal. |
| F11 | Bank payment file | Accounts > Bank Payment Files: New batch of approved remittance vouchers; Submit; have another user Approve; Write file; Download file; Import status file. | The file follows the bank layout; paid payments post their journals; a rejected one frees its voucher. |
| F12 | Insurer override | Commission > Insurer Overrides: New agreement with tiers; Compute a quarter; Submit; have another user Approve; Issue invoice. | The tier and rate follow the production; approval posts the receivable; the sales invoice is issued. |
| F13 | Withholding returns | Accounts > Tax > Withholding Returns: open the 1601-EQ of last quarter; read Reconciliation; Print; Record filing. BIR DAT Files: download the QAP file. | Lines per ATC reconcile with the QAP and the ledger; the filing is recorded; the DAT file passes the BIR validation module. |
| F14 | Sales invoice (EOPT) | Accounts > Tax > Sales Invoices: New invoice for fees (manual); Issue invoice; Record payment. | SI number within the registered serial range; seller and buyer details and VAT shown; the payment acknowledgement prints. |
| F15 | CAS books | Accounts > Tax > CAS Books and Documents: print the General Journal of last month; Reprint. | Page numbers run on through the year; the reprint is marked REPRINT; the print register lists both. |
| F16 | Supplier invoice | Accounts > Payables > Supplier Invoices: New supplier invoice for services from a VAT-registered supplier; Save and submit. | Input VAT and EWT computed; the invoice waits for approval (M6). |
| F17 | Fixed assets | Accounts > Fixed Assets > Asset Register: Register asset; Depreciation Run for the month; Post depreciation. | Straight-line schedule to the salvage value; one journal per asset class; a second run posts nothing. |
| F18 | Claims settlement | Accounts > Claims Settlements: record Funds received from the insurer for the claim of C4; Pay claimant; print the release form. | Claim payment voucher number; both journals posted; the release form lists the payment. |

## Accounting Manager

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| M1 | Approve a voucher | Approve the voucher of F4. | Status approved; your name is recorded as approver. |
| M2 | Approve a bank reconciliation | Approve the reconciliation prepared after F5. | The reconciliation is approved and locked; the maker cannot approve it. |
| M3 | Month-end close | Accounts > Period End > Month-End Close: review the run prepared by Accounting and approve it. | The period becomes closed; a posting dated in it is refused. |
| M4 | Reopen a period | Period Management: reopen the period with a remark, then close it again. | Reopening needs a remark; the history lists both changes with your name. |
| M5 | Soft-closed posting | Soft-close the current period; have Accounting post a journal dated in it, then post one yourself. | The Accounting user is refused; your posting is accepted. |
| M6 | Approve a supplier invoice | Accounts > Payables > Supplier Invoices: approve the invoice of F16 (you are not its maker). | The journal ap.invoice is posted; the maker could not approve it. |
| M7 | IC annual statement | Compliance > Insurance Commission > IC Annual Statement: last year; read Checks and confirmations; Download workbook. | The balance sheet balances; every ledger account with a balance is mapped; the workbook has the confirmation sheet for the accountant. |

## My Work (every role)

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| W1 | My Items | Operations > My Work: read the header figures; select a category; open an item and finish it. | Only the categories of your role appear; the finished item leaves the list. |
| W2 | My Tasks | New task with a due date, time and a reminder 15 minutes before; wait for the reminder; mark it Done. | The reminder arrives as a notification that opens the task; the task shows as done. |
| W3 | My Team (managers) | My Team: read the counts per person; Reassign a claim or task to a team member. | One row per person reporting to you; the reassignment is accepted only within your team. |

## Compliance Officer (AML/CFT)

Run with a user of role Compliance Officer (AML/CFT). Confirm the AML settings against the AMLC's current issuances before the first scenario.

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| K1 | Risk rating and EDD | Onboard a client flagged as politically exposed; have Operations prepare the EDD review and submit it; approve it. | The client is rated High; no policy is issued before the approval; you cannot approve a review you submitted. |
| K2 | Screening list | Compliance > Screening Lists: Upload version of the internal negative list (CSV) with Rescreen on. | The new version is current; potential matches are queued on Screening Hits. |
| K3 | Screening hit | Screening Hits: Decide a hit as Clear with a reason; screen the same client again. | Policy issue was refused while the hit was open; the match is cleared again automatically with your earlier reason. |
| K4 | Covered transaction | Have Accounting post two cash receipts of the same client on one day totalling PHP 550,000.00; Transaction Alerts > Run monitoring. | A covered transaction alert is raised and cannot be closed. |
| K5 | CTR file | AMLC Reports: Generate CTR file for the period; Download; Record filing. | The file holds one detail record per receipt; the alerts become Reported. |
| K6 | STR case | Open a case from a suspicious alert; enter grounds, date and narrative; Approve for filing; Generate report file. | The due date counts working days without weekends and holidays; the STR file is listed on AMLC Reports. |

## Compliance registers (Insurance Commission and data privacy)

Run with the System Administrator or Operations; K9 with Accounting.

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| K7 | Licence register | Compliance > Insurance Commission > Licence Register: Add licence for the firm and for one agent expiring within 60 days; open Expiry calendar. | States Valid and Expiring; the calendar shows the month of expiry. |
| K8 | Insurer authority | Master > Insurance > Insurance Company: set the IC certificate of one insurer as expired; send an RFQ to it. | With `compliance.insurer_authority_check` warn the RFQ goes with a warning in the audit trail; with block it is refused naming the insurer. |
| K9 | Commission to an unlicensed agent | Commission: approve the commission of an agent with no licence in force. | Refused with the reason (block) and the reason shown on the referrer account. |
| K10 | Breach register | Compliance > Data Privacy (NPC) > Breach Register: Log incident (personal data breach); Assess; Notify NPC; Close. | PDB number; the Clock shows the hours left of the 72; close is possible only after the NPC notification is recorded. |
| K11 | Masking by role | Sign in as a Processing user; open a client and export the client list. | TIN, ID, mobile, e-mail and birth date are partly masked on screen and in the file. |
| K12 | Data subject request | Master > Data Privacy > Data Subject Requests: Log request (Access); Export personal data; Close. | DSR number with a due date 15 days after receipt; the export is noted on the request. |

## IT and DevOps (test environments)

| # | Scenario | Steps | Expected result |
|---|---|---|---|
| T1 | Masked copy | On a copy restored from Production: `npm run mask:data -- --remark-copy --confirm-database=<copy> --restore-source=<backup> --execute`, then `--verify-only`. | The verification ends with exit code 0; e-mail sending is off; users must sign in again. See `DATA_MASKING.md`. |
| T2 | Transaction reset | `CONFIRM_RESET=yes npm run reset:transactions` (dry run), then `-- --execute` in UAT between cycles. | The dry run lists the counts; the reset keeps masters and configuration and empties the ledger; it refuses while the go-live lock is on. |
| T3 | Go-live rehearsal | `npm run rehearsal:golive` with SOURCE UAT and TARGET Pre-Prod. | Every check passes; keep the run log for the go/no-go. |
