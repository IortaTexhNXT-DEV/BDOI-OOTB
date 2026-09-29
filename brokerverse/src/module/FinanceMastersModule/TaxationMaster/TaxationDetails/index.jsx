import { BreadCrumb } from "primereact/breadcrumb";
import React from "react";
import { useTranslation } from "react-i18next";
import NavBar from "../../../../components/NavBar";
import SvgDot from "../../../../assets/icons/SvgDot";
import "./index.scss";
import InputField from "../../../../components/InputField";
import SvgBack from "../../../../assets/icons/SvgBack";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import LabelWrapper from "../../../../components/LabelWrapper";
import { Calendar } from "primereact/calendar";

const TaxationDetails = () => {
  const { t } = useTranslation();
  const { taxationView, loading } = useSelector(({ taxationMainReducers }) => {
    return {
      loading: taxationMainReducers?.loading,
      taxationView: taxationMainReducers?.taxationView,
    };
  });
  console.log(taxationView.effectiveFrom, "taxationView");
  const navigate = useNavigate();
  const items = [
    { label: t("financeMasters.taxationMaster"), url: "/master/finance/taxation" },
    {
      label: t("financeMasters.taxationDetails"),
      url: "/master/finance/taxation/taxationdetails",
    },
  ];
  const home = { label: t("financeMasters.master") };

  return (
    <div className="grid overall__taxation__details">
      <div className="col-12"></div>
      <div>
        <span onClick={() => navigate(-1)}>
          <SvgBack />
        </span>
        <label className="label_header">{t("financeMasters.taxationDetails")}</label>
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
              value={taxationView.taxCode}
              label={t("financeMasters.taxCode")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              value={taxationView.taxName}
              label={t("financeMasters.taxName")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              value={taxationView.taxRate}
              label={t("financeMasters.taxRate")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
            />
          </div>

          <div className="col-12 md:col-3 lg:col-3">
            <InputField
              value={taxationView.basis}
              label={t("financeMasters.basis")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputField
              value={taxationView.remarks}
              label={t("financeMasters.remarks")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-6 lg:col-6">
            <InputField
              value={taxationView.taxationDescription}
              label={t("financeMasters.taxationDescription")}
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder={t("financeMasters.enter")}
            />
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <LabelWrapper className="calenderlable__container">
              {t("generalMasters.effectiveFrom")}
            </LabelWrapper>
            <Calendar
              showIcon
              value={new Date(taxationView.effectiveFrom)}
              label="Effective From"
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder="Enter"
              dateFormat="yy-mm-dd"
            />
            {/* <InputField
              
            /> */}
          </div>
          <div className="col-12 md:col-3 lg-col-3 input__view__reversal">
            <LabelWrapper className="calenderlable__container">
              {t("generalMasters.effectiveTo")}
            </LabelWrapper>
            <Calendar
              showIcon
              value={new Date(taxationView.effectiveTo)}
              label="Effective To"
              classNames="dropdown__add__sub"
              className="label__sub__add"
              placeholder="Enter"
              dateFormat="yy-mm-dd"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
export default TaxationDetails;
