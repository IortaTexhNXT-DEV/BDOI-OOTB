import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import NavBar from "../../../../../components/NavBar";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../../assets/icons/SvgDot";
import InputField from "../../../../../components/InputField";
import { useFormik } from "formik";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { MultiSelect } from "primereact/multiselect";
import LabelWrapper from "../../../../../components/LabelWrapper";
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { useNavigate, useParams } from "react-router-dom";
import CustomToast from "../../../../../components/Toast";
import SvgDropdownicon from "../../../../../assets/icons/SvgDropdownicon";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { useSelector, useDispatch } from "react-redux";
import {
  patchInsurancelineOfBusinessMiddleWare,
  postInsurancelineOfBusinessMiddleWare,
} from "../store/insuranceLineOfBusinessMiddleware";

const LineBusinessDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  console.log(action, "find action");
  const { id } = useParams();
  console.log(id, "find route id");
  const toastRef = useRef(null);
  const navigation = useNavigate();
  const { InsuranceLineOfBusinessList, loading } = useSelector(
    ({ insuranceLineOfBusinessReducers }) => {
      return {
        loading: insuranceLineOfBusinessReducers?.loading,
        InsuranceLineOfBusinessList:
          insuranceLineOfBusinessReducers?.InsuranceLineOfBusinessList,
      };
    }
  );

  useEffect(() => {
    if (action === "edit" || action === "view") {
      if (id != null) {
        const FilteredList = InsuranceLineOfBusinessList.filter(
          (data) => data.id === parseInt(id)
        );
        setFormikValues(FilteredList);
      }
    }
  }, [action]);
  const items = [
    {
      label: t("generalMasters.insuranceManagement"),
      url: "/master/generals/insurancemanagement/insurancecompany",
    },
    {
      label: t("generalMasters.insuranceCompany"),
      url: "/master/generals/insurancemanagement/insurancecompany",
    },
    {
      label: action === "add" ? t("generalMasters.addLineOfBusiness") : action === "edit" ? t("generalMasters.editLineOfBusiness") : t("generalMasters.lineOfBusinessDetails"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const customValidation = (values) => {
    const errors = {};

    if (!values.lineofBusinessCode) {
      errors.lineofBusinessCode = t("validation.fieldRequired");
    }
    if (!values.LOBName) {
      errors.LOBName = t("validation.fieldRequired");
    }
    if (!values.LOBDescription) {
      errors.LOBDescription = t("validation.fieldRequired");
    }

    return errors;
  };
  const handleSubmit = (values) => {
    // Handle form submission
    if (action === "add") {
      const valueWithId = {
        ...values,
        id: InsuranceLineOfBusinessList?.length + 1,
      };
      dispatch(postInsurancelineOfBusinessMiddleWare(valueWithId));

      toastRef.current.showToast();

      {
        setTimeout(() => {
          navigation("/master/generals/insurancemanagement/lineofbusiness");
          formik.resetForm();
        }, 3000);
      }
    } else if (action === "edit") {
      dispatch(patchInsurancelineOfBusinessMiddleWare(values));
      navigation("/master/generals/insurancemanagement/lineofbusiness");
    } else {
      navigation("/master/generals/insurancemanagement/lineofbusiness");
    }

    console.log(values, "find values");
  };
  const setFormikValues = (data) => {
    console.log(data, "find data in setFormikValues");
    const lineofBusinessCode = data[0]?.businessCode;
    const LOBName = data[0]?.LOBName;
    const LOBDescription = data[0]?.description;
    const modifiedBy = "Johnson";
    const modifiedOn = "12/12/23";

    const updatedValues = {
      lineofBusinessCode: `${lineofBusinessCode}`,
      LOBName: `${LOBName}`,
      LOBDescription: `${LOBDescription}`,
      modifiedBy: `${modifiedBy}`,
      modifiedOn: `${modifiedOn}`,
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const formik = useFormik({
    initialValues: {
      id: id,
      lineofBusinessCode: "",
      LOBName: "",
      LOBDescription: "",
      modifiedBy: "",
      modifiedOn: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });
  return (
    <div className="action__linebusiness__company_container">
      <div className="grid m-0 top-container">
        <CustomToast
          ref={toastRef}
          message="Line of Business LOB1234 is added"
        />
                <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>
            <div className="main__account__title">
              {action === "add"
                ? t("generalMasters.addLineOfBusiness")
                : action === "edit"
                ? t("generalMasters.editLineOfBusiness")
                : t("generalMasters.lineOfBusinessDetails")}
            </div>
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
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.lineOfBusinessCode")}
              value={formik.values.lineofBusinessCode}
              onChange={(e) =>
                formik.setFieldValue("lineofBusinessCode", e.target.value)
              }
            />
            {formik.touched.lineofBusinessCode &&
              formik.errors.lineofBusinessCode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.lineofBusinessCode}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("generalMasters.enter")}
              label={t("generalMasters.lobName")}
              value={formik.values.LOBName}
              onChange={(e) => formik.setFieldValue("LOBName", e.target.value)}
            />
            {formik.touched.LOBName && formik.errors.LOBName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.LOBName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.lobDescription")}
              value={formik.values.LOBDescription}
              onChange={(e) =>
                formik.setFieldValue("LOBDescription", e.target.value)
              }
            />
            {formik.touched.LOBDescription && formik.errors.LOBDescription && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.LOBDescription}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={true}
              classNames="input__field__corrections"
              className="input__label__corrections"
              label={t("generalMasters.modifiedBy")}
              value={formik.values.modifiedBy}
              onChange={(e) =>
                formik.setFieldValue("modifiedBy", e.target.value)
              }
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={true}
              classNames="input__field__corrections"
              className="input__label__corrections"
              label={t("generalMasters.modifiedOn")}
              value={formik.values.modifiedOn}
              onChange={(e) =>
                formik.setFieldValue("modifiedOn", e.target.value)
              }
            />
          </div>
        </div>
      </div>
      <div className="flex justify-content-end mt-5">
        {action === "add" && (
          <Button
            className="save__action"
            disabled={!formik.isValid}
            onClick={formik.handleSubmit}
          >
            Save
          </Button>
        )}
        {action === "edit" && (
          <Button
            className="save__action"
            disabled={!formik.isValid}
            onClick={formik.handleSubmit}
          >
            Update
          </Button>
        )}
      </div>
    </div>
  );
};

export default LineBusinessDetailsAction;
