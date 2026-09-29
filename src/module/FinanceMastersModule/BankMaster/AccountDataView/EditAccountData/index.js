import React, { useEffect, useState } from "react";
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
import {
  getChequeEditDataMiddleWare,
  postChequeDataMiddleWare,
  postPatchAccountDetailEdit,
} from "../../store/bankMasterMiddleware";
import CheckEditData from "./CheckEditData";

const initialValues = {
  AccountNumber: "",
  AccountName: "",
  AccountType: "",
  MainAccount: "",
  MainAccountDescription: "",
  TransactionLimit: "",
};

function EditAccountDetail({ action }) {
  console.log(action, "action");
  // const [visible, setVisible] = useState(false);

  const { AccountPatchDetailView, loading, chequeListData, getEditChequeData } =
    useSelector(({ bankMasterReducer }) => {
      return {
        loading: bankMasterReducer?.loading,
        AccountPatchDetailView: bankMasterReducer?.AccountPatchDetailView,
        chequeListData: bankMasterReducer?.chequeListData,
        getEditChequeData: bankMasterReducer?.getEditChequeData,
      };
    });
  console.log(chequeListData, "chequeListData");
  const navigate = useNavigate();
  const [date, setDate] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState(false);
  const [visible, setVisible] = useState(false);
  const [visibleEdit, setVisibleEdit] = useState(false);
  const { id } = useParams();
  const dispatch = useDispatch();

  // const customValidation = (values) => {
  //   const errors = {};

  //   if (!values.AccountNumber) {
  //     errors.AccountNumber = "This field Code is required";
  //   }
  //   if (!values.AccountName) {
  //     errors.AccountName = "This field is required";
  //   }
  //   if (!values.AccountType) {
  //     errors.AccountType = "This field is required";
  //   }
  //   if (!values.MainAccount) {
  //     errors.MainAccount = "This field is required";
  //   }
  //   if (!values.MainAccountDescription) {
  //     errors.MainAccountDescription = "This field is required";
  //   }
  //   if (!values.TransactionLimit) {
  //     errors.TransactionLimit = "This field is required";
  //   }

  //   return errors;
  // };

  const Navigate = useNavigate();
  const [selectedItem, setSelectedItem] = useState(null);
  const items = [
    { label: "Bank", url: "/master/finance/bank" },
    { label: "Edit Account details" },
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
            Row count :{" "}
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
    fontFamily: "Inter, sans-serif",
    fontWeight: 500,
    padding: 6,
    color: "#000",
    border: "none",
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
  const handleSubmit = (value) => {
    console.log(value, "columnData");
    // setVisible(true);
    dispatch(postPatchAccountDetailEdit(value));
    navigate("/master/finance/bank/accountdataview");
  };

  const [accType, setAccType] = useState([]);

  console.log(accType, "accType");
  const setFormikValues = () => {
    const AccountTypeData = AccountPatchDetailView?.AccountType;
    const updatedValues = {
      id: AccountPatchDetailView?.id,
      AccountNumber: AccountPatchDetailView?.AccountNumber,
      AccountName: AccountPatchDetailView?.AccountName,
      AccountType: AccountTypeData,
      MainAccount: AccountPatchDetailView?.MainAccount,
      MainAccountDescription: AccountPatchDetailView?.MainAccountDescription,
      TransactionLimit: AccountPatchDetailView?.TransactionLimit,
    };
    console.log(updatedValues, "uu");
    if (AccountTypeData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setAccType([{ label: AccountTypeData, value: AccountTypeData }]);
    }

    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  console.log(formik.values.id, "idd");
  useEffect(() => {
    setFormikValues();
  }, [AccountPatchDetailView]);

  const handlesavebutton = () => {
    setVisible(false);
    dispatch(postChequeDataMiddleWare(formik.values));
  };
  const handleEditbutton = () => {
    setVisibleEdit(false);
  };
  const handleNavigation = () => {
    navigate("/master/finance/bank/accountdataview");
  };

  // const handleNavigation = () => {
  //   Navigate("/SpecificVoucher")
  // }
  // const formik = useFormik({
  //   initialValues: initialValues,
  //   // validate: customValidation,
  //   // onSubmit: (values) => {
  //   //   // Handle form submission
  //   //    handleSubmit(values);

  //   // },
  //   onSubmit: handleSubmit
  // });

  const renderToggleButton = () => {
    return (
      <div>
        <ToggleButton />
      </div>
    );
  };
  const handleEditData = (data) => {
    setVisibleEdit(true);
    console.log(data, "dataa");
    dispatch(getChequeEditDataMiddleWare(data));
  };

  return (
    <div className="overall__editaccountdetail__container">
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>

        <label className="label_header">Edit Account details</label>
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
                label="Account Number"
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
                label="Account Name"
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
                label="Account Type"
                value={formik.values.AccountType}
                onChange={(e) => formik.setFieldValue("AccountType", e.value)}
                options={accType}
                optionLabel="label"
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
                label="Main Account"
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
                label="Main Account Description"
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
                label="Transaction Limit"
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
            label="Add"
            className="addbutton_container"
            icon={<SvgAdd />}
            onClick={() => setVisible(true)}
            // onClick={() => {
            //   formik.handleSubmit();
            // }}
            disabled={!formik.isValid}
          />
        </div>

        <div className="tablegap_container">
          <DataTable
            disabled={!formik.isValid}
            value={chequeListData}
            tableStyle={{ minWidth: "50rem", color: "#1C2536" }}
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
              field="chequeBookNo"
              header="Cheque Book Number"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.chequeBookNo?.toUpperCase()}
            ></Column>
            <Column
              field="chequeLeafBegining"
              header="Cheque Leaf Beginning"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.chequeLeafBegining?.toUpperCase()}
            ></Column>
            <Column
              field="chequeLeafEnd"
              header="Cheque Leaf End"
              headerStyle={headerStyle}
              className="fieldvalue_container"
              body={(rowData) => rowData.chequeLeafEnd?.toUpperCase()}
            ></Column>
            <Column
              body={renderToggleButton}
              header="Statas"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>
            <Column
              body={(columnData) => (
                <div
                  onClick={() => {
                    handleEditData(columnData);
                  }}
                >
                  <SvgEdit />
                </div>
              )}
              header="Action"
              headerStyle={headerStyle}
              className="fieldvalue_container"
            ></Column>

            {/* <Column field="Amount" header="Total Amount" style={{ width: '24rem' }} headerStyle={headerStyle} className='fieldvalue_container'></Column> */}
            {/* <Column field="action" header="Action" headerStyle={headerStyle} className='fieldvalue_container'
        onClick={() => setVisible(true)}
        ></Column> */}

            {/* <Column
            body={(params) => (
                <SvgEditIcon onClick={() => setVisible(true)}/>
            )}
            header="Action"
            headerStyle={headerStyle}
            className="fieldvalue_container"
        ></Column> */}
          </DataTable>
        </div>
      </Card>

      <div className="next_container">
        <Button
          className="submit_button p-0"
          label="Update"
          onClick={formik.handleSubmit}
          //   disabled={!selectedProducts}

          disabled={!formik.isValid}
        />
      </div>
      <CheckEditData
        action={action}
        getEditChequeData={getEditChequeData}
        visible={visible}
        setVisible={setVisible}
        visibleEdit={visibleEdit}
        setVisibleEdit={setVisibleEdit}
      />
    </div>
  );
}

export default EditAccountDetail;
