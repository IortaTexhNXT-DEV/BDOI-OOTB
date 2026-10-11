import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
              {t("correctionJv.rowCount")}{" "}
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
        <Button type="button" icon={<SvgEditIcon />} text className="action__button" onClick={() => handleEdit(rowData)}
          aria-label={t("correctionJv.editLine")} tooltip={t("correctionJv.editLine")} tooltipOptions={{ position: "top" }} />
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
  // each option shows its code with its description, so the line names its account without extra read-only fields
  const toOptions = (rows) =>
    rows.map((row) => ({ label: row.description ? `${row.code} · ${row.description}` : row.code, value: row.code }));
  const mainAccountC = toOptions(mainAccountsData);
  const branchCodeData = toOptions(branchCodesData);
  const deptData = toOptions(departmentCodesData);
  const currencyCodeData = toOptions(currencyCodesData);
  const entryT = ENTRY_TYPES.map((e) => ({ ...e, label: t(`correctionJv.entry.${e.value}`) }));
  const describe = (rows, code) =>
    rows.find((row) => row.code === code)?.description || "";

  const customValidation = (values) => {
    const errors = {};

    if (!values.mainAccount) {
      errors.mainAccount = t("correctionJv.required");
    }

    if (!values.entryType) {
      errors.entryType = t("correctionJv.required");
    }
    const hasSubAccounts = subAccountsData.some(
      (sub) => sub.mainAccount === values.mainAccount
    );
    if (hasSubAccounts && !values.subAccount) {
      errors.subAccount = t("correctionJv.required");
    }

    if (!values.branchCode) {
      errors.branchCode = t("correctionJv.required");
    }

    if (!values.departmentCode) {
      errors.departmentCode = t("correctionJv.required");
    }

    if (!values.currencyCode) {
      errors.currencyCode = t("correctionJv.required");
    }

    if (!values.foreignAmount) {
      errors.foreignAmount = t("correctionJv.required");
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
      remarks: "",
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

  const editingRow = getCorrectionJVEdit || null;
  const editingIndex = (correctionJVList || []).findIndex((r) => r.id === editingRow?.id);
  const editingTitle = editingRow
    ? t("correctionJv.editLineTitle", { line: editingIndex + 1, account: [editingRow.mainAccount, describe(mainAccountsData, editingRow.mainAccount)].filter(Boolean).join(" · ") })
    : t("correctionJv.editLine");

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
      remarks: row.remarks || "",
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
          header={t("correctionJv.mainAccount")}
          className="fieldvalue_container"
        ></Column>
        <Column
          field="subAccount"
          header={t("correctionJv.subAccount")}
          className="fieldvalue_container"
        ></Column>
        <Column
          field="remarks"
          header={t("correctionJv.remarks")}
          className="fieldvalue_container"
        ></Column>
        <Column
          field="currencyCode"
          header={t("correctionJv.currency")}
          className="fieldvalue_container"
        ></Column>
        <Column
          field="foreignAmount"
          header={t("correctionJv.foreignAmount")}
          className="fieldvalue_container"
          body={(r) => (foreignShown(r) ? formatValue(r.foreignAmount, { type: "amount", currency: r.currencyCode || undefined }) : EMPTY_VALUE)}
          bodyClassName="bv-num"
          headerClassName="bv-num"
        ></Column>
        <Column
          field="localAmount"
          header={t("correctionJv.localAmount")}
          className="fieldvalue_container"
          body={(r) => formatValue(r.localAmount === "" ? null : r.localAmount, { type: "amount" })}
          bodyClassName="bv-num"
          headerClassName="bv-num"
        ></Column>
        <Column
          field="entryType"
          header={t("correctionJv.entryType")}
          body={(r) => (r.entryType ? t(`correctionJv.entry.${r.entryType}`, { defaultValue: r.entryType }) : EMPTY_VALUE)}
          className="fieldvalue_container"
        ></Column>
        <Column
          field="id"
          body={renderEditButton}
          header={t("correctionJv.edit")}
          className="fieldvalue_container last__div__table"
          headerStyle={headerStyle}
        ></Column>
      </DataTable>
      <Dialog
        header={editingTitle}
        visible={visible}
        className="bv-centered corrections__jv__edit__line"
        style={{ width: "min(760px, 96vw)" }}
        breakpoints={{ "640px": "calc(100vw - 32px)" }}
        onHide={() => setVisible(false)}
        draggable={false}
        resizable={false}
        footer={(
          <>
            <Button type="button" label={t("correctionJv.cancel")} text onClick={() => setVisible(false)} />
            <Button type="button" label={t("correctionJv.updateLine")} icon="pi pi-check" onClick={formik.handleSubmit} />
          </>
        )}
      >
        <div className="grid corrections__jv__edit__form">
          {[
            ["mainAccount", mainAccountC, t("correctionJv.mainAccount")],
            ["entryType", entryT, t("correctionJv.entryType")],
            ["subAccount", subAccountData, t("correctionJv.subAccount")],
            ["branchCode", branchCodeData, t("correctionJv.branch")],
            ["departmentCode", deptData, t("correctionJv.department")],
            ["currencyCode", currencyCodeData, t("correctionJv.currency")],
          ].map(([field, options, label]) => (
            <div className="col-12 md:col-6" key={field}>
              <DropDowns
                className="input__field__corrections"
                classNames="select__label__corrections"
                label={label}
                required={field !== "subAccount" || subAccountData.length > 0}
                value={formik.values[field]}
                onChange={(e) => formik.setFieldValue(field, e.value)}
                options={options}
                optionLabel="label"
                placeholder={t("correctionJv.select")}
                filter={options.length > 8}
              />
              {formik.touched[field] && formik.errors[field] && <small className="bv-field-error">{formik.errors[field]}</small>}
            </div>
          ))}
          <div className="col-12 md:col-6">
            <InputField
              classNames="input__field__corrections"
              className="select__label__corrections"
              label={t("correctionJv.amountIn", { currency: formik.values.currencyCode || "" })}
              required
              value={formik.values.foreignAmount}
              onChange={(e) => formik.setFieldValue("foreignAmount", e.target.value)}
            />
            {formik.touched.foreignAmount && formik.errors.foreignAmount && <small className="bv-field-error">{formik.errors.foreignAmount}</small>}
          </div>
          <div className="col-12 md:col-6">
            <InputField
              classNames="input__field__corrections__inactive"
              className="select__label__corrections"
              label={t("correctionJv.localAmount")}
              disabled
              value={formatValue(editingRow?.localAmount === "" ? null : editingRow?.localAmount, { type: "amount" })}
            />
          </div>
          <div className="col-12">
            <InputField
              classNames="input__field__corrections"
              className="select__label__corrections"
              label={t("correctionJv.remarks")}
              value={formik.values.remarks}
              onChange={(e) => formik.setFieldValue("remarks", e.target.value)}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default TableData;
