import { BreadCrumb } from "primereact/breadcrumb";
import React, { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import NavBar from "../../../../components/NavBar";
import SvgDot from "../../../../assets/icons/SvgDot";
import "../EditPettyCash/index.scss";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SuccessIcon from "../../../../assets/icons/SuccessIcon";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import { useFormik } from "formik";
import ArrowLeftIcon from "../../../../assets/icons/ArrowLeftIcon";
import { useNavigate, useParams } from "react-router-dom";
import CustomToast from "../../../../components/Toast";
import { useDispatch, useSelector } from "react-redux";
import {
  getPatchPettyCashEdit,
  patchPettyCashEdit,
} from "../store/pettyCashMasterMiddleWare";

const EditPettyCash = () => {
  const { t } = useTranslation();
  const { getPettyCashEdit, loading } = useSelector(
    ({ pettyCashMainReducers }) => {
      return {
        loading: pettyCashMainReducers?.loading,
        getPettyCashEdit: pettyCashMainReducers?.getPettyCashEdit,
      };
    }
  );

  const { id } = useParams();
  console.log(id, "idd");
  const [EditID, setEditID] = useState(id);
  const toastRef = useRef(null);
  const [visiblePopup, setVisiblePopup] = useState(false);
  const items = [
    { label: "Petty Cash", url: "/master/finance/pettycash" },
    {
      label: "Edit Petty Cash",
      url: "/master/finance/pettycash/editpettycash",
    },
  ];
  const home = { label: "Master" };
  useEffect(() => {
    const timerId = setTimeout(() => {
      setVisiblePopup(false);
    }, 2000);

    return () => clearTimeout(timerId);
  }, [visiblePopup]);

  const [step, setStep] = useState(0);
  const customValidation = (values) => {
    const errors = {};

    if (!values.pettycashcode) {
      errors.pettycashcode = "This field Code is required";
    }

    if (!values.pettycashname) {
      errors.pettycashname = "This field is required";
    }
    if (!values.pettycashsize) {
      errors.pettycashsize = "This field is required";
    }
    if (!values.availabelCash) {
      errors.availabelCash = "This field is required";
    }
    if (!values.minicashbox) {
      errors.minicashbox = "This field is required";
    }
    if (!values.transactionlimit) {
      errors.transactionlimit = "This field is required";
    }

    return errors;
  };
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const handleGoBack = () => {
    navigate("/master/finance/pettycash");
  };

  console.log(getPettyCashEdit, "getPettyCashEdit");
  const handleSubmit = (value) => {
    console.log(value, "value");
    dispatch(patchPettyCashEdit(value));
    navigate("/master/finance/pettycash");
  };
  const setFormikValues = () => {
    const updatedValues = {
      id: getPettyCashEdit?.id,
      pettycashcode: getPettyCashEdit?.pettycashcode,
      pettycashname: getPettyCashEdit?.pettycashname,
      pettycashsize: getPettyCashEdit?.pettycashsize,
      availabelCash: getPettyCashEdit?.availabelCash,
      minicashbox: getPettyCashEdit?.minicashbox,
      transactionlimit: getPettyCashEdit?.transactionlimit,
    };
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const formik = useFormik({
    initialValues: {
      pettycashcode: "",
      pettycashname: "",
      pettycashsize: "",
      availabelCash: "",
      minicashbox: "",
      transactionlimit: "",
    },
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  console.log(formik.values.id, "idd");
  useEffect(() => {
    setFormikValues();
  }, [getPettyCashEdit]);

  return (
    <div className="grid edit__add__container">
      <div className="col-12"></div>
      <div className="col-12">
        <CustomToast ref={toastRef} message="Add Petty Cash" />
      </div>
      <div className="col-12 mb-2">
        <div className="add__sub__title mr-2">
          <div onClick={handleGoBack} className="mr-2 mt-1">
            <ArrowLeftIcon />
          </div>
          Edit Petty Cash
        </div>
        <div className="mt-3">
          <BreadCrumb
            home={home}
            className="breadCrums__view__add__screen"
            model={items}
            separatorIcon={<SvgDot color={"#000"} />}
          />
        </div>
      </div>
      <div className="grid card__container p-2 m-1">
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              // step === 0
              // ?
              "input__label__reversal"
              // : "input__label__reversal__inactive"
            }
            label="Petty Cash Code"
            placeholder="Enter"
            value={formik.values.pettycashcode}
            onChange={(e) =>
              formik.setFieldValue("pettycashcode", e.target.value)
            }
          />
          {formik.touched.pettycashcode && formik.errors.pettycashcode && (
            <div style={{ fontSize: 12, color: "red" }}>
              {formik.errors.pettycashcode}
            </div>
          )}
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              // step === 0
              // ?
              "input__label__reversal"
              // : "input__label__reversal__inactive"
            }
            label="Petty Cash Name"
            placeholder="Enter"
            value={formik.values.pettycashname}
            onChange={(e) =>
              formik.setFieldValue("pettycashname", e.target.value)
            }
          />
          {formik.touched.pettycashname && formik.errors.pettycashname && (
            <div style={{ fontSize: 12, color: "red" }}>
              {formik.errors.pettycashname}
            </div>
          )}
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              // step === 0
              // ?
              "input__label__reversal"
              // : "input__label__reversal__inactive"
            }
            label="Petty Cash Size"
            placeholder="Enter"
            value={formik.values.pettycashsize}
            onChange={(e) =>
              formik.setFieldValue("pettycashsize", e.target.value)
            }
          />
          {formik.touched.pettycashsize && formik.errors.pettycashsize && (
            <div style={{ fontSize: 12, color: "red" }}>
              {formik.errors.pettycashsize}
            </div>
          )}
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              // step === 0
              // ?
              "input__label__reversal"
              // : "input__label__reversal__inactive"
            }
            label="Available Cash"
            placeholder="Enter"
            value={formik.values.availabelCash}
            onChange={(e) =>
              formik.setFieldValue("availabelCash", e.target.value)
            }
          />
          {formik.touched.availabelCash && formik.errors.availabelCash && (
            <div style={{ fontSize: 12, color: "red" }}>
              {formik.errors.availabelCash}
            </div>
          )}
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              // step === 0
              // ?
              "input__label__reversal"
              // : "input__label__reversal__inactive"
            }
            label="Minimum Cash Box"
            placeholder="Enter"
            value={formik.values.minicashbox}
            onChange={(e) =>
              formik.setFieldValue("minicashbox", e.target.value)
            }
          />
          {formik.touched.minicashbox && formik.errors.minicashbox && (
            <div style={{ fontSize: 12, color: "red" }}>
              {formik.errors.minicashbox}
            </div>
          )}
        </div>
        <div className="col-12 md:col-3 lg:col-3 xl:col-3 input__view__reversal">
          <InputField
            classNames="input__field__reversal__inactive"
            className={
              // step === 0
              // ?
              "input__label__reversal"
              // : "input__label__reversal__inactive"
            }
            label="Transaction Limit"
            placeholder="Enter"
            value={formik.values.transactionlimit}
            onChange={(e) =>
              formik.setFieldValue("transactionlimit", e.target.value)
            }
          />
          {formik.touched.transactionlimit &&
            formik.errors.transactionlimit && (
              <div style={{ fontSize: 12, color: "red" }}>
                {formik.errors.transactionlimit}
              </div>
            )}
        </div>
      </div>
      <div className="col-12 btn__view__Add mt-2">
        <Button
          label={t("financeMasters.save")}
          className="save__add__btn"
          // onClick={() => setVisiblePopup(true)}
          onClick={formik.handleSubmit}
        />
      </div>
    </div>
  );
};
export default EditPettyCash;
