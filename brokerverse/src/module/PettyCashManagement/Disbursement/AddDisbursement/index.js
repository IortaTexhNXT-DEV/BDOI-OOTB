import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormik } from "formik";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import InputField from "../../../../components/InputField";
import { Card } from "primereact/card";
import usePettyCashOptions from "../../usePettyCashOptions";
import { useDispatch, useSelector } from "react-redux";
import {
  getAddDisbursmentRequestListTableMiddleware,
  getAddDisbursmentTableMiddleware,
  postAddDisbursmentMiddleware,
} from "../store/pettyCashDisbursementMiddleware";
import { DataTable } from "primereact/datatable";
import { Dropdown } from "primereact/dropdown";
import { Column } from "primereact/column";
import SvgTable from "../../../../assets/icons/SvgTable";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../../components/LabelWrapper";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { optionCode } from "../../pettyCashFormat";
import { calendarDateFormat } from "../../../../utility/dateFormat";

const CRITERIA = [
  { label: "Request", value: "Request" },
  { label: "Direct", value: "Direct" },
];

const initialValue = {
  PettyCashCode: "",
  Date: new Date(),
  TransactionCode: "",
  TransactionNumber: "",
  Criteria: "",
  VATMainAccount: "",
  VATSubAccount: "",
  WHTMainAccount: "",
  WHTSubAccount: "",
  Remarks: "",
};

const AddDisbursement = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [selectedRows, setSelectedRows] = useState([]);

  const { AddDisbursmentRequestTable } = useSelector(
    ({ pettyCashDisbursementReducers }) => {
      return {
        loading: pettyCashDisbursementReducers?.loading,
        AddDisbursment: pettyCashDisbursementReducers?.AddDisbursment,
        AddDisbursmentRequestTable: pettyCashDisbursementReducers?.AddDisbursmentRequestTable
      };
    }
  );

  const items = [
    {
      label: t("pettyCash.pettyCashLabel"),
      command: () => navigate("/accounts/pettycash/disbursement"),
    },
    {
      label: t("pettyCash.addDisbursementTitle"),
      to: "/accounts/pettycash/adddisbursement",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };

  const handleBack = () => {
    navigate("/accounts/pettycash/disbursement");
  };
  const { funds, mainAccounts, subAccounts } = usePettyCashOptions();
  const Criteria = CRITERIA;
  const handleSubmit = async (values) => {
    await dispatch(postAddDisbursmentMiddleware(values));
    if (optionCode(values.Criteria) === "Request") {
      await dispatch(getAddDisbursmentTableMiddleware(selectedRows));
    }
    navigate("/accounts/pettycash/adddisbursementtable");
  };
  const handleFundChange = (fund) => {
    formik.setFieldValue("PettyCashCode", fund);
    setSelectedRows([]);
    dispatch(getAddDisbursmentRequestListTableMiddleware(fund?.code));
  };

  const validate = (values) => {
    const errors = {};

    if (!values.PettyCashCode) {
      errors.PettyCashCode = t("pettyCash.thisFieldRequired");
    }
    if (!values.Date) {
      errors.Date = t("pettyCash.thisFieldRequired");
    }
    if (!values.Criteria) {
      errors.Criteria = t("pettyCash.thisFieldRequired");
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
      ];

      return (
        <div className="paginator__container">
          <React.Fragment>
            <span
              className="mx-1"
              style={{ color: "var(--text-color)", userSelect: "none" }}
            >
              {t("pettyCash.rowCount")}{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdownunique_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };
  const headerStyle = {
    // width: "10rem",
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 8,
    color: "#000",
    border: "none",
    textAlign: "center",
    paddingLeft: 0,
  };
  const headaction = {
    justifyContent: "center",
    // textalign: center,
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    // padding: "18px 8px",
    // paddingTop:4,
    color: "#000",
    border: " none",
    display: "flex",
    // paddingBottom:"28px",
    // paddingTop:"8px"
  };
  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  return (
    <div className="add__disbursement__container">
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
        
             <div>
          <span onClick={handleBack}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          {t("pettyCash.addDisbursementTitle")}
          </label>
        </div>
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
      </div>
      <div>
        <Card className="mt-3">
          <div className="grid mt-1">
            <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view">
              <LabelWrapper label={t("pettyCash.date")} className="calenderlable__container" />
              <Calendar
                classNames="calender__container"
                showIcon
                value={formik.values.Date}
                minDate={minDate}
                onChange={(e) => {
                  formik.setFieldValue("Date", e.target.value);
                }}
                dateFormat={calendarDateFormat()}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view">
              <InputField
                classNames="input__filed"
                label={t("pettyCash.transactionCode")}
                textColor={"var(--text-color)"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                value={formik.values.TransactionCode}
                onChange={formik.handleChange("TransactionCode")}
                error={
                  formik.touched.TransactionCode &&
                  formik.errors.TransactionCode
                }
              />
            </div>
            <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view">
              <InputField
                classNames="input__filed"
                label={t("pettyCash.transactionNumber")}
                textColor={"var(--text-color)"}
                textSize={"16"}
                textWeight={500}
                disabled={true}
                value={formik.values.TransactionNumber}
                onChange={formik.handleChange("TransactionNumber")}
                error={
                  formik.touched.TransactionNumber &&
                  formik.errors.TransactionNumber
                }
              />
            </div>

            <div className="col-12 md:col-3 lg:col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("pettyCash.pettyCashCodeRequired")}
                placeholder="Select"
                textColor={"var(--text-color)"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.PettyCashCode}
                options={funds}
                onChange={(e) => handleFundChange(e.value)}
                optionLabel="label"
                error={
                  formik.touched.PettyCashCode && formik.errors.PettyCashCode
                }
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("pettyCash.criteria")}
                placeholder="Select"
                textColor={"var(--text-color)"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.Criteria}
                options={Criteria}
                onChange={(e) => formik.setFieldValue("Criteria", e.value)}
                optionLabel="label"
                error={formik.touched.Criteria && formik.errors.Criteria}
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("pettyCash.vatMainAccount")}
                placeholder="Select"
                textColor={"var(--text-color)"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.VATMainAccount}
                options={mainAccounts}
                onChange={(e) =>
                  formik.setFieldValue("VATMainAccount", e.value)
                }
                optionLabel="label"
                error={
                  formik.touched.VATMainAccount && formik.errors.VATMainAccount
                }
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("pettyCash.vatSubAccount")}
                placeholder="Select"
                textColor={"var(--text-color)"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.VATSubAccount}
                options={subAccounts.filter((a) => a.parentCode === formik.values.VATMainAccount?.code)}
                onChange={(e) => formik.setFieldValue("VATSubAccount", e.value)}
                optionLabel="label"
                error={
                  formik.touched.VATSubAccount && formik.errors.VATSubAccount
                }
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("pettyCash.whtMainAccount")}
                placeholder="Select"
                textColor={"var(--text-color)"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.WHTMainAccount}
                options={mainAccounts}
                onChange={(e) =>
                  formik.setFieldValue("WHTMainAccount", e.value)
                }
                optionLabel="label"
                error={
                  formik.touched.WHTMainAccount && formik.errors.WHTMainAccount
                }
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3 input__view">
              <DropDowns
                className="input__filed"
                label={t("pettyCash.whtSubAccount")}
                placeholder="Select"
                textColor={"var(--text-color)"}
                textSize={"16"}
                textWeight={500}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.WHTSubAccount}
                options={subAccounts.filter((a) => a.parentCode === formik.values.WHTMainAccount?.code)}
                onChange={(e) => formik.setFieldValue("WHTSubAccount", e.value)}
                optionLabel="label"
                error={
                  formik.touched.WHTSubAccount && formik.errors.WHTSubAccount
                }
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6 input__view">
              <InputField
                classNames="input__filed"
                label={t("pettyCash.remarks")}
                placeholder="Enter remarks"
                textColor={"var(--text-color)"}
                textSize={"16"}
                textWeight={500}
                value={formik.values.Remarks}
                onChange={formik.handleChange("Remarks")}
                error={formik.touched.Remarks && formik.errors.Remarks}
              />
            </div>
          </div>
        </Card>
      </div>
      {optionCode(formik.values.Criteria) === "Request" ?
        <Card className="mt-4">
          <div className="sub__container grid ">
            <div className="sub__container__title col-12">
              <div className="table__top__btn__container">
                <div className="sub__request__title">Request List</div>
              </div>
            </div>
          </div>
          <div className="table__container">
            <DataTable
              value={AddDisbursmentRequestTable}
              emptyMessage={emptyTableIcon}
              selection={selectedRows}
              onSelectionChange={(e) => setSelectedRows(e.value)}
              selectionMode="checkbox"
              scrollable={true}
              scrollHeight="40vh"
              paginator
              rows={20}
              rowsPerPageOptions={[20, 50, 100]}
              currentPageReportTemplate="{first} - {last} of {totalRecords}"
              paginatorTemplate={template2}
            >
              <Column
                headerStyle={headaction}
                selectionMode="multiple"
                selectedItem
                style={{ textAlign: "center" }}
              ></Column>
              <Column
                field="TransactionCode"
                header={t("pettyCash.transactionCode")}
                headerStyle={headerStyle}
                sortable
              ></Column>
              <Column
                field="DocumentNumber"
                header={t("pettyCash.documentNumber")}
                headerStyle={headerStyle}
                sortable
              ></Column>
            </DataTable>
          </div>
        </Card>
        : ""
      }

      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label={t("pettyCash.next")}
              className="add__btn"
              onClick={() => {
                formik.handleSubmit();
              }}
              disabled={selectedRows.length === 0 && optionCode(formik.values.Criteria) === "Request"}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddDisbursement;
