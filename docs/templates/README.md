# Upload templates

One workbook per upload that BrokerVerse accepts. Hand these to the people preparing go-live data and day-to-day bulk
uploads. Each workbook has three sheets:

- **Data**: the header row the importer reads, with one or two Philippine sample rows. Required columns have dark red
  headers. Delete the sample rows before uploading your own data.
- **Columns**: each column with required (yes, no or conditional), format, allowed values, an example and other header
  names the importer also accepts.
- **Instructions**: the screen to upload on, the API route, file types, row limit and what happens when a row is wrong.

The same templates can be downloaded on the screens that have an Upload or Import button (master screens, Chart of
Accounts, Period Management, Collections).

## Keeping them in step with the code

The templates are generated, not edited by hand. The column lists come from the importers themselves:

| Upload | Source of the columns |
|---|---|
| Leads, quotations, policies, receipts, payment vouchers | `LEAD_UPLOAD_COLUMNS`, `QUOTE_UPLOAD_COLUMNS`, `POLICY_UPLOAD_COLUMNS`, `RECEIPT_UPLOAD_COLUMNS`, `DISBURSEMENT_UPLOAD_COLUMNS` in the module services; the importers map rows with the same lists |
| Chart of accounts | `ACCOUNT_UPLOAD_COLUMNS` (`backend/src/modules/accounting/service.js`) |
| Opening balances, open items | `OPENING_BALANCE_COLUMNS` (`period-end/opening.js`), `OPEN_ITEM_COLUMNS` (`receipts/opening.js`) |
| Masters | the field definitions of the master type (`master_types`, seeded in `51_masters.sql`); samples and menu paths in `backend/src/modules/masters/uploadSamples.js` |
| Bank statement | the GENERIC statement format (`bank_statement_formats`) |
| Remittance bulk processing | the field mappings of the Bulk Processing master (BFM-001) |
| Remittance bank transactions, users | the screen parser (`brokerverse/src/module/Remittance/Reconciliation/index.js`) and `backend/scripts/provision-users.js`; the test checks the headers against both |

Regenerate after changing an importer, a master type, the GENERIC format or the bulk-processing configuration:

```
cd backend
DATABASE_URL=postgres://... node scripts/build-upload-templates.js      # writes ../docs/templates
```

`backend/test/upload-templates.test.js` builds the templates and reads each one back with its importer's own parser
and column list, so a header that the importer no longer reads fails the test.

## Templates and verification

Verified on 39 templates: a backend on port 8210 with a fresh database (`brokerverse_tpl`, migrated and seeded
with `SEED_SAMPLE_DATA=true`) received the sample rows of each template, unchanged, through the real API as the System
Administrator, in the order of the table. Opening balances and open items were loaded with go-live date 2027-01-01,
because the sample data already has posted journals in fiscal year 2026 (a go-live date after posted journals of the
same fiscal year is refused). The bank statement was imported into bank account ACC-BDO-001 with format GENERIC.
Required columns are in bold.

| Template | Screen | Route | Columns | Result |
|---|---|---|---|---|
| `Chart_of_Accounts_Upload_Template.xlsx` | Master > Finance > Main Account > Upload | `POST /api/accounting/accounts/upload` | **Account Code**, **Account Name**, Account Type, Main Account Code, Statement Group, Category, Normal Balance, Open Item, Allow Manual JV, Status, Description | Accepted: created 2, failed 0 |
| `Company_Upload_Template.xlsx` | Master > Generals > Organization > Company (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/company/upload` | **Company Code**, **Company Name**, License Number, TIN, Email ID, Logo, Website link, Description, Address Line 1, Address Line 2, Address Line 3, Pin Code, City, State, Country, Phone Number, Fax, Letterhead company - used on documents and reports, Status | Accepted: created 1, failed 0 |
| `Branch_Upload_Template.xlsx` | Master > Generals > Organization > Branch (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/branch/upload` | **Branch Code**, **Branch Name**, **Company Name**, **Email ID**, Description, Address Line 1, Address Line 2, Address Line 3, **City**, **State**, **Country**, Phone Number, Fax, Status | Accepted: created 1, failed 0 |
| `Department_Upload_Template.xlsx` | Master > Finance > Department (reached from the Branch screen) (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/department/upload` | **Department Code**, **Department Name**, Description, Branch Code, Status | Accepted: created 1, failed 0 |
| `Insurance_Company_Upload_Template.xlsx` | Master > Generals > Insurance Management > Insurance Company > Upload | `POST /api/masters/insurance-company/upload` | **Insurance Company Code**, **Insurance Company Name**, Description, Short Name, TIN, Address Line 1, Address Line 2, Address Line 3, **City**, **State**, **Country**, **Email ID**, **Phone Number**, Contact Person, Default Commission Rate, Premium Payment Warranty (days), Remittance Terms (days after collection), Default Billing Mode, Status | Accepted: created 1, failed 0 |
| `Line_of_Business_Upload_Template.xlsx` | Master > Generals > Insurance Management > Line of Business (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/line-of-business/upload` | **Line of Business Code**, **LOB Name**, **LOB Description**, Status | Accepted: created 1, failed 0 |
| `Product_Upload_Template.xlsx` | Master > Generals > Insurance Management > Product (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/product/upload` | **Product Code**, **Product Name**, **Product Description**, **Line of Business**, Status | Accepted: created 1, failed 0 |
| `Policy_Type_Upload_Template.xlsx` | Master > Generals > Insurance Management > Product (policy types) (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/policy-type/upload` | **Policy Type Code**, **Policy Type Name**, Description, **Product**, Status | Accepted: created 1, failed 0 |
| `Cover_Upload_Template.xlsx` | Master > Generals > Insurance Management > Cover (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/cover/upload` | **Cover Code**, **Cover Name**, **Cover Description**, Status | Accepted: created 1, failed 0 |
| `Signatories_Upload_Template.xlsx` | Master > Generals > Insurance Management > Signatories (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/signatory/upload` | **Signatory Code**, **Signatory Name**, **Signatory Description**, Designation, Signature (uploaded file key), Status | Accepted: created 1, failed 0 |
| `Vehicle_Brand_Upload_Template.xlsx` | Master > Generals > Insurance Management > Vehicle (choose Vehicle brands in the Upload dialog) > Upload | `POST /api/masters/vehicle-brand/upload` | **Brand**, Status | Accepted: created 1, failed 0 |
| `Vehicle_Model_Upload_Template.xlsx` | Master > Generals > Insurance Management > Vehicle (choose Vehicle models in the Upload dialog) > Upload | `POST /api/masters/vehicle-model/upload` | **Brand**, **Model**, Status | Accepted: created 1, failed 0 |
| `Vehicle_Variant_Upload_Template.xlsx` | Master > Generals > Insurance Management > Vehicle (choose Vehicle variants in the Upload dialog) > Upload | `POST /api/masters/vehicle-variant/upload` | **Model**, **Variant**, Body Type, Seating, Status | Accepted: created 1, failed 0 |
| `Vehicle_Upload_Template.xlsx` | Master > Generals > Insurance Management > Vehicle > Upload | `POST /api/masters/vehicle/upload` | **Vehicle Code**, **Vehicle Name**, **Vehicle Variant**, **Vehicle Model**, **Vehicle Brand**, **Seating Capacity**, Body Type, Status | Accepted: created 1, failed 0 |
| `Country_Upload_Template.xlsx` | Master > Generals > Location > Country > Upload | `POST /api/masters/country/upload` | **Country Name**, **ISO Code**, **Description**, Phone Code, Status | Accepted: created 1, failed 0 |
| `State_Upload_Template.xlsx` | Master > Generals > Location > State > Upload | `POST /api/masters/state/upload` | **State Code**, **State Name**, **Description**, **Country**, Status | Accepted: created 1, failed 0 |
| `City_Upload_Template.xlsx` | Master > Generals > Location > City Master > Upload | `POST /api/masters/city/upload` | **City Code**, **City Name**, **Description**, **State**, Postal Code, Status | Accepted: created 1, failed 0 |
| `Bank_Upload_Template.xlsx` | Master > Finance > Bank > Upload | `POST /api/masters/bank/upload` | **Bank Code**, **Bank Name**, **Bank Branch**, **IFSC / SWIFT Code**, Address Line 1, Address Line 2, Address Line 3, **City**, **State**, **Country**, **Phone**, Fax, **Email ID**, Category, Status | Accepted: created 1, failed 0 |
| `Bank_Account_Upload_Template.xlsx` | Master > Finance > Bank (choose Bank accounts in the Upload dialog) > Upload | `POST /api/masters/bank-account/upload` | **Account Code**, **Account Name**, **Bank Code**, Bank Name, **Account Number**, **Account Type**, **Currency**, GL Account, Branch, Branch Code, SWIFT Code, Opening Date, Contact Person, Contact Number, E-mail, GL Cash Account (bank reconciliation), Bank Statement Format, Reconcile From (date), Status | Accepted: created 1, failed 0 |
| `Currency_Upload_Template.xlsx` | Master > Finance > Currency > Upload | `POST /api/masters/currency/upload` | **Currency Code**, **ISO code**, **Smallest Unit**, **Unit Description**, **Currency Name**, Description, **Currency Format**, **Number of Decimals**, Symbol, Accounting base currency, Status (exchange rates: Exchange Rate master) | Accepted: created 1, failed 0 |
| `Exchange_Rate_Upload_Template.xlsx` | Master > Finance > Exchange Rate (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/exchange-rate/upload` | **Effective From**, **Effective To**, **Currency Code**, **To Currency Code**, **Exchange Rate**, Currency Description, To Currency Description, Status | Accepted: created 1, failed 0 |
| `Transaction_Code_Upload_Template.xlsx` | Master > Finance > Transaction code > Upload | `POST /api/masters/transaction-code/upload` | **Transaction Code**, **Transaction Name**, **Description**, **Transaction Basis**, **Main Account Code**, Main Account Description, Sub Account Code, Sub Account Description, Branch Code, Branch Description, Department Code, Department Description, User Group Access [{ UserRole, MinimumTransaction, MaximumTransaction }], Status | Accepted: created 1, failed 0 |
| `Commission_Upload_Template.xlsx` | Master > Generals > Commission (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/commission/upload` | **Commission Code**, **Description**, **Insurance Company**, **Product**, **Cover**, **Maximum Rate (%)**, Agent / Referrer, **Effective From**, **Effective To**, Sharing by level [{ level, sharingRate }], Status | Accepted: created 1, failed 0 |
| `Hierarchy_Upload_Template.xlsx` | Master > Generals > Employee Management > Hierarchy (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/hierarchy/upload` | **Rank Code**, **Rank Name**, Description, **Level Number**, Status | Accepted: created 1, failed 0 |
| `Designation_Upload_Template.xlsx` | Master > Generals > Employee Management > Designation (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/designation/upload` | **Designation Code**, **Designation Name**, Description, **Department Code**, Level, Reporting to Level, Status | Accepted: created 1, failed 0 |
| `Employee_Upload_Template.xlsx` | Master > Generals > Employee Management > Employee (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/employee/upload` | **Employee Code**, **First Name**, Middle Name, **Last Name**, **Employee Type**, **Designation**, Reporting To, **Branch Code**, **Department Code**, **ID Proof Type**, **ID Number**, Address Line 1, Address Line 2, Address Line 3, **City**, **State**, **Country**, E-mail, Status | Accepted: created 1, failed 0 |
| `Write_off_Reason_Upload_Template.xlsx` | Master > Finance > Account Determination (write-off reasons) (no Upload button on this screen yet: a System Administrator uploads the file through the API route) | `POST /api/masters/write-off-reason/upload` | **Reason Code**, **Reason**, **GL Account**, Maximum Amount, Description, Status | Accepted: created 1, failed 0 |
| `Petty_Cash_Upload_Template.xlsx` | Master > Finance > Petty cash > Upload | `POST /api/masters/petty-cash/upload` | **Petty Cash Code**, **Petty Cash Name**, **Petty Cash Size**, **Available Cash**, **Minimum Cash Box**, **Transaction Limit**, Custodian, Branch Code, Status | Accepted: created 1, failed 0 |
| `Leads_Upload_Template.xlsx` | Operations > Leads/Prospects > Bulk Upload | `POST /api/leads/bulk-upload` | First Name, Last Name, Preferred Name, Company Name, Date of Birth, Gender, Email, Contact Number, House No, Barangay, City, Province, Country, Zip Code, Lead Category, TIN, LOB, Source | Accepted: created 2, failed 0 |
| `Quotations_Upload_Template.xlsx` | Operations > Quotation > Bulk Upload | `POST /api/quotations/bulk-upload` | Lead Id, First Name, Last Name, Company Name, Email, Contact Number, Product Type, Policy Type, Insurance Company, Sum Insured, Own Damage, OD Rate, Net Premium, Discount, Remarks | Accepted: created 1, failed 0 |
| `Policies_Upload_Template.xlsx` | Operations > Policy > Bulk Upload | `POST /api/policies/bulk-upload` | Policy Number, Insured Name, First Name, Last Name, Company Name, Email, Contact Number, Product Type, Insurance Company, Inception Date, Expiry Date, Issue Date, Sum Insured, Net Premium, **Gross Premium**, Plate Number, Payment Status | Accepted: created 2, failed 0 |
| `Receipts_Upload_Template.xlsx` | Accounts > Receipts > Bulk upload | `POST /api/receipts/bulk-upload` | **Policy Number**, **Amount**, Receipt Date, Payment Mode, Reference No, Customer Code, Transaction Code, Remarks | Accepted: created 1, failed 0 |
| `Disbursements_Upload_Template.xlsx` | Accounts > Disbursement > Bulk upload | `POST /api/disbursements/bulk-upload` | Voucher Date, Payee Type, Customer Code, Insurer Name, Policy Number, Referrer Id, Amount, Payment Mode, Transaction Code, Transaction Description, Remarks | Accepted: created 1, failed 0 |
| `Opening_Balances_Upload_Template.xlsx` | Accounts > Period End > Period Management > Import opening balances | `POST /api/period-end/opening-balances/import` | **Account Code**, Account Name, Debit, Credit | Accepted: 7 accounts, debits 2102400 = credits 2102400 (FY2027) |
| `Open_Items_Upload_Template.xlsx` | Accounts > Collections > Import open items | `POST /api/receipts/opening-items/import` | **Policy Number**, **Bill Reference**, **Due Date**, Original Amount, **Open Balance** | Accepted: created 1, failed 0 |
| `Remittance_Bank_Transactions_Template.xlsx` and `Remittance_Bank_Transactions_Template.csv` | Accounts > Remittance > Reconciliation > Import | `The screen reads the CSV in the browser and sends POST /api/remittance/reconciliation/bank-transactions` | **TransDate**, **Reference**, **Amount**, Description | Accepted: 1 line(s) imported 1 bank transaction(s) imported (CSV parsed as the screen does) |
| `Users_Provisioning_Template.xlsx` and `Users_Provisioning_Template.csv` | Not a screen upload: run by the System Administrator on the server with backend/scripts/provision-users.js (dry run first, then CONFIRM_PROVISION=yes). Single users are added in Master > Generals > User Management > User. | `node scripts/provision-users.js /secure/path/users.csv` | **name**, **username**, **password**, **role**, email | Accepted: provision-users.js dry run listed "create alim (Andrea Lim) as accounting"; with CONFIRM_PROVISION=yes the user was created and signed in with the initial password (password change required) |
| `Bank_Statement_Generic_Upload_Template.xlsx` | Accounts > Bank Reconciliation > Reconciliation Workspace > Import statement (format GENERIC) | `POST /api/bank-reconciliation/statements/import` | **Date**, Value Date, Description, Reference, Debit, Credit, Balance | Accepted: BST-2026-00002, 3 lines |
| `Remittance_Bulk_Upload_Template.xlsx` | Accounts > Remittance > Bulk Processing > Upload / Validate, then Process | `POST /api/remittance/bulk/upload` | **PolicyNo**, **Premium**, **Commission**, InsuredName | Accepted: 1 valid, 0 errors File validated |

## Uploads that have no template

| Upload control | Why there is no template |
|---|---|
| Document and photo uploads (policy documents, IDs, vehicle photos, claim documents, endorsement documents, logo) | Single files stored as attachments, not rows of data |
| Bank statements of BDO, BPI and Metrobank | Upload the bank's own export with its format (BDO-SAMPLE, BPI-SAMPLE, MBT-SAMPLE); the generic template is for other banks |
| Employee Flow > Bulk Upload Employees (group quotation screen) | The screen only picks a file; nothing is sent to the API |
| Tax codes (Master > Finance > Taxation) | No upload; the Philippine codes ship with the system and are edited on the screen |
| Commission Rate Matrix, users and roles on the screen | No upload; entered on the screen (named users can be created in bulk with the Users provisioning file) |
| Main Account and Sub Account masters | Copies of the chart of accounts; use the Chart of Accounts template |
