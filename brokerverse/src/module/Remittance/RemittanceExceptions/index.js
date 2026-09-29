import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dropdown } from "primereact/dropdown";
import { InputTextarea } from "primereact/inputtextarea";
import { InputNumber } from "primereact/inputnumber";
import { Toast } from "primereact/toast";
import remittanceService from "../../../services/remittanceService";
import authService from "../../../services/authService";
import { dateBody, downloadCsv, formatDateTime, isoDate, showError, showSuccess } from "../shared";
import "./index.scss";

const emptyResolution = { resolutionType: "", resolutionAmount: 0, resolutionNotes: "" };
const SEVERITIES = ["Critical", "High", "Medium", "Low"];
const STATUSES = ["Open", "In Progress", "Escalated", "Resolved"];
const allOption = (values) => [{ label: "All", value: "All" }, ...values.map((v) => ({ label: v, value: v }))];

/** Due date from the exception SLA ("24 hours", "2 days") counted from creation. */
const dueBy = (row) => {
  const match = /(\d+)\s*(hour|day)/i.exec(String(row.sla || ""));
  if (!match || !row.createdAt) return "-";
  const hours = Number(match[1]) * (/day/i.test(match[2]) ? 24 : 1);
  return formatDateTime(new Date(new Date(row.createdAt).getTime() + hours * 3600000));
};

const RemittanceExceptions = () => {
  const { t } = useTranslation();
  const { formatCurrency, currencyCode } = useFormatCurrency();
  const toast = useRef(null);
  const currentUser = authService.getUser()?.username || localStorage.getItem("USERNAME") || "";
  const [selectedException, setSelectedException] = useState(null);
  const [resolutionData, setResolutionData] = useState(emptyResolution);
  const [exceptions, setExceptions] = useState([]);
  const [filters, setFilters] = useState({ type: "All", severity: "All", status: "All" });
  const [loading, setLoading] = useState(false);

  const loadExceptions = async () => {
    setLoading(true);
    try {
      const rows = await remittanceService.listExceptions({ perPage: 500 });
      setExceptions(rows || []);
      setSelectedException((sel) => (sel ? (rows || []).find((r) => r.id === sel.id) || null : null));
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExceptions();
  }, []);

  const visible = exceptions.filter((e) =>
    (filters.type === "All" || e.type === filters.type)
    && (filters.severity === "All" || e.severity === filters.severity)
    && (filters.status === "All" || e.status === filters.status));
  const today = isoDate(new Date());
  const unresolved = exceptions.filter((e) => e.status !== "Resolved");
  const summary = {
    total: exceptions.length,
    unresolved: unresolved.length,
    processing: exceptions.filter((e) => e.status === "In Progress").length,
    resolvedToday: exceptions.filter((e) => e.status === "Resolved" && String(e.resolvedAt || e.lastModified || "").startsWith(today)).length,
    atRisk: unresolved.reduce((s, e) => s + Number(e.amount || 0), 0)
  };

  const run = async (action, message) => {
    try {
      await action();
      showSuccess(toast, message);
      setResolutionData(emptyResolution);
      await loadExceptions();
    } catch (e) {
      showError(toast, e);
    }
  };

  const startException = (row, assignee = currentUser) => run(() => remittanceService.assignException(row.id, assignee), `${row.exceptionId} assigned to ${assignee}`);

  const resolveException = (row, resolution) => {
    const text = resolution || window.prompt(t("remittance.resolutionNotes"), "");
    if (!text) return;
    run(() => remittanceService.resolveException(row.id, text), `${row.exceptionId} resolved`);
  };

  const escalateException = (row, reason) => {
    const text = reason || window.prompt(t("remittance.escalate"), "");
    if (!text) return;
    run(() => remittanceService.escalateException(row.id, text), `${row.exceptionId} escalated`);
  };

  const resolutionText = () => [resolutionData.resolutionType, resolutionData.resolutionAmount ? formatCurrency(resolutionData.resolutionAmount) : null, resolutionData.resolutionNotes]
    .filter(Boolean).join(" - ");

  const handleBulkAssign = () => {
    const assignee = window.prompt(t("remittance.delegateTo"), currentUser);
    if (assignee && selectedException) startException(selectedException, assignee);
  };

  const exportRows = (rows, name) => downloadCsv(`${name}_${today}.csv`, rows, [
    { field: "exceptionId", header: "ID" },
    { field: "severity", header: "Severity" },
    { field: "type", header: "Type" },
    { field: "remittanceNo", header: "Reference No" },
    { field: "amount", header: "Amount" },
    { field: "age", header: "Age (days)" },
    { field: "assignedTo", header: "Assigned To" },
    { field: "status", header: "Status" },
    { field: "description", header: "Description" }
  ]);

  const severityBodyTemplate = (rowData) => {
    const getSeverity = (severity) => {
      switch (severity) {
        case 'Critical': return 'danger';
        case 'High': return 'warning';
        case 'Medium': return 'info';
        case 'Low': return 'success';
        default: return null;
      }
    };
    return <Tag value={rowData.severity} severity={getSeverity(rowData.severity)} />;
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Resolved': return 'success';
        case 'In Progress': return 'warning';
        case 'Open': return 'danger';
        case 'Escalated': return 'info';
        default: return null;
      }
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const actionsBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button icon="pi pi-play" className="p-button-rounded p-button-text" tooltip={t("remittance.start")} disabled={rowData.status !== 'Open'} onClick={() => startException(rowData)} />
        <Button icon="pi pi-check" className="p-button-rounded p-button-success p-button-text" tooltip={t("remittance.resolve")} disabled={!['In Progress', 'Escalated'].includes(rowData.status)} onClick={() => resolveException(rowData)} />
        <Button icon="pi pi-arrow-up" className="p-button-rounded p-button-warning p-button-text" tooltip={t("remittance.escalate")} disabled={['Resolved', 'Escalated'].includes(rowData.status)} onClick={() => escalateException(rowData)} />
      </div>
    );
  };

  return (
    <div className="remittance-exceptions">
      <Toast ref={toast} />
      <h2>{t("remittance.remittanceExceptions")}</h2>

      <div className="summary-bar">
        <div className="summary-item">
          <i className="pi pi-exclamation-triangle" />
          <div>
            <div className="value">{summary.total}</div>
            <div className="label">{t("remittance.totalExceptions")}</div>
          </div>
        </div>
        <div className="summary-item red">
          <i className="pi pi-clock" />
          <div>
            <div className="value">{summary.unresolved}</div>
            <div className="label">{t("remittance.unresolved")}</div>
          </div>
        </div>
        <div className="summary-item orange">
          <i className="pi pi-spin pi-spinner" />
          <div>
            <div className="value">{summary.processing}</div>
            <div className="label">{t("remittance.processing")}</div>
          </div>
        </div>
        <div className="summary-item green">
          <i className="pi pi-check-circle" />
          <div>
            <div className="value">{summary.resolvedToday}</div>
            <div className="label">{t("remittance.resolvedToday")}</div>
          </div>
        </div>
        <div className="summary-item highlight">
          <i className="pi pi-dollar" />
          <div>
            <div className="value">{formatCurrency(summary.atRisk)}</div>
            <div className="label">{t("remittance.totalValueAtRisk")}</div>
          </div>
        </div>
      </div>

      <div className="split-view">
        <Card title={t("remittance.exceptionList")} className="left-panel">
          <div className="filter-section mb-3">
            <Dropdown placeholder={t("remittance.exceptionType")} value={filters.type}
              options={allOption([...new Set(exceptions.map((e) => e.type).filter(Boolean))])}
              onChange={(e) => setFilters({ ...filters, type: e.value })} className="mr-2" />
            <Dropdown placeholder={t("remittance.severity")} value={filters.severity} options={allOption(SEVERITIES)}
              onChange={(e) => setFilters({ ...filters, severity: e.value })} className="mr-2" />
            <Dropdown placeholder={t("remittance.status")} value={filters.status} options={allOption(STATUSES)}
              onChange={(e) => setFilters({ ...filters, status: e.value })} />
          </div>

          <DataTable
            value={visible}
            loading={loading}
            selection={selectedException}
            onSelectionChange={(e) => setSelectedException(e.value)}
            selectionMode="single"
            dataKey="id"
            stripedRows
          >
            <Column field="severity" header="" body={severityBodyTemplate} style={{ width: '5%' }} />
            <Column field="exceptionId" header="ID" />
            <Column field="type" header={t("remittance.type")} />
            <Column field="remittanceNo" header={t("remittance.referenceNo")} />
            <Column field="amount" header={t("remittance.amount")} body={(data) => formatCurrency(data.amount)} />
            <Column field="age" header={t("remittance.age")} body={(data) => `${data.age}d`} />
            <Column field="assignedTo" header={t("remittance.delegatedTo")} />
            <Column field="status" header={t("remittance.status")} body={statusBodyTemplate} />
            <Column header="" body={actionsBodyTemplate} style={{ width: '10%' }} />
          </DataTable>
        </Card>

        <Card title={t("remittance.exceptionDetails")} className="right-panel">
          {selectedException ? (
            <div className="exception-details">
              <div className="detail-section">
                <h4>{t("remittance.exceptionInformation")}</h4>
                <div className="detail-item">
                  <label>Exception ID:</label>
                  <span>{selectedException.exceptionId}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.type")}:</label>
                  <span>{selectedException.type}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.severity")}:</label>
                  {severityBodyTemplate(selectedException)}
                </div>
                <div className="detail-item">
                  <label>{t("remittance.created")}:</label>
                  <span>{dateBody("createdDate")(selectedException)}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.dueBy")}:</label>
                  <span className="highlight">{dueBy(selectedException)}</span>
                </div>
              </div>

              <div className="detail-section">
                <h4>{t("remittance.transactionDetails")}</h4>
                <div className="detail-item">
                  <label>{t("remittance.referenceNo")}:</label>
                  <span>{selectedException.remittanceNo}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.expectedAmount")}:</label>
                  <span>{formatCurrency(selectedException.amount)}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.actualAmount")}:</label>
                  <span>{selectedException.difference == null ? "-" : formatCurrency(Number(selectedException.amount) - Number(selectedException.difference))}</span>
                </div>
                <div className="detail-item">
                  <label>{t("remittance.difference")}:</label>
                  <span className="highlight">{selectedException.difference == null ? "-" : formatCurrency(selectedException.difference)}</span>
                </div>
              </div>

              <div className="detail-section">
                <h4>{t("remittance.resolution")}</h4>
                <div className="p-fluid">
                  <div className="p-field">
                    <label>{t("remittance.resolutionType")} *</label>
                    <Dropdown
                      value={resolutionData.resolutionType}
                      options={[
                        { label: "Manual Adjustment", value: "Manual Adjustment" },
                        { label: "Write-off", value: "Write-off" },
                        { label: "Create Credit Note", value: "Create Credit Note" },
                        { label: "Create Debit Note", value: "Create Debit Note" },
                        { label: "Reverse Transaction", value: "Reverse Transaction" }
                      ]}
                      onChange={(e) => setResolutionData({ ...resolutionData, resolutionType: e.value })}
                      placeholder={t("remittance.selectResolutionType")}
                    />
                  </div>
                  <div className="p-field">
                    <label>{t("remittance.resolutionAmount")} *</label>
                    <InputNumber
                      value={resolutionData.resolutionAmount}
                      onValueChange={(e) => setResolutionData({ ...resolutionData, resolutionAmount: e.value })}
                      mode="currency"
                      currency={currencyCode}
                    />
                  </div>
                  <div className="p-field">
                    <label>{t("remittance.resolutionNotes")} *</label>
                    <InputTextarea
                      value={resolutionData.resolutionNotes}
                      onChange={(e) => setResolutionData({ ...resolutionData, resolutionNotes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="action-buttons mt-3">
                  <Button label={t("remittance.saveProgress")} className="p-button-secondary mr-2"
                    disabled={selectedException.status !== 'Open'} onClick={() => startException(selectedException)} />
                  <Button label={t("remittance.resolveException")} className="p-button-success mr-2"
                    disabled={selectedException.status === 'Resolved' || !resolutionData.resolutionType || !resolutionData.resolutionNotes}
                    onClick={() => resolveException(selectedException, resolutionText())} />
                  <Button label={t("remittance.escalate")} className="p-button-warning"
                    disabled={['Resolved', 'Escalated'].includes(selectedException.status)}
                    onClick={() => escalateException(selectedException, resolutionData.resolutionNotes)} />
                </div>
              </div>
            </div>
          ) : (
            <div className="no-selection">
              <p>{t("remittance.selectExceptionToView")}</p>
            </div>
          )}
        </Card>
      </div>

      <div className="action-bar">
        <Button label={t("remittance.exportExceptions")} icon="pi pi-download" className="p-button-secondary mr-2" onClick={() => exportRows(visible, "remittance_exceptions")} />
        <Button label={t("remittance.bulkAssign")} icon="pi pi-users" className="p-button-secondary mr-2" disabled={!selectedException || selectedException.status === 'Resolved'} onClick={handleBulkAssign} />
        <Button label={t("remittance.createReport")} icon="pi pi-file" className="p-button-primary" onClick={() => exportRows(exceptions, "remittance_exception_report")} />
      </div>
    </div>
  );
};

export default RemittanceExceptions;