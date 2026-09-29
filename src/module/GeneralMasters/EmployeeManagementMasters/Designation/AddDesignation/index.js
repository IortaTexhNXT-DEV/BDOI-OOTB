import { BreadCrumb } from "primereact/breadcrumb";
import React, { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import NavBar from "../../../../../components/NavBar";
import SvgDot from "../../../../../assets/icons/SvgDot";
import "./index.scss";
import InputField from "../../../../../components/InputField";
import { Button } from "primereact/button";
import { useFormik } from "formik";
import SvgBack from "../../../../../assets/icons/SvgBack";
import CustomToast from "../../../../../components/Toast";
import { useNavigate, useParams } from "react-router-dom";
import DropDowns from "../../../../../components/DropDowns";
import SvgDropdown from "../../../../../assets/icons/SvgDropdown";
import { useDispatch, useSelector } from "react-redux";
import { patchDesignationEditMiddleware, postAddDesignationMiddleware } from "../store/designationMiddleware";

const AddDesignation = ({ action }) => {
  const { t } = useTranslation();
  const { getEditData, loading, getViewData } = useSelector(
    ({ designationMainReducers }) => {
      return {
        loading: designationMainReducers?.loading,
        getEditData: designationMainReducers?.getEditData,
        getViewData: designationMainReducers?.getViewData,
      };
    }
  );
  console.log(getViewData, "getViewData");
  const { id } = useParams();
  console.log(id, "find id");
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const [visiblePopup, setVisiblePopup] = useState("");



  const items = [
    { label: t("generalMasters.employeeManagement") },
    {
      label: t("generalMasters.designation"),
      url: "/master/generals/employeemanagement/designation",
    },
    ,
    {
      label: action === "add"
        ? t("generalMasters.addDesignation")
        : action === "edit"
          ? t("generalMasters.editDesignation")
          : t("generalMasters.viewDesignation"),
    },
  ];
  const home = { label: "Master" };
  const item = [
    {
      label: action === "add" ? "Motor" : getViewData?.departmentCode,
      value: action === "add" ? "Motor" : getViewData?.departmentCode
    },
    {
      label: action === "add" ? "Fire" : getViewData?.departmentCode,
      value: action === "add" ? "Fire" : getViewData?.departmentCode
    },
    {
      label: action === "add" ? "Engineering" : getViewData?.departmentCode,
      value: action === "add" ? "Engineering" : getViewData?.departmentCode
    }
  ];
  const item1 = [
    {
      label: action === "add" ? "1" : getViewData?.level,
      value: action === "add" ? "1" : getViewData?.level
    },
    {
      label: action === "add" ? "2" : getViewData?.level,
      value: action === "add" ? "2" : getViewData?.level
    },
    {
      label: action === "add" ? "3" : getViewData?.level,
      value: action === "add" ? "3" : getViewData?.level
    }
  ];
  const item2 = [
    {
      label: action === "add" ? "1" : getViewData?.reportingtoLevel,
      value: action === "add" ? "1" : getViewData?.reportingtoLevel
    },
    {
      label: action === "add" ? "2" : getViewData?.reportingtoLevel,
      value: action === "add" ? "2" : getViewData?.reportingtoLevel
    },
     {
      label: action === "add" ? "3" : getViewData?.reportingtoLevel,
      value: action === "add" ? "3" : getViewData?.reportingtoLevel
    }
  ];

  const initialValue = {
    designationCode: action === "view" ? getViewData?.designationCode : "",
    designationName: action === "view" ? getViewData?.designationName : "",
    designationDescription: action === "view" ? getViewData?.designationDescription : "",
    departmentCode: action === "view" ? getViewData?.departmentCode : "",
    level: action === "view" ? getViewData?.level : "",
    reportingtoLevel: action === "view" ? getViewData?.reportingtoLevel : "",
    ModifiedBy: action === "view" ? getViewData?.ModifiedBy : "",
    modifiedOn: action === "view" ? getViewData?.modifiedOn : "",
  };
  const validate = (values) => {
    const errors = {};
    console.log(values, errors, "values");
    if (!values.designationCode) {
      errors.designationCode = "Designation Code is required";
    }
    if (!values.departmentCode) {
      errors.departmentCode = "Department Code is required";
    }

    if (!values.designationName) {
      errors.designationName = "Designation Name is required";
    }

    if (!values.level) {
      errors.level = "Level is required";
    }
    if (!values.reportingtoLevel) {
      errors.reportingtoLevel = "reporting to Level is required";
    }

    return errors;
  };
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const dispatch = useDispatch()
  const handleSubmit = (values) => {
    console.log(values, "values");
    if (action === "add") {
      dispatch(postAddDesignationMiddleware(formik.values))
    }
    if (action === "edit") {
      dispatch(patchDesignationEditMiddleware(values))
    }
    toastRef.current.showToast();

    setTimeout(() => {
      setVisiblePopup(false);
      navigate("/master/generals/employeemanagement/designation")
    }, 3000);

  };
  const [designationCodeDataOption, setDesignationCodeDataOption] = useState([])
  const [levelDataOption, setLevelDataOption] = useState([])
  const [reportingToLevelData, setReportingToLevelData] = useState([])
  const setFormikValues = () => {
    const designationCodeData = getEditData?.departmentCode
    const levelData = getEditData?.level
    const reportingToLevelDataOption = getEditData?.reportingtoLevel
    const updatedValues = {
      id: getEditData?.id,
      designationCode: getEditData?.designationCode,
      designationName: getEditData.designationName,
      designationDescription: getEditData?.designationDescription,
      departmentCode: designationCodeData,
      level: levelData,
      reportingto: getEditData?.reportingto,
      ModifiedBy: getEditData?.ModifiedBy,
      modifiedOn: getEditData?.modifiedOn,
      reportingtoLevel: reportingToLevelDataOption,
    };
    if (designationCodeData) {
      setDesignationCodeDataOption([{ label: designationCodeData, value: designationCodeData }])
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (levelData) {
      setLevelDataOption([{ label: levelData, value: levelData }])
      formik.setValues({ ...formik.values, ...updatedValues });
    }
    if (reportingToLevelDataOption) {
      setReportingToLevelData([{ label: reportingToLevelDataOption, value: reportingToLevelDataOption }])
      formik.setValues({ ...formik.values, ...updatedValues });

    }
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  useEffect(() => {
    setFormikValues();
  }, [getEditData]);
  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: handleSubmit,
  });
  return (
    <div>
      <div className="grid add__designation__container">
        <div className="add_backbut_container">
          <div
            style={{
              justifyContent: "center",
              alignItems: "center",
              display: "flex",
            }}
          >
            <span onClick={() => navigate(-1)}>
              <SvgBack />
            </span>
          </div>
          <div className="add__sub__title">
            {action === "add"
              ? "Add Designation"
              : action === "edit"
                ? "Edit Designation"
                : "View Designation"}
          </div>
        </div>
        <div className="col-12 " >
          <div className="mt-2">
            <BreadCrumb
              home={home}
              className="breadCrums__view__add__screen"
              model={items}
              separatorIcon={<SvgDot color={"#000"} />}
            />
          </div>
        </div>
        <div className="col-12 mt-4 ">
          <div className="grid add__account__sub__container p-3 ml-1">
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                disabled={action === "view" ? true : false}
                value={action === "view" ? getViewData?.designationCode : formik.values.designationCode}
                onChange={formik.handleChange("designationCode")}
                // error={formik.errors.designationCode}
                label={t("generalMasters.designationCode")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("generalMasters.enter")}
              />
              {formik.touched.designationCode &&
                formik.errors.designationCode && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.designationCode}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                disabled={action === "view" ? true : false}
                value={action === "view" ? getViewData?.designationName : formik.values.designationName}
                onChange={formik.handleChange("designationName")}
                // error={formik.errors.designationName}
                label={t("generalMasters.designationName")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("generalMasters.enter")}
              />
              {formik.touched.designationName &&
                formik.errors.designationName && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.designationName}
                  </div>
                )}
            </div>

            <div className="col-12 md:col-3 lg:col-6">
              <InputField
                disabled={action === "view" ? true : false}
                value={action === "view" ? getViewData?.designationDescription : formik.values.designationDescription}
                onChange={formik.handleChange("designationDescription")}
                label={t("generalMasters.designationDescription")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("generalMasters.enter")}
              />
              {formik.touched.designationDescription &&
                formik.errors.designationDescription && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.designationDescription}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <DropDowns
                disabled={action === "view" ? true : false}
                value={action === "view" ? getViewData?.departmentCode : formik.values.departmentCode}
                onChange={formik.handleChange("departmentCode")}
                // error={formik.errors.departmentCode}
                className="dropdown__add__sub"
                label={t("generalMasters.departmentCode")}
                classNames="label__sub__add"
                placeholder={"Select"}
                options={action === "add" ? item : action === "edit" ? designationCodeDataOption : item}
                optionValue={"label"}
                optionLabel="label"
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.departmentCode &&
                formik.errors.departmentCode && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.departmentCode}
                  </div>
                )}
            </div>

            <div className="col-12 md:col-3 lg:col-3">
              <DropDowns
                disabled={action === "view" ? true : false}
                value={action === "view" ? getViewData?.level : formik.values.level}
                onChange={formik.handleChange("level")}
                // error={formik.errors.level}
                className="dropdown__add__sub"
                label={t("generalMasters.level")}
                classNames="label__sub__add"
                placeholder={"Select"}
                // options={item1}
                options={action === "add" ? item1 : action === "edit" ? levelDataOption : item1}

                dropdownIcon={<SvgDropdown color={"#000"} />}
                optionValue={"label"}
                optionLabel="label"
              />
              {formik.touched.level &&
                formik.errors.level && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.level}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <DropDowns
                disabled={action === "view" ? true : false}
                value={action === "view" ? getViewData?.reportingtoLevel : formik.values.reportingtoLevel}
                onChange={formik.handleChange("reportingtoLevel")}
                // error={formik.errors.reportingtoLevel}
                className="dropdown__add__sub"
                label={t("generalMasters.reportingToLevel")}
                classNames="label__sub__add"
                placeholder={"Select"}
                options={action === "add" ? item2 : action === "edit" ? reportingToLevelData : item2}

                optionValue={"label"}
                optionLabel="label"
                dropdownIcon={<SvgDropdown color={"#000"} />}
              />
              {formik.touched.reportingtoLevel &&
                formik.errors.reportingtoLevel && (
                  <div style={{ fontSize: 12, color: "red" }}>
                    {formik.errors.reportingtoLevel}
                  </div>
                )}
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                disabled={action === "view" ? true : false}
                value={action === "view" ? getViewData?.ModifiedBy : formik.values.ModifiedBy}
                onChange={formik.handleChange("ModifiedBy")}
                error={formik.errors.ModifiedBy}
                label={t("generalMasters.modifiedBy")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("generalMasters.enter")}
              />

            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                disabled={action === "view" ? true : false}
                value={action === "view" ? getViewData?.modifiedOn : formik.values.modifiedOn}
                onChange={formik.handleChange("modifiedOn")}
                error={formik.errors.modifiedOn}
                label={t("generalMasters.modifiedOn")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("generalMasters.enter")}
              />
            </div>
          </div>
        </div>
        <div className="col-12 btn__view__Add mt-2">
          {action === "add" && (
            <Button
              label={t("generalMasters.save")}
              className="save__add__btn"
              onClick={() => {
                formik.handleSubmit();
              }}
              disabled={!formik.isValid}
            />
          )}
          {action === "edit" && (
            <Button
              className="save__add__btn"
              disabled={!formik.isValid}
              onClick={formik.handleSubmit}
            >
              {t("generalMasters.update")}
            </Button>
          )}
        </div>
        <CustomToast
          ref={toastRef}
          message="Designation Code CC1234 
is added"
        />
      </div>
    </div>
  );
};
export default AddDesignation;
