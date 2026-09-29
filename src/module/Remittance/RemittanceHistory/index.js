import React, { useState } from "react";
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
import { Avatar } from "primereact/avatar";
import { Badge } from "primereact/badge";
import { Tooltip } from "primereact/tooltip";
import { TreeTable } from "primereact/treetable";
import { useNavigate } from "react-router-dom";
import "./index.scss";

const RemittanceHistory = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRows, setSelectedRows] = useState([]);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showAuditDialog, setShowAuditDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedAuditTrail, setSelectedAuditTrail] = useState(null);
  const [filterDateRange, setFilterDateRange] = useState(null);
  const [filterType, setFilterType] = useState("All");
  const [filterUser, setFilterUser] = useState("All");

  const transactionHistory = [
    {
      id: 1,
      referenceNo: "TRF20250926001",
      type: "Electronic Transfer",
      policyNo: "POL123456789",
      clientName: "ABC Insurance Co",
      amount: 125000,
      status: "Completed",
      createdBy: "John Smith",
      createdDate: "2025-09-26 10:30",
      lastModified: "2025-09-26 15:45",
      modifiedBy: "Sarah Johnson",
      version: 3,
      hasAuditTrail: true
    },
    {
      id: 2,
      referenceNo: "SET20250926002",
      type: "Settlement",
      policyNo: "POL987654321",
      clientName: "XYZ Corp",
      amount: 87500,
      status: "Processing",
      createdBy: "Mike Wilson",
      createdDate: "2025-09-26 09:15",
      lastModified: "2025-09-26 14:20",
      modifiedBy: "Emily Brown",
      version: 2,
      hasAuditTrail: true
    },
    {
      id: 3,
      referenceNo: "ADJ20250925003",
      type: "Adjustment",
      policyNo: "POL456789123",
      clientName: "DEF Ltd",
      amount: -5000,
      status: "Approved",
      createdBy: "Lisa Anderson",
      createdDate: "2025-09-25 14:45",
      lastModified: "2025-09-25 16:30",
      modifiedBy: "Robert Chen",
      version: 4,
      hasAuditTrail: true
    }
  ];

  const auditTrails = [
    {
      id: 1,
      referenceNo: "TRF20250926001",
      actionType: "Status Change",
      previousValue: "Pending Approval",
      newValue: "Approved",
      changedBy: "Manager A",
      changeDate: "2025-09-26 15:45",
      ipAddress: "192.168.1.100",
      reason: "Approved after document verification",
      sessionId: "SES_123456"
    },
    {
      id: 2,
      referenceNo: "TRF20250926001",
      actionType: "Amount Modification",
      previousValue: "₱120,000",
      newValue: "₱125,000",
      changedBy: "Finance Head",
      changeDate: "2025-09-26 14:30",
      ipAddress: "192.168.1.105",
      reason: "Adjustment for additional fees",
      sessionId: "SES_789012"
    },
    {
      id: 3,
      referenceNo: "SET20250926002",
      actionType: "Created",
      previousValue: null,
      newValue: "Initial Creation",
      changedBy: "Mike Wilson",
      changeDate: "2025-09-26 09:15",
      ipAddress: "192.168.1.102",
      reason: "New settlement record created",
      sessionId: "SES_345678"
    }
  ];

  const systemLogs = [
    {
      id: 1,
      timestamp: "2025-09-26 16:30:15",
      level: "INFO",
      module: "Settlement Engine",
      message: "Settlement batch processing completed successfully",
      recordsProcessed: 1250,
      executionTime: "45.2s",
      user: "System"
    },
    {
      id: 2,
      timestamp: "2025-09-26 16:25:03",
      level: "WARNING",
      module: "Payment Processor",
      message: "Payment gateway response timeout, retrying...",
      recordsProcessed: 0,
      executionTime: "30.0s",
      user: "System"
    },
    {
      id: 3,
      timestamp: "2025-09-26 16:15:45",
      level: "ERROR",
      module: "Data Validator",
      message: "Invalid account number format detected in batch file",
      recordsProcessed: 0,
      executionTime: "2.1s",
      user: "Auto Validator"
    },
    {
      id: 4,
      timestamp: "2025-09-26 16:10:22",
      level: "INFO",
      module: "Report Generator",
      message: "Monthly commission report generated successfully",
      recordsProcessed: 5670,
      executionTime: "120.5s",
      user: "Scheduler"
    }
  ];

  const archiveHistory = [
    {
      id: 1,
      archiveDate: "2025-09-01",
      recordCount: 125000,
      dataSize: "2.4 GB",
      archiveType: "Automatic",
      status: "Completed",
      retentionPeriod: "7 Years",
      location: "Cloud Archive Tier 1"
    },
    {
      id: 2,
      archiveDate: "2025-08-01",
      recordCount: 118500,
      dataSize: "2.2 GB",
      archiveType: "Automatic",
      status: "Completed",
      retentionPeriod: "7 Years",
      location: "Cloud Archive Tier 1"
    },
    {
      id: 3,
      archiveDate: "2025-07-01",
      recordCount: 134200,
      dataSize: "2.6 GB",
      archiveType: "Manual",
      status: "Completed",
      retentionPeriod: "7 Years",
      location: "Cloud Archive Tier 2"
    }
  ];

  const timelineEvents = [
    {
      status: 'Created',
      date: '2025-09-26 10:30',
      icon: 'pi pi-plus',
      color: '#4CAF50',
      description: 'Transaction created by John Smith'
    },
    {
      status: 'Validated',
      date: '2025-09-26 11:15',
      icon: 'pi pi-check',
      color: '#2196F3',
      description: 'Data validation completed successfully'
    },
    {
      status: 'Modified',
      date: '2025-09-26 14:30',
      icon: 'pi pi-pencil',
      color: '#FF9800',
      description: 'Amount adjusted by Finance Head (+₱5,000)'
    },
    {
      status: 'Approved',
      date: '2025-09-26 15:45',
      icon: 'pi pi-verified',
      color: '#4CAF50',
      description: 'Approved by Manager A after document verification'
    }
  ];

  const typeOptions = [
    { label: "All", value: "All" },
    { label: "Electronic Transfer", value: "Electronic Transfer" },
    { label: "Settlement", value: "Settlement" },
    { label: "Adjustment", value: "Adjustment" },
    { label: "Bulk Processing", value: "Bulk Processing" }
  ];

  const userOptions = [
    { label: "All", value: "All" },
    { label: "John Smith", value: "John Smith" },
    { label: "Sarah Johnson", value: "Sarah Johnson" },
    { label: "Mike Wilson", value: "Mike Wilson" },
    { label: "Emily Brown", value: "Emily Brown" }
  ];

  const logLevelOptions = [
    { label: "All", value: "All" },
    { label: "INFO", value: "INFO" },
    { label: "WARNING", value: "WARNING" },
    { label: "ERROR", value: "ERROR" },
    { label: "DEBUG", value: "DEBUG" }
  ];

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Completed': return 'success';
        case 'Processing': return 'warning';
        case 'Approved': return 'success';
        case 'Rejected': return 'danger';
        case 'Pending': return 'info';
        default: return null;
      }
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
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

  const auditBodyTemplate = (rowData) => {
    return rowData.hasAuditTrail ? (
      <Button
        icon="pi pi-history"
        className="p-button-rounded p-button-text"
        tooltip="View Audit Trail"
        onClick={() => {
          setSelectedAuditTrail(rowData);
          setShowAuditDialog(true);
        }}
      />
    ) : (
      <span className="text-muted">No audit trail</span>
    );
  };

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
        />
        <Button
          icon="pi pi-download"
          className="p-button-rounded p-button-text"
          tooltip="Export"
        />
        <Button
          icon="pi pi-copy"
          className="p-button-rounded p-button-text"
          tooltip="Duplicate"
        />
      </div>
    );
  };

  const archiveActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="View Archive Details"
        />
        <Button
          icon="pi pi-download"
          className="p-button-rounded p-button-text"
          tooltip="Restore Archive"
        />
        <Button
          icon="pi pi-file-export"
          className="p-button-rounded p-button-text"
          tooltip="Export Archive"
        />
      </div>
    );
  };

  const handleBackToMaster = () => {
    navigate("/master/finance/remittance");
  };

  const handleExportHistory = () => {
    console.log("Exporting history data");
  };

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
            <small className="timeline-date">{item.date}</small>
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
              <div className="card-value">2.4M</div>
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
              <div className="card-value">156k</div>
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
              <div className="card-value">8.7 TB</div>
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
              <div className="card-value">99.9%</div>
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
            <Calendar
              value={filterDateRange}
              onChange={(e) => setFilterDateRange(e.value)}
              selectionMode="range"
              placeholder="Date Range"
              className="mr-2"
            />
            <Button label="Filter" icon="pi pi-filter" className="p-button-secondary" />
          </div>
        </div>

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header={<span>Transaction History <Badge value="1,245" className="ml-2" /></span>}>
            <DataTable
              value={transactionHistory}
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
                  return <span style={{ color }}>{"\u20B1"}{Math.abs(data.amount).toLocaleString()}</span>;
                }}
              />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="createdBy" header="Created By" />
              <Column field="createdDate" header="Created" />
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
                />
                <Button
                  label="Compare Versions"
                  icon="pi pi-clone"
                  className="p-button-outlined mr-2"
                  disabled={selectedRows.length !== 2}
                />
                <Button
                  label="View Audit Trails"
                  icon="pi pi-history"
                  className="p-button-outlined"
                />
              </div>
            )}
          </TabPanel>

          <TabPanel header="Audit Trails">
            <DataTable value={auditTrails} stripedRows>
              <Column field="referenceNo" header="Reference No" />
              <Column field="actionType" header="Action" />
              <Column field="previousValue" header="Previous Value" />
              <Column field="newValue" header="New Value" />
              <Column field="changedBy" header="Changed By" />
              <Column field="changeDate" header="Date" />
              <Column field="ipAddress" header="IP Address" />
              <Column field="reason" header="Reason" />
              <Column header="Actions" body={actionsBodyTemplate} />
            </DataTable>
          </TabPanel>

          <TabPanel header="System Logs">
            <div className="log-filters mb-3">
              <Dropdown
                placeholder="Log Level"
                options={logLevelOptions}
                className="mr-2"
              />
              <InputText
                placeholder="Search logs..."
                className="mr-2"
              />
              <Button label="Search" icon="pi pi-search" className="p-button-secondary" />
            </div>

            <DataTable value={systemLogs} stripedRows className="log-table">
              <Column field="timestamp" header="Timestamp" style={{ width: '180px' }} />
              <Column field="level" header="Level" body={levelBodyTemplate} style={{ width: '80px' }} />
              <Column field="module" header="Module" style={{ width: '150px' }} />
              <Column field="message" header="Message" />
              <Column field="user" header="User" style={{ width: '120px' }} />
              <Column
                field="executionTime"
                header="Duration"
                style={{ width: '100px' }}
              />
              <Column header="Actions" body={actionsBodyTemplate} style={{ width: '100px' }} />
            </DataTable>
          </TabPanel>

          <TabPanel header="Archive History">
            <DataTable value={archiveHistory} stripedRows>
              <Column field="archiveDate" header="Archive Date" />
              <Column
                field="recordCount"
                header="Records"
                body={(data) => data.recordCount.toLocaleString()}
              />
              <Column field="dataSize" header="Data Size" />
              <Column field="archiveType" header="Type" />
              <Column field="status" header="Status" body={statusBodyTemplate} />
              <Column field="retentionPeriod" header="Retention" />
              <Column field="location" header="Location" />
              <Column header="Actions" body={archiveActionsTemplate} />
            </DataTable>
          </TabPanel>

          <TabPanel header="Data Lineage">
            <div className="lineage-section">
              <h4>Transaction Lifecycle Timeline</h4>
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
                      <span>{"\u20B1"}{selectedRecord.amount?.toLocaleString()}</span>
                    </div>
                    <div className="detail-item">
                      <label>Status:</label>
                      <Tag value={selectedRecord.status} severity={statusBodyTemplate(selectedRecord).props.severity} />
                    </div>
                  </div>
                </TabPanel>
                <TabPanel header="Change History">
                  <div className="change-history">
                    <Timeline
                      value={timelineEvents}
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
                        <h5>Version 2</h5>
                        <div className="version-data">
                          <div className="data-item">
                            <label>Amount:</label>
                            <span className="old-value">₱120,000</span>
                          </div>
                          <div className="data-item">
                            <label>Status:</label>
                            <span className="old-value">Pending Approval</span>
                          </div>
                        </div>
                      </div>
                      <div className="version-column">
                        <h5>Version 3 (Current)</h5>
                        <div className="version-data">
                          <div className="data-item">
                            <label>Amount:</label>
                            <span className="new-value">₱125,000</span>
                          </div>
                          <div className="data-item">
                            <label>Status:</label>
                            <span className="new-value">Approved</span>
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
                  <span className="metric-value">12</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Contributors:</span>
                  <span className="metric-value">5 users</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Date Range:</span>
                  <span className="metric-value">2025-09-26 to 2025-09-26</span>
                </div>
              </div>
            </div>
            <DataTable value={auditTrails.filter(a => a.referenceNo === selectedAuditTrail.referenceNo)} stripedRows>
              <Column field="actionType" header="Action" />
              <Column field="previousValue" header="Previous" />
              <Column field="newValue" header="New" />
              <Column field="changedBy" header="By" />
              <Column field="changeDate" header="Date" />
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