import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./index.scss";
import NavBar from "../../../../../components/NavBar";
import { BreadCrumb } from "primereact/breadcrumb";
import SvgDot from "../../../../../assets/icons/SvgDot";
import InputField from "../../../../../components/InputField";
import { useFormik } from "formik";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { MultiSelect } from "primereact/multiselect";
import LabelWrapper from "../../../../../components/LabelWrapper";
import { Button } from "primereact/button";
import { SelectButton } from "primereact/selectbutton";
import { useNavigate, useParams } from "react-router-dom";
import CustomToast from "../../../../../components/Toast";
import SvgDropdownicon from "../../../../../assets/icons/SvgDropdownicon";
import SvgBackicon from "../../../../../assets/icons/SvgBackicon";
import { useSelector, useDispatch } from "react-redux";
import {
  patchInsuranceCoverMiddleWare,
  postInsuranceCoverMiddleWare,
} from "../store/insuranceCoverMiddleware";

const CoverDetailsAction = ({ action }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { InsuranceCoverList, loading } = useSelector(
    ({ insuranceCoverReducers }) => {
      return {
        loading: insuranceCoverReducers?.loading,
        InsuranceCoverList: insuranceCoverReducers?.InsuranceCoverList,
      };
    }
  );

  console.log(action, "find action");
  const { id } = useParams();
  console.log(id, "find route id");
  const toastRef = useRef(null);
  const navigation = useNavigate();

  useEffect(() => {
    if (action === "edit" || action === "view") {
      if (id != null) {
        const FilteredList = InsuranceCoverList.filter(
          (data) => data.id === parseInt(id)
        );
        setFormikValues(FilteredList);
      }
    }
  }, [action]);
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
  const handleSubmit = (values) => {
    // Handle form submission
    if (action === "add") {
      const valueWithId = {
        ...values,
        id: InsuranceCoverList?.length + 1,
      };
      dispatch(postInsuranceCoverMiddleWare(valueWithId));
      toastRef.current.showToast();

      {
        setTimeout(() => {
          navigation("/master/generals/insurancemanagement/cover");
          formik.resetForm();
        }, 3000);
      }
    } else if (action === "edit") {
      dispatch(patchInsuranceCoverMiddleWare(values));
      navigation("/master/generals/insurancemanagement/cover");
    } else {
      navigation("/master/generals/insurancemanagement/cover");
    }

    console.log(values, "find values");
  };
  const setFormikValues = (data) => {
    console.log(data, "find setFormikValues");
    const coverCode = data[0]?.coverCode;
    const coverName = data[0]?.coverName;
    const coverDescription = data[0]?.coverDescription;
    const modifiedBy = data[0].modifiedby;
    const modifiedOn = data[0].modifiedOn;

    const updatedValues = {
      coverCode: `${coverCode}`,
      coverName: `${coverName}`,
      coverDescription: `${coverDescription}`,
      modifiedBy: `${modifiedBy}`,
      modifiedOn: `${modifiedOn}`,
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
        <CustomToast ref={toastRef} message="Cover Code CC1234 is added" />
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

export default CoverDetailsAction;
