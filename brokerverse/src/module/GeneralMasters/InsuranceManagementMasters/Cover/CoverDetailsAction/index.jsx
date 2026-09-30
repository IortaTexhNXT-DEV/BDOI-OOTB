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
  patchInsuranceCoverMiddleWare,
  postInsuranceCoverMiddleWare,
} from "../store/insuranceCoverMiddleware";
import mastersService from "../../../../../services/mastersService";

const CoverDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const { id } = useParams();
  const toastRef = useRef(null);
  const navigation = useNavigate();

  useEffect(() => {
    if ((action === "edit" || action === "view") && id != null) {
      mastersService
        .get("cover", id)
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
      label: t("generalMasters.cover"),
      url: "/master/generals/insurancemanagement/cover",
    },
    {
      label: action === "add" ? t("generalMasters.addCover") : action === "edit" ? t("generalMasters.editCover") : t("generalMasters.coverDetails"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const customValidation = (values) => {
    const errors = {};

    if (!values.coverCode) {
      errors.coverCode = t("validation.fieldRequired");
    }
    if (!values.coverName) {
      errors.coverName = t("validation.fieldRequired");
    }
    if (!values.coverDescription) {
      errors.coverDescription = t("validation.fieldRequired");
    }

    return errors;
  };
  const handleSubmit = async (values) => {
    if (action !== "add" && action !== "edit") {
      navigation("/master/generals/insurancemanagement/cover");
      return;
    }
    const thunk = action === "add" ? postInsuranceCoverMiddleWare : patchInsuranceCoverMiddleWare;
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(action === "edit" ? { detail: t("financeMasters.saveSuccessfully") } : undefined);
      setTimeout(() => {
        navigation("/master/generals/insurancemanagement/cover");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const setFormikValues = (data) => {
    const coverCode = data[0]?.coverCode;
    const coverName = data[0]?.coverName;
    const coverDescription = data[0]?.coverDescription;
    const modifiedBy = data[0]?.modifiedBy;
    const modifiedOn = data[0]?.modifiedOn;

    const updatedValues = {
      coverCode: coverCode ?? "",
      coverName: coverName ?? "",
      coverDescription: coverDescription ?? "",
      modifiedBy: modifiedBy ?? "",
      modifiedOn: modifiedOn ?? "",
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const formik = useFormik({
    initialValues: {
      id: id,
      coverCode: "",
      coverName: "",
      coverDescription: "",
      modifiedBy: "",
      modifiedOn: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });
  return (
    <div className="action__cover_container">
      <div className="grid m-0 top-container">
        <CustomToast ref={toastRef} message={`Cover Code ${formik.values.coverCode || ""} is added`} />
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>
            <div className="main__account__title">
              {action === "add"
                ? "Add Cover"
                : action === "edit"
                ? "Edit Cover"
                : "Cover Details"}
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
              label={t("generalMasters.coverCode")}
              value={formik.values.coverCode}
              onChange={(e) =>
                formik.setFieldValue("coverCode", e.target.value)
              }
            />
            {formik.touched.coverCode && formik.errors.coverCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.coverCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.coverName")}
              value={formik.values.coverName}
              onChange={(e) =>
                formik.setFieldValue("coverName", e.target.value)
              }
            />
            {formik.touched.coverName && formik.errors.coverName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.coverName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-6 lg:col-6 xl:col-6 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.coverDescription")}
              value={formik.values.coverDescription}
              onChange={(e) =>
                formik.setFieldValue("coverDescription", e.target.value)
              }
            />
            {formik.touched.coverDescription &&
              formik.errors.coverDescription && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.coverDescription}
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

export default CoverDetailsAction;
