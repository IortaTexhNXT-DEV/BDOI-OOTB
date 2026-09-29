# Translation (i18n) Status

## Pages **with** translation (use `useTranslation` + `t()`)

| Area | Page / Component | Path/File |
|------|------------------|-----------|
| Auth | Login | `agentModule/authModule/Login` |
| Agent | Dashboard (Home) | `agentModule/dashBoardModule/home` |
| Agent | Notifications | `agentModule/dashBoardModule/notification` |
| Agent | Lead Listing | `agentModule/leadModule/leadListing` |
| Agent | Lead Edit, Lead Detail, Lead Creation (Card) | `agentModule/leadModule/leadEdit`, `leadDetail`, `leadCreation`, `leadCreationCard` |
| Agent | Client Listing | `agentModule/quoteModule/clientListing` |
| Agent | Quote Listing, QuoteStatsCards, QuoteListingCard | `agentModule/quoteModule/quoteListing` |
| Agent | Quote Detail View | `agentModule/quoteModule/quoteDetailView` — **fully translated** (was only 2 keys; completed Mar 2025) |
| Agent | Policy list (ClientListingCard) | `agentModule/policyModule/index` |
| Agent | Policy Detail View | `agentModule/policyModule/PolicyDetailView` |
| Agent | Expired Policies | `agentModule/policyModule/ExpiredPoliciesPage` |
| Agent | Batch Renewal Table | `agentModule/policyModule/BatchRenewal/BatchTable` |
| Agent | Fire Lead Creation Card | `agentModule/leadModule/FireLeadCreation/FireLeadCreationCard` |
| Agent | Share Quote Modal | `agentModule/quoteModule/quoteDetailView/Modal/ShareOption` |
| Agent | Approve Quote | `agentModule/ApproveQuote` |
| Agent | View/Edit Profile | `agentModule/dashBoardModule/agentViewProfile`, `agentEditProfile`, `agentProfileEditCard` |
| Agent | Open Items (Activity Tracker) | `agentModule/openItems/openItems` |
| Agent | Open Items list, UpcomingEvents, ExpiringPolicy, RenewalRequest, QuotePending, ExpiringPolicyCard, RenewalRequestCard, QuotePendingCard | `agentModule/openItems/OpenItemsListData`, `upcomingEvents`, `expiringPolicy`, `renewalRequest`, `quotePending`, `expiringPolicyCard`, `renewalRequestCard`, `quotePendingCard` |
| Agent | Claim Detail (all sections) | `agentModule/claimModule/claimDetail` |
| Agent | Payments | `agentModule/paymentsModule` |
| Agent | Collections List | `agentModule/collectionsModule/CollectionsList` |
| Agent | Accounting Query | `agentModule/accountingModule/AccountingQuery` |
| Agent | Claims (list, table, detail) | `agentModule/claimModule`, `claimTable`, `claimDetail` |
| Agent | Policy Table (filters, columns) | `agentModule/policyModule/policyTable` |
| Agent | All Clients Accounting View | `agentModule/accountingModule/AllClientsAccountingView` |
| Agent | Collection Detail, Aging Report | `agentModule/collectionsModule/CollectionDetail`, `AgingReport` |
| Agent | Payment Details | `agentModule/paymentsModule/PaymentDetails` |
| Agent | Policy Accounting View, Premium Accounting Entries | `agentModule/quoteModule/policyAccountingView`, `policyModule/PremiumAccountingEntries` |
| Agent | Batch Renewal (page) | `agentModule/policyModule/BatchRenewal/index` |
| Agent | Endorsement: PersonalDetails, CoverageDetails, UploadEndorsement, EndorsementDetailedView, ViewEndorsement, EndorsementRejected, PaymentErrorEndorsement | `agentModule/endorsementModule/` |
| Module | Executive Dashboard | `module/ExecutiveDashboard` |
| Module | Remittance Reports | `module/Remittance/RemittanceReports` |
| Module | Claims Dashboard | `module/ClaimsModule/ClaimsDashboard` |
| Module | Underwriting Dashboard | `module/UnderwritingModule/UnderwritingDashboard` |
| Module | Operational Reports: Production, Claims, Renewal, Remittance, Broker Commission | `module/Reports/OperationalReports/` |
| Module | Financial Reports: SOA/Premium Receivable, Collection Report, Payables, Journal, Trail Balance | `module/Reports/FinancialReports/` |
| Module | **Commission** – list, Add/Edit/View, CommissionTabel, EditTabel, popups | `module/GeneralMasters/Commission/` |
| Module | Add Commission | `module/GeneralMasters/Commission/AddCommission` |
| Module | **Location** – Country Master, State Master, City Master (list + Add/Edit/View) | `module/GeneralMasters/LocationMasters/CountryMaster`, `StateMaster`, `CityMaster` |
| Module | **Organization** – Company Master, Branch Master (list + Add/Edit/View) | `module/GeneralMasters/OrganizationMasters/ComapanyMaster`, `BranchMaster` |
| Module | **Insurance Management** – Insurance Company, LOB, Product, Policy Type, Cover, Signatories, Vehicle (list + Add/Edit/View + TableData + DetailsAction) | `module/GeneralMasters/InsuranceManagementMasters/` |
| Module | **Employee** – Hierarchy, Designation, Employee (list + Add/Edit/View) | `module/GeneralMasters/EmployeeManagementMasters/` |
| Module | **User** – User, Role (list + AddUser, AddRole, EditUser sub-tables) | `module/GeneralMasters/UserManagementMasters/` |
| Module | **Finance** – Bank Account Master (list), Branch Adding, Bank Master (list + dialogs), Bank AccountDataView/AddAccountDetail | `module/FinanceMastersModule/BankAccountMaster`, `BranchMaster/BranchAdding`, `BankMaster`, `BankMaster/AccountDataView/AddAccountDetail` |
| Shared | NavBar (agent) | `agentModule/component/navBar` |
| Shared | Sidebar (NewSideBar, SideBarItem, SideBarItemCollapse) | `components/SideBar/` |
| Shared | Notification dropdown & fallback | `components/NotificationDropdown`, `NotificationFallback`, `Notification` |
| Shared | Go Back component | `components/GobackComponent` |

---

## Pages **without** translation (still hardcoded)

### Agent module
- **Quote flow** – QuoteComparisonView, PolicyDetails, CoverageDetails, Accessories, CustomerInfo, OrderSummary, PaymentConfirmation, PolicyApproval, UploadPolicy, PolicyDetailedView, CoverageDetailedVew (with translation). Remaining: OrderSummaryQuote, CustomerInfoFire, UploadVehiclePhotos, PaymentOptions, PaymentApproval, PaymentError
- **Claims** – ClaimDetails, SendMail, RequestApproval, AdjusterSubmission, SettlementApproval, ClaimSettlement, ClaimRejected, ClaimDocumentUpload (with translation). SettlementDetails, ClaimAuditTrail use t() where added; some labels may remain.
- **Endorsement** – Complete (PersonalDetails, CoverageDetails, UploadEndorsement, EndorsementDetailedView, ViewEndorsement, EndorsementRejected, PaymentErrorEndorsement). PaymentConfirmation, PaymentOptions, endorsementApproval – optional follow-up
- **Payments** – Complete (list + PaymentDetails)
- **Open Items** – Complete
- **Accounting** – Complete (AllClientsAccountingView, AccountingQuery)
- **Policy accounting** – Complete (PolicyAccountingView, PremiumAccountingEntries)
- **Collections** – Complete (CollectionDetail, AgingReport)
- **Quotation module** – `agentModule/quotationModule`
- **Employee Benefit flow** – EmployeeLeadCreation, CQPolicyAndRiskDetails, CQEmployeeBulkUpload, CQcoverageDetails, CQOrderSummary, **CQquoteDetails** (uses `useTranslation` but still has hardcoded "Leads", "Quote details", etc.), PCwaitingForPolicy, PCuploadPolicy, PCpolicyDetails
- **Batch Renewal** – Complete (index/wrapper translated)

### Module – Accounts
- Receipts (PolicyReceipts, AddPolicyReceipts, AddPolicyReceipts1, PaymentDetails, etc.)
- Payment Voucher (index, CreateVoucher, SpecificVoucher, Detailview, Bankdetailselection)
- Journal Voucher (Journalvoucher, AddJournalVoucture, DetailsJournalVocture)
- Open Entry Matching / Unmatching
- Reversals JV, Correction JV
- Petty Cash (Initiate, Request, Disbursement, Receipts, Replenish + all sub-screens)

### Module – Finance masters
- **Bank Account Master** – Complete (list + Add). Branch Adding – Complete. Bank Master (list + dialogs), AccountDataView Add/View/Edit – Complete.
- **Currency** – Complete (list + Add/Edit/View).
- **Taxation** – Complete (Add/Edit/Details).
- **Department** – Complete (Initial, Adding, DetailsView).
- **Main Account** – Complete (TableData, AddMainAccount). Sub Account (Add label). Account Category (CategoryAdding, ModalAddData Save).
- **Transaction Code** – Table row count. Petty Cash Master (PettyDataTabel row count, EditPettyCash Save). Bank Cheque Add Save.
- Remaining: Exchange Rate, Company Master table/add, Transaction Code Edit/View sub-tables
- **Remittance sub-masters** – Complete (Exception, Agency Bill, Direct Bill, Bulk Processing, Electronic Transfer, Schedule, Approval Workflow, Reconciliation, Report Template, Statement Template, Settlement Parameter, Adjustment, Notification, Analytics Configuration, History Configuration – Save/Cancel/Close/Delete/Add labels wired)
- Premium / Miscellaneous / Customer / RI-Claims Account Setup

### Module – General masters
- **Organization** – Complete (Company Master, Branch Master; list + Add/Edit/View)
- **Insurance Management** – Complete (Insurance Company, Line of Business, Product Master, Policy Type, Cover, Signatories, Vehicle; list + Add/Edit/View + TableData + DetailsAction)
- **Location** – Complete (Country, State, City; list + Add/Edit/View)
- **Commission** – Complete (list, AddCommission, EditCommission, ViewCommission, CommissionTabel, EditTabel, Add/Edit/ViewCommissionPopup)
- **Employee** – Complete (Hierarchy, Designation, Employee masters + AddDesignation, AddHierarchy, AddEmployee)
- **User** – Complete (User, Role masters + AddUser, AddRole, EditUser/UserGroupAccessTable, EditUser/TransactionCodeSetupTable)

### Module – Dashboards & reports
- **Complete** – Claims Dashboard, Underwriting Dashboard, Operational Reports (Production, Claims, Renewal, Remittance, Broker Commission), Financial Reports (SOA/Premium Receivable, Collection Report, Payables, Journal, Trail Balance)

### Module – Remittance (transactions)
- Automated Processing, Tracking, Statements, Settlement, Reconciliation, Bulk Processing, Scheduling, Electronic Transfer, Remittance Approval, Exceptions, Agency Bill, Direct Bill, Adjustments, Notifications, History, Analytics  
  (Only **Remittance Reports** has translation.)

### Module – Incentive
- My Programs, Calculations, Approvals, Reports, Statement

### Module – Renewal
- RenewalQueue, QuoteGeneration, RetentionAnalytics, AtRiskAnalysis, NegotiationWorkspace, LapseManagement, PerformanceTracking

### Module – Reinsurance
- Treaty Master, Treaty Dashboard, Treaty Detail, Cession Dashboard, Recovery Dashboard, Reinsurance Reports, Reconciliation, Reinsurance Analytics

### Module – Product configurator
- Product Dashboard, ProductTemplateManager, CoverageBuilder, RatingEngine, UnderwritingRules, ApprovalWorkflows, MarketMapping, DocumentManager, ProductAnalytics

---

## Summary

- **With translation:** 45+ files (Login, Agent Home, Notifications, Lead Listing/Edit/Detail/Creation, Client Listing, Quote Listing/Stats/Card/DetailView, Policy list & Detail & Expired, Batch Renewal, Fire Lead card, Share modal, Approve Quote, Agent View/Edit Profile, Open Items, Payments, Collections, Accounting, Claims Dashboard, Underwriting Dashboard, Operational Reports, Financial Reports, Endorsement flow, Executive Dashboard, Remittance Reports, Add Commission, NavBar, Sidebar, notification components, Go Back).
- **Without translation:** Remaining quote/policy flow screens, remaining Claims sub-screens, Quotation module, Employee Benefit flow, Accounts, Finance Masters, General Masters, Remittance transactions, Incentive, Renewal, Reinsurance, Product Configurator.

To add translation to a page:
1. Add keys to `src/locales/en.json` and `src/locales/th.json`.
2. In the page component: `import { useTranslation } from "react-i18next";` and `const { t } = useTranslation();`.
3. Replace hardcoded strings with `t("namespace.key")` (and `t("namespace.key", { var: value })` for interpolation).

---

## Note: Partial translation (Quote Detail View)

**Why Quote Detail View was not fully translated earlier:** The page was listed under "with translation" because it had `useTranslation` and two keys (`quoteDetailView.failedToLoad`, `quoteDetailView.errorLoading`) used only in error alerts. The rest of the UI (page title "Leads", tab headers, section labels, buttons, toasts, confirm dialogs) was never wired to i18n. This was fixed by adding 90+ keys under `quoteDetailView` in en.json/th.json and replacing all user-facing strings with `t("quoteDetailView.xxx")`.

**Other pages that may have partial translation:** Any page that imports `useTranslation` but still shows English-only text may have the same issue. Known examples: **CQquoteDetails** (Employee Benefit flow) has `useTranslation` but hardcoded "Leads", "Quote details", "Please check quote details", etc. The "Quote flow" and "Employee Benefit flow" sections above list several screens that may be only partially translated; audit them if Thai/EN switching is required.
