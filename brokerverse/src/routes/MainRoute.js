import { Route, Routes, useLocation } from "react-router-dom";

import ProtectedLayout from "./ProtectedRoute";
import NotFound from "../components/NotFound";
import CorrectionJV from "../module/CorrectionJV";
import PolicyReceipts from "../module/Receipts/PolicyReceipts";
import PolicyReceiptsView from "../module/Receipts/PolicyReceiptsView";
import AddPolicyReceipts1 from "../module/Receipts/AddPolicyReceipts1";
import AddPolicyEdit from "../module/Receipts/AddPolicyReceiptEdit";
import Reversalsjv from "../module/Reversals/index";
import Journalvoucher from "../module/JournalVoucher/index";
import OpenEntryMatching from "../module/accounts/openEntryMatching/OpenEntryMatching";
import OpenEntryUnmatching from "../module/accounts/openEntryUnmatching/OpenEntryUnmatching";
import SpecificVoucher from "../module/PaymentVoucher/SpecificVoucher";
import Paymentvoucher from "../module/PaymentVoucher/index";
import CreateVoucher from "../module/PaymentVoucher/CreateVoucher/index";
import Detailview from "../module/PaymentVoucher/DetailView/index";
import BulkDisburse from "../module/PaymentVoucher/BulkDisburse";
import CurrencyMaster from "../module/FinanceMastersModule/CurrencyMaster";
import ExchangeRateMaster from "../module/FinanceMastersModule/ExchangeRateMaster";
// Main / Sub Account masters are the GL chart of accounts
import ChartOfAccounts from "../module/FinanceMastersModule/ChartOfAccounts";
import PaymentDetails from "../module/Receipts/PaymentDetails";
import TransactionCodeMaster from "../module/FinanceMastersModule/TransactionCodeMaster";
import DepartmentMasterInitial from "../module/FinanceMastersModule/DepartmentMaster/DepartmentMasterInitial";
import DepartmentAdding from "../module/FinanceMastersModule/DepartmentMaster/DepartmentAdding";
import DepartmentDetailsView from "../module/FinanceMastersModule/DepartmentMaster/DepartmentDetailsView";
import AccountCategoryMaster from "../module/FinanceMastersModule/AccountCategoryMaster";
import AddCurrency from "../module/FinanceMastersModule/CurrencyMaster/AddCurrency";
import AddExchange from "../module/FinanceMastersModule/ExchangeRateMaster/AddExchange";
import SaveAndEditExchange from "../module/FinanceMastersModule/ExchangeRateMaster/SaveAndEditExchange";

import AddJournalVoucture from "../module/JournalVoucher/AddJournalVoucture";
import DetailsJournalVocture from "../module/JournalVoucher/DetailsJournalVocture";

import Bankdetailselection from "../module/PaymentVoucher/Bankdetailselection";
import Initiate from "../module/PettyCashManagement/Initiate";
import Disbursement from "../module/PettyCashManagement/Disbursement";
import Request from "../module/PettyCashManagement/Request";
import PettyCashReceipts from "../module/PettyCashManagement/Receipts";
import PettyCashReplenish from "../module/PettyCashManagement/Replenish";
import InitiateForm from "../module/PettyCashManagement/Initiate/InitiateForm";
import PettyCashCodeDetails from "../module/PettyCashManagement/Initiate/PettyCashCodeDetails";
import PettyCashRequest from "../module/PettyCashManagement/Request";
import RequestForm from "../module/PettyCashManagement/Request/RequestForm";
import AddRequestTable from "../module/PettyCashManagement/Request/AddRequestTable";
import AddDisbursement from "../module/PettyCashManagement/Disbursement/AddDisbursement";
import AddDisbursementTable from "../module/PettyCashManagement/Disbursement/AddDisbursementTable";
import DisbursementDetailview from "../module/PettyCashManagement/Disbursement/DisbursementDetailview";
import AddReceipts from "../module/PettyCashManagement/Receipts/AddReceipt";
import AddReceiptsTable from "../module/PettyCashManagement/Receipts/AddReceiptTable";
import ReceiptList from "../module/PettyCashManagement/Receipts/ReceiptList";
import AddReplenish from "../module/PettyCashManagement/Replenish/AddReplenish";
import AddReplenishTable from "../module/PettyCashManagement/Replenish/AddReplenishTable";
import ReplenishtDetailView from "../module/PettyCashManagement/Replenish/ReplenishDetailview";
import TransactionCodeMasterView from "../module/FinanceMastersModule/TransactionCodeMaster/TransactionCodeMasterView";
import TransactionCodeDetails from "../module/FinanceMastersModule/TransactionCodeMaster/TransactionCodeDetails";
import ViewCurrency from "../module/FinanceMastersModule/CurrencyMaster/ViewCurrency";
import MasterRecordView from "../components/RecordView";
import EditCurrency from "../module/FinanceMastersModule/CurrencyMaster/EditCurrency";
import TransactioncodeEdit from "../module/FinanceMastersModule/TransactionCodeMaster/TransactionCodeMasterEdit/index";
import ViewExchange from "../module/FinanceMastersModule/ExchangeRateMaster/ViewExchange";
import BankMaster from "../module/FinanceMastersModule/BankMaster";
import AddBankMaster from "../module/FinanceMastersModule/BankMaster/AddBankMaster";
import Accountdataview from "../module/FinanceMastersModule/BankMaster/AccountDataView/index";
import AddAccountDetail from "../module/FinanceMastersModule/BankMaster/AccountDataView/AddAccountDetail/index";
import ViewAccountDetail from "../module/FinanceMastersModule/BankMaster/AccountDataView/ViewAccountData";
import EditAccountDetail from "../module/FinanceMastersModule/BankMaster/AccountDataView/EditAccountData";
import EmailLayoutPage from "../module/DocumentLayouts/EmailLayout";
import DocumentsLayoutPage from "../module/DocumentLayouts/DocumentsLayout";
import DocumentSignaturesPage from "../module/DocumentLayouts/DocumentSignatures";
import ConfigurationPage from "../module/Administration/Configuration";
import SchedulesPage from "../module/Administration/Schedules";
import DocumentNumberingPage from "../module/Administration/DocumentNumbering";
import CommissionRateMatrix from "../module/FinanceMastersModule/CommissionRateMatrix";
import AuditTrailPage from "../module/Administration/AuditTrail";
import FeatureCatalogue from "../module/FeaturesReleases/FeatureCatalogue";
import PlatformFeatures from "../module/FeaturesReleases/PlatformFeatures";
import EmailOutboxPage from "../module/Administration/EmailOutbox";
import CompanyMasters from "../module/GeneralMasters/OrganizationMasters/CompanyMaster";
import BranchMasters from "../module/GeneralMasters/OrganizationMasters/BranchMaster";
import InsuranceCompany from "../module/GeneralMasters/InsuranceManagementMasters/InsuranceCompany";
import LineOfBusiness from "../module/GeneralMasters/InsuranceManagementMasters/LineOfBusiness";
import ProductMaster from "../module/GeneralMasters/InsuranceManagementMasters/ProductMaster";
import PolicyType from "../module/GeneralMasters/InsuranceManagementMasters/PolicyTypeMaster";
import Cover from "../module/GeneralMasters/InsuranceManagementMasters/Cover";
import Signatories from "../module/GeneralMasters/InsuranceManagementMasters/SignatoriesMaster";
import Vahicle from "../module/GeneralMasters/InsuranceManagementMasters/Vehicle";
import Country from "../module/GeneralMasters/LocationMasters/CountryMaster";
import State from "../module/GeneralMasters/LocationMasters/StateMaster";
import City from "../module/GeneralMasters/LocationMasters/CityMaster";
import InsuranceDetailsAction from "../module/GeneralMasters/InsuranceManagementMasters/InsuranceCompany/InsuranceDetailsAction";
import LineBusinessDetailsAction from "../module/GeneralMasters/InsuranceManagementMasters/LineOfBusiness/LineBusinessDetailsAction";
import ProductMatserDetailsAction from "../module/GeneralMasters/InsuranceManagementMasters/ProductMaster/ProductMasterDetailsAction";
import PolicyTypeDetailsAction from "../module/GeneralMasters/InsuranceManagementMasters/PolicyTypeMaster/PolicyTypeDetailsAction";
import CoverDetailsAction from "../module/GeneralMasters/InsuranceManagementMasters/Cover/CoverDetailsAction";
import SignatoriesDetailsAction from "../module/GeneralMasters/InsuranceManagementMasters/SignatoriesMaster/SignatoriesAction";
import VehicleDetailsAction from "../module/GeneralMasters/InsuranceManagementMasters/Vehicle/VehicleDetailsAction";

import Designation from "../module/GeneralMasters/EmployeeManagementMasters/Designation/DesignationMaster";
import AddDesignation from "../module/GeneralMasters/EmployeeManagementMasters/Designation/AddDesignation";
import User from "../module/GeneralMasters/UserManagementMasters/User/UserMaster";
import AddUser from "../module/GeneralMasters/UserManagementMasters/User/AddUser";
import Role from "../module/GeneralMasters/UserManagementMasters/Role/RoleMaster";
import AddRole from "../module/GeneralMasters/UserManagementMasters/Role/AddRole";
import HierarchyMaster from "../module/GeneralMasters/EmployeeManagementMasters/Hierarchy/HierarchyMaster";
import AddHierarchy from "../module/GeneralMasters/EmployeeManagementMasters/Hierarchy/AddHierarchy";
import UserEdit from "../module/GeneralMasters/UserManagementMasters/User/EditUser";
import ClaimSettlement from "../agentModule/claimsModule/claimSettlement";
import ClaimDetail from "../agentModule/claimModule/claimDetail";
import ClaimAuditTrail from "../agentModule/claimModule/claimAuditTrail";

import AddCompany from "../module/GeneralMasters/OrganizationMasters/CompanyMaster/AddCompany";
import AddBranch from "../module/GeneralMasters/OrganizationMasters/BranchMaster/AddBranch";
import AddCountry from "../module/GeneralMasters/LocationMasters/CountryMaster/AddCountry/index";
import AddCity from "../module/GeneralMasters/LocationMasters/CityMaster/AddCity";
import AddState from "../module/GeneralMasters/LocationMasters/StateMaster/AddState";
import MyProfile from "../module/MyProfile";
import Notification from "../agentModule/dashBoardModule/notification";
import LeadCreation from "../agentModule/leadModule/leadCreation";
import LeadListing from "../agentModule/leadModule/leadListing";
import CoverageDeatails from "../agentModule/quoteModule/coverageDetails";
import RenewalCoverageStep from "../agentModule/quoteModule/renewalTerm";
import PolicyDetails from "../agentModule/quoteModule/policyDetails";
import Accessories from "../agentModule/quoteModule/accessories";
import OrderSummary from "../agentModule/quoteModule/orderSummary";
import OrderSummaryQuote from "../agentModule/quoteModule/orderSummaryQuote";
import QuoteDetailView from "../agentModule/quoteModule/quoteDetailView";
import QuoteListing from "../agentModule/quoteModule/quoteListing";
import CustomerInfo from "../agentModule/quoteModule/customerInfo";
import CustomerInfoFire from "../agentModule/quoteModule/customerInfo/CustomerInfoFire";
import QuoteComparisonView from "../agentModule/quoteModule/quoteComparisonView";
import UploadVehiclePhotos from "../agentModule/quoteModule/uploadVehiclePhotos";
import CoverageDetailedVew from "../agentModule/quoteModule/coverageDetailedView";
import PolicyApproval from "../agentModule/quoteModule/policyApproval";
import UploadPolicy from "../agentModule/quoteModule/uploadPolicy";
import PolicyDetailedView from "../agentModule/quoteModule/policyDetailedView";
import PaymentConfirmation from "../agentModule/quoteModule/paymentConfirmation";
import PaymentOptions from "../agentModule/quoteModule/paymentOptions";
import PaymentApproval from "../agentModule/quoteModule/paymentApproval";
import PaymentError from "../agentModule/quoteModule/paymentError";
import ClientListing from "../agentModule/quoteModule/clientListing";
import ClientView from "../agentModule/quoteModule/clientView";
import ClaimDetails from "../agentModule/claimsModule/claimDetails";
import SendMail from "../agentModule/claimsModule/sendMail";
import ClaimDocumentsStep from "../agentModule/claimsModule/claimDocuments";
import RequestApproval from "../agentModule/claimsModule/requestApproval";
import AdjusterSubmission from "../agentModule/claimsModule/adjusterSubmission";
import SettlementApproval from "../agentModule/claimsModule/settlementApproval";
import SettlementDetails from "../agentModule/claimsModule/settlementDetails";
import PersonalDetails from "../agentModule/endorsementModule/personalDetails";
import CoverageDetails from "../agentModule/endorsementModule/coveragedetails";
import EndorsementApproval from "../agentModule/endorsementModule/endorsementApproval";
import UploadEndorsement from "../agentModule/endorsementModule/uploadEndorsement";
import EndorsementDetailedView from "../agentModule/endorsementModule/endorsementDetailedView";
import PaymentOptionsEndorsement from "../agentModule/endorsementModule/paymentOptions";
import PaymentConfirmationEndorsement from "../agentModule/endorsementModule/paymentConfirmation";
import Endorsementpaymentapproval from "../agentModule/endorsementModule/paymentApprovalEndorsement";
import PaymentErrorEndorsment from "../agentModule/endorsementModule/paymentErrorEndorsement";
import Payments from "../agentModule/paymentsModule";
import Claim from "../agentModule/claimModule";
import Policy from "../agentModule/policyModule";
import PolicyDetailView from "../agentModule/policyModule/PolicyDetailView";
import ExpiredPoliciesPage from "../agentModule/policyModule/ExpiredPoliciesPage";
import Quotation from "../agentModule/quotationModule";
import ClaimRejected from "../agentModule/claimsModule/claimRejected";
import ClaimDocumentUpload from "../agentModule/claimsModule/claimDocumentUpload";
import LeadEdit from "../agentModule/leadModule/leadEdit";
import LeadDetail from "../agentModule/leadModule/leadDetail";
import ViewEndorsement from "../agentModule/endorsementModule/viewUploadEndorsement";
import EndorsementRejected from "../agentModule/endorsementModule/EndorsementRejected";
import Production from "../module/Reports/OperationalReports/Production";
// Dashboard Imports
import ExecutiveDashboard from "../module/ExecutiveDashboard";
import MyDashboard from "../components/Dashboard/MyDashboard";
import ClaimsDashboard from "../module/ClaimsModule/ClaimsDashboard";
import SalesDashboard from "../module/SalesDashboard";
import UnderwritingDashboard from "../module/UnderwritingModule/UnderwritingDashboard";
import SoaPremiumReceivable from "../module/Reports/FinancialReports/SoaPremiumReceivable";
import Claims from "../module/Reports/OperationalReports/Claims";
import Renewal from "../module/Reports/OperationalReports/Renewal";
import Remittance from "../module/Reports/OperationalReports/Remittance";
import BrokerCommision from "../module/Reports/OperationalReports/BrokerCommission";
import Collectionreport from "../module/Reports/FinancialReports/CollectionReport";
import Payables from "../module/Reports/FinancialReports/Payables";
import Journal from "../module/Reports/FinancialReports/Journal";
import TrailBalance from "../module/Reports/FinancialReports/TrailBalance";
import ReportCatalogue, { ReportRunner } from "../module/Reports/ReportCatalogue";
// Period-end processing and BIR tax
import PeriodManagement from "../module/PeriodEnd/PeriodManagement";
import MonthEndClose from "../module/PeriodEnd/MonthEndClose";
import MonthEndCloseRun from "../module/PeriodEnd/MonthEndCloseRun";
import YearEndClose from "../module/PeriodEnd/YearEndClose";
import RecurringJournals from "../module/PeriodEnd/RecurringJournals";
import FinancialStatements from "../module/PeriodEnd/FinancialStatements";
import CloseChecklist from "../module/PeriodEnd/CloseChecklist";
import TaxCodes from "../module/PeriodEnd/TaxCodes";
import Bir2307 from "../module/PeriodEnd/Bir2307";
import PeriodEndReportPage from "../module/PeriodEnd/ReportPage";
// BIR forms, invoicing and tax; overriding commission from insurers
import WithholdingReturns from "../module/BirTax/WithholdingReturns";
import { Alphalist1604E, PercentageTax } from "../module/BirTax/SingleReturn";
import BirDatFiles from "../module/BirTax/DatFiles";
import SalesInvoices from "../module/BirTax/SalesInvoices";
import EisOutbox from "../module/BirTax/EisOutbox";
import CasPack from "../module/BirTax/CasPack";
import OverrideAgreements from "../module/BirTax/OverrideAgreements";
import OverrideComputations from "../module/BirTax/OverrideComputations";
import BankRecWorkspace from "../module/BankReconciliation/Workspace";
import BankReconciliations from "../module/BankReconciliation/Reconciliations";
import BankReconciliationRun from "../module/BankReconciliation/ReconciliationRun";
import BankStatementFormats from "../module/BankReconciliation/StatementFormats";
import BankTransactionTypes from "../module/BankReconciliation/TransactionTypes";
import BankRecReportPage from "../module/BankReconciliation/ReportPage";
import InsurerStatementFormats from "../module/InsurerReconciliation/Formats";
import InstalmentPlans from "../module/CreditControl/InstalmentPlans";
import WarrantyMonitor from "../module/CreditControl/WarrantyMonitor";
import CreditLimits from "../module/CreditControl/CreditLimits";
import RemittanceAgeing from "../module/CreditControl/RemittanceAgeing";
// operations and accounting: cover notes, cancellation, post-dated cheques, claims, payables, fixed assets
import CoverNotes from "../module/OpsAccounting/CoverNotes";
import PolicyCancellation from "../module/OpsAccounting/PolicyCancellation";
import PostDatedCheques from "../module/OpsAccounting/PostDatedCheques";
import ClaimsSettlements from "../module/OpsAccounting/ClaimsSettlements";
import ClaimDocuments from "../module/OpsAccounting/ClaimDocuments";
import MotorClaimRepairs from "../module/OpsAccounting/MotorClaimRepairs";
import SupplierInvoices from "../module/OpsAccounting/SupplierInvoices";
import { ApAgeing, SupplierPayments } from "../module/OpsAccounting/SupplierPayments";
import { AssetRegister, DepreciationRun } from "../module/OpsAccounting/FixedAssets";
import { AssetClasses, CancellationReasons, ClaimDocumentChecklist, CostCentres, LeadSources, ReasonCodes, RepairShops, ShortPeriodRates, Suppliers } from "../module/OpsAccounting/Masters";
// sales activities, asset disposal and the BIR 2307 of suppliers
import SalesActivities from "../module/SalesActivities/SalesActivities";
import { AssetDisposals } from "../module/OpsAccounting/AssetDisposals";
import { SalesActivityOutcomes, SalesActivityTypes } from "../module/OpsAccounting/Masters";

// Collections Module
import CollectionsList from "../agentModule/collectionsModule/CollectionsList";
import CollectionDetail from "../agentModule/collectionsModule/CollectionDetail";
import AgingReport from "../agentModule/collectionsModule/AgingReport";

// Remittance Masters
import RemittanceMaster from "../module/FinanceMastersModule/RemittanceMaster";
import AutomatedRemittanceMaster from "../module/FinanceMastersModule/RemittanceMaster/AutomatedRemittance";
import StatementTemplateMaster from "../module/FinanceMastersModule/RemittanceMaster/StatementTemplate";
import SettlementParameterMaster from "../module/FinanceMastersModule/RemittanceMaster/SettlementParameter";
import BulkProcessingMaster from "../module/FinanceMastersModule/RemittanceMaster/BulkProcessingMaster";
import ExceptionMaster from "../module/FinanceMastersModule/RemittanceMaster/ExceptionMaster";
import AgencyBillMaster from "../module/FinanceMastersModule/RemittanceMaster/AgencyBillMaster";
import AccountDetermination from "../module/FinanceMastersModule/AccountDetermination";
import PostingRules from "../module/FinanceMastersModule/PostingRules";
import ConfigurationApprovals from "../module/FinanceMastersModule/ConfigurationApprovals";
import AccountingFlow from "../module/FinanceMastersModule/AccountingFlow";
import FsVersions from "../module/FinanceMastersModule/FsVersions";
import UnappliedCollections from "../module/Receipts/UnappliedCollections";
import CoInsuranceRegister from "../module/Reports/FinancialReports/CoInsuranceRegister";
import DueToInsurers from "../module/Reports/FinancialReports/DueToInsurers";
// K13-K17 Remittance Masters
import AdjustmentMaster from "../module/FinanceMastersModule/RemittanceMaster/AdjustmentMaster";
import NotificationMaster from "../module/FinanceMastersModule/RemittanceMaster/NotificationMaster";

// Incentive Module
import IncentiveProgramMaster from "../module/FinanceMastersModule/IncentiveMaster/IncentiveProgramMaster";
import MyPrograms from "../module/Incentive/MyPrograms";
import IncentiveCalculations from "../module/Incentive/Calculations";
import IncentiveApprovals from "../module/Incentive/Approvals";
import IncentiveReports from "../module/Incentive/Reports";
import IncentiveStatement from "../module/Incentive/Statement";

// Renewal Module
import RenewalQueue from "../module/Renewal/RenewalQueue";
import QuoteGeneration from "../module/Renewal/QuoteGeneration";
import RetentionAnalytics from "../module/Renewal/RetentionAnalytics";
import AtRiskAnalysis from "../module/Renewal/AtRiskAnalysis";
import NegotiationWorkspace from "../module/Renewal/NegotiationWorkspace";
import LapseManagement from "../module/Renewal/LapseManagement";
import PerformanceTracking from "../module/Renewal/PerformanceTracking";
import LockInAccounts from "../module/Renewal/LockInAccounts";

// Accounts > Remittance
import { remittanceRoutes } from "../module/Remittance/routes";
// Placement journey: Broker Slip -> Quotation Slip -> Placement Slip -> Policy
import BrokerSlipList from "../module/Placement/BrokerSlipList";
import BrokerSlipCreate from "../module/Placement/BrokerSlipCreate";
import QuickQuote from "../module/Sales/QuickQuote";
import UserAccessMatrix from "../module/AccessControl/UserAccessMatrix";
import RolePermissions from "../module/AccessControl/RolePermissions";
import AuthorityMatrix from "../module/AccessControl/AuthorityMatrix";
import Delegations from "../module/AccessControl/Delegations";
import SodRules from "../module/AccessControl/SodRules";
import AccessReviews from "../module/AccessControl/AccessReviews";
// client onboarding before the first policy (customer due diligence)
import ClientOnboarding from "../agentModule/quoteModule/clientOnboarding";
import BundleProducts from "../module/PackagedProducts/BundleProducts";
import InsurerRateTables from "../module/PackagedProducts/InsurerRateTables";
import LguTaxRates from "../module/PackagedProducts/LguTaxRates";
import PaymentGateways from "../module/PackagedProducts/PaymentGateways";
import BrokerSlipDetail from "../module/Placement/BrokerSlipDetail";
import PlacementList from "../module/Placement/PlacementList";
import PlacementDetail from "../module/Placement/PlacementDetail";
import DirectPlacementForm from "../module/Placement/DirectPlacementForm";
import RecordEpolicy from "../module/Placement/RecordEpolicy";
import PolicyRenewalWaiting from "../agentModule/renewalModule/WaitingScreen/PolicyRenewalWaiting";
// Integrations: monitor, message templates, insurer integration, CTPL authentication, bank payment files
import IntegrationsMonitor from "../module/Integrations/IntegrationsMonitor";
import MessageTemplates from "../module/Integrations/MessageTemplates";
import InsurerIntegration from "../module/Integrations/InsurerIntegration";
import CtplAuthentication from "../module/Integrations/CtplAuthentication";
import BankFileLayouts from "../module/Integrations/BankFileLayouts";
import BankPaymentFiles from "../module/Integrations/BankPaymentFiles";
import SapGlExport from "../module/Integrations/SapGlExport";

// Commission Module Imports
import CommissionDashboard from "../module/Commission/CommissionDashboard";
import ReferrerAccounts from "../module/Commission/ReferrerAccounts";
import ReferrerAccountDetail from "../module/Commission/ReferrerAccountDetail";

// Product Configurator Module Imports
import ProductDashboard from "../module/ProductConfigurator/ProductDashboard";
import {
  ProductTemplateManager,
  CoverageBuilder,
  RatingEngine,
  UnderwritingRules,
  MarketMapping,
  DocumentManager,
  ProductAnalytics,
} from "../module/ProductConfigurator/ProductConfiguratorScreens";
import {
  RiskMappingList,
  RiskMappingDetail,
} from "../module/ProductConfigurator/RiskMapping";

import MyWork from "../module/MyWork";
import { Navigate } from "react-router-dom";
import EditRequestForm from "../module/PettyCashManagement/Request/EditRequest";
import ClaimModule from "../agentModule/claimModule";
import PolicyModule from "../agentModule/policyModule";
import QuotationModule from "../agentModule/quotationModule";
import PolicyAccountingView from "../agentModule/quoteModule/policyAccountingView";
import PremiumAccountingEntries from "../agentModule/policyModule/PremiumAccountingEntries";
import AccountingQuery from "../agentModule/accountingModule/AccountingQuery";
import AllClientsAccountingView from "../agentModule/accountingModule/AllClientsAccountingView";
import EmployeeLeadCreation from "../agentModule/EmployeeFlow/EmployeeLeadCreation";
import FireLeadCreation from "../agentModule/leadModule/FireLeadCreation";
import IarLeadCreation from "../agentModule/leadModule/IarLeadCreation";
import CQPolicyAndRiskDetails from "../agentModule/EmployeeFlow/CQPolicyAndRiskDetails";
import CQEmployeeBulkUpload from "../agentModule/EmployeeFlow/CQEmployeeBulkUpload";
import CQcoverageDetails from "../agentModule/EmployeeFlow/CQcoverageDetails";
import CQOrderSummary from "../agentModule/EmployeeFlow/CQorderSummary";
import CQquoteDetails from "../agentModule/EmployeeFlow/CQquoteDetails";
import PCwaitingForPolicy from "../agentModule/EmployeeFlow/PCwaitinForPolicy";
import PCuploadPolicy from "../agentModule/EmployeeFlow/PCuploadPolicy";
import PCpolicyDetails from "../agentModule/EmployeeFlow/PCpolicydetails";
import EndorsementSummary from "../agentModule/endorsementModule/personalDetails/endorsementSummary/EndorsementSummary";
import BatchRenewalModal from "../agentModule/policyModule/BatchRenewal";
import PaymentConfirmationEmployeeBenefit from "../agentModule/endorsementModule/paymentConfirmationEmployee";
import ProductRecommendation from "../agentModule/quoteModule/productRecommendation";
// Distribution, motor programmes and products
import LeadAssignment from "../module/Distribution/LeadAssignment";
import DistributionChannels from "../module/Distribution/DistributionChannels";
import DealerProgrammes from "../module/Distribution/DealerProgrammes";
import FleetSchedules from "../module/Distribution/FleetSchedules";
import OpenCovers from "../module/Distribution/OpenCovers";
import ComparisonReports from "../module/Distribution/ComparisonReports";
import Campaigns from "../module/Distribution/Campaigns";
import ReportBuilder from "../module/Distribution/ReportBuilder";

// The former addresses of My Work (Home, Operations > My Work, Open Items) lead to /my-work, keeping the query string
// that links in notifications carry (?tab=tasks&task=...).
const ToMyWork = () => {
  const { search } = useLocation();
  return <Navigate to={`/my-work${search}`} replace />;
};

const Maincomponent = () => {
  return (
    <div className="parent__main__container">
      <Routes>
        {/* sign-in: agentModule/authModule/Login (App.js route /login) */}
        <Route element={<ProtectedLayout />}>
          <Route
            path="/accounts/correctionsjv/correctionsjvdetails"
            element={<CorrectionJV />}
          />

          {/* Receipts */}

          <Route
            path="/accounts/receipts/addpolicyreceipts"
            element={<Navigate to="/accounts/receipts/addreceipts" replace />}
          />

          <Route
            path="/accounts/receipts/policyreceiptsview"
            element={<PolicyReceiptsView />}
          />

          <Route path="/accounts/receipts" element={<PolicyReceipts />} />
          <Route
            path="/accounts/receipts/addreceiptedit"
            element={<AddPolicyEdit />}
          />
          <Route
            path="/accounts/receipts/receiptdetailview"
            element={<PolicyReceiptsView />}
          />
          <Route
            path="/accounts/receipts/paymentdetails"
            element={<PaymentDetails />}
          />

          <Route
            path="/accounts/receipts/addreceipts"
            element={<AddPolicyReceipts1 />}
          />

          {/* Payment Vouchers */}

          <Route path="accounts/paymentvoucher" element={<Paymentvoucher />} />
          <Route
            path="accounts/paymentvoucher/createvoucher"
            element={<CreateVoucher />}
          />
          <Route
            path="accounts/paymentvoucher/bulk-disburse"
            element={<BulkDisburse />}
          />
          <Route
            path="accounts/paymentvoucher/invoicelist/:disbursementId"
            element={<SpecificVoucher />}
          />
          <Route
            path="accounts/paymentvoucher/detailview/:id"
            element={<Detailview />}
          />
          <Route
            path="accounts/paymentvoucher/bankdetailselection"
            element={<Bankdetailselection />}
          />

          <Route
            path="accounts/paymentvoucher/SpecificVoucher"
            element={<SpecificVoucher />}
          />

          {/* Journal voucher */}

          <Route path="/accounts/journalvoucher" element={<Journalvoucher />} />
          <Route
            path="/accounts/journalvoucher/addjournalvoucture"
            element={<AddJournalVoucture />}
          />
          <Route
            path="/accounts/journalvoucher/detailsjournalvocture/:id"
            element={<DetailsJournalVocture />}
          />
          <Route
            path="/accounts/open-entry-matching"
            element={<OpenEntryMatching />}
          />
          <Route
            path="/accounts/open-entry-unmatching"
            element={<OpenEntryUnmatching />}
          />

          {/* Corrections JV */}

          {/* Reversals JV */}

          <Route
            path="/accounts/reversaljv/reversaljvdetails"
            element={<Reversalsjv />}
          />

          {/* Petty Cash Management */}
          <Route
            path="accounts/pettycash/pettycashcodeinitiate"
            element={<Initiate />}
          />
          <Route
            path="accounts/pettycash/pettycashcodeinitiate/initiate"
            element={<InitiateForm />}
          />
          <Route
            path="accounts/pettycash/PettyCashCodeDetails"
            element={<PettyCashCodeDetails />}
          />
          <Route
            path="accounts/pettycash/pettycashrequest"
            element={<PettyCashRequest />}
          />
          <Route
            path="accounts/pettycash/editrequestform/edit/:id"
            element={<EditRequestForm action="edit" />}
          />
          <Route
            path="accounts/pettycash/editrequestform/view/:id"
            element={<EditRequestForm action="view" />}
          />
          <Route
            path="accounts/pettycash/addrequest/add/:id"
            element={<RequestForm action="add" />}
          />
          <Route
            path="accounts/pettycash/addrequesttable"
            element={<AddRequestTable />}
          />
          <Route
            path="accounts/pettycash/disbursement"
            element={<Disbursement />}
          />
          <Route
            path="accounts/pettycash/adddisbursement"
            element={<AddDisbursement />}
          />
          <Route
            path="accounts/pettycash/adddisbursementtable"
            element={<AddDisbursementTable />}
          />
          <Route
            path="accounts/pettycash/disbursementdetailview"
            element={<DisbursementDetailview />}
          />
          <Route path="accounts/pettycash/request" element={<Request />} />
          <Route
            path="accounts/pettycash/receipts"
            element={<PettyCashReceipts />}
          />
          <Route
            path="accounts/pettycash/addreceipts"
            element={<AddReceipts />}
          />
          <Route
            path="accounts/pettycash/addreceiptstable"
            element={<AddReceiptsTable />}
          />
          <Route
            path="accounts/pettycash/receiptlist"
            element={<ReceiptList />}
          />
          <Route
            path="accounts/pettycash/replenish"
            element={<PettyCashReplenish />}
          />
          <Route
            path="accounts/pettycash/addreplenish"
            element={<AddReplenish />}
          />
          <Route
            path="accounts/pettycash/addreplenishtable"
            element={<AddReplenishTable />}
          />
          <Route
            path="accounts/pettycash/replenishtdetailview"
            element={<ReplenishtDetailView />}
          />
          {/* Finacel Master Route*/}

          {/* General Master */}

          {/* Organization Master */}
          <Route
            path="master/generals/organization/companymaster"
            element={<CompanyMasters />}
          />

          <Route
            path="master/generals/organization/companymaster/add/:id"
            element={<AddCompany action="add" />}
          />
          <Route
            path="master/generals/organization/companymaster/edit/:id"
            element={<AddCompany action="edit" />}
          />
          <Route
            path="master/generals/organization/companymaster/view/:id"
            element={<AddCompany action="view" />}
          />

          {/* Branch master */}
          <Route
            path="master/generals/organization/branchmaster"
            element={<BranchMasters />}
          />
          <Route
            path="master/generals/organization/branchmaster/add/:id"
            element={<AddBranch action="add" />}
          />
          <Route
            path="master/generals/organization/branchmaster/edit/:id"
            element={<AddBranch action="edit" />}
          />
          <Route
            path="master/generals/organization/branchmaster/view/:id"
            element={<AddBranch action="view" />}
          />
          {/* Insurance Management Masters */}
          <Route
            path="master/generals/insurancemanagement/insurancecompany"
            element={<InsuranceCompany />}
          />
          <Route
            path="master/generals/insurancemanagement/insurancecompany/add/:id"
            element={<InsuranceDetailsAction action="add" />}
          />
          <Route
            path="master/generals/insurancemanagement/insurancecompany/edit/:id"
            element={<InsuranceDetailsAction action="edit" />}
          />
          <Route
            path="master/generals/insurancemanagement/insurancecompany/view/:id"
            element={<MasterRecordView entity="master:insurance-company"><InsuranceDetailsAction action="view" /></MasterRecordView>}
          />

          <Route
            path="master/generals/insurancemanagement/lineofbusiness"
            element={<LineOfBusiness />}
          />
          <Route
            path="master/generals/insurancemanagement/lineofbusiness/add/:id"
            element={<LineBusinessDetailsAction action="add" />}
          />
          <Route
            path="master/generals/insurancemanagement/lineofbusiness/edit/:id"
            element={<LineBusinessDetailsAction action="edit" />}
          />
          <Route
            path="master/generals/insurancemanagement/lineofbusiness/view/:id"
            element={<MasterRecordView entity="master:line-of-business"><LineBusinessDetailsAction action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/insurancemanagement/productmaster"
            element={<ProductMaster />}
          />
          <Route
            path="master/generals/insurancemanagement/productmaster/add/:id"
            element={<ProductMatserDetailsAction action="add" />}
          />
          <Route
            path="master/generals/insurancemanagement/productmaster/edit/:id"
            element={<ProductMatserDetailsAction action="edit" />}
          />
          <Route
            path="master/generals/insurancemanagement/productmaster/view/:id"
            element={<MasterRecordView entity="master:product"><ProductMatserDetailsAction action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/insurancemanagement/policytype"
            element={<PolicyType />}
          />
          <Route
            path="master/generals/insurancemanagement/policytype/add/:id"
            element={<PolicyTypeDetailsAction action="add" />}
          />
          <Route
            path="master/generals/insurancemanagement/policytype/edit/:id"
            element={<PolicyTypeDetailsAction action="edit" />}
          />
          <Route
            path="master/generals/insurancemanagement/policytype/view/:id"
            element={<MasterRecordView entity="master:policy-type"><PolicyTypeDetailsAction action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/insurancemanagement/cover"
            element={<Cover />}
          />
          <Route
            path="master/generals/insurancemanagement/cover/add/:id"
            element={<CoverDetailsAction action="add" />}
          />
          <Route
            path="master/generals/insurancemanagement/cover/edit/:id"
            element={<CoverDetailsAction action="edit" />}
          />
          <Route
            path="master/generals/insurancemanagement/cover/view/:id"
            element={<MasterRecordView entity="master:cover"><CoverDetailsAction action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/insurancemanagement/signatories"
            element={<Signatories />}
          />
          <Route
            path="master/generals/insurancemanagement/signatories/add/:id"
            element={<SignatoriesDetailsAction action="add" />}
          />
          <Route
            path="master/generals/insurancemanagement/signatories/edit/:id"
            element={<SignatoriesDetailsAction action="edit" />}
          />
          <Route
            path="master/generals/insurancemanagement/signatories/view/:id"
            element={<MasterRecordView entity="master:signatory"><SignatoriesDetailsAction action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/insurancemanagement/vehicle"
            element={<Vahicle />}
          />
          <Route
            path="master/generals/insurancemanagement/vehicle/add/:id"
            element={<VehicleDetailsAction action="add" />}
          />
          <Route
            path="master/generals/insurancemanagement/vehicle/edit/:id"
            element={<VehicleDetailsAction action="edit" />}
          />
          <Route
            path="master/generals/insurancemanagement/vehicle/view/:id"
            element={<MasterRecordView entity="master:vehicle"><VehicleDetailsAction action="view" /></MasterRecordView>}
          />

          {/* Location */}

          <Route
            path="master/generals/location/country"
            element={<Country />}
          />
          <Route
            path="master/generals/location/country/edit"
            element={<AddCountry action="edit" />}
          />
          <Route
            path="master/generals/location/country/view"
            element={<MasterRecordView><AddCountry action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/location/country/add"
            element={<AddCountry action="add" />}
          />

          <Route path="master/generals/location/state" element={<State />} />

          <Route
            path="master/generals/location/state/edit"
            element={<AddState action="edit" />}
          />
          <Route
            path="master/generals/location/state/view"
            element={<MasterRecordView><AddState action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/location/state/add"
            element={<AddState action="add" />}
          />

          <Route path="master/generals/location/city" element={<City />} />

          <Route
            path="master/generals/location/city/edit"
            element={<AddCity action="edit" />}
          />
          <Route
            path="master/generals/location/city/view"
            element={<MasterRecordView><AddCity action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/location/city/add"
            element={<AddCity action="add" />}
          />

          {/* Employee Management */}

          {/* Hierarchy */}

          <Route
            path="master/generals/employeemanagement/hierarchy"
            element={<HierarchyMaster />}
          />
          <Route
            path="master/generals/employeemanagement/hierarchy/add"
            element={<AddHierarchy action="add" />}
          />
          <Route
            path="master/generals/employeemanagement/hierarchy/edit/:id"
            element={<AddHierarchy action="edit" />}
          />
          <Route
            path="master/generals/employeemanagement/hierarchy/view/:id"
            element={<MasterRecordView entity="master:hierarchy"><AddHierarchy action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/employeemanagement/:id"
            element={<AddHierarchy />}
          />

          <Route
            path="master/generals/employeemanagement/designation"
            element={<Designation />}
          />
          <Route
            path="master/generals/employeemanagement/designation/add/:id"
            element={<AddDesignation action="add" />}
          />
          <Route
            path="master/generals/employeemanagement/designation/edit/:id"
            element={<AddDesignation action="edit" />}
          />
          <Route
            path="master/generals/employeemanagement/designation/view/:id"
            element={<MasterRecordView entity="master:designation"><AddDesignation action="view" /></MasterRecordView>}
          />

          <Route
            path="master/generals/employeemanagement/adddesignation"
            element={<AddDesignation />}
          />

          {/* User Management */}
          <Route
            path="master/generals/usermanagement/user"
            element={<User />}
          />
          <Route
            path="master/generals/usermanagement/useredit"
            element={<UserEdit />}
          />
          <Route
            path="master/generals/usermanagement/user/add"
            element={<AddUser action="add" />}
          />
          <Route
            path="master/generals/usermanagement/user/edit/:id"
            element={<AddUser action="edit" />}
          />
          <Route
            path="master/generals/usermanagement/user/view/:id"
            element={<MasterRecordView entity="user"><AddUser action="view" /></MasterRecordView>}
          />
          <Route
            path="master/generals/usermanagement/adduser"
            element={<AddUser />}
          />
          <Route
            path="master/generals/usermanagement/role"
            element={<Role />}
          />
          <Route
            path="master/generals/usermanagement/role/add/:id"
            element={<AddRole action="add" />}
          />
          <Route
            path="master/generals/usermanagement/role/edit/:id"
            element={<AddRole action="edit" />}
          />
          <Route
            path="master/generals/usermanagement/role/view/:id"
            element={<MasterRecordView entity="role"><AddRole action="view" /></MasterRecordView>}
          />

          {/* the earlier finance Branch and Company masters open the Organization masters */}
          <Route path="master/finance/branch/*" element={<Navigate to="/master/generals/organization/branchmaster" replace />} />
          <Route path="master/finance/company/*" element={<Navigate to="/master/generals/organization/companymaster" replace />} />

          {/* Department Master Module */}
          <Route
            path="master/finance/department/departmentadding"
            element={<DepartmentAdding />}
          />
          <Route
            path="master/finance/department/departmentdetailsview"
            element={<DepartmentDetailsView />}
          />
          <Route
            path="master/finance/department"
            element={<DepartmentMasterInitial />}
          />

          {/* Main Account Master */}

          {/* Account Category Master */}

          <Route
            path="master/finance/accountcategory"
            element={<AccountCategoryMaster />}
          />




          {/* pettycash */}


          <Route />
          <Route path="master/configuration/email-layout" element={<EmailLayoutPage />} />
          <Route path="master/configuration/documents-layout" element={<DocumentsLayoutPage />} />
          <Route path="master/configuration/document-signatures" element={<DocumentSignaturesPage />} />
          <Route path="master/configuration/settings" element={<ConfigurationPage />} />
          <Route path="master/configuration/schedules" element={<SchedulesPage />} />
          <Route path="master/configuration/document-numbering" element={<DocumentNumberingPage />} />
          <Route path="master/finance/commission-rate-matrix" element={<CommissionRateMatrix />} />
          <Route path="master/configuration/audit-trail" element={<AuditTrailPage />} />
          {/* features and releases: read only for the tenant; enabling by the iorta TechNXT platform administrator */}
          <Route path="master/configuration/features" element={<FeatureCatalogue />} />
          <Route path="master/platform/features" element={<PlatformFeatures />} />
          <Route path="master/configuration/email-outbox" element={<EmailOutboxPage />} />
          <Route path="master/finance/currency" element={<CurrencyMaster />} />

          {/* Bank */}

          <Route path="master/finance/bank" element={<BankMaster />} />
          <Route
            path="master/finance/bank/addbankmaster"
            element={<AddBankMaster />}
          />
          <Route
            path="master/finance/bank/accountdataview"
            element={<Accountdataview />}
          />
          <Route
            path="master/finance/bank/accountdataview/addaccountdetail"
            element={<AddAccountDetail />}
          />
          <Route
            path="master/finance/bank/accountdataview/viewaccountdetail"
            element={<ViewAccountDetail />}
          />
          <Route
            path="master/finance/bank/accountdataview/editaccountdetail"
            element={<EditAccountDetail action="Edit" />}
          />

          {/* exchangeRate */}
          <Route
            path="master/finance/exchangerate"
            element={<ExchangeRateMaster />}
          />
          <Route
            path="master/finance/exchangerate/addexchange"
            element={<AddExchange />}
          />
          <Route
            path="master/finance/exchangerate/saveandeditexchange"
            element={<SaveAndEditExchange />}
          />
          <Route
            path="master/finance/exchangerate/viewexchange"
            element={<ViewExchange />}
          />

          {/*  */}

          <Route
            path="master/finance/mainaccount"
            element={<ChartOfAccounts />}
          />
          <Route
            path="master/finance/mainaccount/addmainaccount"
            element={<ChartOfAccounts />}
          />
          <Route
            path="master/finance/mainaccount/editmainaccount"
            element={<ChartOfAccounts />}
          />
          <Route
            path="master/finance/mainaccount/viewmainaccount"
            element={<ChartOfAccounts />}
          />

          <Route
            path="master/finance/subaccount"
            element={<ChartOfAccounts level="sub" />}
          />
          {/* Taxation: the tax codes master (VAT, EWT / FWT with BIR ATC, DST, LGT) */}
          <Route path="master/finance/taxation" element={<TaxCodes />} />
          <Route path="master/finance/close-checklist" element={<CloseChecklist />} />
          <Route path="master/finance/bank-statement-formats" element={<BankStatementFormats />} />
          <Route path="master/finance/insurer-statement-formats" element={<InsurerStatementFormats />} />
          <Route path="master/finance/bank-transaction-types" element={<BankTransactionTypes />} />

          {/* Transactioncode */}

          <Route
            path="master/finance/transactioncode"
            element={<TransactionCodeMaster />}
          />
          <Route
            path="master/finance/transactioncode/addtransactioncode"
            element={<TransactionCodeMasterView />}
          />
          <Route
            path="master/finance/transactioncode/transactioncodedetails"
            element={<MasterRecordView entity="master:transaction-code" selectRecordId={(state) => state.transactionCodeMasterReducer?.TrascationcodeDetailsView?.id}><TransactionCodeDetails /></MasterRecordView>}
          />

          <Route
            path="master/finance/transactioncode/transactioncodeedit"
            element={<TransactioncodeEdit />}
          />

          {/* Account Determination (the GL account of every account role the posting rules use); the former
              Premium / Miscellaneous / Customer / RI-Claims account setup screens open its sections */}
          <Route
            path="master/finance/account-determination"
            element={<AccountDetermination />}
          />
          <Route
            path="master/finance/premium-account-setup"
            element={<AccountDetermination section="premium" />}
          />
          <Route
            path="master/finance/miscellaneous-account-setup"
            element={<AccountDetermination section="miscellaneous" />}
          />
          <Route
            path="master/finance/customer-account-setup"
            element={<AccountDetermination section="customer" />}
          />
          <Route
            path="master/finance/ri-claim-account-setup"
            element={<AccountDetermination section="claims" />}
          />
          <Route
            path="master/finance/posting-rules"
            element={<PostingRules />}
          />
          <Route path="master/finance/configuration-approvals" element={<ConfigurationApprovals />} />
          <Route path="master/finance/accounting-flow" element={<AccountingFlow />} />
          <Route path="master/finance/fs-versions" element={<FsVersions />} />

          {/* Remittance Master Routes */}
          <Route
            path="master/finance/remittance"
            element={<RemittanceMaster />}
          />
          <Route
            path="master/finance/remittance/automatedremittance/:mode"
            element={<AutomatedRemittanceMaster />}
          />
          <Route
            path="master/finance/remittance/statementtemplate/:mode"
            element={<StatementTemplateMaster />}
          />
          <Route
            path="master/finance/remittance/settlementparameter/:mode"
            element={<SettlementParameterMaster />}
          />
          <Route
            path="master/finance/remittance/bulkprocessingmaster/:mode"
            element={<BulkProcessingMaster />}
          />
          <Route
            path="master/finance/remittance/exceptionmaster/:mode"
            element={<ExceptionMaster />}
          />
          <Route
            path="master/finance/remittance/agencybillmaster/:mode"
            element={<AgencyBillMaster />}
          />
          <Route
            path="master/finance/remittance/adjustmentmaster/:mode"
            element={<AdjustmentMaster />}
          />
          <Route
            path="master/finance/remittance/notificationmaster/:mode"
            element={<NotificationMaster />}
          />

          {/* Accounts > Remittance: the menu entries, the record routes and the addresses of the retired screens */}
          {remittanceRoutes()}
          {/* Placement journey */}
          <Route path="/sales/quick-quote" element={<QuickQuote />} />
          <Route path="/master/generals/usermanagement/access-matrix" element={<UserAccessMatrix />} />
          <Route path="/master/generals/usermanagement/role-permissions" element={<RolePermissions />} />
          <Route path="/master/generals/usermanagement/authority-matrix" element={<AuthorityMatrix />} />
          <Route path="/master/generals/usermanagement/delegations" element={<Delegations />} />
          <Route path="/master/generals/usermanagement/segregation-of-duties" element={<SodRules />} />
          <Route path="/master/generals/usermanagement/access-reviews" element={<AccessReviews />} />
          {/* client onboarding before the first policy */}
          <Route path="/agent/client-onboarding" element={<ClientOnboarding />} />
          <Route path="/agent/client-onboarding/:id" element={<ClientOnboarding />} />
          <Route path="/master/finance/package-bundles" element={<BundleProducts />} />
          <Route path="/master/finance/insurer-rate-tables" element={<InsurerRateTables />} />
          <Route path="/master/finance/premium-taxes" element={<LguTaxRates />} />
          <Route path="/master/finance/payment-gateways" element={<PaymentGateways />} />
          {/* Integrations */}
          <Route path="/master/configuration/integrations" element={<IntegrationsMonitor />} />
          <Route path="/master/configuration/message-templates" element={<MessageTemplates />} />
          <Route path="/master/configuration/insurer-integration" element={<InsurerIntegration />} />
          <Route path="/operations/ctpl-authentication" element={<CtplAuthentication />} />
          <Route path="/master/finance/bank-file-layouts" element={<BankFileLayouts />} />
          <Route path="/accounts/bank-payment-files" element={<BankPaymentFiles />} />
          <Route path="/accounts/sap-gl-export" element={<SapGlExport />} />
          <Route path="/placement/broker-slips" element={<BrokerSlipList />} />
          <Route path="/placement/broker-slips/new" element={<BrokerSlipCreate />} />
          <Route path="/placement/broker-slips/:id" element={<BrokerSlipDetail />} />
          <Route path="/placement/placement-slips" element={<PlacementList />} />
          <Route path="/placement/placement-slips/new" element={<DirectPlacementForm />} />
          <Route path="/placement/placement-slips/:id" element={<PlacementDetail />} />
          <Route path="/placement/record-epolicy" element={<RecordEpolicy />} />

          {/* Incentive Master Routes */}
          <Route
            path="master/incentive/programs/:mode"
            element={<IncentiveProgramMaster />}
          />

          {/* Incentive User Routes */}
          <Route path="incentive/my-programs" element={<MyPrograms />} />
          <Route
            path="incentive/calculations"
            element={<IncentiveCalculations />}
          />
          <Route path="incentive/approvals" element={<IncentiveApprovals />} />
          <Route path="incentive/reports" element={<IncentiveReports />} />
          <Route path="incentive/statement" element={<IncentiveStatement />} />

          {/* Renewal Module Routes */}
          <Route path="renewal/queue" element={<RenewalQueue />} />
          <Route
            path="renewal/generate-quote/:policyId"
            element={<QuoteGeneration />}
          />
          <Route path="renewal/analytics" element={<RetentionAnalytics />} />
          <Route path="renewal/at-risk" element={<AtRiskAnalysis />} />
          <Route path="renewal/lock-in-accounts" element={<LockInAccounts />} />
          <Route
            path="renewal/negotiations"
            element={<NegotiationWorkspace />}
          />
          <Route
            path="renewal/lapse-management"
            element={<LapseManagement />}
          />
          <Route path="renewal/performance" element={<PerformanceTracking />} />

          {/* Commission Module Routes */}
          <Route
            path="commission/dashboard"
            element={<CommissionDashboard />}
          />
          <Route
            path="commission/referrer-accounts"
            element={<ReferrerAccounts />}
          />
          <Route
            path="commission/referrer-accounts/:id"
            element={<ReferrerAccountDetail />}
          />

          {/* Product Configurator Module Routes */}
          <Route
            path="product-configurator/dashboard"
            element={<ProductDashboard />}
          />
          <Route
            path="product-configurator/templates"
            element={<ProductTemplateManager />}
          />
          <Route
            path="product-configurator/template/:id"
            element={<ProductTemplateManager />}
          />
          <Route
            path="product-configurator/create"
            element={<ProductTemplateManager />}
          />
          <Route
            path="product-configurator/coverages"
            element={<CoverageBuilder />}
          />
          <Route
            path="product-configurator/rating"
            element={<RatingEngine />}
          />
          <Route
            path="product-configurator/underwriting"
            element={<UnderwritingRules />}
          />
          <Route
            path="product-configurator/documents"
            element={<DocumentManager />}
          />
          <Route
            path="product-configurator/market-mapping"
            element={<MarketMapping />}
          />
          <Route
            path="product-configurator/risk-mapping"
            element={<RiskMappingList />}
          />
          <Route
            path="product-configurator/risk-mapping/:id"
            element={<RiskMappingDetail />}
          />
          <Route
            path="product-configurator/analytics"
            element={<ProductAnalytics />}
          />

          <Route
            path="master/finance/subaccount/subaccountdetails"
            element={<ChartOfAccounts level="sub" />}
          />
          <Route
            path="master/finance/subaccount/subaccountedit"
            element={<ChartOfAccounts level="sub" />}
          />
          <Route
            path="master/finance/currency/addcurrency"
            element={<AddCurrency />}
          />
          <Route
            path="master/finance/currency/editcurrency"
            element={<EditCurrency />}
          />
          <Route
            path="master/finance/currency/viewcurrency"
            element={<MasterRecordView entity="master:currency" selectRecordId={(state) => state.currencyMasterReducer?.CurrencyDetailView?.id}><ViewCurrency /></MasterRecordView>}
          />

          {/* // Dashboard Routes */}
          {/* after sign-in: My Work with the role preset */}
          <Route path="/" element={<ToMyWork />} />
          <Route path="/dashboard" element={<MyDashboard />} />
          <Route path="/executive/dashboard" element={<ExecutiveDashboard />} />
          <Route path="/claims/dashboard" element={<ClaimsDashboard />} />
          <Route path="/sales/dashboard" element={<SalesDashboard />} />
          <Route
            path="/processing/dashboard"
            element={<UnderwritingDashboard />}
          />
          <Route path="/underwriting/dashboard" element={<Navigate to="/processing/dashboard" replace />} />

          {/* My Work: the first screen of every role after sign-in */}
          <Route path="/my-work" element={<MyWork />} />
          <Route path="/agent/home" element={<ToMyWork />} />
          <Route path="/agent/notification" element={<Notification />} />
          <Route path="/account/profile" element={<MyProfile />} />
          <Route path="/agent/viewprofile" element={<Navigate to="/account/profile" replace />} />
          <Route path="/agent/editprofile" element={<Navigate to="/account/profile" replace />} />
          {/* // Lead Creation, edit lead & Lead listing */}
          <Route
            path="/agent/createlead"
            element={<LeadCreation flow="create" action="post" />}
          />
          <Route path="/agent/leadlisting" element={<LeadListing />} />
          <Route
            path="/agent/leadedit/:leadId"
            element={<LeadEdit flow="lead" action="edit" />}
          />
          <Route path="/agent/leaddetail/:leadId" element={<LeadDetail />} />
          <Route
            path="/agent/clientedit"
            element={<LeadCreation flow="client" action="edit" />}
          />
          {/* // Quote Creation, Policy conversion & Client listing */}
          <Route
            path="/agent/createquote/policydetails/createquote/:id"
            element={<PolicyDetails action="createquote" flow="lead" />}
          />

          <Route
            path="/agent/createquote/policydetails/quotedetails/:id"
            element={<PolicyDetails action="quotedetails" flow="client" />}
          />
          <Route
            path="/agent/editquote/policydetails/quotedetails/:id"
            element={<PolicyDetails action="quotedetails" flow="lead" />}
          />
          <Route
            path="/agent/editquote/coveragedetails/coveragedetail/:id"
            element={<CoverageDeatails action="coveragedetail" flow="normal" />}
          />
          <Route
            path="/agent/createquote/coveragedetails/coveragecreate/:id"
            element={<CoverageDeatails action="coveragecreate" flow="normal" />}
          />
          <Route
            path="/agent/createquote/product-recommendation"
            element={
              <ProductRecommendation
                action="productrecommendation"
                flow="normal"
              />
            }
          />
          <Route
            path="/agent/createquote/coveragedetails/coveragedetail/:id"
            element={<CoverageDeatails action="coveragedetail" flow="normal" />}
          />
          <Route
            path="/agent/renewalquote/coveragedetails/coveragedetail/:id"
            element={<RenewalCoverageStep />}
          />
          <Route
            path="/agent/renewalquote/accessories/accessorirsdetails/:id"
            element={<Accessories action="accessoriescreate" flow="renewal" />}
          />
          <Route
            path="/agent/editquote/accessories/accessorirsdetails/:id"
            element={<Accessories action="accessorirsdetails" flow="normal" />}
          />
          <Route
            path="/agent/createquote/accessories/accessoriescreate/:id"
            element={<Accessories action="accessoriescreate" flow="normal" />}
          />
          <Route
            path="/agent/createquote/accessories/accessorirsdetails/:id"
            element={<Accessories action="accessorirsdetails" flow="normal" />}
          />
          <Route
            path="/agent/renewalquote/ordersummary/:id"
            element={<OrderSummary action="post" flow="renewal" />}
          />
          <Route
            path="/agent/createquote/ordersummary/:leadRefId"
            element={<OrderSummary action="post" flow="normal" />}
          />
          <Route
            path="/agent/editquote/ordersummary/:id"
            element={<OrderSummary action="edit" flow="normal" />}
          />
          <Route
            path="/agent/editquote/ordersummaryquote/:quotationId"
            element={<OrderSummaryQuote action="view" />}
          />
          <Route
            path="/agent/createquote/ordersummaryquote/:leadRefId"
            element={<OrderSummaryQuote action="view" />}
          />
          <Route path="/agent/claim/claimtable" element={<ClaimModule />} />
          <Route path="/agent/claim" element={<Claim />} />
          <Route path="/agent/policy" element={<Policy />} />
          <Route path="/agent/policy/policytable" element={<PolicyModule />} />
          <Route path="/agent/Quotation" element={<Quotation />} />
          <Route
            path="/agent/quotation/quotationtable"
            element={<QuotationModule />}
          />
          <Route
            path="/agent/endorsement/summary/:id"
            element={<EndorsementSummary action="view" />}
          />

          <Route
            path="/agent/quotedetailview/:id"
            element={<QuoteDetailView action="view" />}
          />
          {/* Alias: PolicyDetailView links to quotedetailsview (with 's') */}
          <Route
            path="/agent/quotedetailsview/:id"
            element={<QuoteDetailView action="view" />}
          />
          <Route
            path="/agent/quotedetailview"
            element={<QuoteDetailView action="view" />}
          />
          <Route
            path="/agent/quotedetailedit"
            element={<QuoteDetailView action="edit" />}
          />
          <Route path="/agent/quotelisting" element={<QuoteListing />} />
          <Route
            path="/agent/quotecomparisonview"
            element={<QuoteComparisonView />}
          />
          <Route
            path="/agent/convertpolicy/customerinfo/view/:id"
            element={<CustomerInfo action="post" />}
          />

          <Route
            path="/agent/convertpolicy/customerinfo/new/:quotationId"
            element={<CustomerInfo action="new" />}
          />
          <Route
            path="/agent/convertpolicy/customerinfo/fire/new/:quotationId"
            element={<CustomerInfoFire action="new" />}
          />

          <Route
            path="/agent/convertpolicy/customerinfo/edit/:id"
            element={<CustomerInfo action="edit" />}
          />

          <Route
            path="/agent/convertpolicy/uploadvehiclephotos"
            element={<UploadVehiclePhotos />}
          />

          <Route
            path="/agent/convertpolicy/uploadvehiclephotos/:quotationId"
            element={<UploadVehiclePhotos />}
          />

          <Route
            path="/agent/convertpolicy/uploadpolicy/:quotationId"
            element={<UploadPolicy />}
          />
          <Route
            path="/agent/coveragedetailedview"
            element={<CoverageDetailedVew />}
          />
          <Route
            path="/agent/coveragedetailedview/:quotationId"
            element={<CoverageDetailedVew />}
          />
          <Route
            path="/agent/convertpolicy/coveragedetails/:quotationId"
            element={<CoverageDetailedVew />}
          />
          <Route path="/agent/policyapproval" element={<PolicyApproval />} />
          <Route path="/agent/uploadpolicy" element={<UploadPolicy />} />
          <Route
            path="/agent/uploadpolicy/:quotationId"
            element={<UploadPolicy />}
          />
          <Route
            path="/agent/policydetailedview/:id"
            element={<PolicyDetailedView action="edit" />}
          />

          <Route
            path="/agent/policydetailedview/accountview"
            element={<PolicyAccountingView />}
          />
          <Route
            path="/agent/premium-accounting-entries/:policyId"
            element={<PremiumAccountingEntries />}
          />
          <Route path="/agent/accounting/query" element={<AccountingQuery />} />
          <Route
            path="/agent/accounting/all-clients-details"
            element={<AllClientsAccountingView />}
          />
          <Route
            path="/agent/policydetailedviewonly/:id"
            element={<PolicyDetailedView action="view" />}
          />
          <Route
            path="/agent/policy/paymentconfirmation"
            element={<PaymentConfirmation />}
          />
          <Route
            path="/agent/policy/paymentoptions/:policyId"
            element={<PaymentOptions />}
          />
          <Route
            path="/agent/quote/paymentoptions/:quotationId"
            element={<PaymentOptions />}
          />
          <Route
            path="/agent/quote/paymentconfirmation"
            element={<PaymentConfirmation />}
          />
          <Route
            path="/agent/policy/paymentapproval"
            element={<PaymentApproval />}
          />
          <Route path="/agent/policy/paymenterror" element={<PaymentError />} />
          <Route path="/agent/clientlisting" element={<ClientListing />} />
          <Route path="/agent/clientview/:id" element={<ClientView />} />
          <Route
            path="/agent/policydetail/:policyId"
            element={<PolicyDetailView />}
          />
          {/* // Claims */}
          <Route
            path="/agent/claimrequest/claimdetails/:claimId?"
            element={<ClaimDetails />}
          />
          <Route path="/agent/claimrequest/sendmail" element={<SendMail />} />
          <Route path="/agent/claimrequest/documents/:id" element={<ClaimDocumentsStep />} />
          <Route
            path="/agent/claimrequest/requestapproval/:id"
            element={<RequestApproval flow="normal" />}
          />
          <Route
            path="/agent/quotationmrequest/requestapproval/:id"
            element={<RequestApproval flow="quotation" />}
          />
          <Route
            path="/agent/claimrequest/adjustersubmission/:id"
            element={<AdjusterSubmission />}
          />
          <Route
            path="/agent/claimrequest/settlementapproval/:id"
            element={<SettlementApproval />}
          />
          <Route
            path="/agent/claimrequest/settlementdetails/:id"
            element={<SettlementDetails />}
          />
          <Route
            path="/agent/claimdetailedview/:id"
            element={<ClaimSettlement />}
          />
          <Route path="/agent/claimdetail/:claimId" element={<ClaimDetail />} />
          <Route
            path="/agent/claimaudittrail/:claimId"
            element={<ClaimAuditTrail />}
          />

          <Route path="/agent/claimrejected" element={<ClaimRejected />} />
          <Route
            path="/agent/claimdocumentupload"
            element={<ClaimDocumentUpload />}
          />

          {/* // Endorsement */}
          <Route
            path="/agent/endorsement/personaldetails/:id"
            element={<PersonalDetails />}
          />
          <Route
            path="/agent/endorsement/coveragedetails"
            element={<CoverageDetails />}
          />
          <Route
            path="/agent/endorsementapproval"
            element={<EndorsementApproval />}
          />
          <Route
            path="/agent/uploadendorsement/:endorsementId"
            element={<UploadEndorsement />}
          />
          <Route path="/agent/viewendorsement" element={<ViewEndorsement />} />
          <Route
            path="/agent/endorsementdetailedview/:endorsementId"
            element={<EndorsementDetailedView action="continue" />}
          />
          <Route
            path="/agent/endorsementdetailedviewonly/:endorsementId"
            element={<EndorsementDetailedView action="completed" />}
          />
          <Route
            path="/agent/endorsement/paymentconfirmation/:endorsementId"
            element={<PaymentConfirmationEndorsement />}
          />
          <Route
            path="/agent/employee-benefit/paymentconfirmation"
            element={<PaymentConfirmationEmployeeBenefit />}
          />
          <Route
            path="/agent/endorsement/paymentoptions"
            element={<PaymentOptionsEndorsement />}
          />
          <Route
            path="/agent/endorsement/paymentapproval"
            element={<Endorsementpaymentapproval />}
          />
          <Route
            path="/agent/endorsement/paymenterror/:endorsementId"
            element={<PaymentErrorEndorsment />}
          />
          <Route
            path="/agent/endorsement/rejected/:endorsementId"
            element={<EndorsementRejected />}
          />

          {/* // Payments */}
          <Route path="/agent/payments" element={<Payments />} />
          <Route path="/agent/claim" element={<Claim />} />
          <Route path="/agent/policy" element={<Policy />} />
          <Route
            path="/agent/expired-policies"
            element={<ExpiredPoliciesPage />}
          />
          <Route path="/agent/renewal-batch" element={<BatchRenewalModal />} />
          <Route path="/agent/quotation" element={<Quotation />} />
          <Route
            path="/agent/payments/detail/:id"
            element={<PaymentDetails />}
          />
          {/* the former Open Items and Upcoming Events pages: My Work */}
          <Route path="/agent/openitems" element={<ToMyWork />} />
          <Route path="/agent/openitems/upcomingevents" element={<ToMyWork />} />
          <Route path="/agent/openitems/expiringpolicy" element={<ToMyWork />} />
          <Route path="/agent/openitems/quotepending" element={<ToMyWork />} />

          {/* //Reports */}

          {/* every catalogue report (Reports > All Reports) */}
          <Route path="/reports/catalogue" element={<ReportCatalogue />} />
          <Route path="/reports/run/:code" element={<ReportRunner />} />
          <Route path="/reports/financialreports/pe/:code" element={<PeriodEndReportPage area="financial" />} />
          {/* Period-end processing */}
          <Route path="/accounts/period-end/periods" element={<PeriodManagement />} />
          <Route path="/accounts/period-end/close" element={<MonthEndClose />} />
          <Route path="/accounts/period-end/close/:id" element={<MonthEndCloseRun />} />
          <Route path="/accounts/period-end/year-end" element={<YearEndClose />} />
          <Route path="/accounts/period-end/recurring" element={<RecurringJournals />} />
          <Route path="/accounts/period-end/statements" element={<FinancialStatements />} />
          <Route path="/accounts/tax/2307" element={<Bir2307 />} />
          <Route path="/accounts/tax/reports/:code" element={<PeriodEndReportPage area="tax" />} />
          {/* BIR forms, invoicing and tax */}
          <Route path="/accounts/tax/withholding-returns" element={<WithholdingReturns />} />
          <Route path="/accounts/tax/alphalist-1604e" element={<Alphalist1604E />} />
          <Route path="/accounts/tax/percentage-tax" element={<PercentageTax />} />
          <Route path="/accounts/tax/dat-files" element={<BirDatFiles />} />
          <Route path="/accounts/tax/sales-invoices" element={<SalesInvoices />} />
          <Route path="/accounts/tax/eis" element={<EisOutbox />} />
          <Route path="/accounts/tax/cas" element={<CasPack />} />
          {/* Overriding commission from insurers */}
          <Route path="/commission/insurer-overrides/agreements" element={<OverrideAgreements />} />
          <Route path="/commission/insurer-overrides/computations" element={<OverrideComputations />} />
          {/* Bank reconciliation */}
          <Route path="/accounts/bank-reconciliation" element={<BankRecWorkspace />} />
          <Route path="/accounts/bank-reconciliation/reconciliations" element={<BankReconciliations />} />
          <Route path="/accounts/bank-reconciliation/reconciliations/:id" element={<BankReconciliationRun />} />
          <Route path="/accounts/bank-reconciliation/reports/:code" element={<BankRecReportPage />} />
          <Route path="/accounts/credit-control/instalments" element={<InstalmentPlans />} />
          <Route path="/accounts/credit-control/warranty" element={<WarrantyMonitor />} />
          <Route path="/accounts/credit-control/limits" element={<CreditLimits />} />
          <Route path="/accounts/credit-control/remittance-ageing" element={<RemittanceAgeing />} />
          <Route path="/operations/cover-notes" element={<CoverNotes />} />
          <Route path="/operations/policy-cancellation" element={<PolicyCancellation />} />
          <Route path="/operations/claim-documents" element={<ClaimDocuments />} />
          <Route path="/operations/motor-claim-repairs" element={<MotorClaimRepairs />} />
          <Route path="/accounts/post-dated-cheques" element={<PostDatedCheques />} />
          <Route path="/accounts/unapplied-collections" element={<UnappliedCollections />} />
          <Route path="/accounts/claims-settlements" element={<ClaimsSettlements />} />
          <Route path="/accounts/payables/invoices" element={<SupplierInvoices />} />
          <Route path="/accounts/payables/payments" element={<SupplierPayments />} />
          <Route path="/accounts/payables/ageing" element={<ApAgeing />} />
          <Route path="/accounts/payables/suppliers" element={<Suppliers />} />
          <Route path="/accounts/fixed-assets/register" element={<AssetRegister />} />
          <Route path="/accounts/fixed-assets/depreciation" element={<DepreciationRun />} />
          {/* sales activities, asset disposal and the BIR 2307 of suppliers */}
          <Route path="/accounts/fixed-assets/disposals" element={<AssetDisposals />} />
          <Route path="/accounts/payables/2307" element={<Bir2307 payeeType="Supplier" />} />
          <Route path="/sales/activities" element={<SalesActivities />} />
          <Route path="/master/organization/sales-activity-types" element={<SalesActivityTypes />} />
          <Route path="/master/organization/sales-activity-outcomes" element={<SalesActivityOutcomes />} />
          <Route path="/master/insurance/short-period-rates" element={<ShortPeriodRates />} />
          <Route path="/master/insurance/cancellation-reasons" element={<CancellationReasons />} />
          <Route path="/master/insurance/claim-document-checklist" element={<ClaimDocumentChecklist />} />
          <Route path="/master/insurance/repair-shops" element={<RepairShops />} />
          <Route path="/master/insurance/lead-sources" element={<LeadSources />} />
          <Route path="/master/insurance/reason-codes" element={<ReasonCodes />} />
          <Route path="/master/finance/asset-classes" element={<AssetClasses />} />
          <Route path="/master/finance/cost-centres" element={<CostCentres />} />

          {/* OperationalReports */}
          <Route
            path="/reports/operationalreports/production"
            element={<Production />}
          />

          <Route
            path="/reports/operationalreports/claims"
            element={<Claims />}
          />

          <Route
            path="/reports/operationalreports/renewal"
            element={<Renewal />}
          />
          <Route
            path="/reports/operationalreports/remittance"
            element={<Remittance />}
          />
          <Route
            path="/reports/operationalreports/brokercommision"
            element={<BrokerCommision />}
          />

          {/* Finacial master */}

          <Route
            path="/reports/financialreports/soapremiumreceivable"
            element={<SoaPremiumReceivable />}
          />
          <Route
            path="/reports/financialreports/collectionreport"
            element={<Collectionreport />}
          />
          <Route
            path="/reports/financialreports/payables"
            element={<Payables />}
          />
          <Route
            path="/reports/financialreports/journal"
            element={<Journal />}
          />
          <Route
            path="/reports/financialreports/trailbalance"
            element={<TrailBalance />}
          />
          <Route
            path="/reports/financialreports/coinsuranceregister"
            element={<CoInsuranceRegister />}
          />
          <Route
            path="/reports/financialreports/duetoinsurers"
            element={<DueToInsurers />}
          />
          <Route path="/operations/my-work" element={<ToMyWork />} />
          {/* Operations > Open Items became My Work: the old addresses lead there */}
          <Route path="/agent/openitemslistdata" element={<ToMyWork />} />

          <Route path="/agent/openitems/renewalrequest" element={<ToMyWork />} />
          {/* //Reports */}

          {/* // Payments */}
          <Route path="/agent/payments" element={<Payments />} />
          <Route
            path="/agent/payments/detail/:id"
            element={<PaymentDetails />}
          />
          {/* the former Open Items and Upcoming Events pages: My Work */}
          <Route path="/agent/openitems" element={<ToMyWork />} />
          <Route path="/agent/openitems/upcomingevents" element={<ToMyWork />} />
          <Route path="/agent/openitems/expiringpolicy" element={<ToMyWork />} />
          {/* Renewal */}
          <Route
            path="/agent/renewal/waiting/:id"
            element={<PolicyRenewalWaiting />}
          />

          <Route
            path="/agent/createlead/employee-benefit"
            element={<EmployeeLeadCreation flow="create" action="post" />}
          />
          <Route
            path="/agent/createlead/fire-allied-perils"
            element={<FireLeadCreation />}
          />
          <Route
            path="/agent/createlead/iar"
            element={<IarLeadCreation />}
          />
          <Route
            path="/agent/employee-benefit/create-quote"
            element={<CQPolicyAndRiskDetails />}
          />
          <Route
            path="/agent/employee-benefit/create-quote-employeebulkupload"
            element={<CQEmployeeBulkUpload />}
          />
          <Route
            path="/agent/employee-benefit/create-quote-Coverage-details"
            element={<CQcoverageDetails />}
          />
          <Route
            path="/agent/employee-benefit/create-quote-order-summary"
            element={<CQOrderSummary />}
          />
          <Route
            path="/agent/employee-benefit/create-quote-quote-details"
            element={<CQquoteDetails />}
          />
          <Route
            path="/agent/employee-benefit/policy-waiting-for-policy"
            element={<PCwaitingForPolicy />}
          />
          <Route
            path="/agent/employee-benefit/policy-upload-policy"
            element={<PCuploadPolicy />}
          />
          <Route
            path="/agent/employee-benefit/client-policy-details"
            element={<PCpolicyDetails />}
          />

          {/* Collections Module */}
          <Route path="/agent/collections" element={<CollectionsList />} />
          <Route path="/agent/collections/:id" element={<CollectionDetail />} />
          <Route
            path="/agent/collections/aging-report"
            element={<AgingReport />}
          />

          {/* Distribution, motor programmes and products */}
          <Route path="/sales/lead-assignment" element={<LeadAssignment />} />
          <Route path="/sales/dealer-programmes" element={<DealerProgrammes />} />
          <Route path="/sales/comparison-reports" element={<ComparisonReports />} />
          <Route path="/sales/campaigns" element={<Campaigns />} />
          <Route path="/master/insurance/channels" element={<DistributionChannels />} />
          <Route path="/operations/fleet-schedules" element={<FleetSchedules />} />
          <Route path="/operations/fleet-schedules/:id" element={<FleetSchedules />} />
          <Route path="/operations/open-covers" element={<OpenCovers />} />
          <Route path="/operations/open-covers/:id" element={<OpenCovers />} />
          <Route path="/reports/builder" element={<ReportBuilder />} />

          {/* Any other address inside the application */}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </div>
  );
};

export default Maincomponent;
