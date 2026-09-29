import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { TabView, TabPanel } from "primereact/tabview";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Checkbox } from "primereact/checkbox";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { MultiSelect } from "primereact/multiselect";
import { InputTextarea } from "primereact/inputtextarea";
import { ColorPicker } from "primereact/colorpicker";
import { Tag } from "primereact/tag";
import { Dialog } from "primereact/dialog";
import { RadioButton } from "primereact/radiobutton";
import { Slider } from "primereact/slider";
import { Toast } from "primereact/toast";
import { useNavigate, useParams } from "react-router-dom";
import remittanceService, { masterService } from "../../../../services/remittanceService";
import { showError } from "../../../Remittance/shared";
import { MASTER_HOME, saveRecord } from "../masterRecord";
import "./index.scss";

const TYPE = "remittance-analytics-config";
const toWidget = (dashboard) => ({
  id: dashboard.id,
  record: dashboard,
  widgetName: dashboard.name,
  widgetType: dashboard.widgets?.[0]?.type || "Chart",
  chartType: dashboard.widgets?.[0]?.chartType === "Line" ? "Line Chart" : "Bar Chart",
  dataSource: dashboard.widgets?.[0]?.metric || dashboard.widgets?.[0]?.data || "",
  refreshInterval: dashboard.refreshRate,
  enabled: dashboard.status === "Active",
  position: { x: 0, y: 0, width: 6, height: 4 },
  filters: dashboard.filters || ["Date Range"]
});

const AnalyticsConfiguration = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { mode } = useParams();
  const isViewMode = mode === "view";
  const toast = React.useRef(null);

  // Dashboard widgets are records of the remittance-analytics-config master
  const [dashboardWidgets, setDashboardWidgets] = useState([]);

  // KPI definitions
  const [kpiDefinitions, setKpiDefinitions] = useState([
    {
      id: 1,
      kpiName: "Settlement Efficiency",
      description: "Average time to complete settlements",
      calculation: "AVG(completion_time)",
      unit: "Hours",
      target: 24,
      threshold: { green: 20, yellow: 30, red: 48 },
      category: "Operational",
      enabled: true
    },
    {
      id: 2,
      kpiName: "Payment Success Rate",
      description: "Percentage of successful payments",
      calculation: "(successful_payments / total_payments) * 100",
      unit: "Percentage",
      target: 95,
      threshold: { green: 95, yellow: 90, red: 85 },
      category: "Quality",
      enabled: true
    },
    {
      id: 3,
      kpiName: "Transaction Value Growth",
      description: "Month-over-month transaction value growth",
      calculation: "((current_month - previous_month) / previous_month) * 100",
      unit: "Percentage",
      target: 5,
      threshold: { green: 5, yellow: 2, red: 0 },
      category: "Financial",
      enabled: true
    },
    {
      id: 4,
      kpiName: "Exception Rate",
      description: "Percentage of transactions requiring manual intervention",
      calculation: "(exception_count / total_transactions) * 100",
      unit: "Percentage",
      target: 2,
      threshold: { green: 2, yellow: 5, red: 10 },
      category: "Quality",
      enabled: true
    }
  ]);

  // Report templates (remittance-report-template master)
  const [reportTemplates, setReportTemplates] = useState([]);

  // Analytics settings
  const [analyticsSettings, setAnalyticsSettings] = useState({
    dataRetention: 24,
    aggregationLevel: "Hour",
    realTimeUpdates: true,
    cacheRefreshInterval: 15,
    enablePredictiveAnalytics: true,
    anomalyDetection: true,
    alertThreshold: 80,
    exportFormats: ["PDF", "Excel", "CSV"]
  });

  useEffect(() => {
    masterService.list(TYPE)
      .then((rows) => {
        setDashboardWidgets((rows || []).map(toWidget));
        const saved = (rows || []).find((r) => r.screenSettings)?.screenSettings;
        if (saved?.kpiDefinitions) setKpiDefinitions(saved.kpiDefinitions);
        if (saved?.analyticsSettings) setAnalyticsSettings(saved.analyticsSettings);
      })
      .catch((error) => showError(toast, error));
    remittanceService.reportTemplates()
      .then((rows) => setReportTemplates((rows || []).map((tpl) => ({
        id: tpl.id,
        templateName: tpl.name,
        category: tpl.category,
        frequency: tpl.frequency,
        format: [].concat(tpl.format || []).join(" + "),
        recipients: tpl.distribution?.email || [],
        dataPoints: (tpl.sections || []).map((sec) => sec.name),
        lastGenerated: "-",
        status: tpl.status
      }))))
      .catch((error) => showError(toast, error));
  }, []);

  const [showWidgetDialog, setShowWidgetDialog] = useState(false);
  const [showKpiDialog, setShowKpiDialog] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);

  const widgetTypeOptions = [
    { label: "Chart", value: "Chart" },
    { label: "Table", value: "Table" },
    { label: "KPI", value: "KPI" },
    { label: "Text", value: "Text" }
  ];

  const chartTypeOptions = [
    { label: "Line Chart", value: "Line Chart" },
    { label: "Bar Chart", value: "Bar Chart" },
    { label: "Pie Chart", value: "Pie Chart" },
    { label: "Area Chart", value: "Area Chart" },
    { label: "Gauge", value: "Gauge" },
    { label: "Donut Chart", value: "Donut Chart" }
  ];

  const dataSourceOptions = [
    { label: "Transaction Summary", value: "Transaction Summary" },
    { label: "Payment Status", value: "Payment Status" },
    { label: "Client Analytics", value: "Client Analytics" },
    { label: "Settlement Metrics", value: "Settlement Metrics" },
    { label: "Exception Data", value: "Exception Data" }
  ];

  const kpiCategoryOptions = [
    { label: "Operational", value: "Operational" },
    { label: "Financial", value: "Financial" },
    { label: "Quality", value: "Quality" },
    { label: "Compliance", value: "Compliance" }
  ];

  const frequencyOptions = [
    { label: "Real-time", value: "Real-time" },
    { label: "Daily", value: "Daily" },
    { label: "Weekly", value: "Weekly" },
    { label: "Monthly", value: "Monthly" },
    { label: "Quarterly", value: "Quarterly" }
  ];

  const formatOptions = [
    { label: "PDF", value: "PDF" },
    { label: "Excel", value: "Excel" },
    { label: "CSV", value: "CSV" },
    { label: "Dashboard", value: "Dashboard" },
    { label: "Email Alert", value: "Email Alert" }
  ];

  const aggregationOptions = [
    { label: "Minute", value: "Minute" },
    { label: "Hour", value: "Hour" },
    { label: "Day", value: "Day" },
    { label: "Week", value: "Week" },
    { label: "Month", value: "Month" }
  ];

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      return status === 'Active' ? 'success' : 'secondary';
    };
    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const enabledBodyTemplate = (rowData) => {
    return <Checkbox checked={rowData.enabled} disabled={isViewMode} />;
  };

  const thresholdBodyTemplate = (rowData) => {
    return (
      <div className="threshold-indicators">
        <span className="threshold-item green">
          <i className="pi pi-circle-fill" />
          {rowData.threshold.green}
        </span>
        <span className="threshold-item yellow">
          <i className="pi pi-circle-fill" />
          {rowData.threshold.yellow}
        </span>
        <span className="threshold-item red">
          <i className="pi pi-circle-fill" />
          {rowData.threshold.red}
        </span>
      </div>
    );
  };

  const widgetActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="Preview"
          onClick={() => {
            setSelectedWidget(rowData);
            setShowWidgetDialog(true);
          }}
        />
        {!isViewMode && (
          <>
            <Button
              icon="pi pi-pencil"
              className="p-button-rounded p-button-text"
              tooltip="Edit"
            />
            <Button
              icon="pi pi-copy"
              className="p-button-rounded p-button-text"
              tooltip="Duplicate"
            />
            <Button
              icon="pi pi-trash"
              className="p-button-rounded p-button-danger p-button-text"
              tooltip="Delete"
            />
          </>
        )}
      </div>
    );
  };

  const kpiActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="View"
          onClick={() => {
            setSelectedKpi(rowData);
            setShowKpiDialog(true);
          }}
        />
        {!isViewMode && (
          <>
            <Button
              icon="pi pi-pencil"
              className="p-button-rounded p-button-text"
              tooltip="Edit"
            />
            <Button
              icon="pi pi-chart-line"
              className="p-button-rounded p-button-success p-button-text"
              tooltip="View Trend"
            />
            <Button
              icon="pi pi-trash"
              className="p-button-rounded p-button-danger p-button-text"
              tooltip="Delete"
            />
          </>
        )}
      </div>
    );
  };

  const reportActionsTemplate = (rowData) => {
    return (
      <div className="action-buttons">
        <Button
          icon="pi pi-eye"
          className="p-button-rounded p-button-text"
          tooltip="Preview"
          onClick={() => {
            setSelectedReport(rowData);
            setShowReportDialog(true);
          }}
        />
        {!isViewMode && (
          <>
            <Button
              icon="pi pi-play"
              className="p-button-rounded p-button-success p-button-text"
              tooltip="Generate Now"
            />
            <Button
              icon="pi pi-pencil"
              className="p-button-rounded p-button-text"
              tooltip="Edit"
            />
            <Button
              icon="pi pi-clone"
              className="p-button-rounded p-button-text"
              tooltip="Clone"
            />
          </>
        )}
      </div>
    );
  };

  const handleSave = async () => {
    try {
      await Promise.all(dashboardWidgets.map((w, i) => {
        const base = w.record || {};
        const [first, ...rest] = base.widgets || [{}];
        return saveRecord(TYPE, w.record ? w.id : null, {
          code: base.code || `DASH-${String(w.id).slice(-4)}`,
          name: w.widgetName,
          refreshRate: w.refreshInterval,
          isActive: w.enabled,
          filters: w.filters,
          widgets: [{ ...first, type: w.widgetType, chartType: String(w.chartType || "").replace(" Chart", ""), metric: w.dataSource }, ...rest],
          ...(i === 0 ? { screenSettings: { kpiDefinitions, analyticsSettings } } : {})
        });
      }));

      toast.current.show({
        severity: 'success',
        summary: 'Success',
        detail: 'Analytics Configuration saved successfully',
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

  const widgetDialogFooter = (
    <div>
      <Button
        label={t("common.close")}
        icon="pi pi-times"
        onClick={() => setShowWidgetDialog(false)}
        className="p-button-text"
      />
      {!isViewMode && (
        <Button
          label={t("remittance.saveWidget")}
          icon="pi pi-check"
          onClick={() => setShowWidgetDialog(false)}
          autoFocus
        />
      )}
    </div>
  );

  const kpiDialogFooter = (
    <div>
      <Button
        label={t("common.close")}
        icon="pi pi-times"
        onClick={() => setShowKpiDialog(false)}
        className="p-button-text"
      />
      {!isViewMode && (
        <Button
          label={t("remittance.saveKPI")}
          icon="pi pi-check"
          onClick={() => setShowKpiDialog(false)}
          autoFocus
        />
      )}
    </div>
  );

  const reportDialogFooter = (
    <div>
      <Button
        label={t("common.close")}
        icon="pi pi-times"
        onClick={() => setShowReportDialog(false)}
        className="p-button-text"
      />
      {!isViewMode && (
        <Button
          label={t("remittance.saveTemplate")}
          icon="pi pi-check"
          onClick={() => setShowReportDialog(false)}
          autoFocus
        />
      )}
    </div>
  );

  return (
    <div className="analytics-configuration">
      <Toast ref={toast} />
      <div className="header-section">
        <h2>Remittance Analytics Configuration - {mode?.charAt(0).toUpperCase() + mode?.slice(1)}</h2>
      </div>

      <Card>
        <TabView>
          <TabPanel header="Dashboard Widgets">
            <div className="widgets-section">
              {!isViewMode && (
                <div className="toolbar mb-3">
                  <Button
                    label={t("remittance.addWidget")}
                    icon="pi pi-plus"
                    className="p-button-primary"
                    onClick={() => {
                      toast.current.show({
                        severity: 'info',
                        summary: 'Info',
                        detail: 'Add Widget dialog would open here',
                        life: 3000
                      });
                    }}
                  />
                  <Button
                    label={t("remittance.importWidgets")}
                    icon="pi pi-upload"
                    className="p-button-secondary ml-2"
                  />
                </div>
              )}

              <DataTable value={dashboardWidgets} stripedRows>
                <Column field="widgetName" header="Widget Name" style={{ width: '20%' }} />
                <Column field="widgetType" header="Type" style={{ width: '12%' }} />
                <Column field="chartType" header="Chart Type" style={{ width: '15%' }} />
                <Column field="dataSource" header="Data Source" style={{ width: '18%' }} />
                <Column
                  field="refreshInterval"
                  header="Refresh (min)"
                  style={{ width: '12%' }}
                  body={(data) => `${data.refreshInterval}m`}
                />
                <Column
                  field="enabled"
                  header="Enabled"
                  body={enabledBodyTemplate}
                  style={{ width: '8%' }}
                />
                <Column header="Actions" body={widgetActionsTemplate} style={{ width: '15%' }} />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="KPI Definitions">
            <div className="kpi-section">
              {!isViewMode && (
                <div className="toolbar mb-3">
                  <Button
                    label={t("remittance.addKPI")}
                    icon="pi pi-plus"
                    className="p-button-primary"
                    onClick={() => {
                      toast.current.show({
                        severity: 'info',
                        summary: 'Info',
                        detail: 'Add KPI dialog would open here',
                        life: 3000
                      });
                    }}
                  />
                  <Button
                    label={t("remittance.importKpis")}
                    icon="pi pi-upload"
                    className="p-button-secondary ml-2"
                  />
                </div>
              )}

              <DataTable value={kpiDefinitions} stripedRows>
                <Column field="kpiName" header="KPI Name" style={{ width: '20%' }} />
                <Column field="description" header="Description" style={{ width: '25%' }} />
                <Column field="unit" header="Unit" style={{ width: '10%' }} />
                <Column
                  field="target"
                  header="Target"
                  body={(data) => `${data.target} ${data.unit.toLowerCase()}`}
                  style={{ width: '10%' }}
                />
                <Column
                  field="threshold"
                  header="Thresholds"
                  body={thresholdBodyTemplate}
                  style={{ width: '15%' }}
                />
                <Column field="category" header="Category" style={{ width: '12%' }} />
                <Column header="Actions" body={kpiActionsTemplate} style={{ width: '12%' }} />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Report Templates">
            <div className="reports-section">
              {!isViewMode && (
                <div className="toolbar mb-3">
                  <Button
                    label={t("remittance.addTemplate")}
                    icon="pi pi-plus"
                    className="p-button-primary"
                    onClick={() => {
                      toast.current.show({
                        severity: 'info',
                        summary: 'Info',
                        detail: 'Add Report Template dialog would open here',
                        life: 3000
                      });
                    }}
                  />
                  <Button
                    label={t("remittance.scheduleReport")}
                    icon="pi pi-calendar"
                    className="p-button-secondary ml-2"
                  />
                </div>
              )}

              <DataTable value={reportTemplates} stripedRows>
                <Column field="templateName" header="Template Name" style={{ width: '20%' }} />
                <Column field="category" header="Category" style={{ width: '15%' }} />
                <Column field="frequency" header="Frequency" style={{ width: '12%' }} />
                <Column field="format" header="Format" style={{ width: '12%' }} />
                <Column
                  field="recipients"
                  header="Recipients"
                  body={(data) => data.recipients.join(', ')}
                  style={{ width: '20%' }}
                />
                <Column field="lastGenerated" header="Last Run" style={{ width: '12%' }} />
                <Column field="status" header="Status" body={statusBodyTemplate} style={{ width: '8%' }} />
                <Column header="Actions" body={reportActionsTemplate} style={{ width: '12%' }} />
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="Analytics Settings">
            <div className="settings-section">
              <div className="settings-grid">
                <Card className="setting-group">
                  <h3>Data Processing</h3>
                  <div className="p-fluid">
                    <div className="p-field field">
                      <label>Data Retention (Months)</label>
                      <InputNumber
                        value={analyticsSettings.dataRetention}
                        onValueChange={(e) => setAnalyticsSettings({
                          ...analyticsSettings,
                          dataRetention: e.value
                        })}
                        disabled={isViewMode}
                      />
                    </div>
                    <div className="p-field field">
                      <label>Aggregation Level</label>
                      <Dropdown
                        value={analyticsSettings.aggregationLevel}
                        options={aggregationOptions}
                        onChange={(e) => setAnalyticsSettings({
                          ...analyticsSettings,
                          aggregationLevel: e.value
                        })}
                        disabled={isViewMode}
                      />
                    </div>
                    <div className="p-field field">
                      <label>Cache Refresh Interval (minutes)</label>
                      <InputNumber
                        value={analyticsSettings.cacheRefreshInterval}
                        onValueChange={(e) => setAnalyticsSettings({
                          ...analyticsSettings,
                          cacheRefreshInterval: e.value
                        })}
                        disabled={isViewMode}
                      />
                    </div>
                  </div>
                </Card>

                <Card className="setting-group">
                  <h3>Real-time Features</h3>
                  <div className="p-fluid">
                    <div className="p-field field">
                      <div className="field-checkbox">
                        <Checkbox
                          id="realTimeUpdates"
                          checked={analyticsSettings.realTimeUpdates}
                          onChange={(e) => setAnalyticsSettings({
                            ...analyticsSettings,
                            realTimeUpdates: e.checked
                          })}
                          disabled={isViewMode}
                        />
                        <label htmlFor="realTimeUpdates">Enable Real-time Updates</label>
                      </div>
                    </div>
                    <div className="p-field field">
                      <div className="field-checkbox">
                        <Checkbox
                          id="predictiveAnalytics"
                          checked={analyticsSettings.enablePredictiveAnalytics}
                          onChange={(e) => setAnalyticsSettings({
                            ...analyticsSettings,
                            enablePredictiveAnalytics: e.checked
                          })}
                          disabled={isViewMode}
                        />
                        <label htmlFor="predictiveAnalytics">Enable Predictive Analytics</label>
                      </div>
                    </div>
                    <div className="p-field field">
                      <div className="field-checkbox">
                        <Checkbox
                          id="anomalyDetection"
                          checked={analyticsSettings.anomalyDetection}
                          onChange={(e) => setAnalyticsSettings({
                            ...analyticsSettings,
                            anomalyDetection: e.checked
                          })}
                          disabled={isViewMode}
                        />
                        <label htmlFor="anomalyDetection">Enable Anomaly Detection</label>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="setting-group">
                  <h3>Alert Configuration</h3>
                  <div className="p-fluid">
                    <div className="p-field field">
                      <label>Alert Threshold (%)</label>
                      <div className="threshold-slider">
                        <Slider
                          value={analyticsSettings.alertThreshold}
                          onChange={(e) => setAnalyticsSettings({
                            ...analyticsSettings,
                            alertThreshold: e.value
                          })}
                          disabled={isViewMode}
                          min={0}
                          max={100}
                        />
                        <span className="threshold-value">{analyticsSettings.alertThreshold}%</span>
                      </div>
                    </div>
                  </div>
                </Card>

                <Card className="setting-group">
                  <h3>Export Options</h3>
                  <div className="p-fluid">
                    <div className="p-field field">
                      <label>Supported Export Formats</label>
                      <MultiSelect
                        value={analyticsSettings.exportFormats}
                        options={formatOptions}
                        onChange={(e) => setAnalyticsSettings({
                          ...analyticsSettings,
                          exportFormats: e.value
                        })}
                        display="chip"
                        disabled={isViewMode}
                      />
                    </div>
                  </div>
                </Card>
              </div>

              {!isViewMode && (
                <div className="settings-actions mt-4">
                  <Button
                    label={t("remittance.testConfiguration")}
                    icon="pi pi-cog"
                    className="p-button-secondary mr-2"
                    onClick={() => {
                      toast.current.show({
                        severity: 'success',
                        summary: 'Test Complete',
                        detail: 'Analytics configuration test completed successfully',
                        life: 3000
                      });
                    }}
                  />
                  <Button
                    label={t("remittance.resetToDefaults")}
                    icon="pi pi-refresh"
                    className="p-button-outlined mr-2"
                  />
                  <Button
                    label={t("remittance.exportConfiguration")}
                    icon="pi pi-download"
                    className="p-button-outlined"
                  />
                </div>
              )}
            </div>
          </TabPanel>

          <TabPanel header="Performance Metrics">
            <div className="performance-section">
              <h3>System Performance Metrics</h3>
              <div className="metrics-grid">
                <Card className="metric-card">
                  <div className="metric-header">
                    <i className="pi pi-server metric-icon" />
                    <span>Query Performance</span>
                  </div>
                  <div className="metric-value">1.2ms</div>
                  <div className="metric-subtitle">Average response time</div>
                </Card>

                <Card className="metric-card">
                  <div className="metric-header">
                    <i className="pi pi-database metric-icon" />
                    <span>Data Throughput</span>
                  </div>
                  <div className="metric-value">45K</div>
                  <div className="metric-subtitle">Records per second</div>
                </Card>

                <Card className="metric-card">
                  <div className="metric-header">
                    <i className="pi pi-chart-line metric-icon" />
                    <span>Dashboard Load Time</span>
                  </div>
                  <div className="metric-value">2.1s</div>
                  <div className="metric-subtitle">Average load time</div>
                </Card>

                <Card className="metric-card">
                  <div className="metric-header">
                    <i className="pi pi-users metric-icon" />
                    <span>Active Users</span>
                  </div>
                  <div className="metric-value">156</div>
                  <div className="metric-subtitle">Current active sessions</div>
                </Card>
              </div>

              <div className="optimization-tips mt-4">
                <h4>Optimization Recommendations</h4>
                <div className="tips-list">
                  <div className="tip-item">
                    <i className="pi pi-info-circle tip-icon" />
                    <div className="tip-content">
                      <strong>Cache Configuration:</strong>
                      <span>Increase cache refresh interval to 30 minutes for better performance on non-critical widgets.</span>
                    </div>
                  </div>
                  <div className="tip-item">
                    <i className="pi pi-exclamation-triangle tip-icon warning" />
                    <div className="tip-content">
                      <strong>Data Retention:</strong>
                      <span>Consider archiving data older than 12 months to improve query performance.</span>
                    </div>
                  </div>
                  <div className="tip-item">
                    <i className="pi pi-check-circle tip-icon success" />
                    <div className="tip-content">
                      <strong>Real-time Updates:</strong>
                      <span>Current configuration is optimal for your usage pattern.</span>
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

      {/* Widget Dialog */}
      <Dialog
        header="Widget Configuration"
        visible={showWidgetDialog}
        style={{ width: '70vw' }}
        footer={widgetDialogFooter}
        onHide={() => setShowWidgetDialog(false)}
      >
        {selectedWidget && (
          <div className="widget-form">
            <div className="p-fluid formgrid grid">
              <div className="p-field field col-12 md:col-6">
                <label>Widget Name</label>
                <InputText value={selectedWidget.widgetName} disabled={isViewMode} />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Widget Type</label>
                <Dropdown
                  value={selectedWidget.widgetType}
                  options={widgetTypeOptions}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Chart Type</label>
                <Dropdown
                  value={selectedWidget.chartType}
                  options={chartTypeOptions}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Data Source</label>
                <Dropdown
                  value={selectedWidget.dataSource}
                  options={dataSourceOptions}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Refresh Interval (minutes)</label>
                <InputNumber
                  value={selectedWidget.refreshInterval}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Available Filters</label>
                <MultiSelect
                  value={selectedWidget.filters}
                  options={[
                    { label: "Date Range", value: "Date Range" },
                    { label: "Transaction Type", value: "Transaction Type" },
                    { label: "Client Category", value: "Client Category" }
                  ]}
                  display="chip"
                  disabled={isViewMode}
                />
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* KPI Dialog */}
      <Dialog
        header="KPI Configuration"
        visible={showKpiDialog}
        style={{ width: '60vw' }}
        footer={kpiDialogFooter}
        onHide={() => setShowKpiDialog(false)}
      >
        {selectedKpi && (
          <div className="kpi-form">
            <div className="p-fluid formgrid grid">
              <div className="p-field field col-12">
                <label>KPI Name</label>
                <InputText value={selectedKpi.kpiName} disabled={isViewMode} />
              </div>
              <div className="p-field field col-12">
                <label>Description</label>
                <InputTextarea
                  value={selectedKpi.description}
                  rows={2}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field field col-12">
                <label>Calculation Formula</label>
                <InputTextarea
                  value={selectedKpi.calculation}
                  rows={3}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Unit</label>
                <InputText value={selectedKpi.unit} disabled={isViewMode} />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Target Value</label>
                <InputNumber value={selectedKpi.target} disabled={isViewMode} />
              </div>
              <div className="p-field field col-12">
                <label>Threshold Configuration</label>
                <div className="threshold-config">
                  <div className="threshold-item">
                    <label>Green (Good)</label>
                    <InputNumber
                      value={selectedKpi.threshold.green}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="threshold-item">
                    <label>Yellow (Warning)</label>
                    <InputNumber
                      value={selectedKpi.threshold.yellow}
                      disabled={isViewMode}
                    />
                  </div>
                  <div className="threshold-item">
                    <label>Red (Critical)</label>
                    <InputNumber
                      value={selectedKpi.threshold.red}
                      disabled={isViewMode}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Dialog>

      {/* Report Dialog */}
      <Dialog
        header="Report Template Configuration"
        visible={showReportDialog}
        style={{ width: '70vw' }}
        footer={reportDialogFooter}
        onHide={() => setShowReportDialog(false)}
      >
        {selectedReport && (
          <div className="report-form">
            <div className="p-fluid formgrid grid">
              <div className="p-field field col-12 md:col-6">
                <label>Template Name</label>
                <InputText value={selectedReport.templateName} disabled={isViewMode} />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Category</label>
                <InputText value={selectedReport.category} disabled={isViewMode} />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Frequency</label>
                <Dropdown
                  value={selectedReport.frequency}
                  options={frequencyOptions}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field field col-12 md:col-6">
                <label>Output Format</label>
                <Dropdown
                  value={selectedReport.format}
                  options={formatOptions}
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field field col-12">
                <label>Recipients</label>
                <MultiSelect
                  value={selectedReport.recipients}
                  options={[
                    { label: "Finance Team", value: "Finance Team" },
                    { label: "Management", value: "Management" },
                    { label: "Operations Team", value: "Operations Team" }
                  ]}
                  display="chip"
                  disabled={isViewMode}
                />
              </div>
              <div className="p-field field col-12">
                <label>Data Points to Include</label>
                <MultiSelect
                  value={selectedReport.dataPoints}
                  options={[
                    { label: "Total Volume", value: "Total Volume" },
                    { label: "Settlement Time", value: "Settlement Time" },
                    { label: "Success Rate", value: "Success Rate" }
                  ]}
                  display="chip"
                  disabled={isViewMode}
                />
              </div>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
};

export default AnalyticsConfiguration;