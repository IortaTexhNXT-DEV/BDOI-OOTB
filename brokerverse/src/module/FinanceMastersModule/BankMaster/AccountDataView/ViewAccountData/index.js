import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../../../components/InputField";
import SvgDot from "../../../../../assets/icons/SvgDot";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import Productdata from "./mock";
import { Dropdown } from "primereact/dropdown";
import { useFormik } from "formik";
import { useSelector } from "react-redux";
import { Dialog } from "primereact/dialog";
import { formatDate as formatAppDate } from "../../../../../utility/dateFormat";

const initialValues = {
  AccountNumber: "",
  AccountName: "",
  AccountType: "",
  MainAccount: "",
  MainAccountDescription: "",
  TransactionLimit: "",
};

function ViewAccountDetail() {
  const { t } = useTranslation();
  const { accountDetailsView } = useSelector(
    ({ bankMasterReducer }) => {
      return {
        loading: bankMasterReducer?.loading,
        accountDetailsView: bankMasterReducer?.accountDetailsView,
      };
    }
  );
  const [selectedProducts, setSelectedProducts] = useState(false);
  const [visible, setVisible] = useState(false);

  const customValidation = (values) => {
    const errors = {};

    if (!values.AccountNumber) {
      errors.AccountNumber = "This field is required";
    }
    if (!values.AccountName) {
      errors.AccountName = "This field is required";
    }
    if (!values.AccountType) {
      errors.AccountType = "This field is required";
    }
    if (!values.MainAccount) {
      errors.MainAccount = "This field is required";
    }
    if (!values.MainAccountDescription) {
      errors.MainAccountDescription = "This field is required";
    }
    if (!values.TransactionLimit) {
      errors.TransactionLimit = "This field is required";
    }

    return errors;
  };

  const Navigate = useNavigate();
  const items = [
    { label: "Bank", url: "/master/finance/bank" },
    { label: "Add Account" },
  ];

  const template2 = {
    layout:
      "RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink",
    RowsPerPageDropdown: (options) => {
      const dropdownOptions = [
        { label: 5, value: 5 },
        { label: 10, value: 10 },
        { label: 20, value: 20 },
        { label: 120, value: 120 },
      ];

      return (
        <React.Fragment>
          <span
            className="mx-1"
            style={{ color: "var(--text-color)", userSelect: "none" }}
          >
            {t("generalMasters.rowCount")}{" "}
          </span>
          <Dropdown
            value={options.value}
            className="pagedropdown_container"
            options={dropdownOptions}
            onChange={options.onChange}
          />
        </React.Fragment>
      );
    },
  };
  const Type = [
    {
      label: accountDetailsView?.AccountType,
      value: accountDetailsView?.AccountType,
    },
  ];

  const headerStyle = {
    // width: '12rem',
    // backgroundColor: 'var(--color-danger)',
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
  const home = { label: "Master" };

  const handleSubmit = () => {
    setVisible(true);
  };

  const handlesavebutton = () => {
    setVisible(false);
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    // onSubmit: (values) => {
    //   // Handle form submission

    // },
    onSubmit: handleSubmit,
  });

  return (
    <div className="overall__viewaccountdetail__container">
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>

        <label className="label_header">{t("financeMasters.addAccount")}</label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card className="cardstyle_container">
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.accountNumber")}
                placeholder={"Enter"}
                value={accountDetailsView.AccountNumber}
                onChange={formik.handleChange("AccountNumber")}
              />
              {formik.touched.AccountNumber && formik.errors.AccountNumber && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.AccountNumber}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.accountName")}
                placeholder={"Enter"}
                value={accountDetailsView.AccountName}
                onChange={formik.handleChange("AccountName")}
              />
              {formik.touched.AccountName && formik.errors.AccountName && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.AccountName}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12  md:col-3 lg-col-3">
            <div>
              <DropDowns
                className="dropdown__container"
                label={t("financeMasters.accountType")}
                value={accountDetailsView?.AccountType}
                options={Type}
                optionLabel="label"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.AccountType && formik.errors.AccountType && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.AccountType}
                </div>
              )}
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.mainAccount")}
                placeholder={"Enter"}
                value={accountDetailsView.MainAccount}
                onChange={formik.handleChange("MainAccount")}
              />
              {formik.touched.MainAccount && formik.errors.MainAccount && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.MainAccount}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.mainAccountDescription")}
                placeholder={"Enter"}
                value={accountDetailsView.MainAccountDescription}
                onChange={formik.handleChange("MainAccountDescription")}
              />
              {formik.touched.MainAccountDescription &&
                formik.errors.MainAccountDescription && (
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                    {formik.errors.MainAccountDescription}
                  </div>
                )}
            </div>
          </div>

          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.transactionLimit")}
                placeholder={"Enter"}
                value={accountDetailsView.TransactionLimit}
                onChange={formik.handleChange("TransactionLimit")}
              />
              {formik.touched.TransactionLimit &&
                formik.errors.TransactionLimit && (
                  <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                    {formik.errors.TransactionLimit}
                  </div>
                )}
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <div className="cardheader_flex">
          <label className="headlist_lable">Cheque Book Details</label>
        </div>

        <div className="tablegap_container">
          <DataTable
            disabled={!formik.isValid}
            value={Productdata}
            tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            currentPageReportTemplate="{first} - {last} of {totalRecords}"
            paginatorTemplate={template2}
            scrollable={true}
            scrollHeight="40vh"
            selection={selectedProducts}
            onSelectionChange={(e) => setSelectedProducts(e.value)}
          >
            <Column
              field="VoucherNumber"
              header="Cheque Book Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.VoucherNumber?.toUpperCase()}
            ></Column>
            <Column
              field="TransactionNumber"
              header="Cheque Leaf Beginning"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.TransactionNumber?.toUpperCase()}
            ></Column>
            <Column
              field="CustomerCode"
              header="Cheque Leaf End"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.CustomerCode?.toUpperCase()}
            ></Column>
            <Column body={(row) => formatAppDate(row.VoucheDate)}
              field="VoucheDate"
              header="Stats"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>

          </DataTable>
        </div>
      </Card>

      <Dialog
        header="Add Cheque book"
        visible={visible}
        style={{ width: "50vw", boxShadow: "none" }}
        onHide={() => setVisible(false)}
        className="master__flow__common__dialog__container"
      >
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.chequeBookNumber")}
                placeholder={"Enter"}
                value={formik.values.AccountNumber}
                onChange={formik.handleChange("AccountNumber")}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.chequeLeafBeginning")}
                placeholder={"Enter"}
                value={formik.values.AccountName}
                onChange={formik.handleChange("AccountName")}
              />
            </div>
          </div>
        </div>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.chequeLeafEnd")}
                placeholder={"Enter"}
                value={formik.values.AccountNumber}
                onChange={formik.handleChange("AccountNumber")}
              />
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            label={t("generalMasters.save")}
            className="savebutton_container"
            onClick={handlesavebutton}
          />
        </div>
      </Dialog>
    </div>
  );
}

export default ViewAccountDetail;
