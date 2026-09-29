import { BreadCrumb } from "primereact/breadcrumb";
import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import NavBar from "../../../../components/NavBar";
import SvgDot from "../../../../assets/icons/SvgDot";
import "../AddTaxation/index.scss";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { Calendar } from "primereact/calendar";
import LabelWrapper from "../../../../components/LabelWrapper";
import { useFormik } from "formik";
import SvgBack from "../../../../assets/icons/SvgBack";
import CustomToast from "../../../../components/Toast";
import { useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { postAddTaxationMiddileware } from "../store/taxationMiddleWare";
import useTaxRateOptions from "../useTaxRateOptions";
import { calendarDateFormat } from "../../../../utility/dateFormat";
const AddTaxation = () => {
  const { t } = useTranslation();
  const [errors, setErrors] = useState("");
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const dispatch = useDispatch();
  const { taxationList, loading, taxationSearchList } = useSelector(
    ({ taxationMainReducers }) => {
      return {
        loading: taxationMainReducers?.loading,
        taxationList: taxationMainReducers?.taxationList,
        taxationSearchList: taxationMainReducers?.taxationSearchList,
      };
    }
  );
  const items = [
    { label: t("financeMasters.taxationMaster"), url: "/master/finance/taxation" },
    { label: t("financeMasters.addTaxation"), url: "/master/finance/taxation/addtaxation" },
  ];
  const home = { label: t("financeMasters.master") };

  const item = useTaxRateOptions();
  const initialValue = {
    taxCode: "",
    taxName: "",
    taxRate: "",
    basis: "",
    remarks: "",
    taxationDescription: "",
    effectiveFrom: new Date(),
    effectiveTo: new Date(),
  };
  const validate = (values) => {
    const errors = {};
    if (!values.taxCode) {
      errors.taxCode = t("financeMasters.taxCodeRequired");
    }
    if (!values.taxName) {
      errors.taxName = t("financeMasters.taxNameRequired");
    }
    if (!values.taxRate) {
      errors.taxRate = t("financeMasters.taxRateRequired");
    }
    if (!values.basis) {
      errors.basis = t("financeMasters.basisRequired");
    }
    if (!values.effectiveFrom) {
      errors.effectiveFrom = t("financeMasters.effectiveFromRequired");
    }
    if (!values.effectiveTo) {
      errors.effectiveTo = t("financeMasters.effectiveToRequired");
    }

    return errors;
  };
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const handleSubmit = async (values) => {
    try {
      await dispatch(postAddTaxationMiddileware(values)).unwrap();
      toastRef.current.showToast();
      setTimeout(() => {
        navigate("/master/finance/taxation");
      }, 2000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: handleSubmit,
  });
  return (
    <div className="grid sub__add__container">
      <div className="col-12"></div>
      <div>
        <span onClick={() => navigate(-1)}>
          <SvgBack />
        </span>
        <label className="label_header">{t("financeMasters.addTaxation")}</label>
      </div>
      <div className="col-12 mb-2">
        <div className="mt-3">
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="col-12 m-0 ">
        <div className="grid add__account__sub__container p-3">
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              value={formik.values.taxCode}
              onChange={formik.handleChange("taxCode")}
              error={formik.touched.taxCode && formik.errors.taxCode}
              label={t("financeMasters.taxCode")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              value={formik.values.taxName}
              onChange={formik.handleChange("taxName")}
              error={formik.touched.taxName && formik.errors.taxName}
              label={t("financeMasters.taxName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              value={formik.values.taxRate}
              onChange={formik.handleChange("taxRate")}
              error={formik.touched.taxRate && formik.errors.taxRate}
              className="dropdown__add__sub"
              label={t("financeMasters.taxRate")}
              classNames="label__sub__add"
              optionLabel="label"
              placeholder={t("financeMasters.select")}
              options={item}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              value={formik.values.basis}
              onChange={formik.handleChange("basis")}
              error={formik.touched.basis && formik.errors.basis}
              label={t("financeMasters.basis")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputField
              value={formik.values.remarks}
              onChange={formik.handleChange("remarks")}
              error={
                formik.touched.TransactionNumberFrom && formik.errors.remarks
              }
              label={t("financeMasters.remarks")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputField
              value={formik.values.taxationDescription}
              onChange={formik.handleChange("taxationDescription")}
              error={
                formik.touched.taxationDescription &&
                formik.errors.taxationDescription
              }
              label={t("financeMasters.taxationDescription")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <div class="calender_container_claim p-0">
              <LabelWrapper className="calenderlable__container">
                Effective From
              </LabelWrapper>

              <Calendar
                classNames="calender__container"
                showIcon
                value={formik.values.effectiveFrom}
                minDate={minDate}
                onChange={(e) => {
                  formik.setFieldValue("effectiveFrom", e.target.value);
                }}
                dateFormat={calendarDateFormat()}
                error={
                  formik.touched.effectiveFrom && formik.errors.effectiveFrom
                }
              />
            </div>
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <div class="calender_container_claim p-0">
              <LabelWrapper className="calenderlable__container">
                {t("financeMasters.effectiveTo")}
              </LabelWrapper>

              <Calendar
                classNames="calender__container"
                showIcon
                value={formik.values.effectiveTo}
                minDate={minDate}
                onChange={(e) => {
                  formik.setFieldValue("effectiveTo", e.target.value);
                }}
                dateFormat={calendarDateFormat()}
                error={formik.touched.effectiveTo && formik.errors.effectiveTo}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="col-12 btn__view__Add mt-2">
        <Button
          label={t("financeMasters.save")}
          className="save__add__btn"
          onClick={() => {
            formik.handleSubmit();
          }}
          disabled={!formik.isValid}
        />
      </div>
      <CustomToast ref={toastRef} message={t("financeMasters.taxCodeAdded", { code: formik.values.taxCode })} />
    </div>
  );
};
export default AddTaxation;
