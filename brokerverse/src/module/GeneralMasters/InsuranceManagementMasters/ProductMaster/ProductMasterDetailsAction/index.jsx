import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../../assets/icons/SvgDot";
import InputField from "../../../../../components/InputField";
import { useFormik } from "formik";
import { Button } from "primereact/button";
import { Dropdown } from "primereact/dropdown";
import { useNavigate, useParams } from "react-router-dom";
import CustomToast from "../../../../../components/Toast";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { useDispatch } from "react-redux";
import {
  patchInsuranceProductMiddleWare,
  postInsuranceProductMiddleWare,
} from "../store/insuranceProductMiddleware";
import mastersService from "../../../../../services/mastersService";
import useMasterOptions from "../../../common/useMasterOptions";

const BUSINESS_TYPES = ["package", "non_package"];
const CUSTOMER_SEGMENTS = ["retail", "corporate", "both"];

const ProductMatserDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { id } = useParams();
  const toastRef = useRef(null);
  const navigation = useNavigate();
  // Line of business from its master; products keep the lower-case code (motor, fire, ...)
  const lobOptions = useMasterOptions("line-of-business", { valueKey: "code" }).map((o) => ({
    label: o.label,
    value: String(o.value || "").toLowerCase(),
  }));

  useEffect(() => {
    if ((action === "edit" || action === "view") && id != null) {
      mastersService
        .get("product", id)
        .then((record) => setFormikValues([record]))
        .catch((error) => toastRef.current.showToast({ severity: "error", detail: error.message }));
    }
  }, [action, id]); // eslint-disable-line react-hooks/exhaustive-deps
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
          ? "Add Product"
          : action === "edit"
          ? "Edit Product"
          : "Product Details"
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
    if (!values.businessType) {
      errors.businessType = t("validation.fieldRequired");
    }
    if (!values.customerSegment) {
      errors.customerSegment = t("validation.fieldRequired");
    }

    return errors;
  };
  const handleSubmit = async (values) => {
    if (action !== "add" && action !== "edit") {
      navigation("/master/generals/insurancemanagement/productmaster");
      return;
    }
    const thunk = action === "add" ? postInsuranceProductMiddleWare : patchInsuranceProductMiddleWare;
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(action === "edit" ? { detail: t("financeMasters.saveSuccessfully") } : undefined);
      setTimeout(() => {
        navigation("/master/generals/insurancemanagement/productmaster");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const setFormikValues = (data) => {
    const productCode = data[0]?.productCode;
    const productName = data[0]?.productName;
    const productDescription = data[0]?.description;
    const modifiedBy = data[0]?.modifiedBy;
    const modifiedOn = data[0]?.modifiedOn;
    const lineofBusiness = data[0]?.lineofBusiness;
    const businessType = data[0]?.businessType;
    const customerSegment = data[0]?.customerSegment;

    const updatedValues = {
      productCode: productCode ?? "",
      productName: productName ?? "",
      productDescription: productDescription ?? "",
      modifiedBy: modifiedBy ?? "",
      modifiedOn: modifiedOn ?? "",
      lineofBusiness: lineofBusiness ?? "",
      businessType: businessType ?? "",
      customerSegment: customerSegment ?? "both",
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
      businessType: "",
      customerSegment: "both",
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
        <CustomToast ref={toastRef} message={`Product Code ${formik.values.productCode || ""} is added`} />
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>
            <div className="main__account__title">
              {action === "add"
                ? "Add Product"
                : action === "edit"
                ? "Edit Product"
                : "Product Details"}
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
            <label className="input__label__corrections block mb-1" htmlFor="lineofBusiness">{t("generalMasters.lineOfBusiness")}</label>
            <Dropdown
              inputId="lineofBusiness"
              disabled={action === "view"}
              className="w-full"
              value={formik.values.lineofBusiness}
              options={
                formik.values.lineofBusiness && !lobOptions.some((o) => o.value === formik.values.lineofBusiness)
                  ? [...lobOptions, { label: formik.values.lineofBusiness, value: formik.values.lineofBusiness }]
                  : lobOptions
              }
              onChange={(e) => formik.setFieldValue("lineofBusiness", e.value)}
              placeholder={t("productClassification.select")}
            />
            {formik.touched.lineofBusiness && formik.errors.lineofBusiness && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.lineofBusiness}
              </div>
            )}
          </div>
          {/* Package: tariff products sold quickly (quick quote); non-package: placed per risk through the slips */}
          {[
            { name: "businessType", options: BUSINESS_TYPES, label: t("productClassification.businessType"), prefix: "productClassification.businessTypes" },
            { name: "customerSegment", options: CUSTOMER_SEGMENTS, label: t("productClassification.customerSegment"), prefix: "productClassification.segments" },
          ].map((f) => (
            <div key={f.name} className="col-12 md:col-3 lg:col-3 xl:col-3 ">
              <label className="input__label__corrections block mb-1" htmlFor={f.name}>{f.label}</label>
              <Dropdown
                inputId={f.name}
                disabled={action === "view"}
                className="w-full"
                value={formik.values[f.name]}
                options={f.options.map((value) => ({ value, label: t(`${f.prefix}.${value}`) }))}
                onChange={(e) => formik.setFieldValue(f.name, e.value)}
                placeholder={t("productClassification.select")}
              />
              {formik.touched[f.name] && formik.errors[f.name] && (
                <div style={{ fontSize: 12, color: "red" }}>{formik.errors[f.name]}</div>
              )}
            </div>
          ))}
          {action !== "add" && (<>
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
          </>)}
        </div>
      </div>
      <div className="flex justify-content-end mt-5">
        {action === "add" && (
          <Button
            className="save__action"
            onClick={formik.handleSubmit}
          >
            Save
          </Button>
        )}
        {action === "edit" && (
          <Button
            className="save__action"
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
