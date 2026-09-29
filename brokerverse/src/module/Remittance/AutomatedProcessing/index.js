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
import remittanceService from "../../../services/remittanceService";
import authService from "../../../services/authService";
import { calendarDateFormat, formatDate, formatDateTime, isoDate, showError, statusSeverity } from "../shared";
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
  const [scheduledRemittances, setScheduledRemittances] = useState([]);
  const [executionHistory, setExecutionHistory] = useState([]);
  const toast = useRef(null);

  const headerData = {
    currentDate: new Date(),
    lastRun: executionHistory[0]?.executionDate ? new Date(executionHistory[0].executionDate) : null,
    pendingCount: scheduledRemittances.filter((r) => r.status === 'Ready').length,
    currentUser: authService.getUser()?.displayName || localStorage.getItem("USER_NAME") || ""
  };

  const items = [
    { label: t("remittance.finance"), url: "#" },
    { label: t("remittance.remittance"), url: "#" },
    { label: t("remittance.automatedProcessing"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  const loadData = async () => {
    setLoading(true);
    try {
      const [candidates, history] = await Promise.all([
        remittanceService.automatedCandidates(),
        remittanceService.automatedHistory()
      ]);
      setScheduledRemittances(candidates || []);
      setExecutionHistory(history || []);
    } catch (error) {
      showError(toast, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const calculateSummary = () => {
    const total = selectedRemittances.reduce((acc, item) => acc + Number(item.estimatedAmount || 0), 0);
    const policies = selectedRemittances.reduce((acc, item) => acc + Number(item.policyCount || 0), 0);
    return {
      count: selectedRemittances.length,
      amount: total,
      policies: policies
    };
  };

  const candidateValidation = (items) => {
    const results = items.map((item) => ({
      id: item.id,
      code: `${item.scheduleCode} / ${item.insurerName}`,
      valid: item.status === 'Ready',
      errors: item.status === 'Ready' ? [] : [item.status]
    }));
    return {
      totalValidated: results.length,
      validCount: results.filter((r) => r.valid).length,
      invalidCount: results.filter((r) => !r.valid).length,
      results
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
      const fresh = await remittanceService.automatedCandidates();
      setScheduledRemittances(fresh || []);
      const selectedIds = selectedRemittances.map((r) => r.id);
      const results = candidateValidation((fresh || []).filter((r) => selectedIds.includes(r.id)));
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
      showError(toast, error, t("remittance.validationFailed"));
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

    const totalAmount = selectedRemittances.reduce((sum, item) => sum + Number(item.estimatedAmount || 0), 0);

    confirmDialog({
      message: (
        <div>
          <p>{t("remittance.youAreAboutToProcess", { count: selectedRemittances.length })}</p>
          <p><strong>{t("remittance.totalAmount")} {formatCurrency(totalAmount)}</strong></p>
          <p>{t("remittance.processingDate")} {formatDate(processingDate)}</p>
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

  // Generate draft remittances for the selected candidates, validate them and submit the valid ones for approval.
  const processRemittances = async () => {
    setProcessing(true);
    setProcessProgress(10);
    try {
      const execution = await remittanceService.executeAutomated({ ids: selectedRemittances.map((r) => r.id) });
      setProcessProgress(40);
      const generatedIds = (execution.remittances || []).map((r) => r.id);
      const validation = generatedIds.length ? await remittanceService.validateRemittances(generatedIds) : { results: [] };
      setProcessProgress(70);
      const validIds = (validation.results || []).filter((r) => r.valid).map((r) => r.id);
      if (validIds.length) await remittanceService.processRemittances(validIds);
      setProcessProgress(100);

      toast.current.show({
        severity: 'success',
        summary: t("remittance.processingComplete"),
        detail: t("remittance.successfullyProcessed", { count: validIds.length, amount: formatCurrency(execution.totalAmount) }),
        life: 5000
      });
      if (validation.invalidCount) {
        setValidationResults(validation);
        setValidationDialogVisible(true);
      }
      setSelectedRemittances([]);
      await loadData();
    } catch (error) {
      showError(toast, error, t("remittance.processingFailed"));
    } finally {
      setProcessing(false);
      setTimeout(() => setProcessProgress(0), 1000);
    }
  };

  const createSchedules = async () => {
    const configs = [...new Map(selectedRemittances.map((r) => [r.scheduleCode, r])).values()];
    const day = isoDate(processingDate);
    await Promise.all(configs.map((c) => remittanceService.createSchedule({
      code: `SCH-${c.scheduleCode}-${day.replace(/-/g, '')}`,
      name: `${c.configName} (${day})`,
      type: 'Remittance Processing',
      frequency: c.frequency,
      nextRun: day,
      linkedProcesses: [c.scheduleCode]
    })));
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
      message: t("remittance.scheduleRemittancesFor", { count: selectedRemittances.length, date: formatDate(processingDate) }),
      header: t("remittance.scheduleProcessing"),
      icon: 'pi pi-clock',
      accept: async () => {
        try {
          await createSchedules();
          toast.current.show({
            severity: 'info',
            summary: t("remittance.scheduled"),
            detail: t("remittance.remittancesScheduledFor", { count: selectedRemittances.length, date: formatDate(processingDate) }),
            life: 4000
          });
          setSelectedRemittances([]);
        } catch (error) {
          showError(toast, error);
        }
      }
    });
  };

  const handleViewHistory = async () => {
    setLoading(true);
    try {
      const history = await remittanceService.processingHistory();
      setProcessingHistory(history || []);
      setHistoryVisible(true);
    } catch (error) {
      showError(toast, error, t("remittance.failedToLoadProcessingHistory"));
    } finally {
      setLoading(false);
    }
  };

  const statusBodyTemplate = (rowData) => {
    return <Tag value={rowData.status} severity={rowData.status === 'Ready' ? 'success' : statusSeverity(rowData.status)} />;
  };

  const dateBodyTemplate = (rowData) => {
    return formatDate(rowData.dueDate);
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
            <Tag severity={statusSeverity(item.status)} value={item.status} />
          </div>
          <div className="history-details">
            <p><i className="pi pi-user"></i> {item.processedBy}</p>
            <p><i className="pi pi-calendar"></i> {formatDateTime(item.processedAt)}</p>
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
              <span className="value">{formatDate(headerData.currentDate)}</span>
            </div>
            <div className="info-item">
              <span className="label">Last Run</span>
              <span className="value">{headerData.lastRun ? formatDate(headerData.lastRun) : "-"}</span>
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
                loading={loading}
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
                    dateFormat={calendarDateFormat()}
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