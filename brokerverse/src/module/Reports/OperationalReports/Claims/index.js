import React, { useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import DropDowns from "../../../../components/DropDowns";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { useFormik } from "formik";
import CustomToast from "../../../../components/Toast";
import { Card } from "primereact/card";
import { Calendar } from "primereact/calendar";
import { useReportFilterOptions, useReportGenerator } from "../../shared/useReportGenerator";

const Claims = () => {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const { AgentCode, CompanyCode, BranchCode, ClientCode } = useReportFilterOptions(toastRef);

  const initialValues = {
    ReportCriteria: "All", // Default to "All"
    FromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    ToDate: new Date(), // Today
    Agent: "",
    Company: "",
    Branch: "",
    Client: "",
  };

  // Date validation: FromDate should be in the past, ToDate should be <= today
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today
  const items = [
    { label: t("reports.operationalReports") },
    { label: t("reports.claims") },
  ];

  const home = { label: t("reports.heading") };
  const DepartmentCode = [
    { label: t("reports.all"), value: "All" },
    { label: t("reports.open"), value: "Open" },
    { label: t("reports.settled"), value: "Settled" },
    { label: t("reports.rejected"), value: "Rejected" },
    { label: t("reports.aging"), value: "Aging" },
  ];
  const { generate: handleSubmit, isGenerating } = useReportGenerator("claims-position", toastRef);

  const formik = useFormik({
    initialValues: initialValues,
    // validate: customValidation,
    onSubmit: handleSubmit,
  });

  return (
    <div className="reports__claim__container">
      <CustomToast ref={toastRef} message={t("reports.reportGenerated")} />
      <div className="reports__production__heading">{t("reports.heading")}</div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs__container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card className="reports__card__container">
        <div className="grid">
          <div className="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              label={t("reports.reportCriteria")}
              value={formik.values.ReportCriteria}
              onChange={(e) => {
                formik.setFieldValue("ReportCriteria", e.value);
                // Clear other fields when Report Criteria changes
                formik.setFieldValue("DepartmentCode", "");
                formik.setFieldValue("Company", "");
                formik.setFieldValue("Branch", "");
                formik.setFieldValue("Client", "");
              }}
              options={DepartmentCode}
              optionLabel="label"
              placeholder={t("reports.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3">
            <label className="labelfield_container">{t("reports.fromDate")}</label>
            <Calendar
              showIcon
              // placeholder="Select"

              className="calendar_container"
              value={formik.values.FromDate}
              maxDate={today} // FromDate should be in the past (<= today)
              onChange={(e) => {
                formik.setFieldValue("FromDate", e.target.value);
                // If FromDate is selected and it's after ToDate, update ToDate to FromDate
                if (
                  e.target.value &&
                  formik.values.ToDate &&
                  e.target.value > formik.values.ToDate
                ) {
                  formik.setFieldValue("ToDate", e.target.value);
                }
              }}
              dateFormat="yy-mm-dd"
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3">
            <label className="labelfield_container">To Date</label>
            <Calendar
              showIcon
              // placeholder="Select"

              className="calendar_container"
              value={formik.values.ToDate}
              minDate={formik.values.FromDate} // ToDate should be >= FromDate
              maxDate={today} // ToDate should be <= today
              onChange={(e) => {
                formik.setFieldValue("ToDate", e.target.value);
              }}
              dateFormat="yy-mm-dd"
              error={formik.errors.AccountingPeriodStart}
            />
          </div>
        </div>
        <div className="grid">
          <div className="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              textColor="#B1B1B1"
              label={t("reports.agent")}
              // value={departmentcode}
              // onChange={(e) => setDepartmentCode(e.value)}
              value={formik.values.DepartmentCode}
              onChange={(e) => formik.setFieldValue("DepartmentCode", e.value)}
              options={AgentCode}
              optionLabel="label"
              placeholder={t("reports.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={true}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              textColor="#B1B1B1"
              label={t("reports.company")}
              // value={departmentcode}
              // onChange={(e) => setDepartmentCode(e.value)}
              value={formik.values.DepartmentCode}
              onChange={(e) => formik.setFieldValue("DepartmentCode", e.value)}
              options={CompanyCode}
              optionLabel="label"
              placeholder={t("reports.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={true}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              textColor="#B1B1B1"
              label={t("reports.branch")}
              // value={departmentcode}
              // onChange={(e) => setDepartmentCode(e.value)}
              value={formik.values.DepartmentCode}
              onChange={(e) => formik.setFieldValue("DepartmentCode", e.value)}
              options={BranchCode}
              optionLabel="label"
              placeholder={t("reports.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={true}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-3">
            <DropDowns
              className="dropdown__container"
              label={t("reports.client")}
              textColor="#B1B1B1"
              value={formik.values.DepartmentCode}
              onChange={(e) => formik.setFieldValue("DepartmentCode", e.value)}
              options={ClientCode}
              optionLabel="lebel"
              placeholder={t("reports.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
              disabled={true}
            />
          </div>
        </div>
      </Card>

      <div className="Submit__but_reports">
        <Button
          className="submit_button p-0"
          label={isGenerating ? t("reports.generating") : t("reports.generate")}
          disabled={isGenerating}
          loading={isGenerating}
          onClick={() => {
            formik.handleSubmit();
          }}
        />
      </div>
    </div>
  );
};

export default Claims;
