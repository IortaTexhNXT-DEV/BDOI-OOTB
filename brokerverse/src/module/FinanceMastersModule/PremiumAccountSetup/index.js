import React, { useRef, useState } from "react";
import { Toast } from "primereact/toast";
import { useTranslation } from "react-i18next";
import { Button } from "primereact/button";
import { BreadCrumb } from "primereact/breadcrumb";
import { Card } from "primereact/card";
import { InputText } from "primereact/inputtext";
import { Checkbox } from "primereact/checkbox";
import { RadioButton } from "primereact/radiobutton";
import { Calendar } from "primereact/calendar";
import { useNavigate } from "react-router-dom";
import SvgDot from "../../../assets/icons/SvgDot";
import SvgBackicon from "../../../assets/icons/SvgBackicon";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import DropDowns from "../../../components/DropDowns";
import "./index.scss";
import useAccountSetup, { useAccountSetupOptions } from "../common/useAccountSetup";
import { confirmAction } from "../../../utility/dialogs";
import { calendarDateFormat } from "../../../utility/dateFormat";

const PremiumAccountSetup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
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
    businessSourceFrom: "",
    businessSourceTo: "",
    productCodeFrom: "",
    productCodeTo: "",
    sectionFrom: "",
    sectionTo: "",
    coverFrom: "",
    coverTo: "",
    pasCvrIndicator: "",

    // Document Configuration
    docTypeFrom: "",
    docTypeTo: "",
    docCodeFrom: "",
    docCodeTo: "",

    // GL Mapping
    mainAccount: "",
    subAccount: "",
    company: "",
    office: "",
    department: "",

    // Analysis & Tracking
    analysisCode1: "",
    analysisCode2: "",
    activityCode1: "",
    activityCode2: "",

    // Business Control
    forceCompany: false,
    forceDepartment: false,
    forceOffice: false,
    newRenewalBusiness: "New",

    // Validity
    effectiveFromDate: new Date("2025-02-12"),
    effectiveToDate: new Date("2026-02-12"),

    // Audit Trail
    modifiedBy: "System User",
    modifiedOn: "02/12/2025, 09:26:09 am",
  });

  // Placeholder options - replace with actual data from API
  const setupOptions = useAccountSetupOptions();
  const { save } = useAccountSetup("PREMIUM", "Premium Account Setup", setFormData);
  const toastRef = useRef(null);
  const companyOptions = setupOptions.companyOptions;
  const officeOptions = setupOptions.officeOptions;
  const departmentOptions = setupOptions.departmentOptions;
  const businessTypeOptions = [
    { label: "Inward - Facultative", value: "4" },
    { label: "Inward - Fac Foreign", value: "5" },
  ];
  const businessSourceOptions = [];
  const productCodeOptions = setupOptions.productCodeOptions;
  const sectionOptions = [];
  const coverOptions = setupOptions.coverOptions;
  const pasCvrIndicatorOptions = [{ label: "Others", value: "OTH" }];
  const docTypeOptions = [
    { label: "Policy", value: "2" },
    { label: "Endorsement", value: "3" },
  ];
  const mainAccountOptions = setupOptions.mainAccountOptions;
  const subAccountOptions = setupOptions.subAccountOptions;
  const analysisCodeOptions = [];
  const activityCodeOptions = [];

  const items = [
    {
      label: t("financeMasters.finance"),
      url: "/master/finance",
    },
    {
      label: t("financeMasters.premiumAccountSetup"),
      url: "/master/finance/premium-account-setup",
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
    console.log("Duplicating premium account setup");
    // Add duplicate logic here
  };

  const handleReset = async () => {
    if (await confirmAction(t("financeMasters.confirmReset"))) {
      setFormData({
        companyFrom: "",
        companyTo: "",
        officeFrom: "",
        officeTo: "",
        departmentFrom: "",
        departmentTo: "",
        businessTypeFrom: "",
        businessTypeTo: "",
        businessSourceFrom: "",
        businessSourceTo: "",
        productCodeFrom: "",
        productCodeTo: "",
        sectionFrom: "",
        sectionTo: "",
        coverFrom: "",
        coverTo: "",
        pasCvrIndicator: "",
        docTypeFrom: "",
        docTypeTo: "",
        docCodeFrom: "",
        docCodeTo: "",
        mainAccount: "",
        subAccount: "",
        company: "",
        office: "",
        department: "",
        analysisCode1: "",
        analysisCode2: "",
        activityCode1: "",
        activityCode2: "",
        forceCompany: false,
        forceDepartment: false,
        forceOffice: false,
        newRenewalBusiness: "New",
        effectiveFromDate: new Date("2025-02-12"),
        effectiveToDate: new Date("2026-02-12"),
        modifiedBy: "System User",
        modifiedOn: "02/12/2025, 09:26:09 am",
      });
    }
  };

  const handleClose = () => {
    navigate("/master/finance/premium-account-setup");
  };

  return (
    <div className="premium-account-setup">
      <Toast ref={toastRef} />
      <div className="grid m-0">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="header-section">
            <div className="header-left">
              <span onClick={handleClose}>
                <SvgBackicon />
              </span>
              <label className="label_header">{t("financeMasters.premiumAccountSetup")}</label>
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
        {/* Organization Range Setup Section */}
        <div className="section-title">{t("financeMasters.organizationRangeSetup")}</div>
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
              label="Company To"
              placeholder="Select Company"
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
              label={t("financeMasters.businessSourceFrom")}
              placeholder={t("financeMasters.selectBusinessSource")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.businessSourceFrom}
              options={businessSourceOptions}
              onChange={(e) => handleInputChange("businessSourceFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.businessSourceTo")}
              placeholder={t("financeMasters.selectBusinessSource")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.businessSourceTo}
              options={businessSourceOptions}
              onChange={(e) => handleInputChange("businessSourceTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.productCodeFrom")}
              placeholder={t("financeMasters.selectProduct")}
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
              placeholder={t("financeMasters.selectProduct")}
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
              label="Section From"
              placeholder="Select Section"
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.sectionFrom}
              options={sectionOptions}
              onChange={(e) => handleInputChange("sectionFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.sectionTo")}
              placeholder={t("financeMasters.selectSection")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.sectionTo}
              options={sectionOptions}
              onChange={(e) => handleInputChange("sectionTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.coverFrom")}
              placeholder={t("financeMasters.selectCover")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.coverFrom}
              options={coverOptions}
              onChange={(e) => handleInputChange("coverFrom", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.coverTo")}
              placeholder={t("financeMasters.selectCover")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.coverTo}
              options={coverOptions}
              onChange={(e) => handleInputChange("coverTo", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.pasCvrIndicator")}
              placeholder={t("financeMasters.selectIndicator")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.pasCvrIndicator}
              options={pasCvrIndicatorOptions}
              onChange={(e) => handleInputChange("pasCvrIndicator", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
        </div>

        {/* Document Configuration Section */}
        <div className="section-title mt-4">{t("financeMasters.documentConfiguration")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.docTypeFrom")}
              placeholder={t("financeMasters.selectDocumentType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.docTypeFrom}
              options={docTypeOptions}
              onChange={(e) => handleInputChange("docTypeFrom", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.docTypeTo")}
              placeholder={t("financeMasters.selectDocumentType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.docTypeTo}
              options={docTypeOptions}
              onChange={(e) => handleInputChange("docTypeTo", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label>{t("financeMasters.docCodeFrom")}</label>
              <InputText
                value={formData.docCodeFrom}
                onChange={(e) =>
                  handleInputChange("docCodeFrom", e.target.value)
                }
                className="input__filed"
                placeholder={t("financeMasters.enterDocCode")}
              />
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label>{t("financeMasters.docCodeTo")}</label>
              <InputText
                value={formData.docCodeTo}
                onChange={(e) => handleInputChange("docCodeTo", e.target.value)}
                className="input__filed"
                placeholder={t("financeMasters.enterDocCode")}
              />
            </div>
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
          <div className="col-12 md:col-12 lg:col-12 input__view mt-3">
            <div className="input__block">
              <label className="mb-2">{t("financeMasters.newRenewalBusiness")}</label>
              <div className="flex flex-wrap gap-3">
                <div className="flex align-items-center gap-2">
                  <RadioButton
                    inputId="new"
                    name="newRenewalBusiness"
                    value="New"
                    onChange={(e) =>
                      handleInputChange("newRenewalBusiness", e.value)
                    }
                    checked={formData.newRenewalBusiness === "New"}
                  />
                  <label htmlFor="new">{t("financeMasters.new")}</label>
                </div>
                <div className="flex align-items-center gap-2">
                  <RadioButton
                    inputId="renewal"
                    name="newRenewalBusiness"
                    value="Renewal"
                    onChange={(e) =>
                      handleInputChange("newRenewalBusiness", e.value)
                    }
                    checked={formData.newRenewalBusiness === "Renewal"}
                  />
                  <label htmlFor="renewal">{t("financeMasters.renewal")}</label>
                </div>
                <div className="flex align-items-center gap-2">
                  <RadioButton
                    inputId="both"
                    name="newRenewalBusiness"
                    value="Both"
                    onChange={(e) =>
                      handleInputChange("newRenewalBusiness", e.value)
                    }
                    checked={formData.newRenewalBusiness === "Both"}
                  />
                  <label htmlFor="both">{t("financeMasters.both")}</label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Validity Section */}
        <div className="section-title mt-4">Validity</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label className="required-label">Effective From Date</label>
              <Calendar
                value={formData.effectiveFromDate}
                onChange={(e) =>
                  handleInputChange("effectiveFromDate", e.value)
                }
                dateFormat={calendarDateFormat()}
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
                dateFormat={calendarDateFormat()}
                showIcon
                icon="pi pi-calendar"
                className="input__filed"
                style={{ width: "100%" }}
              />
            </div>
          </div>
        </div>

        {/* Audit Trail Section */}
        <div className="section-title mt-4">Audit Trail</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label>Modified By</label>
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

export default PremiumAccountSetup;
