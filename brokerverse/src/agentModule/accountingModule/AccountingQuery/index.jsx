import React, { useState, useEffect, useRef } from "react";
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
import { Dialog } from "primereact/dialog";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import accountingService from "../../../services/accountingService";
import { calendarDateFormat, formatDate } from "../../../utility/dateFormat";
import "./index.scss";
import logger from "../../../utility/logger";

const EntryTypeBadge = ({ entryType }) => {
  const { t } = useTranslation();
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
const DateCell = ({ dateString }) => formatDate(dateString, { empty: "" });

const AccountingQuery = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const toast = useRef(null);

  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
  const [processingTransactionId, setProcessingTransactionId] = useState(null);

  // Filter states
  const [policyId, setPolicyId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [entryType, setEntryType] = useState(null);
  const [referenceType, setReferenceType] = useState(null);
  const [status, setStatus] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [glCode, setGlCode] = useState("");

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

  const referenceTypeOptions = [
    { label: "All Types", value: null },
    { label: "Policy", value: "Policy" },
    { label: "Endorsement", value: "Endorsement" },
    { label: "Renewal", value: "Renewal" },
    { label: "Receipt", value: "Receipt" },
    { label: "Remittance", value: "Remittance" },
    { label: "Refund", value: "Refund" },
  ];

  const statusOptions = [
    { label: "All Statuses", value: null },
    { label: "Pending", value: "Pending" },
    { label: "Posted", value: "Posted" },
    { label: "Reversed", value: "Reversed" },
    { label: "Cancelled", value: "Cancelled" },
  ];

  const handleSearch = async (page = 1, pageSize = null) => {
    try {
      setLoading(true);

      const filters = {
        policyId: policyId?.trim() || undefined,
        clientId: clientId?.trim() || undefined,
        clientName: clientName?.trim() || undefined,
        entryType: entryType || undefined,
        referenceType: referenceType || undefined,
        status: status || undefined,
        glCode: glCode?.trim() || undefined,
        startDate: startDate
          ? new Date(startDate).toISOString().split("T")[0]
          : undefined,
        endDate: endDate
          ? new Date(endDate).toISOString().split("T")[0]
          : undefined,
        page,
        pageSize: pageSize || pagination.pageSize,
      };

      // Remove undefined and empty string values
      Object.keys(filters).forEach(
        (key) =>
          (filters[key] === undefined || filters[key] === "") &&
          delete filters[key]
      );

      const response = await accountingService.queryAccountingEntries(filters);

      if (response.success) {
        setEntries(response.data || []);
        setPagination(response.pagination || pagination);
      } else {
        throw new Error(
          response.error || "Failed to search accounting entries"
        );
      }
    } catch (error) {
      logger.error("Error searching accounting entries:", error);
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: error.message || "Failed to search accounting entries",
        life: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPolicyId("");
    setClientId("");
    setClientName("");
    setEntryType(null);
    setReferenceType(null);
    setStatus(null);
    setStartDate(null);
    setEndDate(null);
    setGlCode("");
    setEntries([]);
    setPagination({
      page: 1,
      pageSize: 50,
      total: 0,
      totalPages: 0,
    });
  };

  const handleExport = async () => {
    try {
      setExportLoading(true);

      const filters = {
        policyId: policyId?.trim() || undefined,
        clientId: clientId?.trim() || undefined,
        clientName: clientName?.trim() || undefined,
        entryType: entryType || undefined,
        referenceType: referenceType || undefined,
        status: status || undefined,
        glCode: glCode?.trim() || undefined,
        startDate: startDate
          ? new Date(startDate).toISOString().split("T")[0]
          : undefined,
        endDate: endDate
          ? new Date(endDate).toISOString().split("T")[0]
          : undefined,
      };

      // Remove undefined and empty string values
      Object.keys(filters).forEach(
        (key) =>
          (filters[key] === undefined || filters[key] === "") &&
          delete filters[key]
      );

      const response = await accountingService.exportAccountingEntries(filters);

      if (response.success) {
        toast.current?.show({
          severity: "success",
          summary: "Export Successful",
          detail: "Accounting entries exported to Excel successfully",
          life: 3000,
        });
      } else {
        throw new Error(
          response.error || "Failed to export accounting entries"
        );
      }
    } catch (error) {
      logger.error("Error exporting accounting entries:", error);
      toast.current?.show({
        severity: "error",
        summary: "Export Failed",
        detail: error.message || "Failed to export accounting entries",
        life: 3000,
      });
    } finally {
      setExportLoading(false);
    }
  };

  const handlePolicyClick = (policyId) => {
    if (policyId) {
      navigate(`/agent/premium-accounting-entries/${policyId}`);
    }
  };

  const handleMotherPolicyClick = (motherPolicyId) => {
    if (motherPolicyId) {
      navigate(`/agent/premium-accounting-entries/${motherPolicyId}`);
    }
  };

  const handlePostTransaction = async (transactionId, transactionCode) => {
    setProcessingTransactionId(transactionId);
    try {
      const response = await accountingService.postTransaction(transactionId);
      if (response.success) {
        // Immediately update local state
        setEntries((prevEntries) =>
          prevEntries.map((entry) =>
            entry.id === transactionId
              ? { ...entry, status: "Posted", ...response.data }
              : entry
          )
        );
        toast.current?.show({
          severity: "success",
          summary: "Success",
          detail: `Transaction ${transactionCode} posted successfully`,
          life: 3000,
        });
        // Also refresh the data to ensure consistency
        await handleSearch(pagination.page);
      } else {
        throw new Error(response.error || "Failed to post transaction");
      }
    } catch (error) {
      toast.current?.show({
        severity: "error",
        summary: "Error",
        detail: error.message || "Failed to post transaction",
        life: 3000,
      });
    } finally {
      setProcessingTransactionId(null);
    }
  };

  const handleReverseTransaction = async (transactionId, transactionCode) => {
    confirmDialog({
      message: `Are you sure you want to reverse transaction ${transactionCode}? This action cannot be undone.`,
      header: "Confirm Reverse",
      icon: "pi pi-exclamation-triangle",
      accept: async () => {
        setProcessingTransactionId(transactionId);
        try {
          const response = await accountingService.reverseTransaction(
            transactionId
          );
          if (response.success) {
            // Immediately update local state
            setEntries((prevEntries) =>
              prevEntries.map((entry) =>
                entry.id === transactionId
                  ? { ...entry, status: "Reversed", ...response.data }
                  : entry
              )
            );
            toast.current?.show({
              severity: "success",
              summary: "Success",
              detail: `Transaction ${transactionCode} reversed successfully`,
              life: 3000,
            });
            // Also refresh the data to ensure consistency
            await handleSearch(pagination.page);
          } else {
            throw new Error(response.error || "Failed to reverse transaction");
          }
        } catch (error) {
          toast.current?.show({
            severity: "error",
            summary: "Error",
            detail: error.message || "Failed to reverse transaction",
            life: 3000,
          });
        } finally {
          setProcessingTransactionId(null);
        }
      },
    });
  };

  const handleCancelTransaction = async (transactionId, transactionCode) => {
    confirmDialog({
      message: `Are you sure you want to cancel transaction ${transactionCode}? This action cannot be undone.`,
      header: "Confirm Cancel",
      icon: "pi pi-exclamation-triangle",
      accept: async () => {
        setProcessingTransactionId(transactionId);
        try {
          const response = await accountingService.cancelTransaction(
            transactionId
          );
          if (response.success) {
            // Immediately update local state
            setEntries((prevEntries) =>
              prevEntries.map((entry) =>
                entry.id === transactionId
                  ? { ...entry, status: "Cancelled", ...response.data }
                  : entry
              )
            );
            toast.current?.show({
              severity: "success",
              summary: "Success",
              detail: `Transaction ${transactionCode} cancelled successfully`,
              life: 3000,
            });
            // Also refresh the data to ensure consistency
            await handleSearch(pagination.page);
          } else {
            throw new Error(response.error || "Failed to cancel transaction");
          }
        } catch (error) {
          toast.current?.show({
            severity: "error",
            summary: "Error",
            detail: error.message || "Failed to cancel transaction",
            life: 3000,
          });
        } finally {
          setProcessingTransactionId(null);
        }
      },
    });
  };

  const ActionButtons = ({ rowData }) => {
    const isProcessing = processingTransactionId === rowData.id;
    const canPost = rowData.status === "Pending";
    const canReverse = rowData.status === "Posted";
    const canCancel =
      rowData.status !== "Cancelled" && rowData.status !== "Reversed";

    return (
      <div className="action-buttons">
        {canPost && (
          <Button
            icon="pi pi-check"
            className="p-button-rounded p-button-text p-button-success"
            onClick={() =>
              handlePostTransaction(rowData.id, rowData.transactionCode)
            }
            disabled={isProcessing}
            loading={isProcessing}
            tooltip="Post this transaction"
            tooltipOptions={{ position: "top" }}
          />
        )}
        {canReverse && (
          <Button
            icon="pi pi-undo"
            className="p-button-rounded p-button-text p-button-warning"
            onClick={() =>
              handleReverseTransaction(rowData.id, rowData.transactionCode)
            }
            disabled={isProcessing}
            loading={isProcessing}
            tooltip="Reverse this transaction"
            tooltipOptions={{ position: "top" }}
          />
        )}
        {canCancel && (
          <Button
            icon="pi pi-times"
            className="p-button-rounded p-button-text p-button-danger"
            onClick={() =>
              handleCancelTransaction(rowData.id, rowData.transactionCode)
            }
            disabled={isProcessing}
            loading={isProcessing}
            tooltip="Cancel this transaction"
            tooltipOptions={{ position: "top" }}
          />
        )}
        {!canPost && !canReverse && !canCancel && (
          <span className="no-actions">-</span>
        )}
      </div>
    );
  };

  return (
    <div className="accounting-query">
      <Toast ref={toast} />
      <ConfirmDialog />

      {/* Header */}
      <div className="page-header">
        <h1>{t("accounting.entriesQuery")}</h1>
        <p className="subtitle">
          {t("accounting.entriesQuerySubtitle")}
        </p>
      </div>

      {/* Search Form */}
      <Card className="search-card">
        <div className="search-form">
          <div className="form-row">
            <div className="form-group">
              <label>{t("accounting.policyIdOptional")}</label>
              <InputText
                value={policyId}
                onChange={(e) => setPolicyId(e.target.value)}
                placeholder={t("accounting.enterPolicyId")}
              />
            </div>
            <div className="form-group">
              <label>{t("accounting.clientId")}</label>
              <InputText
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={t("accounting.enterClientId")}
              />
            </div>
            <div className="form-group">
              <label>{t("accounting.clientName")}</label>
              <InputText
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder={t("accounting.enterClientName")}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t("accounting.entryType")}</label>
              <Dropdown
                value={entryType}
                options={entryTypeOptions}
                onChange={(e) => setEntryType(e.value)}
                placeholder={t("accounting.selectEntryType")}
              />
            </div>
            <div className="form-group">
              <label>{t("accounting.referenceType")}</label>
              <Dropdown
                value={referenceType}
                options={referenceTypeOptions}
                onChange={(e) => setReferenceType(e.value)}
                placeholder={t("accounting.selectReferenceType")}
              />
            </div>
            <div className="form-group">
              <label>{t("accounting.status")}</label>
              <Dropdown
                value={status}
                options={statusOptions}
                onChange={(e) => setStatus(e.value)}
                placeholder={t("accounting.selectStatus")}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>{t("accounting.startDate")}</label>
              <Calendar
                value={startDate}
                onChange={(e) => setStartDate(e.value)}
                dateFormat={calendarDateFormat()}
                showIcon
              />
            </div>
            <div className="form-group">
              <label>{t("accounting.endDate")}</label>
              <Calendar
                value={endDate}
                onChange={(e) => setEndDate(e.value)}
                dateFormat={calendarDateFormat()}
                showIcon
              />
            </div>
            <div className="form-group">
              <label>{t("accounting.glCode")}</label>
              <InputText
                value={glCode}
                onChange={(e) => setGlCode(e.target.value)}
                placeholder={t("accounting.enterGlCode")}
              />
            </div>
            <div className="form-group form-actions">
              <Button
                label={t("accounting.search")}
                icon="pi pi-search"
                onClick={() => handleSearch(1)}
                loading={loading}
                className="search-button"
              />
              <Button
                label={t("accounting.export")}
                icon="pi pi-file-excel"
                onClick={handleExport}
                loading={exportLoading}
                disabled={exportLoading}
                severity="success"
                className="export-button"
              />
              <Button
                label={t("accounting.reset")}
                icon="pi pi-refresh"
                onClick={handleReset}
                severity="secondary"
                outlined
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Results Table */}
      {entries.length > 0 && (
        <Card className="results-card">
          <div className="results-header">
            <h3>
              {t("accounting.results")} ({pagination.total}{" "}
              {pagination.total === 1 ? t("accounting.entry") : t("accounting.entries")})
            </h3>
          </div>

          <DataTable
            value={entries}
            paginator
            lazy
            rows={pagination.pageSize}
            first={(pagination.page - 1) * pagination.pageSize}
            totalRecords={pagination.total}
            onPage={(e) => handleSearch(e.page + 1, e.rows)}
            rowsPerPageOptions={[10, 25, 50, 100]}
            paginatorTemplate="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first} to {last} of {totalRecords} entries"
            emptyMessage={t("accounting.noEntriesFound")}
            className="results-table"
            loading={loading}
          >
            <Column
              field="transactionCode"
              header={t("accounting.transactionCode")}
              sortable
              style={{ minWidth: "150px" }}
            />
            <Column
              field="entryType"
              header={t("accounting.entryType")}
              sortable
              body={(rowData) => (
                <EntryTypeBadge entryType={rowData.entryType} />
              )}
              style={{ minWidth: "150px" }}
            />
            <Column
              field="documentDate"
              header={t("accounting.documentDate")}
              sortable
              body={(rowData) => <DateCell dateString={rowData.documentDate} />}
              style={{ minWidth: "120px" }}
            />
            <Column
              field="account.accountName"
              header={t("accounting.account")}
              sortable
              body={(rowData) =>
                rowData.account?.accountName || rowData.mainAccount
              }
              style={{ minWidth: "200px" }}
            />
            <Column
              field="glCode"
              header={t("accounting.glCode")}
              sortable
              body={(rowData) => {
                if (!rowData.glCode) return "-";
                const parts = rowData.glCode.split("-");
                return parts.length > 2
                  ? `${parts[2]}-${parts[3]}`
                  : rowData.glCode;
              }}
              style={{ minWidth: "120px" }}
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
            <Column
              field="motherPolicyNumber"
              header={t("accounting.referenceNumber")}
              body={(rowData) => {
                const policyNum =
                  rowData.motherPolicyNumber ||
                  (rowData.referenceType === "Policy"
                    ? rowData.referenceId
                    : null);
                if (policyNum) {
                  return (
                    <button
                      className="policy-link"
                      onClick={() =>
                        handlePolicyClick(
                          rowData.motherPolicyId || rowData.referenceId
                        )
                      }
                    >
                      {policyNum}
                    </button>
                  );
                }
                return "-";
              }}
              style={{ minWidth: "150px" }}
            />
            <Column
              field="client.clientId"
              header={t("accounting.clientIdLabel")}
              sortable
              body={(rowData) =>
                rowData.client?.clientId || rowData.clientId || "-"
              }
              style={{ minWidth: "120px" }}
            />
            <Column
              field="client.firstName"
              header={t("tables.clientName")}
              sortable
              body={(rowData) => {
                if (rowData.client?.firstName || rowData.client?.lastName) {
                  return `${rowData.client.firstName || ""} ${
                    rowData.client.lastName || ""
                  }`.trim();
                }
                return "-";
              }}
              style={{ minWidth: "180px" }}
            />
            <Column
              field="status"
              header={t("accounting.status")}
              sortable
              body={(rowData) => (
                <Tag
                  value={rowData.status}
                  severity={
                    rowData.status === "Posted"
                      ? "success"
                      : rowData.status === "Pending"
                      ? "warning"
                      : "danger"
                  }
                />
              )}
              style={{ minWidth: "100px" }}
            />
            {/* <Column
              header={t("tables.actions")}
              body={(rowData) => <ActionButtons rowData={rowData} />}
              style={{ minWidth: "120px" }}
              alignHeader="center"
              align="center"
            /> */}
          </DataTable>
        </Card>
      )}

      {!loading && entries.length === 0 && (
        <Card className="empty-state">
          <div className="empty-message">
            <i
              className="pi pi-search"
              style={{ fontSize: "3rem", color: "#6c757d" }}
            ></i>
            <p>
              {t("accounting.noEntriesHint")}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
};

export default AccountingQuery;
