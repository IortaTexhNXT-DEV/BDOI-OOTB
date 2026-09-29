import { BreadCrumb } from "primereact/breadcrumb";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SvgDot from "../../../../assets/icons/SvgDot";
import "../AddCurrency/index.scss";
import { useFormik } from "formik";
import DropDowns from "../../../../components/DropDowns";
import InputField from "../../../../components/InputField";
import { Button } from "primereact/button";
import SvgDropdown from "../../../../assets/icons/SvgDropdown";
import CustomToast from "../../../../components/Toast";
import { useNavigate } from "react-router-dom";
import SvgBack from "../../../../assets/icons/SvgBack";
import { useDispatch, useSelector } from "react-redux";
import { patchCurrencyDetailEdit } from "../store/currencyMasterMiddlewar";

const initialValues = {
  id: "",
  CurrencyCode: "",
  ISOcode: "",
  SmallestUnit: "",
  UnitDescription: "",
  CurrencyName: "",
  Description: "",
  CurrencyFormat: "",
  NumberofDecimals: "",
};

const EditCurrency = () => {
  const { t } = useTranslation();
  const toastRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isocode, setISOcodeData] = useState([]);
  const [ID, setID] = useState("");
  const { CurrencyDetailEdit, loading } = useSelector(
    ({ currencyMasterReducer }) => {
      return {
        loading: currencyMasterReducer?.loading,
        CurrencyDetailEdit: currencyMasterReducer?.getCurrecyDetailEdit,
      };
    }
  );

  const items = [
    { label: t("financeMasters.currency"), url: "/master/finance/currency" },
    { label: t("financeMasters.editCurrency"), url: "/master/finance/currency/editcurrency" },
  ];
  const setFormikValues = () => {
    const IsoCode = CurrencyDetailEdit?.ISOcode;
    const updatedValues = {
      CurrencyCode: CurrencyDetailEdit?.Currencycode,
      ISOcode: IsoCode,
      SmallestUnit: CurrencyDetailEdit?.SmallestUnit,
      UnitDescription: CurrencyDetailEdit?.UnitDescription,
      CurrencyName: CurrencyDetailEdit?.CurrencyName,
      Description: CurrencyDetailEdit?.Description,
      CurrencyFormat: CurrencyDetailEdit?.CurrencyFormat,
      NumberofDecimals: CurrencyDetailEdit?.NumberofDecimals,
      id: CurrencyDetailEdit.id 
    };

    if (IsoCode) {
      formik.setValues({ ...formik.values, ...updatedValues });
      setISOcodeData([{ label: IsoCode, value: IsoCode }]);
    }
    formik.setValues({ ...formik.values, ...updatedValues });
  };
  const home = { label: t("financeMasters.master") };

  const handleSubmit = (value) => {
    dispatch(patchCurrencyDetailEdit(value));
    toastRef.current.showToast();
    setTimeout(() => {
      navigate("/master/finance/currency");
    }, 2000);
  };

  const formik = useFormik({
    initialValues: initialValues,
    onSubmit: (values) => {
      handleSubmit(values);
    },
  });

  console.log(formik.values.id, "idleo");
  useEffect(() => {
    setFormikValues();
  }, [CurrencyDetailEdit]);
  return (
    <div className="grid sub__add__container">
      <CustomToast ref={toastRef} message="Add Currency Successfully" />
      <div className="col-12 mb-2">
        <div className="back_container">
          <span onClick={() => navigate(-1)}>
            <SvgBack />
          </span>
          <div className="add__sub__title">Edit Currency</div>
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
      <form onSubmit={formik.handleSubmit}>
        <div className="add__account__sub__container p-3 ">
          <div className="grid">
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                label={t("financeMasters.currencyCode")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("financeMasters.enter")}
                value={formik.values.CurrencyCode}
                onChange={formik.handleChange("CurrencyCode")}
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <DropDowns
                label={t("financeMasters.isoCode")}
                className="dropdown__add__sub"
                classNames="label__sub__add"
                placeholder={"Select"}
                dropdownIcon={<SvgDropdown color={"#000"} />}
                value={formik.values.ISOcode}
                options={isocode}
                onChange={(e) => {
                  formik.setFieldValue("ISOcode", e.value);
                }}
                optionLabel="value"
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                label={t("financeMasters.smallestUnit")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("financeMasters.enter")}
                value={formik.values.SmallestUnit}
                onChange={formik.handleChange("SmallestUnit")}
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                label={t("financeMasters.unitDescription")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("financeMasters.enter")}
                value={formik.values.UnitDescription}
                onChange={formik.handleChange("UnitDescription")}
              />
            </div>
          </div>
          <div className="grid">
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                label={t("financeMasters.currencyName")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("financeMasters.enter")}
                value={formik.values.CurrencyName}
                onChange={formik.handleChange("CurrencyName")}
              />
            </div>
            <div className="col-12 md:col-6 lg:col-6">
              <InputField
                label={t("generalMasters.description")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("financeMasters.enter")}
                value={formik.values.Description}
                onChange={formik.handleChange("Description")}
              />
            </div>
          </div>
          <div className="grid ">
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                label={t("financeMasters.currencyFormat")}
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder={t("financeMasters.enter")}
                value={formik.values.CurrencyFormat}
                onChange={formik.handleChange("CurrencyFormat")}
              />
            </div>
            <div className="col-12 md:col-3 lg:col-3">
              <InputField
                label="Number of Decimals"
                classNames="dropdown__add__sub"
                className="label__sub__add"
                placeholder="Enter"
                value={formik.values.NumberofDecimals}
                onChange={formik.handleChange("NumberofDecimals")}
              />
            </div>
          </div>
        </div>
      </form>
      <div className="col-12 btn__view__Add mt-2">
        <Button
          label={t("financeMasters.save")}
          className="save__add__btn"
          onClick={() => {
            formik.handleSubmit();
          }}
        />
      </div>
    </div>
  );
};
export default EditCurrency;
