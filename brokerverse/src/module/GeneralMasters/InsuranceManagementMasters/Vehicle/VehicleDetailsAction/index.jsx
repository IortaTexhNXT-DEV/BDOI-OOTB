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
  patchInsuranceVehicleMiddleWare,
  postInsuranceVehicleMiddleWare,
} from "../store/insuranceVehicleMiddleware";
import mastersService from "../../../../../services/mastersService";

const VehicleDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { id } = useParams();
  const toastRef = useRef(null);
  const navigation = useNavigate();

  useEffect(() => {
    if ((action === "edit" || action === "view") && id != null) {
      mastersService
        .get("vehicle", id)
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
      label: t("generalMasters.vehicle"),
      url: "/master/generals/insurancemanagement/vehicle",
    },
    {
      label: action === "add" ? t("generalMasters.addVehicle") : action === "edit" ? t("generalMasters.editVehicle") : t("generalMasters.vehicleDetails"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const customValidation = (values) => {
    const errors = {};

    if (!values.vehicleCode) {
      errors.vehicleCode = t("validation.fieldRequired");
    }
    if (!values.vehicleName) {
      errors.vehicleName = t("validation.fieldRequired");
    }
    if (!values.vehicleVariant) {
      errors.vehicleVariant = t("validation.fieldRequired");
    }

    if (!values.vehicleModel) {
      errors.vehicleModel = t("validation.fieldRequired");
    }
    if (!values.vehicleBrand) {
      errors.vehicleBrand = t("validation.fieldRequired");
    }

    if (!values.seatingCapacity) {
      errors.seatingCapacity = t("validation.fieldRequired");
    }

    return errors;
  };
  const handleSubmit = async (values) => {
    if (action !== "add" && action !== "edit") {
      navigation("/master/generals/insurancemanagement/vehicle");
      return;
    }
    const thunk = action === "add" ? postInsuranceVehicleMiddleWare : patchInsuranceVehicleMiddleWare;
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(action === "edit" ? { detail: t("financeMasters.saveSuccessfully") } : undefined);
      setTimeout(() => {
        navigation("/master/generals/insurancemanagement/vehicle");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const setFormikValues = (data) => {
    const vehicleCode = data[0]?.vehicleCode;
    const vehicleName = data[0]?.vehicleName;
    const vehicleVariant = data[0]?.vehicleVariant;
    const vehicleModel = data[0]?.vehicleModel;
    const vehicleBrand = data[0]?.vehicleBrand;
    const seatingCapacity = data[0]?.seatingCapacity;

    const updatedValues = {
      id: id,
      vehicleCode: vehicleCode ?? "",
      vehicleName: vehicleName ?? "",
      vehicleVariant: vehicleVariant ?? "",
      vehicleModel: vehicleModel ?? "",
      vehicleBrand: vehicleBrand ?? "",
      seatingCapacity: seatingCapacity ?? "",
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const formik = useFormik({
    initialValues: {
      vehicleCode: "",
      vehicleName: "",
      vehicleVariant: "",
      vehicleModel: "",
      vehicleBrand: "",
      seatingCapacity: "",
    },
    validate: customValidation,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });
  return (
    <div className="action__vehicle_container">
      <div className="grid m-0 top-container">
        <CustomToast ref={toastRef} message={`Vehicle Code ${formik.values.vehicleCode || ""} is added`} />
        <div className="col-12 p-0"></div>
        <div className="col-12 p-0">
          <div className="svgback_container">
            <span onClick={() => navigation(-1)}>
              <SvgBackicon />
            </span>
            <div className="main__account__title">
              {action === "add"
                ? t("generalMasters.addVehicle")
                : action === "edit"
                ? t("generalMasters.editVehicle")
                : t("generalMasters.vehicleDetails")}
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
              placeholder={t("generalMasters.enter")}
              label={t("generalMasters.vehicleCode")}
              value={formik.values.vehicleCode}
              onChange={(e) =>
                formik.setFieldValue("vehicleCode", e.target.value)
              }
            />
            {formik.touched.vehicleCode && formik.errors.vehicleCode && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.vehicleCode}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder="Enter"
              label={t("generalMasters.vehicleName")}
              value={formik.values.vehicleName}
              onChange={(e) =>
                formik.setFieldValue("vehicleName", e.target.value)
              }
            />
            {formik.touched.vehicleName && formik.errors.vehicleName && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.vehicleName}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("generalMasters.enter")}
              label={t("generalMasters.vehicleVariant")}
              value={formik.values.vehicleVariant}
              onChange={(e) =>
                formik.setFieldValue("vehicleVariant", e.target.value)
              }
            />
            {formik.touched.vehicleVariant && formik.errors.vehicleVariant && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.vehicleVariant}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("generalMasters.enter")}
              label={t("generalMasters.vehicleModel")}
              value={formik.values.vehicleModel}
              onChange={(e) =>
                formik.setFieldValue("vehicleModel", e.target.value)
              }
            />
            {formik.touched.vehicleModel && formik.errors.vehicleModel && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.vehicleModel}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("generalMasters.enter")}
              label={t("generalMasters.vehicleBrand")}
              value={formik.values.vehicleBrand}
              onChange={(e) =>
                formik.setFieldValue("vehicleBrand", e.target.value)
              }
            />
            {formik.touched.vehicleBrand && formik.errors.vehicleBrand && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.vehicleBrand}
              </div>
            )}
          </div>
          <div className="col-12 md:col-3 lg:col-3 xl:col-3 ">
            <InputField
              disabled={action === "view" ? true : false}
              classNames="input__field__corrections"
              className="input__label__corrections"
              placeholder={t("generalMasters.enter")}
              label={t("generalMasters.seatingCapacity")}
              value={formik.values.seatingCapacity}
              onChange={(e) =>
                formik.setFieldValue("seatingCapacity", e.target.value)
              }
            />
            {formik.touched.seatingCapacity &&
              formik.errors.seatingCapacity && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.seatingCapacity}
                </div>
              )}
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

export default VehicleDetailsAction;
