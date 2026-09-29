import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatCurrency } from "../../../utility/currencyConverter";
import { useNavigate } from "react-router-dom";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Toast } from "primereact/toast";
import { ProgressSpinner } from "primereact/progressspinner";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Button } from "primereact/button";
import { Tag } from "primereact/tag";
import { Paginator } from "primereact/paginator";
import accountingService from "../../../services/accountingService";
import { calendarDateFormat, formatDate } from "../../../utility/dateFormat";
import "./index.scss";
import logger from "../../../utility/logger";

const EntryTypeBadge = ({ entryType, t }) => {
  const getEntryTypeConfig = (type) => {
    const configs = {
      NORMAL_BOOKING: {
        label: t("accounting.normalBooking"),
        severity: "success",
        icon: "pi pi-book",
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
      REMITTANCE: {
        label: t("accounting.remittance"),
        severity: "info",
        icon: "pi pi-send",
      },
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
        label: type || "N/A",
        severity: "secondary",
        icon: "pi pi-circle",
      }
    );
  };

  const config = getEntryTypeConfig(entryType);
  return (
    <Tag value={config.label} severity={config.severity} icon={config.icon} />
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
const DateCell = ({ dateString }) => formatDate(dateString, { empty: "" });

const AllClientsAccountingView = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);

  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [expandedClients, setExpandedClients] = useState(new Set());
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [totals, setTotals] = useState({
    totalClients: 0,
    totalTransactions: 0,
    grandTotalDebits: 0,
    grandTotalCredits: 0,
    grandTotalBalance: 0,
  });

  // Filter states
  const [clientSearch, setClientSearch] = useState("");
  const [entryType, setEntryType] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  const entryTypeOptions = [
    { label: t("accounting.allTypes"), value: null },
    { label: t("accounting.normalBooking"), value: "NORMAL_BOOKING" },
    { label: t("accounting.endorsementPositiveLabel"), value: "ENDORSEMENT_POSITIVE" },
    { label: t("accounting.endorsementNegativeLabel"), value: "ENDORSEMENT_NEGATIVE" },
    { label: t("accounting.cancellation"), value: "CANCELLATION" },
    { label: t("accounting.renewal"), value: "RENEWAL" },
    { label: t("accounting.directBilled"), value: "DIRECT_BILLED" },
    { label: t("accounting.commissionIncrease"), value: "COMMISSION_INCREASE" },
    { label: t("accounting.commissionDecrease"), value: "COMMISSION_DECREASE" },
    { label: t("accounting.remittance"), value: "REMITTANCE" },
    { label: t("accounting.paymentReceipt"), value: "PAYMENT_RECEIPT" },
    { label: t("accounting.refund"), value: "REFUND" },
    { label: t("accounting.refundFromInsurer"), value: "REFUND_FROM_INSURER" },
  ];

  useEffect(() => {
    fetchData();
  }, [pagination.page, entryType, startDate, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const filters = {
        entryType: entryType || undefined,
        startDate: startDate
          ? new Date(startDate).toISOString().split("T")[0]
          : undefined,
        endDate: endDate
          ? new Date(endDate).toISOString().split("T")[0]
          : undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      };

      // Remove undefined values
      Object.keys(filters).forEach(
        (key) => filters[key] === undefined && delete filters[key]
      );

      const response = await accountingService.getAllClientsAccounting(filters);

      if (response.success) {
        setClients(response.data || []);
        setPagination(response.pagination || pagination);
        setTotals(response.totals || totals);
      } else {
        throw new Error(
          response.error || "Failed to fetch all clients accounting data"
        );
      }
    } catch (error) {
      logger.error("Error fetching all clients accounting:", error);
      toast.current?.show({
        severity: "error",
        summary: t("accounting.error"),
        detail: error.message || "Failed to fetch accounting data",
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setClientSearch("");
    setEntryType(null);
    setStartDate(null);
    setEndDate(null);
    setExpandedClients(new Set());
    setPagination({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
  };

  const handlePolicyClick = (policyId) => {
    if (policyId) {
      navigate(`/agent/premium-accounting-entries/${policyId}`);
    }
  };

  const handleClientClick = (clientId) => {
    if (clientId) {
      navigate(`/agent/clientview/${clientId}`);
    }
  };

  const toggleClientExpansion = (clientId) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(clientId)) {
      newExpanded.delete(clientId);
    } else {
      newExpanded.add(clientId);
    }
    setExpandedClients(newExpanded);
  };

  const handleExport = () => {
    try {
      // Flatten all transactions
      const allTransactions = clients.flatMap((client) =>
        client.transactions.map((t) => ({
          clientNumber: client.clientNumber,
          clientName: client.clientName,
          ...t,
        }))
      );

      // Convert to CSV
      const headers = [
        "Client Number",
        "Client Name",
        "Date",
        "Transaction Code",
        "Description",
        "Account Code",
        "Account Name",
        "Entry Type",
        "Debit/Credit",
        "Amount",
        "Status",
        "Policy Number",
        "Mother Policy Number",
      ];

      const csvRows = [
        headers.join(","),
        ...allTransactions.map((t) =>
          [
            t.clientNumber || "",
            `"${(t.clientName || "").replace(/"/g, '""')}"`,
            t.documentDate ? new Date(t.documentDate).toISOString().split("T")[0] : "",
            t.transactionCode || "",
            `"${(t.description || "").replace(/"/g, '""')}"`,
            t.accountCode || "",
            `"${(t.accountName || "").replace(/"/g, '""')}"`,
            t.entryType || "",
            t.debitCredit || "",
            t.amount || 0,
            t.status || "",
            t.motherPolicyNumber || "",
            t.motherPolicyNumber || "",
          ].join(",")
        ),
      ];

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `all-clients-accounting-${new Date().toISOString().split("T")[0]}.csv`
      );
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.current?.show({
        severity: "success",
        summary: "Export Successful",
        detail: "Accounting data exported to CSV",
        life: 3000,
      });
    } catch (error) {
      logger.error("Error exporting data:", error);
      toast.current?.show({
        severity: "error",
        summary: "Export Failed",
        detail: error.message || "Failed to export data",
        life: 3000,
      });
    }
  };

  // Filter clients by search term
  const filteredClients = clients.filter((client) => {
    if (!clientSearch) return true;
    const searchLower = clientSearch.toLowerCase();
    return (
      client.clientName?.toLowerCase().includes(searchLower) ||
      client.clientNumber?.toLowerCase().includes(searchLower)
    );
  });

  const policyNumberBodyTemplate = (rowData) => {
    if (!rowData.motherPolicyNumber) return "-";
    return (
      <span
        className="policy-link"
        onClick={() => handlePolicyClick(rowData.motherPolicyId)}
      >
        {rowData.motherPolicyNumber}
      </span>
    );
  };

  return (
    <div className="all-clients-accounting-view">
      <Toast ref={toast} />

      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>{t("accounting.allClientsTitle")}</h1>
            <p className="subtitle">
              {t("accounting.allClientsSubtitle")}
            </p>
          </div>
          <Button
            label={t("accounting.exportCsv")}
            icon="pi pi-download"
            onClick={handleExport}
            className="export-button"
          />
        </div>
      </div>

      {/* Summary Cards */}
      {totals.totalClients > 0 && (
        <div className="summary-cards">
          <Card className="summary-card">
            <div className="summary-content">
              <div className="summary-label">{t("accounting.totalClients")}</div>
              <div className="summary-value">{totals.totalClients}</div>
            </div>
          </Card>
          <Card className="summary-card">
            <div className="summary-content">
              <div className="summary-label">{t("accounting.totalTransactions")}</div>
              <div className="summary-value">{totals.totalTransactions}</div>
            </div>
          </Card>
          <Card className="summary-card">
            <div className="summary-content">
              <div className="summary-label">{t("accounting.totalDebits")}</div>
              <div className="summary-value debit-text">
                {formatCurrency(totals.grandTotalDebits)}
              </div>
            </div>
          </Card>
          <Card className="summary-card">
            <div className="summary-content">
              <div className="summary-label">{t("accounting.totalCredits")}</div>
              <div className="summary-value credit-text">
                {formatCurrency(totals.grandTotalCredits)}
              </div>
            </div>
          </Card>
          <Card className="summary-card">
            <div className="summary-content">
              <div className="summary-label">{t("accounting.netBalance")}</div>
              <div
                className={`summary-value ${
                  totals.grandTotalBalance >= 0 ? "debit-text" : "credit-text"
                }`}
              >
                {formatCurrency(totals.grandTotalBalance)}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="filters-card">
        <div className="filters-form">
          <div className="form-row">
            <div className="form-group">
              <label>{t("accounting.searchClient")}</label>
              <InputText
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={t("accounting.searchClientPlaceholder")}
                className="w-full"
              />
            </div>
            <div className="form-group">
              <label>{t("accounting.entryType")}</label>
              <Dropdown
                value={entryType}
                options={entryTypeOptions}
                onChange={(e) => {
                  setEntryType(e.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                placeholder={t("accounting.allTypes")}
                className="w-full"
              />
            </div>
            <div className="form-group">
              <label>{t("accounting.startDate")}</label>
              <Calendar
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                dateFormat={calendarDateFormat()}
                showIcon
                className="w-full"
              />
            </div>
            <div className="form-group">
              <label>{t("accounting.endDate")}</label>
              <Calendar
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.value);
                  setPagination({ ...pagination, page: 1 });
                }}
                dateFormat={calendarDateFormat()}
                showIcon
                className="w-full"
              />
            </div>
            <div className="form-group form-actions">
              <Button
                label={t("accounting.reset")}
                icon="pi pi-refresh"
                onClick={handleReset}
                className="p-button-secondary"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <div className="loading-container">
          <ProgressSpinner />
          <p>{t("accounting.loadingAccounting")}</p>
        </div>
      )}

      {/* Clients List */}
      {!loading && filteredClients.length === 0 && (
        <Card className="empty-state-card">
          <div className="empty-state">
            <i className="pi pi-inbox empty-icon"></i>
            <h3>{t("accounting.noAccountingData")}</h3>
            <p>{t("accounting.noAccountingDataDesc")}</p>
          </div>
        </Card>
      )}

      {!loading && filteredClients.length > 0 && (
        <div className="clients-container">
          {filteredClients.map((client) => (
            <Card key={client.clientId} className="client-card">
              <div
                className="client-header"
                onClick={() => toggleClientExpansion(client.clientId)}
              >
                <div className="client-info">
                  <div className="client-name-section">
                    <h3
                      className="client-name"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClientClick(client.clientId);
                      }}
                    >
                      {client.clientName || "Unknown Client"}
                    </h3>
                    <span className="client-number">{client.clientNumber}</span>
                  </div>
                  <div className="client-summary">
                    <div className="summary-item">
                      <span className="summary-label">{t("accounting.transactions")}</span>
                      <span className="summary-value">
                        {client.totalTransactions}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">{t("accounting.debits")}</span>
                      <span className="summary-value debit-text">
                        {formatCurrency(client.summary.totalDebits)}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">{t("accounting.credits")}</span>
                      <span className="summary-value credit-text">
                        {formatCurrency(client.summary.totalCredits)}
                      </span>
                    </div>
                    <div className="summary-item">
                      <span className="summary-label">{t("accounting.balance")}</span>
                      <span
                        className={`summary-value ${
                          client.summary.balance >= 0
                            ? "debit-text"
                            : "credit-text"
                        }`}
                      >
                        {formatCurrency(client.summary.balance)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="expand-icon">
                  <i
                    className={`pi ${
                      expandedClients.has(client.clientId)
                        ? "pi-chevron-up"
                        : "pi-chevron-down"
                    }`}
                  ></i>
                </div>
              </div>

              {expandedClients.has(client.clientId) && (
                <div className="client-transactions">
                  <DataTable
                    value={client.transactions}
                    responsiveLayout="scroll"
                    className="transactions-table"
                    emptyMessage={t("accounting.noTransactionsFound")}
                  >
                    <Column
                      field="documentDate"
                      header={t("accounting.date")}
                      body={(rowData) => <DateCell dateString={rowData.documentDate} />}
                      sortable
                    />
                    <Column
                      field="transactionCode"
                      header={t("accounting.transactionCode")}
                      sortable
                    />
                    <Column
                      field="description"
                      header={t("accounting.description")}
                      style={{ minWidth: "200px" }}
                    />
                    <Column
                      field="accountCode"
                      header={t("accounting.glCode")}
                      body={(rowData) => (
                        <div>
                          <div className="account-code">{rowData.accountCode}</div>
                          <div className="account-name">{rowData.accountName}</div>
                        </div>
                      )}
                    />
                    <Column
                      field="entryType"
                      header={t("accounting.entryType")}
                      body={(rowData) => (
                        <EntryTypeBadge entryType={rowData.entryType} t={t} />
                      )}
                    />
                    <Column
                      field="motherPolicyNumber"
                      header={t("accounting.policyNumber")}
                      body={policyNumberBodyTemplate}
                    />
                    <Column
                      field="debitCredit"
                      header={t("accounting.drCr")}
                      body={(rowData) => (
                        <span
                          className={
                            rowData.debitCredit === "DEBIT"
                              ? "debit-text"
                              : "credit-text"
                          }
                        >
                          {rowData.debitCredit === "DEBIT" ? "Dr" : "Cr"}
                        </span>
                      )}
                    />
                    <Column
                      field="amount"
                      header={t("accounting.amount")}
                      body={(rowData) => (
                        <AmountCell
                          amount={rowData.amount}
                          debitCredit={rowData.debitCredit}
                        />
                      )}
                      sortable
                    />
                    <Column
                      field="status"
                      header={t("accounting.status")}
                      body={(rowData) => (
                        <Tag
                          value={rowData.status}
                          severity={
                            rowData.status === "Posted"
                              ? "success"
                              : rowData.status === "Pending"
                              ? "warning"
                              : "secondary"
                          }
                        />
                      )}
                    />
                  </DataTable>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!loading && pagination.totalPages > 1 && (
        <div className="pagination-container">
          <Paginator
            first={(pagination.page - 1) * pagination.pageSize}
            rows={pagination.pageSize}
            totalRecords={pagination.total}
            onPageChange={(e) => {
              setPagination({
                ...pagination,
                page: Math.floor(e.first / e.rows) + 1,
              });
            }}
            template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown"
            rowsPerPageOptions={[10, 20, 50, 100]}
            onRowsChange={(e) => {
              setPagination({
                ...pagination,
                pageSize: e.value,
                page: 1,
              });
            }}
          />
        </div>
      )}
    </div>
  );
};

export default AllClientsAccountingView;

