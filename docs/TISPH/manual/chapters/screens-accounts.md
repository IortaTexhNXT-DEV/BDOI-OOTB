# Screen reference: Accounts {#screens-accounts}

The screens of the Accounts menu, in menu order: receipts and collections, Cash Control, disbursements and payables, remittance to insurers, journal vouchers, reconciliations, tax, period end and incentives.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role.

## Verify payments and post official receipts {#verify-payments-and-post-official-receipts}

When Operations or Sales record a client payment, the policy payment status becomes Reviewing and Accounting receives the notification to verify it. Open the notification, check the payment against the bank statement and confirm it (the official receipt is posted) or reject it with a reason. Accounting users can also record a payment and issue the receipt directly from the policy.

{{screen:/accounts/receipts}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Collections {#collections}

Accounts > Collections lists every open premium with **Client Name**, **Policy No.**, **Outstanding** spread over the ageing buckets (**Current**, **1-30 Days**, **31-60 Days**, **61-90 Days**, **Over 90 Days**), **Due Date**, **Status** (Pending, Committed, Overdue), **Days Overdue** and **View**. Filter by status and overdue level.

{{screen:/agent/collections}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Credit control {#credit-control}

{{screen:/accounts/credit-control/instalments}}

{{screen:/accounts/credit-control/warranty}}

{{screen:/accounts/credit-control/limits}}

{{screen:/accounts/credit-control/remittance-ageing}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Post-dated cheques {#post-dated-cheques}

Accounts > Post-Dated Cheques is the register of cheques received from clients before their date.

{{screen:/accounts/post-dated-cheques}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Claims settlements paid through the broker {#claims-settlements-paid-through-the-broker}

{{screen:/accounts/claims-settlements}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Accounts payable {#accounts-payable}

Suppliers are kept on Accounts > Payables > Suppliers: TIN, address, VAT registration, the EWT tax code withheld (Master > Finance > Taxation, for example WC158 goods, WC160 services, WC100 rentals), payment terms and the default expense account.

{{screen:/accounts/payables/invoices}}

{{screen:/accounts/payables/payments}}

{{screen:/accounts/payables/ageing}}

{{screen:/accounts/payables/suppliers}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## BIR Form 2307 for suppliers {#bir-form-2307-for-suppliers}

The expanded withholding tax withheld from a supplier on an approved supplier invoice (the supplier's EWT tax code, on the amount net of VAT) is creditable tax of the supplier: the broker issues BIR Form 2307 for it each quarter.

{{screen:/accounts/payables/2307}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Fixed assets and depreciation {#fixed-assets-and-depreciation}

{{screen:/accounts/fixed-assets/register}}

{{screen:/accounts/fixed-assets/depreciation}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Asset disposal {#asset-disposal}

An asset sold or written off (lost, stolen, damaged beyond repair, obsolete) leaves the register through a disposal.

{{screen:/accounts/fixed-assets/disposals}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Disbursement: payment vouchers and cheques {#disbursement-payment-vouchers-and-cheques}

A payment voucher (PV-YYYY-NNNNN, with the disbursement transaction DT-YYYY-NNNNN) pays an insurer, an agent or referrer, a client or a supplier.

{{screen:/accounts/paymentvoucher}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Bank payment files {#bank-payment-files}

{{screen:/accounts/bank-payment-files}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Remittance to insurers {#remittance-to-insurers}

For broker-billed policies Accounting remits the collected premium, net of the broker's commission, to each insurer by its share.

{{screen:/finance/remittance/automated/execute}}

{{screen:/finance/remittance/tracking/status}}

{{screen:/finance/remittance/statements/generate}}

{{screen:/finance/remittance/settlement/process}}

{{screen:/finance/remittance/reconciliation}}

{{screen:/finance/remittance/bulkprocessing}}

{{screen:/finance/remittance/scheduling}}

{{screen:/finance/remittance/electronictransfer}}

{{screen:/finance/remittance/approval}}

{{screen:/finance/remittance/exceptions}}

{{screen:/finance/remittance/agencybill}}

{{screen:/finance/remittance/adjustments}}

{{screen:/finance/remittance/notifications}}

{{screen:/finance/remittance/history}}

{{screen:/finance/remittance/analytics}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Direct bill: commission debit notes {#direct-bill-commission-debit-notes}

{{screen:/finance/remittance/directbill}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Journal vouchers {#journal-vouchers}

{{screen:/accounts/journalvoucher}}

{{screen:/accounts/correctionsjv/correctionsjvdetails}}

{{screen:/accounts/reversaljv/reversaljvdetails}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## SAP GL export {#sap-gl-export}

{{screen:/accounts/sap-gl-export}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Open entry matching and write-offs {#open-entry-matching-and-write-offs}

Open entry matching settles open debit and credit entries of the same account against each other, for example a receipt against a bill posted without a reference.

{{screen:/accounts/open-entry-matching}}

{{screen:/accounts/open-entry-unmatching}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Accounting Query and All Clients Accounting {#accounting-query-and-all-clients-accounting}

**Accounting Query** searches the accounting entries by **Policy ID / Number**, **Client ID**, **Client Name**, **Entry Type**, **Reference Type**, **Status**, **Start Date**, **End Date** and **GL Code**; **Export** downloads the result. **All Clients Accounting** shows, for every client, the number of transactions, total debits, total credits and balance; **Export CSV** downloads it.

{{screen:/agent/accounting/query}}

{{screen:/agent/accounting/all-clients-details}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Petty cash {#petty-cash}

A fund is opened on Initiate, which issues its code (PCF-) when left empty and holds the fund size, the available cash, the maximum limit and the minimum cash box. Requests are maker-checker. After a save the screen returns to its list.

{{screen:/accounts/pettycash/pettycashcodeinitiate}}

{{screen:/accounts/pettycash/pettycashrequest}}

{{screen:/accounts/pettycash/disbursement}}

{{screen:/accounts/pettycash/receipts}}

{{screen:/accounts/pettycash/replenish}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Bank reconciliation {#bank-reconciliation}

{{screen:/accounts/bank-reconciliation}}

{{screen:/accounts/bank-reconciliation/reconciliations}}

{{screen:/accounts/bank-reconciliation/reports/bank-reconciliation-statement}}

{{screen:/accounts/bank-reconciliation/reports/bank-outstanding-cheques}}

{{screen:/accounts/bank-reconciliation/reports/bank-deposits-in-transit}}

{{screen:/accounts/bank-reconciliation/reports/bank-unmatched-lines}}

{{screen:/accounts/bank-reconciliation/reports/bank-book}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Insurer statement reconciliation {#insurer-statement-reconciliation}

{{screen:/accounts/insurer-reconciliation/statements}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Tax: BIR forms and returns {#tax-bir-forms-and-returns}

{{screen:/accounts/tax/2307}}

{{screen:/accounts/tax/reports/bir-vat-summary}}

{{screen:/accounts/tax/reports/bir-sawt}}

{{screen:/accounts/tax/reports/bir-qap}}

{{screen:/accounts/tax/reports/bir-slsp-sales}}

{{screen:/accounts/tax/reports/bir-slsp-purchases}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Withholding returns: 0619-E, 1601-EQ and their filing records {#withholding-returns-0619-e-1601-eq-and-their-filing-records}

{{screen:/accounts/tax/withholding-returns}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Annual information return 1604-E and alphalist of payees {#annual-information-return-1604-e-and-alphalist-of-payees}

{{screen:/accounts/tax/alphalist-1604e}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Percentage tax 2551Q (non-VAT broker or agent) {#percentage-tax-2551q-non-vat-broker-or-agent}

{{screen:/accounts/tax/percentage-tax}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## BIR DAT files {#bir-dat-files}

{{screen:/accounts/tax/dat-files}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Sales invoices (EOPT Act) {#sales-invoices-eopt-act}

{{screen:/accounts/tax/sales-invoices}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## E-invoicing (EIS) {#e-invoicing-eis}

{{screen:/accounts/tax/eis}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## CAS books and documents {#cas-books-and-documents}

Choose Accounts > Tax > CAS Books and Documents.

{{screen:/accounts/tax/cas}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Period end {#period-end}

A fiscal year (FY2026) has twelve monthly periods and an adjustment period 13 used by the year-end close. The cards count the periods Open, Soft-closed, Closed and Locked.

{{screen:/accounts/period-end/periods}}

{{screen:/accounts/period-end/close}}

{{screen:/accounts/period-end/statements}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Year-end close (preparer) {#year-end-close-preparer}

Accounts > Period End > Year-End Close leads through five steps, one card per step; the stepper above the card shows the status of each step. Choose the fiscal year and select **Start year-end close**: the prerequisites are checked at once.

{{screen:/accounts/period-end/year-end}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Recurring journals {#recurring-journals}

{{screen:/accounts/period-end/recurring}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::

## Incentives {#incentives}

{{screen:/incentive/my-programs}}

{{screen:/incentive/calculations}}

{{screen:/incentive/approvals}}

{{screen:/incentive/statement}}

{{screen:/incentive/reports}}

::: draft
The steps, fields and results of this screen follow in the next draft of this manual.
:::
