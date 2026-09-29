import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../../assets/icons/SvgDot";
import InputField from "../../../../../components/InputField";
import { useFormik } from "formik";
import { Button } from "primereact/button";
import { useNavigate, useParams } from "react-router-dom";
import CustomToast from "../../../../../components/Toast";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { useDispatch } from "react-redux";
import {
  patchInsuranceProductMiddleWare,
  postInsuranceProductMiddleWare,
} from "../store/insuranceProductMiddleware";
import mastersService from "../../../../../services/mastersService";

const ProductMatserDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { id } = useParams();
  const toastRef = useRef(null);
  const navigation = useNavigate();

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

    const updatedValues = {
      productCode: productCode ?? "",
      productName: productName ?? "",
      productDescription: productDescription ?? "",
      modifiedBy: modifiedBy ?? "",
      modifiedOn: modifiedOn ?? "",
      lineofBusiness: lineofBusiness ?? "",
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
