import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "../../../utility/currencyConverter";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
import { Dropdown } from "primereact/dropdown";
import { Tag } from "primereact/tag";
import { Button } from "primereact/button";
import accountingService from "../../../services/accountingService";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
import "./index.scss";
import logger from "../../../utility/logger";

// Cell components for DataTable
const DebitCreditCell = ({ debitCredit }) => {
  const getDebitCreditDisplay = (debitCredit) => {
    return debitCredit === "DEBIT" ? "Dr" : "Cr";
  };

  const getDebitCreditClass = (debitCredit) => {
    return debitCredit === "DEBIT" ? "debit-text" : "credit-text";
  };

  return (
    <span className={getDebitCreditClass(debitCredit)}>
      {getDebitCreditDisplay(debitCredit)}
    </span>
  );
};

const AmountCell = ({ amount, debitCredit }) => {
  const getDebitCreditClass = (debitCredit) => {
    return debitCredit === "DEBIT" ? "debit-text" : "credit-text";
  };

  return (
    <span className={getDebitCreditClass(debitCredit)}>
      {formatCurrency(amount)}
    </span>
  );
};

// Dates in the configured display format (System Settings, general.date_format), not ISO
const DateCell = ({ dateString }) => formatAppDate(dateString, { empty: "" });

const EntryTypeBadge = ({ entryType, entrySubType, t }) => {
  const getEntryTypeConfig = (type, subType) => {
    if (subType === "CO_INSURANCE") {
      return {
        label: t("accounting.coInsurance"),
        severity: "warning",
        icon: "pi pi-users",
      };
    }
    const configs = {
      NEW_BUSINESS: {
        label: t("accounting.normalBooking"),
        severity: "success",
        icon: "pi pi-book",
      },
      ENDORSEMENT: {
        label: t("accounting.endorsement"),
        severity: "info",
        icon: "pi pi-pencil",
      },
      ENDORSEMENT_POSITIVE: {
        label: t("accounting.endorsementPositive"),
        severity: "info",
        icon: "pi pi-plus-circle",
      },
      ENDORSEMENT_NEGATIVE: {
        label: t("accounting.endorsementNegative"),
        severity: "warning",
        icon: "pi pi-minus-circle",
      },
      CANCELLATION: {
        label: t("accounting.cancellation"),
        severity: "danger",
        icon: "pi pi-times-circle",
      },
      RENEWAL: { label: t("accounting.renewal"), severity: "success", icon: "pi pi-refresh" },
      DIRECT_BILLED: {
        label: t("accounting.directBilled"),
        severity: "secondary",
        icon: "pi pi-credit-card",
      },
      COMMISSION_INCREASE: {
        label: t("accounting.commissionIncrease"),
        severity: "success",
        icon: "pi pi-arrow-up",
      },
      COMMISSION_DECREASE: {
        label: t("accounting.commissionDecrease"),
        severity: "warning",
        icon: "pi pi-arrow-down",
      },
      REMITTANCE: { label: t("accounting.remittance"), severity: "info", icon: "pi pi-send" },
      PAYMENT_RECEIPT: {
        label: t("accounting.paymentReceipt"),
        severity: "success",
        icon: "pi pi-money-bill",
      },
      REFUND: { label: t("accounting.refund"), severity: "warning", icon: "pi pi-replay" },
      REFUND_FROM_INSURER: {
        label: t("accounting.refundFromInsurer"),
        severity: "info",
        icon: "pi pi-replay",
      },
    };
    return (
      configs[type] || {
        // a code without its own label reads as words: "COMMISSION_ADJUSTMENT" -> "Commission adjustment"
        label: type ? type.charAt(0) + type.slice(1).toLowerCase().replace(/_/g, " ") : "-",
        severity: "secondary",
        icon: "pi pi-circle",
      }
    );
  };

  const config = getEntryTypeConfig(entryType, entrySubType);
  return (
    <Tag value={config.label} severity={config.severity} icon={config.icon} />
  );
};

const PremiumAccountingEntries = () => {
  const { t } = useTranslation();
  const { policyId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useRef(null);

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [isCoInsurance, setIsCoInsurance] = useState(false);
  const [policyInfo, setPolicyInfo] = useState({});
  const [selectedEntryType, setSelectedEntryType] = useState(null);
  const entryTypeOptions = [
    { label: t("accounting.allTypes"), value: null },
    { label: t("accounting.normalBooking"), value: "NEW_BUSINESS" },
    { label: t("accounting.endorsement"), value: "ENDORSEMENT" },
    { label: t("accounting.coInsurance"), value: "CO_INSURANCE" },
    { label: t("accounting.endorsementPositiveLabel"), value: "ENDORSEMENT_POSITIVE" },
    { label: t("accounting.endorsementNegativeLabel"), value: "ENDORSEMENT_NEGATIVE" },
    { label: t("accounting.cancellation"), value: "CANCELLATION" },
    { label: t("accounting.renewal"), value: "RENEWAL" },
    { label: t("accounting.directBilled"), value: "DIRECT_BILLED" },
    { label: t("accounting.paymentReceipt"), value: "PAYMENT_RECEIPT" },
    { label: t("accounting.remittance"), value: "REMITTANCE" },
    { label: t("accounting.refund"), value: "REFUND" },
  ];

  useEffect(() => {
    if (policyId) {
      fetchPolicyEntries();
    } else {
      // Try to get policyId from location state
      const statePolicyId = location.state?.policyId;
      if (statePolicyId) {
        navigate(`/agent/premium-accounting-entries/${statePolicyId}`, {
          replace: true,
        });
      } else {
        toast.current?.show({
          severity: "error",
          summary: t("accounting.error"),
          detail: t("accounting.policyIdRequired"),
          life: 3000,
        });
        navigate(-1);
      }
    }
  }, [policyId, location.state, navigate]);

  useEffect(() => {
    if (policyId) {
      fetchPolicyEntries();
    }
  }, [selectedEntryType]);

  const fetchPolicyEntries = async () => {
    try {
      setLoading(true);
      const apiEntryType =
        selectedEntryType === "CO_INSURANCE" ? null : selectedEntryType;
      const filters = {
        entryType: apiEntryType,
        page: 1,
        pageSize: 1000, // Get all entries for now
      };
      const response = await accountingService.getPolicyAccountingEntries(
        policyId,
        filters
      );

      if (response.success) {
        setEntries(response.data || []);
        setIsCoInsurance(Boolean(response.isCoInsurance));

        // Extract policy info from first transaction if available
        if (response.data && response.data.length > 0) {
          const firstEntry = response.data[0];
          setPolicyInfo({
            policyNumber:
              firstEntry.motherPolicyNumber ||
              location.state?.policyNumber ||
              t("accounting.unknownPolicy"),
            policyId: policyId,
          });
        } else {
          // Use location state if no entries
          setPolicyInfo({
            policyNumber: location.state?.policyNumber || t("accounting.unknownPolicy"),
            policyId: policyId,
          });
        }
      } else {
        throw new Error(response.error || "Failed to fetch policy entries");
      }
    } catch (error) {
      logger.error("Error fetching policy entries:", error);
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: error.message || t("accounting.failedToFetchEntries"),
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const displayedEntries = useMemo(() => {
    if (selectedEntryType === "CO_INSURANCE") {
      return entries.filter((row) => row.entrySubType === "CO_INSURANCE");
    }
    return entries;
  }, [entries, selectedEntryType]);


  // back to the screen the user came from (policy detail, accounting query, all clients view), else the policy
  const goBack = () => {
    if (location.key !== "default") navigate(-1);
    else navigate(`/agent/policydetail/${policyId}`);
  };
  const breadcrumbItems = [
    { label: t("policyAccounting.policy"), command: () => navigate("/agent/policy") },
    ...(policyInfo.policyNumber ? [{ label: policyInfo.policyNumber, command: () => navigate(`/agent/policydetail/${policyId}`) }] : []),
    { label: t("accounting.premiumAccountingEntries") },
  ];

  if (loading) {
    return (
      <div className="premium-accounting-entries">
        <div className="loading-container">
          <ProgressSpinner />
          <p>{t("accounting.loadingPolicyEntries")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="premium-accounting-entries">
      <Toast ref={toast} />

      {/* Header */}
      <div className="page-header">
        <div className="breadcrumb">
          {breadcrumbItems.map((item, index) => (
            <span key={item.label}>
              {index > 0 && <span className="breadcrumb-separator"> / </span>}
              {item.command ? (
                <button className="breadcrumb-link" onClick={item.command}>
                  {item.label}
                </button>
              ) : (
                <span className="breadcrumb-current">{item.label}</span>
              )}
            </span>
          ))}
        </div>

        <div className="policy-info">
          <Button type="button" icon="pi pi-arrow-left" label={t("accounting.back")} text onClick={goBack} className="p-0 mr-2" />
          <h2>{t("accounting.policyNumberLabel")} {policyInfo.policyNumber}</h2>
          {isCoInsurance ? (
            <Tag
              value={t("accounting.coInsurancePolicy")}
              severity="warning"
              icon="pi pi-users"
              className="co-insurance-policy-tag"
            />
          ) : null}
        </div>
      </div>

      {/* Transactions Table */}
      <Card className="transactions-card">
        <div className="card-header">
          <div className="header-row">
            <h3>{t("accounting.policyAccountingEntries")}</h3>
            <div className="filter-controls">
              <Dropdown
                value={selectedEntryType}
                options={entryTypeOptions}
                onChange={(e) => setSelectedEntryType(e.value)}
                placeholder={t("accounting.filterByEntryType")}
                className="entry-type-filter"
              />
            </div>
          </div>
        </div>

        <DataTable
          value={displayedEntries}
          paginator
          rows={10}
          rowsPerPageOptions={[5, 10, 25, 50]}
          paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
          currentPageReportTemplate={t("accounting.pageReportTemplate")}
          emptyMessage={t("accounting.noEntriesFound")}
          className="transactions-table"
          scrollable
          tableStyle={{ minWidth: "64rem" }}
        >
          <Column
            field="transactionCode"
            header={t("accounting.code")}
            sortable
            style={{ minWidth: "120px" }}
          />
          <Column
            field="entryType"
            header={t("accounting.entryType")}
            sortable
            body={(rowData) => (
              <EntryTypeBadge
                entryType={rowData.entryType}
                entrySubType={rowData.entrySubType}
                t={t}
              />
            )}
            style={{ minWidth: "150px" }}
          />
          <Column
            field="description"
            header={t("accounting.description")}
            sortable
            body={(rowData) => rowData.description || "-"}
            style={{ minWidth: "220px" }}
          />
          <Column
            field="documentDate"
            header={t("accounting.documentDate")}
            sortable
            body={(rowData) => <DateCell dateString={rowData.documentDate} />}
            style={{ minWidth: "120px" }}
          />
          <Column
            field="dueDate"
            header={t("accounting.dueDate")}
            sortable
            body={(rowData) => <DateCell dateString={rowData.dueDate} />}
            style={{ minWidth: "120px" }}
          />
          <Column
            field="account.accountName"
            header={t("accounting.mainAccount")}
            sortable
            body={(rowData) =>
              rowData.account?.accountName || rowData.mainAccount
            }
            style={{ minWidth: "200px" }}
          />
          <Column
            field="debitCredit"
            header={t("accounting.drCr")}
            sortable
            body={(rowData) => (
              <DebitCreditCell debitCredit={rowData.debitCredit} />
            )}
            style={{ minWidth: "80px", textAlign: "center" }}
          />
          <Column
            field="amount"
            header={t("accounting.amount")}
            sortable
            body={(rowData) => (
              <AmountCell
                amount={rowData.amount}
                debitCredit={rowData.debitCredit}
              />
            )}
            style={{ minWidth: "120px", textAlign: "right" }}
          />
        </DataTable>
      </Card>
    </div>
  );
};

export default PremiumAccountingEntries;
