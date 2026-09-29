import React, { useState, useEffect } from "react";
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
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import SvgSearchIcon from "../../../../assets/icons/SvgSearchIcon";
import "./index.scss";

const SettlementParameterMaster = () => {
  const { t } = useTranslation();
  const { currencyCode } = useFormatCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};

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
        setFormData({
          paramCode: data.code || "STP-001",
          paramName: data.name || "Regular Settlement",
          settlementType: "Regular",
          autoCalculate: true,
          level1Limit: 50000.00,
          level2Limit: 100000.00,
          level3Limit: 500000.00,
          payableAccount: "GL-PAY-001",
          clearingAccount: "GL-CLR-001",
          commissionAccount: "GL-COM-001",
          taxAccount: "GL-TAX-001",
        });
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

  const handleSave = () => {
    console.log("Saving settlement parameters:", formData);
    // Add save logic here
    navigate("/master/finance/remittance");
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete these settlement parameters?")) {
      console.log("Deleting settlement parameters:", formData.paramCode);
      // Add delete logic here
      navigate("/master/finance/remittance");
    }
  };

  const handleClose = () => {
    navigate("/master/finance/remittance");
  };

  const openAccountLookup = (accountType) => {
    console.log(`Opening ${accountType} account lookup`);
    // Add lookup modal logic here
  };

  const isViewMode = mode === "view";

  return (
    <div className="container__settlement__parameter__master">
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
                    <div className="input-with-button">
                      <InputText
                        id="payableAccount"
                        value={formData.payableAccount}
                        onChange={(e) => handleInputChange("payableAccount", e.target.value)}
                        disabled={isViewMode}
                        placeholder={t("remittance.selectPayableAccount")}
                        className="full-width"
                      />
                      {!isViewMode && (
                        <Button
                          icon={<SvgSearchIcon />}
                          className="lookup-button"
                          onClick={() => openAccountLookup("payable")}
                        />
                      )}
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="clearingAccount" className="required">Settlement Clearing Account</label>
                    <div className="input-with-button">
                      <InputText
                        id="clearingAccount"
                        value={formData.clearingAccount}
                        onChange={(e) => handleInputChange("clearingAccount", e.target.value)}
                        disabled={isViewMode}
                        placeholder="Select clearing account"
                        className="full-width"
                      />
                      {!isViewMode && (
                        <Button
                          icon={<SvgSearchIcon />}
                          className="lookup-button"
                          onClick={() => openAccountLookup("clearing")}
                        />
                      )}
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="commissionAccount" className="required">Commission Account</label>
                    <div className="input-with-button">
                      <InputText
                        id="commissionAccount"
                        value={formData.commissionAccount}
                        onChange={(e) => handleInputChange("commissionAccount", e.target.value)}
                        disabled={isViewMode}
                        placeholder={t("remittance.selectCommissionAccount")}
                        className="full-width"
                      />
                      {!isViewMode && (
                        <Button
                          icon={<SvgSearchIcon />}
                          className="lookup-button"
                          onClick={() => openAccountLookup("commission")}
                        />
                      )}
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="taxAccount" className="required">Tax Account</label>
                    <div className="input-with-button">
                      <InputText
                        id="taxAccount"
                        value={formData.taxAccount}
                        onChange={(e) => handleInputChange("taxAccount", e.target.value)}
                        disabled={isViewMode}
                        placeholder={t("remittance.selectTaxAccount")}
                        className="full-width"
                      />
                      {!isViewMode && (
                        <Button
                          icon={<SvgSearchIcon />}
                          className="lookup-button"
                          onClick={() => openAccountLookup("tax")}
                        />
                      )}
                    </div>
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