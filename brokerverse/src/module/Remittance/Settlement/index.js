import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { TabView, TabPanel } from "primereact/tabview";
import { Card } from "primereact/card";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Calendar } from "primereact/calendar";
import { InputNumber } from "primereact/inputnumber";
import { InputTextarea } from "primereact/inputtextarea";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { BreadCrumb } from "primereact/breadcrumb";
import { Toast } from "primereact/toast";
import { Dialog } from "primereact/dialog";
import { confirmDialog, ConfirmDialog } from "primereact/confirmdialog";
import { Tag } from "primereact/tag";
import { Checkbox } from "primereact/checkbox";
import { Timeline } from "primereact/timeline";
import { Badge } from "primereact/badge";
import mockRemittanceService from "../../../services/mockRemittanceService";
import { settlementParameterData, commonData, mockCrudOperations } from "../../../services/mockData/remittanceMockData";
import SvgDot from "../../../assets/icons/SvgDot";
import "./index.scss";

const SettlementProcessing = () => {
  const { t } = useTranslation();
  const { formatCurrency, locale } = useFormatCurrency();
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedPolicies, setSelectedPolicies] = useState([]);
  const [addPolicyDialog, setAddPolicyDialog] = useState(false);
  const [availablePolicies, setAvailablePolicies] = useState([]);
  const [approvalDialog, setApprovalDialog] = useState(false);
  const [approvalResult, setApprovalResult] = useState(null);
  const [workflowHistory, setWorkflowHistory] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const toast = useRef(null);

  const [settlementData, setSettlementData] = useState({
    settlementNo: "SET-2025-00001",
    settlementDate: new Date(),
    settlementType: "Regular",
    status: "Draft",
    insurerCode: null,
    insurerName: "",
    settlementPeriod: [new Date(), new Date()],
    previousBalance: 0,
    creditNotes: 0,
    debitNotes: 0,
    otherAdjustments: 0,
    remarks: "",
    paymentMethod: null,
    bankAccount: null,
    referenceNo: "",
    paymentDate: new Date()
  });

  // Load data from mock data service
  const [parameters, setParameters] = useState(settlementParameterData.parameters);
  const [pendingSettlements, setPendingSettlements] = useState(settlementParameterData.pendingSettlements);

  const [policies, setPolicies] = useState([
    { id: 1, policyNo: "POL-2025-001", insuredName: "John Doe", product: "Auto", premium: 5000, commissionRate: 10, commission: 500, tax: 50, netAmount: 4450, selected: false },
    { id: 2, policyNo: "POL-2025-002", insuredName: "Jane Smith", product: "Health", premium: 3500, commissionRate: 12, commission: 420, tax: 42, netAmount: 3038, selected: false },
    { id: 3, policyNo: "POL-2025-003", insuredName: "Bob Johnson", product: "Life", premium: 8000, commissionRate: 15, commission: 1200, tax: 120, netAmount: 6680, selected: false }
  ]);

  // Initialize workflow history
  useEffect(() => {
    setWorkflowHistory([
      { action: 'Created', by: 'System', at: new Date(), status: 'Draft', notes: 'Settlement initiated' }
    ]);
    loadAvailablePolicies();
  }, []);

  const loadAvailablePolicies = async () => {
    // Simulate loading available policies
    const mockAvailable = [
      { id: 4, policyNo: "POL-2025-004", insuredName: "Alice Williams", product: "Home", premium: 4500, commissionRate: 8, commission: 360, tax: 36, netAmount: 4104 },
      { id: 5, policyNo: "POL-2025-005", insuredName: "Charlie Brown", product: "Travel", premium: 1200, commissionRate: 5, commission: 60, tax: 6, netAmount: 1134 },
      { id: 6, policyNo: "POL-2025-006", insuredName: "Diana Prince", product: "Life", premium: 10000, commissionRate: 15, commission: 1500, tax: 150, netAmount: 8350 }
    ];
    setAvailablePolicies(mockAvailable);
  };

  const settlementTypes = [
    { label: "Regular", value: "Regular" },
    { label: "Provisional", value: "Provisional" },
    { label: "Final", value: "Final" },
    { label: "Adjustment", value: "Adjustment" }
  ];

  const insurers = commonData.insurers.map(insurer => ({
    label: insurer.name,
    value: insurer.code
  }));

  const paymentMethods = commonData.paymentMethods.map(method => ({
    label: method,
    value: method.toLowerCase().replace(/\s+/g, '_')
  }));

  const bankAccounts = [
    { label: "Main Operating Account - *1234", value: "ACC001" },
    { label: "Settlement Account - *5678", value: "ACC002" },
    { label: "Premium Collection Account - *9012", value: "ACC003" }
  ];

  const items = [
    { label: t("remittance.finance"), url: "#" },
    { label: t("remittance.remittance"), url: "#" },
    { label: t("remittance.settlement"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  const calculateSummary = () => {
    const totalPremium = policies.reduce((acc, p) => acc + p.premium, 0);
    const totalCommission = policies.reduce((acc, p) => acc + p.commission, 0);
    const totalTax = policies.reduce((acc, p) => acc + p.tax, 0);
    const totalAdjustments = settlementData.previousBalance + settlementData.creditNotes - settlementData.debitNotes + settlementData.otherAdjustments;
    const netSettlement = totalPremium - totalCommission - totalTax + totalAdjustments;

    return {
      totalPremium,
      totalCommission,
      totalTax,
      totalAdjustments,
      netSettlement
    };
  };

  const validateSettlement = () => {
    const errors = [];
    if (!settlementData.insurerCode) errors.push(t("remittance.pleaseSelectInsurer"));
    if (!settlementData.settlementPeriod[0] || !settlementData.settlementPeriod[1]) {
      errors.push(t("remittance.pleaseSelectSettlementPeriod"));
    }
    if (policies.length === 0) errors.push(t("remittance.pleaseAddPolicy"));
    if (activeIndex === 2) { // Payment tab
      if (!settlementData.paymentMethod) errors.push(t("remittance.pleaseSelectPaymentMethod"));
      if (settlementData.paymentMethod !== 'check' && !settlementData.bankAccount) {
        errors.push(t("remittance.pleaseSelectBankAccount"));
      }
    }
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleInputChange = (field, value) => {
    setSettlementData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveDraft = async () => {
    setLoading(true);
    try {
      const settlementRecord = {
        ...settlementData,
        policies,
        summary: calculateSummary(),
        parameters: parameters[0], // Use first parameter as template
        status: 'Draft'
      };

      const result = await mockCrudOperations.create('settlement_draft', settlementRecord);

      toast.current.show({
        severity: 'success',
        summary: t("remittance.draftSaved"),
        detail: t("remittance.draftSavedDetail", { id: result.id }),
        life: 3000
      });

      // Add to workflow history
      setWorkflowHistory(prev => [...prev, {
        action: 'Saved',
        by: 'Current User',
        at: new Date(),
        status: 'Draft',
        notes: 'Draft saved successfully'
      }]);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("remittance.saveFailed"),
        detail: error.message || t("remittance.failedToSaveDraft"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = () => {
    if (!validateSettlement()) {
      toast.current.show({
        severity: 'error',
        summary: t("remittance.validationFailed"),
        detail: validationErrors[0],
        life: 3000
      });
      return;
    }

    const summary = calculateSummary();
    confirmDialog({
      message: (
        <div>
          <p>{t("remittance.submitSettlementApproval")}</p>
          <p>{t("remittance.settlementNo")}: <strong>{settlementData.settlementNo}</strong></p>
          <p>{t("remittance.netAmount")}: <strong>
            {formatCurrency(summary.netSettlement)}
          </strong></p>
        </div>
      ),
      header: t("remittance.confirmSubmission"),
      icon: 'pi pi-send',
      accept: () => submitForApproval()
    });
  };

  const submitForApproval = async () => {
    setLoading(true);
    try {
      const summary = calculateSummary();
      const settlementRecord = {
        ...settlementData,
        policies,
        summary,
        submittedAt: new Date().toISOString(),
        status: 'Pending Approval'
      };

      // Create settlement record for approval
      const result = await mockCrudOperations.create('settlement_approval', settlementRecord);

      // Mock approval result based on settlement parameters
      const approvalParams = parameters.find(p =>
        summary.netSettlement >= p.approvalLevels[0].minAmount &&
        summary.netSettlement <= p.approvalLevels[0].maxAmount
      ) || parameters[0];

      const mockApprovalResult = {
        approvalId: `APV-${result.id}`,
        approver: approvalParams.approvalLevels[0].approver,
        expectedApprovalDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Tomorrow
      };

      setApprovalResult(mockApprovalResult);
      setSettlementData(prev => ({ ...prev, status: 'Pending Approval' }));

      // Add to workflow history
      setWorkflowHistory(prev => [...prev, {
        action: 'Submitted',
        by: 'Current User',
        at: new Date(),
        status: 'Pending Approval',
        notes: `Submitted to ${mockApprovalResult.approver} for approval`
      }]);

      toast.current.show({
        severity: 'success',
        summary: t("remittance.submittedSuccessfully"),
        detail: t("remittance.submittedToApprover", { approver: mockApprovalResult.approver }),
        life: 3000
      });

      setApprovalDialog(true);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: t("remittance.submissionFailed"),
        detail: error.message || t("remittance.failedToSubmitApproval"),
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    toast.current.show({
      severity: 'info',
      summary: 'Print Preview',
      detail: 'Opening print preview...',
      life: 2000
    });
    // In real app, would open print dialog
    window.print();
  };

  const handleCalculate = async () => {
    setLoading(true);
    try {
      const result = await mockRemittanceService.calculateSettlement(
        policies,
        {
          previousBalance: settlementData.previousBalance,
          creditNotes: settlementData.creditNotes,
          debitNotes: settlementData.debitNotes,
          otherAdjustments: settlementData.otherAdjustments
        }
      );

      toast.current.show({
        severity: 'success',
        summary: 'Calculation Complete',
        detail: `Net Settlement: ${formatCurrency(result.netAmount)}`,
        life: 3000
      });

      // Update policies with recalculated values
      const updatedPolicies = policies.map(p => ({
        ...p,
        netAmount: p.premium - p.commission - p.tax
      }));
      setPolicies(updatedPolicies);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Calculation Failed',
        detail: error.message,
        life: 3000
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPolicies = () => {
    setAddPolicyDialog(true);
  };

  const handleImport = () => {
    confirmDialog({
      message: 'Import policies from Excel file?',
      header: 'Import Policies',
      icon: 'pi pi-upload',
      accept: () => {
        toast.current.show({
          severity: 'info',
          summary: 'Import Started',
          detail: 'Select file to import policies',
          life: 3000
        });
      }
    });
  };

  const handleDeletePolicy = (rowData) => {
    confirmDialog({
      message: `Remove policy ${rowData.policyNo} from settlement?`,
      header: 'Confirm Delete',
      icon: 'pi pi-trash',
      accept: () => {
        setPolicies(prev => prev.filter(p => p.id !== rowData.id));
        toast.current.show({
          severity: 'success',
          summary: 'Policy Removed',
          detail: `${rowData.policyNo} removed from settlement`,
          life: 2000
        });
      }
    });
  };

  const confirmAddPolicies = () => {
    const selected = availablePolicies.filter(p => selectedPolicies.includes(p.id));
    if (selected.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select policies to add',
        life: 2000
      });
      return;
    }

    setPolicies(prev => [...prev, ...selected]);
    setAddPolicyDialog(false);
    setSelectedPolicies([]);

    toast.current.show({
      severity: 'success',
      summary: 'Policies Added',
      detail: `Added ${selected.length} policies to settlement`,
      life: 3000
    });
  };

  const amountBodyTemplate = (rowData, field) => {
    return formatCurrency(rowData[field]);
  };

  const percentageBodyTemplate = (rowData) => {
    return `${rowData.commissionRate}%`;
  };

  const actionBodyTemplate = (rowData) => {
    return (
      <Button
        icon="pi pi-trash"
        className="p-button-danger p-button-text p-button-sm"
        onClick={() => handleDeletePolicy(rowData)}
        disabled={settlementData.status !== 'Draft'}
      />
    );
  };

  const summary = calculateSummary();

  const addPolicyDialogFooter = (
    <div className="dialog-footer">
      <Button label={t("remittance.cancel")} icon="pi pi-times" className="p-button-text" onClick={() => setAddPolicyDialog(false)} />
      <Button label={t("remittance.addSelected")} icon="pi pi-check" onClick={confirmAddPolicies} />
    </div>
  );

  const approvalDialogFooter = (
    <div className="dialog-footer">
      <Button label={t("common.yes")} icon="pi pi-check" onClick={() => setApprovalDialog(false)} />
    </div>
  );

  return (
    <div className="container__settlement__processing__master">
        <Toast ref={toast} />
        <ConfirmDialog />
        <div className="top__container">
          <h1 className="page__title">{t("remittance.insurerSettlement")}</h1>
          <BreadCrumb model={items} home={home} />

          <div className="header-content">
            <div className="header-info">
              <div className="info-item">
                <label>{t("remittance.settlementNo")}</label>
                <span className="value">{settlementData.settlementNo}</span>
              </div>
              <div className="info-item">
                <label>{t("remittance.date")}</label>
                <Calendar
                  value={settlementData.settlementDate}
                  onChange={(e) => handleInputChange("settlementDate", e.value)}
                  dateFormat="mm/dd/yy"
                />
              </div>
              <div className="info-item">
                <label>{t("remittance.type")}</label>
                <Dropdown
                  value={settlementData.settlementType}
                  onChange={(e) => handleInputChange("settlementType", e.value)}
                  options={settlementTypes}
                />
              </div>
              <div className="info-item status">
                <label>{t("remittance.status")}</label>
                <span className={`status-badge ${settlementData.status.toLowerCase()}`}>
                  {settlementData.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="content-container">
          <div className="content-section">
          <Card>
            <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
              <TabPanel header={t("remittance.settlementDetails")}>
                <div className="tab-content">
                  <div className="section-title">{t("remittance.insurerInformation")}</div>
                  <div className="form-grid">
                    <div className="form-field">
                      <label htmlFor="insurerCode" className="required">{t("remittance.insurerCode")}</label>
                      <Dropdown
                        id="insurerCode"
                        value={settlementData.insurerCode}
                        onChange={(e) => {
                          handleInputChange("insurerCode", e.value);
                          // Simulate loading insurer details
                          const insurer = insurers.find(i => i.value === e.value);
                          if (insurer) {
                            handleInputChange("insurerName", insurer.label);
                          }
                        }}
                        options={insurers}
                        placeholder={t("remittance.selectInsurer")}
                        className="full-width"
                      />
                    </div>

                    <div className="form-field">
                      <label>{t("remittance.insurerName")}</label>
                      <InputText
                        value={settlementData.insurerName}
                        disabled
                        className="full-width"
                      />
                    </div>

                    <div className="form-field">
                      <label htmlFor="period" className="required">{t("remittance.period")}</label>
                      <Calendar
                        id="period"
                        value={settlementData.settlementPeriod}
                        onChange={(e) => handleInputChange("settlementPeriod", e.value)}
                        selectionMode="range"
                        dateFormat="mm/dd/yy"
                        placeholder={t("remittance.selectPeriod")}
                        className="full-width"
                      />
                    </div>
                  </div>

                  <div className="section-title">{t("remittance.policyDetails")}</div>
                  <div className="table-toolbar">
                    <Button
                      label={t("remittance.addPolicies")}
                      icon="pi pi-plus"
                      className="p-button-sm"
                      onClick={handleAddPolicies}
                      disabled={settlementData.status !== 'Draft'}
                    />
                    <Button
                      label="Import"
                      icon="pi pi-upload"
                      className="p-button-sm p-button-secondary"
                      onClick={handleImport}
                      disabled={settlementData.status !== 'Draft'}
                    />
                    <Button
                      label={t("remittance.calculate")}
                      icon="pi pi-calculator"
                      className="p-button-sm p-button-secondary"
                      onClick={handleCalculate}
                      loading={loading}
                    />
                  </div>

                  <DataTable value={policies} className="policy-table" loading={loading} emptyMessage={t("common.noData")}>
                    <Column field="policyNo" header={t("remittance.policyNo")} style={{ width: '12%' }} />
                    <Column field="insuredName" header={t("remittance.insuredName")} style={{ width: '18%' }} />
                    <Column field="product" header={t("remittance.product")} style={{ width: '10%' }} />
                    <Column body={(data) => amountBodyTemplate(data, 'premium')} header={t("remittance.premium")} style={{ width: '12%', textAlign: 'right' }} />
                    <Column body={percentageBodyTemplate} header={t("remittance.commissionRate")} style={{ width: '8%', textAlign: 'center' }} />
                    <Column body={(data) => amountBodyTemplate(data, 'commission')} header={t("remittance.commission")} style={{ width: '12%', textAlign: 'right' }} />
                    <Column body={(data) => amountBodyTemplate(data, 'tax')} header={t("remittance.tax")} style={{ width: '10%', textAlign: 'right' }} />
                    <Column body={(data) => amountBodyTemplate(data, 'netAmount')} header={t("remittance.netAmount")} style={{ width: '13%', textAlign: 'right' }} />
                    <Column body={actionBodyTemplate} style={{ width: '5%' }} />
                  </DataTable>
                </div>
              </TabPanel>

              <TabPanel header="Adjustments">
                <div className="tab-content">
                  <div className="section-title">Adjustment Details</div>
                  <div className="form-grid two-column">
                    <div className="form-field">
                      <label>Previous Balance</label>
                      <InputNumber
                        value={settlementData.previousBalance}
                        onValueChange={(e) => handleInputChange("previousBalance", e.value)}
                        mode="decimal"
                        minFractionDigits={2}
                        maxFractionDigits={2}
                        locale={locale}
                        className="full-width"
                      />
                    </div>

                    <div className="form-field">
                      <label>Credit Notes</label>
                      <InputNumber
                        value={settlementData.creditNotes}
                        onValueChange={(e) => handleInputChange("creditNotes", e.value)}
                        mode="decimal"
                        minFractionDigits={2}
                        maxFractionDigits={2}
                        locale={locale}
                        className="full-width"
                      />
                    </div>

                    <div className="form-field">
                      <label>Debit Notes</label>
                      <InputNumber
                        value={settlementData.debitNotes}
                        onValueChange={(e) => handleInputChange("debitNotes", e.value)}
                        mode="decimal"
                        minFractionDigits={2}
                        maxFractionDigits={2}
                        locale={locale}
                        className="full-width"
                      />
                    </div>

                    <div className="form-field">
                      <label>Other Adjustments</label>
                      <InputNumber
                        value={settlementData.otherAdjustments}
                        onValueChange={(e) => handleInputChange("otherAdjustments", e.value)}
                        mode="decimal"
                        minFractionDigits={2}
                        maxFractionDigits={2}
                        locale={locale}
                        className="full-width"
                      />
                    </div>
                  </div>

                  <div className="section-title">Notes</div>
                  <div className="form-field">
                    <label>Adjustment Remarks</label>
                    <InputTextarea
                      value={settlementData.remarks}
                      onChange={(e) => handleInputChange("remarks", e.target.value)}
                      rows={4}
                      className="full-width"
                      placeholder="Enter any remarks about adjustments"
                    />
                  </div>
                </div>
              </TabPanel>

              <TabPanel header="Payment">
                <div className="tab-content">
                  <div className="section-title">Payment Information</div>
                  <div className="form-grid two-column">
                    <div className="form-field">
                      <label className="required">Payment Method</label>
                      <Dropdown
                        value={settlementData.paymentMethod}
                        onChange={(e) => handleInputChange("paymentMethod", e.value)}
                        options={paymentMethods}
                        placeholder="Select payment method"
                        className="full-width"
                      />
                    </div>

                    <div className="form-field">
                      <label>Bank Account</label>
                      <Dropdown
                        value={settlementData.bankAccount}
                        onChange={(e) => handleInputChange("bankAccount", e.value)}
                        options={bankAccounts}
                        placeholder="Select bank account"
                        className="full-width"
                        disabled={settlementData.paymentMethod === 'check'}
                      />
                    </div>

                    <div className="form-field">
                      <label>Reference No</label>
                      <InputText
                        value={settlementData.referenceNo}
                        onChange={(e) => handleInputChange("referenceNo", e.target.value)}
                        placeholder="Enter reference number"
                        className="full-width"
                      />
                    </div>

                    <div className="form-field">
                      <label>Payment Date</label>
                      <Calendar
                        value={settlementData.paymentDate}
                        onChange={(e) => handleInputChange("paymentDate", e.value)}
                        dateFormat="mm/dd/yy"
                        className="full-width"
                      />
                    </div>
                  </div>
                </div>
              </TabPanel>

              <TabPanel header="Workflow">
                <div className="tab-content">
                  <div className="section-title">Approval Workflow</div>
                  <Timeline value={workflowHistory}
                    opposite={(item) => item.by}
                    content={(item) => (
                      <div className="workflow-content">
                        <div className="workflow-header">
                          <strong>{item.action}</strong>
                          <Tag value={item.status} severity={
                            item.status === 'Approved' ? 'success' :
                            item.status === 'Pending Approval' ? 'warning' :
                            item.status === 'Draft' ? 'info' : 'secondary'
                          } />
                        </div>
                        <small>{new Date(item.at).toLocaleString()}</small>
                        {item.notes && <p className="workflow-notes">{item.notes}</p>}
                      </div>
                    )}
                  />

                  <div className="section-title">Current Status</div>
                  <div className="status-info">
                    <div className="status-item">
                      <label>Status:</label>
                      <Tag value={settlementData.status} severity={
                        settlementData.status === 'Approved' ? 'success' :
                        settlementData.status === 'Pending Approval' ? 'warning' :
                        settlementData.status === 'Draft' ? 'info' : 'secondary'
                      } />
                    </div>
                    {approvalResult && (
                      <>
                        <div className="status-item">
                          <label>Approver:</label>
                          <span>{approvalResult.approver}</span>
                        </div>
                        <div className="status-item">
                          <label>Expected Approval:</label>
                          <span>{new Date(approvalResult.expectedApprovalDate).toLocaleDateString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </TabPanel>
            </TabView>
          </Card>

          <Card className="summary-card" title="Settlement Summary">
            <div className="summary-grid">
              <div className="summary-item">
                <label>Total Premium</label>
                <span className="value">
                  {formatCurrency(summary.totalPremium)}
                </span>
              </div>
              <div className="summary-item">
                <label>Total Commission</label>
                <span className="value">
                  {formatCurrency(summary.totalCommission)}
                </span>
              </div>
              <div className="summary-item">
                <label>Total Tax</label>
                <span className="value">
                  {formatCurrency(summary.totalTax)}
                </span>
              </div>
              <div className="summary-item">
                <label>Adjustments</label>
                <span className="value">
                  {formatCurrency(summary.totalAdjustments)}
                </span>
              </div>
              <div className="summary-item highlight">
                <label>Net Settlement</label>
                <span className="value">
                  {formatCurrency(summary.netSettlement)}
                </span>
              </div>
            </div>
          </Card>

          <div className="action-buttons">
            <Button
              label={t("remittance.saveDraft")}
              icon="pi pi-save"
              className="p-button-secondary"
              onClick={handleSaveDraft}
            />
            <Button
              label={t("remittance.submitForApproval")}
              icon="pi pi-send"
              onClick={handleSubmitApproval}
              disabled={settlementData.status !== 'Draft'}
            />
            <Button
              label={t("remittance.print")}
              icon="pi pi-print"
              className="p-button-secondary"
              onClick={handlePrint}
            />
            <Button
              label={t("remittance.cancel")}
              className="p-button-text"
              onClick={() => {
                confirmDialog({
                  message: 'Cancel settlement processing? Any unsaved changes will be lost.',
                  header: 'Confirm Cancel',
                  icon: 'pi pi-exclamation-triangle',
                  accept: () => {
                    toast.current.show({
                      severity: 'info',
                      summary: 'Cancelled',
                      detail: 'Settlement processing cancelled',
                      life: 2000
                    });
                  }
                });
              }}
            />
          </div>

          {/* Add Policy Dialog */}
          <Dialog
            header="Add Policies to Settlement"
            visible={addPolicyDialog}
            onHide={() => setAddPolicyDialog(false)}
            style={{ width: '60vw' }}
            footer={addPolicyDialogFooter}
          >
            <DataTable
              value={availablePolicies}
              selection={selectedPolicies}
              onSelectionChange={(e) => setSelectedPolicies(e.value)}
              dataKey="id"
              className="policy-selection-table"
            >
              <Column selectionMode="multiple" style={{ width: '3em' }} />
              <Column field="policyNo" header="Policy No" />
              <Column field="insuredName" header="Insured" />
              <Column field="product" header="Product" />
              <Column body={(data) => amountBodyTemplate(data, 'premium')} header="Premium" />
              <Column body={(data) => amountBodyTemplate(data, 'commission')} header="Commission" />
            </DataTable>
          </Dialog>

          {/* Approval Success Dialog */}
          <Dialog
            header="Submission Successful"
            visible={approvalDialog}
            onHide={() => setApprovalDialog(false)}
            style={{ width: '450px' }}
            footer={approvalDialogFooter}
          >
            {approvalResult && (
              <div className="approval-success">
                <div className="success-icon">
                  <i className="pi pi-check-circle" style={{ fontSize: '3em', color: 'var(--green)' }} />
                </div>
                <p>Settlement has been submitted for approval.</p>
                <div className="approval-details">
                  <div className="detail-item">
                    <label>Approval ID:</label>
                    <span>{approvalResult.approvalId}</span>
                  </div>
                  <div className="detail-item">
                    <label>Approver:</label>
                    <span>{approvalResult.approver}</span>
                  </div>
                  <div className="detail-item">
                    <label>Expected Date:</label>
                    <span>{new Date(approvalResult.expectedApprovalDate).toLocaleDateString()}</span>
                  </div>
                </div>
                <p className="info-message">
                  You will receive a notification once the settlement is approved.
                </p>
              </div>
            )}
          </Dialog>
        </div>
        </div>
      </div>
  );
};

export default SettlementProcessing;