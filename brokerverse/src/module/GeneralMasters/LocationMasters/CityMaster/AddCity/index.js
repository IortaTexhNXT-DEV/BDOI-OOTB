import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../../../components/InputField";
import SvgDot from "../../../../../assets/icons/SvgDot";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate } from "react-router-dom";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import { useFormik } from "formik";
import CustomToast from "../../../../../components/Toast";
import { useDispatch, useSelector } from "react-redux";
import {
  patchCityEditMiddleware,
  postAddCityMiddleware,
} from "../store/cityMiddleware";
import useMasterOptions from "../../../common/useMasterOptions";

const initialValues = {
  CityCode: "",
  CityName: "",
  Description: "",
  State: "",
  Region: "",
  CityClass: "",
  PostalCode: "",
  PsgcCode: "",
  Modifiedby: "",
  ModifiedOn: "",
};

function AddCity({ action }) {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  const Navigate = useNavigate();

  const { CityListById } = useSelector(
    ({ cityReducers }) => {
      return {
        loading: cityReducers?.loading,
        cityTableList: cityReducers?.cityTableList,
        CityListById: cityReducers?.CityListById,
      };
    }
  );

  const home = { label: t("generalMasters.master") };
  const items = [
    { label: t("generalMasters.location"), url: "/master/generals/location/city" },
    {
      label: action === "add" ? t("generalMasters.addCity") : action === "edit" ? t("generalMasters.editCity") : t("generalMasters.cityDetails"),
    },
  ];

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const State = useMasterOptions("state");
  const Region = useMasterOptions("region");
  const CITY_CLASSES = ["Highly Urbanized City", "Independent Component City", "Component City", "Municipality"].map((c) => ({ label: c, value: c }));
  const setFormikValues = () => {
    const statedatas = CityListById?.State;
    const updatedValues = {
      id: CityListById?.id,
      CityCode: CityListById?.CityCode || "",
      CityName: CityListById?.CityName || "",
      Description: CityListById?.Description || "",
      State: statedatas || "",
      Region: CityListById?.Region || "",
      CityClass: CityListById?.CityClass || "",
      PostalCode: CityListById?.PostalCode || "",
      PsgcCode: CityListById?.PsgcCode || "",
      Modifiedby: CityListById?.Modifiedby || "",
      ModifiedOn: CityListById?.ModifiedOn || "",
    };
    if (action === "view") {
      if (statedatas) {
        formik.setValues({ ...formik.values, ...updatedValues });
        formik.setFieldValue("statedatas", statedatas);
      }
    } else {
      if (statedatas) {
        formik.setValues({ ...formik.values, ...updatedValues });
      }
    }

    formik.setValues({ ...formik.values, ...updatedValues });
  };

  useEffect(() => {
    if (action === "view" || action === "edit") {
      setFormikValues();
    }
  }, [CityListById]);

  const saveAndReturn = async (thunk, values, message) => {
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(message ? { detail: message } : undefined);
      setTimeout(() => {
        Navigate("/master/generals/location/city");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };

  const handleSubmitAdd = (values) => saveAndReturn(postAddCityMiddleware, values);

  const handleSubmitEdit = (values) =>
    saveAndReturn(patchCityEditMiddleware, values, t("financeMasters.saveSuccessfully"));

  const handleSubmit = (values) => {
    if (action === "add") {
      handleSubmitAdd(values);
    } else if (action === "edit") {
      handleSubmitEdit(values);
    }
  };

  const customValidation = (values) => {
    const errors = {};

    if (!values.CityCode) {
      errors.CityCode = t("validation.fieldRequired");
    }
    if (!values.CityName) {
      errors.CityName = t("validation.fieldRequired");
    }
    if (!values.State) {
      errors.State = t("validation.fieldRequired");
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: initialValues,
    validate: customValidation,
    onSubmit: (values) => {
      // Handle form submission
       handleSubmit(values);
    },
    // onSubmit: handleSubmit,
  });

  return (
    <div className="overall__addcity__container">
      <CustomToast ref={toastRef} message={t("generalMasters.cityAdded")} />
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">
          {action === "add"
            ? t("generalMasters.addCity")
            : action === "edit"
              ? t("generalMasters.editCity")
              : t("generalMasters.cityDetails")}
        </label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                required
                classNames="field__container"
                label={t("generalMasters.cityCode")}
                placeholder={t("generalMasters.enter")}
                value={formik.values.CityCode}
                onChange={formik.handleChange("CityCode")}
                disabled={
                  action === "add" ? false : action === "edit" ? false : true
                }
              />
              {formik.touched.CityCode && formik.errors.CityCode && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.CityCode}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                required
                classNames="field__container"
                label={t("generalMasters.cityName")}
                placeholder={t("generalMasters.enter")}
                value={formik.values.CityName}
                onChange={formik.handleChange("CityName")}
                disabled={
                  action === "add" ? false : action === "edit" ? false : true
                }
              />
              {formik.touched.CityName && formik.errors.CityName && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.CityName}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-6 lg-col-6">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.description")}
                placeholder={t("generalMasters.enter")}
                value={formik.values.Description}
                onChange={formik.handleChange("Description")}
                disabled={
                  action === "add" ? false : action === "edit" ? false : true
                }
              />
              {formik.touched.Description && formik.errors.Description && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.Description}
                </div>
              )}
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="col-3 md:col-3 lg-col-3">
            <div>
              <DropDowns
                required
                className="dropdown__container"
                label={t("generalMasters.state")}
                value={formik.values.State}
                onChange={(e) => formik.setFieldValue("State", e.value)}
                options={State}
                optionLabel="label"
                optionValue="label"
                placeholder={t("generalMasters.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                disabled={
                  action === "add" ? false : action === "edit" ? false : true
                }
              />
              {formik.touched.State && formik.errors.State && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.State}
                </div>
              )}
            </div>
          </div>

          <div class="col-3 md:col-3 lg-col-3">
            <div>
              <DropDowns
                className="dropdown__container"
                label={t("generalMasters.region")}
                value={formik.values.Region}
                onChange={(e) => formik.setFieldValue("Region", e.value)}
                options={Region}
                optionLabel="label"
                optionValue="label"
                placeholder={t("generalMasters.regionFromProvince")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                disabled={action === "view"}
              />
            </div>
          </div>
          <div class="col-3 md:col-3 lg-col-3">
            <div>
              <DropDowns
                className="dropdown__container"
                label={t("generalMasters.cityClass")}
                value={formik.values.CityClass}
                onChange={(e) => formik.setFieldValue("CityClass", e.value)}
                options={CITY_CLASSES}
                optionLabel="label"
                optionValue="value"
                placeholder={t("generalMasters.select")}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                disabled={action === "view"}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.zipCode")}
                placeholder={t("generalMasters.enter")}
                value={formik.values.PostalCode}
                onChange={formik.handleChange("PostalCode")}
                disabled={action === "view"}
              />
            </div>
          </div>
        </div>

        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.psgcCode")}
                placeholder={t("generalMasters.enter")}
                value={formik.values.PsgcCode}
                onChange={formik.handleChange("PsgcCode")}
                disabled={action === "view"}
              />
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.modifiedBy")}
                placeholder={t("generalMasters.enter")}
                value={formik.values.Modifiedby}
                onChange={formik.handleChange("Modifiedby")}
                disabled={
                  action === "add" ? false : action === "edit" ? false : true
                }
              />
              {formik.touched.Modifiedby && formik.errors.Modifiedby && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.Modifiedby}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.modifiedOn")}
                placeholder={t("generalMasters.enter")}
                value={formik.values.ModifiedOn}
                onChange={formik.handleChange("ModifiedOn")}
                disabled={
                  action === "add" ? false : action === "edit" ? false : true
                }
              />
              {formik.touched.ModifiedOn && formik.errors.ModifiedOn && (
                <div style={{ fontSize: 12, color: "var(--color-danger)" }}>
                  {formik.errors.ModifiedOn}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="next_container">
        {action === "add" && (
          <Button
            className="submit_button p-0"
            label={t("generalMasters.save")}
            onClick={formik.handleSubmit}
          />
        )}
      </div>
      <div className="next_container">
        {action === "edit" && (
          <Button
            className="submit_button p-0"
            label={t("generalMasters.update")}
            onClick={formik.handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

export default AddCity;
