import { useState, useRef } from "react";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../assets/icons/SvgDot";
import InputField from "../../components/InputField";
import DropDowns from "../../components/DropDowns";
import { Button } from "primereact/button";
import SvgDropdown from "../../assets/icons/SvgDropdown";
import TableData from "./TableData/TableData";
import { useFormik } from "formik";
import ModalData from "./EditData/ModalData";
import CustomToast from "../../components/Toast";
import { useDispatch, useSelector } from "react-redux";
import {
  getCorrectionJVTabelData,
  postCorrectionJVData,
} from "./store/correctionJVMiddleWare";
import { resetCorrectionJV } from "./store/correctionJVReducers";
import useJvMasterData from "../JournalVoucher/useJvMasterData";
import SvgBackicon from "../../assets/icons/SvgBackicon";
import { useTranslation } from "react-i18next";

const toCorrectionEntry = (row) => ({
  mainAccount: row.mainAccount,
  mainAccountDescription: row.mainAccountDescription,
  subAccount: row.subAccount || null,
  subAccountDescription: row.subAccountDescription,
  entryType: row.entryType,
  branchCode: row.branchCode || null,
  branchCodeDescription: row.branchCodeDescription,
  departmentCode: row.departmentCode || null,
  departmentDescription: row.departmentDescription,
  currencyCode: row.currencyCode || undefined,
  foreignAmount: parseFloat(row.foreignAmount) || 0,
  remarks: row.remarks || undefined,
});

const CorrectionJV = () => {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  const { correctionJVList, loading } = useSelector(
    ({ correctionJVMainReducers }) => ({
      loading: correctionJVMainReducers?.loading,
      correctionJVList: correctionJVMainReducers?.correctionJVList || [],
    })
  );
  const { transactionCodesData } = useJvMasterData();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [editID, setEditID] = useState(null);
  const [toastMessage, setToastMessage] = useState("");
  const items = [
    {
      label: t("accounts.correctionsJV"),
      to: "/accounts/correctionsjv/correctionsjvdetails",
    },
    {
      label: t("accounts.correctionsJVDetails"),
      to: "/accounts/correctionsjv/correctionsjvdetails",
    },
  ];
  const home = { label: t("sidebar.Accounts") };
  const codeOptions = transactionCodesData.map((code) => ({
    label: code.description,
    value: code.code,
  }));
  const describeCode = (code) =>
    transactionCodesData.find((row) => row.code === code)?.description || "";

  const showToast = (message, severity = "success") => {
    setToastMessage(message);
    toastRef.current?.showToast({ severity, detail: message });
  };

  const customValidation = (values) => {
    const errors = {};
    if (!values.transactionCode) {
      errors.transactionCode = "This field is required";
    }
    if (!values.transactionNumber) {
      errors.transactionNumber = "This field is required";
    }
    if (!values.correctionJVTransactionCode) {
      errors.correctionJVTransactionCode = "This field is required";
    }
    return errors;
  };

  const loadOriginalVoucher = async (values) => {
    const result = await dispatch(
      getCorrectionJVTabelData(values.transactionNumber.trim())
    );
    if (getCorrectionJVTabelData.rejected.match(result)) {
      showToast(result.payload, "error");
      return;
    }
    setStep(1);
  };

  const formik = useFormik({
    initialValues: {
      transactionCode: "",
      transactionNumber: "",
      correctionJVTransactionCode: "",
    },
    validate: customValidation,
    onSubmit: loadOriginalVoucher,
  });

  const handleEdit = (id) => {
    setEditID(id);
    setVisible(true);
  };
  const handleUpdate = () => {};

  const handleApproval = async () => {
    const result = await dispatch(
      postCorrectionJVData({
        transactionNumber: formik.values.transactionNumber.trim(),
        correctionJVTransactionCode: formik.values.correctionJVTransactionCode,
        description: describeCode(formik.values.correctionJVTransactionCode),
        entries: correctionJVList.map(toCorrectionEntry),
      })
    );
    if (postCorrectionJVData.rejected.match(result)) {
      showToast(result.payload, "error");
      return;
    }
    showToast(result.payload?.message);
    setStep(2);
  };

  const handlePrint = () => {
    formik.resetForm();
    dispatch(resetCorrectionJV());
    setStep(0);
  };
  const sumBy = (entryType) =>
    correctionJVList.reduce((total, item) => {
      if (item.entryType !== entryType) return total;
      const amount = parseFloat(item.localAmount || item.foreignAmount);
      return !isNaN(amount) ? total + amount : total;
    }, 0);
  const totalForeignAmount = sumBy("Credit");
  const totalLocalAmount = sumBy("Debit");
  return (
    <div className="container__corrections__jv">
      <CustomToast ref={toastRef} message={toastMessage} />
      <div className="grid m-0 top__container">
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="correction__title__reversal">
            <span onClick={() => setStep(step - 1)}>

              {step !== 0 && <SvgBackicon />}
            </span>
            <label className="label_header">Correction JV</label>
          </div>
        </div>
        <div className="col-12 p-0">
          <BreadCrumb
            home={home}
            className="breadCrums__view__reversal"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="grid card__container">
        <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view__reversal">
          <DropDowns
            disabled={step === 0 ? false : true}
            className={
              step === 0
                ? "input__field__reversal"
                : "input__field__reversal__inactive"
            }
            classNames={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Transaction Code"
            dropdownIcon={<SvgDropdown color={"#000"} />}
            value={formik.values.transactionCode}
            onChange={(e) =>
              formik.setFieldValue("transactionCode", e.target.value)
            }
            options={codeOptions}
            optionLabel="value"
            placeholder="Select "
          />

          {formik.touched.transactionCode && formik.errors.transactionCode && (
            <div style={{ fontSize: 12, color: "var(--color-danger)" }} className="mt-3">
              {formik.errors.transactionCode}
            </div>
          )}
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 input__view__reversal">
          <InputField
            disabled={true}
            classNames="input__field__reversal__inactive"
            className={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Transaction Description"
            value={describeCode(formik.values.transactionCode)}
            onChange={(e) =>
              formik.setFieldValue("transactionDescription", e.target.value)
            }
          />
        </div>
        <div className="col-12 md:col-12 lg:col-3 xl:col-3  input__view__reversal">
          <InputField
            disabled={step === 0 ? false : true}
            classNames={
              step === 0
                ? "input__field__reversal"
                : "input__field__reversal__inactive"
            }
            className={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Transaction Number"
            placeholder="Enter"
            textWeight={500}
            value={formik.values.transactionNumber}
            onChange={(e) =>
              formik.setFieldValue("transactionNumber", e.target.value)
            }
          />
          {formik.touched.transactionNumber &&
            formik.errors.transactionNumber && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.transactionNumber}
              </div>
            )}
        </div>
        <div className="col-12 md:col-6 lg:col-3 xl:col-3 input__view__reversal">
          <DropDowns
            disabled={step === 0 ? false : true}
            className={
              step === 0
                ? "input__field__reversal"
                : "input__field__reversal__inactive"
            }
            classNames={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Corrections JV Transaction Code"
            textWeight={500}
            dropdownIcon={<SvgDropdown color={"#000"} />}
            value={formik.values.correctionJVTransactionCode}
            onChange={(e) =>
              formik.setFieldValue("correctionJVTransactionCode", e.value)
            }
            options={codeOptions}
            optionLabel="value"
            placeholder="Select "
          />
          {formik.touched.correctionJVTransactionCode &&
            formik.errors.correctionJVTransactionCode && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV mt-3"
              >
                {formik.errors.correctionJVTransactionCode}
              </div>
            )}
        </div>
        <div className="col-12 md:col-6 lg:col-6 xl:col-6 input__view__reversal">
          <InputField
            disabled={true}
            classNames="input__field__reversal__inactive"
            className={
              step === 0
                ? "input__label__reversal"
                : "input__label__reversal__inactive"
            }
            label="Correction Description"
            value={describeCode(formik.values.correctionJVTransactionCode)}
          />
        </div>
      </div>

      {step !== 0 && (
        <>
          <div className="grid m-0 table__container">
            <div className="col-12 p-0">
              <TableData
                handleEdit={handleEdit}
                visible={visible}
                editID={editID}
                correctionJVList={correctionJVList}
              />
            </div>
            <ModalData
              visible={visible}
              setVisible={setVisible}
              handleUpdate={handleUpdate}
              setEditID={setEditID}
              correctionJVList={correctionJVList}
            />
          </div>

          <div className="grid m-0">
            <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
              <InputField
                disabled={true}
                classNames="input__field__reversal__inactive"
                className="input__label__reversal"
                label="Total credit"
                placeholder="Enter"
                value={totalForeignAmount}
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
              <InputField
                disabled={true}
                classNames="input__field__reversal__inactive"
                className="input__label__reversal"
                label="Total Debit"
                placeholder="Enter"
                value={totalLocalAmount}
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
              <InputField
                disabled={true}
                classNames="input__field__reversal__inactive"
                className="input__label__reversal"
                label="Net"
                placeholder="Enter"
                value={totalForeignAmount - totalLocalAmount}
              />
            </div>
          </div>
        </>
      )}
      <div className="grid m-0 bottom__container">
        <div className="col-12 button__view__corrections__reversal">
          {step == 0 && (
            <Button
              className="correction__btn__reversal"
              disabled={!formik.isValid || loading}
              onClick={formik.handleSubmit}
            >
              Next
            </Button>
          )}

          {step == 1 && (
            <Button
              className="correction__btn__reversal"
              onClick={handleApproval}
              disabled={
                loading ||
                correctionJVList.length < 2 ||
                Math.abs(totalForeignAmount - totalLocalAmount) > 0.01
              }
            >
              Approve
            </Button>
          )}

          {step == 2 && (
            <Button className="correction__btn__reversal" onClick={handlePrint}>
              Print
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CorrectionJV;
