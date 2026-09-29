import { BreadCrumb } from "primereact/breadcrumb";
import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
import {
  getDesignationPatchData,
  getDesignationViewData,
  patchDesignationEditMiddleware,
  postAddDesignationMiddleware,
} from "../store/designationMiddleware";
import useMasterOptions, { useMasterRecordOptions } from "../../../common/useMasterOptions";

const AddDesignation = ({ action }) => {
  const { t } = useTranslation();
  const { getEditData, getViewData } = useSelector(
    ({ designationMainReducers }) => {
      return {
        loading: designationMainReducers?.loading,
        getEditData: designationMainReducers?.getEditData,
        getViewData: designationMainReducers?.getViewData,
      };
    }
  );
  const { id } = useParams();
  const navigate = useNavigate();
  const toastRef = useRef(null);

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
  const item = useMasterOptions("department", { valueKey: "code" });
  const levelOptions = useMasterRecordOptions("hierarchy", (row) => ({
    label: String(row.levelNumber),
    value: row.levelNumber,
  }));
  const item1 = levelOptions;
  const item2 = levelOptions;

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
  useEffect(() => {
    if (!id) return;
    if (action === "edit") dispatch(getDesignationPatchData(id));
    if (action === "view") dispatch(getDesignationViewData(id));
  }, [action, id, dispatch]);
  const handleSubmit = async (values) => {
    const thunk = action === "add" ? postAddDesignationMiddleware : patchDesignationEditMiddleware;
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(action === "add" ? undefined : { detail: t("financeMasters.saveSuccessfully") });
      setTimeout(() => {
        navigate("/master/generals/employeemanagement/designation");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const setFormikValues = () => {
    const designationCodeData = getEditData?.departmentCode
    const levelData = getEditData?.level
    const reportingToLevelDataOption = getEditData?.reportingtoLevel
    const updatedValues = {
      id: getEditData?.id,
      designationCode: getEditData?.designationCode,
      designationName: getEditData?.designationName,
      designationDescription: getEditData?.designationDescription,
      departmentCode: designationCodeData,
      level: levelData,
      reportingto: getEditData?.reportingto,
      ModifiedBy: getEditData?.ModifiedBy,
      modifiedOn: getEditData?.modifiedOn,
      reportingtoLevel: reportingToLevelDataOption,
    };
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
                className="dropdown__add__sub"
                label={t("generalMasters.departmentCode")}
                classNames="label__sub__add"
                placeholder={"Select"}
                options={item}
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
                className="dropdown__add__sub"
                label={t("generalMasters.level")}
                classNames="label__sub__add"
                placeholder={"Select"}
                options={item1}

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
                className="dropdown__add__sub"
                label={t("generalMasters.reportingToLevel")}
                classNames="label__sub__add"
                placeholder={"Select"}
                options={item2}

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
