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
import { useDispatch, useSelector } from "react-redux";
import {
  getHierarchyPatchMiddleWare,
  getHierarchyViewMiddleWare,
  patchHirarchyEditMiddleware,
  postAddHirarchyMiddleware,
} from "../store/hierarchyMiddleware";
import moment from "moment";

const AddHierarchy = ({ action }) => {
  const { t } = useTranslation();
  const { id } = useParams();

  const { hierarchyListDetails, loading, total, getViewData, getPatchData } =
    useSelector(({ hierarchyTableReducers }) => {
      return {
        loading: hierarchyTableReducers?.loading,
        hierarchyListDetails: hierarchyTableReducers?.hierarchListDetails,
        total: hierarchyTableReducers,
        getViewData: hierarchyTableReducers?.getViewData,
        getPatchData: hierarchyTableReducers?.getPatchData,
      };
    });
  const navigate = useNavigate();
  const toastRef = useRef(null);
  const [visiblePopup, setVisiblePopup] = useState("");
  const dispatch = useDispatch();
  useEffect(() => {
    if (!id) return;
    if (action === "edit") dispatch(getHierarchyPatchMiddleWare(id));
    if (action === "view") dispatch(getHierarchyViewMiddleWare(id));
  }, [action, id, dispatch]);

  const items = [
    { label: t("generalMasters.employeeManagement") },
    {
      label: action === "add" ? t("generalMasters.addHierarchy") : action === "edit" ? t("generalMasters.editHierarchy") : t("generalMasters.hierarchy"),
    },
  ];
  const home = { label: t("generalMasters.master") };

  const initialValue = {
    rankCode: "",
    rankName: "",
    description: "",
    levelNumber: "",
    modifiedBy: "",
    modifiedOn: "",
  };
  const validate = (values) => {
    const errors = {};
    if (!values.rankCode) {
      errors.rankCode = "Rank Code is required";
    }
    if (!values.rankName) {
      errors.rankName = "Rank Name is required";
    }

    if (!values.levelNumber) {
      errors.levelNumber = "Level number is required";
    }

    return errors;
  };
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);

  const handleSubmit = async (values) => {
    const thunk = action === "add" ? postAddHirarchyMiddleware : patchHirarchyEditMiddleware;
    try {
      await dispatch(thunk(values)).unwrap();
      toastRef.current.showToast(action === "add" ? undefined : { detail: t("financeMasters.saveSuccessfully") });
      setTimeout(() => {
        navigate("/master/generals/employeemanagement/hierarchy");
      }, 3000);
    } catch (error) {
      toastRef.current.showToast({ severity: "error", detail: error });
    }
  };
  const setFormikValues = () => {
    const updatedValues = {
      id: getPatchData?.id,
      rankCode: getPatchData?.rankCode,
      rankName: getPatchData?.rankName,
      description: getPatchData?.description,
      levelNumber: getPatchData?.levelNumber,
      modifiedBy: getPatchData?.modifiedBy,
      modifiedOn: moment().format("DD/MM/YYYY"),
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };

  const formik = useFormik({
    initialValues: initialValue,
    validate,
    onSubmit: handleSubmit,
  });
  useEffect(() => {
    if (action === "view" || action === "edit") {
      setFormikValues();
    }
  }, [getPatchData]);
  return (
    <div className="grid add__hierarchy__container">
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
            ? t("generalMasters.addHierarchy")
            : action === "edit"
            ? t("generalMasters.editHierarchy")
            : t("generalMasters.hierarchy")}
        </div>
      </div>
      <div className="col-12 mb-2 mt-2">
        <BreadCrumb
          home={home}
          className="breadCrums__view__add__screen"
          model={items}
          separatorIcon={<SvgDot color={"#000"} />}
        />
      </div>
      <div className="col-12 m-0 ">
        <div className="grid add__account__sub__container p-3">
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={
                action === "view"
                  ? getViewData.rankCode
                  : formik.values.rankCode
              }
              onChange={formik.handleChange("rankCode")}
              label={t("generalMasters.rankCode")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
              error={formik.touched.rankCode && formik.errors.rankCode}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={
                action === "view"
                  ? getViewData.rankName
                  : formik.values.rankName
              }
              onChange={formik.handleChange("rankName")}
              label={t("generalMasters.rankName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
              error={formik.touched.rankName && formik.errors.rankName}
            />
          </div>

          <div className="col-12 md:col-3 lg:col-6">
            <InputField
              disabled={action === "view" ? true : false}
              value={
                action === "view"
                  ? getViewData.description
                  : formik.values.description
              }
              onChange={formik.handleChange("description")}
              label={t("generalMasters.description")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
              error={formik.touched.description && formik.errors.description}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              disabled={action === "view" ? true : false}
              value={
                action === "view"
                  ? getViewData.levelNumber
                  : formik.values.levelNumber
              }
              onChange={formik.handleChange("levelNumber")}
              label={t("generalMasters.levelNumber")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("generalMasters.enter")}
              error={formik.touched.levelNumber && formik.errors.levelNumber}
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
            Update
          </Button>
        )}
      </div>
      <CustomToast ref={toastRef} message={`Hierarchy ${formik.values.rankCode} is added`} />
    </div>
  );
};
export default AddHierarchy;
