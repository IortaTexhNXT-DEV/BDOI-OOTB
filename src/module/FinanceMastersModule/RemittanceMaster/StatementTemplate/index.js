import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { TabView, TabPanel } from "primereact/tabview";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { InputTextarea } from "primereact/inputtextarea";
import { InputNumber } from "primereact/inputnumber";
import { PickList } from "primereact/picklist";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import SvgBackArrow from "../../../../assets/icons/SvgBackArrow";
import "./index.scss";

const StatementTemplateMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};

  const [activeIndex, setActiveIndex] = useState(0);
  const [formData, setFormData] = useState({
    templateCode: "",
    templateName: "",
    statementType: null,
    isActive: true,
    showLogo: true,
    showAddress: true,
    headerText: "",
    showTotals: true,
    signatureLines: 2,
    termsConditions: "",
  });

  const [availableColumns, setAvailableColumns] = useState([
    { name: "Policy Number", code: "policyNo" },
    { name: "Insured Name", code: "insuredName" },
    { name: "Product", code: "product" },
    { name: "Effective Date", code: "effectiveDate" },
    { name: "Premium", code: "premium" },
    { name: "Commission Rate", code: "commissionRate" },
    { name: "Commission Amount", code: "commissionAmount" },
    { name: "Service Tax", code: "serviceTax" },
    { name: "Net Amount", code: "netAmount" },
    { name: "Policy Status", code: "policyStatus" },
    { name: "Branch", code: "branch" },
    { name: "Agent Code", code: "agentCode" },
  ]);

  const [selectedColumns, setSelectedColumns] = useState([]);

  const statementTypes = [
    { label: "Monthly", value: "Monthly" },
    { label: "Quarterly", value: "Quarterly" },
    { label: "Annual", value: "Annual" },
    { label: "Custom", value: "Custom" },
  ];

  const items = [
    { label: "Finance", url: "#" },
    { label: "Remittance Master", url: "/master/finance/remittance" },
    { label: "Statement Template", url: "#" },
  ];

  const home = { label: "Master", url: "#" };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      // Load existing data
      if (data) {
        setFormData({
          templateCode: data.code || "STM-001",
          templateName: data.name || "Standard Statement Template",
          statementType: "Monthly",
          isActive: data.status || true,
          showLogo: true,
          showAddress: true,
          headerText: "Monthly Remittance Statement",
          showTotals: true,
          signatureLines: 2,
          termsConditions: "This statement is subject to the terms and conditions of the remittance agreement.",
        });

        // Set some default selected columns for demo
        setSelectedColumns([
          { name: "Policy Number", code: "policyNo" },
          { name: "Insured Name", code: "insuredName" },
          { name: "Premium", code: "premium" },
          { name: "Commission Amount", code: "commissionAmount" },
          { name: "Net Amount", code: "netAmount" },
        ]);

        setAvailableColumns(prev => prev.filter(col =>
          !["policyNo", "insuredName", "premium", "commissionAmount", "netAmount"].includes(col.code)
        ));
      }
    } else {
      // Generate new code for add mode
      setFormData(prev => ({
        ...prev,
        templateCode: generateCode()
      }));
    }
  }, [mode, data]);

  const generateCode = () => {
    const random = Math.floor(Math.random() * 1000);
    return `STM-${String(random).padStart(3, '0')}`;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    console.log("Saving statement template:", formData);
    console.log("Selected columns:", selectedColumns);
    // Add save logic here
    navigate("/master/finance/remittance");
  };

  const handleDelete = () => {
    if (window.confirm("Are you sure you want to delete this statement template?")) {
      console.log("Deleting statement template:", formData.templateCode);
      // Add delete logic here
      navigate("/master/finance/remittance");
    }
  };

  const handleClose = () => {
    navigate("/master/finance/remittance");
  };

  const isViewMode = mode === "view";

  const columnItemTemplate = (item) => {
    return (
      <div className="column-item">
        <span>{item.name}</span>
      </div>
    );
  };

  return (
    <div className="container__statement__template__master">
        <div className="top__container">
          <div className="header-actions">
            <Button
              icon={<SvgBackArrow />}
              className="back-button"
              onClick={handleClose}
              text
            />
            <h1 className="page__title">Statement Template Master</h1>
            <span className="mode-badge">{mode?.toUpperCase() || "ADD"}</span>
          </div>
          <BreadCrumb model={items} home={home} />
        </div>

        <div className="content-container">
          <div className="content-section">
          <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
            <TabPanel header="Template Configuration">
              <div className="tab-content">
                <div className="section-title">Template Details</div>
                <div className="form-grid two-column">
                  <div className="form-field">
                    <label htmlFor="templateCode" className="required">Template Code</label>
                    <InputText
                      id="templateCode"
                      value={formData.templateCode}
                      onChange={(e) => handleInputChange("templateCode", e.target.value)}
                      disabled={isViewMode || mode === "edit"}
                      placeholder={t("remittance.placeholderStm")}
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="templateName" className="required">Template Name</label>
                    <InputText
                      id="templateName"
                      value={formData.templateName}
                      onChange={(e) => handleInputChange("templateName", e.target.value)}
                      disabled={isViewMode}
                      placeholder={t("remittance.enterTemplateName")}
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="statementType" className="required">Statement Type</label>
                    <Dropdown
                      id="statementType"
                      value={formData.statementType}
                      options={statementTypes}
                      onChange={(e) => handleInputChange("statementType", e.value)}
                      disabled={isViewMode}
                      placeholder="Select statement type"
                      className="full-width"
                    />
                  </div>

                  <div className="form-field checkbox-field">
                    <div className="checkbox-wrapper">
                      <Checkbox
                        inputId="isActive"
                        checked={formData.isActive}
                        onChange={(e) => handleInputChange("isActive", e.checked)}
                        disabled={isViewMode}
                      />
                      <label htmlFor="isActive" className="checkbox-label">Active</label>
                    </div>
                  </div>
                </div>

                <div className="section-title">Column Configuration</div>
                <div className="column-selector">
                  <PickList
                    source={availableColumns}
                    target={selectedColumns}
                    onChange={(e) => {
                      setAvailableColumns(e.source);
                      setSelectedColumns(e.target);
                    }}
                    itemTemplate={columnItemTemplate}
                    sourceHeader="Available Columns"
                    targetHeader="Selected Columns"
                    sourceStyle={{ height: '300px' }}
                    targetStyle={{ height: '300px' }}
                    showSourceControls={false}
                    showTargetControls={false}
                    disabled={isViewMode}
                  />
                </div>
              </div>
            </TabPanel>

            <TabPanel header="Format Settings">
              <div className="tab-content">
                <div className="section-title">Header Configuration</div>
                <div className="form-grid two-column">
                  <div className="form-field checkbox-field">
                    <div className="checkbox-wrapper">
                      <Checkbox
                        inputId="showLogo"
                        checked={formData.showLogo}
                        onChange={(e) => handleInputChange("showLogo", e.checked)}
                        disabled={isViewMode}
                      />
                      <label htmlFor="showLogo" className="checkbox-label">Show Company Logo</label>
                    </div>
                  </div>

                  <div className="form-field checkbox-field">
                    <div className="checkbox-wrapper">
                      <Checkbox
                        inputId="showAddress"
                        checked={formData.showAddress}
                        onChange={(e) => handleInputChange("showAddress", e.checked)}
                        disabled={isViewMode}
                      />
                      <label htmlFor="showAddress" className="checkbox-label">Show Address</label>
                    </div>
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="headerText">Header Text</label>
                  <InputTextarea
                    id="headerText"
                    value={formData.headerText}
                    onChange={(e) => handleInputChange("headerText", e.target.value)}
                    disabled={isViewMode}
                    rows={3}
                    className="full-width"
                    placeholder={t("remittance.enterHeaderText")}
                  />
                </div>

                <div className="section-title">Footer Configuration</div>
                <div className="form-grid two-column">
                  <div className="form-field checkbox-field">
                    <div className="checkbox-wrapper">
                      <Checkbox
                        inputId="showTotals"
                        checked={formData.showTotals}
                        onChange={(e) => handleInputChange("showTotals", e.checked)}
                        disabled={isViewMode}
                      />
                      <label htmlFor="showTotals" className="checkbox-label">Show Totals</label>
                    </div>
                  </div>

                  <div className="form-field">
                    <label htmlFor="signatureLines">Signature Lines</label>
                    <InputNumber
                      id="signatureLines"
                      value={formData.signatureLines}
                      onValueChange={(e) => handleInputChange("signatureLines", e.value)}
                      disabled={isViewMode}
                      min={0}
                      max={3}
                      className="full-width"
                    />
                  </div>
                </div>

                <div className="form-field">
                  <label htmlFor="termsConditions">Terms & Conditions</label>
                  <InputTextarea
                    id="termsConditions"
                    value={formData.termsConditions}
                    onChange={(e) => handleInputChange("termsConditions", e.target.value)}
                    disabled={isViewMode}
                    rows={4}
                    className="full-width"
                    placeholder={t("remittance.enterTermsAndConditions")}
                  />
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
      </div>
  );
};

export default StatementTemplateMaster;