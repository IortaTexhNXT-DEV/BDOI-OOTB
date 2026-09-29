# About this manual

## Purpose

BrokerVerse (BIBS · BDOI Broker System) is the insurance broking platform of BDO Insurance Brokers, Inc. It runs the whole broking cycle for Philippine non-life business in one place: prospects, quotations, policies, billing and collection, commission, remittance to insurers, direct-bill commission debit notes, endorsements, claims, renewals, reinsurance, incentives and reports.

This manual explains how to use every module, step by step. It also explains what happens behind each step: the numbers the system issues, the ledger entries it posts, the approvals it asks for and the reports that pick the transaction up.

## Who this manual is for

| Reader | Use this manual to |
|---|---|
| Agents / referrers and sales staff | Capture leads, prepare quotations, convert accepted quotations into policies and follow renewals. |
| Underwriters | Review quotations, price renewals, maintain rating and underwriting rules, work reinsurance. |
| Customer services | Answer client questions, raise endorsements, follow open items and payments. |
| Claims officers | Register, adjust and settle claims with a second officer as checker. |
| Finance and accounts | Post receipts, pay commission, remit premium to insurers, bill direct-bill commission, keep the ledger. |
| Business administrators | Maintain products, rates, taxes, commission and the other business masters. |
| IT and user access administrators | Manage users, roles, system settings, schedules and the audit trail. |

Chapter 20 has a one-page quick guide for each persona. Read it first, then go to the module chapters for the detail.

## Conventions

| Convention | Meaning |
|---|---|
| **Operations > Quotation** | A menu path. Choose the first item in the sidebar, then the next one. |
| **Create Quote** | A button, tab, field or other text that you see on the screen. |
| `limits.quote_validity_days` | A configuration key. You find it on **Master > Configuration**. |
| QT-2026-00006 | An example record from the sample data shown in the screenshots. |
| ₱ 28,569.53 | Amounts are in Philippine pesos with Philippine digit grouping. |
| 29/09/2026 | Dates use the configured format DD/MM/YYYY. |
| Maker / checker | The maker enters a transaction. A different user, the checker, approves it. |

> **Tip:** Screenshots were taken from the live system with sample data on 29 September 2026. Your screens show your own data, and your menu shows only the items your role may open.

> **Note:** Numbered steps tell you exactly what to do. Text after a step tells you what the system does in return.

## Signing in

You sign in with your own user ID and password. Never share a user ID. Every action is recorded against it in the audit trail.

![The sign-in page](intro-login)

1. Open the BrokerVerse address that your administrator gave you in a web browser (Chrome, Edge or Firefox).
2. Optional: choose your language in the list at the top right (**English** or **ภาษาไทย**).
3. In **User ID**, type your user name, for example `maria.sales`.
4. In **Password**, type your password.
5. Select **Login**.

The system opens your landing screen. Administrators land on the Executive Dashboard. Other roles land on their own home screen or on the first screen their role may open.

### Password rules

| Rule | Value | Where it is set |
|---|---|---|
| Minimum length | 8 characters | `security.password_min_length` |
| Must contain | an upper-case letter, a lower-case letter, a digit and a symbol | `security.password_require_*` |
| Password history | the last 5 passwords cannot be reused | `security.password_history_count` |
| Maximum age | 90 days | `security.password_max_age_days` |

A User Access Administrator sets the first password when your user is created. To change or reset a password, ask a User Access Administrator (see Chapter 18).

### Failed sign-ins and locked accounts

- A wrong user ID or password shows a message under the **Login** button. Check Caps Lock and try again.
- After 5 failed attempts in a row the account is locked (`limits.max_login_attempts`). The message reads **Account locked. Contact the administrator**.
- The system also limits sign-in attempts to 10 in 5 minutes from one computer and for one user name (`security.login_rate_limit`). Wait five minutes before you try again.
- A User Access Administrator unlocks your account by switching its status back to active, or by setting a new password.

### Two-factor authentication

The server supports a second sign-in step with an authenticator app, per role (`security.require_2fa_roles`). No role requires it at present, and the sign-in page does not yet show the code step. Do not add roles to this setting until the code step is available on the sign-in page.

### Automatic sign-out

If you do nothing for 30 minutes, the system signs you out (`limits.session_idle_minutes`). One minute before, a warning appears at the top of the screen. Move the mouse or press a key to stay signed in. Unsaved entries on the screen are lost when you are signed out, so save your work before you leave your desk.

### Signing out

1. Select your initials at the top right of the screen.
2. Select **Logout**.

> **Important:** The **Forgot password?** link on the sign-in page is not active in this release. Ask a User Access Administrator to reset your password.

## The screen layout

![Screen layout: sidebar menu on the left, top bar with language, notifications and profile, work area on the right](intro-layout)

| Area | What it does |
|---|---|
| Logo and system name | BDO Insure logo and "BIBS · BDOI Broker System". |
| **Search menu...** | Type part of a screen name, for example *receipt*. The list shows every matching screen with its menu path. Select one to open it. |
| Sidebar menu | The modules your role may use. Select a module to open its items. Items with an arrow open a further list. |
| Language | Switch the screen language between English and Thai. |
| Notification bell | The number shows unread notifications. Select the bell to see the latest ones. |
| Profile (your initials) | **Profile**, **Help** and **Logout**. |
| Work area | The screen you opened, with its title and breadcrumb (for example *Home • Policy*). |

![Menu search: typing "receipt" lists every screen with that word](intro-menu-search)

### Notifications

The system sends you a notification when something needs your attention: a quotation to review, a claim registered on your policy, an approval waiting for you, a premium overdue, a renewal notice sent.

![Notification panel opened from the bell](intro-notifications)

1. Select the bell. The panel shows the latest notifications with their type (Approval, Reminder, Notification) and time.
2. Select **See More** to open the full list on the **Notification** page.
3. Select the **X** on a notification to remove it from the panel.

![The Notification page](intro-notification-page)

### Your profile

Select your initials, then **Profile**, to see your name, e-mail address and contact details. Select **Edit Profile** to correct them.

![The profile menu](intro-profile-menu)

### Working with lists

Most screens open with a list. The lists work the same way everywhere:

- Type in **Search** to filter the list. Some lists have a field selector next to the search box (for example **Policy Number**).
- Select **Show Filters** to filter by status, dates, insurer or amount.
- Use the arrows at the bottom to page through the list, and **Rows per page** to show more rows.
- Row actions are icons at the end of the row: the arrow or eye opens the record, the pencil edits it, the three dots (**...**) open more actions.
- Status badges are coloured: green for completed or active, amber for pending, red for rejected or overdue.

## Roles and what each persona sees

Your role decides which menus you see and which screens you may open. The server applies the same rules to every request, so a screen you cannot see is also refused if someone types its address.

{widths: 17,15,38,30}
| Persona | Role (code) | Menus | Maker / checker duties |
|---|---|---|---|
| IT Administrator (BrokerVerse) | IT Administrator (it-admin) | All menus | Settings, schedules and integrations. Cannot approve own transactions. |
| Business Administrator (bea.admin) | Business Administrator (ba) | All menus | Products, rates, masters, treaties, incentive programmes. |
| Sales / Relationship Manager (maria.sales) | sales | Dashboard (Executive, Agent), Product Configurator (Dashboard, Templates), Operations (all), Commission Dashboard, Operational Reports | Maker for quotations; earns commission on own production. |
| Agent / Referrer (ramon.agent) | agent | Agent Dashboard, Operations (Home, Leads, Clients, Quotation, Policy, Claims, Renewals), Commission Dashboard | Sees only own book. Maker for quotations. |
| Underwriter (jose.uw) | underwriting | Underwriting and Executive Dashboards, Product Configurator (all), Operations (all), Reinsurance (all), Operational Reports | Notified of quotations sent for approval; checker for renewal terms. |
| Customer Services (ana.cs) | customer-services | Executive Dashboard, Product Configurator (Dashboard, Templates), Operations (all), Operational Reports | Endorsements; can capture leads and quotations. |
| Claims Officer (carlo.claims, lisa.claims2) | claims | Claims Dashboard, Operations (Home, Clients, Policy, Claims), Reinsurance > Claims Recovery, Operational Reports | One officer submits a settlement, another approves it. |
| Finance / Accounts (liza.finance, fe.approver) | finance | Executive Dashboard, Operations (Open Items, Payments), Accounts (all), Commission (all), Reinsurance > Reconciliation, Financial and Operational Reports | One user makes vouchers, JVs, remittances and debit notes; another approves them. |
| User Access Administrator (carmela.morfe) | user-access-admin | Master > User Management and Audit Trail only | Users, roles and access reviews; no business data. |

![A menu reduced to the role: the Agent / Referrer sidebar](persona-ramon.agent)

If you type the address of a screen your role may not open, the system shows **Not authorised**. Choose a screen from your menu instead.

![Not authorised: a User Access Administrator opening Accounts > Receipts](intro-not-authorised)

> **Note:** Agents see only their own book: the leads, clients, quotations and policies they created or own (`security.scoped_roles`).

## Numbers, dates and Philippine formats

| Item | Format and rule |
|---|---|
| Currency | Philippine peso (PHP, ₱) with two decimals and Philippine grouping, for example ₱ 1,450,000.00. |
| Dates | DD/MM/YYYY, for example 29/09/2026 (`general.date_format`). Time zone Asia/Manila. |
| Mobile numbers | Philippine mobile numbers. Type 0917 123 4567, +63 917 123 4567 or 9171234567. The system stores 09171234567. |
| ZIP code | 4 digits, for example 1226 (Makati). |
| Date of birth | Must be a past date. The age must be within the configured range (18 to 100 years by default). |
| TIN | Required for corporate prospects (Tax Identification Number of the company). |
| Government ID (KYC) | PhilSys ID, UMID, Passport, Driver's License, PRC ID, SSS ID, GSIS ID, TIN ID, Postal ID, Voter's ID or Senior Citizen ID (`policy.kyc_id_types`). |
| Taxes on premium | VAT 12%, documentary stamp tax (DST) 12.5%, local government tax (LGT) 0.75%; fire service tax (FST) 2% for fire and IAR (`premium.taxes_by_lob`). |
| Withholding tax | 5% on agent commission (individual), 10% for external / company referrers; the insurer withholds 10% expanded withholding tax on direct-bill commission (BIR Form 2307). |

# The end-to-end business flow

## Overview

A policy passes through the same steps every time. Each step is done by a different person, on a different screen, and each one leaves a numbered document behind.

{widths: 6,17,34,19,24}
| # | Step | What happens | Who | Screen |
|---|---|---|---|---|
| 1 | Lead | The prospect is recorded with contact details and address. Number LD-. | Agent, sales, customer services | Operations > Leads/Prospects |
| 2 | Quotation | Vehicle, cover and insurer are chosen; the system prices the premium and taxes. Number QT-. | Agent, sales, underwriter | Operations > Leads/Prospects > Create Quote |
| 3 | Customer approval | The client receives an e-mail link and accepts the quotation online. Underwriting is notified. | Client; underwriter informed | Public approval page |
| 4 | Policy issue | KYC, vehicle identifiers and photos are recorded; billing mode is chosen (broker billed or direct bill); the insurer's policy is uploaded. Number POL-, client code CL-. | Agent, sales, underwriter | Convert Policy, Upload Policy |
| 5 | Billing | Broker billed: a premium bill INV- with its booking journal and a collection item. Direct bill: commission receivable from the insurer. Commission is accrued for the referrer. | System | Automatic at issue |
| 6 | Payment capture | The client's payment is recorded (pay later, bank transfer, cheque, online, cash) for finance to verify. | Agent, sales, underwriter | Policy > Payment |
| 7 | Receipt | Finance posts the official receipt OR- against the open bill. The bill becomes Partial or Paid. | Finance | Accounts > Receipts |
| 8 | Commission payout | Commission lines become eligible when the premium is fully collected; they are approved and paid by voucher PV- less withholding tax. | Finance maker + checker | Commission > Agents/Referrer Accounts, Accounts > Disbursement |
| 9 | Remittance to insurer | Collected premium, net of commission, is remitted to the insurer (REM-), settled (SET-) and paid by cheque (PV-). | Finance maker + checker | Accounts > Remittance |
| 9a | Direct-bill debit note | For direct-bill policies the broker bills its commission plus VAT to the insurer (DN-) and records the insurer's payments net of EWT (DNC-). | Finance maker + checker | Accounts > Remittance > Direct Bill Processing |
| 10 | Endorsement | A change to the policy (personal details, vehicle, cover, extension, cancellation) is recorded. Additional premium is billed. Number END-. | Customer services, agent, sales | Operations > Policy > ... > Endorsement |
| 11 | Claim | A loss is registered, adjusted and settled; a second claims officer approves the settlement. Number CLM-. | Claims officers | Operations > Policy > ... > Claim, Operations > Claims |
| 12 | Renewal | Policies enter the renewal pipeline 90 days before expiry; notices go out at 60, 30 and 15 days; a renewal quotation becomes the new term. | Underwriter, sales, agent; schedules | Operations > Renewals |
| 13 | Reports | Every step above appears in the dashboards and in the 19 reports. | Everyone, by role | Dashboard, Reports |

## Maker-checker points

Maker-checker means that the person who enters a transaction cannot approve it. The system refuses the approval with a message when the maker tries.

{widths: 28,24,24,24}
| Transaction | Maker | Checker | Setting |
|---|---|---|---|
| Quotation approval (status Approved) | Quotation creator | Another user (underwriting is notified) | `workflow.quote_maker_checker` |
| Claim settlement | Claims officer who submits | Another claims officer | `claims.settlement_maker_checker` |
| Journal voucher | Finance user who submits | Another finance user | `journal.require_approval`, `finance.maker_checker_enabled` |
| Payment voucher, cheque, commission payout | Finance maker | Another finance user | `finance.maker_checker_enabled` |
| Commission line approval | Finance maker | Another finance user | `finance.maker_checker_enabled` |
| Remittance, settlement, adjustment | Initiator | Another finance user (levels by amount) | `remittance.approval_levels` |
| Direct-bill debit note | Finance user who raises it | Another finance user | built-in |
| Renewal terms | Renewal maker | Underwriter | `renewals.maker_checker` |
| Reinsurance treaty | Creator | Another user | `reinsurance.treaty_requires_approval` |
| Incentive calculation batch | Finance maker | Another user | built-in |

## The money trail of a broker-billed policy

This example follows policy POL-2026-00001 (MAPFRE, Toyota Rav4, client Andrea Villanueva, agent Ramon Dela Cruz). Every row is a document the system created and a balanced journal it posted.

{widths: 22,24,20,22,12}
| Event | Document | Debit | Credit | Amount (₱) |
|---|---|---|---|---|
| Policy issued | Bill INV-2026-00001, journal JV-2026-00100 | Premium receivable 35,076.27 | Payable to insurer 30,875.52; commission income 4,200.75 | 35,076.27 |
| Premium received | OR-2026-00019, JV-2026-00101 | Cash in bank | Premium receivable | 35,076.27 |
| Commission to the agent | PV-2026-00022, JV-2026-00103 | Commission payable 4,200.75 | Cash 3,990.71; withholding tax payable 210.04 | 4,200.75 |
| Premium remitted to MAPFRE | REM-2026-00018, SET-2026-00002, PV-2026-00023, JV-2026-00104 | Premium payable | Cash in bank | 30,875.52 |
| Cover increased by endorsement | END-2026-00003, INV-2026-00002, JV-2026-00105 | Premium receivable 5,010.00 | Payable to insurer 4,410.00; commission income 600.00 | 5,010.00 |
| Endorsement premium received | OR-2026-00020 (partial), OR-2026-00021 (balance) | Cash in bank | Premium receivable | 2,000.00 + 3,010.00 |

At the end the premium receivable and the premium payable for the policy are both nil, the agent has been paid, and the trial balance is balanced.

## The money trail of a direct-bill policy

In direct bill the client pays the premium to the insurer. The broker does not collect premium. It bills its commission, plus VAT, to the insurer with a commission debit note. The insurer pays the commission net of 10% expanded withholding tax and sends BIR Form 2307.

Example: POL-2026-00003 (Malayan, Honda City, client Miguel Santiago), commission 4,105.80.

{widths: 22,24,22,20,12}
| Event | Document | Debit | Credit | Amount (₱) |
|---|---|---|---|---|
| Policy issued as direct bill | JV at issue | Commission receivable – insurers 4,598.50 | Commission income 4,105.80; output VAT 492.70 | 4,598.50 |
| Debit note raised and approved | DN-2026-00001 | – | – | 4,598.50 |
| Insurer pays part | DNC collection, JV | Cash 2,000.00; creditable WHT 205.29 | Commission receivable | 2,205.29 |
| Insurer pays the balance | DNC collection, JV | Cash 2,187.92; creditable WHT 205.29 | Commission receivable | 2,393.21 |

No premium bill, no collection reminder and no remittance is created for a direct-bill policy.

## Key business rules at a glance

- The server prices every quotation again with the configured rates and taxes. A premium changed in the browser is refused.
- CTPL is the Insurance Commission tariff premium for the vehicle class, inclusive of taxes and fees. It is added to the gross premium outside the taxed net premium and is never discounted.
- Auto Passenger Personal Accident (APPA) cover is the limit per person × seats (driver and passengers) × 0.1%.
- A policy cannot be issued without the government ID (type, number and image), chassis number, motor number and plate or MV file number (motor).
- A claim is refused when the date of loss is outside the policy period or in the future, or while premium is unpaid (`claims.block_unpaid_premium`).
- Commission becomes eligible for payout only when the premium is fully collected, and only for referrers with a bank account on file.
- Only finance users post official receipts. Other roles record a payment for finance to verify.

# Dashboards

## Purpose

Dashboards show live figures from the policies, bills, claims and commission lines in the system. They move as soon as a transaction is saved: a new policy adds to active policies and premium at once, a receipt reduces the receivable, a settled claim changes the claims figures.

| Dashboard | Menu | Who uses it |
|---|---|---|
| Executive Dashboard | Dashboard > Executive Dashboard | Administrators, sales, underwriters, customer services, finance |
| Claims Dashboard | Dashboard > Claims Dashboard | Claims officers, administrators |
| Underwriting Dashboard | Dashboard > Underwriting Dashboard | Underwriters, administrators |
| Agent Dashboard (Operations Home) | Dashboard > Agent Dashboard, Operations > Home | Agents, sales, administrators |
| Commission Dashboard | Commission > Commission Dashboard | Finance, sales, agents, administrators (see Chapter 13) |

## Executive Dashboard

![Executive Dashboard: key figures against target](dash-exec)

The top of the dashboard shows the key performance indicators against the targets set in **Master > Configuration** (`dashboard.targets`).

| Card | What it shows |
|---|---|
| Total Revenue | Gross written premium in the period, with the change against the previous period. |
| Active Policies | Policies in force. |
| New Business | Premium of new (not renewed) policies in the period. |
| Claims Rate | Claims incurred as a percentage of premium. |
| Retention Rate | Renewals retained as a percentage of renewals due. |
| Customer Satisfaction | Shown as "-" until satisfaction scores are recorded. |
| Premium Receivable (Clients) | Premium billed to clients and not yet collected, with the overdue part. |
| Commission Receivable (Insurers, Direct Bill) | Commission billed or to be billed to insurers on direct-bill policies, with the unbilled and overdue parts. |

To use the dashboard:

1. Choose **Dashboard > Executive Dashboard**.
2. In the period list, choose **This Month**, **This Quarter** or **This Year**. The figures and charts refresh.
3. To download the Production Register for a date range, choose the dates in the date field, then select **Export Report**. The file downloads as Excel (XLSX).
4. Scroll down for the charts and tables.

![Executive Dashboard: trends, product lines, regions, products and agents](dash-exec-2)

| Section | What it shows |
|---|---|
| Performance Trends | Gross written premium by month (scroll sideways for more months). |
| Revenue by Product Line | Premium split by line of business. |
| Regional Performance | Premium, policies and market share by province. |
| Top Performing Products | Premium, number of policies and claim ratio by product. |
| Top Agents Performance | Premium, conversion rate and policies by agent. |
| Claims Status Distribution, Customer Segmentation | Claims by status and clients by segment. |
| Quick Actions | Shortcuts to screens your role may open (for example New Quote, Policies, Reports). |

> **Note:** The **Settings** button on the dashboard header has no function in this release. Targets are maintained in Master > Configuration, group *dashboard*.

## Claims Dashboard

![Claims Dashboard](dash-claims)

1. Choose **Dashboard > Claims Dashboard**.
2. Read the cards: **Total Open Claims**, **Claims Overdue** (past the handling SLA of 20 days), **Today's Claims**, **Highest Claims** (line of business with the most claims) and **Max Claims By State**.
3. Use **Recent Claims** to open a claim. The table shows the line, customer, policy, loss and report dates, priority, status and amount.
4. Choose a date range and select **Export Report** to download the claims data as a spreadsheet.

Further down the dashboard: claims trend, claims by province, claims by source and loss ratio by product.

## Underwriting Dashboard

![Underwriting Dashboard (My Workbench)](dash-uw)

The underwriting workbench lists quotations in progress as submissions.

| Section | What it shows |
|---|---|
| Newly received / older submissions | Quotations waiting for action this week and older ones. |
| Avg. cycle time | Average hours from submission to decision. |
| Open alerts | Data-quality alerts: duplicate submissions, missing sums insured or dates, missing line of business or broker. |
| Workload metrics | Work by assignment group. |
| Submissions list | Case ID (quotation number), proposed insured, agent, sum insured (face amount), product, next requirement due, priority and status. High priority is set from ₱ 5,000,000 sum insured (`dashboard.high_sum_insured`). |
| Open tasks | The quotations assigned for follow-up, with their due dates. |

> **Note:** The workbench subtitle reads "Connected Underwriting - Life". BrokerVerse handles non-life business; read it as the underwriting workbench.

## Agent Dashboard and Operations Home

![Agent Dashboard for Ramon Dela Cruz (own book only)](dash-agent)

The Agent Dashboard is the home screen of agents and sales staff. It shows only your own book.

| Item | What it shows |
|---|---|
| **Create Quote** | Starts a new quotation. |
| Total Leads, Total Clients, Policy Sold | Your counts. Select **See More** to open the list. |
| Commission (chart) | Commission by month for the year you choose. |
| Upcoming events | Your follow-ups from the activity monitor. |
| Earned Commission | Commission earned on your policies, net of withholding tax once paid. |
| Collected Premium, Receivables, Gross Premium | Premium on your policies: collected, still due, and total. |

# Leads and prospects

## Purpose

A lead is a prospect who may buy insurance. You record the lead first; the quotation, the client record and the policy all start from it. Each lead gets a number LD-YYYY-NNNNN.

Who uses it: agents, sales and customer services create and follow leads. Underwriters and administrators can see them.

## The lead list

![Operations > Leads/Prospects](lead-list)

Choose **Operations > Leads/Prospects**. The screen shows:

- Cards: **Total Leads**, **Last 7 Days**, **Last 30 Days**, **Converted Leads** (with the conversion rate), **With Quotations** and **Active Leads**.
- Tabs by line of business: **Motor**, **Fire and Allied Perils** and **Industrial All Risks**.
- One card per lead with its number, category, date, number of quotations, e-mail and phone, and the actions **View**, **Edit** and **Delete**.
- Buttons **Bulk Upload**, **Generate Report** and **Create Lead**.

Agents see only the leads they created.

## Create a lead

1. Choose **Operations > Leads/Prospects**.
2. Select **Create Lead**, then choose the line of business: **Motor**, **Fire and Allied Perils**, **Industrial All Risks** or **Employee Benefit**.
3. Under **Select Category**, choose **Retail** (a person) or **Corporate** (a company).
4. Fill in the fields in the table below.
5. Select **Save & Continue**.

![Create Lead: choose the line of business](lead-create-line)

![Create Lead form for a Motor prospect (example values)](lead-create-form)

{widths: 24,46,10,20}
| Field | Meaning | Required | Rules |
|---|---|---|---|
| Category | Retail (individual) or Corporate (company) | Yes | Corporate adds **Company Name** and **TIN**, both required. |
| First Name, Last Name | Name of the prospect or contact person | Yes | |
| Preferred Name | Name used in letters and e-mails | Yes | |
| Date of Birth | Date of birth of the prospect | Yes | DD/MM/YYYY; not in the future; age between 18 and 100 (`leads.min_age_years`, `leads.max_age_years`). |
| Gender | Male or Female | Yes | |
| Email ID | E-mail address; quotations and approval links are sent here | Yes | Must be a valid e-mail address. |
| Contact Number | Mobile number | Yes | Philippine mobile: 0917 123 4567, +63 917 123 4567 or 9171234567; stored as 09171234567. |
| Country, Province, City | Address; lists come from the location masters | Yes | Choose the country first, then the province, then the city. |
| ZIP Code | Postal code | Yes | 4 digits. |
| Barangay / Subd | Barangay or subdivision | Yes | |
| House No / Unit No / Street | Street address | Yes | |

The system gives the lead its number, sets its status to **New** and adds it to your lead count on the Agent Dashboard. Fire and IAR leads also ask for the risk location (with latitude and longitude) and the sums insured.

> **Tip:** If a field is wrong, the message appears under it in red, for example *Invalid mobile number (e.g. 0917 123 4567 or +63 917 123 4567)*. Correct it and select **Save & Continue** again.

## View, edit or delete a lead

![Lead Details with Create Quote, Edit and Delete](lead-detail)

1. On the lead card, select **View**. The **Lead Details** page shows personal, contact, address and system information and the number of quotations.
2. To change the lead, select **Edit**, correct the fields, then select **Update**.
3. To start a quotation for this lead, select **Create Quote** (see Chapter 6).
4. To remove a lead that was entered by mistake, select **Delete**. Leads with quotations should be kept.

## Lead statuses

| Status | Set when |
|---|---|
| New | The lead is created. |
| Contacted, Qualified | The lead is followed up. |
| QuoteGenerated | A quotation is saved for the lead. |
| Converted | A quotation of the lead becomes a policy; the lead becomes a client. |
| Lost | The prospect does not buy. |

## Lead report and bulk upload

![Generate Report dialog on the lead list](lead-report)

1. Select **Generate Report**.
2. In **Select Report Category**, choose a category or keep **All Categories**.
3. Select **Generate & Download**. The lead report downloads as a spreadsheet.

To load many leads at once:

1. Select **Bulk Upload**.
2. Select **Download Template** and fill in one lead per row in the Excel file.
3. Select the completed file (.xlsx or .csv, at most 10 MB). The system processes it and adds the leads.

# Clients

## Purpose

A client is a person or company that holds, or has held, a policy. The system creates the client, with a client code CL-YYYY-NNNNN, when a quotation is converted into a policy. The client record is the "360 view": policies, claims, renewals and endorsements in one place.

Who uses it: agents (own clients only), sales, customer services, claims officers, underwriters and administrators.

## Find a client

![Operations > Clients](client-list)

1. Choose **Operations > Clients**.
2. Use the tabs **All**, **Retail** or **Corporate**, or type a name in the search box.
3. The list shows the name and client code, category, date, number of policies and status (Active or Expired).
4. Select the arrow at the end of the row to open the client.

## The client 360 view

![Client view with the Policy, Claim, Renewal and Endorsement tabs](client-view)

| Tab | What you see and do |
|---|---|
| Policy | The client's policies with premium, dates, product and payment status. Open a policy, or use the row actions for a claim or an endorsement. |
| Claim | The client's claims with status. |
| Renewal | Renewals due and quoted. |
| Endorsement | The client's endorsements with their status and payment status. |

To correct a client's name, address or contact details on an issued policy, use a **Personal Details Change** endorsement (Chapter 8). The change is then recorded against the policy and sent to the insurer.


# Quotation

## Purpose

A quotation prices the cover a prospect asks for, with one insurer. It shows the net premium, the taxes, CTPL, the gross premium, the broker's commission and the referrer's share. The client accepts it online; the accepted quotation becomes the policy. Each quotation gets a number QT-YYYY-NNNNN and stays valid for 30 days (`limits.quote_validity_days`).

Who uses it: agents, sales and customer services prepare quotations; underwriters are notified and review them; the client accepts them.

## The quotation list

![Operations > Quotation](quote-list)

Choose **Operations > Quotation**. The cards count quotations by status (Converted to Policy, Draft, Approved, Customer Accepted, Rejected, Pending Customer, Submitted to Insurer) and show the average premium. The table lists each quotation with its lead, policy type, gross premium, date and status. Use the pencil to edit a draft and the eye to open the quotation.

## Quotation statuses

| Status | Meaning | Next step |
|---|---|---|
| Draft | Saved, not yet sent. You can still edit it. | Send for Customer Approval |
| Pending Customer | The approval link has been e-mailed to the client. Underwriting is notified. | The client accepts, or you return it to Draft |
| Customer Accepted | The client accepted the quotation through the link. | Proceed to Policy |
| Submitted to Insurer | The quotation was sent to the insurer for its terms. | Approved or Rejected |
| Approved | Approved by a user other than the creator. | Proceed to Policy |
| Rejected, Dropped | Not taken up. Can be reopened as Draft. | – |
| Expired | Not converted within its validity (the Quotation expiry job runs every night at 00:30). | Reopen as Draft |
| Converted to Policy | The policy has been issued. The quotation can no longer be edited. | – |

## Create a motor quotation

A motor quotation has five steps. Nothing is saved until you select **Completed Quote** on the last step, so you can go back and forth with **Back** and **Next**.

1. Open the lead (**Operations > Leads/Prospects > View**) and select **Create Quote**.
2. Fill in **Policy Details** and **Insurance Vehicle Details**, then select **Next**.
3. Review the **Plan Recommendations**, then select **Next**.
4. Fill in **Coverage Details**, select **Calculate**, check the premium, then select **Next**.
5. Fill in **Accessories** and policy limits, then select **Next**.
6. Check the **Order Summary**, set the discount, the referrer and the signatory, then select **Completed Quote**.

The system saves the quotation as **Draft**, gives it its QT number, sets the lead to *QuoteGenerated* and opens the quotation.

### Step 1: Policy details and vehicle

![Create Quote, step 1: policy and vehicle details (example values)](quote-1-policy-details)

{widths: 24,46,10,20}
| Field | Meaning | Required | Rules |
|---|---|---|---|
| Co-Insurance | Tick when more than one insurer shares the risk. A table appears for the co-insurers and their shares. | No | Shares must add up to 100%. |
| Insurance Company Name | The insurer that will issue the policy (Insurance Company master). | Yes | |
| Insurance Policy Type | Comprehensive, Own Damage / Theft or Third Party Liability. | Yes | |
| Account Code | The agent or referrer credited with the business. The commission share is paid to this referrer. | No | Active referrers only. |
| Payment Type | Cash or Credit. | Yes | |
| Vehicle Type | Insurance Commission vehicle class. Decides the CTPL tariff, the default seats and the own damage rate. | Yes | Classes come from the motor tariff in the Product Configurator. |
| Vehicle Brand, Vehicle Model, Model Variant | From the vehicle master. The model list follows the brand; the variant list follows the model. | Yes | |
| Model Year | Year of manufacture. | Yes | The last 20 years up to next year (`quote.model_year_span`). |
| Vehicle Color | Colour of the vehicle. | Yes | List from `quote.vehicle_colours`. |
| Seating Capacity | Seats including the driver. Filled from the variant or the class default. | Yes | Whole number from 1 to 99. Used for Auto Passenger PA. |

### Step 2: Plan recommendations

![Create Quote, step 2: plan recommendations](quote-2-recommendation)

The system shows three tiers for the chosen insurer: **CTPL**, **Basic** and **Comprehensive**. One tier is marked **RECOMMENDED**. The recommendation follows fixed rules on the vehicle class and policy type (for example, motorcycles get CTPL, public utility vehicles get Comprehensive). Select a plan or keep the recommended one, then select **Next**.

> **Note:** The deductible and "estimated monthly" amounts on the plan cards are indicative only. The premium is calculated on the next step.

### Step 3: Coverage details

![Create Quote, step 3: coverage details after Calculate](quote-3-coverage)

{widths: 26,50,24}
| Field | Meaning | Rules |
|---|---|---|
| Own Damage coverage | Sum insured for loss and damage to the vehicle (its market value). | Amount in pesos. |
| Own Damage coverage Rate | Rate in percent. Proposed from the motor tariff for the vehicle class. | Private cars 2%. |
| Own Damage coverage premium | Sum insured × rate. | Calculated. |
| Include CTPL | Adds Compulsory Third Party Liability at the Insurance Commission tariff for the vehicle class. | Read-only amount, inclusive of taxes and fees. |
| Brand-new vehicle: 3-year CTPL | For a brand-new vehicle registered for 3 years with LTO. Replaces the 1-year CTPL amount. | Offered only for classes with a 3-year tariff (private cars ₱ 1,660.40). |
| Include Acts of Nature Coverage | Adds acts of nature (typhoon, flood, earthquake) at the rate you enter. | Optional. |
| Include Roadside Assistance, Include Personal Accident Cover | Optional covers with their own rate and premium. | Optional. |
| Bodily Injury, Property Damage | Excess third-party liability limits (₱ 100,000 to ₱ 500,000) and their premiums. | Choose from the list. |
| Auto Passenger PA - limit per person | Personal accident limit for each person in the vehicle. | ₱ 25,000 to ₱ 200,000. |
| Seats covered | Driver and passengers, from Seating Capacity. | Read-only. |
| APPA Total Coverage, APPA Coverage Premium | Limit × seats, and total × 0.1%. | Read-only. Example: 50,000 × 5 = 250,000; premium 250.00. |
| Total Sum Insured | Own damage + bodily injury + property damage + APPA total. | Calculated. |
| Total Gross Premium | Net premium + VAT + DST + LGT + CTPL. | Calculated. |

Select **Calculate** after every change. **Override** lets you type a cover premium by hand, for example the own damage premium the insurer quoted. CTPL and Auto Passenger PA are always priced by the system.

CTPL tariff by vehicle class (annual, inclusive of taxes and fees):

{widths: 52,16,16,16}
| Vehicle class | CTPL 1 year (₱) | CTPL 3 years (₱) | Default seats |
|---|---|---|---|
| Private cars (including jeeps, AUVs and SUVs) | 610.40 | 1,660.40 | 5 |
| Light / medium trucks (own goods) not over 3,930 kg | 660.40 | – | 3 |
| Heavy trucks (own goods) and private buses over 3,930 kg | 1,250.40 | – | 3 |
| AC and tourist cars | 790.40 | – | 5 |
| Taxi, PUJ and mini bus | 1,150.40 | – | 5 |
| PUB and tourist bus | 1,500.40 | – | 50 |
| Motorcycles / tricycles / trailers | 300.40 | – | 2 |

The tariff is maintained in **Product Configurator > Product Templates > MOT-003-2025 > CTPL & Auto PA** (Chapter 17).

### Step 4: Accessories and policy limits

![Create Quote, step 4: accessories and policy limits](quote-4-accessories)

Enter the declared value of accessories that are to be covered (**Aircon**, **Stereo**, **Mag wheels**, **Others**) and the policy limits: **Deductible**, **Towing** and **Repair Limit**. These values are recorded on the quotation. Leave a field empty if it does not apply.

### Step 5: Order summary, discount and commission

![Create Quote, step 5: order summary with commission and referral](quote-5-order-summary)

The order summary shows the premium the client pays:

| Line | How it is calculated |
|---|---|
| NET Premium | Sum of the cover premiums, without CTPL. |
| Value Added Tax | 12% of the net premium. |
| Documentary Stamp Tax | 12.5% of the net premium. |
| Local Gov't Tax | 0.75% of the net premium. |
| Others (Acc. premium) | Accessory premium, if any. |
| CTPL | Tariff amount, not taxed again and not discounted. |
| Discount | The discount you give the client. |
| Total Premium (Gross Premium) | Net + taxes + others + CTPL − discount. |

Example (QT-2026-00007): net 22,250.00 + VAT 2,670.00 + DST 2,781.25 + LGT 166.88 + CTPL 610.40 = gross ₱ 28,478.53.

To finish the order summary:

1. Optional: set **Discount (Optional)** with **−** and **+** (0% to 30%). The discount comes out of the broker's commission, not the referrer's share.
2. Under **COMMISSION & REFERRAL**, choose the primary referrer in the list, or keep **Direct — broker's own lead**. Choose the referrer level (L1 or L2). The comsub rate fills in from the commission rule (L1 8%, L2 5%) and you can adjust it.
3. Optional: select **+ Add referrer (chain)** to add a second referrer who shares the commission.
4. Check the four boxes: **BROKERAGE** (the broker's income from the insurer, for example 18% of net), **COMSUB (GROSS)** (payable to the referrers), **DISCOUNT** and **MARGIN** (brokerage − comsub − discount).
5. Choose the **Authorized Signature** (from the Signatories master).
6. Select **Completed Quote**.

Withholding tax on the comsub is deducted when the commission is paid, at the referrer's rate (individual agents 5%). In the example the comsub of 1,780.00 gives a net payable of 1,691.00 after 89.00 withholding tax.

> **Important:** The server calculates the premium again from the covers, the rates and the configured taxes when the quotation is saved. The amounts on the saved quotation are the ones that count.

## Send the quotation to the client

![Quotation detail of a draft, with Share and Send for Customer Approval](quote-detail-draft)

1. Open the quotation (**Operations > Quotation**, eye icon).
2. Check the policy, assured, vehicle, coverage and payment details.
3. Select **Send for Customer Approval**.

The system e-mails the client a secure approval link, valid for 7 days (`quotations.approval_link_ttl_hours`), sets the status to **Pending Customer** and notifies the underwriters (`quotations.approval_notify_roles`). The lead must have an e-mail address.

To send the quotation by other means, select **Share**:

![Share Quote: download, e-mail, WhatsApp, send to insurer or copy the link](quote-share)

| Option | What it does |
|---|---|
| Download | Saves the quotation as a document. |
| Email | Opens an e-mail with the quotation for any recipient. |
| WhatsApp | Opens WhatsApp with the quotation link. |
| Send to Insurer | E-mails the quotation to the insurers you choose (placement e-mail from the Insurance Company master). |
| Copy Link | Copies the link of the quotation. |

## The client accepts the quotation

The client opens the link in the e-mail. No sign-in is needed. The page shows the quotation, customer, vehicle, coverage and premium breakdown. The client selects **Approve Quote**.

![The public approval page seen by the client](quote-approval-page)

The status becomes **Customer Accepted** and you receive a notification. The quotation detail now shows **Proceed to Policy**.

## Quotation audit trail

Open the quotation and select the **Audit Trail** tab to see every change with the date, the field, the previous and the new value, and the user.

![Quotation audit trail](quote-audit)

## Tips and common errors

- *The lead has no e-mail address; add one before sending the quotation*: edit the lead, add the e-mail, then send again.
- *Only Draft quotations can be sent for approval*: the quotation was already sent. Wait for the client or reopen it as Draft.
- *A ConvertedToPolicy quotation cannot be edited*: create an endorsement on the policy instead.
- CTPL shows "-": choose the **Vehicle Type** on step 1.
- The premium on the saved quotation differs from what you typed: the server priced it with the configured rates. Check the rates with the Business Administrator.

# Policy issuance and servicing

## Purpose

When the client accepts the quotation, you convert it into a policy. You record the client's identity (KYC), the vehicle identifiers and photos, choose how the premium is billed, upload the insurer's policy and record how the client pays. The system then issues the policy number POL-YYYY-NNNNN, creates the client (CL-), bills the premium and accrues the commission.

Who uses it: agents, sales and underwriters convert quotations; customer services and claims officers view policies; finance verifies payments.

## Convert a quotation into a policy

1. Open the accepted quotation and select **Proceed to Policy**.
2. Complete **Customer Information** and select **Next**.
3. Upload the five vehicle photos and select **Next**.
4. Review the details, choose the **Billing** mode and select **Send to Insurance Company**. The policy is issued.
5. On **Upload Policy**, check the dates, upload the insurer's policy document and choose **Pay Later** or **Proceed to payment**.
6. If the client has paid, record the payment (see *Record the client's payment*).

### Customer information (KYC)

![Convert Policy: customer information and vehicle identifiers](policy-1-customer-info)

{widths: 26,44,10,20}
| Field | Meaning | Required | Rules |
|---|---|---|---|
| Insured Name | From the lead. | – | Read-only. |
| ID Type | Government ID presented by the client. | Yes | PhilSys ID, UMID, Passport, Driver's License, PRC ID, SSS ID, GSIS ID, TIN ID, Postal ID, Voter's ID, Senior Citizen ID. |
| ID Card Number | Number printed on the ID. | Yes | |
| ID Card | Photo or scan of the ID. | Yes | Image or PDF; uploads as soon as you choose it. |
| Email, Contact Number | From the lead. | – | |
| Vehicle Brand, Model, Year, Color | From the quotation. | – | |
| Motor Number | Engine number from the OR/CR. | Yes | |
| Chassis Number | Chassis / VIN from the OR/CR. | Yes | |
| Plate Number (or MV file no.) | Plate number. | Yes | Or give the MV File Number if the vehicle has no plate yet. |
| MV File Number (if no plate yet) | LTO MV file number. | When no plate | |
| Mortgage | Mortgagee bank, if the vehicle is financed. | No | |
| Cert Number, Authen Code | CTPL certificate number and its authentication code. | No | |
| Truck Type, Aluminium, Air Bag, TNVS | Additional vehicle information. | No | TNVS: the vehicle is used for ride-hailing. |

The required fields come from `policy.kyc_required_fields`. The server refuses to issue a motor policy without them.

### Vehicle photos

![Convert Policy: vehicle photos](policy-2-vehicle-photos)

Upload a photo of the left side, right side, front, rear and interior (dashboard). Each file uploads as soon as you choose it; a tick shows **Photo uploaded successfully**. Select **Remove** to replace a wrong photo.

### Review and billing mode

![Coverage Details Review with the billing mode](policy-3-review-billing)

The review page repeats the policy, assured, vehicle, photos, coverage and premium details. At the bottom, choose the **Billing** mode:

| Billing mode | Meaning | What the system does |
|---|---|---|
| Broker billed (default) | The client pays the premium to the broker, who remits it to the insurer net of commission. | Premium bill INV- with its journal (Dr premium receivable / Cr premium payable to insurer and commission income) and a collection item. |
| Direct bill | The client pays the premium to the insurer. The broker bills its commission to the insurer with a debit note. | No premium bill. Journal Dr commission receivable – insurers / Cr commission income and output VAT. The commission appears in Direct Bill Processing. |

Select **Send to Insurance Company**. The system issues the policy number, creates the client from the lead, sets the quotation to *Converted to Policy*, accrues the referrer's commission (status *Accrued*), e-mails the client that the policy was issued, and updates the dashboards and the Production Register.

### Upload the insurer's policy

![Upload Policy](policy-4-upload-policy)

1. Check **Policy Number**, **Insurance Company**, **Production**, **Inception**, **Issued Date** and **Expiry** (DD/MM/YYYY). The default term is 12 months.
2. Under **Upload Policy Document**, select **Choose Files** and choose the insurer's policy (PDF, PNG, JPG or JPEG, at most 10 MB).
3. Select **Pay Later** if the client has not paid yet, or **Proceed to payment** to record the payment now.

## Record the client's payment

Only finance posts official receipts. Everyone else records how the client paid, and finance verifies it.

![Payment Confirmation: recording a bank transfer (example values)](policy-5-payment-capture)

1. Open the policy and select **Proceed to Payment** (or continue from Upload Policy).
2. Under **How does the client pay?**, choose **Pay later**, **Bank transfer**, **Cheque**, **Online payment** or **Cash**.
3. For a payment, fill in the reference (bank or transaction reference, or cheque number and bank), **Amount paid**, **Payment date**, **Remarks** and, if you have it, the proof of payment (deposit slip, cheque image or screenshot).
4. Select **Record payment** (or **Confirm pay later**).

With **Pay later** nothing is posted and the bill stays open.

The payment is saved as a capture waiting for verification; the policy payment status becomes **Reviewing** and finance receives the notification *Premium payment to verify*. The bill stays open until finance confirms.

### Finance: verify a captured payment

1. Open the notification *Premium payment to verify*, or open the policy and select **Proceed to Payment**.
2. Check the reference, amount and date against the bank statement.
3. Select **Confirm**. The system posts the official receipt OR- (Dr cash in bank / Cr premium receivable), marks the bill Paid or Partial and closes the collection item when fully paid.
4. If the money has not arrived, select **Reject** and give the reason, for example *no matching credit in the bank statement*. The bill stays open.

Finance users see the button **Record payment and issue receipt** and can post the receipt directly.

### Direct-bill policies

For a direct-bill policy the payment page shows that the client pays the insurer directly and that the commission (with VAT) is billed to the insurer by finance. There is nothing to record.

![Payment page of a direct-bill policy](policy-6-payment-direct)

## The policy list

![Operations > Policy](policy-list)

Choose **Operations > Policy**. The list shows the policy number, client code and name, gross premium, issue and expiry dates, product and payment status. Use **Search** with the field selector, or **Show Filters** for payment status, dates, insurer, premium and product.

Row actions:

- The arrow opens the policy details.
- The three dots (**...**) open **Claim**, **Endorsement** and **Reminder**. They are disabled while the payment is Pending or Reviewing. **Endorsement** is not offered for expired, lapsed, cancelled or renewed policies.

![Row actions of a policy](policy-row-menu)

## Policy details

![Policy Details (top)](policy-detail)

The policy details page shows:

| Section | Content |
|---|---|
| Header | Policy number, client, expiry and payment status; buttons **Claim** and **View Policy**. |
| Cards | Gross premium, expiry date, client code. |
| Policy Details | Number, payment status, product, issue, expiry, production and inception dates. |
| Insured Details | Client, ID, e-mail, contact number and address. |
| Vehicle Details and Photos | Vehicle, identifiers, mortgage, TNVS and the five photos. |
| Coverage Details | Each cover with its sum insured and premium; total sum insured. |
| Premium Breakdown | Net premium, DST, VAT, LGT, other premium, discount, gross premium. |
| Endorsements | The latest endorsements of the policy. |
| Payment | Payment status; **Proceed to Payment** while premium is due. |
| Documents & Billing | **Generate Policy Invoice**, **Premium Accounting Entries** and the policy document (**Preview**, **Open**). |
| Related Records | Quotation, insurer and account code. |

![Policy Details (coverage and premium)](policy-detail-2)

Select **Premium Accounting Entries** to see every journal line of the policy: new business, payment receipts, commission accrual, remittance and endorsements.

![Premium accounting entries of POL-2026-00001](policy-accounting)

## Policy and payment statuses

| Policy status | Meaning |
|---|---|
| Active | In force. |
| Expired | Past its expiry date (the Policy expiry job runs every night at 00:15). |
| Renewed | Replaced by a new term. |
| Lapsed | Not renewed within the 30-day grace period. |
| Cancelled | Cancelled by endorsement. |

| Payment status | Meaning |
|---|---|
| Pending | Premium due, nothing received. |
| Reviewing | A payment was recorded and is waiting for finance to verify it. |
| Partial | Part of the premium was receipted. |
| Completed | Fully paid. |
| Refunded | Premium returned to the client. |

## Tips and common errors

- *Issuance refused: ID type, ID number, ID image, chassis, motor and plate or MV file number are required*: go back to Customer Information and complete them.
- The **Claim** and **Endorsement** actions are greyed out: the premium is still Pending or Reviewing.
- A payment you recorded does not show as paid: finance has not confirmed it yet.

# Endorsements

## Purpose

An endorsement changes an issued policy: the client's details, the vehicle, the cover, the period, or cancels the policy. The system records the change with a number END-YYYY-NNNNN, sends it to the insurer, and bills any additional premium. A change of cover is priced again with the configured rates.

Who uses it: customer services mainly; agents and sales for their own policies. Finance receipts the additional premium.

## Endorsement types

| Line | Type | What you can change |
|---|---|---|
| Motor | Personal Details Change | Name, preferred name, contact number and address of the insured. |
| Motor | Motor Details Change | Vehicle details and identifiers. |
| Motor | Coverage Change | Own damage sum insured and rate, acts of nature, bodily injury, property damage, Auto Passenger PA limit. The premium is recalculated. |
| Motor | Policy Extend | The policy period. |
| Motor | Policy Cancel | Cancels the policy. |
| Fire and Allied Perils | Regular / Premium Change | Risk, cover or premium (sum insured, address, VAT). |
| Fire and Allied Perils | Policy Cancellation | Full, partial, pro-rata or pro-rata partial cancellation. |

## Raise an endorsement

1. Choose **Operations > Policy** (or open the client and use the **Policy** tab).
2. On the policy row, select **...**, then **Endorsement**.
3. Tick one or more endorsement types. **Proceed** stays disabled until you tick one.
4. Select **Proceed**. The **Endorsement Request** page opens with one section per type you ticked.
5. Enter the changes (see the sections below).
6. Select **Save & Next**. The system saves the endorsement and opens its summary.
7. Check the summary and select **Send to Insurance Company**. Confirm when asked.

![Choosing the endorsement type](end-dialog)

**Endorsement** is offered only for policies in force whose premium is not Pending or Reviewing.

### Personal details change

![Endorsement request: personal details change](end-personal)

Correct the fields that changed: **First name**, **Last name**, **Preferred name**, **Contact number**, **House no. street**, **Barangay subd**, **Country**, **Province**, **City** and **Zip code**. The contact number must be a valid Philippine mobile number and the ZIP code must have 4 digits. When the endorsement is completed, the client record is updated.

### Coverage change

![Endorsement request: coverage change re-priced](end-coverage)

1. Change the cover, for example **Own damage coverage** from 1,200,000 to 1,400,000, or a higher **Auto passenger personal accident** limit.
2. The premium boxes recalculate: net premium, VAT (12%), DST (12.5%), LGT (0.75%), gross premium and **Premium change**.
3. CTPL stays as issued (**CTPL premium (as issued)**).

Example: END-2026-00003 raised own damage on POL-2026-00001 to 1,400,000. The gross premium became 40,086.27 and the premium change was +5,010.00. The system billed it as INV-2026-00002 (journal Dr premium receivable 5,010.00 / Cr payable to insurer 4,410.00 and commission income 600.00) and added a collection item. The server checks the premium change against its own calculation.

## After sending to the insurer

1. The endorsement waits for the insurer (**Waiting for Update**).
2. When the insurer has issued its endorsement, select **Proceed** and upload the insurer's endorsement document with the endorsement number and dates. Select **Complete**.
3. The system applies the change to the policy and the client, and notifies the policy owner.
4. If there is additional premium, the endorsement view shows *Additional premium is due: proceed to payment*. Select **Proceed to payment** and record the client's payment as for a policy (Chapter 7). A return premium is refunded by finance with a client refund voucher.

![A completed endorsement with additional premium due](end-view)

The client's **Endorsement** tab lists all endorsements with their status and payment status.

![Client view: Endorsement tab](end-client-tab)

## Endorsement statuses

| Status | Meaning |
|---|---|
| Draft | Saved, not yet sent. |
| Pending Customer | Sent to the insurer and the client; waiting for the insurer's endorsement. |
| Completed | The change is applied to the policy. |
| Initiate Cancel / Cancelled | A cancellation in progress / done. |
| Rejected | Refused by the insurer. |

## Tips and common errors

- If the premium did not change, check that you changed a cover that is priced (a sum insured or a limit), then look at **Premium change**.
- Endorsement is not offered on an expired policy. Renew the policy instead (Chapter 10).
- A direct-bill policy's additional premium is billed to the insurer as commission, not to the client.

# Claims

## Purpose

The claims module records a loss under a policy, follows it with the insurer and the adjuster, and settles it. A settlement needs a second claims officer to approve it. Each claim gets a number CLM-YYYY-NNNNN.

Who uses it: claims officers (carlo.claims as maker, lisa.claims2 as checker). Agents can raise a claim notice on their own policies. Reinsurance recoveries are in Chapter 15.

## The claims list

![Operations > Claims](claim-list)

Choose **Operations > Claims**. Each row shows the claim number, client, policy, issue date, product and status. The three icons at the end of the row are:

| Icon | Opens |
|---|---|
| Information | **Claim Details**: all the data of the claim. |
| Eye | The next step for the claim's status: *Waiting for Update* for a Pending or Processing claim, *Waiting for Settlement* for a claim Pending Approval, the documents for a settled claim. |
| History | **Claim Audit Trail**. |

## Claim statuses

| Status | Meaning | Next step |
|---|---|---|
| Pending | Registered; the Preliminary Loss Advice was sent to the insurer. | Proceed when the insurer assigns an adjuster |
| Processing | Adjuster details and documents are being gathered. | Submit the settlement |
| Pending Approval | Settlement submitted; waiting for a second claims officer. | Approve or return |
| Approved | Settlement approved. | Settled automatically (`claims.auto_settle_on_approval`) |
| Settled | Settlement released. | Close |
| Rejected | Refused by the insurer. | – |
| Closed | File closed. | – |

## Register a claim

1. Choose **Operations > Policy**, select **...** on the policy row, then **Claim**. You can also select **Claim** on the policy details page.
2. Check the insurer, policy and policy holder (filled from the policy and the client record).
3. Fill in the **Incident Details** and the driver (see the table).
4. Fill in **Third Party Details (If Applicable)**.
5. Select **Next**, attach the documents, then select **Send**.

![Claim Request](claim-request)

{widths: 26,46,10,18}
| Field | Meaning | Required | Rules |
|---|---|---|---|
| Insurance Company Name | Insurer of the policy. | Yes | From the policy. |
| Date of Incident | Date of loss. | Yes | Not in the future; inside the policy period. |
| Time of Incident | Time of loss. | No | |
| Address of Incident / Loss Location | Where the loss happened. | Yes | |
| City, Province | Place of loss. | No | |
| Type of Incident / Cause of Loss | Collision, theft, fire, flood and so on. | Yes | |
| Estimated Claim Amount | First estimate of the loss. | No | Pesos. |
| Insurance Company Claim Number | The insurer's claim reference, when known. | No | |
| Same as Policy Holder | Tick when the insured was driving; copies the holder's address. | No | |
| Driver's name and address | Person driving at the time of loss. | Name yes | |
| Third Party Details | Name, contact number, plate number, unit, shop and insurer of the other party. | No | |
| Documents | Police report, photos, estimates. | No | PNG, JPEG or PDF, at most 2 MB each. |

The system checks the claim before saving it:

- *Date of loss … is outside the policy period …*: the loss date is before inception or after expiry. The claim is refused.
- The claim is refused while the policy premium is unpaid (`claims.block_unpaid_premium`).

When the claim is registered, the system issues the claim number, sets the status to **Pending**, e-mails the Preliminary Loss Advice to the insurer's claims e-mail (`claims.pla_enabled`) and notifies every claims officer and the policy owner. The Claims Dashboard and the Claims Position report include it at once.

## Follow the claim with the insurer

![Waiting for Update: the claim is with the insurer](claim-waiting)

1. Open the claim with the eye icon. The page shows **Waiting for Update**.
2. Select **Edit** to correct the claim request, or **Proceed** when the insurer has assigned an adjuster.
3. On the adjuster page, enter the **Adjuster Name**, the **Insurance Company Claim Number**, the dates, place of accident, driver and address, third party details and upload the proof of documents (PNG, JPEG or PDF, at most 2 MB).
4. Select **Next**. The status becomes **Processing**.

![Adjuster details](claim-adjuster)

## Settle the claim (maker)

1. Open the claim and continue to **Claim Settlement**.
2. Choose the **Settlement Type** (Cash, Card or Cheque), enter the **Settlement Amount**, the **Issue Date** and the **Settle Date**, and upload the settlement documents (PNG or JPEG, at most 2 MB).
3. Select **Submit**.

![Claim Settlement form](claim-settlement)

The system checks that the type, amount (greater than zero) and dates are given. The claim goes to **Pending Approval**; the message says *A second claims user must approve it before the claim is settled*. The other claims officers are notified.

## Approve the settlement (checker)

1. Open the notification, or choose **Operations > Claims** and select the eye icon of the claim in **Pending Approval**.
2. The page shows **Waiting for Settlement**. Check the claim details and the settlement.
3. Select **Approve Settlement**, or **Return** to send it back to the maker.

![Waiting for Settlement: the checker's view](claim-approval)

The maker cannot approve his or her own settlement; the system refuses it. After approval the claim is **Settled** (example: CLM-2026-00002, estimate 85,000, settled 78,500), the maker is notified and the dashboard and reports are updated.

## Claim details, documents and audit trail

![Claim Details](claim-detail)

**Claim Details** shows the claim, incident, driver, policy, third party and system information, including the insurer's claim number and the claim due date (20 days after reporting, `claims.sla_days`).

For a settled claim the eye icon opens **Claim Settlement** with the documents the system produces: Acknowledgment letter, Claims Discharge Voucher, Claims Data sheet and the FIR (first information report). Select **View** to open each one.

![Claim documents](claim-documents)

![Claim Audit Trail: every status change with the user and time](claim-audit)

# Renewals

## Purpose

Renewals keep the book. The system puts every policy into the renewal pipeline 90 days before expiry, sends renewal notices at 60, 30 and 15 days, prices the renewal and turns the accepted renewal quotation into the next policy term. A policy not renewed within 30 days after expiry lapses.

Who uses it: underwriters and sales work the renewals; agents see their own; the schedules run the notices every day.

| Menu (Operations > Renewals) | Use it to |
|---|---|
| Renewal Policy | See active, expiring (0–5 days) and expired policies and start a renewal. |
| Renewal Batch | Group many policies and send their notices together. |
| Renewal Queue | Work the policies due for renewal: days to expiry, status, risk, agent, attempts. |
| Retention Analytics | Retention figures (see the note below). |
| At-Risk Policies | Policies with a high retention risk score and the recommended actions. |
| Negotiations | Record contacts and updates with the client and request approval of terms. |
| Lapse Management | Lapsed policies and policies in the grace period; win-back campaigns. |
| Performance | Renewal rate, premium retention and cycle time against target. |

## Renewal timetable

| When | What happens | Setting |
|---|---|---|
| 90 days before expiry | The policy enters the renewal pipeline (status Pending). | `renewals.pipeline_days` |
| 60, 30 and 15 days before expiry | First, second and final notice e-mailed to the client; the owner is notified. Notices go out in order. | `limits.renewal_notice_days`, `renewals.enforce_notice_order` |
| Expiry date | The policy becomes Expired (night job at 00:15). | – |
| 30 days after expiry | An unrenewed policy lapses. | `renewals.grace_period_days` |
| Up to 90 days after lapse | A lapsed renewal can be reinstated. | `renewals.reinstatement_days` |

## Renew a policy

1. Choose **Operations > Renewals > Renewal Policy**.
2. On the policy row, select **...**, then **Renewal**.
3. The renewal quotation opens, linked to the expiring policy, the client and the insurer. The covers of the expiring term are filled in and the own damage rate comes from the motor tariff.
4. Check the coverage, select **Calculate**, then **Next**.
5. Check accessories and the order summary (taxes, discount, commission), then select **Completed Quote**. A quotation QT- linked to the policy is saved.
6. Send it for customer approval (Chapter 6). When the client accepts, select **Proceed to Policy** and complete KYC and the vehicle identifiers of the new term (they are taken from the expiring policy when available).

![Renewal Policy: expired and expiring policies](renew-policy)

![Row actions on an expired policy: Claim, Renewal, Reminder](renew-menu)

The system issues the new term (for example POL-2026-00002, 14/09/2026 to 14/09/2027), marks the old policy **Renewed**, bills the premium and accrues the commission to the original referrer.

Renewal terms are maker-checker (`renewals.maker_checker`): the underwriter is notified to approve renewal terms submitted from the renewal workspace.

## Renewal queue and follow-up

![Renewal Queue](renew-queue)

The queue lists the policies due for renewal with days to expiry (red when overdue), premium, renewal status (First Notice Sent, Second Notice Sent, Final Notice Sent, Quote Sent, Pending Approval, Approved, Renewed, Lapsed), risk level and the number of contact attempts. Filter by status, risk level, agent or expiry dates.

![At-Risk Analysis](renew-atrisk)

The risk score adds weights for claims in the term, unpaid premium, expiry within 30 days, a premium increase, no contact yet and a first renewal (`renewals.risk_weights`). Bands: Low from 0, Medium from 30, High from 55, Critical from 75. The recommended actions follow `renewals.risk_actions`, for example *Collect outstanding premium before renewal*.

![Negotiation Workspace](renew-negotiations)

Use **Add Update** to record a call or meeting, **Request Approval** to send renewal terms to the underwriter and **Send Communication** to write to the client.

![Lapse Management](renew-lapse)

![Batch Renewal](renew-batch)

A batch groups up to 500 policies (`renewals.batch_max_policies`). Select **Create Batch**, choose the policies, and send the notices of the whole batch. The batch shows how many were processed.

![Performance Tracking](renew-performance)

> **Known issue:** **Retention Analytics** shows "Something went wrong on this screen" in this release. Use Performance and the Renewal Retention report instead. The "Performance Insights" texts on the Performance screen are fixed examples, not calculated from your data.

# Open items and payments

## Open Items

![Operations > Open Items](open-items)

**Operations > Open Items** is the daily worklist of customer services and finance. It has four boxes, each with a count and the first records:

| Box | Content |
|---|---|
| Expiring Policy | Policies close to expiry. |
| Pending Payments | Policies with premium due. |
| Quote Pending | Quotations waiting for the client. |
| Renewal Request | Renewals due. |

Select **See More** to open the full list of a box, or select a record to open it.

## Payments

![Operations > Payments](payments)

**Operations > Payments** shows gross premium, collected premium, receivables and earned commission, with a list of bills by tab **Paid**, **Pending** and **Reviewing**. The **Type** column tells whether the bill is for a policy, a renewal policy or an endorsement. Receipts are posted by finance; this screen shows the result.


# Accounts: receipts, collections and the ledger

## Purpose

The Accounts menu is where finance collects premium, pays out money and keeps the general ledger. Every screen here posts balanced journals to the chart of accounts, and most payments need a second finance user to approve them.

Who uses it: finance and accounts (liza.finance as maker, fe.approver as checker), business and IT administrators.

| Menu (Accounts) | Use it to |
|---|---|
| Receipts | Post official receipts (OR) against open bills. |
| Collections | Follow outstanding premium by ageing bucket and send reminders. |
| Accounting Query, All Clients Accounting | Search the accounting entries; see each client's debits, credits and balance. |
| Open Entry Matching / Un-Matching | Match open debit and credit entries of a sub account, or undo a match. |
| Disbursement | Payment vouchers (PV) and cheques to insurers, agents, clients and suppliers. |
| Petty Cash | Initiate funds, request, disburse, receive and replenish petty cash. |
| Journal Voucher, Correction JV, Reversal JV | Manual journals, corrections and reversals, with approval. |
| Remittance | Remittances to insurers, settlements and direct-bill debit notes (Chapter 14). |
| Incentive | Incentive calculations, approvals and statements (Chapter 16). |

## Receipts

![Accounts > Receipts](acc-receipts)

The receipts list shows each official receipt with its transaction code, transaction number (RT-), policy, client, customer code, date, amount, paid and unpaid amounts and status. Use **Bulk Print** to print receipts for a customer and date range, and **Bulk Upload** to post many receipts from a spreadsheet (.xlsx or .csv, at most 1,000 rows).

### Post a receipt

1. Choose **Accounts > Receipts** and select **+ Receipt**.
2. Check the **Receipt Date** and keep **Receipt Type** = *Payment* (choose *Refund* for money returned).
3. Choose the **Branch Code** and, if used, the **Department Code**.
4. In **Customer Code**, choose the client. The list shows only clients with open bills, with the amount open.
5. In **Policy Number**, choose the policy. The list shows the number of open bills and the amount.
6. Keep **Currency Code** PHP and **Transaction Code** *OR – Official Receipt*.
7. Choose the **Receipt Mode** and type the **Reference No.** (bank reference, cheque number).
8. In **Open bills for policy …**, select the bill to pay.
9. Enter the **Amount received**, or select **Pay full balance**.
10. Add **Remarks** if needed and select **Record payment**.

![Add Receipts with the open bill of POL-2026-90003 (example values)](acc-receipt-add)

{widths: 24,50,26}
| Field | Meaning | Rules |
|---|---|---|
| Receipt Number | Official receipt number OR-YYYY-NNNNN. | Auto-generated. |
| Receipt Mode | Dollar/Peso, Direct Credit/Transfer to Account, Cheque, Authority to Debit, Telegraphic Transfer, Managers Check/Demand Draft, Credit Ticket-Inter Office, Online Banking. | Required. Decides the cash account debited. |
| Amount received | Money received for the selected bill. | Cannot exceed the bill balance. A smaller amount leaves the rest open. |

What the system does:

- Posts the receipt journal: Dr cash in bank (or cash on hand, e-wallet clearing, by mode) / Cr premium receivable.
- Sets the bill to **Partial** or **Paid** and the policy payment status to *Partial* or *Completed*.
- Closes the collection item when the bill is fully paid.
- Makes the referrer's commission lines eligible for payout when the premium is fully collected.
- Adds the receipt to the Receipts Register, the SOA and the Collection Report.

Example: bill INV-2026-00002 of 5,010.00 was paid with OR-2026-00020 (2,000.00, bill Partial with 3,010.00 open) and OR-2026-00021 (3,010.00, bill Paid). A receipt of 4,000.00 on the 3,010.00 balance was refused.

## Collections and ageing

![Accounts > Collections](acc-collections)

**Accounts > Collections** lists every open premium with the client, policy, outstanding amount spread over the ageing buckets (Current, 1–30, 31–60, 61–90 and over 90 days), due date, status (Pending, Committed, Overdue) and days overdue. Filter by status and overdue level. Select **View** to open the item.

- Premium falls due 30 days after inception (`receivables.due_days`).
- Items due within 7 days show as Current (`collections.current_window_days`).
- Overdue level 1 is up to 30 days, level 2 up to 60 days, level 3 beyond (`collections.overdue_levels`).
- Reminders are e-mailed to clients 7 days before the due date and then every 7 days by the *Collection reminders* job at 08:00. The button at the top of the screen sends the reminders at once.

![Collections Aging Report](acc-ageing)

The **Aging Report** (from Collections) shows the total outstanding, the amount and share per bucket, a chart and the detail by client.

## Accounting query and client accounting

![Accounting Entries Query](acc-query)

Use **Accounting Query** to search the accounting entries by policy, client, entry type, reference type, status, dates or GL code. Select **Search**; **Export** downloads the result as CSV.

![All Clients Accounting Details](acc-all-clients)

**All Clients Accounting** shows, for every client, the number of transactions, total debits, total credits and balance. Open a client to see the entries. **Export CSV** downloads the list.

## Open entry matching

![Open Entry Matching](acc-open-entry)

Open entry matching settles open debit and credit entries of the same sub account against each other, for example a receipt against a bill posted without reference.

1. Choose the **Sub Account Code** and, if needed, division, department, analysis codes and currency.
2. Select **Pull**, or **Pull By Criteria** with **Debit** or **Credit**.
3. Tick the entries to match, check the totals and any adjustment or write-off, then select **Match**.

Use **Open Entry Un-Matching** to undo a match.

## Disbursement: payment vouchers and cheques

![Accounts > Disbursement](acc-disb)

A payment voucher PV-YYYY-NNNNN pays an insurer, an agent or referrer, a client or a supplier. The list shows the voucher, transaction number (DT-), customer code, date, amount and status.

| Status | Meaning |
|---|---|
| Draft | Prepared; amounts may still change. |
| For approval | Waiting for a second finance user. |
| Approved | Approved; the cheque can be printed. |
| Paid | Paid: journal Dr payable / Cr cash posted. |
| Cancelled | Cancelled before payment. |

### Create a voucher

1. Choose **Accounts > Disbursement** and select **+ Create**.
2. Fill in the header (table below) and select **Next**.
3. On the **Invoice List**, tick the payables to pay (premium to remit, commission lines, refunds). The list shows the amount, balance, comsub, VAT and WHT. Select **Next**.
4. On the bank page, choose the bank account and cheque book; the total is filled from the selected lines. Save the voucher; it goes for approval.

![Create Disbursement](acc-disb-create)

{widths: 24,52,24}
| Field | Meaning | Rules |
|---|---|---|
| Disbursement Date | Date of the voucher. | Default today. |
| Department Code, Branch Code | Cost centre. | Required. |
| Payee Type | Customer, Insurer, Agent/Referrer or Supplier. | Decides the payable account settled (for example Insurer → 2201001 Premiums payable). |
| Criteria | *Specific* (chosen lines) or *Payall* (every open line of the payee). | Required. |
| Customer Code, Customer Name | The payee. | Optional for an agent payout. |
| Policy Number | Restricts the lines to one policy. | Optional. |
| Transaction Type, Payment Description, Payment Currency, Payment Notes | Description of the payment. | Currency PHP. |

### Approve and pay (checker)

1. The checker opens the voucher (**Accounts > Disbursement**, eye icon, or the notification).
2. The checker reviews the **Cheque book details** and approves the cheque. The system posts the payment journal (for example Dr premium payable / Cr cash in bank).
3. Select **Print** for the approved cheque. The voucher becomes **Paid**.

![Disbursement Details of the insurer voucher PV-2026-00023 with its printed cheque](acc-disb-detail)

The maker cannot approve his or her own voucher or cheque (`finance.maker_checker_enabled`). The message explains the refusal.

**Bulk Disburse** creates one payout voucher, for approval, per selected referrer with approved commission lines.

## Petty cash

![Petty Cash Request](acc-pettycash)

| Screen (Accounts > Petty Cash) | Use it to |
|---|---|
| Initiate | Open a petty cash fund (code, size, maximum per transaction, branch, department). |
| Request | Record a request for petty cash (requester, date, lines, total). |
| Disbursement | Pay out an approved request from the fund. |
| Receipts | Record money returned to the fund. |
| Replenish | Top the fund back up from the bank. |

The funds are defined in **Master > Finance > Petty cash** (for example Head Office petty cash of ₱ 50,000 with a ₱ 10,000 minimum). The custodian is notified when a fund drops below its minimum. Requests are maker-checker.

![Petty Cash Initiate](acc-pettycash-init)

## Journal vouchers

![Accounts > Journal Voucher](acc-jv)

The journal voucher list shows the transaction code, number (JV-), date, description and status (Draft, Awaiting approval, Posted, Rejected).

### Enter a journal voucher (maker)

1. Choose **Accounts > Journal Voucher** and select **+ Voucher**.
2. Choose the **Transaction Code** (JV, CM credit memo, DM debit memo, …), type the **Transaction Description** (the narration) and check the **Date**.
3. Select **Add Data**. Choose the **Main Account**, the **Sub Account** if the account has sub accounts, the **Entry Type** (Debit or Credit), branch, department, currency and **Amount**. Save the line.
4. Repeat for every line. **Total Debit** must equal **Total credit**; **Net** must be 0.
5. Select **Submit for approval**.

![Add Journal Voucher](acc-jv-add)

![Add Journal Voucher: entering a line](acc-jv-line)

The system refuses an unbalanced voucher with the difference, for example *debit 25000 vs credit 24000*. Finance approvers are notified.

### Approve a journal voucher (checker)

1. Open the notification *Journal voucher … awaiting approval*, or open the voucher from the list.
2. Check the lines and totals.
3. Approve the voucher. It is posted and appears in the Journal Register and the trial balance. Or reject it with a reason; the maker is notified.

![Journal Voucher Details of JV-2026-00117 (office rent)](acc-jv-detail)

Example: JV-2026-00117 *October 2026 office rent, Makati*: Dr 4402001 Rent Expense 85,000 / Cr 1102001 Cash in Bank – BDO operating account 85,000, submitted by liza.finance and posted by fe.approver.

### Correction and reversal

![Correction JV](acc-correction)

- **Correction JV**: choose the transaction code and number of a posted voucher, enter the correction code and description, select **Next** and enter the corrected lines. The system reverses the original and posts the corrected entries after approval.
- **Reversal JV**: choose the posted voucher and a reversal code and description. The system posts the opposite entries after approval.

## Trial balance

Run the trial balance from **Reports > Financial Reports > Trail Balance** (Chapter 19). It lists, per account, the opening balance, the period debits and credits and the closing balance, grouped by account type and statement group. Only approved and posted journals are counted (`reports.trial_balance_statuses`). Total debits always equal total credits.

# Commission

## Purpose

The broker earns brokerage commission from the insurer on every policy. Part of it, the *comsub*, is paid to the agent or referrer who brought the business. BrokerVerse accrues the commission at policy issue, makes it payable when the premium is collected, and pays it by voucher less withholding tax.

Who uses it: finance runs the payouts; agents and sales follow their commission on the Commission Dashboard; administrators maintain the rates (Master > Generals > Commission).

## Commission line lifecycle

| Status | Set when | Who |
|---|---|---|
| Accrued | The policy is issued (or an endorsement adds premium). | System |
| Eligible | The premium is fully collected (`commission.auto_eligible_on_full_payment`), or finance marks it. | System / finance |
| Approved | A finance user approves the line; the comsub accrual is posted (Dr commission expense / Cr commission payable). | Finance, not the maker |
| Paid | The payout voucher is approved; Dr commission payable / Cr cash / Cr withholding tax payable. | Finance checker |
| Reversed | The line is reversed; a clawback journal is posted if it was already paid. | Finance |

Only agents and sales users earn commission on the policies they produce (`commission.eligible_roles`). A referrer needs a bank account on file before commission can be approved or paid (`commission.require_bank_account`).

## Commission Dashboard

![Commission > Commission Dashboard](comm-dashboard)

The dashboard shows brokerage income, comsub (gross), net margin and margin %, the outstanding payable and the WHT withheld. Below: comsub by referrer, lines by status, the monthly trend of income, payable and margin, comsub by product and brokerage income by insurer. Switch between the **Accounting** and **Management** views at the top right.

## Agents / referrer accounts

![Commission > Agents/Referrer Accounts](comm-referrers)

The list shows every referrer with type (Agent, Sub-agent, External), level (L1, L2), number of policies, net payable, WHT type and bank account. The header shows the amount due this cycle and the amount ready to pay.

### Pay commission to a referrer

1. Choose **Commission > Agents/Referrer Accounts** and select the referrer.
2. Check **Apply WHT**: ticked when withholding tax applies (individual agents 5%, companies 10%, `commission.wht_rate_by_type`).
3. Under **Current cycle**, check the eligible lines: policy, product and insurer, comsub and rate, WHT and net.
4. Select **Approve**. Another finance user must approve if you prepared the lines.
5. Select **Generate payout**. The system creates a draft payout voucher with the approved lines and opens it in Disbursement.
6. Complete the bank details; the total is the net of the selected lines. Submit the voucher.
7. A second finance user approves the payout. The lines become **Paid**.

![Referrer account of Ramon Dela Cruz](comm-referrer)

Example: POL-2026-00001: comsub 4,200.75, WHT 5% 210.04, net paid 3,990.71 by PV-2026-00022.

Future cycles (Accrued, not yet payable) and the paid history are listed below the current cycle. **Mark eligible** makes accrued lines eligible when their premium is collected. Select a line to override its comsub rate before approval.

> **Important:** The warning *… has no bank account on file* blocks approval and payout. Add the bank name and account number to the referrer first.

# Remittance and direct bill

## Purpose

The Remittance menu pays the insurers. For broker-billed policies, finance remits the collected premium, net of the broker's commission, to each insurer. For direct-bill policies, where the client paid the insurer, finance bills the broker's commission to the insurer with a debit note and records the insurer's payment.

Who uses it: finance (maker and checker).

| Menu (Accounts > Remittance) | Use it to |
|---|---|
| Automated Processing | Generate draft remittances per insurer from the collected, unremitted premium. |
| Tracking | Follow every remittance and submit drafts for approval. |
| Statements | Generate remittance statements for insurers. |
| Settlement | Settle approved remittances with an insurer; raises the insurer payment voucher. |
| Reconciliation | Match bank transactions with remittances. |
| Bulk Processing | Upload remittance files. |
| Scheduling | Scheduled remittance runs. |
| Electronic Transfer | InstaPay, PESONet, RTGS and wire transfers with limits. |
| Approval Workflow | Approve or reject remittances, settlements, transfers and adjustments. |
| Exception Management | Amount mismatches, duplicates, missing documents. |
| Agency Bill Processing | Bill agencies for the premium they collected. |
| Direct Bill Processing | Commission debit notes to insurers for direct-bill policies. |
| Adjustments, Notifications, History, Analytics | Adjustments with approval, messages, audit history and KPIs. |

## Remit premium to an insurer

1. **Automated Processing**: tick the insurers that are *Ready* (collected premium not yet remitted, above the minimum), select **Validate**, then **Process Selected**. Draft remittances REM- are created. You can also create remittances with Agency Bill Processing.
2. **Tracking**: find the draft remittance and select **Process**. It goes for approval in a batch BLK-.
3. **Approval Workflow**: a second finance user approves it. The approval level depends on the amount (level 1 up to ₱ 100,000, level 2 up to ₱ 1,000,000, level 3 above). The initiator cannot approve.
4. **Settlement**: choose the **Insurer code**, select **Add policies** to pick the lines of approved remittances, select **Calculate** (premium − commission − tax ± adjustments = net settlement) and **Submit for approval**.
5. The checker approves the settlement (SET-). The system raises the insurer payment voucher for the net amount in Disbursement.
6. In Disbursement, issue the cheque; the checker approves it (journal Dr premium payable / Cr cash) and you print it. The voucher becomes Paid and the remittance Completed.

![Automated processing](rem-automated)

![Remittance Tracking](rem-tracking)

![Approval workflow: pending approvals with SLA and level](rem-approval)

![Insurer settlement](rem-settlement)

Example: REM-2026-00018 to MAPFRE: gross 35,076.27, commission 4,200.75, net 30,875.52; settlement SET-2026-00002; voucher PV-2026-00023 paid by cheque.

| Remittance status | Meaning |
|---|---|
| Draft | Created, not submitted. |
| Pending Approval | Submitted, waiting for the checker. |
| Approved | Approved; ready for settlement. |
| Completed | Settled and paid to the insurer. |
| Rejected, Cancelled | Refused or withdrawn. |

The approval queue shows an SLA per priority: urgent 4 hours (from ₱ 1,000,000), high 12 hours (from ₱ 250,000), normal 24 hours (from ₱ 20,000), low 48 hours (`remittance.priority_sla_hours`).

## Direct bill processing

![Direct Bill Processing: raise a debit note](rem-db-raise)

The cards at the top show the unbilled commission, the billed and outstanding amount, the overdue amount and the total receivable from insurers.

### Raise a commission debit note (maker)

1. Choose **Accounts > Remittance > Direct Bill Processing**, tab **1. Raise Debit Note**.
2. Choose the **Insurer**, the **Issued from** and **Issued to** dates and, if needed, the **Line of business**. Select **Load policies**.
3. The list shows each unbilled direct-bill policy (or endorsement) with insured, product, gross premium (paid to the insurer), commission rate, commission, VAT, total due, EWT and the journal it was booked in. Tick the policies to bill.
4. Check the totals: commission, output VAT (12%), total due from the insurer, tax withheld (EWT 10% of commission) and net cash expected.
5. Check the **Debit note date**; the **Due date** is 30 days later (`direct_bill.debit_note_due_days`).
6. Select **Raise debit note and submit for approval** (or **Save draft**).

The system numbers the debit note DN-YYYY-NNNNN and sends it for approval.

### Approve and send (checker)

1. Open tab **2. Debit Notes** and filter by status *Pending Approval*.
2. Open the debit note and approve it, or reject it with a reason (its commission becomes unbilled again). The maker cannot approve it.
3. **Print** the approved debit note (broker letterhead, title *Commission Debit Note*) and e-mail it to the insurer. The e-mail asks the insurer to pay net of EWT and to send BIR Form 2307.

![Debit notes: DN-2026-00001 collected](rem-db-notes)

### Record the insurer's payment

1. On tab **2. Debit Notes**, open the debit note and choose **Collections**.
2. Enter the date, the **Cash** received, the **Tax withheld (EWT)**, the **Payment mode** and the **Reference (bank / cheque)**. Partial payments are allowed.
3. Select **Post collection**.

The system posts Dr cash in bank and Dr creditable withholding tax 1302001 / Cr commission receivable – insurers 1203001, numbers the collection DNC-, and sets the debit note to **Partially Collected** or **Collected**. A collection entered by mistake can be reversed.

| Debit note status | Meaning |
|---|---|
| Draft | Saved, not submitted. |
| Pending Approval | Waiting for the checker. |
| Open | Approved and sent; nothing collected yet. |
| Partially Collected | Part of the total due received. |
| Collected | Fully received (cash + EWT = total due). |
| Rejected, Cancelled | Refused or withdrawn. |

**Commission receivable ageing** downloads the Commission Receivable – Direct Bill report.

### Change the billing mode of a policy

![Direct Bill Processing: billing mode](rem-db-mode)

1. Open tab **3. Billing Mode**.
2. Type the **Policy number**, choose **Direct bill** or **Broker billed** and give the **Reason**.
3. Select **Change billing mode**.

Switching to direct bill cancels the premium bill, reverses its booking and books the commission due from the insurer. The change is refused once premium was collected or remitted, or once the commission is on a debit note.

## Other remittance screens

![Remittance history audit trail](rem-history)

![Electronic transfer management](rem-eft)

Electronic transfers have limits per method: InstaPay up to ₱ 50,000, PESONet up to ₱ 10,000,000, and RTGS and wire for larger amounts (`remittance.transfer_methods`).

![Remittance Reconciliation](rem-reconciliation)

Reconciliation matches imported bank transactions (BNK-) with system transactions, exactly or within ₱ 0.50 (`remittance.reconciliation_tolerance`). Select **Auto Match**, or tick one of each and select **Match Selected**.

![Remittance exceptions](rem-exceptions)

![Generate Remittance Statement](rem-statements)

![Agency bill processing](rem-agencybill)

![Remittance analytics](rem-analytics)

# Reinsurance

## Purpose

The reinsurance screens record the treaties that protect large risks, the cessions made under them, the recoveries on claims and the reconciliation of reinsurer statements.

Who uses it: underwriters (all screens), claims officers (Claims Recovery), finance (Reconciliation), business administrators (treaty master).

| Menu | Use it to |
|---|---|
| Master > Reinsurance Treaty | Add and maintain treaties: quota share, surplus, excess of loss, stop loss; reinsurers, shares, period. New treaties need a second user's approval (`reinsurance.treaty_requires_approval`). |
| Reinsurance > Treaty Dashboard | Active treaties, total and available capacity, utilization, premium ceded and claims recovered. |
| Reinsurance > Cession Tracking | Policies ceded per treaty with cession %, ceded premium and commission; **Process Cession** and **Generate Bordereau**. |
| Reinsurance > Claims Recovery | Recoverable amounts on claims under treaties; **Register Recovery**. |
| Reinsurance > Reconciliation | Compare our amounts with the reinsurer's statement; variances above 1% need review (`reinsurance.reconciliation_tolerance_percent`). |
| Reinsurance > Analytics | Treaty utilization, loss ratio trend, retention against the 65% target, recovery performance, catastrophe exposure. |

![Treaty Master](ri-treaty-master)

![Reinsurance Treaty Dashboard](ri-treaties)

![Cession Tracking](ri-cessions)

![Reinsurance Claims Recovery](ri-recovery)

![Reinsurance Reconciliation](ri-reconciliation)

![Reinsurance Analytics](ri-analytics)

Reinsurers must meet the minimum security rating A- (`reinsurance.min_security_rating`). Bordereaux fall due 30 days after the period end. The Reinsurance Cession Register report lists the cessions of a period.

# Incentives

## Purpose

Incentive programmes reward agents for reaching targets: premium volume, policy count, renewal rate or conversion. Programmes are set up by the business administrator; finance calculates the results, a second user approves them and the agents see their statements.

| Screen | Use it to |
|---|---|
| Master > Incentive Programs | Add a programme: code (INC-), name, type (Target Based, Commission Based, Hybrid, Contest), target metric, base target, frequency (Monthly, Quarterly, Semi-Annual, Annual), start and end dates. |
| Accounts > Incentive > My Programs | An agent's programmes with target, achievement and potential earning. |
| Accounts > Incentive > Calculations | **New Calculation** for a period creates a batch CALC- with the amount per agent, sent for approval. |
| Accounts > Incentive > Approvals | Approve, reject or **Bulk Approve** calculation batches (not your own). |
| Accounts > Incentive > Statement | Statement per agent and month: earnings, year-to-date, pending and last payment, programme breakdown. |

![Incentive Program Master](inc-programs)

![Incentive Calculations](inc-calculations)

![Incentive Approvals](inc-approvals)

![Incentive Statement](inc-statement)

Only agents and sales users take part (`incentive.eligible_roles`). The Incentive Results report lists target, achievement and payout per agent.

> **Known issue:** The finance role sees the Incentive menu but its screens show *Requires permission: read:incentive or write:incentive*. Until the role is given the incentive permissions, run incentives as a Business Administrator. The contact details at the foot of the Incentive Statement are sample text.

# Product Configurator

## Purpose

The Product Configurator holds the products the broker sells and the rules that price them: templates, coverages, rating factors, underwriting rules, documents, approval workflows and insurer mappings. The motor tariff that prices every motor quotation (vehicle classes, CTPL and Auto Passenger PA) is maintained here.

Who uses it: business administrators and underwriters maintain it; sales and customer services can view the dashboard and templates.

| Screen | Use it to |
|---|---|
| Dashboard | See active products, total premium, average loss ratio and commission; open templates; quick actions. |
| Product Templates | Create, version and edit product templates (the motor tariff lives in template MOT-003-2025). |
| Coverage Builder | Define coverages: code, name, mandatory or optional, deductible, premium impact. |
| Rating Engine | Rating factors (vehicle age, driver age, no claim bonus, use, region, fleet, deductible, brand) with their rules; **Test Calculator**. |
| Underwriting Rules | Acceptance, validation and loading rules. |
| Document Manager | Document templates per stage (quotation, policy issuance): policy schedule, CTPL certificate, enrolment form. |
| Approval Workflows | Sequential or parallel approval steps with SLAs, for example New Product Approval and Rate Change Approval. |
| Market Mapping | Products mapped to insurers with commission, override and targets. |
| Risk Mapping | Product definitions by line; Industrial All Risks is defined by risk sections. |
| Product Analytics | Policies, premium, loss ratio and margin by product. |

![Product Configurator Dashboard](pc-dashboard)

![Product Templates](pc-templates)

Template statuses: **Draft**, **Active**, **Inactive** and **Retired** (`product.template_statuses`). Only active templates are used by the quotation screens. Use the pencil to edit a template and the arrow icon to reactivate a retired one.

## Maintain the motor tariff (CTPL and Auto Passenger PA)

The template named in `motor.pricing_template_code` (MOT-003-2025) holds the motor tariff.

1. Choose **Product Configurator > Product Templates**.
2. Select the pencil on **MOT-003-2025 Motor Insurance Basic Plan**.
3. Open the **CTPL & Auto PA** tab.
4. For each **Vehicle class**, check the name, **Code**, default **Seats**, **CTPL 1 year (₱)** and **CTPL 3 years (₱)**. Leave the 3-year amount blank when the 3-year CTPL is not offered for the class.
5. Select **+ Add vehicle class** to add a class, or the bin icon to remove one.
6. Under **Auto Passenger Personal Accident**, set the **Rate (% of limit per seat)** and the **Limits per person offered** (separated by commas).
7. Select **Save Template**.

![Template MOT-003-2025, tab CTPL & Auto PA](pc-template-ctpl)

The server checks the values (amounts of 0 or more, whole-number seats, unique class codes). The quotation screens use the new values at once.

| Tab | Content |
|---|---|
| Risk Information | Vehicle information, discounts and loadings of the template. |
| Premium Rates | Rates by cover (for example the own damage rate per vehicle class). |
| CTPL & Auto PA | The CTPL tariff and the Auto Passenger PA rate and limits (above). |
| Taxes and fees | Statutory taxes of the template. |
| Rating Factors | Factors applied to the template. |

![Template MOT-003-2025, tab Risk Information](pc-template)

![Template MOT-003-2025, tab Taxes and fees](pc-template-taxes)

> **Important:** Quotations are taxed with the rates in **Master > Configuration**, group *tax* (VAT 12%, DST 12.5%, LGT 0.75%, FST 2%), applied per line of business by `premium.taxes_by_lob`. The values on the template's **Taxes and fees** tab and in the Taxation master are not used for pricing. Keep them equal to the Configuration values to avoid confusion.

## Coverages, rating and rules

![Coverage Configuration Builder](pc-coverages)

![Rating Engine Configuration](pc-rating)

Select **Test Calculator** on the Rating Engine to try a premium before you activate a change. Select the arrow on a factor to see its rules.

![Underwriting Rules Engine](pc-uwrules)

![Product Approval Workflows](pc-workflows)

![Risk Mapping](pc-risk-mapping)

# Master data and administration

## General masters

The masters hold the reference data that the operational screens offer in their lists. Each master screen works the same way: a list with search, **+ Add**, **Upload** (where offered) for many records at once, the eye to view, the pencil to edit and a status switch to deactivate a record. Records are not deleted; deactivated records disappear from the lists.

| Master (Master > Generals) | Holds | Used by |
|---|---|---|
| Organization > Company, Branch | The broker company, its licence and its branches (Head Office, Cebu, Davao). | Receipts, vouchers, reports |
| Insurance Management > Insurance Company | Insurers: code, name, placement e-mail, phone. | Quotations, policies, remittance, claims (loss advice e-mail) |
| Insurance Management > Line of Business | Motor, Fire, Marine, Casualty, Accident, Engineering, Employee Benefits. | Products, reports |
| Insurance Management > Product | Products with line of business and commission code. | Policies, commission, reports |
| Insurance Management > Cover | Covers (own damage, CTPL, acts of nature, auto PA, …). | Commission rules, coverage |
| Insurance Management > Signatories | Authorised signatories of quotations. | Order summary |
| Insurance Management > Vehicle | Vehicle brand, model, variant and seating. | Quotation vehicle lists |
| Location > Country, State, City Master | Address lists (province = State). | Leads, clients, claims |
| Commission | Brokerage per insurer, product and cover with effective dates. | Quotation commission, accrual |
| Employee Management > Hierarchy, Designation, Employee | Staff structure and designations. | Reference |
| User Management > User, Role | Users and roles (see *Users and roles*). | Sign-in and access |
| Incentive Programs, Reinsurance Treaty | Chapters 16 and 15. | |

![Master > Insurance Company](m-insurer)

![Master > Product](m-product)

![Master > Vehicle](m-vehicle)

![Master > Signatories](m-signatories)

![Master > Commission](m-commission)

![Master > Branch](m-branch)

> **Known issue:** **Master > Generals > Employee Management > Hierarchy** shows "Something went wrong on this screen" in this release.

## Finance masters

| Master (Master > Finance) | Holds |
|---|---|
| Premium, Miscellaneous, Customer and RI-Claims Account Setup | Account determination ranges (company, office, department, business type, product, cover, document type → GL accounts). |
| Transaction code | Codes used on receipts, vouchers and journals: OR, PV, JV, CM, DM, RM. |
| Currency, Exchange Rate | PHP, USD, EUR, JPY, SGD and monthly rates to PHP. |
| Bank | Banks with branch, SWIFT code, e-mail and phone; bank accounts and cheque books. |
| Account Category | Asset, Liability, Equity, Income, Expense. |
| Main Account, Sub Account | The chart of accounts (below). |
| Taxation | Tax codes and rates for reference: DST 12.5%, EWT 5%, FST 2%, LGT 0.75%, premium tax 2%. |
| Petty cash | Petty cash funds with size, minimum cash box and transaction limit. |
| Remittance Master | The 16 remittance configuration types (adjustment types, agency and direct bill set-ups, approval, schedules, templates …). |

![Master > Finance > Taxation](m-taxation)

![Master > Finance > Bank](m-bank)

![Master > Finance > Remittance Master](m-remittance)

## Chart of accounts

![Main Account Master – Chart of Accounts](m-mainaccount)

**Master > Finance > Main Account** is the chart of accounts: a Philippine broker chart grouped by account type and financial statement group (128 accounts). For each account you see the code, name, statement group, category, normal balance (debit or credit), whether it is an open-item account, whether manual journals may use it, its system use and status. Filter by account type, statement group or status.

**Sub Account** holds the sub-ledgers of a main account, for example 4401003001 *Audit Fees – Statutory* under 4401003 *Professional Fees*.

![Sub Account Master](m-subaccount)

To add an account:

1. Select **+ Add**.
2. Enter the code, name, type, statement group, category and normal balance.
3. Tick **Open Item** for receivable or payable accounts matched item by item, and **Manual JV** if journal vouchers may post to it.
4. Save.

Accounts marked for system use (cash, receivables, payables, commission, VAT, withholding tax) are protected: the system posts to them automatically. Their codes are set in **Master > Configuration**, group *accounting*.

Key accounts used by the system:

{widths: 16,44,40}
| Code | Account | Posted by |
|---|---|---|
| 1101001 | Cash on Hand | Cash receipts |
| 1102001 | Cash in Bank – Operating Account (BDO Current) | Receipts by transfer and cheque, vouchers |
| 1102002 | Cash in Bank – E-wallet Clearing (GCash) | Online and GCash receipts |
| 1202001 | Premiums Receivable – Direct Clients | Policy and endorsement bills, receipts |
| 1203001 | Commission Receivable – Insurers (Direct Bill) | Direct-bill issue, debit note collections |
| 1302001 | Creditable Withholding Tax (BIR 2307) | Insurer EWT on direct-bill commission |
| 2201001 | Premiums Payable to Insurers | Bills, remittance vouchers |
| 2203001 | Commission Payable – Agents and Referrers (Comsub) | Commission approval and payout |
| 2204001 | Withholding Tax Payable | Commission payout |
| 2204003 | Output VAT Payable | VAT on direct-bill commission |
| 3201001 | Brokerage Commission Income | Policy issue, endorsements |
| 4401010 | Commission Expense – Agents and Referrers (Comsub) | Commission approval |

## Users and roles

User Access Administrators and IT Administrators manage users on **Master > Generals > User Management**.

![Master > User Management > User](m-users)

### Add a user

1. Choose **Master > Generals > User Management > User** and select **+ Add**.
2. Enter the **Username** (the user ID for signing in), **E-mail**, **Display Name** and the first **Password**.
3. Tick one or more **Roles**. At least one role is required.
4. Select **Save**. **Save** stays disabled until the required fields are filled.

![Add User (example values)](m-user-add)

The password must follow the password rules (Chapter 1). A duplicate username is refused. The creation is recorded in the audit trail.

### Change, lock and unlock users

- Select the pencil on a user to change the display name, e-mail, roles or to set a new password.
- Use the **Status** switch to deactivate a leaver (the history is kept) or to reactivate a user. Reactivating a locked user unlocks it and resets the failed sign-in count.
- Give each person one user of their own. Keep maker and checker duties on different people.

### Roles

![Master > User Management > Role](m-roles)

The nine roles are listed in Chapter 1. Open a role to see its permissions: read and write rights per module (for example `read:receipts`, `write:journal-vouchers`). The server checks these permissions on every request. System roles cannot be deleted, and a role with users cannot be deleted.

## System Settings

![Master > System Settings](m-system-settings)

**Master > System Settings** (IT and business administrators) controls the look of the system:

| Section | Settings |
|---|---|
| Branding | **App Title** (browser tab), **Logo Preset** (BDO), **Add Company Logo**, **Upload Logo**, **Upload Favicon** (images up to 2 MB). |
| Localization | **Display Currency** (PHP — Philippine Peso) and **Default Language**. |
| Theme | **Primary Color** (BDO Blue #0072d8) and **Secondary Color** (BDO Navy #004ea8), with **Theme preview**. |

Select **Save**. The settings apply to every user, including the sign-in page.

## Configuration

![Master > Configuration](m-config)

**Master > Configuration** holds every business parameter, grouped in tabs (accounting, branding, claims, collections, commission, currency, dashboard, direct bill, e-mail, endorsements, finance, general, incentive, leads, limits, notifications, numbering, policies, policy, premium, product, quotations, quote, reinsurance, remittance, renewals, reports, security, system, taxes, uploads). Each setting shows its label and its key.

1. Choose the tab.
2. Change the value (number, text, switch or list).
3. Select **Save changes**. The change applies at once and is recorded in the audit trail with the old and new value.

![Configuration: security settings](m-config-security)

![Configuration: direct bill settings](m-config-direct-bill)

> **Caution:** Change GL accounts, tax rates, numbering prefixes and maker-checker switches only with the agreement of Finance and the Business Administrator. See Appendix C for the key settings.

## Schedules

![Master > Schedules](m-schedules)

**Master > Schedules** lists the jobs the system runs by itself (server time, Asia/Manila). For each job you see what it does, the schedule in plain words, whether it is enabled, the last run and its status.

| Icon | Action |
|---|---|
| Run (▷) | Run the job now, for example after changing a setting. The result shows, for example *Updated: 5*. |
| History | The past runs with their results. |
| Pencil | Change the timetable or enable / disable the job. |

The jobs are listed in Appendix D.

## Audit trail

![Master > Audit Trail](m-audit)

**Master > Audit Trail** lists every create, update, approval, report run and sign-in, newest first: when, user, record type, record ID, action and the change (before and after values).

1. Enter a **Record type** (for example *session* for sign-ins, *policy*, *receipt*, *journal-voucher*), a **Record ID** or a **User**.
2. Select **Search**.

Use the audit trail for investigations, access reviews and to prove that maker and checker were different people.

# Reports

## How to run a report

1. Choose **Reports > Operational Reports** or **Reports > Financial Reports**, then the report.
2. Choose the **Report Criteria**, for example *Overall*, *Agent*, *Principle Insurance* (insurer) or *Branch*. The filter fields that apply to the criteria become available.
3. Choose the **From Date** and **To Date**. Without a From Date the last 365 days are used.
4. Choose the **Agent**, **Company**, **Branch** or **Client** if the criteria needs one.
5. Select **Generate**. The report file is created on the server and downloads as an Excel workbook (XLSX).

![Reports > Operational Reports > Production, with the criteria list open](rep-production)

![Claims report: criteria All, Open, Settled, Rejected](rep-claims)

- Files hold up to 50,000 rows (`reports.max_rows`). Download links stay valid for 72 hours; generated files are kept for 90 days.
- Every generated report is recorded in the audit trail.
- The report screens produce XLSX. The same reports can be produced as CSV or PDF (A4) through the reports API and the report schedules, which e-mail a report on a timetable to a list of recipients (set up by the IT Administrator).
- The *Daily reports* job generates the Production Register, the Collection Report and the Claims Position every morning at 05:00.

On **Collection Report**, **Payables**, **Journal** and **Trail Balance** the criteria fields are fixed (greyed): choose the dates and select **Generate**; the report covers all agents, insurers and branches.

![Reports > Financial Reports > Trail Balance](rep-trial-balance)

> **Known issue:** For sales and claims users the report screens show *Requires permission: read:users* when they open (the list of agents cannot be loaded). The report still generates; leave the Agent filter empty.

## The report catalogue

{widths: 20,40,22,18}
| Report | What it shows | Where | Roles (besides administrators) |
|---|---|---|---|
| Production Register | Policies incepted in the period: premium, commission, new business or renewal, billing mode; by agent, insurer, branch or billing mode. | Reports > Operational > Production; Executive Dashboard > Export Report | Sales, underwriting, customer services, claims |
| Claims Position | Claims reported: estimate, approved, settled, age and bucket. Criteria All, Open, Settled, Rejected, Aging. | Reports > Operational > Claims | Sales, underwriting, customer services, claims |
| Renewal Retention | Renewals due: retained, lost or pending, old and new premium, retention rate. | Reports > Operational > Renewal | Sales, underwriting, customer services, claims |
| Remittance Summary | Remittances to insurers: gross premium, commission retained, net due, status. | Reports > Operational > Remittance | Operational roles, finance |
| Broker Commission Statement | Commission per agent and policy: basis, rate, gross, WHT, net, paid status, billing mode. | Reports > Operational > Broker Commission | Operational roles, finance |
| Premium by Product / Month / Insurer | Policy count, sum insured, premium and commission by month, product or insurer. | Reports API | Operational roles, finance |
| New Business vs Renewals | Policies and premium split into new business and renewals by month or agent. | Reports API | Operational roles, finance |
| Claims Ageing | Open claims by ageing bucket (30/60/90/180 days) with estimate and approved amount. | Reports API | Sales, underwriting, customer services, claims |
| Lead Conversion Funnel | Leads by stage (new to converted or lost) with share and conversion rate. | Reports API; lead list > Generate Report gives the lead list | Sales, underwriting, customer services |
| Reinsurance Cession Register | Cessions per treaty and policy: sum insured, ceded sum and premium, share. | Reports API | Underwriting, finance |
| SOA / Premium Receivable | Bills issued: amount, paid, balance, age and bucket as of the To Date. | Reports > Financial > SOA / Premium Receivable | Finance, sales |
| Collection Report | Bills due: billed, collected, balance and collection rate. | Reports > Financial > Collection Report | Finance |
| Receivables Ageing | Outstanding receivables by bucket (30/60/90/120 days). | Accounts > Collections > Aging Report (on screen); Reports API | Finance, sales |
| Commission Receivable – Direct Bill | Commission and VAT due from insurers on direct-bill policies: unbilled, on a debit note, partly or fully collected, with ageing. | Direct Bill Processing > Commission receivable ageing | Finance |
| Receipts Register | Official receipts: bill, policy, payment mode, bank, reference. | Reports API | Finance |
| Payables / Disbursement Register | Payment vouchers to insurers, agents, clients and suppliers with approval and paid dates. | Reports > Financial > Payables | Finance |
| Journal Register | Journal lines: account, debit, credit, memo, status. | Reports > Financial > Journal | Finance |
| Trial Balance | Opening balance, period debits and credits and closing balance per account, by account type and statement group. | Reports > Financial > Trail Balance | Finance |
| Incentive Results | Programme target, achieved, achievement % and payout per agent. | Reports API | Finance, sales |

"Reports API" means `POST /api/reports/{code}/generate` with the format csv, xlsx or pdf, or a report schedule. Ask the IT Administrator for these files.

## Other exports

| Screen | Export |
|---|---|
| Executive Dashboard | **Export Report**: Production Register (XLSX) for the chosen dates. |
| Claims Dashboard | **Export Report**: claims data for the chosen dates (spreadsheet). |
| Leads | **Generate Report**: the lead list by category (spreadsheet). |
| Accounting Query, All Clients Accounting | **Export** / **Export CSV**. |
| Remittance screens | Export and print buttons on history, exceptions and statements. |

# Persona quick guides

Each page below is a one-page summary for one persona: where you land, your daily tasks and where to find them, the approvals you give or need, and the reports you use. The module chapters give the detail.

## IT Administrator (BrokerVerse)

**Role:** IT Administrator (it-admin). **Menus:** all. **Landing:** Executive Dashboard.

| Task | Where |
|---|---|
| Check that the system is up and the jobs ran | Master > Schedules (last run and status) |
| Change a business parameter (with the owner's agreement) | Master > Configuration > tab > **Save changes** |
| Branding, logo, colours, language | Master > System Settings |
| Create users and assign roles (or support the User Access Administrators) | Master > Generals > User Management > User |
| Review sign-ins and changes | Master > Audit Trail (record type *session*) |
| Run a job now after a change | Master > Schedules > Run |
| Provide CSV / PDF reports and report schedules | Reports API (`/api/reports`) |

- Keep the administrator user for administration. Use persona users for business work, so that commission and maker-checker work as intended.
- Before go-live: e-mail (SMTP), server time zone Asia/Manila, logo, GL accounts, numbering prefixes, password of the administrator.
- You cannot approve a transaction you entered yourself.


![Landing page of the IT Administrator: Executive Dashboard with every menu](persona-BrokerVerse)

\pagebreak

## Business Administrator (bea.admin)

**Role:** Business Administrator (ba). **Menus:** all. **Landing:** Executive Dashboard.

| Task | Where |
|---|---|
| Maintain products and templates | Product Configurator > Product Templates |
| Update the CTPL tariff, vehicle classes, seats, Auto Passenger PA | Product Configurator > Product Templates > MOT-003-2025 > CTPL & Auto PA |
| Maintain coverages, rating factors, underwriting rules | Product Configurator > Coverage Builder, Rating Engine, Underwriting Rules |
| Maintain insurers, products, covers, signatories, vehicles | Master > Generals > Insurance Management |
| Maintain commission rates | Master > Generals > Commission |
| Maintain the chart of accounts (with Finance) | Master > Finance > Main Account, Sub Account |
| Set up incentive programmes and reinsurance treaties | Master > Incentive Programs, Master > Reinsurance Treaty |
| Follow the business | Dashboard > Executive Dashboard; all reports |

- Change rates with the agreement of Finance and test them with the Rating Engine's **Test Calculator** or a draft quotation.
- New treaties and incentive batches need a second user's approval.


![Landing page of the Business Administrator](persona-bea.admin)

\pagebreak

## Sales / Relationship Manager (maria.sales)

**Role:** sales. **Landing:** Executive Dashboard. Your own figures are on Dashboard > Agent Dashboard.

| Task | Where |
|---|---|
| Capture a prospect | Operations > Leads/Prospects > **Create Lead** |
| Prepare and send a quotation | Lead > **Create Quote** … **Completed Quote** > **Send for Customer Approval** |
| Convert an accepted quotation | Quotation > **Proceed to Policy** (KYC, photos, billing mode, upload policy) |
| Record the client's payment for finance | Policy > **Proceed to Payment** > **Record payment** |
| Work renewals | Operations > Renewals > Renewal Queue, At-Risk Policies, Negotiations |
| Follow your commission | Commission > Commission Dashboard |
| Reports | Reports > Operational Reports (Production, Claims, Renewal, Remittance, Broker Commission) |

Notifications you receive: customer accepted quotation, policy issued, renewal notice sent, renewal approved or returned, policy lapsed.


![Landing page of Sales: Executive Dashboard with the sales menu](persona-maria.sales)

\pagebreak

## Agent / Referrer (ramon.agent)

**Role:** agent. **Landing:** Agent Dashboard (Operations > Home). You see only your own leads, clients, quotations and policies.

| Task | Where |
|---|---|
| Start the day | Dashboard > Agent Dashboard: leads, clients, policies sold, commission, receivables |
| Capture a prospect | Operations > Leads/Prospects > **Create Lead** |
| Quote | Lead > **Create Quote** (5 steps) > **Completed Quote** > **Send for Customer Approval** |
| Issue the policy after the client accepts | Operations > Quotation > quotation > **Proceed to Policy** |
| Record how the client paid | Policy > **Proceed to Payment** |
| Raise a claim notice | Operations > Policy > **...** > **Claim** |
| Follow expiring policies | Operations > Renewals > Renewal Policy |
| Follow commission | Commission > Commission Dashboard |

- Put yourself as the referrer (Account Code, Commission & Referral) so the commission is credited to you.
- Keep your bank details with Finance; payouts are blocked without them.
- You have no Reports menu; ask Finance for your Broker Commission Statement.
- Of the Renewals menu, use **Renewal Policy**. The other renewal screens need renewal permissions the agent role does not have yet (see Appendix G).


![Landing page of the Agent: Agent Dashboard, own book only](persona-ramon.agent)

\pagebreak

## Underwriter (jose.uw)

**Role:** underwriting. **Landing:** Executive Dashboard; your workbench is Dashboard > Underwriting Dashboard.

| Task | Where |
|---|---|
| Review quotations sent for approval | Notification *Quotation sent for approval*; Operations > Quotation |
| Monitor submissions and alerts | Dashboard > Underwriting Dashboard |
| Price and approve renewals | Operations > Renewals > Renewal Policy, Renewal Queue, Negotiations |
| Maintain coverages, rating and underwriting rules | Product Configurator |
| Reinsurance: treaties, cessions, recoveries, reconciliation | Reinsurance menu |
| Reports | Reports > Operational Reports; Cession Register (Reports API) |

- You are notified of every quotation sent to a client (`quotations.approval_notify_roles`) and are the checker for renewal terms (`renewals.approver_roles`).
- Quotations expire after 30 days; renewal quotations after 30 days.


![Landing page of the Underwriter](persona-jose.uw)

\pagebreak

## Customer Services (ana.cs)

**Role:** customer-services. **Landing:** Executive Dashboard.

| Task | Where |
|---|---|
| Start the day | Operations > Open Items (expiring policies, pending payments, pending quotes, renewal requests) |
| Answer a client | Operations > Clients > client (Policy, Claim, Renewal, Endorsement tabs) |
| Change a policy | Operations > Policy > **...** > **Endorsement** |
| Follow payments | Operations > Payments |
| Capture leads and quotations for sales | Operations > Leads/Prospects |
| Follow expiring policies | Operations > Renewals > Renewal Policy |
| Reports | Reports > Operational Reports |

- Choose the endorsement type before **Proceed**; check the summary before **Send to Insurance Company**.
- Additional premium from an endorsement is billed automatically; finance posts the receipt.


![Landing page of Customer Services](persona-ana.cs)

\pagebreak

## Claims Officer – maker (carlo.claims)

**Role:** claims. **Landing:** Claims Dashboard.

| Task | Where |
|---|---|
| See open and overdue claims | Dashboard > Claims Dashboard |
| Register a claim | Operations > Policy > **...** > **Claim** |
| Follow a claim with the insurer | Operations > Claims > eye icon > **Proceed** (adjuster details) |
| Submit a settlement | Claim > **Claim Settlement** > **Submit** |
| Check the history | Operations > Claims > history icon (audit trail) |
| Reinsurance recoveries | Reinsurance > Claims Recovery |
| Reports | Reports > Operational Reports > Claims |

- The date of loss must be inside the policy period; unpaid premium blocks a claim.
- Attach documents (PNG, JPEG, PDF up to 2 MB) when you register.


![Landing page of the Claims Officer: Claims Dashboard](persona-carlo.claims)

\pagebreak

## Claims Officer – checker (lisa.claims2)

**Role:** claims. **Landing:** Claims Dashboard.

| Task | Where |
|---|---|
| See settlements waiting for you | Notification *Settlement approval*; Operations > Claims (status Pending Approval) |
| Review and approve a settlement | Claims > eye icon > **Waiting for Settlement** > **Approve Settlement** or **Return** |
| Check the claim before approving | Claims > information icon (Claim Details), history icon (audit trail) |

- You cannot approve a settlement you submitted yourself.
- After approval the claim is Settled and the maker is notified.


![Landing page of the claims checker](persona-lisa.claims2)

\pagebreak

## Finance / Accounts – maker (liza.finance)

**Role:** finance. **Landing:** Executive Dashboard.

| Task | Where |
|---|---|
| Verify payments recorded by agents and sales | Notification *Premium payment to verify* > **Confirm** / **Reject** |
| Post official receipts | Accounts > Receipts > **+ Receipt** |
| Chase overdue premium | Accounts > Collections, Aging Report |
| Pay commission | Commission > Agents/Referrer Accounts > **Approve** > **Generate payout** |
| Remit premium to insurers | Accounts > Remittance > Automated Processing, Tracking, Settlement |
| Bill direct-bill commission | Accounts > Remittance > Direct Bill Processing |
| Journals | Accounts > Journal Voucher > **+ Voucher** > **Submit for approval** |
| Pay suppliers and refunds | Accounts > Disbursement > **+ Create** |
| Reports | Reports > Financial Reports; Operational Reports |

- Always select the bill when you post a receipt.
- Ask the checker to approve the same day; approvals show an SLA.


![Landing page of Finance](persona-liza.finance)

\pagebreak

## Finance / Accounts – checker (fe.approver)

**Role:** finance. **Landing:** Executive Dashboard.

| Approval | Where |
|---|---|
| Journal vouchers | Notification *Journal voucher … awaiting approval*; Accounts > Journal Voucher |
| Payment vouchers, cheques and commission payouts | Accounts > Disbursement > voucher |
| Commission lines | Commission > Agents/Referrer Accounts > referrer > **Approve** |
| Remittances, settlements, transfers, adjustments | Accounts > Remittance > Approval Workflow |
| Commission debit notes | Accounts > Remittance > Direct Bill Processing > 2. Debit Notes |
| Petty cash requests | Accounts > Petty Cash > Request |

- You cannot approve what you entered. Check amounts, accounts and supporting documents before approving.
- Print approved cheques so that vouchers become Paid.
- Run the trial balance after each posting day.


![Landing page of the finance checker](persona-fe.approver)

\pagebreak

## User Access Administrator (carmela.morfe)

**Role:** user-access-admin. **Menus:** Master > User Management (User, Role) and Audit Trail. **Landing:** Audit Trail.

| Task | Where |
|---|---|
| Create a user after the manager approves the request | Master > Generals > User Management > User > **+ Add** |
| Change roles, reset a password | User > pencil |
| Unlock a locked user, deactivate a leaver | User > **Status** switch |
| Review roles and permissions | Master > Generals > User Management > Role |
| Review sign-ins and changes | Master > Audit Trail (record type *session*, or a user name) |

- You cannot open business screens, reports or settings; they show **Not authorised**.
- Give each person the smallest role that does the job, and keep maker and checker on different people.
- Review users with the line managers every quarter.


![Landing page of the User Access Administrator: Audit Trail, Master menu only](persona-carmela.morfe)

# Appendices

## Appendix A. Status reference

| Record | Statuses (in order) |
|---|---|
| Lead | New → Contacted → Qualified → QuoteGenerated → Converted; Lost |
| Quotation | Draft → Pending Customer → Customer Accepted → (Submitted to Insurer → Approved) → Converted to Policy; Rejected, Dropped, Expired |
| Policy | Active → Expired / Renewed / Lapsed / Cancelled |
| Policy payment | Pending → Reviewing → Partial → Completed; Refunded |
| Bill (INV) | Open → Partial → Paid; Cancelled |
| Endorsement | Draft → Pending Customer → Completed; Initiate Cancel, Cancelled, Rejected |
| Claim | Pending → Processing → Pending Approval → Approved → Settled → Closed; Rejected |
| Renewal | Pending → First Notice Sent → Second Notice Sent → Final Notice Sent → Quote Sent → Pending Approval → Approved → Renewed; Lapsed |
| Commission line | Accrued → Eligible → Approved → Paid; Reversed |
| Payment voucher (PV) | Draft → For approval → Approved → Paid; Cancelled |
| Journal voucher (JV) | Draft → Awaiting approval → Posted; Rejected |
| Remittance (REM) | Draft → Pending Approval → Approved → Completed; Rejected, Cancelled |
| Debit note (DN) | Draft → Pending Approval → Open → Partially Collected → Collected; Rejected, Cancelled |
| Collection item | Pending → Committed → Overdue → Closed |
| Product template | Draft → Active → Inactive / Retired |
| User | Active, Inactive, Locked |

## Appendix B. Number series

Numbers are issued by the system as PREFIX-YYYY-NNNNN (for example POL-2026-00001). The prefixes are set in Master > Configuration, group *numbering*.

{widths: 14,46,40}
| Prefix | Document | Issued when |
|---|---|---|
| LD | Lead | A lead is saved |
| QT | Quotation | **Completed Quote** |
| CL | Client code | The first policy of a client is issued |
| POL | Policy | **Send to Insurance Company** |
| INV | Premium bill (invoice) | Policy issue, endorsement or renewal with premium |
| OR | Official receipt | A receipt is posted or a payment confirmed |
| RT | Receipt transaction | With each receipt |
| PV | Payment voucher | A voucher, payout or insurer payment is created |
| DT | Voucher transaction | With each voucher |
| JV | Journal voucher | Every journal (manual or system) |
| REM | Remittance to insurer | Automated processing or agency bill |
| BLK | Remittance batch | Remittances submitted for approval |
| SET | Settlement | Settlement saved |
| END | Endorsement | Endorsement saved |
| CLM | Claim | Claim registered |
| DN | Commission debit note | Debit note raised |
| DNC | Debit note collection | Insurer payment posted |
| ADJ, EXC, TRF, STMT, NTF, SCH, BIL | Remittance adjustment, exception, transfer, statement, notification, schedule, bill | On the remittance screens |
| RN, RB, RQ, WB | Renewal, renewal batch, renewal quote, win-back campaign | On the renewal screens |
| CES, RCL, REC, BDX, TRT, RE | Cession, recovery claim, reconciliation, bordereau, treaty, reinsurer | On the reinsurance screens |
| PC, PCR, PCRC | Petty cash transaction, request, receipt | On the petty cash screens |
| INC, CALC | Incentive programme, calculation batch | On the incentive screens |

## Appendix C. Key configuration settings

All settings are on **Master > Configuration** unless noted. Changes apply at once and are audited.

{widths: 36,22,42}
| Setting (key) | Value | Effect |
|---|---|---|
| `tax.vat_rate`, `tax.dst_rate`, `tax.lgt_rate`, `tax.fst_rate` | 12%, 12.5%, 0.75%, 2% | Taxes on the net premium. |
| `premium.taxes_by_lob` | Motor: VAT, DST, LGT; Fire and IAR: + FST | Which taxes apply per line. |
| `motor.pricing_template_code` | MOT-003-2025 | Template holding the CTPL tariff and Auto Passenger PA (Product Configurator). |
| `limits.quote_validity_days` | 30 | Quotation validity. |
| `quotations.approval_link_ttl_hours` | 168 | Validity of the client's approval link (7 days). |
| `quotations.approval_notify_roles` | underwriting | Roles notified of quotations sent to clients. |
| `workflow.quote_maker_checker` | on | A quotation cannot be approved by its creator. |
| `policy.kyc_required_fields` | Motor: ID type, number, image, chassis, motor, plate or MV file | Required to issue a policy. |
| `policy.kyc_id_types` | PhilSys ID … Senior Citizen ID | Accepted government IDs. |
| `policy.payment_capture_modes` | bank transfer, cheque, online, cash | How a client can pay on the payment screen. |
| `receivables.due_days` | 30 | Days from inception to the bill due date. |
| `direct_bill.default_billing_mode` | broker | Default billing mode at issue. |
| `direct_bill.commission_vat_rate` / `…_inclusive` | 12%, added on top | VAT on direct-bill commission. |
| `direct_bill.insurer_ewt_rate` | 10% | EWT withheld by the insurer (BIR 2307). |
| `direct_bill.debit_note_due_days` | 30 | Debit note due date. |
| `commission.default_rate` | 15% | Brokerage when no rule applies. |
| `commission.wht_rate_by_type` | Agent 5%, Sub-agent 5%, External 10% | Withholding tax on comsub. |
| `commission.comsub_rate_by_level` | L1 8%, L2 5% | Default comsub rate. |
| `commission.eligible_roles` | agent, sales | Who earns commission. |
| `commission.require_bank_account` | on | Payout needs a bank account. |
| `finance.maker_checker_enabled` | on | Approver differs from maker (JVs, cheques, payouts, commission, petty cash). |
| `journal.require_approval` | on | Manual journals need approval. |
| `claims.settlement_maker_checker` | on | Settlement approved by a second user. |
| `claims.validate_loss_date`, `claims.block_unpaid_premium` | on | Claim checks at registration. |
| `claims.sla_days` | 20 | Claim handling SLA. |
| `renewals.pipeline_days`, `limits.renewal_notice_days`, `renewals.grace_period_days` | 90; 60/30/15; 30 | Renewal timetable. |
| `renewals.maker_checker` | on | Renewal terms need approval. |
| `remittance.approval_levels` | 100,000 / 1,000,000 / above | Approval levels by amount. |
| `limits.receivable_ageing_buckets` | 30, 60, 90, 120 | Ageing buckets. |
| `collections.reminder_days_before`, `…repeat_days` | 7, 7 | Collection reminders. |
| `security.password_*`, `limits.max_login_attempts`, `limits.session_idle_minutes` | see Chapter 1 | Sign-in rules. |
| `security.scoped_roles` | agent | Roles limited to their own book. |
| `general.date_format`, `general.timezone`, `currency.default` | DD/MM/YYYY, Asia/Manila, PHP | Formats. |
| `notification.email_enabled` | off in the test system | Sends queued e-mails through SMTP. |
| System Settings (screen) | logo, colours, currency, language | Look of the system. |
| Product Configurator (screen) | CTPL tariff, APPA rate and limits, own damage rates | Motor pricing. |

## Appendix D. Scheduled jobs

| Job | When (server time) | What it does |
|---|---|---|
| Policy expiry | Daily 00:15 | Marks policies past their expiry date as Expired. |
| Quotation expiry | Daily 00:30 | Expires quotations older than the validity. |
| Daily reports | Daily 05:00 | Generates the Production Register, Collection Report and Claims Position. |
| Renewal pipeline | Daily 05:30 | Enrols policies expiring within 90 days; lapses renewals past the grace period. |
| Renewal notices | Daily 06:00 | Creates the 60/30/15-day renewal notices and notifications. |
| Receivable ageing | Daily 07:00 | Recomputes ageing buckets of open receivables. |
| Collection reminders | Daily 08:00 | E-mails and notifies clients about premium falling due. |
| E-mail outbox | Every 5 minutes | Sends queued e-mails. |
| Renewal notice queue | Every minute | Sends queued renewal notices and retries stale jobs. |

## Appendix E. Glossary

{widths: 22,78}
| Term | Meaning |
|---|---|
| APPA | Auto Passenger Personal Accident: personal accident cover for the driver and passengers, priced per seat. |
| BIR Form 2307 | Certificate of Creditable Tax Withheld at Source, given by the insurer for the EWT it withholds. |
| Billing mode | Broker billed (client pays the broker) or direct bill (client pays the insurer). |
| Brokerage | The commission the insurer pays the broker. |
| Comsub | Commission sub-share paid by the broker to an agent or referrer. |
| CTPL | Compulsory Third Party Liability: motor insurance required by law for LTO registration, at the Insurance Commission tariff. |
| Debit note (DN) | The broker's bill to an insurer for commission on direct-bill policies. |
| Direct bill | The client pays the premium to the insurer; the broker bills only its commission. |
| DST | Documentary Stamp Tax (12.5% of the premium). |
| Endorsement | A change to an issued policy. |
| EWT | Expanded Withholding Tax withheld from a payment and credited to the payee (BIR 2307). |
| FST | Fire Service Tax on fire and IAR premium. |
| IAR | Industrial All Risks. |
| KYC | Know Your Customer: verification of the client's identity with a government ID. |
| LGT | Local Government Tax (0.75% of the premium). |
| LTO / MV file number | Land Transportation Office; the MV file number identifies a vehicle before plates are issued. |
| Maker-checker | Four-eyes control: the maker enters, a different user (the checker) approves. |
| Net premium | Premium before taxes. Gross premium = net premium + taxes + CTPL − discount. |
| OR | Official Receipt. |
| PLA | Preliminary Loss Advice: the first notice of a claim to the insurer. |
| PV | Payment voucher. |
| Remittance | Payment of collected premium, net of commission, to the insurer. |
| SOA | Statement of Account. |
| Settlement | (Remittance) the payment of approved remittances to an insurer; (Claims) the payment of a claim. |
| TIN | Tax Identification Number. |
| TNVS | Transport Network Vehicle Service (ride-hailing). |
| VAT | Value Added Tax (12%). |
| WHT | Withholding tax on commission paid to agents and referrers. |

## Appendix F. Troubleshooting

{widths: 34,66}
| Message or problem | What to do |
|---|---|
| **Not authorised** – "Your role does not give access to this screen" | The screen is not part of your role. Use your menu, or ask a User Access Administrator whether your role is right. |
| Wrong user ID or password | Check Caps Lock and the user ID. After 5 failures the account locks. |
| **Account locked. Contact the administrator** | Ask a User Access Administrator to reactivate your user or set a new password. |
| Too many sign-in attempts | Wait 5 minutes, then sign in again. |
| You were signed out | 30 minutes without activity. Sign in again; unsaved entries are lost. |
| *Requires permission: …* at the top of a screen | Your role lacks a permission the screen needs. Report the screen and the message to the IT Administrator. |
| *This field is required*, *Invalid email address* | Fill in the field or correct the format shown in red under it. |
| *Invalid mobile number (e.g. 0917 123 4567 or +63 917 123 4567)* | Type a Philippine mobile number starting with 09, +639 or 9 (10 digits after the 0). |
| *Age must be between 18 and 100 years* | Check the date of birth (DD/MM/YYYY). |
| CTPL shows "-" on the quotation | Choose the Vehicle Type on step 1. |
| *The lead has no e-mail address* | Add the e-mail to the lead, then send the quotation. |
| Issuance refused for missing KYC or vehicle identifiers | Complete ID type, ID number, ID image, chassis, motor and plate or MV file number. |
| *Date of loss … is outside the policy period* | Check the date of loss; register the claim on the policy in force on that date. |
| Receipt refused: amount above the balance | Enter at most the bill balance; use **Pay full balance**. |
| Journal voucher refused: *debit … vs credit …* | Correct the lines until total debit equals total credit. |
| Approval refused for the maker | Ask another user with the same role to approve. |
| Commission payout blocked: no bank account | Add the referrer's bank name and account number. |
| "Something went wrong on this screen" | Select **Reload screen**. If it persists, report the screen and the time to support. |
| E-mails are not received | E-mails wait in the outbox until SMTP is configured and `notification.email_enabled` is on. |

## Appendix G. Known limitations in this release

The items below were observed on 29 September 2026 while preparing this manual. They are reported to the product team.

- The **Forgot password?** link on the sign-in page is not active, and there is no screen for a user to change an expired password or enter a two-factor code.
- **Operations > Renewals > Retention Analytics** and **Master > Generals > Employee Management > Hierarchy** show "Something went wrong on this screen".
- The finance role sees the **Accounts > Incentive** screens but they show *Requires permission: read:incentive or write:incentive*.
- The report screens show *Requires permission: read:users* for sales and claims users; the report still generates.
- **See More** in the notification panel opens a page that finance and user access administrators may not open (**Not authorised**).
- The Executive Dashboard title is dark blue on a dark blue banner and hard to read; its **Settings** button does nothing.
- The policy details page labels LGT as 2% although 0.75% is applied, and a direct-bill policy still shows *Payment Required*.
- The template **Taxes and fees** tab and the Taxation master are not used for pricing (see Chapter 17).
- Some screens show internal record ids instead of numbers (client view header, endorsement numbers on the client's Endorsement tab) and the claim settlement pages show "Loading..." in the header.
- Some lists and pickers still show dates month-first or as YYYY-MM-DD (Disbursement, Journal Voucher, payment date picker, receipt date).
- The agent role sees the whole Renewals menu, but Renewal Queue, Renewal Batch, At-Risk Policies, Negotiations, Lapse Management and Performance refuse it (*Requires permission: read:renewals*).
- The finance role sees Reinsurance > Reconciliation, but the screen is refused (*read:reinsurance*); the Incentive Statement calls a service that does not exist yet; the Remittance Approval Workflow cannot load the user list for finance.
- On the claims officer's Clients screen, **Create Lead** opens **Not authorised**; the underwriter's **Add Treaty** also opens **Not authorised**.
- Company clients are listed with category RETAIL; the Account Category master shows untranslated column names.
- The Agent Dashboard shows collected premium 0.00 for policies that are paid.
- The Collections screen button is labelled *Manual Trigger Renewal Reminder Now* although it sends collection reminders.

## Appendix H. Support

| Need | Contact |
|---|---|
| Sign-in, locked account, new user, role change | Your User Access Administrator |
| Settings, schedules, e-mail, integration, errors on screen | IT Administrator (BrokerVerse) |
| Products, rates, commission, masters | Business Administrator |
| Receipts, payouts, remittance, ledger | Finance / Accounts |
| Service desk | [Service desk e-mail and telephone to be added] |
| Platform provider | iorta TechNXT – [support contact to be added] |

When you report a problem, give the screen (menu path), the record number (for example QT-2026-00007), the time, your user ID and the message shown. Never send your password.
