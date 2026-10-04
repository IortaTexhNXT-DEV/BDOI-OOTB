# Go-live data set-up

For the System Administrator and Accounting. It gives the order in which to set up the company in BrokerVerse before
users start working, and for each step the screen, what to enter, the template to use and how to check the result.
The technical installation (servers, database, secrets, SMTP account) is in `deploy/README.md` and must be
finished first.

The templates are in `docs/templates`. Each has a Data sheet with the exact headers and a sample row to delete, a
Columns sheet and an Instructions sheet. On screens with an **Upload** button the same template is under
**Download template**. Screens without an Upload button are marked below; for those a System Administrator loads the
file through the API route written on the template's Instructions sheet, or enters the records on the screen.

Most of the steps below can also be done with two workbooks on **Master > Go-Live Data Load**: the configuration
workbook (steps 1 to 8: company, users, masters, chart of accounts, commission rates, numbering, settings) and the
migration workbook (step 11: clients, in-force policies, open items, open claims, opening balances), each validated as
a whole before anything is saved. See `GO_LIVE_DATA_WORKBENCH.md`.

Agree a **go-live date** with Accounting before you start: the first day on which transactions are entered in
BrokerVerse. Balances and open items are taken from the old system at the close of the day before.

## Step 1. Company and letterhead

- **Screen:** Master > Generals > Organization > Company.
- **Enter:** edit the delivered company record (iorta TechNXT Corp.) into your own: company name, TIN, Insurance
  Commission licence number, address, e-mail, telephone, web site, logo. Keep **Is Primary** on: the primary company
  is the letterhead of every printed document and report. Then Master > System Settings for the application name and
  logo shown on the sign-in page.
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
- **Enter:** the banks you deal with, then each company bank account: account code, bank, account number, type,
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
