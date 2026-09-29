import React, { useState } from "react";
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
import SvgBack from "../../../../assets/icons/SvgBack";
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { useSelector } from "react-redux";

const ViewMainAccount = () => {
  const { MainAccountDetailView, loading } = useSelector(
    ({ mainAccoutReducers }) => {
      return {
        loading: mainAccoutReducers?.loading,
        MainAccountDetailView: mainAccoutReducers?.MainAccountDetailView,
      };
    }
  );
  console.log(MainAccountDetailView, "MainAccountDetailView");
  const navigation = useNavigate();
  const items = [
    {
      label: "Main Account",
      url: "/master/finance/mainaccount",
    },
    {
      label: "Main Account Details",
      url: "/master/finance/mainaccount/viewmainaccount",
    },
  ];
  const selectSwitchoptions = ["Yes", "No"];
  const [selectSwitch, setselectSwitch] = useState(selectSwitchoptions[0]);
  const EntrySwitchoptions = ["Yes", "No"];
  const [entrySwitch, setentrySwitch] = useState(EntrySwitchoptions[0]);

  const codeaccountType = [
    {
      label: MainAccountDetailView.accountType,
      value: MainAccountDetailView.accountType,
    },
  ];
  const codeOptionsType = [
    {
      label: MainAccountDetailView.openEntryType,
      value: MainAccountDetailView.openEntryType,
    },
  ];
  const categoryOptionsCode = [
    {
      label: MainAccountDetailView.accountCategoryCode,
      value: MainAccountDetailView.accountCategoryCode,
    },
  ];
  const companyCodeDatas = [
    {
      label: MainAccountDetailView.companyCode,
      value: MainAccountDetailView.companyCode,
    },
  ];
  const currencyCodeDatas = [
    {
      label: MainAccountDetailView.currencyCode,
      value: MainAccountDetailView.currencyCode,
    },
  ];

  const home = { label: "Master" };
  const customValidation = (values) => {
    const errors = {};
    return errors;
  };
  const handleSubmit = (values) => {
    // Handle form submission
    navigation("/master/finance/mainaccount", {
      state: { tableView: true },
    });
    console.log(values, "find values");
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
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>

            <div className="main__account__title">Main Account Details</div>
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
              placeholder="Enter"
              label="Main Account Code"
              value={MainAccountDetailView.mainAccountCode}
              disabled={true}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
            <InputField
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label="Main Account Name"
              value={MainAccountDetailView.mainAccountName}
              onChange={(e) =>
                formik.setFieldValue("mainAccountName", e.target.value)
              }
              disabled={true}
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
              value={MainAccountDetailView.description}
              onChange={(e) =>
                formik.setFieldValue("description", e.target.value)
              }
              disabled={true}
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
              label="Account Type"
              value={MainAccountDetailView.accountType}
              onChange={(e) => formik.setFieldValue("accountType", e.value)}
              options={codeaccountType}
              disabled={true}
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
              label="Open Entry"
              classNames="input__label__corrections"
            />
            <SelectButton
              className="mt-2 select__switch__option"
              value={selectSwitch}
              onChange={(e) => setselectSwitch(e.value)}
              options={selectSwitchoptions}
              disabled={true}
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
              label="Open Entry type"
              // value={formik.values.openEntryType}
              value={
                selectSwitch == "Yes" && MainAccountDetailView.openEntryType
              }
              // onChange={(e) => formik.setFieldValue("openEntryType", e.value)}
              options={codeOptionsType}
            />
          </div>
          <div className="col-12 md:col-4 lg:col-3 xl:col-3">
            <LabelWrapper
              label="Is this only a main account?"
              classNames="input__label__corrections"
            />
            <SelectButton
              className="mt-2 select__switch__option"
              value={entrySwitch}
              onChange={(e) => setentrySwitch(e.value)}
              options={selectSwitchoptions}
              disabled={true}
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
              label="Account Category Code"
              // value={MainAccountDetailView.accountCategoryCode}

              // onChange={(e) =>
              //   formik.setFieldValue("accountCategoryCode", e.value)
              // }
              value={MainAccountDetailView.accountCategoryCode}
              options={categoryOptionsCode}
              disabled={true}
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
              value={MainAccountDetailView.description}

              // value={
              //   MainAccountDetailView.accountCategoryCode
              //     ? `descrption ${MainAccountDetailView.description}`
              //     : ""
              // }
            />
          </div>
        </div>
        <div className="grid m-0 p-0">
          <div className="col-12 md:col-6 lg:col-6 xl:col-6">
            <LabelWrapper
              label="Company Code"
              classNames="input__label__corrections"
            />
            <div className="selected__data__view mt-2">
              {companyCodeDatas?.map((item, index) => {
                return <div className="data__content">{item.value}</div>;
              })}
            </div>
          </div>
          {entrySwitch === "Yes" && (
            <div className="col-12 md:col-6 lg:col-6 xl:col-6">
              <LabelWrapper
                label="Currency"
                classNames={
                  entrySwitch === "No"
                    ? "select__label__corrections__inactive"
                    : "input__label__corrections"
                }
              />
              <div className="selected__data__view mt-2">
                {currencyCodeDatas?.map((item, index) => {
                  return <div className="data__content">{item.value}</div>;
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewMainAccount;
