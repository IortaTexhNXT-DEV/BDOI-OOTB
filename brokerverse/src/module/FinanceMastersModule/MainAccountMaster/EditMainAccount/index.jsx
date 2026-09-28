import React, { useEffect, useState } from "react";
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
import SvgBackicon from "../../../../assets/icons/SvgBackicon";
import { useDispatch, useSelector } from "react-redux";
import { patchMainAccountDetailEdit } from "../store/mainAccoutMiddleware";

const EditMainAccount = () => {
  const initialValues = {
    mainAccountCode: "",
    mainAccountName: "",
    description: "",
    accountCategoryCode: "",
    accountType: "",
    companyCode: [],
    currencyCode: [],
    openEntryType: [],
  };
  const dispatch = useDispatch();
  const navigation = useNavigate();
  const items = [
    {
      label: "Main Account",
      url: "/master/finance/mainaccount",
    },
    {
      label: "Edit Main Account",
      url: "/master/finance/mainaccount/editmainaccount",
    },
  ];

  const { getMainAccountDetailEdit, loading } = useSelector(
    ({ mainAccoutReducers }) => {
      return {
        loading: mainAccoutReducers?.loading,
        getMainAccountDetailEdit: mainAccoutReducers?.getMainAccountDetailEdit,
      };
    }
  );
  console.log(getMainAccountDetailEdit, "getMainAccountDetailEdit");
  const handleSubmit = (value) => {
    const openEntry = selectSwitch === "No" ? "Yes" : "No";
    const updatedValues = { ...value, openEntry };
    console.log(value, "value");
    dispatch(patchMainAccountDetailEdit(updatedValues));
    navigation("/master/finance/mainaccount");
  };

  const [accType, setAccType] = useState([]);
  const [openEType, setOpenEType] = useState([]);
  const [accCaletgoryC, setAccCaletgoryC] = useState([]);
  const [companyCodeOption, setcompanyCodeOption] = useState([]);
  const [currencyCodeOption, setcurrencyCodeOption] = useState([]);
  const setFormikValues = () => {
    const accountTypeData = getMainAccountDetailEdit?.accountType;
    const openEntryTypeData = getMainAccountDetailEdit?.openEntryType;
    const accountCategoryCodeData =
      getMainAccountDetailEdit?.accountCategoryCode;
    const companyCodeData = getMainAccountDetailEdit?.companyCode;
    const currencyCodeData = getMainAccountDetailEdit?.currencyCode;
    const updatedValues = {
      id: getMainAccountDetailEdit?.id,
      mainAccountCode: getMainAccountDetailEdit?.mainAccountCode,
      mainAccountName: getMainAccountDetailEdit?.mainAccountName,
      description: getMainAccountDetailEdit?.description,
      accountCategoryCode: getMainAccountDetailEdit?.accountCategoryCode,
      accountType: accountTypeData,
      companyCode: companyCodeData,
      currencyCode: currencyCodeData,
      openEntryType: openEntryTypeData,
    };
    // console.log(updatedValues.accountType, "uu");
    if (accountTypeData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setAccType([{ label: accountTypeData, value: accountTypeData }]);
    }
    if (openEntryTypeData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setOpenEType([{ label: openEntryTypeData, value: openEntryTypeData }]);
    }
    if (accountCategoryCodeData) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setAccCaletgoryC([
        { label: accountCategoryCodeData, value: accountCategoryCodeData },
      ]);
    }
    if (companyCodeData) {
      setcompanyCodeOption([
        { label: companyCodeData, value: companyCodeData },
      ]);
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (currencyCodeData) {
      setcurrencyCodeOption([
        { label: currencyCodeData, value: currencyCodeData },
      ]);
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  console.log(formik.values.id, "idd");
  useEffect(() => {
    setFormikValues();
  }, [getMainAccountDetailEdit]);
  const selectSwitchoptions = ["Yes", "No"];
  const [selectSwitch, setselectSwitch] = useState(selectSwitchoptions[0]);
  const EntrySwitchoptions = ["Yes", "No"];
  const [entrySwitch, setentrySwitch] = useState(EntrySwitchoptions[0]);

  const codeOptionsType = [
    { label: "Option 1", value: "Income" },
    { label: "Option 2", value: "Expense" },
    { label: "Option 3", value: "Asset" },
    { label: "Option 4", value: "Liability" },
  ];
  const categoryOptionsCode = [
    { label: "Option 1", value: "Debtor" },
    { label: "Option 2", value: "Debtor" },
  ];
  const companyCodeDatas = [
    { name: "Option 1", value: "Comp00123" },
    { name: "Option 2", value: "Comp00124" },
    { name: "Option 3", value: "Comp00125" },
  ];
  const currencyCodeDatas = [
    { name: "PHP - Philippine Peso", value: "PHP" },
    { name: "THB - Thai Baht", value: "THB" },
    { name: "USD - US Dollar", value: "USD" },
  ];

  const home = { label: "Master" };
  const customValidation = (values) => {
    const errors = {};
    return errors;
  };
  // const handleSubmit = (values) => {
  //   // Handle form submission
  //   navigation("/master/finance/mainaccount", {
  //     state: { tableView: true },
  //   });
  //   console.log(values, "find values");
  // };
  // const formik = useFormik({
  //   initialValues: {
  //     mainaccountode: "",
  //     mainAccountName: "",
  //     description: "",
  //     accountCategoryCode: "",
  //     accountType: "",
  //     companyCode: [],
  //     currencyCode: [],
  //     openEntryType: "",
  //   },
  //   validate: customValidation,
  //   onSubmit: (values) => {
  //     handleSubmit(values);
  //     formik.resetForm();
  //   },
  // });
  return (
    <div className="add__main__container">
      <div className="grid m-0 top-container">
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>
            <div className="main__account__title">Edit Main Account</div>
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
              placeholder="Enter"
              label="Main Account Name"
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
              label="Account Type"
              value={formik.values.accountType}
              onChange={(e) => formik.setFieldValue("accountType", e.value)}
              options={accType}
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
              value={formik.values.openEntryType}
              onChange={(e) => formik.setFieldValue("openEntryType", e.value)}
              options={openEType}
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
              value={formik.values.accountCategoryCode}
              onChange={(e) =>
                formik.setFieldValue("accountCategoryCode", e.value)
              }
              options={accCaletgoryC}
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
              label="Company Code"
              classNames="input__label__corrections"
            />
            <MultiSelect
              className="input__field__corrections mt-2"
              value={[formik.values.companyCode]}
              onChange={(e) => formik.setFieldValue("companyCode", e.value)}
              options={companyCodeOption}
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
              <MultiSelect
                disabled={entrySwitch === "No" ? true : false}
                className="input__field__corrections mt-2"
                value={[formik.values.currencyCode]}
                onChange={(e) => formik.setFieldValue("currencyCode", e.value)}
                options={currencyCodeOption}
                optionLabel="value"
                display="chip"
                placeholder="Select"
                dropdownIcon={<SvgDropdown />}
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-content-end mt-5">
        <Button className="save__action" onClick={formik.handleSubmit}>
          Update
        </Button>
      </div>
    </div>
  );
};

export default EditMainAccount;
