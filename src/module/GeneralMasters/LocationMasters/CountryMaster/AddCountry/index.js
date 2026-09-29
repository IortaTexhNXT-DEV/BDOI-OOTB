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
  patchCountryEditMiddleware,
  postAddCountryMiddleware,
} from "../store/countryMiddleware";

const initialValues = {
  CountryName: "",
  ISOCode: "",
  Description: "",
  PhoneCode: "",
  Modifiedby: "",
  ModifiedOn: "",
};

function AddExchange({ action }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { id } = useParams();
  console.log("first", id, action);
  const toastRef = useRef(null);
  const [date, setDate] = useState(null);
  const Navigate = useNavigate();

  const { countryTableList, loading, countryDetailList } = useSelector(
    ({ countryReducers }) => {
      return {
        loading: countryReducers?.loading,
        countryTableList: countryReducers?.countryTableList,
        countryDetailList: countryReducers?.countryDetailList,
      };
    }
  );
  console.log(countryDetailList, "countryDetailList");

  const home = { label: t("generalMasters.master") };
  const items = [
    { label: t("generalMasters.location"), url: "/master/generals/location/country" },
    {
      label: action === "add" ? t("generalMasters.addCountry") : action === "edit" ? t("generalMasters.editCountry") : t("generalMasters.countryDetails"),
    },
  ];

  const setFormikValues = () => {
    const updatedValues = {
      id: countryDetailList?.id,
      CountryName: countryDetailList?.CountryName,
      ISOCode: countryDetailList?.ISOCode,
      Description: countryDetailList?.Description,
      PhoneCode: countryDetailList?.PhoneCode,
      Modifiedby: countryDetailList?.Modifiedby,
      ModifiedOn: countryDetailList?.ModifiedOn,
    };
    console.log(updatedValues, "updatedValues");
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  console.log(action, "action");

  useEffect(() => {
    if (action === "view" || action === "edit") {
      setFormikValues();
      console.log(formik.values.CountryName, " formik.values.CountryName");
    }
  }, [countryDetailList]);

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  // const handleSubmit=(value)=>{

  //     Navigate("/master/finance/exchangerate")
  // }

  // const toastRef = useRef(null);
  const handleSubmitAdd = (values) => {
    const valueWithId = {
      ...values,
      id: countryTableList?.length + 1,
    };
    dispatch(postAddCountryMiddleware(valueWithId));

    toastRef.current.showToast();

    setTimeout(() => {
      Navigate("/master/generals/location/country");
    }, 3000);
  };

  const handleSubmitEdit = (values) => {

    dispatch(patchCountryEditMiddleware(values));
    console.log("Handle Edit Submission", values);
    setTimeout(() => {
      Navigate("/master/generals/location/country");
    }, 3000);
  };

  const handleSubmit = (values) => {
    if (action === "add") {
      handleSubmitAdd(values);
    } else if (action === "edit") {
      handleSubmitEdit(values);
    }
  };

  // };

  const customValidation = (values) => {
    const errors = {};

    if (!values.CountryName) {
      errors.CountryName = t("validation.fieldCodeRequired");
    }
    if (!values.ISOCode) {
      errors.ISOCode = t("validation.fieldRequired");
    }
    if (!values.Description) {
      errors.Description = t("validation.fieldRequired");
    }
    // if (!values.PhoneCode) {
    //     errors.PhoneCode = "This field is required";
    // }
    if (!values.Modifiedby) {
      errors.Modifiedby = t("validation.fieldRequired");
    }

    if (!values.ModifiedOn) {
      errors.ModifiedOn = t("validation.fieldRequired");
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
    // onSubmit: handleSubmit
  });

  return (
    <div className="overall__addcountry__container">
      {/* <CustomToast ref={toastRef} 
            // detail="Some detail text"
            // content={"Voucher Details Save Successfully"}
            /> */}
      <CustomToast ref={toastRef} message={t("generalMasters.countryAdded")} />
      <div>
        <span onClick={() => Navigate(-1)}>
          <SvgBackicon />
        </span>
        <label className="label_header">
          {action === "add"
            ? t("generalMasters.addCountry")
            : action === "edit"
              ? t("generalMasters.editCountry")
              : t("generalMasters.countryDetails")}
        </label>
      </div>
      <BreadCrumb
        model={items}
        home={home}
        className="breadcrumbs_container"
        separatorIcon={<SvgDot color={"#000"} />}
      />

      <Card style={{ borderRadius: "20px", marginTop: "20px" }}>
        <div class="grid">
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.countryName")}
                placeholder={t("generalMasters.enter")}
                //   value={formik.values.CurrencyDescription}
                value={formik.values.CountryName}
                onChange={formik.handleChange("CountryName")}
                disabled={
                  action === "add" ? false : action === "edit" ? false : true
                }
              />
              {formik.touched.CountryName && formik.errors.CountryName && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.CountryName}
                </div>
              )}
            </div>
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.isoCode")}
                placeholder={t("generalMasters.enter")}
                //   value={formik.values.CurrencyDescription}
                value={formik.values.ISOCode}
                onChange={formik.handleChange("ISOCode")}
                disabled={
                  action === "add" ? false : action === "edit" ? false : true
                }
              />
              {formik.touched.ISOCode && formik.errors.ISOCode && (
                <div style={{ fontSize: 12, color: "red" }}>
                  {formik.errors.ISOCode}
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
                //   value={formik.values.CurrencyDescription}
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
            <label className="label_text">{t("generalMasters.phoneCode")}</label>
            <div className="p-inputgroup flex-1">
              <span className="p-inputgroup-addon">
                <div>+91</div>
                <i className={<SvgDropdown />}></i>
              </span>
              <InputText
                placeholder={t("generalMasters.enter")}
                value={formik.values.PhoneCode}
                onChange={formik.handleChange("PhoneCode")}
                disabled={
                  action === "add" ? false : action === "edit" ? false : true
                }
              />
            </div>
            {/* {formik.touched.PhoneCode && formik.errors.PhoneCode && (
              <div
                style={{ fontSize: 12, color: "red" }}
                
              >
                {formik.errors.PhoneCode}
              </div>
            )} */}
          </div>
          <div class="sm-col-12 col-12 md:col-3 lg-col-3">
            <div>
              <InputField
                classNames="field__container"
                label={t("generalMasters.modifiedBy")}
                placeholder={t("generalMasters.enter")}
                //   value={formik.values.CurrencyDescription}
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
                //   value={formik.values.CurrencyDescription}
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
            onClick={() => {
              formik.handleSubmit();
            }}
          />
        )}
      </div>
      <div className="next_container">
        {action === "edit" && (
          <Button
            className="submit_button p-0"
            label={t("generalMasters.update")}
            disabled={!formik.isValid}
            onClick={() => {
              formik.handleSubmit();
            }}
          />
        )}
      </div>
    </div>
  );
}

export default AddExchange;
