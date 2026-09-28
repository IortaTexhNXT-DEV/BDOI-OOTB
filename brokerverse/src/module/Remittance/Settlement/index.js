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
import { Timeline } from "primereact/timeline";
import remittanceService from "../../../services/remittanceService";
import { isoDate, loadInsurerOptions, loadMasterOptions, loadSettings, showError, showSuccess } from "../shared";
import SvgDot from "../../../assets/icons/SvgDot";
import "./index.scss";

import { numberLocale } from "../../../utility/currencyConverter";
const initialSettlement = () => ({
  id: null,
  settlementNo: "-",
  settlementDate: new Date(),
  settlementType: "Regular",
  status: "Draft",
  insurerCode: null,
  insurerName: "",
  settlementPeriod: [new Date(new Date().getFullYear(), new Date().getMonth(), 1), new Date()],
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
const EDITABLE = ["Draft", "Rejected"];
const isCheque = (method) => /check|cheque/i.test(method || "");

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
  const [insurers, setInsurers] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [policies, setPolicies] = useState([]);
  const toast = useRef(null);

  const [settlementData, setSettlementData] = useState(initialSettlement);
  const editable = EDITABLE.includes(settlementData.status);

  useEffect(() => {
    loadInsurerOptions().then(setInsurers).catch((e) => showError(toast, e));
    loadMasterOptions("bank-account").then((rows) => setBankAccounts(rows.map((r) => ({ label: `${r.label} - ${r.value}`, value: r.value })))).catch((e) => showError(toast, e));
    loadSettings()
      .then((s) => setPaymentMethods(Object.keys(s["accounting.cash_account_by_payment_mode"] || {}).map((m) => ({
        label: m.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        value: m
      }))))
      .catch((e) => showError(toast, e));
  }, []);

  const loadAvailablePolicies = async (insurerCode) => {
    if (!insurerCode) return;
    try {
      setAvailablePolicies(await remittanceService.settlementPolicies(insurerCode));
    } catch (e) {
      showError(toast, e);
    }
  };

  const loadWorkflow = async (settlementNo) => {
    try {
      const audit = await remittanceService.auditTrail(settlementNo);
      setWorkflowHistory([...audit].reverse().map((a) => ({ action: a.actionType, by: a.changedBy, at: String(a.changeDate).replace(" ", "T"), status: a.newValue || "", notes: a.reason })));
    } catch (e) {
      showError(toast, e);
    }
  };

  const settlementTypes = [
    { label: "Regular", value: "Regular" },
    { label: "Provisional", value: "Provisional" },
    { label: "Final", value: "Final" },
    { label: "Adjustment", value: "Adjustment" }
  ];

  const items = [
    { label: t("remittance.finance"), url: "#" },
    { label: t("remittance.remittance"), url: "#" },
    { label: t("remittance.settlement"), url: "#" }
  ];

  const home = { icon: <SvgDot />, url: "#" };

  const calculateSummary = () => {
    const totalPremium = policies.reduce((acc, p) => acc + Number(p.premium || 0), 0);
    const totalCommission = policies.reduce((acc, p) => acc + Number(p.commission || 0), 0);
    const totalTax = policies.reduce((acc, p) => acc + Number(p.tax || 0), 0);
    const totalAdjustments = Number(settlementData.previousBalance || 0) + Number(settlementData.creditNotes || 0) - Number(settlementData.debitNotes || 0) + Number(settlementData.otherAdjustments || 0);
    const netSettlement = totalPremium - totalCommission - totalTax + totalAdjustments;

    return {
      totalPremium,
      totalCommission,
      totalTax,
      totalAdjustments,
      netSettlement
    };
  };

  const validateSettlement = (forSubmit) => {
    const errors = [];
    if (!settlementData.insurerCode) errors.push(t("remittance.pleaseSelectInsurer"));
    if (!settlementData.settlementPeriod?.[0] || !settlementData.settlementPeriod?.[1]) {
      errors.push(t("remittance.pleaseSelectSettlementPeriod"));
    }
    if (policies.length === 0) errors.push(t("remittance.pleaseAddPolicy"));
    if (forSubmit) {
      if (!settlementData.paymentMethod) errors.push(t("remittance.pleaseSelectPaymentMethod"));
      if (!isCheque(settlementData.paymentMethod) && !settlementData.bankAccount) {
        errors.push(t("remittance.pleaseSelectBankAccount"));
      }
    }
    if (errors.length) {
      toast.current.show({ severity: 'error', summary: t("remittance.validationFailed"), detail: errors[0], life: 3000 });
    }
    return errors.length === 0;
  };

  const handleInputChange = (field, value) => {
    setSettlementData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const payload = () => ({
    insurerCode: settlementData.insurerCode,
    settlementType: settlementData.settlementType,
    settlementDate: isoDate(settlementData.settlementDate),
    settlementPeriod: (settlementData.settlementPeriod || []).map(isoDate),
    lineIds: policies.map((p) => p.id),
    previousBalance: settlementData.previousBalance || 0,
    creditNotes: settlementData.creditNotes || 0,
    debitNotes: settlementData.debitNotes || 0,
    otherAdjustments: settlementData.otherAdjustments || 0,
    remarks: settlementData.remarks,
    paymentMethod: settlementData.paymentMethod,
    bankAccount: isCheque(settlementData.paymentMethod) ? null : settlementData.bankAccount,
    referenceNo: settlementData.referenceNo,
    paymentDate: isoDate(settlementData.paymentDate)
  });

  const applySaved = (saved) => {
    setSettlementData((prev) => ({ ...prev, id: saved.id, settlementNo: saved.settlementNo || saved.referenceNo, status: saved.status }));
    loadWorkflow(saved.settlementNo || saved.referenceNo);
  };

  const saveDraft = async () => {
    if (settlementData.id) return remittanceService.updateSettlement(settlementData.id, payload());
    return remittanceService.createSettlement(payload());
  };

  const handleSaveDraft = async () => {
    if (!validateSettlement(false)) return;
    setLoading(true);
    try {
      const saved = await saveDraft();
      applySaved(saved);
      toast.current.show({
        severity: 'success',
        summary: t("remittance.draftSaved"),
        detail: t("remittance.draftSavedDetail", { id: saved.settlementNo || saved.referenceNo }),
        life: 3000
      });
    } catch (error) {
      showError(toast, error, t("remittance.saveFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApproval = () => {
    if (!validateSettlement(true)) return;

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
      const draft = await saveDraft();
      const saved = await remittanceService.submitSettlement(draft.id, { paymentMethod: settlementData.paymentMethod, bankAccount: settlementData.bankAccount });
      applySaved(saved);
      const approvals = await remittanceService.listApprovals({ transactionType: "Settlement" });
      const approval = approvals.find((a) => a.entityId === saved.id) || {};
      setApprovalResult({
        approvalId: approval.id,
        approver: approval.requiredLevels ? `Level ${approval.currentLevel} of ${approval.requiredLevels}` : "-",
        expectedApprovalDate: new Date(Date.now() + Number(approval.slaHours || 0) * 3600000).toISOString()
      });
      toast.current.show({
        severity: 'success',
        summary: t("remittance.submittedSuccessfully"),
        detail: `${saved.settlementNo || saved.referenceNo}: ${saved.status}`,
        life: 3000
      });
      setApprovalDialog(true);
    } catch (error) {
      showError(toast, error, t("remittance.submissionFailed"));
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCalculate = async () => {
    if (!policies.length) return;
    setLoading(true);
    try {
      const result = await remittanceService.calculateSettlement({
        lineIds: policies.map((p) => p.id),
        adjustments: {
          previousBalance: settlementData.previousBalance,
          creditNotes: settlementData.creditNotes,
          debitNotes: settlementData.debitNotes,
          otherAdjustments: settlementData.otherAdjustments
        }
      });
      showSuccess(toast, `Net Settlement: ${formatCurrency(result.netAmount)}`, 'Calculation Complete');
    } catch (error) {
      showError(toast, error, 'Calculation Failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPolicies = () => {
    if (!settlementData.insurerCode) {
      toast.current.show({ severity: 'warn', summary: t("remittance.validationFailed"), detail: t("remittance.pleaseSelectInsurer"), life: 3000 });
      return;
    }
    setAddPolicyDialog(true);
  };

  const unselectedPolicies = availablePolicies.filter((p) => !policies.some((x) => x.id === p.id));

  const handleImport = () => {
    confirmDialog({
      message: `Add all ${unselectedPolicies.length} available policies for ${settlementData.insurerName || "the insurer"}?`,
      header: 'Import Policies',
      icon: 'pi pi-upload',
      accept: () => setPolicies((prev) => [...prev, ...unselectedPolicies])
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
    if (selectedPolicies.length === 0) {
      toast.current.show({
        severity: 'warn',
        summary: 'No Selection',
        detail: 'Please select policies to add',
        life: 2000
      });
      return;
    }

    setPolicies(prev => [...prev, ...selectedPolicies]);
    setAddPolicyDialog(false);
    setSelectedPolicies([]);

    toast.current.show({
      severity: 'success',
      summary: 'Policies Added',
      detail: `Added ${selectedPolicies.length} policies to settlement`,
      life: 3000
    });
  };

  const handleCancel = () => {
    setSettlementData(initialSettlement());
    setPolicies([]);
    setAvailablePolicies([]);
    setWorkflowHistory([]);
    setApprovalResult(null);
    setActiveIndex(0);
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
        disabled={!editable}
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
                          const insurer = insurers.find(i => i.value === e.value);
                          setSettlementData((prev) => ({ ...prev, insurerCode: e.value, insurerName: insurer?.label || "" }));
                          setPolicies([]);
                          loadAvailablePolicies(e.value);
                        }}
                        options={insurers}
                        filter
                        disabled={!editable}
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
                      disabled={!editable}
                    />
                    <Button
                      label="Import"
                      icon="pi pi-upload"
                      className="p-button-sm p-button-secondary"
                      onClick={handleImport}
                      disabled={!editable || unselectedPolicies.length === 0}
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
                        disabled={isCheque(settlementData.paymentMethod)}
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
                          {item.status && <Tag value={item.status} severity={
                            item.status === 'Approved' ? 'success' :
                            item.status === 'Pending Approval' ? 'warning' :
                            item.status === 'Draft' ? 'info' : 'secondary'
                          } />}
                        </div>
                        <small>{new Date(item.at).toLocaleString(numberLocale())}</small>
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
              disabled={!editable || loading}
            />
            <Button
              label={t("remittance.submitForApproval")}
              icon="pi pi-send"
              onClick={handleSubmitApproval}
              disabled={!editable || loading}
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
                  accept: handleCancel
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
              value={unselectedPolicies}
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