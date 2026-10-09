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
  patchInsurancelineOfBusinessMiddleWare,
  postInsurancelineOfBusinessMiddleWare,
} from "../store/insuranceLineOfBusinessMiddleware";
import mastersService from "../../../../../services/mastersService";

const LineBusinessDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { id } = useParams();
  const toastRef = useRef(null);
  const navigation = useNavigate();

  useEffect(() => {
    if ((action === "edit" || action === "view") && id != null) {
      mastersService
        .get("line-of-business", id)
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
  const handleSubmit = async (values) => {
    if (action !== "add" && action !== "edit") {
      navigation("/master/generals/insurancemanagement/lineofbusiness");
      return;
    }
    const thunk = action === "add" ? postInsurancelineOfBusinessMiddleWare : patchInsurancelineOfBusinessMiddleWare;
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(action === "edit" ? { detail: t("financeMasters.saveSuccessfully") } : undefined);
      setTimeout(() => {
        navigation("/master/generals/insurancemanagement/lineofbusiness");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const setFormikValues = (data) => {
    const lineofBusinessCode = data[0]?.lineofBusinessCode;
    const LOBName = data[0]?.LOBName;
    const LOBDescription = data[0]?.LOBDescription;
    const modifiedBy = data[0]?.modifiedBy;
    const modifiedOn = data[0]?.modifiedOn;

    const updatedValues = {
      lineofBusinessCode: lineofBusinessCode ?? "",
      LOBName: LOBName ?? "",
      LOBDescription: LOBDescription ?? "",
      modifiedBy: modifiedBy ?? "",
      modifiedOn: modifiedOn ?? "",
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
          message={`Line of Business ${formik.values.lineofBusinessCode || ""} is added`}
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
              required
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
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.lineofBusinessCode}
                </div>
              )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              required
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("generalMasters.enter")}
              label={t("generalMasters.lobName")}
              value={formik.values.LOBName}
              onChange={(e) => formik.setFieldValue("LOBName", e.target.value)}
            />
            {formik.touched.LOBName && formik.errors.LOBName && (
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                {formik.errors.LOBName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
            <InputField
              required
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
              <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
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

export default LineBusinessDetailsAction;
