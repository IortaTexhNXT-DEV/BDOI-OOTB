import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { Timeline } from "primereact/timeline";
import { Badge } from "primereact/badge";
import { Tooltip } from "primereact/tooltip";
import { Toast } from "primereact/toast";
import { useNavigate } from "react-router-dom";
import remittanceService from "../../../services/remittanceService";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { calendarDateFormat, dateBody, downloadCsv, isoDate, showError, statusSeverity } from "../shared";
import "./index.scss";

import { numberLocale } from "../../../utility/currencyConverter";
import { formatDate as formatAppDate } from "../../../utility/dateFormat";
const ACTION_STYLE = {
  create: { icon: "pi pi-plus", color: "#4CAF50" },
  approve: { icon: "pi pi-verified", color: "#4CAF50" },
  reject: { icon: "pi pi-times", color: "var(--color-danger)" },
  submit: { icon: "pi pi-send", color: "#2196F3" },
};
const HISTORY_COLUMNS = [
  { field: "referenceNo", header: "Reference No" },
  { field: "type", header: "Type" },
  { field: "policyNo", header: "Policy No" },
  { field: "clientName", header: "Client" },
  { field: "amount", header: "Amount" },
  { field: "status", header: "Status" },
  { field: "createdBy", header: "Created By" },
  { field: "createdDate", header: "Created" },
  { field: "version", header: "Version" }
];
const AUDIT_COLUMNS = [
  { field: "referenceNo", header: "Reference No" },
  { field: "actionType", header: "Action" },
  { field: "previousValue", header: "Previous" },
  { field: "newValue", header: "New" },
  { field: "changedBy", header: "By" },
  { field: "changeDate", header: "Date" },
  { field: "reason", header: "Reason" }
];
const allOption = (values) => [{ label: "All", value: "All" }, ...values.map((v) => ({ label: v, value: v }))];

const RemittanceHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { formatCurrency } = useFormatCurrency();
  const toast = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedAuditTrail, setSelectedAuditTrail] = useState(null);
  const [filterDateRange, setFilterDateRange] = useState(null);
  const [filterType, setFilterType] = useState("All");
  const [filterUser, setFilterUser] = useState("All");
  const [logLevel, setLogLevel] = useState("All");
  const [logSearch, setLogSearch] = useState("");
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [auditTrails, setAuditTrails] = useState([]);
  const [systemLogs, setSystemLogs] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const archiveHistory = [];

  const loadHistory = async () => {
    setLoading(true);
    try {
      const [history, audit, logs] = await Promise.all([
        remittanceService.history({ type: filterType === "All" ? undefined : filterType, perPage: 500 }),
        remittanceService.auditTrail(),
        remittanceService.systemLogs()
      ]);
      const rows = history.data || [];
      setTransactionHistory(rows);
      setHistoryTotal(history.total || rows.length);
      if (filterType === "All") setTypes([...new Set(rows.map((r) => r.type))]);
      setAuditTrails(audit || []);
      setSystemLogs(logs || []);
      setSelectedRows([]);
    } catch (e) {
      showError(toast, e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [fromDate, toDate] = filterDateRange || [];
  const visibleHistory = transactionHistory.filter((r) => {
    const day = String(r.createdDate).slice(0, 10);
    return (filterUser === "All" || r.createdBy === filterUser)
      && (!fromDate || day >= isoDate(fromDate)) && (!toDate || day <= isoDate(toDate));
  });
  const visibleLogs = systemLogs.filter((l) => (logLevel === "All" || l.level === logLevel)
    && (!logSearch || `${l.module} ${l.message} ${l.user}`.toLowerCase().includes(logSearch.toLowerCase())));
  const thisMonth = isoDate(new Date()).slice(0, 7);
  const auditCoverage = transactionHistory.length ? Math.round((transactionHistory.filter((r) => r.hasAuditTrail).length / transactionHistory.length) * 100) : 0;
  const auditFor = (ref) => auditTrails.filter((a) => a.referenceNo === ref);
  const lineageRecord = selectedRecord || transactionHistory[0];
  const toTimeline = (entries) => [...entries].reverse().map((a) => ({
    status: a.actionType,
    date: a.changeDate,
    icon: (ACTION_STYLE[a.actionType] || {}).icon || "pi pi-pencil",
    color: (ACTION_STYLE[a.actionType] || {}).color || "#FF9800",
    description: [a.previousValue && a.newValue ? `${a.previousValue} → ${a.newValue}` : a.newValue, a.changedBy ? `by ${a.changedBy}` : null, a.reason].filter(Boolean).join(" ")
  }));
  const timelineEvents = toTimeline(lineageRecord ? auditFor(lineageRecord.referenceNo) : []);
  const recordAudit = selectedRecord ? auditFor(selectedRecord.referenceNo) : [];
  const latestChange = recordAudit[0];
  const selectedAudit = selectedAuditTrail ? auditFor(selectedAuditTrail.referenceNo) : [];
  const auditDates = selectedAudit.map((a) => String(a.changeDate).slice(0, 10)).sort();

  const typeOptions = allOption(types);

  const userOptions = allOption([...new Set(transactionHistory.map((r) => r.createdBy).filter(Boolean))]);

  const logLevelOptions = allOption([...new Set(systemLogs.map((l) => l.level))]);

  const statusBodyTemplate = (rowData) => {
    return <Tag value={rowData.status} severity={statusSeverity(rowData.status)} />;
  };

  const levelBodyTemplate = (rowData) => {
    const getSeverity = (level) => {
      switch (level) {
        case 'INFO': return 'success';
        case 'WARNING': return 'warning';
        case 'ERROR': return 'danger';
        case 'DEBUG': return 'info';
        default: return null;
      }
    };
    return <Tag value={rowData.level} severity={getSeverity(rowData.level)} />;
  };

  const versionBodyTemplate = (rowData) => {
    return <Badge value={`v${rowData.version}`} severity="info" />;
  };

  const openAudit = (rowData) => {
    setSelectedAuditTrail(rowData);
    setShowAuditDialog(true);
  };

  const auditBodyTemplate = (rowData) => {
    return rowData.hasAuditTrail ? (
      <Button
        icon="pi pi-history"
        className="p-button-rounded p-button-text"
        tooltip="View Audit Trail"
        onClick={() => openAudit(rowData)}
      />
    ) : (
      <span className="text-muted">No audit trail</span>
    );
  };

  const exportRows = (rows, name, columns = HISTORY_COLUMNS) => downloadCsv(`${name}_${isoDate(new Date())}.csv`, rows, columns);

  const actionsBodyTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="View Details"
          onClick={() => {
            setSelectedRecord(rowData);
            setShowDetailDialog(true);
          }}
        />
        <Button
          icon="pi pi-history"
          className="p-button-rounded p-button-text"
          tooltip="View History"
          onClick={() => openAudit(rowData)}
        />
        <Button
          icon="pi pi-download"
          className="p-button-rounded p-button-text"
          tooltip="Export"
          onClick={() => exportRows([rowData], rowData.referenceNo || "record", Object.keys(rowData).map((k) => ({ field: k, header: k })))}
        />
      </div>
    );
  };

  const handleBackToMaster = () => {
    navigate("/master/finance/remittance");
  };

  const handleExportHistory = () => exportRows(visibleHistory, "remittance_history");


  const customizedMarker = (item) => {
    return (
      <span
        className="custom-marker shadow-2"
        style={{ backgroundColor: item.color }}
      >
        <i className={item.icon}></i>
      </span>
    );
  };

  const customizedContent = (item) => {
    return (
      <Card className="timeline-card">
        <div className="timeline-content">
          <div className="timeline-header">
            <span className="timeline-status">{item.status}</span>
            <small className="timeline-date">{formatAppDate(item.date)}</small>
          </div>
          <p className="timeline-description">{item.description}</p>
        </div>
      </Card>
    );
  };

  const detailDialogFooter = (
    <div>
      <Button
        label="Export"
        icon="pi pi-download"
        className="p-button-secondary mr-2"
        onClick={() => selectedRecord && exportRows([selectedRecord], selectedRecord.referenceNo)}
      />
      <Button
        label="Close"
        icon="pi pi-times"
        onClick={() => setShowDetailDialog(false)}
        className="p-button-text"
      />
    </div>
  );

  const auditDialogFooter = (
    <div>
      <Button
        label="Export Audit Trail"
        icon="pi pi-download"
        className="p-button-secondary mr-2"
        onClick={() => exportRows(selectedAudit, `audit_${selectedAuditTrail?.referenceNo}`, AUDIT_COLUMNS)}
      />
      <Button
        label="Close"
        icon="pi pi-times"
        onClick={() => setShowAuditDialog(false)}
        className="p-button-text"
      />
    </div>
  );

  return (
    <div className="remittance-history">
      <Toast ref={toast} />
      <div className="header-section">
        <h2>{t("remittance.remittanceHistoryAuditTrail")}</h2>
        <Button
          label="Back to Master"
          icon="pi pi-arrow-left"
          className="p-button-secondary"
          onClick={handleBackToMaster}
        />
      </div>

      <div className="summary-cards">
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon blue">
              <i className="pi pi-database" />
            </div>
            <div className="card-details">
              <div className="card-value">{historyTotal.toLocaleString(numberLocale())}</div>
              <div className="card-label">Total Records</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon green">
              <i className="pi pi-history" />
            </div>
            <div className="card-details">
              <div className="card-value">{transactionHistory.filter((r) => String(r.createdDate).startsWith(thisMonth)).length}</div>
              <div className="card-label">This Month</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon orange">
              <i className="pi pi-folder" />
            </div>
            <div className="card-details">
              <div className="card-value">{archiveHistory.length}</div>
              <div className="card-label">Archived Data</div>
            </div>
          </div>
        </Card>
        <Card className="summary-card">
          <div className="card-content">
            <div className="card-icon purple">
              <i className="pi pi-shield" />
            </div>
            <div className="card-details">
              <div className="card-value">{auditCoverage}%</div>
              <div className="card-label">Data Integrity</div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <div className="table-toolbar">
          <div className="toolbar-left">
            <Button
              label="Export History"
              icon="pi pi-download"
              className="p-button-primary mr-2"
              onClick={handleExportHistory}
            />
            <Button
              label="Refresh"
              icon="pi pi-refresh"
              className="p-button-secondary"
              onClick={loadHistory}
            />
          </div>
          <div className="filter-section">
            <Dropdown
              value={filterType}
              options={typeOptions}
              onChange={(e) => setFilterType(e.value)}
              placeholder="Type"
              className="mr-2"
            />
            <Dropdown
              value={filterUser}
              options={userOptions}
              onChange={(e) => setFilterUser(e.value)}
              placeholder="User"
              className="mr-2"
            />
            <Calendar dateFormat={calendarDateFormat()}
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.value)}
              selectionMode="range"
              placeholder="Date Range"
              className="mr-2"
            />
            <Button label="Filter" icon="pi pi-filter" className="p-button-secondary" onClick={loadHistory} />
          </div>
        </div>

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={<span>Transaction History <Badge value={visibleHistory.length.toLocaleString(numberLocale())} className="ml-2" /></span>}>
            <DataTable
              value={visibleHistory}
              loading={loading}
              selection={selectedRows}
              onSelectionChange={(e) => setSelectedRows(e.value)}
              dataKey="id"
              stripedRows
              className="history-table"
            >
              <Column selectionMode="multiple" style={{ width: '3rem' }} />
              <Column field="referenceNo" header="Reference No" />
              <Column field="type" header="Type" />
              <Column field="policyNo" header="Policy No" />
              <Column field="clientName" header="Client" />
              <Column
                field="amount"
                header="Amount"
                body={(data) => {
                  const color = data.amount >= 0 ? 'inherit' : 'red';
                  return <span style={{ color }}>{formatCurrency(Math.abs(data.amount))}</span>;
                }}
              />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="createdBy" header="Created By" />
              <Column field="createdDate" body={dateBody("createdDate")} header="Created" />
              <Column field="version" header="Version" body={versionBodyTemplate} />
              <Column field="hasAuditTrail" header="Audit" body={auditBodyTemplate} />
              <Column header="Actions" body={actionsBodyTemplate} style={{ width: '150px' }} />
            </DataTable>

            {selectedRows.length > 0 && (
              <div className="bulk-actions mt-3">
                <Button
                  label={`Export Selected (${selectedRows.length})`}
                  icon="pi pi-download"
                  className="p-button-secondary mr-2"
                  onClick={() => exportRows(selectedRows, "remittance_history_selected")}
                />
                <Button
                  label="View Audit Trails"
                  icon="pi pi-history"
                  className="p-button-outlined"
                  onClick={() => setActiveIndex(1)}
                />
              </div>
            )}
          </TabPanel>

          <TabPanel header="Audit Trails">
            <DataTable value={auditTrails} stripedRows loading={loading}>
              <Column field="referenceNo" header="Reference No" />
              <Column field="actionType" header="Action" />
              <Column field="previousValue" header="Previous Value" />
              <Column field="newValue" header="New Value" />
              <Column field="changedBy" header="Changed By" />
              <Column field="changeDate" body={dateBody("changeDate")} header="Date" />
              <Column field="ipAddress" header="IP Address" />
              <Column field="reason" header="Reason" />
            </DataTable>
          </TabPanel>

          <TabPanel header="System Logs">
            <div className="log-filters mb-3">
              <Dropdown
                placeholder="Log Level"
                value={logLevel}
                options={logLevelOptions}
                onChange={(e) => setLogLevel(e.value)}
                className="mr-2"
              />
              <InputText
                placeholder="Search logs..."
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="mr-2"
              />
              <Button label="Search" icon="pi pi-search" className="p-button-secondary" onClick={loadHistory} />
            </div>

            <DataTable value={visibleLogs} stripedRows className="log-table" loading={loading}>
              <Column field="timestamp" header="Timestamp" body={dateBody("timestamp")} style={{ width: '180px' }} />
              <Column field="level" header="Level" body={levelBodyTemplate} style={{ width: '80px' }} />
              <Column field="module" header="Module" style={{ width: '150px' }} />
              <Column field="message" header="Message" />
              <Column field="user" header="User" style={{ width: '120px' }} />
              <Column
                field="executionTime"
                header="Duration"
                style={{ width: '100px' }}
              />
            </DataTable>
          </TabPanel>

          <TabPanel header="Archive History">
            <DataTable value={archiveHistory} stripedRows emptyMessage="No archive runs recorded">
              <Column field="archiveDate" body={dateBody("archiveDate")} header="Archive Date" />
              <Column
                field="recordCount"
                header="Records"
                body={(data) => data.recordCount.toLocaleString(numberLocale())}
              />
              <Column field="dataSize" header="Data Size" />
              <Column field="archiveType" header="Type" />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="retentionPeriod" header="Retention" />
              <Column field="location" header="Location" />
            </DataTable>
          </TabPanel>

          <TabPanel header="Data Lineage">
            <div className="lineage-section">
              <h4>Transaction Lifecycle Timeline{lineageRecord ? ` - ${lineageRecord.referenceNo}` : ""}</h4>
              <div className="timeline-container">
                <Timeline
                  value={timelineEvents}
                  align="alternate"
                  className="customized-timeline"
                  marker={customizedMarker}
                  content={customizedContent}
                />
              </div>
            </div>
          </TabPanel>
        </TabView>
      </Card>

      <Dialog
        header="Transaction Details & History"
        visible={showDetailDialog}
        style={{ width: '80vw', height: '70vh' }}
        footer={detailDialogFooter}
        onHide={() => setShowDetailDialog(false)}
        maximizable
      >
        {selectedRecord && (
          <div className="record-details">
            <div className="detail-tabs">
              <TabView>
                <TabPanel header="Basic Information">
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Reference No:</label>
                      <span>{selectedRecord.referenceNo}</span>
                    </div>
                    <div className="detail-item">
                      <label>Type:</label>
                      <span>{selectedRecord.type}</span>
                    </div>
                    <div className="detail-item">
                      <label>Policy No:</label>
                      <span>{selectedRecord.policyNo}</span>
                    </div>
                    <div className="detail-item">
                      <label>Client:</label>
                      <span>{selectedRecord.clientName}</span>
                    </div>
                    <div className="detail-item">
                      <label>Amount:</label>
                      <span>{formatCurrency(selectedRecord.amount)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Status:</label>
                      <Tag value={selectedRecord.status} severity={statusSeverity(selectedRecord.status)} />
                    </div>
                  </div>
                </TabPanel>
                <TabPanel header="Change History">
                  <div className="change-history">
                    <Timeline
                      value={toTimeline(recordAudit)}
                      className="timeline-detailed"
                      marker={customizedMarker}
                      content={customizedContent}
                    />
                  </div>
                </TabPanel>
                <TabPanel header="Version Comparison">
                  <div className="version-comparison">
                    <div className="comparison-grid">
                      <div className="version-column">
                        <h5>Before{latestChange ? ` (${latestChange.actionType})` : ""}</h5>
                        <div className="version-data">
                          <div className="data-item">
                            <label>Status:</label>
                            <span className="old-value">{latestChange?.previousValue || "-"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="version-column">
                        <h5>Version {selectedRecord.version} (Current)</h5>
                        <div className="version-data">
                          <div className="data-item">
                            <label>Amount:</label>
                            <span className="new-value">{formatCurrency(selectedRecord.amount)}</span>
                          </div>
                          <div className="data-item">
                            <label>Status:</label>
                            <span className="new-value">{selectedRecord.status}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabPanel>
              </TabView>
            </div>
          </div>
        )}
      </Dialog>

      <Dialog
        header="Audit Trail Details"
        visible={showAuditDialog}
        style={{ width: '70vw' }}
        footer={auditDialogFooter}
        onHide={() => setShowAuditDialog(false)}
      >
        {selectedAuditTrail && (
          <div className="audit-details">
            <div className="audit-summary">
              <h4>Audit Summary for {selectedAuditTrail.referenceNo}</h4>
              <div className="audit-metrics">
                <div className="metric">
                  <span className="metric-label">Total Changes:</span>
                  <span className="metric-value">{selectedAudit.length}</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Contributors:</span>
                  <span className="metric-value">{new Set(selectedAudit.map((a) => a.changedBy)).size} users</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Date Range:</span>
                  <span className="metric-value">{auditDates.length ? `${auditDates[0]} to ${auditDates[auditDates.length - 1]}` : "-"}</span>
                </div>
              </div>
            </div>
            <DataTable value={selectedAudit} stripedRows>
              <Column field="actionType" header="Action" />
              <Column field="previousValue" header="Previous" />
              <Column field="newValue" header="New" />
              <Column field="changedBy" header="By" />
              <Column field="changeDate" body={dateBody("changeDate")} header="Date" />
              <Column field="reason" header="Reason" />
            </DataTable>
          </div>
        )}
      </Dialog>

      <Tooltip target=".p-button" />
    </div>
  );
};

export default RemittanceHistory;