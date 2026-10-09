# Go-live data set-up

For the System Administrator and Accounting. It gives the order in which to set up the company in BrokerVerse before
users start working, and for each step the screen, what to enter, the template to use and how to check the result.
The technical installation (servers, database, secrets, SMTP account) is in `deploy/README.md` and must be
finished first.

The templates are in `docs/package/05_Delivery/Upload_Templates`. Each has a Data sheet with the exact headers and a sample row to delete, a
Columns sheet and an Instructions sheet. On screens with an **Upload** button the same template is under
**Download template**. Screens without an Upload button are marked below; for those a System Administrator loads the
file through the API route written on the template's Instructions sheet, or enters the records on the screen.

Most of the steps below can also be done with two workbooks on **Master > Go-Live Data Load**: the configuration
workbook (steps 1 to 8: company, users, masters, chart of accounts, commission rates, numbering, settings) and the
migration workbook (step 11: clients, in-force policies, open items, open claims, opening balances), each validated as
a whole before anything is saved. See `GO_LIVE_DATA_WORKBENCH.md`.

Agree a **go-live date** with Accounting before you start: the first day on which transactions are entered in
BrokerVerse. Balances and open items are taken from the old system at the close of the day before.

## Philippine settings delivered with BrokerVerse

BrokerVerse is delivered with Philippine reference data and practice in its masters. Check them, activate what you use
and correct what differs in your company; do not enter them again. The items in **To confirm before go-live** below
are the ones the broker (with its tax adviser where noted) must confirm.

**Address masters (Master > Generals > Location).** The Philippine address format is used on every address form
(leads, clients, claims, endorsements, My Profile): House / Unit No., Street, Barangay, City / Municipality, Province,
Region, ZIP code, with the cascade Region -> Province -> City / Municipality -> Barangay. Choosing a province fills its
region, choosing a city suggests its ZIP code, and a ZIP code typed first fills the city, province and region. The
barangay is picked from a list where the city's barangays are loaded, otherwise typed.

| Master | Delivered | Source |
|---|---|---|
| Region (shown with the provinces; `Region_Upload_Template.xlsx`) | 18 regions in the PSA order: NCR, CAR, Region I to XIII, MIMAROPA, NIR (Negros Island Region, Republic Act No. 12000 of 2024) and BARMM | PSGC |
| Province (formerly called State; `Province_Upload_Template.xlsx`) | 82 provinces with their ISO 3166-2:PH code (e.g. CEB) and PSGC code, plus Metro Manila (the 17 local government units of NCR) and the BARMM Special Geographic Area | PSGC |
| City / Municipality (`City_Municipality_Upload_Template.xlsx`) | 1,642 cities and municipalities (149 cities: 33 highly urbanised, 5 independent component, 111 component; 1,493 municipalities) with PSGC code, class, main ZIP code and, for Metro Manila, its district. A highly urbanised city is listed under the province it lies in (Cebu City under Cebu); Isabela City is listed under Basilan and keeps Region IX | PSGC; ZIP codes from PHLPost |
| Barangay (`Barangay_Upload_Template.xlsx`) | the 1,715 barangays of Metro Manila. The 42,010 barangays of the whole country are an optional load (below) | PSGC |
| ZIP codes | 1,846 PHLPost ZIP codes with the place they serve (ZIP code look-up on the address forms) | PHLPost list |

Release: **PSGC 2Q 2026** of the Philippine Statistics Authority (as of 30 June 2026), the edition with 18 regions and
82 provinces; ZIP codes from the PHLPost ZIP code list (GeoNames, CC BY 4.0, mappings reviewed against the PHLPost ZIP
Code Locator). The release is recorded in `backend/src/db/reference/psgc/VERSION` and on the Philippines record of the
Country master (`PsgcRelease`). PSA data is published under CC BY 4.0. The files were taken from the npm packages
`@ianlabicani/geoph-lite` 2.0.0 (hierarchy, city / municipality class, barangays) and `@aivangogh/ph-address` 2026.2.3
(ZIP codes), both built from the PSA publication of the same quarter; the PSA site itself could not be reached from
the build environment, so compare the counts above with the PSA summary of the quarter when you receive the
official file.

To load **all barangays** (about 42,000) on the server, after the API has started once:

    cd backend
    node scripts/load-barangays.js                       # dry run: what would be added
    node scripts/load-barangays.js --execute             # load (one transaction; run again at any time)
    node scripts/load-barangays.js --execute --region=VII,NCR   # only some regions

It adds what is missing, gives the PSGC code to barangays entered by hand with the same name, and never deletes or
renames. A newer PSGC release: replace the CSV files of `backend/src/db/reference/psgc` (same columns), update
`VERSION`, run `node scripts/build-ph-geography.js` to regenerate `src/db/seeds/12_ph_geography.sql` and deploy; the
seed adds the new cities and attaches PSGC codes to records entered before. A single record can also be added with
the upload templates above (up to 1,000 rows per file) or on the screen. The full province / city list is in the
configuration workbook (sheets Regions, Provinces, Cities and Municipalities; Barangays carries only the barangays
you added, not the PSGC list).

**Practice masters (reference lists, API `/api/masters/<type>`, upload templates in the same folder).**

| Master | Delivered |
|---|---|
| Salutation | Mr., Ms., Mrs., Miss, Dr., Atty., Engr., Arch., Hon., Rev. |
| Civil Status | Single, Married, Widowed, Legally Separated, Annulled, Divorced |
| Gender | Male, Female |
| Nationality | Filipino (default) and 16 other nationalities |
| Government ID Type | PhilSys National ID (PhilID / ePhilID), UMID, SSS ID, GSIS eCard, TIN ID, Passport, Driver's License, PRC ID, Postal ID, Voter's ID / Certification, Senior Citizen ID, PWD ID, with the issuing agency and an example of the number format. The KYC list of the policy screen is the setting `policy.kyc_id_types` |
| Customer Type | Individual; Sole Proprietorship (DTI business name registration); Partnership, Stock Corporation, One Person Corporation, Non-stock Corporation / Foundation, Branch of a Foreign Corporation (SEC registration or licence); Cooperative (CDA); Homeowners' Association (DHSUD); Government Agency / GOCC; each with its registration authority and the label of its registration number |
| Payment Mode (Master > Finance) | Cash, Check, Post-dated Check, Bank Deposit, InstaPay, PESONet, GCash, Maya, Credit Card, Debit Card, each with the way it is captured (cash, check, bank transfer, online, card) |
| Holiday | The regular holidays and special non-working days of 2026 and 2027 (42 dates) |
| Bank (Master > Finance > Bank) | BDO, BPI, Metrobank, Land Bank, PNB, Security Bank, UnionBank, RCBC, China Bank, EastWest, DBP, PSBank, AUB, Maybank Philippines, PBCom, Bank of Commerce, Veterans Bank, with their head-office SWIFT code and category |
| Insurance Company | The non-life insurers licensed by the Insurance Commission (51), **inactive** except the starter set MAPFRE, Malayan, Pioneer, FPG, Standard and Mercantile. Activate the insurers you place with (Master > Generals > Insurance Management > Insurance Company) and fill their IC Certificate of Authority number and validity, TIN, address and remittance e-mail |
| Currency | PHP (₱) as the base currency |
| Taxes and charges (Master > Finance > Premium Taxes & LGU Rates) | VAT 12%; Documentary Stamp Tax PHP 0.50 on each PHP 4.00 of premium (NIRC s.184, 12.5%); Fire Service Tax 2% of fire premium (Fire Code); premium tax 2% for the premium-tax regime; Local Government Tax at the rate of the city / municipality in LGU Tax Rates, else 0.75%; the CTPL premiums of the motor tariff |
| LGU Tax Rates | 10 Metro Manila cities at 0.2%, linked to their City / Municipality record. Every city and municipality of the City / Municipality master can be given its rate (the LGU list for the LGT) |

The holiday list is a reference list: no due date is computed from it yet (BrokerVerse counts calendar days for
warranties, renewals and reminders).

**To confirm before go-live** (by the broker; the tax items with its tax adviser):

| Item | What to confirm |
|---|---|
| Insurance Company list | The names, the "as of" date and the licence status against the Insurance Commission's current list of non-life insurance companies with a valid Certificate of Authority. The delivered list was compiled from the IC list known in 2025, not downloaded from the IC site; add any licensed insurer missing, deactivate any that lost its licence. Enter the IC certificate number and validity of each insurer you activate |
| Holidays | The 2026 dates against the proclamation of the 2026 holidays, and the 2027 dates when the 2027 proclamation is issued; the dates of Eid'l Fitr and Eid'l Adha (declared each year by a separate proclamation) and whether 25 February (EDSA anniversary) is a special non-working or working day. Add the local special days of the cities where you have offices |
| Banks | The SWIFT codes of the banks you remit through (the delivered codes are the head-office BIC) and add the banks missing |
| LGU Tax Rates | The local government tax rate of each city / municipality where you place business (the 10 delivered Metro Manila rates of 0.2% and the 0.75% default are examples to confirm against each city's revenue code) |
| Taxes | VAT, DST, FST, premium tax rates and their GL accounts (Step 5) |
| ZIP codes | The main ZIP code of the cities and municipalities where most of your clients are. The list comes from the PHLPost list as published by GeoNames; where a town had two codes, the one outside its province's ZIP range was dropped (9 entries, e.g. Alcoy, Cebu keeps 6023). The ZIP code is only suggested on the forms and can be overwritten |
| Government ID number formats | The number formats are examples for the users, not validation rules |
| Customer types | The registration authorities and labels used in your KYC process |

## Step 1. Company and letterhead

- **Screen:** Master > Generals > Organization > Company.
- **Enter:** edit the delivered company record (iorta TechNXT Corp.) into your own: company name, TIN, Insurance
  Commission licence number, address, e-mail, telephone, web site, logo. Keep **Is Primary** on: the primary company
  is the letterhead of every printed document and report. The application name and the logo of the screens and the
  sign-in page come from the brand pack of the deployment (`BRAND_PACK`).
- **Template:** `Company_Upload_Template.xlsx` only if you have more than one company (no Upload button on this screen).
- **Check:** print a billing statement or run any report as PDF and look at the letterhead and TIN.

## Step 2. Branches and departments

- **Screen:** Master > Generals > Organization > Branch; departments from the Branch screen.
- **Enter:** one branch per office (code, name, company, e-mail, address), then the departments you use for vouchers
  and cost reporting.
- **Template:** `Branch_Upload_Template.xlsx`, `Department_Upload_Template.xlsx` (no Upload button on these screens).
- **Check:** the branches appear in the branch drop-downs of Add user and Journal Voucher.

## Step 3. Users and roles

- **Screen:** Master > Generals > User Management > User. Roles are fixed: System Administrator (Super Admin),
  Sales & Marketing, Processing Team, Operations, Claims, Accounting, Accounting Manager.
- **Enter:** one user per person with a single role, e-mail address and branch. BrokerVerse shows a temporary password
  once; hand it to the user privately. Give the System Administrator role to as few people as possible.
- **Template:** `Users_Provisioning_Template.xlsx` / `.csv` for many users at once. It is run on the server by the
  System Administrator with `backend/scripts/provision-users.js` (dry run first, then `CONFIRM_PROVISION=yes`). The
  file holds initial passwords: keep it outside the repository and delete it after use. The credentials sheet you hand
  out is kept outside the repository too.
- **Security settings:** Master > Configuration > Security. Check the password rules (8 characters, upper and lower
  case, digit, symbol, history 5, expiry 90 days), lockout after 5 wrong passwords, and list the roles that must use
  two-step verification (`security.require_2fa_roles`, recommended: system-admin, accounting, accounting-manager).
- **Check:** each user signs in, changes the password and sees only the menus of the role (`GETTING_STARTED.md`,
  section 2).

## Step 4. Insurers, credit terms and commission

- **Screen:** Master > Generals > Insurance Management > Insurance Company (Upload button); commission rates in
  Master > Finance > Commission Rate Matrix.
- **Enter:** every insurer you place with: code, name, TIN, address, e-mail for remittances and debit notes, default
  commission rate (a fraction: 0.20 for 20%), premium payment warranty days, remittance terms in days, default billing
  (broker or direct). Then the commission rates per insurer, product or line of business.
- **Delivered:** the non-life insurers licensed by the Insurance Commission, inactive except the starter set (see
  Philippine settings above): activate yours instead of adding them, and fill the IC Certificate of Authority number.
- **Template:** `Insurance_Company_Upload_Template.xlsx`. The Commission Rate Matrix (Master > Finance) is the only
  commission source pricing reads; it has no upload, enter it on the screen.
- **Check:** create a test quotation for each main insurer and compare the commission with the insurer's agreement.

## Step 5. Products, motor tariff and tax codes

- **Screens:** Master > Generals > Insurance Management > Line of Business, Product, Cover, Vehicle (Upload button
  for brands, models, variants and vehicles); Product Configurator > Product Templates for the motor tariff (CTPL
  amounts per vehicle class, Auto Passenger PA); Master > Finance > Taxation for tax codes.
- **Enter:** only what the delivered data lacks. BrokerVerse ships Philippine lines of business, products, covers,
  vehicle makes and the 2025 motor tariff. Tax codes ship with VAT 12%, DST 12.5%, LGT 0.75% and the expanded
  withholding codes with their BIR ATC; have your tax adviser confirm the rates and GL accounts.
- **Templates:** `Line_of_Business_…`, `Product_…`, `Policy_Type_…`, `Cover_…`, `Vehicle_Brand_…`, `Vehicle_Model_…`,
  `Vehicle_Variant_…`, `Vehicle_Upload_Template.xlsx`. Tax codes have no upload.
- **Check:** quote one private car and one fire risk; compare the premium, VAT, DST and LGT with a manual calculation.

## Step 6. Chart of accounts review

- **Screen:** Master > Finance > Main Account and Sub Account (the chart of accounts; Upload button).
- **Enter:** review the delivered Philippine broker chart with your accountant. Add missing accounts, rename accounts
  and deactivate those you do not use. Accounts used by the system settings (cash, premiums receivable, due to
  insurers, commission income, VAT and withholding, current year profit, retained earnings) cannot be deactivated;
  change their mapping in Master > Configuration > Accounting first if needed.
- **Template:** `Chart_of_Accounts_Upload_Template.xlsx`. An existing account code updates that account; put a main
  account before its sub accounts.
- **Check:** Accounts > Period End > Financial Statements, trial balance for any date: every account you need is
  listed under the right statement group.

## Step 7. Banks and bank accounts

- **Screen:** Master > Finance > Bank (Upload button: choose Banks or Bank accounts); then Accounts > Bank
  Reconciliation to check each account's GL link and statement format.
- **Enter:** the banks you deal with that are not delivered (the main Philippine banks are, with their SWIFT codes),
  then each company bank account: account code, bank, account number, type,
  currency, the GL cash account it reconciles to, the statement format (BDO-SAMPLE, BPI-SAMPLE, MBT-SAMPLE or GENERIC)
  and the reconcile-from date (normally the go-live date). Signatories in Master > Generals > Insurance Management >
  Signatories.
- **Templates:** `Bank_Upload_Template.xlsx`, `Bank_Account_Upload_Template.xlsx`, `Signatories_Upload_Template.xlsx`.
- **Check:** import one recent statement of each account (`Bank_Statement_Generic_Upload_Template.xlsx` for banks
  without a delivered format) with **Preview** first; the preview must balance.

## Step 8. Document numbering

- **Screen:** Master > Configuration > Document Numbering.
- **Enter:** prefix, format and the next number of each series. To continue the old system's numbering (official
  receipts, invoices, payment vouchers, journal vouchers), set the next number to the last number used plus one. Your
  BIR-registered official receipt series must match the ATP.
- **Check:** create one test document of each series on a test day before go-live or read the preview on the screen.

## Step 9. E-mail and notifications

- **Where:** the SMTP account is an environment setting of the server (`SMTP_URL`, see the go-live checklist).
  E-mail texts, the sender name and notification recipients are in Master > Configuration (sections E-mail,
  Notifications, Security for the password reset e-mail).
- **Enter:** the texts in your company's wording and the recipient lists (finance mailbox for payment verifications,
  claims mailbox).
- **Check:** use **Forgot password?** with a test user and confirm the code arrives; send one quotation approval link to
  an internal address.

## Step 10. Schedules

- **Screen:** Master > Configuration > Schedules.
- **Enter:** review each job and its time. Receivable ageing, collection reminders, renewal notices and queue, policy
  and quotation expiry, daily reports, the e-mail outbox and housekeeping run by default. The month-end reminder,
  recurring journals, accrual reversal, period auto soft-close and bank auto-match are delivered switched off; switch
  on those Accounting wants.
- **Check:** run "Receivable ageing" once with **Run now** and read the run history.

## Step 11. Opening data from the old system

Load in this order. Each file is checked row by row; fix the rows reported and upload again.

1. **In-force policies** (and their clients): Operations > Policy > Bulk Upload with **Existing policies (go-live)**
   ticked. Template `Policies_Upload_Template.xlsx`. In go-live mode each row creates the client and the policy with
   its insurer at 100% but no bill, journal or commission. Co-insured policies are entered on the screen. Each row
   creates a new client, so a client with several policies appears once per policy; merge them afterwards on the
   Clients screen if needed. Check: Operations > Policy lists the policies with the right insurer, dates and premium.
2. **Open premium receivables:** Accounts > Collections > **Import open items**, with the go-live date. Template
   `Open_Items_Upload_Template.xlsx`: one row per unpaid bill (policy number, old bill reference, due date, original
   amount, open balance). No journal is posted. Rows already loaded for the same go-live date are skipped, so you can
   upload the corrected file again. Check: the Collections list and the ageing report total equal the old system's
   receivable ageing at the day before go-live.
3. **GL opening balances:** Accounts > Period End > Period Management > **Import opening balances**, with the same
   go-live date. Template `Opening_Balances_Upload_Template.xlsx`: the old trial balance, one row per account with a
   debit or a credit. Debits must equal credits, otherwise nothing is loaded. Loading again with the same date replaces
   the earlier load. The balance of Premiums Receivable must equal the total open balance of step 2, and Due to
   Insurers must equal what you still owe insurers. Check: Accounts > Period End > Financial Statements, trial balance
   as at the go-live date, agrees with the old trial balance.
4. **Leads and quotations in progress** (optional): Operations > Leads/Prospects > Bulk Upload and Operations >
   Quotation > Bulk Upload with `Leads_Upload_Template.xlsx` and `Quotations_Upload_Template.xlsx`.

Points to know:

- The opening balances go into the fiscal year that contains the go-live date and are read by the trial balance,
  financial statements, GL detail and bank reconciliation of Accounts > Period End; the year-end close carries them
  forward. Screens that add up journals only (such as Accounting Query) show movements from the go-live date.
- A go-live date after journals already posted in the same fiscal year is refused, because those journals would be
  counted twice. Load the balances before anyone posts.
- Premium on an open item is collected with a normal official receipt. The amount still due to the insurer for such a
  bill is part of the Due to Insurers opening balance; pay it with a payment voucher (template
  `Disbursements_Upload_Template.xlsx` for many at once) rather than through the remittance run, which only sees bills
  booked in BrokerVerse.
- Close the accounting periods of the fiscal year before the go-live date (Accounts > Period End > Period Management)
  so nothing is posted into them by mistake.

## Step 12. First month-end

At the end of the first month, Accounting prepares and the Accounting Manager approves:

1. Accounts > Bank Reconciliation: import the month's statements, match, prepare and approve each reconciliation.
2. Accounts > Remittance: remit collected premium to insurers; Accounts > Disbursement for payments due.
3. Accounts > Period End > Month-End Close: start the run for the month, work through the checklist (unposted journals,
   unreconciled banks, open receipts), execute the steps (accruals, recurring journals, commission deferral, FX
   revaluation) and send it for approval.
4. Accounting Manager approves the run; the period closes.
5. Accounts > Tax: VAT summary, SAWT, QAP and Form 2307 for the month.
6. Compare the trial balance with the go-live opening balances plus the month's activity, and keep the reports.

Plan a review meeting after the first close with Accounting, the Accounting Manager and support to note what to
change in the settings.
