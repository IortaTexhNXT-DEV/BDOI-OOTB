<!--
Owner: see WRITER_GUIDE.md. Screen reference: the Master menu (reference masters, users and access, finance masters,
system configuration), in menu order.
-->
# Screen reference: Master {#screens-master}

The reference masters, users and access, and the system configuration of the Master menu.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role. Most master screens are kept by TIS IT AppSupport / Admin; the finance masters by TIS Finance & General Accounting. A change to access, approval limits, posting rules or account determination applies only after another user approves it.

## Distribution Channels {#distribution-channels}

Choose Master > Insurance > Distribution Channels. A channel is a dealer group or dealer branch, a financing bank or bank branch, or an affinity partner (a company whose members or homeowners are referred to the broker).

{{screen:/reports/run/dealer-production}}

{{screen:/master/insurance/channels}}

At TISPH the channels are the Toyota dealer groups and their branches (for example Toyota Alabang, Toyota Cebu, Toyota Makati) and Toyota Financial Services with its offices. The list shows **Code**, **Name**, **Channel type**, **Group** (the parent channel), **Referrer**, **Province / City**, **Prospects**, **Policies**, **Premium** and **Status**; filter by channel type and status.

**Add channel** asks for the code, name and channel type, the group it belongs to (its hierarchy), the province and city, the referrer paid for its business (from [Commission to agents and referrers](#commission-to-agents-and-referrers)) and, for a financing bank, its mortgagee clause. The pencil changes a channel; a channel with business is deactivated, not deleted.

The channel is chosen on the prospect and drives the lead assignment rules, the dealer programmes and the **Dealer Production** report (Reports > Operational Reports > Dealer Production: premium and policies by channel; see [Reports](#reports)).

![Master > Insurance > Distribution Channels: dealer groups, dealer branches and TFS](images/screens-master/distribution-channels.png)

## Company, branches and the letterhead {#company-branches-and-the-letterhead}

Every printed document and report PDF (quotation, request for quotation, placement slip, policy schedule, billing statement, official receipt, payment voucher, debit note, claim letters, BIR forms) carries the letterhead of the company marked as letterhead company.

{{screen:/master/generals/organization/companymaster}}

{{screen:/master/generals/organization/branchmaster}}

**Company** lists **Company Code**, **Company Name**, **License Number**, **Country**, **Email ID** and **Status**. The company record of Toyota Insurance Services Philippines Corporation holds its legal name, TIN, Insurance Commission licence, address, logo and contacts, and is marked as the letterhead company. **Add** creates a company; the pencil changes it.

**Branch** lists **Branch Code**, **Branch Name**, **Country**, **Email ID** and **Status** (for example the head office and the Cebu branch). The branch is chosen on users, receipts, vouchers and journals.

## Insurance companies {#insurance-companies}

Requests for quotation, placement slips, Preliminary Loss Advices and remittance advices go to the insurer's e-mail. Keep it current.

{{screen:/master/generals/insurancemanagement/insurancecompany}}

The list shows **Company Code**, **Company Name**, **E-mail**, **Phone Number**, **Modified By**, **Modified On**, **Status** and **Actions**. Only the panel insurers of TISPH are **Active**; an inactive insurer is not offered on quotations and placements. **Upload** loads insurers from a file (validated first); **Add** creates one.

The insurer record holds the code, name, address, e-mail and phone of the insurer. Whether an insurer's policies are broker-billed or direct-billed is set on [Direct bill: commission debit notes](#direct-bill-commission-debit-notes) (**Billing Mode**); its commission rates on [Commission Rate Matrix](#commission-rate-matrix).

## Masters that work the same way {#masters-that-work-the-same-way}

All masters work alike: a list with search, **Add** (the form opens on its own page or as a panel on the right), **Upload** where offered, the eye to view, the pencil to edit and a status switch to deactivate. Records are not deleted; a deactivated record no longer appears in the lists of the other screens.

{{screen:/master/generals/insurancemanagement/lineofbusiness}}

{{screen:/master/generals/insurancemanagement/productmaster}}

{{screen:/master/generals/insurancemanagement/cover}}

{{screen:/master/generals/insurancemanagement/signatories}}

{{screen:/master/generals/insurancemanagement/vehicle}}

{{screen:/master/generals/location/country}}

{{screen:/master/generals/location/state}}

{{screen:/master/generals/location/city}}

{{screen:/master/generals/employeemanagement/hierarchy}}

{{screen:/master/generals/employeemanagement/designation}}

{{screen:/master/finance/bank}}

| Master | What it holds |
|---|---|
| **Line of Business** | The lines TISPH writes (for example Motor, Accident, Life, Marine), with their code. Only active lines are offered. |
| **Product** | The products of each line: **Product Code**, **Product Name**, **Line of Business**, **Business Type** (for example **Package**), **Customer Segment** (**Retail**, **Corporate**). The rating and covers of a product are kept in the [Product Configurator](#screens-product-configurator). |
| **Cover** | The covers offered on quotations (for example Own Damage, Acts of Nature, Excess Bodily Injury, Property Damage). |
| **Signatories** | The company signatories printed on documents, with their signature image. |
| **Vehicle** | The vehicle master used by motor quotations: **Vehicle Brand**, **Vehicle Model**, **Vehicle Variant**, code and name. **Upload** loads the Toyota model list. |
| **Country**, **Province**, **City / Municipality** | The address lists. A city or municipality has its province, class (city or municipality) and ZIP code; the local government tax rate is kept on [Other finance masters](#finance). |
| **Hierarchy**, **Designation** | The ranks of the sales hierarchy and the job titles of users, by department. |
| **Bank** | The banks: **Bank Code**, **Bank Name**, **Bank Branch**, **SWIFT / BIC Code**, e-mail and phone, used for drawee banks, bank accounts and payee accounts. |

## Claim documents {#claim-documents}

{{screen:/master/insurance/claim-document-checklist}}

The Claim Document Checklist lists the documents a claim needs, by line of business and claim type: **Code**, **Line of Business** (`*` = all), **Claim Type** (`*` = all), **Document**, **Required**, **Sort Order** and **Status**. When a claim is registered, the documents of its line and cause of loss make the list of its **Documents** step (see [Register a claim](#register-a-claim)). **Add** adds a document; the switch removes it from new claims.

![Master > Insurance > Claim Document Checklist](images/screens-master/claim-document-checklist.png)

## Lead sources and reason codes {#lead-sources-and-reason-codes}

{{screen:/master/insurance/lead-sources}}

{{screen:/master/insurance/reason-codes}}

**Lead Sources** lists where prospects come from (for example Walk-In, Referral, Agent, Bundling, Promo, Used-Cars - SCR, Used-Cars - UCFP), with the **Channel Type**, the **Linked Office (branch code)** and the **Sort Order**. The source is chosen on the prospect.

**Reason Codes** holds the coded reasons of decisions, by what they are used for (**Used For**): quotations declined, claims rejected, renewals lost, refunds and adjustments, prospect reassignment, access review removals, the accounting reversals, and the remittance decisions (rejection of a remittance, off-cycle remittance, escalation of a remittance exception, rejection or cancellation of a commission debit note). **Requires Note** asks the user for a note with the reason. A screen that asks for a reason offers only the codes of its use.

![Master > Insurance > Reason Codes](images/screens-master/reason-codes.png)

## Users {#users}

A duplicate username is refused. At the first sign-in the user must choose a new password (Getting started).

{{screen:/master/generals/usermanagement/user}}

The **User List** shows **User Name**, **Assigned Role**, **E-mail** (masked), **Display Name**, **Status** and **Actions** (view, edit, and the account actions **Unlock**, **Reset password**, **Turn off two-step verification** and **Sign-in history**). **Add** creates a user: username, e-mail, display name, branch, designation, reporting line and the TISPH role, grouped by department. The status switch deactivates a leaver.

The steps are in [Create a user account](#tis-it-appsupport-admin-create-user) and [Unlock an account or reset a password](#tis-it-appsupport-admin-account-actions). An administrator cannot change his or her own account or roles.

![Master > Users and Access > User](images/screens-master/users.png)

## Roles and role permissions {#roles-and-role-permissions}

{{screen:/master/generals/usermanagement/role}}

{{screen:/master/generals/usermanagement/role-permissions}}

**Role** lists the 13 TISPH roles with **Role Code**, **Role Name**, **Department**, **Modified By**, **Modified On** and **Status**. The roles are delivered with the system; their names and departments are those of this manual's role chapters.

**Role Permissions** shows what each role may do, by part of the system: **By role** (each role's access to each screen: view, create and edit, approve) and **Compare roles** (two or more roles side by side). A change of a role's permissions waits in **Waiting for approval** and applies once another administrator approves it. **Export to Excel** downloads the permissions.

![Master > Users and Access > Role: the TISPH roles](images/screens-master/roles.png)

## User Access Matrix {#user-access-matrix}

{{screen:/master/generals/usermanagement/access-matrix}}

The User Access Matrix shows who has access to what, for audit. The cards count the **Active users**, the **Dormant** users (no sign-in for 90 days or more), the **Duty conflicts**, the users with **No two-step sign-in** and the **Changes pending**. Each row shows the user, department, roles, branch, status, **Last sign-in**, **Two-step**, **Password age (days)** and the **Segregation of duties** conflicts. Filter by department, role and status; **Export to Excel** downloads the matrix.

## Authority Matrix {#authority-matrix}

{{screen:/master/generals/usermanagement/authority-matrix}}

The Authority Matrix sets the largest amount (or percent) each role may approve per transaction: claim settlement approval, payment voucher and cheque release, journal voucher approval, remittance approval, remittance settlement, adjustment and transfer, and the others. Each transaction is a row, each approver role a column, grouped by department.

- **Limits**: the limits in force. A cell **Not set** means no limit is recorded; whether an approver without a limit may approve is shown above the table.
- **Pending approval**: changes waiting for another administrator.
- **Personal limits**: a limit for one user that differs from the role's.
- **History**: every change, with who requested and who approved it.

**Download** and **Upload** exchange the matrix as a file. A change applies after another administrator approves it.

## Delegations {#delegations}

A delegation lets another user approve with the limit of an approver who is away, for chosen transactions and dates. It applies once another administrator who may approve access changes approves it; neither the requester nor the person covering approves it.

{{screen:/master/generals/usermanagement/delegations}}

The cards count the delegations **Current and upcoming**, **Waiting for approval** and **Ended**. Each row shows the **Approver away**, **Covered by**, **Transactions**, **Period** and **Status**. **New delegation**: choose the approver, the person covering, the transactions (or all) and the dates, and save. **Export to Excel** downloads the list.

## Segregation of Duties {#segregation-of-duties}

{{screen:/master/generals/usermanagement/segregation-of-duties}}

A segregation-of-duties rule names roles or permissions one person should not hold together (for example preparing and approving payments). **Block** refuses the combination when the roles are given; **Warn** allows it and lists the person under **Conflicts** until an exception is accepted.

The cards count the **Users with conflicts**, the **Accepted exceptions**, the **Exceptions ending in 30 days** and the **Active rules**. The tabs are **Conflicts** (each user with the roles held and the rule broken; accept an exception with a reason and an end date), **Rules** (**New rule**) and **Waiting for approval**. Rules and exceptions apply after another administrator approves them. The rules that apply to each role are listed in its role chapter, under Segregation of duties.

## Access Reviews {#access-reviews}

Confirm at least every quarter that each active user still needs his or her access.

{{screen:/master/generals/usermanagement/access-reviews}}

1. Select **Start a review** and choose the scope (all users, a department) and the due date.
2. For each user, confirm the access or mark the roles to remove, with a reason from the reason codes.
3. Submit the review. The removals apply when another administrator signs the review off.

The list shows **Review**, **Scope**, **Due**, **Progress**, **Removals**, **Status**, **Started by** and **Signed off by**. **Export to Excel** downloads a review as audit evidence.

## Posting configuration {#posting-configuration-configuration-approvals-posting-rules-account-determination}

{{screen:/master/finance/account-determination}}

{{screen:/master/finance/posting-rules}}

{{screen:/master/finance/configuration-approvals}}

{{screen:/master/finance/accounting-flow}}

These four screens decide how every business event is posted to the general ledger. They are kept by TIS Finance & General Accounting; a change is approved by {{roles:approve:posting-rules}}, a user other than the one who requested it.

- **Account Determination** gives each account role its general ledger account, by tab (**Premium**, **Customer**, **Miscellaneous**, **Claims**, **Other**, **Payee & payment mode**, **Commission taxes**, **Write-off reasons**), and shows which events use it. For example the brokerage commission income goes to 3201001 Brokerage Commission Income. VAT, DST and LGT on premium are booked in their own accounts.
- **Posting Rules** lists the business events (policy issued, endorsement, renewal, cancellation, premium collection, remittance, direct bill commission, claims, commission) with the version of the rule in force. Open a rule to see its lines (debit or credit, account role, amount); a change creates a new version.
- **Configuration Approvals** lists the changes waiting: what changes, before and after, who requested it and when. **Approve** or **Reject** with a reason.
- **Accounting Flow** is read only: the journal each business event posts with the rules and accounts in force today, grouped (premium billing, collections, remittance to insurers, commission, claims). It shows whether the account mapping is complete. **Export** and **Print** give it for audit.

## Other finance masters {#finance}

{{screen:/master/finance/package-bundles}}

{{screen:/master/finance/insurer-rate-tables}}

{{screen:/master/finance/premium-taxes}}

{{screen:/master/finance/payment-gateways}}

{{screen:/master/finance/transactioncode}}

{{screen:/master/finance/currency}}

{{screen:/master/finance/exchangerate}}

| Master | What it holds |
|---|---|
| **Package Bundles** | Products sold together with a bundle discount, for example TFS Borrower Protect (Credit Life - Compulsory with the borrower's Personal Accident). |
| **Insurer Rate Tables** | Each insurer's rate for a package product: **Rate basis** (percent or per mille of sum insured), **Rate**, **Minimum premium**, **Deductible**, **Key benefits**, **Commission** and the effective dates. [Quick Quote](#quick-quote) prices from these rates. |
| **Premium Taxes & LGU Rates** | The local government tax rate of each city or municipality, the tax and charge rules (DST, VAT, LGT) and a **Calculator** to check the taxes of a premium. |
| **Payment Gateways** | The online payment gateway for the client payment links (GCash, Maya, GrabPay, cards): enabled or not, mode, payment methods, who absorbs the fee, link validity and the bank account credited. The merchant keys are kept on the server, never on this screen. |
| **Transaction Code** | The accounting transaction codes: **CM** Credit Memo, **DM** Debit Memo, **JV** Journal Voucher, **OR** Official Receipt, **PV** Payment Voucher, **RM** Remittance to Insurer, with their basis (debit, credit, both). |
| **Currency**, **Exchange Rate** | The currencies (PHP is the base currency) and the monthly exchange rates to PHP, used by foreign currency receipts and the revaluation of the month-end close. |

## Commission Rate Matrix {#commission-rate-matrix}

{{screen:/master/finance/commission-rate-matrix}}

The Commission Rate Matrix sets the broker's commission rate that applies to a placement. Each row gives an **Insurer**, **Product**, **Line of business**, **Policy type** (new business or renewal), **Rate (%)**, **Effective from**, **Effective to** and **Applies at**. The rate is chosen in this order: insurer and product, insurer and line of business, insurer, product, line of business; an exact policy type before **Any**; then the insurer's default rate and the system default. With no row, the insurers' default rates apply.

**Add rate** adds a row. **Test rate** finds the rate that would apply to a placement of an insurer, product, line of business, policy type and date.

![Master > Finance > Commission Rate Matrix](images/screens-master/commission-rate-matrix.png)

## Accounting masters {#finance-masters-kept-by-accounting}

{{screen:/master/finance/taxation}}

{{screen:/master/finance/close-checklist}}

{{screen:/master/finance/bank-statement-formats}}

{{screen:/master/finance/bank-transaction-types}}

{{screen:/master/finance/insurer-statement-formats}}

| Master | What it holds |
|---|---|
| **Taxation** | The tax codes: **Code**, **Tax type** (VAT, expanded withholding tax), **ATC**, **Description**, **Rate**, **GL account**, **Applies to** (sales, purchases, both) and **Effective from**. For example VAT12-OUT output VAT 12% on brokerage commission and fees, and the EWT codes WC158, WC160, WC100. |
| **Close Checklist** | The items of the month-end close: **Order**, **Code**, **Item**, **Type** (**Automatic** or manual), **Severity** (blocking or warning). For example no unposted journals in the period, trial balance balanced, suspense account cleared, no unapplied receipts. |
| **Bank Statement Formats** | How each bank's statement file is read: columns, date format, debit and credit or signed amounts (for example the BDO and BPI exports). |
| **Bank Transaction Types** | The bank lines with no book entry (bank charges, interest income, final tax on interest): direction, the account they post to, whether they need approval and the description pattern that recognises them on the statement. |
| **Insurer Statement Formats** | How each insurer's statement file is read; the standard format applies to any insurer without its own. |

## Financial statement versions {#financial-statement-versions}

{{screen:/master/finance/fs-versions}}

![Master > Finance > Financial Statement Versions](images/screens-master/fs-versions.png)

A financial statement version lists the lines of the statements in order, each with the range of GL accounts it carries: **TIS01 Local financial statements**, **TIS02 Balance sheet and income statement** and **TIS03 Budget** (income statement lines only). A range is given by the first digits of the accounts: **GL from** 110 and **GL to** 112 take every account from 110 to 112, whatever its length. An account belongs to the first line, by line number, whose range takes it; the accounts no line takes are listed under **Accounts not in this version** and show on that line in the reports, so the statements always add up.

Select a version to see its lines: **Line**, **Statement**, **Section**, **FS line**, **GL from**, **GL to**, **Shown as** (debit or credit balance) and the number of **Accounts** each line takes. TIS Finance & General Accounting edits the name, purpose and status and the lines (**Add line**, the bin of a line, **Save**); the lines are checked before they are saved. **Add version** starts a new version from the lines of another. The version of the reports when none is chosen is TIS01. See [Financial Statement by Version and Daily GL Balance](#reports-by-department).

## Operational masters {#operational-masters}

{{screen:/master/finance/asset-classes}}

{{screen:/master/finance/cost-centres}}

**Asset Classes** gives each class of fixed asset its **Useful Life (months)**, **Asset Account**, **Accumulated Depreciation Account** and **Depreciation Expense Account** (for example Computer equipment, 36 months). **Cost Centres** lists the cost centres of journal lines with the company, department and responsible person; the default cost centre (900901 Toyota Insurance Services) goes on journal lines that name none.

## Bank file layouts and payee bank accounts {#bank-file-layouts-and-payee-bank-accounts}

Master > Finance > Bank File Layouts says how each bank's upload file is written and how its status file is read. The system is delivered with starter layouts for BDO, BPI, Metrobank, Landbank and UnionBank and a generic CSV. **The starter layouts are examples: each must be validated against the bank's current file specification, and a test file accepted by the bank, during onboarding.** They are marked **Test mode** until changed.

{{screen:/master/finance/bank-file-layouts}}

The tab **Layouts** lists **Code**, **Name**, **Bank**, **Payment channels** (bulk credit, InstaPay, PESONet), **File format** (delimited or fixed width) and **Status**. **New layout** defines the header, detail and trailer records of a file and how the bank's status file is read. The tab **Payee bank accounts** holds the bank accounts of the payees (insurers, referrers, suppliers, claimants) used by [Bank payment files](#bank-payment-files).

![Master > Finance > Bank File Layouts](images/screens-master/bank-file-layouts.png)

## E-mail Layout {#e-mail-layout}

{{screen:/master/configuration/email-layout}}

Every e-mail the system sends (quotation links, notices, receipts, reminders, debit notes) uses this layout, with the logo and the details of the primary company. Choose whether e-mails are sent in the branded layout, the header background and text colours, the line under the header, the logo in the header and the footer (company name, address, licence and TIN). **Show a sample e-mail** previews it; **Save** applies it; **Discard changes** returns to the saved layout.

## Documents and Reports Layout {#documents-and-reports-layout}

Master > System > **Documents and Reports Layout** sets how every printed document (quotation, policy schedule, slips, endorsement, receipts, billing statements, vouchers, debit notes, claim letters) and every report PDF or Excel file is printed, together with the logo, legal name, TIN, licence and address of the primary company (Master > Organization > Company).

{{screen:/master/configuration/documents-layout}}

Set the print colours (accent, titles and section headings, section heading band, table header and its text; the contrast ratio is shown for each), the logo height on documents and the other print settings. **Sample document** previews a document; **Save** applies the layout to every document printed afterwards.

## Document Signatures {#document-signatures}

{{screen:/master/configuration/document-signatures}}

For each document (for example the policy schedule), the signature slots: **Slot**, **Label**, **Signed by** (a company signatory of Master > Insurance > Signatories, the default signatory, or the user who issued the document, whose signature is kept in My Profile) and **Prints** (for example **Once the document is issued**). **Add slot** adds a slot; **Save** applies the change.

## Configuration {#configuration}

{{screen:/master/configuration/settings}}

Configuration holds the settings of the system, grouped in cards: **Company & Branding**, **Sales, Quotations & Placement**, **Policies, Endorsements & Renewals**, **Claims**, **Billing, Collections & Credit**, **Remittance & Reconciliation**, **Commission & Incentives**, **Accounting & Tax**, **Notifications & E-mail** and the others. Each card shows the number of its settings. Open a card to see and change its settings; the search box finds a setting by its name or description (for example VAT, renewal notice, password).

A setting changes the behaviour of the system for everyone (for example the quotation validity, the renewal notice days, the grace period). Change a setting only on a decision of the business owner; every change is recorded in the [Audit Trail](#audit-trail).

![Master > System > Configuration](images/screens-master/configuration.png)

## Document Numbering {#document-numbering}

Every number the system issues comes from a series on Master > Document Numbering: prospect, request for quotation, quotation, placement slip, policy, client, bill, official receipt, payment voucher, journal voucher, claim, endorsement, debit note, close run, reconciliation, BIR Form 2307 and the others. The list shows each series with module, prefix, format, counter reset, last number and next number.

{{screen:/master/configuration/document-numbering}}

The usual format is the prefix, the year and a sequence (for example OR-2026-00001), reset every year. Filter by module and status. A number already issued is never issued again; a change to a series applies to the next number.

## Schedules {#schedules}

{{screen:/master/configuration/schedules}}

Schedules lists the jobs the system runs by itself: **Job**, **What it does**, **Schedule (Asia/Manila)**, **Status** (**Scheduled** or **Switched off**), **Next run**, **Last run** and **Last status**. Among them: bank reconciliation auto-match, month-end close reminder, recurring journals, accrual auto-reversal, period auto soft-close, My Work reminders, the e-invoicing outbox, the remittance schedules and the prospect reassignment queue.

The actions of a job are **Run now** (the play button), the run history and the pencil to change its schedule or switch it on or off. Check the last status of the jobs every morning.

![Master > System > Schedules](images/screens-master/schedules.png)

## Audit Trail {#audit-trail}

The history of a single record (claim history, policy and client **History** tab, quotation **Audit Trail** tab, master records) uses the same layout as a timeline grouped by day, newest first, with a search box, a user filter, a filter by kind of event (created, status changes and approvals, other changes, cancelled or removed) and **Export**.

{{screen:/master/configuration/audit-trail}}

Master > System > Audit Trail shows every change made in the system: **Date & Time**, **User** (with the role), **Record**, **Event**, **Changes** (each field with its value before and after) and **Source** (screen, sign-in, file upload, scheduled job). Filter by user, record type and action; **Export** downloads the result.

![Master > System > Audit Trail](images/screens-master/audit-trail.png)

## Features & Releases {#features-and-releases}

{{screen:/master/configuration/features}}

Master > System > Features & Releases lists every function of the system with its release: **Phase 1** (the TISPH scope, always on), **Platform** (users, configuration, audit and jobs, always on), **Phase 2** and **Future release** (available on request). Each line shows the **Tier**, the **Status** (Enabled, Read-only or Not enabled), the **Requirement IDs**, the **Enabled On** date, **Enabled By** (the system supplier) and the **Release Reference** of the change that enabled it. **Decision pending** marks a function whose release TISPH still has to confirm; open the line to read the question.

The tab **Future releases** lists the functions TISPH can ask for, with their description. **Export to Excel** downloads both lists.

The screen is read only. Phase 2 and future-release functions are enabled by the platform administrator of the system supplier under a signed change request, approved by a second platform administrator; IT AppSupport / Admin and the General Manager receive an e-mail and a notification when a function is enabled or disabled. A function disabled while it holds records stays **Read-only**: its records can be viewed and exported, not changed. An address of a function that is not enabled shows **Not available in this edition**.

## E-mail Outbox {#e-mail-outbox}

{{screen:/master/configuration/email-outbox}}

The E-mail Outbox lists every e-mail the system sent or tried to send: **Status** (queued, sent, failed), **To**, **Subject**, **Record**, **Attachments**, **Attempts**, **Last error**, **Created** and **Sent**. When sending is not set up, the screen says so and queued e-mails stay here. **Refresh** reads the list again; the **Last error** of a failed e-mail says why it was not delivered.

## Integrations {#integrations}

{{screen:/master/configuration/integrations}}

Integrations lists the connections to the SMS gateways, the CTPL authentication provider, the LTO, the insurers' systems and the banks. The tab **Connectors** shows each connector's **Type**, **Mode** (test or live), whether its **Credentials** are set, the **Messages** waiting, failed and sent today, and the **Last success** and **Last failure**. The tabs **Outbox** and **Inbox** list the messages sent and received. **Send due messages** sends the waiting messages at once. The credentials themselves are kept on the server, never on this screen.

## SMS and message templates {#sms-and-message-templates}

Master > System > Message Templates holds the texts sent to clients by SMS (or Viber).

{{screen:/master/configuration/message-templates}}

Each template has a **Code**, **Name**, **Event** (for example claim update, CTPL authenticated, renewal notice, payment reminder), **Channel** (SMS, Viber), **Consent needed** (marketing messages need the client's consent; service messages do not) and **Status**. The text holds placeholders, filled when the message is sent: the client's name, the policy and claim numbers, the status, the company name. **New template** adds one; the tab **Messages sent** lists the messages with their delivery status.

## Insurer integration {#insurer-integration}

{{screen:/master/configuration/insurer-integration}}

Insurer Integration says how each insurer's system is called. The tab **Mappings** lists for each insurer the **Connector**, the **Broker code at the insurer**, the **Product codes** mapping (the TISPH product to the insurer's code) and whether the issuance request is sent when a policy is issued. **New mapping** adds an insurer. The tab **Requests** lists the requests sent and their answers; **Claim status file** loads the insurer's file of claim statuses.
