import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Checkbox } from "primereact/checkbox";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { masterService } from "../../../../services/remittanceService";
import { showError } from "../../../Remittance/shared";
import { MASTER_HOME, saveRecord } from "../masterRecord";
import "./index.scss";

import { numberLocale } from "../../../../utility/currencyConverter";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";
const TYPE = "remittance-history-config";

const HistoryConfiguration = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mode } = useParams();
  const isViewMode = mode === "view";
  const toast = React.useRef(null);
  const location = useLocation();
  const [record, setRecord] = useState(location.state?.data || null);

  // History retention settings from mock data
  const [retentionSettings, setRetentionSettings] = useState({
    transactionHistory: 0,
    systemLogs: 0,
    auditTrails: 0,
    reportHistory: 0,
    documentStorage: 0,
    backupRetention: 0
  });

  // Archive settings from mock data
  const [archiveSettings, setArchiveSettings] = useState({
    autoArchive: false,
    archiveThreshold: 90,
    compressionEnabled: false,
    archiveLocation: "",
    archiveFormat: "Compressed",
    encryptionEnabled: false
  });

  // Loads the history configuration record (the one opened from the overview, else the first one).
  useEffect(() => {
    const apply = (cfg) => {
      if (!cfg) return;
      setRecord(cfg);
      const r = cfg.retention || {};
      setRetentionSettings((prev) => ({
        ...prev,
        transactionHistory: (r.transactionHistory || 0) / 12,
        systemLogs: (r.errorLogs || 0) / 12,
        auditTrails: (r.auditLogs || 0) / 12,
        documentStorage: (r.documentHistory || 0) / 12,
        ...(cfg.retentionYears || {})
      }));
      const a = cfg.archival || {};
      setArchiveSettings((prev) => ({
        ...prev,
        autoArchive: Boolean(a.enabled),
        compressionEnabled: Boolean(a.compression),
        encryptionEnabled: Boolean(a.encryption),
        archiveLocation: a.storageLocation || "",
        archiveThreshold: a.thresholdDays ?? prev.archiveThreshold,
        archiveFormat: a.format || prev.archiveFormat
      }));
      if (cfg.historyTracking) setHistoryTracking(cfg.historyTracking);
      if (cfg.purgingRules) setPurgingRules(cfg.purgingRules);
    };
    if (record) apply(record);
    else masterService.list(TYPE).then((rows) => apply((rows || [])[0])).catch((error) => showError(toast, error));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // History tracking configuration
  const [historyTracking, setHistoryTracking] = useState([
    {
      id: 1,
      category: "Transaction Processing",
      entityType: "Remittance Transaction",
      trackChanges: true,
      includeUserDetails: true,
      includeTimestamp: true,
      retentionPeriod: "7 Years",
      priority: "High"
    },
    {
      id: 2,
      category: "Settlement Operations",
      entityType: "Settlement Record",
      trackChanges: true,
      includeUserDetails: true,
      includeTimestamp: true,
      retentionPeriod: "5 Years",
      priority: "High"
    },
    {
      id: 3,
      category: "Master Data Changes",
      entityType: "Configuration Change",
      trackChanges: true,
      includeUserDetails: true,
      includeTimestamp: true,
      retentionPeriod: "10 Years",
      priority: "Critical"
    },
    {
      id: 4,
      category: "User Actions",
      entityType: "User Activity",
      trackChanges: false,
      includeUserDetails: true,
      includeTimestamp: true,
      retentionPeriod: "2 Years",
      priority: "Medium"
    },
    {
      id: 5,
      category: "System Operations",
      entityType: "System Event",
      trackChanges: true,
      includeUserDetails: false,
      includeTimestamp: true,
      retentionPeriod: "1 Year",
      priority: "Low"
    }
  ]);

  // Data purging rules
  const [purgingRules, setPurgingRules] = useState([
    {
      id: 1,
      ruleName: "Old Transaction Purge",
      condition: "Age > 7 Years AND Status = Completed",
      frequency: "Quarterly",
      lastRun: "2025-09-01",
      recordsAffected: 50000,
      status: "Active"
    },
    {
      id: 2,
      ruleName: "Draft Record Cleanup",
      condition: "Status = Draft AND Age > 6 Months",
      frequency: "Monthly",
      lastRun: "2025-09-15",
      recordsAffected: 1200,
      status: "Active"
    },
    {
      id: 3,
      ruleName: "Temporary File Purge",
      condition: "File Type = Temporary AND Age > 30 Days",
      frequency: "Weekly",
      lastRun: "2025-09-20",
      recordsAffected: 8500,
      status: "Active"
    }
  ]);


  const archiveLocationOptions = [
    { label: "Cloud Storage", value: "Cloud Storage" },
    { label: "Local Archive", value: "Local Archive" },
    { label: "Hybrid Storage", value: "Hybrid Storage" }
  ];

  const archiveFormatOptions = [
    { label: "Compressed", value: "Compressed" },
    { label: "Standard", value: "Standard" },
    { label: "Encrypted", value: "Encrypted" }
  ];



  const priorityBodyTemplate = (rowData) => {
    const getSeverity = (priority) => {
      switch (priority) {
        case 'Critical': return 'danger';
        case 'High': return 'warning';
        case 'Medium': return 'info';
        case 'Low': return 'success';
        default: return null;
      }
    };
    return <Tag value={rowData.priority} severity={getSeverity(rowData.priority)} />;
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      return status === 'Active' ? 'success' : 'secondary';
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const booleanBodyTemplate = (field) => (rowData) => {
    return <Checkbox checked={rowData[field]} disabled={isViewMode} />;
  };

  const trackingActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-pencil"
          className="p-button-rounded p-button-text"
          tooltip="Edit"
          disabled={isViewMode}
        />
        <Button
          icon="pi pi-cog"
          className="p-button-rounded p-button-text"
          tooltip="Configure"
          disabled={isViewMode}
        />
      </div>
    );
  };

  const purgeActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-play"
          className="p-button-rounded p-button-success p-button-text"
          tooltip="Run Now"
          disabled={isViewMode}
        />
        <Button
          icon="pi pi-pencil"
          className="p-button-rounded p-button-text"
          tooltip="Edit"
          disabled={isViewMode}
        />
        <Button
          icon="pi pi-pause"
          className="p-button-rounded p-button-warning p-button-text"
          tooltip="Pause"
          disabled={isViewMode}
        />
      </div>
    );
  };

  const handleSave = async () => {
    try {
      const months = (years) => Math.round(Number(years || 0) * 12);
      await saveRecord(TYPE, record?.id, {
        code: record?.code || "HIST-001",
        name: record?.name || "Remittance History Retention",
        retention: {
          transactionHistory: months(retentionSettings.transactionHistory),
          errorLogs: months(retentionSettings.systemLogs),
          auditLogs: months(retentionSettings.auditTrails),
          documentHistory: months(retentionSettings.documentStorage)
        },
        retentionYears: retentionSettings,
        archival: {
          ...(record?.archival || {}),
          enabled: archiveSettings.autoArchive,
          compression: archiveSettings.compressionEnabled,
          encryption: archiveSettings.encryptionEnabled,
          storageLocation: archiveSettings.archiveLocation,
          thresholdDays: archiveSettings.archiveThreshold,
          format: archiveSettings.archiveFormat
        },
        historyTracking,
        purgingRules
      });

      toast.current.show({
        severity: 'success',
        summary: 'Success',
        detail: 'History Configuration saved successfully',
        life: 3000
      });

      setTimeout(() => {
        navigate(MASTER_HOME);
      }, 1500);
    } catch (error) {
      showError(toast, error, 'Failed to save configuration');
    }
  };

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };


  const handleTestArchive = () => {
    toast.current.show({
      severity: archiveSettings.archiveLocation ? 'info' : 'warn',
      summary: 'Archive Configuration',
      detail: archiveSettings.archiveLocation ? `Archive location: ${archiveSettings.archiveLocation}` : 'No archive location configured',
      life: 4000
    });
  };

  return (
    <div className="history-configuration">
      <Toast ref={toast} />
      <div className="header-section">
        <h2>Remittance History Configuration - {mode?.charAt(0).toUpperCase() + mode?.slice(1)}</h2>
      </div>

      <Card>
        <TabView>
          <TabPanel header="Retention Settings">
            <div className="retention-section">
              <h3>Data Retention Periods</h3>
              <div className="retention-grid">
                <div className="retention-item">
                  <label>Transaction History</label>
                  <div className="retention-input">
                    <InputNumber
                      value={retentionSettings.transactionHistory}
                      onValueChange={(e) => setRetentionSettings({
                        ...retentionSettings,
                        transactionHistory: e.value
                      })}
                      disabled={isViewMode}
                      className="retention-number"
                    />
                    <span className="retention-unit">Years</span>
                  </div>
                  <small className="retention-description">
                    How long to keep completed transaction records
                  </small>
                </div>

                <div className="retention-item">
                  <label>System Logs</label>
                  <div className="retention-input">
                    <InputNumber
                      value={retentionSettings.systemLogs}
                      onValueChange={(e) => setRetentionSettings({
                        ...retentionSettings,
                        systemLogs: e.value
                      })}
                      disabled={isViewMode}
                      className="retention-number"
                    />
                    <span className="retention-unit">Years</span>
                  </div>
                  <small className="retention-description">
                    System operation and error log retention
                  </small>
                </div>

                <div className="retention-item">
                  <label>Audit Trails</label>
                  <div className="retention-input">
                    <InputNumber
                      value={retentionSettings.auditTrails}
                      onValueChange={(e) => setRetentionSettings({
                        ...retentionSettings,
                        auditTrails: e.value
                      })}
                      disabled={isViewMode}
                      className="retention-number"
                    />
                    <span className="retention-unit">Years</span>
                  </div>
                  <small className="retention-description">
                    User activity and change history
                  </small>
                </div>

                <div className="retention-item">
                  <label>Report History</label>
                  <div className="retention-input">
                    <InputNumber
                      value={retentionSettings.reportHistory}
                      onValueChange={(e) => setRetentionSettings({
                        ...retentionSettings,
                        reportHistory: e.value
                      })}
                      disabled={isViewMode}
                      className="retention-number"
                    />
                    <span className="retention-unit">Years</span>
                  </div>
                  <small className="retention-description">
                    Generated reports and output files
                  </small>
                </div>

                <div className="retention-item">
                  <label>Document Storage</label>
                  <div className="retention-input">
                    <InputNumber
                      value={retentionSettings.documentStorage}
                      onValueChange={(e) => setRetentionSettings({
                        ...retentionSettings,
                        documentStorage: e.value
                      })}
                      disabled={isViewMode}
                      className="retention-number"
                    />
                    <span className="retention-unit">Years</span>
                  </div>
                  <small className="retention-description">
                    Supporting documents and attachments
                  </small>
                </div>

                <div className="retention-item">
                  <label>Backup Retention</label>
                  <div className="retention-input">
                    <InputNumber
                      value={retentionSettings.backupRetention}
                      onValueChange={(e) => setRetentionSettings({
                        ...retentionSettings,
                        backupRetention: e.value
                      })}
                      disabled={isViewMode}
                      className="retention-number"
                    />
                    <span className="retention-unit">Years</span>
                  </div>
                  <small className="retention-description">
                    System backup files and recovery points
                  </small>
                </div>
              </div>

              <div className="compliance-note mt-4">
                <div className="note-header">
                  <i className="pi pi-info-circle" />
                  <strong>Compliance Information</strong>
                </div>
                <p>
                  These retention periods should comply with regulatory requirements and company policies.
                  Financial transaction records typically require minimum 7-year retention.
                </p>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Archive Settings">
            <div className="archive-section">
              <h3>Archive Configuration</h3>
              <div className="archive-config">
                <div className="config-row">
                  <div className="config-item">
                    <div className="field-checkbox">
                      <Checkbox
                        id="autoArchive"
                        checked={archiveSettings.autoArchive}
                        onChange={(e) => setArchiveSettings({
                          ...archiveSettings,
                          autoArchive: e.checked
                        })}
                        disabled={isViewMode}
                      />
                      <label htmlFor="autoArchive">Enable Automatic Archiving</label>
                    </div>
                    <small>Automatically move old records to archive storage</small>
                  </div>
                </div>

                <div className="config-row">
                  <div className="config-item">
                    <label>Archive Threshold (Days)</label>
                    <InputNumber
                      value={archiveSettings.archiveThreshold}
                      onValueChange={(e) => setArchiveSettings({
                        ...archiveSettings,
                        archiveThreshold: e.value
                      })}
                      disabled={isViewMode}
                      className="w-full"
                    />
                    <small>Move records to archive after this many days of inactivity</small>
                  </div>
                </div>

                <div className="config-row">
                  <div className="config-item">
                    <label>Archive Location</label>
                    <Dropdown
                      value={archiveSettings.archiveLocation}
                      options={archiveLocationOptions}
                      onChange={(e) => setArchiveSettings({
                        ...archiveSettings,
                        archiveLocation: e.value
                      })}
                      disabled={isViewMode}
                      className="w-full"
                    />
                  </div>
                  <div className="config-item">
                    <label>Archive Format</label>
                    <Dropdown
                      value={archiveSettings.archiveFormat}
                      options={archiveFormatOptions}
                      onChange={(e) => setArchiveSettings({
                        ...archiveSettings,
                        archiveFormat: e.value
                      })}
                      disabled={isViewMode}
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="config-row">
                  <div className="config-item">
                    <div className="field-checkbox">
                      <Checkbox
                        id="compressionEnabled"
                        checked={archiveSettings.compressionEnabled}
                        onChange={(e) => setArchiveSettings({
                          ...archiveSettings,
                          compressionEnabled: e.checked
                        })}
                        disabled={isViewMode}
                      />
                      <label htmlFor="compressionEnabled">Enable Compression</label>
                    </div>
                    <small>Compress archived data to save storage space</small>
                  </div>
                  <div className="config-item">
                    <div className="field-checkbox">
                      <Checkbox
                        id="encryptionEnabled"
                        checked={archiveSettings.encryptionEnabled}
                        onChange={(e) => setArchiveSettings({
                          ...archiveSettings,
                          encryptionEnabled: e.checked
                        })}
                        disabled={isViewMode}
                      />
                      <label htmlFor="encryptionEnabled">Enable Encryption</label>
                    </div>
                    <small>Encrypt archived data for security</small>
                  </div>
                </div>
              </div>

              {!isViewMode && (
                <div className="archive-actions mt-4">
                  <Button
                    label={t("remittance.testArchiveConfiguration")}
                    icon="pi pi-cog"
                    className="p-button-secondary"
                    onClick={handleTestArchive}
                  />
                  <Button
                    label={t("remittance.viewArchiveStorage")}
                    icon="pi pi-folder-open"
                    className="p-button-outlined ml-2"
                  />
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel header="History Tracking">
            <div className="tracking-section">
              <h3>Data Change Tracking</h3>
              <DataTable value={historyTracking} stripedRows className="tracking-table">
                <Column field="category" header="Category" style={{ width: '18%' }} />
                <Column field="entityType" header="Entity Type" style={{ width: '18%' }} />
                <Column
                  field="trackChanges"
                  header="Track Changes"
                  body={booleanBodyTemplate('trackChanges')}
                  style={{ width: '12%' }}
                />
                <Column
                  field="includeUserDetails"
                  header="User Details"
                  body={booleanBodyTemplate('includeUserDetails')}
                  style={{ width: '12%' }}
                />
                <Column
                  field="includeTimestamp"
                  header="Timestamp"
                  body={booleanBodyTemplate('includeTimestamp')}
                  style={{ width: '10%' }}
                />
                <Column field="retentionPeriod" header="Retention" style={{ width: '12%' }} />
                <Column field="priority" header="Priority" body={priorityBodyTemplate} style={{ width: '10%' }} />
                <Column header="Actions" body={trackingActionsTemplate} style={{ width: '8%' }} />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Data Purging">
            <div className="purging-section">
              <div className="section-header">
                <h3>Automated Data Purging Rules</h3>
                {!isViewMode && (
                  <Button
                    label={t("remittance.addRule")}
                    icon="pi pi-plus"
                    className="p-button-primary"
                    onClick={() => {
                      toast.current.show({
                        severity: 'info',
                        summary: 'Info',
                        detail: 'Add Purge Rule dialog would open here',
                        life: 3000
                      });
                    }}
                  />
                )}
              </div>

              <DataTable value={purgingRules} stripedRows>
                <Column field="ruleName" header="Rule Name" style={{ width: '20%' }} />
                <Column field="condition" header="Condition" style={{ width: '30%' }} />
                <Column field="frequency" header="Frequency" style={{ width: '12%' }} />
                <Column body={(row) => formatAppDate(row.lastRun)} field="lastRun" header="Last Run" style={{ width: '12%' }} />
                <Column
                  field="recordsAffected"
                  header="Records"
                  body={(data) => data.recordsAffected.toLocaleString(numberLocale())}
                  style={{ width: '10%' }}
                />
                <Column field="status" header="Status" body={statusBodyTemplate} style={{ width: '8%' }} />
                <Column header="Actions" body={purgeActionsTemplate} style={{ width: '12%' }} />
              </DataTable>

              <div className="purging-info mt-4">
                <div className="info-card warning">
                  <div className="info-header">
                    <i className="pi pi-exclamation-triangle" />
                    <strong>Data Purging Warning</strong>
                  </div>
                  <p>
                    Data purging is irreversible. Ensure proper backups are maintained before running purge operations.
                    Review compliance requirements before configuring purge rules.
                  </p>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Storage Analytics">
            <div className="analytics-section">
              <h3>Storage Usage Analytics</h3>
              <div className="storage-metrics">
                <Card className="metric-card">
                  <h4>Database Storage</h4>
                  <div className="metric-value">2.4 TB</div>
                  <div className="metric-trend positive">
                    <i className="pi pi-arrow-up" />
                    +12% this month
                  </div>
                </Card>

                <Card className="metric-card">
                  <h4>Archive Storage</h4>
                  <div className="metric-value">8.7 TB</div>
                  <div className="metric-trend positive">
                    <i className="pi pi-arrow-up" />
                    +5% this month
                  </div>
                </Card>

                <Card className="metric-card">
                  <h4>Growth Rate</h4>
                  <div className="metric-value">45 GB/day</div>
                  <div className="metric-trend neutral">
                    <i className="pi pi-minus" />
                    Stable
                  </div>
                </Card>

                <Card className="metric-card">
                  <h4>Purged Records</h4>
                  <div className="metric-value">1.2M</div>
                  <div className="metric-trend positive">
                    <i className="pi pi-check" />
                    This quarter
                  </div>
                </Card>
              </div>

              <div className="storage-breakdown mt-4">
                <h4>Storage Breakdown by Category</h4>
                <div className="breakdown-list">
                  <div className="breakdown-item">
                    <div className="category-info">
                      <span className="category-name">Transaction Records</span>
                      <span className="category-size">1.8 TB (75%)</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '75%' }} />
                    </div>
                  </div>
                  <div className="breakdown-item">
                    <div className="category-info">
                      <span className="category-name">System Logs</span>
                      <span className="category-size">0.4 TB (17%)</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '17%' }} />
                    </div>
                  </div>
                  <div className="breakdown-item">
                    <div className="category-info">
                      <span className="category-name">Documents</span>
                      <span className="category-size">0.15 TB (6%)</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '6%' }} />
                    </div>
                  </div>
                  <div className="breakdown-item">
                    <div className="category-info">
                      <span className="category-name">Other</span>
                      <span className="category-size">0.05 TB (2%)</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: '2%' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>
        </TabView>

        <div className="action-buttons mt-4">
          {!isViewMode && (
            <Button
              label={t("remittance.saveConfiguration")}
              icon="pi pi-save"
              className="p-button-primary mr-2"
              onClick={handleSave}
            />
          )}
          <Button
            label={isViewMode ? "Close" : "Cancel"}
            icon="pi pi-times"
            className="p-button-secondary"
            onClick={handleCancel}
          />
        </div>
      </Card>
    </div>
  );
};

export default HistoryConfiguration;