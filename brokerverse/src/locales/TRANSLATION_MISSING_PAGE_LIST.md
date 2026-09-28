# Translation Missing – Page-wise List

All places where translation (`useTranslation` + `t()`) is **not** added, organized by route/page.  
Use this to add keys to `en.json`/`th.json` and replace hardcoded strings with `t("namespace.key")`.

---

## 1. Auth (Unprotected routes)

| Route Path | Page / Component | File(s) | Notes |
|------------|------------------|---------|--------|
| `/login` | Login | `module/AuthModule/Login/index.jsx` | ✅ Has translation |
| `/register` | Register | `module/AuthModule/Register/index.jsx` | ✅ Has translation |
| `/resetpassward` | Reset Password | `module/AuthModule/ResetPassward/index.jsx` | ✅ Has translation |
| `/verifycode` | Verify Code | `module/AuthModule/VerfyCode/index.jsx` | ✅ Has translation |

*Note: Forget Password (`ForgetPassward`) uses translation but may not be routed in `AuthRoute.js`.*

---

## 2. Accounts

### 2.1 Receipts

| Route Path | Page / Component | Translation Status |
|------------|------------------|--------------------|
| `/accounts/receipts` | Policy Receipts | ✅ Has translation |
| `/accounts/receipts/addreceipts` | Add Policy Receipts (AddPolicyReceipts1) | ✅ Has translation |
| `/accounts/receipts/addpolicyreceipts` | Add Policy Receipts (legacy) | ✅ Has translation |
| `/accounts/receipts/addreceiptedit` | Add Policy Receipt Edit | ✅ Has translation |
| `/accounts/receipts/policyreceiptsview`, `receiptdetailview` | Policy Receipts View | ✅ Has translation |
| `/accounts/receipts/paymentdetails` | Payment Details | ✅ Has translation |

### 2.2 Payment Voucher

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `accounts/paymentvoucher` | Payment Voucher list | `module/PaymentVoucher/index.js` | ✅ Has translation |
| `accounts/paymentvoucher/createvoucher` | Create Voucher | `module/PaymentVoucher/CreateVoucher/index.js` | ✅ Has translation |
| `accounts/paymentvoucher/invoicelist/:id`, `SpecificVoucher` | Specific Voucher / Invoice List | `SpecificVoucher/index.js`, `InvoiceList/index.js` | ✅ Has translation |
| `accounts/paymentvoucher/detailview/:id` | Detail View | `module/PaymentVoucher/DetailView/index.js` | ✅ Has translation |
| `accounts/paymentvoucher/bankdetailselection` | Bank Detail Selection | `module/PaymentVoucher/Bankdetailselection/index.js` | ✅ Has translation |
| (modal) | Bulk Upload Modal | `module/PaymentVoucher/BulkUploadModal/index.jsx` | ✅ Has translation |

### 2.3 Journal Voucher

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `/accounts/journalvoucher` | Journal Voucher list | `module/JournalVoucher/index.jsx` | ✅ Has translation |
| `/accounts/journalvoucher/addjournalvoucture` | Add Journal Voucher | `module/JournalVoucher/AddJournalVoucture/index.jsx` | ✅ Has translation |
| `/accounts/journalvoucher/detailsjournalvocture/:id` | Details Journal Voucher | `module/JournalVoucher/DetailsJournalVocture` | ✅ Has translation |

### 2.4 Open Entry & Reversals / Corrections

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `/accounts/open-entry-matching` | Open Entry Matching | `module/accounts/openEntryMatching/OpenEntryMatching.jsx` | ✅ Has translation |
| `/accounts/open-entry-unmatching` | Open Entry Unmatching | `module/accounts/openEntryUnmatching/OpenEntryUnmatching.jsx` | ✅ Has translation |
| `/accounts/reversaljv/reversaljvdetails` | Reversals JV | `module/Reversals/index.jsx` | ✅ Has translation |
| `/accounts/correctionsjv/correctionsjvdetails` | Correction JV | `module/CorrectionJV/index.jsx` | ✅ Has translation |

### 2.5 Petty Cash Management

| Route Path | Page / Component | Translation Status |
|------------|------------------|--------------------|
| `accounts/pettycash/pettycashcodeinitiate` | Initiate | ✅ Has translation |
| `accounts/pettycash/pettycashcodeinitiate/initiate` | Initiate Form | ⚠️ **Check** – table/forms |
| `accounts/pettycash/PettyCashCodeDetails` | Petty Cash Code Details | ⚠️ **Check** |
| `accounts/pettycash/pettycashrequest` | Request | ✅ Has translation |
| `accounts/pettycash/editrequestform/edit/:id`, `view/:id` | Edit Request Form | ✅ Has translation |
| `accounts/pettycash/addrequest/add/:id` | Request Form | ⚠️ **Check** – RequestForm component |
| `accounts/pettycash/addrequesttable` | Add Request Table | ⚠️ **Check** |
| `accounts/pettycash/disbursement` | Disbursement | ✅ Has translation |
| `accounts/pettycash/adddisbursement`, `adddisbursementtable` | Add Disbursement | ✅ Has translation |
| `accounts/pettycash/disbursementdetailview` | Disbursement Detail View | ✅ Has translation |
| `accounts/pettycash/request` | Request (list) | ✅ Has translation (RequestTable) |
| `accounts/pettycash/receipts`, `addreceipts`, `addreceiptstable`, `receiptlist` | Receipts | ✅ Has translation (main) |
| `accounts/pettycash/replenish`, `addreplenish`, `addreplenishtable`, `replenishtdetailview` | Replenish | ✅ Has translation (main) |

---

## 3. Agent – Quote / Policy flow (partial missing)

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `/agent/convertpolicy/customerinfo/fire/new/:quotationId` | Customer Info (Fire) | `agentModule/quoteModule/customerInfo/CustomerInfoFire` | ✅ Has translation |
| `/agent/convertpolicy/uploadvehiclephotos` | Upload Vehicle Photos | `agentModule/quoteModule/uploadVehiclePhotos` | ✅ Has translation |
| `/agent/editquote/ordersummaryquote/:id`, `createquote/ordersummaryquote/:leadRefId` | Order Summary Quote | `agentModule/quoteModule/orderSummaryQuote` | ✅ Has translation |
| `/agent/policy/paymentapproval` | Payment Approval | `agentModule/quoteModule/paymentApproval` | ✅ Has translation |
| `/agent/policy/paymenterror` | Payment Error | `agentModule/quoteModule/paymentError` | ✅ Has translation |
| `/agent/createquote/product-recommendation` | Product Recommendation | `agentModule/quoteModule/productRecommandation` | ✅ Has translation |

*Other quote/policy pages (Policy Details, Coverage Details, Order Summary, Payment Confirmation, Policy Approval, Upload Policy, Policy Detailed View, Customer Info, Payment Options, etc.) already use translation.*

---

## 4. Agent – Quotation module

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `/agent/Quotation` | Quotation landing | `agentModule/quotationModule/index.jsx` | ✅ Has translation |
| `/agent/quotation/quotationtable` | Quotation Table | `agentModule/quotationModule/quotationTable` | ✅ Has translation |

*Verify all labels and messages in quotation table and related modals.*

---

## 5. Agent – Claims (partial)

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `/agent/claimrequest/sendmail` | Send Mail | `agentModule/claimsModule/sendMail` | ✅ Has translation |
| `/agent/claimrequest/requestapproval/:id` | Request Approval | `agentModule/claimsModule/requestApproval` | ⚠️ **Check** |
| `/agent/claimrequest/adjustersubmission/:id` | Adjuster Submission | `agentModule/claimsModule/adjusterSubmission` | Uses `t()` – verify completeness |
| `/agent/claimrequest/settlementapproval/:id` | Settlement Approval | `agentModule/claimsModule/settlementApproval` | Uses `t()` – verify completeness |
| `/agent/claimrequest/settlementdetails/:id` | Settlement Details | `agentModule/claimsModule/settlementDetails` | Uses `t()` – verify completeness |
| `/agent/claimdetailedview/:id` | Claim Settlement | `agentModule/claimsModule/claimSettlement` | Uses `t()` – verify completeness |
| `/agent/claimrejected` | Claim Rejected | `agentModule/claimsModule/claimRejected` | Uses `t()` – verify completeness |
| `/agent/claimdocumentupload` | Claim Document Upload | `agentModule/claimsModule/claimDocumentUpload` | Uses `t()` – verify completeness |
| `/agent/claimaudittrail/:claimId` | Claim Audit Trail | `agentModule/claimModule/claimAuditTrail` | Uses `t()` – verify all labels |

---

## 6. Agent – Endorsement (partial)

| Route Path | Page / Component | Translation Status |
|------------|------------------|--------------------|
| `/agent/endorsement/paymentconfirmation/:endorsementId` | Payment Confirmation (Endorsement) | ✅ Has translation |
| `/agent/employee-benefit/paymentconfirmation` | Payment Confirmation (Employee Benefit) | ✅ Has translation |
| `/agent/endorsement/paymentoptions` | Payment Options (Endorsement) | ✅ Has translation (uses agent.*) |
| `/agent/endorsement/paymentapproval` | Payment Approval (Endorsement) | ✅ Has translation |
| `/agent/endorsement/paymenterror/:endorsementId` | Payment Error (Endorsement) | ✅ Has translation |
| `/agent/endorsement/rejected/:endorsementId` | Endorsement Rejected | ✅ Has translation (EndorsementRejected) |

---

## 7. Agent – Employee Benefit flow

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `/agent/createlead/employee-benefit` | Employee Lead Creation | `agentModule/EmployeeFlow/EmployeeLeadCreation` | ✅ Has translation |
| `/agent/createlead/fire-allied-perils` | Fire Lead Creation | Uses FireLeadCreationCard (has translation) – verify page wrapper | ⚠️ **Check** |
| `/agent/employee-benefit/create-quote` | CQ Policy & Risk Details | `agentModule/EmployeeFlow/CQPolicyAndRiskDetails` | ✅ Has translation |
| `/agent/employee-benefit/create-quote-employeebulkupload` | CQ Employee Bulk Upload | `agentModule/EmployeeFlow/CQEmployeeBulkUpload` | ✅ Has translation |
| `/agent/employee-benefit/create-quote-Coverage-details` | CQ Coverage Details | `agentModule/EmployeeFlow/CQcoverageDetails` | ✅ Has translation |
| `/agent/employee-benefit/create-quote-order-summary` | CQ Order Summary | `agentModule/EmployeeFlow/CQOrderSummary` | ✅ Has translation |
| `/agent/employee-benefit/create-quote-quote-details` | CQ Quote Details | `agentModule/EmployeeFlow/CQquoteDetails` | ✅ Has translation |
| `/agent/employee-benefit/policy-waiting-for-policy` | PC Waiting For Policy | `agentModule/EmployeeFlow/PCwaitinForPolicy` | ✅ Has translation |
| `/agent/employee-benefit/policy-upload-policy` | PC Upload Policy | `agentModule/EmployeeFlow/PCuploadPolicy` | ✅ Has translation |
| `/agent/employee-benefit/client-policy-details` | PC Policy Details | `agentModule/EmployeeFlow/PCpolicydetails` | ✅ Has translation |

---

## 8. Finance Masters

Most finance master screens use translation. Remaining to verify or add:

| Route Path | Page / Component | Translation Status |
|------------|------------------|--------------------|
| `master/finance/company` | Company Master | Uses translation – verify table/add labels |
| `master/finance/exchangerate/*` | Exchange Rate (Add/Edit/View) | ✅ Has translation |
| `master/finance/transactioncode/*` | Transaction Code (View/Details/Edit sub-screens) | ⚠️ **Check** – some row counts or labels may be hardcoded |
| `master/finance/premium-account-setup` | Premium Account Setup | Uses `t()` – verify completeness |
| `master/finance/miscellaneous-account-setup` | Miscellaneous Account Setup | ⚠️ **Check** |
| `master/finance/customer-account-setup` | Customer Account Setup | ⚠️ **Check** |
| `master/finance/ri-claim-account-setup` | RI Claims Account Setup | ⚠️ **Check** |

---

## 9. Remittance (transactions) – mostly missing

| Route Path | Page / Component | Translation Status |
|------------|------------------|--------------------|
| `finance/remittance/reports` | Remittance Reports | ✅ Has translation |
| `finance/remittance/bulkprocessing` | Bulk Processing | ✅ Has translation |
| `finance/remittance/automated/execute` | Automated Processing | ✅ Has translation |
| `finance/remittance/tracking/status` | Tracking | ✅ Has translation |
| `finance/remittance/statements/generate` | Statements | ✅ Has translation |
| `finance/remittance/settlement/process` | Settlement | ❌ **Missing** |
| `finance/remittance/reconciliation` | Reconciliation | ❌ **Missing** |
| `finance/remittance/scheduling` | Scheduling | ❌ **Missing** |
| `finance/remittance/electronictransfer` | Electronic Transfer | ❌ **Missing** |
| `finance/remittance/approval` | Remittance Approval | ❌ **Missing** |
| `finance/remittance/exceptions` | Exceptions | ❌ **Missing** |
| `finance/remittance/agencybill` | Agency Bill | ❌ **Missing** |
| `finance/remittance/directbill` | Direct Bill | ❌ **Missing** |
| `finance/remittance/adjustments` | Adjustments | ❌ **Missing** |
| `finance/remittance/notifications` | Notifications | ❌ **Missing** |
| `finance/remittance/history` | History | ❌ **Missing** |
| `finance/remittance/analytics` | Analytics | ❌ **Missing** |

---

## 10. Incentive module – missing

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `incentive/my-programs` | My Programs | `module/Incentive/MyPrograms` | ✅ Has translation |
| `incentive/calculations` | Calculations | `module/Incentive/Calculations` | ❌ **Missing** |
| `incentive/approvals` | Approvals | `module/Incentive/Approvals` | ❌ **Missing** |
| `incentive/reports` | Reports | `module/Incentive/Reports` | ❌ **Missing** |
| `incentive/statement` | Statement | `module/Incentive/Statement` | ❌ **Missing** |
| `master/incentive/programs/:mode` | Incentive Program Master | `module/FinanceMastersModule/IncentiveMaster/IncentiveProgramMaster` | ✅ Has translation |

---

## 11. Renewal module

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `renewal/queue` | Renewal Queue | `module/Renewal/RenewalQueue` | ✅ Has translation |
| `renewal/generate-quote/:policyId` | Quote Generation | `module/Renewal/QuoteGeneration` | ✅ Has translation |
| `renewal/analytics` | Retention Analytics | `module/Renewal/RetentionAnalytics` | ✅ Has translation |
| `renewal/at-risk` | At Risk Analysis | `module/Renewal/AtRiskAnalysis` | ✅ Has translation |
| `renewal/negotiations` | Negotiation Workspace | `module/Renewal/NegotiationWorkspace` | ✅ Has translation |
| `renewal/lapse-management` | Lapse Management | `module/Renewal/LapseManagement` | ✅ Has translation |
| `renewal/performance` | Performance Tracking | `module/Renewal/PerformanceTracking` | ✅ Has translation |

---

## 12. Reinsurance module – missing

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `master/reinsurance/treaty` | Treaty Master | `module/FinanceMastersModule/ReinsuranceMaster/TreatyMaster` | ✅ Has translation |
| `reinsurance/treaties` | Treaty Dashboard | `module/Reinsurance/TreatyDashboard` | ❌ **Missing** |
| `reinsurance/treaty/:id` | Treaty Detail | `module/Reinsurance/TreatyDetail` | ❌ **Missing** |
| `reinsurance/cessions` | Cession Dashboard | `module/Reinsurance/CessionDashboard` | ❌ **Missing** |
| `reinsurance/claims` | Recovery Dashboard | `module/Reinsurance/RecoveryDashboard` | ❌ **Missing** |
| `reinsurance/reports` | Reinsurance Reports | `module/Reinsurance/ReinsuranceReports` | ❌ **Missing** |
| `reinsurance/reconciliation` | Reconciliation | `module/Reinsurance/ReconciliationDashboard` | ❌ **Missing** |
| `reinsurance/analytics` | Reinsurance Analytics | `module/Reinsurance/ReinsuranceAnalytics` | ❌ **Missing** |

---

## 13. Product Configurator – missing

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `product-configurator/dashboard` | Product Dashboard | `module/ProductConfigurator/ProductDashboard` | ✅ Has translation |
| `product-configurator/templates`, `template/:id`, `create` | Product Template Manager | `ProductConfiguratorScreens` (ProductTemplateManager) | ❌ **Missing** (screens) |
| `product-configurator/coverages` | Coverage Builder | `ProductConfiguratorScreens` (CoverageBuilder) | ❌ **Missing** |
| `product-configurator/rating` | Rating Engine | `ProductConfiguratorScreens` (RatingEngine) | ❌ **Missing** |
| `product-configurator/underwriting` | Underwriting Rules | `ProductConfiguratorScreens` (UnderwritingRules) | ❌ **Missing** |
| `product-configurator/documents` | Document Manager | `ProductConfiguratorScreens` (DocumentManager) | ❌ **Missing** |
| `product-configurator/workflows` | Approval Workflows | `ProductConfiguratorScreens` (ApprovalWorkflows) | ❌ **Missing** |
| `product-configurator/market-mapping` | Market Mapping | `ProductConfiguratorScreens` (MarketMapping) | ❌ **Missing** |
| `product-configurator/analytics` | Product Analytics | `ProductConfiguratorScreens` (ProductAnalytics) | ❌ **Missing** |

---

## 14. Agent – Renewal waiting

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `/agent/renewal/waiting/:id` | Policy Renewal Waiting | `agentModule/renewalModule/WaitingScreen/PolicyRenewalWaiting` | ✅ Has translation |

---

## 15. Receipts – Add Policy Receipt Edit

| Route Path | Page / Component | File | Translation Status |
|------------|------------------|------|--------------------|
| `/accounts/receipts/addreceiptedit` | Add Policy Receipt Edit | `module/Receipts/AddPolicyReceiptEdit` | ✅ Has translation |

---

## Summary counts (approximate)

| Category | Pages with translation | Pages missing / to check |
|----------|------------------------|---------------------------|
| Auth | 4 | 0 |
| Accounts – Receipts | 5 | 1 (addreceiptedit) |
| Accounts – Payment Voucher | 1 (modal) | 5 main pages |
| Accounts – Journal Voucher | 2 | 1 (details) |
| Accounts – Open Entry / Reversals | 3 | 1 (unmatching) |
| Accounts – Petty Cash | 0 | 15+ screens |
| Agent – Quote/Policy flow | Many | 6 (Fire customer, upload photos, order summary quote, payment approval/error, product recommendation) |
| Agent – Employee Benefit | 0 | 10 screens |
| Remittance transactions | 2 | 14 |
| Incentive (user) | 0 | 5 |
| Renewal | 0 | 7 |
| Reinsurance (user) | 0 | 7 |
| Product Configurator | 1 (dashboard) | 8 screens |

**How to add translation**

1. Add keys to `src/locales/en.json` and `src/locales/th.json`.
2. In the component: `import { useTranslation } from "react-i18next";` and `const { t } = useTranslation();`.
3. Replace hardcoded strings with `t("namespace.key")` or `t("namespace.key", { var: value })` for interpolation.
