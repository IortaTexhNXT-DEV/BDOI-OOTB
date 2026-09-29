import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFormatCurrency } from "../../../../hooks/useFormatCurrency";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { TabView, TabPanel } from "primereact/tabview";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import { Toast } from "primereact/toast";
import { MasterLookup, deleteAndReturn, saveAndReturn } from "../masterRecord";
import "./index.scss";
import { confirmAction } from "../../../../utility/dialogs";

const SettlementParameterMaster = () => {
  const { t } = useTranslation();
  const { currencyCode } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = useRef(null);
  const TYPE = "remittance-settlement-parameter";

  const [activeIndex, setActiveIndex] = useState(0);
  const [formData, setFormData] = useState({
    paramCode: "",
    paramName: "",
    settlementType: null,
    autoCalculate: true,
    level1Limit: 50000.00,
    level2Limit: 100000.00,
    level3Limit: 500000.00,
    payableAccount: "",
    clearingAccount: "",
    commissionAccount: "",
    taxAccount: "",
  });

  const settlementTypes = [
    { label: "Regular", value: "Regular" },
    { label: "Provisional", value: "Provisional" },
    { label: "Final", value: "Final" },
    { label: "Adjustment", value: "Adjustment" },
  ];

  const items = [
    { label: "Finance", url: "#" },
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Settlement Parameters", url: "#" },
  ];

  const home = { label: "Master", url: "#" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      // Load existing data
      if (data) {
        const levels = data.approvalLevels || [];
        setFormData((prev) => ({
          ...prev,
          ...(data.form || {}),
          paramCode: data.code,
          paramName: data.name,
          level1Limit: levels[0]?.maxAmount ?? prev.level1Limit,
          level2Limit: levels[1]?.maxAmount ?? prev.level2Limit,
          level3Limit: levels[2]?.maxAmount ?? data.maximumAmount ?? prev.level3Limit,
          payableAccount: data.form?.payableAccount || data.glAccounts?.debit || "",
          clearingAccount: data.form?.clearingAccount || data.glAccounts?.credit || "",
        }));
      }
    } else {
      // Generate new code for add mode
      setFormData(prev => ({
        ...prev,
        paramCode: generateCode()
      }));
    }
  }, [mode, data]);

  const generateCode = () => {
    const random = Math.floor(Math.random() * 1000);
    return `STP-${String(random).padStart(3, '0')}`;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => saveAndReturn({
    type: TYPE,
    id: data?.id,
    toast,
    navigate,
    record: {
      code: formData.paramCode,
      name: formData.paramName,
      approvalLevels: [formData.level1Limit, formData.level2Limit, formData.level3Limit].map((maxAmount, i) => ({ level: i + 1, maxAmount })),
      maximumAmount: formData.level3Limit,
      glAccounts: { debit: formData.payableAccount, credit: formData.clearingAccount },
      form: formData
    }
  });

  const handleDelete = async () => {
    if (await confirmAction("Are you sure you want to delete these settlement parameters?", { danger: true })) {
      deleteAndReturn({ type: TYPE, id: data?.id, toast, navigate });
    }
  };

  const handleClose = () => {
    navigate("/master/finance/remittance");
  };

  const isViewMode = mode === "view";

  return (
    <div className="container__settlement__parameter__master">
        <Toast ref={toast} />
        <div className="top__container">
          <div className="header-actions">
            <Button
              icon={<SvgBackArrow />}
              className="back-button"
              onClick={handleClose}
              text
            />
            <h1 className="page__title">Settlement Parameter Master</h1>
            <span className="mode-badge">{mode?.toUpperCase() || "ADD"}</span>
          </div>
          <BreadCrumb model={items} home={home} />
        </div>

        <div className="content-container">
          <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
            <TabPanel header="Parameters">
              <div className="tab-content">
                <div className="section-title">Settlement Rules</div>
                <div className="form-grid two-column">
                  <div className="form-field">
                    <label htmlFor="paramCode" className="required">Parameter Code</label>
                    <InputText
                      id="paramCode"
                      value={formData.paramCode}
                      onChange={(e) => handleInputChange("paramCode", e.target.value)}
                      disabled={isViewMode || mode === "edit"}
                      placeholder={t("remittance.placeholderStp")}
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="paramName" className="required">Parameter Name</label>
                    <InputText
                      id="paramName"
                      value={formData.paramName}
                      onChange={(e) => handleInputChange("paramName", e.target.value)}
                      disabled={isViewMode}
                      placeholder={t("remittance.enterParameterName")}
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="settlementType" className="required">Settlement Type</label>
                    <Dropdown
                      id="settlementType"
                      value={formData.settlementType}
                      options={settlementTypes}
                      onChange={(e) => handleInputChange("settlementType", e.value)}
                      disabled={isViewMode}
                      placeholder={t("remittance.selectSettlementType")}
                      className="full-width"
                    />
                  </div>

                  <div className="form-field checkbox-field">
                    <div className="checkbox-wrapper">
                      <Checkbox
                        inputId="autoCalculate"
                        checked={formData.autoCalculate}
                        onChange={(e) => handleInputChange("autoCalculate", e.checked)}
                        disabled={isViewMode}
                      />
                      <label htmlFor="autoCalculate" className="checkbox-label">Auto Calculate</label>
                    </div>
                  </div>
                </div>

                <div className="section-title">Approval Limits</div>
                <div className="form-grid three-column">
                  <div className="form-field">
                    <label htmlFor="level1Limit">
                      Level 1 Limit
                      <span className="help-text">Supervisor approval</span>
                    </label>
                    <InputNumber
                      id="level1Limit"
                      value={formData.level1Limit}
                      onValueChange={(e) => handleInputChange("level1Limit", e.value)}
                      disabled={isViewMode}
                      mode="currency"
                      currency={currencyCode}
                      locale="en-US"
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="level2Limit">
                      Level 2 Limit
                      <span className="help-text">Manager approval</span>
                    </label>
                    <InputNumber
                      id="level2Limit"
                      value={formData.level2Limit}
                      onValueChange={(e) => handleInputChange("level2Limit", e.value)}
                      disabled={isViewMode}
                      mode="currency"
                      currency={currencyCode}
                      locale="en-US"
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="level3Limit">
                      Level 3 Limit
                      <span className="help-text">Director approval</span>
                    </label>
                    <InputNumber
                      id="level3Limit"
                      value={formData.level3Limit}
                      onValueChange={(e) => handleInputChange("level3Limit", e.value)}
                      disabled={isViewMode}
                      mode="currency"
                      currency={currencyCode}
                      locale="en-US"
                      className="full-width"
                    />
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel header="GL Accounts">
              <div className="tab-content">
                <div className="section-title">Settlement GL Configuration</div>
                <div className="form-grid two-column">
                  <div className="form-field">
                    <label htmlFor="payableAccount" className="required">Settlement Payable Account</label>
                    <MasterLookup
                      type="main-account"
                      value={formData.payableAccount}
                      onChange={(v) => handleInputChange("payableAccount", v)}
                      disabled={isViewMode}
                      placeholder={t("remittance.selectPayableAccount")}
                      toast={toast}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="clearingAccount" className="required">Settlement Clearing Account</label>
                    <MasterLookup
                      type="main-account"
                      value={formData.clearingAccount}
                      onChange={(v) => handleInputChange("clearingAccount", v)}
                      disabled={isViewMode}
                      placeholder={"Select clearing account"}
                      toast={toast}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="commissionAccount" className="required">Commission Account</label>
                    <MasterLookup
                      type="main-account"
                      value={formData.commissionAccount}
                      onChange={(v) => handleInputChange("commissionAccount", v)}
                      disabled={isViewMode}
                      placeholder={t("remittance.selectCommissionAccount")}
                      toast={toast}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="taxAccount" className="required">Tax Account</label>
                    <MasterLookup
                      type="main-account"
                      value={formData.taxAccount}
                      onChange={(v) => handleInputChange("taxAccount", v)}
                      disabled={isViewMode}
                      placeholder={t("remittance.selectTaxAccount")}
                      toast={toast}
                    />
                  </div>
                </div>

                <div className="info-box">
                  <i className="pi pi-info-circle"></i>
                  <div>
                    <strong>GL Account Configuration</strong>
                    <p>These accounts will be used as default values when processing settlements.
                       They can be overridden during individual settlement processing if needed.</p>
                  </div>
                </div>
              </div>
            </TabPanel>
          </TabView>

          <div className="action-buttons">
            {!isViewMode && (
              <Button
                label={t("financeMasters.save")}
                className="save-button"
                onClick={handleSave}
              />
            )}
            {mode === "edit" && (
              <Button
                label={t("common.delete")}
                className="delete-button"
                onClick={handleDelete}
              />
            )}
            <Button
              label={t("common.close")}
              className="close-button"
              onClick={handleClose}
            />
          </div>
        </div>
      </div>
  );
};

export default SettlementParameterMaster;