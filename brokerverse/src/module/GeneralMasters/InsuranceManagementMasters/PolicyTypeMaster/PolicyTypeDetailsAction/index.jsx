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
  patchInsurancePolicyTypeMiddleWare,
  postInsurancePolicyTypeMiddleWare,
} from "../store/insurancePolicyTypeMiddleware";
import mastersService from "../../../../../services/mastersService";

const PolicyTypeDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { id } = useParams();
  const toastRef = useRef(null);
  const navigation = useNavigate();

  useEffect(() => {
    if ((action === "edit" || action === "view") && id != null) {
      mastersService
        .get("policy-type", id)
        .then((record) => setFormikValues([record]))
        .catch((error) => toastRef.current.showToast({ severity: "error", detail: error.message }));
    }
  }, [action, id]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = [
    {
      label: t("generalMasters.insuranceManagement"),
      url: "/master/generals/insurancemanagement/insurancecompany",
    },
    {
      label: t("generalMasters.productMaster"),
      url: "master/generals/insurancemanagement/productmaster",
    },
    {
      label: action === "add" ? t("generalMasters.addPolicyType") : action === "edit" ? t("generalMasters.editPolicyType") : t("generalMasters.policyTypeDetails"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const customValidation = (values) => {
    const errors = {};

    if (!values.policyTypeCode) {
      errors.policyTypeCode = t("validation.fieldRequired");
    }
    if (!values.policyTypeName) {
      errors.policyTypeName = t("validation.fieldRequired");
    }
    if (!values.policyTypeDescription) {
      errors.policyTypeDescription = t("validation.fieldRequired");
    }
    if (!values.Product) {
      errors.Product = t("validation.fieldRequired");
    }

    return errors;
  };
  const handleSubmit = async (values) => {
    if (action !== "add" && action !== "edit") {
      navigation("/master/generals/insurancemanagement/policytype");
      return;
    }
    const thunk = action === "add" ? postInsurancePolicyTypeMiddleWare : patchInsurancePolicyTypeMiddleWare;
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(action === "edit" ? { detail: t("financeMasters.saveSuccessfully") } : undefined);
      setTimeout(() => {
        navigation("/master/generals/insurancemanagement/policytype");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const setFormikValues = (data) => {
    const policyTypeCode = data[0]?.policytypeCode;
    const policyTypeName = data[0]?.policyTypeName;
    const policyTypeDescription = data[0]?.policyTypeDescription;
    const modifiedBy = "Johnson";
    const modifiedOn = "12/12/23";
    const Product = data[0]?.product;

    const updatedValues = {
      policyTypeCode: policyTypeCode ?? "",
      policyTypeName: policyTypeName ?? "",
      policyTypeDescription: policyTypeDescription ?? "",
      modifiedBy: modifiedBy ?? "",
      modifiedOn: modifiedOn ?? "",
      Product: Product ?? "",
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const formik = useFormik({
    initialValues: {
      id: id,
      policyTypeCode: "",
      policyTypeName: "",
      policyTypeDescription: "",
      Product: "",
      modifiedBy: "",
      modifiedOn: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });
  return (
    <div className="policy__type__master_container">
      <div className="grid m-0 top-container">
        <CustomToast
          ref={toastRef}
          message={`Policy Type Code ${formik.values.policyTypeCode || ""} is added`}
        />
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>
            <div className="main__account__title">
              {action === "add"
                ? t("generalMasters.addPolicyType")
                : action === "edit"
                ? t("generalMasters.editPolicyType")
                : t("generalMasters.policyTypeDetails")}
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
              label={t("generalMasters.policyTypeCode")}
              value={formik.values.policyTypeCode}
              onChange={(e) =>
                formik.setFieldValue("policyTypeCode", e.target.value)
              }
            />
            {formik.touched.policyTypeCode && formik.errors.policyTypeCode && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.policyTypeCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("generalMasters.enter")}
              label={t("generalMasters.policyTypeName")}
              value={formik.values.policyTypeName}
              onChange={(e) =>
                formik.setFieldValue("policyTypeName", e.target.value)
              }
            />
            {formik.touched.policyTypeName && formik.errors.policyTypeName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.policyTypeName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("generalMasters.enter")}
              label={t("generalMasters.policyTypeDescription")}
              value={formik.values.policyTypeDescription}
              onChange={(e) =>
                formik.setFieldValue("policyTypeDescription", e.target.value)
              }
            />
            {formik.touched.policyTypeDescription &&
              formik.errors.policyTypeDescription && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.policyTypeDescription}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.product")}
              value={formik.values.Product}
              onChange={(e) => formik.setFieldValue("Product", e.target.value)}
            />
            {formik.touched.Product && formik.errors.Product && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.Product}
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
            onClick={formik.handleSubmit}
          >
            {t("generalMasters.save")}
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

export default PolicyTypeDetailsAction;
