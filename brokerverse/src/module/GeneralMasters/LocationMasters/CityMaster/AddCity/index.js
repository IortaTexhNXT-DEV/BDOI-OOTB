import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import { BreadCrumb } from "primereact/breadcrumb";
import InputField from "../../../../../components/InputField";
import SubmitButton from "../../../../../components/SubmitButton";
import SvgDot from "../../../../../assets/icons/SvgDot";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { Button } from "primereact/button";
import { useNavigate, useParams } from "react-router-dom";
import NavBar from "../../../../../components/NavBar";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { Card } from "primereact/card";
import DatePicker from "../../../../../components/DatePicker";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../../../components/LabelWrapper";
import { useFormik } from "formik";
import { Toast } from "primereact/toast";
import CustomToast from "../../../../../components/Toast";
import { InputText } from "primereact/inputtext";
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
  Modifiedby: "",
  ModifiedOn: "",
};

function AddCity({ action }) {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  const Navigate = useNavigate();
  const { id } = useParams();

  const { cityTableList, loading, CityListById } = useSelector(
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
  const setFormikValues = () => {
    const statedatas = CityListById?.State;
    const updatedValues = {
      id: CityListById?.id,
      CityCode: CityListById?.CityCode || "",
      CityName: CityListById?.CityName || "",
      Description: CityListById?.Description || "",
      State: statedatas || "",
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
    if (!values.Description) {
      errors.Description = t("validation.fieldRequired");
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
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.CityCode}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
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
                <div style={{ fontSize: 12, color: "red" }}>
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
                <div style={{ fontSize: 12, color: "red" }}>
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
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.State}
                </div>
              )}
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
                <div style={{ fontSize: 12, color: "red" }}>
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
                <div style={{ fontSize: 12, color: "red" }}>
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
            disabled={!formik.isValid}
            onClick={formik.handleSubmit}
          />
        )}
      </div>
      <div className="next_container">
        {action === "edit" && (
          <Button
            className="submit_button p-0"
            label={t("generalMasters.update")}
            disabled={!formik.isValid}
            onClick={formik.handleSubmit}
          />
        )}
      </div>
    </div>
  );
}

export default AddCity;
