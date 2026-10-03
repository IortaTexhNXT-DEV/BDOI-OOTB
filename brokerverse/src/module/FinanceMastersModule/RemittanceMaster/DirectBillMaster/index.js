import React, { useEffect, useState } from "react";
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
import remittanceService, { masterService } from "../../../../services/remittanceService";
import { showError, showSuccess } from "../../../Remittance/shared";
import { MasterLookup, saveAndReturn } from "../masterRecord";
import { formatDate as formatAppDate } from "../../../../utility/dateFormat";
import "./index.scss";

const DirectBillMaster = () => {
  const { t } = useTranslation();
  const { currencyCode, formatCurrency } = useFormatCurrency();
  const navigate = useNavigate();
  const { mode } = useParams();
  const location = useLocation();
  const isViewMode = mode === "view";
  const toast = React.useRef(null);

  const cfg = location.state?.data || {};
  const lateFee = cfg.lateFee || {};
  const glMapping = cfg.glMapping || {};

  // Form states
  const [configCode, setConfigCode] = useState(cfg.code || "");
  const [configName, setConfigName] = useState(cfg.name || "");
  const [isActive, setIsActive] = useState(cfg.status === undefined ? true : cfg.status === true || cfg.status === "Active");
  const [billMethod, setBillMethod] = useState(cfg.billMethod || null);
  const [billFrequency, setBillFrequency] = useState(cfg.frequency || null);
  const [paymentDueDays, setPaymentDueDays] = useState(cfg.dueDays ?? 30);
  const [gracePeriod, setGracePeriod] = useState(lateFee.gracePeriod ?? 0);
  const [applyLateCharges, setApplyLateCharges] = useState(Boolean(lateFee.type) && lateFee.type !== "None");
  const [lateChargeType, setLateChargeType] = useState(lateFee.type && lateFee.type !== "None" ? lateFee.type : "Percentage");
  const [lateChargeValue, setLateChargeValue] = useState(lateFee.rate ?? 0);
  const [minLateCharge, setMinLateCharge] = useState(lateFee.minimumCharge ?? 0);

  const [activeBills, setActiveBills] = useState([]);
  const [insurers, setInsurers] = useState([]);

  const [receivableAccount, setReceivableAccount] = useState(glMapping.receivable || "");
  const [premiumAccount, setPremiumAccount] = useState(glMapping.premium || "");
  const [lateChargeAccount, setLateChargeAccount] = useState(glMapping.lateFee || "");
  const [badDebtAccount, setBadDebtAccount] = useState(glMapping.refund || "");

  // open commission debit notes to insurers (direct bill: the client pays the insurer)
  const loadBills = () => remittanceService.listDirectBills({ perPage: 200, status: "open,partial" })
    .then((rows) => setActiveBills(rows || []))
    .catch((error) => showError(toast, error));

  useEffect(() => {
    const setup = cfg.insurerSetup || [];
    masterService.options("insurance-company")
      .then((rows) => setInsurers(rows.map((r) => ({
        id: r.id,
        insurerCode: r.code,
        insurerName: r.label,
        billMethod: cfg.billMethod || "",
        paymentTerms: cfg.dueDays ?? 30,
        creditLimit: 0,
        contactEmail: "",
        autoGenerate: false,
        active: true,
        ...(setup.find((x) => x.insurerCode === r.code) || {})
      }))))
      .catch((error) => showError(toast, error));
    loadBills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const handleSave = () => saveAndReturn({
    type: "remittance-direct-bill",
    id: cfg.id,
    toast,
    navigate,
    record: {
      code: configCode,
      name: configName,
      isActive,
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
        receivable: receivableAccount,
        premium: premiumAccount,
        lateFee: lateChargeAccount,
        refund: badDebtAccount
      },
      insurerSetup: insurers.map(({ id, ...rest }) => rest)
    }
  });

  const sendBills = async (bills) => {
    try {
      await Promise.all(bills.map((b) => remittanceService.sendDebitNote(b.id)));
      showSuccess(toast, `${bills.length} debit note(s) sent`);
      loadBills();
    } catch (error) {
      showError(toast, error);
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
              <DataTable value={insurers} className="insurer-grid" stripedRows>
                <Column field="insurerCode" header="Insurer Code" style={{ width: "10%" }} />
                <Column field="insurerName" header="Insurer Name" style={{ width: "20%" }} />
                <Column field="billMethod" header="Bill Method" style={{ width: "12%" }} />
                <Column field="paymentTerms" header="Payment Terms" style={{ width: "10%" }}
                  body={(rowData) => `${rowData.paymentTerms} days`} />
                <Column field="creditLimit" header="Credit Limit" style={{ width: "12%" }}
                  body={(rowData) => formatCurrency(rowData.creditLimit)} />
                <Column field="contactEmail" header="Contact Email" style={{ width: "15%" }} />
                <Column field="autoGenerate" header="Auto Generate" style={{ width: "8%" }}
                  body={autoGenerateTemplate} />
                <Column field="active" header="Active" style={{ width: "8%" }}
                  body={editInsurerTemplate} />
                {!isViewMode && (
                  <Column header="" style={{ width: "5%" }}
                    body={() => (
                      <Button icon="pi pi-trash" className="p-button-text p-button-danger" aria-label="Delete" tooltip="Delete" tooltipOptions={{ position: "top" }} />
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
                  <MasterLookup type="main-account" value={receivableAccount} onChange={setReceivableAccount} disabled={isViewMode} toast={toast} className="w-full" />
                </div>
                <div className="col-12 md:col-6">
                  <label>Premium Account *</label>
                  <MasterLookup type="main-account" value={premiumAccount} onChange={setPremiumAccount} disabled={isViewMode} toast={toast} className="w-full" />
                </div>
                <div className="col-12 md:col-6">
                  <label>Late Charge Account *</label>
                  <MasterLookup type="main-account" value={lateChargeAccount} onChange={setLateChargeAccount} disabled={isViewMode} toast={toast} className="w-full" />
                </div>
                <div className="col-12 md:col-6">
                  <label>Bad Debt Account *</label>
                  <MasterLookup type="main-account" value={badDebtAccount} onChange={setBadDebtAccount} disabled={isViewMode} toast={toast} className="w-full" />
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
                  onClick={() => navigate("/finance/remittance/directbill")}
                />
                <Button
                  label={t("remittance.sendReminders")}
                  icon="pi pi-send"
                  className="p-button-secondary"
                  disabled={isViewMode || !activeBills.length}
                  onClick={() => sendBills(activeBills)}
                />
              </div>

              <DataTable value={activeBills} stripedRows>
                <Column field="dnNumber" header="Debit Note" style={{ width: "14%" }} />
                <Column field="insurerName" header="Insurer" style={{ width: "20%" }} />
                <Column field="policyCount" header="Policies" style={{ width: "8%" }} />
                <Column body={(row) => formatAppDate(row.dnDate)} field="dnDate" header="Date" style={{ width: "11%" }} />
                <Column body={(row) => formatAppDate(row.dueDate)} field="dueDate" header="Due Date" style={{ width: "11%" }} />
                <Column
                  field="amount"
                  header="Amount Due"
                  style={{ width: "12%" }}
                  body={(rowData) => formatCurrency(rowData.amount)}
                />
                <Column
                  field="balance"
                  header="Balance"
                  style={{ width: "10%" }}
                  body={(rowData) => formatCurrency(rowData.balance)}
                />
                <Column
                  field="status"
                  header="Status"
                  style={{ width: "8%" }}
                  body={(rowData) => (
                    <span className={`status-badge ${String(rowData.status).toLowerCase().replace(/\s+/g, "-")}`}>
                      {rowData.status}
                    </span>
                  )}
                />
                {!isViewMode && (
                  <Column
                    header="Actions"
                    style={{ width: "10%" }}
                    body={(rowData) => (
                      <div>
                        <Button icon="pi pi-send" className="p-button-text p-button-sm" onClick={() => sendBills([rowData])} aria-label="Send" tooltip="Send" tooltipOptions={{ position: "top" }} />
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