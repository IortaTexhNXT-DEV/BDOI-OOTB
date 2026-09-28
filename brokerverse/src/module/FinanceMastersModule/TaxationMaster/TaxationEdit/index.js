import { BreadCrumb } from "primereact/breadcrumb";
import React, { useEffect, useState, useRef } from "react";
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
import { useNavigate } from "react-router-dom";
import SvgBack from "../../../../assets/icons/SvgBack";
import { useDispatch, useSelector } from "react-redux";
import { patchTaxationEdit } from "../store/taxationMiddleWare";
import useTaxRateOptions from "../useTaxRateOptions";
import CustomToast from "../../../../components/Toast";

const AddTaxation = () => {
  const { t } = useTranslation();
  const { getTaxationEdit, loading } = useSelector(
    ({ taxationMainReducers }) => {
      return {
        loading: taxationMainReducers?.loading,
        getTaxationEdit: taxationMainReducers?.getTaxationEdit,
      };
    }
  );
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [selectedOption, setSelectedOption] = useState("30%");
  const handleDropdownChange = (e) => {
    setSelectedOption(e.value);
  };
  const ToCurrencyCode = [
    { label: "PHP", value: "PHP" },
    { label: "THB", value: "THB" },
    { label: "USD", value: "USD" },
  ];
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const items = [
    { label: t("financeMasters.taxation"), url: "/master/finance/taxation" },
    { label: t("financeMasters.editTaxation"), url: "/master/finance/taxation/taxationedit" },
  ];
  const home = { label: t("financeMasters.master") };

  const item = [{ name: "30%" }, { name: "40%" }, { name: "70%" }];
  const isocode = useTaxRateOptions();
  const validate = (values) => {
    const errors = {};
    if (!values.taxCode) {
      errors.taxCode = t("validation.fieldRequired");
    }
    if (!values.taxName) {
      errors.taxName = t("validation.fieldRequired");
    }
    if (!values.taxRate) {
      errors.taxRate = t("validation.fieldRequired");
    }
    if (!values.basis) {
      errors.basis = t("validation.fieldRequired");
    }
    if (!values.effectiveFrom) {
      errors.effectiveFrom = t("validation.fieldRequired");
    }
    if (!values.effectiveTo) {
      errors.effectiveTo = t("validation.fieldRequired");
    }

    return errors;
  };
  const toastRef = useRef(null);
  const handleSubmit = async (value) => {
    try {
      await dispatch(patchTaxationEdit(value)).unwrap();
      navigate("/master/finance/taxation");
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const setFormikValues = () => {
    const taxRatee = getTaxationEdit?.taxRate;
    const updatedValues = {
      id: getTaxationEdit?.id,
      taxCode: getTaxationEdit?.taxCode,
      taxName: getTaxationEdit?.taxName,
      remarks: getTaxationEdit?.remarks,
      taxRate: taxRatee,
      basis: getTaxationEdit?.basis,
      taxationDescription: getTaxationEdit?.taxationDescription,
      effectiveFrom: new Date(getTaxationEdit?.effectiveFrom),
      effectiveTo: new Date(getTaxationEdit?.effectiveTo),
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const formik = useFormik({
    initialValues: {
      taxCode: "",
      taxName: "",
      taxRate: "",
      basis: "",
      remarks: "",
      taxationDescription: "",
      effectiveFrom: "1/24/2023",
      effectiveTo: "1/25/2023",
    },
    validate,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  useEffect(() => {
    setFormikValues();
  }, [getTaxationEdit]);

  return (
    <div className="grid sub__add__container">
      <CustomToast ref={toastRef} />
      <div className="col-12"></div>
      <div>
        <span onClick={() => navigate(-1)}>
          <SvgBack />
        </span>
        <label className="label_header">Edit Taxation </label>
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
              label={t("financeMasters.taxName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <DropDowns
              className="dropdown__add__sub"
              label={t("financeMasters.taxRate")}
              classNames="label__sub__add"
              value={formik.values.taxRate}
              options={isocode}
              onChange={(e) => {
                formik.setFieldValue("taxRate", e.value);
              }}
              optionLabel="label"
              placeholder={t("generalMasters.select")}
              dropdownIcon={<SvgDropdown color={"#000"} />}
            />
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              value={formik.values.basis}
              onChange={formik.handleChange("basis")}
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
              label={t("financeMasters.taxationDescription")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <div class="calender_container_claim p-0">
              <LabelWrapper className="calenderlable__container">
                {t("generalMasters.effectiveFrom")}
              </LabelWrapper>

              <Calendar
                classNames="calender__container"
                showIcon
                value={formik.values.effectiveFrom}
                minDate={minDate}
                onChange={(e) => {
                  formik.setFieldValue("effectiveFrom", e.value);
                }}
                dateFormat="yy-mm-dd"
              />
            </div>
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <div class="calender_container_claim p-0">
              <LabelWrapper className="calenderlable__container">
                {t("generalMasters.effectiveTo")}
              </LabelWrapper>

              <Calendar
                classNames="calender__container"
                showIcon
                value={formik.values.effectiveTo}
                minDate={minDate}
                onChange={(e) => {
                  formik.setFieldValue("effectiveTo", e.target.value);
                }}
                dateFormat="yy-mm-dd"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="col-12 btn__view__Add mt-2">
        <Button
          label={t("financeMasters.update")}
          className="save__add__btn"
          onClick={() => {
            formik.handleSubmit();
          }}
        />
      </div>
    </div>
  );
};
export default AddTaxation;
