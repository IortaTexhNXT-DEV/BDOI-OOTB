import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { Steps } from "primereact/steps";
import { Card } from "primereact/card";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { RadioButton } from "primereact/radiobutton";
import { MultiSelect } from "primereact/multiselect";
import { Checkbox } from "primereact/checkbox";
import { BreadCrumb } from "primereact/breadcrumb";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { InputText } from "primereact/inputtext";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import { ProgressBar } from "primereact/progressbar";
import { Message } from "primereact/message";
import remittanceService, { masterService } from "../../../services/remittanceService";
import { formatDateTime, isoMonth, loadInsurerOptions, showError, showSuccess } from "../shared";
import SvgDot from "../../../assets/icons/SvgDot";
import { DEFAULT_SYSTEM_SETTINGS } from "../../../utility/systemCurrencies";
import "./index.scss";

const EMAIL_PATTERN = /^[\w.-]+@([\w-]+\.)+[\w-]{2,}$/;
const splitEmails = (text) => String(text || "").split(",").map((e) => e.trim()).filter(Boolean);
const sum = (rows, field) => rows.reduce((s, r) => s + Number(r[field] || 0), 0);

const StatementGeneration = () => {
  const { t } = useTranslation();
  const { formatCurrency } = useFormatCurrency();
  const companyName = useSelector(
    (state) => state.systemSettingsReducer?.systemName || DEFAULT_SYSTEM_SETTINGS.systemName
  );
  const [activeStep, setActiveStep] = useState(0);
  const [statementType, setStatementType] = useState(null);
  const [period, setPeriod] = useState(new Date());
  const [selectionType, setSelectionType] = useState('all');
  const [selectedInsurers, setSelectedInsurers] = useState([]);
  const [outputFormats, setOutputFormats] = useState({ pdf: true, excel: false, xml: false });
  const [deliveryOptions, setDeliveryOptions] = useState({ download: true, email: false, archive: false });
  const [emailTemplate, setEmailTemplate] = useState(null);
  const [additionalRecipients, setAdditionalRecipients] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateProgress, setGenerateProgress] = useState(0);
  const [successDialog, setSuccessDialog] = useState(false);
  const [generatedFile, setGeneratedFile] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [insurerOptions, setInsurerOptions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const toast = useRef(null);

  const steps = [
    { label: t("remittance.selection") },
    { label: t("remittance.preview") },
    { label: t("remittance.generate") }
  ];

  useEffect(() => {
    loadInsurerOptions().then(setInsurerOptions).catch((e) => showError(toast, e));
    masterService.options("remittance-statement-template").then(setTemplates).catch((e) => showError(toast, e));
  }, []);

  const statementTypes = [
    { label: t("remittance.accountStatement"), value: "Account Statement" },
    { label: t("remittance.transactionReport"), value: "Transaction Report" },
    { label: t("remittance.monthlyStatement"), value: "monthly" },
    { label: t("remittance.quarterlyStatement"), value: "quarterly" },
    { label: t("remittance.annualStatement"), value: "annual" },
    { label: t("remittance.customStatement"), value: "custom" }
  ];

  const emailTemplates = templates.map(template => ({
    label: template.label,
    value: template.code
  }));

  // Load preview data when moving to preview step
  useEffect(() => {
    if (activeStep === 1) {
      loadPreviewData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep]);

  const insurerFilter = () => (selectionType === 'all' ? [] : selectedInsurers);

  const loadPreviewData = async () => {
    setLoadingPreview(true);
    try {
      const preview = await remittanceService.previewStatement({ period: isoMonth(period), insurers: insurerFilter() });
      const rows = (preview.rows || []).map((r) => ({ ...r, net: r.netAmount }));
      const totalTax = sum(rows, "tax");
      const totals = preview.totals || {};
      setPreviewData({
        policies: rows,
        summary: {
          totalPolicies: preview.totalRows,
          totalPremium: totals.premium ?? sum(rows, "premium"),
          totalCommission: (totals.premium ?? sum(rows, "premium")) - (totals.netAmount ?? sum(rows, "netAmount")) - totalTax,
          totalTax,
          netAmount: totals.netAmount ?? sum(rows, "netAmount")
        }
      });

      toast.current.show({
        severity: 'success',
        summary: t("remittance.previewLoaded"),
        detail: t("remittance.loadedPoliciesForPreview", { count: preview.totalRows }),
        life: 2000
      });
    } catch (error) {
      showError(toast, error, 'Preview Failed');
    } finally {
      setLoadingPreview(false);
    }
  };

  const items = [
    { label: "Finance", url: "#" },
    { label: "Remittance", url: "#" },
    { label: "Statements", url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  const validateStep = (step) => {
    const errors = [];

    if (step === 0) {
      if (!statementType) errors.push('Please select a statement type');
      if (!period) errors.push('Please select a period');
      if (selectionType === 'specific' && selectedInsurers.length === 0) {
        errors.push('Please select at least one insurer');
      }
    } else if (step === 2) {
      const hasFormat = outputFormats.pdf || outputFormats.excel || outputFormats.xml;
      const hasDelivery = deliveryOptions.download || deliveryOptions.email || deliveryOptions.archive;

      if (!hasFormat) errors.push('Please select at least one output format');
      if (!hasDelivery) errors.push('Please select at least one delivery option');

      if (deliveryOptions.email) {
        const invalidEmails = splitEmails(additionalRecipients).filter(e => !EMAIL_PATTERN.test(e));
        if (!splitEmails(additionalRecipients).length) errors.push('Please enter at least one recipient');
        if (invalidEmails.length > 0) {
          errors.push(`Invalid email addresses: ${invalidEmails.join(', ')}`);
        }
      }
    }

    setValidationErrors(errors);
    if (errors.length) {
      toast.current.show({ severity: 'error', summary: 'Validation Failed', detail: errors[0], life: 3000 });
    }
    return errors.length === 0;
  };

  const handleNext = () => {
    if (validateStep(activeStep) && activeStep < 2) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePrevious = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
      setValidationErrors([]);
    }
  };

  const handleGenerate = async () => {
    if (!validateStep(2)) return;

    confirmDialog({
      message: (
        <div>
          <p>Generate statement for {period.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}?</p>
          <p>Type: <strong>{statementTypes.find(t => t.value === statementType)?.label}</strong></p>
          <p>Policies: <strong>{previewData?.summary.totalPolicies || 0}</strong></p>
          <p>Net Amount: <strong>
            {formatCurrency(previewData?.summary.netAmount || 0)}
          </strong></p>
        </div>
      ),
      header: 'Confirm Generation',
      icon: 'pi pi-file',
      accept: () => generateStatement()
    });
  };

  const generateStatement = async () => {
    setGenerating(true);
    setGenerateProgress(30);
    try {
      const result = await remittanceService.generateStatement({
        period: isoMonth(period),
        statementType,
        selectionType,
        insurers: insurerFilter(),
        templateCode: emailTemplate || undefined,
        format: Object.keys(outputFormats).filter((k) => outputFormats[k]).join(","),
        emailTo: deliveryOptions.email ? splitEmails(additionalRecipients) : []
      });
      setGenerateProgress(100);
      setGeneratedFile(result);
      showSuccess(toast, `${result.statementId}: ${result.rowCount} line(s)`, 'Statement Generated');
      if (deliveryOptions.download) window.open(result.downloadUrl, "_blank", "noopener");
      setSuccessDialog(true);
    } catch (error) {
      showError(toast, error, 'Generation Failed');
    } finally {
      setGenerating(false);
      setGenerateProgress(0);
    }
  };

  const handleDownload = () => {
    if (generatedFile?.downloadUrl) window.open(generatedFile.downloadUrl, "_blank", "noopener");
    setSuccessDialog(false);
  };

  const handleEmail = async () => {
    try {
      await remittanceService.sendNotification({
        type: "Statement",
        subject: `Remittance statement ${generatedFile.period}`,
        content: `Your remittance statement is available: ${generatedFile.downloadUrl}`,
        recipients: splitEmails(additionalRecipients),
        channel: "Email",
        templateCode: emailTemplate || undefined
      });
      showSuccess(toast, 'Statement has been emailed to recipients', 'Email Sent');
    } catch (error) {
      showError(toast, error);
    }
  };

  const handleReset = () => {
    setActiveStep(0);
    setStatementType(null);
    setPeriod(new Date());
    setSelectionType('all');
    setSelectedInsurers([]);
    setOutputFormats({ pdf: true, excel: false, xml: false });
    setDeliveryOptions({ download: true, email: false, archive: false });
    setValidationErrors([]);
    setPreviewData(null);
    setSuccessDialog(false);
  };

  const amountBodyTemplate = (rowData, field) => {
    return formatCurrency(rowData[field]);
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Card title="Statement Parameters">
            <div className="step-content">
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="statementType" className="required">Statement Type</label>
                  <Dropdown
                    id="statementType"
                    value={statementType}
                    onChange={(e) => setStatementType(e.value)}
                    options={statementTypes}
                    placeholder="Select statement type"
                    className="full-width"
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="period" className="required">Period</label>
                  <Calendar
                    id="period"
                    value={period}
                    onChange={(e) => setPeriod(e.value)}
                    view="month"
                    dateFormat="mm/yy"
                    placeholder="Select period"
                    className="full-width"
                  />
                </div>
              </div>

              <div className="section-divider">
                <h4>Insurer Selection</h4>
              </div>

              <div className="radio-group">
                <div className="radio-option">
                  <RadioButton
                    inputId="all"
                    value="all"
                    onChange={(e) => setSelectionType(e.value)}
                    checked={selectionType === 'all'}
                  />
                  <label htmlFor="all">All Insurers</label>
                </div>
                <div className="radio-option">
                  <RadioButton
                    inputId="specific"
                    value="specific"
                    onChange={(e) => setSelectionType(e.value)}
                    checked={selectionType === 'specific'}
                  />
                  <label htmlFor="specific">Select Insurers</label>
                </div>
                <div className="radio-option">
                  <RadioButton
                    inputId="group"
                    value="group"
                    onChange={(e) => setSelectionType(e.value)}
                    checked={selectionType === 'group'}
                  />
                  <label htmlFor="group">Insurer Group</label>
                </div>
              </div>

              {selectionType === 'specific' && (
                <div className="form-field">
                  <label>Select Insurers</label>
                  <MultiSelect
                    value={selectedInsurers}
                    onChange={(e) => setSelectedInsurers(e.value)}
                    options={insurerOptions}
                    placeholder="Select insurers"
                    display="chip"
                    className="full-width"
                  />
                </div>
              )}
            </div>
          </Card>
        );

      case 1:
        return (
          <Card title="Statement Preview">
            <div className="preview-header">
              <div className="company-info">
                <h3>{companyName}</h3>
                <p>Remittance Statement - {period.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
              </div>
            </div>

            {previewData && (
              <div className="summary-box">
                <div className="summary-item">
                  <span>Total Policies:</span>
                  <strong>{previewData.summary.totalPolicies}</strong>
                </div>
                <div className="summary-item">
                  <span>Total Premium:</span>
                  <strong>{formatCurrency(previewData.summary.totalPremium)}</strong>
                </div>
                <div className="summary-item">
                  <span>Total Commission:</span>
                  <strong>{formatCurrency(previewData.summary.totalCommission)}</strong>
                </div>
                <div className="summary-item">
                  <span>Net Amount:</span>
                  <strong>{formatCurrency(previewData.summary.netAmount)}</strong>
                </div>
              </div>
            )}

            {loadingPreview ? (
              <div className="preview-loading">
                <i className="pi pi-spin pi-spinner" style={{ fontSize: '2em' }} />
                <p>Loading preview data...</p>
              </div>
            ) : previewData && (
              <>
                <DataTable
                  value={previewData.policies.slice(0, 5)}
                  className="preview-table"
                  footer={previewData.policies.length > 5 ? `Showing 5 of ${previewData.policies.length} policies` : null}
                >
                  <Column field="policyNumber" header="Policy No" />
                  <Column field="insuredName" header="Insured Name" />
                  <Column body={(data) => amountBodyTemplate(data, 'premium')} header="Premium" />
                  <Column body={(data) => amountBodyTemplate(data, 'commission')} header="Commission" />
                  <Column body={(data) => amountBodyTemplate(data, 'tax')} header="Tax" />
                  <Column body={(data) => amountBodyTemplate(data, 'netAmount')} header="Net Amount" />
                </DataTable>

                <div className="summary-totals">
                  <div className="total-row">
                    <span>Total Premium:</span>
                    <strong>{formatCurrency(previewData.summary.totalPremium)}</strong>
                  </div>
                  <div className="total-row">
                    <span>Total Commission:</span>
                    <strong>{formatCurrency(previewData.summary.totalCommission)}</strong>
                  </div>
                  <div className="total-row">
                    <span>Total Tax:</span>
                    <strong>{formatCurrency(previewData.summary.totalTax)}</strong>
                  </div>
                  <div className="total-row net">
                    <span>Net Amount:</span>
                    <strong>{formatCurrency(previewData.summary.netAmount)}</strong>
                  </div>
                </div>
              </>
            )}

            <p className="preview-note">
              This is a preview of your statement. The actual statement will include all policies for the selected period.
            </p>
          </Card>
        );

      case 2:
        return (
          <Card title="Output Options">
            <div className="step-content">
              {validationErrors.length > 0 && (
                <Message severity="error" text={validationErrors[0]} className="mb-3" />
              )}
              <div className="section-divider">
                <h4>Output Format</h4>
              </div>

              <div className="checkbox-group">
                <div className="checkbox-option">
                  <Checkbox
                    inputId="pdf"
                    checked={outputFormats.pdf}
                    onChange={(e) => setOutputFormats({ ...outputFormats, pdf: e.checked })}
                  />
                  <label htmlFor="pdf">PDF</label>
                </div>
                <div className="checkbox-option">
                  <Checkbox
                    inputId="excel"
                    checked={outputFormats.excel}
                    onChange={(e) => setOutputFormats({ ...outputFormats, excel: e.checked })}
                  />
                  <label htmlFor="excel">Excel</label>
                </div>
                <div className="checkbox-option">
                  <Checkbox
                    inputId="xml"
                    checked={outputFormats.xml}
                    onChange={(e) => setOutputFormats({ ...outputFormats, xml: e.checked })}
                  />
                  <label htmlFor="xml">XML</label>
                </div>
              </div>

              <div className="section-divider">
                <h4>Delivery Options</h4>
              </div>

              <div className="checkbox-group">
                <div className="checkbox-option">
                  <Checkbox
                    inputId="download"
                    checked={deliveryOptions.download}
                    onChange={(e) => setDeliveryOptions({ ...deliveryOptions, download: e.checked })}
                  />
                  <label htmlFor="download">Download</label>
                </div>
                <div className="checkbox-option">
                  <Checkbox
                    inputId="email"
                    checked={deliveryOptions.email}
                    onChange={(e) => setDeliveryOptions({ ...deliveryOptions, email: e.checked })}
                  />
                  <label htmlFor="email">Email to Insurers</label>
                </div>
                <div className="checkbox-option">
                  <Checkbox
                    inputId="archive"
                    checked={deliveryOptions.archive}
                    onChange={(e) => setDeliveryOptions({ ...deliveryOptions, archive: e.checked })}
                  />
                  <label htmlFor="archive">Archive</label>
                </div>
              </div>

              {deliveryOptions.email && (
                <>
                  <div className="section-divider">
                    <h4>Email Settings</h4>
                  </div>

                  <div className="form-grid">
                    <div className="form-field">
                      <label htmlFor="emailTemplate">Email Template</label>
                      <Dropdown
                        id="emailTemplate"
                        value={emailTemplate}
                        onChange={(e) => setEmailTemplate(e.value)}
                        options={emailTemplates}
                        className="full-width"
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="additionalRecipients">Additional Recipients</label>
                      <InputText
                        id="additionalRecipients"
                        value={additionalRecipients}
                        onChange={(e) => setAdditionalRecipients(e.target.value)}
                        placeholder="Enter email addresses separated by commas"
                        className="full-width"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>
        );

      default:
        return null;
    }
  };

  const successDialogFooter = (
    <div className="dialog-footer">
      <Button label="Download" icon="pi pi-download" onClick={handleDownload} />
      {deliveryOptions.email && (
        <Button label="Send Email" icon="pi pi-send" className="p-button-secondary" onClick={handleEmail} />
      )}
      <Button label="Generate Another" icon="pi pi-refresh" className="p-button-text" onClick={handleReset} />
    </div>
  );

  return (
    <div className="container__statement__generation__master">
        <Toast ref={toast} />
        <ConfirmDialog />
        <div className="top__container">
          <h1 className="page__title">Generate Remittance Statement</h1>
          <BreadCrumb model={items} home={home} />
        </div>

        <div className="content-container">
          <div className="wizard-section">
          <Card>
            <Steps model={steps} activeIndex={activeStep} />
          </Card>

          <div className="wizard-content">
            {renderStepContent()}
          </div>

          <div className="wizard-actions">
            <Button
              label="Previous"
              icon="pi pi-angle-left"
              className="p-button-secondary"
              onClick={handlePrevious}
              disabled={activeStep === 0}
            />
            {activeStep < 2 ? (
              <Button
                label="Next"
                icon="pi pi-angle-right"
                iconPos="right"
                onClick={handleNext}
              />
            ) : (
              <Button
                label="Generate"
                icon="pi pi-check"
                iconPos="right"
                className="p-button-success"
                onClick={handleGenerate}
              />
            )}
            <Button
              label="Cancel"
              className="p-button-text"
              onClick={handleReset}
            />
          </div>
        </div>

        {/* Progress Dialog */}
        {generating && (
          <div className="generation-overlay">
            <Card className="generation-card">
              <h3>Generating Statement...</h3>
              <div className="bv-meter">
                <ProgressBar value={generateProgress} showValue={false} />
                <span className="bv-meter__value">{`${Math.round(generateProgress)}%`}</span>
              </div>
              <p className="generation-message">
                {generateProgress < 30 ? 'Collecting data...' :
                 generateProgress < 60 ? 'Processing policies...' :
                 generateProgress < 90 ? 'Generating document...' :
                 'Finalizing...'}
              </p>
            </Card>
          </div>
        )}

        {/* Success Dialog */}
        <Dialog
          header="Statement Generated Successfully"
          visible={successDialog}
          onHide={() => setSuccessDialog(false)}
          style={{ width: '450px' }}
          footer={successDialogFooter}
        >
          {generatedFile && (
            <div className="success-content">
              <div className="success-icon">
                <i className="pi pi-check-circle" style={{ fontSize: '3em', color: 'var(--green)' }} />
              </div>
              <div className="file-info">
                <p><strong>File:</strong> {generatedFile.fileName}</p>
                <p><strong>Size:</strong> {generatedFile.fileSize}</p>
                <p><strong>Generated:</strong> {formatDateTime(generatedFile.generatedAt)}</p>
              </div>
              <div className="next-steps">
                <p>Your statement is ready. You can:</p>
                <ul>
                  <li>Download the file to your computer</li>
                  {deliveryOptions.email && <li>Send it via email to recipients</li>}
                  {deliveryOptions.archive && <li>File has been archived for future reference</li>}
                </ul>
              </div>
            </div>
          )}
        </Dialog>
        </div>
      </div>
  );
};

export default StatementGeneration;