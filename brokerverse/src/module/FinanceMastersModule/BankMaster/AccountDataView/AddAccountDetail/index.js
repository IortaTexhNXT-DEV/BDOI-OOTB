import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../../../components/InputField";
import SubmitButton from "../../../../../components/SubmitButton";
import SvgDot from "../../../../../assets/icons/SvgDot";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../../../../../components/NavBar";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import DatePicker from "../../../../../components/DatePicker";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../../../components/LabelWrapper";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import Productdata from "./mock";
import { Dropdown } from "primereact/dropdown";
import { useFormik } from "formik";
import SvgAdd from "../../../../../assets/icons/SvgAdd";
// import SvgEditIcon from '../../../../../assets/icons/SvgEditIcon';
import { useDispatch, useSelector } from "react-redux";
import SvgEdit from "../../../../../assets/icons/SvgEdits";
import { Dialog } from "primereact/dialog";
import ToggleButton from "../../../../../components/ToggleButton";
import { postAddBank } from "../../store/bankMasterMiddleware";
import SvgEditIcon from "../../../../../assets/icons/SvgEditIcon";
import { postAddAccountDetails } from "../../store/bankMasterMiddleware";

const initialValues = {
  AccountNumber: "",
  AccountName: "",
  AccountType: "",
  MainAccount: "",
  MainAccountDescription: "",
  TransactionLimit: "",
  MaxTransactionLimit:""
};

function AddAccountDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [date, setDate] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState(false);
  const [visible, setVisible] = useState(false);
  const { id } = useParams();
  const dispatch = useDispatch();

  const { AccountDetailsList, loading } = useSelector(({ bankMasterReducer }) => {
    return {
      loading: bankMasterReducer?.loading,
      AccountDetailsList: bankMasterReducer?.AccountDetailsList,
    };
  });

  const customValidation = (values) => {
    const errors = {};

    if (!values.AccountNumber) {
      errors.AccountNumber = t("validation.fieldRequired");
    }
    if (!values.AccountName) {
      errors.AccountName = t("validation.fieldRequired");
    }
    if (!values.AccountType) {
      errors.AccountType = t("validation.fieldRequired");
    }
    if (!values.MainAccount) {
      errors.MainAccount = t("validation.fieldRequired");
    }
    if (!values.MainAccountDescription) {
      errors.MainAccountDescription = t("validation.fieldRequired");
    }
    if (!values.TransactionLimit) {
      errors.TransactionLimit = t("validation.fieldRequired");
    }

    return errors;
  };

  const Navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState(null);
  const items = [
    { label: "Bank", url: "/master/finance/bank" },
    { label: "Add Account" },
  ];
  const statusBodyTemplate = (rowData) => {
    return (
      <div
        style={{
          backgroundColor: rowData.status === "Pending" ? "#E2F6EF" : "#FFE5B4",
          color: rowData.status === "Pending" ? "#29CE00" : "#FFA800",
        }}
        className="statuslable_container"
      >
        {rowData.status}
      </div>
    );
  };

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
    { name: "Savings", code: "NY" },
    { name: "Current", code: "RM" },
  ];

  const headerStyle = {
    // width: '12rem',
    // backgroundColor: 'red',
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
  };
  const headeraction = {
    display: "flex",
    justifyContent: "center",
    alignItem: "center",
  };
  const status = [
    { name: "Active", code: "NY" },
    { name: "Deactive", code: "RM" },
  ];
  const item = [
    { name: "New York", code: "NY" },
    { name: "Rome", code: "RM" },
    { name: "London", code: "LDN" },
    { name: "Istanbul", code: "IST" },
    { name: "Paris", code: "PRS" },
  ];
  const home = { label: "Master" };

  const handlesaveTable = () => {
    setVisible(false);
  };

  const handlesave = (value) => {
    // console.log(value, "value");
    const valueWithId = {
      ...value,
      id: AccountDetailsList?.length + 1,
    };
    dispatch(postAddAccountDetails(valueWithId));

    navigate("/master/finance/bank/accountdataview");
  };
  const handleNavigation = () => {
    // navigate("/master/finance/bank/accountdataview");
  };

  // const handleNavigation = () => {
  //   Navigate("/SpecificVoucher")
  // }
  const renderToggleButton = () => {
    return (
      <div>
        <ToggleButton />
      </div>
    );
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    onSubmit: (values) => {
      handlesave(values);
    },
  });

  return (
    <div className="overall__addaccountdetail__container">
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>

        <label className="label_header">Add Account</label>
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
                value={formik.values.AccountNumber}
                onChange={formik.handleChange("AccountNumber")}
              />
              {formik.touched.AccountNumber && formik.errors.AccountNumber && (
                <div style={{ fontSize: 12, color: "red" }}>
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
                value={formik.values.AccountName}
                onChange={formik.handleChange("AccountName")}
              />
              {formik.touched.AccountName && formik.errors.AccountName && (
                <div style={{ fontSize: 12, color: "red" }}>
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
                value={formik.values.AccountType}
                onChange={(e) => formik.setFieldValue("AccountType", e.value)}
                options={Type}
                optionLabel="name"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.AccountType && formik.errors.AccountType && (
                <div style={{ fontSize: 12, color: "red" }}>
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
                value={formik.values.MainAccount}
                onChange={formik.handleChange("MainAccount")}
              />
              {formik.touched.MainAccount && formik.errors.MainAccount && (
                <div style={{ fontSize: 12, color: "red" }}>
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
                value={formik.values.MainAccountDescription}
                onChange={formik.handleChange("MainAccountDescription")}
              />
              {formik.touched.MainAccountDescription &&
                formik.errors.MainAccountDescription && (
                  <div style={{ fontSize: 12, color: "red" }}>
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
                value={formik.values.TransactionLimit}
                onChange={formik.handleChange("TransactionLimit")}
              />
              {formik.touched.TransactionLimit &&
                formik.errors.TransactionLimit && (
                  <div style={{ fontSize: 12, color: "red" }}>
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
          <Button
            type="button"
            label={t("generalMasters.add")}
            className="addbutton_container"
            icon={<SvgAdd />}
            onClick={() => setVisible(true)}
          />
        </div>

        <div className="tablegap_container">
          <DataTable
            disabled={!formik.isValid}
            value={Productdata}
            tableStyle={{ minWidth: "50rem", color: "#2e2e2e" }}
            paginator
            rows={5}
            rowsPerPageOptions={[5, 10, 25, 50]}
            // paginatorTemplate="RowsPerPageDropdown  FirstPageLink PrevPageLink CurrentPageReport NextPageLink LastPageLink"
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
            ></Column>
            <Column
              field="TransactionNumber"
              header="Cheque Leaf Beginning"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              field="CustomerCode"
              header="Cheque Leaf End"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={renderToggleButton}
              header="Statas"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            {/* <Column
              body={(columnData) => <SvgEdit />}
              header="Action"
              headerStyle={headeraction}
              className="fieldvalue_container"
              style={{textAlign:'center'}}
            ></Column> */}

            {/* <Column field="Amount" header="Total Amount" style={{ width: '24rem' }} headerStyle={headerStyle} className='fieldvalue_container'></Column> */}
            {/* <Column field="action" header="Action" headerStyle={headerStyle} className='fieldvalue_container'
        onClick={() => setVisible(true)}
        ></Column> */}

            <Column
              body={(params) => (
                <div onClick={() => setVisible(true)}>
                  <SvgEditIcon />
                </div>
              )}
              header="Action"
              headerStyle={headeraction}
              className="fieldvalue_container"
              style={{ textAlign: "center" }}
            ></Column>
          </DataTable>
        </div>
      </Card>

      <div className="next_container">
        <Button
          className="submit_button p-0"
          label={t("generalMasters.save")}
          onClick={() => {
            formik.handleSubmit();
          }}
          disabled={!formik.isValid}
        />
      </div>

      <Dialog
        header="Add Cheque book "
        visible={visible}
        className="master__flow__common__dialog__container"
        style={{ width: "50vw",boxShadow:"none" }}
        onHide={() => setVisible(false)}
       
      >
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.chequeBookNumber")}
                placeholder={"Enter"}
                //   value={formik.values.AccountNumber}
                //   onChange={formik.handleChange("AccountNumber")}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("financeMasters.chequeLeafBeginning")}
                placeholder={"Enter"}
                //   value={formik.values.AccountName}
                //   onChange={formik.handleChange("AccountName")}
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
                //   value={formik.values.AccountNumber}
                //   onChange={formik.handleChange("AccountNumber")}
              />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            label={t("generalMasters.save")}
            className="savebutton_container"
            onClick={handlesaveTable}
          />
        </div>
      </Dialog>
    </div>
  );
}

export default AddAccountDetail;
