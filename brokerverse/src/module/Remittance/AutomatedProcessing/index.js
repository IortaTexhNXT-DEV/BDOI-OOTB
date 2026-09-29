import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Checkbox } from "primereact/checkbox";
import { Calendar } from "primereact/calendar";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { Tag } from "primereact/tag";
import { Toast } from "primereact/toast";
import { ConfirmDialog, confirmDialog } from "primereact/confirmdialog";
import { Dialog } from "primereact/dialog";
import { ProgressBar } from "primereact/progressbar";
import { Timeline } from "primereact/timeline";
import SvgDot from "../../../assets/icons/SvgDot";
import { mockRemittanceService } from "../../../services/mockRemittanceService";
import { automatedRemittanceData, mockCrudOperations } from "../../../services/mockData/remittanceMockData";
import "./index.scss";

const AutomatedRemittanceProcessing = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const [selectedRemittances, setSelectedRemittances] = useState([]);
  const [processingDate, setProcessingDate] = useState(new Date());
  const [overrideCutoff, setOverrideCutoff] = useState(false);
  const [sendNotifications, setSendNotifications] = useState(true);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState(0);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [processingHistory, setProcessingHistory] = useState([]);
  const [validationResults, setValidationResults] = useState(null);
  const [validationDialogVisible, setValidationDialogVisible] = useState(false);
  const toast = useRef(null);

  // Load data from mock data service
  const [configurations, setConfigurations] = useState(automatedRemittanceData.configurations);
  const [executionHistory, setExecutionHistory] = useState(automatedRemittanceData.executionHistory);
  const [scheduledRemittances, setScheduledRemittances] = useState(
    automatedRemittanceData.configurations.map((config, index) => ({
      id: config.id,
      scheduleCode: config.code,
      insurerName: config.code.includes('001') ? "Allianz Insurance" : "AXA Insurance",
      scheduledDate: new Date(config.nextRun),
      policyCount: Math.floor(Math.random() * 50) + 10,
      estimatedAmount: Math.floor(Math.random() * 100000) + 25000,
      status: config.status === "Active" ? "Ready" : "On Hold",
      frequency: config.frequency,
      includeTypes: config.includeTypes,
      excludeStatuses: config.excludeStatuses
    }))
  );

  const [headerData] = useState({
    currentDate: new Date(),
    lastRun: new Date("2025-09-25 14:30:00"),
    pendingCount: 3,
    currentUser: "John Doe"
  });

  const items = [
    { label: t("remittance.finance"), url: "#" },
    { label: t("remittance.remittance"), url: "#" },
    { label: t("remittance.automatedProcessing"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  const calculateSummary = () => {
    const total = selectedRemittances.reduce((acc, item) => acc + item.estimatedAmount, 0);
    const policies = selectedRemittances.reduce((acc, item) => acc + item.policyCount, 0);
    return {
      count: selectedRemittances.length,
      amount: total,
      policies: policies
    };
  };

  const handleValidate = async () => {
    if (selectedRemittances.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: t("remittance.noSelection"),
        detail: t("remittance.pleaseSelectRemittances"),
        life: 3000
      });
      return;
    }

    setLoading(true);
    try {
      const results = await mockRemittanceService.validateRemittances(selectedRemittances);
      setValidationResults(results);
      setValidationDialogVisible(true);

      if (results.invalidCount > 0) {
        toast.current.show({
          severity: 'warn',
          summary: t("remittance.validationComplete"),
          detail: t("remittance.itemsHaveValidationErrors", { count: results.invalidCount }),
          life: 4000
        });
      } else {
        toast.current.show({
          severity: 'success',
          summary: t("remittance.validationSuccessful"),
          detail: t("remittance.allSelectedItemsValid"),
          life: 3000
        });
      }
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("remittance.validationFailed"),
        detail: error.message,
        life: 4000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleProcessSelected = () => {
    if (selectedRemittances.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: t("remittance.noSelection"),
        detail: t("remittance.pleaseSelectOneRemittance"),
        life: 3000
      });
      return;
    }

    const totalAmount = selectedRemittances.reduce((sum, item) => sum + item.estimatedAmount, 0);

    confirmDialog({
      message: (
        <div>
          <p>{t("remittance.youAreAboutToProcess", { count: selectedRemittances.length })}</p>
          <p><strong>{t("remittance.totalAmount")} {formatCurrency(totalAmount)}</strong></p>
          <p>{t("remittance.processingDate")} {processingDate.toLocaleDateString()}</p>
          {overrideCutoff && <p style={{color: '#ef4444'}}>⚠ {t("remittance.cutoffOverrideEnabled")}</p>}
          <p>{t("remittance.doYouWantToContinue")}</p>
        </div>
      ),
      header: t("remittance.confirmProcessing"),
      icon: 'pi pi-exclamation-triangle',
      accept: () => processRemittances(),
      reject: () => {
        toast.current.show({
          severity: 'info',
          summary: t("remittance.cancelled"),
          detail: t("remittance.processingCancelled"),
          life: 2000
        });
      }
    });
  };

  const processRemittances = async () => {
    setProcessing(true);
    setProcessProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProcessProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Use mock CRUD operations
      const processResults = await Promise.all(
        selectedRemittances.map(async (remittance) => {
          return await mockCrudOperations.update('remittance', remittance.id, {
            status: 'Processing',
            processedDate: processingDate.toISOString(),
            processedBy: 'System Admin'
          });
        })
      );

      clearInterval(interval);
      setProcessProgress(100);

      const totalAmount = selectedRemittances.reduce((sum, item) => sum + item.estimatedAmount, 0);
      const processedIds = selectedRemittances.map(item => item.id);

      toast.current.show({
        severity: 'success',
        summary: t("remittance.processingComplete"),
        detail: t("remittance.successfullyProcessed", { count: selectedRemittances.length, amount: formatCurrency(totalAmount) }),
        life: 5000
      });

      // Clear selection after successful processing
      setSelectedRemittances([]);

      // Update the status of processed items
      setScheduledRemittances(prev =>
        prev.map(item => {
          if (processedIds.includes(item.id)) {
            return { ...item, status: 'Processing' };
          }
          return item;
        })
      );

      // Add to execution history
      const newHistoryEntry = {
        id: executionHistory.length + 1,
        configCode: 'MANUAL-' + new Date().getTime(),
        executionDate: processingDate.toISOString().split('T')[0],
        status: 'Success',
        recordsProcessed: selectedRemittances.length,
        totalAmount: totalAmount,
        duration: '2m 30s'
      };
      setExecutionHistory(prev => [newHistoryEntry, ...prev]);

    } catch (error) {
      clearInterval(interval);
      toast.current.show({
        severity: 'error',
        summary: t("remittance.processingFailed"),
        detail: error.message || t("remittance.errorDuringProcessing"),
        life: 5000
      });
    } finally {
      setProcessing(false);
      setTimeout(() => setProcessProgress(0), 1000);
    }
  };

  const handleScheduleLater = () => {
    if (selectedRemittances.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: t("remittance.noSelection"),
        detail: t("remittance.pleaseSelectRemittancesToSchedule"),
        life: 3000
      });
      return;
    }

    confirmDialog({
      message: t("remittance.scheduleRemittancesFor", { count: selectedRemittances.length, date: processingDate.toLocaleDateString() }),
      header: t("remittance.scheduleProcessing"),
      icon: 'pi pi-clock',
      accept: () => {
        toast.current.show({
          severity: 'info',
          summary: t("remittance.scheduled"),
          detail: t("remittance.remittancesScheduledFor", { count: selectedRemittances.length, date: processingDate.toLocaleDateString() }),
          life: 4000
        });
        setSelectedRemittances([]);
      }
    });
  };

  const handleViewHistory = async () => {
    setLoading(true);
    try {
      // Use data from mock service
      const history = executionHistory.map(item => ({
        batchId: item.configCode,
        status: item.status === 'Success' ? 'Completed' : 'Failed',
        processedBy: 'System Admin',
        processedAt: new Date(item.executionDate + 'T10:00:00'),
        itemCount: item.recordsProcessed,
        totalAmount: item.totalAmount,
        duration: item.duration
      }));
      setProcessingHistory(history);
      setHistoryVisible(true);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("common.error"),
        detail: t("remittance.failedToLoadProcessingHistory"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const statusBodyTemplate = (rowData) => {
    const getSeverity = (status) => {
      switch (status) {
        case 'Ready': return 'success';
        case 'Processing': return 'info';
        case 'On Hold': return 'warning';
        case 'Error': return 'danger';
        default: return null;
      }
    };

    return <Tag value={rowData.status} severity={getSeverity(rowData.status)} />;
  };

  const dateBodyTemplate = (rowData) => {
    return rowData.scheduledDate.toLocaleDateString();
  };

  const amountBodyTemplate = (rowData) => {
    return formatCurrency(rowData.estimatedAmount);
  };

  const summary = calculateSummary();

  const historyTemplate = (item) => {
    return (
      <Card>
        <div className="history-item">
          <div className="history-header">
            <span className="batch-id">{item.batchId}</span>
            <Tag severity={item.status === 'Completed' ? 'success' : item.status === 'Failed' ? 'danger' : 'warning'}
                 value={item.status} />
          </div>
          <div className="history-details">
            <p><i className="pi pi-user"></i> {item.processedBy}</p>
            <p><i className="pi pi-calendar"></i> {item.processedAt.toLocaleString()}</p>
            <p><i className="pi pi-file"></i> {item.itemCount} items</p>
            <p><i className="pi pi-wallet"></i> {formatCurrency(item.totalAmount)}</p>
            <p><i className="pi pi-clock"></i> {item.duration}</p>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="container__automated__processing__master">
      <Toast ref={toast} position="top-right" />
      <ConfirmDialog />
        <div className="top__container">
          <h1 className="page__title">{t("remittance.automatedProcessing")}</h1>
          <BreadCrumb model={items} home={home} />

          <div className="info-bar">
            <div className="info-item">
              <span className="label">Current Date</span>
              <span className="value">{headerData.currentDate.toLocaleDateString()}</span>
            </div>
            <div className="info-item">
              <span className="label">Last Run</span>
              <span className="value">{headerData.lastRun.toLocaleString()}</span>
            </div>
            <div className="info-item highlight">
              <span className="label">Pending Batches</span>
              <span className="value">{headerData.pendingCount}</span>
            </div>
            <div className="info-item">
              <span className="label">User</span>
              <span className="value">{headerData.currentUser}</span>
            </div>
          </div>
        </div>

        <div className="content-container">
          <div className="main-content">
          <div className="left-panel">
            <Card title="Scheduled Remittances">
              <DataTable
                value={scheduledRemittances}
                selection={selectedRemittances}
                onSelectionChange={(e) => setSelectedRemittances(e.value)}
                dataKey="id"
                className="remittance-table"
                stripedRows
              >
                <Column selectionMode="multiple" style={{ width: '3rem' }} />
                <Column field="scheduleCode" header="Schedule Code" style={{ width: '15%' }} />
                <Column field="insurerName" header="Insurer" style={{ width: '25%' }} />
                <Column body={dateBodyTemplate} header="Scheduled For" style={{ width: '15%' }} />
                <Column field="policyCount" header="Policies" style={{ width: '10%', textAlign: 'center' }} />
                <Column body={amountBodyTemplate} header="Est. Amount" style={{ width: '15%', textAlign: 'right' }} />
                <Column body={statusBodyTemplate} header="Status" style={{ width: '15%' }} />
              </DataTable>
            </Card>
          </div>

          <div className="right-panel">
            <Card title="Execution Details">
              <div className="summary-section">
                <h4>Selected Summary</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <label>Total Selected</label>
                    <span className="value">{summary.count}</span>
                  </div>
                  <div className="summary-item">
                    <label>Total Amount</label>
                    <span className="value amount">
                      {formatCurrency(summary.amount)}
                    </span>
                  </div>
                  <div className="summary-item">
                    <label>Total Policies</label>
                    <span className="value">{summary.policies}</span>
                  </div>
                </div>
              </div>

              <div className="options-section">
                <h4>Processing Options</h4>
                <div className="form-field">
                  <label htmlFor="processingDate">Processing Date</label>
                  <Calendar
                    id="processingDate"
                    value={processingDate}
                    onChange={(e) => setProcessingDate(e.value)}
                    dateFormat="mm/dd/yy"
                    className="full-width"
                  />
                </div>

                <div className="checkbox-field">
                  <Checkbox
                    inputId="overrideCutoff"
                    checked={overrideCutoff}
                    onChange={(e) => setOverrideCutoff(e.checked)}
                  />
                  <label htmlFor="overrideCutoff">Override Cut-off</label>
                </div>

                <div className="checkbox-field">
                  <Checkbox
                    inputId="sendNotifications"
                    checked={sendNotifications}
                    onChange={(e) => setSendNotifications(e.checked)}
                  />
                  <label htmlFor="sendNotifications">Send Notifications</label>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <div className="action-section">
          <Button
            label="Validate"
            icon="pi pi-check"
            className="p-button-secondary"
            onClick={handleValidate}
          />
          <Button
            label="Process Selected"
            icon="pi pi-play"
            className="p-button-primary"
            onClick={handleProcessSelected}
            disabled={selectedRemittances.length === 0}
          />
          <Button
            label="Schedule for Later"
            icon="pi pi-clock"
            className="p-button-secondary"
            onClick={handleScheduleLater}
            disabled={selectedRemittances.length === 0}
          />
          <Button
            label="View History"
            icon="pi pi-history"
            className="p-button-text"
            onClick={handleViewHistory}
          />
        </div>
        </div>

        {/* Processing Progress Overlay */}
        {processing && (
          <div className="processing-overlay">
            <Card className="processing-card">
              <h3>Processing Remittances...</h3>
              <ProgressBar value={processProgress} showValue={true} />
              <p className="processing-message">
                {processProgress < 30 && 'Initializing...'}
                {processProgress >= 30 && processProgress < 60 && 'Validating data...'}
                {processProgress >= 60 && processProgress < 90 && 'Processing transactions...'}
                {processProgress >= 90 && 'Finalizing...'}
              </p>
            </Card>
          </div>
        )}

        {/* History Dialog */}
        <Dialog
          header="Processing History"
          visible={historyVisible}
          style={{ width: '70vw' }}
          onHide={() => setHistoryVisible(false)}
          maximizable
        >
          <Timeline
            value={processingHistory}
            content={historyTemplate}
            className="processing-timeline"
          />
        </Dialog>

        {/* Validation Results Dialog */}
        <Dialog
          header="Validation Results"
          visible={validationDialogVisible}
          style={{ width: '50vw' }}
          onHide={() => setValidationDialogVisible(false)}
        >
          {validationResults && (
            <div className="validation-results">
              <div className="validation-summary">
                <div className="summary-item">
                  <i className="pi pi-check-circle" style={{color: 'green'}}></i>
                  <span>Valid: {validationResults.validCount}</span>
                </div>
                <div className="summary-item">
                  <i className="pi pi-times-circle" style={{color: 'red'}}></i>
                  <span>Invalid: {validationResults.invalidCount}</span>
                </div>
              </div>
              {validationResults.results && validationResults.results.filter(r => !r.valid).length > 0 && (
                <div className="validation-errors">
                  <h4>Validation Errors:</h4>
                  {validationResults.results.filter(r => !r.valid).map(result => (
                    <div key={result.id} className="error-item">
                      <strong>{result.code}:</strong>
                      <ul>
                        {result.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Dialog>
      </div>
  );
};

export default AutomatedRemittanceProcessing;