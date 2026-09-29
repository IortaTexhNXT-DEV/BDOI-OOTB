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

const MiscellaneousAccountSetup = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    // Cover Configuration
    coverType: "",
    coverIndicator: "",

    // Business Classification
    businessFrom: "",
    businessTo: "",
    businessSourceFrom: "",
    businessSourceTo: "",

    // Document Configuration
    docTypeFrom: "",
    docTypeTo: "",
    docCodeFrom: "",
    docCodeTo: "",

    // Product & Section
    productCodeFrom: "",
    productCodeTo: "",
    sectionCodeFrom: "",
    sectionCodeTo: "",

    // Accrual Configuration
    accrualCodeFrom: "",
    accrualCodeTo: "",
    accrualSourceFrom: "",
    accrualSourceTo: "",

    // Organization Range
    companyFrom: "",
    companyTo: "",
    officeFrom: "",
    officeTo: "",
    departmentFrom: "",
    departmentTo: "",

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
    newRenewalBusiness: "Both",

    // Validity
    effectiveFromDate: new Date("2025-02-12"),
    effectiveToDate: new Date("2026-02-12"),

    // Audit Trail
    modifiedBy: "System User",
    modifiedOn: "02/12/2025, 09:26:09 am",
  });

  // Placeholder options - replace with actual data from API
  const coverTypeOptions = [{ label: "Charges", value: "002" }];
  const coverIndicatorOptions = [{ label: "Others", value: "OTH" }];
  const businessOptions = [];
  const businessSourceOptions = [];
  const docTypeOptions = [];
  const sectionCodeOptions = [];
  const accrualSourceOptions = [];
  const setupOptions = useAccountSetupOptions();
  const { save } = useAccountSetup("MISCELLANEOUS", "Miscellaneous Account Setup", setFormData);
  const toastRef = useRef(null);
  const companyOptions = setupOptions.companyOptions;
  const officeOptions = setupOptions.officeOptions;
  const departmentOptions = setupOptions.departmentOptions;
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
      label: t("financeMasters.miscellaneousAccountSetup"),
      url: "/master/finance/miscellaneous-account-setup",
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
    console.log("Duplicating miscellaneous account setup");
    // Add duplicate logic here
  };

  const handleReset = async () => {
    if (await confirmAction(t("financeMasters.confirmReset"))) {
      setFormData({
        coverType: "",
        coverIndicator: "",
        businessFrom: "",
        businessTo: "",
        businessSourceFrom: "",
        businessSourceTo: "",
        docTypeFrom: "",
        docTypeTo: "",
        docCodeFrom: "",
        docCodeTo: "",
        productCodeFrom: "",
        productCodeTo: "",
        sectionCodeFrom: "",
        sectionCodeTo: "",
        accrualCodeFrom: "",
        accrualCodeTo: "",
        accrualSourceFrom: "",
        accrualSourceTo: "",
        companyFrom: "",
        companyTo: "",
        officeFrom: "",
        officeTo: "",
        departmentFrom: "",
        departmentTo: "",
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
        newRenewalBusiness: "Both",
        effectiveFromDate: new Date("2025-02-12"),
        effectiveToDate: new Date("2026-02-12"),
        modifiedBy: "System User",
        modifiedOn: "02/12/2025, 09:26:09 am",
      });
    }
  };

  const handleClose = () => {
    navigate("/master/finance/miscellaneous-account-setup");
  };

  return (
    <div className="miscellaneous-account-setup">
      <Toast ref={toastRef} />
      <div className="grid m-0">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="header-section">
            <div className="header-left">
              <span onClick={handleClose}>
                <SvgBackicon />
              </span>
              <label className="label_header">
                {t("financeMasters.miscellaneousAccountSetup")}
              </label>
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
        {/* Cover Configuration Section */}
        <div className="section-title">{t("financeMasters.coverConfiguration")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.coverType")}
              placeholder={t("financeMasters.selectCoverType")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.coverType}
              options={coverTypeOptions}
              onChange={(e) => handleInputChange("coverType", e.value)}
              optionLabel="label"
              optionValue="value"
              required
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.coverIndicator")}
              placeholder={t("financeMasters.selectIndicator")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.coverIndicator}
              options={coverIndicatorOptions}
              onChange={(e) => handleInputChange("coverIndicator", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
        </div>

        {/* Business Classification Section */}
        <div className="section-title mt-4">{t("financeMasters.businessClassification")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.businessFrom")}
              placeholder={t("financeMasters.selectBusiness")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.businessFrom}
              options={businessOptions}
              onChange={(e) => handleInputChange("businessFrom", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.businessTo")}
              placeholder={t("financeMasters.selectBusiness")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.businessTo}
              options={businessOptions}
              onChange={(e) => handleInputChange("businessTo", e.value)}
              optionLabel="label"
              optionValue="value"
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

        {/* Product & Section Section */}
        <div className="section-title mt-4">{t("financeMasters.productAndSection")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label className="required-label">{t("financeMasters.productCodeFrom")}</label>
              <InputText
                value={formData.productCodeFrom}
                onChange={(e) =>
                  handleInputChange("productCodeFrom", e.target.value)
                }
                className="input__filed"
                placeholder={t("financeMasters.productCodeFromPlaceholder")}
              />
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label className="required-label">{t("financeMasters.productCodeTo")}</label>
              <InputText
                value={formData.productCodeTo}
                onChange={(e) =>
                  handleInputChange("productCodeTo", e.target.value)
                }
                className="input__filed"
                placeholder={t("financeMasters.productCodeToPlaceholder")}
              />
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.sectionCodeFrom")}
              placeholder={t("financeMasters.selectSection")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.sectionCodeFrom}
              options={sectionCodeOptions}
              onChange={(e) => handleInputChange("sectionCodeFrom", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.sectionCodeTo")}
              placeholder={t("financeMasters.selectSection")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.sectionCodeTo}
              options={sectionCodeOptions}
              onChange={(e) => handleInputChange("sectionCodeTo", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
        </div>

        {/* Accrual Configuration Section */}
        <div className="section-title mt-4">{t("financeMasters.accrualConfiguration")}</div>
        <div className="grid mt-1">
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label>{t("financeMasters.accrualCodeFrom")}</label>
              <InputText
                value={formData.accrualCodeFrom}
                onChange={(e) =>
                  handleInputChange("accrualCodeFrom", e.target.value)
                }
                className="input__filed"
                placeholder={t("financeMasters.accrualCodeFromPlaceholder")}
              />
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <div className="input__block">
              <label>{t("financeMasters.accrualCodeTo")}</label>
              <InputText
                value={formData.accrualCodeTo}
                onChange={(e) =>
                  handleInputChange("accrualCodeTo", e.target.value)
                }
                className="input__filed"
                placeholder={t("financeMasters.accrualCodeToPlaceholder")}
              />
            </div>
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.accrualSourceFrom")}
              placeholder={t("financeMasters.selectAccrualSource")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.accrualSourceFrom}
              options={accrualSourceOptions}
              onChange={(e) => handleInputChange("accrualSourceFrom", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 input__view">
            <DropDowns
              className="input__filed"
              label={t("financeMasters.accrualSourceTo")}
              placeholder={t("financeMasters.selectAccrualSource")}
              textColor={"#111927"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              value={formData.accrualSourceTo}
              options={accrualSourceOptions}
              onChange={(e) => handleInputChange("accrualSourceTo", e.value)}
              optionLabel="label"
              optionValue="value"
            />
          </div>
        </div>

        {/* Organization Range Section */}
        <div className="section-title mt-4">{t("financeMasters.organizationRange")}</div>
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
                Force Company
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
                Force Office
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

export default MiscellaneousAccountSetup;
