import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import NavBar from "../../../../components/NavBar";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../assets/icons/SvgDot";
import InputField from "../../../../components/InputField";
import { useFormik } from "formik";
import DropDowns from "../../../../components/DropDowns";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { MultiSelect } from "primereact/multiselect";
import LabelWrapper from "../../../../components/LabelWrapper";
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { useNavigate } from "react-router-dom";
import CustomToast from "../../../../components/Toast";
import SvgDropdownicon from "../../../../assets/icons/SvgDropdownicon";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { postMainAccountStatus } from "../store/mainAccoutMiddleware";
import { useDispatch, useSelector } from "react-redux";
import useMainAccountOptions from "../useMainAccountOptions";

const AddMainAccount = () => {
  const { t } = useTranslation();
  const {  loading,MainAccountList } = useSelector(
    ({ mainAccoutReducers }) => {
      return {
        loading: mainAccoutReducers?.loading,
        MainAccountList:mainAccoutReducers?.MainAccountList,
      };
    }
  );
  const toastRef = useRef(null);
  const navigation = useNavigate();
  const items = [
    { label: t("financeMasters.mainAccount"), url: "/master/finance/mainaccount" },
    { label: t("financeMasters.addMainAccount"), url: "/master/finance/mainaccount/addmainaccount" },
  ];
  const selectSwitchoptions = ["Yes", "No"];
  const [selectSwitch, setselectSwitch] = useState(selectSwitchoptions[0]);
  const EntrySwitchoptions = ["Yes", "No"];
  const [entrySwitch, setentrySwitch] = useState(EntrySwitchoptions[0]);

  const mainAccountOptions = useMainAccountOptions();
  const codeOptionsType = mainAccountOptions.accountTypes;
  const categoryOptionsCode = mainAccountOptions.categories;
  const companyCodeDatas = mainAccountOptions.companies;
  const currencyCodeDatas = mainAccountOptions.currencies;

  const home = { label: t("financeMasters.master") };
  const customValidation = (values) => {
    const errors = {};

    if (!values.mainAccountCode) {
      errors.mainAccountCode = t("validation.fieldRequired");
    }
    if (!values.mainAccountName) {
      errors.mainAccountName = t("validation.fieldRequired");
    }
    if (!values.description) {
      errors.description = t("validation.fieldRequired");
    }
    if (!values.accountCategoryCode) {
      errors.accountCategoryCode = t("validation.fieldRequired");
    }

    if (
      !values.companyCode ||
      (Array.isArray(values.companyCode) && values.companyCode.length === 0)
    ) {
      errors.companyCode = "This field is required";
    }

    if (!values.accountType) {
      errors.accountType = "This field is required";
    }

    return errors;
  };
  const dispatch = useDispatch();
  const handleSubmit = async (values) => {
    try {
      await dispatch(postMainAccountStatus({ ...values, openEntry: selectSwitch })).unwrap();
      toastRef.current.showToast();
      setTimeout(() => {
        navigation("/master/finance/mainaccount");
      }, 2000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };

  const formik = useFormik({
    initialValues: {
      mainAccountCode: "",
      mainAccountName: "",
      description: "",
      accountCategoryCode: "",
      accountType: "",
      openEntry: "",
      companyCode: [],
      currencyCode: [],
      openEntryType: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
      formik.resetForm();
    },
  });
  return (
    <div className="add__main__container">
      <div className="grid m-0 top-container">
        <CustomToast
          ref={toastRef}
          message="Main Account Code MAC1234 is added"
        />
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>
            <div className="main__account__title">Main Account Master</div>
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
      <div className="card__container">
        <div className="grid m-0 p-0">
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("financeMasters.enter")}
              label={t("financeMasters.mainAccountCode")}
              value={formik.values.mainAccountCode}
              onChange={(e) =>
                formik.setFieldValue("mainAccountCode", e.target.value)
              }
            />
            {formik.touched.mainAccountCode &&
              formik.errors.mainAccountCode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.mainAccountCode}
                </div>
              )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
            <InputField
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("financeMasters.enter")}
              label={t("financeMasters.mainAccountName")}
              value={formik.values.mainAccountName}
              onChange={(e) =>
                formik.setFieldValue("mainAccountName", e.target.value)
              }
            />
            {formik.touched.mainAccountName &&
              formik.errors.mainAccountName && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.mainAccountName}
                </div>
              )}
          </div>
        </div>
        <div className="grid m-0 p-0">
          <div className="col-12 md:col-8 lg:col-6 xl:col-6 ">
            <InputField
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label="description"
              value={formik.values.description}
              onChange={(e) =>
                formik.setFieldValue("description", e.target.value)
              }
            />
            {formik.touched.description && formik.errors.description && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.description}
              </div>
            )}
          </div>
          <div className="col-12 md:col-4 lg:col-3 xl:col-3">
            <DropDowns
              className="input__field__corrections"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              placeholder="Select "
              classNames="select__label__corrections"
              optionLabel="value"
              label={t("financeMasters.accountType")}
              value={formik.values.accountType}
              onChange={(e) => formik.setFieldValue("accountType", e.value)}
              options={codeOptionsType}
            />
            {formik.touched.accountType && formik.errors.accountType && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.accountType}
              </div>
            )}
          </div>
        </div>
        <div className="grid m-0 p-0">
          <div className="col-12 md:col-4 lg:col-3 xl:col-3">
            <LabelWrapper
              label={t("financeMasters.openEntry")}
              classNames="input__label__corrections"
            />
            <SelectButton
              className="mt-2 select__switch__option"
              value={selectSwitch}
              onChange={(e) => setselectSwitch(e.value)}
              options={selectSwitchoptions}
            />
          </div>
          <div className="col-12 md:col-4 lg:col-3 xl:col-3">
            <DropDowns
              disabled={selectSwitch === "Yes" ? true : false}
              className="input__field__corrections"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              placeholder="Select "
              classNames={
                selectSwitch === "Yes"
                  ? "select__label__corrections__inactive"
                  : "select__label__corrections"
              }
              optionLabel="value"
              label={t("financeMasters.openEntryType")}
              value={formik.values.openEntryType}
              onChange={(e) => formik.setFieldValue("openEntryType", e.value)}
              options={codeOptionsType}
            />
          </div>
          <div className="col-12 md:col-4 lg:col-3 xl:col-3">
            <LabelWrapper
              label={t("financeMasters.isOnlyMainAccount")}
              classNames="input__label__corrections"
            />
            <SelectButton
              className="mt-2 select__switch__option"
              value={entrySwitch}
              onChange={(e) => setentrySwitch(e.value)}
              options={selectSwitchoptions}
            />
          </div>
        </div>
        <div className="grid m-0 p-0">
          <div className="col-12 md:col-4 lg:col-3 xl:col-3">
            <DropDowns
              className="input__field__corrections"
              dropdownIcon={<SvgDropdown color={"#000"} />}
              placeholder="Select "
              classNames="select__label__corrections"
              optionLabel="value"
              label={t("financeMasters.accountCategoryCode")}
              value={formik.values.accountCategoryCode}
              onChange={(e) =>
                formik.setFieldValue("accountCategoryCode", e.value)
              }
              options={categoryOptionsCode}
            />
            {formik.touched.accountCategoryCode &&
              formik.errors.accountCategoryCode && (
                <div
                  style={{ fontSize: 12, color: "red" }}
                  className="formik__errror__JV"
                >
                  {formik.errors.accountCategoryCode}
                </div>
              )}
          </div>
          <div className="col-12 md:col-8 lg:col-6 xl:col-6 ">
            <InputField
              disabled={true}
              classNames="input__field__corrections__inactive"
              className="input__label__corrections"
              label="description"
              value={
                formik.values.accountCategoryCode
                  ? `descrption ${formik.values.accountCategoryCode}`
                  : ""
              }
            />
          </div>
        </div>
        <div className="grid m-0 p-0">
          <div className="col-12 md:col-6 lg:col-6 xl:col-6">
            <LabelWrapper
              label={t("financeMasters.companyCode")}
              classNames="input__label__corrections"
            />
            <MultiSelect
              className="input__field__corrections mt-2"
              value={formik.values.companyCode}
              onChange={(e) => formik.setFieldValue("companyCode", e.value)}
              options={companyCodeDatas}
              optionLabel="value"
              display="chip"
              placeholder="Select"
              dropdownIcon={<SvgDropdown />}
            />
            {formik.touched.companyCode && formik.errors.companyCode && (
              <div
                style={{ fontSize: 12, color: "red" }}
                className="formik__errror__JV"
              >
                {formik.errors.companyCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6">
            <LabelWrapper
              label={t("financeMasters.currency")}
              classNames={
                entrySwitch === "No"
                  ? "select__label__corrections__inactive"
                  : "input__label__corrections"
              }
            />
            <MultiSelect
              disabled={entrySwitch === "No" ? true : false}
              className="input__field__corrections mt-2"
              value={formik.values.currencyCode}
              onChange={(e) => formik.setFieldValue("currencyCode", e.value)}
              options={currencyCodeDatas}
              optionLabel="value"
              display="chip"
              placeholder="Select"
              dropdownIcon={<SvgDropdown />}
            />
          </div>
        </div>
      </div>
      <div className="flex justify-content-end mt-5">
        <Button
          className="save__action"
          disabled={!formik.isValid}
          onClick={formik.handleSubmit}
        >
          Save
        </Button>
      </div>
    </div>
  );
};

export default AddMainAccount;
