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
  patchInsuranceProductMiddleWare,
  postInsuranceProductMiddleWare,
} from "../store/insuranceProductMiddleware";

const ProductMatserDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { InsuranceProductList, loading } = useSelector(
    ({ insuranceProductReducers }) => {
      return {
        loading: insuranceProductReducers?.loading,
        InsuranceProductList: insuranceProductReducers?.InsuranceProductList,
      };
    }
  );
  console.log(action, "find action");
  const { id } = useParams();
  console.log(id, "find route id");
  const toastRef = useRef(null);
  const navigation = useNavigate();

  useEffect(() => {
    if (action === "edit" || action === "view") {
      if (id != null) {
        const FilteredList = InsuranceProductList.filter(
          (data) => data.id === parseInt(id)
        );
        setFormikValues(FilteredList);
      }
    }
  }, [action]);
  const items = [
    {
      label: "Insurance Management",
      url: "/master/generals/insurancemanagement/insurancecompany",
    },
    {
      label: "Product",
      url: "master/generals/insurancemanagement/productmaster",
    },
    {
      label: `${
        action === "add"
          ? "Add Line of Business"
          : action === "edit"
          ? "Edit Line of Business"
          : "Line of Business Details"
      }`,
    },
  ];
  const home = { label: "Master" };

  const customValidation = (values) => {
    const errors = {};

    if (!values.productCode) {
      errors.productCode = t("validation.fieldRequired");
    }
    if (!values.productName) {
      errors.productName = t("validation.fieldRequired");
    }
    if (!values.productDescription) {
      errors.productDescription = t("validation.fieldRequired");
    }
    if (!values.lineofBusiness) {
      errors.lineofBusiness = t("validation.fieldRequired");
    }

    return errors;
  };
  const handleSubmit = (values) => {
    // Handle form submission
    if (action === "add") {
      const valueWithId = {
        ...values,
        id: InsuranceProductList?.length + 1,
      };
      dispatch(postInsuranceProductMiddleWare(valueWithId));

      toastRef.current.showToast();

      {
        setTimeout(() => {
          navigation("/master/generals/insurancemanagement/productmaster");
          formik.resetForm();
        }, 3000);
      }
    } else if (action === "edit") {
      dispatch(patchInsuranceProductMiddleWare(values));
      navigation("/master/generals/insurancemanagement/productmaster");
    } else {
      navigation("/master/generals/insurancemanagement/productmaster");
    }

    console.log(values, "find values");
  };
  const setFormikValues = (data) => {
    console.log(data, "find data in formik");
    const productCode = data[0]?.productCode;
    const productName = data[0]?.productName;
    const productDescription = data[0]?.description;
    const modifiedBy = data[0]?.modifiedby;
    const modifiedOn = data[0]?.modifiedOn;
    const lineofBusiness = data[0]?.lineofBusiness;

    const updatedValues = {
      productCode: `${productCode}`,
      productName: `${productName}`,
      productDescription: `${productDescription}`,
      modifiedBy: `${modifiedBy}`,
      modifiedOn: `${modifiedOn}`,
      lineofBusiness: `${lineofBusiness}`,
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const formik = useFormik({
    initialValues: {
      id: id,
      productCode: "",
      productName: "",
      productDescription: "",
      lineofBusiness: "",
      modifiedBy: "",
      modifiedOn: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });
  return (
    <div className="action__product__master_container">
      <div className="grid m-0 top-container">
        <CustomToast ref={toastRef} message="Product Code CC1234 is added" />
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>
            <div className="main__account__title">
              {action === "add"
                ? "Add Line of Business"
                : action === "edit"
                ? "Edit Line of Business"
                : "Line of Business Details"}
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
              label={t("generalMasters.productCode")}
              value={formik.values.productCode}
              onChange={(e) =>
                formik.setFieldValue("productCode", e.target.value)
              }
            />
            {formik.touched.productCode && formik.errors.productCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.productCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.productName")}
              value={formik.values.productName}
              onChange={(e) =>
                formik.setFieldValue("productName", e.target.value)
              }
            />
            {formik.touched.productName && formik.errors.productName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.productName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.productDescription")}
              value={formik.values.productDescription}
              onChange={(e) =>
                formik.setFieldValue("productDescription", e.target.value)
              }
            />
            {formik.touched.productDescription &&
              formik.errors.productDescription && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.productDescription}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.lineOfBusiness")}
              value={formik.values.lineofBusiness}
              onChange={(e) =>
                formik.setFieldValue("lineofBusiness", e.target.value)
              }
            />
            {formik.touched.lineofBusiness && formik.errors.lineofBusiness && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.lineofBusiness}
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

export default ProductMatserDetailsAction;
