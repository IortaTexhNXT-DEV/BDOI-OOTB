import React, { useEffect, useState } from "react";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import Productdata from "./mock";
import { Dropdown } from "primereact/dropdown";
import SvgEditIcon from "../../../assets/icons/SvgEditicons";
import { Button } from "primereact/button";
import { Dialog } from "primereact/dialog";
import "../EditData/index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../components/DropDowns";
import InputField from "../../../components/InputField";
import SvgDropdown from "../../../assets/icons/SvgDropdown";
import { useDispatch, useSelector } from "react-redux";
import {
  getPatchCorrectionJVEdit,
  patchCorrectionJVEdit,
} from "../store/correctionJVMiddleWare";

const TableData = ({ newDataTable, editID }) => {
  const { correctionJVList, getCorrectionJVEdit, loading } = useSelector(
    ({ correctionJVMainReducers }) => {
      return {
        loading: correctionJVMainReducers?.loading,
        correctionJVList: correctionJVMainReducers?.correctionJVList,
        getCorrectionJVEdit: correctionJVMainReducers?.getCorrectionJVEdit,
      };
    }
  );
  console.log(getCorrectionJVEdit.departmentCode, "getCorrectionJVEdit");
  // const editId = editID;
  console.log(correctionJVList);

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
        <div className="table__selector">
          <React.Fragment>
            <span style={{ color: "var(--text-color)", userSelect: "none" }}>
              Row count :{" "}
            </span>
            <Dropdown
              value={options.value}
              className="pagedropdown_container"
              options={dropdownOptions}
              onChange={options.onChange}
            />
          </React.Fragment>
        </div>
      );
    },
  };
  const [visible, setVisible] = useState(false);
  // const handleEdit = () => {
  //   setVisible(true)
  // }
  const renderEditButton = (rowData) => {
    console.log(rowData.id, "rowData");
    return (
      <div className="action__icon">
        <div onClick={() => handleEdit(rowData)} className="action__button">
          <SvgEditIcon />
        </div>
      </div>
    );
  };
  const headerStyle = {
    // textAlign: "end",
  };

  const codeOptions = [
    { label: "Option 1", value: "00123" },
    { label: "Option 2", value: "00124" },
  ];
  const codeOptionsMain = [
    { label: "Option 1", value: "MAC001" },
    { label: "Option 2", value: "MAC002" },
    { label: "Option 3", value: "MAC003" },
  ];
  const codeOptionsSub = [
    { label: "Option 1", value: "SAC001" },
    { label: "Option 2", value: "SAC002" },
  ];
  const codeOptionsDept = [
    { label: "Option 1", value: "FIN" },
    { label: "Option 2", value: "MKT" },
    { label: "Option 1", value: "IT" },
    { label: "Option 2", value: "SLS" },
  ];
  const codeOptionsBranch = [
    { label: "Option 1", value: "THB001" },
    { label: "Option 2", value: "THB002" },
  ];

  const codeOptionsType = [
    { label: "Option 1", value: "Credit" },
    { label: "Option 2", value: "Debit" },
  ];
  const codeCurrencyType = [
    { label: "THB", value: "THB" },
    { label: "Option 2", value: "EURO" },
  ];

  const customValidation = (values) => {
    const errors = {};

    if (!values.mainAccount) {
      errors.mainAccount = "This field is required";
    }

    if (!values.entryType) {
      errors.entryType = "This field is required";
    }
    if (!values.subAccount) {
      errors.subAccount = "This field is required";
    }

    if (!values.branchCode) {
      errors.branchCode = "This field is required";
    }

    if (!values.departmentCode) {
      errors.departmentCode = "This field is required";
    }

    if (!values.currencyCode) {
      errors.currencyCode = "This field is required";
    }

    if (!values.foreignAmount) {
      errors.foreignAmount = "This field  is required";
    }

    return errors;
  };
  const dispatch = useDispatch();
  const [EditID, setEditID] = useState(null);
  const handleEdit = (rowData) => {
    console.log(rowData.id, "rowDatarowData");
    dispatch(getPatchCorrectionJVEdit(rowData));
    setEditID(rowData.id);
    setVisible(true);
  };
  const handleSubmit = (value) => {
    console.log(value, "find values in formik");
    // const valueWithId = {
    //   ...values,
    //   id: EditID,
    // };
    dispatch(patchCorrectionJVEdit(value));
    setVisible(false);
  };

  const formik = useFormik({
    initialValues: {
      mainAccount: "",
      mainAccountDescription: "",
      entryType: "",
      subAccount: "",
      subAccountDescription: "",
      branchCode: "",
      branchCodeDescription: "",
      departmentCode: "",
      departmentDescription: "",
      currencyCode: "",
      currencyDescription: "",
      foreignAmount: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
      formik.resetForm();
      // handleUpdate(values);
      setVisible(false);
    },
  });

  const [currencyCodeData, setCurrencyCodeData] = useState([]);
  const [mainAccountC, setMainAccountcodeData] = useState([]);
  const [subAccountData, setSubAccountData] = useState([]);
  const [branchCodeData, setBranchCodeData] = useState([]);
  const [deptData, setDeptData] = useState([]);
  const [entryT, setEntryTData] = useState([]);

  const setFormikValues = () => {
    // const getCorrectionJVEdit = correctionJVList.find((item) => item.id === EditID);
    console.log(getCorrectionJVEdit, "find data");
    const MainAccountData = getCorrectionJVEdit?.mainAccount;
    const subAccountData = getCorrectionJVEdit?.subAccount;
    const branchCodeData = getCorrectionJVEdit?.branchCode;
    const deptData = getCorrectionJVEdit.departmentCode;
    const currencyCodeData = getCorrectionJVEdit?.currencyCode;
    const entryT = getCorrectionJVEdit?.entryType;
    const updatedValues = {
      id: getCorrectionJVEdit?.id,
      mainAccount: MainAccountData || "",
      mainAccountDescription: getCorrectionJVEdit?.mainAccountDescription || "",
      entryType: entryT || "",
      subAccount: subAccountData || "",
      subAccountDescription: getCorrectionJVEdit?.subAccountDescription || "",
      branchCode: branchCodeData || "",
      branchCodeDescription: getCorrectionJVEdit?.branchCodeDescription || "",
      departmentCode: deptData || "",
      departmentDescription: getCorrectionJVEdit?.departmentDescription || "",
      currencyCode: currencyCodeData || "",
      currencyDescription: getCorrectionJVEdit?.currencyDescription || "",
      foreignAmount: getCorrectionJVEdit?.foreignAmount || "",
    };
    if (MainAccountData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setMainAccountcodeData([
        { label: MainAccountData, value: MainAccountData },
      ]);
    }
    if (subAccountData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setSubAccountData([{ label: subAccountData, value: subAccountData }]);
    }
    if (branchCodeData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setBranchCodeData([{ label: branchCodeData, value: branchCodeData }]);
    }
    if (deptData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setDeptData([{ label: deptData, value: deptData }]);
    }
    if (currencyCodeData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setCurrencyCodeData([
        { label: currencyCodeData, value: currencyCodeData },
      ]);
    }
    if (entryT) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setEntryTData([{ label: entryT, value: entryT }]);
    }
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  useEffect(() => {
    setFormikValues();
  }, [getCorrectionJVEdit]);

  return (
    <div className="corrections__table__container">
      <DataTable
        value={correctionJVList}
        paginator
        rows={5}
        rowsPerPageOptions={[5, 10, 25, 50]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        className="corrections__table__main"
        scrollable={true}
        scrollHeight="40vh"
      >
        <Column
          field="mainAccount"
          header="Main A/c"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="subAccount"
          header="Sub A/c"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="remarks"
          header="Remarks"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="currencyCode"
          header="Currency"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="foreignAmount"
          header="Foreign Amount"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="localAmount"
          header="Local Amount"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="entryType"
          header="Entry"
          className="fieldvalue_container"
        ></Column>
        <Column
          field="id"
          body={renderEditButton}
          header="Edit"
          className="fieldvalue_container last__div__table"
          headerStyle={headerStyle}
        ></Column>
      </DataTable>
      <Dialog
        header="Edit Data"
        visible={visible}
        className="corrections__jv__Edit__modal__container master__flow__common__dialog__container"
        onHide={() => setVisible(false)}
        dismissableMask={true}
        style={{ boxShadow: "none" }} 
      >
        <div className="form__container">
          <div className="grid m-0">
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                className="input__field__corrections"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                placeholder="Select "
                classNames="select__label__corrections"
                optionLabel="value"
                label="Main Account"
                value={formik.values.mainAccount}
                onChange={(e) => formik.setFieldValue("mainAccount", e.value)}
                options={mainAccountC}
              />
              {formik.touched.mainAccount && formik.errors.mainAccount && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.mainAccount}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <InputField
                classNames="input__field__corrections__inactive"
                disabled={true}
                className="input__label__corrections"
                label="Main Account Description"
                value={
                  formik.values.mainAccount
                    ? `Main Account Description ${formik.values.mainAccount}`
                    : ""
                }
              />
            </div>

            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                className="input__field__corrections"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                placeholder="Select "
                classNames="select__label__corrections"
                optionLabel="value"
                label="Entry Type"
                value={formik.values.entryType}
                onChange={(e) => formik.setFieldValue("entryType", e.value)}
                options={entryT}
              />
              {formik.touched.entryType && formik.errors.entryType && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.entryType}
                </div>
              )}
            </div>
          </div>
          <div
            className="grid m-0 p-0 add__journal__vocture__add__JV"
            style={{ alignItems: "center" }}
          >
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                className="input__field__corrections"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                classNames="select__label__corrections"
                optionLabel="value"
                label="Sub Account"
                value={formik.values.subAccount}
                onChange={(e) => formik.setFieldValue("subAccount", e.value)}
                options={subAccountData}
                placeholder="Select "
              />
              {formik.touched.subAccount && formik.errors.subAccount && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.subAccount}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
              <InputField
                classNames="input__field__corrections__inactive"
                disabled={true}
                className="input__label__corrections"
                label="Sub Account Description"
                value={
                  formik.values.subAccount
                    ? `Sub Account Description ${formik.values.subAccount}`
                    : ""
                }
              />
            </div>
          </div>
          <div
            className="grid m-0 p-0 add__journal__vocture__add__JV"
            style={{ alignItems: "center" }}
          >
            <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
              <DropDowns
                className="input__field__corrections"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                classNames="select__label__corrections"
                optionLabel="value"
                label="Branch Code"
                value={formik.values.branchCode}
                onChange={(e) => formik.setFieldValue("branchCode", e.value)}
                options={branchCodeData}
                placeholder="Select "
              />
              {formik.touched.branchCode && formik.errors.branchCode && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.branchCode}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <InputField
                classNames="input__field__corrections__inactive"
                disabled={true}
                className="input__label__corrections"
                label="Branch Code Description"
                value={
                  formik.values.branchCode
                    ? `Branch Code Description ${formik.values.branchCode}`
                    : ""
                }
              />
              {formik.touched.branchCodeDescription &&
                formik.errors.branchCodeDescription && (
                  <div
                    style={{ fontSize: 12, color: "red" }}
                    className="formik__errror__JV"
                  >
                    {formik.errors.branchCodeDescription}
                  </div>
                )}
            </div>
          </div>
          <div
            className="grid m-0 p-0 add__journal__vocture__add__JV"
            style={{ alignItems: "center" }}
          >
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                className="input__field__corrections"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                classNames="select__label__corrections"
                optionLabel="value"
                label="Department Code"
                value={formik.values.departmentCode}
                onChange={(e) =>
                  formik.setFieldValue("departmentCode", e.value)
                }
                options={deptData}
                placeholder="Select "
              />
              {formik.touched.departmentCode &&
                formik.errors.departmentCode && (
                  <div
                    style={{ fontSize: 12, color: "red" }}
                    className="formik__errror__JV"
                  >
                    {formik.errors.departmentCode}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <InputField
                classNames="input__field__corrections__inactive"
                disabled={true}
                className="input__label__corrections"
                label="Department Description"
                value={
                  formik.values.departmentCode
                    ? `Department Description ${formik.values.departmentCode}`
                    : ""
                }
              />
              {formik.touched.departmentDescription &&
                formik.errors.departmentDescription && (
                  <div
                    style={{ fontSize: 12, color: "red" }}
                    className="formik__errror__JV"
                  >
                    {formik.errors.departmentDescription}
                  </div>
                )}
            </div>
          </div>
          <div
            className="grid m-0 p-0 add__journal__vocture__add__JV"
            style={{ alignItems: "center" }}
          >
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                className="input__field__corrections"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                classNames="select__label__corrections"
                optionLabel="value"
                label="Currency Code"
                value={formik.values.currencyCode}
                onChange={(e) => formik.setFieldValue("currencyCode", e.value)}
                options={currencyCodeData}
                placeholder="Select "
              />
              {formik.touched.currencyCode && formik.errors.currencyCode && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.currencyCode}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <InputField
                classNames="input__field__corrections__inactive"
                disabled={true}
                className="input__label__corrections"
                label="Currency Description"
                value={
                  formik.values.currencyCode
                    ? `Currency Description ${formik.values.currencyCode}`
                    : ""
                }
              />
              {formik.touched.currencyDescription &&
                formik.errors.currencyDescription && (
                  <div
                    style={{ fontSize: 12, color: "red" }}
                    className="formik__errror__JV"
                  >
                    {formik.errors.currencyDescription}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <InputField
                classNames="input__field__corrections"
                className="select__label__corrections"
                label="Foreign Amount"
                value={formik.values.foreignAmount}
                onChange={(e) =>
                  formik.setFieldValue("foreignAmount", e.target.value)
                }
                placeholder="Enter"
              />
              {formik.touched.foreignAmount && formik.errors.foreignAmount && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.foreignAmount}
                </div>
              )}
            </div>

            <div
              className="col-12 save__popup__correction"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "flex-end",
              }}
            >
              <Button
                label="Update"
                className="correction__btn__corrections"
                disabled={!formik.isValid}
                onClick={formik.handleSubmit}
              />
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default TableData;
