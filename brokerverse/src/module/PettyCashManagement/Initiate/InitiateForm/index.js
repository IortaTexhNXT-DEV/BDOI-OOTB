import { useRef } from "react";
import { showSuccessMessage } from "../../../../utility/toastUtils";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { useFormik } from "formik";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import { useNavigate } from "react-router";
import { Card } from "primereact/card";
import InputField from "../../../../components/InputField";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { openConfirm } from "../../../../components/ConfirmDialog";
import CustomToast from "../../../../components/Toast";
import usePettyCashOptions, { describe } from "../../usePettyCashOptions";
import { optionCode } from "../../pettyCashFormat";
import {
  postInitiateMiddleware,
} from "../store/pettyCashInitiateMiddleware";
import { useDispatch } from "react-redux";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../../components/LabelWrapper";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { calendarDateFormat } from "../../../../utility/dateFormat";

const initialValue = {
  TransactionDate: new Date(),
  TransactionCode: "",
  TransactionNumber: "",
  PettyCashCodes: "",
  PettyCashdescription: "",
  PettyCashSize: "",
  BankCode: "",
  BankAccountCode: "",
  MainAccountCode: "",
  SubAccountCode: "",
  Currency: "",
  Currencydescription: "",
  BranchCode: "",
  Branchdescription: "",
  DepartmentCode: "",
  Departmentdescription: "",
  AvailableCash: "",
  MaxLimit: "",
  MinimumCashbox: "",
};

const InitiateForm = () => {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const {
    banks,
    bankAccounts,
    mainAccounts,
    subAccounts,
    currencies,
    branches,
    departments,
  } = usePettyCashOptions();
  const validate = (values) => {
    const errors = {};

    // the code may be left empty: the next Petty Cash Code is issued when the fund is established
    if (!(Number(values.PettyCashSize) > 0)) {
      errors.PettyCashSize = t("pettyCash.pettyCashSizeRequired");
    }

    if (!values.BankCode) {
      errors.BankCode = t("pettyCash.bankCodeRequired");
    }

    if (!values.BankAccountCode) {
      errors.BankAccountCode = t("pettyCash.bankAccountCodeRequired");
    }

    if (!values.MainAccountCode) {
      errors.MainAccountCode = t("pettyCash.mainAccountCodeRequired");
    }

    return errors;
  };


  // the new fund is confirmed with its figures, then waits for another user to approve (establish) it
  const handleSubmit = async (value) => {
    let failed = null;
    const answer = await openConfirm({
      title: t("pettyCash.fundApproval.submitTitle"),
      facts: [
        { label: t("pettyCash.pettyCashCode"), value: optionCode(value.PettyCashCodes) || t("pettyCash.fundApproval.nextCode") },
        { label: t("pettyCash.pettyCashDescription"), value: value.PettyCashdescription },
        { label: t("pettyCash.bankCode"), value: optionCode(value.BankCode) },
        { label: t("pettyCash.mainAccountCode"), value: optionCode(value.MainAccountCode) },
        { label: t("pettyCash.maxLimit"), value: value.MaxLimit, type: "amount" },
        { label: t("pettyCash.pettyCashSize"), value: value.PettyCashSize, type: "amount", emphasis: true },
      ],
      confirmLabel: t("pettyCash.fundApproval.submit"),
      onConfirm: async () => {
        const result = await dispatch(postInitiateMiddleware(value));
        if (postInitiateMiddleware.rejected.match(result)) {
          failed = result.payload;
          throw new Error(result.payload);
        }
      },
    });
    if (answer === false || answer === null || answer === undefined || failed) return;
    showSuccessMessage(t("pettyCash.fundApproval.submitted"));
    navigate("/accounts/pettycash/pettycashcodeinitiate");
  };
  const items = [
    { label: t("pettyCash.pettyCashLabel"), command: () => navigate("/accounts/pettycash/pettycashcodeinitiate") },
    {
      label: t("pettyCash.pettyCashCodeInitiateLabel"),
      command: () => navigate("/accounts/pettycash/pettycashcodeinitiate"),
    },
    {
      label: t("pettyCash.initiate"),
      to: "/accounts/pettycash/pettycashcodeinitiate/initiate",
    },
  ];
  const Initiate = { label: t("pettyCash.accounts") };

  const handleClick = () => {
    navigate("/accounts/pettycash/pettycashcodeinitiate");
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  // Initiate owns the fund: the cash available when it is established is its size
  const handleFundSize = (value) => {
    formik.setFieldValue("PettyCashSize", value);
    formik.setFieldValue("AvailableCash", value);
  };
  const handlecurrency = (option) => {
    formik.setFieldValue("Currencydescription", describe(currencies, option?.code));
  };
  const handleBranch = (option) => {
    formik.setFieldValue("Branchdescription", describe(branches, option?.code));
  };
  const handleDepart = (option) => {
    formik.setFieldValue("Departmentdescription", describe(departments, option?.code));
  };
  return (
    <div className="pettycash__form">
      <CustomToast ref={toastRef} message={t("pettyCash.initiatedSuccessfully")} />
      <div className="grid  m-0">
        <div className="col-12 md:col-6 lg:col-6">
        <div>
          <span onClick={handleClick}>
            <SvgBackicon />
          </span>
          <label className="label_header">
          {t("pettyCash.addPettyCash")}
          </label>
        </div>
          
          <div className="mt-3">
            <BreadCrumb
              model={items}
              home={Initiate}
              className="breadCrums"
              separatorIcon={<SvgDot color="currentColor" />}
            />
          </div>
        </div>
      </div>

      <Card className="mt-4">

        <div className="grid">
          <div className="col-12 md:col-4">
            <InputField
              disabled={true}
              classNames="field__container"
              label={t("pettyCash.transactionNumber")}
              value={
                formik.values.TransactionNumber
              }

              onChange={formik.handleChange("TransactionNumber")}
            />
          </div>
          <div className="col-12 md:col-4">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.transactionCode")}
              disabled={true}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
            />

          </div>
          <div className="calender__container col-12 md:col-4">
            <LabelWrapper label={t("pettyCash.transactionDate")} className="calenderlable__container" />
            <Calendar
              showIcon
              placeholder={t("pettyCash.select")}
              className="calendar_container"
              value={formik.values.TransactionDate}

              onChange={(e) => {
                formik.setFieldValue("TransactionDate", e.target.value);
              }}
              dateFormat={calendarDateFormat()}
              error={formik.errors.TransactionDate}

            />
          </div>
        </div>

        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.pettyCashCode")}
              placeholder={t("pettyCash.pettyCashCodeAuto")}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              length={30}
              value={formik.values.PettyCashCodes}
              onChange={formik.handleChange("PettyCashCodes")}
            />

          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.pettyCashDescription")}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.PettyCashdescription}
              onChange={formik.handleChange("PettyCashdescription")}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.pettyCashSize")}
              required
              type="number"
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.PettyCashSize}
              onChange={(e) => handleFundSize(e.target.value)}
              error={
                formik.touched.PettyCashSize && formik.errors.PettyCashSize
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.bankCode")}
              placeholder={t("pettyCash.select")}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color="currentColor" />}
              value={formik.values.BankCode}
              options={banks}
              onChange={(e) => {
                formik.setFieldValue("BankCode", e.value);
                formik.setFieldValue("BankAccountCode", "");
              }}
              optionLabel="label"
              error={
                formik.touched.BankCode &&
                formik.errors.BankCode
              }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.bankAccountCode")}
              placeholder={t("pettyCash.select")}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color="currentColor" />}
              value={formik.values.BankAccountCode}
              options={bankAccounts.filter(
                (account) => account.bankCode === formik.values.BankCode?.code
              )}
              onChange={(e) => {
                formik.setFieldValue("BankAccountCode", e.value);
              }}
              optionLabel="label"
              error={
                formik.touched.BankAccountCode && formik.errors.BankAccountCode
              }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.mainAccountCode")}
              placeholder={t("pettyCash.select")}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color="currentColor" />}
              value={formik.values.MainAccountCode}
              options={mainAccounts}
              onChange={(e) => {
                formik.setFieldValue("MainAccountCode", e.value);
                formik.setFieldValue("SubAccountCode", "");
              }}
              optionLabel="label"
              error={formik.touched.MainAccountCode && formik.errors.MainAccountCode}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.subAccountCode")}
              placeholder={t("pettyCash.select")}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color="currentColor" />}
              value={formik.values.SubAccountCode}
              options={subAccounts.filter(
                (account) => account.parentCode === formik.values.MainAccountCode?.code
              )}
              onChange={(e) => {
                formik.setFieldValue("SubAccountCode", e.value);
              }}
              optionLabel="label"
              error={
                formik.touched.SubAccountCode && formik.errors.SubAccountCode
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.currency")}
              placeholder={t("pettyCash.select")}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color="currentColor" />}
              value={formik.values.Currency}
              options={currencies}
              onChange={(e) => {
                formik.setFieldValue("Currency", e.value).then(() => {
                  handlecurrency(e.value);
                })

              }}
              optionLabel="code"
              error={formik.touched.Currency && formik.errors.Currency}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.currencyDescription")}
              disabled={true}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.Currencydescription}
              onChange={formik.handleChange("Currencydescription")}
              error={
                formik.touched.Currencydescription &&
                formik.errors.Currencydescription
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.branchCode")}
              placeholder={t("pettyCash.select")}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color="currentColor" />}
              value={formik.values.BranchCode}
              options={branches}
              onChange={(e) => {
                formik.setFieldValue("BranchCode", e.value).then(() => {
                  handleBranch(e.value);
                })

              }}
              optionLabel="code"
              error={formik.touched.BranchCode && formik.errors.BranchCode}
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.branchDescription")}
              disabled={true}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.Branchdescription}
              onChange={formik.handleChange("Branchdescription")}
              error={
                formik.touched.Branchdescription &&
                formik.errors.Branchdescription
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <DropDowns
              className="input__filed"
              label={t("pettyCash.departmentCode")}
              placeholder={t("pettyCash.select")}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              dropdownIcon={<SvgDropdown color="currentColor" />}
              value={formik.values.DepartmentCode}
              options={departments}
              onChange={(e) => {
                formik.setFieldValue("DepartmentCode", e.value).then(() => {
                  handleDepart(e.value);
                })

              }}
              optionLabel="code"
              error={
                formik.touched.DepartmentCode && formik.errors.DepartmentCode
              }
            />
          </div>
          <div className="col-12 md:col-6 lg-col-6 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.departmentDescription")}
              disabled={true}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.Departmentdescription}
              onChange={formik.handleChange("Departmentdescription")}
              error={
                formik.touched.Departmentdescription &&
                formik.errors.Departmentdescription
              }
            />
          </div>
        </div>
        <div className="grid mt-1">
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.availableCash")}
              disabled={true}
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.AvailableCash}
              onChange={formik.handleChange("AvailableCash")}
              error={
                formik.touched.AvailableCash && formik.errors.AvailableCash
              }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.maxLimit")}
              type="number"
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.MaxLimit}
              onChange={formik.handleChange("MaxLimit")}
              error={
                formik.touched.MaxLimit &&
                formik.errors.MaxLimit
              }
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view">
            <InputField
              classNames="input__filed"
              label={t("pettyCash.minimumCashbox")}
              type="number"
              textColor={"var(--color-heading)"}
              textSize={"16"}
              textWeight={500}
              value={formik.values.MinimumCashbox}
              onChange={formik.handleChange("MinimumCashbox")}
              error={
                formik.touched.MinimumCashbox && formik.errors.MinimumCashbox
              }
            />
          </div>
        </div>
      </Card>

      <div className="grid  mt-4">
        <div className="col-12 md:col-12 lg:col-12">
          <div className="btn__container">
            <Button
              label={t("pettyCash.fundApproval.submit")}
              className="add__btn"
              onClick={() => {
                formik.handleSubmit();
              }}
              disabled={!formik.isValid}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default InitiateForm;
