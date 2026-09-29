import React, { useState, useEffect, useRef } from "react";
import "../AddPolicyReceipts/index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../assets/icons/SvgDot";
import InputField from "../../../components/InputField";
import DropDowns from "../../../components/DropDowns";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Button } from "primereact/button";
import { Paginator } from "primereact/paginator";
import SuccessIcon from "../../../assets/icons/SuccessIcon";
import { Checkbox } from "primereact/checkbox";
import { dataa } from "./data";
import { mock } from "./mock";
import SvgEdit from "../../../assets/icons/SvgEdit";
import NavBar from "../../../components/NavBar";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const AddPolicyReceipts = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const items = [
    { label: t("sidebar.Accounts"), to: "/accounts" },
    { label: t("sidebar.Receipts"), command: () => navigate("/accounts/receipts") },
    { label: t("accounts.addReceiptsLabel"), to: "/accounts/receipts/addpolicyreceipts" },
  ];

  const home = { label: t("accounts.dashboard") };

  const columns = [
    {
      field: "customerName",
      header: t("accounts.receiptItem"),
      width: 110,
      backgroundColor: "#000",
    },
    { field: "branchCode", header: t("accounts.netPremium"), width: 110 },
    { field: "departmentCode", header: t("accounts.paid"), width: 110 },
    { field: "receiptNo", header: t("accounts.balance"), width: 110 },
    { field: "receiptDate", header: "DST", width: 110 },
    { field: "paymentType", header: "LGT", width: 110 },
    { field: "amount", header: t("accounts.others"), width: 110 },
    { field: "action", header: "VAT", width: 110 },
    { field: "ewt", header: "EWT", width: 110 },
  ];

  const [first, setFirst] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const onPageChange = (event) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };

  const [selectedRows, setSelectedRows] = useState([]);

  const onSelectionChange = (e) => {
    setSelectedRows(e.value);
  };

  const [visiblePopup, setVisiblePopup] = useState(false);
  const popupRef = useRef(null);
  const [successPopup, setSuccessPopup] = useState(false);
  const [open, setOpen] = React.useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);
  const handleOpenTwo = () => setSuccessPopup(true);

  const handleClickOutside = (event) => {
    if (popupRef.current && !popupRef.current.contains(event.target)) {
      setVisiblePopup(false);
    }
  };

  useEffect(() => {
    window.addEventListener("click", handleClickOutside);

    return () => {
      window.removeEventListener("click", handleClickOutside);
    };
  }, []);
  const colors = ["#FEF3F2", "#FCF5E9", "#F3FFEF", "#DDEEFF", "#F5E8FF"];
  const initialState = {
    branchValue: "B012",
    deptValue: "Dep01",
    receiptValue: "Policy Receipt",
    custValue: "Cust001",
    remarkValue: "Fully Paid",
  };

  const [values, setValues] = useState(initialState);

  const handleChange = (fieldName, value) => {
    setValues((prevValues) => ({
      ...prevValues,
      [fieldName]: value,
    }));
  };
  return (
    <div>
      <div className="grid container__addPolicy m-0">
        <div className="col-12">
          <div className="correction__title__addPolicy">Receipt Details</div>
        </div>
        <div className="col-12 ">
          <BreadCrumb
            home={home}
            className="breadCrums__view__addPolicy"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
        <div className="col-12 md:col-2-5 lg-col-2-5 input__view__reversal">
          <InputField
            classNames="field__container"
            label="Branch"
            textColor={"#111927"}
            textSize={16}
            textWeight={500}
            value={values.branchValue}
            onChange={(e) => handleChange("branchValue", e.value)}
          />
        </div>
        <div className="col-12 md:col-2-5 lg-col-2-5 input__view__reversal">
          <InputField
            classNames="field__container"
            label="Department"
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={values.deptValue}
            onChange={(e) => handleChange("deptValue", e.value)}
          />
        </div>
        <div className="col-12 md:col-2-5 lg-col-2-5 input__view__reversal">
          <InputField
            classNames="field__container"
            label="Receipt Type"
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={values.custValue}
            onChange={(e) => handleChange("custValue", e.value)}
          />
        </div>

        <div className="col-12 md:col-2-5 lg-col-2-5 input__view__reversal">
          <InputField
            classNames="field__container"
            label="Customer Code"
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={values.receiptValue}
            onChange={(e) => handleChange("receiptValue", e.value)}
          />
        </div>
        <div className="col-11 md:col-2-5 lg-col-2-5 input__view__reversal">
          <InputField
            classNames="field__container"
            label="Remarks"
            textColor={"#111927"}
            textSize={"16"}
            textWeight={500}
            value={values.remarkValue}
            onChange={(e) => handleChange("remarkValue", e.value)}
          />
        </div>
        <div className="col-12"></div>
        <div className="col-6">
          <div className={"policy__text"}>Policy List</div>
        </div>
        <div
          style={{ display: "flex", justifyContent: "flex-end" }}
          className="col-6"
        >
          <Button
            onClick={() => setVisiblePopup(true)}
            className={"buttons__edit"}
          >
            <div className={"edit__icon"}>
              <SvgEdit />
            </div>
            <div className={"exit__text"}>Edit</div>
          </Button>
        </div>
        <div className="col-12 md:col-12 lg-col-12">
          <div className="card">
            <DataTable
              value={dataa}
              first={first}
              rows={rowsPerPage}
              totalRecords={dataa.length}
              responsive
              selection={selectedRows}
              onSelectionChange={onSelectionChange}
              className="header__text"
              scrollable={true}
              scrollHeight="40vh"
            >
              <Column
                bodyStyle={{ padding: 20 }}
                selectionMode="multiple"
                style={{ width: "3em" }}
              />
              {columns.map((column) => (
                <Column
                  key={column.field}
                  field={column.field}
                  header={column.header}
                  style={{ flex: column.flex }}
                />
              ))}
            </DataTable>
            <Paginator
              className="paginator__view__addPolicy"
              first={first}
              rows={rowsPerPage}
              totalRecords={dataa.length}
              onPageChange={onPageChange}
            />
          </div>
        </div>
        <div className="col-12" style={{ display: "flex", flexWrap: "wrap" }}>
          {mock.map((item, index) => (
            <div
              key={index}
              className="col-12 md:col-2-5 lg:col-2-5 "
              style={{ flex: "1 0 18%", margin: "0 5px" }}
            >
              <div
                className={"box__header__view p-3"}
                style={{
                  backgroundColor: colors[index % colors.length],
                  height: "100%",
                }}
              >
                <div p={2} className={"cost__title"}>
                  {item.title}
                </div>
                <div pb={2} className={"cost__text"}>
                  {item.cost}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="col-12 md:col-12 lg-col-12 button__view__corrections__addPolicy">
          <div>
            <Button label="Approve" className="correction__btn__addPolicy" />
          </div>
        </div>
        <div className="col-12">
          {visiblePopup && (
            <div className="grid custom-modal-overlay">
              <div className="custom-modal">
                <div className="col-12">
                  <div className="policy__detail__text">Policy details</div>
                </div>
                <div className="popup__input__view">
                  <div className="col-4">Receipt Item:</div>
                  <div className="col-7">
                    <InputField
                      classNames="input__filed__addPolicy"
                      textColor={"#111927"}
                      textSize={"16"}
                      textWeight={500}
                    />
                  </div>
                </div>
                <div className="popup__input__view">
                  <div className="col-4">Net Premium :</div>
                  <div className="col-7">
                    <InputField
                      classNames="input__filed__addPolicy"
                      textColor={"#111927"}
                      textSize={"16"}
                      textWeight={500}
                    />
                  </div>
                </div>
                <div className="popup__input__view">
                  <div className="col-4">Paid :</div>
                  <div className="col-7">
                    <InputField
                      classNames="input__filed__addPolicy"
                      textColor={"#111927"}
                      textSize={"16"}
                      textWeight={500}
                    />
                  </div>
                </div>
                <div className="popup__input__view">
                  <div className="col-4">Balance :</div>
                  <div className="col-7">
                    <InputField
                      classNames="input__filed__addPolicy"
                      textColor={"#111927"}
                      textSize={"16"}
                      textWeight={500}
                    />
                  </div>
                </div>
                <div className="popup__input__view">
                  <div className="col-4">DST :</div>
                  <div className="col-7">
                    <InputField
                      classNames="input__filed__addPolicy"
                      textColor={"#111927"}
                      textSize={"16"}
                      textWeight={500}
                    />
                  </div>
                </div>
                <div className="popup__input__view">
                  <div className="col-4">LGT :</div>
                  <div className="col-7">
                    <InputField
                      classNames="input__filed__addPolicy"
                      textColor={"#111927"}
                      textSize={"16"}
                      textWeight={500}
                    />
                  </div>
                </div>
                <div className="popup__input__view">
                  <div className="col-4">Others :</div>
                  <div className="col-7">
                    <InputField
                      classNames="input__filed__addPolicy"
                      textColor={"#111927"}
                      textSize={"16"}
                      textWeight={500}
                    />
                  </div>
                </div>
                <div className="popup__input__view">
                  <div className="col-4">VAT :</div>
                  <div className="col-7">
                    <InputField
                      classNames="input__filed__addPolicy"
                      textColor={"#111927"}
                      textSize={"16"}
                      textWeight={500}
                    />
                  </div>
                </div>
                <div className="popup__input__view">
                  <div className="col-4">EWT :</div>
                  <div className="col-7">
                    <InputField
                      classNames="input__filed__addPolicy"
                      textColor={"#111927"}
                      textSize={"16"}
                      textWeight={500}
                    />
                  </div>
                </div>
                <div className="col-12 save__btn__view">
                  <Button
                    label="Save"
                    className="save__button"
                    onClick={() => setVisiblePopup(false)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddPolicyReceipts;
