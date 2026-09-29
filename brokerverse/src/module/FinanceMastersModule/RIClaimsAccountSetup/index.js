import React, { useRef, useState } from "react";
import { Toast } from "primereact/toast";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { InputText } from "primereact/inputtext";
import { Checkbox } from "primereact/checkbox";
import { Calendar } from "primereact/calendar";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import DropDowns from "../../../components/DropDowns";
import "./index.scss";
import useAccountSetup, { useAccountSetupOptions } from "../common/useAccountSetup";
import { confirmAction } from "../../../utility/dialogs";

const RIClaimsAccountSetup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    // Business Classification
    businessTypeFrom: "",
    businessTypeTo: "",
    documentTypeFrom: "",
    documentTypeTo: "",

    // Organization Range Setup
    companyFrom: "",
    companyTo: "",
    divisionFrom: "",
    divisionTo: "",
    departmentFrom: "",
    departmentTo: "",

    // Product & Peril Configuration
    productCodeFrom: "",
    productCodeTo: "",
    perilClassFrom: "",
    perilClassTo: "",

    // GL Mapping
    mainAccount: "",
    accountType: "",
    subAccount: "",
    company: "",
    division: "",
    department: "",

    // Analysis & Tracking
    analysisCode1: "",
    analysisCode2: "",
    activityCode1: "",
    activityCode2: "",

    // Business Control
    forceCompany: false,
    forceDivision: false,
    forceDepartment: false,
    revenueType: "",

    // Validity
    effectiveFromDate: new Date("2025-02-12"),
    effectiveToDate: new Date("2026-02-12"),

    // Audit Trail
    modifiedBy: "System User",
    modifiedOn: "02/12/2025, 09:26:09 am",
  });

  // Placeholder options - replace with actual data from API
  const businessTypeOptions = [
    { label: "FAC Out Foreign", value: "4" },
    { label: "FAC Out Local", value: "13" },
  ];

  const documentTypeOptions = [{ label: "Claims", value: "4" }];

  const setupOptions = useAccountSetupOptions();
  const { save } = useAccountSetup("RI-CLAIMS", "RI Claims Account Setup", setFormData);
  const toastRef = useRef(null);
  const companyOptions = setupOptions.companyOptions;

  const divisionOptions = setupOptions.officeOptions;

  const departmentOptions = setupOptions.departmentOptions;

  const productCodeOptions = setupOptions.productCodeOptions;

  const perilClassOptions = [];

  const accountTypeOptions = [
    { label: "Type 1", value: "1" },
    { label: "Type 2", value: "2" },
    { label: "Type 3", value: "3" },
  ];

  const mainAccountOptions = setupOptions.mainAccountOptions;

  const subAccountOptions = setupOptions.subAccountOptions;

  const analysisCodeOptions = [];
  const activityCodeOptions = [];

  const revenueTypeOptions = [
    { label: "Foreign", value: "Foreign" },
    { label: "Local", value: "Local" },
  ];

  const items = [
    {
      label: t("financeMasters.finance"),
      url: "/master/finance",
    },
    {
      label: t("financeMasters.riClaimsAccountSetup"),
      url: "/master/finance/ri-claim-account-setup",
    },
  ];

  const home = { label: t("financeMasters.master") };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      await save(formData);
      toastRef.current.show({ severity: "success", detail: t("financeMasters.saveSuccessfully") });
    } catch (error) {
      toastRef.current.show({ severity: "error", detail: error.message });
    }
  };

  const handleDuplicate = () => {
    console.log("Duplicating RI-Claims account setup");
    // Add duplicate logic here
  };

  const handleReset = async () => {
    if (await confirmAction("Are you sure you want to reset all fields?")) {
      setFormData({
        businessTypeFrom: "",
        businessTypeTo: "",
        documentTypeFrom: "",
        documentTypeTo: "",
        companyFrom: "",
        companyTo: "",
        divisionFrom: "",
        divisionTo: "",
        departmentFrom: "",
        departmentTo: "",
        productCodeFrom: "",
        productCodeTo: "",
        perilClassFrom: "",
        perilClassTo: "",
        mainAccount: "",
        accountType: "",
        subAccount: "",
        company: "",
        division: "",
        department: "",
        analysisCode1: "",
        analysisCode2: "",
        activityCode1: "",
        activityCode2: "",
        forceCompany: false,
        forceDivision: false,
        forceDepartment: false,
        revenueType: "",
        effectiveFromDate: new Date("2025-02-12"),
        effectiveToDate: new Date("2026-02-12"),
        modifiedBy: "System User",
        modifiedOn: "02/12/2025, 09:26:09 am",
      });
    }
  };

  const handleClose = () => {
    navigate("/master/finance/ri-claim-account-setup");
  };

  return (
    <div className="ri-claims-account-setup">
      <Toast ref={toastRef} />
      <div className="grid m-0">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="header-section">
            <div className="header-left">
              <span onClick={handleClose}>
                <SvgBackicon />
              </span>
              <label className="label_header">{t("financeMasters.riClaimsAccountSetup")}</label>
            </div>
          </div>
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={home}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
      </div>

      <Card className="mt-4">
        {/* Business Classification Section */}
        <div className="section-title">Business Classification</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.businessTypeFrom")}
              placeholder={t("financeMasters.selectBusinessType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.businessTypeFrom}
              options={businessTypeOptions}
              onChange={(e) => handleInputChange("businessTypeFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.businessTypeTo")}
              placeholder={t("financeMasters.selectBusinessType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.businessTypeTo}
              options={businessTypeOptions}
              onChange={(e) => handleInputChange("businessTypeTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.documentTypeFrom")}
              placeholder={t("financeMasters.selectDocumentType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.documentTypeFrom}
              options={documentTypeOptions}
              onChange={(e) => handleInputChange("documentTypeFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.documentTypeTo")}
              placeholder={t("financeMasters.selectDocumentType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.documentTypeTo}
              options={documentTypeOptions}
              onChange={(e) => handleInputChange("documentTypeTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
        </div>

        {/* Organization Range Setup Section */}
        <div className="section-title mt-4">{t("financeMasters.organizationRangeSetup")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.companyFrom")}
              placeholder={t("financeMasters.selectCompany")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.companyFrom}
              options={companyOptions}
              onChange={(e) => handleInputChange("companyFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.companyTo")}
              placeholder={t("financeMasters.selectCompany")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.companyTo}
              options={companyOptions}
              onChange={(e) => handleInputChange("companyTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.divisionFrom")}
              placeholder={t("financeMasters.selectDivision")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.divisionFrom}
              options={divisionOptions}
              onChange={(e) => handleInputChange("divisionFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.divisionTo")}
              placeholder={t("financeMasters.selectDivision")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.divisionTo}
              options={divisionOptions}
              onChange={(e) => handleInputChange("divisionTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.departmentFrom")}
              placeholder={t("financeMasters.selectDepartment")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.departmentFrom}
              options={departmentOptions}
              onChange={(e) => handleInputChange("departmentFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.departmentTo")}
              placeholder={t("financeMasters.selectDepartment")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.departmentTo}
              options={departmentOptions}
              onChange={(e) => handleInputChange("departmentTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
        </div>

        {/* Product & Peril Configuration Section */}
        <div className="section-title mt-4">{t("financeMasters.productAndPerilConfiguration")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.productCodeFrom")}
              placeholder={t("financeMasters.selectProductRange")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.productCodeFrom}
              options={productCodeOptions}
              onChange={(e) => handleInputChange("productCodeFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.productCodeTo")}
              placeholder={t("financeMasters.selectProductRange")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.productCodeTo}
              options={productCodeOptions}
              onChange={(e) => handleInputChange("productCodeTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.perilClassFrom")}
              placeholder={t("financeMasters.selectPerilClass")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.perilClassFrom}
              options={perilClassOptions}
              onChange={(e) => handleInputChange("perilClassFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.perilClassTo")}
              placeholder={t("financeMasters.selectPerilClass")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.perilClassTo}
              options={perilClassOptions}
              onChange={(e) => handleInputChange("perilClassTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
        </div>

        {/* GL Mapping Section */}
        <div className="section-title mt-4">GL Mapping</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.mainAccount")}
              placeholder={t("financeMasters.selectGLAccount")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.mainAccount}
              options={mainAccountOptions}
              onChange={(e) => handleInputChange("mainAccount", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.accountType")}
              placeholder={t("financeMasters.selectAccountType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.accountType}
              options={accountTypeOptions}
              onChange={(e) => handleInputChange("accountType", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.subAccount")}
              placeholder={t("financeMasters.selectSubAccount")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.subAccount}
              options={subAccountOptions}
              onChange={(e) => handleInputChange("subAccount", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.company")}
              placeholder={t("financeMasters.selectCompany")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.company}
              options={companyOptions}
              onChange={(e) => handleInputChange("company", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.division")}
              placeholder={t("financeMasters.selectDivision")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.division}
              options={divisionOptions}
              onChange={(e) => handleInputChange("division", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.department")}
              placeholder={t("financeMasters.selectDepartment")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.department}
              options={departmentOptions}
              onChange={(e) => handleInputChange("department", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
        </div>

        {/* Analysis & Tracking Section */}
        <div className="section-title mt-4">{t("financeMasters.analysisTracking")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.analysisCode1")}
              placeholder={t("financeMasters.selectAnalysisCode")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.analysisCode1}
              options={analysisCodeOptions}
              onChange={(e) => handleInputChange("analysisCode1", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.analysisCode2")}
              placeholder={t("financeMasters.selectAnalysisCode")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.analysisCode2}
              options={analysisCodeOptions}
              onChange={(e) => handleInputChange("analysisCode2", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.activityCode1")}
              placeholder={t("financeMasters.selectActivityCode")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.activityCode1}
              options={activityCodeOptions}
              onChange={(e) => handleInputChange("activityCode1", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.activityCode2")}
              placeholder={t("financeMasters.selectActivityCode")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.activityCode2}
              options={activityCodeOptions}
              onChange={(e) => handleInputChange("activityCode2", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
        </div>

        {/* Business Control Section */}
        <div className="section-title mt-4">{t("financeMasters.businessControl")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <div className="checkbox-field">
              <Checkbox
                inputId="forceCompany"
                checked={formData.forceCompany}
                onChange={(e) => handleInputChange("forceCompany", e.checked)}
              />
              <label htmlFor="forceCompany" className="checkbox-label">
                {t("financeMasters.forceCompany")}
              </label>
            </div>
          </div>
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <div className="checkbox-field">
              <Checkbox
                inputId="forceDivision"
                checked={formData.forceDivision}
                onChange={(e) => handleInputChange("forceDivision", e.checked)}
              />
              <label htmlFor="forceDivision" className="checkbox-label">
                {t("financeMasters.forceDivision")}
              </label>
            </div>
          </div>
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <div className="checkbox-field">
              <Checkbox
                inputId="forceDepartment"
                checked={formData.forceDepartment}
                onChange={(e) =>
                  handleInputChange("forceDepartment", e.checked)
                }
              />
              <label htmlFor="forceDepartment" className="checkbox-label">
                {t("financeMasters.forceDepartment")}
              </label>
            </div>
          </div>
          <div className="col-12 md:col-3 lg:col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.revenueType")}
              placeholder={t("financeMasters.selectRevenueType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.revenueType}
              options={revenueTypeOptions}
              onChange={(e) => handleInputChange("revenueType", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
        </div>

        {/* Validity Section */}
        <div className="section-title mt-4">{t("financeMasters.validity")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label className="required-label">{t("financeMasters.effectiveFromDate")}</label>
              <Calendar
                value={formData.effectiveFromDate}
                onChange={(e) =>
                  handleInputChange("effectiveFromDate", e.value)
                }
                dateFormat="mm/dd/yy"
                showIcon
                icon="pi pi-calendar"
                className="input__filed"
                style={{ width: "100%" }}
              />
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label className="required-label">Effective To Date</label>
              <Calendar
                value={formData.effectiveToDate}
                onChange={(e) => handleInputChange("effectiveToDate", e.value)}
                dateFormat="mm/dd/yy"
                showIcon
                icon="pi pi-calendar"
                className="input__filed"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>

        {/* Audit Trail Section */}
        <div className="section-title mt-4">{t("financeMasters.auditTrail")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label>{t("financeMasters.modifiedBy")}</label>
              <InputText
                value={formData.modifiedBy}
                className="input__filed"
                readOnly
                style={{ backgroundColor: "#f3f4f6", cursor: "not-allowed" }}
              />
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label>Modified On</label>
              <InputText
                value={formData.modifiedOn}
                className="input__filed"
                readOnly
                style={{ backgroundColor: "#f3f4f6", cursor: "not-allowed" }}
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="btn__container mt-4">
          <Button
            label={t("financeMasters.saveConfiguration")}
            className="add__btn"
            onClick={handleSave}
          />
          <Button
            label={t("financeMasters.duplicateConfig")}
            className="close__btn"
            onClick={handleDuplicate}
          />
          <Button label={t("financeMasters.reset")} className="close__btn" onClick={handleReset} />
        </div>
      </Card>
    </div>
  );
};

export default RIClaimsAccountSetup;
