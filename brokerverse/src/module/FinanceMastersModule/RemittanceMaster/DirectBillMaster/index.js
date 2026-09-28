import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { TabView, TabPanel } from "primereact/tabview";
import { Card } from "primereact/card";
import { Button } from "primereact/button";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { InputNumber } from "primereact/inputnumber";
import { Checkbox } from "primereact/checkbox";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Toast } from "primereact/toast";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { directBillData, mockCrudOperations } from "../../../../services/mockData/remittanceMockData";
import "./index.scss";

const DirectBillMaster = () => {
  const { t } = useTranslation();
  const { currencyCode } = useFormatCurrency();
  const navigate = useNavigate();
  const { mode } = useParams();
  const location = useLocation();
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  const toast = React.useRef(null);

  // Initialize with mock data
  const mockConfig = directBillData.configurations[0];

  // Form states
  const [configCode, setConfigCode] = useState(isEditMode ? mockConfig.code : "");
  const [configName, setConfigName] = useState(isEditMode ? mockConfig.name : "");
  const [isActive, setIsActive] = useState(mockConfig.status === "Active");
  const [billMethod, setBillMethod] = useState(mockConfig.billMethod);
  const [billFrequency, setBillFrequency] = useState(mockConfig.frequency);
  const [paymentDueDays, setPaymentDueDays] = useState(mockConfig.dueDays);
  const [gracePeriod, setGracePeriod] = useState(mockConfig.lateFee.gracePeriod);
  const [applyLateCharges, setApplyLateCharges] = useState(mockConfig.lateFee.type !== "None");
  const [lateChargeType, setLateChargeType] = useState(mockConfig.lateFee.type);
  const [lateChargeValue, setLateChargeValue] = useState(mockConfig.lateFee.rate);
  const [minLateCharge, setMinLateCharge] = useState(mockConfig.lateFee.minimumCharge);

  // Active bills data from mock
  const [activeBills, setActiveBills] = useState(directBillData.activeBills);

  // Insurer setup data - converted from common insurers data
  const [insurers, setInsurers] = useState([
    {
      id: 1,
      insurerCode: "INS001",
      insurerName: "Allianz Insurance",
      billMethod: "Direct Bill",
      paymentTerms: 30,
      creditLimit: 500000,
      contactEmail: "billing@allianz.com",
      autoGenerate: true,
      active: true
    },
    {
      id: 2,
      insurerCode: "INS002",
      insurerName: "AXA Insurance",
      billMethod: "Policy-wise",
      paymentTerms: 45,
      creditLimit: 750000,
      contactEmail: "accounts@axa.com",
      autoGenerate: false,
      active: true
    },
    {
      id: 3,
      insurerCode: "INS003",
      insurerName: "MetLife",
      billMethod: "Account Current",
      paymentTerms: 30,
      creditLimit: 300000,
      contactEmail: "remittance@metlife.com",
      autoGenerate: true,
      active: true
    }
  ]);

  // GL Accounts from mock data
  const [receivableAccount, setReceivableAccount] = useState(mockConfig.glMapping.premium);
  const [premiumAccount, setPremiumAccount] = useState(mockConfig.glMapping.premium);
  const [lateChargeAccount, setLateChargeAccount] = useState(mockConfig.glMapping.lateFee);
  const [badDebtAccount, setBadDebtAccount] = useState(mockConfig.glMapping.refund);

  const billMethodOptions = [
    { label: "Policy-wise", value: "Policy-wise" },
    { label: "Insured-wise", value: "Insured-wise" },
    { label: "Period-wise", value: "Period-wise" },
    { label: "On-Demand", value: "On-Demand" }
  ];

  const frequencyOptions = [
    { label: "Monthly", value: "Monthly" },
    { label: "Quarterly", value: "Quarterly" },
    { label: "Semi-Annual", value: "Semi-Annual" },
    { label: "Annual", value: "Annual" }
  ];

  const lateChargeOptions = [
    { label: "Flat Amount", value: "Flat Amount" },
    { label: "Percentage", value: "Percentage" },
    { label: "Tiered", value: "Tiered" }
  ];

  const handleSave = async () => {
    try {
      const configData = {
        code: configCode,
        name: configName,
        billMethod,
        frequency: billFrequency,
        dueDays: paymentDueDays,
        lateFee: {
          type: applyLateCharges ? lateChargeType : "None",
          rate: lateChargeValue,
          minimumCharge: minLateCharge,
          gracePeriod
        },
        glMapping: {
          premium: premiumAccount,
          lateFee: lateChargeAccount,
          refund: badDebtAccount
        },
        status: isActive ? "Active" : "Inactive"
      };

      await mockCrudOperations.create("directBillConfiguration", configData);

      toast.current.show({
        severity: 'success',
        summary: 'Success',
        detail: 'Direct Bill Master configuration saved successfully',
        life: 3000
      });

      setTimeout(() => {
        navigate("/master/finance/remittance");
      }, 1500);
    } catch (error) {
      toast.current.show({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to save configuration',
        life: 3000
      });
    }
  };

  const handleCancel = () => {
    navigate("/master/finance/remittance");
  };

  const editInsurerTemplate = (rowData) => {
    if (isViewMode) return rowData.active ? "Yes" : "No";
    return (
      <Checkbox
        checked={rowData.active}
        onChange={(e) => {
          const updatedInsurers = insurers.map(ins =>
            ins.id === rowData.id ? { ...ins, active: e.checked } : ins
          );
          setInsurers(updatedInsurers);
        }}
      />
    );
  };

  const autoGenerateTemplate = (rowData) => {
    if (isViewMode) return rowData.autoGenerate ? "Yes" : "No";
    return (
      <Checkbox
        checked={rowData.autoGenerate}
        onChange={(e) => {
          const updatedInsurers = insurers.map(ins =>
            ins.id === rowData.id ? { ...ins, autoGenerate: e.checked } : ins
          );
          setInsurers(updatedInsurers);
        }}
      />
    );
  };

  return (
    <div className="direct-bill-master">
      <Toast ref={toast} />
      <div className="header-section">
        <h2>Direct Bill Processing Master - {mode?.charAt(0).toUpperCase() + mode?.slice(1)}</h2>
      </div>

      <Card>
        <TabView>
          <TabPanel header="Configuration">
            <div className="form-section">
              <h3>Direct Bill Settings</h3>
              <div className="grid">
                <div className="col-12 md:col-4">
                  <label>Config Code *</label>
                  <InputText
                    value={configCode}
                    onChange={(e) => setConfigCode(e.target.value)}
                    disabled={isViewMode}
                    placeholder={t("remittance.placeholderDbl")}
                    className="w-full"
                  />
                </div>
                <div className="col-12 md:col-4">
                  <label>Config Name *</label>
                  <InputText
                    value={configName}
                    onChange={(e) => setConfigName(e.target.value)}
                    disabled={isViewMode}
                    className="w-full"
                  />
                </div>
                <div className="col-12 md:col-4">
                  <label>Active</label>
                  <div className="checkbox-container">
                    <Checkbox
                      checked={isActive}
                      onChange={(e) => setIsActive(e.checked)}
                      disabled={isViewMode}
                    />
                    <span className="ml-2">Active</span>
                  </div>
                </div>
              </div>

              <h3 className="mt-4">Billing Parameters</h3>
              <div className="grid">
                <div className="col-12 md:col-6">
                  <label>Bill Generation Method</label>
                  <Dropdown
                    value={billMethod}
                    options={billMethodOptions}
                    onChange={(e) => setBillMethod(e.value)}
                    disabled={isViewMode}
                    className="w-full"
                  />
                </div>
                <div className="col-12 md:col-6">
                  <label>Bill Frequency</label>
                  <Dropdown
                    value={billFrequency}
                    options={frequencyOptions}
                    onChange={(e) => setBillFrequency(e.value)}
                    disabled={isViewMode}
                    className="w-full"
                  />
                </div>
                <div className="col-12 md:col-6">
                  <label>Payment Due Days</label>
                  <InputNumber
                    value={paymentDueDays}
                    onValueChange={(e) => setPaymentDueDays(e.value)}
                    disabled={isViewMode}
                    min={1}
                    max={90}
                    suffix=" days"
                    className="w-full"
                  />
                </div>
                <div className="col-12 md:col-6">
                  <label>Grace Period (Days)</label>
                  <InputNumber
                    value={gracePeriod}
                    onValueChange={(e) => setGracePeriod(e.value)}
                    disabled={isViewMode}
                    min={0}
                    max={30}
                    suffix=" days"
                    className="w-full"
                  />
                </div>
              </div>

              <h3 className="mt-4">Late Payment Settings</h3>
              <div className="grid">
                <div className="col-12 md:col-6">
                  <label>Apply Late Charges</label>
                  <div className="checkbox-container">
                    <Checkbox
                      checked={applyLateCharges}
                      onChange={(e) => setApplyLateCharges(e.checked)}
                      disabled={isViewMode}
                    />
                    <span className="ml-2">Apply Late Charges</span>
                  </div>
                </div>
                {applyLateCharges && (
                  <>
                    <div className="col-12 md:col-6">
                      <label>Late Charge Type</label>
                      <Dropdown
                        value={lateChargeType}
                        options={lateChargeOptions}
                        onChange={(e) => setLateChargeType(e.value)}
                        disabled={isViewMode}
                        className="w-full"
                      />
                    </div>
                    <div className="col-12 md:col-6">
                      <label>Late Charge Amount/Rate</label>
                      <InputNumber
                        value={lateChargeValue}
                        onValueChange={(e) => setLateChargeValue(e.value)}
                        disabled={isViewMode}
                        prefix={lateChargeType === "Percentage" ? "" : "$"}
                        suffix={lateChargeType === "Percentage" ? "%" : ""}
                        minFractionDigits={2}
                        maxFractionDigits={2}
                        className="w-full"
                      />
                    </div>
                    <div className="col-12 md:col-6">
                      <label>Minimum Late Charge</label>
                      <InputNumber
                        value={minLateCharge}
                        onValueChange={(e) => setMinLateCharge(e.value)}
                        disabled={isViewMode}
                        mode="currency"
                        currency={currencyCode}
                        className="w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Insurer Setup">
            <div className="insurer-setup-section">
              <div className="toolbar mb-3">
                <Button
                  label={t("remittance.addInsurer")}
                  icon="pi pi-plus"
                  className="p-button-primary mr-2"
                  disabled={isViewMode}
                />
                <Button
                  label={t("common.import")}
                  icon="pi pi-upload"
                  className="p-button-secondary"
                  disabled={isViewMode}
                />
              </div>

              <DataTable value={insurers} className="insurer-grid" stripedRows>
                <Column field="insurerCode" header="Insurer Code" style={{ width: "10%" }} />
                <Column field="insurerName" header="Insurer Name" style={{ width: "20%" }} />
                <Column field="billMethod" header="Bill Method" style={{ width: "12%" }} />
                <Column field="paymentTerms" header="Payment Terms" style={{ width: "10%" }}
                  body={(rowData) => `${rowData.paymentTerms} days`} />
                <Column field="creditLimit" header="Credit Limit" style={{ width: "12%" }}
                  body={(rowData) => `$${rowData.creditLimit.toLocaleString()}`} />
                <Column field="contactEmail" header="Contact Email" style={{ width: "15%" }} />
                <Column field="autoGenerate" header="Auto Generate" style={{ width: "8%" }}
                  body={autoGenerateTemplate} />
                <Column field="active" header="Active" style={{ width: "8%" }}
                  body={editInsurerTemplate} />
                {!isViewMode && (
                  <Column header="" style={{ width: "5%" }}
                    body={() => (
                      <Button icon="pi pi-trash" className="p-button-text p-button-danger" />
                    )}
                  />
                )}
              </DataTable>
            </div>
          </TabPanel>

          <TabPanel header="GL Mapping">
            <div className="gl-mapping-section">
              <h3>Direct Bill GL Configuration</h3>
              <div className="grid">
                <div className="col-12 md:col-6">
                  <label>Receivable Account *</label>
                  <div className="p-inputgroup">
                    <InputText
                      value={receivableAccount}
                      onChange={(e) => setReceivableAccount(e.target.value)}
                      disabled={isViewMode}
                      className="w-full"
                    />
                    <Button icon="pi pi-search" disabled={isViewMode} />
                  </div>
                </div>
                <div className="col-12 md:col-6">
                  <label>Premium Account *</label>
                  <div className="p-inputgroup">
                    <InputText
                      value={premiumAccount}
                      onChange={(e) => setPremiumAccount(e.target.value)}
                      disabled={isViewMode}
                      className="w-full"
                    />
                    <Button icon="pi pi-search" disabled={isViewMode} />
                  </div>
                </div>
                <div className="col-12 md:col-6">
                  <label>Late Charge Account *</label>
                  <div className="p-inputgroup">
                    <InputText
                      value={lateChargeAccount}
                      onChange={(e) => setLateChargeAccount(e.target.value)}
                      disabled={isViewMode}
                      className="w-full"
                    />
                    <Button icon="pi pi-search" disabled={isViewMode} />
                  </div>
                </div>
                <div className="col-12 md:col-6">
                  <label>Bad Debt Account *</label>
                  <div className="p-inputgroup">
                    <InputText
                      value={badDebtAccount}
                      onChange={(e) => setBadDebtAccount(e.target.value)}
                      disabled={isViewMode}
                      className="w-full"
                    />
                    <Button icon="pi pi-search" disabled={isViewMode} />
                  </div>
                </div>
              </div>
            </div>
          </TabPanel>

          <TabPanel header="Active Bills">
            <div className="active-bills-section">
              <div className="toolbar mb-3">
                <Button
                  label={t("remittance.generateBill")}
                  icon="pi pi-plus"
                  className="p-button-primary mr-2"
                  disabled={isViewMode}
                />
                <Button
                  label={t("remittance.sendReminders")}
                  icon="pi pi-send"
                  className="p-button-secondary"
                  disabled={isViewMode}
                />
              </div>

              <DataTable value={activeBills} stripedRows>
                <Column field="billNo" header="Bill No" style={{ width: "15%" }} />
                <Column field="policyNo" header="Policy No" style={{ width: "15%" }} />
                <Column field="insured" header="Insured" style={{ width: "20%" }} />
                <Column field="billDate" header="Bill Date" style={{ width: "12%" }} />
                <Column field="dueDate" header="Due Date" style={{ width: "12%" }} />
                <Column
                  field="premium"
                  header="Premium"
                  style={{ width: "12%" }}
                  body={(rowData) => `$${rowData.premium.toLocaleString()}`}
                />
                <Column field="installment" header="Installment" style={{ width: "10%" }} />
                <Column
                  field="status"
                  header="Status"
                  style={{ width: "8%" }}
                  body={(rowData) => (
                    <span className={`status-badge ${rowData.status.toLowerCase()}`}>
                      {rowData.status}
                    </span>
                  )}
                />
                {!isViewMode && (
                  <Column
                    header="Actions"
                    style={{ width: "10%" }}
                    body={() => (
                      <div>
                        <Button icon="pi pi-eye" className="p-button-text p-button-sm mr-1" />
                        <Button icon="pi pi-send" className="p-button-text p-button-sm" />
                      </div>
                    )}
                  />
                )}
              </DataTable>
            </div>
          </TabPanel>
        </TabView>

        <div className="action-buttons mt-4">
          {!isViewMode && (
            <Button
              label={t("financeMasters.save")}
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

export default DirectBillMaster;