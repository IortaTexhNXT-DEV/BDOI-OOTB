import { Route, Routes } from "react-router-dom";

import ProtectedLayout from "./ProtectedRoute";
import CorrectionJV from "../module/CorrectionJV";
import PolicyReceipts from "../module/Receipts/PolicyReceipts";
import PolicyReceiptsView from "../module/Receipts/PolicyReceiptsView";
import AddPolicyReceipts1 from "../module/Receipts/AddPolicyReceipts1";
// import AddPolicyReceipts1 from "../src/module/Receipts/AddReceipts/AddPolicyReceipts1";
import AddPolicyEdit from "../module/Receipts/AddPolicyReceiptEdit";
import Receipts from "../module/Receipts";
import Reversalsjv from "../module/Reversals/index";
import Journalvoucher from "../module/JournalVoucher/index";
import OpenEntryMatching from "../module/accounts/openEntryMatching/OpenEntryMatching";
import OpenEntryUnmatching from "../module/accounts/openEntryUnmatching/OpenEntryUnmatching";
import SpecificVoucher from "../module/PaymentVoucher/SpecificVoucher";
import Payallvoucher from "../module/PaymentVoucher/PayAll";
import Paymentvoucher from "../module/PaymentVoucher/index";
import CreateVoucher from "../module/PaymentVoucher/CreateVoucher/index";
import Detailview from "../module/PaymentVoucher/DetailView/index";
import BulkDisburse from "../module/PaymentVoucher/BulkDisburse";
import AddPolicyReceipts from "../module/Receipts/AddPolicyReceipts";
// import AccountCategoryMaster from "../module/FinanceMastersModule/AccountCategoryMaster";
import BankAccountMaster from "../module/FinanceMastersModule/BankAccountMaster";
import BankChequeMaster from "../module/FinanceMastersModule/BankChequeMaster";
import BranchMasterInitial from "../module/FinanceMastersModule/BranchMaster/BranchMasterInitial";
// import BranchMaster from "../module/FinanceMastersModule/BranchMaster/BranchAdding";
import BranchAdding from "../module/FinanceMastersModule/BranchMaster/BranchAdding";
import BranchDetailsView from "../module/FinanceMastersModule/BranchMaster/BranchDetailsView";
import CompanyMaster from "../module/FinanceMastersModule/CompanyMaster";
import CurrencyMaster from "../module/FinanceMastersModule/CurrencyMaster";
import ExchangeRateMaster from "../module/FinanceMastersModule/ExchangeRateMaster";
import MainAccountMaster from "../module/FinanceMastersModule/MainAccountMaster";
import PettyCashMaster from "../module/FinanceMastersModule/PettyCashMaster";
import PaymentDetails from "../module/Receipts/PaymentDetails";
import SubAccountMaster from "../module/FinanceMastersModule/SubAccountMaster";
import TaxationMaster from "../module/FinanceMastersModule/TaxationMaster";
import TransactionCodeMaster from "../module/FinanceMastersModule/TransactionCodeMaster";
import DepartmentMasterInitial from "../module/FinanceMastersModule/DepartmentMaster/DepartmentMasterInitial";
import DepartmentAdding from "../module/FinanceMastersModule/DepartmentMaster/DepartmentAdding";
import DepartmentDetailsView from "../module/FinanceMastersModule/DepartmentMaster/DepartmentDetailsView";
import AccountCategoryMaster from "../module/FinanceMastersModule/AccountCategoryMaster";
// import SubAdd from "../module/FinanceMastersModule/SubAccountMaster/SubAdd";
// import SaveAndEdit from "../module/FinanceMastersModule/SubAccountMaster/SaveAndEdit";
import CategoryMasterInitial from "../module/FinanceMastersModule/AccountCategoryMaster/CategoryMasterInitial";
import CategoryAdding from "../module/FinanceMastersModule/AccountCategoryMaster/CategoryAdding";
import CategoryDetailsView from "../module/FinanceMastersModule/AccountCategoryMaster/CategoryDetailsView";
import SubAccountDetails from "../module/FinanceMastersModule/SubAccountMaster/SubAccountDetails";
import SaveAndEdit from "../module/FinanceMastersModule/SubAccountMaster/SubAccountEdit";
import AddCurrency from "../module/FinanceMastersModule/CurrencyMaster/AddCurrency";
import SaveAndEditCurrency from "../module/FinanceMastersModule/CurrencyMaster/ViewCurrency";
import AddTaxation from "../module/FinanceMastersModule/TaxationMaster/AddTaxation";
import TaxationDetails from "../module/FinanceMastersModule/TaxationMaster/TaxationDetails";
import TaxationEdit from "../module/FinanceMastersModule/TaxationMaster/TaxationEdit";
import AddExchange from "../module/FinanceMastersModule/ExchangeRateMaster/AddExchange";
import SaveAndEditExchange from "../module/FinanceMastersModule/ExchangeRateMaster/SaveAndEditExchange";

// import AddCompany from "../module/FinanceMastersModule/CompanyMaster/AddCompany";

import AddBankAccount from "../module/FinanceMastersModule/BankAccountMaster/AddBankAccount";
import BankAccountdetails from "../module/FinanceMastersModule/BankAccountMaster/BankAccountdetails";
import AddBankCheque from "../module/FinanceMastersModule/BankChequeMaster/AddBankCheque";
import BankChequeDetails from "../module/FinanceMastersModule/BankChequeMaster/BankChequeDetails";
import AddPettyCash from "../module/FinanceMastersModule/PettyCashMaster/AddPettyCash";
import PettyCashdetails from "../module/FinanceMastersModule/PettyCashMaster/PettyCashdetails";
import AddJournalVoucture from "../module/JournalVoucher/AddJournalVoucture";
import DetailsJournalVocture from "../module/JournalVoucher/DetailsJournalVocture";

import Bankdetailselection from "../module/PaymentVoucher/Bankdetailselection";
import Initiate from "../module/PettyCashManagement/Initiate";
import Disbursement from "../module/PettyCashManagement/Disbursement";
import SubAccountEdit from "../module/FinanceMastersModule/SubAccountMaster/SubAccountEdit";
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
import EditCurrency from "../module/FinanceMastersModule/CurrencyMaster/EditCurrency";
import AddMainAccount from "../module/FinanceMastersModule/MainAccountMaster/AddMainAccount";
import EditMainAccount from "../module/FinanceMastersModule/MainAccountMaster/EditMainAccount";
import ViewMainAccount from "../module/FinanceMastersModule/MainAccountMaster/ViewMainAccount";
import Commission from "../module/GeneralMasters/Commission";
import AddCommission from "../module/GeneralMasters/Commission/AddCommission";
import EditCommission from "../module/GeneralMasters/Commission/EditCommission";
import ViewCommission from "../module/GeneralMasters/Commission/ViewCommission";
import EditPettyCash from "../module/FinanceMastersModule/PettyCashMaster/EditPettyCash";
import TransactioncodeEdit from "../module/FinanceMastersModule/TransactionCodeMaster/TransactionCodeMasterEdit/index";
import ViewExchange from "../module/FinanceMastersModule/ExchangeRateMaster/ViewExchange";
import BankMaster from "../module/FinanceMastersModule/BankMaster";
import AddBankMaster from "../module/FinanceMastersModule/BankMaster/AddBankMaster";
import Accountdataview from "../module/FinanceMastersModule/BankMaster/AccountDataView/index";
import AddAccountDetail from "../module/FinanceMastersModule/BankMaster/AccountDataView/AddAccountDetail/index";
import ViewAccountDetail from "../module/FinanceMastersModule/BankMaster/AccountDataView/ViewAccountData";
import EditAccountDetail from "../module/FinanceMastersModule/BankMaster/AccountDataView/EditAccountData";
import SystemSettingsPage from "../module/SystemSettings";
import ConfigurationPage from "../module/Administration/Configuration";
import SchedulesPage from "../module/Administration/Schedules";
import AuditTrailPage from "../module/Administration/AuditTrail";
import CompanyMasters from "../module/GeneralMasters/OrganizationMasters/ComapanyMaster";
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
import Employee from "../module/GeneralMasters/EmployeeManagementMasters/Employee/EmployeeMaster";
import AddEmployee from "../module/GeneralMasters/EmployeeManagementMasters/Employee/AddEmployee";
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

import AddCompany from "../module/GeneralMasters/OrganizationMasters/ComapanyMaster/AddCompany";
import AddBranch from "../module/GeneralMasters/OrganizationMasters/BranchMaster/AddBranch";
import AddCountry from "../module/GeneralMasters/LocationMasters/CountryMaster/AddCountry/index";
import AddCity from "../module/GeneralMasters/LocationMasters/CityMaster/AddCity";
import AddState from "../module/GeneralMasters/LocationMasters/StateMaster/AddState";
import Dashboard from "../agentModule/dashBoardModule/home";
import AgentViewProfile from "../agentModule/dashBoardModule/agentViewProfile";
import AgentEditProfile from "../agentModule/dashBoardModule/agentEditProfile";
import Notification from "../agentModule/dashBoardModule/notification";
import LeadCreation from "../agentModule/leadModule/leadCreation";
import LeadListing from "../agentModule/leadModule/leadListing";
import CoverageDeatails from "../agentModule/quoteModule/coverageDetails";
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
import CoverageDetailedVew from "../agentModule/quoteModule/coverageDetailedVew";
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
import OpenItems from "../agentModule/openItems/openItems";
import UpcomingEvents from "../agentModule/openItems/upcomingEvents";
import ExpiringPolicy from "../agentModule/openItems/expiringPolicy";
import RenewalRequest from "../agentModule/openItems/renewalRequest";
import QuotePending from "../agentModule/openItems/quotePending";
import AgenSideBar from "../components/AgentSideBar";
import EditCommissionPopup from "../module/GeneralMasters/Commission/EditCommission/EditCommissionPopup";
import ClaimRejected from "../agentModule/claimsModule/claimRejected";
import ClaimDocumentUpload from "../agentModule/claimsModule/claimDocumentUpload";
import LeadEdit from "../agentModule/leadModule/leadEdit";
import LeadDetail from "../agentModule/leadModule/leadDetail";
import ViewEndorsement from "../agentModule/endorsementModule/viewUploadEndorsement";
import EndorsementRejected from "../agentModule/endorsementModule/EndorsementRejected";
import LoginScreen from "../module/AuthModule/Login/index";
import Production from "../module/Reports/OperationalReports/Production";
// Dashboard Imports
import ExecutiveDashboard from "../module/ExecutiveDashboard";
import ClaimsDashboard from "../module/ClaimsModule/ClaimsDashboard";
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
// import OperationalReports from "../module/Reports/OperationalReports";

// Collections Module
import CollectionsList from "../agentModule/collectionsModule/CollectionsList";
import CollectionDetail from "../agentModule/collectionsModule/CollectionDetail";
import AgingReport from "../agentModule/collectionsModule/AgingReport";

// Remittance Masters
import RemittanceMaster from "../module/FinanceMastersModule/RemittanceMaster";
import AutomatedRemittanceMaster from "../module/FinanceMastersModule/RemittanceMaster/AutomatedRemittance";
import StatementTemplateMaster from "../module/FinanceMastersModule/RemittanceMaster/StatementTemplate";
import SettlementParameterMaster from "../module/FinanceMastersModule/RemittanceMaster/SettlementParameter";
import ReconciliationMaster from "../module/FinanceMastersModule/RemittanceMaster/ReconciliationMaster";
import BulkProcessingMaster from "../module/FinanceMastersModule/RemittanceMaster/BulkProcessingMaster";
import ScheduleMaster from "../module/FinanceMastersModule/RemittanceMaster/ScheduleMaster";
import ElectronicTransferMaster from "../module/FinanceMastersModule/RemittanceMaster/ElectronicTransferMaster";
import ApprovalWorkflowMaster from "../module/FinanceMastersModule/RemittanceMaster/ApprovalWorkflowMaster";
import ExceptionMaster from "../module/FinanceMastersModule/RemittanceMaster/ExceptionMaster";
import ReportTemplateMaster from "../module/FinanceMastersModule/RemittanceMaster/ReportTemplateMaster";
import AgencyBillMaster from "../module/FinanceMastersModule/RemittanceMaster/AgencyBillMaster";
import PremiumAccountSetup from "../module/FinanceMastersModule/PremiumAccountSetup";
import MiscellaneousAccountSetup from "../module/FinanceMastersModule/MiscellaneousAccountSetup";
import CustomerAccountSetup from "../module/FinanceMastersModule/CustomerAccountSetup";
import RIClaimsAccountSetup from "../module/FinanceMastersModule/RIClaimsAccountSetup";
// K13-K17 Remittance Masters
import DirectBillMaster from "../module/FinanceMastersModule/RemittanceMaster/DirectBillMaster";
import AdjustmentMaster from "../module/FinanceMastersModule/RemittanceMaster/AdjustmentMaster";
import NotificationMaster from "../module/FinanceMastersModule/RemittanceMaster/NotificationMaster";
import HistoryConfiguration from "../module/FinanceMastersModule/RemittanceMaster/HistoryConfiguration";
import AnalyticsConfiguration from "../module/FinanceMastersModule/RemittanceMaster/AnalyticsConfiguration";

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

// Remittance Transactions
import AutomatedRemittanceProcessing from "../module/Remittance/AutomatedProcessing";
import RemittanceTracking from "../module/Remittance/Tracking";
import StatementGeneration from "../module/Remittance/Statements";
import SettlementProcessing from "../module/Remittance/Settlement";
import ReconciliationProcess from "../module/Remittance/Reconciliation";
import BulkProcessing from "../module/Remittance/BulkProcessing";
import SchedulingDashboard from "../module/Remittance/Scheduling";
import ElectronicTransfer from "../module/Remittance/ElectronicTransfer";
import RemittanceApproval from "../module/Remittance/RemittanceApproval";
import RemittanceExceptions from "../module/Remittance/RemittanceExceptions";
import RemittanceReports from "../module/Remittance/RemittanceReports";
import AgencyBillProcessing from "../module/Remittance/AgencyBillProcessing";
// K13-K17 Remittance Transactions
import DirectBillProcessing from "../module/Remittance/DirectBillProcessing";
import RemittanceAdjustments from "../module/Remittance/RemittanceAdjustments";
import RemittanceNotifications from "../module/Remittance/RemittanceNotifications";
import RemittanceHistory from "../module/Remittance/RemittanceHistory";
import RemittanceAnalytics from "../module/Remittance/RemittanceAnalytics";
import PolicyRenewalWaiting from "../agentModule/renewalModule/WaitingScreen/PolicyRenewalWaiting";

// Commission Module Imports
import CommissionDashboard from "../module/Commission/CommissionDashboard";
import ReferrerAccounts from "../module/Commission/ReferrerAccounts";
import ReferrerAccountDetail from "../module/Commission/ReferrerAccountDetail";

// Reinsurance Module Imports
import TreatyMaster from "../module/FinanceMastersModule/ReinsuranceMaster/TreatyMaster";
import TreatyDashboard from "../module/Reinsurance/TreatyDashboard";
import TreatyDetail from "../module/Reinsurance/TreatyDetail";
import CessionDashboard from "../module/Reinsurance/CessionDashboard";
import RecoveryDashboard from "../module/Reinsurance/RecoveryDashboard";
import ReinsuranceReports from "../module/Reinsurance/ReinsuranceReports";
import ReconciliationDashboard from "../module/Reinsurance/ReconciliationDashboard";
import ReinsuranceAnalytics from "../module/Reinsurance/ReinsuranceAnalytics";

// Product Configurator Module Imports
import ProductDashboard from "../module/ProductConfigurator/ProductDashboard";
import {
  ProductTemplateManager,
  CoverageBuilder,
  RatingEngine,
  UnderwritingRules,
  ApprovalWorkflows,
  MarketMapping,
  DocumentManager,
  ProductAnalytics,
} from "../module/ProductConfigurator/ProductConfiguratorScreens";
import {
  RiskMappingList,
  RiskMappingDetail,
} from "../module/ProductConfigurator/RiskMapping";

import OpenItemsListData from "../agentModule/openItems/OpenItemsListData";
import { Navigate } from "react-router-dom";
import { useEffect } from "react";
import Cookies from "js-cookie";
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
import ProductRecommendation from "../agentModule/quoteModule/productRecommandation";

const Maincomponent = () => {
  return (
    <div className="parent__main__container">
      {/* <AuthRoute /> */}
      <Routes>
        {/* <Route path="/login" element={<LoginScreen />} /> */}
        <Route element={<ProtectedLayout />}>
          <Route
            path="/accounts/correctionsjv/correctionsjvdetails"
            element={<CorrectionJV />}
          />

          {/* Receipts */}

          {/* <Route path="/accounts/receipts" element={<Receipts />} /> */}

          <Route
            path="/accounts/receipts/addpolicyreceipts"
            element={<AddPolicyReceipts />}
          />

          <Route
            path="/accounts/receipts/policyreceiptsview"
            element={<PolicyReceiptsView />}
          />

          {/* <Route path="/accounts/receipts/addreceipt" element={<AddPolicyReceipts1 />} /> */}

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

          {/* <Route path="/payallvoucher" element={<Payallvoucher />} /> */}
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
          {/* <Route
              path="/accounts/pettycash/addrequest/view/:id"
              element={<RequestForm action="view" />}
            /> */}
          {/* <Route
              path="/accounts/pettycash/addrequest/edit/:id"
              element={<RequestForm action="edit" />}
            /> */}
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
          {/* <Route
              path="/pettycashmanagement"
              element={<Pettycashmanagement />}
            /> */}
          {/* Finacel Master Route*/}
          {/* <Route
              path="master/finance/accountcate"
              element={<AccountCategoryMaster />}
            /> */}

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
            element={<InsuranceDetailsAction action="view" />}
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
            element={<LineBusinessDetailsAction action="view" />}
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
            element={<ProductMatserDetailsAction action="view" />}
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
            element={<PolicyTypeDetailsAction action="view" />}
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
            element={<CoverDetailsAction action="view" />}
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
            element={<SignatoriesDetailsAction action="view" />}
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
            element={<VehicleDetailsAction action="view" />}
          />

          {/* Location */}

          {/* {Country} */}
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
            element={<AddCountry action="view" />}
          />
          <Route
            path="master/generals/location/country/add"
            element={<AddCountry action="add" />}
          />

          {/* {State} */}
          <Route path="master/generals/location/state" element={<State />} />

          <Route
            path="master/generals/location/state/edit"
            element={<AddState action="edit" />}
          />
          <Route
            path="master/generals/location/state/view"
            element={<AddState action="view" />}
          />
          <Route
            path="master/generals/location/state/add"
            element={<AddState action="add" />}
          />

          {/* {City} */}
          <Route path="master/generals/location/city" element={<City />} />

          <Route
            path="master/generals/location/city/edit"
            element={<AddCity action="edit" />}
          />
          <Route
            path="master/generals/location/city/view"
            element={<AddCity action="view" />}
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
            element={<AddHierarchy action="view" />}
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
            element={<AddDesignation action="view" />}
          />

          <Route
            path="master/generals/employeemanagement/adddesignation"
            element={<AddDesignation />}
          />
          <Route
            path="master/generals/employeemanagement/employee"
            element={<Employee />}
          />
          <Route
            path="master/generals/employeemanagement/employee/add/:id"
            element={<AddEmployee action="add" />}
          />
          <Route
            path="master/generals/employeemanagement/employee/edit/:id"
            element={<AddEmployee action="edit" />}
          />
          <Route
            path="master/generals/employeemanagement/employee/view/:id"
            element={<AddEmployee action="view" />}
          />
          <Route
            path="master/generals/employeemanagement/addemployee"
            element={<AddEmployee />}
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
            element={<AddUser action="view" />}
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
            element={<AddRole action="view" />}
          />
          {/* <Route
              path="master/generals/usermanagement/addrole"
              element={<AddRole />}
            /> */}

          {/* Branch Master Module */}
          <Route
            path="master/finance/branch/branchadding"
            element={<BranchAdding />}
          />
          <Route
            path="master/finance/branch/branchdetailsview"
            element={<BranchDetailsView />}
          />
          <Route
            path="master/finance/branch"
            element={<BranchMasterInitial />}
          />

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

          <Route
            path="master/finance/bankaccount"
            element={<BankAccountMaster />}
          />
          <Route
            path="master/finance/bankcheque"
            element={<BankChequeMaster />}
          />

          {/* bankacountmaster */}
          <Route
            path="master/finance/bankaccount"
            element={<BankAccountMaster />}
          />
          <Route
            path="master/finance/bankaccount/addbankaccount"
            element={<AddBankAccount />}
          />
          <Route
            path="master/finance/bankaccount/bankaccountdetails"
            element={<BankAccountdetails />}
          />

          {/* bankchequemaster */}
          <Route
            path="master/finance/bankcheque"
            element={<BankChequeMaster />}
          />
          <Route
            path="master/finance/bankcheque/addbankcheque"
            element={<AddBankCheque />}
          />
          <Route
            path="master/finance/bankcheque/bankchequedetails"
            element={<BankChequeDetails />}
          />

          {/* pettycash */}
          <Route
            path="master/finance/pettycash"
            element={<PettyCashMaster />}
          />
          <Route
            path="master/finance/pettycash/addpettycash"
            element={<AddPettyCash />}
          />
          <Route
            path="master/finance/pettycash/pettycashdetail/:id"
            element={<PettyCashdetails />}
          />

          <Route
            path="master/finance/pettycash/editpettycash/:id"
            element={<EditPettyCash />}
          />

          <Route />
          <Route
            path="master/configuration/system-settings"
            element={<SystemSettingsPage />}
          />
          <Route path="master/configuration/settings" element={<ConfigurationPage />} />
          <Route path="master/configuration/schedules" element={<SchedulesPage />} />
          <Route path="master/configuration/audit-trail" element={<AuditTrailPage />} />
          <Route path="master/finance/company" element={<CompanyMaster />} />
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
            element={<MainAccountMaster />}
          />
          <Route
            path="master/finance/mainaccount/addmainaccount"
            element={<AddMainAccount />}
          />
          <Route
            path="master/finance/mainaccount/editmainaccount"
            element={<EditMainAccount />}
          />
          <Route
            path="master/finance/mainaccount/viewmainaccount"
            element={<ViewMainAccount />}
          />

          <Route
            path="master/finance/subaccount"
            element={<SubAccountMaster />}
          />
          <Route path="master/finance/taxation" element={<TaxationMaster />} />
          <Route
            path="master/finance/taxation/addtaxation"
            element={<AddTaxation />}
          />
          <Route
            path="master/finance/taxation/taxationedit"
            element={<TaxationEdit />}
          />
          <Route
            path="master/finance/taxation/taxationdetails"
            element={<TaxationDetails />}
          />

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
            element={<TransactionCodeDetails />}
          />

          <Route
            path="master/finance/transactioncode/transactioncodeedit"
            element={<TransactioncodeEdit />}
          />

          {/* Premium Account Setup Route */}
          <Route
            path="master/finance/premium-account-setup"
            element={<PremiumAccountSetup />}
          />

          {/* Miscellaneous Account Setup Route */}
          <Route
            path="master/finance/miscellaneous-account-setup"
            element={<MiscellaneousAccountSetup />}
          />

          {/* Customer Account Setup Route */}
          <Route
            path="master/finance/customer-account-setup"
            element={<CustomerAccountSetup />}
          />

          {/* RI-Claims Account Setup Route */}
          <Route
            path="master/finance/ri-claim-account-setup"
            element={<RIClaimsAccountSetup />}
          />

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
            path="master/finance/remittance/reconciliationmaster/:mode"
            element={<ReconciliationMaster />}
          />
          <Route
            path="master/finance/remittance/bulkprocessingmaster/:mode"
            element={<BulkProcessingMaster />}
          />
          <Route
            path="master/finance/remittance/schedulemaster/:mode"
            element={<ScheduleMaster />}
          />
          <Route
            path="master/finance/remittance/electronictransfermaster/:mode"
            element={<ElectronicTransferMaster />}
          />
          <Route
            path="master/finance/remittance/approvalworkflowmaster/:mode"
            element={<ApprovalWorkflowMaster />}
          />
          <Route
            path="master/finance/remittance/exceptionmaster/:mode"
            element={<ExceptionMaster />}
          />
          <Route
            path="master/finance/remittance/reporttemplatemaster/:mode"
            element={<ReportTemplateMaster />}
          />
          <Route
            path="master/finance/remittance/agencybillmaster/:mode"
            element={<AgencyBillMaster />}
          />
          <Route
            path="master/finance/remittance/directbillmaster/:mode"
            element={<DirectBillMaster />}
          />
          <Route
            path="master/finance/remittance/adjustmentmaster/:mode"
            element={<AdjustmentMaster />}
          />
          <Route
            path="master/finance/remittance/notificationmaster/:mode"
            element={<NotificationMaster />}
          />
          <Route
            path="master/finance/remittance/historyconfiguration/:mode"
            element={<HistoryConfiguration />}
          />
          <Route
            path="master/finance/remittance/analyticsconfiguration/:mode"
            element={<AnalyticsConfiguration />}
          />

          {/* Remittance Transaction Routes */}
          <Route
            path="finance/remittance/automated/execute"
            element={<AutomatedRemittanceProcessing />}
          />
          <Route
            path="finance/remittance/tracking/status"
            element={<RemittanceTracking />}
          />
          <Route
            path="finance/remittance/statements/generate"
            element={<StatementGeneration />}
          />
          <Route
            path="finance/remittance/settlement/process"
            element={<SettlementProcessing />}
          />
          <Route
            path="finance/remittance/reconciliation"
            element={<ReconciliationProcess />}
          />
          <Route
            path="finance/remittance/bulkprocessing"
            element={<BulkProcessing />}
          />
          <Route
            path="finance/remittance/scheduling"
            element={<SchedulingDashboard />}
          />
          <Route
            path="finance/remittance/electronictransfer"
            element={<ElectronicTransfer />}
          />
          <Route
            path="finance/remittance/approval"
            element={<RemittanceApproval />}
          />
          <Route
            path="finance/remittance/exceptions"
            element={<RemittanceExceptions />}
          />
          <Route
            path="finance/remittance/reports"
            element={<RemittanceReports />}
          />
          <Route
            path="finance/remittance/agencybill"
            element={<AgencyBillProcessing />}
          />
          <Route
            path="finance/remittance/directbill"
            element={<DirectBillProcessing />}
          />
          <Route
            path="finance/remittance/adjustments"
            element={<RemittanceAdjustments />}
          />
          <Route
            path="finance/remittance/notifications"
            element={<RemittanceNotifications />}
          />
          <Route
            path="finance/remittance/history"
            element={<RemittanceHistory />}
          />
          <Route
            path="finance/remittance/analytics"
            element={<RemittanceAnalytics />}
          />

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

          {/* Reinsurance Module Routes */}
          {/* Reinsurance Master */}
          <Route path="master/reinsurance/treaty" element={<TreatyMaster />} />

          {/* Reinsurance User Screens */}
          <Route path="reinsurance/treaties" element={<TreatyDashboard />} />
          <Route path="reinsurance/treaty/:id" element={<TreatyDetail />} />
          <Route path="reinsurance/cessions" element={<CessionDashboard />} />
          <Route path="reinsurance/claims" element={<RecoveryDashboard />} />
          <Route path="reinsurance/reports" element={<ReinsuranceReports />} />
          <Route
            path="reinsurance/reconciliation"
            element={<ReconciliationDashboard />}
          />
          <Route
            path="reinsurance/analytics"
            element={<ReinsuranceAnalytics />}
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
            path="product-configurator/workflows"
            element={<ApprovalWorkflows />}
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
            element={<SubAccountDetails />}
          />
          <Route
            path="master/finance/subaccount/subaccountedit"
            element={<SubAccountEdit />}
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
            element={<ViewCurrency />}
          />
          <Route path="master/generals/commission" element={<Commission />} />
          <Route
            path="master/generals/commission/addcommission"
            element={<AddCommission />}
          />
          <Route
            path="master/generals/commission/editcommission"
            element={<EditCommission />}
          />
          <Route
            path="master/generals/commission/editcommissionpopup"
            element={<EditCommissionPopup />}
          />
          <Route
            path="master/generals/commission/viewcommission/:id"
            element={<ViewCommission />}
          />

          {/* <Route path="/login" element={<Login />} />
            <Route path="/forgotpassword" element={<ForgotPassword />} /> */}
          {/* // Dashboard Routes */}
          <Route path="/" element={<ExecutiveDashboard />} />
          <Route path="/executive/dashboard" element={<ExecutiveDashboard />} />
          <Route path="/claims/dashboard" element={<ClaimsDashboard />} />
          <Route
            path="/underwriting/dashboard"
            element={<UnderwritingDashboard />}
          />

          {/* // Agent Dashboard, Notification & agent profile */}
          <Route path="/agent/home" element={<Dashboard />} />
          <Route path="/agent/notification" element={<Notification />} />
          <Route path="/agent/viewprofile" element={<AgentViewProfile />} />
          <Route path="/agent/editprofile" element={<AgentEditProfile />} />
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
          {/* <Route
            path="/agent/leadcreate"
            element={<LeadEdit flow="create" action="create"/>}
          /> */}
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
            element={
              <CoverageDeatails action="coveragedetail" flow="renewal" />
            }
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

          {/* <Route
            path="/agent/createquote/ordersummaryquote"
            element={<OrderSummaryQuote />}
          /> */}
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
          {/* // Open items */}
          <Route path="/agent/openitems" element={<OpenItems />} />
          <Route
            path="/agent/openitems/upcomingevents"
            element={<UpcomingEvents />}
          />
          <Route
            path="/agent/openitems/expiringpolicy"
            element={<ExpiringPolicy />}
          />
          <Route
            path="/agent/openitems/quotepending"
            element={<QuotePending />}
          />

          {/* //Reports */}

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
            path="/agent/openitemslistdata"
            element={<OpenItemsListData />}
          />

          <Route
            path="/agent/openitems/renewalrequest"
            element={<RenewalRequest />}
          />
          {/* //Reports */}
          {/* <Route
              path="/reports/operationalreports"
              element={<OperationalReports />}
            /> */}

          {/* // Payments */}
          <Route path="/agent/payments" element={<Payments />} />
          <Route
            path="/agent/payments/detail/:id"
            element={<PaymentDetails />}
          />
          {/* // Open items */}
          <Route path="/agent/openitems" element={<OpenItems />} />
          <Route
            path="/agent/openitems/upcomingevents"
            element={<UpcomingEvents />}
          />
          <Route
            path="/agent/openitems/expiringpolicy"
            element={<ExpiringPolicy />}
          />
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

          {/* //Reports */}
          {/* <Route
              path="/reports/operationalreports"
              element={<OperationalReports />}
            /> */}
        </Route>
      </Routes>
    </div>
  );
};

export default Maincomponent;
