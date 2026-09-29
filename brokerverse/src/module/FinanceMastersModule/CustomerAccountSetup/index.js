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

const CustomerAccountSetup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    // Customer Range Setup
    customerCatgFrom: "",
    customerCatgTo: "",

    // Organization Range Setup
    companyFrom: "",
    companyTo: "",
    officeFrom: "",
    officeTo: "",
    departmentFrom: "",
    departmentTo: "",

    // Business Classification
    businessTypeFrom: "",
    businessTypeTo: "",
    insuranceTypeFrom: "",
    insuranceTypeTo: "",

    // Document Configuration
    acDocTypeFrom: "",
    acDocTypeTo: "",

    // GL Mapping
    mainAccount: "",
    subAccount: "",
    office: "",
    acReceivableType: "",
    company: "",
    department: "",

    // Analysis & Tracking
    analysisCode1: "",
    activityCode1: "",
    analysisCode2: "",
    activityCode2: "",

    // Business Control
    forceCompany: false,
    forceOffice: false,
    forceDepartment: false,

    // Validity
    effectiveFromDate: new Date("2025-02-12"),
    effectiveToDate: new Date("2026-02-12"),

    // Audit Trail
    modifiedBy: "System User",
    modifiedOn: "02/12/2025, 09:26:09 am",
  });

  // Placeholder options - replace with actual data from API
  const customerCategoryOptions = [
    { label: "Reinsurance Co - International", value: "RI" },
    { label: "Reinsurance Co - Local", value: "RL" },
  ];

  const setupOptions = useAccountSetupOptions();
  const { save } = useAccountSetup("CUSTOMER", "Customer Account Setup", setFormData);
  const toastRef = useRef(null);
  const companyOptions = setupOptions.companyOptions;

  const officeOptions = setupOptions.officeOptions;

  const departmentOptions = setupOptions.departmentOptions;

  const businessTypeOptions = [{ label: "Inward - Co Insurance", value: "3" }];

  const insuranceTypeOptions = [];

  const acDocTypeOptions = [{ label: "Premium Account", value: "001" }];

  const mainAccountOptions = setupOptions.mainAccountOptions;

  const subAccountOptions = setupOptions.subAccountOptions;

  const acReceivableTypeOptions = [];

  const analysisCodeOptions = [];
  const activityCodeOptions = [];

  const items = [
    {
      label: t("financeMasters.finance"),
      url: "/master/finance",
    },
    {
      label: t("financeMasters.customerAccountSetup"),
      url: "/master/finance/customer-account-setup",
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
    console.log("Duplicating customer account setup");
    // Add duplicate logic here
  };

  const handleReset = async () => {
    if (await confirmAction(t("financeMasters.confirmReset"))) {
      setFormData({
        customerCatgFrom: "",
        customerCatgTo: "",
        companyFrom: "",
        companyTo: "",
        officeFrom: "",
        officeTo: "",
        departmentFrom: "",
        departmentTo: "",
        businessTypeFrom: "",
        businessTypeTo: "",
        insuranceTypeFrom: "",
        insuranceTypeTo: "",
        acDocTypeFrom: "",
        acDocTypeTo: "",
        mainAccount: "",
        subAccount: "",
        office: "",
        acReceivableType: "",
        company: "",
        department: "",
        analysisCode1: "",
        activityCode1: "",
        analysisCode2: "",
        activityCode2: "",
        forceCompany: false,
        forceOffice: false,
        forceDepartment: false,
        effectiveFromDate: new Date("2025-02-12"),
        effectiveToDate: new Date("2026-02-12"),
        modifiedBy: "System User",
        modifiedOn: "02/12/2025, 09:26:09 am",
      });
    }
  };

  const handleClose = () => {
    navigate("/master/finance/customer-account-setup");
  };

  return (
    <div className="customer-account-setup">
      <Toast ref={toastRef} />
      <div className="grid m-0">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="header-section">
            <div className="header-left">
              <span onClick={handleClose}>
                <SvgBackicon />
              </span>
              <label className="label_header">{t("financeMasters.customerAccountSetup")}</label>
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
        {/* Customer Range Setup Section */}
        <div className="section-title">{t("financeMasters.customerRangeSetup")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.customerCategoryFrom")}
              placeholder={t("financeMasters.selectCategory")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.customerCatgFrom}
              options={customerCategoryOptions}
              onChange={(e) => handleInputChange("customerCatgFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.customerCategoryTo")}
              placeholder={t("financeMasters.selectCategory")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.customerCatgTo}
              options={customerCategoryOptions}
              onChange={(e) => handleInputChange("customerCatgTo", e.value)}
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
              label={t("financeMasters.officeFrom")}
              placeholder={t("financeMasters.selectOffice")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.officeFrom}
              options={officeOptions}
              onChange={(e) => handleInputChange("officeFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.officeTo")}
              placeholder={t("financeMasters.selectOffice")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.officeTo}
              options={officeOptions}
              onChange={(e) => handleInputChange("officeTo", e.value)}
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

        {/* Business Classification Section */}
        <div className="section-title mt-4">{t("financeMasters.businessClassification")}</div>
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
              label={t("financeMasters.insuranceTypeFrom")}
              placeholder={t("financeMasters.selectInsuranceType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.insuranceTypeFrom}
              options={insuranceTypeOptions}
              onChange={(e) => handleInputChange("insuranceTypeFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.insuranceTypeTo")}
              placeholder={t("financeMasters.selectInsuranceType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.insuranceTypeTo}
              options={insuranceTypeOptions}
              onChange={(e) => handleInputChange("insuranceTypeTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
        </div>

        {/* Document Configuration Section */}
        <div className="section-title mt-4">{t("financeMasters.documentConfiguration")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.acDocTypeFrom")}
              placeholder={t("financeMasters.selectDocumentType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.acDocTypeFrom}
              options={acDocTypeOptions}
              onChange={(e) => handleInputChange("acDocTypeFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.acDocTypeTo")}
              placeholder={t("financeMasters.selectDocumentType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.acDocTypeTo}
              options={acDocTypeOptions}
              onChange={(e) => handleInputChange("acDocTypeTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
        </div>

        {/* GL Mapping Section */}
        <div className="section-title mt-4">{t("financeMasters.glMapping")}</div>
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
              label={t("financeMasters.acReceivableType")}
              placeholder={t("financeMasters.selectAcReceivableType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.acReceivableType}
              options={acReceivableTypeOptions}
              onChange={(e) => handleInputChange("acReceivableType", e.value)}
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
              label={t("financeMasters.office")}
              placeholder={t("financeMasters.selectOffice")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.office}
              options={officeOptions}
              onChange={(e) => handleInputChange("office", e.value)}
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
                inputId="forceOffice"
                checked={formData.forceOffice}
                onChange={(e) => handleInputChange("forceOffice", e.checked)}
              />
              <label htmlFor="forceOffice" className="checkbox-label">
                {t("financeMasters.forceOffice")}
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
              <label className="required-label">{t("financeMasters.effectiveToDate")}</label>
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
              <label>{t("financeMasters.modifiedOn")}</label>
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

export default CustomerAccountSetup;
