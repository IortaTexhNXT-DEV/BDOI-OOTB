import React, { useEffect, useState } from "react";
import "../AddDataTabel/index.scss";
import { DataTable } from "primereact/datatable";
import { Column } from "primereact/column";
import { Dropdown } from "primereact/dropdown";
import SvgEditIcon from "../../../../assets/icons/SvgEditicons";
import SvgTable from "../../../../assets/icons/SvgTable";
import { useDispatch } from "react-redux";
import { Dialog } from "primereact/dialog";
import "../EditData/index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { patchJVMiddleware } from "../../store/journalVoucherMiddleware";
import useJvMasterData from "../../useJvMasterData";

const ENTRY_TYPES = [
  { label: "Debit", value: "Debit" },
  { label: "Credit", value: "Credit" },
];

const AddDataTabel = ({ newDataTable, journalVoucherPostTabelData }) => {
  const [, setFirst] = useState(0);
  const [visibleEdit, setVisibleEdit] = useState(false);
  const [, setRowsPerPage] = useState(10);

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
        { label: 20, value: 20 },
        { label: 50, value: 50 },
        { label: 100, value: 100 },
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

  const customValidation = (values) => {
    const errors = {};

    if (!values.mainAccount) {
      errors.mainAccount = "This field is required";
    }

    if (!values.entryType) {
      errors.entryType = "This field is required";
    }
    // a sub account is needed only when the main account has sub accounts
    const hasSubAccounts = subAccountsData.some((sub) => sub.mainAccount === values.mainAccount);
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
  const [EditID, setEditID] = useState(null);
  const handleSubmit = (values) => {
    // keep the local amount in step with an edited foreign amount (same rate the line was entered with)
    const original = (Array.isArray(journalVoucherPostTabelData) ? journalVoucherPostTabelData : []).find((r) => r.id === EditID) || {};
    const oldForeign = parseFloat(original.foreignAmount);
    const oldLocal = parseFloat(original.localAmount);
    const rate = oldForeign > 0 && oldLocal > 0 ? oldLocal / oldForeign : 1;
    const newForeign = parseFloat(values.foreignAmount);
    const valueWithId = {
      ...values,
      localAmount: Number.isFinite(newForeign) ? (newForeign * rate).toFixed(2) : values.localAmount,
      id: EditID,
    };
    dispatch(patchJVMiddleware(valueWithId));
    setVisibleEdit(false);
  };

  useEffect(() => {
    if (EditID != null) {
      setFormikValues();
    }
  }, [EditID]);
  const {
    mainAccountsData,
    subAccountsData,
    branchCodesData,
    departmentCodesData,
    currencyCodesData,
  } = useJvMasterData();
  const toOptions = (rows) =>
    rows.map((row) => ({ label: row.description, value: row.code }));
  const describe = (rows, code) =>
    rows.find((row) => row.code === code)?.description || "";
  const mainAc = toOptions(mainAccountsData);
  const entrytypp = ENTRY_TYPES;
  const branchh = toOptions(branchCodesData);
  const currencyyy = toOptions(currencyCodesData);
  const deptt = toOptions(departmentCodesData);

  const setFormikValues = () => {
    const targetInvoice = journalVoucherPostTabelData.find(
      (item) => item.id === EditID
    );
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

  const subAcc = toOptions(
    subAccountsData.filter((sub) => sub.mainAccount === formik.values.mainAccount)
  );
  return (
    <div className="journal__table__container">
      <DataTable
        value={journalVoucherPostTabelData}
        style={{ overflowY: "auto", maxWidth: "100%" }}
        responsive={true}
        className="table__view__Journal__Voture"
        paginator
        paginatorLeft
        rows={20}
        rowsPerPageOptions={[20, 50, 100]}
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
                dropdownIcon={<SvgDropdown color={"#000"} />}
                placeholder="Select "
                className="dropdown__container"
                optionLabel="value"
                label="Main Account"
                value={formik.values.mainAccount}
                onChange={(e) => formik.setFieldValue("mainAccount", e.value)}
                options={mainAc}
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
                classNames="field__container"
                label="Main Account Description"
                value={describe(mainAccountsData, formik.values.mainAccount)}
              />
            </div>

            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                dropdownIcon={<SvgDropdown color={"#000"} />}
                placeholder="Select "
                className="dropdown__container"
                optionLabel="value"
                label="Entry Type"
                value={formik.values.entryType}
                onChange={(e) => formik.setFieldValue("entryType", e.value)}
                options={entrytypp}
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
            className="grid m-0 "
          >
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                dropdownIcon={<SvgDropdown color={"#000"} />}
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.subAccount}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
              <InputField
                classNames="field__container"
                label="Sub Account Description"
                value={describe(subAccountsData, formik.values.subAccount)}
              />
            </div>
          </div>
          <div className="grid m-0 ">
            <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
              <DropDowns
                dropdownIcon={<SvgDropdown color={"#000"} />}
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.branchCode}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <InputField
                classNames="field__container"
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
          <div className="grid m-0 ">
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                dropdownIcon={<SvgDropdown color={"#000"} />}
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
                    style={{ fontSize: 12, color: "var(--color-danger)" }}
                    className="formik__errror__JV"
                  >
                    {formik.errors.departmentCode}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <InputField
                classNames="field__container"
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
            className="grid m-0 "
          >
            <div className="col-12 md:col-3 lg:col-3 xl:col-3">
              <DropDowns
                dropdownIcon={<SvgDropdown color={"#000"} />}
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.currencyCode}
                </div>
              )}
            </div>
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <InputField
                classNames="field__container"
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
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
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
                value={formik.values.remarks}
                classNames="field__container"
                onChange={(e) =>
                  formik.setFieldValue("remarks", e.target.value)
                }
                placeholder="Enter"
              />
              {formik.touched.remarks && formik.errors.remarks && (
                <div
                  style={{ fontSize: 12, color: "var(--color-danger)" }}
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
