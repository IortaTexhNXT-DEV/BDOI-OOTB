import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { TabView, TabPanel } from "primereact/tabview";
import { InputText } from "primereact/inputtext";
import { Dropdown } from "primereact/dropdown";
import { Checkbox } from "primereact/checkbox";
import { InputNumber } from "primereact/inputnumber";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import SvgDot from "../../../../assets/icons/SvgDot";
import { Card } from "primereact/card";
import { Toast } from "primereact/toast";
import { MasterLookup, deleteAndReturn, saveAndReturn, useMasterOptions } from "../masterRecord";
import "./index.scss";
import { confirmAction } from "../../../../utility/dialogs";

const AutomatedRemittanceMaster = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { mode } = useParams();
  const { data } = location.state || {};
  const toast = useRef(null);
  const TYPE = "remittance-automated";

  const [activeIndex, setActiveIndex] = useState(0);
  const [formData, setFormData] = useState({
    ruleCode: "",
    ruleName: "",
    isActive: false,
    frequency: null,
    processingDay: 1,
    cutoffDays: 3,
    minTransCount: 1,
    mainAccount: "",
    subAccount: "",
    branchDept: null,
  });

  const frequencyOptions = [
    { label: t("automatedRemittance.daily"), value: "Daily" },
    { label: t("automatedRemittance.weekly"), value: "Weekly" },
    { label: t("automatedRemittance.monthly"), value: "Monthly" },
    { label: t("automatedRemittance.quarterly"), value: "Quarterly" },
  ];

  const branchOptions = useMasterOptions("branch", toast);

  const items = [
    { label: t("automatedRemittance.remittanceMaster"), url: "/master/finance/remittance" },
    { label: t("automatedRemittance.automatedRemittanceSetup"), url: "#" },
  ];

  const home = { label: t("automatedRemittance.master") };

  useEffect(() => {
    if (mode === "edit" || mode === "view") {
      // Load existing data
      if (data) {
        setFormData({
          ...(data.form || {}),
          ruleCode: data.code,
          ruleName: data.name,
          isActive: data.status === true || data.status === "Active",
          frequency: data.frequency || null,
          processingDay: data.dayOfExecution ?? 1,
          cutoffDays: data.cutoffDays ?? 0,
          minTransCount: data.minTransactionCount ?? 1,
          mainAccount: data.glMapping?.debit || "",
          subAccount: data.glMapping?.credit || "",
          branchDept: data.form?.branchDept || null,
        });
      }
    } else {
      // Generate new code for add mode
      setFormData(prev => ({
        ...prev,
        ruleCode: generateCode()
      }));
    }
  }, [mode, data]);

  const generateCode = () => {
    const random = Math.floor(Math.random() * 10000);
    return `ARM-${String(random).padStart(4, '0')}`;
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
      code: formData.ruleCode,
      name: formData.ruleName,
      isActive: formData.isActive,
      frequency: formData.frequency,
      dayOfExecution: formData.processingDay,
      cutoffDays: formData.cutoffDays,
      minTransactionCount: formData.minTransCount,
      glMapping: { debit: formData.mainAccount, credit: formData.subAccount },
      form: formData
    }
  });

  const handleDelete = async () => {
    if (await confirmAction("Are you sure you want to delete this remittance rule?", { danger: true })) {
      deleteAndReturn({ type: TYPE, id: data?.id, toast, navigate });
    }
  };

  const handleClose = () => {
    navigate("/master/finance/remittance");
  };


  const isViewMode = mode === "view";

  return (
    <div className="container__automated__remittance__master">
        <Toast ref={toast} />
        <div className="grid m-0 top__container">
          <div className="col-12 p-0">
            <Button
              icon="pi pi-arrow-left"
              className="back__button"
              onClick={handleClose}
            />
            <span className="page__title">{t("automatedRemittance.pageTitle")}</span>
            <span className="mode-badge">{mode?.toUpperCase() || "ADD"}</span>
          </div>
          <div className="col-12 p-0">
            <BreadCrumb
              home={home}
              className="breadCrums__view__reversal"
              model={items}
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>

        <div className="content__container">
          <TabView activeIndex={activeIndex} onTabChange={(e) => setActiveIndex(e.index)}>
            <TabPanel header={t("automatedRemittance.general")}>
              <div className="tab-content">
                <div className="section-title">{t("automatedRemittance.automationRuleConfig")}</div>
                <div className="form-grid three-column">
                  <div className="form-field">
                    <label htmlFor="ruleCode" className="required">{t("automatedRemittance.ruleCode")}</label>
                    <InputText
                      id="ruleCode"
                      value={formData.ruleCode}
                      onChange={(e) => handleInputChange("ruleCode", e.target.value)}
                      disabled={isViewMode || mode === "edit"}
                      placeholder={t("automatedRemittance.placeholderRuleCode")}
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="ruleName" className="required">{t("automatedRemittance.ruleName")}</label>
                    <InputText
                      id="ruleName"
                      value={formData.ruleName}
                      onChange={(e) => handleInputChange("ruleName", e.target.value)}
                      disabled={isViewMode}
                      placeholder={t("automatedRemittance.placeholderRuleName")}
                      className="full-width"
                      maxLength={100}
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
                      <label htmlFor="isActive" className="checkbox-label">{t("automatedRemittance.active")}</label>
                    </div>
                  </div>
                </div>

                <div className="section-title">{t("automatedRemittance.processingRules")}</div>
                <div className="form-grid two-column">
                  <div className="form-field">
                    <label htmlFor="frequency" className="required">{t("automatedRemittance.frequency")}</label>
                    <Dropdown
                      id="frequency"
                      value={formData.frequency}
                      options={frequencyOptions}
                      onChange={(e) => handleInputChange("frequency", e.value)}
                      disabled={isViewMode}
                      placeholder={t("automatedRemittance.selectFrequency")}
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="processingDay">
                      {t("automatedRemittance.processingDay")}
                      {formData.frequency === "Monthly" && <span className="required">*</span>}
                    </label>
                    <InputNumber
                      id="processingDay"
                      value={formData.processingDay}
                      onValueChange={(e) => handleInputChange("processingDay", e.value)}
                      disabled={isViewMode || formData.frequency !== "Monthly"}
                      min={1}
                      max={31}
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="cutoffDays">
                      {t("automatedRemittance.cutoffDays")}
                      <span className="help-text">{t("automatedRemittance.cutoffDaysHelp")}</span>
                    </label>
                    <InputNumber
                      id="cutoffDays"
                      value={formData.cutoffDays}
                      onValueChange={(e) => handleInputChange("cutoffDays", e.value)}
                      disabled={isViewMode}
                      min={0}
                      max={30}
                      className="full-width"
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="minTransCount">{t("automatedRemittance.minTransCount")}</label>
                    <InputNumber
                      id="minTransCount"
                      value={formData.minTransCount}
                      onValueChange={(e) => handleInputChange("minTransCount", e.value)}
                      disabled={isViewMode}
                      min={1}
                      className="full-width"
                    />
                  </div>
                </div>
              </div>
            </TabPanel>

            <TabPanel header="GL Mapping">
              <div className="tab-content">
                <div className="section-title">Account Configuration</div>
                <div className="form-grid three-column">
                  <div className="form-field">
                    <label htmlFor="mainAccount" className="required">Main Account</label>
                    <MasterLookup
                      type="main-account"
                      value={formData.mainAccount}
                      onChange={(v) => handleInputChange("mainAccount", v)}
                      disabled={isViewMode}
                      placeholder={t("remittance.selectMainAccount")}
                      toast={toast}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="subAccount">{t("automatedRemittance.subAccount")}</label>
                    <MasterLookup
                      type="sub-account"
                      value={formData.subAccount}
                      onChange={(v) => handleInputChange("subAccount", v)}
                      disabled={isViewMode}
                      placeholder={t("automatedRemittance.selectSubAccount")}
                      toast={toast}
                    />
                  </div>

                  <div className="form-field">
                    <label htmlFor="branchDept" className="required">Branch/Department</label>
                    <Dropdown
                      id="branchDept"
                      value={formData.branchDept}
                      options={branchOptions}
                      onChange={(e) => handleInputChange("branchDept", e.value)}
                      disabled={isViewMode}
                      placeholder={t("remittance.selectBranchDepartment")}
                      className="full-width"
                    />
                  </div>
                </div>
              </div>
            </TabPanel>
              </TabView>

              <div className="action-buttons">
            {!isViewMode && (
              <Button
                label={t("automatedRemittance.save")}
                className="save-button"
                onClick={handleSave}
              />
            )}
            {mode === "edit" && (
              <Button
                label={t("automatedRemittance.delete")}
                className="delete-button"
                onClick={handleDelete}
              />
            )}
            <Button
              label={t("automatedRemittance.close")}
              className="close-button"
              onClick={handleClose}
            />
              </div>
        </div>
      </div>
  );
};

export default AutomatedRemittanceMaster;