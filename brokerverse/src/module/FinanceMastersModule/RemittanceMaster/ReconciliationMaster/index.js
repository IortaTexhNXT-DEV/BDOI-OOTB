import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { TabView, TabPanel } from "primereact/tabview";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { Slider } from "primereact/slider";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import { Toast } from "primereact/toast";
import { apiRequest } from "../../../../services/remittanceService";
import { showError } from "../../../Remittance/shared";
import { MasterLookup, saveAndReturn, useMasterOptions } from "../masterRecord";
import { Card } from "primereact/card";
import "./index.scss";

const ReconciliationMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = useRef(null);
  const TYPE = "remittance-reconciliation-rule";
  const [roleOptions, setRoleOptions] = useState([]);
  const exceptionTypes = useMasterOptions("remittance-exception", toast);
  const exceptionTypeOptions = exceptionTypes.map((o) => ({ label: o.name, value: o.name }));

  useEffect(() => {
    apiRequest("GET", "/roles")
      .then((res) => setRoleOptions((res.data || []).map((r) => ({ label: r.name, value: r.name }))))
      .catch((error) => showError(toast, error));
  }, []);

  const [activeIndex, setActiveIndex] = useState(0);
  const [formData, setFormData] = useState({
    ruleCode: "",
    ruleName: "",
    isActive: true,
    matchByPolicy: true,
    matchByAmount: true,
    matchByDate: false,
    matchByReference: false,
    amountTolerance: 0.00,
    dateTolerance: 3,
    enableAutoMatch: false,
    confidenceLevel: 85,
    suspenseAccount: "",
    clearingAccount: "",
    differenceAccount: "",
    writeOffAccount: "",
    exceptionRules: []
  });

  const [exceptionRules, setExceptionRules] = useState([]);

  const actionOptions = [
    { label: "Auto-Resolve", value: "Auto-Resolve" },
    { label: "Flag for Review", value: "Flag for Review" },
    { label: "Reject", value: "Reject" },
    { label: "Hold", value: "Hold" },
  ];


  const items = [
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Reconciliation Setup", url: "#" },
  ];

  const home = { label: "Master" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      if (data) {
        const criteria = data.matchingCriteria || [];
        const byField = (name) => criteria.find((c) => c.field === name);
        setFormData((prev) => ({
          ...prev,
          matchByPolicy: Boolean(byField("Policy Number")),
          matchByAmount: Boolean(byField("Premium Amount")),
          matchByDate: Boolean(byField("Transaction Date")),
          matchByReference: Boolean(byField("Reference")),
          amountTolerance: byField("Premium Amount")?.tolerance ?? prev.amountTolerance,
          dateTolerance: byField("Transaction Date")?.rangeDays ?? prev.dateTolerance,
          confidenceLevel: data.autoMatchThreshold ?? prev.confidenceLevel,
          ...(data.form || {}),
          ruleCode: data.code,
          ruleName: data.name,
          isActive: data.status === true || data.status === "Active",
        }));
        setExceptionRules(data.form?.exceptionRules || []);
      }
    } else {
      setFormData(prev => ({
        ...prev,
        ruleCode: generateCode()
      }));
    }
  }, [mode, data]);

  const generateCode = () => {
    const random = Math.floor(Math.random() * 10000);
    return `REC-${String(random).padStart(4, '0')}`;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const matchingCriteria = () => [
    formData.matchByPolicy && { field: "Policy Number", priority: 1, matchType: "Exact" },
    formData.matchByAmount && { field: "Premium Amount", priority: 2, matchType: "Within Tolerance", tolerance: formData.amountTolerance },
    formData.matchByDate && { field: "Transaction Date", priority: 3, matchType: "Within Range", rangeDays: formData.dateTolerance },
    formData.matchByReference && { field: "Reference", priority: 4, matchType: "Exact" }
  ].filter(Boolean);

  const handleSave = () => saveAndReturn({
    type: TYPE,
    id: data?.id,
    toast,
    navigate,
    record: {
      code: formData.ruleCode,
      name: formData.ruleName,
      isActive: formData.isActive,
      autoMatchThreshold: formData.confidenceLevel,
      matchingCriteria: matchingCriteria(),
      form: { ...formData, exceptionRules }
    }
  });

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  const addExceptionRule = () => {
    const newRule = {
      id: exceptionRules.length + 1,
      exceptionType: "",
      condition: "",
      action: "",
      notifyRole: ""
    };
    setExceptionRules([...exceptionRules, newRule]);
  };

  const deleteExceptionRule = (rowData) => {
    setExceptionRules(exceptionRules.filter(rule => rule.id !== rowData.id));
  };

  const onExceptionCellEdit = (e) => {
    const updatedRules = [...exceptionRules];
    const index = updatedRules.findIndex(rule => rule.id === e.rowData.id);
    updatedRules[index][e.field] = e.value;
    setExceptionRules(updatedRules);
  };

  const exceptionTypeEditor = (options) => (
    <Dropdown
      value={options.value}
      options={exceptionTypeOptions}
      onChange={(e) => options.editorCallback(e.value)}
      style={{ width: '100%' }}
    />
  );

  const actionEditor = (options) => (
    <Dropdown
      value={options.value}
      options={actionOptions}
      onChange={(e) => options.editorCallback(e.value)}
      style={{ width: '100%' }}
    />
  );

  const roleEditor = (options) => (
    <Dropdown
      value={options.value}
      options={roleOptions}
      onChange={(e) => options.editorCallback(e.value)}
      style={{ width: '100%' }}
    />
  );

  const actionBodyTemplate = (rowData) => {
    return (
      <Button
        icon="pi pi-trash"
        className="p-button-rounded p-button-danger p-button-text"
        onClick={() => deleteExceptionRule(rowData)} aria-label="Delete" tooltip="Delete" tooltipOptions={{ position: "top" }} />
    );
  };

  return (
    <div className="automated-remittance-master">
      <div className="page-header">
        <BreadCrumb model={items} home={home} />
      </div>

      <Toast ref={toast} />
      <Card className="main-card">
        <div className="card-header">
          <h3>Remittance Reconciliation Master</h3>
          <div className="header-actions">
            <Button
              label={t("financeMasters.save")}
              icon="pi pi-save"
              className="p-button-sm p-button-success"
              onClick={handleSave}
              disabled={mode === "view"}
            />
            <Button
              label={t("common.cancel")}
              icon="pi pi-times"
              className="p-button-sm p-button-secondary"
              onClick={handleCancel}
            />
          </div>
        </div>

        <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
          <TabPanel header="General">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Reconciliation Rules
              </h4>
              <div className="form-grid three-column">
                <div className="form-field">
                  <label htmlFor="ruleCode">Rule Code *</label>
                  <InputText
                    id="ruleCode"
                    value={formData.ruleCode}
                    onChange={(e) => handleInputChange('ruleCode', e.target.value)}
                    disabled={mode === "edit" || mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="ruleName">Rule Name *</label>
                  <InputText
                    id="ruleName"
                    value={formData.ruleName}
                    onChange={(e) => handleInputChange('ruleName', e.target.value)}
                    disabled={mode === "view"}
                    className="w-full"
                  />
                </div>
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="isActive"
                    checked={formData.isActive}
                    onChange={(e) => handleInputChange('isActive', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="isActive" className="ml-2">Active</label>
                </div>
              </div>

              <h4 className="section-title mt-4">
                <SvgDot />
                Matching Criteria
              </h4>
              <div className="form-grid two-column">
                <div className="form-field">
                  <label>Match By</label>
                  <div className="checkbox-group">
                    <div className="checkbox-item">
                      <Checkbox
                        inputId="matchByPolicy"
                        checked={formData.matchByPolicy}
                        onChange={(e) => handleInputChange('matchByPolicy', e.checked)}
                        disabled={mode === "view"}
                      />
                      <label htmlFor="matchByPolicy" className="ml-2">Policy Number</label>
                    </div>
                    <div className="checkbox-item">
                      <Checkbox
                        inputId="matchByAmount"
                        checked={formData.matchByAmount}
                        onChange={(e) => handleInputChange('matchByAmount', e.checked)}
                        disabled={mode === "view"}
                      />
                      <label htmlFor="matchByAmount" className="ml-2">Amount</label>
                    </div>
                    <div className="checkbox-item">
                      <Checkbox
                        inputId="matchByDate"
                        checked={formData.matchByDate}
                        onChange={(e) => handleInputChange('matchByDate', e.checked)}
                        disabled={mode === "view"}
                      />
                      <label htmlFor="matchByDate" className="ml-2">Transaction Date</label>
                    </div>
                    <div className="checkbox-item">
                      <Checkbox
                        inputId="matchByReference"
                        checked={formData.matchByReference}
                        onChange={(e) => handleInputChange('matchByReference', e.checked)}
                        disabled={mode === "view"}
                      />
                      <label htmlFor="matchByReference" className="ml-2">Reference Number</label>
                    </div>
                  </div>
                </div>
                <div className="form-field">
                  <label>Tolerance Settings</label>
                  <div className="tolerance-fields">
                    <div className="sub-field">
                      <label htmlFor="amountTolerance">Amount Tolerance (%)</label>
                      <InputNumber
                        id="amountTolerance"
                        value={formData.amountTolerance}
                        onValueChange={(e) => handleInputChange('amountTolerance', e.value)}
                        mode="decimal"
                        minFractionDigits={2}
                        maxFractionDigits={2}
                        min={0}
                        max={10}
                        disabled={mode === "view"}
                        className="w-full"
                      />
                    </div>
                    <div className="sub-field">
                      <label htmlFor="dateTolerance">Date Tolerance (Days)</label>
                      <InputNumber
                        id="dateTolerance"
                        value={formData.dateTolerance}
                        onValueChange={(e) => handleInputChange('dateTolerance', e.value)}
                        min={0}
                        max={30}
                        disabled={mode === "view"}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Auto-Match Rules">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Automatic Matching Configuration
              </h4>
              <div className="form-grid single-column">
                <div className="form-field checkbox-field">
                  <Checkbox
                    inputId="enableAutoMatch"
                    checked={formData.enableAutoMatch}
                    onChange={(e) => handleInputChange('enableAutoMatch', e.checked)}
                    disabled={mode === "view"}
                  />
                  <label htmlFor="enableAutoMatch" className="ml-2">Enable Auto-Matching</label>
                </div>

                <div className="form-field">
                  <label htmlFor="confidenceLevel">Confidence Level (%) - {formData.confidenceLevel}%</label>
                  <Slider
                    id="confidenceLevel"
                    value={formData.confidenceLevel}
                    onChange={(e) => handleInputChange('confidenceLevel', e.value)}
                    min={50}
                    max={100}
                    step={5}
                    disabled={mode === "view" || !formData.enableAutoMatch}
                    className="w-full"
                  />
                  <small className="help-text">Minimum confidence level for auto-matching</small>
                </div>

                <div className="form-field">
                  <label>Matching Priority</label>
                  <div className="priority-list">
                    <div className="priority-item">
                      <span className="priority-number">1</span>
                      <span className="priority-label">Exact Match</span>
                    </div>
                    <div className="priority-item">
                      <span className="priority-number">2</span>
                      <span className="priority-label">Partial Match</span>
                    </div>
                    <div className="priority-item">
                      <span className="priority-number">3</span>
                      <span className="priority-label">Fuzzy Match</span>
                    </div>
                    <div className="priority-item">
                      <span className="priority-number">4</span>
                      <span className="priority-label">Manual Review</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="GL Mapping">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Reconciliation Accounts
              </h4>
              <div className="form-grid two-column">
                <div className="form-field">
                  <label htmlFor="suspenseAccount">Suspense Account *</label>
                  <MasterLookup
                    type="main-account"
                    value={formData.suspenseAccount}
                    onChange={(v) => handleInputChange("suspenseAccount", v)}
                    disabled={mode === "view"}
                    toast={toast}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="clearingAccount">Clearing Account *</label>
                  <MasterLookup
                    type="main-account"
                    value={formData.clearingAccount}
                    onChange={(v) => handleInputChange("clearingAccount", v)}
                    disabled={mode === "view"}
                    toast={toast}
                    className="w-full"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="differenceAccount">Difference Account *</label>
                  <MasterLookup
                    type="main-account"
                    value={formData.differenceAccount}
                    onChange={(v) => handleInputChange("differenceAccount", v)}
                    disabled={mode === "view"}
                    toast={toast}
                    className="w-full"
                  />
                  <small className="help-text">For unmatched differences</small>
                </div>
                <div className="form-field">
                  <label htmlFor="writeOffAccount">Write-off Account *</label>
                  <MasterLookup
                    type="main-account"
                    value={formData.writeOffAccount}
                    onChange={(v) => handleInputChange("writeOffAccount", v)}
                    disabled={mode === "view"}
                    toast={toast}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Exception Handling">
            <div className="form-section">
              <h4 className="section-title">
                <SvgDot />
                Exception Rules
              </h4>
              <div className="toolbar mb-3">
                <Button
                  label={t("remittance.addRule")}
                  icon="pi pi-plus"
                  className="p-button-sm"
                  onClick={addExceptionRule}
                  disabled={mode === "view"}
                />
              </div>
              <DataTable
                value={exceptionRules}
                editMode="cell"
                className="editable-cells-table"
              >
                <Column
                  field="exceptionType"
                  header="Exception Type"
                  editor={exceptionTypeEditor}
                  onCellEditComplete={onExceptionCellEdit}
                  style={{ width: '25%' }}
                />
                <Column
                  field="condition"
                  header="Condition"
                  editor={(options) => (
                    <InputText
                      type="text"
                      value={options.value}
                      onChange={(e) => options.editorCallback(e.target.value)}
                    />
                  )}
                  onCellEditComplete={onExceptionCellEdit}
                  style={{ width: '25%' }}
                />
                <Column
                  field="action"
                  header="Action"
                  editor={actionEditor}
                  onCellEditComplete={onExceptionCellEdit}
                  style={{ width: '25%' }}
                />
                <Column
                  field="notifyRole"
                  header="Notify"
                  editor={roleEditor}
                  onCellEditComplete={onExceptionCellEdit}
                  style={{ width: '20%' }}
                />
                <Column
                  body={actionBodyTemplate}
                  style={{ width: '5%' }}
                />
              </DataTable>
            </div>
          </TabPanel>
        </TabView>
      </Card>
    </div>
  );
};

export default ReconciliationMaster;