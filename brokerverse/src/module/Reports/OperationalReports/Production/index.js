import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import InputField from "../../../../components/InputField";
import DropDowns from "../../../../components/DropDowns";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import NavBar from "../../../../components/NavBar";

import { useFormik } from "formik";

import ArrowLeftIcon from "../../../../assets/icons/ArrowLeftIcon";
import CustomToast from "../../../../components/Toast";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, useNavigate } from "react-router-dom";
import { Card } from "primereact/card";
import { Calendar } from "primereact/calendar";
import { useReportFilterOptions, useReportGenerator } from "../../shared/useReportGenerator";

const Production = () => {
    const { t } = useTranslation();
    const toastRef = useRef(null);
    const { AgentCode, CompanyCode, BranchCode, ClientCode } = useReportFilterOptions(toastRef);

    const initialValues = {
        ReportCriteria: "",
        FromDate: new Date(),
        ToDate: new Date(),
        Agent: "",
        Company: "",
        Branch: "",
        Client: ""
    };

    const items = [
        { label: t("reports.operationalReports") },
        { label: t("reports.production") },
    ];

    const home = { label: t("reports.heading") };
    const DepartmentCode = [
        { label: t("reports.overall"), value: "Overall" },
        { label: t("reports.agent"), value: "Agent" },
        { label: t("reports.principleInsurance"), value: "Principle Insurance" },
        { label: t("reports.branch"), value: "Branch" },
    ];

    // const customValidation = (values) => {
    //     const errors = {};

    //     if (!values.PolicyNumber) {
    //         errors.PolicyNumber = "This field Code is required";
    //     }
    //     if (!values.Production) {
    //         errors.Production = "This field is required";
    //     }
    //     if (!values.Mortgage) {
    //         errors.Mortgage = "This field is required";
    //     }

    //     return errors;
    // };
    const dispatch = useDispatch();
    const { generate: handleSubmit } = useReportGenerator("production-register", toastRef);

    const formik = useFormik({
        initialValues: initialValues,
        // validate: customValidation,
        onSubmit: handleSubmit,
    });

    const navigate = useNavigate();
    const handlePrint = () => {
        toastRef.current.showToast();
        // formik.resetForm();

        // navigate("/accounts/correctionsjv/correctionsjvdetails")
    };

    return (
        <div className="reports__production__container">
            <CustomToast
                ref={toastRef}
                message={t("reports.reportGenerated")}
            />
            <div className="reports__production__heading">{t("reports.heading")}</div>
            <BreadCrumb
                model={items}
                home={home}
                className="breadcrumbs__container"
                separatorIcon={<SvgDot color={"#000"} />}
            />

            <Card className="reports__card__container">
                <div class="grid">
                    <div class="col-12 md:col-6 lg:col-3">
                        <DropDowns
                            className="dropdown__container"
                            label={t("reports.reportCriteria")}
                            value={formik.values.ReportCriteria}
                            onChange={(e) => {
                                formik.setFieldValue("ReportCriteria", e.value);
                                const isCriteria1 = e.value === "Criteria1";
                                formik.setFieldValue("DepartmentCode", isCriteria1 ? null : formik.values.DepartmentCode);
                                formik.setFieldValue("Company", isCriteria1 ? null : formik.values.Company);
                                formik.setFieldValue("Branch", isCriteria1 ? null : formik.values.Branch);
                                formik.setFieldValue("Client", isCriteria1 ? null : formik.values.Client);
                            }}
                            options={DepartmentCode}
                            optionLabel="label"
                            placeholder={t("reports.select")}
                            dropdownIcon={<SvgDropdown color={"#000"} />}
                        />
                    </div>
                    <div class="col-12 md:col-6 lg:col-3">
                        <label className="labelfield_container">{t("reports.fromDate")}</label>
                        <Calendar

                            showIcon
                            // placeholder="Select"

                            className="calendar_container"
                            value={formik.values.FromDate}
                            onChange={(e) => {
                                formik.setFieldValue("FromDate", e.target.value);
                            }}
                            dateFormat="yy-mm-dd"

                        />
                    </div>
                    <div class="col-12 md:col-6 lg:col-3">
                        <label className="labelfield_container">{t("reports.toDate")}</label>
                        <Calendar
                            showIcon
                            // placeholder="Select"

                            className="calendar_container"
                            value={formik.values.ToDate}
                            onChange={(e) => {
                                formik.setFieldValue("ToDate", e.target.value);
                            }}
                            dateFormat="yy-mm-dd"
                            error={formik.errors.AccountingPeriodStart}
                        />
                    </div>
                </div>
                <div class="grid">
                    <div class="col-12 md:col-6 lg:col-3">
                        <DropDowns
                            className="dropdown__container"
                            textColor={formik.values.ReportCriteria === "Overall" ||
                                formik.values.ReportCriteria === "Principle Insurance" ||
                                formik.values.ReportCriteria === "Branch" ? "#B1B1B1" : null}

                            label="Agent"
                            // value={departmentcode}
                            // onChange={(e) => setDepartmentCode(e.value)}
                            value={formik.values.Agent}
                            onChange={(e) => formik.setFieldValue("Agent", e.value)}
                            options={AgentCode}
                            optionLabel="label"
                            placeholder={t("reports.select")}
                            dropdownIcon={<SvgDropdown color={"#000"} />}
                            disabled={formik.values.ReportCriteria === "Overall" ||
                                formik.values.ReportCriteria === "Principle Insurance" ||
                                formik.values.ReportCriteria === "Branch" ? true : false}

                        />
                    </div>
                    <div class="col-12 md:col-6 lg:col-3">
                        <DropDowns
                            className="dropdown__container"
                            textColor={formik.values.ReportCriteria === "Overall" ||
                                formik.values.ReportCriteria === "Agent" ||
                                formik.values.ReportCriteria === "Branch" ? "#B1B1B1" : null}
                            label={t("reports.company")}
                            // value={departmentcode}
                            // onChange={(e) => setDepartmentCode(e.value)}
                            value={formik.values.Company}
                            onChange={(e) => formik.setFieldValue("Company", e.value)}
                            options={CompanyCode}
                            optionLabel="label"
                            placeholder={t("reports.select")}
                            dropdownIcon={<SvgDropdown color={"#000"} />}
                            disabled={formik.values.ReportCriteria === "Overall" ||
                                formik.values.ReportCriteria === "Agent" ||
                                formik.values.ReportCriteria === "Branch" ? true : false}
                        />
                    </div>
                    <div class="col-12 md:col-6 lg:col-3">
                        <DropDowns
                            className="dropdown__container"
                            textColor={formik.values.ReportCriteria === "Overall" ||
                                formik.values.ReportCriteria === "Agent" ||
                                formik.values.ReportCriteria === "Principle Insurance" ? "#B1B1B1" : null}
                            label={t("reports.branch")}
                            // value={departmentcode}
                            // onChange={(e) => setDepartmentCode(e.value)}
                            value={formik.values.Branch}
                            onChange={(e) => formik.setFieldValue("Branch", e.value)}
                            options={BranchCode}
                            optionLabel="label"
                            placeholder={t("reports.select")}
                            dropdownIcon={<SvgDropdown color={"#000"} />}
                            disabled={formik.values.ReportCriteria === "Overall" ||
                                formik.values.ReportCriteria === "Agent" ||
                                formik.values.ReportCriteria === "Principle Insurance" ? true : false}
                        />
                    </div>
                    <div class="col-12 md:col-6 lg:col-3">
                        <DropDowns
                            className="dropdown__container"
                            label={t("reports.client")}
                            textColor={formik.values.ReportCriteria === "Branch" ||
                                formik.values.ReportCriteria === "Agent" ||
                                formik.values.ReportCriteria === "Principle Insurance" ? "#B1B1B1" : null}
                            // value={departmentcode}
                            // onChange={(e) => setDepartmentCode(e.value)}
                            value={formik.values.Client}
                            onChange={(e) => formik.setFieldValue("Client", e.value)}
                            options={ClientCode}
                            optionLabel="label"
                            placeholder={t("reports.select")}
                            dropdownIcon={<SvgDropdown color={"#000"} />}
                            disabled={formik.values.ReportCriteria === "Branch" ||
                                formik.values.ReportCriteria === "Agent" ||
                                formik.values.ReportCriteria === "Principle Insurance" ? true : false}
                        />

                    </div>
                </div>
            </Card>

            <div className="Submit__but_reports">
                <Button
                    className="submit_button p-0"
                    label={t("reports.generate")}
                    // disabled={!formik.isValid}
                    onClick={() => {
                        formik.handleSubmit();
                    }}
                />
            </div>
        </div>
    );
};

export default Production;
