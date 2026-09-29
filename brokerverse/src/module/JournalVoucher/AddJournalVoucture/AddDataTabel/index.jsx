import React, { useEffect, useState } from "react";
import "../AddDataTabel/index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import SvgEditIcon from "../../../../assets/icons/SvgEditicons";
import SvgTable from "../../../../assets/icons/SvgTable";
import SvgDeleteIcon from "../../../../assets/icons/SvgDeleteIcon";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import { Dialog } from "primereact/dialog";
import "../EditData/index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import SvgIconeye from "../../../../assets/icons/SvgIconeye";
import { patchJVMiddleware } from "../../store/journalVoucherMiddleware";

const AddDataTabel = ({ newDataTable, journalVoucherPostTabelData }) => {
  const [first, setFirst] = useState(0);
  const [visibleEdit, setVisibleEdit] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const navigate = useNavigate();
  const handleNavigate = (rowData) => {
    console.log(rowData, "rowData");

    // setVisibleEdit(true)
  };
  console.log(journalVoucherPostTabelData, "jv");

  const onPageChange = (event) => {
    setFirst(event.first);
    setRowsPerPage(event.rows);
  };
  const isEmpty = journalVoucherPostTabelData.length === 0;
  const emptyTableIcon = (
    <div className="empty-table-icon">
      <SvgTable />
    </div>
  );

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
        <div style={{ width: "46%" }} className="table__selector">
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

  const handleEdit = (rowData) => {
    setEditID(rowData?.id);
    console.log("first10", rowData?.id);
    setVisibleEdit(true);
  };

  const headerStyle = {
    fontSize: 16,
    fontFamily: "Nunito, Arial, sans-serif",
    fontWeight: 500,
    padding: "1rem",
    color: "#000",
    border: "none",
  };

  const headaction = {
    justifyContent: "center",
    fontsize: 16,
    fontfamily: "Inter, sans-serif",
    fontWeight: 400,
    padding: "1rem",
    color: "#000",
    border: " none",
    display: "flex",
  };

  const codeOptionsMain = [
    { label: "Option 1", value: "Main00123" },
    { label: "Option 2", value: "Main00124" },
  ];
  const codeOptionsSub = [
    { label: "Option 1", value: "Sub00123" },
    { label: "Option 2", value: "Sub00124" },
  ];
  const codeOptionsDept = [
    { label: "Option 1", value: "Dep00123" },
    { label: "Option 2", value: "Dep00124" },
  ];
  const codeOptionsBranch = [
    { label: "Option 1", value: "Branch00123" },
    { label: "Option 2", value: "Branch00124" },
  ];

  const codeOptionsType = [
    { label: "Option 1", value: "Credit" },
    { label: "Option 2", value: "Debit" },
  ];
  const codeCurrencyType = [
    { label: "PHP", value: "PHP" },
    { label: "THB", value: "THB" },
    { label: "USD", value: "USD" },
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
  const handleSubmit = (values) => {
    console.log(values, "find values in formik");
    const valueWithId = {
      ...values,
      id: EditID,
    };
    console.log(valueWithId, "find values in formik");
    dispatch(patchJVMiddleware(valueWithId));
    setVisibleEdit(false);
  };

  useEffect(() => {
    if (EditID != null) {
      setFormikValues();
    }
  }, [EditID]);
  const [mainAc, setMainAccountcodeData] = useState([]);
  const [subAcc, setSubAccountData] = useState([]);
  const [entrytypp, setEnteryTypeData] = useState([]);
  const [branchh, setBranchCodeData] = useState([]);
  const [currencyyy, setCurrencyData] = useState([]);
  const [deptt, setDeptData] = useState([]);

  const setFormikValues = () => {
    const targetInvoice = journalVoucherPostTabelData.find(
      (item) => item.id === EditID
    );
    console.log(targetInvoice, "find data");
    const mainAcc = targetInvoice?.mainAccount;
    const subAc = targetInvoice?.subAccount;
    const entryT = targetInvoice?.entryType;
    const branchC = targetInvoice?.branchCode;
    const deptC = targetInvoice?.departmentCode;
    const currencyC = targetInvoice?.currencyCode;
    const updatedValues = {
      mainAccount: mainAcc || "",
      mainAccountDescription: targetInvoice?.mainAccountDescription || "",
      entryType: entryT || "",
      subAccount: subAc || "",
      subAccountDescription: targetInvoice?.subAccountDescription || "",
      branchCode: branchC || "",
      branchCodeDescription: targetInvoice?.branchCodeDescription || "",
      departmentCode: deptC || "",
      departmentDescription: targetInvoice?.departmentDescription || "",
      currencyCode: currencyC || "",
      currencyDescription: targetInvoice?.currencyDescription || "",
      foreignAmount: targetInvoice?.foreignAmount || "",
    };

    if (mainAcc) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setMainAccountcodeData([{ label: mainAcc, value: mainAcc }]);
    }
    if (subAc) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setSubAccountData([{ label: subAc, value: subAc }]);
    }
    if (entryT) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setEnteryTypeData([{ label: entryT, value: entryT }]);
    }
    if (branchC) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setBranchCodeData([{ label: branchC, value: branchC }]);
    }
    if (currencyC) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setCurrencyData([{ label: currencyC, value: currencyC }]);
    }
    if (deptC) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setDeptData([{ label: deptC, value: deptC }]);
    }
    formik.setValues({ ...formik.values, ...updatedValues });
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
      setVisibleEdit(false);
    },
  });

  return (
    <div className="journal__table__container">
      <DataTable
        value={journalVoucherPostTabelData}
        style={{ overflowY: "auto", maxWidth: "100%" }}
        responsive={true}
        className="table__view__Journal__Voture"
        paginator
        paginatorLeft
        rows={5}
        rowsPerPageOptions={[5, 10, 25, 50]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        onPage={onPageChange}
        emptyMessage={isEmpty ? emptyTableIcon : null}
        scrollable={true}
        scrollHeight="40vh"
      >
        <Column
          field="mainAccount"
          header="Main A/c"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          style={{ paddingLeft: "0.5rem" }}
        ></Column>
        <Column
          field="subAccount"
          header="Sub A/c"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          style={{ paddingLeft: "0.5rem" }}
        ></Column>

        <Column
          field="Remarks"
          header="Remarks"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          style={{ paddingLeft: "0.5rem" }}
        ></Column>
        <Column
          field="foreignAmount"
          header="Foreign Amount"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          style={{ paddingLeft: "0.5rem" }}
        ></Column>
        <Column
          field="currencyCode"
          header="Currency"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          style={{ paddingLeft: "0.5rem" }}
        ></Column>

        <Column
          field="localAmount"
          header="Local Amount"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          style={{ paddingLeft: "0.5rem" }}
        ></Column>
        <Column
          field="entryType"
          header="Entry"
          className="fieldvalue_container"
          headerStyle={headerStyle}
          style={{ paddingLeft: "0.5rem !important" }}
        ></Column>
        <Column
          body={(columnData) => (
            <SvgEditIcon onClick={() => handleEdit(columnData)} />
          )}
          header="Action"
          className="fieldvalue_container"
          headerStyle={headaction}
          style={{ textAlign: "center" }}
        ></Column>
      </DataTable>

      <Dialog
        header="Edit Journal Voucher"
        visible={visibleEdit}
        className="jv__Edit__container master__flow__common__dialog__container"
        onHide={() => setVisibleEdit(false)}
        dismissableMask={true}
        style={{ boxShadow: "none" }}
      >
        <div className="form__container">
          <div className="grid m-0">
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                // className="input__field__jv"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                placeholder="Select "
                className="dropdown__container"
                // classNames="select__label__jv"
                optionLabel="value"
                label="Main Account"
                value={formik.values.mainAccount}
                onChange={(e) => formik.setFieldValue("mainAccount", e.value)}
                options={mainAc}
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
                // classNames="input__field__jv"
                // className="input__label__jv"
                classNames="field__container"
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
                // className="input__field__jv"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                placeholder="Select "
                className="dropdown__container"
                // classNames="select__label__jv"
                optionLabel="value"
                label="Entry Type"
                value={formik.values.entryType}
                onChange={(e) => formik.setFieldValue("entryType", e.value)}
                options={entrytypp}
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
            className="grid m-0 "
            // style={{ alignItems: "center" }}
          >
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                // className="input__field__jv"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                // classNames="select__label__jv"
                className="dropdown__container"
                optionLabel="value"
                label="Sub Account"
                value={formik.values.subAccount}
                onChange={(e) => formik.setFieldValue("subAccount", e.value)}
                options={subAcc}
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
                // classNames="input__field__jv"
                // className="input__label__jv"
                classNames="field__container"
                label="Sub Account Description"
                value={
                  formik.values.subAccount
                    ? `Sub Account Description ${formik.values.subAccount}`
                    : ""
                }
              />
            </div>
          </div>
          <div className="grid m-0 ">
            <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
              <DropDowns
                // className="input__field__jv"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                // classNames="select__label__jv"
                optionLabel="value"
                className="dropdown__container"
                label="Branch Code"
                value={formik.values.branchCode}
                onChange={(e) => formik.setFieldValue("branchCode", e.value)}
                options={branchh}
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
                // classNames="input__field__jv"
                // className="input__label__jv"
                classNames="field__container"
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
          <div className="grid m-0 ">
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                // className="input__field__jv"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                // classNames="select__label__jv"
                className="dropdown__container"
                optionLabel="value"
                label="Department Code"
                value={formik.values.departmentCode}
                onChange={(e) =>
                  formik.setFieldValue("departmentCode", e.value)
                }
                options={deptt}
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
                // classNames="input__field__jv"
                // className="input__label__jv"
                classNames="field__container"
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
            className="grid m-0 "
            // style={{ alignItems: "center" }}
          >
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                // className="input__field__jv"
                dropdownIcon={<SvgDropdown color={"#000"} />}
                // classNames="select__label__jv"
                optionLabel="value"
                className="dropdown__container"
                label="Currency Code"
                value={formik.values.currencyCode}
                onChange={(e) => formik.setFieldValue("currencyCode", e.value)}
                options={currencyyy}
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
                // classNames="input__field__jv"
                // className="input__label__jv"
                classNames="field__container"
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
                // classNames="input__field__jv"
                // className="select__label__jv"
                classNames="field__container"
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
            <div className="col-12 md:col-6">
              <div className="select__label__jv">
                Remarks <span style={{ color: "#B1B1B1" }}>(Options)</span>
              </div>
              <InputField
                // classNames="input__field__jv"
                // className="select__label__jv"
                // label="Remarks (Options)"
                value={formik.values.remarks}
                classNames="field__container"
                onChange={(e) =>
                  formik.setFieldValue("remarks", e.target.value)
                }
                placeholder="Enter"
              />
              {formik.touched.remarks && formik.errors.remarks && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.remarks}
                </div>
              )}
            </div>

            <div
              className="col-12 save__popup__jv"
              style={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "flex-end",
              }}
            >
              <Button
                label="Save"
                className="jv__btn__reversal"
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

export default AddDataTabel;
