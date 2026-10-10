import React, { useEffect, useState } from "react";
import "./index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
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
import useJvMasterData from "../../JournalVoucher/useJvMasterData";
import { EMPTY_VALUE, formatValue } from "../../../components/KeyValueGrid";

// a line in the local currency carries the same figure as its foreign amount: only a converted line shows one
const foreignShown = (r) => Number(r.foreignAmount) && Number(r.foreignAmount) !== Number(r.localAmount);

const ENTRY_TYPES = [
  { label: "Debit", value: "Debit" },
  { label: "Credit", value: "Credit" },
];

const TableData = ({ newDataTable, editID }) => {
  const { correctionJVList, getCorrectionJVEdit } = useSelector(
    ({ correctionJVMainReducers }) => {
      return {
        loading: correctionJVMainReducers?.loading,
        correctionJVList: correctionJVMainReducers?.correctionJVList,
        getCorrectionJVEdit: correctionJVMainReducers?.getCorrectionJVEdit,
      };
    }
  );

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
  const renderEditButton = (rowData) => {
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

  const {
    mainAccountsData,
    subAccountsData,
    branchCodesData,
    departmentCodesData,
    currencyCodesData,
  } = useJvMasterData();
  const toOptions = (rows) =>
    rows.map((row) => ({ label: row.description, value: row.code }));
  const mainAccountC = toOptions(mainAccountsData);
  const branchCodeData = toOptions(branchCodesData);
  const deptData = toOptions(departmentCodesData);
  const currencyCodeData = toOptions(currencyCodesData);
  const entryT = ENTRY_TYPES;
  const describe = (rows, code) =>
    rows.find((row) => row.code === code)?.description || "";

  const customValidation = (values) => {
    const errors = {};

    if (!values.mainAccount) {
      errors.mainAccount = "This field is required";
    }

    if (!values.entryType) {
      errors.entryType = "This field is required";
    }
    const hasSubAccounts = subAccountsData.some(
      (sub) => sub.mainAccount === values.mainAccount
    );
    if (hasSubAccounts && !values.subAccount) {
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
  const [, setEditID] = useState(null);
  const handleEdit = (rowData) => {
    dispatch(getPatchCorrectionJVEdit(rowData));
    setEditID(rowData.id);
    setVisible(true);
  };
  const handleSubmit = (value) => {
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
      setVisible(false);
    },
  });

  const subAccountData = toOptions(
    subAccountsData.filter((sub) => sub.mainAccount === formik.values.mainAccount)
  );

  const setFormikValues = () => {
    const row = getCorrectionJVEdit || {};
    formik.setValues({
      ...formik.values,
      id: row.id,
      mainAccount: row.mainAccount || "",
      mainAccountDescription: row.mainAccountDescription || "",
      entryType: row.entryType || "",
      subAccount: row.subAccount || "",
      subAccountDescription: row.subAccountDescription || "",
      branchCode: row.branchCode || "",
      branchCodeDescription: row.branchCodeDescription || "",
      departmentCode: row.departmentCode || "",
      departmentDescription: row.departmentDescription || "",
      currencyCode: row.currencyCode || "",
      currencyDescription: row.currencyDescription || "",
      foreignAmount: row.foreignAmount || "",
    });
  };

  useEffect(() => {
    setFormikValues();
  }, [getCorrectionJVEdit]);

  return (
    <div className="corrections__table__container">
      <DataTable
        value={correctionJVList}
        paginator={(correctionJVList || []).length > 20}
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
        currentPageReportTemplate="{first} - {last} of {totalRecords}"
        paginatorTemplate={template2}
        className="corrections__table__main"
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
          body={(r) => (foreignShown(r) ? formatValue(r.foreignAmount, { type: "amount", currency: r.currencyCode || undefined }) : EMPTY_VALUE)}
          bodyClassName="bv-num"
          headerClassName="bv-num"
        ></Column>
        <Column
          field="localAmount"
          header="Local Amount"
          className="fieldvalue_container"
          body={(r) => formatValue(r.localAmount === "" ? null : r.localAmount, { type: "amount" })}
          bodyClassName="bv-num"
          headerClassName="bv-num"
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                value={describe(mainAccountsData, formik.values.mainAccount)}
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                value={describe(subAccountsData, formik.values.subAccount)}
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                value={describe(branchCodesData, formik.values.branchCode)}
              />
              {formik.touched.branchCodeDescription &&
                formik.errors.branchCodeDescription && (
                  <div
                    style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                    style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                value={describe(departmentCodesData, formik.values.departmentCode)}
              />
              {formik.touched.departmentDescription &&
                formik.errors.departmentDescription && (
                  <div
                    style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                value={describe(currencyCodesData, formik.values.currencyCode)}
              />
              {formik.touched.currencyDescription &&
                formik.errors.currencyDescription && (
                  <div
                    style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
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
