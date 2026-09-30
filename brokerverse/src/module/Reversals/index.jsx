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
import CustomToast from "../../components/Toast";
import { useDispatch, useSelector } from "react-redux";
import {
  getReversalTabelData,
  postReversalJVData,
} from "./store/reversalMiddleWare";
import { resetReversalJV } from "./store/reversalReducers";
import useJvMasterData from "../JournalVoucher/useJvMasterData";
import SvgBackicon from "../../assets/icons/SvgBackicon";
import { useTranslation } from "react-i18next";

const Reversals = () => {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  const [step, setStep] = useState(0);
  const [toastMessage, setToastMessage] = useState("");
  const { transactionCodesData } = useJvMasterData();
  const { reversalJVList, loading, reversalJVGetDataList } = useSelector(
    ({ reversalMainReducers }) => ({
      loading: reversalMainReducers?.loading,
      reversalJVList: reversalMainReducers?.reversalJVList,
      reversalJVGetDataList: reversalMainReducers?.reversalJVGetDataList || [],
    })
  );
  const items = [
    { label: t("sidebar.Reversal JV"), to: "/accounts/reversaljv/reversaljvdetails" },
    {
      label: t("accounts.reversalJVDetails"),
      to: "/accounts/reversaljv/reversaljvdetails",
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
      errors.transactionCode = t("validation.fieldRequired");
    }

    if (!values.transactionNumber) {
      errors.transactionNumber = t("validation.fieldRequired");
    }
    if (!values.reversalJVTransactionCode) {
      errors.reversalJVTransactionCode = t("validation.fieldRequired");
    }

    return errors;
  };

  const loadOriginalVoucher = async (values) => {
    const result = await dispatch(
      getReversalTabelData(values.transactionNumber.trim())
    );
    if (getReversalTabelData.rejected.match(result)) {
      showToast(result.payload, "error");
      return;
    }
    setStep(1);
  };

  const formik = useFormik({
    initialValues: {
      transactionCode: "",
      transactionNumber: "",
      reversalJVTransactionCode: "",
    },
    validate: customValidation,
    onSubmit: loadOriginalVoucher,
  });

  const handleApproval = async () => {
    const result = await dispatch(
      postReversalJVData({
        transactionNumber: formik.values.transactionNumber.trim(),
        reversalJVTransactionCode: formik.values.reversalJVTransactionCode,
        description: describeCode(formik.values.reversalJVTransactionCode),
      })
    );
    if (postReversalJVData.rejected.match(result)) {
      showToast(result.payload, "error");
      return;
    }
    showToast(result.payload?.message);
    setStep(2);
  };

  const handlePrint = () => {
    formik.resetForm();
    dispatch(resetReversalJV());
    setStep(0);
  };
  return (
    <div className="container__reversal">
      <CustomToast ref={toastRef} message={toastMessage} />

      <div className="grid m-0 top__container">
        <div className="col-12 p-0"></div>
        <div className="correction__title__reversal">
          <span onClick={() => setStep(step - 1)}>
            {step !== 0 && <SvgBackicon />}
          </span>
          <label className={step !== 0 ? "label_header" : ""}>
            Reversal JV Details
          </label>
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
            label="Transaction Code "
            dropdownIcon={<SvgDropdown color={"#000"} />}
            value={formik.values.transactionCode}
            onChange={(e) =>
              formik.setFieldValue("transactionCode", e.target.value)
            }
            options={codeOptions}
            optionLabel="value"
            placeholder={"Select"}
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
            label="Reversal JV Transaction Code"
            dropdownIcon={<SvgDropdown color={"#000"} />}
            value={formik.values.reversalJVTransactionCode}
            onChange={(e) =>
              formik.setFieldValue("reversalJVTransactionCode", e.value)
            }
            options={codeOptions}
            optionLabel="value"
            placeholder={"Select"}
          />
          {formik.touched.reversalJVTransactionCode &&
            formik.errors.reversalJVTransactionCode && (
              <div
                style={{ fontSize: 12, color: "var(--color-danger)" }}
                className="formik__errror__JV mt-3"
              >
                {formik.errors.reversalJVTransactionCode}
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
            label="Reversal Description"
            value={describeCode(formik.values.reversalJVTransactionCode)}
          />
        </div>
      </div>

      {step !== 0 && (
        <div className="grid m-0 table__container">
          <div className="col-12 p-0">
            <TableData
              reversalJVGetDataList={reversalJVGetDataList}
              reversalJVList={reversalJVList}
            />
          </div>
        </div>
      )}

      <div className="grid m-0 bottom__container">
        <div className="col-12 button__view__corrections__reversal">
          {step == 0 && (
            <Button
              label="Next"
              className="correction__btn__reversal"
              disabled={!formik.isValid || loading}
              onClick={formik.handleSubmit}
            />
          )}

          {step == 1 && (
            <Button
              label="Approve"
              className="correction__btn__reversal"
              onClick={handleApproval}
              disabled={loading || reversalJVGetDataList.length === 0}
            />
          )}

          {step == 2 && (
            <Button
              label="Print"
              className="correction__btn__reversal"
              onClick={handlePrint}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default Reversals;
